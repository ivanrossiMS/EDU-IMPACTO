'use client'

import { supabase } from '@/lib/supabase'
import {
  refreshSessionCentralized,
  isSessionExpiredOrExpiringSoon,
  getSessionFromStorageTiers,
  isValidSessionObject,
  isNetworkOrTransientError,
  isPermanentTokenRevocation,
  clearSessionSecurely,
  isUserLoggedOut
} from '@/lib/auth/secureSession'

export interface ApiFetchOptions extends RequestInit {
  /** Se true, não anexa o cabeçalho Authorization: Bearer */
  skipAuth?: boolean
  /** Se true, não tenta auto-retry em caso de resposta 401 ou falha de rede */
  skipRetry?: boolean
}

let isRedirectingZombieSession = false

function handleConfirmedZombieSession() {
  if (typeof window === 'undefined' || isRedirectingZombieSession) return
  if (window.location.pathname.startsWith('/login') || isUserLoggedOut()) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  isRedirectingZombieSession = true
  console.warn('[apiFetch] Sessão zumbi detectada (revogada no servidor e sem refresh válido). Redirecionando para /login...')
  try {
    window.dispatchEvent(new CustomEvent('edu:logout-start'))
  } catch {}
  clearSessionSecurely().finally(() => {
    setTimeout(() => {
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?expired=1')
      }
      isRedirectingZombieSession = false
    }, 150)
  })
}

/**
 * Valida se a URL de destino pertence à aplicação atual (origem confiável).
 * NUNCA anexa o Bearer token para URLs externas (ex: Asaas, S3, APIs de terceiros).
 */
function isTrustedAppOrigin(input: string | URL | Request): boolean {
  if (typeof window === 'undefined') return true

  let targetUrl = ''
  if (typeof input === 'string') {
    targetUrl = input
  } else if (input instanceof URL) {
    targetUrl = input.href
  } else if (input && typeof input === 'object' && 'url' in input) {
    targetUrl = (input as Request).url
  }

  // URLs relativas são sempre da própria aplicação
  if (targetUrl.startsWith('/') || targetUrl.startsWith('./') || targetUrl.startsWith('../')) {
    return true
  }

  try {
    const parsed = new URL(targetUrl, window.location.origin)
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

async function fetchWithNetworkRetry(
  input: string | URL | Request,
  init: RequestInit,
  canRetryNetwork: boolean
): Promise<Response> {
  const maxAttempts = canRetryNetwork ? 3 : 1
  const delays = [600, 1500]

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init)
      // Se for erro transitório de gateway/timeout (502, 503, 504) em leitura idempotente, tenta novamente
      if (canRetryNetwork && attempt < maxAttempts && [502, 503, 504].includes(res.status)) {
        console.warn(`[apiFetch] Status transitório ${res.status} (tentativa ${attempt}/${maxAttempts}). Retentando...`)
        await new Promise(r => setTimeout(r, delays[attempt - 1] || 1000))
        continue
      }
      return res
    } catch (err: any) {
      // Se foi cancelado intencionalmente por AbortController externo, não repete
      if (err?.name === 'AbortError' || init.signal?.aborted) {
        throw err
      }
      if (canRetryNetwork && attempt < maxAttempts && isNetworkOrTransientError(err)) {
        console.warn(`[apiFetch] Oscilação de rede detectada (${err?.message || 'network drop'}) — reconectando tentativa ${attempt + 1}/${maxAttempts}...`)
        await new Promise(r => setTimeout(r, delays[attempt - 1] || 1000))
        continue
      }
      throw err
    }
  }

  return fetch(input, init)
}

