import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase.from('system_users').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const mapped = data?.map(u => ({ ...u, ultimoAcesso: u.ultimoacesso || u.ultimoAcesso })) || []
  return NextResponse.json(mapped)
}

export async function POST(req: Request) {
  const body = await req.json()
  
  const prepare = (b: any) => { 
     const out = { ...b }; 
     if ('ultimoAcesso' in out) { out.ultimoacesso = out.ultimoAcesso; delete out.ultimoAcesso; }
     return out;
  }

  // se for array faz upsert de tudo para evitar duplo POST no mesmo milisegundo (Next.js react bugs)
  if (Array.isArray(body)) {
      const fixedBody = body.map(prepare)
      const { data, error } = await supabase.from('system_users').upsert(fixedBody).select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
  }
  
  // single upsert
  const fixedBody = prepare(body)
  const { data, error } = await supabase.from('system_users').upsert([fixedBody]).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
