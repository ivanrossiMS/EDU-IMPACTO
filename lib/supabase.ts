import { createClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { createChunks, combineChunks, stringToBase64URL, stringFromBase64URL, isChunkLike } from '@supabase/ssr'
import { saveSessionSecurely, clearSessionSecurely, setSecureStorageWithRetry, getSecureStorageWithRetry } from '@/lib/auth/secureSession'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lrpwerkkqrjkcauofhph.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDAzMjYsImV4cCI6MjA5MDk3NjMyNn0.1-_0vMiLn0Y9piS90150Ur7qx8ic1Kz64RuhiaVGLhg'

const BASE64_PREFIX = 'base64-'
export const INFINITE_SESSION_SECONDS = 31536000 // 1 ano (365 dias) — seguro contra overflow de 32 bits (RFC 6265bis)

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

export function syncDocumentCookie(key: string, value: string) {
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

import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { SESSION_KEY } from '@/lib/auth/secureSession'

// Custom async storage adapter that evaluates native platform at runtime
// and maintains document.cookie in sync so SSR/middleware can always see the session
const customStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') return null

    // 1. Native Secure Storage (iOS Keychain / Android Keystore) com retry
    if (Capacitor.isNativePlatform()) {
      const secVal = await getSecureStorageWithRetry(key)
      const valid = decodeAndValidate(secVal)
      if (valid) return valid

      // Backup 1: checa chave canônica geral SESSION_KEY no Keychain
      const secBackup = await getSecureStorageWithRetry(SESSION_KEY)
      const validBackup = decodeAndValidate(secBackup)
      if (validBackup) return validBackup

      // Backup 2: se o Keychain estiver temporariamente inacessível (ex: cold boot / lock transitório),
      // verifica se há contingência em Preferences e migra de volta de forma segura
      try {
        const { value: prefKeyVal } = await Preferences.get({ key })
        const validPrefKey = decodeAndValidate(prefKeyVal)
        if (validPrefKey) return validPrefKey

        const { value: prefSessionVal } = await Preferences.get({ key: SESSION_KEY })
        const validPrefSession = decodeAndValidate(prefSessionVal)
        if (validPrefSession) return validPrefSession
      } catch (e) {}

      return null
    }

    // 2. Web Browser: document.cookie chunks têm precedência para manter sincronia com SSR
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
        if (valid) {
          try {
            window.localStorage.setItem(key, valid)
          } catch {}
          return valid
        }
      } catch (e) {}
    }

    // 3. Fallback to localStorage (Web)
    try {
      const localVal = window.localStorage.getItem(key) || window.localStorage.getItem(SESSION_KEY)
      const valid = decodeAndValidate(localVal)
      if (valid) return valid
    } catch (e) {}

    return null
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') return

    // 1. Persiste no Capacitor SecureStorage com await obrigatório
    if (Capacitor.isNativePlatform()) {
      await setSecureStorageWithRetry(key, value)
    } else {
      try {
        window.localStorage.setItem(key, value)
      } catch (e) {}
    }

    // 2. Sincroniza com os cookies do navegador para Next.js SSR / Edge Middleware
    syncDocumentCookie(key, value)

    // 3. Sincroniza atômica com a chave de sessão padrão garantindo await
    try {
      const parsed = JSON.parse(value)
      if (parsed?.access_token && parsed?.refresh_token) {
        await saveSessionSecurely(parsed)
      }
    } catch {}
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch (e) {}

    if (Capacitor.isNativePlatform()) {
      try {
        await SecureStoragePlugin.remove({ key })
      } catch (e) {}
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
      }
    })

    // Listener automático para salvar sessão no Keychain/Keystore e atualizar cookies
    newClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          await saveSessionSecurely(session).catch(() => {})
        }
      } else if (event === 'SIGNED_OUT') {
        await clearSessionSecurely().catch(() => {})
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem('edu-current-user')
            window.localStorage.removeItem('edu-current-perfil')
            const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
            removeDocumentCookie(`sb-${projectRef}-auth-token`)
          } catch {}
        }
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

