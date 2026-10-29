import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import {
  createProtectedClient,
  extractAccessTokenFromCookieList,
  getJwtExpMs,
  isJwtTokenExpired
} from './supabaseServerFactory'

/**
 * Utilitário para proteger rotas de API.
 * Suporta tanto Header Authorization: Bearer <token> (Mobile) quanto cookies de sessão (Web).
 * 
 * Uso em rotas de API:
 * ```ts
 * const { user, errorResponse } = await requireAuth(request)
 * if (errorResponse) return errorResponse
 * // Acesso seguro: user está autenticado
 * ```
 */
const VERIFIED_TOKEN_CACHE_TTL_MS = 45_000
const REVOKED_TOKEN_CACHE_TTL_MS = 15_000
const verifiedTokenCache = new Map<string, { user: any; expiresAt: number }>()
const revokedTokenCache = new Map<string, number>()
const inflightTokenVerifications = new Map<string, Promise<any | null>>()

export async function verifyTokenWithDedup(token: string): Promise<any | null> {
  if (!token || isJwtTokenExpired(token, 0)) {
    verifiedTokenCache.delete(token)
    return null
  }

  const now = Date.now()
  const revokedUntil = revokedTokenCache.get(token)
  if (revokedUntil) {
    if (revokedUntil > now) return null
    revokedTokenCache.delete(token)
  }

  const cachedToken = verifiedTokenCache.get(token)
  if (cachedToken && cachedToken.expiresAt > now && cachedToken.user) {
    return cachedToken.user
  }

  let verifyPromise = inflightTokenVerifications.get(token)
  if (!verifyPromise) {
    verifyPromise = (async () => {
      try {
        const supabase = await createProtectedClient(token)
        const res = await supabase.auth.getUser(token)
        if (!res.error && res.data?.user) {
          if (verifiedTokenCache.size > 500) verifiedTokenCache.clear()
          const tokenExpMs = getJwtExpMs(token)
          const cacheUntil = Date.now() + VERIFIED_TOKEN_CACHE_TTL_MS
          verifiedTokenCache.set(token, {
            user: res.data.user,
            expiresAt: tokenExpMs ? Math.min(cacheUntil, tokenExpMs) : cacheUntil
          })
          return res.data.user
        }
        if (res.error) {
          const errCode = String((res.error as any).code || '').toLowerCase()
          const errMsg = String(res.error.message || '').toLowerCase()
          const errStatus = Number((res.error as any).status || 0)
          if (
            errCode === 'session_not_found' ||
            errCode === 'user_not_found' ||
            errCode === 'bad_jwt' ||
            errMsg.includes('session from session_id claim in jwt does not exist') ||
            errMsg.includes('invalid claim') ||
            errStatus === 401 ||
            errStatus === 403
          ) {
            if (revokedTokenCache.size > 500) revokedTokenCache.clear()
            revokedTokenCache.set(token, Date.now() + REVOKED_TOKEN_CACHE_TTL_MS)
          }
        }
      } catch {}
      return null
    })().finally(() => {
      inflightTokenVerifications.delete(token)
    })
    inflightTokenVerifications.set(token, verifyPromise)
  }

  return verifyPromise
}

