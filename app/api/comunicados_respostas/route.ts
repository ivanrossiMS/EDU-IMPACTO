import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getColaboradorIds, getInstitutionalMasterAdminIds } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

function normalizeRole(str?: string | null): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const STAFF_KEYWORDS = [
  'diretor', 'diretora', 'direcao', 'administrador', 'admin', 'master',
  'coordenador', 'coordenadora', 'coordenacao', 'professor', 'professora',
  'docente', 'secretaria', 'secretario', 'auxiliar administrativo',
  'assistente', 'auxiliar', 'financeiro', 'tesouraria', 'portaria',
  'seguranca', 'inspetoria', 'inspetor', 'colaborador', 'funcionario'
];

async function checkIsStaffOrAuthor({
  user,
  supabase,
  comunicadoId,
  groupedAutorId,
  espelharColabId
}: {
  user: any;
  supabase: any;
  comunicadoId?: string | null;
  groupedAutorId?: string | null;
  espelharColabId?: string | null;
}): Promise<{ isStaff: boolean; isAuthor: boolean; canViewAllThreads: boolean }> {
  const perfil = user.user_metadata?.perfil || '';
  const cargo = user.user_metadata?.cargo || '';
  const pNorm = normalizeRole(perfil);
  const cNorm = normalizeRole(cargo);

  const hasStaffKeyword = STAFF_KEYWORDS.some(kw => pNorm.includes(kw) || cNorm.includes(kw));

  const isFamilyOrStudent = 
    (pNorm === 'familia' || pNorm === 'responsavel' || pNorm === 'aluno' || cNorm === 'responsavel' || cNorm === 'aluno') &&
    !user.user_metadata?.colaborador_id &&
    !user.user_metadata?.system_user_id &&
    !hasStaffKeyword;

  let isStaff = !isFamilyOrStudent && (
    hasStaffKeyword || 
    Boolean(user.user_metadata?.colaborador_id || user.user_metadata?.system_user_id || user.user_metadata?.uid_legacy)
  );

  if (!isStaff && !isFamilyOrStudent) {
    try {
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('id, perfil, cargo, status')
        .or(`id.eq."${user.id}",auth_id.eq."${user.id}",email.ilike."${user.email || ''}"`)
        .eq('status', 'ativo')
        .maybeSingle();

      if (dbUser) isStaff = true;
    } catch (e) {
      console.warn('Erro ao checar system_users:', e);
    }
  }

  let isAuthor = false;
  const userCandidateIds = new Set<string>([
    String(user.id),
    String(user.user_metadata?.colaborador_id || ''),
    String(user.user_metadata?.system_user_id || ''),
    String(user.user_metadata?.uid_legacy || ''),
    String(espelharColabId || '')
  ].filter(Boolean));

  if (groupedAutorId && userCandidateIds.has(String(groupedAutorId))) {
    isAuthor = true;
  }

  if (comunicadoId && !isAuthor) {
    try {
      const { data: comData } = await supabase
        .from('comunicados')
        .select('autor, dados')
        .eq('id', comunicadoId)
        .maybeSingle();

      if (comData) {
        const comAutorId = String(comData.dados?.autorId || '');
        if (comAutorId && userCandidateIds.has(comAutorId)) {
          isAuthor = true;
        }
        const comAutorNome = normalizeRole(comData.autor || comData.dados?.autorNome);
        const userNome = normalizeRole(user.user_metadata?.nome || user.user_metadata?.name);
        if (comAutorNome && userNome && (comAutorNome === userNome || userNome.includes(comAutorNome) || comAutorNome.includes(userNome))) {
          isAuthor = true;
        }
      }
    } catch (e) {
      console.warn('Erro ao checar autor do comunicado:', e);
    }
  }

  return { isStaff, isAuthor, canViewAllThreads: isStaff || isAuthor };
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url);
  const comunicadoId = searchParams.get('comunicado_id');
  const comunicadoIds = searchParams.get('comunicado_ids');
  const remetenteId = searchParams.get('remetente_id'); // If parent is viewing, they pass their ID to only see their chat
  const espelharColabId = searchParams.get('espelhar_colaborador');
  const adminParam = searchParams.get('admin') === 'true';

  const groupedAutorId = searchParams.get('grouped_autor_id');
  const groupedTime = searchParams.get('grouped_time');

  if (!comunicadoId && !comunicadoIds && !groupedAutorId) {
    return NextResponse.json({ error: 'comunicado_id or comunicado_ids is required' }, { status: 400 });
  }

  // Verifica permissão institucional (staff) ou autoria do comunicado
  const { canViewAllThreads } = await checkIsStaffOrAuthor({
    user,
    supabase,
    comunicadoId,
    groupedAutorId,
    espelharColabId
  });

  let query = supabase
    .from('comunicados_respostas')
    .select('*')
    .order('created_at', { ascending: true });

  if (groupedAutorId && groupedTime) {
    // Busca os IDs dos relatórios filhos no banco
    const timeNum = parseInt(groupedTime, 10);
    const minTime = new Date(timeNum - 15000).toISOString();
    const maxTime = new Date(timeNum + 15000).toISOString();
    
    const { data: relatedComs } = await supabase
      .from('comunicados')
      .select('id')
      .eq('dados->>autorId', groupedAutorId)
      .like('id', 'AD-COM-REL-STU%')
      .gte('created_at', minTime)
      .lte('created_at', maxTime);
      
    const idsArray = relatedComs?.map(c => c.id) || [];
    if (idsArray.length > 0) {
      query = query.in('comunicado_id', idsArray);
    } else {
      return NextResponse.json([]); // Nenhum filho encontrado, logo nenhuma conversa
    }
  } else if (comunicadoIds) {
    const idsArray = comunicadoIds.split(',').slice(0, 50); // Limitar a 50 IDs
    query = query.in('comunicado_id', idsArray);
  } else if (comunicadoId) {
    query = query.eq('comunicado_id', comunicadoId);
  }

  // Regra de privacidade:
  // Se o usuário pode ver todas as threads (staff ou autor) e solicitou admin=true (ou não passou remetente_id):
  // -> Ele vê todas as threads (adminThreads).
  // Se for Família/Aluno ou se um colaborador com perfil duplo passou remetente_id sem admin=true:
  // -> Filtra apenas a conversa pertencente ao remetente.
  if (!canViewAllThreads || (!adminParam && remetenteId)) {
    if (remetenteId) {
      query = query.eq('remetente_id', remetenteId);
    } else {
      const userSlug = user.user_metadata?.aluno_id || user.user_metadata?.responsavel_id || user.id;
      query = query.eq('remetente_id', String(userSlug));
    }
  }

  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const espelharColabId = body.espelhar_colaborador || searchParams.get('espelhar_colaborador');
    
    // Validate required fields
    if (!body.comunicado_id || !body.remetente_id || !body.conteudo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Identifica se o remetente atua como autoridade escolar / staff
    const { canViewAllThreads } = await checkIsStaffOrAuthor({
      user,
      supabase,
      comunicadoId: body.comunicado_id,
      espelharColabId
    });
    const serverIsAdmin = canViewAllThreads;

    let finalComunicadoId = body.comunicado_id;

    // Se o admin responder a um relatorio agrupado, o frontend (que nao tem os filhos carregados)
    // enviara o ID do pai (COLAB). Precisamos encontrar o filho (STU) correspondente ao aluno.
    if (serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-COLAB')) {
      const { data: parentCom } = await supabase
        .from('comunicados')
        .select('created_at, dados')
        .eq('id', finalComunicadoId)
        .single();
        
      if (parentCom && parentCom.dados && parentCom.dados.autorId) {
        const pTime = new Date(parentCom.created_at).getTime();
        const minDate = new Date(pTime - 15000).toISOString();
        const maxDate = new Date(pTime + 15000).toISOString();
        
        const { data: stus } = await supabase
          .from('comunicados')
          .select('id, dados')
          .ilike('id', 'AD-COM-REL-STU-%')
          .gte('created_at', minDate)
          .lte('created_at', maxDate);
          
        if (stus && stus.length > 0) {
          const child = stus.find(s => s.dados && s.dados.autorId === parentCom.dados.autorId && (s.dados.alunosIds || []).some((id: any) => String(id) === String(body.remetente_id)));
          if (child) {
            finalComunicadoId = child.id;
          }
        }
      }
    }

    // Se o admin tentar responder num report agrupado (pai), o frontend as vezes nao tem o ID do filho carregado
    // Vamos auto-resolver o ID do filho correspondente no servidor se possivel
    if (serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-') && !finalComunicadoId.startsWith('AD-COM-REL-STU-') && body.remetente_id) {
      const { data: parentData } = await supabase.from('comunicados').select('created_at, dados').eq('id', finalComunicadoId).single();
      if (parentData) {
        const timeNum = new Date(parentData.created_at).getTime();
        const minTime = new Date(timeNum - 15000).toISOString();
        const maxTime = new Date(timeNum + 15000).toISOString();
        const parentAutorId = parentData.dados?.autorId;
        
        if (parentAutorId) {
          // Busca um filho deste autor naquele intervalo que contenha o remetente_id nos alunosIds
          const { data: relatedComs } = await supabase
            .from('comunicados')
            .select('id, alunosIds')
            .eq('dados->>autorId', parentAutorId)
            .like('id', 'AD-COM-REL-STU%')
            .gte('created_at', minTime)
            .lte('created_at', maxTime);
            
          if (relatedComs) {
            const studentChild = relatedComs.find(c => {
               const alIds = Array.isArray(c.alunosIds) ? c.alunosIds : (c.alunosIds ? JSON.parse(c.alunosIds) : []);
               return alIds.some((id: any) => String(id) === String(body.remetente_id));
            });
            if (studentChild) {
              finalComunicadoId = studentChild.id;
            }
          }
        }
      }
    }

    const row = {
      comunicado_id: finalComunicadoId,
      remetente_id: body.remetente_id,
      remetente_nome: body.remetente_nome || 'Usuário',
      conteudo: body.conteudo,
      anexos: Array.isArray(body.anexos) ? body.anexos : [],
      is_admin: serverIsAdmin  // Determinado pelo servidor, não pelo cliente
    };

    const { data, error } = await supabase
      .from('comunicados_respostas')
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ── Notificações Push e In-App bidirecionais ──
    try {
      const msgTexto = body.conteudo.length > 50 ? body.conteudo.substring(0, 50) + '...' : body.conteudo;
      const remetenteNome = body.remetente_nome || user.user_metadata?.nome || user.user_metadata?.name || (serverIsAdmin ? 'A Escola' : 'Usuário');

      if (!serverIsAdmin) {
        // Responsável/Aluno respondeu -> Notifica a Escola (Autor original do comunicado + Administradores Master Institucionais)
        const { data: comData } = await supabase
          .from('comunicados')
          .select('titulo, dados')
          .eq('id', body.comunicado_id)
          .single();
        
        if (comData) {
          const rawAutorId = comData.dados?.autorId;
          let baseTargets: string[] = [];
          if (rawAutorId) {
            const resolvedIds = await getColaboradorIds([rawAutorId]);
            baseTargets = resolvedIds.length > 0 ? resolvedIds : [rawAutorId];
          }
          const masterAdminIds = await getInstitutionalMasterAdminIds();
          const targetUserIds = Array.from(new Set([...baseTargets, ...masterAdminIds])).filter(Boolean);
          
          try {
            for (const uid of targetUserIds) {
              await supabase.from('notificacoes').insert({
                user_id: uid,
                titulo: `Nova resposta: ${comData.titulo}`,
                mensagem: `${remetenteNome} comentou: "${msgTexto}"`,
                link: `/agenda-digital/comunicados`,
                lida: false,
                tipo: 'comunicado',
                created_at: new Date().toISOString()
              });
            }
          } catch (err) {
            console.error("Notificacao DB erro:", err);
          }

          try {
            await sendAgendaPushNotification({
              type: 'comunicados',
              itemId: String(data.id), // ID único do comentário evita deduplicação indevida
              title: `💬 Resposta de ${remetenteNome}`,
              message: `No comunicado "${comData.titulo}": ${msgTexto}`,
              targetUserIds,
              targetUrl: `/agenda-digital/colaborador/comunicados?id=${body.comunicado_id}`,
              metadata: { perfil_destino: 'colaborador', item_id: String(body.comunicado_id), rota: 'comunicados', targetUrl: `/agenda-digital/colaborador/comunicados?id=${body.comunicado_id}` }
            });
          } catch (err) {
            console.error("Push erro:", err);
          }
        }
      } else {
        // Escola respondeu -> Notifica o Pai/Aluno dono da thread (remetente_id da thread)
        const targetUserId = body.remetente_id; 
        if (targetUserId) {
          const { data: comData } = await supabase
            .from('comunicados')
            .select('titulo, dados')
            .eq('id', body.comunicado_id)
            .single();
            
          const tituloCom = comData ? comData.titulo : 'Comunicado';
          const targetAlunoId = body.aluno_id || comData?.dados?.aluno_id || (Array.isArray(comData?.dados?.targetStudents) && comData.dados.targetStudents.length === 1 ? comData.dados.targetStudents[0] : null);
          const studentUrl = targetAlunoId 
            ? `/agenda-digital/${targetAlunoId}/comunicados?id=${body.comunicado_id}`
            : `/agenda-digital/comunicados?id=${body.comunicado_id}`;

          try {
            await supabase.from('notificacoes').insert({
              user_id: targetUserId,
              titulo: `Nova resposta de ${remetenteNome}`,
              mensagem: `Resposta no comunicado "${tituloCom}": "${msgTexto}"`,
              link: studentUrl,
              lida: false,
              tipo: 'comunicado',
              created_at: new Date().toISOString()
            });
          } catch (err) {
            console.error("Notificacao DB erro:", err);
          }

          try {
            await sendAgendaPushNotification({
              type: 'comunicados',
              itemId: String(data.id),
              title: `🏫 Nova mensagem de ${remetenteNome}`,
              message: `Sobre "${tituloCom}": ${msgTexto}`,
              targetUserIds: [targetUserId],
              targetUrl: studentUrl,
              metadata: { 
                perfil_destino: 'familia', 
                item_id: String(body.comunicado_id), 
                rota: 'comunicados', 
                targetUrl: studentUrl,
                ...(targetAlunoId ? { aluno_id: String(targetAlunoId) } : {})
              }
            });
          } catch (err) {
            console.error("Push erro:", err);
          }
        }
      }
    } catch (notifError) {
      console.error("Erro geral nas notificações de resposta:", notifError);
      // Nao damos throw para nao quebrar a insercao original da mensagem
    }

    // --- LÓGICA DE RESET DE LEITURA (NOVO/NÃO LIDO) ---
    try {
      const { data: comData } = await supabase.from('comunicados').select('id, created_at, dados').eq('id', finalComunicadoId).single();
      if (comData) {
        const comDados = comData.dados || {};
        let leituras = { ...(comDados.leituras || {}) };
        let usersToReset: string[] = [];

        if (!serverIsAdmin) {
           // Família respondeu. O autor e a equipe escolar devem ver como NÃO LIDO.
           const autorId = comDados.autorId;
           if (autorId) usersToReset.push(String(autorId));
           if (autorId && leituras[autorId]) delete leituras[autorId];
           // Remove todas as leituras da equipe/autor para garantir status Não Lido
           Object.keys(leituras).forEach(k => {
             if (k === autorId || k.startsWith('colab_') || k.startsWith('admin_')) {
               delete leituras[k];
             }
           });
        } else {
           // Equipe/Admin respondeu. A família/aluno precisa ver como NÃO LIDO.
           if (body.remetente_id) {
             const rId = String(body.remetente_id);
             usersToReset.push(rId);
             delete leituras[rId];
             Object.keys(leituras).forEach(k => {
               if (k === rId || k.includes(rId)) {
                 delete leituras[k];
               }
             });
           }
        }

        if (usersToReset.length > 0) {
          // Atualiza a coluna 'dados' de comunicados com o novo timestamp _last_reply e leituras atualizadas
          await supabase.from('comunicados').update({ 
            dados: { 
              ...comDados, 
              leituras, 
              _last_reply: new Date().toISOString() 
            } 
          }).eq('id', finalComunicadoId);
          
          // Deleta a leitura da tabela agenda_notification_reads também
          for (const uid of usersToReset) {
            if (!serverIsAdmin) {
               // Família respondeu, reseta para o admin / autor
               await supabase.from('agenda_notification_reads')
                 .delete()
                 .eq('content_id', finalComunicadoId)
                 .eq('usuario_id', uid);
            } else {
               // Admin respondeu, reseta para a família / aluno
               await supabase.from('agenda_notification_reads')
                 .delete()
                 .eq('content_id', finalComunicadoId)
                 .or(`usuario_id.eq.${uid},aluno_id.eq.${uid}`);
            }
          }

          // Se a resposta foi feita por uma família num child report, reseta o lido do PAI também pro Admin!
          if (!serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-STU-')) {
             const autorId = comDados.autorId;
             if (autorId) {
               const timeNum = new Date(comData.created_at).getTime();
               if (timeNum > 0) {
                 const minTime = new Date(timeNum - 15000).toISOString();
                 const maxTime = new Date(timeNum + 15000).toISOString();
                 // Busca o pai
                 const { data: parentCom } = await supabase.from('comunicados')
                   .select('id, dados')
                   .eq('dados->>autorId', String(autorId))
                   .not('id', 'like', 'AD-COM-REL-STU-%')
                   .like('id', 'AD-COM-REL-%')
                   .gte('created_at', minTime)
                   .lte('created_at', maxTime)
                   .limit(1)
                   .single();
                   
                 if (parentCom && parentCom.dados) {
                   let parentLeituras = { ...(parentCom.dados.leituras || {}) };
                   if (parentLeituras[autorId]) delete parentLeituras[autorId];
                   await supabase.from('comunicados').update({ 
                     dados: {
                       ...parentCom.dados,
                       leituras: parentLeituras,
                       _last_reply: new Date().toISOString()
                     }
                   }).eq('id', parentCom.id);
                   
                   // Deleta do pai na nova tabela também
                   await supabase.from('agenda_notification_reads')
                     .delete()
                     .eq('content_id', parentCom.id)
                     .eq('usuario_id', autorId);
                 }
               }
             }
          }
        }
      }
    } catch (resetErr) {
      console.error("Erro ao resetar status LIDO:", resetErr);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  try {
    const supabase = await createProtectedClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const espelharColabId = searchParams.get('espelhar_colaborador');

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Buscar a mensagem atual
    const { data: msg, error: fetchErr } = await supabase.from('comunicados_respostas').select('*').eq('id', id).single();
    
    if (fetchErr || !msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    }

    // Identificar permissão institucional (staff) ou autoria do comunicado
    const { canViewAllThreads } = await checkIsStaffOrAuthor({
      user,
      supabase,
      comunicadoId: msg.comunicado_id,
      espelharColabId
    });
    const isAdmin = canViewAllThreads;

    const currentUserId = user.id;

    // Regras de exclusão:
    // 1. Staff / Admin / Autor pode excluir qualquer mensagem para moderação
    // 2. O aluno/família só pode excluir a PRÓPRIA mensagem.
    if (!isAdmin) {
      const allowedIds = [
        currentUserId,
        user.user_metadata?.aluno_id,
        user.user_metadata?.responsavel_id,
        user.user_metadata?.slug
      ].filter(Boolean).map(String);

      if (!allowedIds.includes(String(msg.remetente_id))) {
         return NextResponse.json({ error: 'Sem permissão para excluir esta mensagem' }, { status: 403 });
      }
    }

    const { error: delErr } = await supabase.from('comunicados_respostas').delete().eq('id', id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
