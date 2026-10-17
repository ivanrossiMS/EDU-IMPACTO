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
      if (user && (user.email || '').toLowerCase().trim() === cleanEmail) return user
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
      if (user && (user.email || '').toLowerCase().trim() === cleanEmail) return user
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
        if (user && (user.email || '').toLowerCase().trim() === cleanEmail) return user
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

const isValidRealEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !email.endsWith('@impactoedu.local')

const isFamilyOnlySystemUserRow = (sysRow: any): boolean => {
  if (!sysRow) return true
  const rawRole = String(sysRow.perfil || sysRow.cargo || sysRow.dados?.perfil || sysRow.dados?.cargo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!rawRole) return true
  return ['responsavel', 'responsaveis', 'aluno', 'alunos', 'pai', 'mae', 'familia'].includes(rawRole)
}

async function checkEmailUsageInDb(
  email: string,
  opts?: { excludeRespId?: string; excludeAlunoId?: string }
) {
  const admin = getAdminClient()
  const clean = (email || '').trim().toLowerCase()
  if (!clean) {
    return { hasStaffUser: false, hasOtherResp: false, hasOtherAluno: false, familySysIds: [] as string[] }
  }

  const { data: sysRows } = await admin
    .from('system_users')
    .select('id, auth_id, email, perfil, cargo, dados')
    .ilike('email', clean)

  const hasStaffUser = (sysRows || []).some((r: any) => !isFamilyOnlySystemUserRow(r))
  const familySysIds = (sysRows || []).filter(isFamilyOnlySystemUserRow).map((r: any) => String(r.id))

  let rQuery = admin.from('responsaveis').select('id').ilike('email', clean)
  if (opts?.excludeRespId) {
    rQuery = rQuery.neq('id', opts.excludeRespId)
  }
  const { data: otherResps } = await rQuery.limit(1)
  const hasOtherResp = Boolean(otherResps && otherResps.length > 0)

  let aQuery = admin
    .from('alunos')
    .select('id')
    .or(`email.ilike.${clean},dados->>email.ilike.${clean}`)
  if (opts?.excludeAlunoId) {
    aQuery = aQuery.neq('id', opts.excludeAlunoId)
  }
  const { data: otherAlunos } = await aQuery.limit(1)
  const hasOtherAluno = Boolean(otherAlunos && otherAlunos.length > 0)

  return { hasStaffUser, hasOtherResp, hasOtherAluno, familySysIds }
}

/**
 * Sincroniza ou exclui a credencial antiga no Supabase Auth quando o e-mail de um Responsável
 * é alterado ou removido, garantindo que o e-mail antigo nunca continue ativo.
 */
