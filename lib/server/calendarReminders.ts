/**
 * lib/server/calendarReminders.ts
 *
 * Motor centralizado de lembretes e resolução de destinatários do calendário escolar.
 *
 * Responsabilidades:
 * 1. Consolidar múltiplos eventos do mesmo dia (targetDate) por aluno (aluno_id),
 *    garantindo que cada aluno receba NO MÁXIMO 1 notificação de lembrete por data de evento.
 * 2. Agendar via OneSignal (send_after às 20:00 America/Campo_Grande na véspera) quando acionado
 *    antes das 20:00, ou disparar imediatamente quando acionado a partir das 20:00 na véspera.
 * 3. Fornecer gatilho oportunístico leve (triggerCalendarRemindersIfDue) para ambientes
 *    serverless como Netlify onde o vercel.json não é executado automaticamente.
 */

import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'
import { getPushPauseStatus } from '@/lib/server/pushPauseService'

const CAMPO_GRANDE_TZ = 'America/Campo_Grande'

export function getCampoGrandeDateStr(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPO_GRANDE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export function getTomorrowCampoGrandeDateStr(baseDate: Date = new Date()): string {
  const todayStr = getCampoGrandeDateStr(baseDate)
  return addDaysToDateStr(todayStr, 1)
}

export function getCampoGrandeTimeParts(date: Date = new Date()): {
  dateStr: string
  hour: number
  minute: number
  dayOfWeek: number
} {
  const dateStr = getCampoGrandeDateStr(date)
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPO_GRANDE_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(date)
  const minStr = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPO_GRANDE_TZ,
    minute: '2-digit',
  }).format(date)
  const hour = parseInt(hourStr, 10) % 24
  const minute = parseInt(minStr, 10) || 0
  const d = new Date(`${dateStr}T12:00:00-04:00`)
  return {
    dateStr,
    hour,
    minute,
    dayOfWeek: d.getUTCDay(),
  }
}

