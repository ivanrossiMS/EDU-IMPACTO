import { RowValidationResult, ValidationIssue } from './types'
export type { RowValidationResult, ValidationIssue } from './types'


export function excelSerialToDate(serial: number): string | null {
  try {
    // Excel base date: Dec 30 1899 due to 1900 leap year bug
    const utc_days = Math.floor(serial - 25569)
    const date = new Date(utc_days * 86400 * 1000)
    if (isNaN(date.getTime())) return null
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    if (y < 1920 || y > 2030) return null
    return `${y}-${m}-${d}`
  } catch {
    return null
  }
}

export function parseBrazilianDate(val: any): { iso: string | null; formatted: string; valid: boolean } {
  if (val === undefined || val === null || String(val).trim() === '') {
    return { iso: null, formatted: '', valid: true } // Vazio é tolerado se não for obrigatório
  }

  // 1. Se for número serial do Excel
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const iso = excelSerialToDate(val)
    if (iso) {
      const parts = iso.split('-')
      return { iso, formatted: `${parts[2]}/${parts[1]}/${parts[0]}`, valid: true }
    }
  }

  const str = String(val).trim()

  // 2. Se já estiver no formato ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/)
  if (isoMatch) {
    const [_, y, m, d] = isoMatch
    const year = parseInt(y)
    const month = parseInt(m)
    const day = parseInt(d)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1920 && year <= 2030) {
      return { iso: `${y}-${m}-${d}`, formatted: `${d}/${m}/${y}`, valid: true }
    }
  }

  // 3. Se estiver no formato brasileiro DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (brMatch) {
    const [_, dRaw, mRaw, y] = brMatch
    const d = dRaw.padStart(2, '0')
    const m = mRaw.padStart(2, '0')
    const year = parseInt(y)
    const month = parseInt(m)
    const day = parseInt(d)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1920 && year <= 2030) {
      return { iso: `${y}-${m}-${d}`, formatted: `${d}/${m}/${y}`, valid: true }
    }
  }

  return { iso: null, formatted: str, valid: false }
}

export function cleanDigits(val: any): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '')
}

