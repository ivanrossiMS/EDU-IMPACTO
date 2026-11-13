import { BookOpen, FileSignature, PenTool, type LucideIcon } from 'lucide-react'
import { getDerivedStatus, isQuestionForRequisicao } from '@/lib/utils'

export type EvaluationType = 'Prova' | 'Simulado' | 'Redação'

export type EvaluationStatus =
  | 'aguardando'
  | 'em_revisao'
  | 'aprovado'
  | 'publicado'
  | 'rejeitado'

export interface PlainCalendarParts {
  year: number
  month: number
  day: number
}

export interface DeadlineUrgency {
  state: 'overdue' | 'today' | 'soon' | 'upcoming' | 'none'
  label: string
  formatted: string
  daysLeft: number | null
}

export interface RequisicaoProgress {
  total: number
  submitted: number
  approved: number
  rejected: number
  pending: number
  percent: number
  submittedNames: string[]
  missingNames: string[]
  rejectedNames: string[]
}

export interface NormalizedEvaluation {
  id: string
  key: string
  type: EvaluationType
  titulo: string
  status: string
  isAdaptada: boolean
  seriesText: string
  disciplinas: string[]
  bimestreId: string
  bimestreName: string
  criadoPorNome: string
  createdAt: string
  envioIso: string | null
  dataAplicacao: string | null
  dataLimiteUpload: string | null
  deadline: DeadlineUrgency
  progress: RequisicaoProgress
  detailHref: string
  editHref: string
  adaptHref: string | null
}

export interface ProfessorTaskItem {
  id: string
  parentId: string
  type: EvaluationType
  title: string
  disciplina: string
  bimestre: string
  bimestreId?: string
  prazo: string | null
  deadline: DeadlineUrgency
  statusReq: string
  enviadoEm: string | null
  link: string
  qtdQuestoes?: number
  seriesText?: string
  dataAplicacao?: string | null
  observacoes?: string
}

export interface BimestreInfo {
  id: string
  nome: string
  ano_letivo?: string
  data_fim?: string
  data_inicio?: string
  status?: string
}

/**
 * Encontra o último bimestre do ano a partir de uma lista de bimestres.
 * Ordena considerando:
 * 1. Ano Letivo mais recente (ano_letivo ou extraído do nome/data_fim)
 * 2. Maior número de bimestre (ex.: 4º > 3º > 2º > 1º)
 * 3. data_fim mais tardia no ano
 */
export function findLastBimestreOfYear(bimestres: BimestreInfo[]): string | null {
  if (!bimestres || bimestres.length === 0) return null

  const parseBim = (b: BimestreInfo) => {
    let year = 0
    if (b.ano_letivo) {
      const parsed = parseInt(String(b.ano_letivo).trim(), 10)
      if (!isNaN(parsed)) year = parsed
    }
    if (!year && b.nome) {
      const ym = b.nome.match(/\b(20\d{2})\b/)
      if (ym) year = parseInt(ym[1], 10)
    }
    if (!year && b.data_fim) {
      const ym = b.data_fim.match(/\b(20\d{2})\b/)
      if (ym) year = parseInt(ym[1], 10)
    }

    let num = 0
    const nm = b.nome?.match(/(\d+)\s*[º°ªa]/i)
    if (nm) {
      num = parseInt(nm[1], 10)
    }

    const dateVal = b.data_fim ? new Date(b.data_fim).getTime() : 0

    return { id: b.id, nome: b.nome, year, num, dateVal }
  }

  const list = bimestres.map(parseBim)

  list.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    if (a.num !== b.num) return b.num - a.num
    return b.dateVal - a.dateVal
  })

  return list[0]?.id || null
}

export interface TypeMeta {
  type: EvaluationType
  label: string
  pluralLabel: string
  color: string
  tintBg: string
  tintBorder: string
  icon: LucideIcon
  createHref: string
  listHref: string
  buildDetailHref: (id: string) => string
  buildEditHref: (id: string) => string
  buildAdaptHref: ((id: string) => string) | null
}