/**
 * apiFetch: Fetcher centralizado e resiliente para aplicações Web e Mobile.
 *
 * Características essenciais:
 * 1. Proativo: Antes de disparar, verifica se o access_token está vencido ou próximo de vencer (<60s).
 *    Se estiver, renova com o mutex centralizado para evitar requisições com token expirado.
 * 2. Injeção de Bearer: Anexa Authorization: Bearer <token> apenas para origens confiáveis da aplicação.
 * 3. Preservação de Cookies: Mantém credentials: 'include' para compatibilidade total com SSR/Web.
 * 4. Auto-retry de Rede: Em leituras (GET/HEAD/OPTIONS), recupera automaticamente de micro-quedas 4G
 *    (ERR_CONNECTION_CLOSED / Failed to fetch) e erros transitórios 502/503/504.
 * 5. Auto-recuperação 401 (Forçada): Em requisições de leitura seguras, se receber 401,
 *    força a renovação real do token no servidor (force=true) via mutex e repete a consulta.
 * 6. Eliminação de Sessão Zumbi: Se o servidor confirmar revogação permanente (session_not_found / invalid_grant),
 *    limpa o estado zumbi e redireciona de forma limpa para /login.
 */
export async function apiFetch(
  input: string | URL | Request,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const { skipAuth = false, skipRetry = false, ...fetchOptions } = init

  const isTrusted = isTrustedAppOrigin(input)
  const headers = new Headers(fetchOptions.headers || {})
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const isIdempotentMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method)

  let accessToken: string | null = null

  if (!skipAuth && isTrusted && typeof window !== 'undefined') {
    try {
      // 1. Obter sessão atual em memória ou armazenamento persistente
      let session: any = null
      try {
        const { data } = await supabase.auth.getSession()
        session = data?.session
      } catch {}

      if (!session) {
        session = await getSessionFromStorageTiers()
      }

      if (session && isValidSessionObject(session)) {
        // 2. Proativo: se o token está expirado ou vence em menos de 60s, renova primeiro
        if (isSessionExpiredOrExpiringSoon(session, 60)) {
          console.log('[apiFetch] Token expirado ou próximo de vencer. Renovando proativamente...')
          const { session: refreshedSession } = await refreshSessionCentralized(supabase)
          if (refreshedSession && isValidSessionObject(refreshedSession)) {
            session = refreshedSession
          }
        }

        accessToken = session.access_token || null
      }
    } catch (authPrepErr) {
      console.warn('[apiFetch] Erro na verificação prévia de autenticação:', authPrepErr)
    }

    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
  }

  // Garantir credentials include para sincronização com cookies do navegador
  if (!fetchOptions.credentials) {
    fetchOptions.credentials = 'include'
  }

  fetchOptions.headers = headers

  // Dispara a requisição com proteção contra micro-quedas de rede em métodos de leitura
  let response = await fetchWithNetworkRetry(input, fetchOptions, isIdempotentMethod && !skipRetry)

  // 3. Se receber 401 Unauthorized e for elegível para retry
  if (response.status === 401 && !skipRetry && isTrusted && typeof window !== 'undefined') {
    if (isIdempotentMethod) {
      console.warn('[apiFetch] Recebido 401 em consulta de leitura. Forçando renovação de sessão no servidor (force=true) e retry...')
      try {
        const { session: newSession, error: refreshErr, isOffline } = await refreshSessionCentralized(supabase, true)
        if (!refreshErr && newSession?.access_token) {
          const retryHeaders = new Headers(fetchOptions.headers)
          retryHeaders.set('Authorization', `Bearer ${newSession.access_token}`)

          response = await fetchWithNetworkRetry(
            input,
            {
              ...fetchOptions,
              headers: retryHeaders,
            },
            true
          )
          console.log('[apiFetch] Retry após refresh forçado concluído com status:', response.status)
          if (response.ok) {
            try {
              window.dispatchEvent(new CustomEvent('edu:auth-recovered'))
            } catch {}
          }
        } else if (!isOffline && (isPermanentTokenRevocation(refreshErr) || (!newSession && refreshErr?.message?.includes('No valid session stored')))) {
          // Sessão zumbi confirmada: o usuário parecia logado localmente (localStorage), mas a sessão não existe mais no servidor
          const hasLocalUser = Boolean(window.localStorage.getItem('edu-current-user'))
          if (hasLocalUser) {
            handleConfirmedZombieSession()
          }
        }
      } catch (retryErr) {
        console.error('[apiFetch] Falha no retry após 401:', retryErr)
      }
    } else {
      console.warn(`[apiFetch] Recebido 401 em operação de escrita (${method}). Não repetindo automaticamente para evitar duplicação.`)
    }
  }

  return response
}

