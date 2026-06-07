import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authClient = await createProtectedClient();
  const supabase = supabaseServer;
  
  const { searchParams } = new URL(request.url)
  const alunoId = searchParams.get('aluno_id')
  
  if (!alunoId) {
    return NextResponse.json({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0, unreadCalendario: 0, unreadOcorrencias: 0, unreadNotas: 0 })
  }

  try {
    const accessStartDate = await getLoggedUserAccessStartDate()

    // 1. Resolve Turma from 'alunos' and 'turmas' tables (since 'vinculos' table does not exist)
    let resolvedTurma = null;
    let turmaId = null;
    const { data: student } = await supabase.from('alunos').select('turma').eq('id', alunoId).maybeSingle();
    if (student?.turma) {
      turmaId = student.turma;
      const { data: tData } = await supabase.from('turmas').select('nome').eq('id', student.turma).maybeSingle();
      if (tData && tData.nome) {
        resolvedTurma = tData.nome;
      } else {
        const { data: cData } = await supabase.from('turmas').select('nome').eq('codigo', student.turma).maybeSingle();
        if (cData && cData.nome) {
          resolvedTurma = cData.nome;
        } else {
          resolvedTurma = student.turma;
        }
      }
    }

    // 2. Unread Comunicados (Mural)
    const conditions = [`destino.eq.todos`];
    if (resolvedTurma) {
      conditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
      if (resolvedTurma !== turmaId) {
         conditions.push(`dados->turmas.cs.["${turmaId}"]`);
      }
    }
    conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
    conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
    conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
    
    let comQuery = supabase.from('comunicados').select('id, dados').or(conditions.join(','));
    if (accessStartDate) {
      comQuery = comQuery.gte('data', accessStartDate.toISOString());
    }
    
    const { data: comunicados, error: comError } = await comQuery;
    if (comError) throw new Error(`Comunicados error: ${comError.message}`);

    const unreadMural = comunicados?.filter(c => {
      const mergedStatus = (c as any).status || c.dados?.status || 'enviado';
      if (mergedStatus === 'rascunho' || mergedStatus === 'agendado') return false;
      const leituras = (c as any).leituras || c.dados?.leituras || {};
      return !leituras[alunoId];
    }).length || 0;

    // 3. Unread Momentos
    const momentosConditions = [`dados->targetClasses.cs.["TODOS"]`, `dados->targetClasses.cs.["Toda a Escola"]`, `dados->targetClasses.cs.["Toda a escola"]`];
    if (resolvedTurma) {
       momentosConditions.push(`dados->targetClasses.cs.["${resolvedTurma}"]`);
       if (resolvedTurma !== turmaId) {
          momentosConditions.push(`dados->targetClasses.cs.["${turmaId}"]`);
       }
    }
    let momQuery = supabase.from('momentos')
       .select('id, dados')
       .eq('dados->>status', 'approved')
       .or(momentosConditions.join(','));
       
    if (accessStartDate) {
      momQuery = momQuery.gte('created_at', accessStartDate.toISOString());
    }
    
    const { data: momentos, error: momError } = await momQuery;
    if (momError) throw new Error(`Momentos error: ${momError.message}`);
       
    const unreadMomentos = momentos?.filter(m => {
      const leituras = (m as any).leituras || m.dados?.leituras || {};
      return !leituras[alunoId];
    }).length || 0;

    // 4. Unread Calendario (eventos_agenda)
    const eventosConditions = [`turmas.cs.["Todos"]`, `turmas.cs.["Toda a escola"]`, `turmas.cs.["Toda a Escola"]`];
    if (resolvedTurma) {
       eventosConditions.push(`turmas.cs.["${resolvedTurma}"]`);
       if (resolvedTurma !== turmaId) {
          eventosConditions.push(`turmas.cs.["${turmaId}"]`);
       }
    }
    let evQuery = supabase.from('eventos_agenda')
       .select('id, dados')
       .or(eventosConditions.join(','));
       
    if (accessStartDate) {
      const accessStartDateStr = accessStartDate.toISOString().substring(0, 10);
      evQuery = evQuery.gte('data', accessStartDateStr);
    }
    
    const { data: eventos, error: evError } = await evQuery;
    if (evError) throw new Error(`Eventos error: ${evError.message}`);
       
    const unreadCalendario = eventos?.filter((e: any) => {
      const leituras = e.leituras || e.dados?.leituras || {};
      return !leituras[alunoId];
    }).length || 0;

    // 5. Unread Ocorrencias
    let ocQuery = supabase.from('ocorrencias')
       .select('id, dados')
       .or(`aluno_id.eq.${alunoId},dados->>aluno_id.eq.${alunoId},dados->>alunoId.eq.${alunoId}`);
       
    if (accessStartDate) {
      ocQuery = ocQuery.gte('created_at', accessStartDate.toISOString());
    }
    
    const { data: ocorrencias, error: ocError } = await ocQuery;
    if (ocError) throw new Error(`Ocorrencias error: ${ocError.message}`);
       
    const unreadOcorrencias = ocorrencias?.filter((o: any) => {
      const leituras = o.leituras || o.dados?.leituras || {};
      return !leituras[alunoId];
    }).length || 0;

    // 6. Unread Notas (boletins)
    const alunoStr = String(alunoId)
    const alunoSemZero = alunoStr.replace(/^0+/, '')
    let bolQuery = supabase.from('boletins').select('id, dados');
    if (alunoStr !== alunoSemZero) {
       bolQuery = bolQuery.or(`aluno_id.eq.${alunoStr},aluno_id.eq.${alunoSemZero}`)
    } else {
       bolQuery = bolQuery.eq('aluno_id', alunoId)
    }
    
    if (accessStartDate) {
      bolQuery = bolQuery.gte('created_at', accessStartDate.toISOString());
    }
    
    const { data: notas, error: notasError } = await bolQuery;
    if (notasError) throw new Error(`Notas error: ${notasError.message}`);
       
    const unreadNotas = notas?.filter((b: any) => {
      const leituras = b.leituras || b.dados?.leituras || {};
      return !leituras[alunoId];
    }).length || 0;

    // 7. Unread Frequencia
    let freqQuery = supabase.from('frequencias').select('id, dados, leituras').eq('aluno_id', alunoId);
    if (accessStartDate) {
      freqQuery = freqQuery.gte('created_at', accessStartDate.toISOString());
    }
    const { data: frequencias, error: freqError } = await freqQuery;
    if (freqError) throw new Error(`Frequencias error: ${freqError.message}`);
    const unreadFrequencia = frequencias?.filter((f: any) => {
      const leituras = f.leituras || f.dados?.leituras || {};
      return !leituras[alunoId];
    }).length || 0;

    let unreadChat = 0;

    return NextResponse.json({
      unreadMural,
      unreadMomentos,
      unreadCalendario,
      unreadOcorrencias,
      unreadNotas,
      unreadFrequencia,
      unreadChat
    })
  } catch (err: any) {
    console.error("Erro ao buscar notificações unread:", err);
    return NextResponse.json({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0, unreadCalendario: 0, unreadOcorrencias: 0, unreadNotas: 0, unreadFrequencia: 0 })
  }
}
