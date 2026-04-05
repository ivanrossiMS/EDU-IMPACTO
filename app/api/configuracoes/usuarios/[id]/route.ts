import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const body = await req.json()
  const { id } = await context.params
  
  const { data: current } = await supabase.from('configuracoes').select('valor').eq('chave', 'usuarios').single()
  let users = current?.valor || []
  if (!Array.isArray(users)) users = []

  users = users.map((u: any) => u.id === id ? { ...u, ...body } : u)

  const { data, error } = await supabase.from('configuracoes').upsert({ chave: 'usuarios', valor: users }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.valor)
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  
  const { data: current } = await supabase.from('configuracoes').select('valor').eq('chave', 'usuarios').single()
  let users = current?.valor || []
  if (!Array.isArray(users)) users = []

  users = users.filter((u: any) => u.id !== id)

  const { error } = await supabase.from('configuracoes').upsert({ chave: 'usuarios', valor: users })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
