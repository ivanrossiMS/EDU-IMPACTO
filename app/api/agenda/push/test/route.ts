import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import { getAdminClient, getAllAuthUsersCached } from '@/lib/server/supabaseAdminSingleton'
import {
  sendPushNotification,
  getNotificationStats,
  cleanupOneSignalForInactiveStudent,
  cleanupAllInactiveStudentsOneSignal,
} from '@/lib/server/pushService'
import { AgendaPushType } from '@/lib/server/agendaNotifications'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'

export const dynamic = 'force-dynamic'

const ALLOWED_PROFILES = ['Direção', 'Administrador', 'Diretor Geral', 'Administrador Master']

async function verifyAdminAuth(): Promise<
  | { authorized: true; user: any; errorResponse?: never }
  | { authorized: false; errorResponse: NextResponse; user?: never }
> {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse || !user) {
    return {
      authorized: false,
      errorResponse: errorResponse || NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }),
    }
  }

  const supabase = supabaseServer
  const { data: dbUser } = await supabase
    .from('system_users')
    .select('id, perfil, cargo, nome, email')
    .eq('id', user.id)
    .maybeSingle()

  const perfil = dbUser?.perfil || (user.user_metadata?.perfil as string) || ''
  const cargo = dbUser?.cargo || (user.user_metadata?.cargo as string) || ''

  const isAllowed = ALLOWED_PROFILES.includes(perfil) || ALLOWED_PROFILES.includes(cargo)

  if (!isAllowed) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: 'Acesso negado. Apenas administradores e direção podem testar notificações.' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true, user: dbUser || user }
}

function formatDeviceModel(model: string, type: string): string {
  if (!model) return type?.toLowerCase().includes('ios') ? 'Apple iPhone / iPad' : type?.toLowerCase().includes('android') ? 'Dispositivo Android' : 'Navegador Web'
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
    'MacIntel': 'Apple Mac (Navegador)',
    'Win32': 'PC Windows (Navegador)',
    'Linux x86_64': 'Linux (Navegador)'
  }

  if (appleModels[m]) return appleModels[m]
  if (m.startsWith('iPhone')) return `Apple ${m}`
  if (m.startsWith('iPad')) return `Apple ${m}`
  if (m.startsWith('SM-')) return `Samsung Galaxy (${m})`
  return m
}

async function fetchOneSignalUserDevices(
  identifier: string,
  aliasLabel: 'external_id' | 'responsavel_id' | 'aluno_id' | 'email' | 'system_user_id' | 'colaborador_id' = 'external_id'
) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey || !identifier) return []

  try {
    const cleanId = identifier.trim()
    const isEmail = aliasLabel === 'email' || cleanId.includes('@')
    const label = isEmail ? 'email' : aliasLabel
    const val = isEmail ? cleanId.toLowerCase() : cleanId
    const url = `https://onesignal.com/api/v1/apps/${appId}/users/by/${label}/${encodeURIComponent(val)}`

    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      if (label !== 'email' && cleanId.includes('@')) {
        return fetchOneSignalUserDevices(cleanId, 'email')
      }
      return []
    }

    const data = await res.json()
    const subscriptions = data.subscriptions || []

    return subscriptions.map((sub: any) => {
      const typeStr = sub.type || ''
      const isIos = typeStr.toLowerCase().includes('ios')
      const isAndroid = typeStr.toLowerCase().includes('android')
      const isWeb = !isIos && !isAndroid

      const notifType = sub.notification_types
      const isSubscribed = Boolean(sub.enabled && notifType > 0 && sub.token)

      let statusDescription = '🟢 Push Ativo e Conectado'
      let statusTone: 'success' | 'warning' | 'danger' = 'success'

      if (!sub.enabled || notifType <= 0 || !sub.token) {
        statusTone = 'danger'
        if (notifType === -10) {
          statusDescription = '🔴 Desativado / Token Substituído por outro aparelho'
        } else if (notifType === -99) {
          statusDescription = '⚪ Navegador Web Desconectado'
          statusTone = 'warning'
        } else if (!sub.token) {
          statusDescription = '🔴 Sem Token Push no aparelho'
        } else {
          statusDescription = '🔴 Notificações Bloqueadas nos Ajustes'
        }
      }

      return {
        id: sub.id,
        tipo: isIos ? 'iOS' : isAndroid ? 'Android' : 'Web',
        tipoRaw: typeStr,
        modelo: formatDeviceModel(sub.device_model, typeStr),
        modeloRaw: sub.device_model || '',
        sistema: sub.device_os ? (isIos ? `iOS ${sub.device_os}` : isAndroid ? `Android ${sub.device_os}` : sub.device_os) : '',
        appVersion: sub.app_version || '',
        sessoes: sub.session_count || 0,
        tempoSessaoSegundos: sub.session_time || 0,
        isSubscribed,
        statusDescription,
        statusTone,
        notificationCode: notifType,
        hasToken: Boolean(sub.token),
        tokenPreview: sub.token ? `${sub.token.slice(0, 8)}...${sub.token.slice(-4)}` : null,
        lastActive: data.properties?.last_active ? new Date(data.properties.last_active * 1000).toISOString() : null,
      }
    })
  } catch (err: any) {
    console.warn('[OneSignal Device Fetch] Erro ao buscar dispositivos:', err?.message)
    return []
  }
}

const isUUID = (str: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim())

async function fetchDevicesForGuardian(r: {
  authId?: string | null
  responsavel_id?: string | null
  email?: string | null
  colaborador_id?: string | null
  system_user_id?: string | null
}): Promise<any[]> {
  const deviceMap = new Map<string, any>()

  // 1. Tenta por authId (external_id canônico do Supabase Auth)
  if (r.authId) {
    const devs = await fetchOneSignalUserDevices(r.authId, 'external_id')
    devs.forEach((d: any) => deviceMap.set(d.id, d))
  }

  // 2. Tenta por responsavel_id (alias customizado e como external_id)
  if (r.responsavel_id) {
    const devs = await fetchOneSignalUserDevices(r.responsavel_id, 'responsavel_id')
    devs.forEach((d: any) => deviceMap.set(d.id, d))
    const devsExt = await fetchOneSignalUserDevices(r.responsavel_id, 'external_id')
    devsExt.forEach((d: any) => deviceMap.set(d.id, d))
  }

  // 3. Tenta por colaborador_id (tanto como alias quanto como external_id)
  if (r.colaborador_id) {
    const devs = await fetchOneSignalUserDevices(r.colaborador_id, 'colaborador_id')
    devs.forEach((d: any) => deviceMap.set(d.id, d))
    const devsExt = await fetchOneSignalUserDevices(r.colaborador_id, 'external_id')
    devsExt.forEach((d: any) => deviceMap.set(d.id, d))
  }

  // 4. Tenta por system_user_id
  if (r.system_user_id && r.system_user_id !== r.colaborador_id) {
    const devs = await fetchOneSignalUserDevices(r.system_user_id, 'system_user_id')
    devs.forEach((d: any) => deviceMap.set(d.id, d))
  }

  // 5. Tenta por email se ainda não localizou ou para cobrir navegadores web adicionais
  if (r.email) {
    const devs = await fetchOneSignalUserDevices(r.email, 'email')
    devs.forEach((d: any) => deviceMap.set(d.id, d))
  }

  return Array.from(deviceMap.values())
}

function formatPhoneDisplay(p?: string | null): string | null {
  if (!p) return null
  const digits = String(p).replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return p
}

