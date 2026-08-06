import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'

import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turma_id')
  const alunoId = searchParams.get('aluno_id')
  const data = searchParams.get('data')

  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 10000

  let query = supabase.from('frequencias').select('*').order('data', { ascending: false }).limit(limit)

  if (turmaId) {
    const { data: allTurmas } = await supabase.from('turmas').select('*')
    const { data: allAlunos } = await supabase.from('alunos').select('id, turma, status, dados').or('status.neq.inativo,status.is.null')

    const targetTurma = (allTurmas || []).find(t => String(t.id) === String(turmaId) || String(t.codigo) === String(turmaId) || String(t.nome) === String(turmaId))
    const studentIds = (allAlunos || [])
      .filter(a => isAlunoCursandoTurma(a, targetTurma || turmaId, undefined, allTurmas || []))
      .map(a => String(a.id))

    if (studentIds.length > 0) {
      query = query.or(`turma_id.eq.${turmaId},aluno_id.in.(${studentIds.join(',')})`)
    } else {
      query = query.eq('turma_id', turmaId)
    }
  }

  if (alunoId) query = query.eq('aluno_id', alunoId)
  if (data) query = query.eq('data', data)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const map = new Map<string, any>()
  ;(rows || []).forEach(row => {
    const key = `${row.aluno_id}_${String(row.data).split('T')[0]}`
    if (!map.has(key)) {
      map.set(key, row)
    } else {
      const existing = map.get(key)
      const existingDate = new Date(existing.updated_at || existing.created_at || existing.data).getTime()
      const newDate = new Date(row.updated_at || row.created_at || row.data).getTime()
      if (newDate > existingDate) {
        map.set(key, row)
      }
    }
  })

  const finalRows = Array.from(map.values())
  return NextResponse.json(finalRows.map(row => ({ ...row, ...(row.dados || {}) })))
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(f => buildRow(f))
      const { error } = await supabase.from('frequencias').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Lote otimizado para não dar timeout no Vercel/Netlify
      const targetData = await getStudentTargetsForComunicados({ targetStudents: rows.map(r => String(r.aluno_id)) })
      
      const pushPromises = rows.map(async (row) => {
        const studentInfo = targetData.students.find(s => String(s.aluno_id) === String(row.aluno_id))
        if (!studentInfo || studentInfo.responsaveis_ids.length === 0) return

        const nomeAluno = studentInfo.aluno_nome || 'o aluno'
        const isPresent = row.presente !== false
        const pushTitle = isPresent ? '✅ Presença Confirmada' : '❌ Falta Registrada'
        const pushMsg = isPresent 
          ? `A presença de ${nomeAluno} foi confirmada na escola.` 
          : `Foi registrada uma falta para ${nomeAluno}.`

        try {
          await sendAgendaPushNotification({
            type: 'frequencia',
            itemId: String(row.id),
            title: pushTitle,
            message: pushMsg,
            targetUserIds: studentInfo.responsaveis_ids,
            targetUrl: `/agenda-digital/frequencia`
          })
        } catch (err) {
          console.error('Frequencia Push Error:', err)
        }
      })

      // Executa os envios em paralelo e não bloqueia 100% caso demore muito, enviando em chunks
      const chunkSize = 50
      for (let i = 0; i < pushPromises.length; i += chunkSize) {
        await Promise.all(pushPromises.slice(i, i + chunkSize))
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('frequencias').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const targetIds = await getResponsavelIdsForTargets({ targetStudents: [data.aluno_id] })
    if (targetIds.length > 0) {
      const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', data.aluno_id).single()
      const nomeAluno = aluno?.nome ? aluno.nome : 'o aluno'
      
      const isPresent = data.presente !== false;
      const pushTitle = isPresent ? '✅ Presença Confirmada' : '❌ Falta Registrada';
      const pushMsg = isPresent 
        ? `A presença de ${nomeAluno} foi confirmada na escola.` 
        : `Foi registrada uma falta para ${nomeAluno}.`;

      sendAgendaPushNotification({
        type: 'frequencia',
        itemId: String(data.id),
        title: pushTitle,
        message: pushMsg,
        targetUserIds: targetIds,
        targetUrl: `/agenda-digital/frequencia`
      }).catch(err => console.error('Frequencia Push Error:', err))
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
  const all = searchParams.get('all')
  
  if (all === 'true') {
    const { error } = await supabase.from('frequencias').delete().neq('id', 'non-existent-id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, message: 'Todos os registros foram excluídos.' })
  }
  
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('frequencias').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(f: any) {
  const { id, alunoId, turmaId, data, presente, justificativa, anoLetivo, registradoPor, origem, horaRegistro, ...rest } = f
  const currentYear = new Date().getFullYear().toString()
  const year = anoLetivo || currentYear
  const diarioId = `DIARIO-${turmaId}-${year}`
  
  return {
    id: id || `FREQ-${alunoId}-${data}`,
    aluno_id: alunoId || '',
    turma_id: turmaId || '',
    data: data || new Date().toISOString().split('T')[0],
    presente: presente !== undefined ? Boolean(presente) : true,
    justificativa: justificativa || '',
    dados: {
      ...rest,
      diarioId,
      anoLetivo: year,
      registradoPor: registradoPor || rest.registradoPor || 'Manual',
      origem: origem || rest.origem || 'manual',
      horaRegistro: horaRegistro || rest.horaRegistro || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    },
  }
}
