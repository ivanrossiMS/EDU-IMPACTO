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
import { cookies } from 'next/headers'

function cleanEnvKey(key?: string): string {
  if (!key) return ''
  return key.trim().replace(/^['"]|['"]$/g, '')
}

const defaultUrl = 'https://lrpwerkkqrjkcauofhph.supabase.co'
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDAzMjYsImV4cCI6MjA5MDk3NjMyNn0.1-_0vMiLn0Y9piS90150Ur7qx8ic1Kz64RuhiaVGLhg'

/** Client autenticado — respeita Row Level Security. Use na maioria das API routes. */
export async function createProtectedClient() {
  const cookieStore = await cookies()
  const url = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_URL) || defaultUrl
  const anonKey = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || defaultAnonKey

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const sessionOptions = { ...options };
              
              // Unconditionally keep the user connected for 1 year
              const expires = new Date();
              expires.setFullYear(expires.getFullYear() + 1);
              sessionOptions.maxAge = 315360000;
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
  const url = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_URL) || defaultUrl
  const serviceRole = cleanEnvKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const anonKey = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const key = serviceRole || anonKey || defaultAnonKey

  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  )
}

/**
 * Helper: extrai o usuário autenticado do cookie e retorna null se não autenticado.
 * Use para proteger rotas sensíveis programaticamente.
 */
export async function getAuthenticatedUser() {
  const client = await createProtectedClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  return user
}
