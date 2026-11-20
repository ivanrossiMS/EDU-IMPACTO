/**
 * Utilitários compartilhados para a integração de Portaria / Catracas Control iD.
 */

export function parseBooleanSairSozinho(val: any): boolean | undefined {
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val === 1
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase()
    if (['true', 'sim', 's', '1', 'autorizado'].includes(s)) return true
    if (['false', 'nao', 'não', 'n', '0', 'nao autorizado', 'não autorizado'].includes(s)) return false
  }
  return undefined
}

export function resolveStudentAutorizadoSairSozinho(student: any, d: any = student?.dados || {}): boolean {
  const candidates = [
    student?.autorizadoSairSozinho,
    d?.autorizadoSairSozinho,
    student?.sairSozinho,
    d?.sairSozinho,
    student?.saude?.autorizaSaida,
    d?.saude?.autorizaSaida,
  ]
  for (const c of candidates) {
    const parsed = parseBooleanSairSozinho(c)
    if (parsed !== undefined) return parsed
  }
  return false
}

export function isStudentActiveStatus(status: any): boolean {
  if (status === null || status === undefined || status === '') return true
  const s = String(status).trim().toLowerCase()
  return ['matriculado', 'cursando', 'ativo'].includes(s)
}

export function resolveStudentNumericId(student: any, fallbackId?: string): number | null {
  const candidates = [
    student?.matricula,
    student?.dados?.codigo,
    student?.dados?.matricula,
    student?.dados?.codigoAluno,
    fallbackId ?? student?.id,
  ]
  for (const raw of candidates) {
    if (!raw) continue
    const parsed = parseInt(String(raw).replace(/\D/g, ''), 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return null
}

export function isMaster150Device(dev: { id?: string | null; ip?: string | null; nome?: string | null }): boolean {
  const id = String(dev?.id || '').trim()
  const ip = String(dev?.ip || '').trim()
  const nome = String(dev?.nome || '').toLowerCase()
  return (
    ip === '192.168.1.150' ||
    id === '0M0200/02638E' ||
    id.includes('02638E') ||
    nome.includes('médio') ||
    nome.includes('medio')
  )
}

export function isBidirectional155Device(dev: { id?: string | null; ip?: string | null; nome?: string | null }): boolean {
  const id = String(dev?.id || '').trim()
  const ip = String(dev?.ip || '').trim()
  const nome = String(dev?.nome || '').toLowerCase()
  return (
    ip === '192.168.1.155' ||
    id === '0M0200/02639C' ||
    id.includes('02639C') ||
    (nome.includes('fund1') && nome.includes('principal'))
  )
}

export function isExitBlockingDevice(dev: { id?: string | null; ip?: string | null; nome?: string | null; configuracao?: any }): boolean {
  const sentido = String(dev?.configuracao?.sentido || '').toLowerCase()
  return (
    isMaster150Device(dev) ||
    isBidirectional155Device(dev) ||
    sentido === 'mestre' ||
    sentido === 'ambos'
  )
}
