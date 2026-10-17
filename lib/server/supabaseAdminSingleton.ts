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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AUTH_USERS_CACHE_TTL_MS = 60_000

let _cachedAuthUsers: any[] | null = null
let _cachedAuthUsersByEmail = new Map<string, any>()
let _cachedAuthUsersExpiresAt = 0
let _inflightAuthUsersList: Promise<any[]> | null = null

export function invalidateAuthUsersCache() {
  _cachedAuthUsers = null
  _cachedAuthUsersByEmail.clear()
  _cachedAuthUsersExpiresAt = 0
}

/**
 * Retorna a lista de usuários do Supabase Auth com cache em memória (TTL 60s)
 * e deduplicação de chamadas concorrentes (singleflight), evitando varreduras
 * repetidas de até 5.000 registros a cada push notification, login ou relatório.
 */
export async function getAllAuthUsersCached(forceRefresh = false): Promise<any[]> {
  const now = Date.now()
  if (!forceRefresh && _cachedAuthUsers && _cachedAuthUsersExpiresAt > now) {
    return _cachedAuthUsers
  }

  if (!forceRefresh && _inflightAuthUsersList) {
    return _inflightAuthUsersList
  }

  _inflightAuthUsersList = (async () => {
    const admin = getAdminClient()
    const allUsers: any[] = []
    const byEmail = new Map<string, any>()
    let page = 1

    while (page <= 5) {
      const { data, error } = await admin.auth.admin
        .listUsers({ page, perPage: 1000 })
        .catch(() => ({ data: null, error: true }))
      if (error || !data?.users || data.users.length === 0) break
      for (const u of data.users) {
        allUsers.push(u)
        const em = u.email?.toLowerCase().trim()
        if (em) byEmail.set(em, u)
      }
      if (data.users.length < 1000) break
      page++
    }

    if (allUsers.length > 0) {
      _cachedAuthUsers = allUsers
      _cachedAuthUsersByEmail = byEmail
      _cachedAuthUsersExpiresAt = Date.now() + AUTH_USERS_CACHE_TTL_MS
    }
    return allUsers
  })().finally(() => {
    _inflightAuthUsersList = null
  })

  return _inflightAuthUsersList
}

/**
 * Helper: busca um usuário no Supabase Auth por email de forma completa e resiliente.
 * 1. Tenta na tabela system_users (O(1) indexado).
 * 2. Tenta na tabela responsaveis via auth_id / dados->>auth_id (O(1) indexado).
 * 3. Tenta na tabela alunos via dados->>auth_id (O(1) indexado).
 * 4. Se não encontrar, usa getAllAuthUsersCached (com cache em memória + backfill de auth_id).
 */
export async function findAuthUserByEmail(email: string) {
  if (!email) return null
  const admin = getAdminClient()
  const cleanEmail = email.toLowerCase().trim()

  // 0. Se o cache em memória já estiver quente, verifica nele primeiro
  if (_cachedAuthUsers && _cachedAuthUsersExpiresAt > Date.now()) {
    const cachedHit = _cachedAuthUsersByEmail.get(cleanEmail)
    if (cachedHit) return cachedHit
  }

  // 1. Tenta lookup rápido via system_users
  const { data: su } = await admin
    .from('system_users')
    .select('id, auth_id, dados')
    .ilike('email', cleanEmail)
    .limit(1)
    .maybeSingle()

  const suCandidateId = su?.auth_id || su?.dados?.auth_id || su?.id
  if (suCandidateId && UUID_REGEX.test(String(suCandidateId))) {
    try {
      const { data: { user } } = await admin.auth.admin.getUserById(String(suCandidateId))
      if (user) return user
    } catch {}
  }

  // 2. Tenta lookup rápido via responsaveis (auth_id ou dados->>auth_id)
  let respRecord: any = null
  try {
    const { data: resp } = await admin
      .from('responsaveis')
      .select('id, auth_id, dados')
      .ilike('email', cleanEmail)
      .limit(1)
      .maybeSingle()
    respRecord = resp
    const respAuthId = resp?.auth_id || resp?.dados?.auth_id || resp?.dados?.user_id
    if (respAuthId && UUID_REGEX.test(String(respAuthId))) {
      const { data: { user } } = await admin.auth.admin.getUserById(String(respAuthId))
      if (user) return user
    }
  } catch {}

  // 3. Tenta lookup rápido via alunos (dados->>auth_id)
  try {
    if (!cleanEmail.endsWith('@impactoedu.local')) {
      const { data: al } = await admin
        .from('alunos')
        .select('id, dados')
        .ilike('email', cleanEmail)
        .limit(1)
        .maybeSingle()
      const alAuthId = al?.dados?.auth_id
      if (alAuthId && UUID_REGEX.test(String(alAuthId))) {
        const { data: { user } } = await admin.auth.admin.getUserById(String(alAuthId))
        if (user) return user
      }
    }
  } catch {}

  // 4. Fallback via lista cacheada de auth.users
  await getAllAuthUsersCached()
  const match = _cachedAuthUsersByEmail.get(cleanEmail) || null

  // Backfill assíncrono de auth_id em responsaveis para acelerar próximas consultas
  if (match?.id && respRecord?.id && !respRecord.auth_id) {
    void admin
      .from('responsaveis')
      .update({ auth_id: match.id })
      .eq('id', respRecord.id)
      .then(() => {}, () => {})
  }

  return match
}


