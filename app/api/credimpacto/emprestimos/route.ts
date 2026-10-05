import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetEmprestimos, dbSaveEmprestimo, dbGetConfiguracao } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import { simulateLoan } from '@/lib/credimpacto/engine'
import { generateContractHtml } from '@/lib/credimpacto/contractTemplate'
import { CredImpactoEmprestimo, MetodoCalculo } from '@/types/credimpacto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const colaboradorIdParam = searchParams.get('colaborador_id')
    const statusParam = searchParams.get('status')

    const resolved = await resolveCredImpactoUser(user)

    let allowedIds: string[] | undefined = undefined
    let filterEmail: string | undefined = undefined
    let filterNome: string | undefined = undefined

    // Segurança rígida: se NÃO for admin ou diretor geral, força a visualização apenas dos seus próprios dados
    if (!resolved.isAdminOrFinance) {
      allowedIds = [resolved.id, resolved.systemUserId, resolved.funcionarioId].filter(Boolean) as string[]
      filterEmail = resolved.email
      filterNome = resolved.nome
    } else if (colaboradorIdParam) {
      allowedIds = [colaboradorIdParam]
    }

    const emprestimos = await dbGetEmprestimos({
      colaboradorIds: allowedIds,
      colaboradorEmail: filterEmail,
      colaboradorNome: filterNome,
      status: statusParam || undefined
    })

    return NextResponse.json(emprestimos)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao consultar empréstimos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const resolved = await resolveCredImpactoUser(user)
    const config = await dbGetConfiguracao()

    const {
      colaboradorId: targetColaboradorId,
      colaboradorNome: targetColaboradorNome,
      colaboradorCpf: targetColaboradorCpf,
      colaboradorEmail: targetColaboradorEmail,
      colaboradorCargo: targetColaboradorCargo,
      colaboradorMatricula: targetColaboradorMatricula,
      colaboradorSalarioBase: targetSalarioBase,
      valorSolicitado,
      quantidadeParcelas,
      taxaMensal,
      metodoCalculo,
      justificativaSolicitacao,
      finalidade,
      dadosBancarios,
      criadoPorFinanceiro
    } = body

    const valor = Number(valorSolicitado)
    const parcelasCount = Number(quantidadeParcelas)

    if (isNaN(valor) || valor <= 0) {
      return NextResponse.json({ error: 'Valor do empréstimo inválido.' }, { status: 400 })
    }

    if (isNaN(parcelasCount) || parcelasCount < 1) {
      return NextResponse.json({ error: 'Quantidade de parcelas inválida.' }, { status: 400 })
    }

    // Valida limites das políticas (apenas para colaboradores solicitando por conta própria; admin tem liberdade total)
    const isMasterOrAdminConcession = Boolean(resolved.isAdminOrFinance || criadoPorFinanceiro)
    if (!isMasterOrAdminConcession) {
      if (valor < config.valorMinimoEmprestimo || valor > config.valorMaximoEmprestimo) {
        return NextResponse.json({
          error: `O valor deve estar entre R$ ${config.valorMinimoEmprestimo.toFixed(2)} e R$ ${config.valorMaximoEmprestimo.toFixed(2)} conforme política escolar.`
        }, { status: 400 })
      }

      if (parcelasCount < config.prazoMinimoParcelas || parcelasCount > config.prazoMaximoParcelas) {
        return NextResponse.json({
          error: `O prazo deve estar entre ${config.prazoMinimoParcelas} e ${config.prazoMaximoParcelas} parcelas.`
        }, { status: 400 })
      }
    }

    const { getAdminClient } = await import('@/lib/server/supabaseAdminSingleton')
    const sb = getAdminClient()
    const { getDadosUnidadeEscolar } = await import('@/lib/credimpacto/unitHelper')

    // Define colaborador beneficiário
    let colabId = resolved.id
    let colabNome = resolved.nome
    let colabCpf = body.colaboradorCpf || resolved.cpf || ''
    let colabEmail = resolved.email
    let colabCargo = resolved.cargo
    let colabMatricula = resolved.matricula
    let colabSalario = resolved.salarioBase
    let colabUnidade = resolved.unidade || ''

    // Se admin estiver cadastrando para outro colaborador
    if (criadoPorFinanceiro && resolved.isAdminOrFinance && targetColaboradorId) {
      colabId = targetColaboradorId
      try {
        const { data: targetFunc } = await sb
          .from('funcionarios')
          .select('*')
          .eq('id', targetColaboradorId)
          .maybeSingle()

        if (targetFunc) {
          colabNome = targetColaboradorNome || targetFunc.nome || colabNome
          colabCpf = targetColaboradorCpf || targetFunc.cpf || colabCpf
          colabEmail = targetColaboradorEmail || targetFunc.email || ''
          colabCargo = targetColaboradorCargo || targetFunc.cargo || colabCargo
          colabMatricula = targetColaboradorMatricula || targetFunc.codigo || colabMatricula
          colabSalario = targetSalarioBase ? Number(targetSalarioBase) : (targetFunc.salario ? Number(targetFunc.salario) : colabSalario)
          colabUnidade = targetFunc.unidade || colabUnidade
        }
      } catch (e) {}
    }

    // Valida CPF obrigatório com 11 dígitos (apenas para colaborador solicitando por conta própria; admin pode enviar sem CPF para o colaborador completar na assinatura)
    const cleanDigitsCpf = (colabCpf || '').replace(/\D/g, '').slice(0, 11)
    if (!isMasterOrAdminConcession && (!cleanDigitsCpf || cleanDigitsCpf.length !== 11 || cleanDigitsCpf === '00000000000')) {
      return NextResponse.json({ error: 'O CPF do colaborador é obrigatório e deve conter 11 dígitos.' }, { status: 400 })
    }

    // Valida Chave PIX obrigatória (para colaborador solicitando; admin pode conceder e deixar a definir)
    if (!isMasterOrAdminConcession && (!dadosBancarios?.chavePix || !String(dadosBancarios.chavePix).trim())) {
      return NextResponse.json({ error: 'A Chave PIX é obrigatória para o crédito do empréstimo.' }, { status: 400 })
    }

    // Formata o CPF (000.000.000-00) se fornecido com 11 dígitos válidos
    let formattedCpf = ''
    if (cleanDigitsCpf.length === 11 && cleanDigitsCpf !== '00000000000') {
      formattedCpf = `${cleanDigitsCpf.slice(0, 3)}.${cleanDigitsCpf.slice(3, 6)}.${cleanDigitsCpf.slice(6, 9)}-${cleanDigitsCpf.slice(9, 11)}`
    }
    colabCpf = formattedCpf

    if (formattedCpf) {
      try {
        const funcIdToUpdate = criadoPorFinanceiro && targetColaboradorId ? targetColaboradorId : resolved.funcionarioId
        if (funcIdToUpdate) {
          await sb.from('funcionarios').update({
            cpf: formattedCpf,
            updated_at: new Date().toISOString()
          }).eq('id', funcIdToUpdate)
        } else if (colabEmail) {
          await sb.from('funcionarios').update({
            cpf: formattedCpf,
            updated_at: new Date().toISOString()
          }).ilike('email', colabEmail)
        }

        if (resolved.systemUserId || resolved.id) {
          await sb.from('system_users').update({
            cpf: formattedCpf,
            updated_at: new Date().toISOString()
          }).or(`id.eq.${resolved.systemUserId || resolved.id},auth_id.eq.${resolved.id}`)
        } else if (colabEmail) {
          await sb.from('system_users').update({
            cpf: formattedCpf,
            updated_at: new Date().toISOString()
          }).ilike('email', colabEmail)
        }
      } catch (errSync) {
        console.warn('[Sync CPF error]', errSync)
      }
    }

    // Define taxa e método
    let taxa = Number(taxaMensal)
    if (isNaN(taxa) || (!resolved.isAdminOrFinance && taxa !== config.taxaMensalPadrao)) {
      taxa = config.taxaMensalPadrao
    }

    let metodo: MetodoCalculo = metodoCalculo || config.metodoCalculoPadrao
    if (!resolved.isAdminOrFinance && !config.metodosPermitidos.includes(metodo)) {
      metodo = config.metodoCalculoPadrao
    }

    // Calcula simulação e parcelas
    const simulacao = simulateLoan(
      valor,
      parcelasCount,
      taxa,
      metodo,
      colabSalario,
      new Date(),
      config.diaPadraoDescontoFolha
    )

    const empId = crypto.randomUUID()
    const anoAtual = new Date().getFullYear()
    const randomCode = Math.floor(1000 + Math.random() * 9000)
    const codigoOperacao = `CRED-${anoAtual}-${randomCode}`

    const parcelasEntities = simulacao.parcelas.map((p) => ({
      id: crypto.randomUUID(),
      emprestimoId: empId,
      numero: p.numero,
      competencia: p.competencia,
      dataVencimento: p.dataVencimento,
      valorAmortizacao: p.valorAmortizacao,
      valorJuros: p.valorJuros,
      valorTotal: p.valorTotal,
      saldoDevedorApos: p.saldoDevedorApos,
      status: 'prevista' as const
    }))

    const initialStatus = criadoPorFinanceiro && resolved.isAdminOrFinance
      ? 'aguardando_assinatura' // Admin concedeu diretamente; aguarda aceite e assinatura do colaborador
      : 'solicitado'            // Colaborador solicitou; aguarda análise financeira

    // Obtém dados oficiais da unidade escolar onde o colaborador está cadastrado
    const dadosUnidade = await getDadosUnidadeEscolar(colabUnidade)

    const novoEmprestimo: CredImpactoEmprestimo = {
      id: empId,
      codigoOperacao,
      colaboradorId: colabId,
      colaboradorNome: colabNome,
      colaboradorCpf: colabCpf,
      colaboradorEmail: colabEmail,
      colaboradorCargo: colabCargo,
      colaboradorMatricula: colabMatricula,
      colaboradorSalarioBase: colabSalario,
      colaboradorUnidade: colabUnidade,
      valorSolicitado: valor,
      valorAprovado: valor,
      quantidadeParcelas: parcelasCount,
      taxaMensal: taxa,
      metodoCalculo: metodo,
      totalJuros: simulacao.totalJuros,
      totalAPagar: simulacao.totalAPagar,
      saldoDevedorAtual: valor,
      totalAmortizado: 0,
      status: initialStatus,
      justificativaSolicitacao,
      finalidade,
      dadosBancarios: dadosBancarios?.chavePix ? dadosBancarios : (isMasterOrAdminConcession ? { chavePix: 'A definir pelo colaborador', tipoConta: 'corrente' } : undefined),
      criadoPorTipo: criadoPorFinanceiro && resolved.isAdminOrFinance ? 'financeiro' : 'colaborador',
      criadoPorId: resolved.id,
      criadoPorNome: resolved.nome,
      termoAutorizacaoDesconto: config.termoAutorizacaoDesconto,
      memoriaCalculo: simulacao.memoriaCalculo,
      parcelas: parcelasEntities,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Gera texto contratual com a unidade escolar do colaborador e termo configurado
    novoEmprestimo.contratoConteudoHtml = generateContractHtml(novoEmprestimo, {
      razaoSocialEscola: dadosUnidade.razaoSocial,
      nomeFantasiaEscola: dadosUnidade.nomeFantasia,
      cnpjEscola: dadosUnidade.cnpj,
      enderecoEscola: dadosUnidade.endereco,
      cidadeUfEscola: dadosUnidade.cidadeUf,
      unidadeEscola: dadosUnidade.unidadeNome,
      termoAutorizacaoDesconto: config.termoAutorizacaoDesconto
    })

    const salvo = await dbSaveEmprestimo(
      novoEmprestimo,
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
      'CRIACAO',
      criadoPorFinanceiro ? 'Empréstimo iniciado pelo financeiro' : 'Solicitação enviada pelo colaborador'
    )

    return NextResponse.json(salvo, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao registrar solicitação' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json(
        { error: 'Apenas o Administrador e a Direção Geral possuem permissão para excluir registros de empréstimos.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Identificador do empréstimo é obrigatório.' }, { status: 400 })
    }

    const { dbDeleteEmprestimo } = await import('@/lib/credimpacto/db')
    const success = await dbDeleteEmprestimo(id, {
      id: resolved.id,
      nome: resolved.nome,
      perfil: resolved.perfil
    })

    if (!success) {
      return NextResponse.json({ error: 'Empréstimo não encontrado ou já removido.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Empréstimo excluído com sucesso.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar exclusão' }, { status: 500 })
  }
}