export async function requireAuth(req?: Request) {
  let authHeader: string | null = null;
  if (req && 'headers' in req) {
    authHeader = req.headers.get('authorization');
  } else {
    try {
      const h = await headers();
      authHeader = h.get('authorization');
    } catch {}
  }

  const hasBearer = authHeader ? authHeader.toLowerCase().startsWith('bearer ') : false;
  const bearerToken = hasBearer ? authHeader!.substring(7).trim() : null;

  // 1. Se o Bearer token foi fornecido explicitamente:
  if (bearerToken) {
    const verifiedUser = await verifyTokenWithDedup(bearerToken)
    if (verifiedUser) {
      return { user: verifiedUser, errorResponse: null }
    }

    // REGRA DE SEGURANÇA: Se o Bearer falhar, NUNCA assume silenciosamente uma identidade presente no cookie!
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Não autorizado. Token expirado ou inválido.', code: 'token_expired' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
      )
    };
  }

  // 1.5. Tenta extrair o access_token do cookie de sessão e validar via cache/deduplicação in-flight:
  let hadCookieToken = false
  try {
    const cookieStore = await cookies()
    const cookieToken = extractAccessTokenFromCookieList(cookieStore.getAll())
    if (cookieToken) {
      hadCookieToken = true
      const verifiedUser = await verifyTokenWithDedup(cookieToken)
      if (verifiedUser) {
        return { user: verifiedUser, errorResponse: null }
      }
    }
  } catch {}

  if (hadCookieToken) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Não autorizado. Sessão expirada ou inválida.', code: 'token_expired' },
        { status: 401 }
      )
    }
  }

  // 2. Fluxo tradicional por cookies de sessão para requisições web/SSR:
  const supabase = await createProtectedClient()
  
  let user = null;
  let error = null;

  try {
    const res = await supabase.auth.getUser()
    user = res.data.user;
    error = res.error;
  } catch (err: any) {
    // If multiple API routes hit the server concurrently and token needs refresh,
    // Supabase SSR uses Web Locks. If the lock is "stolen" by another request, it throws.
    if (err?.message?.includes('stole it') || err?.message?.includes('Lock')) {
      // Just retry once, the other request should have refreshed the token by now
      try {
        const retryRes = await supabase.auth.getUser()
        user = retryRes.data.user;
        error = retryRes.error;
      } catch (retryErr: any) {
        error = retryErr;
      }
    } else {
      error = err;
    }
  }

  if (error || !user) {
    const errorResponse = NextResponse.json(
      { error: 'Não autorizado. Autenticação é obrigatória para este endpoint.' },
      { status: 401 }
    )

    return {
      user: null,
      errorResponse
    }
  }

  return { user, errorResponse: null }
}

interface SystemUserCacheEntry {
  dbUser: { id: string; nome?: string; email?: string; auth_id?: string; dados?: any; perfil: string; cargo: string; status: string } | null
  expiresAt: number
}

const SYSTEM_USER_CACHE_TTL_MS = 60_000
const systemUserCache = new Map<string, SystemUserCacheEntry>()
const inflightSystemUser = new Map<string, Promise<SystemUserCacheEntry['dbUser']>>()

interface FamilyScopeCacheEntry {
  alunoIds: Set<string>
  responsavelIds: Set<string>
  expiresAt: number
}

const FAMILY_SCOPE_CACHE_TTL_MS = 60_000
const familyScopeCache = new Map<string, FamilyScopeCacheEntry>()
const inflightFamilyScope = new Map<string, Promise<{ alunoIds: Set<string>; responsavelIds: Set<string> }>>()

export function clearAuthGuardCache(userId?: string) {
  if (userId) {
    systemUserCache.delete(userId)
    familyScopeCache.delete(userId)
    inflightSystemUser.delete(userId)
    inflightFamilyScope.delete(userId)
    for (const [token, entry] of verifiedTokenCache.entries()) {
      if (entry.user?.id === userId) {
        verifiedTokenCache.delete(token)
      }
    }
  } else {
    systemUserCache.clear()
    familyScopeCache.clear()
    inflightSystemUser.clear()
    inflightFamilyScope.clear()
    verifiedTokenCache.clear()
  }
}

