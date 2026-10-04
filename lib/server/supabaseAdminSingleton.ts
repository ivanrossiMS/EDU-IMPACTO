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
 * Usa a tabela system_users como fonte primária (O(1) com índice)
 * em vez de carregar todos os usuários do Auth (O(n)).
 */
export async function lookupAuthUserByEmail(email: string) {
  const admin = getAdminClient()
  // Busca na tabela interna — sempre consistente e indexada
  const { data: found } = await admin
    .from('system_users')
    .select('id, email, nome, cargo, perfil, status')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()
  
  if (!found) return null
  
  // Se precisar dos dados completos do Supabase Auth, busca só esse usuário
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(found.id)
    return authUser?.user || null
  } catch {
    return null
  }
}

/**
 * Helper: busca um usuário no Supabase Auth por email de forma completa e resiliente.
 * 1. Primeiro tenta na tabela system_users (O(1)).
 * 2. Se não encontrar, faz fallback paginado na API admin.listUsers do Supabase Auth (perPage: 1000).
 */
export async function findAuthUserByEmail(email: string) {
  if (!email) return null
  const admin = getAdminClient()
  const cleanEmail = email.toLowerCase().trim()

  // 1. Tenta lookup rápido via system_users
  const { data: su } = await admin
    .from('system_users')
    .select('id, auth_id')
    .ilike('email', cleanEmail)
    .maybeSingle()

  const candidateId = su?.auth_id || su?.id
  const isUuid = candidateId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId)
  if (isUuid) {
    try {
      const { data: { user } } = await admin.auth.admin.getUserById(candidateId)
      if (user) return user
    } catch {}
  }

  // 2. Fallback: varre auth.users usando perPage: 1000
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 }).catch(() => ({ data: null, error: true }))
    if (error || !data?.users || data.users.length === 0) break
    const match = data.users.find(u => u.email?.toLowerCase().trim() === cleanEmail)
    if (match) return match
    if (data.users.length < 1000) break
    page++
  }

  return null
}

