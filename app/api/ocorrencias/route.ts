import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
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
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(row => ({ ...row, ...(row.dados || {}) })))
}

export async function POST(request: Request) {
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
          await sendAgendaPushNotification({
            type: 'ocorrencias',
            itemId: String(row.id),
            title: 'Nova ocorrência registrada',
            message: `Uma nova ocorrência foi registrada na agenda.`,
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
      sendAgendaPushNotification({
        type: 'ocorrencias',
        itemId: String(data.id),
        title: 'Nova ocorrência registrada',
        message: `Uma nova ocorrência foi registrada na agenda.`,
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
