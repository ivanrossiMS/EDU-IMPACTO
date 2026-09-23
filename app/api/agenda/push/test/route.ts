import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendPushNotification, getNotificationStats } from '@/lib/server/pushService'
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
    const base = log.item_id.replace(/(_aluno_\d+|_perfil_\w+|-\w+_\d+)$/, '')
    if (base && base !== log.item_id) ids.add(base)
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

async function resolveLogFullDetails(logIdOrLog: string | any, supabase: any) {
  let log = logIdOrLog
  if (typeof logIdOrLog === 'string') {
    const { data, error } = await supabase.from('agenda_push_logs').select('*').eq('id', logIdOrLog).maybeSingle()
    if (error || !data) return null
    log = data
  }

  const alunoId = extractLogStudentId(log)
  const isColaborador = log.item_id?.includes('colaborador') || log.target_url?.includes('/colaborador/')

  let recipients: any[] = []
  let summary = ''
  const targetAliases = new Set<string>()

  // Extrair alvos já gravados no JSON
  try {
    if (log.onesignal_response) {
      const p = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
      if (Array.isArray(p?._target_user_ids)) {
        p._target_user_ids.forEach((id: string) => targetAliases.add(id))
      }
    }
  } catch {}

  // 1. Caso seja relativo a Aluno
  if (alunoId) {
    const [{ data: aluno }, { data: vinculos }] = await Promise.all([
      supabase.from('alunos').select('id, nome, matricula, turma, foto, status').eq('id', alunoId).maybeSingle(),
      supabase.from('aluno_responsavel').select('responsavel_id').eq('aluno_id', alunoId)
    ])

    let turmaNome = ''
    if (aluno?.turma) {
      const { data: turma } = await supabase.from('turmas').select('nome').eq('id', aluno.turma).maybeSingle()
      turmaNome = turma?.nome || `Turma ${aluno.turma}`
    }

    const respIds = (vinculos || []).map((v: any) => String(v.responsavel_id)).filter(Boolean)
    let resps: any[] = []
    if (respIds.length > 0) {
      const { data: rList } = await supabase.from('responsaveis').select('id, nome, email, telefone, celular, dados').in('id', respIds)
      resps = rList || []
    }

    // Identificadores de disparo para este aluno
    targetAliases.add(String(alunoId))
    targetAliases.add(String(alunoId).padStart(6, '0'))
    respIds.forEach((id: string) => targetAliases.add(id))
    resps.forEach((r: any) => {
      if (r.email) targetAliases.add(r.email.toLowerCase().trim())
      if (r.dados?.auth_id) targetAliases.add(r.dados.auth_id)
    })

    // Consultar dispositivos no OneSignal para cada responsável
    for (const r of resps) {
      const devices = await fetchDevicesForGuardian({
        responsavel_id: r.id,
        email: r.email,
        authId: r.dados?.auth_id
      })
      const hasActive = devices.some((d: any) => d.isSubscribed)
      const deviceModels = devices.map((d: any) => d.modelo || d.tipo).filter(Boolean)

      recipients.push({
        id: String(r.id),
        nome: r.nome || 'Responsável Legal',
        tipo: 'responsavel',
        tipoLabel: 'Responsável',
        email: r.email || null,
        telefone: formatPhoneDisplay(r.telefone || r.celular),
        devicesCount: devices.length,
        devices,
        hasActiveDevice: hasActive,
        deviceSummary: devices.length > 0 ? deviceModels.join(', ') : 'Sem aparelho ativo no app',
        statusTone: hasActive ? 'success' : 'danger',
      })
    }

    if (aluno) {
      recipients.push({
        id: String(aluno.id),
        nome: aluno.nome,
        tipo: 'aluno',
        tipoLabel: 'Aluno(a)',
        matricula: aluno.matricula || String(aluno.id),
        turmaNome: turmaNome || aluno.turma || 'Turma não informada',
        statusTone: 'neutral',
        deviceSummary: 'Dispositivo cadastrado pelos responsáveis',
      })
    }

    summary = `${aluno?.nome || 'Aluno'} (${resps.length} responsável(is) vinculado(s))`
  } else if (isColaborador) {
    // 2. Caso seja relativo a Colaborador
    const { data: colabs } = await supabase.from('system_users')
      .select('id, nome, email, cargo, perfil, auth_id, dados')
      .limit(30)

    for (const c of colabs || []) {
      recipients.push({
        id: String(c.id),
        nome: c.nome || 'Colaborador',
        tipo: 'colaborador',
        tipoLabel: c.cargo || c.perfil || 'Colaborador',
        email: c.email || null,
        cargo: c.cargo || c.perfil || 'Equipe Escolar',
        statusTone: 'neutral',
      })
      targetAliases.add(String(c.id))
      if (c.email) targetAliases.add(c.email.toLowerCase().trim())
      if (c.auth_id) targetAliases.add(c.auth_id)
    }
    summary = `Equipe Escolar / Colaboradores (${(colabs || []).length} destinatários)`
  } else {
    // 3. Fallback genérico
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
        readInfo.readerName = recipients.find(rec => rec.tipo === 'aluno')?.nome || 'Aluno'
      } else {
        const { data: su } = await supabase.from('system_users').select('nome').eq('id', cleanUserId).maybeSingle()
        if (su) readInfo.readerName = su.nome
      }
    }
  }

  // Estatísticas de entrega ao vivo OneSignal
  let oneSignalStats: any = null
  let oneSignalId: string | null = null
  try {
    if (log.onesignal_response) {
      const p = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
      oneSignalId = p?.id || null
      if (p?.successful !== undefined) {
        oneSignalStats = p
      }
    }
  } catch {}

  if (oneSignalId && !oneSignalStats) {
    try {
      oneSignalStats = await getNotificationStats(oneSignalId)
    } catch (e) {
      console.warn('Erro ao consultar stats do OneSignal:', e)
    }
  }

  return {
    logId: log.id,
    recipients,
    summary,
    targetAliases: Array.from(targetAliases),
    targetCount: log.target_count || recipients.length || 1,
    readInfo,
    oneSignalId,
    oneSignalStats,
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
  const supabase = supabaseServer

  try {
    // 1. Status de configuração do OneSignal
    if (wantConfig) {
      const hasAppId = Boolean(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_APP_ID.length > 8)
      const hasRestKey = Boolean(process.env.ONESIGNAL_REST_API_KEY && process.env.ONESIGNAL_REST_API_KEY.length > 8)
      const isMockMode = !hasAppId || !hasRestKey

      return NextResponse.json({
        hasAppId,
        hasRestKey,
        isMockMode,
        appIdPreview: hasAppId ? `${process.env.ONESIGNAL_APP_ID!.slice(0, 8)}...` : null,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://resilient-cuchufli-2b4125.netlify.app',
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

      return NextResponse.json({ logs: logs || [] })
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

      // 4. Filtro por Busca Textual
      if (filterSearch) {
        query = query.or(`title.ilike.%${filterSearch}%,message.ilike.%${filterSearch}%,item_id.ilike.%${filterSearch}%`)
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
            userContext = {
              id: String(colab.id),
              authId: colab.auth_id,
              nome: colab.nome,
              tipo: 'colaborador',
              cargo: colab.cargo,
              perfil: colab.perfil,
              email: colab.email,
              foto: colab.dados?.foto || null
            }
            const colabId = String(colab.id).trim()
            const colabAuth = colab.auth_id || colabId
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
            query = query.or(colabConditions.join(','))

            userDevices = await fetchDevicesForGuardian({
              authId: colab.auth_id,
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

      const { data: logs, count: totalCount, error: logsError } = await query

      if (logsError) {
        return NextResponse.json({ error: logsError.message }, { status: 400 })
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

      // 2. Resolução semântica de destinatários em lote (Alunos e Responsáveis)
      const batchAlunoIds = Array.from(new Set(
        (logs || []).map((l: any) => extractLogStudentId(l)).filter(Boolean) as string[]
      ))

      const studentLookup = new Map<string, { nome: string; turma?: string; resps: { nome: string; email?: string }[] }>()

      if (batchAlunoIds.length > 0) {
        const [{ data: alunosData }, { data: vinculosData }] = await Promise.all([
          supabase.from('alunos').select('id, nome, matricula, turma').in('id', batchAlunoIds),
          supabase.from('aluno_responsavel').select('aluno_id, responsavel_id').in('aluno_id', batchAlunoIds)
        ])

        const respIds = Array.from(new Set((vinculosData || []).map((v: any) => String(v.responsavel_id)).filter(Boolean)))
        let respsData: any[] = []
        if (respIds.length > 0) {
          const { data: rList } = await supabase.from('responsaveis').select('id, nome, email').in('id', respIds)
          respsData = rList || []
        }

        const respMap = new Map<string, { nome: string; email?: string }>()
        respsData.forEach((r: any) => respMap.set(String(r.id), { nome: r.nome, email: r.email }))

        ;(alunosData || []).forEach((a: any) => {
          const aId = String(a.id)
          const linkedRespIds = (vinculosData || [])
            .filter((v: any) => String(v.aluno_id) === aId)
            .map((v: any) => String(v.responsavel_id))
          const resps = linkedRespIds.map(rid => respMap.get(rid)).filter(Boolean) as { nome: string; email?: string }[]

          studentLookup.set(aId, {
            nome: a.nome,
            turma: a.turma,
            resps,
          })
        })
      }

      // 3. Enriquecer logs com indicador de leitura, telemetria e resumo de destinatários
      const enrichedLogs = (logs || []).map((log: any) => {
        let oneSignalId = null
        let oneSignalErrors = null
        try {
          if (log.onesignal_response) {
            const parsed = typeof log.onesignal_response === 'string' ? JSON.parse(log.onesignal_response) : log.onesignal_response
            oneSignalId = parsed.id || null
            oneSignalErrors = parsed.errors || null
          }
        } catch {}

        // Encontrar leitura por qualquer um dos candidate IDs do log
        const cands = logCandidateMap.get(log.id) || [log.item_id]
        let matchedRead: any = null
        for (const cid of cands) {
          if (readsMap[cid]) {
            matchedRead = readsMap[cid]
            break
          }
        }

        // Resumo de destinatários
        const aId = extractLogStudentId(log)
        let recipient_summary = `${log.target_count || 1} usuário(s)`
        let recipients_preview: { nome: string; tipo: string }[] = []

        if (aId && studentLookup.has(aId)) {
          const stu = studentLookup.get(aId)!
          const parts = stu.nome.trim().split(/\s+/).filter(Boolean)
          const friendlyStudent = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0]
          const numResps = stu.resps.length

          recipient_summary = numResps > 0
            ? `${friendlyStudent} (${numResps} resp.)`
            : friendlyStudent

          recipients_preview = [
            ...stu.resps.map(r => ({ nome: r.nome, tipo: 'responsavel' })),
            { nome: stu.nome, tipo: 'aluno' }
          ]
        } else if (log.item_id?.includes('colaborador') || log.target_url?.includes('/colaborador/')) {
          recipient_summary = `Equipe Escolar (${log.target_count || 1} alvos)`
          recipients_preview = [{ nome: 'Equipe de Colaboradores', tipo: 'colaborador' }]
        }

        return {
          ...log,
          oneSignalId,
          oneSignalErrors,
          isRead: Boolean(matchedRead),
          readAt: matchedRead?.read_at || null,
          readBy: matchedRead?.usuario_id || null,
          recipient_summary,
          recipients_preview,
        }
      })

      const total = totalCount || 0
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
      const { data: aluno, error: alunoErr } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, foto, dados, responsavel, responsavel_financeiro, responsavel_pedagogico')
        .or(`id.eq.${cleanAlunoId},matricula.eq.${cleanAlunoId}`)
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
        .select('id, auth_id, email, nome, ultimo_acesso, created_at, dados')
        .limit(2000)

      // 2. Buscar usuários do Supabase Auth para verificar contas ativas dos responsáveis
      const supabaseAdmin = getAdminClient()
      let authUsers: any[] = []
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
        if (listData?.users) {
          authUsers = listData.users
        }
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
        const resolvedUltimoAcesso = authUser?.last_sign_in_at || sysUser?.ultimo_acesso || null

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
      responsavelIds = [],
      includeAlunoDirect = false,
      type = 'test',
      title,
      message,
      targetUrl,
      targetSubscriptionId,
      metadata = {},
      bypassDedup = true,
      ignoreGlobalConfig = true,
    } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'O título da notificação é obrigatório.' }, { status: 400 })
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'A mensagem da notificação é obrigatória.' }, { status: 400 })
    }

    let studentData: any = null
    let colabData: any = null
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
      const { data: st } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, responsavel, responsavel_financeiro, responsavel_pedagogico, dados')
        .or(`id.eq.${String(alunoId).trim()},matricula.eq.${String(alunoId).trim()}`)
        .maybeSingle()

      if (st) {
        studentData = st

        // Incluir o ID do aluno se marcado ou se responsável virtual
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

      // Se responsavelIds não foi passado explicitamente, buscar todos os vinculados
      let respIdsToQuery = Array.isArray(responsavelIds) && responsavelIds.length > 0
        ? responsavelIds.map(String)
        : []

      if (respIdsToQuery.length === 0) {
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

      // Buscar detalhes e contas dos responsáveis selecionados
      if (respIdsToQuery.length > 0) {
        const expandedRespIds = Array.from(new Set([
          ...respIdsToQuery,
          ...respIdsToQuery.map(id => id.replace(/^0+/, '')),
          ...respIdsToQuery.map(id => !isNaN(Number(id)) ? String(Number(id)).padStart(6, '0') : '')
        ].filter(Boolean)))

        const { data: resps } = await supabase
          .from('responsaveis')
          .select('id, nome, email, telefone')
          .in('id', expandedRespIds)

        const { data: sysUsers } = await supabase
          .from('system_users')
          .select('id, auth_id, email, nome, dados')
          .limit(2000)

        // Buscar usuários do Supabase Auth para mapear auth UUID
        const supabaseAdmin = getAdminClient()
        let authUsers: any[] = []
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
          if (listData?.users) {
            authUsers = listData.users
          }
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
      responsavelIds.forEach(id => targetUserIdsSet.add(String(id).trim()))
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

    // Formatar texto com formatFriendlyStudentName exatamente como a Agenda Digital real
    const rawNomeAlvo = colabData?.nome || studentData?.nome || 'Destinatário'
    const nomeAlvo = colabData?.nome ? colabData.nome : (studentData?.nome ? formatFriendlyStudentName(studentData.nome) : 'Destinatário')
    const matriculaAlvo = studentData?.matricula || (colabData ? (colabData.cargo || colabData.perfil || '') : '')
    const turmaAlvo = colabData ? (colabData.cargo || colabData.perfil || 'Equipe Escolar') : (studentData?.turma || '')
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

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

    console.log(`🧪 [API Push Test] Disparando push de teste [${type}] para ${cleanTargetIds.length} alvo(s)...`, {
      aluno: nomeAlvo,
      targetCount: cleanTargetIds.length,
      item_id: uniqueTestId,
    })

    // Disparar via OneSignal
    const pushResult = await sendPushNotification({
      title: finalTitle,
      body: finalMessage,
      targetUserIds: targetSubscriptionId ? undefined : cleanTargetIds,
      targetSubscriptionIds: targetSubscriptionId ? [String(targetSubscriptionId).trim()] : undefined,
      url: finalTargetUrl,
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
    const logStatus = pushResult.success ? 'sent' : 'failed'
    const logErrorMsg = pushResult.mock
      ? 'Modo Mock: OneSignal não possui credenciais configuradas neste ambiente (push simulado com sucesso).'
      : (pushResult.success ? null : (pushResult.error || 'Erro desconhecido ao enviar'))

    let responsePayloadObj: any = {}
    try {
      if (rawOneSignalResponse) responsePayloadObj = JSON.parse(rawOneSignalResponse)
      else if (pushResult.data) responsePayloadObj = pushResult.data
    } catch {}
    responsePayloadObj._target_user_ids = cleanTargetIds
    responsePayloadObj._metadata = metadata || null

    const { data: savedLog, error: logSaveError } = await supabase
      .from('agenda_push_logs')
      .insert({
        user_id: authUser.id,
        type: type,
        item_id: uniqueTestId,
        title: finalTitle,
        message: finalMessage,
        target_url: finalTargetUrl,
        target_count: finalRecipients || cleanTargetIds.length,
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
    if (pushResult.mock) {
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
      targetCount: cleanTargetIds.length,
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
        let resSubStatus = null
        try {
          const resSub = await fetch(`https://onesignal.com/api/v1/apps/${appId}/users/by/subscriptions/${subId}`, {
            method: 'DELETE',
            headers: { Authorization: `Basic ${apiKey}` },
          })
          resSubStatus = resSub.status
        } catch {}

        deleteResults.push({
          subscriptionId: subId,
          success: resPlayer.ok,
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

