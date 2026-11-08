import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

// Cache persistente em memória e em serverless containers
const globalCache = (globalThis as any).configCache || new Map<string, { value: any, timestamp: number }>();
(globalThis as any).configCache = globalCache;
const CACHE_TTL = 300_000; // 5 minutos

// Chaves que são puramente visuais/públicas e não necessitam de bloqueio por autenticação
const PUBLIC_KEYS = ['ad_banner', 'ad_config', 'cfgTurnos', 'cfgTiposOcorrencia'];

// Chaves sensíveis exclusivas da equipe administrativa (nunca expostas a família/aluno)
const SENSITIVE_STAFF_ONLY_CONFIG_KEYS = new Set([
  'zapsign_api_token',
  'cfgZapSignInteg',
  'matriculas_digitais_config',
  'matriculas_digitais_list',
  'matriculas_digitais_registros_v1',
  'matriculas_contratos_list',
  'matriculas_negociacoes_v1',
  'cfgBackupSnapshots',
  'catraca_ip',
  'catraca_user',
  'catraca_pass',
  'catraca_devices',
  'portaria_config',
  'totem_pin',
  'import_batches_history',
  'import_batches_list',
  'credimpacto_config',
  'boletos_titulos_emitidos',
  'fin_acordos_renegociacao',
  'fin_contas_pagar_v1',
  'fin_fornecedores_pagar_v1',
  'fin_orcamento_pagar_v1',
  'rh_folha_processada',
  'storage_auto_clean',
  'ocorrencias_push_config',
]);

// IDs de caixas simulados que não devem permanecer no banco de dados
const SIMULATED_CAIXA_IDS = new Set([
  'CX-108',
  'CX-102',
  'CX-98',
  'CX-94',
  'CX-19',
  'CX-11',
  'CX-1',
])

function filterOutSimulatedCaixas(list: any): { cleaned: any[]; removed: boolean } {
  if (!Array.isArray(list)) return { cleaned: [], removed: false }
  const cleaned = list.filter((c: any) => {
    if (!c || typeof c !== 'object') return false
    const id = String(c.id || '').trim()
    if (SIMULATED_CAIXA_IDS.has(id)) return false
    return true
  })
  return { cleaned, removed: cleaned.length !== list.length }
}

