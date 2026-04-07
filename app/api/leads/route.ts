import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.toLowerCase()

  let query = supabaseServer.from('leads').select('*').order('data', { ascending: false })
  if (status && status !== 'todos') query = query.eq('status', status)
  if (q) query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(l => buildRow(l))
      const { error } = await supabaseServer.from('leads').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }
    const row = buildRow(body)
    const { data, error } = await supabaseServer.from('leads').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(l: any) {
  const { id, nome, interesse, origem, status, responsavel, data,
    telefone, email, score_ia, valor_potencial, notas, ...rest } = l
  return {
    id: id || `LEAD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    nome: nome || '', interesse: interesse || '', origem: origem || '',
    status: status || 'novo', responsavel: responsavel || '',
    data: data || new Date().toISOString().split('T')[0],
    telefone: telefone || '', email: email || '',
    score_ia: Number(score_ia) || 0, valor_potencial: Number(valor_potencial) || 0,
    notas: notas || '', dados: rest, updated_at: new Date().toISOString(),
  }
}
