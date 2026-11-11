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
import {
  extractFormIdentity,
  validateIdentifierAnswers,
  doesResponseMatchIdentity,
  maskIdentifierForUi,
  maskProtocolForUi,
  normalizeEmailValue,
  normalizeProtocolCode,
  sanitizeFormResponseForClient,
} from '@/lib/gestao-pessoas/formIdentity'
import {
  generateFormEditToken,
  verifyFormEditToken,
  readEditCookieToken,
  attachEditCookieHeader,
} from '@/lib/server/gpFormSecurity'

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
        const rowIdentity = extractFormIdentity(form, rowAnswers)
        const fallbackEmail = normalizeEmailValue(row.respondentEmail)
        const resolvedEmail = rowIdentity.respondentEmail || fallbackEmail
        const resolvedId =
          row.respondentId ||
          rowIdentity.respondentId ||
          (resolvedEmail ? `email:${resolvedEmail}` : '') ||
          `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const keys = Array.from(
          new Set([
            ...rowIdentity.identifierKeys,
            ...(resolvedEmail ? [`email:${resolvedEmail}`] : []),
          ])
        )
        return {
          id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          formId,
          protocol: generateProtocol(),
          respondentId: resolvedId,
          respondentName:
            row.respondentName ||
            rowIdentity.respondentName ||
            'Colaborador Importado',
          respondentEmail: resolvedEmail,
          respondentCpf: rowIdentity.respondentCpf || undefined,
          respondentPhone: rowIdentity.respondentPhone || undefined,
          identifierKeys: keys.length > 0 ? keys : undefined,
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
        responses: updatedResponses.map(sanitizeFormResponseForClient),
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
      const manualAnswers = answers || {}
      const manualIdentity = extractFormIdentity(form, manualAnswers)
      const respEmail =
        manualIdentity.respondentEmail ||
        normalizeEmailValue(manualRespondent?.email) ||
        ''
      const respName =
        String(manualRespondent?.name || '').trim() ||
        manualIdentity.respondentName ||
        'Colaborador (Lançamento Manual)'
      const respId =
        String(manualRespondent?.id || '').trim() ||
        manualIdentity.respondentId ||
        (respEmail ? `email:${respEmail}` : '') ||
        `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const respKeys = Array.from(
        new Set([
          ...manualIdentity.identifierKeys,
          ...(respEmail ? [`email:${respEmail}`] : []),
        ])
      )
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
        respondentCpf: manualIdentity.respondentCpf || undefined,
        respondentPhone: manualIdentity.respondentPhone || undefined,
        identifierKeys: respKeys.length > 0 ? respKeys : undefined,
        respondentRole: respRole,
        respondentDepartment: respDept,
        respondentUnit: respUnit,
        source: 'inserido_pelo_gestor',
        insertedByAdminName: adminName,
        adminNotes: adminNotes || undefined,
        answers: manualAnswers,
        quizScore: computeQuizScore(form, manualAnswers),
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

      return NextResponse.json(sanitizeFormResponseForClient(newResponse), { status: 201 })
    }

    // -------------------------------------------------------------------------
    // MODE 3: COLLABORATOR / PUBLIC SUBMISSION (Identificação Determinística)
    // -------------------------------------------------------------------------
    const isPublicForm = Boolean(
      form.settings?.publicLink || form.settings?.requireLogin === false
    )
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

    const safeAnswers = answers && typeof answers === 'object' ? answers : {}
    const identifierValidation = validateIdentifierAnswers(form, safeAnswers)
    if (!identifierValidation.valid) {
      return NextResponse.json(
        {
          error: identifierValidation.message || 'Verifique os campos de identificação.',
          fieldId: identifierValidation.fieldId,
        },
        { status: 400 }
      )
    }

    const formIdentity = extractFormIdentity(form, safeAnswers)

    let respondentId = ''
    let respondentUserId: string | undefined = undefined
    let respondentName = ''
    let respondentEmail = ''
    let respondentCpf: string | undefined = formIdentity.respondentCpf || undefined
    let respondentPhone: string | undefined = formIdentity.respondentPhone || undefined
    let respondentRole = 'Colaborador'
    let respondentDepartment = ''
    let respondentUnit = ''
    let authedUserId = ''
    let authedUserEmail = ''
    let authedMatched = false
    let sourceForResponse: GPFormResponse['source'] = isPublicForm
      ? 'link_publico'
      : 'colaborador_logado'

    const identifierKeySet = new Set<string>(formIdentity.identifierKeys)
    const adminSupabase = getAdminClient()

    const applyAuthenticatedIdentity = (
      sysId: string,
      sysName: string,
      sysEmail: string,
      sysRole: string
    ) => {
      authedUserId = sysId
      authedUserEmail = normalizeEmailValue(sysEmail)
      authedMatched = true

      const hasDifferentExplicitEmail = Boolean(
        formIdentity.respondentEmail &&
          authedUserEmail &&
          formIdentity.respondentEmail !== authedUserEmail
      )

      if (isPublicForm && hasDifferentExplicitEmail) {
        // Quando usuário autenticado envia formulário público informando explicitamente outro e-mail válido,
        // o registro pertence ao identificador informado (evita colisões e preserva separação por e-mail).
        respondentId = formIdentity.respondentId
        respondentName = formIdentity.respondentName || 'Participante (Público)'
        respondentEmail = formIdentity.respondentEmail
        respondentRole = 'Público / Externo'
        sourceForResponse = 'link_publico'
      } else {
        respondentUserId = sysId || undefined
        if (sysId) identifierKeySet.add(`uid:${sysId.toLowerCase()}`)
        if (authedUserEmail && !formIdentity.respondentEmail) {
          identifierKeySet.add(`email:${authedUserEmail}`)
        }

        respondentId = formIdentity.respondentId || sysId
        respondentName = formIdentity.respondentName || sysName
        respondentEmail = formIdentity.respondentEmail || authedUserEmail
        respondentRole = sysRole
        sourceForResponse = isPublicForm ? 'link_publico' : 'colaborador_logado'
      }
    }

    if (!roleCtx.errorResponse && roleCtx.isStaff && roleCtx.dbUser) {
      applyAuthenticatedIdentity(
        String(roleCtx.dbUser.id),
        String(roleCtx.dbUser.nome || roleCtx.user?.email || 'Colaborador'),
        String(roleCtx.dbUser.email || roleCtx.user?.email || ''),
        String(roleCtx.dbUser.cargo || roleCtx.dbUser.perfil || 'Colaborador')
      )
    } else if (!roleCtx.errorResponse && roleCtx.user && form.settings?.allowAccessWithoutModule) {
      // Qualquer usuário do sistema autenticado (mesmo sem estar em system_users ou sem permissão ao módulo GP)
      applyAuthenticatedIdentity(
        String(roleCtx.user.id),
        String(roleCtx.user.user_metadata?.nome || roleCtx.user.email?.split('@')[0] || 'Usuário'),
        String(roleCtx.user.email || ''),
        String(roleCtx.cargo || roleCtx.perfil || roleCtx.user.user_metadata?.cargo || 'Usuário')
      )
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
          applyAuthenticatedIdentity(
            String(authData.user.id),
            String(authData.user.user_metadata?.nome || cleanEmail),
            cleanEmail,
            'Usuário'
          )
        } else {
          return NextResponse.json(
            { error: 'Acesso permitido apenas para colaboradores ativos do sistema.' },
            { status: 403 }
          )
        }
      } else {
        applyAuthenticatedIdentity(
          String(sysUser.id),
          String(sysUser.nome || authData.user.user_metadata?.nome || cleanEmail),
          String(sysUser.email || cleanEmail),
          String(sysUser.cargo || sysUser.perfil || 'Colaborador')
        )
      }
    } else if (isPublicForm) {
      const bodyEmail = normalizeEmailValue(body.respondentEmail)
      respondentEmail = formIdentity.respondentEmail || bodyEmail || ''
      if (respondentEmail) identifierKeySet.add(`email:${respondentEmail}`)

      respondentId =
        formIdentity.respondentId ||
        (respondentEmail ? `email:${respondentEmail}` : '') ||
        `anon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      respondentName =
        formIdentity.respondentName ||
        String(body.respondentName || '').trim() ||
        'Participante (Público)'
      respondentRole = 'Público / Externo'
      sourceForResponse = 'link_publico'
    } else {
      return NextResponse.json(
        { error: 'Você precisa estar logado no sistema para responder a este formulário.' },
        { status: 401 }
      )
    }

    const identifierKeys = Array.from(identifierKeySet)

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

    // Busca determinística de resposta existente por ID de e-mail, CPF, telefone ou UID
    const matchCriteria = {
      respondentId,
      identifierKeys,
      userId: respondentUserId || undefined,
      userEmail: respondentEmail || undefined,
    }
    const existingIndex = allResponses.findIndex(r =>
      doesResponseMatchIdentity(form, r, matchCriteria)
    )

    if (existingIndex !== -1 && !form.settings?.allowMultipleResponses) {
      const prev = allResponses[existingIndex]

      if (form.settings?.allowEditOwnResponse === false) {
        return NextResponse.json(
          {
            error:
              'Já existe uma resposta registrada com este identificador (E-mail/CPF). Este formulário não permite múltiplas respostas nem alterações.',
            code: 'DUPLICATE_LOCKED',
          },
          { status: 409 }
        )
      }

      const cookieAuth = readEditCookieToken(req, formId)
      const candidateToken = String(
        body.editToken ||
          (cookieAuth?.responseId === prev.id ? cookieAuth.editToken : '') ||
          ''
      ).trim()
      const hasValidToken = Boolean(
        prev.editTokenHash &&
          candidateToken &&
          verifyFormEditToken(candidateToken, prev.editTokenHash)
      )
      const isSessionOwner = Boolean(
        authedMatched &&
          doesResponseMatchIdentity(form, prev, {
            userId: authedUserId,
            userEmail: authedUserEmail,
          })
      )
      const reqLegacyProto = normalizeProtocolCode(body.legacyProtocol)
      const hasLegacyMatch = Boolean(
        !prev.editTokenHash &&
          body.responseId &&
          body.responseId === prev.id &&
          reqLegacyProto &&
          reqLegacyProto === normalizeProtocolCode(prev.protocol)
      )

      if (!(isAdmin || isSessionOwner || hasValidToken || hasLegacyMatch)) {
        const idType =
          formIdentity.primaryType || (respondentEmail ? 'email' : null)
        const idVal = formIdentity.primaryValue || respondentEmail
        return NextResponse.json(
          {
            error:
              'Já existe uma resposta registrada para este identificador. Confirme sua identidade para visualizar ou editar sua resposta anterior.',
            code: 'EXISTING_RESPONSE_REQUIRES_VERIFICATION',
            identifierType: idType,
            maskedIdentifier: maskIdentifierForUi(idType, idVal),
            protocolHint: maskProtocolForUi(prev.protocol),
            supportsEmailOtp: Boolean(
              formIdentity.respondentEmail || prev.respondentEmail
            ),
          },
          { status: 409 }
        )
      }

      let rawTokenToReturn = ''
      let nextTokenHash = prev.editTokenHash
      let nextTokenIssuedAt = prev.editTokenIssuedAt
      if (!nextTokenHash) {
        const issued = generateFormEditToken()
        rawTokenToReturn = issued.rawToken
        nextTokenHash = issued.tokenHash
        nextTokenIssuedAt = new Date().toISOString()
      }

      const updatedResp: GPFormResponse = {
        ...prev,
        respondentId: respondentId || prev.respondentId,
        respondentUserId: respondentUserId || prev.respondentUserId,
        respondentName: respondentName || prev.respondentName,
        respondentEmail: respondentEmail || prev.respondentEmail,
        respondentCpf: respondentCpf || prev.respondentCpf,
        respondentPhone: respondentPhone || prev.respondentPhone,
        identifierKeys: identifierKeys.length > 0 ? identifierKeys : prev.identifierKeys,
        respondentRole: respondentRole || prev.respondentRole,
        respondentDepartment: respondentDepartment || prev.respondentDepartment,
        respondentUnit: respondentUnit || prev.respondentUnit,
        answers: safeAnswers,
        quizScore: computeQuizScore(form, safeAnswers),
        completionTimeSeconds:
          Number(completionTimeSeconds || 0) || prev.completionTimeSeconds,
        updatedAt: new Date().toISOString(),
        ipAddress: ip,
        editTokenHash: nextTokenHash,
        editTokenIssuedAt: nextTokenIssuedAt,
      }

      const nextList = [...allResponses]
      nextList[existingIndex] = updatedResp
      await saveFormResponses(formId, nextList)

      const payloadOut: Record<string, any> = {
        ...sanitizeFormResponseForClient(updatedResp),
        updated: true,
      }
      if (rawTokenToReturn) {
        payloadOut._editToken = rawTokenToReturn
      }
      const res = NextResponse.json(payloadOut)
      if (rawTokenToReturn) {
        attachEditCookieHeader(res, formId, updatedResp.id, rawTokenToReturn)
      }
      return res
    }

    const { rawToken, tokenHash } = generateFormEditToken()
    const newResponse: GPFormResponse = {
      id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      formId,
      protocol: generateProtocol(),
      respondentId,
      respondentUserId,
      respondentName,
      respondentEmail,
      respondentCpf,
      respondentPhone,
      identifierKeys: identifierKeys.length > 0 ? identifierKeys : undefined,
      respondentRole,
      respondentDepartment,
      respondentUnit,
      source: sourceForResponse,
      answers: safeAnswers,
      quizScore: computeQuizScore(form, safeAnswers),
      completionTimeSeconds: Number(completionTimeSeconds || 0) || undefined,
      submittedAt: new Date().toISOString(),
      ipAddress: ip,
      editTokenHash: tokenHash,
      editTokenIssuedAt: new Date().toISOString(),
    }

    const updatedResponses = [newResponse, ...allResponses]
    await saveFormResponses(formId, updatedResponses)

    forms[formIdx] = {
      ...form,
      respostasCount: updatedResponses.length,
    }
    await saveAllGPForms(forms)

    const res = NextResponse.json(
      {
        ...sanitizeFormResponseForClient(newResponse),
        _editToken: rawToken,
      },
      { status: 201 }
    )
    attachEditCookieHeader(res, formId, newResponse.id, rawToken)
    return res
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
    const {
      responseId,
      identifierKey,
      respondentId: reqRespondentId,
      answers,
      respondentName,
      respondentRole,
      respondentDepartment,
      respondentUnit,
      adminNotes,
      editToken,
      legacyProtocol,
    } = body

    const roleCtx = await resolveUserRole(req)
    const isAuthenticated = Boolean(!roleCtx.errorResponse && roleCtx.user)
    const isAdmin = Boolean(
      isAuthenticated &&
        roleCtx.isStaff &&
        isHrOrAdminUser(roleCtx.perfil, roleCtx.cargo)
    )

    const forms = await loadAllGPForms()
    const form = forms.find(f => f.id === formId)
    if (!form) {
      return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 })
    }

    const isPublicForm = Boolean(
      form.settings?.publicLink || form.settings?.requireLogin === false
    )

    if (!isAuthenticated && !isPublicForm) {
      return (
        roleCtx.errorResponse ||
        NextResponse.json(
          { error: 'Autenticação necessária para editar esta resposta.' },
          { status: 401 }
        )
      )
    }

    const allResponses = await loadFormResponses(formId)
    const nextAnswersObj = answers !== undefined && typeof answers === 'object' ? answers : null
    const draftIdentity = nextAnswersObj ? extractFormIdentity(form, nextAnswersObj) : null

    // Busca prioritária por responseId; caso omitido, resolve pelo ID determinístico do identificador (e-mail, CPF, etc.)
    let idx = responseId ? allResponses.findIndex(r => r.id === responseId) : -1
    if (idx === -1 && (identifierKey || reqRespondentId || draftIdentity?.respondentId)) {
      const candidateKeys = [
        ...(identifierKey ? [String(identifierKey)] : []),
        ...(draftIdentity?.identifierKeys || []),
      ]
      idx = allResponses.findIndex(r =>
        doesResponseMatchIdentity(form, r, {
          respondentId: reqRespondentId || draftIdentity?.respondentId,
          identifierKeys: candidateKeys,
        })
      )
    }

    if (idx === -1) {
      return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 })
    }

    const target = allResponses[idx]
    const userId = String(roleCtx.dbUser?.id || roleCtx.user?.id || '').trim()
    const userEmail = String(roleCtx.dbUser?.email || roleCtx.user?.email || '')
      .trim()
      .toLowerCase()
    const isSessionOwner =
      isAuthenticated &&
      doesResponseMatchIdentity(form, target, { userId, userEmail })

    const cookieAuth = readEditCookieToken(req, formId)
    const candidateToken = String(
      editToken ||
        (cookieAuth?.responseId === target.id ? cookieAuth.editToken : '') ||
        ''
    ).trim()
    const hasValidEditToken = Boolean(
      target.editTokenHash &&
        candidateToken &&
        verifyFormEditToken(candidateToken, target.editTokenHash)
    )

    const reqLegacyProto = normalizeProtocolCode(legacyProtocol)
    const targetProto = normalizeProtocolCode(target.protocol)
    const hasLegacyOwnerMatch = Boolean(
      !target.editTokenHash &&
        responseId &&
        responseId === target.id &&
        reqLegacyProto &&
        targetProto &&
        reqLegacyProto === targetProto
    )

    if (!isAdmin) {
      if (form.settings?.allowEditOwnResponse === false) {
        return NextResponse.json(
          { error: 'Este formulário não permite alteração das respostas após o envio.' },
          { status: 403 }
        )
      }
      if (!isSessionOwner && !hasValidEditToken && !hasLegacyOwnerMatch) {
        return NextResponse.json(
          {
            error:
              'Sem permissão para editar esta resposta. Confirme sua identidade por código no e-mail ou protocolo.',
            code: 'EDIT_AUTHORIZATION_REQUIRED',
          },
          { status: isAuthenticated ? 403 : 401 }
        )
      }
    }

    const nextAnswers = answers !== undefined ? answers : target.answers
    if (!isAdmin) {
      const idValidation = validateIdentifierAnswers(form, nextAnswers || {})
      if (!idValidation.valid) {
        return NextResponse.json(
          {
            error: idValidation.message || 'Verifique os campos de identificação.',
            fieldId: idValidation.fieldId,
          },
          { status: 400 }
        )
      }
    }

    const nextIdentity = extractFormIdentity(form, nextAnswers || {})

    if (!form.settings?.allowMultipleResponses && !isAdmin && nextIdentity.respondentId) {
      const duplicateOther = allResponses.some(
        (r, i) =>
          i !== idx &&
          doesResponseMatchIdentity(form, r, {
            respondentId: nextIdentity.respondentId,
          })
      )
      if (duplicateOther) {
        return NextResponse.json(
          {
            error:
              'Já existe outra resposta registrada com este mesmo e-mail ou documento identificador.',
          },
          { status: 409 }
        )
      }
    }

    const mergedKeys = new Set<string>(nextIdentity.identifierKeys)
    if (target.respondentUserId) {
      mergedKeys.add(`uid:${String(target.respondentUserId).toLowerCase()}`)
    }
    const resolvedEmail =
      nextIdentity.respondentEmail || normalizeEmailValue(target.respondentEmail)
    if (resolvedEmail) mergedKeys.add(`email:${resolvedEmail}`)

    const nextRespondentId =
      nextIdentity.respondentId ||
      (target.respondentId && !target.respondentId.startsWith('anon-')
        ? target.respondentId
        : resolvedEmail
        ? `email:${resolvedEmail}`
        : target.respondentId)

    const nextRespondentName =
      isAdmin && respondentName !== undefined
        ? respondentName
        : nextIdentity.respondentName || target.respondentName
    let nextRespondentRole =
      isAdmin && respondentRole !== undefined
        ? respondentRole
        : target.respondentRole
    let nextRespondentDepartment =
      isAdmin && respondentDepartment !== undefined
        ? respondentDepartment
        : target.respondentDepartment
    let nextRespondentUnit =
      isAdmin && respondentUnit !== undefined
        ? respondentUnit
        : target.respondentUnit

    if (
      resolvedEmail &&
      resolvedEmail !== normalizeEmailValue(target.respondentEmail)
    ) {
      try {
        const adminSupabase = getAdminClient()
        const { data: funcRow } = await adminSupabase
          .from('funcionarios')
          .select('departamento, unidade, cargo')
          .ilike('email', resolvedEmail)
          .limit(1)
          .maybeSingle()

        if (funcRow) {
          if (!isAdmin || respondentDepartment === undefined) {
            nextRespondentDepartment = String(funcRow.departamento || nextRespondentDepartment || '')
          }
          if (!isAdmin || respondentUnit === undefined) {
            nextRespondentUnit = String(funcRow.unidade || nextRespondentUnit || '')
          }
          if ((!isAdmin || respondentRole === undefined) && funcRow.cargo) {
            nextRespondentRole = String(funcRow.cargo)
          }
        }
      } catch {}
    }

    let rawTokenToReturn = ''
    let nextTokenHash = target.editTokenHash
    let nextTokenIssuedAt = target.editTokenIssuedAt
    if (!isAdmin && !nextTokenHash) {
      const issued = generateFormEditToken()
      rawTokenToReturn = issued.rawToken
      nextTokenHash = issued.tokenHash
      nextTokenIssuedAt = new Date().toISOString()
    }

    const updated: GPFormResponse = {
      ...target,
      respondentId: nextRespondentId,
      respondentName: nextRespondentName,
      respondentEmail: resolvedEmail,
      respondentCpf: nextIdentity.respondentCpf || target.respondentCpf,
      respondentPhone: nextIdentity.respondentPhone || target.respondentPhone,
      identifierKeys: mergedKeys.size > 0 ? Array.from(mergedKeys) : target.identifierKeys,
      respondentRole: nextRespondentRole,
      respondentDepartment: nextRespondentDepartment,
      respondentUnit: nextRespondentUnit,
      adminNotes: isAdmin && adminNotes !== undefined ? adminNotes : target.adminNotes,
      answers: nextAnswers,
      quizScore: computeQuizScore(form, nextAnswers),
      updatedAt: new Date().toISOString(),
      editTokenHash: nextTokenHash,
      editTokenIssuedAt: nextTokenIssuedAt,
    }

    const nextResponses = [...allResponses]
    nextResponses[idx] = updated
    await saveFormResponses(formId, nextResponses)

    const outPayload: Record<string, any> = sanitizeFormResponseForClient(updated)
    if (rawTokenToReturn) {
      outPayload._editToken = rawTokenToReturn
    }
    const res = NextResponse.json(outPayload)
    if (rawTokenToReturn) {
      attachEditCookieHeader(res, formId, updated.id, rawTokenToReturn)
    }
    return res
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
