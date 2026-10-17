import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'
import { findAuthUserByEmail } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, dbUser, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { responsavelId, email, avatarUrl } = await request.json()

    if (!responsavelId || !avatarUrl) {
      return NextResponse.json({ error: 'Faltam parâmetros: responsavelId ou avatarUrl' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Buscar o responsável para validar propriedade se não for staff
    const { data: respData, error: fetchErr } = await supabaseAdmin
      .from('responsaveis')
      .select('id, email, auth_id, dados')
      .eq('id', responsavelId)
      .single()

    if (!isStaff) {
      const userEmail = String(user.email || dbUser?.email || '').trim().toLowerCase()
      const respEmail = String(respData?.email || email || '').trim().toLowerCase()
      const isOwnGuardian =
        String(user.id) === String(responsavelId) ||
        String(respData?.auth_id || '') === String(user.id) ||
        String(user.user_metadata?.responsavel_id || '') === String(responsavelId) ||
        (userEmail && respEmail && userEmail === respEmail)

      if (!isOwnGuardian) {
        return NextResponse.json(
          { error: 'Acesso negado: você só pode alterar o seu próprio avatar.' },
          { status: 403 }
        )
      }
    }

    if (!fetchErr) {
      const novosDados = { ...(respData?.dados || {}), foto: avatarUrl }
      await supabaseAdmin.from('responsaveis').update({ dados: novosDados }).eq('id', responsavelId)
    }

    // 2. Sincronizar com a tabela system_users apenas se for Staff ou o próprio e-mail autenticado
    const targetEmailLower = email ? email.trim().toLowerCase() : ''
    const callerEmailLower = String(user.email || '').trim().toLowerCase()
    if (targetEmailLower && (isStaff || targetEmailLower === callerEmailLower)) {
      const { data: uData } = await supabaseAdmin.from('system_users').select('id, dados, auth_id').eq('email', targetEmailLower).maybeSingle()
      if (uData) {
        const sysDados = { ...(uData.dados || {}), foto: avatarUrl }
        await supabaseAdmin.from('system_users').update({ dados: sysDados }).eq('id', uData.id)
        if (uData.auth_id) {
          await supabaseAdmin.auth.admin.updateUserById(uData.auth_id, {
            user_metadata: { foto: avatarUrl }
          })
        }
      }
    }

    // 3. Sincronizar user_metadata do Supabase Auth para o Responsável
    const emailLower = (email || respData?.email || '').trim().toLowerCase()
    let authUserIdToUpdate: string | null = respData?.auth_id || null

    // Caso A: O usuário autenticado na requisição é o próprio responsável
    if (
      !authUserIdToUpdate &&
      ((user.email && emailLower && user.email.toLowerCase() === emailLower) ||
       user.user_metadata?.responsavel_id === responsavelId)
    ) {
      authUserIdToUpdate = user.id
    }

    // Caso B: Se ainda não determinou o ID do auth, busca via findAuthUserByEmail (com cache O(1))
    if (!authUserIdToUpdate && emailLower) {
      try {
        const found = await findAuthUserByEmail(emailLower)
        if (found) {
          authUserIdToUpdate = found.id
        }
      } catch (e: any) {
        console.warn('[Avatar Sync] Falha ao buscar auth user:', e.message)
      }
    }

    if (authUserIdToUpdate) {
      try {
        const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(authUserIdToUpdate)
        const currentMeta = existingAuth?.user?.user_metadata || {}
        await supabaseAdmin.auth.admin.updateUserById(authUserIdToUpdate, {
          user_metadata: { ...currentMeta, foto: avatarUrl }
        })
      } catch (authSyncErr: any) {
        console.warn('[Avatar Sync] Erro ao sincronizar user_metadata do auth:', authSyncErr.message)
      }
    }

    return NextResponse.json({ ok: true, message: 'Avatar atualizado com sucesso', avatarUrl })
  } catch (err: any) {
    console.error('[API responsaveis/avatar]', err)
    return NextResponse.json({ error: err.message || 'Erro inesperado ao salvar avatar' }, { status: 500 })
  }
}