function extractLogCandidateReadIds(log: any): string[] {
  const ids = new Set<string>()
  if (log.item_id) {
    ids.add(log.item_id)
    const base = log.item_id.replace(/(_aluno_\d+|_perfil_\w+|-\w+_\d+|_familia|_colaborador)$/, '')
    if (base && base !== log.item_id) ids.add(base)
  }
  if (log.type === 'chat') {
    try {
      if (log.onesignal_response) {
        const p = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
        if (p?._metadata?.message_id) ids.add(String(p._metadata.message_id))
      }
    } catch {}
  }
  if (log.target_url) {
    const m = log.target_url.match(/[?&]id=([^&#]+)/)
    if (m && m[1]) ids.add(decodeURIComponent(m[1]))
  }
  const aId = extractLogStudentId(log)
  if (aId && (log.type === 'saida' || log.type === 'frequencia') && log.created_at) {
    const dtUtc = log.created_at.slice(0, 10)
    ids.add(`FREQ-${aId}-${dtUtc}`)
    try {
      const dtLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(log.created_at))
      ids.add(`FREQ-${aId}-${dtLocal}`)
    } catch {}
  }
  return Array.from(ids).filter(Boolean)
}

function extractLogStudentId(log: any): string | null {
  if (log?.type === 'chat') return null
  const m1 = log.item_id?.match(/aluno_(\d+)/i)
  if (m1) return m1[1]
  const m2 = log.target_url?.match(/\/agenda-digital\/(\d+)/i) || log.target_url?.match(/aluno_id=(\d+)/i)
  if (m2) return m2[1]
  const m3 = log.item_id?.match(/_(\d{4,5})$/i) || log.item_id?.match(/-(\d{4,5})$/i)
  if (m3) return m3[1]
  try {
    if (log.onesignal_response) {
      const p = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
      if (p?._metadata?.aluno_id) return String(p._metadata.aluno_id)
    }
  } catch {}
  return null
}

export interface PushSenderInfo {
  id?: string | null
  nome: string
  friendlyName?: string
  subtitulo?: string | null
  tipo: 'colaborador' | 'responsavel' | 'aluno' | 'sistema' | 'portaria' | 'outro'
  foto?: string | null
  email?: string | null
  initials?: string
}

function getSenderInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getFriendlySenderName(fullName: string): string {
  if (!fullName) return 'Sistema'
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return fullName
  return `${parts[0]} ${parts[1]}`
}

async function batchResolveSenders(logs: any[], supabase: any): Promise<Map<string, PushSenderInfo>> {
  const result = new Map<string, PushSenderInfo>()
  if (!logs || logs.length === 0) return result

  const momentoIds = new Set<string>()
  const comunicadoIds = new Set<string>()
  const callIds = new Set<string>()
  const eventoIds = new Set<string>()
  const freqIds = new Set<string>()
  const ocorrenciaIds = new Set<string>()
  const directUserIds = new Set<string>()

  for (const l of logs) {
    if (l.user_id) directUserIds.add(String(l.user_id))

    let meta: any = null
    try {
      meta = typeof l.onesignal_response === 'string'
        ? JSON.parse(l.onesignal_response)?._metadata
        : l.onesignal_response?._metadata
    } catch {}

    if (meta?.sender_id) directUserIds.add(String(meta.sender_id))
    if (meta?.sender_auth_id) directUserIds.add(String(meta.sender_auth_id))
    if (meta?.author_id) directUserIds.add(String(meta.author_id))
    if (meta?.authorId) directUserIds.add(String(meta.authorId))

    const itemIdStr = l.item_id ? String(l.item_id).trim() : ''

    if (l.type === 'momentos') {
      if (meta?.item_id) momentoIds.add(String(meta.item_id))
      if (itemIdStr && !itemIdStr.startsWith('momento_like_') && !itemIdStr.startsWith('momento_comment_')) {
        const baseId = itemIdStr.split('_aluno_')[0].split('_perfil_')[0]
        if (baseId) momentoIds.add(baseId)
      }
    } else if (l.type === 'comunicados') {
      if (meta?.item_id) comunicadoIds.add(String(meta.item_id))
      if (itemIdStr && !itemIdStr.startsWith('resp_')) {
        const baseId = itemIdStr.split('_aluno_')[0].split('_perfil_')[0]
        if (baseId) comunicadoIds.add(baseId)
      }
    } else if (l.type === 'saida') {
      const m = itemIdStr.match(/^(?:chamada|saida|special_auth)_([0-9a-f-]{36})/i)
      if (m) callIds.add(m[1])
      if (meta?.saida_id) callIds.add(String(meta.saida_id))
      if (meta?.call_id) callIds.add(String(meta.call_id))
    } else if (l.type === 'calendario') {
      if (meta?.item_id) eventoIds.add(String(meta.item_id))
      if (Array.isArray(meta?.evento_ids)) {
        for (const eid of meta.evento_ids) {
          if (eid) eventoIds.add(String(eid))
        }
      }
      const baseId = itemIdStr ? itemIdStr.replace(/-reminder.*$/, '').split('_aluno_')[0].split('_perfil_')[0].replace(/-\d+$/, '') : null
      if (baseId && !baseId.startsWith('cal_dia_') && !baseId.startsWith('cal_lembrete_')) eventoIds.add(baseId)
    } else if (l.type === 'frequencia') {
      const baseFreqId = itemIdStr.replace(/_(presente|falta|justificada|atraso|saida)$/i, '').trim()
      if (baseFreqId.startsWith('FREQ-')) freqIds.add(baseFreqId)
      if (meta?.aluno_id && meta?.data) {
        freqIds.add(`FREQ-${meta.aluno_id}-${meta.data}`)
      }
    } else if (l.type === 'ocorrencias') {
      if (meta?.item_id) ocorrenciaIds.add(String(meta.item_id))
      const baseOcId = itemIdStr.replace(/^ciencia_/, '').split('_aluno_')[0].trim()
      if (baseOcId) ocorrenciaIds.add(baseOcId)
    }
  }

  // Buscar dados em lote de forma paralela (incluindo frequencias, ocorrencias e auth.users em cache)
  const [momsRes, comsRes, callsRes, evsRes, freqsRes, ocsRes, sysUsersRes, authUsersList] = await Promise.all([
    momentoIds.size > 0
      ? supabase.from('momentos').select('id, dados').in('id', Array.from(momentoIds))
      : Promise.resolve({ data: [] }),
    comunicadoIds.size > 0
      ? supabase.from('comunicados').select('id, autor, dados, titulo').in('id', Array.from(comunicadoIds))
      : Promise.resolve({ data: [] }),
    callIds.size > 0
      ? supabase.from('saida_calls').select('id, dados').in('id', Array.from(callIds))
      : Promise.resolve({ data: [] }),
    eventoIds.size > 0
      ? supabase.from('eventos_agenda').select('id, titulo, criado_por, turmas, dados').in('id', Array.from(eventoIds))
      : Promise.resolve({ data: [] }),
    freqIds.size > 0
      ? supabase.from('frequencias').select('id, aluno_id, data, presente, dados').in('id', Array.from(freqIds))
      : Promise.resolve({ data: [] }),
    ocorrenciaIds.size > 0
      ? supabase.from('ocorrencias').select('id, descricao, dados, created_at').in('id', Array.from(ocorrenciaIds))
      : Promise.resolve({ data: [] }),
    supabase.from('system_users').select('id, auth_id, nome, email, perfil, cargo, dados'),
    getAllAuthUsersCached().catch(() => [] as any[]),
  ])

  const momMap = new Map<string, any>((momsRes.data || []).map((m: any) => [String(m.id), m]))
  const comMap = new Map<string, any>((comsRes.data || []).map((c: any) => [String(c.id), c]))
  const callMap = new Map<string, any>((callsRes.data || []).map((c: any) => [String(c.id), c]))
  const evMap = new Map<string, any>((evsRes.data || []).map((e: any) => [String(e.id), e]))
  const freqMap = new Map<string, any>((freqsRes.data || []).map((f: any) => [String(f.id), f]))
  const ocMap = new Map<string, any>((ocsRes.data || []).map((o: any) => [String(o.id), o]))

  // Se houver ocorrências vinculadas a relatórios de colaboradores (comunicadoColabId) ainda não carregados em comMap, buscá-los
  const extraColabComIds = new Set<string>()
  for (const oc of ocsRes.data || []) {
    const colabComId = oc?.dados?.comunicadoColabId
    if (colabComId && !comMap.has(String(colabComId))) {
      extraColabComIds.add(String(colabComId))
    }
  }
  if (extraColabComIds.size > 0) {
    const { data: extraComs } = await supabase
      .from('comunicados')
      .select('id, autor, dados, titulo')
      .in('id', Array.from(extraColabComIds))
    for (const ec of extraComs || []) {
      comMap.set(String(ec.id), ec)
    }
  }
  const sysUserList: any[] = sysUsersRes.data || []
  const authUsersById = new Map<string, any>((authUsersList || []).map((au: any) => [String(au.id), au]))

  const normText = (s?: string | null) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

  const GENERIC_SENDER_NAMES = new Set([
    'sistema', 'automatico', 'automático', 'portaria', 'portaria escolar', 'portaria & saida',
    'secretaria', 'secretaria academica', 'catraca', 'catraca idface', 'catraca digital idface',
    'totem', 'admin', 'admin logado', 'colaborador', 'colaboradora', 'colaborador(a)',
    'usuario', 'usuário', 'usuario(a)', 'usuário(a)', 'user',
    'professor', 'professora', 'coordenacao', 'coordenação', 'coordenacao escolar',
    'coordenacao disciplinar', 'equipe pedagogica', 'equipe escolar', 'colegio impacto',
    'departamento financeiro', 'financeiro', 'manual', 'manual (auto)'
  ])

  const isGenericSenderName = (name?: string | null): boolean => {
    if (!name) return true
    const n = normText(name)
    if (!n || n.length < 2) return true
    return GENERIC_SENDER_NAMES.has(n)
  }

  function findUser(idOrAuthId?: string | null, name?: string | null, email?: string | null) {
    if (idOrAuthId) {
      const cleanId = String(idOrAuthId).trim()
      const strippedId = cleanId.replace(/^(f_|func_|colab_|prof_|usr_)/i, '')
      const u = sysUserList.find(x =>
        String(x.id) === cleanId ||
        String(x.id) === strippedId ||
        (x.auth_id && String(x.auth_id) === cleanId) ||
        (x.dados?.colaborador_id && String(x.dados.colaborador_id) === strippedId) ||
        (x.dados?.uid_legacy && String(x.dados.uid_legacy) === cleanId)
      )
      if (u) return u

      // Se o ID é um Auth UUID que ainda não está vinculado em system_users.auth_id,
      // cruzar via auth.users (por email, uid_legacy, colaborador_id ou nome)
      const au = authUsersById.get(cleanId)
      if (au) {
        const auEmail = String(au.email || au.user_metadata?.email || '').toLowerCase().trim()
        const auLegacyId = String(au.user_metadata?.uid_legacy || au.user_metadata?.colaborador_id || au.user_metadata?.system_user_id || '').trim()
        const auName = String(au.user_metadata?.nome || au.user_metadata?.full_name || au.user_metadata?.name || '').trim()

        if (auLegacyId) {
          const strippedLegacy = auLegacyId.replace(/^(f_|func_|colab_|prof_|usr_)/i, '')
          const uByLegacy = sysUserList.find(x => String(x.id) === auLegacyId || String(x.id) === strippedLegacy)
          if (uByLegacy) return uByLegacy
        }
        if (auEmail) {
          const uByEmail = sysUserList.find(x => x.email && String(x.email).toLowerCase().trim() === auEmail)
          if (uByEmail) return uByEmail
        }
        if (auName && !isGenericSenderName(auName)) {
          const auNameNorm = normText(auName)
          const uByName = sysUserList.find(x => x.nome && normText(x.nome) === auNameNorm)
          if (uByName) return uByName
        }
        if (auName && !isGenericSenderName(auName) && !auEmail.endsWith('@impactoedu.local')) {
          return {
            id: cleanId,
            auth_id: cleanId,
            nome: auName,
            email: auEmail || null,
            cargo: au.user_metadata?.cargo || au.user_metadata?.perfil || 'Colaborador(a)',
            perfil: au.user_metadata?.perfil || 'Colaborador(a)',
            dados: { foto: au.user_metadata?.foto || au.user_metadata?.avatar_url || null }
          }
        }
      }
    }

    if (email) {
      const cleanEmail = email.toLowerCase().trim()
      const u = sysUserList.find(x => x.email && x.email.toLowerCase().trim() === cleanEmail)
      if (u) return u
    }

    if (name) {
      const rawExtracted = String(name).match(/^Manual\s*\((.+)\)$/i)?.[1]?.trim() || String(name).trim()
      if (!isGenericSenderName(rawExtracted)) {
        const cleanNameNorm = normText(rawExtracted)
        if (cleanNameNorm.length >= 3) {
          const uExact = sysUserList.find(x => x.nome && normText(x.nome) === cleanNameNorm)
          if (uExact) return uExact
          const uPrefix = sysUserList.find(x => x.nome && normText(x.nome).startsWith(cleanNameNorm + ' '))
          if (uPrefix) return uPrefix
          const uSub = sysUserList.find(x => x.nome && (normText(x.nome).includes(cleanNameNorm) || cleanNameNorm.includes(normText(x.nome))))
          if (uSub) return uSub

          const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
          const nameTokens = cleanNameNorm.split(/\s+/).filter(t => t.length >= 2 && !stopWords.has(t))
          if (nameTokens.length >= 2) {
            const firstTok = nameTokens[0]
            const lastTok = nameTokens[nameTokens.length - 1]
            const uFirstLast = sysUserList.find(x => {
              if (!x.nome) return false
              const xTokens = normText(x.nome).split(/\s+/).filter(t => t.length >= 2 && !stopWords.has(t))
              return xTokens.length >= 2 && xTokens[0] === firstTok && xTokens[xTokens.length - 1] === lastTok
            })
            if (uFirstLast) return uFirstLast
          }
        }
      }
    }
    return null
  }

  function buildAutoSender(subtitulo = 'Sincronizar Catraca'): PushSenderInfo {
    return {
      id: 'automatico',
      nome: 'Automático',
      friendlyName: 'Automático',
      subtitulo,
      tipo: 'sistema',
      foto: null,
      initials: 'AU',
    }
  }

  function buildColabSender(
    u: any | null,
    fallbackName?: string | null,
    fallbackCargo?: string | null,
    fallbackFoto?: string | null
  ): PushSenderInfo {
    const rawFallback = fallbackName
      ? (String(fallbackName).match(/^Manual\s*\((.+)\)$/i)?.[1]?.trim() || String(fallbackName).trim())
      : null
    const finalName = u?.nome || rawFallback || 'Colaborador'
    return {
      id: u?.id ? String(u.id) : null,
      nome: finalName,
      friendlyName: getFriendlySenderName(finalName),
      subtitulo: u?.cargo || u?.perfil || fallbackCargo || 'Colaborador(a)',
      tipo: 'colaborador',
      foto: u?.foto || u?.dados?.foto || u?.dados?.avatar || fallbackFoto || null,
      email: u?.email || null,
      initials: getSenderInitials(finalName),
    }
  }

  for (const l of logs) {
    let sender: PushSenderInfo | null = null
    let meta: any = null
    try {
      meta = typeof l.onesignal_response === 'string'
        ? JSON.parse(l.onesignal_response)?._metadata
        : l.onesignal_response?._metadata
    } catch {}

    const itemIdStr = String(l.item_id || '').trim()
    const msgStr = String(l.message || '').trim()
    const titleStr = String(l.title || '').trim()

    // 0. Detecção prioritária de disparos AUTOMÁTICOS (Sincronizar_Catraca, Totem, Crons)
    const isCatracaAuto =
      meta?.origem === 'sincronizar_catraca' ||
      meta?.origem === 'catraca' ||
      meta?.origem === 'catraca_idface' ||
      meta?.tipo === 'saida_sozinho' ||
      itemIdStr.startsWith('reentrada_catraca_') ||
      itemIdStr.startsWith('saida_catraca_') ||
      (l.type === 'frequencia' && (
        /\(Entrada\s+às\s+\d{1,2}:\d{2}\)/i.test(msgStr) ||
        /confirmada na portaria às .* via /i.test(msgStr)
      )) ||
      (l.type === 'saida' && (
        /Saída Registrada na Catraca/i.test(titleStr) ||
        /\(Saiu sozinho\)/i.test(msgStr)
      ))

    if (isCatracaAuto) {
      sender = buildAutoSender(
        meta?.dispositivo
          ? `Sincronizar Catraca • ${meta.dispositivo}`
          : 'Sincronizar Catraca'
      )
    }

    const isTotemAuto =
      !sender && (
        meta?.origem === 'totem_automatico' ||
        meta?.origem === 'totem' ||
        (l.type === 'frequencia' && !l.user_id && /Foi registrada uma falta para .+ no dia \d{4}-\d{2}-\d{2}/i.test(msgStr))
      )

    if (isTotemAuto) {
      sender = buildAutoSender('Totem de Frequência')
    }

    const isCalendarAutoReminder =
      !sender &&
      l.type === 'calendario' && (
        itemIdStr.includes('-reminder') ||
        Boolean(meta?.is_reminder) ||
        titleStr.includes('Lembrete') ||
        msgStr.startsWith('Lembrete')
      )

    if (isCalendarAutoReminder) {
      sender = buildAutoSender('Lembrete de Calendário')
    }

    const isFinanceiroAuto =
      !sender &&
      l.type === 'cobrancas' &&
      !l.user_id && (
        itemIdStr.startsWith('fin_overdue_') ||
        meta?.origem === 'cron_automatico' ||
        meta?.tipo === 'parcela_vencida_3d'
      )

    if (isFinanceiroAuto) {
      sender = buildAutoSender('Alerta Financeiro')
    }

    if (!sender && meta?.sender_type === 'automatico') {
      sender = buildAutoSender(
        meta?.origem === 'sincronizar_catraca' ? 'Sincronizar Catraca' : 'Sistema Automático'
      )
    }

    // 1. Checagem direta por user_id ou metadados do remetente (colaborador ou responsável manual)
    if (!sender) {
      const directId = l.user_id || meta?.sender_id || meta?.sender_auth_id || meta?.author_id || meta?.authorId
      const directName = meta?.sender_name || meta?.author || meta?.autor || meta?.operator_name
      const directEmail = meta?.sender_email

      if (meta?.sender_type === 'responsavel' && directName && !isGenericSenderName(directName)) {
        sender = {
          id: directId ? String(directId) : null,
          nome: directName,
          friendlyName: getFriendlySenderName(directName),
          subtitulo: 'Responsável (Família)',
          tipo: 'responsavel',
          foto: meta?.sender_foto || null,
          initials: getSenderInitials(directName),
        }
      } else if (directId || (directName && !isGenericSenderName(directName)) || directEmail) {
        const u = findUser(directId, directName, directEmail)
        if (u) {
          sender = buildColabSender(u, directName, meta?.sender_cargo || meta?.sender_perfil, meta?.sender_foto)
        } else if (directName && !isGenericSenderName(directName)) {
          sender = buildColabSender(null, directName, meta?.sender_cargo || meta?.sender_perfil || 'Colaborador(a)', meta?.sender_foto)
        }
      }
    }

    // 2. Chat: se tem meta.sender_name
    if (!sender && l.type === 'chat' && meta?.sender_name) {
      const u = findUser(meta?.sender_id, meta.sender_name)
      const isFamSender = ['aluno', 'responsável', 'responsavel', 'família', 'familia'].includes(normText(meta?.sender_perfil))
      if (isFamSender && !u) {
        sender = {
          id: meta?.sender_id || null,
          nome: meta.sender_name,
          friendlyName: getFriendlySenderName(meta.sender_name),
          subtitulo: meta?.sender_perfil || 'Responsável (Família)',
          tipo: 'responsavel',
          foto: null,
          initials: getSenderInitials(meta.sender_name),
        }
      } else {
        sender = buildColabSender(u, meta.sender_name, meta?.sender_perfil || 'Mensagem do Chat')
      }
    }

    // 3. Frequência (diferenciação estrita entre Colaborador Manual vs Automático)
    if (!sender && l.type === 'frequencia') {
      const baseFreqId = itemIdStr.replace(/_(presente|falta|justificada|atraso|saida)$/i, '').trim()
      const freqRow = freqMap.get(baseFreqId) || (meta?.aluno_id && meta?.data ? freqMap.get(`FREQ-${meta.aluno_id}-${meta.data}`) : null)
      const fDados = freqRow?.dados || {}
      const regPor = String(fDados.registradoPor || '').trim()
      const manualMatch = regPor.match(/^Manual\s*\((.+)\)$/i)
      const extractedManualName =
        fDados.usuarioNome ||
        (manualMatch ? manualMatch[1].trim() : (!isGenericSenderName(regPor) && !/catraca|idface|totem/i.test(regPor) ? regPor : null))
      const manualUserId = fDados.usuarioId || fDados.usuarioAuthId

      if (manualUserId || (extractedManualName && !isGenericSenderName(extractedManualName))) {
        const u = findUser(manualUserId, extractedManualName)
        if (u || (extractedManualName && !isGenericSenderName(extractedManualName))) {
          sender = buildColabSender(u, extractedManualName, fDados.usuarioCargo || 'Registro de Frequência')
        }
      }

      if (!sender) {
        if (fDados.origem === 'totem' || /totem/i.test(regPor)) {
          sender = buildAutoSender('Totem de Frequência')
        } else {
          sender = buildAutoSender('Sincronizar Catraca')
        }
      }
    }

    // 4. Momentos (publicações e interações de curtida/comentário)
    if (!sender && l.type === 'momentos') {
      if (itemIdStr.startsWith('momento_like_') || itemIdStr.startsWith('momento_comment_')) {
        const actorName = meta?.author || msgStr.match(/^(.+?)\s+(?:curtiu|comentou)/i)?.[1]?.trim()
        const u = findUser(l.user_id || meta?.sender_id, actorName)
        if (u) {
          sender = buildColabSender(u, actorName)
        } else if (actorName) {
          sender = {
            nome: actorName,
            friendlyName: getFriendlySenderName(actorName),
            subtitulo: 'Interação no Mural',
            tipo: 'responsavel',
            foto: null,
            initials: getSenderInitials(actorName),
          }
        }
      }

      if (!sender) {
        const baseId = meta?.item_id || (itemIdStr ? itemIdStr.split('_aluno_')[0].split('_perfil_')[0] : null)
        const m = baseId ? momMap.get(String(baseId)) : null
        const authorName = m?.dados?.author || m?.dados?.autor || meta?.author || meta?.autor
        const authorId = m?.dados?.authorId || m?.dados?.author_id || meta?.authorId || meta?.author_id

        const u = findUser(authorId, authorName)
        if (u || (authorName && !isGenericSenderName(authorName))) {
          sender = buildColabSender(u, authorName, 'Professora / Coordenação')
        } else {
          sender = {
            nome: 'Equipe Pedagógica',
            friendlyName: 'Equipe Pedagógica',
            subtitulo: 'Momentos & Mídia',
            tipo: 'colaborador',
            foto: null,
            initials: 'EP',
          }
        }
      }
    }

    // 5. Comunicados (e respostas de comunicados)
    if (!sender && l.type === 'comunicados') {
      if (titleStr.startsWith('💬 Resposta de ')) {
        const repName = titleStr.replace(/^💬\s*Resposta de\s+/i, '').trim()
        if (repName) {
          sender = {
            nome: repName,
            friendlyName: getFriendlySenderName(repName),
            subtitulo: 'Responsável (Família)',
            tipo: 'responsavel',
            foto: null,
            initials: getSenderInitials(repName),
          }
        }
      } else if (titleStr.startsWith('🏫 Nova mensagem de ')) {
        const repName = titleStr.replace(/^🏫\s*Nova mensagem de\s+/i, '').trim()
        if (repName) {
          const u = findUser(null, repName)
          sender = buildColabSender(u, repName, 'Resposta em Comunicado')
        }
      }

      if (!sender) {
        const baseId = meta?.item_id || (itemIdStr ? itemIdStr.split('_aluno_')[0].split('_perfil_')[0] : null)
        const c = baseId ? comMap.get(String(baseId)) : null
        let authorName = c?.autor || c?.dados?.autor || c?.dados?.autor_nome || meta?.author || meta?.autor
        let authorId = c?.dados?.autorId || meta?.authorId || meta?.author_id
        let authorCargo = c?.dados?.autorCargo || meta?.author_cargo
        let authorFoto = c?.dados?.autorFoto || meta?.author_foto

        if (!authorName && msgStr) {
          const m1 = msgStr.match(/enviada por\s+([^.]+)/i)
          const m2 = msgStr.match(/^(.+?)\s+enviou uma mensagem/i)
          const m3 = msgStr.match(/^(.+?)\s+disponibilizou o relatório/i)
          const m4 = msgStr.match(/^(.+?)\s+enviou um novo comunicado/i)
          const m5 = msgStr.match(/^(.+?)\s+enviou o seu relatório/i)
          authorName = (m1?.[1] || m2?.[1] || m3?.[1] || m4?.[1] || m5?.[1] || null)?.trim()
        }

        const u = findUser(authorId, authorName)
        if (u || (authorName && !isGenericSenderName(authorName))) {
          sender = buildColabSender(u, authorName, authorCargo || 'Colaborador(a)', authorFoto)
        } else {
          sender = {
            nome: 'Coordenação Escolar',
            friendlyName: 'Coordenação',
            subtitulo: 'Comunicado Escolar',
            tipo: 'colaborador',
            foto: null,
            initials: 'CE',
          }
        }
      }
    }

    // 6. Portaria & Saída
    if (!sender && l.type === 'saida') {
      const match = itemIdStr.match(/^(?:chamada|saida|special_auth)_([0-9a-f-]{36})/i)
      const callIdKey = match ? match[1] : (meta?.saida_id || meta?.call_id || null)
      const call = callIdKey ? callMap.get(String(callIdKey)) : null
      const cDados = call?.dados || {}

      const isCallCatraca =
        cDados.origem === 'catraca_idface' ||
        cDados.guardianId === 'catraca-saida' ||
        cDados.source === 'catraca' ||
        cDados.source === 'idface' ||
        /catraca/i.test(String(cDados.operatorId || ''))

      if (isCallCatraca) {
        sender = buildAutoSender('Sincronizar Catraca • Portaria')
      } else {
        const isAppCall =
          titleStr.includes('Chamada') &&
          (cDados.source === 'app' || cDados.source === 'app_familia' || meta?.source === 'app' || meta?.source === 'app_familia')

        const guardian = cDados.guardianName || meta?.guardian_name
        const candidateOps = [
          meta?.operator_name,
          cDados.confirmedBy,
          cDados.operatorId,
          cDados.authorizedBy,
        ]
          .map(v => (typeof v === 'string' ? v.trim() : ''))
          .filter(v =>
            Boolean(v) &&
            !isGenericSenderName(v) &&
            !v.toLowerCase().includes('(app agenda digital)') &&
            (!guardian || normText(v) !== normText(guardian))
          )

        if (!isAppCall && candidateOps.length > 0) {
          const opName = candidateOps[0]
          const u = findUser(null, opName)
          sender = buildColabSender(u, opName, 'Portaria & Saída')
        } else if (guardian && !isGenericSenderName(guardian)) {
          sender = {
            nome: guardian,
            friendlyName: getFriendlySenderName(guardian),
            subtitulo: isAppCall ? 'Responsável (App)' : 'Responsável (Família)',
            tipo: 'responsavel',
            foto: null,
            initials: getSenderInitials(guardian),
          }
        } else {
          sender = buildAutoSender('Portaria & Saída')
        }
      }
    }

    // 7. Calendário & Eventos
    if (!sender && l.type === 'calendario') {
      const candidateEvId =
        meta?.item_id ||
        (Array.isArray(meta?.evento_ids) && meta.evento_ids[0] ? String(meta.evento_ids[0]) : null) ||
        (itemIdStr ? itemIdStr.split('_aluno_')[0].split('_perfil_')[0].replace(/-\d+$/, '') : null)
      const ev = candidateEvId ? evMap.get(String(candidateEvId)) : null
      const rawCreator =
        ev?.criado_por ||
        ev?.dados?.criadoPor ||
        ev?.dados?.criado_por ||
        ev?.dados?.responsavel ||
        ev?.dados?.autor ||
        ev?.dados?.usuarioNome ||
        meta?.sender_name
      const evCreator = rawCreator && !isGenericSenderName(rawCreator) ? rawCreator : null
      const u = findUser(l.user_id || meta?.sender_id || ev?.dados?.usuarioId, evCreator)
      if (u || evCreator) {
        sender = buildColabSender(u, evCreator, ev?.dados?.usuarioCargo || meta?.sender_cargo || 'Calendário de Eventos', ev?.dados?.usuarioFoto || meta?.sender_foto)
      } else {
        const eqTurma = Array.isArray(ev?.turmas)
          ? ev.turmas.find((t: any) => /coordena/i.test(String(t || '')))
          : null
        const coordLabel = eqTurma ? String(eqTurma).trim() : 'Coordenação Escolar'
        sender = {
          nome: coordLabel,
          friendlyName: eqTurma ? coordLabel : 'Coordenação',
          subtitulo: 'Calendário de Eventos',
          tipo: 'colaborador',
          foto: null,
          initials: 'CE',
        }
      }
    }

    // 8. Teste / Diagnóstico
    if (!sender && l.type === 'test') {
      sender = {
        nome: 'Administrador Master',
        friendlyName: 'Administrador',
        subtitulo: 'Simulação Manual de Push',
        tipo: 'colaborador',
        foto: null,
        initials: 'AM',
      }
    }

    // 9. Notas / Boletim
    if (!sender && l.type === 'notas') {
      sender = {
        nome: 'Secretaria Acadêmica',
        friendlyName: 'Secretaria',
        subtitulo: 'Boletim & Notas',
        tipo: 'colaborador',
        foto: null,
        initials: 'SA',
      }
    }

    // 10. Ocorrências
    if (!sender && l.type === 'ocorrencias') {
      if (itemIdStr.startsWith('ciencia_') || meta?.action === 'ciencia_confirmada') {
        const baseOcId = meta?.item_id || itemIdStr.replace(/^ciencia_/, '').split('_aluno_')[0].trim()
        const oc = baseOcId ? ocMap.get(String(baseOcId)) : null
        const famMatch = msgStr.match(/A família de\s+(.+?)\s+confirmou ciência/i)?.[1]?.trim()
        const respCienciaName =
          meta?.sender_name ||
          oc?.dados?.responsavel_ciencia ||
          (famMatch ? `Família de ${getFriendlySenderName(famMatch)}` : 'Responsável')
        sender = {
          nome: respCienciaName,
          friendlyName: respCienciaName.startsWith('Família de ') ? respCienciaName : getFriendlySenderName(respCienciaName),
          subtitulo: 'Ciência de Ocorrência • Família',
          tipo: 'responsavel',
          foto: null,
          initials: getSenderInitials(famMatch || respCienciaName),
        }
      } else {
        const baseOcId = meta?.item_id || itemIdStr.split('_aluno_')[0].trim()
        let oc = baseOcId ? ocMap.get(String(baseOcId)) : null
        // Se uma ocorrência individual de lote (OC-REL-<timestamp>-...) foi removida depois,
        // buscar irmã do mesmo lote pelo prefixo de timestamp
        if (!oc && baseOcId && baseOcId.startsWith('OC-REL-')) {
          const tsPrefix = baseOcId.slice(0, 19) // ex: "OC-REL-179250332016"
          for (const [k, v] of ocMap.entries()) {
            if (k.startsWith(tsPrefix)) {
              oc = v
              break
            }
          }
        }
        const ocDados = oc?.dados || {}
        const descStr = String(oc?.descricao || ocDados?.descricao || '')
        const lancadoMatch = descStr.match(/\[Lançado por:\s*([^\]]+?)(?:\s+via\s+Relatório)?(?:\s+em\s+\d{2}\/\d{2}|\])/i)
        const editadoMatch = descStr.match(/\[Editado por:\s*([^\]]+?)(?:\s+em\s+\d{2}\/\d{2}|\])/i)
        const extractedFromDesc = lancadoMatch?.[1]?.trim() || editadoMatch?.[1]?.trim() || null
        const parentCom = ocDados.comunicadoColabId ? comMap.get(String(ocDados.comunicadoColabId)) : null

        const candidateNames = [
          ocDados.responsavel,
          ocDados.registradoPor,
          extractedFromDesc,
          ocDados.autor,
          ocDados.professor,
          ocDados.usuarioNome,
          parentCom?.autor,
          parentCom?.dados?.autor,
          meta?.sender_name,
        ]
          .map(v => (typeof v === 'string' ? v.trim() : ''))
          .filter(v => Boolean(v) && !isGenericSenderName(v))

        const ocAuthorName = candidateNames[0] || null
        const ocAuthorId =
          ocDados.usuarioId ||
          ocDados.autorId ||
          parentCom?.dados?.autorId ||
          meta?.sender_id ||
          meta?.sender_auth_id ||
          null

        const u = findUser(ocAuthorId, ocAuthorName)
        if (u || (ocAuthorName && !isGenericSenderName(ocAuthorName))) {
          sender = buildColabSender(
            u,
            ocAuthorName,
            ocDados.autorCargo || ocDados.cargo || parentCom?.dados?.autorCargo || 'Registro de Ocorrência',
            ocDados.autorFoto || parentCom?.dados?.autorFoto || null
          )
        } else {
          sender = {
            nome: 'Coordenação Disciplinar',
            friendlyName: 'Coordenação',
            subtitulo: 'Registro de Ocorrência',
            tipo: 'colaborador',
            foto: null,
            initials: 'CD',
          }
        }
      }
    }

    // 11. Cobranças
    if (!sender && l.type === 'cobrancas') {
      sender = buildAutoSender('Departamento Financeiro')
    }

    // Fallback geral
    if (!sender) {
      sender = buildAutoSender('Sistema Escolar')
    }

    result.set(l.id, sender)
  }

  return result
}

