import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { buildComunicadoAuditoria } from '@/lib/server/comunicadoAuditoriaService'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, dbUser, perfil, cargo, errorResponse } = await requireStaff(request)
  if (errorResponse || !user) {
    return errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { id: rawId } = await context.params
    const comId = decodeURIComponent(String(rawId || '')).trim()
    if (!comId) {
      return NextResponse.json({ error: 'ID do comunicado é obrigatório.' }, { status: 400 })
    }

    const result = await buildComunicadoAuditoria(comId, {
      userId: String(user.id),
      dbUser,
      perfil,
      cargo,
    })

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Erro ao carregar destinatários.' },
        { status: result.status || 500 }
      )
    }

    return NextResponse.json(result.data, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (err: any) {
    console.error('[GET /api/comunicados/[id]/destinatarios] Erro:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao auditar destinatários.' },
      { status: 500 }
    )
  }
}