function isSensitiveConfigKey(k: string): boolean {
  const clean = String(k || '').trim()
  return SENSITIVE_STAFF_ONLY_CONFIG_KEYS.has(clean) || clean.startsWith('import_batch_')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chave = searchParams.get('chave')
  const chaves = searchParams.get('chaves')  // comma-separated bulk

  // Verifica se as chaves solicitadas são todas públicas
  let isPublicRequest = false;
  let touchesSensitiveKey = false;
  if (chaves) {
    const keys = chaves.split(',').map(k => k.trim()).filter(Boolean);
    isPublicRequest = keys.length > 0 && keys.every(k => PUBLIC_KEYS.includes(k));
    touchesSensitiveKey = keys.some(k => isSensitiveConfigKey(k));
  } else if (chave) {
    isPublicRequest = PUBLIC_KEYS.includes(chave);
    touchesSensitiveKey = isSensitiveConfigKey(chave);
  }

  // Se não for uma requisição apenas de chaves públicas, exige autenticação
  if (!isPublicRequest) {
    const { errorResponse } = await requireAuth(request)
    if (errorResponse) return errorResponse
  }

  if (touchesSensitiveKey) {
    const { requireStaff } = await import('@/lib/server/authGuard')
    const { errorResponse } = await requireStaff(request)
    if (errorResponse) return errorResponse
  }

  // Cabeçalhos estritos contra cache em CDN Edge / Proxy para evitar cache poisoning
  const cacheHeaders: Record<string, string> = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Netlify-CDN-Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  const supabase = getAdminClient();

  // ── BULK fetch (multiple keys in one query) ─────────────────────
  if (chaves) {
    const keys = chaves.split(',').map(k => k.trim()).filter(Boolean)
    if (keys.length === 0) return NextResponse.json({}, { headers: cacheHeaders })

    const cacheKey = keys.sort().join(',');
    const cached = globalCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return NextResponse.json(cached.value, { headers: cacheHeaders })
    }

    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', keys)

    if (error) return NextResponse.json({}, { status: 500 })

    // Return as { chave: valor } map
    const result: Record<string, any> = {}
    for (const row of data || []) {
      if (row.chave === 'cfgCaixas') {
        const { cleaned, removed } = filterOutSimulatedCaixas(row.valor)
        result[row.chave] = cleaned
        if (removed) {
          await supabase
            .from('configuracoes')
            .upsert({ chave: 'cfgCaixas', valor: cleaned, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
            .then(() => {}, () => {})
        }
      } else {
        result[row.chave] = row.valor
      }
    }

    globalCache.set(cacheKey, { value: result, timestamp: Date.now() });

    return NextResponse.json(result, { headers: cacheHeaders })
  }

  // ── Single key ─────────────────────────────────────────────────
  if (chave) {
    const cacheKey = `single:${chave}`;
    const cached = globalCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ valor: cached.value }, { headers: cacheHeaders })
    }

    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .single()
    if (error) return NextResponse.json({ valor: null }, { headers: cacheHeaders })

    let resolvedVal = data?.valor ?? null
    if (chave === 'cfgCaixas' && Array.isArray(resolvedVal)) {
      const { cleaned, removed } = filterOutSimulatedCaixas(resolvedVal)
      resolvedVal = cleaned
      if (removed) {
        await supabase
          .from('configuracoes')
          .upsert({ chave: 'cfgCaixas', valor: cleaned, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
          .then(() => {}, () => {})
      }
    }

    globalCache.set(cacheKey, { value: resolvedVal, timestamp: Date.now() });
    return NextResponse.json({ valor: resolvedVal }, { headers: cacheHeaders })
  }


  // ── All configs ─────────────────────────────────────────────────
  const { resolveUserRole } = await import('@/lib/server/authGuard')
  const { isStaff } = await resolveUserRole(request)
  const { data, error } = await supabase.from('configuracoes').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const filteredData = isStaff
    ? (data || [])
    : (data || []).filter((item: any) => !isSensitiveConfigKey(String(item.chave || '')))
  return NextResponse.json(filteredData, { headers: cacheHeaders })
}

// POST /api/configuracoes  { chave: 'cfgDisciplinas', valor: [...] }
export async function POST(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = getAdminClient();
  try {
    const body = await request.json()
    const { clearPerfilAcessoCache } = await import('@/lib/server/perfilAcessoCache')
    const { invalidateAdConfigCache } = await import('@/lib/server/agendaNotifications')
    
    // Suporte a salvamento em lote de múltiplas configurações de uma só vez
    if (Array.isArray(body?.items) && body.items.length > 0) {
      const rows = body.items
        .filter((it: any) => it && it.chave)
        .map((it: any) => ({
          chave: it.chave,
          valor: it.valor,
          updated_at: new Date().toISOString()
        }))

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Nenhum item válido com chave fornecido' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('configuracoes')
        .upsert(rows, { onConflict: 'chave' })
        .select()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      globalCache.clear()
      clearPerfilAcessoCache()
      invalidateAdConfigCache()
      return NextResponse.json({ ok: true, count: data?.length || rows.length, data })
    }

    const { chave, valor } = body
    if (!chave) return NextResponse.json({ error: 'chave required' }, { status: 400 })

    const finalValor = chave === 'cfgCaixas' && Array.isArray(valor)
      ? filterOutSimulatedCaixas(valor).cleaned
      : valor

    const { data, error } = await supabase
      .from('configuracoes')
      .upsert({ chave, valor: finalValor, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    
    // Invalida o cache em memória do servidor ao atualizar qualquer chave
    globalCache.clear();
    invalidateAdConfigCache();
    if (chave === 'config_perfis_acesso') {
      clearPerfilAcessoCache()
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
