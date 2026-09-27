import { EnqueteData, EnqueteStats, EnqueteVoto } from './types'

export function calculateEnqueteStats(enquete?: EnqueteData | null): EnqueteStats {
  if (!enquete || !Array.isArray(enquete.opcoes)) {
    return {
      totalVotantes: 0,
      totalVotos: 0,
      opcoes: [],
      hasWinningOption: false
    }
  }

  const votosMap = enquete.votos || {}
  const votosList = Object.values(votosMap)
  const totalVotantes = votosList.length

  // Counts per option
  const countsPerOption: Record<string, number> = {}
  enquete.opcoes.forEach(op => {
    countsPerOption[op.id] = 0
  })

  let totalVotos = 0
  votosList.forEach(v => {
    if (Array.isArray(v.opcoesIds)) {
      v.opcoesIds.forEach(opId => {
        if (countsPerOption[opId] !== undefined) {
          countsPerOption[opId] += 1
          totalVotos += 1
        }
      })
    }
  })

  // Find max votes to mark winners
  let maxCount = 0
  enquete.opcoes.forEach(op => {
    const c = countsPerOption[op.id] || 0
    if (c > maxCount) maxCount = c
  })

  const baseTotal = totalVotantes > 0 ? totalVotantes : 1

  const opcoesStats = enquete.opcoes.map(op => {
    const count = countsPerOption[op.id] || 0
    const rawPercent = totalVotantes > 0 ? (count / baseTotal) * 100 : 0
    const percent = Math.round(rawPercent * 10) / 10

    return {
      ...op,
      count,
      percent,
      isWinner: maxCount > 0 && count === maxCount
    }
  })

  return {
    totalVotantes,
    totalVotos,
    opcoes: opcoesStats,
    hasWinningOption: maxCount > 0
  }
}

export function getVoterKey(usuarioId: string, alunoId?: string | null): string {
  const cleanUser = String(usuarioId || '').trim()
  const cleanAluno = String(alunoId || '').trim()
  if (cleanAluno && cleanAluno !== cleanUser) {
    return `${cleanUser}_${cleanAluno}`
  }
  return cleanUser
}

export function getUserVote(
  enquete: EnqueteData | null | undefined,
  usuarioId: string,
  alunoId?: string | null
): EnqueteVoto | null {
  if (!enquete || !enquete.votos) return null
  const key = getVoterKey(usuarioId, alunoId)
  if (enquete.votos[key]) return enquete.votos[key]

  // Fallback: check by usuarioId alone or by alunoId
  if (usuarioId && enquete.votos[usuarioId]) return enquete.votos[usuarioId]
  if (alunoId && enquete.votos[alunoId]) return enquete.votos[alunoId]

  return null
}

export function isEnqueteClosed(enquete?: EnqueteData | null): boolean {
  if (!enquete) return true
  if (enquete.encerrada) return true
  if (enquete.dataExpiracao) {
    const exp = new Date(enquete.dataExpiracao).getTime()
    if (!isNaN(exp) && Date.now() > exp) return true
  }
  return false
}

export function formatTimeRemaining(dataExpiracao?: string | null): string | null {
  if (!dataExpiracao) return null
  const exp = new Date(dataExpiracao).getTime()
  if (isNaN(exp)) return null
  const diff = exp - Date.now()
  if (diff <= 0) return 'Encerrada'

  const mins = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days > 1) return `Encerra em ${days} dias`
  if (days === 1) return `Encerra amanhã`
  if (hours >= 1) return `Encerra em ${hours}h`
  if (mins >= 1) return `Encerra em ${mins} min`
  return 'Encerra em instantes'
}
