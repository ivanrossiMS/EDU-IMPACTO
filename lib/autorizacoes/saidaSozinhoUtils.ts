export const SCHOOL_TIMEZONE = 'America/Campo_Grande'

export type TipoAssinaturaSaida = 'manual' | 'caligrafica' | 'institucional'

export interface AutorizacaoSaidaComprovante {
  protocolo: string
  hashVerificacao: string
  acao: 'AUTORIZAR_SAIDA_SOZINHO' | 'DESAUTORIZAR_SAIDA_SOZINHO'
  autorizado: boolean
  dataHoraIso: string
  dataHoraFormatada: string
  alunoId: string
  alunoNome: string
  alunoMatricula?: string
  assinanteId?: string
  assinanteNome: string
  assinanteParentesco?: string
  assinanteEmail?: string
  assinanteCpfMascarado?: string
  tipoAssinatura: TipoAssinaturaSaida
  estiloCaligrafico?: string
  assinaturaTexto?: string
  assinaturaSvgPath?: string | null
  assinaturaBase64?: string | null
  observacoes?: string
  origem?: 'agenda_digital' | 'gestao_alunos'
  termoAceite?: string
  previousAutorizado?: boolean
}

export function formatDateTimeSchoolBR(isoDate?: string | null): string {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) return String(isoDate)
    const data = d.toLocaleDateString('pt-BR', {
      timeZone: SCHOOL_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const hora = d.toLocaleTimeString('pt-BR', {
      timeZone: SCHOOL_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${data} às ${hora}`
  } catch {
    return String(isoDate)
  }
}

/**
 * Sanitiza um path SVG gerado pela área de assinatura manual para conter exclusivamente
 * comandos vetoriais seguros (M, L, Q) e coordenadas numéricas.
 */
export function sanitizeSvgSignaturePath(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 20000) return null
  if (!/^[MLQ0-9.,\s-]+$/.test(trimmed)) return null
  if (!trimmed.startsWith('M')) return null
  return trimmed
}

/**
 * Mascara CPF para exibição segura no comprovante (***.XXX.XXX-**).
 */
export function maskCpfDisplay(cpf?: string | null): string {
  const digits = String(cpf || '').replace(/\D/g, '')
  if (digits.length !== 11) return ''
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

/**
 * Normaliza a URL Data Base64 de assinatura PNG/JPEG para evitar payloads malformados ou excessivos.
 */
export function sanitizeSignatureDataUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length > 250_000) return null
  if (
    !trimmed.startsWith('data:image/png;base64,') &&
    !trimmed.startsWith('data:image/jpeg;base64,')
  ) {
    return null
  }
  return trimmed
}
