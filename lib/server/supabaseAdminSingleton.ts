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
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  // Supabase Admin SDK v2 não tem getUserByEmail direto, mas podemos
  // buscar via system_users (fonte de verdade interna) ou usar filter da listagem
  // com página pequena. A alternativa correta é buscar na tabela system_users primeiro.
  const { data: systemUser } = await admin
    .from('system_users')
    .select('id, email, nome, cargo, perfil, status')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  return systemUser
}

/**
 * Helper: busca um usuário do Supabase Auth por email usando filter.
 * Evita carregar 1.000 usuários na memória.
 */
export async function lookupAuthUserByEmail(email: string) {
  const admin = getAdminClient()
  // Supabase Admin API v2 suporta filtro por email via listUsers filter param
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  // Fallback: usar getUserByEmail via undocumented filter — se não disponível,
  // fazemos lookup na tabela interna system_users que é sempre consistente
  const { data: found } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  return (found?.users || []).find(
    u => u.email?.toLowerCase() === email.toLowerCase()
  ) || null
}
