import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetEmprestimoById, dbProcessarQuitacaoAntecipada } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import { calculateEarlyPayoff } from '@/lib/credimpacto/engine'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { emprestimoId } = body

    if (!emprestimoId) {
      return NextResponse.json({ error: 'Identificador do empréstimo obrigatório.' }, { status: 400 })
    }

    const loan = await dbGetEmprestimoById(emprestimoId)
    if (!loan) {
      return NextResponse.json({ error: 'Empréstimo não encontrado.' }, { status: 404 })
    }

    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance && loan.colaboradorId !== resolved.id && loan.colaboradorEmail !== resolved.email) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const calc = calculateEarlyPayoff(loan.parcelas || [], loan.valorAprovado)

    return NextResponse.json({
      emprestimoId: loan.id,
      codigoOperacao: loan.codigoOperacao,
      valorOriginal: loan.valorAprovado,
      totalAmortizado: calc.totalAmortizadoAteAgora,
      saldoDevedorPrincipal: calc.saldoDevedorPrincipal,
      jurosFuturosDispensados: calc.jurosFuturosDispensados,
      totalSemDesconto: calc.totalSemDesconto,
      valorParaQuitacao: calc.valorParaQuitacao,
      economiaColaborador: calc.economiaColaborador,
      parcelasPagasCount: calc.parcelasPagasCount,
      parcelasRestantesCount: calc.parcelasRestantesCount
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao calcular quitação antecipada' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { emprestimoId, valorPago, metodoPagamento = 'pix', comprovanteUrl, observacao } = body

    if (!emprestimoId) {
      return NextResponse.json({ error: 'Identificador do empréstimo obrigatório.' }, { status: 400 })
    }

    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Apenas usuários do financeiro podem confirmar a liquidação de quitação antecipada.' }, { status: 403 })
    }

    const updatedLoan = await dbProcessarQuitacaoAntecipada(
      emprestimoId,
      {
        valorPago: Number(valorPago),
        metodoPagamento,
        comprovanteUrl,
        observacao
      },
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil }
    )

    return NextResponse.json({ success: true, emprestimo: updatedLoan })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar quitação' }, { status: 400 })
  }
}
