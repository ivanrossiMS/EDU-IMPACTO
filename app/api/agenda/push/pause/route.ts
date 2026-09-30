import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { getPushPauseStatus, setPushNotificationsPaused } from '@/lib/server/pushPauseService'

export const dynamic = 'force-dynamic'

const ALLOWED_PROFILES = [
  'Direção',
  'Administrador',
  'Diretor Geral',
  'Administrador Master',
  'Coordenação',
  'TI',
]

async function verifyPauseAuth(req?: Request) {
  const { user, errorResponse } = await requireAuth(req)
  if (errorResponse || !user) {
    return {
      authorized: false,
      errorResponse: errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }),
    }
  }

  const supabase = getAdminClient()
  const { data: dbUser } = await supabase
    .from('system_users')
    .select('id, perfil, cargo, nome, email')
    .eq('id', user.id)
    .maybeSingle()

  const perfil = dbUser?.perfil || (user.user_metadata?.perfil as string) || ''
  const cargo = dbUser?.cargo || (user.user_metadata?.cargo as string) || ''

  const isAllowed = ALLOWED_PROFILES.includes(perfil) || ALLOWED_PROFILES.includes(cargo)

  if (!isAllowed) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado. Apenas administradores e direção podem alterar o status de pausa das notificações.' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true, user: dbUser || user }
}

/**
 * GET /api/agenda/push/pause
 * Retorna o status atual da pausa global de notificações push.
 */
export async function GET() {
  try {
    const status = await getPushPauseStatus()
    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao consultar status' }, { status: 500 })
  }
}

/**
 * POST /api/agenda/push/pause
 * Altera o status da pausa global de notificações push.
 * Body: { paused: boolean, motivo?: string }
 */
export async function POST(request: Request) {
  try {
    const auth = await verifyPauseAuth(request)
    if (!auth.authorized) return auth.errorResponse!

    const body = await request.json().catch(() => ({}))
    const current = await getPushPauseStatus()
    const targetPaused = typeof body.paused === 'boolean' ? body.paused : current.paused

    const updated = await setPushNotificationsPaused(
      targetPaused,
      auth.user,
      body.motivo !== undefined ? body.motivo : current.pauseReason,
      body.exemptStudents !== undefined ? body.exemptStudents : current.exemptStudents
    )

    const exemptCount = (updated.exemptStudents || []).length

    return NextResponse.json({
      success: true,
      status: updated,
      message: targetPaused
        ? `Notificações push pausadas com sucesso.${exemptCount > 0 ? ` (${exemptCount} aluno(s) com responsáveis liberados como exceção).` : ''}`
        : 'Notificações push retomadas com sucesso. Novos eventos serão disparados normalmente.',
    })
  } catch (err: any) {
    console.error('❌ [API /api/agenda/push/pause]', err)
    return NextResponse.json({ error: err?.message || 'Erro ao atualizar status de pausa' }, { status: 500 })
  }
}
