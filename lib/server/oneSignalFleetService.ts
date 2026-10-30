import { getAdminClient, getAllAuthUsersCached } from '@/lib/server/supabaseAdminSingleton'
import {
  isStudentInactiveStatus,
  isFamilyOnlySystemUserRole,
  deleteOneSignalUserByAlias,
} from '@/lib/server/pushService'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'

export type FleetDeviceCleanupReason =
  | 'aluno_inativo'
  | 'colaborador_inativo'
  | 'orfao'
  | 'desativado'
  | 'duplicado'
  | 'sem_uso_30d'
  | 'sem_uso_60d'
  | 'sem_uso_90d'
  | 'sem_uso_180d'

export interface LinkedStudentSummary {
  id: string
  nome: string
  friendlyName: string
  matricula: string
  turma: string
  status: string
  isInactive: boolean
}

export interface OneSignalFleetDevice {
  id: string
  externalUserId: string | null
  platform: 'iOS' | 'Android' | 'Web'
  platformRaw: string
  model: string
  modelRaw: string
  os: string
  appVersion: string
  sessionCount: number
  playtimeSeconds: number
  createdAt: string | null
  lastActiveAt: string | null
  daysInactive: number
  isSubscribed: boolean
  notificationTypes: number | null
  hasToken: boolean
  tokenPreview: string | null
  statusLabel: string
  statusTone: 'success' | 'warning' | 'danger'

  // Owner & Vínculo Escolar
  ownerKey: string
  ownerType: 'responsavel' | 'colaborador' | 'aluno' | 'orfao'
  ownerId: string | null
  ownerAuthId: string | null
  ownerName: string
  ownerEmail: string | null
  ownerPhone: string | null
  ownerRole: string
  ownerFoto: string | null
  ownerStatus: 'ativo' | 'inativo' | 'orfao'
  isStaffMember: boolean
  linkedStudents: LinkedStudentSummary[]
  activeStudentsCount: number
  inactiveStudentsCount: number

  // Diagnóstico de Duplicidade e Limpeza
  deviceRankInUser: number
  userTotalDevices: number
  isDuplicateStale: boolean
  isProtected: boolean
  protectionReason: string | null
  cleanupReasons: FleetDeviceCleanupReason[]
  isRecommendedForCleanup: boolean
  primaryCleanupBadge: {
    code: string
    label: string
    tone: 'danger' | 'warning' | 'info' | 'neutral'
  } | null
}

export interface OneSignalFleetSummary {
  isMockMode: boolean
  totalDevices: number
  activeDevices: number
  disabledDevices: number
  uniqueUsersTotal: number
  uniqueUsersWithActivePush: number
  byPlatform: {
    ios: { total: number; active: number }
    android: { total: number; active: number }
    web: { total: number; active: number }
  }
  byCategory: {
    activeFamily: number
    activeStaff: number
    inactiveStudents: number
    inactiveStudentsActivePush: number
    orphans: number
    orphansActivePush: number
    disabledPush: number
    duplicatesStale: number
    duplicatesStaleActivePush: number
    unused30d: number
    unused30dNonStaff: number
    unused60d: number
    unused60dNonStaff: number
    unused90d: number
    unused90dNonStaff: number
    unused180d: number
    recommendedCleanupTotal: number
    recommendedActiveSlotsFreed: number
  }
}

export interface OneSignalFleetOverviewResult {
  success: boolean
  fetchedAt: string
  summary: OneSignalFleetSummary
  devices: OneSignalFleetDevice[]
}

function formatDeviceModelFriendly(model: string, platform: 'iOS' | 'Android' | 'Web'): string {
  if (!model || !model.trim()) {
    return platform === 'iOS'
      ? 'Apple iPhone / iPad'
      : platform === 'Android'
      ? 'Smartphone Android'
      : 'Navegador Web (PC/Mac)'
  }
  const m = model.trim()
  const appleModels: Record<string, string> = {
    'iPhone18,1': 'iPhone 16 Pro',
    'iPhone18,2': 'iPhone 16 Pro Max',
    'iPhone17,1': 'iPhone 16',
    'iPhone17,2': 'iPhone 16 Plus',
    'iPhone16,1': 'iPhone 15 Pro',
    'iPhone16,2': 'iPhone 15 Pro Max',
    'iPhone15,4': 'iPhone 15',
    'iPhone15,5': 'iPhone 15 Plus',
    'iPhone15,2': 'iPhone 14 Pro',
    'iPhone15,3': 'iPhone 14 Pro Max',
    'iPhone14,7': 'iPhone 14',
    'iPhone14,8': 'iPhone 14 Plus',
    'iPhone14,2': 'iPhone 13 Pro',
    'iPhone14,3': 'iPhone 13 Pro Max',
    'iPhone14,5': 'iPhone 13',
    'iPhone14,4': 'iPhone 13 mini',
    'iPhone13,2': 'iPhone 12',
    'iPhone13,3': 'iPhone 12 Pro',
    'iPhone13,4': 'iPhone 12 Pro Max',
    'iPhone12,1': 'iPhone 11',
    'iPhone12,3': 'iPhone 11 Pro',
    'iPhone12,5': 'iPhone 11 Pro Max',
    'iPhone11,8': 'iPhone XR',
    'iPhone11,2': 'iPhone XS',
    'iPhone10,3': 'iPhone X',
    'iPhone10,6': 'iPhone X',
    'iPhone14,6': 'iPhone SE (3ª ger.)',
    'iPhone12,8': 'iPhone SE (2ª ger.)',
    MacIntel: 'Apple Mac (Web)',
    Win32: 'Windows PC (Web)',
    'Linux x86_64': 'Linux PC (Web)',
  }
  if (appleModels[m]) return appleModels[m]
  if (m.startsWith('iPhone')) return `Apple ${m}`
  if (m.startsWith('iPad')) return `Apple ${m}`
  if (m.startsWith('SM-')) return `Samsung Galaxy (${m})`
  if (m.toLowerCase().startsWith('moto')) return `Motorola (${m})`
  if (m.toLowerCase().startsWith('redmi') || m.toLowerCase().startsWith('poco')) return `Xiaomi ${m}`
  return m
}

function detectPlatform(deviceType: number | undefined, model: string): 'iOS' | 'Android' | 'Web' {
  if (deviceType === 0) return 'iOS'
  if (deviceType === 1 || deviceType === 2) return 'Android'
  const m = (model || '').toLowerCase()
  if (m.includes('iphone') || m.includes('ipad') || m.includes('ios')) return 'iOS'
  if (m.includes('android') || m.startsWith('sm-') || m.includes('moto') || m.includes('redmi')) return 'Android'
  return 'Web'
}

