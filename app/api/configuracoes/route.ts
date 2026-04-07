import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/configuracoes?chave=cfgDisciplinas  → single key
// GET /api/configuracoes                        → all keys
// GET /api/configuracoes?chaves=k1,k2,k3       → bulk fetch (NEW — eliminates 16 separate requests)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chave = searchParams.get('chave')
  const chaves = searchParams.get('chaves')  // comma-separated bulk

  // ── BULK fetch (multiple keys in one query) ─────────────────────
  if (chaves) {
    const keys = chaves.split(',').map(k => k.trim()).filter(Boolean)
    if (keys.length === 0) return NextResponse.json({})

    const { data, error } = await supabaseServer
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', keys)

    if (error) return NextResponse.json({}, { status: 500 })

    // Return as { chave: valor } map
    const result: Record<string, any> = {}
    for (const row of data || []) {
      result[row.chave] = row.valor
    }
    return NextResponse.json(result)
  }

  // ── Single key ─────────────────────────────────────────────────
  if (chave) {
    const { data, error } = await supabaseServer
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .single()
    if (error) return NextResponse.json({ valor: null })
    return NextResponse.json({ valor: data?.valor ?? null })
  }

  // ── All configs ─────────────────────────────────────────────────
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
