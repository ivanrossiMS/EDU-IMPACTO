import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  loadAllGPForms,
  saveAllGPForms,
  loadFormResponses,
  saveFormResponses,
  normalizeForm,
  isHrOrAdminUser,
} from '@/lib/server/gpFormulariosStore'
import {
  doesResponseMatchIdentity,
  sanitizeFormResponseForClient,
} from '@/lib/gestao-pessoas/formIdentity'
import {
  readEditCookieToken,
  verifyFormEditToken,
} from '@/lib/server/gpFormSecurity'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function checkUserHasGPAccess(roleCtx: any): Promise<boolean> {
  if (!roleCtx || roleCtx.errorResponse || !roleCtx.user) return false
  if (roleCtx.isFamilyOrStudent) return false
  if (!roleCtx.isStaff) return false
  if (isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)) return true

  try {
    const supabase = getAdminClient()
    const perfilName = String(roleCtx.perfil || roleCtx.dbUser?.perfil || '').trim().toLowerCase()
    if (!perfilName) return true
    const { data } = await supabase.from('perfis').select('id, dados').limit(50)
    if (data && Array.isArray(data)) {
      const match = data.find(p => {
        const d = p.dados || {}
        return (
          String(d.nome || '').trim().toLowerCase() === perfilName ||
          String(p.id || '').trim().toLowerCase() === perfilName
        )
      })
      if (match?.dados?.bloqueadoGestaoPessoas === true) {
        return false
      }
    }
  } catch {}
  return true
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const forms = await loadAllGPForms()
    const form = forms.find(f => f.id === id)

    if (!form) {
      return NextResponse.json(
        { error: 'Formulário não encontrado.' },
        { status: 404 }
      )
    }

    const roleCtx = await resolveUserRole(req)
    const isAuthenticated = Boolean(!roleCtx.errorResponse && roleCtx.user)
    const isAuthenticatedStaff = Boolean(!roleCtx.errorResponse && roleCtx.isStaff)
    const isAdmin =
      isAuthenticatedStaff && isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)

    const isPublicForm = Boolean(form.settings?.publicLink || form.settings?.requireLogin === false)
    const hasModuleAccess = await checkUserHasGPAccess(roleCtx)
    const allowWithoutModule = Boolean(form.settings?.allowAccessWithoutModule)

    // Se o formulário NÃO for público nem permitir acesso sem o módulo e o usuário logado não tiver permissão
    if (!isPublicForm && !allowWithoutModule && isAuthenticated && !hasModuleAccess) {
      return NextResponse.json(
        {
          error:
            'Você não possui acesso a este formulário pois ele é restrito ao Módulo de Gestão de Pessoas.',
          restrictedModule: true,
        },
        { status: 403 }
      )
    }

    const allResponses = await loadFormResponses(id)

    if (!isAuthenticated) {
      // Verifica se este navegador possui cookie HttpOnly válido de resposta própria
      const cookieAuth = readEditCookieToken(req, id)
      const matchedByCookie = cookieAuth
        ? allResponses.find(
            r =>
              r.id === cookieAuth.responseId &&
              verifyFormEditToken(cookieAuth.editToken, r.editTokenHash)
          ) || null
        : null
      const safeCookieResponses = matchedByCookie
        ? [sanitizeFormResponseForClient(matchedByCookie)]
        : []

      // Retorna a estrutura pública para exibir cabeçalho ou permitir resposta pública
      return NextResponse.json({
        form: {
          ...form,
          respostasCount: allResponses.length,
          myResponse: safeCookieResponses[0] || null,
        },
        authenticated: false,
        isPublic: isPublicForm,
        isAdmin: false,
        hasModuleAccess: false,
        responses: [],
        myResponses: safeCookieResponses,
      })
    }

    const userId = String(roleCtx.dbUser?.id || roleCtx.user?.id || '').trim()
    const userEmail = String(roleCtx.dbUser?.email || roleCtx.user?.email || '')
      .trim()
      .toLowerCase()
    const cookieAuth = readEditCookieToken(req, id)

    const myResponses = allResponses
      .filter(
        r =>
          doesResponseMatchIdentity(form, r, { userId, userEmail }) ||
          Boolean(
            cookieAuth &&
              r.id === cookieAuth.responseId &&
              verifyFormEditToken(cookieAuth.editToken, r.editTokenHash)
          )
      )
      .map(sanitizeFormResponseForClient)

    const safeResponses = isAdmin
      ? allResponses.map(sanitizeFormResponseForClient)
      : []

    return NextResponse.json({
      form: {
        ...form,
        respostasCount: allResponses.length,
        myResponse: myResponses[0] || null,
      },
      authenticated: true,
      isAdmin,
      hasModuleAccess,
      responses: safeResponses,
      myResponses,
    })
  } catch (error: any) {
    console.error('[GET /api/gestao-pessoas/formularios/[id]]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar formulário.' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const roleCtx = await resolveUserRole(req)
    if (roleCtx.errorResponse) return roleCtx.errorResponse
    const isAdmin = isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)
    if (!roleCtx.isStaff || !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas Administradores, Diretores ou RH podem editar formulários.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()
    const forms = await loadAllGPForms()
    const idx = forms.findIndex(f => f.id === id)

    if (idx === -1) {
      return NextResponse.json(
        { error: 'Formulário não encontrado.' },
        { status: 404 }
      )
    }

    const existing = forms[idx]
    const updated = normalizeForm({
      ...existing,
      ...body,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    })

    const nextForms = [...forms]
    nextForms[idx] = updated
    await saveAllGPForms(nextForms)

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[PUT /api/gestao-pessoas/formularios/[id]]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar formulário.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const roleCtx = await resolveUserRole(req)
    if (roleCtx.errorResponse) return roleCtx.errorResponse
    const isAdmin = isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)
    if (!roleCtx.isStaff || !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas Administradores, Diretores ou RH podem excluir formulários.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const forms = await loadAllGPForms()
    const nextForms = forms.filter(f => f.id !== id)
    await saveAllGPForms(nextForms)
    await saveFormResponses(id, [])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/gestao-pessoas/formularios/[id]]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir formulário.' },
      { status: 500 }
    )
  }
}
