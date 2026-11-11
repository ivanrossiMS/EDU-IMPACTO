import { FormField, GPForm, GPFormResponse } from './formulariosTypes'
import { isValidEmailSyntax } from '@/lib/utils/emailValidation'

export type FormIdentifierType = 'email' | 'cpf' | 'telefone' | 'url'

export interface FormIdentifierField {
  field: FormField
  type: FormIdentifierType
  label: string
}

export interface ExtractedFormIdentity {
  respondentId: string
  primaryType: FormIdentifierType | null
  primaryValue: string
  respondentEmail: string
  respondentCpf: string
  respondentPhone: string
  respondentUrl: string
  respondentName: string
  identifierKeys: string[]
}

const IDENTIFIER_PRIORITY: FormIdentifierType[] = ['email', 'cpf', 'telefone', 'url']

export function normalizeEmailValue(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function isValidEmailValue(raw: unknown): boolean {
  const email = normalizeEmailValue(raw)
  return Boolean(email && isValidEmailSyntax(email))
}

export function normalizeCpfDigits(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '')
}

export function isValidCpfValue(raw: unknown): boolean {
  const digits = normalizeCpfDigits(raw)
  return digits.length === 11 && !/^(\d)\1{10}$/.test(digits)
}

export function normalizePhoneDigits(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2)
  }
  return digits
}

export function isValidPhoneValue(raw: unknown): boolean {
  const digits = normalizePhoneDigits(raw)
  return (digits.length === 10 || digits.length === 11) && !/^(\d)\1+$/.test(digits)
}

export function normalizeUrlValue(raw: unknown): string {
  return String(raw ?? '').trim()
}

