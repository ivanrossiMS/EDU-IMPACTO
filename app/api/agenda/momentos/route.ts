import { NextResponse, after } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getStudentTargetsForComunicados, checkResponsavelRelationship } from '@/lib/server/notificationHelper'
import { deleteStorageFilesByUrls } from '@/lib/upload/storageServer'
import { getAlunoTodasTurmasEGrupos } from '@/lib/studentTurmaUtils'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = supabaseServer; // Bypass RLS as we manually enforce strict filtering in this route
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const limit = limitParam ? parseInt(limitParam, 10) : 30
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0
    const alunoId = searchParams.get('aluno_id')
    const idParam = searchParams.get('id')

    // VERIFICAÇÃO DE PERFIL E IDOR
    let isFamilyOrStudent = false;
    const perfil = user.user_metadata?.perfil || '';
    const cargo = user.user_metadata?.cargo || '';
    if (
      perfil === 'Família' || 
      perfil === 'Responsável' || 
      cargo === 'Responsável' || 
      cargo === 'Aluno' || 
      perfil === 'Aluno'
    ) {
      isFamilyOrStudent = true;
    } else {
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('perfil, cargo')
        .eq('id', user.id)
        .maybeSingle();
      if (dbUser && (
        dbUser.perfil === 'Família' || 
        dbUser.perfil === 'Responsável' || 
        dbUser.cargo === 'Responsável' || 
        dbUser.cargo === 'Aluno' || 
        dbUser.perfil === 'Aluno'
      )) {
        isFamilyOrStudent = true;
      }
    }

    if (isFamilyOrStudent) {
      if (!alunoId) {
        return NextResponse.json({ error: 'Acesso negado: ID do aluno não informado.' }, { status: 403 });
      }
      const checkId = user.user_metadata?.responsavel_id || user.user_metadata?.aluno_id || user.id;
      const isOwner = await checkResponsavelRelationship(checkId, alunoId);
      if (!isOwner) {
        return NextResponse.json({ error: 'Acesso negado: Você não tem permissão para visualizar dados deste aluno.' }, { status: 403 });
      }
    }

    let accessStartDate = await getLoggedUserAccessStartDate(true)
    let query = supabase.from('momentos').select('*')

    // Filtragem segura no Backend
    if (isFamilyOrStudent && alunoId) {
      let resolvedTargets: string[] = [];
      const [alunoRes, turmasRes, gruposRes] = await Promise.all([
        supabase.from('alunos').select('*').eq('id', alunoId).maybeSingle(),
        supabase.from('turmas').select('*'),
        supabase.from('agenda_grupos').select('*')
      ]);

      const alunoData = alunoRes.data;
      if (alunoData) {
        const turmasList = (turmasRes.data || []).map(t => ({ id: t.id, nome: t.nome, codigo: t.codigo, ano: t.ano, dados: t.dados }));
        const gruposList = (gruposRes.data || []).map(g => ({ id: g.id, nome: g.nome || g.dados?.nome, alunosIds: g.alunosIds || g.dados?.alunosIds, syncId: g.syncId || g.dados?.syncId, dados: g.dados }));
        
        resolvedTargets = getAlunoTodasTurmasEGrupos(alunoData, turmasList, gruposList);

        const dateStr = alunoData.dados?.data_matricula || alunoData.dados?.data_inicio || alunoData.dados?.data_ingresso || alunoData.created_at;
        if (dateStr) {
          const studentEntryDate = new Date(dateStr);
          if (accessStartDate === null || studentEntryDate > accessStartDate) {
            accessStartDate = studentEntryDate;
          }
        }
      }

      const conditions = [];
      // Momentos públicos para "Toda a escola", "TODOS" ou sem array (empty array)
      conditions.push(`dados->targetClasses.eq."[]"`);
      conditions.push(`dados->targetClasses.is.null`);
      conditions.push(`dados->targetClasses.cs.["Todos"]`);
      conditions.push(`dados->targetClasses.cs.["Toda a escola"]`);
      conditions.push(`dados->targetClasses.cs.["Toda a Escola"]`);
      conditions.push(`dados->targetClasses.cs.["Todas"]`);

      // Se tiver aluno especifico
      conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);

      // Incluir todas as turmas e grupos ativos do aluno no filtro
      resolvedTargets.forEach(target => {
        conditions.push(`dados->targetClasses.cs.["${target}"]`);
      });

      query = query.or(conditions.join(','));
    } else if (!isFamilyOrStudent) {
       // Se for colaborador
        const perfisMasterAdmin = ['administrador master', 'administrador', 'admin', 'diretor geral', 'diretora geral', 'master'];
        const isAdmin = perfisMasterAdmin.some(p => p === perfil.toLowerCase() || p === cargo.toLowerCase());
        
        if (!isAdmin) {
          const candidateUserIds = new Set<string>([String(user.id)]);
          if (user.user_metadata?.uid_legacy) candidateUserIds.add(String(user.user_metadata.uid_legacy));
          if (user.user_metadata?.id) candidateUserIds.add(String(user.user_metadata.id));
          if (user.user_metadata?.colaborador_id) candidateUserIds.add(String(user.user_metadata.colaborador_id));
          if (user.user_metadata?.system_user_id) candidateUserIds.add(String(user.user_metadata.system_user_id));

          const userEmail = (user.email || user.user_metadata?.email || '').trim().toLowerCase();
          const userNome = (user.user_metadata?.nome || '').trim().toLowerCase();

          let sysUserQuery = supabase.from('system_users').select('id, email, nome, dados');
          if (userEmail) {
            sysUserQuery = sysUserQuery.or(`id.eq."${user.id}",email.ilike."${userEmail}"`);
          } else {
            sysUserQuery = sysUserQuery.eq('id', user.id);
          }
          const { data: sysUsers } = await sysUserQuery.limit(5);
          if (sysUsers && sysUsers.length > 0) {
            sysUsers.forEach((su: any) => {
              if (su.id) candidateUserIds.add(String(su.id));
              if (su.dados?.auth_id) candidateUserIds.add(String(su.dados.auth_id));
            });
          }

          const conditions: string[] = [];
          // Momentos globais da escola e equipe escolar
          conditions.push(`dados->targetClasses.eq."[]"`);
          conditions.push(`dados->targetClasses.is.null`);
          conditions.push(`dados->targetClasses.cs.["Toda a escola"]`);
          conditions.push(`dados->targetClasses.cs.["Toda a Escola"]`);
          conditions.push(`dados->targetClasses.cs.["Todos"]`);
          conditions.push(`dados->targetClasses.cs.["Todas"]`);
          conditions.push(`dados->targetClasses.cs.["Equipe Escolar"]`);
          conditions.push(`dados->targetClasses.cs.["Equipe"]`);
          conditions.push(`dados->targetClasses.cs.["Institucional"]`);

          candidateUserIds.forEach(cId => {
            const clean = cId.replace(/^f_?/, '');
            conditions.push(`dados->funcionariosIds.cs.["${cId}"]`);
            conditions.push(`dados->funcionariosIds.cs.["${clean}"]`);
            conditions.push(`dados->funcionariosIds.cs.["f_${clean}"]`);
            conditions.push(`dados->colaboradoresIds.cs.["${cId}"]`);
            conditions.push(`dados->colaboradoresIds.cs.["${clean}"]`);
            conditions.push(`dados->colaboradoresIds.cs.["f_${clean}"]`);
            conditions.push(`dados->>authorId.eq.${cId}`);
            conditions.push(`dados->>authorId.eq.${clean}`);
          });

          // Buscar grupos da agenda e equipes para resolução em memória (robusta)
          const [gruposRes, equipesRes] = await Promise.all([
            supabase.from('agenda_grupos').select('id, dados'),
            supabase.from('agenda_equipes').select('id, dados')
          ]);

          const allGroups = gruposRes.data || [];
          const allEquipes = equipesRes.data || [];
          let hasGlobalStaffAccess = false;
          const matchedGroupNames = new Set<string>();
          const matchedGroupIds = new Set<string>();
          const matchedSyncTurmaIds = new Set<string>();

          allGroups.forEach((g: any) => {
            const gDados = g.dados || {};
            let colabs = gDados.colaboradoresIds || g.colaboradoresIds || [];
            if (typeof colabs === 'string') {
              try { colabs = JSON.parse(colabs); } catch { colabs = []; }
            }
            if (!Array.isArray(colabs)) colabs = [];

            const isMember = colabs.some((cid: any) => {
              const cleanC = String(typeof cid === 'object' ? (cid.id || cid.usuarioId || '') : cid).replace(/^f_?/, '').trim().toLowerCase();
              const cNome = typeof cid === 'object' ? String(cid.nome || '').trim().toLowerCase() : '';
              return Array.from(candidateUserIds).some(uid => {
                const cleanUid = uid.replace(/^f_?/, '').trim().toLowerCase();
                return cleanC === cleanUid || (userEmail && cleanC === userEmail);
              }) || (userNome && cNome && cNome === userNome);
            });

            const isGlobal = (gDados.isGlobalAccess === true || gDados.isGlobalAccess === 'true' || gDados.isGlobalAccess === 1) && (!gDados.ano && !gDados.anoLetivo);

            if (isMember) {
              if (isGlobal) hasGlobalStaffAccess = true;
              const gNome = gDados.nome || g.nome;
              if (gNome) matchedGroupNames.add(gNome);
              matchedGroupIds.add(String(g.id));

              const syncId = String(gDados.syncId || g.syncId || g.id || '');
              if (syncId.startsWith('sync-')) {
                matchedSyncTurmaIds.add(syncId.replace('sync-', ''));
              }
            }
          });

          allEquipes.forEach((e: any) => {
            const eDados = e.dados || {};
            let membros = eDados.membrosIds || eDados.colaboradoresIds || e.membrosIds || e.colaboradoresIds || [];
            if (typeof membros === 'string') {
              try { membros = JSON.parse(membros); } catch { membros = []; }
            }
            if (!Array.isArray(membros)) membros = [];

            const isMember = membros.some((cid: any) => {
              const cleanC = String(typeof cid === 'object' ? (cid.id || cid.usuarioId || '') : cid).replace(/^f_?/, '').trim().toLowerCase();
              const cNome = typeof cid === 'object' ? String(cid.nome || '').trim().toLowerCase() : '';
              return Array.from(candidateUserIds).some(uid => {
                const cleanUid = uid.replace(/^f_?/, '').trim().toLowerCase();
                return cleanC === cleanUid || (userEmail && cleanC === userEmail);
              }) || (userNome && cNome && cNome === userNome);
            });

            if (isMember) {
              const eNome = eDados.nome || e.nome;
              if (eNome) matchedGroupNames.add(eNome);
              matchedGroupIds.add(String(e.id));
            }
          });

          if (hasGlobalStaffAccess) {
            conditions.push(`id.not.is.null`);
          } else {
            matchedGroupNames.forEach(nome => {
              conditions.push(`dados->targetClasses.cs.["${nome}"]`);
              conditions.push(`dados->grupos.cs.["${nome}"]`);
              conditions.push(`dados->targetGrupos.cs.["${nome}"]`);
            });

            matchedGroupIds.forEach(id => {
              const cleanId = id.replace(/^[tg]_?/, '');
              conditions.push(`dados->targetClassesIds.cs.["${id}"]`);
              conditions.push(`dados->targetClassesIds.cs.["${cleanId}"]`);
              conditions.push(`dados->targetClassesIds.cs.["g_${cleanId}"]`);
              conditions.push(`dados->gruposIds.cs.["${id}"]`);
              conditions.push(`dados->gruposIds.cs.["${cleanId}"]`);
            });

            if (matchedSyncTurmaIds.size > 0 || matchedGroupNames.size > 0) {
              const { data: myTurmas } = await supabase.from('turmas').select('id, nome');
              if (myTurmas) {
                myTurmas.forEach(t => {
                  const tId = String(t.id);
                  const tNomeLower = String(t.nome).trim().toLowerCase();
                  if (matchedSyncTurmaIds.has(tId) || Array.from(matchedGroupNames).some(n => n.trim().toLowerCase() === tNomeLower)) {
                    conditions.push(`dados->targetClasses.cs.["${t.nome}"]`);
                    conditions.push(`dados->targetClassesIds.cs.["${t.id}"]`);
                    conditions.push(`dados->targetClassesIds.cs.["t_${t.id}"]`);
                  }
                });
              }
            }
          }

          query = query.or(conditions.join(','));
       }
    }

    if (isFamilyOrStudent && accessStartDate) {
      const adjustedStartDate = new Date(accessStartDate.getTime() - 60000); // 1 min buffer para clock skew
      query = query.gte('created_at', adjustedStartDate.toISOString());
    }

    if (idParam) {
      query = query.eq('id', idParam);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (error) throw new Error(error.message)
    
    const itemIds = data ? data.map((d: any) => String(d.id)) : [];
    let allReads: any[] = [];
  
    if (itemIds.length > 0) {
       const readsRes = await supabase.from('agenda_notification_reads').select('content_id, usuario_id, read_at, aluno_id').in('content_id', itemIds);
       allReads = readsRes.data || [];
    }

    const result = (data || []).map(row => {
      const merged = { ...row, ...(row.dados || {}) }
      
      merged.leituras = merged.leituras && typeof merged.leituras === 'object' && !Array.isArray(merged.leituras) ? merged.leituras : {}
      const itemReads = allReads.filter(r => r.content_id === String(row.id));
      itemReads.forEach(r => {
         const cleanUsuarioId = r.usuario_id ? r.usuario_id.split('#')[0] : r.usuario_id;
         const key = r.aluno_id ? `${cleanUsuarioId}_${r.aluno_id}` : cleanUsuarioId;
         merged.leituras[key] = r.read_at;
      });

      if (merged.midias && Array.isArray(merged.midias)) {
        merged.midias = merged.midias.map((m: any) => {
          if (m.url && m.url.startsWith('data:image/') && m.url.length > 500) {
             m.url = m.thumbnail_url || null; // fallback para thumb se base64 for pesado
          }
          if (m.thumbnail_url && m.thumbnail_url.startsWith('data:image/') && m.thumbnail_url.length > 500) {
             m.thumbnail_url = null;
          }
          return m;
        });
      }
      return merged;
    })
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const perfil = user.user_metadata?.perfil || '';
    const cargo = user.user_metadata?.cargo || '';
    if (perfil === 'Família' || perfil === 'Responsável' || cargo === 'Responsável' || cargo === 'Aluno' || perfil === 'Aluno') {
      return NextResponse.json({ error: 'Acesso negado: Famílias não podem publicar Momentos.' }, { status: 403 });
    }

    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) {
         return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(buildRowAuth)
      console.log(`[API Momentos] Upserting ${rows.length} items...`)
      
      // Obter IDs existentes para não mandar push repetido
      const incomingIds = rows.map((r: any) => r.id)
      const { data: existingRecords } = await supabase
        .from('momentos')
        .select('id')
        .in('id', incomingIds)
        
      const existingIds = new Set((existingRecords || []).map(r => r.id))
      const newRows = rows.filter((r: any) => !existingIds.has(r.id))

      const { error } = await supabase.from('momentos').upsert(rows)
      if (error) {
        console.error('[API Momentos] Upsert Error:', error)
        throw new Error(error.message)
      }

      // Disparar Push APENAS para novos
      after(async () => {
        const allPushPromises: Promise<any>[] = [];
        for (const row of newRows) {
          const targetParams = normalizeMomentoParams(row.dados);
          const { students, directColaboradores } = await getStudentTargetsForComunicados(targetParams);
          
          if (students.length <= 5) {
            for (const student of students) {
              if (student.responsaveis_ids.length > 0) {
                allPushPromises.push(
                  sendAgendaPushNotification({
                    type: 'momentos',
                    itemId: String(row.id),
                    title: '📸 Novo Momento Publicado!',
                    message: `Um novo conteúdo para ${student.aluno_nome} foi compartilhado. Confira!`,
                    targetUserIds: student.responsaveis_ids,
                    targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${row.id}`,
                    metadata: { aluno_id: student.aluno_id, perfil_destino: 'familia', item_id: String(row.id), rota: 'momentos', targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${row.id}` }
                  }).catch(err => console.error('Momento Push Error:', err))
                )
              }
            }
          } else {
            // Momentos para a turma (> 5 alunos): personalizar com o nome de cada aluno
            for (const student of students) {
              if (student.responsaveis_ids && student.responsaveis_ids.length > 0) {
                const nomeAluno = formatFriendlyStudentName(student.aluno_nome)
                allPushPromises.push(
                  sendAgendaPushNotification({
                    type: 'momentos',
                    itemId: String(row.id),
                    title: '📸 Novo Momento Publicado!',
                    message: `Novas fotos e atividades da turma de ${nomeAluno} foram compartilhadas. Confira!`,
                    targetUserIds: student.responsaveis_ids,
                    targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${row.id}`,
                    metadata: { aluno_id: student.aluno_id, perfil_destino: 'familia', item_id: String(row.id), rota: 'momentos', targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${row.id}` }
                  }).catch(err => console.error('Momento Push Error Turma Batch:', err))
                );
              }
            }
          }

          if (directColaboradores && directColaboradores.length > 0) {
            allPushPromises.push(
              sendAgendaPushNotification({
                type: 'momentos',
                itemId: String(row.id),
                title: '📸 Novo Momento Publicado!',
                message: `Um novo conteúdo foi compartilhado. Confira!`,
                targetUserIds: directColaboradores,
                targetUrl: `/agenda-digital/colaborador/momentos?id=${row.id}`,
                metadata: { perfil_destino: 'colaborador', item_id: String(row.id), rota: 'momentos', targetUrl: `/agenda-digital/colaborador/momentos?id=${row.id}` }
              }).catch(err => console.error('Momento Push Error Colab:', err))
            )
          }
        }
        await Promise.allSettled(allPushPromises);
      });

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    
    // Verificar se já existe antes do single upsert
    const { data: existingSingle } = await supabase.from('momentos').select('id').eq('id', row.id).maybeSingle()
    const isNew = !existingSingle

    const { data, error } = await supabase.from('momentos').upsert(row).select().single()
    if (error) {
       console.error('[API Momentos] Single Upsert Error:', error)
       throw new Error(error.message)
    }

    if (isNew) {
      after(async () => {
        const targetParams = normalizeMomentoParams(data.dados);
        const { students, directColaboradores } = await getStudentTargetsForComunicados(targetParams);
        const pushPromises = [];
        
        if (students.length <= 5) {
          for (const student of students) {
            if (student.responsaveis_ids.length > 0) {
              pushPromises.push(
                sendAgendaPushNotification({
                  type: 'momentos',
                  itemId: String(data.id),
                  title: '📸 Novo Momento Publicado!',
                  message: `Um novo conteúdo para ${student.aluno_nome} foi compartilhado. Confira!`,
                  targetUserIds: student.responsaveis_ids,
                  targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${data.id}`,
                  metadata: { aluno_id: student.aluno_id, perfil_destino: 'familia', item_id: String(data.id), rota: 'momentos', targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${data.id}` }
                }).catch(err => console.error('Momento Push Error:', err))
              )
            }
          }
        } else {
          // Momentos para a turma (> 5 alunos): personalizar com o nome de cada aluno
          for (const student of students) {
            if (student.responsaveis_ids && student.responsaveis_ids.length > 0) {
              const nomeAluno = formatFriendlyStudentName(student.aluno_nome)
              pushPromises.push(
                sendAgendaPushNotification({
                  type: 'momentos',
                  itemId: String(data.id),
                  title: '📸 Novo Momento Publicado!',
                  message: `Novas fotos e atividades da turma de ${nomeAluno} foram compartilhadas. Confira!`,
                  targetUserIds: student.responsaveis_ids,
                  targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${data.id}`,
                  metadata: { aluno_id: student.aluno_id, perfil_destino: 'familia', item_id: String(data.id), rota: 'momentos', targetUrl: `/agenda-digital/${student.aluno_id}/momentos?id=${data.id}` }
                }).catch(err => console.error('Momento Push Error Turma:', err))
              );
            }
          }
        }

        if (directColaboradores && directColaboradores.length > 0) {
          pushPromises.push(
            sendAgendaPushNotification({
              type: 'momentos',
              itemId: String(data.id),
              title: '📸 Novo Momento Publicado!',
              message: `Um novo conteúdo foi compartilhado. Confira!`,
              targetUserIds: directColaboradores,
              targetUrl: `/agenda-digital/colaborador/momentos?id=${data.id}`,
              metadata: { perfil_destino: 'colaborador', item_id: String(data.id), rota: 'momentos', targetUrl: `/agenda-digital/colaborador/momentos?id=${data.id}` }
            }).catch(err => console.error('Momento Push Error Colab:', err))
          )
        }
        await Promise.allSettled(pushPromises);
      });
    }

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    console.error('[API Momentos] General Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    dados: rest,
  }
}

function normalizeMomentoParams(rawDados: any) {
  const inner = rawDados?.dados || {}
  const targetClasses = rawDados?.targetClasses || rawDados?.turmas || inner?.targetClasses || inner?.turmas || []
  const grupos = rawDados?.grupos || inner?.grupos || rawDados?.targetGrupos || inner?.targetGrupos || []
  const funcionariosIds = rawDados?.funcionariosIds || rawDados?.colaboradoresIds || inner?.funcionariosIds || inner?.colaboradoresIds || []
  const alunosIds = rawDados?.alunosIds || rawDados?.targetStudents || inner?.alunosIds || inner?.targetStudents || []
  const isTodos = Array.isArray(targetClasses) && targetClasses.some((t: any) => typeof t === 'string' && (t.toLowerCase().includes('toda a escola') || t.toLowerCase().includes('todos')))

  return {
    turmas: targetClasses,
    targetClasses,
    grupos,
    alunosIds,
    funcionariosIds,
    colaboradoresIds: funcionariosIds,
    destino: isTodos ? 'todos' : (rawDados?.destino || inner?.destino || 'selecionados')
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const perfil = user.user_metadata?.perfil || '';
    const cargo = user.user_metadata?.cargo || '';
    if (perfil === 'Família' || perfil === 'Responsável' || cargo === 'Responsável' || cargo === 'Aluno' || perfil === 'Aluno') {
      return NextResponse.json({ error: 'Acesso negado: Famílias não podem apagar Momentos.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const idsParam = searchParams.get('ids')

    let initialIds: string[] = []
    if (idsParam) {
      initialIds = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    } else if (id) {
      initialIds = [id.trim()]
    }

    if (initialIds.length === 0) {
      return NextResponse.json({ error: 'ID não informado' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    const { data: momentosList, error: fetchErr } = await adminClient
      .from('momentos')
      .select('id, dados')
      .in('id', initialIds)

    if (fetchErr) {
      console.error('Erro ao buscar momentos para exclusão:', fetchErr)
    }

    const urlsToDelete: string[] = []
    if (momentosList && momentosList.length > 0) {
      for (const mom of momentosList) {
        const midias = mom.dados?.midia || mom.dados?.midias
        if (Array.isArray(midias)) {
          for (const media of midias) {
            if (media.url) urlsToDelete.push(media.url)
            if (media.thumbnail_url) urlsToDelete.push(media.thumbnail_url)
          }
        }
      }
    }

    // Cascata: excluir leituras associadas a estes momentos
    try {
      await adminClient
        .from('agenda_notification_reads')
        .delete()
        .in('content_id', initialIds);
    } catch (err: any) {
      console.error('Erro ao deletar leituras dos momentos:', err);
    }

    // Excluir os momentos usando adminClient (bypass RLS)
    const { error: deleteError, count } = await adminClient
      .from('momentos')
      .delete({ count: 'exact' })
      .in('id', initialIds)

    if (deleteError) {
      console.error('Erro ao excluir momentos do banco:', deleteError)
      throw new Error(deleteError.message)
    }

    if (urlsToDelete.length > 0) {
      deleteStorageFilesByUrls(urlsToDelete).catch(err => console.error('Erro ao deletar arquivos de mídia do storage:', err))
    }

    return NextResponse.json({ ok: true, deletedCount: count ?? initialIds.length }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
