import { NextResponse, after } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { requireAuth } from '@/lib/server/authGuard'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getStudentTargetsForComunicados, checkResponsavelRelationship } from '@/lib/server/notificationHelper'
import { deleteStorageFilesByUrls } from '@/lib/upload/storageServer'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

function normalizeRow(row: any) {
  const merged = { ...row, ...(row.dados || {}) }
  // Ensure critical fields are always safe types
  merged.leituras = merged.leituras && typeof merged.leituras === 'object' && !Array.isArray(merged.leituras) ? merged.leituras : {}
  merged.ciencias = merged.ciencias && typeof merged.ciencias === 'object' && !Array.isArray(merged.ciencias) ? merged.ciencias : {}
  merged.turmas = Array.isArray(merged.turmas) ? merged.turmas : []
  merged.alunosIds = Array.isArray(merged.alunosIds) ? merged.alunosIds : []
  merged.status = merged.status || 'enviado'
  merged.prioridade = merged.prioridade || 'normal'
  merged.fixado = Boolean(merged.fixado)
  merged.exigeCiencia = Boolean(merged.exigeCiencia)
  merged.permiteResposta = Boolean(merged.permiteResposta)
  merged.anexos = Array.isArray(merged.anexos) ? merged.anexos : []
  // Map DB column names to app field names
  if (!merged.conteudo && merged.texto) merged.conteudo = merged.texto
  if (!merged.dataEnvio && merged.data) merged.dataEnvio = merged.data
  return merged
}
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const authClient = await createProtectedClient();
  const supabase = authClient;
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const turmaId = searchParams.get('turma_id');
  const alunoId = searchParams.get('aluno_id');
  const idParam = searchParams.get('id');
  const sinceParam = searchParams.get('since');
  
  // VERIFICAÇÃO DE PERFIL — usa user_metadata para evitar round-trip ao banco na maioria dos casos
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
  } else if (!perfil && !cargo) {
    // Só consulta o banco se os metadados estão vazios (caso raro)
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('perfil, cargo')
      .eq('id', user.id)
      .maybeSingle();
    
    const dbPerfil = dbUser?.perfil || '';
    const dbCargo = dbUser?.cargo || '';
    if (
      dbPerfil === 'Família' || 
      dbPerfil === 'Responsável' || 
      dbCargo === 'Responsável' || 
      dbCargo === 'Aluno' || 
      dbPerfil === 'Aluno'
    ) {
      isFamilyOrStudent = true;
    }
  }

  let isAdmin = false;
  const perfisAdmin = ['Diretor Geral', 'Administrador', 'Admin'];
  const cargosAdmin = ['Administrador Master', 'Diretor Geral'];
  
  if (perfisAdmin.includes(perfil) || cargosAdmin.includes(cargo)) {
    isAdmin = true;
  } else if (!perfil && !cargo) {
    // Buscar banco se metadata falhar para checar admin
    const { data: dbUserAdmin } = await supabase
      .from('system_users')
      .select('perfil, cargo')
      .eq('id', user.id)
      .maybeSingle();
    
    if (dbUserAdmin && (perfisAdmin.includes(dbUserAdmin.perfil) || cargosAdmin.includes(dbUserAdmin.cargo))) {
      isAdmin = true;
    }
  }

  // BLINDAGEM IDOR: Se for família, DEVE informar um aluno_id que lhe pertença
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

  // ── Resolução paralela de turma, grupos e data de acesso ──────────────────
  // Antes: 4 queries sequenciais. Agora: 2 batches paralelos.
  let resolvedTurmas: string[] = [];
  if (turmaId) resolvedTurmas.push(turmaId);
  let studentGroups: string[] = [];
  let accessStartDate = await getLoggedUserAccessStartDate();

  if (alunoId) {
    // Batch 1: busca dados do aluno, todas as turmas e todos os grupos ao mesmo tempo
    const [alunoRes, turmasRes, gruposRes] = await Promise.all([
      supabase.from('alunos').select('id, turma, created_at, dados').eq('id', alunoId).maybeSingle(),
      supabase.from('turmas').select('*'),
      supabase.from('agenda_grupos').select('id, dados, nome, alunosIds'),
    ]);

    const alunoData = alunoRes.data;
    const allTurmas = turmasRes.data || [];
    const allGrupos = gruposRes.data || [];

    if (alunoData) {
      // 1. Resolver todas as turmas que o aluno está cursando (incluindo turmas regulares e Integral/Intermediário)
      allTurmas.forEach((t: any) => {
        if (isAlunoCursandoTurma(alunoData, t, t.ano)) {
          if (t.nome) resolvedTurmas.push(t.nome);
          if (t.id) resolvedTurmas.push(String(t.id));
          if (t.codigo) resolvedTurmas.push(String(t.codigo));
        }
      });

      if (alunoData.turma && !resolvedTurmas.includes(alunoData.turma)) {
        resolvedTurmas.push(alunoData.turma);
      }

      // 2. Resolver data de acesso
      const dateStr = alunoData.dados?.data_matricula || alunoData.dados?.data_inicio || alunoData.dados?.data_ingresso || alunoData.created_at;
      if (dateStr) {
        const studentEntryDate = new Date(dateStr);
        if (accessStartDate === null || studentEntryDate > accessStartDate) {
          accessStartDate = studentEntryDate;
        }
      }

      // 3. Resolver grupos do aluno em agenda_grupos
      const cleanId = alunoId.replace(/^(a_|_ALU)/, '');
      allGrupos.forEach((g: any) => {
        const gAlunosIds = g.alunosIds || g.dados?.alunosIds || [];
        const isMember = gAlunosIds.some((aId: string) => String(aId).replace(/^(a_|_ALU)/, '') === cleanId);

        const gTurmaRef = allTurmas.find((t: any) => (g.syncId && (g.syncId === `sync-${t.id}` || g.id === `sync-${t.id}`)) || t.nome === g.nome || t.nome === g.dados?.nome);
        const isCursandoGrupo = gTurmaRef ? isAlunoCursandoTurma(alunoData, gTurmaRef, gTurmaRef.ano) : false;

        if (isMember || isCursandoGrupo) {
          const gNome = g.nome || g.dados?.nome;
          if (gNome && !studentGroups.includes(gNome)) {
            studentGroups.push(gNome);
          }
        }
      });
    }
  } else if (turmaId) {
    const { data: tData } = await supabase.from('turmas').select('id, nome').or(`id.eq."${turmaId}",codigo.eq."${turmaId}",nome.eq."${turmaId}"`).maybeSingle();
    if (tData) {
      if (tData.nome) resolvedTurmas.push(tData.nome);
      if (tData.id) resolvedTurmas.push(String(tData.id));
    } else {
      resolvedTurmas.push(turmaId);
    }
  }

  let query = supabase.from('comunicados').select('*');

  if (accessStartDate) {
    const adjustedStartDate = new Date(accessStartDate.getTime() - 60000); // 1 min buffer para clock skew
    query = query.gte('data', adjustedStartDate.toISOString());
  }
  
  if (turmaId || alunoId) {
    const conditions = [`destino.eq.todos`];
    const uniqueTurmas = Array.from(new Set(resolvedTurmas.filter(Boolean)));
    uniqueTurmas.forEach(tName => {
      conditions.push(`dados->turmas.cs.["${tName}"]`);
    });
    
    studentGroups.forEach(gNome => {
      conditions.push(`dados->grupos.cs.["${gNome}"]`);
    });
    if (alunoId) {
      conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
    }
    query = query.or(conditions.join(','));
  } else if (!isAdmin && !isFamilyOrStudent) {
    // Colaborador sem aluno_id: garante que comunicados direcionados diretamente a ele ou ao seu grupo apareçam.
    const candidateUserIds = new Set<string>([String(user.id)])
    if (user.user_metadata?.uid_legacy) candidateUserIds.add(String(user.user_metadata.uid_legacy))
    if (user.user_metadata?.id) candidateUserIds.add(String(user.user_metadata.id))

    const userEmail = (user.email || user.user_metadata?.email || '').trim().toLowerCase()
    let sysUserQuery = supabaseServer.from('system_users').select('id, email, nome')
    if (userEmail) {
      sysUserQuery = sysUserQuery.or(`id.eq."${user.id}",email.ilike."${userEmail}"`)
    } else {
      sysUserQuery = sysUserQuery.eq('id', user.id)
    }
    const { data: sysUsers } = await sysUserQuery.limit(5)
    if (sysUsers && sysUsers.length > 0) {
      sysUsers.forEach((su: any) => {
        if (su.id) candidateUserIds.add(String(su.id))
      })
    }

    const colaboradorConditions = [
      `destino.eq.todos`
    ];

    candidateUserIds.forEach(cId => {
      colaboradorConditions.push(`dados->"funcionariosIds".cs.["${cId}"]`)
      colaboradorConditions.push(`dados->"colaboradoresIds".cs.["${cId}"]`)
      colaboradorConditions.push(`dados->"funcionariosIds".cs.["f_${cId}"]`)
      colaboradorConditions.push(`dados->"colaboradoresIds".cs.["f_${cId}"]`)
      colaboradorConditions.push(`dados->>autorId.eq.${cId}`)
    })

    // Buscar grupos da agenda e resolver membros em memória para robustez total
    const { data: allGroups } = await supabaseServer.from('agenda_grupos').select('id, dados')
    const matchedGroupNames = new Set<string>()
    const matchedTurmaSyncIds = new Set<string>()
    let hasGlobalStaffAccess = false

    if (allGroups && allGroups.length > 0) {
      allGroups.forEach((g: any) => {
        const gDados = g.dados || {}
        let colabs = gDados.colaboradoresIds || g.colaboradoresIds || []
        if (typeof colabs === 'string') {
          try { colabs = JSON.parse(colabs) } catch { colabs = [] }
        }
        if (!Array.isArray(colabs)) colabs = []

        const isMember = colabs.some((cId: any) => {
          const cleanCId = String(cId).replace(/^f_?/, '').trim().toLowerCase()
          return Array.from(candidateUserIds).some(uid => {
            const cleanUid = String(uid).replace(/^f_?/, '').trim().toLowerCase()
            return cleanCId === cleanUid || (userEmail && cleanCId === userEmail)
          })
        })

        const isGlobal = (gDados.isGlobalAccess === true || gDados.isGlobalAccess === 'true' || gDados.isGlobalAccess === 1) && (!gDados.ano && !gDados.anoLetivo)
        if (isMember) {
          if (isGlobal) {
            hasGlobalStaffAccess = true
          }
          const gNome = gDados.nome || g.nome
          if (gNome) matchedGroupNames.add(gNome)
          
          const syncId = String(gDados.syncId || g.syncId || g.id || '')
          if (syncId.startsWith('sync-')) {
            matchedTurmaSyncIds.add(syncId.replace('sync-', ''))
          }
        }
      })
    }

    if (hasGlobalStaffAccess) {
      colaboradorConditions.push(`id.not.is.null`)
    } else {
      matchedGroupNames.forEach(gNome => {
        colaboradorConditions.push(`dados->grupos.cs.["${gNome}"]`)
      })

      if (matchedTurmaSyncIds.size > 0 || matchedGroupNames.size > 0) {
        const { data: myTurmas } = await supabaseServer.from('turmas').select('id, nome')
        if (myTurmas) {
          myTurmas.forEach((t: any) => {
            const tId = String(t.id)
            const tNomeLower = String(t.nome || '').trim().toLowerCase()
            if (matchedTurmaSyncIds.has(tId) || Array.from(matchedGroupNames).some(gn => gn.trim().toLowerCase() === tNomeLower)) {
              colaboradorConditions.push(`dados->turmas.cs.["${t.nome}"]`)
            }
          })
        }
      }
    }

    query = query.or(colaboradorConditions.join(','))
  }
  
  if (idParam) {
    query = query.eq('id', idParam);
  }
  
  if (sinceParam) {
    query = query.gt('created_at', sinceParam);
  }

  // Ocultar envios individuais de relatorios para admins e colaboradores no feed (eles veem apenas o resumo/pai)
  if (!isFamilyOrStudent && !idParam && !alunoId) {
    query = query.not('id', 'like', 'AD-COM-REL-STU-%');
  }
  
  query = query.order('data', { ascending: false });
  
  if (limitParam) {
     const limit = parseInt(limitParam);
     const offset = offsetParam ? parseInt(offsetParam) : 0;
     query = query.range(offset, offset + limit - 1);
  } else {
     query = query.limit(30);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const itemIds = data ? data.map((d: any) => String(d.id)) : [];
  let allReads: any[] = [];
  let allCiencias: any[] = [];

  if (itemIds.length > 0) {
     const [readsRes, cienciasRes] = await Promise.all([
        supabaseServer.from('agenda_notification_reads').select('content_id, usuario_id, read_at, aluno_id').in('content_id', itemIds),
        supabaseServer.from('agenda_ciencias').select('content_id, usuario_id, ciente_em, aluno_id').in('content_id', itemIds)
     ]);
     allReads = readsRes.data || [];
     allCiencias = cienciasRes.data || [];

     // Fetch reads for dynamic STU reports related to COLAB reports
     const colabs = data.filter((d: any) => d.id && String(d.id).startsWith('AD-COM-REL-COLAB-'));
     if (colabs.length > 0) {
       const colabReadsPromises = colabs.map(async (colab: any) => {
         try {
           const dateStr = colab.created_at || (colab.dados && colab.dados.dataEnvio);
           if (!dateStr) return null;
           const createdDate = new Date(dateStr);
           if (isNaN(createdDate.getTime())) return null;
           
           const minDate = new Date(createdDate.getTime() - 2 * 60000).toISOString();
           const maxDate = new Date(createdDate.getTime() + 2 * 60000).toISOString();
           const autorId = colab.dados && colab.dados.autorId;
           if (!autorId) return null;
           
           const { data: stus } = await supabaseServer.from('comunicados')
             .select('id, dados')
             .ilike('id', 'AD-COM-REL-STU-%')
             .gte('created_at', minDate)
             .lte('created_at', maxDate);
             
           const filteredStus = (stus || []).filter((s: any) => s.dados && s.dados.autorId === autorId);
           if (filteredStus.length === 0) return null;
           
           const { data: stuReads } = await supabaseServer.from('agenda_notification_reads')
             .select('content_id, usuario_id, read_at, aluno_id')
             .in('content_id', filteredStus.map((s: any) => s.id));
             
           return { colabId: colab.id, reads: stuReads || [] };
         } catch(e) {
           console.error('Error fetching dynamic reads:', e);
           return null;
         }
       });
       
       const colabReadsResults = await Promise.all(colabReadsPromises);
       for (const res of colabReadsResults) {
         if (!res) continue;
         for (const r of res.reads) {
           allReads.push({
             content_id: res.colabId,
             usuario_id: r.usuario_id,
             read_at: r.read_at,
             aluno_id: r.aluno_id
           });
         }
       }
     }
  }

  const normalized = (data || []).map((row: any) => {
     const merged = normalizeRow(row);
     
     // Merge das novas tabelas sobre o que eventualmente já estava no JSON (fallback para históricos)
     const itemReads = allReads.filter(r => r.content_id === String(row.id));
     itemReads.forEach(r => {
        const cleanUsuarioId = r.usuario_id ? r.usuario_id.split('#')[0] : r.usuario_id;
        const key = r.aluno_id ? `${cleanUsuarioId}_${r.aluno_id}` : cleanUsuarioId;
        merged.leituras[key] = r.read_at;
     });

     const itemCiencias = allCiencias.filter(c => c.content_id === String(row.id));
     itemCiencias.forEach(c => {
        const cleanUsuarioId = c.usuario_id ? c.usuario_id.split('#')[0] : c.usuario_id;
        const key = c.aluno_id ? `${cleanUsuarioId}_${c.aluno_id}` : cleanUsuarioId;
        merged.ciencias[key] = c.ciente_em;
     });

     return merged;
  });

  let filtered = normalized;
  if (isFamilyOrStudent) {
    filtered = normalized.filter((c: any) => c.destino !== 'interno');
  } else if (!isAdmin) {
    filtered = normalized.filter((c: any) => !c.isSaudacao && !c.dados?.isSaudacao && c.titulo !== 'Mensagem de Boas-vindas');
  }

  // Optimization disabled: Modals rely on the complete payload
  // if (!idParam) {
  //   filtered = filtered.map((c: any) => {
  //     delete c.conteudo;
  //     delete c.texto;
  //     delete c.anexos;
  //     if (c.dados) {
  //       delete c.dados.conteudo;
  //       delete c.dados.texto;
  //       delete c.dados.anexos;
  //       delete c.dados.respostas;
  //     }
  //     return c;
  //   });
  // }

  return NextResponse.json(filtered, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const authClient = await createProtectedClient();
  const supabase = authClient;

  const perfil = user.user_metadata?.perfil || '';
  const cargo = user.user_metadata?.cargo || '';
  if (perfil === 'Família' || perfil === 'Responsável' || cargo === 'Responsável' || cargo === 'Aluno' || perfil === 'Aluno') {
    return NextResponse.json({ error: 'Acesso negado: Famílias e Alunos não podem criar comunicados.' }, { status: 403 });
  }

  console.log("==> POST /api/comunicados CALLED!");
  try {
    const body = await request.json()
    console.log("==> POST body length:", Array.isArray(body) ? body.length : 'not array');
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ ok: true, count: 0 })
      }
      
      const builtRows = body.map(c => buildRow(c))
      const rows = await Promise.all(builtRows.map(async r => await enrichGruposRecipients(r)))
      const { error: upsertError } = await supabase.from('comunicados').upsert(rows)
      if (upsertError) {
        console.error("==> UPSERT ERROR:", upsertError);
        return NextResponse.json({ error: upsertError.message }, { status: 400 })
      }
      console.log("==> UPSERT SUCCESS");
      
      after(async () => {
        const allPushPromises = [];
        for (const row of rows) {
          const isInterno = row.destino === 'interno';
          const { students, directColaboradores } = await getStudentTargetsForComunicados(row.dados)
          
          if (!isInterno) {
            if (students.length <= 5) {
              for (const student of students) {
                if (student.responsaveis_ids.length > 0) {
                  allPushPromises.push(
                    sendAgendaPushNotification({
                      type: 'comunicados',
                      itemId: String(row.id),
                      title: `📢 Comunicado: ${row.titulo}`,
                      message: `${row.autor} enviou uma mensagem para ${student.aluno_nome}`,
                      targetUserIds: student.responsaveis_ids,
                      targetUrl: `/agenda-digital/${student.aluno_id}/comunicados?id=${row.id}`,
                      metadata: { aluno_id: student.aluno_id, perfil_destino: 'familiar', item_id: String(row.id), rota: 'comunicados' }
                    }).catch(err => console.error("Push Error:", err))
                  );
                }
              }
            } else {
              const allResponsaveis = Array.from(
                new Set(students.flatMap(s => s.responsaveis_ids))
              ).filter(Boolean);
              if (allResponsaveis.length > 0) {
                allPushPromises.push(
                  sendAgendaPushNotification({
                    type: 'comunicados',
                    itemId: String(row.id),
                    title: `📢 Comunicado: ${row.titulo}`,
                    message: `${row.autor} enviou um novo comunicado escolar. Confira!`,
                    targetUserIds: allResponsaveis,
                    targetUrl: `/agenda-digital?redirect=comunicados&id=${row.id}`,
                    metadata: { perfil_destino: 'familiar', item_id: String(row.id), rota: 'comunicados' }
                  }).catch(err => console.error("Push Error Batch:", err))
                );
              }
            }
          }

          if (directColaboradores.length > 0) {
            allPushPromises.push(
              sendAgendaPushNotification({
                type: 'comunicados',
                itemId: String(row.id),
                title: `📢 Comunicado: ${row.titulo}`,
                message: `Você tem uma nova mensagem enviada por ${row.autor}.`,
                targetUserIds: directColaboradores,
                targetUrl: `/agenda-digital/colaborador/comunicados?id=${row.id}`,
                metadata: { perfil_destino: 'colaborador', item_id: String(row.id), rota: 'comunicados', targetUrl: `/agenda-digital/colaborador/comunicados?id=${row.id}` }
              }).catch(err => console.error("Push Error Colab:", err))
            );
          }
        }
        await Promise.allSettled(allPushPromises);
      });
      
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const builtRow = buildRow(body)
    const row = await enrichGruposRecipients(builtRow)
    const { data, error } = await supabase.from('comunicados').upsert(row).select().single()
    if (error) {
      console.error("UPSERT SINGLE ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    // 1. Criar Cobrança Asaas se existir (Pseudo-Rollback)
    let cobrancaError = false;
    let cobrancaErrorMessage = '';
    
    if (body.cobranca && data.destino !== 'interno') {
       try {
         const cobrancaObj = {
           comunicado_id: String(data.id),
           titulo: body.cobranca.titulo,
           valor: parseFloat(body.cobranca.valor),
           vencimento: body.cobranca.vencimento
         }
         
         const { data: cobrancaSalva, error: cobrancaErr } = await supabase.from('agenda_cobrancas').insert(cobrancaObj).select().single()
         
         if (cobrancaErr) {
            cobrancaError = true;
            cobrancaErrorMessage = cobrancaErr.message;
         } else if (cobrancaSalva) {
            const { students } = await getStudentTargetsForComunicados(data.dados);
            const destinatariosToInsert = students.map((s: any) => ({
              cobranca_id: cobrancaSalva.id,
              destinatario_id: s.aluno_id,
              destinatario_nome: s.aluno_nome,
              status: 'PENDING'
            }))
            
            if (destinatariosToInsert.length > 0) {
               const { error: destErr } = await supabase.from('agenda_cobrancas_destinatarios').insert(destinatariosToInsert)
               if (destErr) {
                 cobrancaError = true;
                 cobrancaErrorMessage = destErr.message;
               }
            }
         }
       } catch (err: any) {
         console.error('Erro ao salvar cobrança anexada:', err)
         cobrancaError = true;
         cobrancaErrorMessage = err.message || 'Erro desconhecido ao salvar cobrança';
       }
    }

    // 2. Se a cobrança falhou, faz Rollback do Comunicado e aborta!
    if (cobrancaError) {
      await supabase.from('comunicados').delete().eq('id', data.id);
      console.error("ROLLBACK APLICADO: Comunicado deletado pois a cobrança falhou.", cobrancaErrorMessage);
      return NextResponse.json({ error: `Falha ao criar cobrança anexada. O comunicado foi cancelado. Erro: ${cobrancaErrorMessage}` }, { status: 400 });
    }

    // 3. Disparar Push em background apenas se tudo deu certo
    after(async () => {
      const isInterno = data.destino === 'interno';
      const { students, directColaboradores } = await getStudentTargetsForComunicados(data.dados);
      console.log(`[Push Comunicado][${data.id}] students=${students.length} colaboradores=${directColaboradores.length} destino=${data.destino} funcionariosIds=${JSON.stringify(data.dados?.funcionariosIds || [])}`);
      const pushPromises = [];
      
      if (!isInterno) {
        if (students.length <= 5) {
          for (const student of students) {
            if (student.responsaveis_ids.length > 0) {
              pushPromises.push(
                sendAgendaPushNotification({
                  type: 'comunicados',
                  itemId: String(data.id),
                  title: `📢 Comunicado: ${data.titulo}`,
                  message: `${data.autor} enviou uma mensagem para ${student.aluno_nome}`,
                  targetUserIds: student.responsaveis_ids,
                  targetUrl: `/agenda-digital/${student.aluno_id}/comunicados?id=${data.id}`,
                  metadata: { aluno_id: student.aluno_id, perfil_destino: 'familiar', item_id: String(data.id), rota: 'comunicados' }
                }).catch(err => console.error("Push Error:", err))
              );
            }
          }
        } else {
          const allResponsaveis = Array.from(
            new Set(students.flatMap(s => s.responsaveis_ids))
          ).filter(Boolean);
          if (allResponsaveis.length > 0) {
            pushPromises.push(
              sendAgendaPushNotification({
                type: 'comunicados',
                itemId: String(data.id),
                title: `📢 Comunicado: ${data.titulo}`,
                message: `${data.autor} enviou um novo comunicado escolar. Confira!`,
                targetUserIds: allResponsaveis,
                targetUrl: `/agenda-digital?redirect=comunicados&id=${data.id}`,
                metadata: { perfil_destino: 'familiar', item_id: String(data.id), rota: 'comunicados' }
              }).catch(err => console.error("Push Error Batch:", err))
            );
          }
        }
      }

      if (directColaboradores.length > 0) {
        console.log(`[Push Comunicado][${data.id}] Enviando push para ${directColaboradores.length} colaboradores:`, directColaboradores.slice(0, 10));
        pushPromises.push(
          sendAgendaPushNotification({
            type: 'comunicados',
            itemId: String(data.id),
            title: `📢 Comunicado: ${data.titulo}`,
            message: `Você tem uma nova mensagem enviada por ${data.autor}.`,
            targetUserIds: directColaboradores,
            targetUrl: `/agenda-digital/colaborador/comunicados?id=${data.id}`,
            metadata: { perfil_destino: 'colaborador', item_id: String(data.id), rota: 'comunicados', targetUrl: `/agenda-digital/colaborador/comunicados?id=${data.id}` }
          }).catch(err => console.error("Push Error Colab:", err))
        );
      } else {
        console.log(`[Push Comunicado][${data.id}] Nenhum colaborador para push. dados.funcionariosIds=${JSON.stringify(data.dados?.funcionariosIds)}, dados.colaboradoresIds=${JSON.stringify(data.dados?.colaboradoresIds)}`);
      }
      
      await Promise.allSettled(pushPromises);
    });

    return NextResponse.json(normalizeRow(data), { status: 201 })
  } catch (e: any) {
    console.error("POST CATCH ERROR:", e);
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const authClient = await createProtectedClient();
  const supabase = authClient;

  const perfil = user.user_metadata?.perfil || '';
  const cargo = user.user_metadata?.cargo || '';
  if (perfil === 'Família' || perfil === 'Responsável' || cargo === 'Responsável' || cargo === 'Aluno' || perfil === 'Aluno') {
    return NextResponse.json({ error: 'Acesso negado: Permissão insuficiente.' }, { status: 403 });
  }

  try {
    const { id, dados } = await request.json()
    if (!id || !dados) return NextResponse.json({ error: 'id and dados required' }, { status: 400 })

    const { data, error } = await supabase.from('comunicados').update({ dados }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json(normalizeRow(data))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const perfil = user.user_metadata?.perfil || '';
  const cargo = user.user_metadata?.cargo || '';
  if (perfil === 'Família' || perfil === 'Responsável' || cargo === 'Responsável' || cargo === 'Aluno' || perfil === 'Aluno') {
    return NextResponse.json({ error: 'Acesso negado: Permissão insuficiente.' }, { status: 403 });
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
    return NextResponse.json({ error: 'id or ids required' }, { status: 400 })
  }

  const adminClient = getAdminClient()

  const { data: comunicados, error: fetchError } = await adminClient
    .from('comunicados')
    .select('id, dados, created_at, titulo')
    .in('id', initialIds)

  if (fetchError) {
    console.error('Erro ao buscar comunicados para exclusão:', fetchError)
  }

  const urlsToDelete: string[] = []
  const idsToDelete = new Set<string>(initialIds)

  if (comunicados) {
    for (const com of comunicados) {
      if (com.dados?.anexos && Array.isArray(com.dados.anexos)) {
        urlsToDelete.push(...com.dados.anexos)
      }

      if (com.id && String(com.id).startsWith('AD-COM-REL-COLAB-')) {
        const autorId = com.dados?.autorId;
        const dateStr = com.created_at || com.dados?.dataEnvio;
        if (autorId && dateStr) {
          const createdDate = new Date(dateStr);
          if (!isNaN(createdDate.getTime())) {
            const minDate = new Date(createdDate.getTime() - 2 * 60000).toISOString();
            const maxDate = new Date(createdDate.getTime() + 2 * 60000).toISOString();
            
            const { data: stus } = await adminClient.from('comunicados')
              .select('id, dados, titulo')
              .ilike('id', 'AD-COM-REL-STU-%')
              .gte('created_at', minDate)
              .lte('created_at', maxDate);
            
            if (stus) {
              const colabTitulo = (com.titulo || '').replace('Relatório: ', '');
              
              const relatedStus = stus.filter((s: any) => {
                if (!s.dados || s.dados.autorId !== autorId) return false;
                // Tentar garantir que seja do mesmo lote verificando prefixo
                if (colabTitulo && s.titulo) {
                  if (!s.titulo.includes(colabTitulo)) return false;
                }
                return true;
              });

              for (const stu of relatedStus) {
                idsToDelete.add(stu.id);
                if (stu.dados?.anexos && Array.isArray(stu.dados.anexos)) {
                  urlsToDelete.push(...stu.dados.anexos);
                }
              }
            }
          }
        }
      }
    }
  }

  const finalIdsToDelete = Array.from(idsToDelete)

  // 1. Buscar eventuais anexos em respostas de comunicados antes de deletar
  try {
    const { data: respostas } = await adminClient
      .from('comunicados_respostas')
      .select('arquivo_url, audio_url')
      .in('comunicado_id', finalIdsToDelete);
    if (respostas) {
      for (const resp of respostas) {
        if (resp.arquivo_url) urlsToDelete.push(resp.arquivo_url);
        if (resp.audio_url) urlsToDelete.push(resp.audio_url);
      }
    }
  } catch (err) {
    console.error('Erro ao verificar anexos de comunicados_respostas:', err);
  }

  // 2. Cascata: remover registros em tabelas filhas/associadas
  await Promise.allSettled([
    adminClient.from('comunicados_respostas').delete().in('comunicado_id', finalIdsToDelete),
    adminClient.from('agenda_notification_reads').delete().in('content_id', finalIdsToDelete),
    adminClient.from('agenda_ciencias').delete().in('content_id', finalIdsToDelete),
    adminClient.from('agenda_cobrancas').delete().in('comunicado_id', finalIdsToDelete),
  ]);

  // 3. Excluir comunicados do banco com privilégio de admin
  const { error: deleteError, count } = await adminClient
    .from('comunicados')
    .delete({ count: 'exact' })
    .in('id', finalIdsToDelete);

  if (deleteError) {
    console.error('Erro ao deletar comunicados do banco:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // 4. Limpeza assíncrona de arquivos do Storage
  if (urlsToDelete.length > 0) {
    deleteStorageFilesByUrls(urlsToDelete).catch(err => console.error('Erro ao deletar arquivos do storage:', err));
  }

  return NextResponse.json({ ok: true, deletedCount: count ?? finalIdsToDelete.length }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

// Removed deprecated config export

async function enrichGruposRecipients(row: any) {
  if (!row.dados?.grupos || !Array.isArray(row.dados.grupos) || row.dados.grupos.length === 0) {
    return row;
  }
  try {
    const [gruposRes, equipesRes] = await Promise.allSettled([
      supabaseServer.from('agenda_grupos').select('id, dados, nome'),
      supabaseServer.from('agenda_equipes').select('id, dados, nome'),
    ]);
    const allGrupos = gruposRes.status === 'fulfilled' && gruposRes.value.data ? gruposRes.value.data : [];
    const allEquipes = equipesRes.status === 'fulfilled' && equipesRes.value.data ? equipesRes.value.data : [];

    if (allGrupos.length === 0 && allEquipes.length === 0) return row;

    const grupoNames = row.dados.grupos.map((g: string) => String(g).trim().toLowerCase());
    const extraColabs = new Set<string>();
    const extraAlunos = new Set<string>();

    allGrupos.forEach((g: any) => {
      const gDados = g.dados || {};
      const gNome = String(gDados.nome || g.nome || '').trim().toLowerCase();
      const gId = String(g.id || '').trim().toLowerCase();
      if (grupoNames.includes(gNome) || grupoNames.includes(gId) || grupoNames.includes(`g_${gId}`)) {
        let cIds = gDados.colaboradoresIds || gDados.funcionariosIds || g.colaboradoresIds || g.funcionariosIds || [];
        if (typeof cIds === 'string') {
          try { cIds = JSON.parse(cIds); } catch { cIds = []; }
        }
        if (Array.isArray(cIds)) {
          cIds.forEach((id: any) => {
            const clean = String(id).replace(/^[feq_]+/, '').trim();
            if (clean) extraColabs.add(clean);
          });
        }

        let aIds = gDados.alunosIds || g.alunosIds || [];
        if (typeof aIds === 'string') {
          try { aIds = JSON.parse(aIds); } catch { aIds = []; }
        }
        if (Array.isArray(aIds)) {
          aIds.forEach((id: any) => {
            const clean = String(id).replace(/^(a_|_ALU)/, '').trim();
            if (clean) extraAlunos.add(clean);
          });
        }
      }
    });

    allEquipes.forEach((e: any) => {
      const eDados = e.dados || {};
      const eNome = String(eDados.nome || e.nome || '').trim().toLowerCase();
      const eId = String(e.id || '').trim().toLowerCase();
      if (grupoNames.includes(eNome) || grupoNames.includes(eId) || grupoNames.includes(`eq_${eId}`) || grupoNames.includes(`g_${eId}`)) {
        let mIds = eDados.membrosIds || eDados.colaboradoresIds || eDados.funcionariosIds || e.membrosIds || e.colaboradoresIds || [];
        if (typeof mIds === 'string') {
          try { mIds = JSON.parse(mIds); } catch { mIds = []; }
        }
        if (Array.isArray(mIds)) {
          mIds.forEach((id: any) => {
            const clean = String(id).replace(/^[feq_]+/, '').trim();
            if (clean) extraColabs.add(clean);
          });
        }
      }
    });

    if (extraColabs.size > 0) {
      const existingFuncs = new Set(row.dados.funcionariosIds || []);
      extraColabs.forEach(id => existingFuncs.add(id));
      row.dados.funcionariosIds = Array.from(existingFuncs);
      row.dados.colaboradoresIds = Array.from(existingFuncs);
    }

    if (extraAlunos.size > 0) {
      const existingAlunos = new Set(row.dados.alunosIds || []);
      extraAlunos.forEach(id => existingAlunos.add(id));
      row.dados.alunosIds = Array.from(existingAlunos);
    }
  } catch (err) {
    console.warn('[EnrichGruposRecipients] Erro ao enriquecer destinatários:', err);
  }
  return row;
}

function buildRow(c: any) {
  const source = { ...c, ...(c.dados || {}) }
  delete source.dados
  const { id, titulo, conteudo, texto, autor, dataEnvio, data, destino, fixado, ...rest } = source
  // Ensure safe defaults for JSONB fields stored in dados
  const dados = {
    ...rest,
    status: rest.status || 'enviado',
    prioridade: rest.prioridade || 'normal',
    turmas: Array.isArray(rest.turmas) ? rest.turmas : [],
    turmasIds: Array.isArray(rest.turmasIds) ? rest.turmasIds : [],
    grupos: Array.isArray(rest.grupos) ? rest.grupos : [],
    alunosIds: Array.isArray(rest.alunosIds) ? rest.alunosIds : [],
    funcionariosIds: Array.isArray(rest.funcionariosIds) ? rest.funcionariosIds : [],
    colaboradoresIds: Array.isArray(rest.colaboradoresIds) ? rest.colaboradoresIds : (Array.isArray(rest.funcionariosIds) ? rest.funcionariosIds : []),
    leituras: (rest.leituras && typeof rest.leituras === 'object' && !Array.isArray(rest.leituras)) ? rest.leituras : {},
    ciencias: (rest.ciencias && typeof rest.ciencias === 'object' && !Array.isArray(rest.ciencias)) ? rest.ciencias : {},
    anexos: Array.isArray(rest.anexos) ? rest.anexos : [],
    exigeCiencia: Boolean(rest.exigeCiencia),
    permiteResposta: Boolean(rest.permiteResposta),
  }
  const hasTargets = dados.turmas.length > 0 || dados.alunosIds.length > 0 || dados.grupos.length > 0 || dados.funcionariosIds.length > 0
  const merged = {
    id: id || `COM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    titulo: titulo || '', 
    texto: conteudo || texto || '', 
    autor: autor || '',
    data: dataEnvio || data || new Date().toISOString(),
    destino: destino || (hasTargets ? 'selecionados' : 'todos'), 
    fixado: Boolean(fixado),
    dados: {
      ...dados,
      conteudo: conteudo || texto || '',
      dataEnvio: dataEnvio || data || new Date().toISOString()
    },
    updated_at: new Date().toISOString(),
  }
  
  return merged
}
