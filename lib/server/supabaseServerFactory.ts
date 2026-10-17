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
import { getAdminClient } from './supabaseAdminSingleton'

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

  if (effectiveBearer) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${effectiveBearer}`
          },
          fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' })
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    )
    const origGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = ((jwt?: string) => origGetUser(jwt || effectiveBearer)) as typeof client.auth.getUser
    return client
  }

  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options?.maxAge === 0 || value === '') {
                cookieStore.set(name, '', { ...options, maxAge: 0, path: '/' })
                return
              }
              const sessionOptions = { ...options };
              
              // 1 ano (365 dias) — seguro contra overflow de 32 bits (RFC 6265bis)
              const SAFE_SESSION_SECONDS = 31536000;
              const expires = new Date(Date.now() + SAFE_SESSION_SECONDS * 1000);
              sessionOptions.maxAge = SAFE_SESSION_SECONDS;
              sessionOptions.expires = expires;
              
              cookieStore.set(name, value, sessionOptions)
            })
          } catch {
            // Ignorado intencionalmente: ocorre em Server Components sem contexto de mutação
          }
        },
      },
      global: {
        fetch: (url, options) => {
          return fetch(url, { ...options, cache: 'no-store' })
        }
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
