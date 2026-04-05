import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/configuracoes?chave=cfgDisciplinas
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chave = searchParams.get('chave')

  if (chave) {
    const { data, error } = await supabaseServer
      .from('configuracoes').select('valor').eq('chave', chave).single()
    if (error) return NextResponse.json([]) // retorna vazio se não existe
    return NextResponse.json(data?.valor ?? [])
  }

  // All configs
  const { data, error } = await supabaseServer.from('configuracoes').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/configuracoes  { chave: 'cfgDisciplinas', valor: [...] }
export async function POST(request: Request) {
  try {
    const { chave, valor } = await request.json()
    if (!chave) return NextResponse.json({ error: 'chave required' }, { status: 400 })

    const { data, error } = await supabaseServer
      .from('configuracoes')
      .upsert({ chave, valor, updated_at: new Date().toISOString() })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
