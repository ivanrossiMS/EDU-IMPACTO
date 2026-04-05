import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { titulo, descricao, responsavel, prazo, status, prioridade, ...rest } = body
    const row = {
      titulo, descricao: descricao || '', responsavel: responsavel || '',
      prazo: prazo || '', status: status || 'pendente',
      prioridade: prioridade || 'media', dados: rest,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabaseServer.from('tarefas').update(row).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseServer.from('tarefas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
