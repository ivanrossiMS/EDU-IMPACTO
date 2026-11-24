import type { SupabaseClient } from '@supabase/supabase-js'
import { isCobrancaPaidStatus, normalizeIsoTimestamp } from '../cobrancasUtils'
import { buildCobrancaReceiptPath } from './receiptToken'

export interface MercadoPagoReceiptDetails {
  mpPaymentId: string
  status: string | null
  statusDetail: string | null
  paymentMethodId: string | null
  paymentTypeId: string | null
  installments: number | null
  cardLastFour: string | null
  authorizationCode: string | null
  transactionId: string | null
  payerBankName: string | null
  orderId: string | null
  totalPaidAmount: number | null
  netReceivedAmount: number | null
  dateApproved: string | null
  receiptUrl: string | null
}

interface CachedPaymentInfo {
  paidAt: string | null
  paymentMethod: string | null
  status: string | null
  receiptUrl: string | null
  details: MercadoPagoReceiptDetails | null
  expiresAt: number
}

const APPROVED_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h
const ERROR_CACHE_TTL_MS = 5 * 60 * 1000 // 5min
const mpPaymentCache = new Map<string, CachedPaymentInfo>()

function isNumericPaymentId(val: unknown): val is string {
  return typeof val === 'string' && /^\d+$/.test(val.trim())
}

export function extractMercadoPagoPaidAt(paymentData: any): string | null {
  if (!paymentData || paymentData.status !== 'approved') return null
  return normalizeIsoTimestamp(
    paymentData.date_approved || paymentData.date_last_updated || paymentData.date_created
  )
}

export async function fetchMercadoPagoPaymentInfo(
  paymentId: string,
  accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
): Promise<{
  paidAt: string | null
  paymentMethod: string | null
  status: string | null
  receiptUrl: string | null
  details: MercadoPagoReceiptDetails | null
} | null> {
  const cleanId = String(paymentId || '').trim()
  if (!isNumericPaymentId(cleanId) || !accessToken) return null

  const now = Date.now()
  const cached = mpPaymentCache.get(cleanId)
  if (cached && cached.expiresAt > now) {
    return {
      paidAt: cached.paidAt,
      paymentMethod: cached.paymentMethod,
      status: cached.status,
      receiptUrl: cached.receiptUrl,
      details: cached.details
    }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(cleanId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      mpPaymentCache.set(cleanId, {
        paidAt: null,
        paymentMethod: null,
        status: null,
        receiptUrl: null,
        details: null,
        expiresAt: now + ERROR_CACHE_TTL_MS
      })
      return null
    }

    const paymentData = await res.json()
    const paidAt = extractMercadoPagoPaidAt(paymentData)
    const paymentMethod = paymentData?.payment_method_id ? String(paymentData.payment_method_id) : null
    const status = paymentData?.status ? String(paymentData.status) : null
    const receiptUrl =
      paymentData?.transaction_details?.external_resource_url ||
      paymentData?.point_of_interaction?.transaction_data?.ticket_url ||
      null

    const details: MercadoPagoReceiptDetails = {
      mpPaymentId: cleanId,
      status,
      statusDetail: paymentData?.status_detail ? String(paymentData.status_detail) : null,
      paymentMethodId: paymentMethod,
      paymentTypeId: paymentData?.payment_type_id ? String(paymentData.payment_type_id) : null,
      installments: typeof paymentData?.installments === 'number' ? paymentData.installments : null,
      cardLastFour: paymentData?.card?.last_four_digits ? String(paymentData.card.last_four_digits) : null,
      authorizationCode: paymentData?.authorization_code ? String(paymentData.authorization_code) : null,
      transactionId:
        paymentData?.transaction_details?.transaction_id ||
        paymentData?.point_of_interaction?.transaction_data?.transaction_id ||
        null,
      payerBankName:
        paymentData?.point_of_interaction?.transaction_data?.bank_info?.payer?.long_name || null,
      orderId: paymentData?.order?.id ? String(paymentData.order.id) : null,
      totalPaidAmount:
        typeof paymentData?.transaction_details?.total_paid_amount === 'number'
          ? paymentData.transaction_details.total_paid_amount
          : typeof paymentData?.transaction_amount === 'number'
            ? paymentData.transaction_amount
            : null,
      netReceivedAmount:
        typeof paymentData?.transaction_details?.net_received_amount === 'number'
          ? paymentData.transaction_details.net_received_amount
          : null,
      dateApproved: paidAt,
      receiptUrl: receiptUrl ? String(receiptUrl) : null
    }

    mpPaymentCache.set(cleanId, {
      paidAt,
      paymentMethod,
      status,
      receiptUrl: details.receiptUrl,
      details,
      expiresAt: now + (paidAt ? APPROVED_CACHE_TTL_MS : ERROR_CACHE_TTL_MS)
    })

    return { paidAt, paymentMethod, status, receiptUrl: details.receiptUrl, details }
  } catch {
    mpPaymentCache.set(cleanId, {
      paidAt: null,
      paymentMethod: null,
      status: null,
      receiptUrl: null,
      details: null,
      expiresAt: now + ERROR_CACHE_TTL_MS
    })
    return null
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIdx = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++
      results[idx] = await worker(items[idx])
    }
  })

  await Promise.all(runners)
  return results
}

/**
 * Enriches paid `agenda_cobrancas_destinatarios` rows that are missing `paid_at`
 * by looking up their real `date_approved` on Mercado Pago.
 * If the `paid_at` column exists in Supabase, persists the backfilled timestamp.
 */
