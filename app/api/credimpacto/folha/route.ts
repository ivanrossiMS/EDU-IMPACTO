import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import {
  dbGetParcelasFolha,
  dbConciliarParcela,
  dbEstornarParcela
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

    const parcelas = await dbGetParcelasFolha(competencia)

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
      return NextResponse.json({ error: 'Apenas usuários do setor financeiro podem conciliar parcelas de folha.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      parcelaId,
      parcelaIds,
      valorPago,
      metodoPagamento = 'folha_pagamento',
      dataPagamento,
      comprovanteUrl,
      observacao,
      loteFolhaId
    } = body

    // 1. Conciliação em Lote (múltiplas parcelas confirmadas pela folha de pagamento)
    if (Array.isArray(parcelaIds) && parcelaIds.length > 0) {
      const concilSuccess: string[] = []
      const concilErrors: Array<{ id: string; error: string }> = []

      for (const id of parcelaIds) {
        try {
          await dbConciliarParcela(
            id,
            {
              valorPago: 0, // se 0, usará o valor total da parcela
              metodoPagamento,
              dataPagamento,
              comprovanteUrl,
              observacao: observacao || `Conciliação em lote da folha (Lote: ${loteFolhaId || 'Automático'})`,
              loteFolhaId
            },
            { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil }
          )
          concilSuccess.push(id)
        } catch (e: any) {
          concilErrors.push({ id, error: e.message })
        }
      }

      return NextResponse.json({
        success: true,
        processadas: concilSuccess.length,
        falhas: concilErrors.length,
        detalhesFalhas: concilErrors
      })
    }

    // 2. Conciliação Individual
    if (!parcelaId) {
      return NextResponse.json({ error: 'Informe a parcela a ser conciliada.' }, { status: 400 })
    }

    const res = await dbConciliarParcela(
      parcelaId,
      {
        valorPago: Number(valorPago),
        metodoPagamento,
        dataPagamento,
        comprovanteUrl,
        observacao,
        loteFolhaId
      },
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil }
    )

    return NextResponse.json(res)
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
    const { parcelaId, justificativa } = body

    if (!parcelaId) {
      return NextResponse.json({ error: 'Identificador da parcela é obrigatório.' }, { status: 400 })
    }

    if (!justificativa || justificativa.trim().length < 5) {
      return NextResponse.json({ error: 'Justificativa detalhada é obrigatória para estorno financeiro.' }, { status: 400 })
    }

    const res = await dbEstornarParcela(
      parcelaId,
      justificativa,
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil }
    )

    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao estornar baixa da parcela' }, { status: 400 })
  }
}
