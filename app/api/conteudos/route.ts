import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turma_id')
  const ano = searchParams.get('ano')
  const tipo = searchParams.get('tipo')

  let query = supabase.from('diario_conteudos').select('*').order('data', { ascending: false })
  if (turmaId) query = query.eq('turma_id', turmaId)
  if (ano) query = query.eq('ano', ano)
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(c => buildRow(c))
      const { error } = await supabase.from('diario_conteudos').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabase.from('diario_conteudos').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
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
  const { error } = await supabase.from('diario_conteudos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(c: any) {
  const { id, turma_id, ano, data, disciplina, conteudo, observacoes, aulas, tipo, data_entrega } = c
  return {
    id: id || `CNT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    turma_id: turma_id || '',
    ano: ano || '',
    data: data || new Date().toISOString().split('T')[0],
    disciplina: disciplina || '',
    conteudo: conteudo || '',
    observacoes: observacoes || '',
    aulas: aulas || 1,
    tipo: tipo || 'conteudo',
    data_entrega: data_entrega || null,
  }
}
