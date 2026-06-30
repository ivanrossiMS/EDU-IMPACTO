import { NextResponse, after } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { requireAuth } from '@/lib/server/authGuard'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getStudentTargetsForComunicados, checkResponsavelRelationship } from '@/lib/server/notificationHelper'
export const dynamic = 'force-dynamic'

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
  
  // VERIFICAÇÃO DE PERFIL
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

  // BLINDAGEM IDOR: Se for família, DEVE informar um aluno_id que lhe pertença
  if (isFamilyOrStudent) {
    if (!alunoId) {
      // Se não enviou alunoId, não pode ler tudo solto
      return NextResponse.json({ error: 'Acesso negado: ID do aluno não informado.' }, { status: 403 });
    }
    const checkId = user.user_metadata?.responsavel_id || user.user_metadata?.aluno_id || user.id;
    const isOwner = await checkResponsavelRelationship(checkId, alunoId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Acesso negado: Você não tem permissão para visualizar dados deste aluno.' }, { status: 403 });
    }
  }

  let resolvedTurma = turmaId;
  if (!turmaId && alunoId) {
     const { data: aData } = await supabase.from('alunos').select('turma').eq('id', alunoId).single();
     if (aData && aData.turma) {
        const { data: tData } = await supabase.from('turmas').select('nome').or(`id.eq."${aData.turma}",codigo.eq."${aData.turma}",nome.eq."${aData.turma}"`).maybeSingle();
        if (tData && tData.nome) resolvedTurma = tData.nome;
        else resolvedTurma = aData.turma;
     }
  } else if (turmaId) {
    const { data: tData } = await supabase.from('turmas').select('nome').eq('id', turmaId).single();
    if (tData && tData.nome) {
      resolvedTurma = tData.nome;
    } else {
      const { data: cData } = await supabase.from('turmas').select('nome').eq('codigo', turmaId).single();
      if (cData && cData.nome) {
        resolvedTurma = cData.nome;
      }
    }
  }

  let studentGroups: string[] = [];
  if (alunoId) {
    const cleanId = alunoId.replace(/^(a_|_ALU)/, '');
    const { data: allGrupos } = await supabase.from('agenda_grupos').select('nome, dados');
    if (allGrupos) {
      allGrupos.forEach(g => {
        const alunosIdsList = g.dados?.alunosIds || [];
        if (alunosIdsList.some((aId: string) => String(aId).replace(/^(a_|_ALU)/, '') === cleanId)) {
          if (g.nome) studentGroups.push(g.nome);
        }
      });
    }
  }

  let query = supabase.from('comunicados').select('*');
  
  let accessStartDate = await getLoggedUserAccessStartDate();

  if (alunoId) {
    const { data: studentData } = await supabase.from('alunos').select('created_at, dados').eq('id', alunoId).maybeSingle();
    if (studentData) {
      const dateStr = studentData.dados?.data_matricula || studentData.dados?.data_inicio || studentData.dados?.data_ingresso || studentData.created_at;
      if (dateStr) {
        const studentEntryDate = new Date(dateStr);
        if (!accessStartDate || studentEntryDate > accessStartDate) {
          accessStartDate = studentEntryDate;
        }
      }
    }
  }

  if (accessStartDate) {
    query = query.gte('data', accessStartDate.toISOString());
  }
  
  if (turmaId || alunoId) {
    const conditions = [`destino.eq.todos`];
    if (resolvedTurma) {
      conditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
      if (turmaId && resolvedTurma !== turmaId) {
        conditions.push(`dados->turmas.cs.["${turmaId}"]`);
      }
    }
    
    studentGroups.forEach(gNome => {
      conditions.push(`dados->grupos.cs.["${gNome}"]`);
    });
    if (alunoId) {
      conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
    }
    query = query.or(conditions.join(','));
  }
  
  if (idParam) {
    query = query.eq('id', idParam);
  }
  
  if (sinceParam) {
    query = query.gt('created_at', sinceParam);
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
        supabaseServer.from('agenda_notification_reads').select('content_id, usuario_id, read_at').in('content_id', itemIds),
        supabaseServer.from('agenda_ciencias').select('content_id, usuario_id, ciente_em').in('content_id', itemIds)
     ]);
     allReads = readsRes.data || [];
     allCiencias = cienciasRes.data || [];
  }

  const normalized = (data || []).map((row: any) => {
     const merged = normalizeRow(row);
     
     // Merge das novas tabelas sobre o que eventualmente já estava no JSON (fallback para históricos)
     const itemReads = allReads.filter(r => r.content_id === String(row.id));
     itemReads.forEach(r => {
        merged.leituras[r.usuario_id] = r.read_at;
     });

     const itemCiencias = allCiencias.filter(c => c.content_id === String(row.id));
     itemCiencias.forEach(c => {
        merged.ciencias[c.usuario_id] = c.ciente_em;
     });

     return merged;
  });
  let filtered = isFamilyOrStudent
    ? normalized.filter((c: any) => c.destino !== 'interno')
    : normalized.filter((c: any) => !c.isSaudacao && !c.dados?.isSaudacao && c.titulo !== 'Mensagem de Boas-vindas');

  // Optimization: Remove heavy payload from lists (Phase 3)
  if (!idParam) {
    filtered = filtered.map((c: any) => {
      delete c.conteudo;
      delete c.texto;
      delete c.anexos;
      if (c.dados) {
        delete c.dados.conteudo;
        delete c.dados.texto;
        delete c.dados.anexos;
        delete c.dados.respostas;
      }
      return c;
    });
  }

  return NextResponse.json(filtered)
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
      
      const rows = body.map(c => buildRow(c))
      const { error: upsertError } = await supabase.from('comunicados').upsert(rows)
      if (upsertError) {
        console.error("==> UPSERT ERROR:", upsertError);
        return NextResponse.json({ error: upsertError.message }, { status: 400 })
      }
      console.log("==> UPSERT SUCCESS");
      
      after(async () => {
        const allPushPromises = [];
        for (const row of rows) {
          if (row.destino === 'interno') continue;
          const { students, directColaboradores } = await getStudentTargetsForComunicados(row.dados)
          
          for (const student of students) {
            if (student.responsaveis_ids.length > 0) {
              allPushPromises.push(
                sendAgendaPushNotification({
                  type: 'comunicados',
                  itemId: String(row.id),
                  title: `📢 Comunicado: ${row.titulo}`,
                  message: `${row.autor} enviou uma mensagem para ${student.aluno_nome}`,
                  targetUserIds: student.responsaveis_ids,
                  targetUrl: '/agenda-digital/comunicados',
                  metadata: { aluno_id: student.aluno_id }
                }).catch(err => console.error("Push Error:", err))
              );
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
                targetUrl: '/agenda-digital/comunicados'
              }).catch(err => console.error("Push Error Colab:", err))
            );
          }
        }
        await Promise.allSettled(allPushPromises);
      });
      
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('comunicados').upsert(row).select().single()
    if (error) {
      console.error("UPSERT SINGLE ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    // Disparar Push em background
    if (data.destino !== 'interno') {
      after(async () => {
        const { students, directColaboradores } = await getStudentTargetsForComunicados(data.dados);
        const pushPromises = [];
        
        for (const student of students) {
          if (student.responsaveis_ids.length > 0) {
            pushPromises.push(
              sendAgendaPushNotification({
                type: 'comunicados',
                itemId: String(data.id),
                title: `📢 Comunicado: ${data.titulo}`,
                message: `${data.autor} enviou uma mensagem para ${student.aluno_nome}`,
                targetUserIds: student.responsaveis_ids,
                targetUrl: '/agenda-digital/comunicados',
                metadata: { aluno_id: student.aluno_id }
              }).catch(err => console.error("Push Error:", err))
            );
          }
        }

        if (directColaboradores.length > 0) {
          pushPromises.push(
            sendAgendaPushNotification({
              type: 'comunicados',
              itemId: String(data.id),
              title: `📢 Comunicado: ${data.titulo}`,
              message: `Você tem uma nova mensagem enviada por ${data.autor}.`,
              targetUserIds: directColaboradores,
              targetUrl: '/agenda-digital/comunicados'
            }).catch(err => console.error("Push Error Colab:", err))
          );
        }
        
        await Promise.allSettled(pushPromises);
      });
    }

    // Criar Cobrança Asaas se existir
    if (body.cobranca && data.destino !== 'interno') {
       try {
         const cobrancaObj = {
           comunicado_id: String(data.id),
           titulo: body.cobranca.titulo,
           valor: parseFloat(body.cobranca.valor),
           vencimento: body.cobranca.vencimento
         }
         
         const { data: cobrancaSalva, error: cobrancaErr } = await supabase.from('agenda_cobrancas').insert(cobrancaObj).select().single()
         
         if (!cobrancaErr && cobrancaSalva) {
            const { students } = await getStudentTargetsForComunicados(data.dados);
            const destinatariosToInsert = students.map((s: any) => ({
              cobranca_id: cobrancaSalva.id,
              destinatario_id: s.aluno_id,
              destinatario_nome: s.aluno_nome,
              status: 'PENDING'
            }))
            
            if (destinatariosToInsert.length > 0) {
               await supabase.from('agenda_cobrancas_destinatarios').insert(destinatariosToInsert)
            }
         }
       } catch (err) {
         console.error('Erro ao salvar cobrança anexada:', err)
       }
    }

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

  const authClient = await createProtectedClient();
  const supabase = authClient;

  const perfil = user.user_metadata?.perfil || '';
  const cargo = user.user_metadata?.cargo || '';
  if (perfil === 'Família' || perfil === 'Responsável' || cargo === 'Responsável' || cargo === 'Aluno' || perfil === 'Aluno') {
    return NextResponse.json({ error: 'Acesso negado: Permissão insuficiente.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('comunicados').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// Removed deprecated config export

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
    alunosIds: Array.isArray(rest.alunosIds) ? rest.alunosIds : [],
    leituras: (rest.leituras && typeof rest.leituras === 'object' && !Array.isArray(rest.leituras)) ? rest.leituras : {},
    ciencias: (rest.ciencias && typeof rest.ciencias === 'object' && !Array.isArray(rest.ciencias)) ? rest.ciencias : {},
    anexos: Array.isArray(rest.anexos) ? rest.anexos : [],
    exigeCiencia: Boolean(rest.exigeCiencia),
    permiteResposta: Boolean(rest.permiteResposta),
  }
  const merged = {
    id: id || `COM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    titulo: titulo || '', 
    texto: conteudo || texto || '', 
    autor: autor || '',
    data: dataEnvio || data || new Date().toISOString(),
    destino: destino || ((dados.turmas.length > 0 || dados.alunosIds.length > 0) ? 'selecionados' : 'todos'), 
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