/**
 * Exclui apenas a subscrição/aparelho específico no OneSignal, SEM deletar a identidade
 * do usuário proprietário (seguro para remover sessões duplicadas mantendo o aparelho principal).
 */
export async function deleteOneSignalSubscriptionOnly(
  subId: string,
  appIdOverride?: string,
  apiKeyOverride?: string
): Promise<boolean> {
  const appId = appIdOverride || process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = apiKeyOverride || process.env.ONESIGNAL_REST_API_KEY || ''
  if (!appId || !apiKey || !subId) return false

  const cleanSubId = subId.trim()
  let ok = false

  try {
    const resPlayer = await fetch(
      `https://onesignal.com/api/v1/players/${encodeURIComponent(cleanSubId)}?app_id=${encodeURIComponent(appId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${apiKey}` },
      }
    )
    if (resPlayer.ok || resPlayer.status === 404) ok = true
  } catch {}

  try {
    const resSub = await fetch(
      `https://onesignal.com/api/v1/apps/${encodeURIComponent(appId)}/subscriptions/${encodeURIComponent(cleanSubId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${apiKey}` },
      }
    )
    if (resSub.ok || resSub.status === 404) ok = true
  } catch {}

  return ok
}

/**
 * Busca todos os players do OneSignal (paginado em paralelo para máxima velocidade)
 */
async function fetchAllOneSignalPlayers(appId: string, apiKey: string): Promise<any[]> {
  try {
    const firstRes = await fetch(
      `https://onesignal.com/api/v1/players?app_id=${encodeURIComponent(appId)}&limit=300&offset=0`,
      {
        headers: { Authorization: `Basic ${apiKey}` },
        cache: 'no-store',
      }
    )
    if (!firstRes.ok) return []

    const firstData = await firstRes.json().catch(() => ({}))
    const firstPlayers: any[] = Array.isArray(firstData.players) ? firstData.players : []
    const totalCount = Number(firstData.total_count || firstPlayers.length)
    // OneSignal API v1 impõe limite real de 200 players por página mesmo quando limit=300 é enviado
    const pageSize = Number(firstData.limit) > 0 ? Number(firstData.limit) : (firstPlayers.length || 200)

    if (firstPlayers.length === 0 || totalCount <= firstPlayers.length) {
      return firstPlayers
    }

    const maxOffset = Math.min(totalCount, 5000)
    const offsets: number[] = []
    for (let offset = firstPlayers.length; offset < maxOffset; offset += pageSize) {
      offsets.push(offset)
    }

    const pageResults = await Promise.all(
      offsets.map(async offset => {
        try {
          const r = await fetch(
            `https://onesignal.com/api/v1/players?app_id=${encodeURIComponent(appId)}&limit=${pageSize}&offset=${offset}`,
            {
              headers: { Authorization: `Basic ${apiKey}` },
              cache: 'no-store',
            }
          )
          if (!r.ok) return []
          const d = await r.json().catch(() => ({}))
          return Array.isArray(d.players) ? d.players : []
        } catch {
          return []
        }
      })
    )

    const allPlayers = [...firstPlayers, ...pageResults.flat()]
    const uniqueMap = new Map<string, any>()
    for (const p of allPlayers) {
      if (p?.id) uniqueMap.set(String(p.id).trim(), p)
    }
    return Array.from(uniqueMap.values())
  } catch (err: any) {
    console.error('[OneSignalFleet] Erro ao buscar players:', err?.message)
    return []
  }
}

/**
 * Gera o raio-X completo de todos os aparelhos registrados no OneSignal cruzados com o banco da escola.
 */
