/**
 * lib/server/firstAccessSecurity.ts
 *
 * Módulo Criptográfico e de Segurança para o Primeiro Acesso (Criação de Senha).
 * Fornece tokens assinados com HMAC-SHA256 (stateless, sem dependência de tabelas temporárias),
 * controle de expiração, limitação de tentativas (anti-bruteforce) e mascaramento de e-mails.
 */

import crypto from 'crypto'

const HMAC_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXTAUTH_SECRET ||
  'impacto-edu-first-access-secret-key-2026'

const OTP_EXPIRATION_MS = 15 * 60 * 1000 // 15 minutos
const CREATION_TOKEN_EXPIRATION_MS = 15 * 60 * 1000 // 15 minutos para definir a senha após OTP validado
const MAX_ATTEMPTS = 5

export interface FirstAccessUserPayload {
  userId: string
  realId: string
  nome: string
  email: string
  cargo?: string
  perfil?: string
  userType: 'aluno' | 'responsavel' | 'system_user'
  matricula?: string
  isParentEmail?: boolean
  parentName?: string
}

interface OtpTokenPayload {
  user: FirstAccessUserPayload
  salt: string
  otpHash: string
  expiresAt: number
  attempts: number
}

export interface CreationTokenPayload {
  user: FirstAccessUserPayload
  verifiedAt: number
  expiresAt: number
}

/**
 * Mascara o e-mail para exibição segura na interface (ex: iv***@gmail.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'seu e-mail cadastrado'
  const [local, domain] = email.split('@')
  if (local.length <= 2) {
    return `${local}***@${domain}`
  }
  const start = local.slice(0, 2)
  const end = local.length > 4 ? local.slice(-1) : ''
  return `${start}***${end}@${domain}`
}

/**
 * Calcula o HMAC SHA-256 de uma string usando o segredo do servidor
 */
function createSignature(data: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex')
}

/**
 * Verifica com segurança contra timing attacks se a assinatura é válida
 */
function verifySignature(data: string, signature: string): boolean {
  const expected = createSignature(data)
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

/**
 * Serializa um payload com assinatura HMAC (formato: base64url.signature)
 */
function signPayload<T>(payload: T): string {
  const jsonStr = JSON.stringify(payload)
  const encoded = Buffer.from(jsonStr, 'utf8').toString('base64url')
  const sig = createSignature(encoded)
  return `${encoded}.${sig}`
}

/**
 * Desserializa e valida a integridade da assinatura
 */
function parseSignedPayload<T>(token: string): T | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null
  if (!verifySignature(encoded, sig)) return null

  try {
    const jsonStr = Buffer.from(encoded, 'base64url').toString('utf8')
    return JSON.parse(jsonStr) as T
  } catch {
    return null
  }
}

/**
 * Calcula o hash do código OTP com o salt único e o segredo interno do servidor
 */
function hashOtp(code: string, salt: string): string {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${code.trim()}:${salt}`)
    .digest('hex')
}

/**
 * Gera um novo código OTP numérico de 6 dígitos e o token assinado associado
 */
export function generateFirstAccessOtp(user: FirstAccessUserPayload): {
  otpCode: string
  otpToken: string
  expiresAt: number
} {
  // Gera código aleatório criptograficamente seguro entre 100000 e 999999
  const otpCode = String(crypto.randomInt(100000, 999999))
  const salt = crypto.randomBytes(16).toString('hex')
  const otpHash = hashOtp(otpCode, salt)
  const expiresAt = Date.now() + OTP_EXPIRATION_MS

  const payload: OtpTokenPayload = {
    user,
    salt,
    otpHash,
    expiresAt,
    attempts: 0,
  }

  const otpToken = signPayload(payload)

  return {
    otpCode,
    otpToken,
    expiresAt,
  }
}

/**
 * Valida o código OTP informado pelo usuário
 */
export function verifyFirstAccessOtp(
  otpToken: string,
  providedCode: string
): {
  success: boolean
  error?: string
  remainingAttempts?: number
  nextOtpToken?: string
  creationToken?: string
  user?: FirstAccessUserPayload
} {
  const payload = parseSignedPayload<OtpTokenPayload>(otpToken)

  if (!payload) {
    return {
      success: false,
      error: 'Sessão de verificação inválida ou expirada. Solicite um novo código.',
    }
  }

  if (Date.now() > payload.expiresAt) {
    return {
      success: false,
      error: 'O código de verificação expirou (validade: 15 minutos). Solicite um novo código.',
    }
  }

  if (payload.attempts >= MAX_ATTEMPTS) {
    return {
      success: false,
      error: 'Limite de tentativas excedido por segurança. Solicite um novo código.',
      remainingAttempts: 0,
    }
  }

  const cleanCode = (providedCode || '').replace(/\D/g, '')
  if (cleanCode.length !== 6) {
    return {
      success: false,
      error: 'O código deve conter exatamente 6 dígitos numéricos.',
    }
  }

  const computedHash = hashOtp(cleanCode, payload.salt)
  const isMatch =
    computedHash.length === payload.otpHash.length &&
    crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(payload.otpHash, 'hex'))

  if (!isMatch) {
    const nextAttempts = payload.attempts + 1
    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - nextAttempts)

    const updatedPayload: OtpTokenPayload = {
      ...payload,
      attempts: nextAttempts,
    }
    const nextOtpToken = signPayload(updatedPayload)

    return {
      success: false,
      error:
        remainingAttempts > 0
          ? `Código incorreto. Você tem mais ${remainingAttempts} tentativa${remainingAttempts === 1 ? '' : 's'}.`
          : 'Limite de tentativas excedido. Solicite um novo código.',
      remainingAttempts,
      nextOtpToken,
    }
  }

  // OTP validado com sucesso! Gera o creationToken de uso único
  const creationPayload: CreationTokenPayload = {
    user: payload.user,
    verifiedAt: Date.now(),
    expiresAt: Date.now() + CREATION_TOKEN_EXPIRATION_MS,
  }

  const creationToken = signPayload(creationPayload)

  return {
    success: true,
    creationToken,
    user: payload.user,
  }
}

/**
 * Valida o creationToken antes de persistir a nova senha
 */
export function verifyCreationToken(creationToken: string): {
  valid: boolean
  user?: FirstAccessUserPayload
  error?: string
} {
  const payload = parseSignedPayload<CreationTokenPayload>(creationToken)

  if (!payload) {
    return {
      valid: false,
      error: 'Token de autorização inválido ou expirado. Reinicie o Primeiro Acesso.',
    }
  }

  if (Date.now() > payload.expiresAt) {
    return {
      valid: false,
      error: 'O tempo limite para criação da senha expirou (15 minutos). Reinicie o processo.',
    }
  }

  return {
    valid: true,
    user: payload.user,
  }
}
