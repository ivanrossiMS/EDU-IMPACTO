/**
 * lib/isaacCache.ts
 *
 * Camada de Cache em Memória de Alta Performance para a API do Isaac Escola.
 *
 * Arquitetura e Estratégia de Desempenho:
 * 1. Singleflight (Request Coalescing): se 2+ requisições simultâneas solicitarem o mesmo ano,
 *    apenas 1 busca externa é executada no Isaac. Ambas aguardam a mesma Promise.
 * 2. In-Memory Indexing: após a busca, 9.143 faturas são indexadas em Map por student.external_id,
 *    guardian.external_id e guardian.tax_id. Filtros por responsável/aluno passam a levar < 1ms.
 * 3. Stale-While-Revalidate (SWR): respostas em cache fresco (< 15 min) retornam em ~1ms.
 *    Se o cache tiver entre 15 min e 24h, os dados são entregues imediatamente e uma revalidação
 *    em segundo plano é iniciada de forma assíncrona, sem prender o usuário.
 * 4. Invalidação Reativa via Webhook: ao receber webhook de pagamento ou alteração,
 *    o cache é atualizado em tempo real.
 */

import { isaacRequest, type IsaacInstallment } from './isaac'

const PER_PAGE = 200
const FETCH_CONCURRENCY = 12
const FRESH_TTL_MS = 15 * 60 * 1000      // 15 minutos (dados frescos)
const MAX_STALE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas (dados aproveitáveis em SWR)

export interface YearCacheEntry {
  ano: string
  items: IsaacInstallment[]
  byGuardianId: Map<string, IsaacInstallment[]>
  byStudentId: Map<string, IsaacInstallment[]>
  byGuardianTaxId: Map<string, IsaacInstallment[]>
  fetchedAt: number
}

// Persistência em hot reload do Next.js via globalThis
interface IsaacCacheGlobal {
  yearCacheMap?: Map<string, YearCacheEntry>
  inFlightFetches?: Map<string, Promise<IsaacInstallment[]>>
}

const g = globalThis as unknown as IsaacCacheGlobal
if (!g.yearCacheMap) g.yearCacheMap = new Map()
if (!g.inFlightFetches) g.inFlightFetches = new Map()

const yearCacheMap = g.yearCacheMap!
const inFlightFetches = g.inFlightFetches!

function cleanDigits(val?: string | null): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '')
}

/**
 * Constrói índices em memória sobre a lista bruta de parcelas
 */
export function buildYearCacheEntry(ano: string, items: IsaacInstallment[]): YearCacheEntry {
  const byGuardianId = new Map<string, IsaacInstallment[]>()
  const byStudentId = new Map<string, IsaacInstallment[]>()
  const byGuardianTaxId = new Map<string, IsaacInstallment[]>()

  // Deduplicação estrita por item.id
  const uniqueMap = new Map<string, IsaacInstallment>()
  for (const item of items) {
    if (item.id && !uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item)
    }
  }
  const deduplicated = Array.from(uniqueMap.values())

  for (const item of deduplicated) {
    // 1. Índice por Guardian External ID
    const guardianExtId = String(item.guardian?.external_id || '').trim()
    if (guardianExtId) {
      const list = byGuardianId.get(guardianExtId) || []
      list.push(item)
      byGuardianId.set(guardianExtId, list)
    }

    // 2. Índice por Student External ID
    const studentExtId = String(item.student?.external_id || '').trim()
    if (studentExtId) {
      const list = byStudentId.get(studentExtId) || []
      list.push(item)
      byStudentId.set(studentExtId, list)
    }

    // 3. Índice por Guardian Tax ID (CPF)
    const guardianTax = cleanDigits(item.guardian?.tax_id)
    if (guardianTax) {
      const list = byGuardianTaxId.get(guardianTax) || []
      list.push(item)
      byGuardianTaxId.set(guardianTax, list)
    }
  }

  return {
    ano,
    items: deduplicated,
    byGuardianId,
    byStudentId,
    byGuardianTaxId,
    fetchedAt: Date.now(),
  }
}