export async function fetchAuthoritativeSystemUser(user: any) {
  const cacheKey = String(user?.id || '')
  const now = Date.now()
  if (cacheKey) {
    const cached = systemUserCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.dbUser
    }
    const inflight = inflightSystemUser.get(cacheKey)
    if (inflight) {
      return inflight
    }
  }

  const promise = (async () => {
    const supabaseAdmin = require('./supabaseAdminSingleton').getAdminClient()
    const queryId = user.user_metadata?.uid_legacy || user.id
    const safeEmail = (user.email || '').trim().replace(/"/g, '')

    const orParts = [`id.eq."${queryId}"`, `auth_id.eq."${user.id}"`]
    if (safeEmail) {
      orParts.push(`email.ilike."${safeEmail}"`)
    }

    const { data: dbUser } = await supabaseAdmin
      .from('system_users')
      .select('id, nome, email, auth_id, dados, perfil, cargo, status')
      .or(orParts.join(','))
      .limit(1)
      .maybeSingle()

    const normalized = dbUser
      ? {
          id: String(dbUser.id),
          nome: dbUser.nome ? String(dbUser.nome) : undefined,
          email: dbUser.email ? String(dbUser.email) : undefined,
          auth_id: dbUser.auth_id ? String(dbUser.auth_id) : undefined,
          dados: dbUser.dados || {},
          perfil: String(dbUser.perfil || ''),
          cargo: String(dbUser.cargo || ''),
          status: String(dbUser.status || 'ativo'),
        }
      : null

    if (cacheKey) {
      if (systemUserCache.size > 500) {
        systemUserCache.clear()
      }
      systemUserCache.set(cacheKey, { dbUser: normalized, expiresAt: Date.now() + SYSTEM_USER_CACHE_TTL_MS })
    }

    return normalized
  })().finally(() => {
    if (cacheKey) inflightSystemUser.delete(cacheKey)
  })

  if (cacheKey) {
    inflightSystemUser.set(cacheKey, promise)
  }

  return promise
}

/**
 * Resolve de forma autoritativa (via tabela system_users) se o usuário autenticado
 * é um colaborador/administrador ativo (isStaff) ou se é Família/Aluno.
 * NUNCA confia em user.user_metadata para conceder privilégios de colaborador.
 */
export async function resolveUserRole(req?: Request) {
  const { user, errorResponse } = await requireAuth(req)
  if (errorResponse || !user) {
    return {
      user: null,
      dbUser: null,
      isStaff: false,
      isFamilyOrStudent: false,
      perfil: '',
      cargo: '',
      errorResponse,
    }
  }

  const dbUser = await fetchAuthoritativeSystemUser(user)
  if (dbUser) {
    if (dbUser.status.toLowerCase() === 'inativo') {
      return {
        user,
        dbUser,
        isStaff: false,
        isFamilyOrStudent: false,
        perfil: dbUser.perfil,
        cargo: dbUser.cargo,
        errorResponse: NextResponse.json({ error: 'Usuário inativo.' }, { status: 403 }),
      }
    }
    return {
      user,
      dbUser,
      isStaff: true,
      isFamilyOrStudent: false,
      perfil: dbUser.perfil,
      cargo: dbUser.cargo,
      errorResponse: null,
    }
  }

  const metaCargo = String(user.user_metadata?.cargo || '')
  const fallbackCargo = metaCargo === 'Aluno' ? 'Aluno' : 'Responsável'
  return {
    user,
    dbUser: null,
    isStaff: false,
    isFamilyOrStudent: true,
    perfil: 'Família',
    cargo: fallbackCargo,
    errorResponse: null,
  }
}

/**
 * Exige que o usuário autenticado seja um colaborador/administrador ativo em system_users.
 * Bloqueia contas de Família/Responsável e Aluno mesmo se user_metadata for adulterado.
 */
export async function requireStaff(req?: Request) {
  const resolved = await resolveUserRole(req)
  if (resolved.errorResponse) {
    return { user: null, dbUser: null, perfil: '', cargo: '', errorResponse: resolved.errorResponse }
  }
  if (!resolved.isStaff || !resolved.dbUser) {
    return {
      user: resolved.user,
      dbUser: null,
      perfil: resolved.perfil,
      cargo: resolved.cargo,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado. Operação restrita a colaboradores e administradores.' },
        { status: 403 }
      ),
    }
  }
  return {
    user: resolved.user,
    dbUser: resolved.dbUser,
    perfil: resolved.perfil,
    cargo: resolved.cargo,
    errorResponse: null,
  }
}

/**
 * Utilitário para verificar permissão específica por perfil.
 * Nunca confia em user.user_metadata para perfis administrativos.
 */
