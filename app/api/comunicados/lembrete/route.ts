import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'
import { getCachedSystemUsers, getCachedFuncionarios } from '@/lib/server/turmasGruposCache'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'
import { isCobrancaPaidStatus } from '@/lib/cobrancasUtils'
import { reconcilePendingMercadoPagoPayments } from '@/lib/server/mercadopagoSync'
import { isAutorizacaoClosed } from '@/lib/autorizacoes/autorizacaoUtils'
import { isEnqueteClosed } from '@/lib/enquetes/enqueteUtils'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

type ReminderMode =
  | 'all'
  | 'unread'
  | 'unpaid'
  | 'unanswered_auth'
  | 'unanswered_report'
  | 'unanswered_poll'

const VALID_MODES = new Set<ReminderMode>([
  'all',
  'unread',
  'unpaid',
  'unanswered_auth',
  'unanswered_report',
  'unanswered_poll',
])

const MODE_LABELS: Record<ReminderMode, string> = {
  all: 'Todos os destinatários',
  unread: 'Apenas não lidos',
  unpaid: 'Apenas não pagos',
  unanswered_auth: 'Apenas sem autorização',
  unanswered_report: 'Apenas sem resposta dos relatórios',
  unanswered_poll: 'Apenas sem resposta na enquete',
}

const REMINDER_COOLDOWN_MS = 30_000
const MAX_CUSTOM_MESSAGE_LEN = 160
const BATCH_SIZE = 35
const EXEMPT_COBRANCA_STATUSES = new Set(['CANCELLED', 'CANCELED', 'EXEMPT', 'ISENTO'])

const ADMIN_ROLES = [
  'administrador',
  'admin',
  'administrador master',
  'master',
  'diretor geral',
  'diretora geral',
  'diretor',
  'diretora',
  'direcao',
  'diretoria',
  'coordenador',
  'coordenadora',
  'coordenador(a) pedagogico(a)',
  'gestor',
  'auxiliar administrativo',
  'secretaria',
  'secretario',
  'secretaria escolar',
]

function normalizeText(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function stripLeadingZeros(str: string): string {
  const s = String(str || '').trim()
  if (!s) return ''
  const stripped = s.replace(/^0+/, '')
  return stripped || (s === '0' ? '0' : stripped)
}

function cleanStudentKey(id: any): string {
  const raw = String(id || '')
    .replace(/^(?:a_|_ALU|ALU|_)/i, '')
    .trim()
  return stripLeadingZeros(raw)
}

function cleanStaffKey(id: any): string {
  return String(id || '')
    .replace(/^(?:f_|func_)/i, '')
    .trim()
    .toLowerCase()
}

function parseJsonSafe<T = Record<string, any>>(raw: any, fallback: T): T {
  if (!raw) return fallback
  if (typeof raw === 'object') return raw as T
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

function isAdminRoleText(perfil?: string, cargo?: string): boolean {
  const pNorm = normalizeText(perfil)
  const cNorm = normalizeText(cargo)
  return ADMIN_ROLES.some(
    r =>
      pNorm === r ||
      cNorm === r ||
      pNorm.includes('administrador') ||
      cNorm.includes('administrador master') ||
      pNorm.includes('diretor') ||
      cNorm.includes('diretor') ||
      pNorm.includes('coordenad') ||
      cNorm.includes('coordenad') ||
      pNorm.includes('gestor') ||
      cNorm.includes('gestor')
  )
}

function checkCanManageReminder(
  user: any,
  dbUser: any,
  perfil: string | undefined,
  cargo: string | undefined,
  existingCom: any,
  dados: Record<string, any>
): boolean {
  if (isAdminRoleText(dbUser?.perfil || perfil, dbUser?.cargo || cargo)) {
    return true
  }

  const userCandidateIds = new Set<string>(
    [
      String(user?.id || ''),
      String(dbUser?.id || ''),
      String(dbUser?.auth_id || ''),
      String(dbUser?.dados?.id || ''),
      String(dbUser?.dados?.auth_id || ''),
      String(dbUser?.dados?.colaborador_id || ''),
      String(dbUser?.dados?.uid_legacy || ''),
      String(user?.user_metadata?.id || ''),
      String(user?.user_metadata?.colaborador_id || ''),
      String(user?.user_metadata?.system_user_id || ''),
      String(user?.user_metadata?.uid_legacy || ''),
    ]
      .filter(Boolean)
      .map(s => cleanStaffKey(s))
  )

  const userCandidateNames = new Set<string>(
    [dbUser?.nome, user?.user_metadata?.nome, user?.user_metadata?.name]
      .filter(Boolean)
      .map(n => normalizeText(String(n)))
  )

  const comAutorId = cleanStaffKey(dados?.autorId || dados?.autor_id || '')
  const comAutorNome = normalizeText(existingCom?.autor || dados?.autorNome || dados?.autor)

  return Boolean(
    (comAutorId && userCandidateIds.has(comAutorId)) ||
      (comAutorNome && userCandidateNames.has(comAutorNome))
  )
}

async function fetchInChunks<T>(
  table: string,
  select: string,
  column: string,
  values: string[],
  chunkSize = 120
): Promise<T[]> {
  if (!values || values.length === 0) return []
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  const results: T[] = []
  for (let i = 0; i < uniqueValues.length; i += chunkSize) {
    const chunk = uniqueValues.slice(i, i + chunkSize)
    const { data, error } = await supabaseServer.from(table).select(select).in(column, chunk)
    if (!error && data) {
      results.push(...(data as T[]))
    }
  }
  return results
}

function parseAnexoDescriptor(raw: any): { name: string; url: string; mime: string } | null {
  if (!raw) return null
  if (typeof raw === 'object') {
    return {
      name: String(raw.nome || raw.name || '').trim(),
      url: String(raw.url || '').trim(),
      mime: String(raw.mime || raw.mimeType || raw.tipo || '').trim(),
    }
  }
  if (typeof raw === 'string') {
    const parts = raw.split('|')
    if (raw.endsWith('|report-payload')) {
      const firstPipe = raw.indexOf('|')
      const lastPipe = raw.lastIndexOf('|')
      return {
        name: firstPipe >= 0 ? raw.slice(0, firstPipe).trim() : raw.trim(),
        url: firstPipe >= 0 && lastPipe > firstPipe ? raw.slice(firstPipe + 1, lastPipe).trim() : '',
        mime: 'report-payload',
      }
    }
    return {
      name: (parts[0] || '').trim(),
      url: (parts[1] || '').trim(),
      mime: (parts[2] || '').trim(),
    }
  }
  return null
}

function inspectReportCapabilities(
  comIdStr: string,
  existingCom: any,
  dados: Record<string, any>
): {
  isIndividualStudentReport: boolean
  isConsolidatedReport: boolean
  hasRelatorio: boolean
  hasReportTask: boolean
  hasFormAttachment: boolean
  relatorioLabel: string | null
  explicitReportStudentIds: Set<string>
} {
  const isIndividualStudentReport = Boolean(
    comIdStr.startsWith('AD-COM-REL-STU-') || dados?.tipoRelatorio === 'individual'
  )
  const isConsolidatedReport = Boolean(
    comIdStr.startsWith('AD-COM-REL-COLAB-') ||
      comIdStr.startsWith('AD-COM-REL-TURMA-') ||
      (comIdStr.startsWith('AD-COM-REL-') && !comIdStr.startsWith('AD-COM-REL-STU-'))
  )

  const explicitReportStudentIds = new Set<string>()
  const addStudentId = (val: any) => {
    const clean = cleanStudentKey(val)
    if (clean) explicitReportStudentIds.add(clean)
  }

  if (isIndividualStudentReport) {
    const m = comIdStr.match(/^AD-COM-REL-STU-\d+-([^-]+)-/i)
    if (m && m[1]) addStudentId(m[1])
  }

  const rawStuIds = Array.isArray(dados?.stuIds) ? dados.stuIds : []
  for (const sId of rawStuIds) {
    const m = String(sId || '').match(/^AD-COM-REL-STU-\d+-([^-]+)-/i)
    if (m && m[1]) addStudentId(m[1])
  }

  if (Array.isArray(dados?.stu_target_ids)) {
    dados.stu_target_ids.forEach(addStudentId)
  }

  const allAnexos = [
    ...(Array.isArray(dados?.anexos) ? dados.anexos : []),
    ...(Array.isArray(existingCom?.anexos) ? existingCom.anexos : []),
  ]

  let hasReportPayload = false
  let hasReportTask = false
  let hasFormAttachment = false

  for (const anx of allAnexos) {
    const parsed = parseAnexoDescriptor(anx)
    if (!parsed) continue
    const nameLower = parsed.name.toLowerCase()
    const urlLower = parsed.url.toLowerCase()
    const mimeLower = parsed.mime.toLowerCase()

    if (
      mimeLower === 'report-payload' ||
      urlLower.startsWith('payload:') ||
      nameLower.startsWith('relatório personalizado:') ||
      nameLower.startsWith('relatorio personalizado:') ||
      (nameLower.startsWith('relatório:') && !urlLower.startsWith('form:'))
    ) {
      hasReportPayload = true
      if (parsed.url.startsWith('payload:')) {
        try {
          const payloadObj = JSON.parse(parsed.url.slice(8))
          const pStuId = payloadObj?.studentInfo?.id || Object.keys(payloadObj?.values || {})[0]
          if (pStuId) addStudentId(pStuId)
        } catch {
          // ignore malformed inline payload
        }
      }
    } else if (
      nameLower.startsWith('tarefa de relatório:') ||
      nameLower.startsWith('tarefa de relatorio:') ||
      urlLower.startsWith('report-task:')
    ) {
      hasReportTask = true
    } else if (
      nameLower.startsWith('formulário:') ||
      nameLower.startsWith('formulario:') ||
      nameLower.startsWith('relatório:') ||
      urlLower.startsWith('form:')
    ) {
      hasFormAttachment = true
    }
  }

  const isTipoRelatorio =
    normalizeText(dados?.tipo) === 'relatorio' || normalizeText(existingCom?.tipo) === 'relatorio'

  const hasRelatorio = Boolean(
    isConsolidatedReport ||
      isIndividualStudentReport ||
      isTipoRelatorio ||
      rawStuIds.length > 0 ||
      hasReportPayload ||
      hasReportTask ||
      hasFormAttachment
  )

  let relatorioLabel: string | null = null
  if (hasRelatorio) {
    if (hasReportTask && !isConsolidatedReport && !hasReportPayload) {
      relatorioLabel = 'Tarefa de Relatório'
    } else if (hasFormAttachment && !isConsolidatedReport && !hasReportPayload) {
      relatorioLabel = 'Formulário / Relatório'
    } else {
      relatorioLabel = 'Relatório'
    }
  }

  return {
    isIndividualStudentReport,
    isConsolidatedReport,
    hasRelatorio,
    hasReportTask,
    hasFormAttachment,
    relatorioLabel,
    explicitReportStudentIds,
  }
}

async function resolveStuMapForConsolidatedReport(
  comId: string,
  existingCom: any,
  dados: Record<string, any>
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const registerStuId = (rawStuId: string) => {
    const match = String(rawStuId).match(/^AD-COM-REL-STU-\d+-([^-]+)-/i)
    if (match && match[1]) {
      const stuAlunoId = String(match[1]).trim()
      map.set(stuAlunoId, String(rawStuId))
      const cleaned = cleanStudentKey(stuAlunoId)
      if (cleaned) map.set(cleaned, String(rawStuId))
    }
  }

  if (Array.isArray(dados?.stuIds) && dados.stuIds.length > 0) {
    const candidateIds = dados.stuIds.map(String).filter(Boolean)
    const existingStus = await fetchInChunks<{ id: string }>('comunicados', 'id', 'id', candidateIds)
    existingStus.forEach(row => registerStuId(String(row.id)))
    if (map.size > 0) return map
  }

  // Fallback para relatórios legados sem dados.stuIds: localizar pelo prefixo de timestamp e autor
  try {
    const idMatch = String(comId).match(/AD-COM-REL-[A-Za-z]+-(\d+)/)
    const colabTs = idMatch ? parseInt(idMatch[1], 10) : null
    const baseTime =
      colabTs ||
      (existingCom?.created_at ? new Date(existingCom.created_at).getTime() : null) ||
      (dados?.dataEnvio ? new Date(dados.dataEnvio).getTime() : Date.now())

    const minDate = new Date(baseTime - 15 * 60000).toISOString()
    const maxDate = new Date(baseTime + 15 * 60000).toISOString()
    const { data: stusByDate } = await supabaseServer
      .from('comunicados')
      .select('id, autor, created_at')
      .ilike('id', 'AD-COM-REL-STU-%')
      .gte('created_at', minDate)
      .lte('created_at', maxDate)

    const colabAutorNorm = normalizeText(existingCom?.autor || dados?.autor || '')
    for (const s of stusByDate || []) {
      const sMatch = String(s.id).match(/AD-COM-REL-STU-(\d+)/)
      const sTs = sMatch ? parseInt(sMatch[1], 10) : null
      const sameAutor = !colabAutorNorm || !s.autor || normalizeText(s.autor) === colabAutorNorm
      if (sameAutor && (!colabTs || !sTs || Math.abs(sTs - colabTs) < 60_000)) {
        registerStuId(String(s.id))
      }
    }
  } catch (err) {
    console.warn('[Comunicados Lembrete] Falha ao resolver relatórios individuais vinculados:', err)
  }

  return map
}

function deduplicateStudents(
  list: Array<{ aluno_id: string; aluno_nome: string; responsaveis_ids: string[] }>
): Array<{ aluno_id: string; aluno_nome: string; responsaveis_ids: string[] }> {
  const byKey = new Map<string, { aluno_id: string; aluno_nome: string; responsaveis_ids: Set<string> }>()
  for (const item of list) {
    const rawId = String(item?.aluno_id || '').trim()
    if (!rawId) continue
    const key = cleanStudentKey(rawId) || rawId
    const validResps = (item.responsaveis_ids || [])
      .map(r => String(r || '').trim())
      .filter(r => r.length > 0 && r !== 'undefined' && r !== 'null')
    if (validResps.length === 0) continue

    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        aluno_id: rawId,
        aluno_nome: item.aluno_nome || '',
        responsaveis_ids: new Set(validResps),
      })
    } else {
      if (!existing.aluno_nome && item.aluno_nome) {
        existing.aluno_nome = item.aluno_nome
      }
      validResps.forEach(r => existing.responsaveis_ids.add(r))
    }
  }

  return Array.from(byKey.values()).map(v => ({
    aluno_id: v.aluno_id,
    aluno_nome: v.aluno_nome,
    responsaveis_ids: Array.from(v.responsaveis_ids),
  }))
}

