import { NextResponse } from 'next/server'
import { requireAuth, resolveUserRole, isAdminStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { userId, bio, telefone, unidade } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
    }

    const loggedUser = user
    const roleCtx = await resolveUserRole(request)
    const isMasterAdmin = roleCtx ? isAdminStaff(roleCtx) : false
    const isSelf = loggedUser.id === userId ||
      loggedUser.email?.toLowerCase() === String(userId).toLowerCase() ||
      loggedUser.user_metadata?.system_user_id === userId ||
      loggedUser.user_metadata?.colaborador_id === userId ||
      roleCtx?.dbUser?.id === userId ||
      roleCtx?.dbUser?.auth_id === userId

    if (!isSelf && !isMasterAdmin) {
      return NextResponse.json({ error: 'Proibido atualizar dados de outro usuário' }, { status: 403 })
    }

    const supabaseAdmin = getAdminClient()

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    const filter = isSelf
      ? (isUuid
          ? `id.eq.${userId},auth_id.eq.${userId},auth_id.eq.${loggedUser.id},email.eq.${loggedUser.email}`
          : `id.eq.${userId},auth_id.eq.${loggedUser.id},email.eq.${loggedUser.email}`)
      : (isUuid
          ? `id.eq.${userId},auth_id.eq.${userId}`
          : `id.eq.${userId},email.eq.${userId}`)

    const { data: current } = await supabaseAdmin
      .from('system_users')
      .select('id, dados')
      .or(filter)
      .maybeSingle()

    if (current) {
      const newDados = { 
        ...(current.dados || {}), 
        bio, 
        telefone, 
        unidade 
      }

      const { error: dbErr } = await supabaseAdmin
        .from('system_users')
        .update({ dados: newDados })
        .eq('id', current.id)

      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API user-photo/extra POST] Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