export const EVALUATION_TYPE_META: Record<EvaluationType, TypeMeta> = {
  Prova: {
    type: 'Prova',
    label: 'Prova',
    pluralLabel: 'Provas',
    color: '#10b981',
    tintBg: 'rgba(16, 185, 129, 0.12)',
    tintBorder: 'rgba(16, 185, 129, 0.28)',
    icon: FileSignature,
    createHref: '/simulados/provas-upload/nova',
    listHref: '/simulados/provas-upload',
    buildDetailHref: (id) => `/simulados/provas-upload/${id}`,
    buildEditHref: (id) => `/simulados/provas-upload/${id}/editar`,
    buildAdaptHref: (id) => `/simulados/provas-upload/${id}/adaptar`,
  },
  Simulado: {
    type: 'Simulado',
    label: 'Simulado',
    pluralLabel: 'Simulados',
    color: '#3b82f6',
    tintBg: 'rgba(59, 130, 246, 0.12)',
    tintBorder: 'rgba(59, 130, 246, 0.28)',
    icon: BookOpen,
    createHref: '/simulados/simulados-upload/nova',
    listHref: '/simulados/simulados-upload',
    buildDetailHref: (id) => `/simulados/simulados-upload/${id}`,
    buildEditHref: (id) => `/simulados/simulados-upload/${id}/editar`,
    buildAdaptHref: (id) => `/simulados/simulados-upload/${id}/adaptar`,
  },
  'Redação': {
    type: 'Redação',
    label: 'Redação',
    pluralLabel: 'Redações',
    color: '#f43f5e',
    tintBg: 'rgba(244, 63, 94, 0.12)',
    tintBorder: 'rgba(244, 63, 94, 0.28)',
    icon: PenTool,
    createHref: '/simulados/redacao-upload/nova',
    listHref: '/simulados/redacao-upload',
    buildDetailHref: (id) => `/simulados/redacao-upload/${id}`,
    buildEditHref: (id) => `/simulados/redacao-upload/${id}/editar`,
    buildAdaptHref: null,
  },
}

export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; dot: string; order: number }
> = {
  em_revisao: {
    label: 'Em Revisão',
    color: '#2563eb',
    bg: 'rgba(59, 130, 246, 0.12)',
    dot: '#3b82f6',
    order: 0,
  },
  aguardando: {
    label: 'Aguardando',
    color: '#d97706',
    bg: 'rgba(245, 158, 11, 0.14)',
    dot: '#f59e0b',
    order: 1,
  },
  aprovado: {
    label: 'Aprovado',
    color: '#059669',
    bg: 'rgba(16, 185, 129, 0.14)',
    dot: '#10b981',
    order: 2,
  },
  publicado: {
    label: 'Publicado',
    color: '#7c3aed',
    bg: 'rgba(139, 92, 246, 0.14)',
    dot: '#8b5cf6',
    order: 3,
  },
  rejeitado: {
    label: 'Ajuste Solicitado',
    color: '#dc2626',
    bg: 'rgba(239, 68, 68, 0.14)',
    dot: '#ef4444',
    order: 0,
  },
}

/**
 * Parses a calendar date (`YYYY-MM-DD` or ISO prefix) into location-agnostic
 * year/month/day integers using Temporal.PlainDate when available, avoiding UTC
 * midnight timezone drift (`new Date('YYYY-MM-DD')`).
 */
export function parsePlainCalendarDate(dateStr?: string | null): PlainCalendarParts | null {
  if (!dateStr || typeof dateStr !== 'string') return null
  const dateOnly = dateStr.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null

  const TemporalGlobal = (globalThis as any).Temporal
  if (TemporalGlobal?.PlainDate) {
    try {
      const plain = TemporalGlobal.PlainDate.from(dateOnly)
      return { year: plain.year, month: plain.month, day: plain.day }
    } catch {
      return null
    }
  }

  const [y, m, d] = dateOnly.split('-').map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m, day: d }
}

function getTodayPlainParts(): PlainCalendarParts {
  const TemporalGlobal = (globalThis as any).Temporal
  if (TemporalGlobal?.Now?.plainDateISO) {
    const today = TemporalGlobal.Now.plainDateISO()
    return { year: today.year, month: today.month, day: today.day }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

function toCalendarEpochDays(parts: PlainCalendarParts): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000)
}

/** Formats YYYY-MM-DD directly as DD/MM/YYYY without timezone conversion. */
export function formatCalendarDateBR(dateStr?: string | null): string {
  const parts = parsePlainCalendarDate(dateStr)
  if (!parts) return 'Não definida'
  const dd = String(parts.day).padStart(2, '0')
  const mm = String(parts.month).padStart(2, '0')
  return `${dd}/${mm}/${parts.year}`
}

