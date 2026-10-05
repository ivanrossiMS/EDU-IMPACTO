// ==============================================================================
// Types do Módulo CredImpacto - Empréstimos e Consignações do Colégio Impacto
// ==============================================================================

export type MetodoCalculo =
  | 'JUROS_SIMPLES_SALDO'    // Juros simples sobre o saldo devedor (amortização constante, parcelas decrescentes)
  | 'JUROS_SIMPLES_INICIAL'  // Juros mensais sobre o valor inicial (parcelas fixas, juros lineares)
  | 'ACRESCIMO_UNICO'        // Acréscimo único sobre o total (taxa percentual global)
  | 'TABELA_PRICE'           // Tabela Price (parcelas fixas amortização francesa)
  | 'BALAO_FINAL_COMPOSTO'   // Tudo no final com juros compostos (Bullet)

export type StatusEmprestimo =
  | 'solicitado'             // Colaborador submeteu a proposta
  | 'em_analise'             // Financeiro/Direção avaliando crédito e margem
  | 'contraproposta'         // Financeiro enviou nova condição (aguarda aceite)
  | 'aprovado'               // Aprovado pela escola
  | 'aguardando_assinatura'  // Contrato pronto para assinatura digital
  | 'aguardando_liberacao'   // Assinado por ambas as partes, aguardando TED/PIX
  | 'ativo'                  // Dinheiro liberado, parcelas ativas no cronograma
  | 'quitado'                // 100% amortizado ou liquidado antecipadamente
  | 'renegociado'            // Substituído por novo contrato de refinanciamento
  | 'recusado'               // Rejeitado com justificativa
  | 'cancelado'              // Cancelado antes da liberação

export type StatusParcela =
  | 'prevista'               // Agendada para a competência futura
  | 'exportada_folha'        // Enviada para arquivo/remessa da folha do mês
  | 'descontada'             // Desconto efetivo comprovado no contracheque
  | 'paga_avulso'            // Paga pelo colaborador via PIX/TED diretamente
  | 'atrasada'               // Folha rodou ou venceu e não houve comprovação
  | 'renegociada'            // Incluída em renegociação posterior
  | 'cancelada'              // Cancelada (ex: por quitação antecipada)

export type MetodoPagamento =
  | 'folha_pagamento'
  | 'pix'
  | 'transferencia'
  | 'dinheiro'
  | 'rescisao_clt'

export interface CredImpactoConfig {
  id?: string
  taxaMensalPadrao: number                // Ex: 1.5 (%)
  metodoCalculoPadrao: MetodoCalculo
  metodosPermitidos: MetodoCalculo[]
  margemMaximaConsignavel?: number        // Ex: 30 (%) do salário (opcional/descontinuado)
  prazoMinimoParcelas: number             // Ex: 1
  prazoMaximoParcelas: number             // Ex: 24
  valorMinimoEmprestimo: number           // Ex: 200 (R$)
  valorMaximoEmprestimo: number           // Ex: 25000 (R$)
  diaPadraoDescontoFolha: number          // Ex: 5 (dia do mês)
  exigeAprovacaoDupla: boolean
  limiteCompensacaoRescisaoCltPercentual: number // Ex: 100% de 1 salário (Art. 477 § 5º CLT)
  textoContratoPadrao?: string
  termoAutorizacaoDesconto?: string
  updatedAt?: string
}

export interface CredImpactoParcela {
  id: string
  emprestimoId: string
  numero: number
  competencia: string                     // Ex: '2026-10' ou '10/2026'
  dataVencimento: string                  // YYYY-MM-DD
  valorAmortizacao: number                // Abatimento estrito do capital
  valorJuros: number                      // Juros do período
  valorTotal: number                      // Amortização + Juros
  saldoDevedorApos: number                // Saldo restante após esta parcela ser paga
  status: StatusParcela
  
  // Conciliação e comprovação do desconto
  dataPagamento?: string                  // Data do desconto efetivo ou pagamento
  valorPago?: number
  metodoPagamento?: MetodoPagamento
  loteFolhaId?: string                    // Identificador da competência/lote da folha
  comprovanteUrl?: string                 // URL do contracheque ou comprovante PIX
  observacao?: string
  responsavelBaixaId?: string             // ID do operador do financeiro
  responsavelBaixaNome?: string
  baixadoEm?: string
}

export interface MemoriaCalculoItem {
  etapa: string
  descricao: string
  formula?: string
  detalhe?: string
}

export interface CredImpactoMemoriaCalculo {
  metodo: MetodoCalculo
  nomeMetodo: string
  taxaMensal: number
  valorPrincipal: number
  quantidadeParcelas: number
  totalJuros: number
  totalAPagar: number
  explicacao: string
  itens: MemoriaCalculoItem[]
}

export interface DadosBancariosColaborador {
  banco: string
  agencia: string
  conta: string
  tipoConta: 'corrente' | 'poupanca' | 'salario'
  chavePix?: string
  tipoChavePix?: 'cpf' | 'email' | 'telefone' | 'aleatoria'
  favorecido?: string
}

export interface ContrapropostaFinanceiro {
  valorProposto: number
  quantidadeParcelas: number
  taxaMensal: number
  metodoCalculo: MetodoCalculo
  motivo: string
  propostoPorId: string
  propostoPorNome: string
  propostoEm: string
  status: 'pendente' | 'aceita' | 'recusada'
}