export async function enrichDestinatariosWithPaymentDates(
  destinatarios: any[],
  supabase?: SupabaseClient,
  options?: { persistToDb?: boolean }
): Promise<any[]> {
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return destinatarios
  }

  const persistToDb = options?.persistToDb !== false && Boolean(supabase)
  const hasPaidAtColumn = destinatarios.some(d => d && 'paid_at' in d)

  const candidates = destinatarios.filter(
    d =>
      d &&
      isCobrancaPaidStatus(d.status) &&
      !d.paid_at &&
      isNumericPaymentId(String(d.asaas_payment_id || '').trim())
  )

  if (candidates.length === 0) {
    return destinatarios.map(d =>
      d && isCobrancaPaidStatus(d.status) && d.id && !d.receipt_url
        ? { ...d, receipt_url: buildCobrancaReceiptPath(String(d.id)) }
        : d
    )
  }

  const resolvedById = new Map<
    string,
    { paidAt: string; paymentMethod: string | null; receiptUrl: string | null }
  >()

  await mapWithConcurrency(candidates, 6, async row => {
    const mpId = String(row.asaas_payment_id).trim()
    const info = await fetchMercadoPagoPaymentInfo(mpId)
    if (info?.paidAt) {
      resolvedById.set(String(row.id), {
        paidAt: info.paidAt,
        paymentMethod: info.paymentMethod,
        receiptUrl: info.receiptUrl
      })
    }
  })

  if (resolvedById.size === 0) {
    return destinatarios.map(d =>
      d && isCobrancaPaidStatus(d.status) && d.id && !d.receipt_url
        ? { ...d, receipt_url: buildCobrancaReceiptPath(String(d.id)) }
        : d
    )
  }

  // Persist backfilled paid_at in DB when column exists so future reads are DB-only
  if (persistToDb && supabase && hasPaidAtColumn) {
    const entries = Array.from(resolvedById.entries())
    await mapWithConcurrency(entries, 6, async ([rowId, info]) => {
      try {
        await supabase
          .from('agenda_cobrancas_destinatarios')
          .update({ paid_at: info.paidAt })
          .eq('id', rowId)
          .is('paid_at', null)
      } catch {
        // Ignore if schema cache hasn't refreshed yet
      }
    })
  }

  return destinatarios.map(d => {
    const match = d?.id ? resolvedById.get(String(d.id)) : undefined
    const isPaid = d && isCobrancaPaidStatus(d.status)
    const receiptPath = isPaid && d?.id ? buildCobrancaReceiptPath(String(d.id)) : undefined
    if (!match) {
      return receiptPath && !d.receipt_url ? { ...d, receipt_url: receiptPath } : d
    }
    return {
      ...d,
      paid_at: match.paidAt,
      ...(match.paymentMethod && !d.payment_method ? { payment_method: match.paymentMethod } : {}),
      ...(match.receiptUrl ? { mp_receipt_url: match.receiptUrl } : {}),
      ...(receiptPath ? { receipt_url: receiptPath } : {})
    }
  })
}

/**
 * Reconciles pending recipients that already have a payment link (`url_pagamento`)
 * against Mercado Pago search API, recovering any missed webhook notifications.
 */
export async function reconcilePendingMercadoPagoPayments(
  destinatarios: any[],
  cobrancasById: Map<string, any>,
  supabase: SupabaseClient
): Promise<any[]> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken || !Array.isArray(destinatarios) || destinatarios.length === 0) {
    return destinatarios
  }

  const pendingWithLinks = destinatarios.filter(
    d => d && !isCobrancaPaidStatus(d.status) && Boolean(d.url_pagamento)
  )

  if (pendingWithLinks.length === 0 || pendingWithLinks.length > 50) {
    return destinatarios
  }

  const updates = new Map<string, { status: string; asaas_payment_id: string; paid_at: string }>()

  await mapWithConcurrency(pendingWithLinks, 4, async row => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(String(row.id))}&status=approved&sort=date_approved&criteria=desc`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal
        }
      )
      clearTimeout(timer)
      if (!res.ok) return

      const json = await res.json()
      const approvedPayment = Array.isArray(json?.results) ? json.results[0] : null
      if (!approvedPayment || approvedPayment.status !== 'approved') return

      const cob = cobrancasById.get(String(row.cobranca_id))
      if (cob && Number(approvedPayment.transaction_amount) < Number(cob.valor) - 0.05) {
        return
      }

      const paidAt = extractMercadoPagoPaidAt(approvedPayment) || new Date().toISOString()
      const paymentIdStr = String(approvedPayment.id)

      const payload: Record<string, any> = {
        status: 'RECEIVED',
        asaas_payment_id: paymentIdStr
      }
      if ('paid_at' in row) payload.paid_at = paidAt
      if ('updated_at' in row) payload.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .update(payload)
        .eq('id', row.id)

      if (error && (payload.paid_at || payload.updated_at)) {
        await supabase
          .from('agenda_cobrancas_destinatarios')
          .update({ status: 'RECEIVED', asaas_payment_id: paymentIdStr })
          .eq('id', row.id)
      }

      updates.set(String(row.id), {
        status: 'RECEIVED',
        asaas_payment_id: paymentIdStr,
        paid_at: paidAt
      })
    } catch {
      // Non-fatal
    }
  })

  if (updates.size === 0) return destinatarios

  return destinatarios.map(d => {
    const upd = d?.id ? updates.get(String(d.id)) : undefined
    return upd ? { ...d, ...upd } : d
  })
}
