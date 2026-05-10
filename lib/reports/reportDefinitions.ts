// ═══════════════════════════════════════════════════════════
// CENTRAL DE RELATÓRIOS — Definições Declarativas
// ═══════════════════════════════════════════════════════════

export type ReportCategory = 'financeiro' | 'pedagogico' | 'administrativo' | 'personalizado'
export type ChartType = 'bar' | 'pie' | 'line' | 'area' | 'stacked-bar' | 'none'

export interface FilterDef {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'dateRange' | 'number' | 'boolean' | 'multi-select'
  options?: { value: string; label: string }[]
  placeholder?: string
  defaultValue?: string
}

export interface ColumnDef {
  key: string
  label: string
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'percent' | 'badge'
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: number
  aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max'
  badgeColors?: Record<string, string>
}

export interface ReportDefinition {
  slug: string
  name: string
  description: string
  category: ReportCategory
  icon: string
  source: string
  availableFilters: FilterDef[]
  availableColumns: ColumnDef[]
  defaultColumns: string[]
  defaultSort: { field: string; dir: 'asc' | 'desc' }
  chartType: ChartType
  chartDataKey?: string
  chartCategoryKey?: string
  kpiFields?: string[]
}

// ─── Shared filter definitions ───────────────────────────────

const F_UNIDADE: FilterDef = { key: 'unidade', label: 'Unidade', type: 'text', placeholder: 'Todas' }
const F_ANO: FilterDef = { key: 'anoLetivo', label: 'Ano Letivo', type: 'select', options: [{ value: '2026', label: '2026' }, { value: '2025', label: '2025' }, { value: '2024', label: '2024' }], defaultValue: '2026' }
const F_STATUS_MAT: FilterDef = { key: 'statusMatricula', label: 'Status Matrícula', type: 'select', options: [{ value: '', label: 'Todos' }, { value: 'Ativo', label: 'Ativo' }, { value: 'Inativo', label: 'Inativo' }, { value: 'Trancado', label: 'Trancado' }, { value: 'Cancelado', label: 'Cancelado' }] }
const F_TURMA: FilterDef = { key: 'turma', label: 'Turma', type: 'text', placeholder: 'Todas' }
const F_SERIE: FilterDef = { key: 'serie', label: 'Série', type: 'text', placeholder: 'Todas' }
const F_TURNO: FilterDef = { key: 'turno', label: 'Turno', type: 'select', options: [{ value: '', label: 'Todos' }, { value: 'Manhã', label: 'Manhã' }, { value: 'Tarde', label: 'Tarde' }, { value: 'Integral', label: 'Integral' }, { value: 'Noite', label: 'Noite' }] }
const F_DT_INI: FilterDef = { key: 'dataInicio', label: 'Data Início', type: 'date' }
const F_DT_FIM: FilterDef = { key: 'dataFim', label: 'Data Fim', type: 'date' }
const F_STATUS_FIN: FilterDef = { key: 'statusFinanceiro', label: 'Status Financeiro', type: 'select', options: [{ value: '', label: 'Todos' }, { value: 'pago', label: 'Pago' }, { value: 'pendente', label: 'Pendente' }, { value: 'vencido', label: 'Vencido' }, { value: 'cancelado', label: 'Cancelado' }, { value: 'renegociado', label: 'Renegociado' }] }
const F_FORMA_PAGTO: FilterDef = { key: 'formaPagamento', label: 'Forma de Pagamento', type: 'select', options: [{ value: '', label: 'Todas' }, { value: 'Dinheiro', label: 'Dinheiro' }, { value: 'PIX', label: 'PIX' }, { value: 'Cartão Crédito', label: 'Cartão Crédito' }, { value: 'Cartão Débito', label: 'Cartão Débito' }, { value: 'Boleto', label: 'Boleto' }, { value: 'Transferência', label: 'Transferência' }] }
const F_BUSCA: FilterDef = { key: 'busca', label: 'Buscar', type: 'text', placeholder: 'Nome, código...' }
const F_SEXO: FilterDef = { key: 'sexo', label: 'Sexo', type: 'select', options: [{ value: '', label: 'Todos' }, { value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }] }
const F_MES_ANIV: FilterDef = { key: 'mesAniversario', label: 'Mês Aniversário', type: 'select', options: [{ value: '', label: 'Todos' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString('pt-BR', { month: 'long' }) }))] }

