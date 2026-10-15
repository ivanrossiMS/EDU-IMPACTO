import { CredImpactoEmprestimo, CredImpactoParcela } from '@/types/credimpacto'
import { formatBrl, METODOS_LABELS, roundMoney, simulateLoan } from './engine'
import { getWhatsAppShareUrl } from '@/lib/whatsapp'

export type WhatsAppEventType =
  | 'aprovado'
  | 'recusado'
  | 'depositado'
  | 'contrato_cronograma'

function cleanCpfDigits(val?: string | null): string {
  if (!val) return ''
  const digits = val.replace(/\D/g, '')
  return digits.length === 11 && digits !== '00000000000' ? digits : ''
}

function cleanStr(val?: string | null): string {
  if (!val) return ''
  return val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  solicitado: 'Solicitado / Em Análise',
  em_analise: 'Em Análise de Crédito',
  contraproposta: 'Contraproposta Disponível',
  aprovado: 'Aprovado',
  aguardando_assinatura: 'Aguardando Assinatura',
  assinado: 'Contrato Assinado',
  aguardando_liberacao: 'Aguardando Liberação (PIX/TED)',
  ativo: 'Ativo em Folha',
  quitado: 'Quitado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  renegociado: 'Renegociado'
}

function getParcelaStatusLabel(status?: string): string {
  switch (status) {
    case 'descontada':
      return '✅ Paga (Folha)'
    case 'paga_avulso':
      return '✅ Paga (Avulso)'
    case 'exportada_folha':
      return '📄 Em Folha'
    case 'atrasada':
      return '⚠️ Em Atraso'
    case 'cancelada':
      return '🚫 Cancelada'
    case 'renegociada':
      return '🔄 Renegociada'
    default:
      return '⏳ A Vencer'
  }
}

function formatDateBr(dateStr?: string | null): string {
  if (!dateStr) return 'A definir'
  const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR')
}

/**
 * Resolve o número de WhatsApp / Celular do colaborador a partir do empréstimo,
 * da lista de funcionários cadastrados no RH ou da Chave PIX tipo telefone.
 */
export function resolveColaboradorPhone(
  loan: CredImpactoEmprestimo | null | undefined,
  colaboradoresList: any[] = []
): string {
  if (!loan) return ''

  // 1. Telefone já salvo diretamente na operação de empréstimo
  if (loan.colaboradorTelefone && loan.colaboradorTelefone.replace(/\D/g, '').length >= 10) {
    return loan.colaboradorTelefone.trim()
  }

  // 2. Busca no cadastro de funcionários (RH)
  if (Array.isArray(colaboradoresList) && colaboradoresList.length > 0) {
    const loanCpf = cleanCpfDigits(loan.colaboradorCpf)
    const loanMat = cleanStr(loan.colaboradorMatricula)
    const loanEmail = (loan.colaboradorEmail || '').trim().toLowerCase()
    const loanNome = cleanStr(loan.colaboradorNome)

    const matched = colaboradoresList.find((f) => {
      if (loan.colaboradorId && f.id === loan.colaboradorId) return true
      const fCpf = cleanCpfDigits(f.cpf || f.dados?.cpf)
      if (loanCpf && fCpf && loanCpf === fCpf) return true
      const fMat = cleanStr(f.matricula || f.codigo || f.dados?.matricula || f.dados?.codigo)
      if (loanMat && fMat && loanMat !== 'n/a' && loanMat === fMat) return true
      const fEmail = (f.email || f.dados?.email || '').trim().toLowerCase()
      if (loanEmail && fEmail && loanEmail === fEmail) return true
      const fNome = cleanStr(f.nome || f.dados?.nome)
      if (loanNome && fNome && loanNome.split(' ').length >= 2 && loanNome === fNome) return true
      return false
    })

    if (matched) {
      const tel =
        matched.celular ||
        matched.telefone ||
        matched.dados?.celular ||
        matched.dados?.telefone ||
        ''
      if (tel && String(tel).replace(/\D/g, '').length >= 10) {
        return String(tel).trim()
      }
    }
  }

  // 3. Fallback: se a Chave PIX informada for do tipo telefone
  if (
    loan.dadosBancarios?.tipoChavePix === 'telefone' &&
    loan.dadosBancarios?.chavePix &&
    loan.dadosBancarios.chavePix.replace(/\D/g, '').length >= 10
  ) {
    return loan.dadosBancarios.chavePix.trim()
  }

  return loan.colaboradorTelefone || ''
}

