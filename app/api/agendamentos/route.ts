import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase.from('agendamentos').select('*').order('data')
  if (status) query = query.eq('status', status)

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
      const rows = body.map(a => buildRow(a))
      const { error } = await supabase.from('agendamentos').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('agendamentos').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
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
  const { error } = await supabase.from('agendamentos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(a: any) {
  const { id, titulo, descricao, data, hora, responsavel, status, ...rest } = a
  return {
    id: id || `AG-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    titulo: titulo || '', descricao: descricao || '',
    data: data || new Date().toISOString().split('T')[0],
    hora: hora || '', responsavel: responsavel || '',
    status: status || 'agendado', dados: rest,
    updated_at: new Date().toISOString(),
  }
}
