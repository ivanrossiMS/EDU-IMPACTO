import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { data, error } = await supabaseServer
    .from('tarefas').select('*').order('prazo')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(r => ({ ...r, ...(r.dados || {}) })))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, titulo, descricao, responsavel, prazo, status, prioridade, ...rest } = body
    const row = {
      id: id || `TAR${Date.now()}`,
      titulo, descricao: descricao || '', responsavel: responsavel || '',
      prazo: prazo || '', status: status || 'pendente',
      prioridade: prioridade || 'media', dados: rest,
    }
    const { data, error } = await supabaseServer.from('tarefas').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