export function formatCpf(val: any): string {
  const digits = cleanDigits(val)
  if (digits.length !== 11) return String(val ?? '')
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export function formatPhone(val: any): string {
  const digits = cleanDigits(val)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`
  }
  return String(val ?? '')
}

export function validateRows(
  rows: any[][],
  headers: string[],
  mapping: Record<string, string>,
  knownTurmas: Array<{ id: string; nome: string }> = []
): {
  results: RowValidationResult[]
  totalReady: number
  totalWarning: number
  totalError: number
  unmatchedTurmas: string[]
} {
  const results: RowValidationResult[] = []
  const unmatchedTurmasSet = new Set<string>()

  // Normalização de turmas do sistema para comparação
  const normalizedKnownTurmas = knownTurmas.map(t => ({
    id: t.id,
    original: t.nome,
    norm: t.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  }))

  rows.forEach((row, rIdx) => {
    // Verificar se linha é totalmente vazia
    const isEmpty = row.every(c => c === undefined || c === null || String(c).trim() === '')
    if (isEmpty) return

    const issues: ValidationIssue[] = []
    const extractedData: Record<string, any> = {}

    // Extrair dados baseados no mapeamento
    headers.forEach((header, cIdx) => {
      const targetField = mapping[header]
      if (!targetField) return
      const cellVal = row[cIdx]
      if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
        extractedData[targetField] = cellVal
      }
    })

    // 1. Validação de Nome do Aluno (OBRIGATÓRIO)
    const nomeAluno = String(extractedData.aluno_nome || '').trim()
    if (!nomeAluno) {
      issues.push({
        type: 'error',
        field: 'aluno_nome',
        message: 'Nome do aluno é obrigatório'
      })
    } else if (nomeAluno.length < 2) {
      issues.push({
        type: 'error',
        field: 'aluno_nome',
        message: 'Nome do aluno é muito curto (mínimo 2 caracteres)'
      })
    }

    // 2. Validação de Data de Nascimento do Aluno
    if (extractedData.aluno_data_nascimento) {
      const parsedDate = parseBrazilianDate(extractedData.aluno_data_nascimento)
      if (!parsedDate.valid) {
        issues.push({
          type: 'warning',
          field: 'aluno_data_nascimento',
          message: `Data de nascimento inválida ("${extractedData.aluno_data_nascimento}"). Use DD/MM/AAAA.`
        })
      } else if (parsedDate.iso) {
        extractedData.aluno_data_nascimento = parsedDate.iso
      }
    }

    // 3. Validação de CPF do Aluno
    if (extractedData.aluno_cpf) {
      const digits = cleanDigits(extractedData.aluno_cpf)
      if (digits.length > 0 && digits.length !== 11) {
        issues.push({
          type: 'warning',
          field: 'aluno_cpf',
          message: `CPF do aluno com tamanho incomum (${digits.length} dígitos em vez de 11)`
        })
      }
    }

    // 4. Validação de CPF dos Responsáveis
    if (extractedData.resp1_cpf) {
      const digits = cleanDigits(extractedData.resp1_cpf)
      if (digits.length > 0 && digits.length !== 11) {
        issues.push({
          type: 'warning',
          field: 'resp1_cpf',
          message: `CPF do Resp. 1 com tamanho incomum (${digits.length} dígitos)`
        })
      }
    }
    if (extractedData.resp2_cpf) {
      const digits = cleanDigits(extractedData.resp2_cpf)
      if (digits.length > 0 && digits.length !== 11) {
        issues.push({
          type: 'warning',
          field: 'resp2_cpf',
          message: `CPF do Resp. 2 com tamanho incomum (${digits.length} dígitos)`
        })
      }
    }

    // 5. Validação de Telefones
    if (extractedData.aluno_telefone) {
      const digits = cleanDigits(extractedData.aluno_telefone)
      if (digits.length > 0 && digits.length < 10) {
        issues.push({
          type: 'warning',
          field: 'aluno_telefone',
          message: 'Telefone do aluno parece incompleto (faltando DDD?)'
        })
      }
    }
    if (extractedData.resp1_telefone) {
      const digits = cleanDigits(extractedData.resp1_telefone)
      if (digits.length > 0 && digits.length < 10) {
        issues.push({
          type: 'warning',
          field: 'resp1_telefone',
          message: 'Telefone do Resp. 1 parece incompleto (faltando DDD?)'
        })
      }
    }

    // 6. Validação e Conciliação de Turma
    if (extractedData.aluno_turma && normalizedKnownTurmas.length > 0) {
      const turmaStr = String(extractedData.aluno_turma).trim()
      const normTurmaStr = turmaStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
      
      const found = normalizedKnownTurmas.find(t => 
        t.norm === normTurmaStr || t.norm.includes(normTurmaStr) || normTurmaStr.includes(t.norm)
      )

      if (!found) {
        unmatchedTurmasSet.add(turmaStr)
        issues.push({
          type: 'warning',
          field: 'aluno_turma',
          message: `Turma "${turmaStr}" não encontrada no sistema (poderá ser conciliada ou criada)`
        })
      }
    }

    const hasErrors = issues.some(i => i.type === 'error')
    const hasWarnings = issues.some(i => i.type === 'warning')

    results.push({
      rowIndex: rIdx + 2, // 1-based + 1 for header
      status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ready',
      issues,
      data: extractedData,
      originalRow: row
    })
  })

  const totalReady = results.filter(r => r.status === 'ready').length
  const totalWarning = results.filter(r => r.status === 'warning').length
  const totalError = results.filter(r => r.status === 'error').length

  return {
    results,
    totalReady,
    totalWarning,
    totalError,
    unmatchedTurmas: Array.from(unmatchedTurmasSet)
  }
}
