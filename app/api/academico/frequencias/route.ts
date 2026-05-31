import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turma_id')
  const alunoId = searchParams.get('aluno_id')
  const data = searchParams.get('data')

  let query = supabase.from('frequencias').select('*').order('data', { ascending: false })
  if (turmaId) query = query.eq('turma_id', turmaId)
  if (alunoId) query = query.eq('aluno_id', alunoId)
  if (data) query = query.eq('data', data)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows || []).map(row => ({ ...row, ...(row.dados || {}) })))
}

export async function POST(request: Request) {
  const supabase = createAdminClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(f => buildRow(f))
      const { error } = await supabase.from('frequencias').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      for (const row of rows) {
        // Enviar notificação para o aluno correspondente
        const targetIds = await getResponsavelIdsForTargets({ targetStudents: [row.aluno_id] })
        if (targetIds.length > 0) {
          await sendAgendaPushNotification({
            type: 'frequencia',
            itemId: String(row.id),
            title: 'Atualização de frequência',
            message: `Há uma nova atualização de frequência disponível.`,
            targetUserIds: targetIds,
            targetUrl: `/agenda-digital/frequencia`
          }).catch(err => console.error('Frequencia Push Error:', err))
        }
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('frequencias').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const targetIds = await getResponsavelIdsForTargets({ targetStudents: [data.aluno_id] })
    if (targetIds.length > 0) {
      sendAgendaPushNotification({
        type: 'frequencia',
        itemId: String(data.id),
        title: 'Atualização de frequência',
        message: `Há uma nova atualização de frequência disponível.`,
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
  const supabase = createAdminClient();
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
  const { id, alunoId, turmaId, data, presente, justificativa, anoLetivo, ...rest } = f
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
      anoLetivo: year
    },
  }
}
