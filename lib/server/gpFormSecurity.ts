import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { calculateSha256 } from '@/lib/contracts/cryptoSignature'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

const EDIT_COOKIE_PREFIX = 'gp_fedit_'
const RECOVERY_KEY_PREFIX = 'gp_form_recovery_'
const OTP_TTL_MS = 15 * 60 * 1000 // 15 min
const OTP_RESEND_COOLDOWN_MS = 30 * 1000 // 30s
const MAX_VERIFICATION_ATTEMPTS = 5
const EDIT_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 dias

export interface RecoveryAttemptRecord {
  identifierKey: string
  otpHash?: string
  otpExpiresAt?: number
  otpLastSentAt?: number
  failedAttempts: number
  windowStartedAt: number
}

function safeCookieSuffix(formId: string): string {
  return String(formId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80)
}

export function getFormEditCookieName(formId: string): string {
  return `${EDIT_COOKIE_PREFIX}${safeCookieSuffix(formId)}`
}

export function generateFormEditToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(24).toString('hex')
  const tokenHash = calculateSha256(rawToken)
  return { rawToken, tokenHash }
}

export function verifyFormEditToken(
  rawToken: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!rawToken || !storedHash) return false
  const candidateHash = calculateSha256(String(rawToken).trim())
  const normalizedStored = String(storedHash).trim().toUpperCase()
  if (candidateHash.length !== normalizedStored.length) return false
  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'utf8'),
      Buffer.from(normalizedStored, 'utf8')
    )
  } catch {
    return false
  }
}

export function readEditCookieToken(
  req: Request,
  formId: string
): { responseId: string; editToken: string } | null {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    if (!cookieHeader) return null
    const targetName = getFormEditCookieName(formId)
    const parts = cookieHeader.split(';')
    for (const part of parts) {
      const eqIdx = part.indexOf('=')
      if (eqIdx === -1) continue
      const name = part.slice(0, eqIdx).trim()
      if (name !== targetName) continue
      const rawVal = decodeURIComponent(part.slice(eqIdx + 1).trim())
      const colonIdx = rawVal.indexOf(':')
      if (colonIdx === -1) return null
      const responseId = rawVal.slice(0, colonIdx).trim()
      const editToken = rawVal.slice(colonIdx + 1).trim()
      if (!responseId || !editToken) return null
      return { responseId, editToken }
    }
  } catch {
    return null
  }
  return null
}

export function attachEditCookieHeader(
  res: NextResponse,
  formId: string,
  responseId: string,
  rawToken: string
): void {
  const name = getFormEditCookieName(formId)
  const value = `${responseId}:${rawToken}`
  res.cookies.set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: EDIT_COOKIE_MAX_AGE_SECONDS,
  })
}

export function clearEditCookieHeader(res: NextResponse, formId: string): void {
  const name = getFormEditCookieName(formId)
  res.cookies.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export async function loadFormRecoveryMap(
  formId: string
): Promise<Record<string, RecoveryAttemptRecord>> {
  const supabase = getAdminClient()
  const key = `${RECOVERY_KEY_PREFIX}${formId}`
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', key)
    .maybeSingle()

  if (error || !data || !data.valor || typeof data.valor !== 'object' || Array.isArray(data.valor)) {
    return {}
  }

  const now = Date.now()
  const cleaned: Record<string, RecoveryAttemptRecord> = {}
  for (const [k, rec] of Object.entries(data.valor as Record<string, RecoveryAttemptRecord>)) {
    if (!rec) continue
    const stillValidOtp = Boolean(rec.otpExpiresAt && rec.otpExpiresAt > now)
    const stillValidWindow = Boolean(rec.windowStartedAt && now - rec.windowStartedAt < OTP_TTL_MS * 2)
    if (stillValidOtp || stillValidWindow) {
      cleaned[k] = rec
    }
  }
  return cleaned
}

export async function saveFormRecoveryMap(
  formId: string,
  records: Record<string, RecoveryAttemptRecord>
): Promise<void> {
  const supabase = getAdminClient()
  const key = `${RECOVERY_KEY_PREFIX}${formId}`
  const { error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: key,
        valor: records,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chave' }
    )
  if (error) {
    throw new Error(error.message)
  }
}

export function canSendRecoveryOtp(record?: RecoveryAttemptRecord): {
  allowed: boolean
  retryAfterSeconds?: number
} {
  if (!record?.otpLastSentAt) return { allowed: true }
  const elapsed = Date.now() - record.otpLastSentAt
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000),
    }
  }
  return { allowed: true }
}

export function isRecoveryLockedOut(record?: RecoveryAttemptRecord): boolean {
  if (!record) return false
  if (Date.now() - (record.windowStartedAt || 0) > OTP_TTL_MS) return false
  return (record.failedAttempts || 0) >= MAX_VERIFICATION_ATTEMPTS
}

export function getRecoveryConstants() {
  return {
    OTP_TTL_MS,
    OTP_RESEND_COOLDOWN_MS,
    MAX_VERIFICATION_ATTEMPTS,
  }
}
