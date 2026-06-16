import { NextResponse } from 'next/server'
import { createProtectedClient } from './supabaseServerFactory'

/**
 * Utilitário para proteger rotas de API.
 * Verifica o cookie de sessão httpOnly. Se não houver sessão válida, retorna uma resposta de erro.
 * Se houver sessão, retorna o usuário.
 * 
 * Uso em rotas de API:
 * ```ts
 * const { user, errorResponse } = await requireAuth()
 * if (errorResponse) return errorResponse
 * // Acesso seguro: user está autenticado
 * ```
 */
export async function requireAuth() {
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
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Não autorizado. Autenticação é obrigatória para este endpoint.' },
        { status: 401 }
      )
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
  const { data: dbUser } = await supabaseAdmin
    .from('system_users')
    .select('perfil, status')
    .eq('id', user.id)
    .maybeSingle()

  const perfil = dbUser?.perfil || user.user_metadata?.perfil
  const status = dbUser?.status

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
