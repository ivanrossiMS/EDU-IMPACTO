// app/(app)/financeiro/pagar/types.ts
import { formatCurrency } from '@/lib/utils'

export type ContaPagarStatus =
  | 'pendente'
  | 'agendado'
  | 'pago'
  | 'vencido'
  | 'cancelado'

export type ContaPagarPrioridade = 'critica' | 'alta' | 'media' | 'baixa'

export type ContaPagarTipoCusto =
  | 'fixo'
  | 'variavel'
  | 'investimento'
  | 'extraordinario'

export interface RateioCentroCustoItem {
  id?: string
  centroCusto: string
  percentual: number
  valor: number
}

export interface HistoricoContaPagarItem {
  id: string
  data: string
  acao: string
  usuario: string
  detalhes?: string
}

export interface DetalhesRetencaoFiscal {
  iss: number
  irrf: number
  inss: number
  pisCofinsCsll: number
}

export interface ContaPagarRecord {
  id: string
  codigo?: string
  descricao: string
  fornecedorId?: string
  fornecedorNome: string
  fornecedor?: string
  fornecedorDocumento?: string
  categoria: string
  subcategoria?: string
  centroCusto: string
  rateio?: RateioCentroCustoItem[]
  planoContasId?: string
  eventoId?: string
  tipoCusto: ContaPagarTipoCusto
  prioridade: ContaPagarPrioridade
  competencia: string // YYYY-MM
  dataEmissao: string // YYYY-MM-DD
  vencimento: string // YYYY-MM-DD
  dataPagamento?: string // YYYY-MM-DD
  valorBase: number
  desconto: number
  juros: number
  multa: number
  retencaoImpostos: number
  detalhesRetencao?: DetalhesRetencaoFiscal
  valor: number // Valor líquido a pagar
  valorPago?: number
  status: ContaPagarStatus
  formaPagamento: string
  caixaOrigem?: string
  numeroDocumento?: string
  tipoDocumento?:
    | 'NF-e'
    | 'NFS-e'
    | 'Boleto'
    | 'Recibo'
    | 'Contrato'
    | 'DARF'
    | 'Folha'
    | 'Fatura'
    | 'Outro'
  notaFiscal?: string
  linhaDigitavel?: string
  chavePix?: string
  comprovanteUrl?: string
  parcelaAtual?: number
  totalParcelas?: number
  grupoParcelamentoId?: string
  recorrente?: boolean
  frequenciaRecorrencia?: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  aprovacaoStatus?: 'aprovado' | 'pendente_aprovacao' | 'rejeitado'
  aprovadoPor?: string
  observacoes?: string
  historico?: HistoricoContaPagarItem[]
  createdAt?: string
  updatedAt?: string
}

export interface FornecedorEscolar {
  id: string
  nome: string
  nomeFantasia?: string
  documento: string
  categoriaPadrao: string
  centroCustoPadrao: string
  formaPagamentoPadrao: string
  banco?: string
  agencia?: string
  contaCorrente?: string
  chavePix?: string
  tipoPix?: 'CNPJ' | 'CPF' | 'E-mail' | 'Telefone' | 'Aleatória' | string
  contatoNome?: string
  telefone?: string
  email?: string
  observacoes?: string
  avaliacao?: number
  ativo: boolean
}

export interface OrcamentoCategoriaItem {
  categoria: string
  metaMensal: number
  alertaPercentual: number
}

export interface CategoriaEscolarMeta {
  id: string
  label: string
  grupoDre: string
  cor: string
  orcamentoSugeridoMensal: number
  tipoCustoPadrao: ContaPagarTipoCusto
}

