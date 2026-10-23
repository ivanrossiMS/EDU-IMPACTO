/**
 * supabaseServerFactory.ts
 * 
 * Factory para clientes Supabase no lado servidor (API Routes).
 * 
 * REGRA:
 *  - createProtectedClient()  → usa anon key + cookies do usuário → RESPEITA RLS
 *  - createAdminClient()      → usa service role key → BYPASSA RLS (usar somente em 
 *                               operações sistêmicas sem usuário, ex: backfill, webhooks)
 */

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { getAdminClient, serverSupabaseFetch } from './supabaseAdminSingleton'

/**
 * Extrai o timestamp de expiração (em ms) do payload de um JWT sem precisar de chamada de rede.
 */
export function getJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
    if (typeof payload?.exp === 'number') {
      return payload.exp * 1000
    }
  } catch {}
  return null
}

/**
 * Verifica localmente se o JWT já expirou (evita chamadas GET /auth/v1/user que geram 403 bad_jwt nos logs).
 */
export function isJwtTokenExpired(token: string, clockSkewSeconds = 0): boolean {
  const expMs = getJwtExpMs(token)
  if (expMs === null) return false
  return expMs <= Date.now() + clockSkewSeconds * 1000
}

/**
 * Extrai o access_token diretamente dos cookies de sessão do Supabase (@supabase/ssr),
 * suportando formato base64url ('base64-...'), JSON direto e cookies fragmentados (.0, .1, ...).
 * Isso evita que múltiplas rotas de API paralelas acionem refresh_token simultaneamente no servidor.
 */
export function extractAccessTokenFromCookieList(
  allCookies: Array<{ name: string; value: string }>
): string | null {
  try {
    if (!allCookies || allCookies.length === 0) return null
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = url.replace('https://', '').split('.')[0]
    const baseName = projectRef ? `sb-${projectRef}-auth-token` : ''

    let rawValue = ''
    if (baseName) {
      const exact = allCookies.find(c => c.name === baseName && c.value)
      if (exact) {
        rawValue = exact.value
      } else {
        const chunks = allCookies
          .filter(c => c.name.startsWith(`${baseName}.`) && /^\d+$/.test(c.name.slice(baseName.length + 1)))
          .sort((a, b) => {
            const idxA = parseInt(a.name.slice(baseName.length + 1), 10)
            const idxB = parseInt(b.name.slice(baseName.length + 1), 10)
            return idxA - idxB
          })
        if (chunks.length > 0) {
          rawValue = chunks.map(c => c.value).join('')
        }
      }
    }

    if (!rawValue) {
      const fallback = allCookies.find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value)
      if (fallback) rawValue = fallback.value
    }

    if (!rawValue) return null

    let jsonStr = rawValue
    if (jsonStr.startsWith('base64-')) {
      const b64 = jsonStr.slice(7).replace(/-/g, '+').replace(/_/g, '/')
      jsonStr = Buffer.from(b64, 'base64').toString('utf-8')
    } else if (jsonStr.startsWith('%7B') || jsonStr.startsWith('%5B')) {
      jsonStr = decodeURIComponent(jsonStr)
    }

    const parsed = JSON.parse(jsonStr)
    const token = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : null)
    if (typeof token === 'string' && token.split('.').length === 3) {
      return token
    }
  } catch {
    // Fallback silencioso para createServerClient padrão
  }
  return null
}

/** Client autenticado — respeita Row Level Security. Suporta Bearer Token (mobile/web) ou cookies (web). */
export async function createProtectedClient(bearerToken?: string) {
  let effectiveBearer = bearerToken
  if (!effectiveBearer) {
    try {
      const headerStore = await headers()
      const authHeader = headerStore.get('authorization')
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        effectiveBearer = authHeader.substring(7).trim()
      }
    } catch {
      // Ignorado fora de contexto de Request Next.js
    }
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null
  if (!effectiveBearer) {
    try {
      cookieStore = await cookies()
      effectiveBearer = extractAccessTokenFromCookieList(cookieStore.getAll()) || undefined
    } catch {
      // Ignorado fora de contexto de Request Next.js
    }
  }

  if (effectiveBearer) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${effectiveBearer}`
          },
          fetch: serverSupabaseFetch
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    )
    const origGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = (async (jwt?: string) => {
      const targetJwt = jwt || effectiveBearer
      if (targetJwt && isJwtTokenExpired(targetJwt, 0)) {
        return {
          data: { user: null },
          error: { name: 'AuthApiError', message: 'token is expired', status: 401 } as any
        }
      }
      return origGetUser(targetJwt)
    }) as typeof client.auth.getUser
    return client
  }

  if (!cookieStore) {
    cookieStore = await cookies()
  }
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore!.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options?.maxAge === 0 || value === '') {
                cookieStore!.set(name, '', { ...options, maxAge: 0, path: '/' })
                return
              }
              const sessionOptions = { ...options };
              
              // 1 ano (365 dias) — seguro contra overflow de 32 bits (RFC 6265bis)
              const SAFE_SESSION_SECONDS = 31536000;
              const expires = new Date(Date.now() + SAFE_SESSION_SECONDS * 1000);
              sessionOptions.maxAge = SAFE_SESSION_SECONDS;
              sessionOptions.expires = expires;
              
              cookieStore!.set(name, value, sessionOptions)
            })
          } catch {
            // Ignorado intencionalmente: ocorre em Server Components sem contexto de mutação
          }
        },
      },
      auth: {
        autoRefreshToken: false,
      },
      global: {
        fetch: serverSupabaseFetch
      }
    }
  )
}

/**
 * Client admin — usa SERVICE_ROLE_KEY, bypassa RLS.
 * ⚠️  USAR SOMENTE em: backfills, migrations, webhooks sistêmicos.
 * NUNCA use em rotas onde o payload vem do usuário final.
 */
export function createAdminClient() {
  return getAdminClient()
}

/**
 * Helper: extrai o usuário autenticado do cookie e retorna null se não autenticado.
 * Use para proteger rotas sensíveis programaticamente.
 */
export async function getAuthenticatedUser() {
  try {
    const client = await createProtectedClient()
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}
