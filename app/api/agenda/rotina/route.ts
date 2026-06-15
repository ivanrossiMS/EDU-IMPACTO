import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const accessStartDate = await getLoggedUserAccessStartDate()
    let query = supabase.from('rotina_items').select('*')
    if (accessStartDate) {
      query = query.gte('created_at', accessStartDate.toISOString())
    }
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json(data || [], {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRowAuth)
      const { error } = await supabase.from('rotina_items').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('rotina_items').upsert(row).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  return {
    id: body.id || crypto.randomUUID(),
    turma: body.turma || '',
    dia_semana: body.dia_semana || 1,
    hora_inicio: body.hora_inicio || '',
    hora_fim: body.hora_fim || '',
    disciplina: body.disciplina || '',
    professor: body.professor || '',
    sala: body.sala || '',
    tipo: body.tipo || 'aula',
    cor: body.cor || '#3b82f6',
  }
}
