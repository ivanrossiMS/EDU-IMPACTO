import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
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
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(f => buildRow(f))
      const { error } = await supabase.from('frequencias').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('frequencias').upsert(row).select().single()
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
  const { error } = await supabase.from('frequencias').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(f: any) {
  const { id, alunoId, turmaId, data, presente, justificativa, ...rest } = f
  return {
    id: id || `FREQ-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    aluno_id: alunoId || '',
    turma_id: turmaId || '',
    data: data || new Date().toISOString().split('T')[0],
    presente: presente !== undefined ? Boolean(presente) : true,
    justificativa: justificativa || '',
    dados: rest,
  }
}
