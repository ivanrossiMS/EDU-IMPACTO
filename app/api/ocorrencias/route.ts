import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const alunoId = searchParams.get('aluno_id')

  let query = supabase.from('ocorrencias').select('*')
  
  const accessStartDate = await getLoggedUserAccessStartDate()
  if (accessStartDate) {
    query = query.gte('created_at', accessStartDate.toISOString())
  }

  query = query.order('created_at', { ascending: false })
  if (alunoId) {
    query = query.or(`aluno_id.eq.${alunoId},dados->>aluno_id.eq.${alunoId},dados->>alunoId.eq.${alunoId}`)
  } else {
    // Prevent full table scans on global queries
    query = query.limit(100)
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ocorrencias = data || [];
  
  // Buscar nomes das turmas com supabaseServer (ignora RLS que bloqueia Família)
  const turmaIds = [...new Set(ocorrencias.map(o => o.dados?.turma).filter(Boolean))];
  let turmasDict: Record<string, string> = {};
  if (turmaIds.length > 0) {
    const { supabaseServer } = await import('@/lib/supabaseServer');
    const { data: turmasData } = await supabaseServer
      .from('turmas')
      .select('id, nome')
      .in('id', turmaIds);
      
    if (turmasData) {
      turmasData.forEach(t => {
        turmasDict[t.id] = t.nome;
      });
    }
  }

  return NextResponse.json(ocorrencias.map(row => {
    const turmaId = row.dados?.turma;
    return { 
      ...row, 
      ...(row.dados || {}),
      turmaNome: turmaId && turmasDict[turmaId] ? turmasDict[turmaId] : turmaId
    };
  }))
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(o => buildRow(o))
      const { error } = await supabase.from('ocorrencias').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      for (const row of rows) {
        const targetIds = await getResponsavelIdsForTargets({ targetStudents: [row.aluno_id] })
        if (targetIds.length > 0) {
          const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', row.aluno_id).single()
          const nomeAluno = aluno?.nome ? aluno.nome : 'o aluno'
          await sendAgendaPushNotification({
            type: 'ocorrencias',
            itemId: String(row.id),
            title: '⚠️ Aviso de Ocorrência',
            message: `Uma nova ocorrência foi registrada para ${nomeAluno}. Acesse para ver os detalhes.`,
            targetUserIds: targetIds,
            targetUrl: `/agenda-digital/ocorrencias`
          }).catch(err => console.error('Ocorrencia Push Error:', err))
        }
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('ocorrencias').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const targetIds = await getResponsavelIdsForTargets({ targetStudents: [data.aluno_id] })
    if (targetIds.length > 0) {
      const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', data.aluno_id).single()
      const nomeAluno = aluno?.nome ? aluno.nome : 'o aluno'
      sendAgendaPushNotification({
        type: 'ocorrencias',
        itemId: String(data.id),
        title: '⚠️ Aviso de Ocorrência',
        message: `Uma nova ocorrência foi registrada para ${nomeAluno}. Acesse para ver os detalhes.`,
        targetUserIds: targetIds,
        targetUrl: `/agenda-digital/ocorrencias`
      }).catch(err => console.error('Ocorrencia Push Error:', err))
    }

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('ocorrencias').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(o: any) {
  const { id, alunoId, tipoId, descricao, data, status, ...rest } = o
  return {
    id: id || `OC-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    aluno_id: alunoId || '',
    tipo_id: tipoId || '',
    descricao: descricao || '',
    data: data || new Date().toISOString().split('T')[0],
    status: status || 'aberta',
    dados: rest,
  }
}
