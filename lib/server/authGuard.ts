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

/**
 * Utilitário para verificar permissão específica por perfil.
 */
export async function requireProfile(allowedProfiles: string[]) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return { user: null, errorResponse }

  // Buscando o perfil atualizado do system_users para evitar falsificação no user_metadata
  const supabaseAdmin = require('./supabaseAdminSingleton').getAdminClient()
  const queryId = user.user_metadata?.uid_legacy || user.id
  
  const { data: dbUser } = await supabaseAdmin
    .from('system_users')
    .select('perfil, status')
    .or(`id.eq."${queryId}",auth_id.eq."${user.id}",email.eq."${user.email || ''}"`)
    .maybeSingle()

  const perfil = dbUser?.perfil || user.user_metadata?.perfil
  // Se o usuário não está no system_users (ex: Aluno/Família), assumimos ativo se ele logou com sucesso,
  // ou confiamos no status da tabela caso exista.
  const status = dbUser ? dbUser.status : (user.user_metadata?.status || 'ativo')

  if (status !== 'ativo') {
    return {
      user,
      errorResponse: NextResponse.json(
        { error: 'Usuário inativo.' },
        { status: 403 }
      )
    }
  }

  if (!allowedProfiles.includes(perfil)) {
    return {
      user,
      errorResponse: NextResponse.json(
        { error: `Acesso negado. Requer um dos perfis: ${allowedProfiles.join(', ')}` },
        { status: 403 }
      )
    }
  }

  return { user, perfil, errorResponse: null }
}
