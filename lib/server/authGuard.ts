import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createProtectedClient } from './supabaseServerFactory'

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
    const supabase = await createProtectedClient(bearerToken);
    try {
      const res = await supabase.auth.getUser(bearerToken);
      if (!res.error && res.data?.user) {
        return { user: res.data.user, errorResponse: null };
      }
    } catch {}

    // REGRA DE SEGURANÇA: Se o Bearer falhar, NUNCA assume silenciosamente uma identidade presente no cookie!
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Não autorizado. Token expirado ou inválido.', code: 'token_expired' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
      )
    };
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
  dbUser: { id: string; nome?: string; perfil: string; cargo: string; status: string } | null
  expiresAt: number
}

const SYSTEM_USER_CACHE_TTL_MS = 15_000
const systemUserCache = new Map<string, SystemUserCacheEntry>()

export function clearAuthGuardCache(userId?: string) {
  if (userId) {
    systemUserCache.delete(userId)
  } else {
    systemUserCache.clear()
  }
}

async function fetchAuthoritativeSystemUser(user: any) {
  const cacheKey = String(user?.id || '')
  const now = Date.now()
  if (cacheKey) {
    const cached = systemUserCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.dbUser
    }
  }

  const supabaseAdmin = require('./supabaseAdminSingleton').getAdminClient()
  const queryId = user.user_metadata?.uid_legacy || user.id
  const safeEmail = (user.email || '').trim().replace(/"/g, '')

  const orParts = [`id.eq."${queryId}"`, `auth_id.eq."${user.id}"`]
  if (safeEmail) {
    orParts.push(`email.ilike."${safeEmail}"`)
  }

  const { data: dbUser } = await supabaseAdmin
    .from('system_users')
    .select('id, nome, perfil, cargo, status')
    .or(orParts.join(','))
    .limit(1)
    .maybeSingle()

  const normalized = dbUser
    ? {
        id: String(dbUser.id),
        nome: dbUser.nome ? String(dbUser.nome) : undefined,
        perfil: String(dbUser.perfil || ''),
        cargo: String(dbUser.cargo || ''),
        status: String(dbUser.status || 'ativo'),
      }
    : null

  if (cacheKey) {
    if (systemUserCache.size > 500) {
      systemUserCache.clear()
    }
    systemUserCache.set(cacheKey, { dbUser: normalized, expiresAt: now + SYSTEM_USER_CACHE_TTL_MS })
  }

  return normalized
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