/** Computes urgency status and human label for a location-agnostic deadline date. */
export function getDeadlineUrgency(dateStr?: string | null): DeadlineUrgency {
  const target = parsePlainCalendarDate(dateStr)
  if (!target) {
    return { state: 'none', label: 'Sem prazo', formatted: 'Sem prazo', daysLeft: null }
  }

  const today = getTodayPlainParts()
  const diff = toCalendarEpochDays(target) - toCalendarEpochDays(today)
  const formatted = formatCalendarDateBR(dateStr)

  if (diff < 0) {
    const abs = Math.abs(diff)
    return {
      state: 'overdue',
      label: abs === 1 ? 'Atrasado 1 dia' : `Atrasado ${abs}d`,
      formatted,
      daysLeft: diff,
    }
  }
  if (diff === 0) {
    return { state: 'today', label: 'Vence hoje', formatted, daysLeft: 0 }
  }
  if (diff === 1) {
    return { state: 'soon', label: 'Vence amanhã', formatted, daysLeft: 1 }
  }
  if (diff <= 3) {
    return { state: 'soon', label: `Em ${diff} dias`, formatted, daysLeft: diff }
  }
  return { state: 'upcoming', label: formatted, formatted, daysLeft: diff }
}

/** Formats an instant ISO timestamp concisely in Brazilian Portuguese. */
export function formatRelativeDateTime(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)

  if (diffMins >= 0 && diffMins < 1) return 'Agora'
  if (diffMins >= 1 && diffMins < 60) return `Há ${diffMins}min`
  if (diffHours >= 1 && diffHours < 24) return `Há ${diffHours}h`

  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const itemMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((todayMidnight - itemMidnight) / 86_400_000)

  if (dayDiff === 1) return 'Ontem'
  return date.toLocaleDateString('pt-BR')
}

export function formatCreatorShortName(name?: string | null): string {
  if (!name) return 'Sistema'
  const ignore = new Set(['de', 'da', 'do', 'dos', 'das'])
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p && !ignore.has(p.toLowerCase()))
  if (parts.length > 1) return `${parts[0]} ${parts[1]}`
  return parts[0] || 'Sistema'
}

export function extractSeriesText(item: any): string {
  const rawSeries = item?.series ?? item?.serie ?? item?.series_nomes ?? item?.turmas
  if (Array.isArray(rawSeries)) return rawSeries.filter(Boolean).join(', ')
  if (typeof rawSeries === 'string') return rawSeries.trim()
  return ''
}

export function extractDisciplinasList(item: any, reqs: any[]): string[] {
  const discSet = new Set<string>()
  if (item?.disciplina_nome) discSet.add(String(item.disciplina_nome).trim())
  if (item?.disciplina) discSet.add(String(item.disciplina).trim())
  for (const r of reqs) {
    const label = r?.disciplina_nome || r?.nome_disciplina
    if (label && String(label).trim()) discSet.add(String(label).trim())
  }
  return Array.from(discSet).filter(Boolean)
}

function getReqsFromItem(item: any, type: EvaluationType): any[] {
  if (type === 'Prova') return item?.provas_upload_requisicoes || item?.requisicoes || []
  if (type === 'Simulado') return item?.simulados_upload_requisicoes || item?.requisicoes || []
  return item?.redacao_upload_requisicoes || item?.requisicoes || []
}

