export const COBRANCA_PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'PAID', 'PAGO'])

export function isCobrancaPaidStatus(status: unknown): boolean {
  return COBRANCA_PAID_STATUSES.has(String(status || '').trim().toUpperCase())
}

export function normalizeIsoTimestamp(raw: unknown): string | null {
  if (!raw) return null
  const str = String(raw).trim()
  if (!str) return null
  const d = new Date(str)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * Resolves the real payment timestamp for a recipient row.
 * Never falls back to `created_at` (send date) or generic `updated_at`,
 * because link generation or recipient updates would masquerade as payment dates.
 */
export function resolveCobrancaPaymentTimestamp(dest: any): string | null {
  if (!dest || !isCobrancaPaidStatus(dest.status)) return null
  return normalizeIsoTimestamp(dest.paid_at || dest.data_pagamento || null)
}

export function formatCobrancaDatePtBr(raw: unknown): string | null {
  const iso = normalizeIsoTimestamp(raw)
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatCobrancaDateTimePtBr(raw: unknown): string | null {
  const iso = normalizeIsoTimestamp(raw)
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}