export async function syncResponsavelAuthOnEmailChange(params: {
  responsavelId: string
  oldEmail?: string | null
  newEmail?: string | null
  nome?: string | null
  existingAuthId?: string | null
  authId?: string | null
}) {
  try {
    const admin = getAdminClient()
    const respId = String(params.responsavelId || '').trim()
    if (!respId) return

    const cleanOld = (params.oldEmail || '').trim().toLowerCase()
    const cleanNew = (params.newEmail || '').trim().toLowerCase()
    const hasValidNew = isValidRealEmail(cleanNew)
    const rawAuthId = params.existingAuthId || params.authId
    const candidateAuthId = rawAuthId ? String(rawAuthId).trim() : ''

    const allAuthUsers = await getAllAuthUsersCached(true)

    const matchedUsers = allAuthUsers.filter((u: any) => {
      const uEmail = (u.email || '').trim().toLowerCase()
      const metaRespId = String(u.user_metadata?.responsavel_id || u.app_metadata?.responsavel_id || '').trim()
      if (metaRespId === respId) return true
      if (candidateAuthId && u.id === candidateAuthId) return true
      if (cleanOld && cleanOld !== cleanNew && uEmail === cleanOld) return true
      return false
    })

    const existingNewAuthUser = hasValidNew
      ? allAuthUsers.find((u: any) => (u.email || '').trim().toLowerCase() === cleanNew) || null
      : null

    const staleUsers = matchedUsers.filter((u: any) => {
      const uEmail = (u.email || '').trim().toLowerCase()
      return !hasValidNew || uEmail !== cleanNew
    })

    if (staleUsers.length === 0 && !existingNewAuthUser) {
      return
    }

    const migratableOrDeletable: any[] = []

    for (const u of staleUsers) {
      const uEmail = (u.email || '').trim().toLowerCase()
      const usage = await checkEmailUsageInDb(uEmail, { excludeRespId: respId })

      if (usage.hasStaffUser || usage.hasOtherResp || usage.hasOtherAluno) {
        // E-mail antigo ainda pertence a um colaborador ativo ou outro cadastro: apenas desvincula este responsavel_id
        const metaRespId = String(u.user_metadata?.responsavel_id || u.app_metadata?.responsavel_id || '').trim()
        if (metaRespId === respId) {
          const nextUserMeta = { ...(u.user_metadata || {}) }
          delete nextUserMeta.responsavel_id
          if (!usage.hasOtherResp) nextUserMeta.hasDualRole = false
          const nextAppMeta = { ...(u.app_metadata || {}) }
          delete nextAppMeta.responsavel_id
          await admin.auth.admin
            .updateUserById(u.id, { user_metadata: nextUserMeta, app_metadata: nextAppMeta })
            .catch(() => {})
        }
        continue
      }

      if (usage.familySysIds.length > 0) {
        await admin.from('system_users').delete().in('id', usage.familySysIds)
      }

      migratableOrDeletable.push(u)
    }

    if (hasValidNew) {
      if (existingNewAuthUser) {
        // Já existe conta Auth no novo e-mail: exclui todas as contas antigas
        for (const oldU of migratableOrDeletable) {
          if (oldU.id !== existingNewAuthUser.id) {
            await admin.auth.admin.deleteUser(oldU.id).catch(() => {})
          }
        }
        await admin.auth.admin
          .updateUserById(existingNewAuthUser.id, {
            user_metadata: {
              ...(existingNewAuthUser.user_metadata || {}),
              ...(params.nome ? { nome: params.nome } : {}),
              responsavel_id: respId,
            },
            app_metadata: {
              ...(existingNewAuthUser.app_metadata || {}),
              responsavel_id: respId,
            },
          })
          .catch(() => {})
        await admin.from('responsaveis').update({ auth_id: existingNewAuthUser.id }).eq('id', respId)
      } else if (migratableOrDeletable.length > 0) {
        // Migra a conta Auth existente para o novo e-mail e exclui eventuais duplicatas antigas
        const primary = migratableOrDeletable[0]
        const { error: upErr } = await admin.auth.admin.updateUserById(primary.id, {
          email: cleanNew,
          email_confirm: true,
          user_metadata: {
            ...(primary.user_metadata || {}),
            ...(params.nome ? { nome: params.nome } : {}),
            responsavel_id: respId,
          },
          app_metadata: {
            ...(primary.app_metadata || {}),
            responsavel_id: respId,
          },
        })
        if (upErr) {
          // Se falhar a atualização (ex: conflito), exclui a conta antiga para nunca manter o e-mail antigo ativo
          await admin.auth.admin.deleteUser(primary.id).catch(() => {})
          await admin.from('responsaveis').update({ auth_id: null }).eq('id', respId)
        } else {
          await admin.from('responsaveis').update({ auth_id: primary.id }).eq('id', respId)
        }

        for (const extra of migratableOrDeletable.slice(1)) {
          await admin.auth.admin.deleteUser(extra.id).catch(() => {})
        }
      }
    } else {
      // Novo e-mail vazio ou inválido: exclui todas as contas Auth antigas deste responsável
      for (const oldU of migratableOrDeletable) {
        await admin.auth.admin.deleteUser(oldU.id).catch(() => {})
      }
      await admin.from('responsaveis').update({ auth_id: null }).eq('id', respId)
    }

    invalidateAuthUsersCache()
  } catch (err: any) {
    console.error('[syncResponsavelAuthOnEmailChange] Error:', err?.message || err)
  }
}

/**
 * Sincroniza ou exclui a credencial antiga no Supabase Auth quando o e-mail de um Aluno
 * é alterado ou removido, garantindo que o e-mail antigo nunca continue ativo.
 */
