import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

// Cache persistente em Dev Mode para evitar wiping durante Hot-Reloads
const globalCache = (global as any).configCache || new Map<string, { value: any, timestamp: number }>();
if (process.env.NODE_ENV !== 'production') {
  (global as any).configCache = globalCache;
}
const CACHE_TTL = 300_000; // 5 minutos

// Chaves que são puramente visuais/públicas e não necessitam de bloqueio por autenticação
const PUBLIC_KEYS = ['ad_banner', 'ad_config', 'cfgTurnos', 'cfgTiposOcorrencia'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chave = searchParams.get('chave')
  const chaves = searchParams.get('chaves')  // comma-separated bulk

  // Verifica se as chaves solicitadas são todas públicas
  let isPublicRequest = false;
  if (chaves) {
    const keys = chaves.split(',').map(k => k.trim()).filter(Boolean);
    isPublicRequest = keys.every(k => PUBLIC_KEYS.includes(k));
  } else if (chave) {
    isPublicRequest = PUBLIC_KEYS.includes(chave);
  }

  // Se não for uma requisição apenas de chaves públicas, exige autenticação
  if (!isPublicRequest) {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
  }

  const supabase = getAdminClient();

  // ── BULK fetch (multiple keys in one query) ─────────────────────
  if (chaves) {
    const keys = chaves.split(',').map(k => k.trim()).filter(Boolean)
    if (keys.length === 0) return NextResponse.json({})

    const cacheKey = keys.sort().join(',');
    const cached = globalCache.get(cacheKey);
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

    globalCache.set(cacheKey, { value: result, timestamp: Date.now() });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600'
      }
    })
  }

  // ── Single key ─────────────────────────────────────────────────
  if (chave) {
    const cacheKey = `single:${chave}`;
    const cached = globalCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ valor: cached.value }, {
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' }
      })
    }

    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .single()
    if (error) return NextResponse.json({ valor: null })

    globalCache.set(cacheKey, { value: data?.valor ?? null, timestamp: Date.now() });
    return NextResponse.json({ valor: data?.valor ?? null }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' }
    })
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
