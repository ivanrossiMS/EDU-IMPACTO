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
  const { data: { user }, error } = await supabase.auth.getUser()

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