export const CATEGORIAS_ESCOLARES: CategoriaEscolarMeta[] = [
  {
    id: 'Pessoal & Corpo Docente',
    label: 'Pessoal & Corpo Docente',
    grupoDre: 'Custos Pedagógicos e Pessoal',
    cor: '#38bdf8',
    orcamentoSugeridoMensal: 90000,
    tipoCustoPadrao: 'fixo',
  },
  {
    id: 'Encargos Sociais & Trabalhistas',
    label: 'Encargos Sociais & Trabalhistas (FGTS/INSS)',
    grupoDre: 'Custos Pedagógicos e Pessoal',
    cor: '#06b6d4',
    orcamentoSugeridoMensal: 26000,
    tipoCustoPadrao: 'fixo',
  },
  {
    id: 'Material Didático & Pedagógico',
    label: 'Material Didático, Sistemas de Ensino & Laboratórios',
    grupoDre: 'Custos Pedagógicos Diretos',
    cor: '#a855f7',
    orcamentoSugeridoMensal: 22000,
    tipoCustoPadrao: 'variavel',
  },
  {
    id: 'Infraestrutura, Aluguel & Manutenção',
    label: 'Infraestrutura, Climatização & Manutenção Predial',
    grupoDre: 'Despesas de Ocupação e Estrutura',
    cor: '#f59e0b',
    orcamentoSugeridoMensal: 15000,
    tipoCustoPadrao: 'fixo',
  },
  {
    id: 'Utilidades (Energia, Água, Internet)',
    label: 'Utilidades Públicas (Energia, Água, Telecom)',
    grupoDre: 'Despesas de Ocupação e Estrutura',
    cor: '#eab308',
    orcamentoSugeridoMensal: 11000,
    tipoCustoPadrao: 'variavel',
  },
  {
    id: 'Segurança, Portaria & Limpeza',
    label: 'Segurança Escolar, Portaria & Limpeza Terceirizada',
    grupoDre: 'Despesas Operacionais',
    cor: '#10b981',
    orcamentoSugeridoMensal: 12500,
    tipoCustoPadrao: 'fixo',
  },
  {
    id: 'Tecnologia, Sistemas & Licenças',
    label: 'Tecnologia, ERP Escolar, Links & Licenças',
    grupoDre: 'Despesas Administrativas e TI',
    cor: '#6366f1',
    orcamentoSugeridoMensal: 6000,
    tipoCustoPadrao: 'fixo',
  },
  {
    id: 'Alimentação & Cantina Escolar',
    label: 'Alimentação, Nutrição Infantil & Merenda',
    grupoDre: 'Custos Operacionais de Alunos',
    cor: '#84cc16',
    orcamentoSugeridoMensal: 8000,
    tipoCustoPadrao: 'variavel',
  },
  {
    id: 'Marketing & Captação de Alunos',
    label: 'Marketing Educacional & Captação de Matrículas',
    grupoDre: 'Despesas Comerciais',
    cor: '#ec4899',
    orcamentoSugeridoMensal: 7500,
    tipoCustoPadrao: 'investimento',
  },
  {
    id: 'Impostos, Taxas & Tributos',
    label: 'Impostos, ISSQN, DARF & Taxas Municipais',
    grupoDre: 'Deduções e Tributos',
    cor: '#f43f5e',
    orcamentoSugeridoMensal: 10000,
    tipoCustoPadrao: 'variavel',
  },
  {
    id: 'Serviços Contábeis & Jurídicos',
    label: 'Assessoria Contábil, Jurídica & Auditoria',
    grupoDre: 'Despesas Administrativas',
    cor: '#14b8a6',
    orcamentoSugeridoMensal: 4500,
    tipoCustoPadrao: 'fixo',
  },
  {
    id: 'Eventos Escolares, Esportes & Cultura',
    label: 'Eventos Pedagógicos, Olimpíadas & Cultura',
    grupoDre: 'Atividades Extracurriculares',
    cor: '#f97316',
    orcamentoSugeridoMensal: 5000,
    tipoCustoPadrao: 'variavel',
  },
  {
    id: 'Outros Custos Operacionais',
    label: 'Outros Custos Operacionais & Suprimentos',
    grupoDre: 'Despesas Gerais',
    cor: '#94a3b8',
    orcamentoSugeridoMensal: 4000,
    tipoCustoPadrao: 'variavel',
  },
]

