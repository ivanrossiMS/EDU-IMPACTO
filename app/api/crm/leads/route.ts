import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  let query = supabaseServer.from('leads').select('*').order('data', { ascending: false })
  if (status && status !== 'Todos') query = query.eq('status', status)
  if (q) query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(r => ({ ...r, ...(r.dados || {}) })))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, nome, interesse, origem, status, responsavel, data, telefone, email, score_ia, valor_potencial, notas, ...rest } = body

    const row = {
      id: id || `L${Date.now()}`,
      nome, interesse: interesse || '', origem: origem || '',
      status: status || 'novo', responsavel: responsavel || '',
      data: data || new Date().toISOString().slice(0, 10),
      telefone: telefone || '', email: email || '',
      score_ia: score_ia || 0, valor_potencial: valor_potencial || 0,
      notas: notas || '', dados: rest,
    }

    const { data: saved, error } = await supabaseServer.from('leads').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(saved, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const body = await request.json()
    const { nome, interesse, origem, status, responsavel, data, telefone, email, score_ia, valor_potencial, notas, ...rest } = body
    const row = {
      nome, interesse: interesse || '', origem: origem || '', status: status || 'novo',
      responsavel: responsavel || '', data: data || '', telefone: telefone || '',
      email: email || '', score_ia: score_ia || 0, valor_potencial: valor_potencial || 0,
      notas: notas || '', dados: rest, updated_at: new Date().toISOString(),
    }
    const { data: saved, error } = await supabaseServer.from('leads').update(row).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(saved)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseServer.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
