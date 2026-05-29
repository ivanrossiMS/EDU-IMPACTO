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
