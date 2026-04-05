import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase.from('system_users').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  
  // se for array faz upsert de tudo para evitar duplo POST no mesmo milisegundo (Next.js react bugs)
  if (Array.isArray(body)) {
      const { data, error } = await supabase.from('system_users').upsert(body).select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
  }
  
  // single upsert
  const { data, error } = await supabase.from('system_users').upsert([body]).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