function hasStudentActivity(
  student: { aluno_id: string; responsaveis_ids: string[] },
  records: Array<{ content_id: string; usuario_id?: string | null; aluno_id?: string | null }>,
  legacyMap: Record<string, any> | undefined,
  expectedContentIds: string[]
): boolean {
  const rawAlunoId = String(student.aluno_id || '').trim()
  const cleanAluno = cleanStudentKey(rawAlunoId)
  const respIdSet = new Set(student.responsaveis_ids.map(r => String(r).trim().toLowerCase()))
  const expectedSet = new Set(expectedContentIds.map(String))

  for (const r of records) {
    if (!expectedSet.has(String(r.content_id))) continue
    const rAlunoClean = cleanStudentKey(r.aluno_id)
    if (rAlunoClean && cleanAluno && rAlunoClean === cleanAluno) {
      return true
    }
    const uid = String(r.usuario_id || '').trim()
    if (!uid) continue
    if (uid.includes('#')) {
      const hashPart = cleanStudentKey(uid.split('#')[1])
      if (hashPart && cleanAluno && hashPart === cleanAluno) {
        return true
      }
    } else if (!r.aluno_id) {
      if (
        uid === rawAlunoId ||
        cleanStudentKey(uid) === cleanAluno ||
        uid === `aluno_${rawAlunoId}` ||
        respIdSet.has(uid.toLowerCase())
      ) {
        return true
      }
    }
  }

  if (legacyMap && typeof legacyMap === 'object') {
    for (const key of Object.keys(legacyMap)) {
      if (!legacyMap[key]) continue
      if (
        key === rawAlunoId ||
        key === cleanAluno ||
        key === `aluno_${rawAlunoId}` ||
        key === `aluno_${cleanAluno}` ||
        key.endsWith(`_${rawAlunoId}`) ||
        (cleanAluno && key.endsWith(`_${cleanAluno}`))
      ) {
        return true
      }
      if (!key.includes('_') && respIdSet.has(key.toLowerCase())) {
        return true
      }
    }
  }

  return false
}

