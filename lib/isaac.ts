/**
 * lib/isaac.ts
 * Cliente HTTP seguro para a API do Isaac Escola.
 * Executa EXCLUSIVAMENTE no servidor (Next.js API Routes / Server Actions).
 * A ISAAC_API_KEY nunca é exposta ao browser.
 */

const ISAAC_API_URL = process.env.ISAAC_API_URL || 'https://api.olaisaac.io/v2'
const ISAAC_API_KEY = process.env.ISAAC_API_KEY

// ─── Types ──────────────────────────────────────────────────────────────────

export type IsaacInstallmentStatus =
  | 'OPEN'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELED'
  | 'AGGLUTINATED'
  | 'RENEGOTIATED'

export interface IsaacDiscount {
  days_before_due_date: number
  amount: number
  description: string
  internal_discount: boolean
}

export interface IsaacInstallment {
  id: string
  created_at: string
  updated_at: string
  external_id: string
  description: string
  type: 'TUITION' | 'ENROLLMENT' | 'MATERIAL' | 'OTHER'
  base_amount: number
  due_date: string
  paid_date: string | null
  competence_date: string
  amount_including_scholarship: number
  payable_amount: number
  minimum_amount: number
  reference_year: string
  penalty_and_interest_paid: number
  paid_value: number
  late_payment_fee_paid: number
  late_payment_interest_paid: number
  discounts: IsaacDiscount[]
  status: IsaacInstallmentStatus
  status_details: any
  school_id: string
  contract_id: string
  product: { id: string; external_id: string }
  guardian: {
    id: string
    name: string
    tax_id: string
    external_id: string
  }
  student: {
    id: string
    name: string
    external_id: string
  }
  active_receivables: IsaacReceivable[] | null
  academic_period: string
  accrual_scope: string
}

export interface IsaacReceivable {
  id: string
  checkout_url?: string
  bank_slip_url?: string
  pix_qr_code?: string
  pix_key?: string
  due_date?: string
  paid_date?: string | null
  amount?: number
  status?: string
  payment_source?: string | null
  payment_method?: string | null
}

export interface IsaacListResponse<T> {
  data: { items: T[] }
  pagination: {
    per_page: number
    page: number
    total: number
  }
}

// ─── Core Request ────────────────────────────────────────────────────────────

export async function isaacRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, any>
): Promise<T> {
  const apiKey = process.env.ISAAC_API_KEY || ISAAC_API_KEY
  const apiUrl = process.env.ISAAC_API_URL || ISAAC_API_URL || 'https://api.olaisaac.io/v2'

  if (!apiKey) {
    throw new Error('ISAAC_API_KEY não configurada no ambiente do servidor.')
  }

  const url = `${apiUrl}${endpoint}`

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    // Sem cache — dados financeiros devem ser sempre frescos
    cache: 'no-store',
  }

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    let message = `Isaac API Error ${response.status}: ${response.statusText}`
    try {
      const errData = await response.json()
      if (errData?.errors?.length) {
        message = errData.errors.map((e: any) => e.message || e.description).join(', ')
      }
    } catch {}
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

// ─── Domain Helpers ──────────────────────────────────────────────────────────

export interface FetchInstallmentsParams {
  /** ID do responsável no Supabase (= external_id do guardian no Isaac) */
  guardianExternalId: string
  /** Filtro de status. Omitir = todos */
  status?: IsaacInstallmentStatus | IsaacInstallmentStatus[]
  /** Ano de referência (ex: "2026") */
  referenceYear?: string
  page?: number
  perPage?: number
}

/**
 * Busca as parcelas/faturas de um responsável específico.
 * Filtragem por guardian.external_id (= id na tabela responsaveis do Supabase).
 */
export async function fetchInstallmentsByGuardian(
  params: FetchInstallmentsParams
): Promise<IsaacListResponse<IsaacInstallment>> {
  const {
    guardianExternalId,
    status,
    referenceYear,
    page = 0,
    perPage = 100,
  } = params

  const qs = new URLSearchParams()
  qs.set('page', String(page))
  qs.set('per_page', String(perPage))

  if (referenceYear) qs.set('reference_year', referenceYear)

  // Isaac aceita múltiplos status via query repetida: ?status=OPEN&status=OVERDUE
  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    statuses.forEach((s) => qs.append('status', s))
  }

  const result = await isaacRequest<IsaacListResponse<IsaacInstallment>>(
    `/consolidated-installments?${qs.toString()}`
  )

  // Filtra client-side pelo guardian.external_id (a API não aceita esse filtro direto)
  if (result?.data?.items) {
    result.data.items = result.data.items.filter(
      (item) => item.guardian?.external_id === guardianExternalId
    )
  }

  return result
}

// ─── Formatting Utilities ────────────────────────────────────────────────────

/** Converte centavos (int) em reais formatados: ex. 169500 → "R$ 1.695,00" */
export function formatIsaacAmount(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

/** Retorna o valor efetivo a pagar (payable_amount ou minimum_amount) em centavos */
export function getEffectiveAmount(installment: IsaacInstallment): number {
  return installment.payable_amount > 0
    ? installment.payable_amount
    : installment.minimum_amount
}
