import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetEmprestimoById, dbSaveEmprestimo, dbGetConfiguracao } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import { simulateLoan } from '@/lib/credimpacto/engine'
import { generateContractHtml } from '@/lib/credimpacto/contractTemplate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { id } = await context.params
    const resolved = await resolveCredImpactoUser(user)
    const loan = await dbGetEmprestimoById(id)

    if (!loan) {
      return NextResponse.json({ error: 'Empréstimo não encontrado.' }, { status: 404 })
    }

    // Valida acesso: somente o próprio colaborador ou administrador/financeiro
    if (!resolved.isAdminOrFinance && loan.colaboradorId !== resolved.id && loan.colaboradorEmail !== resolved.email) {
      return NextResponse.json({ error: 'Acesso não autorizado a esta operação.' }, { status: 403 })
    }

    return NextResponse.json(loan)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao consultar empréstimo' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { id } = await context.params
    const body = await request.json()
    const resolved = await resolveCredImpactoUser(user)
    const loan = await dbGetEmprestimoById(id)

    if (!loan) {
      return NextResponse.json({ error: 'Empréstimo não encontrado.' }, { status: 404 })
    }

    const { acao } = body

    // ─────────────────────────────────────────────────────────────────────────
    // 1. AÇÃO: ANALISAR (Aprovar, Recusar ou Contraproposta) — Apenas Financeiro
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'analisar') {
      if (!resolved.isAdminOrFinance) {
        return NextResponse.json({ error: 'Apenas usuários autorizados do financeiro/direção podem analisar solicitações.' }, { status: 403 })
      }

      const { decisao, motivoRecusa, contraproposta } = body

      if (decisao === 'aprovar') {
        const config = await dbGetConfiguracao()
        loan.status = 'aguardando_assinatura'
        if (!loan.termoAutorizacaoDesconto) {
          loan.termoAutorizacaoDesconto = config.termoAutorizacaoDesconto
        }
        loan.contratoConteudoHtml = generateContractHtml(loan, {
          termoAutorizacaoDesconto: loan.termoAutorizacaoDesconto
        })
        const updated = await dbSaveEmprestimo(
          loan,
          { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
          'APROVACAO',
          'Solicitação de empréstimo aprovada pelo financeiro'
        )
        return NextResponse.json(updated)
      }

      if (decisao === 'recusar') {
        loan.status = 'recusado'
        loan.motivoRecusa = motivoRecusa || 'Não aprovado pelos critérios internos de crédito e margem.'
        const updated = await dbSaveEmprestimo(
          loan,
          { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
          'RECUSA',
          `Solicitação recusada: ${loan.motivoRecusa}`
        )
        return NextResponse.json(updated)
      }

      if (decisao === 'contraproposta') {
        if (!contraproposta || !contraproposta.valorProposto) {
          return NextResponse.json({ error: 'Dados da contraproposta incompletos.' }, { status: 400 })
        }

        loan.status = 'contraproposta'
        loan.contraproposta = {
          valorProposto: Number(contraproposta.valorProposto),
          quantidadeParcelas: Number(contraproposta.quantidadeParcelas || loan.quantidadeParcelas),
          taxaMensal: Number(contraproposta.taxaMensal || loan.taxaMensal),
          metodoCalculo: contraproposta.metodoCalculo || loan.metodoCalculo,
          motivo: contraproposta.motivo || 'Ajuste de valor/prazo para adequação à margem salarial.',
          propostoPorId: resolved.id,
          propostoPorNome: resolved.nome,
          propostoEm: new Date().toISOString(),
          status: 'pendente'
        }

        const updated = await dbSaveEmprestimo(
          loan,
          { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
          'CONTRAPROPOSTA',
          `Contraproposta enviada: R$ ${contraproposta.valorProposto} em ${contraproposta.quantidadeParcelas}x`
        )
        return NextResponse.json(updated)
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. AÇÃO: RESPONDER CONTRAPROPOSTA — Pelo Colaborador
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'responder_contraproposta') {
      const isOwner = loan.colaboradorId === resolved.id || loan.colaboradorEmail === resolved.email
      if (!isOwner && !resolved.isAdminOrFinance) {
        return NextResponse.json({ error: 'Apenas o colaborador titular pode responder à contraproposta.' }, { status: 403 })
      }

      const { aceitou } = body
      if (!loan.contraproposta) {
        return NextResponse.json({ error: 'Nenhuma contraproposta pendente nesta operação.' }, { status: 400 })
      }

      if (aceitou) {
        const config = await dbGetConfiguracao()
        const prop = loan.contraproposta

        // Recalcula o empréstimo com as novas condições aceitas
        const novaSimulacao = simulateLoan(
          prop.valorProposto,
          prop.quantidadeParcelas,
          prop.taxaMensal,
          prop.metodoCalculo,
          loan.colaboradorSalarioBase,
          new Date(),
          config.diaPadraoDescontoFolha
        )

        loan.valorAprovado = prop.valorProposto
        loan.quantidadeParcelas = prop.quantidadeParcelas
        loan.taxaMensal = prop.taxaMensal
        loan.metodoCalculo = prop.metodoCalculo
        loan.totalJuros = novaSimulacao.totalJuros
        loan.totalAPagar = novaSimulacao.totalAPagar
        loan.saldoDevedorAtual = prop.valorProposto
        loan.memoriaCalculo = novaSimulacao.memoriaCalculo
        loan.contraproposta.status = 'aceita'
        loan.status = 'aguardando_assinatura'

        loan.parcelas = novaSimulacao.parcelas.map((p) => ({
          id: crypto.randomUUID(),
          emprestimoId: loan.id,
          numero: p.numero,
          competencia: p.competencia,
          dataVencimento: p.dataVencimento,
          valorAmortizacao: p.valorAmortizacao,
          valorJuros: p.valorJuros,
          valorTotal: p.valorTotal,
          saldoDevedorApos: p.saldoDevedorApos,
          status: 'prevista' as const
        }))

        if (!loan.termoAutorizacaoDesconto) {
          loan.termoAutorizacaoDesconto = config.termoAutorizacaoDesconto
        }
        loan.contratoConteudoHtml = generateContractHtml(loan, {
          termoAutorizacaoDesconto: loan.termoAutorizacaoDesconto
        })

        const updated = await dbSaveEmprestimo(
          loan,
          { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
          'APROVACAO',
          'Colaborador aceitou a contraproposta. Contrato gerado para assinatura.'
        )
        return NextResponse.json(updated)
      } else {
        loan.contraproposta.status = 'recusada'
        loan.status = 'cancelado'
        loan.motivoCancelamento = 'Colaborador não aceitou a contraproposta enviada pelo financeiro.'
        loan.canceladoEm = new Date().toISOString()
        loan.canceladoPorId = resolved.id
        loan.canceladoPorNome = resolved.nome

        const updated = await dbSaveEmprestimo(
          loan,
          { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
          'CANCELAMENTO',
          loan.motivoCancelamento
        )
        return NextResponse.json(updated)
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. AÇÃO: LIBERAR RECURSOS (Disbursement) — Apenas Financeiro
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'liberar') {
      if (!resolved.isAdminOrFinance) {
        return NextResponse.json({ error: 'Apenas o setor financeiro pode registrar a liberação do dinheiro.' }, { status: 403 })
      }

      if (loan.status !== 'aguardando_liberacao') {
        return NextResponse.json({
          error: `O empréstimo precisa estar assinado antes da liberação. Status atual: ${loan.status}`
        }, { status: 400 })
      }

      const { comprovanteLiberacaoUrl, dadosBancarios, dataLiberacao } = body

      loan.status = 'ativo'
      loan.dataLiberacao = dataLiberacao || new Date().toISOString()
      loan.liberadoPorId = resolved.id
      loan.liberadoPorNome = resolved.nome
      loan.comprovanteLiberacaoUrl = comprovanteLiberacaoUrl || loan.comprovanteLiberacaoUrl
      if (dadosBancarios) {
        loan.dadosBancarios = dadosBancarios
      }

      const updated = await dbSaveEmprestimo(
        loan,
        { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
        'LIBERACAO',
        `Recursos no valor de R$ ${loan.valorAprovado.toFixed(2)} liberados na conta do colaborador`
      )
      return NextResponse.json(updated)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. AÇÃO: CANCELAR OPERAÇÃO
    // ─────────────────────────────────────────────────────────────────────────
    if (acao === 'cancelar') {
      if (loan.status === 'ativo' || loan.status === 'quitado') {
        return NextResponse.json({ error: 'Operações ativas ou quitadas não podem ser canceladas diretamente. Utilize estorno ou liquidação.' }, { status: 400 })
      }

      loan.status = 'cancelado'
      loan.canceladoEm = new Date().toISOString()
      loan.canceladoPorId = resolved.id
      loan.canceladoPorNome = resolved.nome
      loan.motivoCancelamento = body.motivo || 'Operação cancelada a pedido.'

      const updated = await dbSaveEmprestimo(
        loan,
        { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
        'CANCELAMENTO',
        loan.motivoCancelamento
      )
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar alteração do empréstimo' }, { status: 400 })
  }
}