export async function requireProfile(allowedProfiles: string[], req?: Request) {
  const resolved = await resolveUserRole(req)
  if (resolved.errorResponse) return { user: null, errorResponse: resolved.errorResponse }

  const { user, dbUser, isStaff, perfil, cargo } = resolved

  // Apenas se allowedProfiles incluir explicitamente 'Família', 'Responsável' ou 'Aluno'
  // um usuário fora de system_users poderá passar.
  const normalizedAllowed = allowedProfiles.map(p => p.trim().toLowerCase())
  const effectivePerfil = isStaff && dbUser ? dbUser.perfil : perfil
  const effectiveCargo = isStaff && dbUser ? dbUser.cargo : cargo

  const matchesPerfil = normalizedAllowed.includes(effectivePerfil.trim().toLowerCase())
  const matchesCargo = Boolean(effectiveCargo && normalizedAllowed.includes(effectiveCargo.trim().toLowerCase()))

  if (!matchesPerfil && !matchesCargo) {
    return {
      user,
      errorResponse: NextResponse.json(
        { error: `Acesso negado. Requer um dos perfis: ${allowedProfiles.join(', ')}` },
        { status: 403 }
      )
    }
  }

  return { user, perfil: effectivePerfil, cargo: effectiveCargo, errorResponse: null }
}

/**
 * Verifica de forma autoritativa se o contexto resolvido pertence à Administração/Direção/Master.
 */
export function isAdminStaff(roleCtx: { isStaff?: boolean; perfil?: string; cargo?: string }): boolean {
  if (!roleCtx?.isStaff) return false
  const p = String(roleCtx.perfil || '').toLowerCase()
  const c = String(roleCtx.cargo || '').toLowerCase()
  return (
    p.includes('admin') ||
    p.includes('master') ||
    p.includes('diret') ||
    p.includes('gestor') ||
    c.includes('admin') ||
    c.includes('diret')
  )
}

/**
 * Exige que o usuário autenticado seja Administrador, Diretor Geral, Gestor ou Master.
 */
export async function requireAdminOrDirecao(req?: Request) {
  const resolved = await resolveUserRole(req)
  if (resolved.errorResponse) {
    return { ...resolved, errorResponse: resolved.errorResponse }
  }
  if (!isAdminStaff(resolved)) {
    return {
      ...resolved,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado. Operação restrita à Direção e Administração.' },
        { status: 403 }
      ),
    }
  }
  return resolved
}

/**
 * Exige que o usuário autenticado pertença ao RH, Gestão de Pessoas, Psicologia, Direção ou Administração.
 */
export async function requireHrOrAdmin(req?: Request) {
  const resolved = await resolveUserRole(req)
  if (resolved.errorResponse) {
    return { ...resolved, errorResponse: resolved.errorResponse }
  }
  const p = String(resolved.perfil || '').toLowerCase()
  const c = String(resolved.cargo || '').toLowerCase()
  const allowed =
    isAdminStaff(resolved) ||
    (resolved.isStaff &&
      (p.includes('rh') ||
        p.includes('recursos humanos') ||
        p.includes('gestao de pessoas') ||
        p.includes('gestão de pessoas') ||
        p.includes('psic') ||
        p.includes('sst') ||
        p.includes('dp') ||
        c.includes('rh') ||
        c.includes('recursos humanos') ||
        c.includes('gestao de pessoas') ||
        c.includes('gestão de pessoas') ||
        c.includes('psic') ||
        c.includes('departamento pessoal')))
  if (!allowed) {
    return {
      ...resolved,
      errorResponse: NextResponse.json(
        { error: 'Acesso restrito ao RH, Gestão de Pessoas e Diretoria.' },
        { status: 403 }
      ),
    }
  }
  return resolved
}

/**
 * Exige que o usuário autenticado pertença ao Financeiro, Secretaria, Direção ou Administração.
 */