/**
 * Realiza a varredura das páginas da API do Isaac para um ano específico com controle de concorrência.
 */
async function fetchAllPagesFromIsaac(ano: string): Promise<IsaacInstallment[]> {
  console.log(`[IsaacCache] Iniciando busca completa no Isaac para o ano ${ano}...`)
  const startTime = Date.now()

  // Página 1 para descobrir paginação
  const firstPage = await isaacRequest<any>(
    `/consolidated-installments?page=1&per_page=${PER_PAGE}&reference_year=${ano}&include_active_receivables=true`
  )

  const totalItems: number = firstPage?.pagination?.total ?? 0
  const firstItems: IsaacInstallment[] = firstPage?.data?.items ?? []
  const totalPages = Math.ceil(totalItems / PER_PAGE)

  console.log(`[IsaacCache] Ano ${ano}: ${totalItems} faturas totais em ${totalPages} páginas`)

  const allItems: IsaacInstallment[] = [...firstItems]

  if (totalPages > 1) {
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)

    // Concorrência controlada
    for (let i = 0; i < remainingPages.length; i += FETCH_CONCURRENCY) {
      const batch = remainingPages.slice(i, i + FETCH_CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map((page) =>
          isaacRequest<any>(
            `/consolidated-installments?page=${page}&per_page=${PER_PAGE}&reference_year=${ano}&include_active_receivables=true`
          )
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const items: IsaacInstallment[] = result.value?.data?.items ?? []
          allItems.push(...items)
        } else {
          console.warn(`[IsaacCache] Falha ao carregar uma das páginas de ${ano}:`, (result as PromiseRejectedResult).reason?.message)
        }
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[IsaacCache] Download concluído para ${ano}: ${allItems.length} itens em ${duration}s`)
  return allItems
}

/**
 * Obtém ou atualiza o cache do ano com suporte a Singleflight e SWR.
 */
export async function getOrFetchYearCache(
  ano: string,
  options?: { forceRefresh?: boolean }
): Promise<YearCacheEntry> {
  const existing = yearCacheMap.get(ano)
  const now = Date.now()

  // Se o cache é fresco e não pediu forceRefresh, entrega imediatamente
  if (existing && !options?.forceRefresh && now - existing.fetchedAt < FRESH_TTL_MS) {
    return existing
  }

  // Se já existe um fetch em andamento (Singleflight), aguarda o mesmo
  const pending = inFlightFetches.get(ano)
  if (pending) {
    // Se temos dados stale e não forçamos atualização, entrega stale enquanto revalida
    if (existing && !options?.forceRefresh && now - existing.fetchedAt < MAX_STALE_TTL_MS) {
      return existing
    }
    const items = await pending
    return yearCacheMap.get(ano) || buildYearCacheEntry(ano, items)
  }

  // Se os dados existem mas estão stale (< 24h), entrega imediatamente e revalida em background (SWR)
  if (existing && !options?.forceRefresh && now - existing.fetchedAt < MAX_STALE_TTL_MS) {
    // Dispara revalidação em background de forma assíncrona
    const refreshPromise = (async () => {
      try {
        const freshItems = await fetchAllPagesFromIsaac(ano)
        const newEntry = buildYearCacheEntry(ano, freshItems)
        yearCacheMap.set(ano, newEntry)
        console.log(`[IsaacCache] Cache SWR de ${ano} atualizado em background.`)
        return freshItems
      } catch (err: any) {
        console.error(`[IsaacCache] Falha na revalidação SWR de ${ano}:`, err.message)
        return existing.items
      } finally {
        inFlightFetches.delete(ano)
      }
    })()

    inFlightFetches.set(ano, refreshPromise)
    return existing
  }

  // Se não temos cache ou forçamos refresh: executa busca síncrona com singleflight
  const fetchPromise = (async () => {
    try {
      const items = await fetchAllPagesFromIsaac(ano)
      const newEntry = buildYearCacheEntry(ano, items)
      yearCacheMap.set(ano, newEntry)
      return items
    } finally {
      inFlightFetches.delete(ano)
    }
  })()

  inFlightFetches.set(ano, fetchPromise)
  await fetchPromise

  return yearCacheMap.get(ano)!
}

/**
 * Busca faturas filtrando por lista de alunos e/ou responsáveis usando os índices do cache.
 */
export async function getFilteredInstallments(params: {
  ano: string
  guardianIds?: (string | null | undefined)[]
  studentIds?: (string | null | undefined)[]
  guardianTaxIds?: (string | null | undefined)[]
  forceRefresh?: boolean
}): Promise<{
  items: IsaacInstallment[]
  fromCache: boolean
  cacheAgeMs: number
  totalInYear: number
}> {
  const { ano, guardianIds = [], studentIds = [], guardianTaxIds = [], forceRefresh } = params
  const before = Date.now()

  const entry = await getOrFetchYearCache(ano, { forceRefresh })
  const cacheAgeMs = Date.now() - entry.fetchedAt
  const fromCache = cacheAgeMs > 100

  const validGuardianIds = new Set(guardianIds.filter(Boolean).map((id) => String(id).trim()))
  const validStudentIds = new Set(studentIds.filter(Boolean).map((id) => String(id).trim()))
  const validTaxIds = new Set(
    guardianTaxIds
      .filter(Boolean)
      .map((t) => cleanDigits(t))
      .filter(Boolean)
  )

  const matchedItemsMap = new Map<string, IsaacInstallment>()

  // 1. Match rápido por Student External ID
  for (const sId of validStudentIds) {
    const list = entry.byStudentId.get(sId)
    if (list) {
      for (const item of list) matchedItemsMap.set(item.id, item)
    }
  }

  // 2. Match rápido por Guardian External ID
  for (const gId of validGuardianIds) {
    const list = entry.byGuardianId.get(gId)
    if (list) {
      for (const item of list) matchedItemsMap.set(item.id, item)
    }
  }

  // 3. Match rápido por Guardian Tax ID (CPF)
  for (const tax of validTaxIds) {
    const list = entry.byGuardianTaxId.get(tax)
    if (list) {
      for (const item of list) matchedItemsMap.set(item.id, item)
    }
  }

  const items = Array.from(matchedItemsMap.values())
  const duration = Date.now() - before

  console.log(
    `[IsaacCache] Query ${ano} finalizada em ${duration}ms: ${items.length} parcelas encontradas ` +
    `(GuardianIDs: [${Array.from(validGuardianIds).join(', ')}], StudentIDs: [${Array.from(validStudentIds).join(', ')}]) ` +
    `| CacheAge: ${Math.round(cacheAgeMs / 1000)}s`
  )

  return {
    items,
    fromCache,
    cacheAgeMs,
    totalInYear: entry.items.length,
  }
}

/**
 * Atualiza ou insere uma parcela diretamente no cache em tempo real (ex: vinda de webhook)
 */
export function updateInstallmentInCache(item: IsaacInstallment) {
  if (!item?.id) return
  const ano = item.reference_year || new Date(item.due_date).getFullYear().toString()
  const entry = yearCacheMap.get(ano)

  if (!entry) return

  // Atualiza ou insere na lista principal
  const index = entry.items.findIndex((i) => i.id === item.id)
  if (index >= 0) {
    entry.items[index] = item
  } else {
    entry.items.push(item)
  }

  // Reindexa
  const updated = buildYearCacheEntry(ano, entry.items)
  yearCacheMap.set(ano, updated)
  console.log(`[IsaacCache] Parcela ${item.id} atualizada no cache em tempo real (Ano ${ano})`)
}

/**
 * Invalida o cache para um ano específico ou todos os anos
 */
export function invalidateIsaacYearCache(ano?: string) {
  if (ano) {
    yearCacheMap.delete(ano)
    inFlightFetches.delete(ano)
    console.log(`[IsaacCache] Cache do ano ${ano} invalidado.`)
  } else {
    yearCacheMap.clear()
    inFlightFetches.clear()
    console.log(`[IsaacCache] Todo o cache do Isaac foi limpo.`)
  }
}