export const CENTROS_CUSTO_ESCOLARES = [
  { id: 'Educação Infantil', label: 'Educação Infantil', sigla: 'INF', cor: '#ec4899' },
  { id: 'Fundamental Anos Iniciais', label: 'Fundamental Anos Iniciais (1º ao 5º)', sigla: 'EF1', cor: '#38bdf8' },
  { id: 'Fundamental Anos Finais', label: 'Fundamental Anos Finais (6º ao 9º)', sigla: 'EF2', cor: '#6366f1' },
  { id: 'Ensino Médio & Pré-Vestibular', label: 'Ensino Médio & Pré-Vestibular', sigla: 'EM', cor: '#a855f7' },
  { id: 'Período Integral / Bilíngue', label: 'Período Integral & Programa Bilíngue', sigla: 'INT', cor: '#10b981' },
  { id: 'Administração & Diretoria Geral', label: 'Administração, Secretaria & Diretoria', sigla: 'ADM', cor: '#f59e0b' },
  { id: 'Infraestrutura, Limpeza & Segurança', label: 'Infraestrutura, Campus & Facilities', sigla: 'INFRA', cor: '#06b6d4' },
  { id: 'Marketing & Captação (Matrículas)', label: 'Comercial, Marketing & Captação', sigla: 'MKT', cor: '#f43f5e' },
]

export const FORMAS_PAGAMENTO_CONTAS_PAGAR = [
  'PIX',
  'Boleto Bancário',
  'Transferência / TED',
  'Débito Automático',
  'Cartão Corporativo',
  'Espécie / Caixa Físico',
  'Cheque Administrativo',
]

export const CAIXAS_BANCOS_ESCOLARES = [
  'Banco do Brasil — Conta Movimento',
  'Itaú — Conta Operacional',
  'Santander — Conta Arrecadação',
  'Caixa Econômica — Conta Escolar',
  'Caixa Físico — Tesouraria Escolar',
]

