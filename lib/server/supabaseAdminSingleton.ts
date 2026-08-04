/**
 * supabaseAdminSingleton.ts
 *
 * Singleton lazy-init do cliente Supabase Admin (service role).
 * Reutilizado entre hot paths no mesmo processo Node.js, evitando
 * re-criação desnecessária do cliente a cada request.
 *
 * ⚠️  APENAS para operações sistêmicas (delete cascade, auth admin, backfill).
 * NUNCA use para escrever dados vindos do usuário final (bypassa RLS).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.warn('[SUPABASE ADMIN WARNING] Missing SUPABASE_SERVICE_ROLE_KEY in environment variables!')
    }
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }
  return _adminClient
}

/**
 * Helper: busca um usuário do Auth diretamente por email.
 * Substitui o padrão listUsers({ perPage: 1000 }).find() que trafega
 * até 1.000 registros para encontrar 1 usuário.
 */
export async function getAuthUserByEmail(email: string) {
  const admin = getAdminClient()
  const { data: systemUser } = await admin
    .from('system_users')
    .select('id, auth_id, email, nome, cargo, perfil, status')
    .ilike('email', email.toLowerCase().trim())
    .maybeSingle()

  return systemUser
}

/**
 * Helper: busca um usuário do Supabase Auth por email usando filter.
 * Usa a tabela system_users como fonte primária (O(1) com índice)
 * em vez de carregar todos os usuários do Auth (O(n)).
 */
export async function lookupAuthUserByEmail(email: string) {
  const admin = getAdminClient()
  const { data: found } = await admin
    .from('system_users')
    .select('id, auth_id, email, nome, cargo, perfil, status')
    .ilike('email', email.toLowerCase().trim())
    .maybeSingle()
  
  if (!found) return null
  
  try {
    const authId = found.auth_id || found.id
    const { data: authUser } = await admin.auth.admin.getUserById(authId)
    return authUser?.user || null
  } catch {
    return null
  }
}