export async function getOneSignalFleetOverview(): Promise<OneSignalFleetOverviewResult> {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''
  const isMockMode = !appId || !apiKey

  const emptySummary: OneSignalFleetSummary = {
    isMockMode,
    totalDevices: 0,
    activeDevices: 0,
    disabledDevices: 0,
    uniqueUsersTotal: 0,
    uniqueUsersWithActivePush: 0,
    byPlatform: {
      ios: { total: 0, active: 0 },
      android: { total: 0, active: 0 },
      web: { total: 0, active: 0 },
    },
    byCategory: {
      activeFamily: 0,
      activeStaff: 0,
      inactiveStudents: 0,
      inactiveStudentsActivePush: 0,
      orphans: 0,
      orphansActivePush: 0,
      disabledPush: 0,
      duplicatesStale: 0,
      duplicatesStaleActivePush: 0,
      unused30d: 0,
      unused30dNonStaff: 0,
      unused60d: 0,
      unused60dNonStaff: 0,
      unused90d: 0,
      unused90dNonStaff: 0,
      unused180d: 0,
      recommendedCleanupTotal: 0,
      recommendedActiveSlotsFreed: 0,
    },
  }

  if (isMockMode) {
    return {
      success: true,
      fetchedAt: new Date().toISOString(),
      summary: emptySummary,
      devices: [],
    }
  }

  const supabase = getAdminClient()

  // Helper para buscar todas as linhas sem o corte padrão de 1000 registros do PostgREST
  async function fetchAllRows(table: string, cols: string): Promise<any[]> {
    const all: any[] = []
    let from = 0
    const step = 1000
    while (from < 10000) {
      const { data, error } = await supabase
        .from(table)
        .select(cols)
        .range(from, from + step - 1)
      if (error || !data || data.length === 0) break
      all.push(...data)
      if (data.length < step) break
      from += step
    }
    return all
  }

  const [
    rawPlayers,
    allAlunos,
    allTurmas,
    allLinks,
    allResponsaveis,
    allSysUsers,
    allFuncionarios,
    authUsers,
  ] = await Promise.all([
    fetchAllOneSignalPlayers(appId, apiKey),
    fetchAllRows(
      'alunos',
      'id, nome, matricula, turma, status, foto, email, dados, responsavel, responsavel_financeiro, responsavel_pedagogico'
    ),
    fetchAllRows('turmas', 'id, nome, codigo'),
    fetchAllRows('aluno_responsavel', 'aluno_id, responsavel_id, parentesco, resp_financeiro, resp_pedagogico'),
    fetchAllRows('responsaveis', 'id, nome, email, telefone, celular, auth_id, dados'),
    fetchAllRows('system_users', 'id, auth_id, nome, email, status, perfil, cargo, ultimoacesso, dados'),
    fetchAllRows('funcionarios', 'id, nome, email, cargo, status, dados'),
    getAllAuthUsersCached().catch(() => [] as any[]),
  ])

  // 1. Indexar Turmas
  const turmaNameMap = new Map<string, string>()
  for (const t of allTurmas || []) {
    if (t?.id) turmaNameMap.set(String(t.id).trim(), t.nome || t.codigo || String(t.id))
  }

  // 2. Indexar Alunos (por id, id sem zero à esquerda, matricula)
  const studentMap = new Map<string, any>()
  const addStudentKey = (key: unknown, st: any) => {
    if (!key) return
    const k = String(key).trim()
    if (!k) return
    studentMap.set(k, st)
    studentMap.set(k.toLowerCase(), st)
    const stripped = k.replace(/^0+/, '')
    if (stripped) studentMap.set(stripped, st)
  }

  for (const a of allAlunos || []) {
    const turmaNome = a.turma ? (turmaNameMap.get(String(a.turma).trim()) || String(a.turma)) : 'Sem turma'
    const inactive = isStudentInactiveStatus(a)
    const enrichedStudent: LinkedStudentSummary & { raw: any } = {
      id: String(a.id).trim(),
      nome: a.nome || 'Aluno',
      friendlyName: formatFriendlyStudentName(a.nome || 'Aluno'),
      matricula: String(a.matricula || a.id || '').trim(),
      turma: turmaNome,
      status: String(a.status || a.dados?.status || (inactive ? 'inativo' : 'ativo')),
      isInactive: inactive,
      raw: a,
    }
    addStudentKey(a.id, enrichedStudent)
    addStudentKey(a.matricula, enrichedStudent)
    addStudentKey(a.dados?.codigo, enrichedStudent)
    addStudentKey(a.dados?.id, enrichedStudent)
    if (a.matricula) {
      addStudentKey(`aluno.${String(a.matricula).trim().toLowerCase()}@impactoedu.local`, enrichedStudent)
    }
  }

  // 3. Indexar Auth Users
  const authById = new Map<string, any>()
  const authByEmail = new Map<string, any>()
  for (const au of authUsers || []) {
    if (!au?.id) continue
    authById.set(String(au.id).trim(), au)
    authById.set(String(au.id).trim().toLowerCase(), au)
    const em = String(au.email || '').trim().toLowerCase()
    if (em) authByEmail.set(em, au)
  }

  // 4. Indexar Colaboradores e Usuários de Sistema
  const staffMap = new Map<string, any>()
  const sysUserMap = new Map<string, any>()

  const addStaffKey = (key: unknown, item: any) => {
    if (!key) return
    const k = String(key).trim()
    if (!k) return
    staffMap.set(k, item)
    staffMap.set(k.toLowerCase(), item)
    const clean = k.replace(/^(?:f_|func_|eq_|g_)/i, '').trim()
    if (clean) {
      staffMap.set(clean, item)
      staffMap.set(clean.toLowerCase(), item)
    }
  }

  for (const f of allFuncionarios || []) {
    const isInactive = String(f.status || '').trim().toLowerCase() === 'inativo'
    const entry = {
      id: String(f.id).trim(),
      authId: null as string | null,
      nome: f.nome || 'Colaborador',
      email: f.email ? String(f.email).trim().toLowerCase() : null,
      cargo: f.cargo || f.funcao || 'Colaborador',
      perfil: 'Colaborador',
      foto: null as string | null,
      isInactive,
    }
    addStaffKey(f.id, entry)
    if (entry.email) addStaffKey(entry.email, entry)
  }

  for (const su of allSysUsers || []) {
    const suId = String(su.id || '').trim()
    const suAuth = su.auth_id ? String(su.auth_id).trim() : null
    const suEmail = su.email ? String(su.email).trim().toLowerCase() : null
    if (suId) {
      sysUserMap.set(suId, su)
      sysUserMap.set(suId.toLowerCase(), su)
    }
    if (suAuth) {
      sysUserMap.set(suAuth, su)
      sysUserMap.set(suAuth.toLowerCase(), su)
    }
    if (suEmail) {
      sysUserMap.set(suEmail, su)
    }

    if (!isFamilyOnlySystemUserRole(su)) {
      const isInactive = String(su.status || '').trim().toLowerCase() === 'inativo'
      const entry = {
        id: suId,
        authId: suAuth,
        nome: su.nome || 'Colaborador',
        email: suEmail,
        cargo: su.cargo || su.perfil || 'Equipe Escolar',
        perfil: su.perfil || 'Colaborador',
        foto: (su as any).foto || su.dados?.foto || null,
        isInactive,
      }
      addStaffKey(suId, entry)
      if (suAuth) addStaffKey(suAuth, entry)
      if (suEmail) addStaffKey(suEmail, entry)
    }
  }

  // 5. Indexar Vínculos Aluno <-> Responsável
  const studentIdsByResp = new Map<string, Set<string>>()
  const respIdsByStudent = new Map<string, Set<string>>()

  const registerLink = (rIdRaw: unknown, aIdRaw: unknown) => {
    const rId = String(rIdRaw || '').trim()
    const aId = String(aIdRaw || '').trim()
    if (!rId || !aId) return
    const rClean = rId.replace(/^0+/, '') || rId
    const aClean = aId.replace(/^0+/, '') || aId

    for (const rk of [rId, rClean]) {
      if (!studentIdsByResp.has(rk)) studentIdsByResp.set(rk, new Set())
      studentIdsByResp.get(rk)!.add(aId)
    }
    for (const ak of [aId, aClean]) {
      if (!respIdsByStudent.has(ak)) respIdsByStudent.set(ak, new Set())
      respIdsByStudent.get(ak)!.add(rId)
    }
  }

  for (const l of allLinks || []) {
    registerLink(l.responsavel_id, l.aluno_id)
  }

  // 6. Indexar Responsáveis
  const guardianMap = new Map<string, any>()
  const addGuardianKey = (key: unknown, g: any) => {
    if (!key) return
    const k = String(key).trim()
    if (!k) return
    guardianMap.set(k, g)
    guardianMap.set(k.toLowerCase(), g)
    const stripped = k.replace(/^0+/, '')
    if (stripped) guardianMap.set(stripped, g)
  }

  for (const r of allResponsaveis || []) {
    const rId = String(r.id || '').trim()
    if (!rId) continue
    if (Array.isArray(r.dados?.alunosVinculados)) {
      for (const aid of r.dados.alunosVinculados) {
        registerLink(rId, aid)
      }
    }

    const rEmail = String(r.email || r.dados?.email || '').trim().toLowerCase()
    const matchedAuth = rEmail ? authByEmail.get(rEmail) : null
    const rAuthId = String(
      r.auth_id || r.dados?.auth_id || r.dados?.user_id || matchedAuth?.id || ''
    ).trim()

    // Resolver nome caso r.nome esteja em branco (herdando do vínculo com aluno)
    let resolvedName = String(r.nome || r.dados?.nome || matchedAuth?.user_metadata?.nome || '').trim()
    const linkedStudentIdSet = studentIdsByResp.get(rId) || studentIdsByResp.get(rId.replace(/^0+/, '')) || new Set<string>()
    if (!resolvedName && linkedStudentIdSet.size > 0) {
      const firstSt = studentMap.get(Array.from(linkedStudentIdSet)[0])
      if (firstSt?.raw) {
        resolvedName = String(
          firstSt.raw.responsavel || firstSt.raw.responsavel_financeiro || firstSt.raw.responsavel_pedagogico || ''
        ).trim()
      }
    }
    if (!resolvedName) resolvedName = 'Responsável Legal'

    const gEntry = {
      id: rId,
      authId: rAuthId || null,
      nome: resolvedName,
      email: rEmail || null,
      telefone: r.telefone || r.celular || null,
      foto: r.dados?.foto || null,
    }

    addGuardianKey(rId, gEntry)
    if (rAuthId) addGuardianKey(rAuthId, gEntry)
    if (rEmail) addGuardianKey(rEmail, gEntry)
  }

  // Também mapear auth_users que têm user_metadata.responsavel_id ou aluno_id
  for (const au of authUsers || []) {
    const auId = String(au.id || '').trim()
    const metaRespId = String(au.user_metadata?.responsavel_id || au.user_metadata?.responsavelId || '').trim()
    if (metaRespId && guardianMap.has(metaRespId) && !guardianMap.has(auId)) {
      addGuardianKey(auId, guardianMap.get(metaRespId))
    }
  }

  const nowSec = Math.floor(Date.now() / 1000)

  // 7. Processar cada Player do OneSignal
  const enrichedDevices: Array<OneSignalFleetDevice & { _lastActiveSort: number; _isPhantom: boolean }> = rawPlayers.map((p: any) => {
    const subId = String(p.id || '').trim()
    const extId = p.external_user_id ? String(p.external_user_id).trim() : null
    const tags: Record<string, string> = p.tags && typeof p.tags === 'object' ? p.tags : {}

    const isPhantomRecord = !p.sdk && !p.device_model && !p.identifier
    const platform = detectPlatform(p.device_type, p.device_model || '')
    const model = isPhantomRecord
      ? 'Registro Fantasma API (Sem Aparelho)'
      : formatDeviceModelFriendly(p.device_model || '', platform)
    const os = p.device_os
      ? platform === 'iOS'
        ? `iOS ${p.device_os}`
        : platform === 'Android'
        ? `Android ${p.device_os}`
        : String(p.device_os)
      : platform

    const notifTypes = typeof p.notification_types === 'number' ? p.notification_types : null
    const invalidIdentifier = Boolean(p.invalid_identifier)
    const hasToken = Boolean(p.identifier && String(p.identifier).trim().length > 0 && !invalidIdentifier)
    const isSubscribed = Boolean(hasToken && (notifTypes === null || notifTypes > 0) && p.enabled !== false)

    let statusLabel = 'Push Ativo'
    let statusTone: 'success' | 'warning' | 'danger' = 'success'
    if (!isSubscribed) {
      statusTone = 'danger'
      if (isPhantomRecord) {
        statusLabel = 'Registro Fantasma API (Sem Hardware)'
      } else if (notifTypes === -99) {
        statusLabel = 'Web Desconectado'
        statusTone = 'warning'
      } else if (notifTypes === -2) {
        statusLabel = 'Desativado no App (Opt-out)'
      } else if (notifTypes === -10 || invalidIdentifier) {
        statusLabel = 'Token Substituído / App Desinstalado'
      } else if (!p.identifier) {
        statusLabel = 'Sem Token Push Gerado'
      } else {
        statusLabel = 'Bloqueado nos Ajustes do Aparelho'
      }
    }

    const createdTs = typeof p.created_at === 'number' && p.created_at > 0 ? p.created_at : null
    const lastActiveTs =
      typeof p.last_active === 'number' && p.last_active > 0
        ? p.last_active
        : createdTs

    const createdAt = createdTs ? new Date(createdTs * 1000).toISOString() : null
    const lastActiveAt = lastActiveTs ? new Date(lastActiveTs * 1000).toISOString() : null
    const daysInactive = lastActiveTs ? Math.max(0, Math.floor((nowSec - lastActiveTs) / 86400)) : 999

    // Extrair candidatos de vínculo
    const tagRespId = String(tags.responsavel_id || '').trim()
    const tagAlunoId = String(tags.aluno_id || tags.aluno_db_id || '').trim()
    const tagColabId = String(tags.colaborador_id || tags.system_user_id || '').trim()
    const tagEmail = String(tags.email || '').trim().toLowerCase()
    const dynamicAlunoIds = Object.keys(tags)
      .filter(k => k.startsWith('aluno_') && k !== 'aluno_id' && k !== 'aluno_db_id' && String(tags[k]) === 'true')
      .map(k => k.replace(/^aluno_/, '').trim())
      .filter(Boolean)

    // Resolver staff
    const matchedStaff =
      (tagColabId && (staffMap.get(tagColabId) || staffMap.get(tagColabId.toLowerCase()))) ||
      (extId && (staffMap.get(extId) || staffMap.get(extId.toLowerCase()))) ||
      (tagEmail && staffMap.get(tagEmail)) ||
      null

    // Resolver responsável
    let matchedGuardian =
      (tagRespId && (guardianMap.get(tagRespId) || guardianMap.get(tagRespId.toLowerCase()))) ||
      (extId && (guardianMap.get(extId) || guardianMap.get(extId.toLowerCase()))) ||
      (tagEmail && guardianMap.get(tagEmail)) ||
      null

    // Coletar alunos vinculados
    const candidateStudentIds = new Set<string>()
    if (tagAlunoId) candidateStudentIds.add(tagAlunoId)
    dynamicAlunoIds.forEach(id => candidateStudentIds.add(id))

    if (matchedGuardian) {
      const gLinks =
        studentIdsByResp.get(matchedGuardian.id) ||
        studentIdsByResp.get(matchedGuardian.id.replace(/^0+/, ''))
      if (gLinks) {
        gLinks.forEach(aid => candidateStudentIds.add(aid))
      }
    }

    // Se ainda não achou responsável mas temos aluno vinculado, tentar achar o responsável principal do aluno
    if (!matchedGuardian && !matchedStaff && candidateStudentIds.size > 0) {
      for (const aid of Array.from(candidateStudentIds)) {
        const rSet = respIdsByStudent.get(aid) || respIdsByStudent.get(aid.replace(/^0+/, ''))
        if (rSet && rSet.size > 0) {
          const firstRespId = Array.from(rSet)[0]
          const g = guardianMap.get(firstRespId)
          if (g) {
            matchedGuardian = g
            const gLinks = studentIdsByResp.get(g.id) || studentIdsByResp.get(g.id.replace(/^0+/, ''))
            if (gLinks) gLinks.forEach(x => candidateStudentIds.add(x))
            break
          }
        }
      }
    }

    // Verificar se o próprio extId é um aluno direto
    const directStudent =
      (extId && (studentMap.get(extId) || studentMap.get(extId.toLowerCase()))) ||
      (tagEmail && studentMap.get(tagEmail)) ||
      null
    if (directStudent) {
      candidateStudentIds.add(directStudent.id)
    }

    // Montar lista deduplicada de alunos vinculados
    const linkedStudentsMap = new Map<string, LinkedStudentSummary>()
    for (const rawAid of Array.from(candidateStudentIds)) {
      const st = studentMap.get(rawAid) || studentMap.get(rawAid.replace(/^0+/, ''))
      if (st && !linkedStudentsMap.has(st.id)) {
        linkedStudentsMap.set(st.id, {
          id: st.id,
          nome: st.nome,
          friendlyName: st.friendlyName,
          matricula: st.matricula,
          turma: st.turma,
          status: st.status,
          isInactive: st.isInactive,
        })
      }
    }
    const linkedStudents = Array.from(linkedStudentsMap.values())
    const activeStudentsCount = linkedStudents.filter(s => !s.isInactive).length
    const inactiveStudentsCount = linkedStudents.filter(s => s.isInactive).length

    // Determinar proprietário canônico
    let ownerType: 'responsavel' | 'colaborador' | 'aluno' | 'orfao' = 'orfao'
    let ownerId: string | null = null
    let ownerAuthId: string | null = null
    let ownerName = 'Aparelho Sem Vínculo (Anônimo)'
    let ownerEmail: string | null = tagEmail || null
    let ownerPhone: string | null = null
    let ownerRole = 'Sem Login'
    let ownerFoto: string | null = null
    let ownerStatus: 'ativo' | 'inativo' | 'orfao' = 'orfao'
    let isStaffMember = false

    if (matchedStaff) {
      ownerType = 'colaborador'
      ownerId = matchedStaff.id
      ownerAuthId = matchedStaff.authId || extId
      ownerName = matchedStaff.nome
      ownerEmail = matchedStaff.email || ownerEmail
      ownerRole = matchedStaff.cargo || matchedStaff.perfil || 'Colaborador'
      ownerFoto = matchedStaff.foto
      ownerStatus = matchedStaff.isInactive ? 'inativo' : 'ativo'
      isStaffMember = !matchedStaff.isInactive
    } else if (matchedGuardian) {
      ownerType = 'responsavel'
      ownerId = matchedGuardian.id
      ownerAuthId = matchedGuardian.authId || extId
      ownerName = matchedGuardian.nome
      ownerEmail = matchedGuardian.email || ownerEmail
      ownerPhone = matchedGuardian.telefone
      ownerRole = 'Responsável'
      ownerFoto = matchedGuardian.foto
      ownerStatus = activeStudentsCount > 0 ? 'ativo' : 'inativo'
    } else if (directStudent || linkedStudents.length > 0) {
      const primarySt = directStudent || linkedStudents[0]
      const rawSt = (directStudent as any)?.raw || studentMap.get(primarySt.id)?.raw
      const fallbackGuardianName = rawSt?.responsavel || rawSt?.responsavel_financeiro || null
      if (fallbackGuardianName && !directStudent) {
        ownerType = 'responsavel'
        ownerId = `resp-${primarySt.id}`
        ownerAuthId = extId
        ownerName = String(fallbackGuardianName).trim()
        ownerRole = 'Responsável'
      } else {
        ownerType = 'aluno'
        ownerId = primarySt.id
        ownerAuthId = extId
        ownerName = primarySt.nome
        ownerRole = `Aluno (${primarySt.turma})`
        ownerFoto = rawSt?.foto || null
      }
      ownerStatus = activeStudentsCount > 0 ? 'ativo' : 'inativo'
    } else if (extId) {
      // Tentar localizar em authUsers ou sysUsers residual
      const residualSys = sysUserMap.get(extId) || sysUserMap.get(extId.toLowerCase())
      const residualAuth = authById.get(extId) || authById.get(extId.toLowerCase())
      if (residualSys || residualAuth) {
        const rName = residualSys?.nome || residualAuth?.user_metadata?.nome || residualAuth?.email || null
        ownerName = rName ? `${rName} (Sem aluno ativo)` : `Conta sem vínculo (${extId.slice(0, 8)}...)`
        ownerEmail = residualSys?.email || residualAuth?.email || ownerEmail
        ownerAuthId = residualAuth?.id || extId
        ownerRole = residualSys?.perfil || residualAuth?.user_metadata?.perfil || 'Sem Vínculo Ativo'
        ownerStatus = 'orfao'
      } else {
        ownerName = tags.nome ? `${tags.nome} (Órfão)` : `Registro Órfão (${extId.slice(0, 8)}...)`
        ownerRole = 'Conta Inexistente / Órfão'
        ownerStatus = 'orfao'
      }
    }

    const ownerKey =
      ownerType !== 'orfao' && ownerId
        ? `${ownerType}:${ownerId}`
        : extId
        ? `ext:${extId}`
        : `anon:${subId}`

    return {
      id: subId,
      externalUserId: extId,
      platform,
      platformRaw: String(p.device_type ?? ''),
      model,
      modelRaw: p.device_model || '',
      os,
      appVersion: String(p.game_version || p.app_version || ''),
      sessionCount: Number(p.session_count || 0),
      playtimeSeconds: Number(p.playtime || 0),
      createdAt,
      lastActiveAt,
      daysInactive,
      isSubscribed,
      notificationTypes: notifTypes,
      hasToken,
      tokenPreview: p.identifier
        ? `${String(p.identifier).slice(0, 8)}...${String(p.identifier).slice(-4)}`
        : null,
      statusLabel,
      statusTone,
      ownerKey,
      ownerType,
      ownerId,
      ownerAuthId,
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerRole,
      ownerFoto,
      ownerStatus,
      isStaffMember,
      linkedStudents,
      activeStudentsCount,
      inactiveStudentsCount,
      deviceRankInUser: 1,
      userTotalDevices: 1,
      isDuplicateStale: isPhantomRecord,
      isProtected: false,
      protectionReason: null,
      cleanupReasons: [],
      isRecommendedForCleanup: false,
      primaryCleanupBadge: null,
      _lastActiveSort: lastActiveTs || 0,
      _isPhantom: isPhantomRecord,
    }
  })

  // 8. Agrupar por usuário para detectar sessões duplicadas/antigas
  const devicesByOwner = new Map<string, typeof enrichedDevices>()
  for (const d of enrichedDevices) {
    if (d.ownerKey.startsWith('anon:')) continue
    if (!devicesByOwner.has(d.ownerKey)) devicesByOwner.set(d.ownerKey, [])
    devicesByOwner.get(d.ownerKey)!.push(d)
  }

  for (const group of Array.from(devicesByOwner.values())) {
    if (group.length <= 1) continue
    group.sort((a, b) => {
      if (a.isSubscribed !== b.isSubscribed) return a.isSubscribed ? -1 : 1
      if (a._isPhantom !== b._isPhantom) return a._isPhantom ? 1 : -1
      const aHasModel = Boolean(a.modelRaw && a.modelRaw.trim().length > 0)
      const bHasModel = Boolean(b.modelRaw && b.modelRaw.trim().length > 0)
      if (aHasModel !== bHasModel) return aHasModel ? -1 : 1
      if (b._lastActiveSort !== a._lastActiveSort) return b._lastActiveSort - a._lastActiveSort
      return b.sessionCount - a.sessionCount
    })

    const primaryDevice = group[0]
    const seenPlatformModels = new Set<string>([`${primaryDevice.platform}:${primaryDevice.model}`])

    group.forEach((dev, idx) => {
      dev.deviceRankInUser = idx + 1
      dev.userTotalDevices = group.length
      if (dev._isPhantom) {
        dev.isDuplicateStale = true
        return
      }
      if (idx === 0) return

      const platModelKey = `${dev.platform}:${dev.model}`
      const isSameModelDuplicate = seenPlatformModels.has(platModelKey)
      seenPlatformModels.add(platModelKey)

      // Só marca 2º aparelho como duplicado se for do mesmo modelo (reinstalação),
      // estiver com push desativado, ou estiver sem uso há +60 dias (preserva 2º celular ativo de pai/mãe/portaria de modelo diferente)
      if (
        isSameModelDuplicate ||
        !dev.isSubscribed ||
        (primaryDevice.isSubscribed && dev.daysInactive >= 60 && !dev.isStaffMember)
      ) {
        dev.isDuplicateStale = true
      }
    })
  }

  // 9. Classificar motivos de limpeza e travas de proteção em cada aparelho
  for (const dev of enrichedDevices) {
    const reasons: FleetDeviceCleanupReason[] = []

    if (!dev.isSubscribed && !dev._isPhantom && dev.deviceRankInUser === 1 && dev.daysInactive <= 14 && dev.statusLabel.includes('Token Substituído')) {
      dev.statusLabel = 'Bloqueado nos Ajustes do Celular'
    } else if (!dev.isSubscribed && !dev._isPhantom && dev.deviceRankInUser > 1 && dev.statusLabel.includes('Token Substituído')) {
      dev.statusLabel = 'Sessão Antiga (App Reinstalado/Atualizado)'
    }

    // Aparelho físico principal (1º) de responsável/colaborador ativo com uso recente que apenas está
    // com notificações desativadas nos ajustes do celular: não ocupa vaga ativa no OneSignal e, se for
    // deletado, será recriado automaticamente no dia seguinte ao abrir o app.
    const isActiveUserPrimaryBlockedDevice =
      !dev.isSubscribed &&
      !dev._isPhantom &&
      dev.platform !== 'Web' &&
      dev.deviceRankInUser === 1 &&
      dev.ownerStatus === 'ativo' &&
      dev.ownerType !== 'orfao' &&
      dev.daysInactive <= 14

    if (dev.isStaffMember) {
      dev.isProtected = true
      dev.protectionReason = 'Colaborador / Equipe Ativa'
    } else if (dev.ownerType === 'responsavel' && dev.activeStudentsCount > 0 && dev.inactiveStudentsCount > 0) {
      dev.isProtected = true
      const activeNames = dev.linkedStudents
        .filter(s => !s.isInactive)
        .map(s => s.friendlyName)
        .join(', ')
      dev.protectionReason = `Possui filho ativo (${activeNames})`
    }

    if (dev.ownerType === 'orfao' || dev.ownerStatus === 'orfao') {
      reasons.push('orfao')
    } else if (dev.ownerType === 'colaborador' && dev.ownerStatus === 'inativo') {
      reasons.push('colaborador_inativo')
    } else if (!dev.isStaffMember && dev.ownerStatus === 'inativo') {
      reasons.push('aluno_inativo')
    }

    if (!dev.isSubscribed) {
      reasons.push('desativado')
    }

    if (dev.isDuplicateStale) {
      reasons.push('duplicado')
    }

    if (dev.daysInactive >= 30) reasons.push('sem_uso_30d')
    if (dev.daysInactive >= 60) reasons.push('sem_uso_60d')
    if (dev.daysInactive >= 90) reasons.push('sem_uso_90d')
    if (dev.daysInactive >= 180) reasons.push('sem_uso_180d')

    dev.cleanupReasons = reasons

    // Elegível para limpeza recomendada automática
    dev.isRecommendedForCleanup =
      reasons.includes('aluno_inativo') ||
      reasons.includes('colaborador_inativo') ||
      reasons.includes('orfao') ||
      reasons.includes('duplicado') ||
      (reasons.includes('desativado') && !isActiveUserPrimaryBlockedDevice) ||
      (!dev.isStaffMember && reasons.includes('sem_uso_60d'))

    // Badge principal de diagnóstico
    if (reasons.includes('aluno_inativo')) {
      dev.primaryCleanupBadge = {
        code: 'aluno_inativo',
        label: 'Aluno Inativo',
        tone: 'danger',
      }
    } else if (reasons.includes('colaborador_inativo')) {
      dev.primaryCleanupBadge = {
        code: 'colaborador_inativo',
        label: 'Ex-Colaborador Inativo',
        tone: 'danger',
      }
    } else if (reasons.includes('orfao')) {
      dev.primaryCleanupBadge = {
        code: 'orfao',
        label: dev.externalUserId ? 'Conta Órfã / Sem Vínculo' : 'Aparelho Anônimo (Órfão)',
        tone: 'warning',
      }
    } else if (dev._isPhantom) {
      dev.primaryCleanupBadge = {
        code: 'duplicado',
        label: 'Registro Fantasma API',
        tone: 'danger',
      }
    } else if (reasons.includes('duplicado')) {
      dev.primaryCleanupBadge = {
        code: 'duplicado',
        label: `Sessão Duplicada (${dev.deviceRankInUser}º de ${dev.userTotalDevices})`,
        tone: 'info',
      }
    } else if (!dev.isSubscribed) {
      dev.primaryCleanupBadge = {
        code: 'desativado',
        label: isActiveUserPrimaryBlockedDevice ? 'Push Bloqueado no Aparelho' : 'Push Desativado / Sem Token',
        tone: isActiveUserPrimaryBlockedDevice ? 'warning' : 'danger',
      }
    } else if (reasons.includes('sem_uso_60d')) {
      dev.primaryCleanupBadge = {
        code: 'sem_uso',
        label: `Sem uso há ${dev.daysInactive} dias`,
        tone: 'warning',
      }
    } else if (reasons.includes('sem_uso_30d')) {
      dev.primaryCleanupBadge = {
        code: 'sem_uso_30d',
        label: `Sem uso há ${dev.daysInactive} dias`,
        tone: 'neutral',
      }
    }

    delete (dev as any)._lastActiveSort
    delete (dev as any)._isPhantom
  }

  // 10. Calcular KPIs consolidados
  const activeUsersSet = new Set<string>()
  const allUsersSet = new Set<string>()
  const summary: OneSignalFleetSummary = {
    ...emptySummary,
    totalDevices: enrichedDevices.length,
  }

  for (const d of enrichedDevices) {
    if (!d.ownerKey.startsWith('anon:')) {
      allUsersSet.add(d.ownerKey)
      if (d.isSubscribed) activeUsersSet.add(d.ownerKey)
    }

    if (d.isSubscribed) summary.activeDevices++
    else summary.disabledDevices++

    const platKey = d.platform === 'iOS' ? 'ios' : d.platform === 'Android' ? 'android' : 'web'
    summary.byPlatform[platKey].total++
    if (d.isSubscribed) summary.byPlatform[platKey].active++

    if (d.isStaffMember) {
      summary.byCategory.activeStaff++
    } else if (d.ownerStatus === 'ativo' && (d.ownerType === 'responsavel' || d.ownerType === 'aluno')) {
      summary.byCategory.activeFamily++
    }

    if (d.cleanupReasons.includes('aluno_inativo') || d.cleanupReasons.includes('colaborador_inativo')) {
      summary.byCategory.inactiveStudents++
      if (d.isSubscribed) summary.byCategory.inactiveStudentsActivePush++
    }

    if (d.cleanupReasons.includes('orfao')) {
      summary.byCategory.orphans++
      if (d.isSubscribed) summary.byCategory.orphansActivePush++
    }

    if (d.cleanupReasons.includes('desativado')) {
      summary.byCategory.disabledPush++
    }

    if (d.cleanupReasons.includes('duplicado')) {
      summary.byCategory.duplicatesStale++
      if (d.isSubscribed) summary.byCategory.duplicatesStaleActivePush++
    }

    if (d.cleanupReasons.includes('sem_uso_30d')) {
      summary.byCategory.unused30d++
      if (!d.isStaffMember) summary.byCategory.unused30dNonStaff++
    }
    if (d.cleanupReasons.includes('sem_uso_60d')) {
      summary.byCategory.unused60d++
      if (!d.isStaffMember) summary.byCategory.unused60dNonStaff++
    }
    if (d.cleanupReasons.includes('sem_uso_90d')) {
      summary.byCategory.unused90d++
      if (!d.isStaffMember) summary.byCategory.unused90dNonStaff++
    }
    if (d.cleanupReasons.includes('sem_uso_180d')) {
      summary.byCategory.unused180d++
    }

    if (d.isRecommendedForCleanup) {
      summary.byCategory.recommendedCleanupTotal++
      if (d.isSubscribed) summary.byCategory.recommendedActiveSlotsFreed++
    }
  }

  summary.uniqueUsersTotal = allUsersSet.size
  summary.uniqueUsersWithActivePush = activeUsersSet.size

  // Ordenar: primeiro os recomendados para limpeza (alunos inativos -> órfãos -> duplicados -> sem uso), depois ativos mais recentes
  enrichedDevices.sort((a, b) => {
    const score = (x: OneSignalFleetDevice) => {
      if (x.cleanupReasons.includes('aluno_inativo') || x.cleanupReasons.includes('colaborador_inativo')) return 100
      if (x.cleanupReasons.includes('orfao')) return 90
      if (x.cleanupReasons.includes('duplicado')) return 80
      if (!x.isSubscribed) return 70
      if (x.daysInactive >= 60 && !x.isStaffMember) return 60
      return 10
    }
    const sA = score(a)
    const sB = score(b)
    if (sA !== sB) return sB - sA
    return b.daysInactive - a.daysInactive
  })

  return {
    success: true,
    fetchedAt: new Date().toISOString(),
    summary,
    devices: enrichedDevices,
  }
}

