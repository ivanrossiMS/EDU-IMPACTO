import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const memCache = new Map<string, { value: any, timestamp: number }>();
const CACHE_TTL = 300_000; // 5 minutos

// GET /api/configuracoes?chave=cfgDisciplinas  → single key
// GET /api/configuracoes                        → all keys
// GET /api/configuracoes?chaves=k1,k2,k3       → bulk fetch (NEW — eliminates 16 separate requests)
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // Usa o Service Role para ler configurações globais, garantindo acesso a famílias sem barreiras de RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(request.url)
  const chave = searchParams.get('chave')
  const chaves = searchParams.get('chaves')  // comma-separated bulk

  // ── BULK fetch (multiple keys in one query) ─────────────────────
  if (chaves) {
    const keys = chaves.split(',').map(k => k.trim()).filter(Boolean)
    if (keys.length === 0) return NextResponse.json({})

    const cacheKey = keys.sort().join(',');
    const cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return NextResponse.json(cached.value, {
         headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' }
       })
    }

    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', keys)

    if (error) return NextResponse.json({}, { status: 500 })

    // Return as { chave: valor } map
    const result: Record<string, any> = {}
    for (const row of data || []) {
      result[row.chave] = row.valor
    }

    memCache.set(cacheKey, { value: result, timestamp: Date.now() });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600'
      }
    })
  }

  // ── Single key ─────────────────────────────────────────────────
  if (chave) {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .single()
    if (error) return NextResponse.json({ valor: null })
    return NextResponse.json({ valor: data?.valor ?? null })
  }

  // ── All configs ─────────────────────────────────────────────────
  const { data, error } = await supabase.from('configuracoes').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/configuracoes  { chave: 'cfgDisciplinas', valor: [...] }
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const { chave, valor } = await request.json()
    if (!chave) return NextResponse.json({ error: 'chave required' }, { status: 400 })

    const { data, error } = await supabase
      .from('configuracoes')
      .upsert({ chave, valor, updated_at: new Date().toISOString() })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
