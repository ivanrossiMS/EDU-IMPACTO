import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  let query = supabaseServer.from('funcionarios').select('*').order('nome')
  if (status && status !== 'Todos') query = query.eq('status', status)
  if (q) query = query.or(`nome.ilike.%${q}%,cargo.ilike.%${q}%,departamento.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(r => ({ ...r, ...(r.dados || {}) })))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, nome, cargo, departamento, salario, status, email, admissao, unidade, ...rest } = body
    const row = {
      id: id || `F${Date.now()}`,
      nome, cargo: cargo || '', departamento: departamento || '',
      salario: salario || 0, status: status || 'ativo',
      email: email || '', admissao: admissao || '',
      unidade: unidade || '', dados: rest,
    }
    const { data, error } = await supabaseServer.from('funcionarios').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
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
    const { nome, cargo, departamento, salario, status, email, admissao, unidade, ...rest } = body
    const { data, error } = await supabaseServer.from('funcionarios').update({
      nome, cargo: cargo || '', departamento: departamento || '',
      salario: salario || 0, status: status || 'ativo',
      email: email || '', admissao: admissao || '',
      unidade: unidade || '', dados: rest,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseServer.from('funcionarios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