export function getEve20hSchedule(eventDateStr: string, now: Date = new Date()): {
  eveDateStr: string
  sendAfterStr: string
  sendAfterDate: Date
  diffHours: number
  isBefore20h: boolean
  isSameDayEve: boolean
} {
  const eveDateStr = addDaysToDateStr(eventDateStr, -1)
  // America/Campo_Grande é permanentemente GMT-0400 (sem horário de verão)
  const sendAfterStr = `${eveDateStr} 20:00:00 GMT-0400`
  const sendAfterDate = new Date(`${eveDateStr}T20:00:00-04:00`)
  const diffHours = (sendAfterDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  const todayStr = getCampoGrandeDateStr(now)

  return {
    eveDateStr,
    sendAfterStr,
    sendAfterDate,
    diffHours,
    isBefore20h: diffHours > 0,
    isSameDayEve: todayStr === eveDateStr,
  }
}

export interface ResolvedEventTargetStudent {
  aluno_id: string
  aluno_nome: string
  responsaveis_ids: string[]
}

export interface ResolvedEventTargets {
  students: ResolvedEventTargetStudent[]
  directColaboradores: string[]
}

/**
 * Resolve os alunos (e seus responsáveis) e colaboradores diretos destinatários de um evento,
 * utilizando cache por assinatura de turmas/visibilidade para evitar queries repetidas em lotes.
 */
export async function resolveEventTargets(
  supabase: any,
  row: any,
  cache?: Map<string, ResolvedEventTargets>
): Promise<ResolvedEventTargets> {
  const rowDados = row.dados || {}
  const turmasList = Array.isArray(row.turmas)
    ? row.turmas
    : Array.isArray(rowDados.turmas)
      ? rowDados.turmas
      : []
  const isTodos =
    turmasList.length === 0 ||
    turmasList.some(
      (t: any) =>
        typeof t === 'string' &&
        (t.toLowerCase().includes('todos') || t.toLowerCase().includes('toda a escola'))
    )
  const visibilidadeUsuario = rowDados.visibilidadeUsuario || row.visibilidadeUsuario || ''

  const targetParams = {
    turmas: turmasList,
    targetClasses: turmasList,
    grupos: rowDados.grupos || rowDados.targetGrupos || [],
    colaboradoresIds: rowDados.colaboradoresIds || rowDados.funcionariosIds || [],
    funcionariosIds: rowDados.funcionariosIds || rowDados.colaboradoresIds || [],
    alunosIds: rowDados.alunosIds || rowDados.targetStudents || [],
    destino: isTodos ? 'todos' : (rowDados.destino || 'selecionados'),
  }

  const cacheKey = JSON.stringify({
    turmas: [...turmasList].sort(),
    grupos: [...(targetParams.grupos || [])].sort(),
    colaboradoresIds: [...(targetParams.colaboradoresIds || [])].sort(),
    alunosIds: [...(targetParams.alunosIds || [])].sort(),
    destino: targetParams.destino,
    visibilidadeUsuario,
  })

  if (cache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!
    return {
      students: cached.students.map((s) => ({
        ...s,
        responsaveis_ids: [...s.responsaveis_ids],
      })),
      directColaboradores: [...cached.directColaboradores],
    }
  }

  const baseResolved = await getStudentTargetsForComunicados(targetParams)
  const students: ResolvedEventTargetStudent[] = (baseResolved.students || []).map((s) => ({
    aluno_id: String(s.aluno_id),
    aluno_nome: s.aluno_nome || 'Aluno',
    responsaveis_ids: [...(s.responsaveis_ids || [])],
  }))
  const directColaboradores = [...(baseResolved.directColaboradores || [])]

  if (visibilidadeUsuario && visibilidadeUsuario !== 'Todos') {
    const { data: sysUser } = await supabase
      .from('system_users')
      .select('id')
      .ilike('nome', visibilidadeUsuario)
      .maybeSingle()
    if (sysUser?.id) {
      directColaboradores.push(String(sysUser.id))
    } else {
      const { data: respUser } = await supabase
        .from('responsaveis')
        .select('id')
        .ilike('nome', visibilidadeUsuario)
        .maybeSingle()
      if (respUser?.id) {
        directColaboradores.push(String(respUser.id))
      } else {
        const { data: alunoUser } = await supabase
          .from('alunos')
          .select('id, nome')
          .ilike('nome', visibilidadeUsuario)
          .maybeSingle()
        if (alunoUser?.id) {
          const { data: vincs } = await supabase
            .from('aluno_responsavel')
            .select('responsavel_id')
            .eq('aluno_id', alunoUser.id)
          const responsaveis_ids = [String(alunoUser.id)]
          vincs?.forEach((v: any) => responsaveis_ids.push(String(v.responsavel_id)))
          students.push({
            aluno_id: String(alunoUser.id),
            aluno_nome: alunoUser.nome || 'Aluno',
            responsaveis_ids,
          })
        }
      }
    }
  }

  if (cache) {
    cache.set(cacheKey, { students, directColaboradores })
  }
  return { students, directColaboradores }
}

export interface RunCalendarRemindersOptions {
  supabase?: any
  targetDate?: string
  dryRun?: boolean
  senderUserId?: string
  source?: string
  allowScheduleAhead?: boolean
}

export interface CalendarReminderSummary {
  ok: boolean
  status: 'ok' | 'skipped' | 'error'
  skipped?: boolean
  reason?: string
  targetDate: string
  dryRun: boolean
  eventsCount: number
  eventsProcessed: number
  uniqueStudentsTargeted: number
  sentCount: number
  skippedCount: number
  failedCount: number
  totalPushesSent: number
  totalPushesSkipped: number
  results: any[]
}

/**
 * Executa o processamento consolidado de lembretes para uma data de evento específica (targetDate).
 * Garante no máximo 1 notificação de lembrete por aluno para o dia targetDate,
 * mesmo que existam múltiplos eventos cadastrados para aquela mesma data.
 */
export async function runCalendarRemindersForDate(
  options: RunCalendarRemindersOptions = {}
): Promise<CalendarReminderSummary> {
  const supabase = options.supabase || getAdminClient()
  const targetDate = options.targetDate || getTomorrowCampoGrandeDateStr()
  const dryRun = Boolean(options.dryRun)
  const source = options.source || 'cron_lembrete_calendario'
  const allowScheduleAhead = options.allowScheduleAhead !== false
  const logPrefix = `[Lembretes Calendário][${targetDate}]`

  // 1. Verificar se notificações de calendário estão ativas em ad_config
  const { data: configData } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'ad_config')
    .maybeSingle()

  const notifConfig = configData?.valor?.notificacoes || { pushCalendario: true }
  if (notifConfig.pushCalendario === false) {
    console.log(`${logPrefix} Notificações de calendário desativadas em ad_config. Abortando.`)
    return {
      ok: true,
      status: 'skipped',
      skipped: true,
      reason: 'pushCalendario_disabled',
      targetDate,
      dryRun,
      eventsCount: 0,
      eventsProcessed: 0,
      uniqueStudentsTargeted: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      totalPushesSent: 0,
      totalPushesSkipped: 0,
      results: [],
    }
  }

  // 2. Checagem de pausa global
  const pauseStatus = await getPushPauseStatus()
  if (pauseStatus.paused && (!pauseStatus.exemptStudents || pauseStatus.exemptStudents.length === 0) && (!pauseStatus.exemptUserIds || pauseStatus.exemptUserIds.length === 0)) {
    console.log(`${logPrefix} Notificações push estão pausadas globalmente. Abortando.`)
    return {
      ok: true,
      status: 'skipped',
      skipped: true,
      reason: 'notifications_paused',
      targetDate,
      dryRun,
      eventsCount: 0,
      eventsProcessed: 0,
      uniqueStudentsTargeted: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      totalPushesSent: 0,
      totalPushesSkipped: 0,
      results: [],
    }
  }

  // 3. Buscar todos os eventos do dia targetDate
  const { data: eventos, error } = await supabase
    .from('eventos_agenda')
    .select('*')
    .eq('data', targetDate)

  if (error) {
    throw new Error(`Erro ao buscar eventos_agenda para ${targetDate}: ${error.message}`)
  }

  if (!eventos || eventos.length === 0) {
    return {
      ok: true,
      status: 'ok',
      targetDate,
      dryRun,
      eventsCount: 0,
      eventsProcessed: 0,
      uniqueStudentsTargeted: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      totalPushesSent: 0,
      totalPushesSkipped: 0,
      results: [],
    }
  }

  // 4. Calcular horário de entrega (20:00 GMT-0400 da véspera)
  const now = new Date()
  const schedule = getEve20hSchedule(targetDate, now)
  // Se ainda estamos antes das 20:00 da véspera (com margem de 2 minutos), agendamos via send_after no OneSignal
  // para que o responsável receba pontualmente às 20:00:00 (America/Campo_Grande).
  const sendAfter =
    allowScheduleAhead && schedule.diffHours > 0.03
      ? schedule.sendAfterStr
      : undefined

  // 5. Consultar logs de lembretes já registrados para este targetDate (novos e legados)
  const eventIdsOnDate = eventos.map((e: any) => String(e.id))
  const { data: existingReminderLogs } = await supabase
    .from('agenda_push_logs')
    .select('item_id, status')
    .eq('type', 'calendario')
    .ilike('item_id', '%-reminder%')

  const alreadyRemindedAlunos = new Set<string>()
  let colabAlreadyReminded = false
  const staleFailedKeysToClear = new Set<string>()

  for (const log of existingReminderLogs || []) {
    const itemIdStr = String(log.item_id || '')
    const st = String(log.status || '')

    const isForTargetDate =
      itemIdStr.startsWith(`cal_lembrete_${targetDate}-`) ||
      eventIdsOnDate.some((evId: string) => itemIdStr.startsWith(`${evId}-`))

    if (!isForTargetDate) continue

    const isCompletedStatus = st === 'sent' || st === 'pending' || st === 'skipped'
    const alunoMatch = itemIdStr.match(/_aluno_(\d+)$/)

    if (alunoMatch) {
      if (isCompletedStatus) {
        alreadyRemindedAlunos.add(alunoMatch[1])
      } else if (st === 'failed' || st === 'paused') {
        staleFailedKeysToClear.add(itemIdStr)
      }
    } else if (itemIdStr.endsWith('_perfil_colaborador')) {
      if (isCompletedStatus) {
        colabAlreadyReminded = true
      } else if (st === 'failed' || st === 'paused') {
        staleFailedKeysToClear.add(itemIdStr)
      }
    }
  }

  // 6. Resolver destinatários por evento (consolidando por aluno_id e colaboradores diretos)
  const targetResolutionCache = new Map<string, ResolvedEventTargets>()
  const studentEventsMap = new Map<string, { student: ResolvedEventTargetStudent; events: any[] }>()
  const colabEventsList: any[] = []
  const allDirectColabIds = new Set<string>()

  for (const row of eventos) {
    const resolved = await resolveEventTargets(supabase, row, targetResolutionCache)

    for (const student of resolved.students || []) {
      if (!student.responsaveis_ids || student.responsaveis_ids.length === 0) continue
      const alunoKey = String(student.aluno_id)
      const existing = studentEventsMap.get(alunoKey)
      if (!existing) {
        studentEventsMap.set(alunoKey, {
          student: {
            aluno_id: alunoKey,
            aluno_nome: student.aluno_nome,
            responsaveis_ids: Array.from(new Set(student.responsaveis_ids)),
          },
          events: [row],
        })
      } else {
        existing.events.push(row)
        for (const rId of student.responsaveis_ids) {
          if (!existing.student.responsaveis_ids.includes(rId)) {
            existing.student.responsaveis_ids.push(rId)
          }
        }
      }
    }

    if (resolved.directColaboradores && resolved.directColaboradores.length > 0) {
      for (const cId of resolved.directColaboradores) {
        allDirectColabIds.add(cId)
      }
      colabEventsList.push(row)
    }
  }

  // Limpar eventuais chaves 'failed'/'paused' antigas se vamos tentar enviar novamente
  if (!dryRun && staleFailedKeysToClear.size > 0) {
    const keysArr = Array.from(staleFailedKeysToClear)
    for (let i = 0; i < keysArr.length; i += 100) {
      await supabase
        .from('agenda_push_logs')
        .delete()
        .eq('type', 'calendario')
        .in('item_id', keysArr.slice(i, i + 100))
        .in('status', ['failed', 'paused'])
    }
  }

  let sentCount = 0
  let skippedCount = 0
  let failedCount = 0
  const results: any[] = []

  // 7. Disparar 1 único lembrete consolidado por aluno para targetDate
  const studentEntries = Array.from(studentEventsMap.entries())
  const CHUNK_SIZE = 30

  for (let i = 0; i < studentEntries.length; i += CHUNK_SIZE) {
    const chunk = studentEntries.slice(i, i + CHUNK_SIZE)

    const outcomes = await Promise.all(
      chunk.map(async ([alunoId, { student, events: studentEvents }]) => {
        if (alreadyRemindedAlunos.has(alunoId)) {
          return { status: 'skipped' as const, alunoId, reason: 'already_reminded_for_date' }
        }

        // Deduplicar títulos de eventos (case-insensitive) preservando a grafia original
        const uniqueTitles: string[] = []
        const seenNormTitles = new Set<string>()
        for (const ev of studentEvents) {
          const cleanTitle = String(ev.titulo || 'Evento Escolar').trim()
          const normTitle = cleanTitle.toLowerCase()
          if (cleanTitle && !seenNormTitles.has(normTitle)) {
            seenNormTitles.add(normTitle)
            uniqueTitles.push(cleanTitle)
          }
        }

        const primaryEvent = studentEvents[0]
        const nomeAluno = formatFriendlyStudentName(student.aluno_nome)
        const reminderItemId = `cal_lembrete_${targetDate}-${student.aluno_id}-reminder`
        const studentTargetUrl = `/agenda-digital/${student.aluno_id}/calendario?id=${encodeURIComponent(String(primaryEvent.id))}&data=${encodeURIComponent(targetDate)}`

        const message =
          uniqueTitles.length <= 1
            ? `Lembrete para ${nomeAluno}: amanhã temos o evento ${uniqueTitles[0] || primaryEvent.titulo}. Não se esqueça!`
            : `Lembrete para ${nomeAluno}: amanhã temos os eventos ${uniqueTitles.join(', ')}. Não se esqueça!`

        if (dryRun) {
          return {
            status: 'sent' as const,
            alunoId,
            dryRun: true,
            itemId: reminderItemId,
            message,
            sendAfter: sendAfter || null,
          }
        }

        try {
          const res = await sendAgendaPushNotification({
            type: 'calendario',
            itemId: reminderItemId,
            title: '⏰ Lembrete: Amanhã!',
            message,
            targetUserIds: student.responsaveis_ids,
            targetUrl: studentTargetUrl,
            collapseId: `cal_rem_${targetDate}_${student.aluno_id}`,
            senderUserId: options.senderUserId,
            sendAfter,
            metadata: {
              aluno_id: student.aluno_id,
              aluno_nome: nomeAluno,
              perfil_destino: 'familia',
              item_id: String(primaryEvent.id),
              event_ids: studentEvents.map((e: any) => String(e.id)),
              rota: 'calendario',
              data: targetDate,
              targetUrl: studentTargetUrl,
              is_reminder: true,
              sender_type: 'automatico',
              sender_name: 'Automático',
              origem: source,
              send_after: sendAfter || null,
            },
          })

          if (res.skipped) return { status: 'skipped' as const, alunoId, reason: res.reason }
          if (res.success) return { status: 'sent' as const, alunoId }
          return { status: 'failed' as const, alunoId, error: res.error }
        } catch (err: any) {
          console.error(`${logPrefix} Erro no push do aluno ${student.aluno_id}:`, err?.message)
          return { status: 'failed' as const, alunoId, error: err?.message }
        }
      })
    )

    for (const outcome of outcomes) {
      if (outcome.status === 'sent') sentCount++
      else if (outcome.status === 'skipped') skippedCount++
      else failedCount++
    }
  }

  // 8. Disparar 1 único lembrete consolidado para colaboradores diretos
  let colabSent = 0
  let colabSkipped = 0
  if (allDirectColabIds.size > 0) {
    if (colabAlreadyReminded) {
      colabSkipped++
      skippedCount++
    } else {
      const colabEvents = colabEventsList.length > 0 ? colabEventsList : eventos
      const uniqueTitles: string[] = []
      const seenNormTitles = new Set<string>()
      for (const ev of colabEvents) {
        const cleanTitle = String(ev.titulo || 'Evento Escolar').trim()
        const normTitle = cleanTitle.toLowerCase()
        if (cleanTitle && !seenNormTitles.has(normTitle)) {
          seenNormTitles.add(normTitle)
          uniqueTitles.push(cleanTitle)
        }
      }

      const primaryEvent = colabEvents[0] || eventos[0]
      const colabReminderItemId = `cal_lembrete_${targetDate}-reminder`
      const colabTargetUrl = `/agenda-digital/colaborador/calendario?id=${encodeURIComponent(String(primaryEvent.id))}&data=${encodeURIComponent(targetDate)}`
      const colabMessage =
        uniqueTitles.length <= 1
          ? `Amanhã temos o evento: ${uniqueTitles[0] || primaryEvent.titulo}. Não se esqueça!`
          : `Amanhã temos os eventos: ${uniqueTitles.join(', ')}. Não se esqueça!`

      if (dryRun) {
        colabSent++
        sentCount++
      } else {
        const resColab = await sendAgendaPushNotification({
          type: 'calendario',
          itemId: colabReminderItemId,
          title: '⏰ Lembrete: Amanhã!',
          message: colabMessage,
          targetUserIds: Array.from(allDirectColabIds),
          targetUrl: colabTargetUrl,
          collapseId: `cal_rem_${targetDate}_colab`,
          senderUserId: options.senderUserId,
          sendAfter,
          metadata: {
            perfil_destino: 'colaborador',
            item_id: String(primaryEvent.id),
            event_ids: colabEvents.map((e: any) => String(e.id)),
            rota: 'calendario',
            data: targetDate,
            targetUrl: colabTargetUrl,
            is_reminder: true,
            sender_type: 'automatico',
            sender_name: 'Automático',
            origem: source,
            send_after: sendAfter || null,
          },
        }).catch((err) => {
          console.error(`${logPrefix} Erro no push colaboradores:`, err?.message)
          return { success: false, skipped: false }
        })

        if ((resColab as any)?.skipped) {
          colabSkipped++
          skippedCount++
        } else if (resColab?.success) {
          colabSent++
          sentCount++
        } else {
          failedCount++
        }
      }
    }
  }

  results.push({
    targetDate,
    eventsIds: eventos.map((e: any) => e.id),
    titulos: eventos.map((e: any) => e.titulo),
    studentsTargeted: studentEntries.length,
    colaboradoresTargeted: allDirectColabIds.size,
    studentPushesSent: sentCount - colabSent,
    colaboradorPushesSent: colabSent,
    sendAfter: sendAfter || null,
  })

  return {
    ok: true,
    status: 'ok',
    targetDate,
    dryRun,
    eventsCount: eventos.length,
    eventsProcessed: eventos.length,
    uniqueStudentsTargeted: studentEntries.length,
    sentCount,
    skippedCount,
    failedCount,
    totalPushesSent: sentCount,
    totalPushesSkipped: skippedCount,
    results,
  }
}

