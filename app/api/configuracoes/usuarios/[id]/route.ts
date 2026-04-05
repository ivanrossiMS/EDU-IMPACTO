import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { data, error } = await supabase.from('system_users').update(body).eq('id', params.id).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase.from('system_users').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
