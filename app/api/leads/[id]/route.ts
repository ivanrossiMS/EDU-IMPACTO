import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { data, error } = await supabaseServer.from('leads').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ ...data, ...(data.dados || {}) })
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const body = await request.json()
    const { nome, interesse, origem, status, responsavel, data, telefone, email,
      score_ia, valor_potencial, notas, ...rest } = body
    const row = {
      id: id, nome: nome || '', interesse: interesse || '', origem: origem || '',
      status: status || 'novo', responsavel: responsavel || '',
      data: data || new Date().toISOString().split('T')[0],
      telefone: telefone || '', email: email || '',
      score_ia: Number(score_ia) || 0, valor_potencial: Number(valor_potencial) || 0,
      notas: notas || '', dados: rest, updated_at: new Date().toISOString(),
    }
    const { data: d, error } = await supabaseServer.from('leads').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...d, ...(d.dados || {}) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { error } = await supabaseServer.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
