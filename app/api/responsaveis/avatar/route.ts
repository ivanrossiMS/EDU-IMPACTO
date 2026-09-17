import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { responsavelId, email, avatarUrl } = await request.json()

    if (!responsavelId || !avatarUrl) {
      return NextResponse.json({ error: 'Faltam parâmetros: responsavelId ou avatarUrl' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Atualizar a tabela responsaveis (campo jsonb 'dados')
    const { data: respData, error: fetchErr } = await supabaseAdmin.from('responsaveis').select('dados').eq('id', responsavelId).single()
    
    if (!fetchErr) {
      const novosDados = { ...(respData?.dados || {}), foto: avatarUrl }
      await supabaseAdmin.from('responsaveis').update({ dados: novosDados }).eq('id', responsavelId)
    }

    // 2. Sincronizar com a tabela system_users se o email for informado
    if (email) {
      const emailLower = email.trim().toLowerCase()
      const { data: uData } = await supabaseAdmin.from('system_users').select('id, dados, auth_id').eq('email', emailLower).maybeSingle()
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
    const emailLower = email ? email.trim().toLowerCase() : ''
    let authUserIdToUpdate: string | null = null

    // Caso A: O usuário autenticado na requisição é o próprio responsável
    if (
      (user.email && emailLower && user.email.toLowerCase() === emailLower) ||
      user.user_metadata?.responsavel_id === responsavelId
    ) {
      authUserIdToUpdate = user.id
    }

    // Caso B: Se ainda não determinou o ID do auth, busca na lista de usuários do Supabase Auth
    if (!authUserIdToUpdate && emailLower) {
      try {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const found = authUsers?.users?.find(u => u.email?.toLowerCase() === emailLower)
        if (found) {
          authUserIdToUpdate = found.id
        }
      } catch (e: any) {
        console.warn('[Avatar Sync] Falha ao listar auth users:', e.message)
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
    require('fs').writeFileSync('/tmp/avatar_err.log', String(err.stack || err.message))
    return NextResponse.json({ error: err.message || 'Erro inesperado', stack: err.stack, full: String(err) }, { status: 500 })
  }
}
