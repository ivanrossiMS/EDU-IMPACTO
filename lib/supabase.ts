import { createClient, processLock } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { createChunks, combineChunks, stringToBase64URL, stringFromBase64URL, isChunkLike } from '@supabase/ssr'
import { saveSessionSecurely, clearSessionSecurely } from '@/lib/auth/secureSession'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lrpwerkkqrjkcauofhph.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDAzMjYsImV4cCI6MjA5MDk3NjMyNn0.1-_0vMiLn0Y9piS90150Ur7qx8ic1Kz64RuhiaVGLhg'

const BASE64_PREFIX = 'base64-'
const INFINITE_SESSION_SECONDS = 3153600000 // 100 anos (rolagem contínua no browser)

/**
 * Decodifica o valor caso esteja no formato base64url do @supabase/ssr
 * e garante que é uma string JSON válida representando um objeto.
 * Se for inválido ou corrompido, retorna null para evitar que GoTrueClient
 * receba strings primitivas (o que causava TypeError: Attempted to assign to readonly property).
 */
function decodeAndValidate(raw: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  let val = raw.trim()
  if (val.startsWith(BASE64_PREFIX)) {
    try {
      val = stringFromBase64URL(val.substring(BASE64_PREFIX.length))
    } catch {
      return null
    }
  }
  try {
    const parsed = JSON.parse(val)
    if (typeof parsed === 'object' && parsed !== null) {
      return val
    }
    return null
  } catch {
    return null
  }
}

function syncDocumentCookie(key: string, value: string) {
  if (typeof document === 'undefined') return
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const securePart = isHttps ? '; Secure' : ''
  try {
    const encoded = `${BASE64_PREFIX}${stringToBase64URL(value)}`
    const chunks = createChunks(key, encoded)

    // Remove chunks antigos/órfãos que não estão mais nesta lista
    const currentCookies = document.cookie.split('; ').map(c => c.split('=')[0])
    const newNames = new Set(chunks.map(ch => ch.name))
    currentCookies.filter(name => isChunkLike(name, key) && !newNames.has(name)).forEach(name => {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${securePart}`
    })

    // Grava chunks com codificação segura base64url
    chunks.forEach(chunk => {
      document.cookie = `${chunk.name}=${chunk.value}; path=/; max-age=${INFINITE_SESSION_SECONDS}; SameSite=Lax${securePart}`
    })
  } catch (e) {
    try {
      document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax${securePart}`
    } catch {}
  }
}

function removeDocumentCookie(key: string) {
  if (typeof document === 'undefined') return
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const securePart = isHttps ? '; Secure' : ''
  try {
    const currentCookies = document.cookie.split('; ').map(c => c.split('=')[0])
    currentCookies.filter(name => isChunkLike(name, key)).forEach(name => {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${securePart}`
    })
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax${securePart}`
  } catch {}
}

// Custom async storage adapter that evaluates native platform at runtime
// and maintains document.cookie in sync so SSR/middleware can always see the session
const customStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') return null

    // 1. Native platform preferences
    if (Capacitor.isNativePlatform()) {
      try {
        const { value } = await Preferences.get({ key })
        const valid = decodeAndValidate(value)
        if (valid) return valid
      } catch (e) {}
    }

    // 2. localStorage
    try {
      const localVal = window.localStorage.getItem(key)
      const valid = decodeAndValidate(localVal)
      if (valid) return valid
    } catch (e) {}

    // 3. Fallback to document.cookie chunks
    if (typeof document !== 'undefined') {
      try {
        const parsedCookies = document.cookie.split('; ').reduce((acc, c) => {
          const idx = c.indexOf('=')
          if (idx !== -1) {
            acc[c.substring(0, idx)] = c.substring(idx + 1)
          }
          return acc
        }, {} as Record<string, string>)

        const combined = await combineChunks(key, async (chunkName) => {
          return parsedCookies[chunkName] || null
        })
        const valid = decodeAndValidate(combined)
        if (valid) return valid
      } catch (e) {}
    }

    return null
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') return

    // Persiste no localStorage
    try {
      window.localStorage.setItem(key, value)
    } catch (e) {}

    // Persiste no Capacitor Preferences
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.set({ key, value })
      } catch (e) {}
    }

    // Sincroniza com os cookies do navegador para que o Next.js Middleware/SSR reconheça
    syncDocumentCookie(key, value)
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch (e) {}

    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.remove({ key })
      } catch (e) {}
    }

    removeDocumentCookie(key)
  },
}

const isBrowser = typeof window !== 'undefined'

// Singleton instance to prevent Next.js Fast Refresh or multiple imports
// from creating multiple instances and fighting for the auth lock.
let client: ReturnType<typeof createClient>

if (isBrowser) {
  if (!(window as any)._supabaseClient) {
    const newClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        lock: processLock,
      }
    })

    // Listener automático para salvar sessão na Keychain/Keystore e atualizar cookies
    newClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          saveSessionSecurely(session).catch(() => {})
        }
      } else if (event === 'SIGNED_OUT') {
        clearSessionSecurely().catch(() => {})
      }
    })

    ;(window as any)._supabaseClient = newClient
  }
  client = (window as any)._supabaseClient
} else {
  // During SSR, we don't have localStorage and we don't want to persist/refresh the session
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: undefined,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  })
}

export const supabase = client