export const STATUS_CONTA_PAGAR_CONFIG: Record<
  ContaPagarStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  pago: {
    label: 'Liquidado / Pago',
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  pendente: {
    label: 'Em Aberto',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  agendado: {
    label: 'Agendado Banco',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  vencido: {
    label: 'Vencido',
    color: '#be123c',
    bg: '#fff1f2',
    border: '#fecdd3',
  },
  cancelado: {
    label: 'Cancelado',
    color: '#475569',
    bg: '#f1f5f9',
    border: '#cbd5e1',
  },
}

export const PRIORIDADE_CONTA_PAGAR_CONFIG: Record<
  ContaPagarPrioridade,
  { label: string; color: string; bg: string }
> = {
  critica: { label: 'Crítica', color: '#be123c', bg: '#fff1f2' },
  alta: { label: 'Alta', color: '#b45309', bg: '#fffbeb' },
  media: { label: 'Média', color: '#0369a1', bg: '#f0f9ff' },
  baixa: { label: 'Baixa', color: '#475569', bg: '#f1f5f9' },
}

export const TIPO_CUSTO_CONFIG: Record<
  ContaPagarTipoCusto,
  { label: string; color: string }
> = {
  fixo: { label: 'Custo Fixo', color: '#6366f1' },
  variavel: { label: 'Custo Variável', color: '#f59e0b' },
  investimento: { label: 'Investimento / CAPEX', color: '#10b981' },
  extraordinario: { label: 'Extraordinário', color: '#f43f5e' },
}

export const TEMPLATES_DESPESAS_ESCOLARES = [
  {
    id: 'tpl-folha-docente',
    titulo: 'Folha de Pagamento — Corpo Docente & Coordenação',
    categoria: 'Pessoal & Corpo Docente',
    centroCusto: 'Fundamental Anos Finais',
    tipoCusto: 'fixo' as ContaPagarTipoCusto,
    prioridade: 'critica' as ContaPagarPrioridade,
    diaVencimento: 5,
    valorEstimado: 85000,
    formaPagamento: 'Transferência / TED',
  },
  {
    id: 'tpl-fgts-inss',
    titulo: 'Guia FGTS Digital e DARF Previdenciário (INSS Patronal)',
    categoria: 'Encargos Sociais & Trabalhistas',
    centroCusto: 'Administração & Diretoria Geral',
    tipoCusto: 'fixo' as ContaPagarTipoCusto,
    prioridade: 'critica' as ContaPagarPrioridade,
    diaVencimento: 20,
    valorEstimado: 24850,
    formaPagamento: 'PIX',
  },
  {
    id: 'tpl-sistema-ensino',
    titulo: 'Sistema de Ensino — Royalties & Plataforma de Material Didático',
    categoria: 'Material Didático & Pedagógico',
    centroCusto: 'Ensino Médio & Pré-Vestibular',
    tipoCusto: 'variavel' as ContaPagarTipoCusto,
    prioridade: 'alta' as ContaPagarPrioridade,
    diaVencimento: 15,
    valorEstimado: 18800,
    formaPagamento: 'Boleto Bancário',
  },
  {
    id: 'tpl-energia-campus',
    titulo: 'Concessionária de Energia Elétrica — Campus Principal',
    categoria: 'Utilidades (Energia, Água, Internet)',
    centroCusto: 'Infraestrutura, Limpeza & Segurança',
    tipoCusto: 'variavel' as ContaPagarTipoCusto,
    prioridade: 'critica' as ContaPagarPrioridade,
    diaVencimento: 10,
    valorEstimado: 7600,
    formaPagamento: 'Débito Automático',
  },
  {
    id: 'tpl-portaria-limpeza',
    titulo: 'Protege Facilities — Portaria Controlada, Vigilância e Limpeza',
    categoria: 'Segurança, Portaria & Limpeza',
    centroCusto: 'Infraestrutura, Limpeza & Segurança',
    tipoCusto: 'fixo' as ContaPagarTipoCusto,
    prioridade: 'alta' as ContaPagarPrioridade,
    diaVencimento: 15,
    valorEstimado: 10235,
    formaPagamento: 'PIX',
  },
  {
    id: 'tpl-erp-fibra',
    titulo: 'CloudEdu Tech — Licenciamento ERP Escolar & Link Fibra Dedicado',
    categoria: 'Tecnologia, Sistemas & Licenças',
    centroCusto: 'Administração & Diretoria Geral',
    tipoCusto: 'fixo' as ContaPagarTipoCusto,
    prioridade: 'alta' as ContaPagarPrioridade,
    diaVencimento: 10,
    valorEstimado: 3500,
    formaPagamento: 'PIX',
  },
  {
    id: 'tpl-issqn-municipal',
    titulo: 'Prefeitura Municipal — Guia DAM ISSQN Sobre Mensalidades',
    categoria: 'Impostos, Taxas & Tributos',
    centroCusto: 'Administração & Diretoria Geral',
    tipoCusto: 'variavel' as ContaPagarTipoCusto,
    prioridade: 'alta' as ContaPagarPrioridade,
    diaVencimento: 10,
    valorEstimado: 8420,
    formaPagamento: 'PIX',
  },
  {
    id: 'tpl-merenda-infantil',
    titulo: 'Sabor & Saúde — Nutrição Escolar e Lanches Educação Infantil',
    categoria: 'Alimentação & Cantina Escolar',
    centroCusto: 'Educação Infantil',
    tipoCusto: 'variavel' as ContaPagarTipoCusto,
    prioridade: 'alta' as ContaPagarPrioridade,
    diaVencimento: 12,
    valorEstimado: 6200,
    formaPagamento: 'Boleto Bancário',
  },
]

export function calcularValorLiquido(
  valorBase: number,
  desconto = 0,
  juros = 0,
  multa = 0,
  retencaoImpostos = 0
): number {
  const b = Math.max(0, Number(valorBase) || 0)
  const d = Math.max(0, Number(desconto) || 0)
  const j = Math.max(0, Number(juros) || 0)
  const m = Math.max(0, Number(multa) || 0)
  const r = Math.max(0, Number(retencaoImpostos) || 0)
  return Math.max(0, Math.round((b - d + j + m - r) * 100) / 100)
}

export function normalizarContaPagar(
  raw: any,
  index = 0,
  hojeStr = new Date().toISOString().split('T')[0]
): ContaPagarRecord {
  const unpacked = raw?.dados && typeof raw.dados === 'object' ? { ...raw.dados, ...raw } : { ...raw }
  const vencimento = String(unpacked.vencimento || hojeStr).slice(0, 10)
  const competencia = String(unpacked.competencia || vencimento.slice(0, 7))

  const valorBase = Number(
    unpacked.valorBase ?? unpacked.valorOriginal ?? unpacked.valor ?? 0
  )
  const desconto = Number(unpacked.desconto ?? 0)
  const juros = Number(unpacked.juros ?? 0)
  const multa = Number(unpacked.multa ?? 0)
  const retencaoImpostos = Number(unpacked.retencaoImpostos ?? 0)

  const valor =
    unpacked.valor !== undefined && unpacked.valor !== null
      ? Number(unpacked.valor)
      : calcularValorLiquido(valorBase, desconto, juros, multa, retencaoImpostos)

  let status: ContaPagarStatus = unpacked.status || 'pendente'
  if (status !== 'pago' && status !== 'cancelado') {
    if (vencimento < hojeStr) status = 'vencido'
    else if (status === 'vencido') status = 'pendente'
  }

  const fornecedorNome = String(
    unpacked.fornecedorNome || unpacked.fornecedor || 'Fornecedor Escolar'
  ).trim()

  return {
    id: String(unpacked.id || `CP-${Date.now()}-${index}`),
    codigo: String(unpacked.codigo || `CP-${String(index + 1).padStart(3, '0')}`),
    descricao: String(unpacked.descricao || 'Despesa Operacional Escolar').trim(),
    fornecedorId: unpacked.fornecedorId || undefined,
    fornecedorNome,
    fornecedor: fornecedorNome,
    fornecedorDocumento: unpacked.fornecedorDocumento || undefined,
    categoria: String(unpacked.categoria || CATEGORIAS_ESCOLARES[0].id),
    subcategoria: unpacked.subcategoria || undefined,
    centroCusto: String(unpacked.centroCusto || CENTROS_CUSTO_ESCOLARES[0].id),
    rateio: Array.isArray(unpacked.rateio) ? unpacked.rateio : [],
    planoContasId: unpacked.planoContasId || undefined,
    eventoId: unpacked.eventoId || undefined,
    tipoCusto: (unpacked.tipoCusto as ContaPagarTipoCusto) || 'fixo',
    prioridade:
      unpacked.prioridade === 'normal'
        ? 'media'
        : (unpacked.prioridade as ContaPagarPrioridade) || 'media',
    competencia,
    dataEmissao: String(unpacked.dataEmissao || vencimento).slice(0, 10),
    vencimento,
    dataPagamento: status === 'pago' ? String(unpacked.dataPagamento || vencimento).slice(0, 10) : undefined,
    valorBase: valorBase > 0 ? valorBase : valor,
    desconto,
    juros,
    multa,
    retencaoImpostos,
    detalhesRetencao: unpacked.detalhesRetencao || undefined,
    valor,
    valorPago: status === 'pago' ? Number(unpacked.valorPago ?? valor) : 0,
    status,
    formaPagamento: String(unpacked.formaPagamento || 'PIX'),
    caixaOrigem: unpacked.caixaOrigem || unpacked.caixaNome || undefined,
    numeroDocumento: unpacked.numeroDocumento || undefined,
    tipoDocumento: unpacked.tipoDocumento || 'NFS-e',
    notaFiscal: unpacked.notaFiscal || undefined,
    linhaDigitavel: unpacked.linhaDigitavel || undefined,
    chavePix: unpacked.chavePix || undefined,
    comprovanteUrl: unpacked.comprovanteUrl || unpacked.comprovanteNumero || undefined,
    parcelaAtual: unpacked.parcelaAtual ? Number(unpacked.parcelaAtual) : undefined,
    totalParcelas: unpacked.totalParcelas ? Number(unpacked.totalParcelas) : undefined,
    grupoParcelamentoId: unpacked.grupoParcelamentoId || undefined,
    recorrente: Boolean(unpacked.recorrente),
    frequenciaRecorrencia: unpacked.frequenciaRecorrencia || undefined,
    aprovacaoStatus: unpacked.aprovacaoStatus || 'aprovado',
    aprovadoPor: unpacked.aprovadoPor || undefined,
    observacoes: unpacked.observacoes || unpacked.obs || undefined,
    historico: Array.isArray(unpacked.historico) ? unpacked.historico : [],
    createdAt: unpacked.createdAt || new Date().toISOString(),
    updatedAt: unpacked.updatedAt || new Date().toISOString(),
  }
}

export function openPrintOrdemPagamento(conta: ContaPagarRecord) {
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank', 'width=880,height=720')
  if (!win) return

  const stLabel = STATUS_CONTA_PAGAR_CONFIG[conta.status]?.label || conta.status
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ordem de Pagamento - ${conta.codigo || conta.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 32px; }
    .box { border: 2px solid #0f172a; border-radius: 12px; padding: 24px; max-width: 780px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 20px; font-weight: 900; margin: 0; }
    .sub { font-size: 12px; color: #475569; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
    .cell { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
    .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
    .val { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .tot-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .tot-box { padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right; }
    .tot-liq { background: #ecfdf5; border-color: #10b981; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 48px; text-align: center; font-size: 12px; }
    .sig-line { border-top: 1px solid #0f172a; padding-top: 8px; font-weight: 700; }
    @media print { button { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <div>
        <h1 class="title">ORDEM DE PAGAMENTO ESCOLAR (OP)</h1>
        <div class="sub">Colégio Impacto • Controladoria & Tesouraria Financeira</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:900">${conta.codigo || conta.id}</div>
        <div class="sub">Situação: <strong>${stLabel}</strong></div>
      </div>
    </div>

    <div class="grid">
      <div class="cell">
        <div class="lbl">Favorecido / Credor</div>
        <div class="val">${conta.fornecedorNome}</div>
        <div class="sub">CNPJ/CPF: ${conta.fornecedorDocumento || 'Não informado'}</div>
      </div>
      <div class="cell">
        <div class="lbl">Classificação Orçamentária</div>
        <div class="val">${conta.categoria}</div>
        <div class="sub">Centro de Custo: ${conta.centroCusto}</div>
      </div>
      <div class="cell">
        <div class="lbl">Descrição da Despesa</div>
        <div class="val">${conta.descricao}</div>
        <div class="sub">${conta.tipoDocumento || 'Doc'}: ${conta.numeroDocumento || 'S/N'}</div>
      </div>
      <div class="cell">
        <div class="lbl">Vencimento & Forma de Pagamento</div>
        <div class="val">Venc: ${conta.vencimento?.split('-').reverse().join('/')} • ${conta.formaPagamento}</div>
        <div class="sub">Competência: ${conta.competencia} ${conta.chavePix ? `| PIX: ${conta.chavePix}` : ''}</div>
      </div>
    </div>

    <div class="tot-row">
      <div class="tot-box">
        <div class="lbl">Valor Bruto</div>
        <div class="val">${formatCurrency(conta.valorBase)}</div>
      </div>
      <div class="tot-box">
        <div class="lbl">(-) Descontos / Retenções</div>
        <div class="val">- ${formatCurrency((conta.desconto || 0) + (conta.retencaoImpostos || 0))}</div>
      </div>
      <div class="tot-box">
        <div class="lbl">(+) Juros / Multa</div>
        <div class="val">+ ${formatCurrency((conta.juros || 0) + (conta.multa || 0))}</div>
      </div>
      <div class="tot-box tot-liq">
        <div class="lbl">Valor Líquido Autorizado</div>
        <div class="val" style="font-size:18px;font-weight:900;color:#047857">${formatCurrency(conta.valor)}</div>
      </div>
    </div>

    ${conta.observacoes ? `<div class="cell" style="margin-bottom:18px"><div class="lbl">Observações / Histórico</div><div class="val" style="font-weight:500;font-size:12px">${conta.observacoes}</div></div>` : ''}

    <div class="signatures">
      <div class="sig-line">Emitente / Tesouraria</div>
      <div class="sig-line">Controladoria Financeira</div>
      <div class="sig-line">Diretoria Geral (Autorização)</div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}

export function openPrintBorderoPagamentos(contas: ContaPagarRecord[], tituloPeriodo = 'Programação de Pagamentos') {
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank', 'width=1024,height=768')
  if (!win) return

  const totalBruto = contas.reduce((a, b) => a + (Number(b.valorBase) || 0), 0)
  const totalRetencoes = contas.reduce((a, b) => a + (Number(b.retencaoImpostos) || 0), 0)
  const totalLiquido = contas.reduce((a, b) => a + (Number(b.valor) || 0), 0)

  const rowsHtml = contas
    .map(
      (c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${c.vencimento?.split('-').reverse().join('/')}</strong></td>
        <td><strong>${c.fornecedorNome}</strong><br/><span style="font-size:10px;color:#64748b">${c.fornecedorDocumento || ''}</span></td>
        <td>${c.descricao}<br/><span style="font-size:10px;color:#64748b">${c.categoria} • ${c.centroCusto}</span></td>
        <td>${c.formaPagamento}<br/><span style="font-size:10px;color:#64748b">${c.chavePix || c.numeroDocumento || ''}</span></td>
        <td style="text-align:right">${formatCurrency(c.valorBase)}</td>
        <td style="text-align:right">${formatCurrency(c.retencaoImpostos)}</td>
        <td style="text-align:right;font-weight:800">${formatCurrency(c.valor)}</td>
      </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Borderô de Autorização de Pagamentos - ${tituloPeriodo}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 28px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; }
    td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; vertical-align: top; }
    .summary { margin-top: 18px; display: flex; justify-content: flex-end; gap: 24px; font-size: 13px; background: #f1f5f9; padding: 14px 18px; border-radius: 8px; }
    .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 54px; text-align: center; font-size: 12px; }
    .sig { border-top: 1px solid #0f172a; padding-top: 8px; font-weight: 700; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:20px;font-weight:900">BORDERÔ DE AUTORIZAÇÃO DE PAGAMENTOS</h1>
      <div style="font-size:12px;color:#475569;margin-top:4px">Colégio Impacto • ${tituloPeriodo} • Emitido em ${new Date().toLocaleString('pt-BR')}</div>
    </div>
    <div style="text-align:right;font-size:13px">
      <strong>Total de Títulos:</strong> ${contas.length}<br/>
      <strong>Total Líquido:</strong> ${formatCurrency(totalLiquido)}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Vencimento</th>
        <th>Fornecedor / Credor</th>
        <th>Descrição / Classificação</th>
        <th>Forma / PIX / Doc</th>
        <th style="text-align:right">Valor Bruto</th>
        <th style="text-align:right">Retenções</th>
        <th style="text-align:right">Valor Líquido</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="summary">
    <div>Total Bruto: <strong>${formatCurrency(totalBruto)}</strong></div>
    <div>Retenções Fiscais: <strong>${formatCurrency(totalRetencoes)}</strong></div>
    <div>Total Líquido para Liberação Bancária: <strong style="color:#047857;font-size:15px">${formatCurrency(totalLiquido)}</strong></div>
  </div>

  <div class="sigs">
    <div class="sig">Conferência Tesouraria</div>
    <div class="sig">Visto Controladoria</div>
    <div class="sig">Autorização Diretoria Geral</div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}
