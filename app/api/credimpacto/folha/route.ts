import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import {
  dbGetParcelasFolha,
  dbConciliarParcelasLote,
  dbEstornarParcelasLote
} from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import { roundMoney } from '@/lib/credimpacto/engine'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const competencia = searchParams.get('competencia') || undefined
    const resolved = await resolveCredImpactoUser(user)

    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Acesso restrito ao setor financeiro.' }, { status: 403 })
    }

    const parcelas = await dbGetParcelasFolha(competencia === 'todas' ? undefined : competencia)

    // Agrupamento de totais da competência
    const totalPrevisto = roundMoney(parcelas.reduce((acc, p) => acc + (p.valorTotal || 0), 0))
    const parcelasPagas = parcelas.filter((p) => p.status === 'descontada' || p.status === 'paga_avulso')
    const totalDescontado = roundMoney(parcelasPagas.reduce((acc, p) => acc + (p.valorPago || p.valorTotal || 0), 0))
    const totalPendente = roundMoney(Math.max(0, totalPrevisto - totalDescontado))
    const colaboradoresUnicos = new Set(parcelas.map((p) => p.colaboradorCpf)).size

    return NextResponse.json({
      competencia: competencia || 'todas',
      totalPrevisto,
      totalDescontado,
      totalPendente,
      quantidadeParcelas: parcelas.length,
      quantidadePagas: parcelasPagas.length,
      quantidadeColaboradores: colaboradoresUnicos,
      parcelas
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar parcelas da folha' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Apenas usuários do setor financeiro podem conciliar parcelas.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      parcelaId,
      parcelaIds,
      valorPago,
      modoValor = 'integral',
      metodoPagamento = 'folha_pagamento',
      dataPagamento,
      comprovanteUrl,
      observacao,
      loteFolhaId
    } = body

    const targetIds: string[] = Array.isArray(parcelaIds) && parcelaIds.length > 0
      ? parcelaIds
      : parcelaId
        ? [parcelaId]
        : []

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Informe ao menos uma parcela a ser baixada.' }, { status: 400 })
    }

    const resLote = await dbConciliarParcelasLote(
      targetIds,
      {
        valorPago: valorPago !== undefined && valorPago !== '' ? Number(valorPago) : undefined,
        modoValor,
        metodoPagamento,
        dataPagamento,
        comprovanteUrl,
        observacao:
          observacao ||
          (targetIds.length > 1 && loteFolhaId
            ? `Conciliação em lote (Lote: ${loteFolhaId})`
            : undefined),
        loteFolhaId
      },
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil }
    )

    const { notifyCredImpactoEvent } = await import('@/lib/credimpacto/pushNotifications')

    // Agrupa notificações por empréstimo para não disparar múltiplos pushes repetidos ao mesmo colaborador
    const byLoan = new Map<string, { loan: typeof resLote.emprestimosAtualizados[0]; parcelas: typeof resLote.parcelasBaixadas }>()
    for (const item of resLote.parcelasBaixadas) {
      const entry = byLoan.get(item.emprestimo.id) || { loan: item.emprestimo, parcelas: [] }
      entry.parcelas.push(item)
      byLoan.set(item.emprestimo.id, entry)
    }

    for (const { loan, parcelas } of byLoan.values()) {
      const firstParcela = parcelas[0].parcela
      const totalValorBaixado = roundMoney(
        parcelas.reduce((acc, p) => acc + (p.parcela.valorPago || p.parcela.valorTotal || 0), 0)
      )
      await notifyCredImpactoEvent({
        eventType: loan.status === 'quitado' ? 'quitacao_confirmada' : 'parcela_conciliada',
        loan,
        targetRoles: ['colaborador'],
        sentByNome: resolved.nome,
        extra: {
          parcelaNumero: firstParcela.numero,
          competencia:
            parcelas.length === 1
              ? firstParcela.competencia
              : `${parcelas.length} parcelas (${parcelas.map((p) => `#${p.parcela.numero}`).join(', ')})`,
          valor: totalValorBaixado,
          autorNome: resolved.nome
        }
      }).catch((e) => console.warn('[CredImpacto Push Folha Error]', e))
    }

    return NextResponse.json({
      success: true,
      processadas: resLote.parcelasBaixadas.length,
      falhas: resLote.erros.length,
      detalhesFalhas: resLote.erros,
      emprestimo: resLote.emprestimosAtualizados[0],
      emprestimosAtualizados: resLote.emprestimosAtualizados,
      parcela: resLote.parcelasBaixadas[0]?.parcela,
      parcelasBaixadas: resLote.parcelasBaixadas.map((p) => p.parcela)
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao conciliar parcela' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Apenas o setor financeiro pode estornar conciliações de parcelas.' }, { status: 403 })
    }

    const body = await request.json()
    const { parcelaId, parcelaIds, justificativa } = body

    const targetIds: string[] = Array.isArray(parcelaIds) && parcelaIds.length > 0
      ? parcelaIds
      : parcelaId
        ? [parcelaId]
        : []

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Identificador da(s) parcela(s) é obrigatório.' }, { status: 400 })
    }

    if (!justificativa || justificativa.trim().length < 5) {
      return NextResponse.json({ error: 'Justificativa detalhada é obrigatória para estorno financeiro (mín. 5 caracteres).' }, { status: 400 })
    }

    const resLote = await dbEstornarParcelasLote(
      targetIds,
      justificativa,
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil }
    )

    const { notifyCredImpactoEvent } = await import('@/lib/credimpacto/pushNotifications')

    const byLoan = new Map<string, { loan: typeof resLote.emprestimosAtualizados[0]; parcelas: typeof resLote.parcelasEstornadas }>()
    for (const item of resLote.parcelasEstornadas) {
      const entry = byLoan.get(item.emprestimo.id) || { loan: item.emprestimo, parcelas: [] }
      entry.parcelas.push(item)
      byLoan.set(item.emprestimo.id, entry)
    }

    for (const { loan, parcelas } of byLoan.values()) {
      const firstParcela = parcelas[0].parcela
      await notifyCredImpactoEvent({
        eventType: 'parcela_estornada',
        loan,
        targetRoles: ['colaborador'],
        sentByNome: resolved.nome,
        extra: {
          parcelaNumero: firstParcela.numero,
          competencia:
            parcelas.length === 1
              ? firstParcela.competencia
              : `${parcelas.length} parcelas (${parcelas.map((p) => `#${p.parcela.numero}`).join(', ')})`,
          motivo: justificativa,
          autorNome: resolved.nome
        }
      }).catch((e) => console.warn('[CredImpacto Push Estorno Error]', e))
    }

    return NextResponse.json({
      success: true,
      processadas: resLote.parcelasEstornadas.length,
      falhas: resLote.erros.length,
      detalhesFalhas: resLote.erros,
      emprestimo: resLote.emprestimosAtualizados[0],
      emprestimosAtualizados: resLote.emprestimosAtualizados,
      parcela: resLote.parcelasEstornadas[0]?.parcela
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao estornar baixa da parcela' }, { status: 400 })
  }
}