function hasStudentRepliedInComments(
  student: { aluno_id: string; responsaveis_ids: string[] },
  replyRows: Array<{
    comunicado_id: string
    remetente_id?: string | null
    remetente_nome?: string | null
    anexos?: any
    is_admin?: boolean | null
  }>,
  dedicatedStuComId: string | null,
  parentComId: string
): boolean {
  const rawAlunoId = String(student.aluno_id || '').trim()
  const cleanAluno = cleanStudentKey(rawAlunoId)
  const respTokens = new Set<string>(
    student.responsaveis_ids
      .map(r => String(r || '').trim().toLowerCase())
      .filter(Boolean)
  )

  for (const row of replyRows) {
    if (row.is_admin) continue
    const rowComId = String(row.comunicado_id || '')

    // Em relatórios individuais (AD-COM-REL-STU-...), qualquer resposta não-admin naquele relatório pertence à família daquele aluno
    if (dedicatedStuComId && rowComId === dedicatedStuComId) {
      return true
    }

    if (rowComId !== parentComId) continue

    const remRaw = String(row.remetente_id || '').trim()
    const remLower = remRaw.toLowerCase()
    const remCleanStu = cleanStudentKey(remRaw)

    if (
      (remRaw && remRaw === rawAlunoId) ||
      (remCleanStu && cleanAluno && remCleanStu === cleanAluno) ||
      (remLower && respTokens.has(remLower))
    ) {
      return true
    }

    const anxList = Array.isArray(row.anexos) ? row.anexos : []
    for (const item of anxList) {
      const authorMeta = item && typeof item === 'object' ? item.__author__ : null
      if (!authorMeta || typeof authorMeta !== 'object') continue
      const candidateTokens = [
        authorMeta.id,
        authorMeta.auth_id,
        authorMeta.responsavel_id,
        authorMeta.email,
      ]
        .map(v => String(v || '').trim().toLowerCase())
        .filter(Boolean)

      if (candidateTokens.some(tok => respTokens.has(tok) || cleanStudentKey(tok) === cleanAluno)) {
        return true
      }
    }
  }

  return false
}

async function groupCollaboratorAliases(directColaboradores: string[]): Promise<{
  targetGroups: Set<Set<string>>
  standaloneAliases: Set<string>
  directLowerMap: Map<string, string>
  totalPersonCount: number
}> {
  const targetGroups = new Set<Set<string>>()
  const standaloneAliases = new Set<string>()
  const directLowerMap = new Map<string, string>()

  if (directColaboradores.length === 0) {
    return { targetGroups, standaloneAliases, directLowerMap, totalPersonCount: 0 }
  }

  const [sysRes, funcRes] = await Promise.allSettled([getCachedSystemUsers(), getCachedFuncionarios()])
  const sysUsers = sysRes.status === 'fulfilled' && Array.isArray(sysRes.value) ? sysRes.value : []
  const funcionarios = funcRes.status === 'fulfilled' && Array.isArray(funcRes.value) ? funcRes.value : []

  const tokenToGroup = new Map<string, Set<string>>()
  const addGroup = (tokens: any[]) => {
    const cleanTokens = tokens.map(t => String(t || '').trim().toLowerCase()).filter(Boolean)
    if (cleanTokens.length === 0) return
    let group: Set<string> | undefined
    for (const t of cleanTokens) {
      if (tokenToGroup.has(t)) {
        group = tokenToGroup.get(t)
        break
      }
    }
    if (!group) group = new Set<string>()
    for (const t of cleanTokens) {
      group.add(t)
      tokenToGroup.set(t, group)
    }
  }

  for (const f of funcionarios) {
    addGroup([f.id, cleanStaffKey(f.id), f.codigo, f.email, f.dados?.auth_id, f.dados?.user_id])
  }
  for (const su of sysUsers) {
    addGroup([
      su.id,
      cleanStaffKey(su.id),
      su.auth_id,
      su.email,
      su.dados?.auth_id,
      su.dados?.colaborador_id,
      cleanStaffKey(su.dados?.colaborador_id),
      su.dados?.uid_legacy,
    ])
  }

  for (const rawAlias of directColaboradores) {
    const lower = String(rawAlias || '').trim().toLowerCase()
    if (!lower) continue
    const clean = cleanStaffKey(rawAlias)
    directLowerMap.set(lower, rawAlias)
    const grp = tokenToGroup.get(lower) || tokenToGroup.get(clean)
    if (grp) {
      targetGroups.add(grp)
    } else {
      standaloneAliases.add(rawAlias)
    }
  }

  return {
    targetGroups,
    standaloneAliases,
    directLowerMap,
    totalPersonCount: targetGroups.size + standaloneAliases.size,
  }
}

function filterCollaboratorGroupsByActiveTokens(
  grouped: {
    targetGroups: Set<Set<string>>
    standaloneAliases: Set<string>
    directLowerMap: Map<string, string>
  },
  completedTokens: Set<string>
): { aliases: string[]; personCount: number; skippedCount: number } {
  const pendingAliases = new Set<string>()
  let skippedCount = 0
  let personCount = 0

  for (const rawAlias of grouped.standaloneAliases) {
    const lower = rawAlias.trim().toLowerCase()
    const clean = cleanStaffKey(rawAlias)
    if (completedTokens.has(lower) || completedTokens.has(clean)) {
      skippedCount++
    } else {
      pendingAliases.add(rawAlias)
      personCount++
    }
  }

  for (const grp of grouped.targetGroups) {
    let isCompleted = false
    for (const token of grp) {
      if (completedTokens.has(token) || completedTokens.has(cleanStaffKey(token))) {
        isCompleted = true
        break
      }
    }
    if (isCompleted) {
      skippedCount++
    } else {
      personCount++
      for (const token of grp) {
        const original = grouped.directLowerMap.get(token)
        if (original) pendingAliases.add(original)
      }
    }
  }

  return { aliases: Array.from(pendingAliases), personCount, skippedCount }
}

interface AnalyzedTargetsResult {
  capabilities: {
    hasCobranca: boolean
    cobrancaTitulo: string | null
    cobrancaOverdue: boolean
    hasAutorizacao: boolean
    autorizacaoTitulo: string | null
    autorizacaoClosed: boolean
    hasRelatorio: boolean
    relatorioLabel: string | null
    hasEnquete: boolean
    enquetePergunta: string | null
    enqueteClosed: boolean
    exigeCiencia: boolean
    isInterno: boolean
    isReport: boolean
  }
  counts: {
    all: number
    unread: number
    unpaid: number | null
    paid: number | null
    unanswered_auth: number | null
    answered_auth: number | null
    unanswered_report: number | null
    answered_report: number | null
    unanswered_poll: number | null
    answered_poll: number | null
  }
  stuComIdByAlunoId: Map<string, string>
  resolveForMode: (mode: ReminderMode) => {
    students: Array<{ aluno_id: string; aluno_nome: string; responsaveis_ids: string[] }>
    colaboradores: string[]
    colaboradoresCount: number
    skippedCount: number
  }
}

