import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase.from('configuracoes').select('valor').eq('chave', 'usuarios').single()
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 }) // PGRST116 = zero rows
  return NextResponse.json(data ? data.valor : [])
}

export async function POST(req: Request) {
  const body = await req.json()
  
  // get existing
  const { data: current } = await supabase.from('configuracoes').select('valor').eq('chave', 'usuarios').single()
  let users = current?.valor || []
  if (!Array.isArray(users)) users = []

  // Add elements without duplication
  const newItems = Array.isArray(body) ? body : [body]
  for (const item of newItems) {
    if (item.id && !users.some((u: any) => u.id === item.id)) {
      users.push(item)
    } else if (!item.id) {
       // local storage should always provide IDs, but just in case
       users.push(item)
    }
  }

  // update config kv
  const { data, error } = await supabase.from('configuracoes').upsert({ chave: 'usuarios', valor: users }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.valor)
}
