import { NextResponse, after } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getStudentTargetsForComunicados, checkResponsavelRelationship } from '@/lib/server/notificationHelper'
import { deleteStorageFilesByUrls } from '@/lib/upload/storageServer'

export const dynamic = 'force-dynamic'

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
      let resolvedTurma = null;
      const { data: alunoRes } = await supabase.from('alunos').select('turma, created_at, dados').eq('id', alunoId).maybeSingle();
      if (alunoRes) {
        if (alunoRes.turma) {
          const { data: tData } = await supabase.from('turmas').select('nome').or(`id.eq."${alunoRes.turma}",codigo.eq."${alunoRes.turma}",nome.eq."${alunoRes.turma}"`).maybeSingle();
          resolvedTurma = tData?.nome || alunoRes.turma;
        }

        const dateStr = alunoRes.dados?.data_matricula || alunoRes.dados?.data_inicio || alunoRes.dados?.data_ingresso || alunoRes.created_at;
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
      // Se tiver turma
      if (resolvedTurma) {
        conditions.push(`dados->targetClasses.cs.["${resolvedTurma}"]`);
        conditions.push(`dados->targetClasses.cs.["Todos"]`);
        conditions.push(`dados->targetClasses.cs.["Toda a escola"]`);
        conditions.push(`dados->targetClasses.cs.["Toda a Escola"]`);
        conditions.push(`dados->targetClasses.cs.["Todas"]`);
      }
      // Se tiver aluno especifico
      conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
      
      query = query.or(conditions.join(','));
    } else if (!isFamilyOrStudent) {
       // Se for colaborador
       const perfisAdmin = ['Diretor Geral', 'Administrador', 'Admin', 'Coordenador', 'Coordenadora', 'Secretaria', 'Secretário', 'Auxiliar Administrativo', 'Diretor', 'Diretora'];
       const cargosAdmin = ['Administrador Master', 'Diretor Geral', 'Coordenador', 'Coordenadora', 'Secretaria', 'Secretário', 'Auxiliar Administrativo', 'Diretor', 'Diretora'];
       const isAdmin = perfisAdmin.includes(perfil) || cargosAdmin.includes(cargo);
        if (!isAdmin) {
           const conditions = [];
           conditions.push(`dados->targetClasses.eq."[]"`);
           conditions.push(`dados->targetClasses.is.null`);
           conditions.push(`dados->targetClasses.cs.["Toda a escola"]`);
           conditions.push(`dados->targetClasses.cs.["Toda a Escola"]`);
           conditions.push(`dados->targetClasses.cs.["Todos"]`);
           conditions.push(`dados->targetClasses.cs.["Todas"]`);
           conditions.push(`dados->funcionariosIds.cs.["${user.id}"]`);
           conditions.push(`dados->colaboradoresIds.cs.["${user.id}"]`);
           conditions.push(`dados->>authorId.eq.${user.id}`);
           
           // Identificar turmas e grupos que o colaborador leciona para injetar no filtro
           const { data: myGroups } = await supabase.from('agenda_grupos')
             .select('id, dados')
             .contains('dados->colaboradoresIds', `["${user.id}"]`);
             
           if (myGroups && myGroups.length > 0) {
             const isGlobal = myGroups.some(g => (g.dados?.isGlobalAccess === true || g.dados?.isGlobalAccess === 'true' || g.dados?.isGlobalAccess === 1) && (!g.dados?.ano && !g.dados?.anoLetivo));
             if (isGlobal) {
                conditions.push(`id.not.is.null`); // Vê tudo (acesso global total)
             } else {
                myGroups.forEach(g => {
                  if (g.dados?.nome) conditions.push(`dados->targetClasses.cs.["${g.dados.nome}"]`);
                });
                
                const syncIds = myGroups.filter(g => String(g.dados?.syncId || '').startsWith('sync-') || String(g.id).startsWith('sync-')).map(g => String(g.dados?.syncId || g.id).replace('sync-', ''));
                const names = myGroups.map(g => String(g.dados?.nome || '').trim().toLowerCase());
                
                if (syncIds.length > 0 || names.length > 0) {
                   const { data: myTurmas } = await supabase.from('turmas').select('id, nome');
                   if (myTurmas) {
                      myTurmas.forEach(t => {
                        if (syncIds.includes(String(t.id)) || names.includes(String(t.nome).trim().toLowerCase())) {
                          conditions.push(`dados->targetClasses.cs.["${t.nome}"]`);
                        }
                      });
                   }
                }
             }
           }

           query = query.or(conditions.join(','));
        }
    }

    if (accessStartDate) {
      const adjustedStartDate = new Date(accessStartDate.getTime() - 60000); // 1 min buffer para clock skew
      query = query.gte('created_at', adjustedStartDate.toISOString());
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
         const key = r.aluno_id ? `${r.usuario_id}_${r.aluno_id}` : r.usuario_id;
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
    return NextResponse.json(result)
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
          const { students, directColaboradores } = await getStudentTargetsForComunicados(row.dados)
          
          for (const student of students) {
            if (student.responsaveis_ids.length > 0) {
              allPushPromises.push(
                sendAgendaPushNotification({
                  type: 'momentos',
                  itemId: String(row.id),
                  title: '📸 Novo Momento Publicado!',
                  message: `Novas fotos ou vídeos de ${student.aluno_nome} foram compartilhados com você. Venha conferir!`,
                  targetUserIds: student.responsaveis_ids,
                  targetUrl: '/agenda-digital/momentos',
                  metadata: { aluno_id: student.aluno_id }
                }).catch(err => console.error('Momento Push Error:', err))
              )
            }
          }

          if (directColaboradores && directColaboradores.length > 0) {
            allPushPromises.push(
              sendAgendaPushNotification({
                type: 'momentos',
                itemId: String(row.id),
                title: '📸 Novo Momento Publicado!',
                message: `Novas fotos ou vídeos foram compartilhados com você. Venha conferir!`,
                targetUserIds: directColaboradores,
                targetUrl: '/agenda-digital/momentos'
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
        const { students, directColaboradores } = await getStudentTargetsForComunicados(data.dados);
        const pushPromises = [];
        
        for (const student of students) {
          if (student.responsaveis_ids.length > 0) {
            pushPromises.push(
              sendAgendaPushNotification({
                type: 'momentos',
                itemId: String(data.id),
                title: '📸 Novo Momento Publicado!',
                message: `Novas fotos ou vídeos de ${student.aluno_nome} foram compartilhados com você. Venha conferir!`,
                targetUserIds: student.responsaveis_ids,
                targetUrl: '/agenda-digital/momentos',
                metadata: { aluno_id: student.aluno_id }
              }).catch(err => console.error('Momento Push Error:', err))
            )
          }
        }

        if (directColaboradores && directColaboradores.length > 0) {
          pushPromises.push(
            sendAgendaPushNotification({
              type: 'momentos',
              itemId: String(data.id),
              title: '📸 Novo Momento Publicado!',
              message: `Novas fotos ou vídeos foram compartilhados com você. Venha conferir!`,
              targetUserIds: directColaboradores,
              targetUrl: '/agenda-digital/momentos'
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
    if (!id) return NextResponse.json({ error: 'ID não informado' }, { status: 400 })

    const supabase = await createProtectedClient()

    const { data: mom } = await supabase.from('momentos').select('dados').eq('id', id).single()
    const urlsToDelete: string[] = []
    if (mom && mom.dados?.midia && Array.isArray(mom.dados.midia)) {
      for (const media of mom.dados.midia) {
        if (media.url) urlsToDelete.push(media.url)
      }
    }

    const { error } = await supabase.from('momentos').delete().eq('id', id)
    
    if (error) throw new Error(error.message)
    
    if (urlsToDelete.length > 0) {
      deleteStorageFilesByUrls(urlsToDelete).catch(console.error)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