async function analyzeComunicadoReminderTargets(
  comIdStr: string,
  existingCom: any,
  dados: Record<string, any>,
  options?: { reconcilePayments?: boolean }
): Promise<AnalyzedTargetsResult> {
  const reportInfo = inspectReportCapabilities(comIdStr, existingCom, dados)
  const {
    isIndividualStudentReport,
    isConsolidatedReport,
    hasRelatorio,
    hasReportTask,
    relatorioLabel,
    explicitReportStudentIds,
  } = reportInfo

  const rawDestinoNorm = normalizeText(existingCom?.destino || dados?.destino || '')
  // Importante: AD-COM-REL-COLAB-* salva destino='interno' apenas para não duplicar no feed familiar,
  // pois cada aluno recebe seu AD-COM-REL-STU-*. Seus destinatários reais de lembrete são as famílias dos alunos!
  const effectiveIsInterno =
    !isConsolidatedReport &&
    !isIndividualStudentReport &&
    (rawDestinoNorm === 'interno' || rawDestinoNorm === 'funcionarios' || rawDestinoNorm === 'equipe')

  const stuComIdByAlunoId = isConsolidatedReport
    ? await resolveStuMapForConsolidatedReport(comIdStr, existingCom, dados)
    : new Map<string, string>()

  if (isConsolidatedReport && stuComIdByAlunoId.size > 0) {
    stuComIdByAlunoId.forEach((_stuComId, key) => {
      const clean = cleanStudentKey(key)
      if (clean) explicitReportStudentIds.add(clean)
    })
  }

  const explicitReportIdsList = Array.from(explicitReportStudentIds)

  const targetLookupPayload = isConsolidatedReport
    ? {
        ...dados,
        id: comIdStr,
        destino: 'alunos',
        alunosIds:
          explicitReportIdsList.length > 0
            ? explicitReportIdsList
            : Array.isArray(dados?.alunosIds)
              ? dados.alunosIds
              : [],
        turmas: explicitReportIdsList.length > 0 ? [] : dados?.turmas,
        grupos: explicitReportIdsList.length > 0 ? [] : dados?.grupos,
        colaboradoresIds: [],
        funcionariosIds: [],
      }
    : {
        ...dados,
        id: comIdStr,
        destino: existingCom?.destino || dados?.destino,
        tipoRelatorio: dados?.tipoRelatorio,
      }

  const [{ students: rawStudents, directColaboradores: rawColabs }, cobrancasRes] = await Promise.all([
    getStudentTargetsForComunicados(targetLookupPayload),
    supabaseServer
      .from('agenda_cobrancas')
      .select('id, titulo, valor, vencimento, created_at')
      .eq('comunicado_id', comIdStr)
      .order('created_at', { ascending: true }),
  ])

  let baseStudents = effectiveIsInterno ? [] : deduplicateStudents(rawStudents || [])
  if (isConsolidatedReport) {
    if (stuComIdByAlunoId.size > 0) {
      baseStudents = baseStudents.filter(s => {
        const raw = String(s.aluno_id || '').trim()
        const clean = cleanStudentKey(raw)
        return stuComIdByAlunoId.has(raw) || (clean && stuComIdByAlunoId.has(clean))
      })
    } else if (explicitReportIdsList.length === 0) {
      baseStudents = []
    }
  }

  const baseColabRaw = isIndividualStudentReport || isConsolidatedReport ? [] : rawColabs || []
  const groupedColabs = await groupCollaboratorAliases(baseColabRaw)

  // ── 1. Detectar Autorização ───────────────────────────────────────────────
  const autorizacaoObj = dados?.autorizacao || (existingCom as any)?.autorizacao || null
  const hasAutorizacao = Boolean(
    autorizacaoObj &&
      typeof autorizacaoObj === 'object' &&
      (autorizacaoObj.id || autorizacaoObj.titulo || Array.isArray(autorizacaoObj.opcoes))
  )
  const autorizacaoTitulo = hasAutorizacao ? String(autorizacaoObj.titulo || existingCom?.titulo || 'Autorização').trim() : null
  const autorizacaoClosed = hasAutorizacao ? isAutorizacaoClosed(autorizacaoObj) : false

  // Mapear respostas da autorização (e quem recusou explicitamente, para não cobrar quem recusou passeio)
  const answeredAuthCleanIds = new Set<string>()
  const refusedAuthCleanIds = new Set<string>()
  const orphanAuthUserIds = new Set<string>()

  if (hasAutorizacao) {
    const respostasMap =
      autorizacaoObj.respostas && typeof autorizacaoObj.respostas === 'object'
        ? autorizacaoObj.respostas
        : {}

    for (const [vKey, resp] of Object.entries(respostasMap) as Array<[string, any]>) {
      if (!resp || vKey.startsWith('anon_') || String(resp.usuarioId || '').startsWith('anon_')) continue
      const matchedKeys: string[] = []
      const rStu = cleanStudentKey(resp.alunoId)
      if (rStu) matchedKeys.push(rStu)
      if (vKey.includes('_')) {
        const suffix = cleanStudentKey(vKey.split('_').pop())
        if (suffix) matchedKeys.push(suffix)
      } else {
        const direct = cleanStudentKey(vKey)
        if (direct) matchedKeys.push(direct)
      }

      if (matchedKeys.length > 0) {
        matchedKeys.forEach(k => {
          answeredAuthCleanIds.add(k)
          if (resp.tipoDecisao === 'recusa' || resp.status === 'REJECTED' || resp.status === 'RECUSADO') {
            refusedAuthCleanIds.add(k)
          }
        })
      } else if (resp.usuarioId) {
        orphanAuthUserIds.add(String(resp.usuarioId).trim().toLowerCase())
      }
    }
  }

  // Contar quantos alunos do comunicado compartilham o mesmo responsável para desambiguar respostas legadas sem alunoId
  const guardianStudentCount = new Map<string, number>()
  for (const s of baseStudents) {
    for (const rid of s.responsaveis_ids) {
      const rl = String(rid).trim().toLowerCase()
      guardianStudentCount.set(rl, (guardianStudentCount.get(rl) || 0) + 1)
    }
  }

  const hasStudentAnsweredAuth = (s: { aluno_id: string; responsaveis_ids: string[] }): boolean => {
    const clean = cleanStudentKey(s.aluno_id)
    if (clean && answeredAuthCleanIds.has(clean)) return true
    if (orphanAuthUserIds.size > 0) {
      return s.responsaveis_ids.some(r => {
        const rl = String(r).trim().toLowerCase()
        return orphanAuthUserIds.has(rl) && (guardianStudentCount.get(rl) || 0) === 1
      })
    }
    return false
  }

  const unansweredAuthStudents = hasAutorizacao
    ? baseStudents.filter(s => !hasStudentAnsweredAuth(s))
    : []
  const answeredAuthCount = hasAutorizacao ? Math.max(0, baseStudents.length - unansweredAuthStudents.length) : null

  // ── 2. Detectar Cobrança (Não Pagos) ──────────────────────────────────────
  const dbCobrancas = Array.isArray(cobrancasRes.data) ? cobrancasRes.data : []
  const jsonCobrancasRaw = Array.isArray(dados?.cobrancas)
    ? dados.cobrancas
    : dados?.cobranca
      ? [dados.cobranca]
      : []
  const validJsonCobrancas = jsonCobrancasRaw.filter((c: any) => {
    if (!c) return false
    const v = typeof c.valor === 'string' ? parseFloat(c.valor.replace(/\./g, '').replace(',', '.')) : Number(c.valor)
    return !isNaN(v) && v > 0
  })

  const hasCobranca = !effectiveIsInterno && (dbCobrancas.length > 0 || validJsonCobrancas.length > 0)
  const primaryCob = dbCobrancas[0] || validJsonCobrancas[0] || null
  const cobrancaTitulo = hasCobranca
    ? String(primaryCob?.titulo || existingCom?.titulo || 'Cobrança').trim()
    : null

  let cobrancaOverdue = false
  if (hasCobranca && primaryCob?.vencimento) {
    const vStr = String(primaryCob.vencimento).trim()
    const vDate = new Date(vStr.includes('T') ? vStr : `${vStr}T23:59:59`)
    if (!isNaN(vDate.getTime()) && vDate.getTime() < Date.now()) {
      cobrancaOverdue = true
    }
  }

  let unpaidStudents: Array<{ aluno_id: string; aluno_nome: string; responsaveis_ids: string[] }> = []
  let paidOrExemptCount: number | null = null

  if (hasCobranca) {
    let cobDestRows: any[] = []
    if (dbCobrancas.length > 0) {
      const cobIds = dbCobrancas.map((c: any) => String(c.id))
      const { data: rawDests } = await supabaseServer
        .from('agenda_cobrancas_destinatarios')
        .select('*')
        .in('cobranca_id', cobIds)
      cobDestRows = rawDests || []

      if (options?.reconcilePayments && cobDestRows.length > 0) {
        try {
          const cobMap = new Map<string, any>(dbCobrancas.map((c: any) => [String(c.id), c]))
          cobDestRows = await reconcilePendingMercadoPagoPayments(cobDestRows, cobMap, supabaseServer)
        } catch (recErr) {
          console.warn('[Comunicados Lembrete] Aviso ao reconciliar pagamentos Mercado Pago:', recErr)
        }
      }
    }

    // Caso existam destinatários pendentes em agenda_cobrancas_destinatarios que mudaram de turma depois da emissão, garante inclusão
    const baseCleanSet = new Set(baseStudents.map(s => cleanStudentKey(s.aluno_id)))
    const extraCobStudentIds: string[] = []
    for (const d of cobDestRows) {
      const dClean = cleanStudentKey(d?.destinatario_id || d?.aluno_id)
      const stUpper = String(d?.status || 'PENDING').trim().toUpperCase()
      if (
        dClean &&
        !baseCleanSet.has(dClean) &&
        !isCobrancaPaidStatus(stUpper) &&
        !EXEMPT_COBRANCA_STATUSES.has(stUpper)
      ) {
        extraCobStudentIds.push(dClean)
      }
    }

    let candidateCobStudents = [...baseStudents]
    if (extraCobStudentIds.length > 0) {
      try {
        const { students: extraResolved } = await getStudentTargetsForComunicados({
          destino: 'alunos',
          alunosIds: Array.from(new Set(extraCobStudentIds)),
        })
        candidateCobStudents = deduplicateStudents([...baseStudents, ...(extraResolved || [])])
      } catch {
        // fallback mantém baseStudents
      }
    }

    if (dbCobrancas.length === 0 || cobDestRows.length === 0) {
      // Nenhuma baixa registrada ainda: todos os destinatários (exceto quem recusou autorização acoplada) estão pendentes
      let skipped = 0
      for (const s of candidateCobStudents) {
        const clean = cleanStudentKey(s.aluno_id)
        if (clean && refusedAuthCleanIds.has(clean)) {
          skipped++
        } else {
          unpaidStudents.push(s)
        }
      }
      paidOrExemptCount = skipped
    } else {
      const destsByCobId = new Map<string, any[]>()
      for (const cob of dbCobrancas) {
        destsByCobId.set(String(cob.id), [])
      }
      for (const d of cobDestRows) {
        const cid = String(d.cobranca_id)
        if (!destsByCobId.has(cid)) destsByCobId.set(cid, [])
        destsByCobId.get(cid)!.push(d)
      }

      let paidCount = 0
      for (const s of candidateCobStudents) {
        const clean = cleanStudentKey(s.aluno_id)
        const sNormName = normalizeText(s.aluno_nome)

        let hasAnyUnpaidCob = false
        let hasActiveLinkOrRow = false

        for (const cob of dbCobrancas) {
          const listForCob = destsByCobId.get(String(cob.id)) || []
          if (listForCob.length === 0) {
            hasAnyUnpaidCob = true
            continue
          }

          const matchedRow =
            listForCob.find(d => cleanStudentKey(d?.destinatario_id || d?.aluno_id) === clean) ||
            (sNormName
              ? listForCob.find(d => normalizeText(d?.destinatario_nome || d?.aluno_nome) === sNormName)
              : null)

          if (matchedRow) {
            if (matchedRow.url_pagamento) hasActiveLinkOrRow = true
            const stUpper = String(matchedRow.status || 'PENDING').trim().toUpperCase()
            if (isCobrancaPaidStatus(stUpper) || EXEMPT_COBRANCA_STATUSES.has(stUpper)) {
              continue
            }
            hasAnyUnpaidCob = true
          } else {
            // Aluno destinatário ativo ainda não sincronizado na tabela de destinatários -> pendente
            hasAnyUnpaidCob = true
          }
        }

        // Se a família assinou explicitamente "Não autorizo" na autorização acoplada e não gerou pagamento, não cobrar
        if (hasAnyUnpaidCob && clean && refusedAuthCleanIds.has(clean) && !hasActiveLinkOrRow) {
          hasAnyUnpaidCob = false
        }

        if (hasAnyUnpaidCob) {
          unpaidStudents.push(s)
        } else {
          paidCount++
        }
      }
      paidOrExemptCount = paidCount
    }
  }

  // ── 3. Detectar Enquete ───────────────────────────────────────────────────
  const enqueteObj = dados?.enquete || (existingCom as any)?.enquete || null
  const hasEnquete = Boolean(
    enqueteObj &&
      typeof enqueteObj === 'object' &&
      Array.isArray(enqueteObj.opcoes) &&
      enqueteObj.opcoes.length > 0
  )
  const enquetePergunta = hasEnquete
    ? String(enqueteObj.pergunta || enqueteObj.titulo || existingCom?.titulo || 'Enquete').trim()
    : null
  const enqueteClosed = hasEnquete ? isEnqueteClosed(enqueteObj) : false

  const votedPollCleanStudentIds = new Set<string>()
  const votedPollUserTokens = new Set<string>()

  if (hasEnquete) {
    const votosMap = enqueteObj.votos && typeof enqueteObj.votos === 'object' ? enqueteObj.votos : {}
    for (const [vKey, voto] of Object.entries(votosMap) as Array<[string, any]>) {
      if (!voto || vKey.startsWith('anon_') || String(voto.usuarioId || '').startsWith('anon_')) continue
      const vStu = cleanStudentKey(voto.alunoId)
      if (vStu) votedPollCleanStudentIds.add(vStu)
      if (vKey.includes('_')) {
        const suffix = cleanStudentKey(vKey.split('_').pop())
        if (suffix) votedPollCleanStudentIds.add(suffix)
      } else {
        const direct = cleanStudentKey(vKey)
        if (direct) votedPollCleanStudentIds.add(direct)
      }
      if (voto.usuarioId) {
        const uLower = String(voto.usuarioId).trim().toLowerCase()
        votedPollUserTokens.add(uLower)
        votedPollUserTokens.add(cleanStaffKey(uLower))
      }
    }
  }

  const unansweredPollStudents = hasEnquete
    ? baseStudents.filter(s => {
        const clean = cleanStudentKey(s.aluno_id)
        if (clean && votedPollCleanStudentIds.has(clean)) return false
        if (votedPollUserTokens.size > 0) {
          const singleChildMatch = s.responsaveis_ids.some(r => {
            const rl = String(r).trim().toLowerCase()
            return votedPollUserTokens.has(rl) && (guardianStudentCount.get(rl) || 0) === 1
          })
          if (singleChildMatch) return false
        }
        return true
      })
    : []

  const unansweredPollColabs =
    hasEnquete && groupedColabs.totalPersonCount > 0 && effectiveIsInterno
      ? filterCollaboratorGroupsByActiveTokens(groupedColabs, votedPollUserTokens)
      : { aliases: [] as string[], personCount: 0, skippedCount: 0 }

  const unansweredPollTotal = hasEnquete
    ? unansweredPollStudents.length + unansweredPollColabs.personCount
    : null
  const answeredPollTotal = hasEnquete
    ? Math.max(
        0,
        baseStudents.length +
          (effectiveIsInterno ? groupedColabs.totalPersonCount : 0) -
          (unansweredPollTotal || 0)
      )
    : null

  // ── 4. Leituras, Ciências e Respostas de Relatórios ───────────────────────
  const contentIdsToCheck = Array.from(new Set([comIdStr, ...Array.from(stuComIdByAlunoId.values())]))
  const exigeCiencia = Boolean(dados?.exigeCiencia)
  const needCiencias = exigeCiencia || hasRelatorio
  const needRespostas = hasRelatorio

  const [readRows, cienciaRows, replyRows] = await Promise.all([
    contentIdsToCheck.length > 0
      ? fetchInChunks<{ content_id: string; usuario_id: string | null; aluno_id: string | null }>(
          'agenda_notification_reads',
          'content_id, usuario_id, aluno_id',
          'content_id',
          contentIdsToCheck
        )
      : Promise.resolve([]),
    needCiencias && contentIdsToCheck.length > 0
      ? fetchInChunks<{ content_id: string; usuario_id: string | null; aluno_id: string | null }>(
          'agenda_ciencias',
          'content_id, usuario_id, aluno_id',
          'content_id',
          contentIdsToCheck
        )
      : Promise.resolve([]),
    needRespostas && contentIdsToCheck.length > 0
      ? fetchInChunks<{
          comunicado_id: string
          remetente_id: string | null
          remetente_nome: string | null
          anexos: any
          is_admin: boolean | null
        }>(
          'comunicados_respostas',
          'comunicado_id, remetente_id, remetente_nome, anexos, is_admin',
          'comunicado_id',
          contentIdsToCheck
        )
      : Promise.resolve([]),
  ])

  // Calcular não lidos (unread)
  const unreadStudents: typeof baseStudents = []
  let unreadSkippedStudents = 0
  for (const s of baseStudents) {
    const raw = String(s.aluno_id || '').trim()
    const clean = cleanStudentKey(raw)
    const dedicatedStuId = isConsolidatedReport
      ? stuComIdByAlunoId.get(raw) || stuComIdByAlunoId.get(clean) || null
      : null
    const expectedIds = dedicatedStuId ? [dedicatedStuId, comIdStr] : [comIdStr]

    const hasRead = hasStudentActivity(s, readRows, dados?.leituras, expectedIds)
    const hasCiencia = exigeCiencia
      ? hasStudentActivity(s, cienciaRows, dados?.ciencias, expectedIds)
      : true

    if (hasRead && hasCiencia) {
      unreadSkippedStudents++
    } else {
      unreadStudents.push(s)
    }
  }

  const colabReadTokens = new Set<string>()
  for (const r of readRows) {
    if (String(r.content_id) !== comIdStr) continue
    const rawUid = String(r.usuario_id || '').split('#')[0].trim()
    if (rawUid) {
      colabReadTokens.add(rawUid.toLowerCase())
      colabReadTokens.add(cleanStaffKey(rawUid))
    }
  }
  if (dados?.leituras && typeof dados.leituras === 'object') {
    for (const [k, v] of Object.entries(dados.leituras)) {
      if (v && !k.includes('_')) {
        colabReadTokens.add(k.toLowerCase())
        colabReadTokens.add(cleanStaffKey(k))
      }
    }
  }

  const unreadColabs =
    groupedColabs.totalPersonCount > 0
      ? filterCollaboratorGroupsByActiveTokens(groupedColabs, colabReadTokens)
      : { aliases: [] as string[], personCount: 0, skippedCount: 0 }

  // Calcular sem resposta dos relatórios (unanswered_report)
  const unansweredReportStudents: typeof baseStudents = []
  let answeredReportSkippedStudents = 0
  if (hasRelatorio) {
    for (const s of baseStudents) {
      const raw = String(s.aluno_id || '').trim()
      const clean = cleanStudentKey(raw)
      const dedicatedStuId = isConsolidatedReport
        ? stuComIdByAlunoId.get(raw) || stuComIdByAlunoId.get(clean) || null
        : null
      const expectedIds = dedicatedStuId ? [dedicatedStuId, comIdStr] : [comIdStr]

      const repliedInChat = hasStudentRepliedInComments(s, replyRows, dedicatedStuId, comIdStr)
      const confirmedCiencia = hasStudentActivity(s, cienciaRows, dados?.ciencias, expectedIds)

      if (repliedInChat || confirmedCiencia) {
        answeredReportSkippedStudents++
      } else {
        unansweredReportStudents.push(s)
      }
    }
  }

  let unansweredReportColabs = { aliases: [] as string[], personCount: 0, skippedCount: 0 }
  if (hasRelatorio && groupedColabs.totalPersonCount > 0 && (effectiveIsInterno || hasReportTask)) {
    const colabRespondedTokens = new Set<string>()
    for (const r of replyRows) {
      if (String(r.comunicado_id) !== comIdStr) continue
      const rem = String(r.remetente_id || '').trim()
      if (rem) {
        colabRespondedTokens.add(rem.toLowerCase())
        colabRespondedTokens.add(cleanStaffKey(rem))
      }
      const anxList = Array.isArray(r.anexos) ? r.anexos : []
      for (const item of anxList) {
        const authMeta = item && typeof item === 'object' ? item.__author__ : null
        if (authMeta) {
          for (const candidate of [authMeta.id, authMeta.auth_id, authMeta.email]) {
            if (candidate) {
              const cl = String(candidate).trim().toLowerCase()
              colabRespondedTokens.add(cl)
              colabRespondedTokens.add(cleanStaffKey(cl))
            }
          }
        }
      }
    }
    for (const c of cienciaRows) {
      if (String(c.content_id) !== comIdStr) continue
      const uid = String(c.usuario_id || '').split('#')[0].trim()
      if (uid) {
        colabRespondedTokens.add(uid.toLowerCase())
        colabRespondedTokens.add(cleanStaffKey(uid))
      }
    }

    if (hasReportTask && existingCom?.created_at) {
      try {
        const { data: submittedReports } = await supabaseServer
          .from('comunicados')
          .select('id, autor, dados')
          .like('id', 'AD-COM-REL-COLAB-%')
          .gte('created_at', existingCom.created_at)
          .limit(200)
        for (const sr of submittedReports || []) {
          const srDados = parseJsonSafe<Record<string, any>>(sr.dados, {})
          const srAutorId = String(srDados?.autorId || srDados?.autor_id || '').trim()
          if (srAutorId) {
            colabRespondedTokens.add(srAutorId.toLowerCase())
            colabRespondedTokens.add(cleanStaffKey(srAutorId))
          }
        }
      } catch {
        // non-fatal
      }
    }

    unansweredReportColabs = filterCollaboratorGroupsByActiveTokens(groupedColabs, colabRespondedTokens)
  }

  const allCount = baseStudents.length + groupedColabs.totalPersonCount
  const unreadCount = unreadStudents.length + unreadColabs.personCount
  const unansweredReportCount = hasRelatorio
    ? unansweredReportStudents.length + unansweredReportColabs.personCount
    : null
  const answeredReportCount = hasRelatorio
    ? answeredReportSkippedStudents + unansweredReportColabs.skippedCount
    : null

  return {
    capabilities: {
      hasCobranca,
      cobrancaTitulo,
      cobrancaOverdue,
      hasAutorizacao,
      autorizacaoTitulo,
      autorizacaoClosed,
      hasRelatorio,
      relatorioLabel,
      hasEnquete,
      enquetePergunta,
      enqueteClosed,
      exigeCiencia,
      isInterno: effectiveIsInterno,
      isReport: isConsolidatedReport || isIndividualStudentReport || hasRelatorio,
    },
    counts: {
      all: allCount,
      unread: unreadCount,
      unpaid: hasCobranca ? unpaidStudents.length : null,
      paid: hasCobranca ? paidOrExemptCount : null,
      unanswered_auth: hasAutorizacao ? unansweredAuthStudents.length : null,
      answered_auth: answeredAuthCount,
      unanswered_report: unansweredReportCount,
      answered_report: answeredReportCount,
      unanswered_poll: unansweredPollTotal,
      answered_poll: answeredPollTotal,
    },
    stuComIdByAlunoId,
    resolveForMode: (mode: ReminderMode) => {
      switch (mode) {
        case 'unpaid':
          return {
            students: unpaidStudents,
            colaboradores: [],
            colaboradoresCount: 0,
            skippedCount: paidOrExemptCount || 0,
          }
        case 'unanswered_auth':
          return {
            students: unansweredAuthStudents,
            colaboradores: [],
            colaboradoresCount: 0,
            skippedCount: answeredAuthCount || 0,
          }
        case 'unanswered_report':
          return {
            students: unansweredReportStudents,
            colaboradores: unansweredReportColabs.aliases,
            colaboradoresCount: unansweredReportColabs.personCount,
            skippedCount: (answeredReportSkippedStudents || 0) + unansweredReportColabs.skippedCount,
          }
        case 'unanswered_poll':
          return {
            students: unansweredPollStudents,
            colaboradores: unansweredPollColabs.aliases,
            colaboradoresCount: unansweredPollColabs.personCount,
            skippedCount: answeredPollTotal || 0,
          }
        case 'unread':
          return {
            students: unreadStudents,
            colaboradores: unreadColabs.aliases,
            colaboradoresCount: unreadColabs.personCount,
            skippedCount: unreadSkippedStudents + unreadColabs.skippedCount,
          }
        case 'all':
        default:
          return {
            students: baseStudents,
            colaboradores: baseColabRaw,
            colaboradoresCount: groupedColabs.totalPersonCount,
            skippedCount: 0,
          }
      }
    },
  }
}

