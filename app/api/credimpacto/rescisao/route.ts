import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetEmprestimoById, dbSaveEmprestimo, dbGetConfiguracao } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import { calculateTerminationSeverance, roundMoney } from '@/lib/credimpacto/engine'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Acesso restrito ao setor financeiro e recursos humanos.' }, { status: 403 })
    }

    const body = await request.json()
    const { emprestimoId, salarioBase, verbasRescisoriasLiquidas, tipoRescisao = 'sem_justa_causa' } = body

    if (!emprestimoId) {
      return NextResponse.json({ error: 'Identificador do empréstimo obrigatório.' }, { status: 400 })
    }

    const loan = await dbGetEmprestimoById(emprestimoId)
    if (!loan) {
      return NextResponse.json({ error: 'Empréstimo não encontrado.' }, { status: 404 })
    }

    const config = await dbGetConfiguracao()
    const salario = salarioBase ? Number(salarioBase) : (loan.colaboradorSalarioBase || 0)

    if (salario <= 0) {
      return NextResponse.json({ error: 'Informe a remuneração base do colaborador para cálculo do teto da CLT.' }, { status: 400 })
    }

    const verbas = Number(verbasRescisoriasLiquidas || 0)
    const saldoDevedor = loan.saldoDevedorAtual

    const calc = calculateTerminationSeverance(
      saldoDevedor,
      salario,
      verbas,
      config.limiteCompensacaoRescisaoCltPercentual
    )

    return NextResponse.json({
      emprestimoId: loan.id,
      codigoOperacao: loan.codigoOperacao,
      colaboradorNome: loan.colaboradorNome,
      colaboradorCpf: loan.colaboradorCpf,
      tipoRescisao,
      ...calc
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao simular compensação rescisória' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Acesso restrito ao financeiro/RH.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      emprestimoId,
      valorCompensadoNoTRCT,
      saldoRemanescente,
      formaPagamentoRemanescente = 'pix_a_vista',
      observacoes
    } = body

    const loan = await dbGetEmprestimoById(emprestimoId)
    if (!loan) throw new Error('Empréstimo não encontrado.')

    const compensado = roundMoney(Number(valorCompensadoNoTRCT || 0))
    const remanescente = roundMoney(Number(saldoRemanescente || 0))

    // Atualiza saldo amortizado e devedor
    loan.totalAmortizado = roundMoney(loan.totalAmortizado + compensado)
    loan.saldoDevedorAtual = remanescente

    if (remanescente <= 0) {
      loan.status = 'quitado'
      loan.quitadoEm = new Date().toISOString()
      loan.parcelas = (loan.parcelas || []).map((p) => {
        if (p.status === 'prevista' || p.status === 'exportada_folha') {
          return {
            ...p,
            status: 'descontada',
            valorPago: p.valorAmortizacao,
            metodoPagamento: 'rescisao_clt',
            dataPagamento: new Date().toISOString().split('T')[0],
            observacao: 'Compensado integralmente no TRCT.'
          }
        }
        return p
      })
    } else {
      loan.status = 'renegociado'
      loan.motivoRecusa = `Compensado R$ ${compensado.toFixed(2)} no TRCT (Art. 477 CLT). Saldo remanescente de R$ ${remanescente.toFixed(2)} a ser pago via ${formaPagamentoRemanescente}.`
    }

    const updated = await dbSaveEmprestimo(
      loan,
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
      'RESCISAO_CLT',
      `Homologação de rescisão CLT: compensado R$ ${compensado.toFixed(2)} no TRCT. Saldo remanescente: R$ ${remanescente.toFixed(2)}`
    )

    return NextResponse.json({ success: true, emprestimo: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao homologar compensação rescisória' }, { status: 400 })
  }
}
