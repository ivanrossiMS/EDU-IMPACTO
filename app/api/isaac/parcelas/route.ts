/**
 * app/api/isaac/parcelas/route.ts
 *
 * Busca as parcelas/faturas de um responsável no Isaac Escola.
 *
 * Estratégia: Fetch paralelo de TODAS as páginas da API do Isaac,
 * filtrando pelo guardian.external_id do responsável. Isso garante
 * que qualquer responsável seja encontrado independente da posição.
 *
 * GET /api/isaac/parcelas?ano=2026&responsavelId=216736
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import {
  isaacRequest,
  formatIsaacAmount,
  getEffectiveAmount,
  type IsaacInstallment,
} from '@/lib/isaac'

export const dynamic = 'force-dynamic'

const PER_PAGE = 200   // máximo que a API Isaac aceita
const MAX_PARALLEL = 10 // requests simultâneos por batch

/**
 * Busca TODAS as parcelas de um guardian em paralelo,
 * varrendo todas as páginas da API Isaac.
 */
async function fetchAllPagesForGuardian(
  guardianExternalId: string,
  ano: string
): Promise<IsaacInstallment[]> {
  // Página 1 → descobre o total de registros
  const firstPage = await isaacRequest<any>(
    `/consolidated-installments?page=1&per_page=${PER_PAGE}&reference_year=${ano}&include_active_receivables=true`
  )
  const totalItems: number = firstPage?.pagination?.total ?? 0
  const firstItems: IsaacInstallment[] = firstPage?.data?.items ?? []
  const totalPages = Math.ceil(totalItems / PER_PAGE)

  console.log(`[Isaac] Ano ${ano}: ${totalItems} faturas totais | ${totalPages} páginas`)

  const rawItems: IsaacInstallment[] = firstItems.filter(
    (i) => i.guardian?.external_id === guardianExternalId
  )

  // Busca páginas restantes (de 2 até totalPages) em batches paralelos
  if (totalPages > 1) {
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)

    for (let i = 0; i < remainingPages.length; i += MAX_PARALLEL) {
      const batch = remainingPages.slice(i, i + MAX_PARALLEL)

      const results = await Promise.allSettled(
        batch.map((page) =>
          isaacRequest<any>(
            `/consolidated-installments?page=${page}&per_page=${PER_PAGE}&reference_year=${ano}&include_active_receivables=true`
          )
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const items: IsaacInstallment[] = result.value?.data?.items ?? []
          const filtered = items.filter(
            (i) => i.guardian?.external_id === guardianExternalId
          )
          rawItems.push(...filtered)
        }
      }
    }
  }

  // Deduplicação estrita por ID único da parcela
  const uniqueMap = new Map<string, IsaacInstallment>()
  for (const item of rawItems) {
    if (item.id && !uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item)
    }
  }

  const allItems = Array.from(uniqueMap.values())
  console.log(`[Isaac] Parcelas únicas do guardian ${guardianExternalId}: ${allItems.length}`)
  return allItems
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  const { searchParams } = new URL(request.url)

  const responsavelIdParam = searchParams.get('responsavelId')
  const ano = searchParams.get('ano') || new Date().getFullYear().toString()

  // ── Descobrir o guardian external_id ──────────────────────────────────────
  // Ordem de prioridade:
  // 1. responsavel_id do user_metadata → login de família (zero queries extras)
  // 2. responsavelId param → admin espelhando
  // 3. Busca por email no Supabase → fallback

  let guardianExternalId = responsavelIdParam

  if (!guardianExternalId) {
    const metaRespId = user?.user_metadata?.responsavel_id
    if (metaRespId) {
      guardianExternalId = String(metaRespId)
    }
  }

  if (!guardianExternalId) {
    if (!user?.email) {
      return NextResponse.json(
        { error: 'Email do usuário não encontrado.' },
        { status: 400 }
      )
    }

    const { data: resp, error: respError } = await supabase
      .from('responsaveis')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (respError) {
      return NextResponse.json({ error: respError.message }, { status: 500 })
    }

    if (!resp) {
      return NextResponse.json(
        { error: 'Responsável não encontrado para este e-mail.', notFound: true },
        { status: 404 }
      )
    }

    guardianExternalId = String(resp.id)
  }

  console.log(`[Isaac] Guardian: ${guardianExternalId} | Ano: ${ano}`)

  try {
    // ── Fetch paralelo de todas as páginas ────────────────────────────────────
    const allItems = await fetchAllPagesForGuardian(guardianExternalId, ano)

    // ── Ordenação por status e vencimento ─────────────────────────────────────
    const now = new Date()
    const statusOrder: Record<string, number> = {
      OVERDUE: 0,
      OPEN: 1,
      PAID: 2,
      AGGLUTINATED: 3,
      RENEGOTIATED: 4,
      CANCELED: 5,
    }

    allItems.sort((a, b) => {
      const isAOverdue = a.status === 'OPEN' && new Date(a.due_date) < now
      const isBOverdue = b.status === 'OPEN' && new Date(b.due_date) < now
      const aKey = isAOverdue ? 'OVERDUE' : a.status
      const bKey = isBOverdue ? 'OVERDUE' : b.status
      const orderDiff = (statusOrder[aKey] ?? 9) - (statusOrder[bKey] ?? 9)
      if (orderDiff !== 0) return orderDiff
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

    // ── Resumo financeiro ─────────────────────────────────────────────────────
    const emAberto = allItems.filter((i) => i.status === 'OPEN' || i.status === 'OVERDUE')
    const vencidas = allItems.filter(
      (i) => i.status === 'OPEN' && new Date(i.due_date) < now
    )
    const pagas = allItems.filter((i) => i.status === 'PAID')

    const totalEmAberto = emAberto.reduce((s, i) => s + getEffectiveAmount(i), 0)
    const totalVencido = vencidas.reduce((s, i) => s + getEffectiveAmount(i), 0)
    const totalPago = pagas.reduce((s, i) => s + (i.paid_value || 0), 0)

    const proximoVencimento = allItems
      .filter((i) => i.status === 'OPEN' && new Date(i.due_date) >= now)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]

    const summary = {
      totalEmAberto,
      totalEmAbertoFormatado: formatIsaacAmount(totalEmAberto),
      totalVencido,
      totalVencidoFormatado: formatIsaacAmount(totalVencido),
      totalPago,
      totalPagoFormatado: formatIsaacAmount(totalPago),
      quantidadeEmAberto: emAberto.length,
      quantidadeVencidas: vencidas.length,
      quantidadePagas: pagas.length,
      proximoVencimento: proximoVencimento
        ? {
            valor: formatIsaacAmount(getEffectiveAmount(proximoVencimento)),
            data: proximoVencimento.due_date,
            descricao: proximoVencimento.description,
          }
        : null,
      isAdimplente: vencidas.length === 0,
    }

    // ── Mapear para o frontend ────────────────────────────────────────────────
    const parcelas = allItems.map((item) => {
      const isItemOverdue = item.status === 'OPEN' && new Date(item.due_date) < now
      return {
        id: item.id,
        descricao: item.description,
        tipo: item.type,
        status: isItemOverdue ? 'OVERDUE' : item.status,
        vencimento: item.due_date,
        dataPagamento: item.paid_date,
        competencia: item.competence_date,
        anoReferencia: item.reference_year,
        valorBase: item.base_amount,
        valorEfetivo: getEffectiveAmount(item),
        valorPago: item.paid_value,
        valorFormatado: formatIsaacAmount(getEffectiveAmount(item)),
        valorPagoFormatado: formatIsaacAmount(item.paid_value || 0),
        valorBaseFormatado: formatIsaacAmount(item.base_amount),
        descontos: item.discounts.map((d) => ({
          valor: formatIsaacAmount(d.amount),
          descricao: d.description,
        })),
        aluno: item.student?.name || '',
        alunoId: item.student?.external_id || '',
        responsavel: item.guardian?.name || '',
        multa: item.late_payment_fee_paid,
        juros: item.late_payment_interest_paid,
        multaFormatado: formatIsaacAmount(item.late_payment_fee_paid || 0),
        jurosFormatado: formatIsaacAmount(item.late_payment_interest_paid || 0),
        receivables: item.active_receivables,
        contractId: item.contract_id,
      }
    })

    return NextResponse.json({ parcelas, summary, guardianId: guardianExternalId, ano })
  } catch (err: any) {
    console.error('[isaac/parcelas] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