export async function GET(request: Request) {
  const { user, dbUser, perfil, cargo, errorResponse } = await requireStaff(request)
  if (errorResponse || !user || !dbUser) {
    return errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'ID do comunicado é obrigatório.' }, { status: 400 })
    }

    const { data: existingCom, error: fetchErr } = await supabaseServer
      .from('comunicados')
      .select('id, titulo, texto, autor, data, destino, fixado, dados, created_at')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!existingCom) {
      return NextResponse.json({ error: 'Comunicado não encontrado.' }, { status: 404 })
    }

    const dados = parseJsonSafe<Record<string, any>>(existingCom.dados, {})

    if (!checkCanManageReminder(user, dbUser, perfil, cargo, existingCom, dados)) {
      return NextResponse.json(
        { error: 'Acesso negado: Apenas quem enviou o comunicado ou um administrador pode consultar lembretes.' },
        { status: 403 }
      )
    }

    const analyzed = await analyzeComunicadoReminderTargets(String(existingCom.id), existingCom, dados, {
      reconcilePayments: false,
    })

    const prevHistory: any[] = Array.isArray(dados?.lembretes_historico) ? dados.lembretes_historico : []

    return NextResponse.json({
      ok: true,
      comunicadoId: String(existingCom.id),
      capabilities: analyzed.capabilities,
      counts: analyzed.counts,
      lembretes_historico: prevHistory,
    })
  } catch (err: any) {
    console.error('[GET /api/comunicados/lembrete] Erro:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar resumo de destinatários do lembrete.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { user, dbUser, perfil, cargo, errorResponse } = await requireStaff(request)
  if (errorResponse || !user || !dbUser) {
    return errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const rawMode = typeof body?.mode === 'string' ? (body.mode.trim() as ReminderMode) : 'all'
    const mode: ReminderMode = VALID_MODES.has(rawMode) ? rawMode : 'all'

    const rawCustomMessage = typeof body?.customMessage === 'string' ? body.customMessage : ''
    const customMessage = rawCustomMessage
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CUSTOM_MESSAGE_LEN)

    if (!id) {
      return NextResponse.json({ error: 'ID do comunicado é obrigatório.' }, { status: 400 })
    }

    const { data: existingCom, error: fetchErr } = await supabaseServer
      .from('comunicados')
      .select('id, titulo, texto, autor, data, destino, fixado, dados, created_at')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!existingCom) {
      return NextResponse.json({ error: 'Comunicado não encontrado.' }, { status: 404 })
    }

    const dados = parseJsonSafe<Record<string, any>>(existingCom.dados, {})

    if (!checkCanManageReminder(user, dbUser, perfil, cargo, existingCom, dados)) {
      return NextResponse.json(
        { error: 'Acesso negado: Apenas quem enviou o comunicado ou um administrador pode enviar lembrete.' },
        { status: 403 }
      )
    }

    const comStatus = String(dados?.status || 'enviado').toLowerCase().trim()
    if (comStatus === 'rascunho' || comStatus === 'agendado') {
      return NextResponse.json(
        { error: 'Só é possível enviar lembrete para comunicados que já foram enviados.' },
        { status: 400 }
      )
    }

    // Cooldown anti-clique duplo por modo (30s) — permite disparar categorias diferentes em sequência sem bloqueio indevido
    const prevHistory: any[] = Array.isArray(dados?.lembretes_historico) ? dados.lembretes_historico : []
    const lastSameModeReminder = prevHistory.find(h => (h?.mode || 'all') === mode)
    if (lastSameModeReminder?.sentAt) {
      const elapsedMs = Date.now() - new Date(lastSameModeReminder.sentAt).getTime()
      if (!isNaN(elapsedMs) && elapsedMs >= 0 && elapsedMs < REMINDER_COOLDOWN_MS) {
        const waitSec = Math.ceil((REMINDER_COOLDOWN_MS - elapsedMs) / 1000)
        return NextResponse.json(
          {
            error: `Um lembrete para "${MODE_LABELS[mode]}" acabou de ser enviado. Aguarde ${waitSec}s antes de reenviar esta mesma opção.`,
          },
          { status: 429 }
        )
      }
    }

    // Verificar configuração global de push para comunicados
    try {
      const { data: configRow } = await supabaseServer
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'ad_config')
        .maybeSingle()
      if (configRow?.valor?.notificacoes?.pushComunicados === false) {
        return NextResponse.json(
          {
            ok: false,
            disabledByConfig: true,
            error: 'As notificações push para comunicados estão desativadas nas configurações da Agenda Digital.',
          },
          { status: 400 }
        )
      }
    } catch (cfgErr) {
      console.warn('[Comunicados Lembrete] Aviso ao consultar ad_config:', cfgErr)
    }

    const comIdStr = String(existingCom.id)
    const analyzed = await analyzeComunicadoReminderTargets(comIdStr, existingCom, dados, {
      reconcilePayments: mode === 'unpaid',
    })

    const { capabilities, stuComIdByAlunoId } = analyzed

    if (mode === 'unpaid' && !capabilities.hasCobranca) {
      return NextResponse.json(
        { error: 'Este comunicado não possui cobrança vinculada.' },
        { status: 400 }
      )
    }
    if (mode === 'unanswered_auth' && !capabilities.hasAutorizacao) {
      return NextResponse.json(
        { error: 'Este comunicado não possui uma autorização digital vinculada.' },
        { status: 400 }
      )
    }
    if (mode === 'unanswered_report' && !capabilities.hasRelatorio) {
      return NextResponse.json(
        { error: 'Este comunicado não possui relatório ou formulário vinculado.' },
        { status: 400 }
      )
    }
    if (mode === 'unanswered_poll' && !capabilities.hasEnquete) {
      return NextResponse.json(
        { error: 'Este comunicado não possui enquete vinculada.' },
        { status: 400 }
      )
    }

    const resolvedTargets = analyzed.resolveForMode(mode)
    const targetStudents = resolvedTargets.students
    const targetColaboradores = resolvedTargets.colaboradores
    const targetColaboradoresCount = resolvedTargets.colaboradoresCount
    const alreadyReadSkipped = resolvedTargets.skippedCount

    const reminderBatchId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const senderDisplayName =
      dbUser.nome ||
      user.user_metadata?.nome ||
      user.user_metadata?.name ||
      existingCom.autor ||
      'Equipe Escolar'
    const tituloCom = String(existingCom.titulo || 'Comunicado').trim()
    const tituloAut = String(capabilities.autorizacaoTitulo || tituloCom).trim()
    const tituloCob = String(capabilities.cobrancaTitulo || tituloCom).trim()
    const tituloEnq = String(capabilities.enquetePergunta || tituloCom).trim()

    const pushTitle =
      mode === 'unpaid'
        ? `💳 Pagamento pendente: ${tituloCob}`
        : mode === 'unanswered_auth'
          ? `✍️ Autorização pendente: ${tituloAut}`
          : mode === 'unanswered_report'
            ? `📋 Relatório pendente: ${tituloCom}`
            : mode === 'unanswered_poll'
              ? `📊 Enquete pendente: ${tituloCom}`
              : `🔔 Lembrete: ${tituloCom}`

    const isConsolidatedReport = Boolean(
      comIdStr.startsWith('AD-COM-REL-COLAB-') ||
        comIdStr.startsWith('AD-COM-REL-TURMA-') ||
        (comIdStr.startsWith('AD-COM-REL-') && !comIdStr.startsWith('AD-COM-REL-STU-'))
    )
    const isIndividualStudentReport = Boolean(
      comIdStr.startsWith('AD-COM-REL-STU-') || dados?.tipoRelatorio === 'individual'
    )

    const pushTasks: Array<{ weight: number; run: () => Promise<any> }> = []

    if (!capabilities.isInterno) {
      for (const student of targetStudents) {
        if (!student.responsaveis_ids || student.responsaveis_ids.length === 0) continue

        const rawAluno = String(student.aluno_id || '').trim()
        const cleanAluno = cleanStudentKey(rawAluno)
        const targetComId = isConsolidatedReport
          ? stuComIdByAlunoId.get(rawAluno) || stuComIdByAlunoId.get(cleanAluno) || comIdStr
          : comIdStr

        const nomeAluno = formatFriendlyStudentName(student.aluno_nome)
        const familyTargetUrl = `/agenda-digital/${encodeURIComponent(rawAluno)}/comunicados?id=${encodeURIComponent(targetComId)}`

        const bodyMessage = customMessage
          ? nomeAluno
            ? `${nomeAluno}: ${customMessage}`
            : customMessage
          : mode === 'unpaid'
            ? `Lembrete de ${senderDisplayName}: há uma cobrança pendente ("${tituloCob}") referente a ${nomeAluno} na Agenda Digital. Toque para conferir!`
            : mode === 'unanswered_auth'
              ? `A autorização "${tituloAut}" referente a ${nomeAluno} aguarda sua assinatura na Agenda Digital. Toque para responder!`
              : mode === 'unanswered_report'
                ? `Lembrete de ${senderDisplayName}: o relatório "${tituloCom}" de ${nomeAluno} aguarda sua resposta na Agenda Digital. Toque para abrir!`
                : mode === 'unanswered_poll'
                  ? `A enquete "${tituloEnq}" referente a ${nomeAluno} aguarda sua participação na Agenda Digital. Toque para votar!`
                  : isIndividualStudentReport || isConsolidatedReport
                    ? `Lembrete de ${senderDisplayName}: confira o relatório "${tituloCom}" de ${nomeAluno}. Toque para abrir!`
                    : `Lembrete de ${senderDisplayName}: confira o comunicado "${tituloCom}" para ${nomeAluno}. Toque para abrir!`

        pushTasks.push({
          weight: 1,
          run: () =>
            sendAgendaPushNotification({
              type: 'comunicados',
              itemId: `${targetComId}-reminder-${reminderBatchId}`,
              collapseId: `rem_${targetComId}_${reminderBatchId}`,
              title: pushTitle,
              message: bodyMessage,
              targetUserIds: student.responsaveis_ids,
              targetUrl: familyTargetUrl,
              senderUserId: user.id,
              metadata: {
                aluno_id: rawAluno,
                aluno_nome: nomeAluno,
                perfil_destino: 'familiar',
                item_id: String(targetComId),
                comunicado_id: String(targetComId),
                parent_comunicado_id: isConsolidatedReport ? comIdStr : undefined,
                rota: 'comunicados',
                targetUrl: familyTargetUrl,
                is_reminder: true,
                reminder_batch_id: reminderBatchId,
                reminder_mode: mode,
                reminder_mode_label: MODE_LABELS[mode],
                reminder_sent_by: user.id,
                reminder_sent_by_name: senderDisplayName,
                author: existingCom.autor || senderDisplayName,
                author_id: dados?.autorId || user.id,
                author_cargo: dados?.autorCargo || cargo,
                author_foto: dados?.autorFoto || null,
              },
            }),
        })
      }
    }

    if (targetColaboradores.length > 0 && !isIndividualStudentReport && !isConsolidatedReport) {
      const colabTargetUrl = `/agenda-digital/colaborador/comunicados?id=${encodeURIComponent(comIdStr)}`
      const colabMessage = customMessage
        ? `${senderDisplayName}: ${customMessage}`
        : mode === 'unanswered_report'
          ? `Lembrete de ${senderDisplayName}: o relatório "${tituloCom}" aguarda seu preenchimento ou resposta. Toque para abrir!`
          : mode === 'unanswered_poll'
            ? `A enquete "${tituloEnq}" aguarda seu voto na Agenda Digital. Toque para responder!`
            : `Lembrete de ${senderDisplayName}: confira o comunicado "${tituloCom}". Toque para abrir!`

      pushTasks.push({
        weight: Math.max(1, targetColaboradoresCount),
        run: () =>
          sendAgendaPushNotification({
            type: 'comunicados',
            itemId: `${comIdStr}-reminder-${reminderBatchId}`,
            collapseId: `rem_${comIdStr}_${reminderBatchId}`,
            title: pushTitle,
            message: colabMessage,
            targetUserIds: targetColaboradores,
            targetUrl: colabTargetUrl,
            senderUserId: user.id,
            metadata: {
              perfil_destino: 'colaborador',
              item_id: comIdStr,
              comunicado_id: comIdStr,
              rota: 'comunicados',
              targetUrl: colabTargetUrl,
              is_reminder: true,
              reminder_batch_id: reminderBatchId,
              reminder_mode: mode,
              reminder_mode_label: MODE_LABELS[mode],
              reminder_sent_by: user.id,
              reminder_sent_by_name: senderDisplayName,
              author: existingCom.autor || senderDisplayName,
              author_id: dados?.autorId || user.id,
              author_cargo: dados?.autorCargo || cargo,
              author_foto: dados?.autorFoto || null,
            },
          }),
      })
    }

    if (pushTasks.length === 0) {
      const noTargetMsg =
        mode === 'unpaid'
          ? alreadyReadSkipped > 0
            ? 'Todos os destinatários elegíveis já estão com o pagamento confirmado!'
            : 'Nenhum destinatário pendente de pagamento encontrado para esta cobrança.'
          : mode === 'unanswered_auth'
            ? alreadyReadSkipped > 0
              ? 'Todos os alunos destinatários já possuem resposta assinada nesta autorização!'
              : 'Nenhum responsável elegível encontrado para os alunos pendentes.'
            : mode === 'unanswered_report'
              ? alreadyReadSkipped > 0
                ? 'Todos os destinatários já enviaram resposta ou confirmação neste relatório!'
                : 'Nenhum destinatário pendente de resposta encontrado para este relatório.'
              : mode === 'unanswered_poll'
                ? alreadyReadSkipped > 0
                  ? 'Todos os destinatários já participaram desta enquete!'
                  : 'Nenhum destinatário pendente encontrado para esta enquete.'
                : mode === 'unread' && alreadyReadSkipped > 0
                  ? Boolean(dados?.exigeCiencia)
                    ? 'Todos os destinatários já leram e confirmaram ciência neste comunicado.'
                    : 'Todos os destinatários já visualizaram este comunicado.'
                  : 'Nenhum destinatário elegível encontrado para este comunicado.'

      return NextResponse.json(
        {
          ok: false,
          noTargets: true,
          alreadyReadSkipped,
          counts: analyzed.counts,
          error: noTargetMsg,
        },
        { status: 400 }
      )
    }

    const totalWeightedTargets = pushTasks.reduce((acc, t) => acc + t.weight, 0)
    const outcomes: Array<{ weight: number; res: any }> = []
    for (let i = 0; i < pushTasks.length; i += BATCH_SIZE) {
      const slice = pushTasks.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(slice.map(t => t.run()))
      batchResults.forEach((r, idx) => {
        outcomes.push({
          weight: slice[idx].weight,
          res: r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Erro' },
        })
      })
    }

    let sentCount = 0
    let noSubscribersCount = 0
    let pausedCount = 0
    let disabledCount = 0
    let failedCount = 0
    let mockCount = 0

    for (const { weight, res } of outcomes) {
      if (res?.skipped) {
        if (res.reason === 'notifications_paused') pausedCount += weight
        else if (res.reason === 'disabled_by_admin_config') disabledCount += weight
        else noSubscribersCount += weight
      } else if (res?.success) {
        sentCount += weight
        if (res.mock) mockCount += weight
      } else if (res?.noSubscribers) {
        noSubscribersCount += weight
      } else {
        failedCount += weight
      }
    }

    if (sentCount === 0 && pausedCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          paused: true,
          error:
            'As notificações push estão pausadas globalmente no sistema. Desative o modo pausa para enviar lembretes.',
        },
        { status: 409 }
      )
    }

    if (sentCount === 0 && disabledCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          disabledByConfig: true,
          error: 'O envio de notificações push para comunicados está desativado nas configurações.',
        },
        { status: 400 }
      )
    }

    const historyEntry = {
      id: `REM-${reminderBatchId}`,
      sentAt: new Date().toISOString(),
      sentById: user.id,
      sentByName: senderDisplayName,
      mode,
      modeLabel: MODE_LABELS[mode],
      customMessage: customMessage || null,
      totalTargets: totalWeightedTargets,
      sent: sentCount,
      noSubscribers: noSubscribersCount,
      failed: failedCount,
      alreadyReadSkipped,
      mock: mockCount > 0,
    }

    const nextHistory = [historyEntry, ...prevHistory].slice(0, 20)
    const updatedDados = {
      ...dados,
      lembretes_historico: nextHistory,
    }

    const { error: updateErr } = await supabaseServer
      .from('comunicados')
      .update({
        dados: updatedDados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', comIdStr)

    if (updateErr) {
      console.warn('[Comunicados Lembrete] Falha ao gravar histórico de lembrete:', updateErr.message)
    }

    const skippedReasonLabel =
      mode === 'unpaid'
        ? 'já haviam pago'
        : mode === 'unanswered_auth'
          ? 'já haviam respondido a autorização'
          : mode === 'unanswered_report'
            ? 'já haviam respondido ao relatório'
            : mode === 'unanswered_poll'
              ? 'já haviam votado'
              : 'já haviam lido'

    let message = ''
    if (sentCount > 0) {
      message = `Lembrete enviado para ${sentCount} destinatário(s)!`
      if (noSubscribersCount > 0) {
        message += ` (${noSubscribersCount} sem aparelho inscrito para push)`
      }
      if (alreadyReadSkipped > 0) {
        message += ` • ${alreadyReadSkipped} ${skippedReasonLabel}.`
      }
    } else if (noSubscribersCount > 0 && failedCount === 0) {
      message = `Nenhum destinatário elegível possui aparelho inscrito para notificações push no momento (${noSubscribersCount} sem inscrição).`
    } else {
      return NextResponse.json(
        {
          ok: false,
          sent: sentCount,
          noSubscribers: noSubscribersCount,
          failed: failedCount,
          error: 'Não foi possível entregar o lembrete via OneSignal. Verifique a configuração de push.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      ...historyEntry,
      lembretes_historico: nextHistory,
      counts: analyzed.counts,
      message,
    })
  } catch (err: any) {
    console.error('[POST /api/comunicados/lembrete] Erro:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno ao enviar lembrete.' }, { status: 500 })
  }
}
