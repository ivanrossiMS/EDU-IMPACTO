import { createHmac, timingSafeEqual } from 'crypto'

function getSigningSecret(): string {
  return (
    process.env.RECEIPT_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    'impacto-edu-receipt-fallback-secret'
  )
}

export function signCobrancaReceiptToken(destinatarioId: string): string {
  const cleanId = String(destinatarioId || '').trim()
  return createHmac('sha256', getSigningSecret())
    .update(`cobranca_receipt:${cleanId}`)
    .digest('hex')
    .slice(0, 32)
}

export function verifyCobrancaReceiptToken(destinatarioId: string, token: string | null | undefined): boolean {
  const cleanId = String(destinatarioId || '').trim()
  const cleanToken = String(token || '').trim()
  if (!cleanId || !cleanToken) return false

  const expected = signCobrancaReceiptToken(cleanId)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(cleanToken, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function buildCobrancaReceiptPath(destinatarioId: string): string {
  const cleanId = String(destinatarioId || '').trim()
  const sig = signCobrancaReceiptToken(cleanId)
  return `/recibo/cobranca/${encodeURIComponent(cleanId)}?sig=${sig}`
}