async function resolveLogFullDetails(logIdOrLog: string | any, supabase: any) {
  let log = logIdOrLog
  if (typeof logIdOrLog === 'string') {
    const { data, error } = await supabase.from('agenda_push_logs').select('*').eq('id', logIdOrLog).maybeSingle()
    if (error || !data) return null
    log = data
  }

  let parsedResp: any = null
  try {
    if (log.onesignal_response) {
      parsedResp = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
    }
  } catch {}

  const meta = parsedResp?._metadata || null
  const savedTargetDetails: any[] | null = Array.isArray(parsedResp?._target_details)
    ? parsedResp._target_details
    : (Array.isArray(meta?.target_details) ? meta.target_details : null)

  const recordedTargetIds = new Set<string>()
  const targetAliases = new Set<string>()

  if (Array.isArray(parsedResp?._target_user_ids)) {
    parsedResp._target_user_ids.forEach((id: string) => {
      const clean = String(id || '').trim()
      if (clean) {
        recordedTargetIds.add(clean)
        targetAliases.add(clean)
      }
    })
  }

  const normalizedRecordedTargets = new Set<string>()
  recordedTargetIds.forEach(id => {
    normalizedRecordedTargets.add(id.toLowerCase())
    const noZeros = id.replace(/^0+/, '')
    if (noZeros) normalizedRecordedTargets.add(noZeros.toLowerCase())
  })

  const alunoId = extractLogStudentId(log)
  const isColaborador = Boolean(
    log.item_id?.includes('colaborador') ||
    log.target_url?.includes('/colaborador/') ||
    meta?.colaborador_id ||
    (savedTargetDetails && savedTargetDetails.some((d: any) => d.tipo === 'colaborador'))
  )

  let recipients: any[] = []
  let summary = ''
  let studentContext: {
    id: string
    nome: string
    matricula: string
    turmaNome: string
    totalLinkedGuardians: number
    targetedGuardiansCount: number
  } | null = null

  // 1. Caso seja relativo a Aluno (comunicados, momentos, frequência, saída - exceto chat que possui destinatários específicos)
  if (alunoId && log.type !== 'chat') {
    const cleanAlunoId = String(alunoId).trim()
    const expandedAlunoIds = Array.from(new Set([
      cleanAlunoId,
      cleanAlunoId.replace(/^0+/, ''),
      !isNaN(Number(cleanAlunoId)) ? String(Number(cleanAlunoId)).padStart(6, '0') : ''
    ].filter(Boolean)))

    const [{ data: aluno }, { data: vinculos }] = await Promise.all([
      supabase.from('alunos').select('id, nome, matricula, turma, foto, status, responsavel, responsavel_financeiro, responsavel_pedagogico').in('id', expandedAlunoIds).maybeSingle(),
      supabase.from('aluno_responsavel').select('responsavel_id').in('aluno_id', expandedAlunoIds)
    ])

    let turmaNome = ''
    if (aluno?.turma) {
      const { data: turma } = await supabase.from('turmas').select('nome').eq('id', aluno.turma).maybeSingle()
      turmaNome = turma?.nome || `Turma ${aluno.turma}`
    }

    const rawRespIds: string[] = Array.from(new Set((vinculos || []).map((v: any) => String(v.responsavel_id).trim()).filter(Boolean)))
    const expandedRespIds = Array.from(new Set([
      ...rawRespIds,
      ...rawRespIds.map((id: string) => id.replace(/^0+/, '')),
      ...rawRespIds.map((id: string) => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
    ].filter(Boolean)))

    let resps: any[] = []
    if (expandedRespIds.length > 0) {
      const { data: rList } = await supabase.from('responsaveis').select('id, nome, email, telefone, celular, dados').in('id', expandedRespIds)
      resps = rList || []
    }

    // Buscar contas no Supabase Auth (com cache) e system_users para verificar ativação real
    let authUsersList: any[] = []
    try {
      authUsersList = await getAllAuthUsersCached()
    } catch (e) {
      console.warn('[resolveLogFullDetails] Aviso ao buscar auth.users:', e)
    }

    const { data: sysUsersList } = await supabase
      .from('system_users')
      .select('id, auth_id, email, nome, dados')
      .limit(3000)

    // Resolver dados completos de todos os responsáveis vinculados ao aluno
    const resolvedLinkedGuardians = resps.map((r: any) => {
      const rIdStr = String(r.id).trim()
      const rIdClean = rIdStr.replace(/^0+/, '')
      const rIdPadded = !isNaN(Number(rIdStr)) ? String(Number(rIdStr)).padStart(6, '0') : ''
      const cleanEmail = (r.email || '').toLowerCase().trim()

      const matchedAuthByEmail = cleanEmail ? authUsersList.find(u => (u.email || u.user_metadata?.email || '').toLowerCase().trim() === cleanEmail) : null
      const matchedAuthByMeta = authUsersList.find(u => {
        const metaRespId = String(u.user_metadata?.responsavel_id || u.user_metadata?.responsavelId || '').trim()
        return metaRespId && (metaRespId === rIdStr || metaRespId.replace(/^0+/, '') === rIdClean)
      })
      const matchedAuth = matchedAuthByEmail || matchedAuthByMeta

      const matchedSys = (sysUsersList || []).find((u: any) => {
        const uEmail = (u.email || '').toLowerCase().trim()
        const uRespId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
        return (cleanEmail && uEmail === cleanEmail) || (uRespId && (uRespId === rIdStr || uRespId.replace(/^0+/, '') === rIdClean))
      })

      const effectiveAuthId = matchedAuth?.id || matchedSys?.auth_id || (matchedSys ? matchedSys.id : null) || r.dados?.auth_id || null
      const sysUserId = matchedSys?.id ? String(matchedSys.id).trim() : null

      const candidateIds = [
        rIdStr,
        rIdClean,
        rIdPadded,
        cleanEmail,
        effectiveAuthId ? String(effectiveAuthId).trim() : '',
        sysUserId || '',
        r.dados?.auth_id ? String(r.dados.auth_id).trim() : ''
      ].filter(Boolean)

      const isTargetedByRecordedIds = candidateIds.some(cid =>
        normalizedRecordedTargets.has(cid.toLowerCase()) ||
        normalizedRecordedTargets.has(cid.replace(/^0+/, '').toLowerCase())
      )

      return {
        raw: r,
        rIdStr,
        rIdClean,
        rIdPadded,
        cleanEmail,
        matchedAuth,
        matchedSys,
        effectiveAuthId,
        sysUserId,
        isTargetedByRecordedIds,
      }
    })

    // Filtrar apenas os responsáveis que realmente foram alvo deste disparo
    let guardiansToProcess = resolvedLinkedGuardians

    if (Array.isArray(meta?.responsavel_ids)) {
      const explicitSet = new Set(
        meta.responsavel_ids.flatMap((id: any) => {
          const s = String(id || '').trim()
          return [s.toLowerCase(), s.replace(/^0+/, '').toLowerCase()]
        }).filter(Boolean)
      )
      guardiansToProcess = resolvedLinkedGuardians.filter(g =>
        explicitSet.has(g.rIdStr.toLowerCase()) || explicitSet.has(g.rIdClean.toLowerCase())
      )
    } else if (savedTargetDetails && savedTargetDetails.some((d: any) => d.tipo === 'responsavel')) {
      const savedRespSet = new Set(
        savedTargetDetails
          .filter((d: any) => d.tipo === 'responsavel')
          .flatMap((d: any) => {
            const s = String(d.id || '').trim()
            return [s.toLowerCase(), s.replace(/^0+/, '').toLowerCase()]
          })
          .filter(Boolean)
      )
      guardiansToProcess = resolvedLinkedGuardians.filter(g =>
        savedRespSet.has(g.rIdStr.toLowerCase()) || savedRespSet.has(g.rIdClean.toLowerCase())
      )
    } else if (recordedTargetIds.size > 0) {
      const matchedByTargets = resolvedLinkedGuardians.filter(g => g.isTargetedByRecordedIds)
      const studentOnlyTargeted =
        matchedByTargets.length === 0 &&
        expandedAlunoIds.some(aid => normalizedRecordedTargets.has(aid.toLowerCase())) &&
        recordedTargetIds.size <= 2

      if (matchedByTargets.length > 0) {
        guardiansToProcess = matchedByTargets
      } else if (studentOnlyTargeted) {
        guardiansToProcess = []
      }
    }

    // Se o log não tinha _target_user_ids gravado (logs legados), sintetizar aliases apenas dos responsáveis filtrados
    if (recordedTargetIds.size === 0) {
      targetAliases.add(String(alunoId))
      targetAliases.add(String(alunoId).padStart(6, '0'))
      guardiansToProcess.forEach(g => {
        targetAliases.add(g.rIdStr)
        if (g.cleanEmail) targetAliases.add(g.cleanEmail)
        if (g.effectiveAuthId) targetAliases.add(String(g.effectiveAuthId))
      })
    }

    // Consultar dispositivos no OneSignal para cada responsável efetivamente alvo
    for (const g of guardiansToProcess) {
      const { raw: r, cleanEmail, matchedAuth, matchedSys, effectiveAuthId } = g

      const devices = await fetchDevicesForGuardian({
        responsavel_id: r.id,
        email: r.email,
        authId: effectiveAuthId
      })
      const hasActive = devices.some((d: any) => d.isSubscribed)
      const deviceModels = devices.map((d: any) => d.modelo || d.tipo).filter(Boolean)

      // Diagnóstico detalhado do status da conta
      let accountStatus: 'active_device' | 'never_activated' | 'no_email' | 'no_device' = 'no_device'
      let accountStatusLabel = 'Sem Push Ativo'
      let accountStatusDetail = 'App desinstalado ou sem permissão'
      let statusTone: 'success' | 'warning' | 'danger' | 'neutral' = 'danger'

      if (hasActive) {
        accountStatus = 'active_device'
        accountStatusLabel = 'Push Ativo'
        accountStatusDetail = deviceModels.join(', ') || 'Dispositivo conectado'
        statusTone = 'success'
      } else if (!cleanEmail) {
        accountStatus = 'no_email'
        accountStatusLabel = 'Sem E-mail'
        accountStatusDetail = 'Pendente cadastro na secretaria'
        statusTone = 'neutral'
      } else if (!matchedAuth && !matchedSys) {
        accountStatus = 'never_activated'
        accountStatusLabel = 'Conta Não Ativada'
        accountStatusDetail = 'Nunca fez o 1º Acesso no app'
        statusTone = 'warning'
      } else {
        accountStatus = 'no_device'
        accountStatusLabel = 'Sem Aparelho Ativo'
        accountStatusDetail = 'App desinstalado ou sem permissão'
        statusTone = 'danger'
      }

      recipients.push({
        id: String(r.id),
        nome: r.nome || matchedSys?.nome || matchedAuth?.user_metadata?.nome || 'Responsável Legal',
        tipo: 'responsavel',
        tipoLabel: 'Responsável',
        email: r.email || matchedSys?.email || matchedAuth?.email || null,
        telefone: formatPhoneDisplay(r.telefone || r.celular),
        devicesCount: devices.length,
        devices,
        hasActiveDevice: hasActive,
        deviceSummary: devices.length > 0 ? deviceModels.join(', ') : accountStatusDetail,
        accountStatus,
        accountStatusLabel,
        accountStatusDetail,
        statusTone,
      })
    }

    const wasAlunoDirectTargeted = Boolean(
      meta?.include_aluno_direct === true ||
      (savedTargetDetails && savedTargetDetails.some((d: any) => d.tipo === 'aluno')) ||
      (recipients.length === 0 && aluno)
    )

    if (aluno && wasAlunoDirectTargeted) {
      recipients.push({
        id: String(aluno.id),
        nome: aluno.nome,
        tipo: 'aluno',
        tipoLabel: 'Aluno(a) (Acesso Direto)',
        matricula: aluno.matricula || String(aluno.id),
        turmaNome: turmaNome || aluno.turma || 'Turma não informada',
        statusTone: 'neutral',
        deviceSummary: 'Alias direto do aluno (aluno_id)',
      })
    }

    if (aluno) {
      studentContext = {
        id: String(aluno.id),
        nome: aluno.nome,
        matricula: aluno.matricula || String(aluno.id),
        turmaNome: turmaNome || aluno.turma || 'Turma não informada',
        totalLinkedGuardians: resolvedLinkedGuardians.length,
        targetedGuardiansCount: guardiansToProcess.length,
      }
    }

    if (guardiansToProcess.length === 1 && resolvedLinkedGuardians.length > 1) {
      summary = `${recipients[0]?.nome || 'Responsável'} • Aluno(a): ${aluno?.nome || 'Aluno'} (1 de ${resolvedLinkedGuardians.length} responsáveis)`
    } else if (guardiansToProcess.length > 1 && guardiansToProcess.length < resolvedLinkedGuardians.length) {
      summary = `${guardiansToProcess.map(g => g.raw.nome).join(', ')} • Aluno(a): ${aluno?.nome || 'Aluno'} (${guardiansToProcess.length} de ${resolvedLinkedGuardians.length} responsáveis)`
    } else {
      summary = `${aluno?.nome || 'Aluno'} (${guardiansToProcess.length || resolvedLinkedGuardians.length} responsável(is) vinculado(s))`
    }
  } else if (isColaborador) {
    // 2. Caso seja relativo a Colaborador
    const rawAliases = Array.from(targetAliases)
    if (meta?.colaborador_id) rawAliases.push(String(meta.colaborador_id))
    const cleanColabIds = Array.from(new Set(rawAliases.map(id => id.replace(/^f_/, '').trim()).filter(Boolean)))
    
    let colabQuery = supabase.from('system_users').select('id, nome, email, cargo, perfil, auth_id, dados')
    if (cleanColabIds.length > 0) {
      const orParts: string[] = []
      const regularIds = cleanColabIds.filter(id => !id.includes('@'))
      const uuidIds = regularIds.filter(id => isUUID(id))
      const emailIds = cleanColabIds.filter(id => id.includes('@')).map(e => e.toLowerCase())
      if (regularIds.length > 0) {
        orParts.push(`id.in.(${regularIds.map(id => `"${id}"`).join(',')})`)
      }
      if (uuidIds.length > 0) {
        orParts.push(`auth_id.in.(${uuidIds.map(id => `"${id}"`).join(',')})`)
      }
      if (emailIds.length > 0) {
        orParts.push(`email.in.(${emailIds.map(e => `"${e}"`).join(',')})`)
      }
      if (orParts.length > 0) {
        colabQuery = colabQuery.or(orParts.join(','))
      }
    } else {
      colabQuery = colabQuery.limit(30)
    }
    const { data: colabs } = await colabQuery

    for (const c of colabs || []) {
      const devices = await fetchDevicesForGuardian({
        authId: c.auth_id,
        colaborador_id: String(c.id),
        system_user_id: String(c.id),
        email: c.email,
      })
      const hasActive = devices.some((d: any) => d.isSubscribed)
      const deviceModels = devices.map((d: any) => d.modelo || d.tipo).filter(Boolean)

      let accountStatus: 'active_device' | 'never_activated' | 'no_email' | 'no_device' = 'no_device'
      let accountStatusLabel = 'Sem Aparelho Ativo'
      let accountStatusDetail = 'App desinstalado ou sem permissão'
      let statusTone: 'success' | 'warning' | 'danger' | 'neutral' = 'danger'

      if (hasActive) {
        accountStatus = 'active_device'
        accountStatusLabel = 'Push Ativo'
        accountStatusDetail = deviceModels.join(', ') || 'Dispositivo conectado'
        statusTone = 'success'
      } else if (!c.email) {
        accountStatus = 'no_email'
        accountStatusLabel = 'Sem E-mail'
        accountStatusDetail = 'Pendente cadastro na secretaria'
        statusTone = 'neutral'
      } else if (!c.auth_id) {
        accountStatus = 'never_activated'
        accountStatusLabel = 'Conta Não Ativada'
        accountStatusDetail = 'Nunca fez o 1º Acesso no app'
        statusTone = 'warning'
      } else {
        accountStatus = 'no_device'
        accountStatusLabel = 'Sem Aparelho Ativo'
        accountStatusDetail = 'App desinstalado ou sem permissão'
        statusTone = 'danger'
      }

      recipients.push({
        id: String(c.id),
        nome: c.nome || 'Colaborador',
        tipo: 'colaborador',
        tipoLabel: c.cargo || c.perfil || 'Colaborador',
        email: c.email || null,
        cargo: c.cargo || c.perfil || 'Equipe Escolar',
        devicesCount: devices.length,
        devices,
        hasActiveDevice: hasActive,
        deviceSummary: devices.length > 0 ? deviceModels.join(', ') : accountStatusDetail,
        accountStatus,
        accountStatusLabel,
        accountStatusDetail,
        statusTone,
      })
      if (recordedTargetIds.size === 0) {
        targetAliases.add(String(c.id))
        if (c.email) targetAliases.add(c.email.toLowerCase().trim())
        if (c.auth_id) targetAliases.add(c.auth_id)
      }
    }
    summary = (colabs || []).length === 1
      ? `${colabs![0].nome} (${colabs![0].cargo || colabs![0].perfil || 'Colaborador'})`
      : `Equipe Escolar / Colaboradores (${(colabs || []).length} destinatários)`
  } else if (log.type === 'chat' || recordedTargetIds.size > 0) {
    // 3. Caso seja mensagem de Chat ou disparo avulso com _target_user_ids registrados
    const targetIds = Array.from(targetAliases)
    if (targetIds.length > 0) {
      const numericIds = targetIds.filter(id => /^\d+$/.test(id))
      const uuidIds = targetIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      const emailIds = targetIds.filter(id => id.includes('@'))

      const queries: Promise<any>[] = []
      if (numericIds.length > 0) {
        queries.push(supabase.from('responsaveis').select('id, nome, email, telefone, celular').in('id', numericIds).limit(50))
      } else {
        queries.push(Promise.resolve({ data: [] }))
      }

      if (uuidIds.length > 0 || emailIds.length > 0) {
        let q = supabase.from('system_users').select('id, nome, email, cargo, perfil, auth_id, dados')
        const conds: string[] = []
        if (uuidIds.length > 0) {
          conds.push(`id.in.(${uuidIds.map(u => `"${u}"`).join(',')})`)
          conds.push(`auth_id.in.(${uuidIds.map(u => `"${u}"`).join(',')})`)
        }
        if (emailIds.length > 0) {
          conds.push(`email.in.(${emailIds.map(e => `"${e}"`).join(',')})`)
        }
        queries.push(q.or(conds.join(',')).limit(50))
      } else {
        queries.push(Promise.resolve({ data: [] }))
      }

      const [{ data: resps }, { data: sysUsers }] = await Promise.all(queries)
      const matchedRespIds = new Set((resps || []).map((r: any) => String(r.id).trim()))

      for (const r of resps || []) {
        const matchedSysForResp = (sysUsers || []).find((u: any) => {
          const uRespId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
          const uEmail = (u.email || '').toLowerCase().trim()
          const rEmail = (r.email || '').toLowerCase().trim()
          return (uRespId && uRespId === String(r.id).trim()) || (rEmail && uEmail === rEmail)
        })

        const devices = await fetchDevicesForGuardian({
          responsavel_id: r.id,
          email: r.email,
          authId: matchedSysForResp?.auth_id || null,
        })
        const hasActive = devices.some((d: any) => d.isSubscribed)
        const deviceModels = devices.map((d: any) => d.modelo || d.tipo).filter(Boolean)

        recipients.push({
          id: String(r.id),
          nome: r.nome || 'Responsável',
          tipo: 'responsavel',
          tipoLabel: 'Responsável',
          email: r.email || null,
          telefone: formatPhoneDisplay(r.telefone || r.celular),
          devicesCount: devices.length,
          devices,
          hasActiveDevice: hasActive,
          deviceSummary: devices.length > 0 ? deviceModels.join(', ') : 'App desinstalado ou sem permissão',
          accountStatus: hasActive ? 'active_device' : 'no_device',
          accountStatusLabel: hasActive ? 'Push Ativo' : 'Sem Aparelho Ativo',
          accountStatusDetail: deviceModels.join(', ') || 'Sem permissão',
          statusTone: hasActive ? 'success' : 'danger',
        })
      }

      for (const c of sysUsers || []) {
        // Evitar duplicar caso este system_user já tenha sido listado como o próprio responsável acima
        const uRespId = String(c.dados?.responsavel_id || c.dados?.responsavelId || '').trim()
        if (uRespId && matchedRespIds.has(uRespId)) continue
        if (c.email && (resps || []).some((r: any) => (r.email || '').toLowerCase().trim() === c.email.toLowerCase().trim())) continue

        const devices = await fetchDevicesForGuardian({
          authId: c.auth_id,
          system_user_id: String(c.id),
          colaborador_id: String(c.id),
          email: c.email,
        })
        const hasActive = devices.some((d: any) => d.isSubscribed)
        const deviceModels = devices.map((d: any) => d.modelo || d.tipo).filter(Boolean)

        recipients.push({
          id: String(c.id),
          nome: c.nome || 'Colaborador',
          tipo: 'colaborador',
          tipoLabel: c.cargo || c.perfil || 'Equipe Escolar',
          email: c.email || null,
          cargo: c.cargo || c.perfil || 'Equipe Escolar',
          devicesCount: devices.length,
          devices,
          hasActiveDevice: hasActive,
          deviceSummary: devices.length > 0 ? deviceModels.join(', ') : (hasActive ? 'Dispositivo conectado' : 'App desinstalado ou sem permissão'),
          accountStatus: hasActive ? 'active_device' : 'no_device',
          accountStatusLabel: hasActive ? 'Push Ativo' : 'Sem Aparelho Ativo',
          accountStatusDetail: deviceModels.join(', ') || (hasActive ? 'Dispositivo conectado' : 'Sem permissão'),
          statusTone: hasActive ? 'success' : 'danger',
        })
      }
    }

    const metaTitle = meta?.conversation_title || ''
    const metaRecipient = meta?.recipient_name || ''
    const friendlyName = metaRecipient || metaTitle || (recipients[0]?.nome) || 'Destinatário'
    summary = `${friendlyName} (${recipients.length || 1} destinatário(s))`
  } else {
    // 4. Fallback genérico
    summary = `${log.target_count || 1} destinatário(s) na lista`
  }

  // Verificar Leitura no Aplicativo (agenda_notification_reads)
  const candidateIds = extractLogCandidateReadIds(log)
  let readInfo: { isRead: boolean; readAt: string | null; readBy: string | null; readerName: string | null } = {
    isRead: false,
    readAt: null,
    readBy: null,
    readerName: null,
  }

  if (candidateIds.length > 0) {
    const { data: reads } = await supabase.from('agenda_notification_reads')
      .select('content_id, read_at, usuario_id, perfil, aluno_id')
      .in('content_id', candidateIds)
      .order('read_at', { ascending: false })
      .limit(1)

    if (reads && reads.length > 0) {
      const r = reads[0]
      readInfo.isRead = true
      readInfo.readAt = r.read_at
      readInfo.readBy = r.usuario_id

      const cleanUserId = (r.usuario_id || '').split('#')[0]
      const foundResp = recipients.find(rec => rec.id === cleanUserId || rec.email === cleanUserId)
      if (foundResp) {
        readInfo.readerName = foundResp.nome
      } else if (cleanUserId === alunoId) {
        readInfo.readerName = studentContext?.nome || recipients.find(rec => rec.tipo === 'aluno')?.nome || 'Aluno'
      } else {
        const { data: su } = await supabase.from('system_users').select('nome').eq('id', cleanUserId).maybeSingle()
        if (su) readInfo.readerName = su.nome
      }
    }
  }

  // Se for chat e não constar em agenda_notification_reads, checar em chat_messages
  if (!readInfo.isRead && log.type === 'chat') {
    try {
      let msgId: string | null = meta?.message_id || null
      if (!msgId && log.item_id) {
        const m = log.item_id.match(/(?:^|_)msg_([a-zA-Z0-9-]+?)(?:_(?:familia|colaborador))?$/)
        if (m) msgId = m[1]
      }
      if (msgId) {
        const { data: cmsg } = await supabase
          .from('chat_messages')
          .select('id, status, updated_at')
          .eq('id', msgId)
          .maybeSingle()

        if (cmsg && cmsg.status === 'read') {
          readInfo.isRead = true
          readInfo.readAt = cmsg.updated_at
          readInfo.readerName = 'Lido no chat'
        }
      }
    } catch {}
  }

  // Estatísticas de entrega ao vivo OneSignal
  let oneSignalStats: any = null
  let oneSignalId: string | null = parsedResp?.id || null
  if (parsedResp?.successful !== undefined) {
    oneSignalStats = parsedResp
  }

  if (oneSignalId && !oneSignalStats) {
    try {
      oneSignalStats = await getNotificationStats(oneSignalId)
    } catch (e) {
      console.warn('Erro ao consultar stats do OneSignal:', e)
    }
  }

  // Extrair informações de lembrete / agendamento
  let sendAfter: string | null = parsedResp?._send_after || meta?.send_after || null
  let isReminder = Boolean(log.item_id?.includes('-reminder') || log.title?.toLowerCase().includes('lembrete') || meta?.is_reminder)
  let eventDate: string | null = meta?.data || null

  if (isReminder && !sendAfter && eventDate) {
    try {
      const evDate = new Date(`${eventDate}T12:00:00Z`)
      evDate.setUTCDate(evDate.getUTCDate() - 1)
      sendAfter = `${evDate.toISOString().split('T')[0]} 20:00:00 GMT-0400`
    } catch {}
  }

  const sendersMap = await batchResolveSenders([log], supabase)
  const sender = sendersMap.get(log.id) || null

  return {
    logId: log.id,
    sender,
    recipients,
    studentContext,
    summary,
    targetAliases: Array.from(targetAliases),
    targetCount: recipients.length || log.target_count || 1,
    readInfo,
    oneSignalId,
    oneSignalStats,
    sendAfter,
    isReminder,
    eventDate,
  }
}

/**
 * GET /api/agenda/push/test
 *
 * Query params:
 * - ?aluno_id=... : Retorna aluno, turma, responsáveis vinculados e prontidão de push
 * - ?logs=true : Retorna os últimos 50 logs de disparos de teste
 * - ?config=true : Retorna o status de conexão com o OneSignal
 * - ?log_details=... : Retorna auditoria detalhada com lista completa de destinatários e leituras
 */
export async function GET(request: Request) {
  const auth = await verifyAdminAuth()
  if (!auth.authorized) return auth.errorResponse!

  const { searchParams } = new URL(request.url)
  const alunoId = searchParams.get('aluno_id')
  const colaboradorId = searchParams.get('colaborador_id') || searchParams.get('usuario_id')
  const wantColaboradores = searchParams.get('colaboradores') === 'true'
  const wantLogs = searchParams.get('logs') === 'true'
  const wantConfig = searchParams.get('config') === 'true'
  const wantOneSignalOverview = searchParams.get('onesignal_overview') === 'true'
  const supabase = supabaseServer

  try {
    // 0. Panorama completo de Aparelhos Ativos e Limpeza no OneSignal
    if (wantOneSignalOverview) {
      const { getOneSignalFleetOverview } = await import('@/lib/server/oneSignalFleetService')
      const overview = await getOneSignalFleetOverview()
      return NextResponse.json(overview)
    }

    // 1. Status de configuração do OneSignal
    if (wantConfig) {
      const hasAppId = Boolean(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_APP_ID.length > 8)
      const hasRestKey = Boolean(process.env.ONESIGNAL_REST_API_KEY && process.env.ONESIGNAL_REST_API_KEY.length > 8)
      const isMockMode = !hasAppId || !hasRestKey

      const { getPushPauseStatus } = await import('@/lib/server/pushPauseService')
      const pauseStatus = await getPushPauseStatus()

      return NextResponse.json({
        hasAppId,
        hasRestKey,
        isMockMode,
        appIdPreview: hasAppId ? `${process.env.ONESIGNAL_APP_ID!.slice(0, 8)}...` : null,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://resilient-cuchufli-2b4125.netlify.app',
        pauseStatus,
      })
    }

    // 2. Histórico de logs
    if (wantLogs) {
      const { data: logs, error: logsErr } = await supabase
        .from('agenda_push_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60)

      if (logsErr) {
        return NextResponse.json({ error: logsErr.message }, { status: 400 })
      }

      const sendersMap = await batchResolveSenders(logs || [], supabase)
      const enriched = (logs || []).map((l: any) => ({
        ...l,
        sender: sendersMap.get(l.id) || null
      }))

      return NextResponse.json({ logs: enriched })
    }

    // 2.0.1b Detalhes completos de destinatários e leitura de um log
    const logDetailsId = searchParams.get('log_details') || searchParams.get('recipients_for_log')
    if (logDetailsId) {
      const details = await resolveLogFullDetails(logDetailsId, supabase)
      if (!details) {
        return NextResponse.json({ error: 'Log não encontrado.' }, { status: 404 })
      }
      return NextResponse.json(details)
    }

    // 2.0.1 Consulta de estatísticas ao vivo do OneSignal para uma notificação
    const notifStatsId = searchParams.get('notification_stats')
    if (notifStatsId) {
      const stats = await getNotificationStats(notifStatsId)
      return NextResponse.json({ stats })
    }

    // 2.0.2 Busca unificada instantânea de usuários (Alunos, Responsáveis, Colaboradores)
    const userSearch = searchParams.get('user_search')?.trim()
    if (userSearch) {
      const q = userSearch.toLowerCase()
      const [alunosRes, usersRes, respsRes] = await Promise.all([
        supabase.from('alunos').select('id, nome, matricula, turma, foto, status').or(`nome.ilike.%${q}%,matricula.ilike.%${q}%`).limit(12),
        supabase.from('system_users').select('id, nome, email, cargo, perfil, status, auth_id, dados').or(`nome.ilike.%${q}%,email.ilike.%${q}%`).limit(12),
        supabase.from('responsaveis').select('id, nome, email, telefone, celular, dados').or(`nome.ilike.%${q}%,email.ilike.%${q}%`).limit(12)
      ])

      const results = [
        ...(alunosRes.data || []).map((a: any) => ({
          id: String(a.id),
          nome: a.nome,
          tipo: 'aluno' as const,
          subtitulo: `Matrícula: ${a.matricula || a.id} • ${a.turma || 'Turma não informada'}`,
          foto: a.foto || null,
          status: a.status || 'ativo',
          detalhe: a.turma || 'Aluno',
        })),
        ...(respsRes.data || []).map((r: any) => ({
          id: String(r.id),
          nome: r.nome || 'Responsável',
          tipo: 'responsavel' as const,
          subtitulo: r.email || r.telefone || r.celular || 'Responsável Legal',
          foto: null,
          status: 'ativo',
          detalhe: r.email || 'Responsável',
        })),
        ...(usersRes.data || []).map((u: any) => ({
          id: String(u.id),
          authId: u.auth_id || null,
          nome: u.nome || 'Colaborador',
          tipo: 'colaborador' as const,
          subtitulo: `${u.cargo || u.perfil || 'Equipe'} • ${u.email || ''}`,
          foto: u.foto || u.dados?.foto || null,
          status: u.status || 'ativo',
          detalhe: u.cargo || u.perfil || 'Equipe',
        })),
      ]

      return NextResponse.json({ users: results })
    }

    // 2.0.3 Histórico Completo com Paginação, Multi-Filtros e Detecção de Leitura
    const wantHistory = searchParams.get('history') === 'true'
    if (wantHistory) {
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)))
      const from = (page - 1) * limit
      const to = from + limit - 1

      const filterUserType = searchParams.get('user_type') // 'aluno' | 'responsavel' | 'colaborador'
      const filterUserId = searchParams.get('user_id')?.trim()
      const filterSearch = searchParams.get('search')?.trim()
      const filterCategory = searchParams.get('category')?.trim()
      const filterStatus = searchParams.get('status')?.trim()
      const filterDateRange = searchParams.get('date_range')?.trim() // 'today' | '7d' | '30d' | 'all'

      let query = supabase.from('agenda_push_logs').select('*', { count: 'exact' })

      // 1. Filtro por Data
      if (filterDateRange === 'today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        query = query.gte('created_at', today.toISOString())
      } else if (filterDateRange === '7d') {
        const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        query = query.gte('created_at', d7.toISOString())
      } else if (filterDateRange === '30d') {
        const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        query = query.gte('created_at', d30.toISOString())
      }

      // 2. Filtro por Categoria
      if (filterCategory && filterCategory !== 'all') {
        if (filterCategory === 'saida') {
          query = query.or('type.eq.saida,item_id.ilike.saida_%,item_id.ilike.chamada_%')
        } else {
          query = query.eq('type', filterCategory)
        }
      }

      // 3. Filtro por Status
      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      // 4. Filtro por Busca Textual (com suporte a Remetente/Autor e Automático/Catraca)
      if (filterSearch) {
        const safeOrSearch = filterSearch.replace(/[,()"'\\]/g, '').trim()
        const searchOrs: string[] = safeOrSearch
          ? [
              `title.ilike.%${safeOrSearch}%`,
              `message.ilike.%${safeOrSearch}%`,
              `item_id.ilike.%${safeOrSearch}%`
            ]
          : []

        const searchNorm = safeOrSearch
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()

        if (
          searchNorm.includes('automatic') ||
          searchNorm.includes('catraca') ||
          searchNorm.includes('sincronizar')
        ) {
          searchOrs.push(
            'message.ilike.%Entrada às%',
            'message.ilike.%Saiu sozinho%',
            'item_id.ilike.%catraca%',
            'item_id.ilike.%-reminder%'
          )
        }

        if (safeOrSearch.length >= 2) {
          try {
            const [{ data: matchedUsers }, { data: matchedMoms }, { data: matchedComs }, { data: matchedOcs }, authUsersForSearch] = await Promise.all([
              supabase.from('system_users').select('id, auth_id, email, nome').ilike('nome', `%${safeOrSearch}%`).limit(15),
              supabase.from('momentos').select('id').ilike('dados->>author', `%${safeOrSearch}%`).limit(25),
              supabase.from('comunicados').select('id').ilike('autor', `%${safeOrSearch}%`).not('id', 'like', 'AD-COM-REL-STU-%').limit(25),
              supabase.from('ocorrencias').select('id').or(`dados->>responsavel.ilike.%${safeOrSearch}%,descricao.ilike.%${safeOrSearch}%`).limit(25),
              getAllAuthUsersCached().catch(() => [] as any[])
            ])

            const matchedEmails = new Set<string>()
            if (matchedUsers && matchedUsers.length > 0) {
              matchedUsers.forEach((u: any) => {
                if (u.id) searchOrs.push(`user_id.eq.${u.id}`)
                if (u.auth_id) searchOrs.push(`user_id.eq.${u.auth_id}`)
                if (u.email) matchedEmails.add(String(u.email).toLowerCase().trim())
              })
            }

            if (Array.isArray(authUsersForSearch) && authUsersForSearch.length > 0) {
              authUsersForSearch.forEach((au: any) => {
                const auEmail = String(au.email || au.user_metadata?.email || '').toLowerCase().trim()
                const auNameNorm = String(au.user_metadata?.nome || au.user_metadata?.full_name || au.user_metadata?.name || '')
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                if ((auEmail && matchedEmails.has(auEmail)) || (searchNorm.length >= 3 && auNameNorm.includes(searchNorm))) {
                  if (au.id) searchOrs.push(`user_id.eq.${au.id}`)
                }
              })
            }

            if (matchedMoms && matchedMoms.length > 0) {
              matchedMoms.forEach((m: any) => {
                if (m.id) searchOrs.push(`item_id.ilike.%${m.id}%`)
              })
            }

            if (matchedComs && matchedComs.length > 0) {
              matchedComs.forEach((c: any) => {
                if (c.id) searchOrs.push(`item_id.ilike.%${c.id}%`)
              })
            }

            if (matchedOcs && matchedOcs.length > 0) {
              matchedOcs.forEach((o: any) => {
                if (o.id) searchOrs.push(`item_id.ilike.${o.id}%`)
              })
            }
          } catch (searchEnhanceErr) {
            console.warn('Aviso ao expandir busca por autor:', searchEnhanceErr)
          }
        }

        if (searchOrs.length > 0) {
          query = query.or(Array.from(new Set(searchOrs)).join(','))
        }
      }

      // 5. Filtro por Usuário Específico
      let userContext: any = null
      let userDevices: any[] = []

      if (filterUserId) {
        if (filterUserType === 'aluno' || (!filterUserType && /^\d+$/.test(filterUserId))) {
          const { data: aluno } = await supabase.from('alunos').select('id, nome, matricula, turma, foto, status').eq('id', filterUserId).maybeSingle()
          if (aluno) {
            userContext = {
              id: String(aluno.id),
              nome: aluno.nome,
              tipo: 'aluno',
              foto: aluno.foto,
              matricula: aluno.matricula,
              turma: aluno.turma,
              status: aluno.status
            }
            const aid = String(aluno.id).trim()
            const parts = aluno.nome.trim().split(/\s+/).filter(Boolean)
            const friendlyName = (parts[0].length <= 3 && parts.length > 1) ? `${parts[0]} ${parts[1]}` : parts[0]
            const fullName = aluno.nome.trim()

            const studentOrConditions = [
              `item_id.ilike.%aluno_${aid}%`,
              `item_id.ilike.%-${aid}%`,
              `item_id.ilike.%_${aid}%`,
              `item_id.ilike.%FREQ-${aid}%`,
              `item_id.ilike.%saida_%-${aid}%`,
              `target_url.ilike.%/${aid}/%`,
              `target_url.ilike.%/${aid}?%`,
              `target_url.ilike.%/${aid}`,
              `target_url.ilike.%aluno_id=${aid}%`,
              `message.ilike.%${fullName}%`
            ]

            if (friendlyName.length >= 4) {
              studentOrConditions.push(`message.ilike.% de ${friendlyName} %`)
              studentOrConditions.push(`message.ilike.% para ${friendlyName} %`)
              studentOrConditions.push(`message.ilike.% de ${friendlyName}.%`)
              studentOrConditions.push(`message.ilike.% de ${friendlyName}:%`)
              studentOrConditions.push(`message.ilike.% de ${friendlyName} foi%`)
              studentOrConditions.push(`message.ilike.%turma de ${friendlyName}%`)
            }

            if (aluno.turma) {
              const cleanTurma = String(aluno.turma).replace(/^sync-/, '')
              studentOrConditions.push(`item_id.ilike.%turma_${aluno.turma}%`)
              studentOrConditions.push(`item_id.ilike.%turma_${cleanTurma}%`)
              studentOrConditions.push(`item_id.ilike.%turma_sync-${cleanTurma}%`)
            }

            query = query.or(studentOrConditions.join(','))

            // Buscar responsáveis do aluno para trazer os aparelhos vinculados
            const { data: vinculos } = await supabase.from('aluno_responsavel').select('responsavel_id').eq('aluno_id', String(aluno.id))
            const respIds = (vinculos || []).map((v: any) => String(v.responsavel_id)).filter(Boolean)
            if (respIds.length > 0) {
              const { data: rData } = await supabase.from('responsaveis').select('id, nome, email').in('id', respIds)
              const devicesArr = await Promise.all(
                (rData || []).map(r => fetchDevicesForGuardian({ responsavel_id: r.id, email: r.email }))
              )
              userDevices = devicesArr.flat()
            }
          }
        } else if (filterUserType === 'colaborador') {
          const isColabUuid = isUUID(filterUserId)
          const colabFilter = isColabUuid ? `id.eq.${filterUserId},auth_id.eq.${filterUserId}` : `id.eq.${filterUserId}`
          const { data: colab } = await supabase.from('system_users').select('id, nome, email, cargo, perfil, auth_id, dados').or(colabFilter).maybeSingle()
          if (colab) {
            let resolvedColabAuthId = colab.auth_id || null
            if (!resolvedColabAuthId && colab.email) {
              try {
                const authList = await getAllAuthUsersCached()
                const cleanColabEmail = String(colab.email).toLowerCase().trim()
                const matchedAu = authList.find((u: any) => String(u.email || '').toLowerCase().trim() === cleanColabEmail)
                if (matchedAu?.id) resolvedColabAuthId = String(matchedAu.id)
              } catch {}
            }

            userContext = {
              id: String(colab.id),
              authId: resolvedColabAuthId,
              nome: colab.nome,
              tipo: 'colaborador',
              cargo: colab.cargo,
              perfil: colab.perfil,
              email: colab.email,
              foto: colab.dados?.foto || null
            }
            const colabId = String(colab.id).trim()
            const colabAuth = resolvedColabAuthId || colabId
            const colabFullName = colab.nome.trim()
            const colabParts = colabFullName.split(/\s+/).filter(Boolean)
            const colabFriendly = colabParts.length > 1 ? `${colabParts[0]} ${colabParts[1]}` : colabParts[0]

            const colabConditions = [
              `item_id.ilike.%${colabId}%`,
              `user_id.eq.${colabAuth}`,
              `user_id.eq.${colabId}`,
              `message.ilike.%${colabFullName}%`
            ]
            if (colabFriendly.length >= 4) {
              colabConditions.push(`message.ilike.%${colabFriendly}%`)
            }

            try {
              const { data: colabOcs } = await supabase
                .from('ocorrencias')
                .select('id')
                .or(`dados->>responsavel.ilike.%${colabFullName}%,dados->>responsavel.ilike.%${colabFriendly}%`)
                .limit(30)
              for (const oc of colabOcs || []) {
                if (oc.id) colabConditions.push(`item_id.ilike.${oc.id}%`)
              }
            } catch {}

            query = query.or(Array.from(new Set(colabConditions)).join(','))

            userDevices = await fetchDevicesForGuardian({
              authId: resolvedColabAuthId,
              system_user_id: String(colab.id),
              colaborador_id: String(colab.id),
              email: colab.email
            })
          }
        } else if (filterUserType === 'responsavel') {
          const { data: resp } = await supabase.from('responsaveis').select('id, nome, email, telefone, celular, dados').eq('id', filterUserId).maybeSingle()
          if (resp) {
            const { data: vinculos } = await supabase.from('aluno_responsavel').select('aluno_id').eq('responsavel_id', resp.id)
            const alunoIds = (vinculos || []).map((v: any) => String(v.aluno_id)).filter(Boolean)
            userContext = {
              id: String(resp.id),
              nome: resp.nome,
              tipo: 'responsavel',
              email: resp.email,
              telefone: resp.telefone || resp.celular,
              alunoIds
            }
            userDevices = await fetchDevicesForGuardian({
              responsavel_id: resp.id,
              email: resp.email
            })

            if (alunoIds.length > 0) {
              const alunoOrConditions = alunoIds.flatMap(aid => [
                `item_id.ilike.%aluno_${aid}%`,
                `item_id.ilike.%-${aid}%`,
                `item_id.ilike.%FREQ-${aid}%`,
                `target_url.ilike.%/${aid}/%`,
                `target_url.ilike.%/${aid}?%`,
                `target_url.ilike.%/${aid}`
              ]).join(',')
              query = query.or(alunoOrConditions)
            }
          }
        }
      }

      // Ordenar e Paginar
      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data: rawLogs, count: totalCount, error: logsError } = await query

      if (logsError) {
        return NextResponse.json({ error: logsError.message }, { status: 400 })
      }

      // Se houver filtro por responsável específico, remover disparos direcionados exclusivamente a OUTRO responsável do mesmo aluno
      let logs = rawLogs || []
      if (filterUserId && filterUserType === 'responsavel' && userContext) {
        const respIdStr = String(userContext.id).trim().toLowerCase()
        const respIdClean = respIdStr.replace(/^0+/, '')
        const respEmail = String(userContext.email || '').trim().toLowerCase()
        const allowedTokens = new Set([respIdStr, respIdClean, respEmail].filter(Boolean))

        try {
          const authUsersList = await getAllAuthUsersCached()
          authUsersList.forEach((u: any) => {
            const uEmail = (u.email || u.user_metadata?.email || '').toLowerCase().trim()
            const uMetaResp = String(u.user_metadata?.responsavel_id || u.user_metadata?.responsavelId || '').trim().toLowerCase()
            if ((respEmail && uEmail === respEmail) || (uMetaResp && (uMetaResp === respIdStr || uMetaResp.replace(/^0+/, '') === respIdClean))) {
              allowedTokens.add(String(u.id).toLowerCase())
            }
          })
        } catch {}

        logs = logs.filter((l: any) => {
          try {
            const p = typeof l.onesignal_response === 'string' ? JSON.parse(l.onesignal_response) : l.onesignal_response
            const explicitResps: any[] | null = Array.isArray(p?._metadata?.responsavel_ids) ? p._metadata.responsavel_ids : null
            if (explicitResps && explicitResps.length > 0) {
              return explicitResps.some(id => {
                const s = String(id || '').trim().toLowerCase()
                return allowedTokens.has(s) || allowedTokens.has(s.replace(/^0+/, ''))
              })
            }
            const targetIds: any[] | null = Array.isArray(p?._target_user_ids) ? p._target_user_ids : null
            if (targetIds && targetIds.length > 0) {
              return targetIds.some(id => {
                const s = String(id || '').trim().toLowerCase()
                return allowedTokens.has(s) || allowedTokens.has(s.replace(/^0+/, ''))
              })
            }
          } catch {}
          return true
        })
      }

      // 1. Mapeamento de candidatos para busca de leitura (Notification Center)
      const logCandidateMap = new Map<string, string[]>()
      const allCandidateIds = new Set<string>()

      ;(logs || []).forEach((l: any) => {
        const cands = extractLogCandidateReadIds(l)
        logCandidateMap.set(l.id, cands)
        cands.forEach(cid => allCandidateIds.add(cid))
      })

      const readsMap: Record<string, { read_at: string; usuario_id: string; perfil: string }> = {}
      if (allCandidateIds.size > 0) {
        const { data: reads } = await supabase.from('agenda_notification_reads')
          .select('content_id, read_at, usuario_id, perfil')
          .in('content_id', Array.from(allCandidateIds))

        if (reads) {
          reads.forEach((r: any) => {
            readsMap[r.content_id] = r
          })
        }
      }

      // Para mensagens de chat, também verificar leitura em chat_messages
      const chatMessageIds = (logs || [])
        .filter((l: any) => l.type === 'chat')
        .map((l: any) => {
          try {
            const p = typeof l.onesignal_response === 'string' ? JSON.parse(l.onesignal_response) : l.onesignal_response
            return p?._metadata?.message_id
          } catch {
            return null
          }
        })
        .filter(Boolean)

      if (chatMessageIds.length > 0) {
        const { data: readChatMsgs } = await supabase
          .from('chat_messages')
          .select('id, status, updated_at')
          .in('id', chatMessageIds)
          .eq('status', 'read')

        if (readChatMsgs) {
          readChatMsgs.forEach((m: any) => {
            readsMap[m.id] = {
              read_at: m.updated_at,
              usuario_id: 'destinatario',
              perfil: 'destinatario'
            }
          })
        }
      }

      // 2. Resolução semântica de destinatários em lote (Alunos e Responsáveis)
      const batchAlunoIds = Array.from(new Set(
        (logs || []).map((l: any) => extractLogStudentId(l)).filter(Boolean) as string[]
      ))

      interface GuardianLookupItem {
        id: string
        idClean: string
        nome: string
        email?: string
        candidateTokens: string[]
      }

      const studentLookup = new Map<string, { nome: string; turma?: string; resps: GuardianLookupItem[] }>()

      if (batchAlunoIds.length > 0) {
        const expandedBatchAlunoIds = Array.from(new Set([
          ...batchAlunoIds,
          ...batchAlunoIds.map(id => id.replace(/^0+/, '')),
          ...batchAlunoIds.map(id => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
        ].filter(Boolean)))

        const [{ data: alunosData }, { data: vinculosData }] = await Promise.all([
          supabase.from('alunos').select('id, nome, matricula, turma').in('id', expandedBatchAlunoIds),
          supabase.from('aluno_responsavel').select('aluno_id, responsavel_id').in('aluno_id', expandedBatchAlunoIds)
        ])

        const rawRespIds = Array.from(new Set((vinculosData || []).map((v: any) => String(v.responsavel_id).trim()).filter(Boolean)))
        const expandedBatchRespIds = Array.from(new Set([
          ...rawRespIds,
          ...rawRespIds.map(id => id.replace(/^0+/, '')),
          ...rawRespIds.map(id => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
        ].filter(Boolean)))

        let respsData: any[] = []
        if (expandedBatchRespIds.length > 0) {
          const { data: rList } = await supabase.from('responsaveis').select('id, nome, email, dados').in('id', expandedBatchRespIds)
          respsData = rList || []
        }

        let authUsersList: any[] = []
        try {
          authUsersList = await getAllAuthUsersCached()
        } catch {}

        const respMap = new Map<string, GuardianLookupItem>()
        respsData.forEach((r: any) => {
          const rId = String(r.id).trim()
          const rIdClean = rId.replace(/^0+/, '')
          const rEmail = (r.email || '').toLowerCase().trim()
          const tokens = new Set<string>([rId.toLowerCase(), rIdClean.toLowerCase()])
          if (rEmail) tokens.add(rEmail)
          if (r.dados?.auth_id) tokens.add(String(r.dados.auth_id).toLowerCase())

          authUsersList.forEach((u: any) => {
            const uEmail = (u.email || u.user_metadata?.email || '').toLowerCase().trim()
            const uMetaResp = String(u.user_metadata?.responsavel_id || u.user_metadata?.responsavelId || '').trim()
            if ((rEmail && uEmail === rEmail) || (uMetaResp && (uMetaResp === rId || uMetaResp.replace(/^0+/, '') === rIdClean))) {
              tokens.add(String(u.id).toLowerCase())
            }
          })

          const item: GuardianLookupItem = {
            id: rId,
            idClean: rIdClean,
            nome: r.nome || 'Responsável',
            email: r.email,
            candidateTokens: Array.from(tokens).filter(Boolean),
          }
          respMap.set(rId, item)
          respMap.set(rIdClean, item)
        })

        ;(alunosData || []).forEach((a: any) => {
          const aId = String(a.id).trim()
          const aIdClean = aId.replace(/^0+/, '')
          const linkedRespIds = Array.from(new Set(
            (vinculosData || [])
              .filter((v: any) => {
                const vAid = String(v.aluno_id).trim()
                return vAid === aId || vAid.replace(/^0+/, '') === aIdClean
              })
              .map((v: any) => String(v.responsavel_id).trim())
          ))
          const resps = linkedRespIds
            .map(rid => respMap.get(rid) || respMap.get(rid.replace(/^0+/, '')))
            .filter(Boolean) as GuardianLookupItem[]

          const entry = {
            nome: a.nome,
            turma: a.turma,
            resps,
          }
          studentLookup.set(aId, entry)
          studentLookup.set(aIdClean, entry)
        })
      }

      // 3. Resolução semântica de quem enviou (Remetente / Autor / Sistema) em lote
      const sendersMap = await batchResolveSenders(logs || [], supabase)

      // 4. Enriquecer logs com indicador de leitura, telemetria, remetente e resumo de destinatários
      const enrichedLogs = (logs || []).map((log: any) => {
        let parsed: any = null
        let oneSignalId = null
        let oneSignalErrors = null
        let sendAfter: string | null = null
        let isReminder = Boolean(log.item_id?.includes('-reminder') || log.title?.toLowerCase().includes('lembrete'))
        let eventDate: string | null = null

        try {
          if (log.onesignal_response) {
            parsed = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
            oneSignalId = parsed?.id || null
            oneSignalErrors = parsed?.errors || null
            sendAfter = parsed?._send_after || parsed?._metadata?.send_after || null
            eventDate = parsed?._metadata?.data || null
            if (parsed?._metadata?.is_reminder) isReminder = true
          }
        } catch {}

        if (isReminder && !sendAfter && eventDate) {
          try {
            const evDate = new Date(`${eventDate}T12:00:00Z`)
            evDate.setUTCDate(evDate.getUTCDate() - 1)
            sendAfter = `${evDate.toISOString().split('T')[0]} 20:00:00 GMT-0400`
          } catch {}
        }

        // Encontrar leitura por qualquer um dos candidate IDs do log
        const cands = logCandidateMap.get(log.id) || [log.item_id]
        let matchedRead: any = null
        for (const cid of cands) {
          if (readsMap[cid]) {
            matchedRead = readsMap[cid]
            break
          }
        }

        const meta = parsed?._metadata || null
        const savedTargetDetails: any[] | null = Array.isArray(parsed?._target_details)
          ? parsed._target_details
          : (Array.isArray(meta?.target_details) ? meta.target_details : null)
        const recordedTargetSet = new Set<string>(
          Array.isArray(parsed?._target_user_ids)
            ? parsed._target_user_ids.flatMap((id: any) => {
                const s = String(id || '').trim().toLowerCase()
                return [s, s.replace(/^0+/, '')]
              }).filter(Boolean)
            : []
        )

        // Resumo de destinatários
        const aId = extractLogStudentId(log)
        let recipient_summary = `${log.target_count || 1} destinatário(s)`
        let recipients_preview: { nome: string; tipo: string }[] = []
        let resolved_target_count = log.target_count || 1

        if (aId && (studentLookup.has(aId) || studentLookup.has(aId.replace(/^0+/, '')))) {
          const stu = (studentLookup.get(aId) || studentLookup.get(aId.replace(/^0+/, '')))!
          const parts = stu.nome.trim().split(/\s+/).filter(Boolean)
          const friendlyStudent = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0]

          let targetedResps = stu.resps
          if (Array.isArray(meta?.responsavel_ids)) {
            const explicitSet = new Set(
              meta.responsavel_ids.flatMap((id: any) => {
                const s = String(id || '').trim().toLowerCase()
                return [s, s.replace(/^0+/, '')]
              }).filter(Boolean)
            )
            targetedResps = stu.resps.filter(r =>
              explicitSet.has(r.id.toLowerCase()) || explicitSet.has(r.idClean.toLowerCase())
            )
          } else if (savedTargetDetails && savedTargetDetails.some((d: any) => d.tipo === 'responsavel')) {
            const savedSet = new Set(
              savedTargetDetails
                .filter((d: any) => d.tipo === 'responsavel')
                .flatMap((d: any) => {
                  const s = String(d.id || '').trim().toLowerCase()
                  return [s, s.replace(/^0+/, '')]
                }).filter(Boolean)
            )
            targetedResps = stu.resps.filter(r =>
              savedSet.has(r.id.toLowerCase()) || savedSet.has(r.idClean.toLowerCase())
            )
          } else if (recordedTargetSet.size > 0) {
            const matched = stu.resps.filter(r =>
              r.candidateTokens.some(tok => recordedTargetSet.has(tok))
            )
            if (matched.length > 0) {
              targetedResps = matched
            }
          }

          const numTargeted = targetedResps.length
          const totalLinked = stu.resps.length
          const includeAlunoDirect = Boolean(
            meta?.include_aluno_direct === true ||
            (savedTargetDetails && savedTargetDetails.some((d: any) => d.tipo === 'aluno'))
          )

          resolved_target_count = (numTargeted + (includeAlunoDirect ? 1 : 0)) || 1

          if (numTargeted === 1 && totalLinked > 1) {
            const respFirstParts = targetedResps[0].nome.trim().split(/\s+/).filter(Boolean)
            const friendlyResp = respFirstParts.length > 1 ? `${respFirstParts[0]} ${respFirstParts[1]}` : respFirstParts[0]
            recipient_summary = `${friendlyResp} • ${friendlyStudent}`
          } else if (numTargeted > 1 && numTargeted < totalLinked) {
            recipient_summary = `${friendlyStudent} (${numTargeted} de ${totalLinked} resp.)`
          } else if (numTargeted > 0) {
            recipient_summary = `${friendlyStudent} (${numTargeted} resp.)`
          } else {
            recipient_summary = friendlyStudent
          }

          recipients_preview = [
            ...targetedResps.map(r => ({ nome: r.nome, tipo: 'responsavel' })),
            ...(includeAlunoDirect || numTargeted === 0 ? [{ nome: stu.nome, tipo: 'aluno' }] : [])
          ]
        } else if (savedTargetDetails && savedTargetDetails.length > 0) {
          resolved_target_count = savedTargetDetails.length
          if (savedTargetDetails.length === 1) {
            recipient_summary = savedTargetDetails[0].nome || '1 destinatário'
          } else {
            recipient_summary = `${savedTargetDetails[0].nome} (+${savedTargetDetails.length - 1})`
          }
          recipients_preview = savedTargetDetails.map((d: any) => ({
            nome: d.nome || 'Destinatário',
            tipo: d.tipo || 'colaborador'
          }))
        } else if (log.item_id?.includes('colaborador') || log.target_url?.includes('/colaborador/') || meta?.colaborador_id) {
          recipient_summary = `Equipe Escolar (${log.target_count || 1} alvos)`
          recipients_preview = [{ nome: 'Equipe de Colaboradores', tipo: 'colaborador' }]
        } else if (log.type === 'chat') {
          const metaTitle = meta?.conversation_title || ''
          const metaRecipient = meta?.recipient_name || ''
          const displayName = metaRecipient || metaTitle || 'Participante do Chat'
          resolved_target_count = 1
          recipient_summary = displayName
          recipients_preview = [{ nome: displayName, tipo: 'chat' }]
        }

        return {
          ...log,
          target_count: resolved_target_count,
          resolved_target_count,
          aliases_count: recordedTargetSet.size || log.target_count || 1,
          sender: sendersMap.get(log.id) || null,
          oneSignalId,
          oneSignalErrors,
          isRead: Boolean(matchedRead),
          readAt: matchedRead?.read_at || null,
          readBy: matchedRead?.usuario_id || null,
          recipient_summary,
          recipients_preview,
          sendAfter,
          isReminder,
          eventDate,
        }
      })

      const total = filterUserId && filterUserType === 'responsavel' ? enrichedLogs.length : (totalCount || 0)
      const totalPages = Math.ceil(total / limit)

      return NextResponse.json({
        logs: enrichedLogs,
        total,
        page,
        limit,
        totalPages,
        userContext,
        userDevices,
      })
    }

    // 2.1 Consulta de aparelhos conectados para um usuário específico
    const userForDevices = searchParams.get('devicesForUser')
    if (userForDevices) {
      const isEmail = userForDevices.includes('@')
      let devices = await fetchOneSignalUserDevices(userForDevices, isEmail ? 'email' : 'external_id')
      if (devices.length === 0 && !isEmail) {
        devices = await fetchOneSignalUserDevices(userForDevices, 'responsavel_id')
      }
      if (devices.length === 0 && !isEmail) {
        devices = await fetchOneSignalUserDevices(userForDevices, 'aluno_id')
      }
      if (devices.length === 0 && !isEmail) {
        devices = await fetchOneSignalUserDevices(userForDevices, 'colaborador_id')
      }
      if (devices.length === 0 && !isEmail) {
        devices = await fetchOneSignalUserDevices(userForDevices, 'system_user_id')
      }
      return NextResponse.json({
        user: userForDevices,
        dispositivos: devices,
        totalDispositivos: devices.length,
        dispositivosAtivos: devices.filter((d: any) => d.isSubscribed).length,
      })
    }

    // 2.2 Lista de colaboradores para o dropdown / autocomplete de teste
    if (wantColaboradores) {
      const { data: rawUsers, error: usersErr } = await supabase
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status, dados, auth_id')
        .order('nome', { ascending: true })

      if (usersErr) {
        return NextResponse.json({ error: usersErr.message }, { status: 400 })
      }

      const masterRoles = ['administrador master', 'administrador', 'admin', 'diretor geral', 'diretora geral', 'master']
      const mapped = (rawUsers || []).map((u: any) => {
        const cargoLower = String(u.cargo || '').toLowerCase().trim()
        const perfilLower = String(u.perfil || '').toLowerCase().trim()
        const isMaster = masterRoles.includes(cargoLower) || masterRoles.includes(perfilLower) || String(u.nome || '').toLowerCase().includes('ivan rossi')
        const isInstitucional = isMaster || ['Direção', 'Diretor Geral', 'Administrador'].includes(u.perfil)

        return {
          id: String(u.id),
          nome: u.nome || 'Colaborador',
          email: (u.email || '').trim().toLowerCase(),
          cargo: u.cargo || 'Não definido',
          perfil: u.perfil || 'Colaborador',
          status: u.status || 'ativo',
          foto: u.foto || u.dados?.foto || null,
          auth_id: u.auth_id || null,
          isMaster,
          isInstitucional,
        }
      })

      // Ordenar: Master admins e Institucional primeiro, depois ordem alfabética
      mapped.sort((a, b) => {
        if (a.isMaster && !b.isMaster) return -1
        if (!a.isMaster && b.isMaster) return 1
        if (a.isInstitucional && !b.isInstitucional) return -1
        if (!a.isInstitucional && b.isInstitucional) return 1
        return a.nome.localeCompare(b.nome)
      })

      return NextResponse.json({ colaboradores: mapped })
    }

    // 2.3 Inspeção detalhada de um Colaborador / Administrador e seus aparelhos no OneSignal
    if (colaboradorId) {
      const cleanColabId = colaboradorId.trim()
      const colabIsUuid = isUUID(cleanColabId)
      const colabFilter = colabIsUuid
        ? `id.eq.${cleanColabId},auth_id.eq.${cleanColabId},email.eq.${cleanColabId}`
        : `id.eq.${cleanColabId},email.eq.${cleanColabId}`

      let { data: userRow } = await supabase
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status, dados, auth_id')
        .or(colabFilter)
        .maybeSingle()

      // Fallback: se não encontrou e tem @, busca por email
      if (!userRow && cleanColabId.includes('@')) {
        const { data: rowByEmail } = await supabase
          .from('system_users')
          .select('id, nome, email, cargo, perfil, status, dados, auth_id')
          .ilike('email', cleanColabId)
          .maybeSingle()
        if (rowByEmail) userRow = rowByEmail
      }

      if (!userRow) {
        return NextResponse.json({ error: 'Colaborador / Usuário não encontrado no banco de dados.' }, { status: 404 })
      }

      const masterRoles = ['administrador master', 'administrador', 'admin', 'diretor geral', 'diretora geral', 'master']
      const cargoLower = String(userRow.cargo || '').toLowerCase().trim()
      const perfilLower = String(userRow.perfil || '').toLowerCase().trim()
      const isMaster = masterRoles.includes(cargoLower) || masterRoles.includes(perfilLower) || String(userRow.nome || '').toLowerCase().includes('ivan rossi')
      const isInstitucional = isMaster || ['Direção', 'Diretor Geral', 'Administrador'].includes(userRow.perfil)

      const devices = await fetchDevicesForGuardian({
        authId: userRow.auth_id || (colabIsUuid ? cleanColabId : null),
        system_user_id: String(userRow.id),
        colaborador_id: String(userRow.id),
        email: userRow.email,
      })

      const ativos = devices.filter((d: any) => d.isSubscribed).length

      // Buscar logs recentes específicos deste colaborador
      const { data: recentLogs } = await supabase
        .from('agenda_push_logs')
        .select('*')
        .or(`item_id.ilike.%${userRow.id}%,user_id.eq.${userRow.auth_id || userRow.id},message.ilike.%${userRow.nome}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      return NextResponse.json({
        colaborador: {
          id: String(userRow.id),
          nome: userRow.nome,
          email: userRow.email,
          cargo: userRow.cargo || 'Não definido',
          perfil: userRow.perfil || 'Colaborador',
          status: userRow.status || 'ativo',
          foto: (userRow as any).foto || userRow.dados?.foto || null,
          auth_id: userRow.auth_id || null,
          isMaster,
          isInstitucional,
        },
        dispositivos: devices,
        totalDispositivos: devices.length,
        dispositivosAtivos: ativos,
        recentLogs: recentLogs || [],
      })
    }

    // 3. Inspeção do Aluno e Responsáveis
    if (alunoId) {
      const cleanAlunoId = alunoId.trim()

      // Buscar aluno
      const isCleanUuid = isUUID(cleanAlunoId)
      const { data: aluno, error: alunoErr } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, foto, dados, responsavel, responsavel_financeiro, responsavel_pedagogico')
        .or(isCleanUuid ? `id.eq.${cleanAlunoId},matricula.eq.${cleanAlunoId}` : `matricula.eq.${cleanAlunoId}`)
        .maybeSingle()

      if (alunoErr || !aluno) {
        return NextResponse.json({ error: 'Aluno não encontrado no banco de dados.' }, { status: 404 })
      }

      // Buscar turma para nome amigável
      let turmaNome = aluno.turma || 'Ensino Regular'
      if (aluno.turma) {
        const { data: turmaData } = await supabase
          .from('turmas')
          .select('nome, codigo')
          .eq('id', aluno.turma)
          .maybeSingle()
        if (turmaData?.nome) turmaNome = turmaData.nome
      }

      // Buscar vínculos em aluno_responsavel
      const searchAlunoIds = Array.from(new Set([
        String(aluno.id),
        String(aluno.id).replace(/^0+/, ''),
        aluno.matricula ? String(aluno.matricula) : '',
        aluno.matricula ? String(aluno.matricula).replace(/^0+/, '') : '',
        !isNaN(Number(aluno.id)) ? String(Number(aluno.id)).padStart(6, '0') : ''
      ].filter(Boolean)))

      const { data: vinculos } = await supabase
        .from('aluno_responsavel')
        .select('*')
        .in('aluno_id', searchAlunoIds)

      const respIds = (vinculos || []).map((v: any) => String(v.responsavel_id)).filter(Boolean)
      const expandedRespIds = Array.from(new Set([
        ...respIds,
        ...respIds.map(id => id.replace(/^0+/, '')),
        ...respIds.map(id => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
      ].filter(Boolean)))

      // Buscar dados de responsaveis (atenção: tabela não tem coluna cpf)
      let responsaveisList: any[] = []
      let resps: any[] = []
      if (expandedRespIds.length > 0) {
        const { data: rData, error: rErr } = await supabase
          .from('responsaveis')
          .select('id, nome, email, telefone, celular, dados')
          .in('id', expandedRespIds)

        if (rData) resps = rData
        if (rErr) console.warn('[API Push Test] Erro ao buscar responsaveis:', rErr.message)
      }

      // 1. Buscar se existem contas em system_users para esses responsáveis
      const { data: sysUsers } = await supabase
        .from('system_users')
        .select('id, auth_id, email, nome, ultimoacesso, created_at, dados')
        .limit(2000)

      // 2. Buscar usuários do Supabase Auth para verificar contas ativas dos responsáveis
      let authUsers: any[] = []
      try {
        authUsers = await getAllAuthUsersCached()
      } catch (authErr: any) {
        console.warn('[API Push Test GET] Erro ao listar auth.users:', authErr.message)
      }

      responsaveisList = (vinculos || []).map((v: any) => {
        const vIdStr = String(v.responsavel_id).trim()
        const vIdClean = vIdStr.replace(/^0+/, '')
        const rInfo: any = (resps || []).find((r: any) => {
          const rIdStr = String(r.id).trim()
          return rIdStr === vIdStr || rIdStr.replace(/^0+/, '') === vIdClean
        }) || {}
        const rEmail = (rInfo.email || '').toLowerCase().trim()

        // Match no system_users por responsavel_id, email ou auth_id
        const sysUser = (sysUsers || []).find((u: any) => {
          const uRespId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
          const uEmail = (u.email || '').toLowerCase().trim()
          return (uRespId && (uRespId === vIdStr || uRespId.replace(/^0+/, '') === vIdClean)) || (rEmail && uEmail === rEmail)
        })

        const rPhoneDigits = (rInfo.telefone || rInfo.celular || '').replace(/\D/g, '').slice(-8)
        const rCpfDigits = (rInfo.dados?.cpf || rInfo.cpf || '').replace(/\D/g, '')

        // Match no Supabase Auth por email, responsavel_id nos metadados, telefone ou CPF
        const authUser = (authUsers || []).find((u: any) => {
          const uEmail = (u.email || u.user_metadata?.email || '').toLowerCase().trim()
          const uMetaRespId = String(u.user_metadata?.responsavel_id || u.user_metadata?.responsavelId || '').trim()
          const uPhoneDigits = (u.phone || u.user_metadata?.telefone || u.user_metadata?.celular || '').replace(/\D/g, '').slice(-8)
          const uCpfDigits = (u.user_metadata?.cpf || '').replace(/\D/g, '')
          return (rEmail && uEmail === rEmail) ||
                 (uMetaRespId && (uMetaRespId === vIdStr || uMetaRespId.replace(/^0+/, '') === vIdClean)) ||
                 (rPhoneDigits.length >= 8 && uPhoneDigits.length >= 8 && rPhoneDigits === uPhoneDigits) ||
                 (rCpfDigits.length >= 11 && uCpfDigits.length >= 11 && rCpfDigits === uCpfDigits)
        })

        const temContaAtiva = Boolean(sysUser || authUser)
        const resolvedAuthId = authUser?.id || sysUser?.auth_id || (sysUser ? sysUser.id : null)
        const resolvedUltimoAcesso = authUser?.last_sign_in_at || sysUser?.ultimoacesso || sysUser?.dados?.ultimo_acesso || null

        // NUNCA exibir ID puro — resolver nome real ou papel
        let resolvedNome = (rInfo.nome || '').trim()
        if (!resolvedNome && authUser?.user_metadata?.nome) resolvedNome = String(authUser.user_metadata.nome).trim()
        if (!resolvedNome && sysUser?.nome) resolvedNome = sysUser.nome.trim()
        if (!resolvedNome && sysUser?.dados?.nome) resolvedNome = String(sysUser.dados.nome).trim()
        if (!resolvedNome && v.resp_financeiro && (aluno as any).responsavel_financeiro) {
          resolvedNome = String((aluno as any).responsavel_financeiro).trim()
        }
        if (!resolvedNome && (v.parentesco === 'mae' || !v.parentesco) && (aluno as any).responsavel) {
          resolvedNome = String((aluno as any).responsavel).trim()
        }
        if (!resolvedNome && (aluno as any).responsavel_pedagogico) {
          resolvedNome = String((aluno as any).responsavel_pedagogico).trim()
        }
        if (!resolvedNome && (aluno.dados?.mae_nome || aluno.dados?.responsavel)) {
          resolvedNome = String(aluno.dados?.mae_nome || aluno.dados?.responsavel).trim()
        }
        if (!resolvedNome) {
          resolvedNome = v.parentesco ? `Responsável (${v.parentesco})` : 'Responsável Legal'
        }

        return {
          responsavel_id: vIdStr,
          nome: resolvedNome,
          email: rInfo.email || sysUser?.email || authUser?.email || null,
          telefone: rInfo.telefone || rInfo.celular || null,
          parentesco: v.parentesco || (v.resp_financeiro ? 'Financeiro' : 'Responsável'),
          isFinanceiro: Boolean(v.resp_financeiro),
          isPedagogico: Boolean(v.resp_pedagogico),
          isOutro: Boolean(v.resp_outro),
          systemUserId: sysUser?.id || null,
          authId: resolvedAuthId,
          temContaAtiva,
          ultimoAcesso: resolvedUltimoAcesso,
        }
      })

      // Se não havia vínculos em aluno_responsavel, mas o aluno possui responsavel cadastrado na tabela alunos
      if (responsaveisList.length === 0) {
        if ((aluno as any).responsavel) {
          responsaveisList.push({
            responsavel_id: `resp-cad-${aluno.id}`,
            nome: String((aluno as any).responsavel).trim(),
            email: aluno.dados?.email_responsavel || null,
            telefone: aluno.dados?.telefone_responsavel || null,
            parentesco: 'Responsável Pedagógico',
            isFinanceiro: false,
            isPedagogico: true,
            isOutro: false,
            systemUserId: null,
            authId: null,
            temContaAtiva: false,
            ultimoAcesso: null,
          })
        }
        if ((aluno as any).responsavel_financeiro && (aluno as any).responsavel_financeiro !== (aluno as any).responsavel) {
          responsaveisList.push({
            responsavel_id: `resp-fin-${aluno.id}`,
            nome: String((aluno as any).responsavel_financeiro).trim(),
            email: aluno.dados?.email_financeiro || null,
            telefone: aluno.dados?.telefone_financeiro || null,
            parentesco: 'Responsável Financeiro',
            isFinanceiro: true,
            isPedagogico: false,
            isOutro: false,
            systemUserId: null,
            authId: null,
            temContaAtiva: false,
            ultimoAcesso: null,
          })
        }
      }

      // 4. Enriquecer cada responsável com seus aparelhos conectados no OneSignal
      const enrichedResponsaveis = await Promise.all(
        responsaveisList.map(async (r: any) => {
          let devices: any[] = []
          try {
            devices = await fetchDevicesForGuardian(r)
          } catch (devErr: any) {
            console.warn(`[Push Test GET] Erro ao buscar dispositivos para ${r.nome}:`, devErr?.message)
          }

          const ativos = devices.filter((d: any) => d.isSubscribed).length
          return {
            ...r,
            dispositivos: devices,
            totalDispositivos: devices.length,
            dispositivosAtivos: ativos,
          }
        })
      )

      // Buscar logs recentes específicos deste aluno
      const { data: recentLogs } = await supabase
        .from('agenda_push_logs')
        .select('*')
        .or(`item_id.ilike.%${aluno.id}%,target_url.ilike.%${aluno.id}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      return NextResponse.json({
        aluno: {
          id: String(aluno.id),
          nome: aluno.nome,
          matricula: aluno.matricula || aluno.id,
          turma: turmaNome,
          turmaId: aluno.turma,
          status: aluno.status,
          foto: aluno.foto || aluno.dados?.foto || null,
        },
        responsaveis: enrichedResponsaveis,
        recentLogs: recentLogs || [],
      })
    }

    return NextResponse.json({ message: 'Parâmetro aluno_id, colaborador_id, colaboradores, logs ou config não especificado.' }, { status: 400 })
  } catch (err: any) {
    console.error('[API Push Test GET] Erro:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao consultar dados.' }, { status: 500 })
  }
}

/**
 * POST /api/agenda/push/test
 *
 * Dispara notificação push de teste para o aluno e seus responsáveis.
 */
export async function POST(request: Request) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const targetSubId = body.targetSubscriptionId || body.targetSubscriptionIds?.[0]
  let authUser: any = null

  if (targetSubId) {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse || !user) {
      return errorResponse || NextResponse.json({ error: 'Não autorizado para teste de dispositivo.' }, { status: 401 })
    }
    authUser = user
  } else {
    const auth = await verifyAdminAuth()
    if (!auth.authorized) return auth.errorResponse!
    authUser = auth.user
  }

  const supabase = supabaseServer

  try {
    const {
      alunoId,
      colaboradorId,
      responsavelIds,
      includeAlunoDirect = false,
      type = 'test',
      title,
      message,
      targetUrl,
      targetSubscriptionId,
      metadata = {},
      bypassDedup = true,
      ignoreGlobalConfig = true,
      bypassPause = false,
    } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'O título da notificação é obrigatório.' }, { status: 400 })
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'A mensagem da notificação é obrigatória.' }, { status: 400 })
    }

    let studentData: any = null
    let colabData: any = null
    let resolvedRespIdsForLog: string[] = []
    const targetUserIdsSet = new Set<string>()
    const targetDetails: any[] = []

    // 0. Resolução de Colaborador / Administrador se fornecido
    const effectiveColabId = colaboradorId || body.authId
    if (effectiveColabId) {
      const cleanColab = String(effectiveColabId).trim()
      const colabIsUuid = isUUID(cleanColab)
      const colabFilter = colabIsUuid
        ? `id.eq.${cleanColab},auth_id.eq.${cleanColab},email.eq.${cleanColab}`
        : `id.eq.${cleanColab},email.eq.${cleanColab}`

      let { data: colab } = await supabase
        .from('system_users')
        .select('id, nome, email, cargo, perfil, auth_id')
        .or(colabFilter)
        .maybeSingle()

      if (!colab && cleanColab.includes('@')) {
        const { data: colabByEmail } = await supabase
          .from('system_users')
          .select('id, nome, email, cargo, perfil, auth_id')
          .ilike('email', cleanColab)
          .maybeSingle()
        if (colabByEmail) colab = colabByEmail
      }

      if (body.authId && isUUID(String(body.authId))) {
        targetUserIdsSet.add(String(body.authId).trim())
      }

      if (colab) {
        colabData = colab
        if (colab.id) targetUserIdsSet.add(String(colab.id))
        if (colab.auth_id) targetUserIdsSet.add(String(colab.auth_id))
        if (colab.email) targetUserIdsSet.add(String(colab.email).toLowerCase().trim())

        targetDetails.push({
          tipo: 'colaborador',
          id: String(colab.id),
          nome: colab.nome,
          cargo: colab.cargo || 'Não informado',
          perfil: colab.perfil || 'Colaborador',
          email: colab.email,
          authId: colab.auth_id || null,
          descricao: `${colab.cargo || colab.perfil || 'Colaborador'} (${colab.email || colab.id})`,
        })
      }
    }

    // 1. Resolução do Aluno se fornecido
    if (alunoId) {
      const cleanAlunoId = String(alunoId).trim()
      const isAlUuid = isUUID(cleanAlunoId)
      const { data: st } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, responsavel, responsavel_financeiro, responsavel_pedagogico, dados')
        .or(isAlUuid ? `id.eq.${cleanAlunoId},matricula.eq.${cleanAlunoId}` : `matricula.eq.${cleanAlunoId}`)
        .maybeSingle()

      if (st) {
        studentData = st

        // Incluir o ID do aluno se marcado
        if (includeAlunoDirect) {
          targetUserIdsSet.add(String(st.id))
          if (st.matricula) targetUserIdsSet.add(String(st.matricula))
          targetDetails.push({
            tipo: 'aluno',
            id: String(st.id),
            nome: st.nome,
            descricao: `Acesso do Aluno (${st.matricula || st.id})`,
          })
        }
      }

      // Respeitar estritamente responsavelIds quando enviado como array pelo Simulador
      const hasExplicitRespArray = Array.isArray(responsavelIds)
      let respIdsToQuery = hasExplicitRespArray
        ? responsavelIds.map((id: any) => String(id || '').trim()).filter(Boolean)
        : []

      if (!hasExplicitRespArray) {
        const searchAlunoIds = Array.from(new Set([
          String(st?.id || alunoId),
          String(st?.id || alunoId).replace(/^0+/, ''),
          st?.matricula ? String(st.matricula) : '',
        ].filter(Boolean)))

        const { data: vinculos } = await supabase
          .from('aluno_responsavel')
          .select('responsavel_id, parentesco, resp_financeiro, resp_pedagogico')
          .in('aluno_id', searchAlunoIds)

        if (vinculos && vinculos.length > 0) {
          respIdsToQuery = vinculos.map((v: any) => String(v.responsavel_id)).filter(Boolean)
        }
      }

      if (hasExplicitRespArray && respIdsToQuery.length === 0 && !includeAlunoDirect && !effectiveColabId && !targetSubscriptionId) {
        return NextResponse.json(
          { error: 'Selecione pelo menos um responsável vinculado ou marque a opção de envio direto para o aluno.' },
          { status: 400 }
        )
      }

      resolvedRespIdsForLog = respIdsToQuery

      // Buscar detalhes e contas dos responsáveis selecionados
      if (respIdsToQuery.length > 0) {
        const expandedRespIds = Array.from(new Set([
          ...respIdsToQuery,
          ...respIdsToQuery.map(id => id.replace(/^0+/, '')),
          ...respIdsToQuery.map(id => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
        ].filter(Boolean)))

        const { data: resps } = await supabase
          .from('responsaveis')
          .select('id, nome, email, telefone, celular, dados')
          .in('id', expandedRespIds)

        const { data: sysUsers } = await supabase
          .from('system_users')
          .select('id, auth_id, email, nome, dados')
          .limit(2000)

        // Buscar usuários do Supabase Auth para mapear auth UUID (usando cache)
        let authUsers: any[] = []
        try {
          authUsers = await getAllAuthUsersCached()
        } catch (authErr: any) {
          console.warn('[API Push Test POST] Erro ao listar auth.users:', authErr.message)
        }

        respIdsToQuery.forEach(rId => {
          const rIdStr = String(rId).trim()
          const rIdClean = rIdStr.replace(/^0+/, '')
          targetUserIdsSet.add(rIdStr)

          const rInfo = (resps || []).find((r: any) => {
            const rid = String(r.id).trim()
            return rid === rIdStr || rid.replace(/^0+/, '') === rIdClean
          })
          const rEmail = (rInfo?.email || '').toLowerCase().trim()

          // Adicionar system_user id e auth_id se existirem
          const matchedUser = (sysUsers || []).find((u: any) => {
            const uRespId = String(u.dados?.responsavel_id || u.dados?.responsavelId || '').trim()
            const uEmail = (u.email || '').toLowerCase().trim()
            return (uRespId && (uRespId === rIdStr || uRespId.replace(/^0+/, '') === rIdClean)) ||
                   (rEmail && uEmail === rEmail)
          })

          const rPhoneDigits = (rInfo?.telefone || (rInfo as any)?.celular || '').replace(/\D/g, '').slice(-8)
          const rCpfDigits = ((rInfo as any)?.dados?.cpf || (rInfo as any)?.cpf || '').replace(/\D/g, '')

          const matchedAuthUser = (authUsers || []).find((u: any) => {
            const uEmail = (u.email || u.user_metadata?.email || '').toLowerCase().trim()
            const uMetaRespId = String(u.user_metadata?.responsavel_id || u.user_metadata?.responsavelId || '').trim()
            const uPhoneDigits = (u.phone || u.user_metadata?.telefone || u.user_metadata?.celular || '').replace(/\D/g, '').slice(-8)
            const uCpfDigits = (u.user_metadata?.cpf || '').replace(/\D/g, '')
            return (rEmail && uEmail === rEmail) ||
                   (uMetaRespId && (uMetaRespId === rIdStr || uMetaRespId.replace(/^0+/, '') === rIdClean)) ||
                   (rPhoneDigits.length >= 8 && uPhoneDigits.length >= 8 && rPhoneDigits === uPhoneDigits) ||
                   (rCpfDigits.length >= 11 && uCpfDigits.length >= 11 && rCpfDigits === uCpfDigits)
          })

          if (matchedUser) {
            if (matchedUser.id) targetUserIdsSet.add(String(matchedUser.id))
            if (matchedUser.auth_id) targetUserIdsSet.add(String(matchedUser.auth_id))
          }

          if (matchedAuthUser) {
            targetUserIdsSet.add(String(matchedAuthUser.id))
          }

          if (rEmail) {
            targetUserIdsSet.add(rEmail)
          }

          // Resolver nome amigável real — NUNCA mostrar #ID
          let resolvedNome = (rInfo?.nome || '').trim()
          if (!resolvedNome && matchedAuthUser?.user_metadata?.nome) resolvedNome = String(matchedAuthUser.user_metadata.nome).trim()
          if (!resolvedNome && matchedUser?.nome) resolvedNome = matchedUser.nome.trim()
          if (!resolvedNome && matchedUser?.dados?.nome) resolvedNome = String(matchedUser.dados.nome).trim()
          if (!resolvedNome && st?.responsavel_financeiro && rIdStr.includes('fin')) {
            resolvedNome = String(st.responsavel_financeiro).trim()
          }
          if (!resolvedNome && st?.responsavel) {
            resolvedNome = String(st.responsavel).trim()
          }
          if (!resolvedNome && st?.responsavel_pedagogico) {
            resolvedNome = String(st.responsavel_pedagogico).trim()
          }
          if (!resolvedNome) {
            resolvedNome = 'Responsável Legal'
          }

          targetDetails.push({
            tipo: 'responsavel',
            id: rIdStr,
            nome: resolvedNome,
            email: rInfo?.email || matchedUser?.email || matchedAuthUser?.email || null,
            authId: matchedAuthUser?.id || matchedUser?.auth_id || null,
            systemUserId: matchedUser?.id || null,
            temContaAtiva: Boolean(matchedUser || matchedAuthUser),
          })
        })
      }
    } else if (Array.isArray(responsavelIds) && responsavelIds.length > 0) {
      resolvedRespIdsForLog = responsavelIds.map((id: any) => String(id).trim()).filter(Boolean)
      resolvedRespIdsForLog.forEach(id => targetUserIdsSet.add(id))
    }

    // Se nenhum destinatário for encontrado, adicionar o ID do admin para teste de envio
    if (targetUserIdsSet.size === 0 && !targetSubscriptionId) {
      const adminId = String(authUser.id)
      targetUserIdsSet.add(adminId)
      targetDetails.push({
        tipo: 'admin_fallback',
        id: adminId,
        nome: (authUser as any).nome || 'Administrador (Auto-teste)',
        descricao: 'Nenhum responsável encontrado para o aluno; teste redirecionado para o seu usuário.',
      })
    }

    const cleanTargetIds = Array.from(targetUserIdsSet).filter(Boolean)
    const humanTargetCount = targetDetails.length || 1

    // Formatar texto com formatFriendlyStudentName exatamente como a Agenda Digital real
    const rawNomeAlvo = colabData?.nome || studentData?.nome || 'Destinatário'
    const nomeAlvo = colabData?.nome ? colabData.nome : (studentData?.nome ? formatFriendlyStudentName(studentData.nome) : 'Destinatário')
    const matriculaAlvo = studentData?.matricula || (colabData ? (colabData.cargo || colabData.perfil || '') : '')
    const turmaAlvo = colabData ? (colabData.cargo || colabData.perfil || 'Equipe Escolar') : (studentData?.turma || '')
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' })

    const finalTitle = title
      .replace(/{aluno}/gi, nomeAlvo)
      .replace(/{turma}/gi, turmaAlvo)
      .replace(/{hora}/gi, agoraHora)

    const finalMessage = message
      .replace(/{aluno}/gi, nomeAlvo)
      .replace(/{turma}/gi, turmaAlvo)
      .replace(/{matricula}/gi, matriculaAlvo)
      .replace(/{hora}/gi, agoraHora)

    // Gerar item_id único para testes (evita bloqueio pela deduplicação)
    const uniqueTestId = bypassDedup
      ? `test-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      : `test-${type}-${colabData?.id || alunoId || 'general'}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resilient-cuchufli-2b4125.netlify.app'
    let resolvedTargetUrl = targetUrl || `/agenda-digital${studentData?.id ? `/${studentData.id}` : ''}`
    if (studentData?.id) {
      resolvedTargetUrl = resolvedTargetUrl.replace(/{alunoId}/gi, String(studentData.id))
    }
    const finalTargetUrl = resolvedTargetUrl.startsWith('http')
      ? resolvedTargetUrl
      : `${appUrl}${resolvedTargetUrl.startsWith('/') ? '' : '/'}${resolvedTargetUrl}`

    console.log(`🧪 [API Push Test] Disparando push de teste [${type}] para ${humanTargetCount} destinatário(s) (${cleanTargetIds.length} aliases)...`, {
      aluno: nomeAlvo,
      targetCount: humanTargetCount,
      aliasesCount: cleanTargetIds.length,
      item_id: uniqueTestId,
    })

    // Disparar via OneSignal
    const pushResult = await sendPushNotification({
      title: finalTitle,
      body: finalMessage,
      targetUserIds: targetSubscriptionId ? undefined : cleanTargetIds,
      targetSubscriptionIds: targetSubscriptionId ? [String(targetSubscriptionId).trim()] : undefined,
      url: finalTargetUrl,
      bypassPause: Boolean(bypassPause),
      data: {
        type: type as AgendaPushType,
        item_id: uniqueTestId,
        is_test: true,
        aluno_id: studentData?.id || alunoId || null,
        aluno_nome: nomeAlvo,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    })

    // Obter estatísticas reais de entrega diretamente do OneSignal
    let finalRecipients = pushResult.recipients ?? 0
    let platformDeliveryStats: any = null
    let rawOneSignalResponse = pushResult.data ? JSON.stringify(pushResult.data) : null

    if (pushResult.success && pushResult.data?.id) {
      // Aguardar janela curta (600ms) para o OneSignal processar a entrega nos gateways (APNs e FCM)
      await new Promise(resolve => setTimeout(resolve, 600))
      try {
        const stats = await getNotificationStats(pushResult.data.id)
        if (stats) {
          if (typeof stats.successful === 'number' && stats.successful > 0) {
            finalRecipients = stats.successful
          }
          if (stats.platform_delivery_stats) {
            platformDeliveryStats = stats.platform_delivery_stats
          }
          rawOneSignalResponse = JSON.stringify(stats)
        }
      } catch (statsErr: any) {
        console.warn('[API Push Test] Erro ao consultar estatísticas do OneSignal:', statsErr?.message)
      }
    }

    // Gravar log na tabela agenda_push_logs
    const logStatus = pushResult.paused ? 'paused' : (pushResult.success ? 'sent' : 'failed')
    const logErrorMsg = pushResult.paused
      ? 'Notificações push estão pausadas globalmente pelo administrador. Disparo suprimido.'
      : (pushResult.mock
        ? 'Modo Mock: OneSignal não possui credenciais configuradas neste ambiente (push simulado com sucesso).'
        : (pushResult.success ? null : (pushResult.error || 'Erro desconhecido ao enviar')))

    let responsePayloadObj: any = {}
    try {
      if (rawOneSignalResponse) responsePayloadObj = JSON.parse(rawOneSignalResponse)
      else if (pushResult.data) responsePayloadObj = pushResult.data
    } catch {}
    responsePayloadObj._target_user_ids = cleanTargetIds
    responsePayloadObj._target_details = targetDetails
    responsePayloadObj._metadata = {
      ...(metadata || {}),
      aluno_id: studentData?.id ? String(studentData.id) : (alunoId ? String(alunoId) : null),
      aluno_nome: studentData?.nome || null,
      colaborador_id: colabData?.id ? String(colabData.id) : (effectiveColabId ? String(effectiveColabId) : null),
      responsavel_ids: resolvedRespIdsForLog,
      include_aluno_direct: Boolean(includeAlunoDirect),
    }
    if (pushResult.paused) {
      responsePayloadObj.paused = true
    }

    const { data: savedLog, error: logSaveError } = await supabase
      .from('agenda_push_logs')
      .insert({
        user_id: authUser.id,
        type: type,
        item_id: uniqueTestId,
        title: finalTitle,
        message: finalMessage,
        target_url: finalTargetUrl,
        target_count: humanTargetCount,
        status: logStatus,
        error_message: logErrorMsg,
        onesignal_response: JSON.stringify(responsePayloadObj),
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (logSaveError) {
      console.warn('[API Push Test] Falha ao gravar log no banco:', logSaveError.message)
    }

    // Avaliação de diagnóstico
    let warning: string | null = null
    if (pushResult.paused) {
      warning = 'As notificações push estão PAUSADAS globalmente no sistema. O disparo foi cancelado e não foi entregue aos aparelhos. Para testar mesmo pausado, marque a opção "Forçar envio de teste mesmo pausado".'
    } else if (pushResult.mock) {
      warning = 'O sistema está em Modo Mock (variáveis ONESIGNAL_APP_ID e/ou ONESIGNAL_REST_API_KEY não configuradas no servidor). A notificação foi simulada com sucesso.'
    } else if (finalRecipients === 0) {
      warning = 'A notificação foi aceita pelo OneSignal, porém retornou 0 destinatários inscritos ativos. Isso geralmente ocorre se o responsável ainda não abriu o aplicativo no celular para aceitar as permissões de notificação push.'
    }

    return NextResponse.json({
      ok: pushResult.success,
      notificationId: pushResult.data?.id || null,
      recipients: finalRecipients,
      platformDeliveryStats,
      mock: Boolean(pushResult.mock),
      status: logStatus,
      targetCount: humanTargetCount,
      aliasesCount: cleanTargetIds.length,
      targetUserIds: cleanTargetIds,
      targetDetails,
      warning,
      error: pushResult.error || null,
      logId: savedLog?.id || null,
      itemId: uniqueTestId,
      fullUrl: finalTargetUrl,
      title: finalTitle,
      message: finalMessage,
    })
  } catch (err: any) {
    console.error('[API Push Test POST] Erro crítico:', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar envio de teste.' }, { status: 500 })
  }
}

/**
 * DELETE /api/agenda/push/test
 *
 * Exclusão de sessão / aparelho push no OneSignal (individual e em lote)
 * para reiniciar o ciclo de solicitação de permissão e registro do aparelho.
 */
export async function DELETE(request: Request) {
  const auth = await verifyAdminAuth()
  if (!auth.authorized) return auth.errorResponse!

  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) {
    return NextResponse.json({ error: 'Credenciais OneSignal não configuradas.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    let body: any = {}
    try {
      body = await request.json()
    } catch {}

    const subscriptionId = body.subscriptionId || searchParams.get('subscriptionId')
    const subscriptionIds = Array.isArray(body.subscriptionIds) ? body.subscriptionIds : (subscriptionId ? [subscriptionId] : [])
    const responsavelId = body.responsavelId || searchParams.get('responsavelId')
    const authId = body.authId || searchParams.get('authId')
    const colabId = body.colaboradorId || body.userId || searchParams.get('colaboradorId') || searchParams.get('userId')
    const clearAllForUser = body.clearAllForUser || searchParams.get('clearAllForUser') === 'true'
    const clearAllOrphans = body.clearAllOrphans || searchParams.get('clearAllOrphans') === 'true'
    const clearInactiveStudents = body.clearInactiveStudents || searchParams.get('clearInactiveStudents') === 'true'
    const inactiveAlunoId = body.inactiveAlunoId || searchParams.get('inactiveAlunoId')
    const cleanupMode = body.cleanupMode || searchParams.get('cleanupMode')
    const minInactiveDays = body.minInactiveDays || searchParams.get('minInactiveDays')
    const protectStaff = body.protectStaff !== undefined ? Boolean(body.protectStaff) : true

    if (cleanupMode) {
      const { executeOneSignalSmartCleanup } = await import('@/lib/server/oneSignalFleetService')
      const smartRes = await executeOneSignalSmartCleanup({
        mode: cleanupMode,
        subscriptionIds,
        minInactiveDays: minInactiveDays ? Number(minInactiveDays) : 60,
        protectStaff,
      })
      return NextResponse.json(smartRes)
    }

    if (clearInactiveStudents) {
      const batchRes = await cleanupAllInactiveStudentsOneSignal()
      return NextResponse.json({
        success: batchRes.success,
        deletedCount: batchRes.deletedSubscriptionsCount,
        deletedUsersCount: batchRes.deletedUsersCount,
        inactiveStudentsTotal: batchRes.inactiveStudentsTotal,
        eligibleGuardiansTotal: batchRes.eligibleGuardiansTotal,
        protectedGuardiansTotal: batchRes.protectedGuardiansTotal,
        deletedSubscriptionIds: batchRes.deletedSubscriptionIds,
        message: `${batchRes.deletedSubscriptionsCount} aparelho(s) e ${batchRes.deletedUsersCount} usuário(s) inativo(s) removidos do OneSignal (${batchRes.inactiveStudentsTotal} alunos inativos verificados; ${batchRes.protectedGuardiansTotal} responsáveis preservados por possuírem outro filho ativo ou vínculo de colaborador).`,
      })
    }

    if (clearAllOrphans) {
      const { executeOneSignalSmartCleanup } = await import('@/lib/server/oneSignalFleetService')
      const orphanRes = await executeOneSignalSmartCleanup({ mode: 'orphans' })
      return NextResponse.json(orphanRes)
    }

    if (inactiveAlunoId) {
      const singleRes = await cleanupOneSignalForInactiveStudent(String(inactiveAlunoId), {
        forceTreatAsInactive: true,
      })
      return NextResponse.json({
        success: singleRes.success,
        deletedCount: singleRes.deletedSubscriptionsCount,
        deletedUsersCount: singleRes.deletedUsersCount,
        cleanedGuardianIds: singleRes.cleanedGuardianIds,
        protectedGuardianIds: singleRes.protectedGuardianIds,
        message: `${singleRes.deletedSubscriptionsCount} aparelho(s) excluído(s) do OneSignal para o aluno ${singleRes.studentName || inactiveAlunoId}.`,
      })
    }

    const targetsToDelete = new Set<string>(subscriptionIds.filter(Boolean))

    // 1. Se solicitado excluir todas as sessões de um responsável ou colaborador
    if ((responsavelId || authId || colabId) && (clearAllForUser || targetsToDelete.size === 0)) {
      const devs = await fetchDevicesForGuardian({
        authId: authId || null,
        responsavel_id: responsavelId || null,
        colaborador_id: colabId || null,
        system_user_id: colabId || null,
      })
      devs.forEach((d: any) => {
        if (d.id) targetsToDelete.add(d.id)
      })
    }

    // 2. Se solicitado limpar sessões órfãs (aparelhos sem external_user_id)
    if (clearAllOrphans) {
      try {
        const rList = await fetch(`https://onesignal.com/api/v1/players?app_id=${appId}&limit=100`, {
          headers: { Authorization: `Basic ${apiKey}` }
        })
        if (rList.ok) {
          const listData = await rList.json()
          const orphans = (listData.players || []).filter((p: any) => !p.external_user_id || p.external_user_id.trim() === '')
          orphans.forEach((p: any) => {
            if (p.id) targetsToDelete.add(p.id)
          })
        }
      } catch (orphanErr: any) {
        console.warn('[API Push Test DELETE] Aviso ao listar órfãos:', orphanErr?.message)
      }
    }

    if (targetsToDelete.size === 0) {
      return NextResponse.json({ error: 'Nenhum identificador de aparelho (subscriptionId) informado para exclusão.' }, { status: 400 })
    }

    const deleteResults: any[] = []
    const idsList = Array.from(targetsToDelete)

    for (const subId of idsList) {
      try {
        // a) DELETE via Player API (Universal)
        const resPlayer = await fetch(`https://onesignal.com/api/v1/players/${subId}?app_id=${appId}`, {
          method: 'DELETE',
          headers: { Authorization: `Basic ${apiKey}` },
        })

        // b) DELETE via Subscription API (OneSignal User Model v5)
        let resSubStatus: number | null = null
        try {
          const subEndpoint = clearAllForUser
            ? `https://onesignal.com/api/v1/apps/${appId}/users/by/subscriptions/${subId}`
            : `https://onesignal.com/api/v1/apps/${appId}/subscriptions/${subId}`
          const resSub = await fetch(subEndpoint, {
            method: 'DELETE',
            headers: { Authorization: `Basic ${apiKey}` },
          })
          resSubStatus = resSub.status
        } catch {}

        deleteResults.push({
          subscriptionId: subId,
          success: resPlayer.ok || resPlayer.status === 404 || (resSubStatus !== null && resSubStatus >= 200 && resSubStatus < 300),
          playerStatus: resPlayer.status,
          subscriptionStatus: resSubStatus,
        })
      } catch (delErr: any) {
        deleteResults.push({
          subscriptionId: subId,
          success: false,
          error: delErr.message,
        })
      }
    }

    const totalSuccess = deleteResults.filter(r => r.success).length

    console.log(`🗑️ [API Push Test DELETE] ${totalSuccess}/${idsList.length} aparelho(s) excluído(s) do OneSignal`, deleteResults)

    return NextResponse.json({
      success: true,
      deletedCount: totalSuccess,
      totalRequested: idsList.length,
      results: deleteResults,
      message: `${totalSuccess} sessão(ões) excluída(s) com sucesso do OneSignal. Na próxima abertura do app, o aparelho solicitará novo registro.`,
    })
  } catch (err: any) {
    console.error('[API Push Test DELETE] Erro:', err)
    return NextResponse.json({ error: err.message || 'Erro ao excluir aparelhos.' }, { status: 500 })
  }
}

