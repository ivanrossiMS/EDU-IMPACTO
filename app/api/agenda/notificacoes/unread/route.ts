import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authClient = await createProtectedClient();
  const supabase = supabaseServer;
  
  const { searchParams } = new URL(request.url)
  const alunoId = searchParams.get('aluno_id')
  
  if (!alunoId) {
    return NextResponse.json({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0 })
  }

  try {
    // 1. Unread Comunicados (Mural)
    // Needs to fetch comunicados for this aluno and check if they are in leituras
    let resolvedTurma = null;
    const { data: vData } = await supabase.from('vinculos').select('turma_id').eq('aluno_id', alunoId).single();
    if (vData?.turma_id) {
      const { data: tData } = await supabase.from('turmas').select('nome').eq('id', vData.turma_id).single();
      resolvedTurma = tData?.nome || vData.turma_id;
    }

    const conditions = [`destino.eq.todos`];
    if (resolvedTurma) {
      conditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
      if (resolvedTurma !== vData?.turma_id) {
         conditions.push(`dados->turmas.cs.["${vData?.turma_id}"]`);
      }
    }
    conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
    conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
    
    const { data: comunicados } = await supabase.from('comunicados')
      .select('id, dados')
      .or(conditions.join(','));

    let unreadMural = 0;
    if (comunicados) {
       for (const c of comunicados) {
          const ciencias = c.dados?.ciencias || {};
          if (!ciencias[alunoId]) {
             unreadMural++;
          }
       }
    }

    let unreadChat = 0;
    const { data: chatsData } = await supabase.from('agenda_chats')
      .select('id, dados')
      .like('id', `${alunoId}-%`);

    if (chatsData) {
      for (const chat of chatsData) {
        if (chat.dados && chat.dados.unread > 0) {
          // Precisamos descobrir se a última mensagem foi enviada pela escola ('us')
          // Porque se foi enviada pela família ('them'), o unread é para a escola, não para a família.
          const { data: msgs } = await supabase.from('agenda_mensagens')
            .select('dados')
            .eq('dados->>chatId', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (msgs) {
             const sender = msgs.dados?.sender;
             // Na visão da família, se a escola enviou ('us' no mockup original ou 'school'), é unread.
             // Se o backend salva as mensagens da escola como 'us' (pois admin envia como 'us' na sua view):
             if (sender === 'us' || sender === 'school') {
                unreadChat++;
             }
          } else {
             // Caso não haja fallback fácil, assumimos unread apenas para simplificar se o banco estiver instável
             unreadChat++;
          }
        }
      }
    }

    return NextResponse.json({
      unreadMural,
      unreadChat,
      unreadMomentos: 0
    })
  } catch (err) {
    console.error("Erro ao buscar notificações unread:", err);
    return NextResponse.json({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0 })
  }
}