export type SmartCleanupMode =
  | 'inactive_students'
  | 'orphans'
  | 'disabled'
  | 'duplicates'
  | 'unused'
  | 'smart_all'
  | 'selected_ids'

export interface ExecuteSmartCleanupOptions {
  mode: SmartCleanupMode
  subscriptionIds?: string[]
  minInactiveDays?: number
  protectStaff?: boolean
}

export interface ExecuteSmartCleanupResult {
  success: boolean
  mode: SmartCleanupMode
  deletedCount: number
  freedActiveSlots: number
  deletedUsersCount: number
  deletedSubscriptionIds: string[]
  message: string
}

/**
 * Executa a exclusão em lote inteligente ou por seleção manual no OneSignal,
 * liberando acessos imediatamente e respeitando todas as travas de proteção.
 */
export async function executeOneSignalSmartCleanup(
  options: ExecuteSmartCleanupOptions
): Promise<ExecuteSmartCleanupResult> {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''

  if (!appId || !apiKey) {
    return {
      success: false,
      mode: options.mode,
      deletedCount: 0,
      freedActiveSlots: 0,
      deletedUsersCount: 0,
      deletedSubscriptionIds: [],
      message: 'Credenciais do OneSignal não configuradas neste ambiente.',
    }
  }

  const overview = await getOneSignalFleetOverview()
  const allDevices = overview.devices
  const deviceById = new Map<string, OneSignalFleetDevice>(allDevices.map(d => [d.id, d]))

  const protectStaff = options.protectStaff !== false
  const minDays = Math.max(7, Number(options.minInactiveDays || 60))

  let targets: OneSignalFleetDevice[] = []

  if (options.mode === 'selected_ids') {
    const requestedIds = Array.from(new Set((options.subscriptionIds || []).map(s => String(s || '').trim()).filter(Boolean)))
    targets = requestedIds.map(id => {
      const found = deviceById.get(id)
      if (found) return found
      return {
        id,
        isSubscribed: true,
        externalUserId: null,
        ownerType: 'orfao',
        ownerStatus: 'orfao',
        cleanupReasons: [],
      } as any
    })
  } else if (options.mode === 'inactive_students') {
    targets = allDevices.filter(
      d =>
        d.cleanupReasons.includes('aluno_inativo') ||
        d.cleanupReasons.includes('colaborador_inativo')
    )
  } else if (options.mode === 'orphans') {
    targets = allDevices.filter(d => d.cleanupReasons.includes('orfao'))
  } else if (options.mode === 'disabled') {
    targets = allDevices.filter(d => !d.isSubscribed && d.isRecommendedForCleanup)
  } else if (options.mode === 'duplicates') {
    targets = allDevices.filter(d => d.isDuplicateStale)
  } else if (options.mode === 'unused') {
    targets = allDevices.filter(d => {
      if (protectStaff && d.isStaffMember) return false
      return d.daysInactive >= minDays
    })
  } else if (options.mode === 'smart_all') {
    targets = allDevices.filter(d => {
      if (d.cleanupReasons.includes('aluno_inativo') || d.cleanupReasons.includes('colaborador_inativo')) return true
      if (d.cleanupReasons.includes('orfao')) return true
      if (d.isDuplicateStale) return true
      if (!d.isSubscribed && d.isRecommendedForCleanup) return true
      if (!d.isStaffMember && d.daysInactive >= minDays) return true
      return false
    })
  }

  if (targets.length === 0) {
    return {
      success: true,
      mode: options.mode,
      deletedCount: 0,
      freedActiveSlots: 0,
      deletedUsersCount: 0,
      deletedSubscriptionIds: [],
      message: 'Nenhum aparelho pendente encontrado para este critério. O OneSignal já está limpo e otimizado!',
    }
  }

  // Executar exclusão de subscrições em lotes paralelos de 15
  const CHUNK_SIZE = 15
  let deletedCount = 0
  let freedActiveSlots = 0
  const deletedIds: string[] = []

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE)
    const results = await Promise.all(
      chunk.map(async dev => {
        const ok = await deleteOneSignalSubscriptionOnly(dev.id, appId, apiKey)
        return { dev, ok }
      })
    )
    for (const { dev, ok } of results) {
      if (ok) {
        deletedCount++
        deletedIds.push(dev.id)
        if (dev.isSubscribed) freedActiveSlots++
      }
    }
  }

  // Para usuários completamente inativos/órfãos que tiveram TODOS os seus aparelhos removidos,
  // limpar também o registro de identidade (User Model v5) no OneSignal
  const deletedIdSet = new Set(deletedIds)
  const usersToWipe = new Map<string, { label: string; id: string }>()

  for (const dev of targets) {
    if (!deletedIdSet.has(dev.id)) continue
    const isFullInactiveOwner =
      dev.cleanupReasons.includes('aluno_inativo') ||
      dev.cleanupReasons.includes('colaborador_inativo') ||
      dev.cleanupReasons.includes('orfao')

    if (!isFullInactiveOwner || dev.isProtected) continue

    // Verificar se restou algum aparelho não excluído para este ownerKey
    const remainingForOwner = allDevices.some(
      other => other.ownerKey === dev.ownerKey && !deletedIdSet.has(other.id)
    )
    if (remainingForOwner) continue

    if (dev.externalUserId) {
      usersToWipe.set(`external_id:${dev.externalUserId}`, {
        label: 'external_id',
        id: dev.externalUserId,
      })
    }
    if (dev.ownerType === 'responsavel' && dev.ownerId && !dev.ownerId.startsWith('resp-')) {
      usersToWipe.set(`responsavel_id:${dev.ownerId}`, {
        label: 'responsavel_id',
        id: dev.ownerId,
      })
    }
    if (dev.ownerType === 'aluno' && dev.ownerId) {
      usersToWipe.set(`aluno_id:${dev.ownerId}`, {
        label: 'aluno_id',
        id: dev.ownerId,
      })
    }
  }

  let deletedUsersCount = 0
  const userWipeList = Array.from(usersToWipe.values())
  for (let i = 0; i < userWipeList.length; i += CHUNK_SIZE) {
    const chunk = userWipeList.slice(i, i + CHUNK_SIZE)
    const r = await Promise.all(
      chunk.map(u => deleteOneSignalUserByAlias(u.label, u.id, appId, apiKey))
    )
    deletedUsersCount += r.filter(Boolean).length
  }

  const message =
    freedActiveSlots > 0
      ? `${deletedCount} aparelho(s) excluído(s) com sucesso (${freedActiveSlots} acesso(s) ativo(s) liberado(s) no OneSignal)!`
      : `${deletedCount} registro(s) de aparelho(s) limpo(s) com sucesso no OneSignal!`

  return {
    success: true,
    mode: options.mode,
    deletedCount,
    freedActiveSlots,
    deletedUsersCount,
    deletedSubscriptionIds: deletedIds,
    message,
  }
}
