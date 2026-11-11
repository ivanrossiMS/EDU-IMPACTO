import { NextResponse } from 'next/server'
import { loadAllGPForms, loadFormResponses, saveFormResponses } from '@/lib/server/gpFormulariosStore'
import { calculateSha256, generateOtpCode } from '@/lib/contracts/cryptoSignature'
import { enviarCodigoOtpFormulario } from '@/lib/server/emailService'
import {
  FormIdentifierType,
  buildIdentifierKey,
  collectResponseIdentifierKeys,
  doesResponseMatchIdentity,
  extractFormIdentity,
  maskIdentifierForUi,
  maskProtocolForUi,
  normalizeEmailValue,
  normalizeProtocolCode,
  sanitizeFormResponseForClient,
} from '@/lib/gestao-pessoas/formIdentity'
import {
  attachEditCookieHeader,
  canSendRecoveryOtp,
  clearEditCookieHeader,
  generateFormEditToken,
  getRecoveryConstants,
  isRecoveryLockedOut,
  loadFormRecoveryMap,
  readEditCookieToken,
  saveFormRecoveryMap,
  verifyFormEditToken,
} from '@/lib/server/gpFormSecurity'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function resolveTargetIdentifier(
  rawType: unknown,
  rawValue: unknown
): { type: FormIdentifierType; key: string; normalizedValue: string } | null {
  const t = String(rawType || 'email') as FormIdentifierType
  const validType: FormIdentifierType =
    t === 'cpf' || t === 'telefone' || t === 'url' ? t : 'email'
  const built = buildIdentifierKey(validType, rawValue)
  if (!built || !built.valid) return null
  return {
    type: validType,
    key: built.key,
    normalizedValue: built.normalizedValue,
  }
}

function getValidationErrorMessage(rawType: unknown): string {
  if (rawType === 'cpf') return 'Informe um CPF válido com 11 dígitos para localizar.'
  if (rawType === 'telefone') return 'Informe um telefone válido com DDD para localizar.'
  if (rawType === 'url') return 'Informe uma URL válida iniciando com http:// ou https://.'
  return 'Informe um endereço de e-mail válido para localizar.'
}

