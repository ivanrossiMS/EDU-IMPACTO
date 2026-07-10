import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url);
  const comunicadoId = searchParams.get('comunicado_id');
  const comunicadoIds = searchParams.get('comunicado_ids');
  const remetenteId = searchParams.get('remetente_id'); // If parent is viewing, they pass their ID to only see their chat
  
  // SECURITY FIX: Verificar no servidor se o usuário é admin (não confiar no ?admin=true do cliente)
  const perfil = user.user_metadata?.perfil || ''
  const cargo = user.user_metadata?.cargo || ''
  const adminPerfis = ['Diretor Geral', 'Administrador', 'Admin', 'Colaborador', 'Professor', 'Coordenador']
  const familyPerfis = ['Família', 'Responsável', 'Aluno']
  const isFamilyOrStudent = familyPerfis.includes(perfil) || familyPerfis.includes(cargo)
  const isAdmin = !isFamilyOrStudent && (adminPerfis.includes(perfil) || adminPerfis.includes(cargo) || (!perfil && !cargo))

  const groupedAutorId = searchParams.get('grouped_autor_id');
  const groupedTime = searchParams.get('grouped_time');

  if (!comunicadoId && !comunicadoIds && !groupedAutorId) {
    return NextResponse.json({ error: 'comunicado_id or comunicado_ids is required' }, { status: 400 });
  }

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

  // Privacy rule: se não é admin, filtrar apenas mensagens do próprio usuário
  if (!isAdmin && remetenteId) {
    query = query.eq('remetente_id', remetenteId);
  } else if (!isAdmin && !remetenteId) {
    // Sem remetente_id e sem admin: filtrar pelo ID do usuário autenticado
    const userSlug = user.user_metadata?.aluno_id || user.user_metadata?.responsavel_id || user.id
    query = query.eq('remetente_id', String(userSlug));
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
    
    // Validate required fields
    if (!body.comunicado_id || !body.remetente_id || !body.conteudo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // SECURITY FIX: Determinar is_admin via perfil do servidor, não pelo body do cliente
    const senderPerfil = user.user_metadata?.perfil || ''
    const senderCargo = user.user_metadata?.cargo || ''
    const familyPerfisPost = ['Família', 'Responsável', 'Aluno']
    const serverIsAdmin = !familyPerfisPost.includes(senderPerfil) && !familyPerfisPost.includes(senderCargo)

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
      const remetenteNome = body.remetente_nome || (body.is_admin ? 'A Escola' : 'Usuário');

      if (!body.is_admin) {
        // Responsável/Aluno respondeu -> Notifica a Escola (Autor original do comunicado)
        const { data: comData } = await supabase
          .from('comunicados')
          .select('titulo, dados')
          .eq('id', body.comunicado_id)
          .single();
        
        if (comData && comData.dados && comData.dados.autorId) {
          const targetUserId = comData.dados.autorId;
          
          try {
            await supabase.from('notificacoes').insert({
              user_id: targetUserId,
              titulo: `Nova resposta: ${comData.titulo}`,
              mensagem: `${remetenteNome} comentou: "${msgTexto}"`,
              link: `/agenda-digital/comunicados`,
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
              itemId: String(data.id), // ID único do comentário evita deduplicação indevida
              title: `💬 Resposta de ${remetenteNome}`,
              message: `No comunicado "${comData.titulo}": ${msgTexto}`,
              targetUserIds: [targetUserId],
              targetUrl: `/agenda-digital/comunicados`
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
            .select('titulo')
            .eq('id', body.comunicado_id)
            .single();
            
          const tituloCom = comData ? comData.titulo : 'Comunicado';

          try {
            await supabase.from('notificacoes').insert({
              user_id: targetUserId,
              titulo: `Nova resposta da Escola`,
              mensagem: `Resposta no comunicado "${tituloCom}": "${msgTexto}"`,
              link: `/agenda-digital/comunicados`,
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
              title: `🏫 Nova mensagem da Escola`,
              message: `Sobre "${tituloCom}": ${msgTexto}`,
              targetUserIds: [targetUserId],
              targetUrl: `/agenda-digital/comunicados`
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

    // --- LÓGICA DE RESET DE LEITURA (NOVO/LIDO) ---
    try {
      const { data: comData } = await supabase.from('comunicados').select('id, created_at, dados, leituras').eq('id', finalComunicadoId).single();
      if (comData) {
        let leituras = comData.leituras || {};
        let usersToReset = [];

        if (!serverIsAdmin) {
           // Familia respondeu. O admin (autor) precisa ver como NOVO.
           const autorId = comData.dados?.autorId;
           if (autorId) usersToReset.push(autorId);
        } else {
           // Admin respondeu. A familia/aluno (remetente_id da conversa) precisa ver como NOVO.
           if (body.remetente_id) usersToReset.push(body.remetente_id);
        }

        if (usersToReset.length > 0) {
          let changed = false;
          usersToReset.forEach(uid => {
             if (leituras[uid]) {
                delete leituras[uid];
                changed = true;
             }
          });
          
          if (changed) {
             await supabase.from('comunicados').update({ leituras }).eq('id', finalComunicadoId);
          }
          
          // Se a resposta foi feita por uma familia num child report, temos que resetar o lido do PAI tambem pro Admin!
          if (!serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-STU-')) {
             const autorId = comData.dados?.autorId;
             if (autorId) {
               const timeNum = new Date(comData.created_at).getTime();
               if (timeNum > 0) {
                 const minTime = new Date(timeNum - 15000).toISOString();
                 const maxTime = new Date(timeNum + 15000).toISOString();
                 // Busca o pai
                 const { data: parentCom } = await supabase.from('comunicados')
                   .select('id, leituras')
                   .eq('dados->>autorId', String(autorId))
                   .not('id', 'like', 'AD-COM-REL-STU-%')
                   .like('id', 'AD-COM-REL-%')
                   .gte('created_at', minTime)
                   .lte('created_at', maxTime)
                   .limit(1)
                   .single();
                   
                 if (parentCom && parentCom.leituras && parentCom.leituras[autorId]) {
                   let parentLeituras = parentCom.leituras;
                   delete parentLeituras[autorId];
                   await supabase.from('comunicados').update({ leituras: parentLeituras }).eq('id', parentCom.id);
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

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Identificar perfil
    const perfil = user.user_metadata?.perfil || '';
    const cargo = user.user_metadata?.cargo || '';
    const adminPerfis = ['Diretor Geral', 'Administrador', 'Admin', 'Colaborador', 'Professor', 'Coordenador'];
    const familyPerfis = ['Família', 'Responsável', 'Aluno'];
    const isFamilyOrStudent = familyPerfis.includes(perfil) || familyPerfis.includes(cargo);
    const isAdmin = !isFamilyOrStudent && (adminPerfis.includes(perfil) || adminPerfis.includes(cargo) || (!perfil && !cargo));

    // Buscar a mensagem atual
    const { data: msg, error: fetchErr } = await supabase.from('comunicados_respostas').select('*').eq('id', id).single();
    
    if (fetchErr || !msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    }

    const currentUserId = user.id;

    // Regras de exclusão:
    // 1. O admin pode excluir qualquer mensagem (ou talvez apenas as dele? Vamos permitir admin excluir qualquer uma para moderação)
    // 2. O aluno/família só pode excluir a PRÓPRIA mensagem.
    if (!isAdmin) {
      if (msg.remetente_id !== currentUserId && msg.remetente_id !== user.user_metadata?.slug) {
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