// ─── Shared column definitions ──────────────────────────────

const C_COD: ColumnDef = { key: 'codigo', label: 'Código', type: 'text', sortable: true, width: 80 }
const C_NOME: ColumnDef = { key: 'nome', label: 'Nome', type: 'text', sortable: true }
const C_TURMA: ColumnDef = { key: 'turma', label: 'Turma', type: 'text', sortable: true, width: 120 }
const C_SERIE: ColumnDef = { key: 'serie', label: 'Série', type: 'text', sortable: true, width: 100 }
const C_TURNO: ColumnDef = { key: 'turno', label: 'Turno', type: 'text', sortable: true, width: 80 }
const C_UNIDADE: ColumnDef = { key: 'unidade', label: 'Unidade', type: 'text', sortable: true, width: 120 }
const C_STATUS: ColumnDef = { key: 'status', label: 'Status', type: 'badge', sortable: true, width: 100, badgeColors: { matriculado: '#10b981', Ativo: '#10b981', ativo: '#10b981', Inativo: '#ef4444', Trancado: '#f59e0b', Cancelado: '#6b7280' } }
const C_DT_NASC: ColumnDef = { key: 'dataNascimento', label: 'Dt. Nascimento', type: 'date', sortable: true, width: 110 }
const C_EMAIL: ColumnDef = { key: 'email', label: 'E-mail', type: 'text', width: 180 }
const C_TEL: ColumnDef = { key: 'telefone', label: 'Telefone', type: 'text', width: 120 }

// Financial columns
const C_VALOR: ColumnDef = { key: 'valor', label: 'Valor', type: 'currency', sortable: true, align: 'right', width: 100, aggregate: 'sum' }
const C_DESCONTO: ColumnDef = { key: 'desconto', label: 'Desconto', type: 'currency', sortable: true, align: 'right', width: 100, aggregate: 'sum' }
const C_JUROS: ColumnDef = { key: 'juros', label: 'Juros', type: 'currency', align: 'right', width: 90, aggregate: 'sum' }
const C_MULTA: ColumnDef = { key: 'multa', label: 'Multa', type: 'currency', align: 'right', width: 90, aggregate: 'sum' }
const C_VALOR_PAGO: ColumnDef = { key: 'valorPago', label: 'Valor Pago', type: 'currency', sortable: true, align: 'right', width: 110, aggregate: 'sum' }
const C_VENCIMENTO: ColumnDef = { key: 'vencimento', label: 'Vencimento', type: 'date', sortable: true, width: 100 }
const C_DT_PAGTO: ColumnDef = { key: 'dataPagamento', label: 'Dt. Pagamento', type: 'date', sortable: true, width: 110 }
const C_FORMA_PAGTO: ColumnDef = { key: 'formaPagamento', label: 'Forma Pagto.', type: 'text', sortable: true, width: 110 }
const C_PARCELA: ColumnDef = { key: 'parcela', label: 'Parcela', type: 'text', width: 70 }
const C_EVENTO: ColumnDef = { key: 'evento', label: 'Evento', type: 'text', sortable: true, width: 140 }
const C_COMPETENCIA: ColumnDef = { key: 'competencia', label: 'Competência', type: 'text', sortable: true, width: 100 }
const C_SALDO: ColumnDef = { key: 'saldo', label: 'Saldo', type: 'currency', align: 'right', width: 100, aggregate: 'sum' }
const C_STATUS_FIN: ColumnDef = { key: 'statusFinanceiro', label: 'Status', type: 'badge', sortable: true, width: 90, badgeColors: { pago: '#10b981', pendente: '#f59e0b', vencido: '#ef4444', cancelado: '#6b7280', renegociado: '#8b5cf6' } }
const C_RESP_FIN: ColumnDef = { key: 'responsavelFinanceiro', label: 'Resp. Financeiro', type: 'text', sortable: true, width: 160 }
const C_CPF_RESP: ColumnDef = { key: 'cpfResponsavel', label: 'CPF Resp.', type: 'text', width: 120 }

