import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const authClient = await createProtectedClient();
  const supabase = supabaseServer;
  
  const { searchParams } = new URL(request.url)
  const queryAlunoId = searchParams.get('aluno_id')
  
  // Se não foi passado aluno_id e o usuário é família/aluno, retorna 0 (precisa saber qual aluno).
  // Se for admin/colaborador, usamos o próprio user.id para as leituras.
  const isFamily = user.user_metadata?.perfil === 'Família' || user.user_metadata?.cargo === 'Aluno' || user.user_metadata?.cargo === 'Responsável'
  if (isFamily && !queryAlunoId) {
    return NextResponse.json({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0, unreadCalendario: 0, unreadOcorrencias: 0, unreadNotas: 0 })
  }

  // O identificador de leitura será o alunoId (se família) ou o próprio user.id (se admin/colab)
  const readerId = isFamily ? queryAlunoId : user.id

  try {
    const accessStartDate = await getLoggedUserAccessStartDate()

    let resolvedTurma = null;
    let turmaId = null;

    if (isFamily && queryAlunoId) {
      // 1. Resolve Turma do Aluno
      const { data: student } = await supabase.from('alunos').select('turma').eq('id', queryAlunoId).maybeSingle();
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
    }

    // 2. Unread Comunicados (Mural)
    let comQuery = supabase.from('comunicados').select('id, dados');
    
    if (isFamily && queryAlunoId) {
      const conditions = [`destino.eq.todos`];
      if (resolvedTurma) {
        conditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
        if (resolvedTurma !== turmaId) {
           conditions.push(`dados->turmas.cs.["${turmaId}"]`);
        }
      }
      conditions.push(`dados->alunosIds.cs.["${queryAlunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["a_${queryAlunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["_ALU${queryAlunoId}"]`);
      comQuery = comQuery.or(conditions.join(','));
    }
    // Admin/Colab buscam tudo (ou baseado no app deles), faremos filtro via JS pra simplificar leitura do JSON.
    
    if (accessStartDate) {
      comQuery = comQuery.gte('data', accessStartDate.toISOString());
    }
    
    const { data: comunicados, error: comError } = await comQuery;
    if (comError) throw new Error(`Comunicados error: ${comError.message}`);

    const unreadMural = comunicados?.filter(c => {
      const mergedStatus = c.status || c.dados?.status || 'enviado';
      if (mergedStatus === 'rascunho' || mergedStatus === 'agendado') return false;
      // Não conta se fui eu mesmo que mandei
      const autorId = c.autorId || c.dados?.autorId;
      if (String(autorId) === String(user.id)) return false;
      
      const leituras = (c as any).leituras || c.dados?.leituras || {};
      return !leituras[readerId as string];
    }).length || 0;

    // 3. Unread Momentos
    let momQuery = supabase.from('momentos').select('id, dados, created_at').eq('dados->>status', 'approved');
    if (isFamily && queryAlunoId) {
      const momentosConditions = [`dados->targetClasses.cs.["TODOS"]`, `dados->targetClasses.cs.["Toda a Escola"]`, `dados->targetClasses.cs.["Toda a escola"]`];
      if (resolvedTurma) {
         momentosConditions.push(`dados->targetClasses.cs.["${resolvedTurma}"]`);
         if (resolvedTurma !== turmaId) {
            momentosConditions.push(`dados->targetClasses.cs.["${turmaId}"]`);
         }
      }
      momQuery = momQuery.or(momentosConditions.join(','));
    }
       
    if (accessStartDate) {
      momQuery = momQuery.gte('created_at', accessStartDate.toISOString());
    }
    
    const { data: momentos, error: momError } = await momQuery;
    if (momError) throw new Error(`Momentos error: ${momError.message}`);
       
    const unreadMomentos = momentos?.filter(m => {
      const autorId = m.autorId || m.dados?.autorId;
      if (String(autorId) === String(user.id)) return false;
      const leituras = (m as any).leituras || m.dados?.leituras || {};
      return !leituras[readerId as string];
    }).length || 0;

    // 4. Unread Calendario (eventos_agenda)
    let evQuery = supabase.from('eventos_agenda').select('id, dados, turmas');
    if (isFamily && queryAlunoId) {
      const eventosConditions = [`turmas.cs.["Todos"]`, `turmas.cs.["Toda a escola"]`, `turmas.cs.["Toda a Escola"]`];
      if (resolvedTurma) {
         eventosConditions.push(`turmas.cs.["${resolvedTurma}"]`);
         if (resolvedTurma !== turmaId) {
            eventosConditions.push(`turmas.cs.["${turmaId}"]`);
         }
      }
      evQuery = evQuery.or(eventosConditions.join(','));
    }
       
    if (accessStartDate) {
      const accessStartDateStr = accessStartDate.toISOString().substring(0, 10);
      evQuery = evQuery.gte('data', accessStartDateStr);
    }
    
    const { data: eventos, error: evError } = await evQuery;
    if (evError) throw new Error(`Eventos error: ${evError.message}`);
       
    const unreadCalendario = eventos?.filter((e: any) => {
      const leituras = e.leituras || e.dados?.leituras || {};
      return !leituras[readerId as string];
    }).length || 0;

    // 5. Unread Ocorrencias
    let ocQuery = supabase.from('ocorrencias').select('id, dados, aluno_id');
    if (isFamily && queryAlunoId) {
      ocQuery = ocQuery.or(`aluno_id.eq.${queryAlunoId},dados->>aluno_id.eq.${queryAlunoId},dados->>alunoId.eq.${queryAlunoId}`);
    }
       
    if (accessStartDate) {
      ocQuery = ocQuery.gte('created_at', accessStartDate.toISOString());
    }
    
    const { data: ocorrencias, error: ocError } = await ocQuery;
    if (ocError) throw new Error(`Ocorrencias error: ${ocError.message}`);
       
    const unreadOcorrencias = ocorrencias?.filter((o: any) => {
      if (String(o.dados?.autorId) === String(user.id)) return false;
      const leituras = o.leituras || o.dados?.leituras || {};
      return !leituras[readerId as string];
    }).length || 0;

    // 6. Unread Notas (boletins)
    let bolQuery = supabase.from('boletins').select('id, dados, aluno_id');
    if (isFamily && queryAlunoId) {
      const alunoStr = String(queryAlunoId)
      const alunoSemZero = alunoStr.replace(/^0+/, '')
      if (alunoStr !== alunoSemZero) {
         bolQuery = bolQuery.or(`aluno_id.eq.${alunoStr},aluno_id.eq.${alunoSemZero}`)
      } else {
         bolQuery = bolQuery.eq('aluno_id', queryAlunoId)
      }
    }
    
    if (accessStartDate) {
      bolQuery = bolQuery.gte('created_at', accessStartDate.toISOString());
    }
    
    const { data: notas, error: notasError } = await bolQuery;
    if (notasError) throw new Error(`Notas error: ${notasError.message}`);
       
    const unreadNotas = notas?.filter((b: any) => {
      const leituras = b.leituras || b.dados?.leituras || {};
      return !leituras[readerId as string];
    }).length || 0;

    // FREQUENCIA REMOVIDA INTENCIONALMENTE (NÃO DEVE TER BADGE)

    return NextResponse.json({
      unreadMural,
      unreadMomentos,
      unreadCalendario,
      unreadOcorrencias,
      unreadNotas,
      unreadFrequencia: 0, // mantido 0 por compatibilidade
      unreadChat: 0
    })
  } catch (err: any) {
    console.error("Erro ao buscar notificações unread:", err);
    return NextResponse.json({ unreadMural: 0, unreadChat: 0, unreadMomentos: 0, unreadCalendario: 0, unreadOcorrencias: 0, unreadNotas: 0, unreadFrequencia: 0 })
  }
}
