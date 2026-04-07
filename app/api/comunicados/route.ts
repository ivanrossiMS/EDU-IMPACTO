import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('comunicados').select('*').order('data', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(row => ({ ...row, ...(row.dados || {}) })))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(c => buildRow(c))
      const { error } = await supabaseServer.from('comunicados').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabaseServer.from('comunicados').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseServer.from('comunicados').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

function buildRow(c: any) {
  const { id, titulo, texto, autor, data, destino, fixado, ...rest } = c
  return {
    id: id || `COM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    titulo: titulo || '', texto: texto || '', autor: autor || '',
    data: data || new Date().toISOString().split('T')[0],
    destino: destino || 'todos', fixado: Boolean(fixado),
    dados: rest, updated_at: new Date().toISOString(),
  }
}
