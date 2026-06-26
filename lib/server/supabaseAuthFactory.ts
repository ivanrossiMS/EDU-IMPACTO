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
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // Rely on the resolved userAgent from outside, or the cookie
            const keepConnected = cookieStore.get('edu_keep_connected')?.value === '1';
            
            cookiesToSet.forEach(({ name, value, options }) => {
              const sessionOptions = { ...options };
              if (!keepConnected) {
                delete sessionOptions.maxAge;
                delete sessionOptions.expires;
              } else {
                const expires = new Date();
                expires.setFullYear(expires.getFullYear() + 1);
                sessionOptions.maxAge = 315360000;
                sessionOptions.expires = expires;
              }
              cookieStore.set(name, value, sessionOptions)
            })
          } catch {
            // Ignorado intencionalmente: Ocorre quando lido por Client/Server components sem contexto de Mutação
          }
        },
      },
    }
  )
}
