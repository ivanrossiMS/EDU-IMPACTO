import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import {
  loadAllGPForms,
  saveAllGPForms,
  loadMultipleFormResponsesMap,
  normalizeForm,
  isHrOrAdminUser,
} from '@/lib/server/gpFormulariosStore'
import {
  doesResponseMatchIdentity,
  sanitizeFormResponseForClient,
} from '@/lib/gestao-pessoas/formIdentity'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const roleCtx = await resolveUserRole(req)
    if (roleCtx.errorResponse) return roleCtx.errorResponse
    if (!roleCtx.isStaff) {
      return NextResponse.json(
        { error: 'Acesso restrito aos colaboradores.' },
        { status: 403 }
      )
    }

    const isAdmin = isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)
    const forms = await loadAllGPForms()
    const formIds = forms.map(f => f.id)
    const responsesMap = await loadMultipleFormResponsesMap(formIds)

    const userId = String(roleCtx.dbUser?.id || roleCtx.user?.id || '').trim()
    const userEmail = String(roleCtx.dbUser?.email || roleCtx.user?.email || '')
      .trim()
      .toLowerCase()

    const enrichedForms = forms.map(f => {
      const list = responsesMap[f.id] || []
      const matched =
        list.find(r =>
          doesResponseMatchIdentity(f, r, { userId, userEmail })
        ) || null
      const myResponse = matched ? sanitizeFormResponseForClient(matched) : null

      return {
        ...f,
        respostasCount: list.length,
        myResponse,
      }
    })

    // Non-admins see active forms (and any form they already responded to)
    const visibleForms = isAdmin
      ? enrichedForms
      : enrichedForms.filter(f => f.status === 'ativo' || Boolean(f.myResponse))

    return NextResponse.json({
      forms: visibleForms,
      isAdmin,
    })
  } catch (error: any) {
    console.error('[GET /api/gestao-pessoas/formularios]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar formulários.' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const roleCtx = await resolveUserRole(req)
    if (roleCtx.errorResponse) return roleCtx.errorResponse
    const isAdmin = isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)
    if (!roleCtx.isStaff || !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas Administradores, Diretores ou RH podem criar formulários.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const forms = await loadAllGPForms()
    const now = new Date().toISOString()

    const newForm = normalizeForm({
      ...body,
      id: body.id || `form-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      createdBy: roleCtx.dbUser?.nome || roleCtx.user?.email || 'Gestão de Pessoas',
      respostasCount: 0,
    })

    const nextForms = [newForm, ...forms]
    await saveAllGPForms(nextForms)

    return NextResponse.json(newForm, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/gestao-pessoas/formularios]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar formulário.' },
      { status: 500 }
    )
  }
}