/**
 * POST /api/gestao-pessoas/formularios/[id]/identificar
 * Permite localizar, confirmar posse (via OTP por e-mail ou Protocolo Oficial)
 * e liberar edição segura de resposta pelo identificador determinístico (email:, cpf:, tel:).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params
    const body = await req.json()
    const action = String(body.action || 'lookup')

    const forms = await loadAllGPForms()
    const form = forms.find(f => f.id === formId)
    if (!form) {
      return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 })
    }

    const isPublicForm = Boolean(
      form.settings?.publicLink || form.settings?.requireLogin === false
    )
    if (!isPublicForm) {
      return NextResponse.json(
        { error: 'Este formulário exige autenticação direta no sistema.' },
        { status: 403 }
      )
    }

    const resolvedId = resolveTargetIdentifier(body.identifierType, body.identifierValue)
    if (!resolvedId) {
      return NextResponse.json(
        { error: getValidationErrorMessage(body.identifierType) },
        { status: 400 }
      )
    }

    const allResponses = await loadFormResponses(formId)
    const matchedResponses = allResponses.filter(r =>
      doesResponseMatchIdentity(form, r, {
        identifierType: resolvedId.type,
        identifierValue: resolvedId.normalizedValue,
      })
    )

    if (matchedResponses.length === 0) {
      return NextResponse.json({
        success: true,
        found: false,
        count: 0,
        identifierKey: resolvedId.key,
        maskedIdentifier: maskIdentifierForUi(resolvedId.type, resolvedId.normalizedValue),
      })
    }

    // Ordena da mais recente para a mais antiga
    const sortedMatches = [...matchedResponses].sort(
      (a, b) =>
        new Date(b.updatedAt || b.submittedAt).getTime() -
        new Date(a.updatedAt || a.submittedAt).getTime()
    )
    const latestMatch = sortedMatches[0]

    // Descobre se a resposta possui algum e-mail válido para eventual envio de OTP
    const latestIdentity = extractFormIdentity(form, latestMatch.answers || {})
    const candidateEmail =
      (resolvedId.type === 'email' ? resolvedId.normalizedValue : '') ||
      latestIdentity.respondentEmail ||
      normalizeEmailValue(latestMatch.respondentEmail)

    // -------------------------------------------------------------------------
    // ACTION: LOOKUP (verifica existência; destrava direto apenas se já houver cookie válido do mesmo navegador)
    // -------------------------------------------------------------------------
    if (action === 'lookup') {
      const cookieAuth = readEditCookieToken(req, formId)
      const unlockedTarget = cookieAuth
        ? sortedMatches.find(
            r =>
              r.id === cookieAuth.responseId &&
              verifyFormEditToken(cookieAuth.editToken, r.editTokenHash)
          ) || null
        : null

      if (unlockedTarget) {
        return NextResponse.json({
          success: true,
          found: true,
          unlocked: true,
          count: sortedMatches.length,
          identifierKey: resolvedId.key,
          maskedIdentifier: maskIdentifierForUi(resolvedId.type, resolvedId.normalizedValue),
          allowEditOwnResponse: form.settings?.allowEditOwnResponse !== false,
          response: sanitizeFormResponseForClient(unlockedTarget),
          _editToken: cookieAuth!.editToken,
        })
      }

      return NextResponse.json({
        success: true,
        found: true,
        unlocked: false,
        count: sortedMatches.length,
        identifierKey: resolvedId.key,
        maskedIdentifier: maskIdentifierForUi(resolvedId.type, resolvedId.normalizedValue),
        protocolHint: maskProtocolForUi(latestMatch.protocol),
        allowEditOwnResponse: form.settings?.allowEditOwnResponse !== false,
        canSendEmailOtp: Boolean(candidateEmail),
        maskedEmail: candidateEmail ? maskIdentifierForUi('email', candidateEmail) : '',
      })
    }

    if (form.settings?.allowEditOwnResponse === false) {
      return NextResponse.json(
        {
          error:
            'Já existe uma resposta registrada para este identificador, e este formulário não permite alterações após o envio.',
        },
        { status: 403 }
      )
    }

    const recoveryMap = await loadFormRecoveryMap(formId)
    const { OTP_TTL_MS, MAX_VERIFICATION_ATTEMPTS } = getRecoveryConstants()
    const currentRec = recoveryMap[resolvedId.key]

    // -------------------------------------------------------------------------
    // ACTION: REQUEST_OTP (envia código de 6 dígitos para o e-mail vinculado)
    // -------------------------------------------------------------------------
    if (action === 'request_otp') {
      if (!candidateEmail) {
        return NextResponse.json(
          {
            error:
              'Esta resposta não possui um e-mail vinculado para envio de código. Utilize a confirmação pelo Protocolo Oficial (#FORM-...).',
          },
          { status: 400 }
        )
      }

      const cooldown = canSendRecoveryOtp(currentRec)
      if (!cooldown.allowed) {
        return NextResponse.json(
          {
            error: `Aguarde ${cooldown.retryAfterSeconds}s antes de solicitar um novo código.`,
            retryAfterSeconds: cooldown.retryAfterSeconds,
          },
          { status: 429 }
        )
      }

      const otpCode = generateOtpCode()
      const otpHash = calculateSha256(otpCode)
      const now = Date.now()

      const emailResult = await enviarCodigoOtpFormulario({
        destinatario: candidateEmail,
        nomeDestinatario: latestMatch.respondentName,
        formTitle: form.title,
        codigoOtp: otpCode,
        protocolHint: maskProtocolForUi(latestMatch.protocol),
      })

      if (!emailResult.success) {
        if (emailResult.smtpNotConfigured) {
          return NextResponse.json({
            success: false,
            smtpUnavailable: true,
            error:
              'O envio automático de e-mail não está configurado neste ambiente. Confirme usando seu Protocolo Oficial (#FORM-...).',
          })
        }
        return NextResponse.json(
          {
            error:
              emailResult.error ||
              'Não foi possível enviar o e-mail no momento. Você pode confirmar utilizando seu Protocolo Oficial.',
          },
          { status: 500 }
        )
      }

      recoveryMap[resolvedId.key] = {
        identifierKey: resolvedId.key,
        otpHash,
        otpExpiresAt: now + OTP_TTL_MS,
        otpLastSentAt: now,
        failedAttempts: 0,
        windowStartedAt: currentRec?.windowStartedAt || now,
      }
      await saveFormRecoveryMap(formId, recoveryMap)

      return NextResponse.json({
        success: true,
        otpSent: true,
        simulated: Boolean(emailResult.simulated),
        maskedEmail: maskIdentifierForUi('email', candidateEmail),
        protocolHint: maskProtocolForUi(latestMatch.protocol),
      })
    }

    // -------------------------------------------------------------------------
    // ACTION: VERIFY_OTP ou VERIFY_PROTOCOL (valida posse e libera editToken)
    // -------------------------------------------------------------------------
    if (action === 'verify_otp' || action === 'verify_protocol') {
      if (isRecoveryLockedOut(currentRec)) {
        return NextResponse.json(
          {
            error:
              'Limite de tentativas excedido por segurança. Aguarde alguns minutos ou solicite um novo código.',
          },
          { status: 429 }
        )
      }

      let verifiedMatch = null as typeof latestMatch | null

      if (action === 'verify_otp') {
        const code = String(body.code || '').trim()
        if (!code || !currentRec?.otpHash) {
          return NextResponse.json(
            { error: 'Nenhum código ativo encontrado. Solicite o envio do código primeiro.' },
            { status: 400 }
          )
        }
        if (!currentRec.otpExpiresAt || Date.now() > currentRec.otpExpiresAt) {
          return NextResponse.json(
            { error: 'Este código expirou. Solicite um novo código para continuar.' },
            { status: 400 }
          )
        }
        if (calculateSha256(code) === currentRec.otpHash) {
          verifiedMatch = latestMatch
        }
      } else {
        const submittedProto = normalizeProtocolCode(body.protocol)
        if (!submittedProto || submittedProto.length < 6) {
          return NextResponse.json(
            { error: 'Informe o Protocolo Oficial completo (ex.: #FORM-2026-123456).' },
            { status: 400 }
          )
        }
        verifiedMatch =
          sortedMatches.find(
            r => normalizeProtocolCode(r.protocol) === submittedProto
          ) || null
      }

      if (!verifiedMatch) {
        const now = Date.now()
        const resetWindow =
          !currentRec?.windowStartedAt || now - currentRec.windowStartedAt > OTP_TTL_MS
        const nextFails = (resetWindow ? 0 : currentRec?.failedAttempts || 0) + 1
        recoveryMap[resolvedId.key] = {
          ...(currentRec || { identifierKey: resolvedId.key }),
          failedAttempts: nextFails,
          windowStartedAt: resetWindow ? now : currentRec!.windowStartedAt,
        }
        await saveFormRecoveryMap(formId, recoveryMap)

        const remaining = Math.max(0, MAX_VERIFICATION_ATTEMPTS - nextFails)
        const errorText =
          action === 'verify_otp'
            ? `Código incorreto. Restam ${remaining} tentativa(s).`
            : `Protocolo não confere com este identificador. Restam ${remaining} tentativa(s).`
        return NextResponse.json(
          { error: errorText, remainingAttempts: remaining },
          { status: remaining === 0 ? 429 : 400 }
        )
      }

      // Limpa registro de OTP/tentativas após verificação bem-sucedida
      if (recoveryMap[resolvedId.key]) {
        delete recoveryMap[resolvedId.key]
        await saveFormRecoveryMap(formId, recoveryMap)
      }

      // Atualiza metadados determinísticos caso seja uma resposta antiga e emite novo editToken
      const targetIdx = allResponses.findIndex(r => r.id === verifiedMatch!.id)
      const { rawToken, tokenHash } = generateFormEditToken()
      const matchedIdentity = extractFormIdentity(form, verifiedMatch.answers || {})
      const upgradedKeys = collectResponseIdentifierKeys(form, verifiedMatch)

      const upgradedResponse = {
        ...verifiedMatch,
        respondentId:
          matchedIdentity.respondentId ||
          (resolvedId.key.startsWith('email:') || resolvedId.key.startsWith('cpf:')
            ? resolvedId.key
            : verifiedMatch.respondentId),
        respondentEmail:
          matchedIdentity.respondentEmail ||
          candidateEmail ||
          verifiedMatch.respondentEmail ||
          '',
        respondentCpf: matchedIdentity.respondentCpf || verifiedMatch.respondentCpf,
        respondentPhone: matchedIdentity.respondentPhone || verifiedMatch.respondentPhone,
        respondentName: matchedIdentity.respondentName || verifiedMatch.respondentName,
        identifierKeys: upgradedKeys.length > 0 ? upgradedKeys : verifiedMatch.identifierKeys,
        editTokenHash: tokenHash,
        editTokenIssuedAt: new Date().toISOString(),
      }

      if (targetIdx !== -1) {
        const nextList = [...allResponses]
        nextList[targetIdx] = upgradedResponse
        await saveFormResponses(formId, nextList)
      }

      const res = NextResponse.json({
        success: true,
        found: true,
        unlocked: true,
        response: sanitizeFormResponseForClient(upgradedResponse),
        _editToken: rawToken,
      })
      attachEditCookieHeader(res, formId, upgradedResponse.id, rawToken)
      return res
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error: any) {
    console.error('[POST /api/gestao-pessoas/formularios/[id]/identificar]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao identificar resposta.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/gestao-pessoas/formularios/[id]/identificar
 * Limpa o cookie HttpOnly local de identificação do formulário (ex.: computador compartilhado).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: formId } = await params
  const res = NextResponse.json({ success: true })
  clearEditCookieHeader(res, formId)
  return res
}