export interface CredImpactoEmprestimo {
  id: string
  codigoOperacao: string                  // Ex: CRED-2026-0001
  colaboradorId: string
  colaboradorNome: string
  colaboradorCpf: string
  colaboradorEmail?: string
  colaboradorCargo?: string
  colaboradorMatricula?: string
  colaboradorSalarioBase?: number
  colaboradorUnidade?: string
  
  // Parâmetros Contratuais
  valorSolicitado: number
  valorAprovado: number
  quantidadeParcelas: number
  taxaMensal: number
  metodoCalculo: MetodoCalculo
  totalJuros: number
  totalAPagar: number
  saldoDevedorAtual: number               // Principal restante ainda não amortizado
  totalAmortizado: number                 // Soma das amortizações de parcelas efetivamente pagas
  
  status: StatusEmprestimo
  motivoRecusa?: string
  justificativaSolicitacao?: string
  finalidade?: string
  
  contraproposta?: ContrapropostaFinanceiro
  
  // Liberação Financeira
  dadosBancarios?: DadosBancariosColaborador
  comprovanteLiberacaoUrl?: string
  liberadoPorId?: string
  liberadoPorNome?: string
  dataLiberacao?: string
  
  // Assinatura Eletrônica e Contrato Formal
  contratoConteudoHtml?: string
  contratoHashSha256?: string
  codigoVerificacaoAssinatura?: string
  termoAutorizacaoDesconto?: string
  assinadoEm?: string
  assinanteIp?: string
  assinanteUserAgent?: string
  assinanteDocumento?: string
  
  // Quitação e Cancelamento
  quitadoEm?: string
  canceladoEm?: string
  canceladoPorId?: string
  canceladoPorNome?: string
  motivoCancelamento?: string
  
  criadoPorTipo: 'colaborador' | 'financeiro'
  criadoPorId?: string
  criadoPorNome?: string
  
  memoriaCalculo?: CredImpactoMemoriaCalculo
  parcelas?: CredImpactoParcela[]
  
  createdAt: string
  updatedAt: string
}

export interface CredImpactoSimulacao {
  valorSolicitado: number
  quantidadeParcelas: number
  taxaMensal: number
  metodoCalculo: MetodoCalculo
  totalJuros: number
  totalAPagar: number
  valorPrimeiraParcela: number
  valorUltimaParcela: number
  parcelas: Array<{
    numero: number
    competencia: string
    dataVencimento: string
    valorAmortizacao: number
    valorJuros: number
    valorTotal: number
    saldoDevedorApos: number
  }>
  memoriaCalculo: CredImpactoMemoriaCalculo
  limiteMargemConsignavel?: {
    salarioBase: number
    margemMaximaValor: number
    margemComprometida: boolean
    percentualComprometimento: number
  }
}

export interface CredImpactoQuitacao {
  id: string
  emprestimoId: string
  colaboradorId: string
  colaboradorNome: string
  dataSolicitacao: string
  parcelasRestantesCount: number
  saldoDevedorBruto: number
  descontoJurosFuturos: number
  valorLiquidoQuitacao: number
  status: 'pendente' | 'aprovada' | 'paga' | 'recusada' | 'cancelada'
  motivoRecusa?: string
  comprovanteUrl?: string
  metodoPagamento?: MetodoPagamento
  liquidadoEm?: string
  responsavelId?: string
  responsavelNome?: string
  createdAt: string
  updatedAt: string
}

export interface CredImpactoRescisao {
  id: string
  emprestimoId: string
  colaboradorId: string
  colaboradorNome: string
  dataDesligamento: string
  tipoRescisao: 'sem_justa_causa' | 'com_justa_causa' | 'pedido_demissao' | 'acordo_mutuo'
  salarioBaseColaborador: number
  saldoDevedorTotal: number
  tetoCompensacaoClt: number             // Limite Art. 477 § 5º da CLT (1 salário)
  valorCompensadoTrct: number            // O que será descontado no TRCT
  saldoRemanescente: number              // O que ainda fica pendente
  formaPagamentoRemanescente?: 'pix_a_vista' | 'parcelamento_avulso' | 'outro'
  parcelasAcordo?: number
  termoConfissaoDividaUrl?: string
  status: 'simulacao' | 'aprovado_financeiro' | 'homologado_trct' | 'cancelado'
  observacoes?: string
  analisadoPorId?: string
  analisadoPorNome?: string
  analisadoEm?: string
  createdAt: string
  updatedAt: string
}

export interface CredImpactoAuditLog {
  id: string
  entidadeTipo: 'emprestimo' | 'parcela' | 'quitacao' | 'rescisao' | 'configuracao'
  entidadeId: string
  acao:
    | 'CRIACAO'
    | 'APROVACAO'
    | 'RECUSA'
    | 'CONTRAPROPOSTA'
    | 'ASSINATURA'
    | 'LIBERACAO'
    | 'CONCILIACAO_FOLHA'
    | 'ESTORNO_BAIXA'
    | 'QUITACAO_ANTECIPADA'
    | 'RESCISAO_CLT'
    | 'CANCELAMENTO'
    | 'EXCLUSAO'
    | 'ALTERACAO_CONFIG'
  autorId: string
  autorNome: string
  autorPerfil?: string
  dadosAnteriores?: any
  dadosNovos?: any
  justificativa?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
}
