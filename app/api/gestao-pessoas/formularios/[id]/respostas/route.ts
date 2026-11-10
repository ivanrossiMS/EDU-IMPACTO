import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  loadAllGPForms,
  saveAllGPForms,
  loadFormResponses,
  saveFormResponses,
  computeQuizScore,
  isHrOrAdminUser,
} from '@/lib/server/gpFormulariosStore'
import { GPFormResponse } from '@/lib/gestao-pessoas/formulariosTypes'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function generateProtocol(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(100000 + Math.random() * 900000)
  return `FORM-${year}-${rand}`
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params
    const body = await req.json()
    const {
      mode, // 'collaborator' | 'manual_admin' | 'bulk_import'
      answers,
      email,
      password,
      manualRespondent,
      bulkRows,
      completionTimeSeconds,
    } = body

    const forms = await loadAllGPForms()
    const formIdx = forms.findIndex(f => f.id === formId)
    if (formIdx === -1) {
      return NextResponse.json(
        { error: 'Formulário não encontrado.' },
        { status: 404 }
      )
    }

    const form = forms[formIdx]
    const allResponses = await loadFormResponses(formId)
    const roleCtx = await resolveUserRole(req)
    const isAdmin =
      !roleCtx.errorResponse &&
      roleCtx.isStaff &&
      isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)

    let ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('remote-addr') ||
      '0.0.0.0'
    ip = ip.split(',')[0].trim()

    // -------------------------------------------------------------------------
    // MODE 1: BULK IMPORT BY ADMIN / HR
    // -------------------------------------------------------------------------
    if (mode === 'bulk_import') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Apenas gestores e RH podem importar respostas em lote.' },
          { status: 403 }
        )
      }
      if (!Array.isArray(bulkRows) || bulkRows.length === 0) {
        return NextResponse.json(
          { error: 'Nenhuma linha válida para importar.' },
          { status: 400 }
        )
      }

      const adminName =
        roleCtx.dbUser?.nome || roleCtx.user?.email || 'Gestor RH'
      const importedList: GPFormResponse[] = bulkRows.map((row: any) => {
        const rowAnswers = row.answers || {}
        return {
          id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          formId,
          protocol: generateProtocol(),
          respondentId: row.respondentId || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          respondentName: row.respondentName || 'Colaborador Importado',
          respondentEmail: row.respondentEmail || '',
          respondentRole: row.respondentRole || 'Colaborador',
          respondentDepartment: row.respondentDepartment || '',
          respondentUnit: row.respondentUnit || '',
          source: 'importado_planilha',
          insertedByAdminName: adminName,
          adminNotes: row.adminNotes || 'Importado via planilha',
          answers: rowAnswers,
          quizScore: computeQuizScore(form, rowAnswers),
          submittedAt: row.submittedAt || new Date().toISOString(),
          ipAddress: ip,
        }
      })

      const updatedResponses = [...importedList, ...allResponses]
      await saveFormResponses(formId, updatedResponses)

      forms[formIdx] = {
        ...form,
        respostasCount: updatedResponses.length,
      }
      await saveAllGPForms(forms)

      return NextResponse.json({
        success: true,
        importedCount: importedList.length,
        responses: updatedResponses,
      })
    }

    // -------------------------------------------------------------------------
    // MODE 2: MANUAL ENTRY BY ADMIN / HR ("Mas tambem posso adicionar respostas")
    // -------------------------------------------------------------------------
    if (mode === 'manual_admin') {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Apenas Administradores, Diretores ou RH podem lançar respostas manualmente.' },
          { status: 403 }
        )
      }

      const adminName =
        roleCtx.dbUser?.nome || roleCtx.user?.email || 'Gestor RH'
      const respName =
        String(manualRespondent?.name || '').trim() || 'Colaborador (Lançamento Manual)'
      const respId =
        String(manualRespondent?.id || '').trim() ||
        `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const respEmail = String(manualRespondent?.email || '').trim()
      const respRole = String(manualRespondent?.role || '').trim() || 'Colaborador'
      const respDept = String(manualRespondent?.department || '').trim()
      const respUnit = String(manualRespondent?.unit || '').trim()
      const respDate = manualRespondent?.submittedAt
        ? new Date(manualRespondent.submittedAt).toISOString()
        : new Date().toISOString()
      const adminNotes = String(manualRespondent?.notes || '').trim()

      const newResponse: GPFormResponse = {
        id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        formId,
        protocol: generateProtocol(),
        respondentId: respId,
        respondentName: respName,
        respondentEmail: respEmail,
        respondentRole: respRole,
        respondentDepartment: respDept,
        respondentUnit: respUnit,
        source: 'inserido_pelo_gestor',
        insertedByAdminName: adminName,
        adminNotes: adminNotes || undefined,
        answers: answers || {},
        quizScore: computeQuizScore(form, answers || {}),
        completionTimeSeconds: Number(completionTimeSeconds || 0) || undefined,
        submittedAt: respDate,
        ipAddress: ip,
      }

      const updatedResponses = [newResponse, ...allResponses]
      await saveFormResponses(formId, updatedResponses)

      forms[formIdx] = {
        ...form,
        respostasCount: updatedResponses.length,
      }
      await saveAllGPForms(forms)

      return NextResponse.json(newResponse, { status: 201 })
    }

    // -------------------------------------------------------------------------
    // MODE 3: COLLABORATOR SUBMISSION (Requires Login / Session or Credentials)
    // -------------------------------------------------------------------------
    const isPublicForm = Boolean(form.settings?.publicLink)
    const isAcceptingResponses =
      form.status === 'ativo' || (form.status === 'rascunho' && isPublicForm)

    if (!isAcceptingResponses && !isAdmin) {
      const msg =
        form.status === 'encerrado'
          ? 'Este formulário foi encerrado e não está mais aceitando respostas.'
          : 'Este formulário não está aceitando novas respostas no momento.'
      return NextResponse.json(
        { error: msg },
        { status: 400 }
      )
    }

    // Auto-promote draft to active if responses are incoming through an open form
    if (form.status === 'rascunho' && isPublicForm) {
      form.status = 'ativo'
      forms[formIdx] = { ...form, status: 'ativo' }
      saveAllGPForms(forms).catch(() => {})
    }

    if (form.settings?.deadline && !isAdmin) {
      const deadlineDate = new Date(form.settings.deadline + 'T23:59:59')
      if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
        return NextResponse.json(
          { error: 'O prazo para responder a este formulário já foi encerrado.' },
          { status: 400 }
        )
      }
    }

    let respondentId = ''
    let respondentName = ''
    let respondentEmail = ''
    let respondentRole = 'Colaborador'
    let respondentDepartment = ''
    let respondentUnit = ''

    const adminSupabase = getAdminClient()

    if (!roleCtx.errorResponse && roleCtx.isStaff && roleCtx.dbUser) {
      respondentId = String(roleCtx.dbUser.id)
      respondentName = String(roleCtx.dbUser.nome || roleCtx.user?.email || 'Colaborador')
      respondentEmail = String(roleCtx.dbUser.email || roleCtx.user?.email || '')
      respondentRole = String(roleCtx.dbUser.cargo || roleCtx.dbUser.perfil || 'Colaborador')
    } else if (!roleCtx.errorResponse && roleCtx.user && form.settings?.allowAccessWithoutModule) {
      // Qualquer usuário do sistema autenticado (mesmo sem estar em system_users ou sem permissão ao módulo GP)
      respondentId = String(roleCtx.user.id)
      respondentName = String(roleCtx.user.user_metadata?.nome || roleCtx.user.email?.split('@')[0] || 'Usuário')
      respondentEmail = String(roleCtx.user.email || '')
      respondentRole = String(roleCtx.cargo || roleCtx.perfil || roleCtx.user.user_metadata?.cargo || 'Usuário')
    } else if (email && password) {
      // Authenticate via Supabase Auth credentials when collaborator signs in directly on the form
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: authData, error: authError } =
        await authClient.auth.signInWithPassword({
          email: String(email).trim(),
          password: String(password),
        })

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: 'E-mail ou senha incorretos. Faça login com sua conta institucional.' },
          { status: 401 }
        )
      }

      const cleanEmail = String(authData.user.email || email).trim().toLowerCase()
      const { data: sysUser } = await adminSupabase
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status')
        .or(`id.eq."${authData.user.id}",auth_id.eq."${authData.user.id}",email.ilike."${cleanEmail}"`)
        .limit(1)
        .maybeSingle()

      if (!sysUser || String(sysUser.status || '').toLowerCase() === 'inativo') {
        if (form.settings?.allowAccessWithoutModule && authData.user) {
          respondentId = String(authData.user.id)
          respondentName = String(authData.user.user_metadata?.nome || cleanEmail)
          respondentEmail = cleanEmail
          respondentRole = 'Usuário'
        } else {
          return NextResponse.json(
            { error: 'Acesso permitido apenas para colaboradores ativos do sistema.' },
            { status: 403 }
          )
        }
      } else {
        respondentId = String(sysUser.id)
        respondentName = String(sysUser.nome || authData.user.user_metadata?.nome || cleanEmail)
        respondentEmail = String(sysUser.email || cleanEmail)
        respondentRole = String(sysUser.cargo || sysUser.perfil || 'Colaborador')
      }
    } else if (form.settings?.publicLink || form.settings?.requireLogin === false) {
      // Procura se o participante preencheu o campo de nome no formulário
      const allFields = (form.sections || []).flatMap(s => s.fields || [])
      let detectedName = ''
      for (const [fId, val] of Object.entries(answers)) {
        const field = allFields.find(f => f.id === fId)
        if (
          field &&
          (field.autoFillUser === 'nome' ||
            field.type === 'usuario_logado' ||
            /nome/i.test(field.title))
        ) {
          if (typeof val === 'string' && val.trim()) {
            detectedName = val.trim()
            break
          }
        }
      }
      respondentId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      respondentName = detectedName || body.respondentName || 'Participante (Público)'
      respondentEmail = body.respondentEmail || ''
      respondentRole = 'Público / Externo'
    } else {
      return NextResponse.json(
        { error: 'Você precisa estar logado no sistema para responder a este formulário.' },
        { status: 401 }
      )
    }

    // Enrich department & unit from funcionarios table if available
    if (respondentEmail) {
      const { data: funcRow } = await adminSupabase
        .from('funcionarios')
        .select('departamento, unidade, cargo')
        .ilike('email', respondentEmail.trim())
        .limit(1)
        .maybeSingle()

      if (funcRow) {
        respondentDepartment = String(funcRow.departamento || '')
        respondentUnit = String(funcRow.unidade || '')
        if (funcRow.cargo) respondentRole = String(funcRow.cargo)
      }
    }

    // Check if collaborator already responded when allowMultipleResponses is false
    const existingIndex = allResponses.findIndex(
      r =>
        ((respondentId && r.respondentId === respondentId) ||
          (respondentEmail &&
            String(r.respondentEmail || '').toLowerCase() ===
              respondentEmail.toLowerCase()))
    )

    if (existingIndex !== -1 && !form.settings?.allowMultipleResponses) {
      if (form.settings?.allowEditOwnResponse) {
        // Update existing response
        const prev = allResponses[existingIndex]
        const updatedResp: GPFormResponse = {
          ...prev,
          answers: answers || {},
          quizScore: computeQuizScore(form, answers || {}),
          completionTimeSeconds:
            Number(completionTimeSeconds || 0) || prev.completionTimeSeconds,
          updatedAt: new Date().toISOString(),
          ipAddress: ip,
        }
        const nextList = [...allResponses]
        nextList[existingIndex] = updatedResp
        await saveFormResponses(formId, nextList)
        return NextResponse.json(updatedResp)
      } else {
        return NextResponse.json(
          { error: 'Você já respondeu a este formulário (limite de 1 resposta por colaborador).' },
          { status: 400 }
        )
      }
    }

    const newResponse: GPFormResponse = {
      id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      formId,
      protocol: generateProtocol(),
      respondentId,
      respondentName,
      respondentEmail,
      respondentRole,
      respondentDepartment,
      respondentUnit,
      source: 'colaborador_logado',
      answers: answers || {},
      quizScore: computeQuizScore(form, answers || {}),
      completionTimeSeconds: Number(completionTimeSeconds || 0) || undefined,
      submittedAt: new Date().toISOString(),
      ipAddress: ip,
    }

    const updatedResponses = [newResponse, ...allResponses]
    await saveFormResponses(formId, updatedResponses)

    forms[formIdx] = {
      ...form,
      respostasCount: updatedResponses.length,
    }
    await saveAllGPForms(forms)

    return NextResponse.json(newResponse, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/gestao-pessoas/formularios/[id]/respostas]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar resposta.' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params
    const body = await req.json()
    const { responseId, answers, respondentName, respondentRole, respondentDepartment, respondentUnit, adminNotes } = body

    const roleCtx = await resolveUserRole(req)
    if (roleCtx.errorResponse) return roleCtx.errorResponse
    if (!roleCtx.isStaff) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 })
    }

    const isAdmin = isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)
    const forms = await loadAllGPForms()
    const form = forms.find(f => f.id === formId)
    if (!form) {
      return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 })
    }

    const allResponses = await loadFormResponses(formId)
    const idx = allResponses.findIndex(r => r.id === responseId)
    if (idx === -1) {
      return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 })
    }

    const target = allResponses[idx]
    const userId = String(roleCtx.dbUser?.id || roleCtx.user?.id || '')
    const isOwner = Boolean(userId && target.respondentId === userId)

    if (!isAdmin && (!isOwner || !form.settings?.allowEditOwnResponse)) {
      return NextResponse.json(
        { error: 'Sem permissão para editar esta resposta.' },
        { status: 403 }
      )
    }

    const nextAnswers = answers !== undefined ? answers : target.answers
    const updated: GPFormResponse = {
      ...target,
      respondentName: isAdmin && respondentName !== undefined ? respondentName : target.respondentName,
      respondentRole: isAdmin && respondentRole !== undefined ? respondentRole : target.respondentRole,
      respondentDepartment: isAdmin && respondentDepartment !== undefined ? respondentDepartment : target.respondentDepartment,
      respondentUnit: isAdmin && respondentUnit !== undefined ? respondentUnit : target.respondentUnit,
      adminNotes: isAdmin && adminNotes !== undefined ? adminNotes : target.adminNotes,
      answers: nextAnswers,
      quizScore: computeQuizScore(form, nextAnswers),
      updatedAt: new Date().toISOString(),
    }

    const nextResponses = [...allResponses]
    nextResponses[idx] = updated
    await saveFormResponses(formId, nextResponses)

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[PUT /api/gestao-pessoas/formularios/[id]/respostas]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar resposta.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params
    const { searchParams } = new URL(req.url)
    const responseId = searchParams.get('responseId')

    const roleCtx = await resolveUserRole(req)
    if (roleCtx.errorResponse) return roleCtx.errorResponse
    const isAdmin = isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)
    if (!roleCtx.isStaff || !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas Administradores, Diretores ou RH podem excluir respostas.' },
        { status: 403 }
      )
    }

    if (!responseId) {
      return NextResponse.json({ error: 'responseId é obrigatório.' }, { status: 400 })
    }

    const allResponses = await loadFormResponses(formId)
    const nextResponses = allResponses.filter(r => r.id !== responseId)
    await saveFormResponses(formId, nextResponses)

    const forms = await loadAllGPForms()
    const fIdx = forms.findIndex(f => f.id === formId)
    if (fIdx !== -1) {
      forms[fIdx] = {
        ...forms[fIdx],
        respostasCount: nextResponses.length,
      }
      await saveAllGPForms(forms)
    }

    return NextResponse.json({ success: true, count: nextResponses.length })
  } catch (error: any) {
    console.error('[DELETE /api/gestao-pessoas/formularios/[id]/respostas]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao excluir resposta.' },
      { status: 500 }
    )
  }
}