/**
 * Resolve os dados financeiros consolidados e a lista de parcelas de um empréstimo.
 */
export function resolveLoanFinancialDetails(loan: CredImpactoEmprestimo) {
  const rawValor = Number(loan.valorAprovado || loan.valorSolicitado || 0)
  const rawTotalAPagar = Number(loan.totalAPagar || 0)
  const rawTotalJuros = Number(loan.totalJuros || 0)

  const valorPrincipal =
    rawTotalAPagar > 0 && rawTotalJuros > 0 && Math.abs(rawValor - rawTotalAPagar) < 0.01
      ? roundMoney(Math.max(0, rawTotalAPagar - rawTotalJuros))
      : roundMoney(rawValor)

  const simFallback = simulateLoan(
    valorPrincipal,
    loan.quantidadeParcelas || 1,
    loan.taxaMensal ?? 0,
    loan.metodoCalculo || 'JUROS_SIMPLES_SALDO',
    loan.colaboradorSalarioBase,
    loan.createdAt ? new Date(loan.createdAt) : new Date(),
    5,
    loan.primeiraParcelaCompetencia,
    loan.primeiraParcelaVencimento
  )

  const parcelas: Array<Partial<CredImpactoParcela> & {
    numero: number
    competencia: string
    dataVencimento: string
    valorAmortizacao: number
    valorJuros: number
    valorTotal: number
    saldoDevedorApos: number
  }> = loan.parcelas && loan.parcelas.length > 0 ? loan.parcelas : simFallback.parcelas

  const totalJuros =
    typeof loan.totalJuros === 'number' && loan.totalJuros > 0
      ? roundMoney(loan.totalJuros)
      : roundMoney(parcelas.reduce((acc, p) => acc + (p.valorJuros || 0), 0))

  const totalAPagar =
    typeof loan.totalAPagar === 'number' && loan.totalAPagar > 0
      ? roundMoney(loan.totalAPagar)
      : roundMoney(valorPrincipal + totalJuros)

  const parcelasPagas = parcelas.filter(
    (p) => p.status === 'descontada' || p.status === 'paga_avulso'
  )
  const parcelasEmAberto = parcelas.filter(
    (p) =>
      p.status !== 'descontada' &&
      p.status !== 'paga_avulso' &&
      p.status !== 'cancelada' &&
      p.status !== 'renegociada'
  )

  const totalPagoComJuros = roundMoney(
    parcelasPagas.reduce((acc, p) => acc + (p.valorPago || p.valorTotal || 0), 0)
  )
  const saldoAReceberComJuros = roundMoney(
    parcelasEmAberto.reduce((acc, p) => acc + (p.valorTotal || 0), 0)
  )
  const principalAReceber = roundMoney(
    parcelasEmAberto.reduce((acc, p) => acc + (p.valorAmortizacao || 0), 0)
  )
  const jurosAReceber = roundMoney(
    parcelasEmAberto.reduce((acc, p) => acc + (p.valorJuros || 0), 0)
  )

  const taxaFormatada = Number(loan.taxaMensal || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const sufixoTaxa = loan.metodoCalculo === 'ACRESCIMO_UNICO' ? '(Taxa Única)' : 'a.m.'
  const metodoNome = METODOS_LABELS[loan.metodoCalculo]?.nome || loan.metodoCalculo

  const rawPix = loan.dadosBancarios?.chavePix?.trim() || ''
  const hasPix = Boolean(rawPix && !rawPix.toLowerCase().includes('definir'))
  const pixDestino = hasPix
    ? `${rawPix}${loan.dadosBancarios?.tipoChavePix ? ` (${loan.dadosBancarios.tipoChavePix.toUpperCase()})` : ''}`
    : loan.colaboradorCpf || 'Não informada'

  return {
    valorPrincipal,
    totalJuros,
    totalAPagar,
    parcelas,
    parcelasPagasCount: parcelasPagas.length,
    parcelasEmAbertoCount: parcelasEmAberto.length,
    totalPagoComJuros,
    saldoAReceberComJuros,
    principalAReceber,
    jurosAReceber,
    taxaFormatada,
    sufixoTaxa,
    metodoNome,
    pixDestino
  }
}

/**
 * Formata o bloco de cronograma de parcelas organizado para mensagens do WhatsApp.
 */
export function formatInstallmentsScheduleBlock(
  parcelas: Array<Partial<CredImpactoParcela> & {
    numero: number
    competencia: string
    dataVencimento: string
    valorAmortizacao: number
    valorJuros: number
    valorTotal: number
    saldoDevedorApos: number
  }>,
  totalParcelasCount?: number
): string {
  if (!parcelas || parcelas.length === 0) {
    return '• Cronograma em geração.'
  }

  const totalCount = totalParcelasCount || parcelas.length
  return parcelas
    .map((p) => {
      const numStr = `${String(p.numero).padStart(2, '0')}/${String(totalCount).padStart(2, '0')}`
      const vencStr = formatDateBr(p.dataVencimento)
      const compStr = p.competencia ? ` (Comp. ${p.competencia})` : ''
      const statusStr = getParcelaStatusLabel(p.status)
      return (
        `*Parcela ${numStr}* • Venc.: *${vencStr}*${compStr}\n` +
        `   💵 Valor: *${formatBrl(p.valorTotal)}* _(Principal: ${formatBrl(p.valorAmortizacao)} + Juros: ${formatBrl(p.valorJuros)})_\n` +
        `   📉 Saldo Após: ${formatBrl(p.saldoDevedorApos)} • ${statusStr}`
      )
    })
    .join('\n\n')
}

/**
 * Gera a mensagem formatada para envio no WhatsApp do colaborador
 * nas etapas: Aprovado, Recusado, Valor Depositado ou Extrato Completo (Contrato + Cronograma).
 */
export function buildCredImpactoWhatsAppMessage(
  loan: CredImpactoEmprestimo,
  eventType: WhatsAppEventType
): string {
  const details = resolveLoanFinancialDetails(loan)
  const {
    valorPrincipal,
    totalJuros,
    totalAPagar,
    parcelas,
    parcelasPagasCount,
    totalPagoComJuros,
    saldoAReceberComJuros,
    principalAReceber,
    jurosAReceber,
    taxaFormatada,
    sufixoTaxa,
    metodoNome,
    pixDestino
  } = details

  const primeiraParcela = parcelas[0]
  const primeiroVencFormatado = primeiraParcela?.dataVencimento
    ? formatDateBr(primeiraParcela.dataVencimento)
    : formatDateBr(loan.primeiraParcelaVencimento)

  const cronogramaTexto = formatInstallmentsScheduleBlock(parcelas, loan.quantidadeParcelas)

  if (eventType === 'contrato_cronograma') {
    const statusLabel = STATUS_LABELS[loan.status] || loan.status
    const dataContratacao = formatDateBr(loan.createdAt)
    const dataLiberacao = loan.dataLiberacao ? formatDateBr(loan.dataLiberacao) : null

    return (
      `📄 *CREDIMPACTO • EXTRATO DO CONTRATO E CRONOGRAMA DE PARCELAS*\n\n` +
      `Olá, *${loan.colaboradorNome}*!\n` +
      `Segue o demonstrativo detalhado do seu contrato de empréstimo consignado e o cronograma completo das parcelas:\n\n` +
      `📌 *DADOS DO CONTRATO:*\n` +
      `• Operação: *${loan.codigoOperacao}*\n` +
      `• Situação: *${statusLabel}*\n` +
      `• Colaborador: *${loan.colaboradorNome}*\n` +
      (loan.colaboradorCpf ? `• CPF: *${loan.colaboradorCpf}*\n` : '') +
      `• Data da Operação: *${dataContratacao}*\n` +
      (dataLiberacao ? `• Data de Liberação: *${dataLiberacao}*\n` : '') +
      `• Chave PIX Cadastrada: *${pixDestino}*\n\n` +
      `💰 *CONDIÇÕES FINANCEIRAS:*\n` +
      `• Valor Concedido (Principal): *${formatBrl(valorPrincipal)}*\n` +
      `• Taxa de Juros: *${taxaFormatada}% ${sufixoTaxa}* (${metodoNome})\n` +
      `• Valor Total dos Juros: *${formatBrl(totalJuros)}*\n` +
      `• Total do Contrato (Principal + Juros): *${formatBrl(totalAPagar)}*\n` +
      `• Quantidade de Parcelas: *${loan.quantidadeParcelas}x* (Desconto em Folha)\n\n` +
      `📊 *POSIÇÃO ATUAL DE PAGAMENTO:*\n` +
      `• Parcelas Quitadas: *${parcelasPagasCount} de ${loan.quantidadeParcelas}*\n` +
      `• Total Já Pago: *${formatBrl(totalPagoComJuros)}*\n` +
      `• Saldo em Aberto a Descontar: *${formatBrl(saldoAReceberComJuros)}* _(Principal: ${formatBrl(principalAReceber)} | Juros: ${formatBrl(jurosAReceber)})_\n\n` +
      `📅 *CRONOGRAMA DETALHADO DAS PARCELAS:*\n` +
      `────────────────────────\n` +
      `${cronogramaTexto}\n` +
      `────────────────────────\n\n` +
      (loan.codigoVerificacaoAssinatura
        ? `🔐 *Assinatura / Autenticação:* ${loan.codigoVerificacaoAssinatura}\n\n`
        : '') +
      `_Emitido em ${new Date().toLocaleDateString('pt-BR')} • Departamento Financeiro • Colégio Impacto_`
    )
  }

  if (eventType === 'aprovado') {
    const proximoPassoTexto =
      loan.status === 'aguardando_assinatura'
        ? `✍️ *PRÓXIMO PASSO:*\nSeu contrato já está disponível no portal *CredImpacto > Meus Empréstimos*. Acesse para realizar a assinatura eletrônica e liberar o depósito!`
        : loan.status === 'ativo'
        ? `💸 *STATUS DA LIBERAÇÃO:*\nSeu contrato já foi formalizado e ativado com sucesso no sistema!`
        : `🏦 *PRÓXIMO PASSO:*\nSua operação já foi encaminhada para a Tesouraria realizar a transferência via PIX/TED. Assim que o valor for depositado, você receberá a confirmação por aqui!`

    return (
      `✅ *CREDIMPACTO • EMPRÉSTIMO APROVADO*\n\n` +
      `Olá, *${loan.colaboradorNome}*!\n` +
      `Sua operação de empréstimo consignado no *Colégio Impacto* foi *APROVADA*!\n\n` +
      `📋 *RESUMO DO CONTRATO APROVADO:*\n` +
      `• Operação: *${loan.codigoOperacao}*\n` +
      `• Valor Aprovado (Líquido): *${formatBrl(valorPrincipal)}*\n` +
      `• Parcelamento: *${loan.quantidadeParcelas}x* (Desconto em Folha)\n` +
      `• Taxa de Juros: *${taxaFormatada}% ${sufixoTaxa}* (${metodoNome})\n` +
      `• Valor Total dos Juros: *${formatBrl(totalJuros)}*\n` +
      `• Total a Pagar: *${formatBrl(totalAPagar)}*\n` +
      `• 1º Vencimento Previsto: *${primeiroVencFormatado}*\n` +
      `• Chave PIX Destino: *${pixDestino}*\n\n` +
      `📅 *CRONOGRAMA DAS PARCELAS:*\n` +
      `────────────────────────\n` +
      `${cronogramaTexto}\n` +
      `────────────────────────\n\n` +
      `${proximoPassoTexto}\n\n` +
      `_Departamento Financeiro • Colégio Impacto_`
    )
  }

  if (eventType === 'recusado') {
    const motivo =
      (loan.motivoRecusa || '').trim() ||
      'Não aprovado pelos critérios internos de análise de crédito e margem consignável.'

    return (
      `⚠️ *CREDIMPACTO • ATUALIZAÇÃO DE SOLICITAÇÃO*\n\n` +
      `Olá, *${loan.colaboradorNome}*.\n` +
      `Informamos que a análise da sua solicitação de empréstimo consignado no *Colégio Impacto* foi concluída.\n\n` +
      `📋 *DADOS DA SOLICITAÇÃO:*\n` +
      `• Operação: *${loan.codigoOperacao}*\n` +
      `• Valor Solicitado: *${formatBrl(loan.valorSolicitado || valorPrincipal)}* em *${loan.quantidadeParcelas}x*\n` +
      `• Situação: *Não Aprovada / Recusada*\n\n` +
      `📝 *Parecer da Análise Financeira:*\n` +
      `"${motivo}"\n\n` +
      `Caso deseje realizar uma nova simulação ajustada à sua margem disponível ou esclarecer qualquer dúvida, estamos à disposição no setor Financeiro / RH.\n\n` +
      `_Departamento Financeiro • Colégio Impacto_`
    )
  }

  // eventType === 'depositado'
  const dataLiberacaoFormatada = loan.dataLiberacao
    ? formatDateBr(loan.dataLiberacao)
    : new Date().toLocaleDateString('pt-BR')

  return (
    `💸 *CREDIMPACTO • VALOR DEPOSITADO COM SUCESSO!*\n\n` +
    `Olá, *${loan.colaboradorNome}*!\n` +
    `Informamos que o valor referente ao seu empréstimo consignado já foi *DEPOSITADO / TRANSFERIDO* para a sua conta!\n\n` +
    `🏦 *COMPROVAÇÃO DE LIBERAÇÃO:*\n` +
    `• Operação: *${loan.codigoOperacao}*\n` +
    `• Valor Creditado (Líquido): *${formatBrl(valorPrincipal)}*\n` +
    `• Chave PIX / Destino: *${pixDestino}*\n` +
    `• Data da Liberação: *${dataLiberacaoFormatada}*\n` +
    `• Taxa de Juros: *${taxaFormatada}% ${sufixoTaxa}* (Total de Juros: ${formatBrl(totalJuros)})\n` +
    `• Total Contratado: *${formatBrl(totalAPagar)}* em *${loan.quantidadeParcelas}x*\n` +
    (loan.comprovanteLiberacaoUrl
      ? `\n📎 *Comprovante de Depósito:*\n${loan.comprovanteLiberacaoUrl}\n`
      : '') +
    `\n📅 *CRONOGRAMA DE DESCONTO EM FOLHA:*\n` +
    `────────────────────────\n` +
    `${cronogramaTexto}\n` +
    `────────────────────────\n\n` +
    `_Departamento Financeiro • Colégio Impacto_`
  )
}

export function getCredImpactoWhatsAppUrl(phone: string, message: string): string {
  return getWhatsAppShareUrl(phone, message)
}
