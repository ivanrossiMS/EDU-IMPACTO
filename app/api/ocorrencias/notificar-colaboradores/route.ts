import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { resolveCollaboratorUsers } from '@/lib/server/collaboratorLookup'
import {
  getOcorrenciasPushConfig,
  saveOcorrenciasPushConfig,
  notifyOcorrenciaToColaboradores,
  fetchUserOneSignalSubscriptions,
} from '@/lib/server/ocorrenciasPushHelper'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ocorrencias/notificar-colaboradores
 * Retorna a configuração atual de push de ocorrências para colaboradores e o status de aparelhos ativos no OneSignal.
 */
export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabaseService = getAdminClient()
    const url = new URL(request.url)
    const userIdsParam = url.searchParams.get('userIds')

    const config = await getOcorrenciasPushConfig()

    let targetIds: string[] = []
    if (userIdsParam) {
      targetIds = userIdsParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    } else {
      targetIds = config.selectedUserIds || []
    }

    const statusMap: Record<
      string,
      {
        hasActiveDevice: boolean
        deviceCount: number
        devices: Array<{ type: string; id: string }>
      }
    > = {}

    if (targetIds.length > 0) {
      const targetUsers = await resolveCollaboratorUsers(supabaseService, targetIds)
      const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
      const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''

      if (appId && apiKey && targetUsers.length > 0) {
        await Promise.allSettled(
          targetUsers.map(async u => {
            const idCandidates = [u.id, u.auth_id, u.email].filter(Boolean).map(String)
            const subs = await fetchUserOneSignalSubscriptions(appId, apiKey, idCandidates)
            const entry = {
              hasActiveDevice: subs.length > 0,
              deviceCount: subs.length,
              devices: subs.map(s => ({ type: s.type, id: s.id })),
            }
            if (u.id) statusMap[String(u.id)] = entry
            if (u.auth_id && u.auth_id !== u.id) statusMap[String(u.auth_id)] = entry
          })
        )
      }
    }

    return NextResponse.json({
      ok: true,
      config,
      status: statusMap,
    })
  } catch (err: any) {
    console.error('[API Ocorrencias Notificar Colaboradores GET] Erro:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

/**
 * PUT /api/ocorrencias/notificar-colaboradores
 * Salva as configurações de quais colaboradores recebem notificações push sobre ocorrências.
 */
export async function PUT(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const payload = body?.config && typeof body.config === 'object' ? body.config : body
    const savedConfig = await saveOcorrenciasPushConfig(payload)
    return NextResponse.json({ ok: true, config: savedConfig })
  } catch (err: any) {
    console.error('[API Ocorrencias Notificar Colaboradores PUT] Erro:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/ocorrencias/notificar-colaboradores
 * Suporta tanto salvar a configuração quanto disparar um teste imediato de notificação push para os colaboradores marcados.
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()

    if (body?.action === 'save_config' || (!body?.test && body?.selectedUserIds !== undefined)) {
      const payload = body?.config && typeof body.config === 'object' ? body.config : body
      const savedConfig = await saveOcorrenciasPushConfig(payload)
      return NextResponse.json({ ok: true, config: savedConfig })
    }

    const userIds: string[] | undefined = Array.isArray(body?.userIds)
      ? body.userIds.map((id: any) => String(id || '').trim()).filter(Boolean)
      : undefined

    if (userIds && userIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecione pelo menos um colaborador para enviar o teste de notificação.',
        },
        { status: 400 }
      )
    }

    const result = await notifyOcorrenciaToColaboradores({
      action: 'teste',
      ocorrenciaId: `test_${Date.now()}`,
      senderUserId: user?.id,
      customUserIds: userIds,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Falha ao disparar notificação de teste.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[API Ocorrencias Notificar Colaboradores POST] Erro:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
