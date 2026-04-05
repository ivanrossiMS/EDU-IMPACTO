import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  let query = supabaseServer.from('comunicados').select('*').order('data', { ascending: false })
  if (q) query = query.or(`titulo.ilike.%${q}%,autor.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(r => ({ ...r, ...(r.dados || {}) })))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, titulo, texto, autor, data, destino, fixado, ...rest } = body
    const row = {
      id: id || `COM${Date.now()}`,
      titulo, texto: texto || '', autor: autor || '',
      data: data || new Date().toISOString().slice(0, 10),
      destino: destino || 'Todos',
      fixado: fixado || false,
      dados: rest,
    }
    const { data: saved, error } = await supabaseServer.from('comunicados').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(saved, { status: 201 })
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
