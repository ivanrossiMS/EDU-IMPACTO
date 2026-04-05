// ============================================================
// IMPACTO EDU — Mock Data Zerado para Hospedagem / Produção
// ============================================================

export const ALUNOS: any[] = []
export const TURMAS: any[] = []
export const FUNCIONARIOS: any[] = []

import { Adiantamento } from './dataContext'
export const ADIANTAMENTOS: Adiantamento[] = []

export const LEADS: any[] = []
export const TITULOS: any[] = []
export const CONTAS_PAGAR: any[] = []

export const DRE_DATA = {
  periodo: 'Jan–Mar 2026',
  receita_bruta: 0,
  deducoes: 0,
  receita_liquida: 0,
  custos_pessoal: 0,
  custos_diretos: 0,
  despesas_adm: 0,
  despesas_marketing: 0,
  despesas_tecnologia: 0,
  depreciacao: 0,
  ebitda: 0,
  resultado_financeiro: 0,
  lucro_liquido: 0,
  margem_liquida: 0,
}

export const RECEITA_DESPESA_MENSAL: any[] = []

export const KPIS = {
  totalAlunos: 0,
  varAlunos: 0,
  receitasMes: 0,
  varReceita: 0,
  inadimplenciaRate: 0,
  varInadimplencia: 0,
  taxaOcupacao: 0,
  varOcupacao: 0,
  novasMatriculas: 0,
  varMatriculas: 0,
  funcionarios: 0,
  varFuncionarios: 0,
  npsScore: 0,
  varNps: 0,
  evasaoRisco: 0,
  varEvasao: 0,
}

export const NOTIFICACOES: any[] = []
export const CONVERSAS: any[] = []
export const COMUNICADOS: any[] = []
export const ALERTAS_CRITICOS: any[] = []
export const ATIVIDADE_RECENTE: any[] = []

export const OCUPACAO_SEGMENTOS = [
  { segmento: 'Educação Infantil', ocupacao: 0, total: 0, matriculados: 0, cor: '#3b82f6' },
  { segmento: 'Fund. I', ocupacao: 0, total: 0, matriculados: 0, cor: '#8b5cf6' },
  { segmento: 'Fund. II', ocupacao: 0, total: 0, matriculados: 0, cor: '#10b981' },
  { segmento: 'Ensino Médio', ocupacao: 0, total: 0, matriculados: 0, cor: '#f59e0b' },
  { segmento: 'EJA', ocupacao: 0, total: 0, matriculados: 0, cor: '#06b6d4' },
]

export const UNIDADES: any[] = []

export const CENSO_STATUS = {
  ano_ref: 2026,
  prazo: '2026-04-14',
  status: 'em_andamento',
  progresso: 0,
  total_alunos: 0,
  preenchidos: 0,
  pendentes: 0,
  inconsistencias: 0,
  validacoes: [
    { campo: 'CPF Aluno', status: 'ok', total: 0, invalidos: 0 },
    { campo: 'Endereço', status: 'ok', total: 0, invalidos: 0 },
    { campo: 'Deficiências', status: 'ok', total: 0, invalidos: 0 },
    { campo: 'Raça/Cor', status: 'ok', total: 0, invalidos: 0 },
    { campo: 'Transporte', status: 'ok', total: 0, invalidos: 0 },
  ]
}

export const PLANOS_AULA: any[] = []
export const AVALIACOES: any[] = []
export const FREQUENCIA_TURMA: any[] = []
export const BI_EVOLUCAO_ALUNOS: any[] = []
export const RISCO_EVASAO_DIST = [
  { nome: 'Baixo', valor: 0, fill: '#10b981' },
  { nome: 'Médio', valor: 0, fill: '#f59e0b' },
  { nome: 'Alto', valor: 0, fill: '#ef4444' },
]
export const PATRIMONIO_ITEMS: any[] = []
