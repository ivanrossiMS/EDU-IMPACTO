import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cria um client do Supabase que lê os cookies do Next.js
 * ISSO É OBRIGATÓRIO para que o banco (PostgreSQL) utilize o RLS (Row Level Security)
 * identificando o usuário logado e rejeitando acessos indevidos.
 */
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado intencionalmente: Ocorre quando lido por Client/Server components sem contexto de Mutação
          }
        },
      },
    }
  )
}
