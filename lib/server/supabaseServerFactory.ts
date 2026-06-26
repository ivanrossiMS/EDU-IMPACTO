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

/** Client autenticado — respeita Row Level Security. Use na maioria das API routes. */
export async function createProtectedClient() {
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
            const newNames = cookiesToSet.map(c => c.name)
            cookieStore.getAll().forEach(c => {
               if (c.name.startsWith('sb-') && !newNames.includes(c.name)) {
                  try { cookieStore.set({ name: c.name, value: '', maxAge: 0 }) } catch(e) {}
               }
            })
            const isNative = cookieStore.get('is_native_app')?.value === '1';
            cookiesToSet.forEach(({ name, value, options }) => {
              const sessionOptions = { ...options };
              if (!isNative) {
                delete sessionOptions.maxAge;
                delete sessionOptions.expires;
              }
              cookieStore.set(name, value, sessionOptions)
            })
          } catch {
            // Ignorado intencionalmente: ocorre em Server Components sem contexto de mutação
          }
        },
      },
    }
  )
}

/**
 * Client admin — usa SERVICE_ROLE_KEY, bypassa RLS.
 * ⚠️  USAR SOMENTE em: backfills, migrations, webhooks sistêmicos.
 * NUNCA use em rotas onde o payload vem do usuário final.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
