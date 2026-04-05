import { ALUNOS, TURMAS, TITULOS, CONTAS_PAGAR, DRE_DATA, RECEITA_DESPESA_MENSAL, COMUNICADOS } from './data'

// Force memory wipe para deploy (2026-04-05)
export const db = {
  alunos: [...ALUNOS],
  turmas: [...TURMAS],
  titulos: [...TITULOS],
  contas_pagar: [...CONTAS_PAGAR],
  dre: { ...DRE_DATA },
  mensal: [...RECEITA_DESPESA_MENSAL],
  comunicados: [...COMUNICADOS],
  tarefas: [] as any[],
  cfgCentrosCusto: [] as any[],
  funcionarios: [] as any[],
  mantenedores: [] as any[],
  agendamentos: [] as any[],
  leads: [] as any[],
  cfgDisciplinas: [] as any[],
  lancamentosNota: [] as any[],
  frequencias: [] as any[],
  rotinaItems: [] as any[],
  ocorrencias: [] as any[]
}