export async function requireFinanceOrAdmin(req?: Request) {
  const resolved = await resolveUserRole(req)
  if (resolved.errorResponse) {
    return { ...resolved, errorResponse: resolved.errorResponse }
  }
  const p = String(resolved.perfil || '').toLowerCase()
  const c = String(resolved.cargo || '').toLowerCase()
  const allowed =
    isAdminStaff(resolved) ||
    (resolved.isStaff &&
      (p.includes('financ') ||
        p.includes('tesour') ||
        p.includes('contab') ||
        p.includes('secret') ||
        c.includes('financ') ||
        c.includes('tesour') ||
        c.includes('contab') ||
        c.includes('secret')))
  if (!allowed) {
    return {
      ...resolved,
      errorResponse: NextResponse.json(
        { error: 'Acesso restrito ao setor Financeiro e Administração.' },
        { status: 403 }
      ),
    }
  }
  return resolved
}

/**
 * Resolve de forma autoritativa todos os IDs de alunos e responsáveis vinculados
 * a um usuário autenticado (Família / Responsável / Aluno), com cache curto (15s).
 */
export async function resolveFamilyScope(user: any): Promise<{ alunoIds: Set<string>; responsavelIds: Set<string> }> {
  const empty = { alunoIds: new Set<string>(), responsavelIds: new Set<string>() }
  if (!user?.id) return empty

  const cacheKey = String(user.id)
  const now = Date.now()
  const cached = familyScopeCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return {
      alunoIds: new Set(cached.alunoIds),
      responsavelIds: new Set(cached.responsavelIds),
    }
  }

  const inflight = inflightFamilyScope.get(cacheKey)
  if (inflight) {
    const res = await inflight
    return {
      alunoIds: new Set(res.alunoIds),
      responsavelIds: new Set(res.responsavelIds),
    }
  }

  const promise = (async () => {
    const supabaseAdmin = require('./supabaseAdminSingleton').getAdminClient()
    const alunoIds = new Set<string>()
    const responsavelIds = new Set<string>()

    const metaAlunoId = String(user.user_metadata?.aluno_id || user.app_metadata?.aluno_id || '').trim()
    const metaRespId = String(user.user_metadata?.responsavel_id || user.app_metadata?.responsavel_id || '').trim()
    const metaMatricula = String(user.user_metadata?.matricula || user.app_metadata?.matricula || '').trim()
    const rawEmail = String(user.email || '').trim().toLowerCase()
    const isVirtualStudentEmail = rawEmail.endsWith('@impactoedu.local')

    if (metaAlunoId) alunoIds.add(metaAlunoId.replace(/^(a_|_ALU)/, ''))
    if (metaRespId) responsavelIds.add(metaRespId)

    // Se for e-mail virtual de aluno: aluno.{matricula}@impactoedu.local
    let virtualMatricula = metaMatricula
    if (!virtualMatricula && rawEmail.startsWith('aluno.') && isVirtualStudentEmail) {
      virtualMatricula = rawEmail.slice('aluno.'.length, -'@impactoedu.local'.length).trim()
    }

    try {
      // 1. Preparar busca de responsaveis e alunos diretos + aluno_responsavel inicial (para metaRespId) em PARALELO
      const respOrParts: string[] = [`id.eq."${String(user.id).replace(/"/g, '')}"`, `auth_id.eq."${String(user.id).replace(/"/g, '')}"`]
      if (metaRespId) {
        respOrParts.push(`id.eq."${metaRespId.replace(/"/g, '')}"`)
      }
      if (rawEmail && !isVirtualStudentEmail) {
        respOrParts.push(`email.ilike."${rawEmail.replace(/"/g, '')}"`)
      }

      const alunoOrParts: string[] = [`id.eq."${String(user.id).replace(/"/g, '')}"`]
      if (metaAlunoId) {
        alunoOrParts.push(`id.eq."${metaAlunoId.replace(/"/g, '')}"`)
      }
      if (virtualMatricula) {
        const safeMat = virtualMatricula.replace(/"/g, '')
        alunoOrParts.push(`matricula.eq."${safeMat}"`, `dados->>codigo.eq."${safeMat}"`)
      }
      if (rawEmail && !isVirtualStudentEmail) {
        alunoOrParts.push(`email.ilike."${rawEmail.replace(/"/g, '')}"`)
      }

      const initialRespIds = Array.from( new Set([String(user.id), metaRespId].filter(Boolean)) )

      const [respRes, directAlunosRes, initialLinksRes] = await Promise.all([
        supabaseAdmin
          .from('responsaveis')
          .select('id, email, dados')
          .or(respOrParts.join(','))
          .limit(20),
        supabaseAdmin
          .from('alunos')
          .select('id, email, matricula, dados')
          .or(alunoOrParts.join(','))
          .limit(20),
        initialRespIds.length > 0
          ? supabaseAdmin
              .from('aluno_responsavel')
              .select('aluno_id, responsavel_id')
              .in('responsavel_id', initialRespIds)
          : Promise.resolve({ data: [] })
      ])

      const respRows = respRes.data
      if (Array.isArray(respRows)) {
        for (const r of respRows) {
          const rEmail = String(r?.email || r?.dados?.email || '').trim().toLowerCase()
          if (!isVirtualStudentEmail && rEmail && rawEmail && rEmail !== rawEmail) {
            continue
          }
          if (r?.id) responsavelIds.add(String(r.id))
          const vincs = r?.dados?.alunosVinculados || r?.dados?.alunos_vinculados
          if (Array.isArray(vincs)) {
            vincs.forEach((aid: any) => {
              const cleanAid = String(typeof aid === 'object' ? aid?.id || aid?.aluno_id : aid || '').trim()
              if (cleanAid) alunoIds.add(cleanAid)
            })
          }
        }
      }

      if (Array.isArray(initialLinksRes.data)) {
        for (const l of initialLinksRes.data) {
          if (l?.aluno_id) alunoIds.add(String(l.aluno_id).trim())
        }
      }

      // 2. Se descobrimos novos responsavelIds que não estavam em initialRespIds, buscar seus vínculos
      const extraRespIds = Array.from(responsavelIds).filter(id => !initialRespIds.includes(id))
      if (extraRespIds.length > 0) {
        const { data: extraLinks } = await supabaseAdmin
          .from('aluno_responsavel')
          .select('aluno_id, responsavel_id')
          .in('responsavel_id', extraRespIds)
        if (Array.isArray(extraLinks)) {
          for (const l of extraLinks) {
            if (l?.aluno_id) alunoIds.add(String(l.aluno_id).trim())
          }
        }
      }

      const directAlunos = directAlunosRes.data
      if (Array.isArray(directAlunos)) {
        for (const a of directAlunos) {
          const aEmail = String(a?.email || a?.dados?.email || '').trim().toLowerCase()
          if (!isVirtualStudentEmail && aEmail && rawEmail && aEmail !== rawEmail) {
            continue
          }
          if (a?.id) alunoIds.add(String(a.id).trim())
        }
      }
    } catch (err) {
      console.warn('[authGuard] Aviso ao resolver familyScope:', err)
    }

    if (familyScopeCache.size > 500) {
      familyScopeCache.clear()
    }
    familyScopeCache.set(cacheKey, {
      alunoIds: new Set(alunoIds),
      responsavelIds: new Set(responsavelIds),
      expiresAt: Date.now() + FAMILY_SCOPE_CACHE_TTL_MS,
    })

    return { alunoIds, responsavelIds }
  })().finally(() => {
    inflightFamilyScope.delete(cacheKey)
  })

  inflightFamilyScope.set(cacheKey, promise)
  const result = await promise
  return {
    alunoIds: new Set(result.alunoIds),
    responsavelIds: new Set(result.responsavelIds),
  }
}

export async function getAuthorizedAlunoIdsForUser(user: any): Promise<Set<string>> {
  const { alunoIds } = await resolveFamilyScope(user)
  return alunoIds
}

export async function getAuthorizedResponsavelIdsForUser(user: any): Promise<Set<string>> {
  const { responsavelIds } = await resolveFamilyScope(user)
  return responsavelIds
}


