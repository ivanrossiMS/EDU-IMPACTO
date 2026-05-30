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
    
    // 1. Unread Comunicados (Mural)
    const { data: comunicados } = await supabase.from('comunicados')
      .select('id')
      .or(conditions.join(','))
      .is(`dados->leituras->>${alunoId}`, null);

    const unreadMural = comunicados?.length || 0;

    // 2. Unread Momentos
    const momentosConditions = [`dados->targetClasses.cs.["TODOS"]`, `dados->targetClasses.cs.["Toda a Escola"]`];
    if (resolvedTurma) {
       momentosConditions.push(`dados->targetClasses.cs.["${resolvedTurma}"]`);
       if (resolvedTurma !== vData?.turma_id) {
          momentosConditions.push(`dados->targetClasses.cs.["${vData?.turma_id}"]`);
       }
    }
    const { data: momentos } = await supabase.from('momentos')
       .select('id')
       .eq('dados->>status', 'approved')
       .or(momentosConditions.join(','))
       .is(`dados->leituras->>${alunoId}`, null);
       
    const unreadMomentos = momentos?.length || 0;

    // 3. Unread Calendario (eventos)
    const eventosConditions = [`dados->turmas.cs.["Todos"]`, `dados->turmas.cs.["Toda a escola"]`];
    if (resolvedTurma) {
       eventosConditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
       if (resolvedTurma !== vData?.turma_id) {
          eventosConditions.push(`dados->turmas.cs.["${vData?.turma_id}"]`);
       }
    }
    const { data: eventos } = await supabase.from('eventos')
       .select('id')
       .or(eventosConditions.join(','))
       .is(`dados->leituras->>${alunoId}`, null);
       
    const unreadCalendario = eventos?.length || 0;

    // 4. Unread Ocorrencias
    const { data: ocorrencias } = await supabase.from('ocorrencias')
       .select('id')
       .eq('dados->>aluno_id', alunoId)
       .is(`dados->leituras->>${alunoId}`, null);
       
    const unreadOcorrencias = ocorrencias?.length || 0;

    // 5. Unread Notas (boletins)
    const { data: notas } = await supabase.from('boletins')
       .select('id')
       .eq('aluno_id', alunoId)
       .is(`dados->leituras->>${alunoId}`, null);
       
    const unreadNotas = notas?.length || 0;

    let unreadChat = 0;

    return NextResponse.json({
      unreadMural,
      unreadMomentos,
      unreadCalendario,
      unreadOcorrencias,
      unreadNotas,
      unreadChat
    })
  } catch (err) {
    console.error("Erro ao buscar notificações unread:", err);
    return NextResponse.json({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0, unreadCalendario: 0, unreadOcorrencias: 0, unreadNotas: 0 })
  }
}