interface AutoReminderState {
  lastAttemptAt: number
  completedDates: Set<string>
  isRunning: boolean
}

// @ts-ignore
const _autoReminderState: AutoReminderState = (global as any).__calendarReminderAutoState ??
  ((global as any).__calendarReminderAutoState = {
    lastAttemptAt: 0,
    completedDates: new Set<string>(),
    isRunning: false,
  })

const AUTO_CHECK_THROTTLE_MS = 15 * 60 * 1000 // 15 minutos

/**
 * Gatilho oportunístico não-bloqueante para garantir que os lembretes das 20:00 (America/Campo_Grande)
 * sejam sempre agendados/enviados na véspera do evento, mesmo quando hospedado no Netlify (sem Vercel Cron).
 *
 * Janela de execução:
 * - Todos os dias a partir das 18:00 MS (ou a partir das 12:00 MS em finais de semana): verifica o dia seguinte (tomorrowStr).
 * - Nas sextas (>= 16:00 MS) e sábados (>= 12:00 MS): também pré-agenda via send_after os eventos de domingo/segunda-feira,
 *   garantindo entrega pontual às 20:00 da véspera mesmo se não houver tráfego no domingo à noite.
 */
export function triggerCalendarRemindersIfDue(source = 'auto_heartbeat'): void {
  try {
    const now = new Date()
    const nowMs = now.getTime()

    if (_autoReminderState.isRunning) return
    if (nowMs - _autoReminderState.lastAttemptAt < AUTO_CHECK_THROTTLE_MS) return

    const { dateStr: todayStr, hour, dayOfWeek } = getCampoGrandeTimeParts(now)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isFriday = dayOfWeek === 5

    const candidateTargetDates: string[] = []
    const tomorrowStr = addDaysToDateStr(todayStr, 1)

    // Na véspera (dias úteis >= 18h, fim de semana >= 12h), verifica o evento de amanhã
    if ((isWeekend && hour >= 12) || (!isWeekend && hour >= 18)) {
      if (!_autoReminderState.completedDates.has(`${todayStr}->${tomorrowStr}`)) {
        candidateTargetDates.push(tomorrowStr)
      }
    }

    // Na sexta-feira (>= 16h) ou sábado (>= 12h), pré-agenda eventos do fim de semana e segunda-feira via send_after
    if ((isFriday && hour >= 16) || (dayOfWeek === 6 && hour >= 12)) {
      const plus2 = addDaysToDateStr(todayStr, 2)
      const plus3 = addDaysToDateStr(todayStr, 3)
      if (!_autoReminderState.completedDates.has(`${todayStr}->${plus2}`)) {
        candidateTargetDates.push(plus2)
      }
      if (isFriday && !_autoReminderState.completedDates.has(`${todayStr}->${plus3}`)) {
        candidateTargetDates.push(plus3)
      }
    }

    if (candidateTargetDates.length === 0) return

    _autoReminderState.lastAttemptAt = nowMs
    _autoReminderState.isRunning = true

    Promise.resolve()
      .then(async () => {
        for (const targetDate of candidateTargetDates) {
          try {
            const summary = await runCalendarRemindersForDate({
              targetDate,
              source,
              allowScheduleAhead: true,
            })
            if (summary.status === 'ok' && summary.failedCount === 0) {
              _autoReminderState.completedDates.add(`${todayStr}->${targetDate}`)
            }
          } catch (err: any) {
            console.warn(`[CalendarReminders Auto] Erro ao verificar ${targetDate}:`, err?.message || err)
          }
        }
      })
      .finally(() => {
        _autoReminderState.isRunning = false
      })
  } catch (err: any) {
    _autoReminderState.isRunning = false
    console.warn('[CalendarReminders Auto] Erro inesperado:', err?.message || err)
  }
}

/**
 * Invalida o cache em memória de uma data específica quando um novo evento é adicionado ou editado para aquela data.
 */
export function invalidateCalendarReminderCacheForDate(targetDate: string): void {
  if (!targetDate) return
  for (const key of Array.from(_autoReminderState.completedDates)) {
    if (key.endsWith(`->${targetDate}`)) {
      _autoReminderState.completedDates.delete(key)
    }
  }
}