export function isValidUrlValue(raw: unknown): boolean {
  const val = normalizeUrlValue(raw)
  if (!/^https?:\/\//i.test(val)) return false
  try {
    const parsed = new URL(val)
    return Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export function normalizeProtocolCode(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^#+/, '')
    .toUpperCase()
}

export function buildIdentifierKey(
  type: FormIdentifierType,
  rawValue: unknown
): { key: string; normalizedValue: string; valid: boolean } | null {
  if (type === 'email') {
    const normalizedValue = normalizeEmailValue(rawValue)
    if (!normalizedValue) return null
    return {
      key: `email:${normalizedValue}`,
      normalizedValue,
      valid: isValidEmailValue(normalizedValue),
    }
  }
  if (type === 'cpf') {
    const normalizedValue = normalizeCpfDigits(rawValue)
    if (!normalizedValue) return null
    return {
      key: `cpf:${normalizedValue}`,
      normalizedValue,
      valid: isValidCpfValue(normalizedValue),
    }
  }
  if (type === 'telefone') {
    const normalizedValue = normalizePhoneDigits(rawValue)
    if (!normalizedValue) return null
    return {
      key: `tel:${normalizedValue}`,
      normalizedValue,
      valid: isValidPhoneValue(normalizedValue),
    }
  }
  const normalizedValue = normalizeUrlValue(rawValue).toLowerCase()
  if (!normalizedValue) return null
  return {
    key: `url:${normalizedValue}`,
    normalizedValue,
    valid: isValidUrlValue(rawValue),
  }
}

/**
 * Resolve todos os campos do formulário configurados para identificação
 * (via validation.regexType ou autoFillUser === 'email', com fallback seguro por título).
 */
export function getFormIdentifierFields(form: GPForm): FormIdentifierField[] {
  const allFields = (form.sections || []).flatMap(s => s.fields || [])
  const explicit: FormIdentifierField[] = []

  for (const field of allFields) {
    const regexType = field.validation?.regexType
    if (regexType === 'email' || field.autoFillUser === 'email') {
      explicit.push({ field, type: 'email', label: field.title || 'E-mail' })
    } else if (regexType === 'cpf') {
      explicit.push({ field, type: 'cpf', label: field.title || 'CPF' })
    } else if (regexType === 'telefone') {
      explicit.push({ field, type: 'telefone', label: field.title || 'Telefone' })
    } else if (regexType === 'url') {
      explicit.push({ field, type: 'url', label: field.title || 'URL' })
    }
  }

  const hasExplicitEmail = explicit.some(item => item.type === 'email')
  const hasExplicitCpf = explicit.some(item => item.type === 'cpf')

  if (!hasExplicitEmail || !hasExplicitCpf) {
    for (const field of allFields) {
      if (field.type !== 'texto_curto' && field.type !== 'usuario_logado') continue
      if (explicit.some(item => item.field.id === field.id)) continue
      const title = String(field.title || '').trim()
      if (!hasExplicitEmail && /^(seu\s+)?e-?mail(\s+(pessoal|corporativo|de\s+contato))?$/i.test(title)) {
        explicit.push({ field, type: 'email', label: field.title || 'E-mail' })
      } else if (!hasExplicitCpf && /^(seu\s+)?cpf$/i.test(title)) {
        explicit.push({ field, type: 'cpf', label: field.title || 'CPF' })
      }
    }
  }

  return explicit.sort(
    (a, b) => IDENTIFIER_PRIORITY.indexOf(a.type) - IDENTIFIER_PRIORITY.indexOf(b.type)
  )
}

export function detectRespondentNameFromAnswers(
  form: GPForm,
  answers: Record<string, any>
): string {
  const allFields = (form.sections || []).flatMap(s => s.fields || [])
  const safeAnswers = answers || {}

  const readVal = (field: FormField): string => {
    const raw = safeAnswers[field.id]
    return typeof raw === 'string' ? raw.trim() : ''
  }

  // 1. Campo explícito de usuário logado / autoFill nome
  for (const field of allFields) {
    if (field.autoFillUser === 'nome' || field.type === 'usuario_logado') {
      const val = readVal(field)
      if (val) return val
    }
  }

  // 2. Título exato principal ("Nome completo", "Nome", "Seu nome")
  for (const field of allFields) {
    const title = String(field.title || '').trim()
    if (/^(nome(\s+completo)?|seu\s+nome|colaborador(a)?|participante)$/i.test(title)) {
      const val = readVal(field)
      if (val) return val
    }
  }

  // 3. Título contendo "nome", evitando campos secundários ("NOMES ACOMPANHANTES", "Nome da mãe")
  for (const field of allFields) {
    const title = String(field.title || '').trim()
    if (
      /nome/i.test(title) &&
      !/acompanhante|familiar|c[oô]njuge|filh|pai|m[aã]e|emerg[eê]ncia|indicad/i.test(title)
    ) {
      const val = readVal(field)
      if (val) return val
    }
  }

  return ''
}

/**
 * Extrai a identidade determinística do respondente a partir dos campos validados do formulário.
 */
export function extractFormIdentity(
  form: GPForm,
  answers: Record<string, any>
): ExtractedFormIdentity {
  const safeAnswers = answers || {}
  const identifierFields = getFormIdentifierFields(form)

  let respondentEmail = ''
  let respondentCpf = ''
  let respondentPhone = ''
  let respondentUrl = ''

  const keySet = new Set<string>()

  for (const { field, type } of identifierFields) {
    const rawVal = safeAnswers[field.id]
    const built = buildIdentifierKey(type, rawVal)
    if (!built || !built.valid) continue

    keySet.add(built.key)

    if (type === 'email' && !respondentEmail) {
      respondentEmail = built.normalizedValue
    } else if (type === 'cpf' && !respondentCpf) {
      respondentCpf = built.normalizedValue
    } else if (type === 'telefone' && !respondentPhone) {
      respondentPhone = built.normalizedValue
    } else if (type === 'url' && !respondentUrl) {
      respondentUrl = built.normalizedValue
    }
  }

  let primaryType: FormIdentifierType | null = null
  let primaryValue = ''
  let respondentId = ''

  if (respondentEmail) {
    primaryType = 'email'
    primaryValue = respondentEmail
    respondentId = `email:${respondentEmail}`
  } else if (respondentCpf) {
    primaryType = 'cpf'
    primaryValue = respondentCpf
    respondentId = `cpf:${respondentCpf}`
  } else if (respondentPhone) {
    primaryType = 'telefone'
    primaryValue = respondentPhone
    respondentId = `tel:${respondentPhone}`
  } else if (respondentUrl) {
    primaryType = 'url'
    primaryValue = respondentUrl
    respondentId = `url:${respondentUrl}`
  }

  const orderedKeys: string[] = []
  if (respondentEmail) orderedKeys.push(`email:${respondentEmail}`)
  if (respondentCpf) orderedKeys.push(`cpf:${respondentCpf}`)
  if (respondentPhone) orderedKeys.push(`tel:${respondentPhone}`)
  if (respondentUrl) orderedKeys.push(`url:${respondentUrl}`)
  for (const k of keySet) {
    if (!orderedKeys.includes(k)) orderedKeys.push(k)
  }

  return {
    respondentId,
    primaryType,
    primaryValue,
    respondentEmail,
    respondentCpf,
    respondentPhone,
    respondentUrl,
    respondentName: detectRespondentNameFromAnswers(form, safeAnswers),
    identifierKeys: orderedKeys,
  }
}

/**
 * Valida no servidor campos de identificação preenchidos (evita bypass direto via API).
 */
export function validateIdentifierAnswers(
  form: GPForm,
  answers: Record<string, any>
): { valid: boolean; fieldId?: string; message?: string } {
  const safeAnswers = answers || {}
  const allFields = (form.sections || []).flatMap(s => s.fields || [])

  for (const field of allFields) {
    const regexType = field.validation?.regexType
    if (!regexType || regexType === 'livre' || regexType === 'numero') continue

    const raw = safeAnswers[field.id]
    if (raw === undefined || raw === null || String(raw).trim() === '') continue

    if (regexType === 'email' && !isValidEmailValue(raw)) {
      return {
        valid: false,
        fieldId: field.id,
        message: `Informe um e-mail válido no campo "${field.title}".`,
      }
    }
    if (regexType === 'cpf' && !isValidCpfValue(raw)) {
      return {
        valid: false,
        fieldId: field.id,
        message: `Informe um CPF válido (11 dígitos) no campo "${field.title}".`,
      }
    }
    if (regexType === 'telefone' && !isValidPhoneValue(raw)) {
      return {
        valid: false,
        fieldId: field.id,
        message: `Informe um telefone válido com DDD no campo "${field.title}".`,
      }
    }
    if (regexType === 'url' && !isValidUrlValue(raw)) {
      return {
        valid: false,
        fieldId: field.id,
        message: `Informe um link válido (iniciando com http:// ou https://) no campo "${field.title}".`,
      }
    }
  }

  return { valid: true }
}

/**
 * Reúne todas as chaves determinísticas de uma resposta armazenada,
 * incluindo varredura das respostas preenchidas para compatibilidade retroativa
 * com respostas antigas (ex.: salvas antes como anon-* sem respondentEmail).
 */
export function collectResponseIdentifierKeys(
  form: GPForm,
  response: Partial<GPFormResponse> | null | undefined
): string[] {
  if (!response) return []
  const keys = new Set<string>()

  if (Array.isArray(response.identifierKeys)) {
    for (const k of response.identifierKeys) {
      const normalized = String(k || '').trim().toLowerCase()
      if (normalized) keys.add(normalized)
    }
  }

  const storedRespId = String(response.respondentId || '').trim()
  if (storedRespId) {
    if (
      storedRespId.startsWith('email:') ||
      storedRespId.startsWith('cpf:') ||
      storedRespId.startsWith('tel:') ||
      storedRespId.startsWith('url:') ||
      storedRespId.startsWith('uid:')
    ) {
      keys.add(storedRespId.toLowerCase())
    } else if (
      !storedRespId.startsWith('anon-') &&
      !storedRespId.startsWith('manual-') &&
      !storedRespId.startsWith('preview')
    ) {
      keys.add(`uid:${storedRespId.toLowerCase()}`)
    }
  }

  if (response.respondentUserId) {
    keys.add(`uid:${String(response.respondentUserId).trim().toLowerCase()}`)
  }

  if (response.respondentEmail && isValidEmailValue(response.respondentEmail)) {
    keys.add(`email:${normalizeEmailValue(response.respondentEmail)}`)
  }

  if (response.respondentCpf && isValidCpfValue(response.respondentCpf)) {
    keys.add(`cpf:${normalizeCpfDigits(response.respondentCpf)}`)
  }

  if (response.respondentPhone && isValidPhoneValue(response.respondentPhone)) {
    keys.add(`tel:${normalizePhoneDigits(response.respondentPhone)}`)
  }

  if (response.answers && typeof response.answers === 'object') {
    const fromAnswers = extractFormIdentity(form, response.answers)
    for (const k of fromAnswers.identifierKeys) {
      keys.add(k)
    }
  }

  return Array.from(keys)
}

export interface IdentityMatchCriteria {
  userId?: string | null
  userEmail?: string | null
  respondentId?: string | null
  identifierKeys?: string[]
  identifierType?: FormIdentifierType | null
  identifierValue?: string | null
}

export function doesResponseMatchIdentity(
  form: GPForm,
  response: Partial<GPFormResponse> | null | undefined,
  criteria: IdentityMatchCriteria
): boolean {
  if (!response) return false
  const targetKeys = new Set<string>()

  if (criteria.userId) {
    const uid = String(criteria.userId).trim().toLowerCase()
    if (uid) targetKeys.add(`uid:${uid}`)
  }

  if (criteria.userEmail && isValidEmailValue(criteria.userEmail)) {
    targetKeys.add(`email:${normalizeEmailValue(criteria.userEmail)}`)
  }

  if (criteria.respondentId) {
    const rid = String(criteria.respondentId).trim().toLowerCase()
    if (
      rid.startsWith('email:') ||
      rid.startsWith('cpf:') ||
      rid.startsWith('tel:') ||
      rid.startsWith('url:') ||
      rid.startsWith('uid:')
    ) {
      targetKeys.add(rid)
    } else if (
      rid &&
      !rid.startsWith('anon-') &&
      !rid.startsWith('manual-') &&
      !rid.startsWith('preview')
    ) {
      targetKeys.add(`uid:${rid}`)
    }
  }

  if (Array.isArray(criteria.identifierKeys)) {
    for (const k of criteria.identifierKeys) {
      const normalized = String(k || '').trim().toLowerCase()
      if (normalized) targetKeys.add(normalized)
    }
  }

  if (criteria.identifierType && criteria.identifierValue) {
    const built = buildIdentifierKey(criteria.identifierType, criteria.identifierValue)
    if (built?.valid) {
      targetKeys.add(built.key)
    }
  }

  if (targetKeys.size === 0) return false

  const responseKeys = collectResponseIdentifierKeys(form, response)
  return responseKeys.some(k => targetKeys.has(k))
}

export function maskIdentifierForUi(
  type: FormIdentifierType | null | undefined,
  value: string
): string {
  if (!value) return 'identificador cadastrado'
  if (type === 'email') {
    const [local, domain] = normalizeEmailValue(value).split('@')
    if (!domain) return '***'
    if (local.length <= 2) return `${local[0] || '*'}***@${domain}`
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`
  }
  if (type === 'cpf') {
    const d = normalizeCpfDigits(value)
    if (d.length !== 11) return '***.***.***-**'
    return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`
  }
  if (type === 'telefone') {
    const d = normalizePhoneDigits(value)
    if (d.length < 4) return '****'
    return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`
  }
  return value.length > 18 ? `${value.slice(0, 12)}...${value.slice(-4)}` : value
}

export function maskProtocolForUi(protocol: string | null | undefined): string {
  const norm = normalizeProtocolCode(protocol)
  if (!norm) return ''
  const parts = norm.split('-')
  if (parts.length === 3 && parts[2].length >= 2) {
    return `${parts[0]}-${parts[1]}-••••${parts[2].slice(-2)}`
  }
  return `${norm.slice(0, 5)}••••`
}

export function formatDisplayIdentifier(response: Partial<GPFormResponse>): string {
  if (response.respondentEmail) return response.respondentEmail
  if (response.respondentCpf && response.respondentCpf.length === 11) {
    const d = response.respondentCpf
    return `CPF ${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
  }
  const id = String(response.respondentId || '')
  if (id.startsWith('email:')) return id.slice(6)
  if (id.startsWith('cpf:')) {
    const d = id.slice(4)
    return d.length === 11
      ? `CPF ${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
      : `CPF ${d}`
  }
  if (id.startsWith('tel:')) return `Tel ${id.slice(4)}`
  return ''
}

export function sanitizeFormResponseForClient(response: GPFormResponse): GPFormResponse {
  const { editTokenHash: _removedHash, editTokenIssuedAt: _removedAt, ...safe } = response
  return safe
}
