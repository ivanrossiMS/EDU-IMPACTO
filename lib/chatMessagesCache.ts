/**
 * High-Performance Client Cache & Prefetcher for Chat Messages
 * Implements SWR (Stale-While-Revalidate), in-flight request deduplication,
 * memory caching and sessionStorage persistence for instant (0ms) conversation opening.
 */

export interface CachedConversationData {
  messages: any[]
  hasLeft?: boolean
  leftAt?: string | null
  updatedAt: number
}

// Module-level singleton memory cache (0ms O(1) synchronous lookup)
const memoryCache = new Map<string, CachedConversationData>()
const inFlightRequests = new Map<string, Promise<CachedConversationData | null>>()

const SESSION_CACHE_KEY = 'impacto_chat_msg_cache_v3'

let isHydrated = false

function hydrateFromSessionStorage() {
  if (typeof window === 'undefined' || isHydrated) return
  isHydrated = true
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        const entries = Object.entries(parsed)
        // Keep at most 20 recent conversations
        entries.slice(-20).forEach(([k, v]: [string, any]) => {
          if (v && Array.isArray(v.messages)) {
            memoryCache.set(k, v)
          }
        })
      }
    }
  } catch (_) {}
}

function persistToSessionStorage() {
  if (typeof window === 'undefined') return
  try {
    const obj: Record<string, any> = {}
    // Save the 15 most recently updated conversations
    const sorted = Array.from(memoryCache.entries())
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, 15)
    for (const [k, v] of sorted) {
      // Store at most 50 messages per conversation to preserve storage space
      obj[k] = {
        ...v,
        messages: v.messages.slice(-50)
      }
    }
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(obj))
  } catch (_) {}
}

/**
 * Returns cached messages synchronously (0ms) if available
 */
export function getCachedMessages(convId: string): CachedConversationData | null {
  if (!convId) return null
  hydrateFromSessionStorage()
  return memoryCache.get(convId) || null
}

/**
 * Updates cache for a conversation
 */
export function setCachedMessages(
  convId: string, 
  data: { messages: any[]; hasLeft?: boolean; leftAt?: string | null }
) {
  if (!convId) return
  hydrateFromSessionStorage()
  const payload: CachedConversationData = {
    messages: data.messages || [],
    hasLeft: data.hasLeft,
    leftAt: data.leftAt,
    updatedAt: Date.now()
  }
  memoryCache.set(convId, payload)
  persistToSessionStorage()
}

/**
 * Appends a new realtime message to cache
 */
export function appendCachedMessage(convId: string, msg: any) {
  if (!convId || !msg) return
  hydrateFromSessionStorage()
  const existing = memoryCache.get(convId)
  if (existing) {
    if (!existing.messages.some(m => m.id === msg.id)) {
      existing.messages = [...existing.messages, msg]
      existing.updatedAt = Date.now()
      memoryCache.set(convId, existing)
      persistToSessionStorage()
    }
  } else {
    memoryCache.set(convId, {
      messages: [msg],
      updatedAt: Date.now()
    })
    persistToSessionStorage()
  }
}

/**
 * Updates an edited message in cache
 */
export function updateCachedMessage(convId: string, updatedMsg: any) {
  if (!convId || !updatedMsg) return
  hydrateFromSessionStorage()
  const existing = memoryCache.get(convId)
  if (existing) {
    existing.messages = existing.messages.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)
    existing.updatedAt = Date.now()
    memoryCache.set(convId, existing)
    persistToSessionStorage()
  }
}

/**
 * Removes a deleted message from cache
 */
export function removeCachedMessage(convId: string, msgId: string) {
  if (!convId || !msgId) return
  hydrateFromSessionStorage()
  const existing = memoryCache.get(convId)
  if (existing) {
    existing.messages = existing.messages.filter(m => m.id !== msgId)
    existing.updatedAt = Date.now()
    memoryCache.set(convId, existing)
    persistToSessionStorage()
  }
}

/**
 * Prefetches conversation messages with promise deduplication.
 * If already fetching or fresh (< 20s), reuses result.
 */
export async function prefetchConversationMessages(
  convId: string, 
  options?: { force?: boolean }
): Promise<CachedConversationData | null> {
  if (!convId) return null
  hydrateFromSessionStorage()

  const cached = memoryCache.get(convId)
  const isFresh = cached && (Date.now() - cached.updatedAt < 20_000)

  if (isFresh && !options?.force) {
    return cached
  }

  // Deduplicate in-flight fetch
  if (inFlightRequests.has(convId)) {
    return inFlightRequests.get(convId)!
  }

  const promise = (async () => {
    try {
      const res = await fetch(`/api/chat/messages?conversation_id=${convId}&limit=100`)
      if (res.ok) {
        const data = await res.json()
        const payload: CachedConversationData = {
          messages: data.messages || [],
          hasLeft: data.hasLeft,
          leftAt: data.leftAt,
          updatedAt: Date.now()
        }
        memoryCache.set(convId, payload)
        persistToSessionStorage()
        return payload
      }
    } catch (_) {}
    return cached || null
  })().finally(() => {
    inFlightRequests.delete(convId)
  })

  inFlightRequests.set(convId, promise)
  return promise
}

/**
 * Sequentially prefetch a batch of conversations during idle time
 */
export function prefetchBatchConversations(convIds: string[]) {
  if (typeof window === 'undefined') return
  const uniqueIds = Array.from(new Set(convIds)).filter(Boolean)
  if (uniqueIds.length === 0) return

  const runPrefetch = () => {
    let index = 0
    function next() {
      if (index >= uniqueIds.length) return
      const id = uniqueIds[index++]
      prefetchConversationMessages(id).then(() => {
        setTimeout(next, 60)
      })
    }
    next()
  }

  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(runPrefetch)
  } else {
    setTimeout(runPrefetch, 250)
  }
}