/** Computes real requisition progress across disciplines/teachers. */
export function computeRequisicoesProgress(item: any, type: EvaluationType): RequisicaoProgress {
  const reqs = getReqsFromItem(item, type)
  if (!Array.isArray(reqs) || reqs.length === 0) {
    const hasQuestions = Array.isArray(item?.questoes_json) && item.questoes_json.length > 0
    const isDone = item?.status === 'publicado' || item?.status === 'aprovado' || hasQuestions
    return {
      total: 0,
      submitted: isDone ? 1 : 0,
      approved: item?.status === 'publicado' || item?.status === 'aprovado' ? 1 : 0,
      rejected: 0,
      pending: isDone ? 0 : 1,
      percent: isDone ? 100 : 0,
      submittedNames: [],
      missingNames: [],
      rejectedNames: [],
    }
  }

  const allQs = Array.isArray(item?.questoes_json) ? item.questoes_json : []
  const submittedNames: string[] = []
  const missingNames: string[] = []
  const rejectedNames: string[] = []

  let approved = 0
  let submitted = 0
  let rejected = 0

  for (const r of reqs) {
    const discLabel = r?.disciplina_nome || r?.nome_disciplina || r?.professor_nome || 'Disciplina'
    const st = String(r?.status || 'pendente').toLowerCase()
    const isApproved = st === 'aprovado' || st === 'concluido' || st === 'publicado'
    const isRejected = st === 'rejeitado' || st === 'reprovado'
    const hasQs = allQs.length > 0 && allQs.some((q: any) => isQuestionForRequisicao(q, r, reqs, true))
    const isSent = isApproved || st === 'enviado' || hasQs

    if (isApproved) approved += 1
    if (isRejected) {
      rejected += 1
      rejectedNames.push(discLabel)
    } else if (isSent) {
      submitted += 1
      submittedNames.push(discLabel)
    } else {
      missingNames.push(discLabel)
    }
  }

  const total = reqs.length
  const pending = Math.max(0, total - submitted)
  const percent = total > 0 ? Math.round((submitted / total) * 100) : 0

  return {
    total,
    submitted,
    approved,
    rejected,
    pending,
    percent,
    submittedNames,
    missingNames,
    rejectedNames,
  }
}

function resolveLatestSubmissionIso(item: any, reqs: any[], status: string): string | null {
  const validSubmissionTimes = reqs
    .filter((r: any) => r?.enviado_em || ['enviado', 'aprovado', 'concluido', 'publicado'].includes(r?.status))
    .map((r: any) => r?.enviado_em || r?.updated_at)
    .filter(Boolean)
    .sort()
    .reverse()

  if (validSubmissionTimes.length > 0) return validSubmissionTimes[0]
  if (status !== 'aguardando' && item?.updated_at) {
    const createdMs = item?.created_at ? new Date(item.created_at).getTime() : 0
    const updatedMs = new Date(item.updated_at).getTime()
    if (!Number.isNaN(updatedMs) && updatedMs >= createdMs) return item.updated_at
  }
  return null
}

export function normalizeEvaluationItem(
  raw: any,
  type: EvaluationType,
  bimsMap: Record<string, string>,
  usersMap: Record<string, string>
): NormalizedEvaluation {
  const meta = EVALUATION_TYPE_META[type]
  const derivedTypeKey = type === 'Prova' ? 'prova' : type === 'Simulado' ? 'simulado' : 'redacao'
  const status = getDerivedStatus(raw, derivedTypeKey)
  const reqs = getReqsFromItem(raw, type)

  const bimestreId = raw?.id_bimestre ? String(raw.id_bimestre) : ''
  const bimestreName =
    (bimestreId && bimsMap[bimestreId]) ||
    (typeof raw?.bimestre === 'string' && raw.bimestre.trim()) ||
    raw?.bimestre_nome ||
    raw?.simulados_bimestres?.nome ||
    ''

  const progress = computeRequisicoesProgress(raw, type)
  const prazo = raw?.data_limite_upload || null

  return {
    id: String(raw.id),
    key: `${type}-${raw.id}`,
    type,
    titulo: raw.titulo || 'Sem título',
    status,
    isAdaptada: Boolean(raw?.eh_adaptada) || String(raw?.titulo || '').toUpperCase().includes('ADAPT'),
    seriesText: extractSeriesText(raw),
    disciplinas: extractDisciplinasList(raw, reqs),
    bimestreId,
    bimestreName,
    criadoPorNome: usersMap[raw.criado_por] || 'Sistema',
    createdAt: raw.created_at || '',
    envioIso: resolveLatestSubmissionIso(raw, reqs, status),
    dataAplicacao: raw.data_aplicacao || null,
    dataLimiteUpload: prazo,
    deadline: getDeadlineUrgency(prazo),
    progress,
    detailHref: meta.buildDetailHref(String(raw.id)),
    editHref: meta.buildEditHref(String(raw.id)),
    adaptHref: meta.buildAdaptHref ? meta.buildAdaptHref(String(raw.id)) : null,
  }
}
