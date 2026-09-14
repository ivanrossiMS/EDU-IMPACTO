'use client'

import { supabase } from '@/lib/supabase'
import {
  refreshSessionCentralized,
  isSessionExpiredOrExpiringSoon,
  getSessionFromStorageTiers,
  isValidSessionObject
} from '@/lib/auth/secureSession'

export interface ApiFetchOptions extends RequestInit {
  /** Se true, não anexa o cabeçalho Authorization: Bearer */
  skipAuth?: boolean
  /** Se true, não tenta auto-retry em caso de resposta 401 */
  skipRetry?: boolean
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

/**
 * apiFetch: Fetcher centralizado e resiliente para aplicações Web e Mobile.
 *
 * Características essenciais:
 * 1. Proativo: Antes de disparar, verifica se o access_token está vencido ou próximo de vencer (<60s).
 *    Se estiver, renova com o mutex centralizado para evitar requisições com token expirado.
 * 2. Injeção de Bearer: Anexa Authorization: Bearer <token> apenas para origens confiáveis da aplicação.
 * 3. Preservação de Cookies: Mantém credentials: 'include' para compatibilidade total com SSR/Web.
 * 4. Auto-recuperação 401: Em requisições de leitura seguras (GET, HEAD, OPTIONS), se receber 401,
 *    tenta renovar o token exatamente 1 vez via mutex e repete a consulta.
 * 5. Proteção contra duplicação: Operações de escrita (POST, PUT, DELETE, PATCH) NÃO são repetidas
 *    automaticamente em caso de erro para evitar criação duplicada de registros.
 */
export async function apiFetch(
  input: string | URL | Request,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const { skipAuth = false, skipRetry = false, ...fetchOptions } = init

  const isTrusted = isTrustedAppOrigin(input)
  const headers = new Headers(fetchOptions.headers || {})

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

  // Dispara a requisição inicial
  let response = await fetch(input, fetchOptions)

  // 3. Se receber 401 Unauthorized e for elegível para retry
  if (response.status === 401 && !skipRetry && isTrusted && typeof window !== 'undefined') {
    const method = (fetchOptions.method || 'GET').toUpperCase()
    const isIdempotentMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method)

    // Permitir no máximo 1 recuperação e repetição para consultas de leitura
    if (isIdempotentMethod) {
      console.warn('[apiFetch] Recebido 401 em consulta de leitura. Tentando renovação única e retry...')
      try {
        const { session: newSession, error: refreshErr } = await refreshSessionCentralized(supabase)
        if (!refreshErr && newSession?.access_token) {
          // Clona os headers e atualiza o Bearer com o novo token
          const retryHeaders = new Headers(fetchOptions.headers)
          retryHeaders.set('Authorization', `Bearer ${newSession.access_token}`)

          response = await fetch(input, {
            ...fetchOptions,
            headers: retryHeaders,
          })
          console.log('[apiFetch] Retry concluído com status:', response.status)
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