// ═══════════════════════════════════════════════════════════
// REPORT DEFINITIONS
// ═══════════════════════════════════════════════════════════

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  // ─── FINANCEIRO ────────────────────────────────────────
  {
    slug: 'inadimplentes',
    name: 'Alunos Inadimplentes',
    description: 'Alunos com parcelas vencidas — por mês e por responsável, com evento, juros, multa e desconto',
    category: 'financeiro',
    icon: '💳',
    source: 'financeiro_inadimplentes',
    availableFilters: [F_BUSCA, F_UNIDADE, F_ANO, F_TURMA, F_SERIE, F_DT_INI, F_DT_FIM],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_SERIE, C_UNIDADE, C_RESP_FIN, C_EVENTO, C_PARCELA, C_COMPETENCIA, C_VENCIMENTO, C_VALOR, C_DESCONTO, C_JUROS, C_MULTA, C_SALDO, C_STATUS_FIN],
    defaultColumns: ['codigo', 'nome', 'turma', 'responsavelFinanceiro', 'evento', 'parcela', 'vencimento', 'valor', 'desconto', 'juros', 'multa', 'saldo'],
    defaultSort: { field: 'vencimento', dir: 'asc' },
    chartType: 'bar',
    chartDataKey: 'saldo',
    chartCategoryKey: 'nome',
  },
  {
    slug: 'ticket-medio',
    name: 'Ticket Médio (ARPU)',
    description: 'Dashboard executivo C-Level — Ticket médio global, lucratividade de turmas e faturamento por nível de ensino',
    category: 'financeiro',
    icon: '💎',
    source: '', // Custom page
    availableFilters: [],
    availableColumns: [],
    defaultColumns: [],
    defaultSort: { field: 'nome', dir: 'asc' },
    chartType: 'none',
  },
  {
    slug: 'descontos-concedidos',
    name: 'Descontos Concedidos',
    description: 'Relatório de descontos e bolsas aplicados',
    category: 'financeiro',
    icon: '🏷️',
    source: 'financeiro_descontos',
    availableFilters: [F_BUSCA, F_UNIDADE, F_ANO, F_TURMA, F_DT_INI, F_DT_FIM],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_SERIE, C_EVENTO, C_PARCELA, C_VALOR, C_DESCONTO, C_VALOR_PAGO, C_COMPETENCIA],
    defaultColumns: ['codigo', 'nome', 'turma', 'evento', 'valor', 'desconto', 'valorPago'],
    defaultSort: { field: 'desconto', dir: 'desc' },
    chartType: 'pie',
    chartDataKey: 'desconto',
    chartCategoryKey: 'turma',
  },
  {
    slug: 'previsao-recebimentos',
    name: 'Previsão de Recebimentos',
    description: 'Parcelas pendentes agrupadas por vencimento',
    category: 'financeiro',
    icon: '📈',
    source: 'financeiro_previsao',
    availableFilters: [F_UNIDADE, F_ANO, F_TURMA, F_DT_INI, F_DT_FIM],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_EVENTO, C_PARCELA, C_VENCIMENTO, C_VALOR, C_DESCONTO, C_SALDO, C_STATUS_FIN],
    defaultColumns: ['nome', 'turma', 'vencimento', 'valor', 'saldo', 'statusFinanceiro'],
    defaultSort: { field: 'vencimento', dir: 'asc' },
    chartType: 'line',
    chartDataKey: 'valor',
    chartCategoryKey: 'vencimento',
  },
  {
    slug: 'recebimentos-data',
    name: 'Recebimentos por Data',
    description: 'Pagamentos recebidos em período específico',
    category: 'financeiro',
    icon: '💰',
    source: 'financeiro_recebimentos',
    availableFilters: [F_BUSCA, F_UNIDADE, F_ANO, F_TURMA, F_DT_INI, F_DT_FIM, F_FORMA_PAGTO],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_RESP_FIN, C_EVENTO, C_PARCELA, C_VENCIMENTO, C_DT_PAGTO, C_VALOR, C_DESCONTO, C_JUROS, C_MULTA, C_VALOR_PAGO, C_FORMA_PAGTO],
    defaultColumns: ['nome', 'turma', 'dataPagamento', 'valor', 'desconto', 'valorPago', 'formaPagamento'],
    defaultSort: { field: 'dataPagamento', dir: 'desc' },
    chartType: 'bar',
    chartDataKey: 'valorPago',
    chartCategoryKey: 'dataPagamento',
  },
  {
    slug: 'baixas-forma-pagamento',
    name: 'Baixas por Forma de Pagamento',
    description: 'Agrupamento de baixas por método de pagamento',
    category: 'financeiro',
    icon: '💳',
    source: 'financeiro_recebimentos',
    availableFilters: [F_UNIDADE, F_ANO, F_DT_INI, F_DT_FIM, F_FORMA_PAGTO],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_FORMA_PAGTO, C_VALOR_PAGO, C_DT_PAGTO, C_PARCELA],
    defaultColumns: ['nome', 'formaPagamento', 'valorPago', 'dataPagamento'],
    defaultSort: { field: 'formaPagamento', dir: 'asc' },
    chartType: 'pie',
    chartDataKey: 'valorPago',
    chartCategoryKey: 'formaPagamento',
  },
  {
    slug: 'extrato',
    name: 'Extrato Financeiro',
    description: 'Extrato completo por aluno ou responsável — débitos, pagamentos e declaração de crédito',
    category: 'financeiro',
    icon: '📊',
    source: 'financeiro_extrato',
    availableFilters: [F_BUSCA, F_UNIDADE, F_ANO, F_TURMA, F_DT_INI, F_DT_FIM, F_STATUS_FIN],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_EVENTO, C_PARCELA, C_COMPETENCIA, C_VENCIMENTO, C_VALOR, C_DESCONTO, C_JUROS, C_MULTA, C_VALOR_PAGO, C_SALDO, C_DT_PAGTO, C_FORMA_PAGTO, C_STATUS_FIN, C_RESP_FIN],
    defaultColumns: ['nome', 'evento', 'parcela', 'vencimento', 'valor', 'desconto', 'valorPago', 'saldo', 'statusFinanceiro'],
    defaultSort: { field: 'vencimento', dir: 'asc' },
    chartType: 'none',
  },

  {
    slug: 'fluxo-recebimentos',
    name: 'Fluxo de Recebimentos Mensal',
    description: 'Painel completo de recebimentos, inadimplência, fluxo de caixa e análise financeira — KPIs, gráficos, tabela premium e exportação',
    category: 'financeiro',
    icon: '📊',
    source: 'financeiro_recebimentos',
    availableFilters: [F_UNIDADE, F_ANO, F_DT_INI, F_DT_FIM],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_DT_PAGTO, C_VALOR_PAGO, C_FORMA_PAGTO, C_COMPETENCIA],
    defaultColumns: ['nome', 'dataPagamento', 'valorPago', 'formaPagamento'],
    defaultSort: { field: 'dataPagamento', dir: 'asc' },
    chartType: 'area',
    chartDataKey: 'valorPago',
    chartCategoryKey: 'dataPagamento',
  },
  {
    slug: 'mapa-recebimento',
    name: 'Mapa de Recebimento',
    description: 'Visão matricial ampla de status cruzados entre alunos e competências.',
    category: 'financeiro',
    icon: '🗺️',
    source: 'financeiro_recebimentos',
    availableFilters: [F_UNIDADE, F_ANO, F_TURMA, F_DT_INI, F_DT_FIM],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_EVENTO, C_PARCELA, C_VENCIMENTO, C_VALOR, C_DESCONTO, C_SALDO, C_STATUS_FIN],
    defaultColumns: ['nome', 'turma', 'vencimento', 'valor', 'saldo', 'statusFinanceiro'],
    defaultSort: { field: 'vencimento', dir: 'asc' },
    chartType: 'none',
  },


  // ─── PEDAGÓGICO ────────────────────────────────────────
  {
    slug: 'progressao-parcial',
    name: 'Progressão Parcial',
    description: 'Relatório de alunos cursando Progressão Parcial e Dependência',
    category: 'pedagogico',
    icon: '📖',
    source: 'alunos_progressao',
    availableFilters: [
      F_ANO, F_SERIE, F_TURNO
    ],
    availableColumns: [
      C_COD, C_NOME, C_TURMA, C_SERIE, C_TURNO, C_UNIDADE, C_STATUS
    ],
    defaultColumns: ['codigo', 'nome', 'turma', 'serie', 'turno'],
    defaultSort: { field: 'nome', dir: 'asc' },
    chartType: 'none',
  },
  {
    slug: 'relacao-alunos',
    name: 'Relação de Alunos',
    description: 'Listagem completa de alunos matriculados',
    category: 'pedagogico',
    icon: '📝',
    source: 'alunos',
    availableFilters: [F_BUSCA, F_UNIDADE, F_ANO, F_TURMA, F_SERIE, F_TURNO, F_STATUS_MAT, F_SEXO],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_SERIE, C_TURNO, C_UNIDADE, C_DT_NASC, C_EMAIL, C_TEL, C_STATUS, C_RESP_FIN],
    defaultColumns: ['codigo', 'nome', 'turma', 'serie', 'turno', 'status'],
    defaultSort: { field: 'nome', dir: 'asc' },
    chartType: 'bar',
    chartDataKey: 'count',
    chartCategoryKey: 'turma',
  },
  {
    slug: 'alunos-turma',
    name: 'Alunos por Turma',
    description: 'Quantidade de alunos por turma',
    category: 'pedagogico',
    icon: '🏫',
    source: 'alunos',
    availableFilters: [F_UNIDADE, F_ANO, F_TURMA, F_SERIE, F_TURNO, F_STATUS_MAT],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_SERIE, C_TURNO, C_UNIDADE, C_STATUS],
    defaultColumns: ['codigo', 'nome', 'turma', 'serie', 'turno', 'status'],
    defaultSort: { field: 'turma', dir: 'asc' },
    chartType: 'bar',
    chartDataKey: 'count',
    chartCategoryKey: 'turma',
  },
  {
    slug: 'aniversariantes',
    name: 'Aniversariantes',
    description: 'Alunos aniversariantes por mês',
    category: 'pedagogico',
    icon: '🎂',
    source: 'alunos',
    availableFilters: [F_BUSCA, F_UNIDADE, F_TURMA, F_SERIE, F_MES_ANIV],
    availableColumns: [C_COD, C_NOME, C_DT_NASC, { key: 'idade', label: 'Idade', type: 'number', sortable: true, width: 60 }, C_TURMA, C_SERIE, C_TEL, C_EMAIL],
    defaultColumns: ['codigo', 'nome', 'dataNascimento', 'idade', 'turma', 'telefone'],
    defaultSort: { field: 'dataNascimento', dir: 'asc' },
    chartType: 'bar',
    chartDataKey: 'count',
    chartCategoryKey: 'mes',
  },
  {
    slug: 'nao-rematriculados',
    name: 'Não Rematriculados',
    description: 'Alunos do ano anterior sem matrícula no ano atual',
    category: 'pedagogico',
    icon: '⚠️',
    source: 'alunos_nao_rematriculados',
    availableFilters: [F_BUSCA, F_UNIDADE, F_TURMA, F_SERIE],
    availableColumns: [C_COD, C_NOME, C_TURMA, C_SERIE, C_TURNO, C_UNIDADE, C_TEL, C_EMAIL, C_RESP_FIN],
    defaultColumns: ['codigo', 'nome', 'turma', 'serie', 'telefone', 'responsavelFinanceiro'],
    defaultSort: { field: 'nome', dir: 'asc' },
    chartType: 'pie',
    chartDataKey: 'count',
    chartCategoryKey: 'serie',
  },
  {
    slug: 'mapa-turmas',
    name: 'Mapa Geral de Turmas',
    description: 'Capacidade e ocupação por turma',
    category: 'pedagogico',
    icon: '🗺️',
    source: 'turmas',
    availableFilters: [F_UNIDADE, F_ANO, F_SERIE, F_TURNO],
    availableColumns: [
      { key: 'codigo', label: 'Código', type: 'text', sortable: true, width: 80 },
      { key: 'nome', label: 'Turma', type: 'text', sortable: true },
      { key: 'serie', label: 'Série', type: 'text', sortable: true, width: 100 },
      { key: 'turno', label: 'Turno', type: 'text', width: 80 },
      { key: 'professor', label: 'Professor', type: 'text', width: 150 },
      { key: 'sala', label: 'Sala', type: 'text', width: 80 },
      { key: 'capacidade', label: 'Capacidade', type: 'number', align: 'right', width: 90 },
      { key: 'matriculados', label: 'Matriculados', type: 'number', align: 'right', width: 100, aggregate: 'sum' },
      { key: 'vagas', label: 'Vagas', type: 'number', align: 'right', width: 70 },
      { key: 'ocupacao', label: 'Ocupação', type: 'percent', align: 'right', width: 80 },
    ],
    defaultColumns: ['nome', 'serie', 'turno', 'professor', 'capacidade', 'matriculados', 'vagas', 'ocupacao'],
    defaultSort: { field: 'nome', dir: 'asc' },
    chartType: 'bar',
    chartDataKey: 'matriculados',
    chartCategoryKey: 'nome',
  },

  {
    slug: 'ocorrencias',
    name: 'Ocorrências Disciplinares',
    description: 'Relatório de ocorrências registradas',
    category: 'pedagogico',
    icon: '📎',
    source: 'ocorrencias',
    availableFilters: [F_BUSCA, F_UNIDADE, F_TURMA, F_DT_INI, F_DT_FIM],
    availableColumns: [
      { key: 'alunoNome', label: 'Aluno', type: 'text', sortable: true },
      { key: 'tipoNome', label: 'Tipo', type: 'text', sortable: true, width: 120 },
      { key: 'descricao', label: 'Descrição', type: 'text' },
      { key: 'data', label: 'Data', type: 'date', sortable: true, width: 100 },
      { key: 'status', label: 'Status', type: 'badge', width: 90, badgeColors: { aberta: '#f59e0b', resolvida: '#10b981', fechada: '#6b7280' } },
    ],
    defaultColumns: ['alunoNome', 'tipoNome', 'descricao', 'data', 'status'],
    defaultSort: { field: 'data', dir: 'desc' },
    chartType: 'bar',
    chartDataKey: 'count',
    chartCategoryKey: 'tipoNome',
  },

  {
    slug: 'alunos-faltosos',
    name: 'Relação de Alunos Faltosos',
    description: 'Relação de absenteísmo, projeção de faltas e lista nominal de alunos críticos',
    category: 'pedagogico',
    icon: '📉',
    source: '', // Custom page
    availableFilters: [],
    availableColumns: [],
    defaultColumns: [],
    defaultSort: { field: 'nome', dir: 'asc' },
    chartType: 'none',
  },

]

export function getReportBySlug(slug: string): ReportDefinition | undefined {
  return REPORT_DEFINITIONS.find(r => r.slug === slug)
}

export function getReportsByCategory(category: ReportCategory): ReportDefinition[] {
  return REPORT_DEFINITIONS.filter(r => r.category === category)
}
