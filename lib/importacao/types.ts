export interface SystemFieldDef {
  value: string
  label: string
  category: 'aluno' | 'resp1' | 'resp2' | 'endereco' | 'geral'
  required?: boolean
  description?: string
  aliases: string[]
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  field: string
  message: string
}

export interface RowValidationResult {
  rowIndex: number // 1-based (Excel row number)
  status: 'ready' | 'warning' | 'error'
  issues: ValidationIssue[]
  data: Record<string, any>
  originalRow: any[]
}

export interface ImportBatchRecord {
  id: string
  data: string
  usuario?: string
  total: number
  inseridos: number
  atualizados: number
  erros: number
  status: 'concluido' | 'revertido'
  alunoIdsCriados: string[]
  alunoIdsAtualizados: string[]
  alunosInativados: string[]
  respIdsCriados: string[]
  vinculoIdsCriados: string[]
  snapshotAnterior?: Record<string, any>
}
