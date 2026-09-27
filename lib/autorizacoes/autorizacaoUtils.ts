import { 
  AutorizacaoData, 
  AutorizacaoStats, 
  AutorizacaoResposta, 
  AutorizacaoOpcaoStat 
} from './types'

export function calculateAutorizacaoStats(autorizacao?: AutorizacaoData | null): AutorizacaoStats {
  if (!autorizacao || !Array.isArray(autorizacao.opcoes)) {
    return {
      totalRespostas: 0,
      totalAprovados: 0,
      totalRecusados: 0,
      totalNeutros: 0,
      percentAprovados: 0,
      percentRecusados: 0,
      opcoes: [],
      respostasList: [],
      respostasComObservacoes: []
    }
  }

  const respostasMap = autorizacao.respostas || {}
  const respostasList = Object.values(respostasMap).sort((a, b) => {
    return new Date(b.respondidoEm || 0).getTime() - new Date(a.respondidoEm || 0).getTime()
  })

  const totalRespostas = respostasList.length

  const countsPerOption: Record<string, number> = {}
  autorizacao.opcoes.forEach(op => {
    countsPerOption[op.id] = 0
  })

  let totalAprovados = 0
  let totalRecusados = 0
  let totalNeutros = 0

  respostasList.forEach(r => {
    if (countsPerOption[r.opcaoId] !== undefined) {
      countsPerOption[r.opcaoId] += 1
    }
    if (r.tipoDecisao === 'aprova') {
      totalAprovados += 1
    } else if (r.tipoDecisao === 'recusa') {
      totalRecusados += 1
    } else {
      totalNeutros += 1
    }
  })

  const baseTotal = totalRespostas > 0 ? totalRespostas : 1

  const opcoesStats: AutorizacaoOpcaoStat[] = autorizacao.opcoes.map(op => {
    const count = countsPerOption[op.id] || 0
    const rawPercent = totalRespostas > 0 ? (count / baseTotal) * 100 : 0
    const percent = Math.round(rawPercent * 10) / 10

    return {
      ...op,
      count,
      percent
    }
  })

  const percentAprovados = totalRespostas > 0 ? Math.round((totalAprovados / totalRespostas) * 1000) / 10 : 0
  const percentRecusados = totalRespostas > 0 ? Math.round((totalRecusados / totalRespostas) * 1000) / 10 : 0

  const respostasComObservacoes = respostasList.filter(
    r => typeof r.observacoes === 'string' && r.observacoes.trim().length > 0
  )

  return {
    totalRespostas,
    totalAprovados,
    totalRecusados,
    totalNeutros,
    percentAprovados,
    percentRecusados,
    opcoes: opcoesStats,
    respostasList,
    respostasComObservacoes
  }
}

export function getAutorizacaoVoterKey(usuarioId: string, alunoId?: string | null): string {
  const cleanUser = String(usuarioId || '').trim()
  const cleanAluno = String(alunoId || '').trim()
  if (cleanAluno && cleanAluno !== cleanUser) {
    return `${cleanUser}_${cleanAluno}`
  }
  return cleanUser
}

export function getUserAutorizacaoResposta(
  autorizacao: AutorizacaoData | null | undefined,
  usuarioId: string,
  alunoId?: string | null
): AutorizacaoResposta | null {
  if (!autorizacao || !autorizacao.respostas) return null
  const key = getAutorizacaoVoterKey(usuarioId, alunoId)
  if (autorizacao.respostas[key]) return autorizacao.respostas[key]

  // Fallbacks: check by key alone or by alunoId
  if (usuarioId && autorizacao.respostas[usuarioId]) return autorizacao.respostas[usuarioId]
  if (alunoId && autorizacao.respostas[alunoId]) return autorizacao.respostas[alunoId]

  return null
}

export function isAutorizacaoClosed(autorizacao?: AutorizacaoData | null): boolean {
  if (!autorizacao) return true
  if (autorizacao.encerrada) return true
  if (autorizacao.dataLimite) {
    const exp = new Date(autorizacao.dataLimite).getTime()
    if (!isNaN(exp) && Date.now() > exp) return true
  }
  return false
}

export function formatTimeRemaining(dataLimite?: string | null): string | null {
  if (!dataLimite) return null
  const exp = new Date(dataLimite).getTime()
  if (isNaN(exp)) return null
  const diff = exp - Date.now()
  if (diff <= 0) return 'Prazo encerrado'

  const mins = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days > 1) return `Encerra em ${days} dias`
  if (days === 1) return `Encerra amanhã`
  if (hours >= 1) return `Encerra em ${hours}h`
  if (mins >= 1) return `Encerra em ${mins} min`
  return 'Encerra em instantes'
}

export function generateDigitalSignatureHash(payload: {
  autorizacaoId: string
  usuarioId: string
  alunoId?: string
  opcaoId: string
  timestamp: string
}): string {
  const raw = `${payload.autorizacaoId}-${payload.usuarioId}-${payload.alunoId || 'none'}-${payload.opcaoId}-${payload.timestamp}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `IMP-AUT-${hex}-${randomPart}`
}

export function formatDateTimeBR(dateString?: string | null): string {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return String(dateString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} às ${hours}:${mins}`
  } catch (_) {
    return String(dateString)
  }
}

/**
 * Validação oficial de CPF brasileiro (11 dígitos e dígitos verificadores)
 */
export function validarCPF(cpf: string): boolean {
  const c = String(cpf || '').replace(/\D/g, '')
  if (c.length !== 11) return false
  if (/^(\d)\1+$/.test(c)) return false // Elimina sequências inválidas conhecidas (111.111.111-11, etc.)

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(c[i], 10) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(c[9], 10)) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(c[i], 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(c[10], 10)
}

/**
 * Aplica máscara 000.000.000-00 dinamicamente
 */
export function formatarCPF(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}