export async function syncAlunoAuthOnEmailChange(params: {
  alunoId: string
  matricula?: string | null
  oldEmail?: string | null
  newEmail?: string | null
  nome?: string | null
  existingAuthId?: string | null
  authId?: string | null
}) {
  try {
    const admin = getAdminClient()
    const alId = String(params.alunoId || '').trim()
    if (!alId) return

    const mat = String(params.matricula || alId).trim()
    const virtualEmail = `aluno.${mat}@impactoedu.local`.toLowerCase()
    const virtualEmailById = `aluno.${alId}@impactoedu.local`.toLowerCase()
    const cleanOld = (params.oldEmail || '').trim().toLowerCase()
    const cleanNew = (params.newEmail || '').trim().toLowerCase()
    const hasValidNew = isValidRealEmail(cleanNew)
    const rawAuthId = params.existingAuthId || params.authId
    const candidateAuthId = rawAuthId ? String(rawAuthId).trim() : ''

    const allAuthUsers = await getAllAuthUsersCached(true)

    const matchedUsers = allAuthUsers.filter((u: any) => {
      const uEmail = (u.email || '').trim().toLowerCase()
      const metaAlunoId = String(u.user_metadata?.aluno_id || u.app_metadata?.aluno_id || '').trim()
      const metaMat = String(u.user_metadata?.matricula || u.app_metadata?.matricula || '').trim()
      if (metaAlunoId === alId) return true
      if (mat && metaMat === mat) return true
      if (uEmail === virtualEmail || uEmail === virtualEmailById) return true
      if (candidateAuthId && u.id === candidateAuthId) return true
      if (cleanOld && cleanOld !== cleanNew && uEmail === cleanOld) return true
      return false
    })

    const existingNewAuthUser = hasValidNew
      ? allAuthUsers.find((u: any) => (u.email || '').trim().toLowerCase() === cleanNew) || null
      : null

    const staleUsers = matchedUsers.filter((u: any) => {
      const uEmail = (u.email || '').trim().toLowerCase()
      return !hasValidNew || uEmail !== cleanNew
    })

    if (staleUsers.length === 0 && !existingNewAuthUser) {
      return
    }

    const migratableOrDeletable: any[] = []

    for (const u of staleUsers) {
      const uEmail = (u.email || '').trim().toLowerCase()
      const isVirtual = uEmail.endsWith('@impactoedu.local')

      if (!isVirtual) {
        const usage = await checkEmailUsageInDb(uEmail, { excludeAlunoId: alId })
        if (usage.hasStaffUser || usage.hasOtherResp || usage.hasOtherAluno) {
          // E-mail antigo pertence a um responsável/colaborador ou outro aluno: apenas desvincula aluno_id desta conta
          const metaAlunoId = String(u.user_metadata?.aluno_id || u.app_metadata?.aluno_id || '').trim()
          if (metaAlunoId === alId) {
            const nextUserMeta = { ...(u.user_metadata || {}) }
            delete nextUserMeta.aluno_id
            delete nextUserMeta.matricula
            const nextAppMeta = { ...(u.app_metadata || {}) }
            delete nextAppMeta.aluno_id
            await admin.auth.admin
              .updateUserById(u.id, { user_metadata: nextUserMeta, app_metadata: nextAppMeta })
              .catch(() => {})
          }
          continue
        }

        if (usage.familySysIds.length > 0) {
          await admin.from('system_users').delete().in('id', usage.familySysIds)
        }
      }

      migratableOrDeletable.push(u)
    }

    if (hasValidNew) {
      if (existingNewAuthUser) {
        for (const oldU of migratableOrDeletable) {
          if (oldU.id !== existingNewAuthUser.id) {
            await admin.auth.admin.deleteUser(oldU.id).catch(() => {})
          }
        }
      } else if (migratableOrDeletable.length > 0) {
        // Prioriza migrar conta com e-mail real anterior, ou a virtual
        const primary =
          migratableOrDeletable.find((u: any) => !(u.email || '').toLowerCase().endsWith('@impactoedu.local')) ||
          migratableOrDeletable[0]

        const { error: upErr } = await admin.auth.admin.updateUserById(primary.id, {
          email: cleanNew,
          email_confirm: true,
          user_metadata: {
            ...(primary.user_metadata || {}),
            ...(params.nome ? { nome: params.nome } : {}),
            aluno_id: alId,
            matricula: mat,
          },
          app_metadata: {
            ...(primary.app_metadata || {}),
            aluno_id: alId,
          },
        })
        if (upErr) {
          await admin.auth.admin.deleteUser(primary.id).catch(() => {})
        }

        for (const extra of migratableOrDeletable) {
          if (extra.id !== primary.id) {
            await admin.auth.admin.deleteUser(extra.id).catch(() => {})
          }
        }
      }
    } else {
      // Novo e-mail vazio ou inválido: exclui todas as contas Auth antigas deste aluno
      for (const oldU of migratableOrDeletable) {
        await admin.auth.admin.deleteUser(oldU.id).catch(() => {})
      }
    }

    invalidateAuthUsersCache()
  } catch (err: any) {
    console.error('[syncAlunoAuthOnEmailChange] Error:', err?.message || err)
  }
}



