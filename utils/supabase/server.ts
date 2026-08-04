import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getValidSupabaseKey } from '@/lib/server/supabaseAdminSingleton'

const defaultUrl = 'https://lrpwerkkqrjkcauofhph.supabase.co'

export async function createClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^['"]|['"]$/g, '') || defaultUrl
  const anonKey = getValidSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado em execução Server Component.
          }
        },
      },
    }
  )
}
