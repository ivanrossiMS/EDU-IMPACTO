import { NextResponse } from 'next/server'
import { requireAuth, requireStaff, resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'
import { isTurmaOrGroupMatch } from '@/lib/studentTurmaUtils'
import {
  getCampoGrandeDateStr,
  getEve20hSchedule,
  invalidateCalendarReminderCacheForDate,
  resolveEventTargets,
  runCalendarRemindersForDate,
  triggerCalendarRemindersIfDue,
  type ResolvedEventTargetStudent,
  type ResolvedEventTargets,
} from '@/lib/server/calendarReminders'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Gatilho oportunístico não-bloqueante para garantir lembretes de véspera às 20:00 MS
  triggerCalendarRemindersIfDue('agenda_eventos_get')

  const { user, isStaff, isFamilyOrStudent: resolvedIsFamily, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')
    const alunoId = url.searchParams.get('aluno_id')
    const idParam = url.searchParams.get('id')
    
    let query = supabase.from('eventos_agenda').select('*')

    if (idParam) {
      query = query.eq('id', idParam)
    }

    if (limitParam) {
      const limit = parseInt(limitParam)
      const offset = offsetParam ? parseInt(offsetParam) : 0
      query = query.range(offset, offset + limit - 1)
    } else {
      query = query.limit(1000)
    }

    query = query.order('data', { ascending: false })

    const isRestrictedFamilyOrStudent = !isStaff && resolvedIsFamily

    // Executa query de eventos, cache de turmas/grupos e resolução de alunos autorizados em PARALELO
    const [eventosRes, turmasGruposRes, authorizedAlunoIds] = await Promise.all([
      query,
      isRestrictedFamilyOrStudent && !idParam
        ? getCachedTurmasAndGrupos()
        : Promise.resolve({ allTurmas: [] as any[], allGrupos: [] as any[] }),
      isRestrictedFamilyOrStudent && !idParam
        ? getAuthorizedAlunoIdsForUser(user)
        : Promise.resolve(new Set<string>())
    ])

    const { data, error } = eventosRes
    if (error) throw new Error(error.message)

    let rows = data || []

    // Filtragem Segura no Backend para contas exclusivas de Família/Aluno (!isStaff)
    if (isRestrictedFamilyOrStudent && !idParam) {
      const norm = (s: any) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

      const { allTurmas, allGrupos } = turmasGruposRes

      const candidateStudentIds = new Set<string>(authorizedAlunoIds)
      const candidateRespIds = new Set<string>()
      const familyNamesNorm = new Set<string>()

      if (alunoId) candidateStudentIds.add(String(alunoId).trim())
      if (user.user_metadata?.aluno_id) candidateStudentIds.add(String(user.user_metadata.aluno_id).trim())
      if (user.user_metadata?.nome) familyNamesNorm.add(norm(user.user_metadata.nome))

      // Fallback apenas se getAuthorizedAlunoIdsForUser ainda não encontrou alunos vinculados
      if (candidateStudentIds.size === 0) {
        if (user.id) candidateRespIds.add(String(user.id).trim())
        if (user.user_metadata?.responsavel_id) candidateRespIds.add(String(user.user_metadata.responsavel_id).trim())
        if (user.user_metadata?.uid_legacy) candidateRespIds.add(String(user.user_metadata.uid_legacy).trim())

        const respOrConds: string[] = []
        if (user.id) {
          respOrConds.push(`dados->>auth_id.eq.${user.id}`)
          respOrConds.push(`dados->>user_id.eq.${user.id}`)
        }
        const userEmail = String(user.email || '').trim().toLowerCase()
        if (userEmail) {
          respOrConds.push(`email.ilike.${userEmail}`)
        }
        const nomeUser = user.user_metadata?.nome
        if (nomeUser) {
          const safeNome = String(nomeUser).replace(/["%,]/g, '').trim()
          if (safeNome.length >= 3) {
            respOrConds.push(`nome.ilike."%${safeNome}%"`)
          }
        }

        const sysConds: string[] = []
        if (user.id) sysConds.push(`id.eq.${user.id}`, `auth_id.eq.${user.id}`)
        if (userEmail) sysConds.push(`email.ilike.${userEmail}`)

        const [respRowsRes, sysDataRes] = await Promise.all([
          respOrConds.length > 0
            ? supabase.from('responsaveis').select('id, nome').or(respOrConds.join(',')).limit(10)
            : Promise.resolve({ data: [] }),
          sysConds.length > 0
            ? supabase.from('system_users').select('id, nome, dados').or(sysConds.join(',')).limit(5)
            : Promise.resolve({ data: [] })
        ])

        if (respRowsRes.data) {
          for (const r of respRowsRes.data as any[]) {
            if (r.id) candidateRespIds.add(String(r.id).trim())
            if (r.nome) familyNamesNorm.add(norm(r.nome))
          }
        }
        if (sysDataRes.data) {
          for (const s of sysDataRes.data as any[]) {
            const rId = s.dados?.responsavel_id || s.dados?.responsavelId
            if (rId) candidateRespIds.add(String(rId).trim())
            if (s.nome) familyNamesNorm.add(norm(s.nome))
          }
        }

        if (candidateRespIds.size > 0) {
          const { data: vincsByResp } = await supabase
            .from('aluno_responsavel')
            .select('aluno_id')
            .in('responsavel_id', Array.from(candidateRespIds))
          if (vincsByResp) {
            for (const v of vincsByResp as any[]) {
              if (v.aluno_id) candidateStudentIds.add(String(v.aluno_id).trim())
            }
          }
        }
      }

      let studentsList: any[] = []
      if (candidateStudentIds.size > 0) {
        const { data: alunosRows } = await supabase
          .from('alunos')
          .select('id, nome, turma, serie, turno, status, dados')
          .in('id', Array.from(candidateStudentIds))
        if (alunosRows && alunosRows.length > 0) {
          studentsList = alunosRows.map((a: any) => {
            if (a.nome) familyNamesNorm.add(norm(a.nome))
            const tObj = (allTurmas || []).find((t: any) =>
              t && (String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma) || t.nome === a.turma)
            )
            return {
              ...a,
              turma_nome: tObj?.nome || a.turma_nome || a.turma || '',
              turno_nome: tObj?.turno || a.turno_nome || a.turno || ''
            }
          })
        }
      }

      rows = rows.filter((row: any) => {
        const rawDados = row.dados && typeof row.dados === 'object' ? row.dados : {}
        const visUser = rawDados.visibilidadeUsuario || row.visibilidadeUsuario
        if (visUser && norm(visUser) !== 'todos') {
          const visNorm = norm(visUser)
          for (const fn of familyNamesNorm) {
            if (fn && (visNorm === fn || visNorm.includes(fn) || fn.includes(visNorm))) {
              return true
            }
          }
          return false
        }

        let targets: any = row.turmas || []
        if (typeof targets === 'string') {
          try { targets = JSON.parse(targets) } catch { targets = [targets] }
        }
        if (!Array.isArray(targets)) targets = []

        if (targets.length === 0) return true

        const isGlobal = targets.some((t: any) => {
          const tl = norm(t)
          return tl === 'todos' || tl === 'toda a escola' || tl === 'todas'
        })
        if (isGlobal) return true

        if (studentsList.length > 0) {
          return studentsList.some(student =>
            targets.some((t: any) => isTurmaOrGroupMatch(t, student, allTurmas || [], allGrupos || []))
          )
        }

        // Fallback se nenhum aluno foi resolvido ainda: permitir eventos universais do ano (ex: TODOS:2026)
        return targets.some((t: any) => String(t || '').trim().toLowerCase().startsWith('todos:'))
      })
    }

    const result = rows.map(row => {
      const rawDados = (row.dados && typeof row.dados === 'object') ? { ...row.dados } : {}
      delete rawDados.dados
      return {
        ...rawDados,
        ...row,
        dados: rawDados,
        horaInicio: row.hora_inicio || rawDados.horaInicio || rawDados.hora_inicio || '',
        horaFim: row.hora_fim || rawDados.horaFim || rawDados.hora_fim || '',
        criadoPor: row.criado_por || rawDados.criadoPor || rawDados.criado_por || '',
      }
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

interface SenderContext {
  userId?: string
  senderId?: string
  senderName?: string
  senderEmail?: string
  senderCargo?: string
  senderFoto?: string | null
}

/**
 * Dispara notificações push de calendário de forma consolidada por aluno e por dia (America/Campo_Grande).
 *
 * REGRA DE OURO:
 * Quando múltiplos eventos são adicionados (ou alterados) no mesmo dia para o mesmo aluno
 * (seja em um único lote de período data..dataFim ou em salvamentos separados ao longo do mesmo dia),
 * envia APENAS 1 notificação push de calendário por aluno naquele dia.
 */
async function dispatchCalendarPushNotificationsBatch(
  supabase: any,
  newRows: any[],
  updatedRows: any[],
  senderCtx?: SenderContext
) {
  const todayStr = getCampoGrandeDateStr()

  // 1. Consultar configurações globais de notificações (ad_config)
  let pushCalendarioEnabled = true
  let pushAlteracaoEnabled = true
  try {
    const { data: cfgRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'ad_config')
      .maybeSingle()
    const notifs = cfgRow?.valor?.notificacoes
    if (notifs) {
      if (notifs.pushCalendario === false) pushCalendarioEnabled = false
      if (notifs.pushAlteracaoCalendario === false) pushAlteracaoEnabled = false
    }
  } catch (err) {
    console.warn('[Eventos Push] Falha ao ler ad_config, mantendo padrão habilitado:', err)
  }

  if (!pushCalendarioEnabled) {
    return
  }

  // Filtrar apenas eventos com data atual ou futura (eventos passados adicionados retroativamente não disparam push)
  const eligibleNewRows = (newRows || []).filter((r) => !r.data || String(r.data) >= todayStr)
  const eligibleUpdatedRows = pushAlteracaoEnabled
    ? (updatedRows || []).filter((r) => !r.data || String(r.data) >= todayStr)
    : []

  const allEligibleRows = [...eligibleNewRows, ...eligibleUpdatedRows]
  if (allEligibleRows.length === 0) {
    return
  }

  // Invalidar cache em memória de lembretes para as datas afetadas
  const affectedDates = new Set<string>()
  for (const r of allEligibleRows) {
    if (r.data) {
      affectedDates.add(String(r.data))
      invalidateCalendarReminderCacheForDate(String(r.data))
    }
  }

  // 2. Consultar agenda_push_logs de HOJE (fuso America/Campo_Grande, GMT-0400)
  // para identificar alunos que JÁ receberam notificação de calendário hoje (excluindo lembretes).
  const startOfTodayIso = new Date(`${todayStr}T00:00:00-04:00`).toISOString()
  const { data: logsToday } = await supabase
    .from('agenda_push_logs')
    .select('item_id, status')
    .eq('type', 'calendario')
    .gte('created_at', startOfTodayIso)

  const alreadyNotifiedAlunosToday = new Set<string>()
  let colabAlreadyNotifiedToday = false
  const staleCalDiaKeysToClear = new Set<string>()

  for (const log of logsToday || []) {
    const itemIdStr = String(log.item_id || '')
    const st = String(log.status || '')

    // Ignorar logs de lembrete (véspera às 20h) — eles possuem controle próprio por data do evento
    if (itemIdStr.includes('-reminder') || itemIdStr.startsWith('cal_lembrete_')) {
      continue
    }

    const isCompletedStatus = st === 'sent' || st === 'pending' || st === 'skipped'
    const alunoMatch = itemIdStr.match(/_aluno_(\d+)$/)

    if (alunoMatch) {
      const alunoId = alunoMatch[1]
      if (isCompletedStatus) {
        alreadyNotifiedAlunosToday.add(alunoId)
      } else if (
        (st === 'failed' || st === 'paused') &&
        itemIdStr.startsWith(`cal_dia_${todayStr}-`)
      ) {
        staleCalDiaKeysToClear.add(itemIdStr)
      }
    } else if (itemIdStr.endsWith('_perfil_colaborador')) {
      if (isCompletedStatus && itemIdStr === `cal_dia_${todayStr}_perfil_colaborador`) {
        colabAlreadyNotifiedToday = true
      } else if (
        (st === 'failed' || st === 'paused') &&
        itemIdStr === `cal_dia_${todayStr}_perfil_colaborador`
      ) {
        staleCalDiaKeysToClear.add(itemIdStr)
      }
    }
  }

  // 3. Resolver destinatários de todos os eventos do lote (com cache de turmas para evitar queries repetidas)
  const targetResolutionCache = new Map<string, ResolvedEventTargets>()
  const studentBucketMap = new Map<
    string,
    {
      student: ResolvedEventTargetStudent
      newEvents: any[]
      updatedEvents: any[]
    }
  >()
  const colabNewEvents: any[] = []
  const colabUpdatedEvents: any[] = []
  const allDirectColabIds = new Set<string>()

  for (const row of eligibleNewRows) {
    const resolved = await resolveEventTargets(supabase, row, targetResolutionCache)
    for (const student of resolved.students || []) {
      if (!student.responsaveis_ids || student.responsaveis_ids.length === 0) continue
      const alunoKey = String(student.aluno_id)
      const bucket = studentBucketMap.get(alunoKey)
      if (!bucket) {
        studentBucketMap.set(alunoKey, {
          student: {
            aluno_id: alunoKey,
            aluno_nome: student.aluno_nome,
            responsaveis_ids: Array.from(new Set(student.responsaveis_ids)),
          },
          newEvents: [row],
          updatedEvents: [],
        })
      } else {
        bucket.newEvents.push(row)
        for (const rId of student.responsaveis_ids) {
          if (!bucket.student.responsaveis_ids.includes(rId)) {
            bucket.student.responsaveis_ids.push(rId)
          }
        }
      }
    }
    if (resolved.directColaboradores && resolved.directColaboradores.length > 0) {
      for (const cId of resolved.directColaboradores) allDirectColabIds.add(cId)
      colabNewEvents.push(row)
    }
  }

  for (const row of eligibleUpdatedRows) {
    const resolved = await resolveEventTargets(supabase, row, targetResolutionCache)
    for (const student of resolved.students || []) {
      if (!student.responsaveis_ids || student.responsaveis_ids.length === 0) continue
      const alunoKey = String(student.aluno_id)
      const bucket = studentBucketMap.get(alunoKey)
      if (!bucket) {
        studentBucketMap.set(alunoKey, {
          student: {
            aluno_id: alunoKey,
            aluno_nome: student.aluno_nome,
            responsaveis_ids: Array.from(new Set(student.responsaveis_ids)),
          },
          newEvents: [],
          updatedEvents: [row],
        })
      } else {
        bucket.updatedEvents.push(row)
        for (const rId of student.responsaveis_ids) {
          if (!bucket.student.responsaveis_ids.includes(rId)) {
            bucket.student.responsaveis_ids.push(rId)
          }
        }
      }
    }
    if (resolved.directColaboradores && resolved.directColaboradores.length > 0) {
      for (const cId of resolved.directColaboradores) allDirectColabIds.add(cId)
      colabUpdatedEvents.push(row)
    }
  }

  // Se havia algum registro 'failed' ou 'paused' para hoje que agora poderá ser reenviado, limpá-lo antes
  if (staleCalDiaKeysToClear.size > 0) {
    const keysArr = Array.from(staleCalDiaKeysToClear)
    for (let i = 0; i < keysArr.length; i += 100) {
      await supabase
        .from('agenda_push_logs')
        .delete()
        .eq('type', 'calendario')
        .in('item_id', keysArr.slice(i, i + 100))
        .in('status', ['failed', 'paused'])
    }
  }

  // 4. Disparar NO MÁXIMO 1 push imediato por aluno no dia (cal_dia_${todayStr}-${aluno_id})
  const studentEntries = Array.from(studentBucketMap.entries()).filter(
    ([alunoId]) => !alreadyNotifiedAlunosToday.has(alunoId)
  )

  if (studentEntries.length > 0) {
    const BATCH_SIZE = 20
    for (let i = 0; i < studentEntries.length; i += BATCH_SIZE) {
      const batch = studentEntries.slice(i, i + BATCH_SIZE)
      const batchPromises: Promise<any>[] = []

      for (const [alunoId, { student, newEvents, updatedEvents }] of batch) {
        alreadyNotifiedAlunosToday.add(alunoId)

        const allStudentEvents = [...newEvents, ...updatedEvents]
        const primaryEvent = newEvents[0] || updatedEvents[0]
        const nomeAluno = formatFriendlyStudentName(student.aluno_nome)

        // Deduplicar títulos de eventos (para que eventos de múltiplos dias com o mesmo título, ex: Recesso Criativo,
        // exibam o título de forma limpa sem repetição)
        const uniqueTitles: string[] = []
        const seenNormTitles = new Set<string>()
        for (const ev of allStudentEvents) {
          const cleanTitle = String(ev.titulo || 'Evento Escolar').trim()
          const normTitle = cleanTitle.toLowerCase()
          if (cleanTitle && !seenNormTitles.has(normTitle)) {
            seenNormTitles.add(normTitle)
            uniqueTitles.push(cleanTitle)
          }
        }

        const isNewAddition = newEvents.length > 0
        let title = '📅 Novo Evento!'
        let message = ''

        if (isNewAddition) {
          if (uniqueTitles.length <= 1) {
            title = '📅 Novo Evento!'
            message = `Novo evento no calendário para a turma de ${nomeAluno}: ${uniqueTitles[0] || primaryEvent.titulo}. Confira os detalhes!`
          } else {
            title = '📅 Novos Eventos no Calendário!'
            const listed =
              uniqueTitles.slice(0, 2).join(', ') +
              (uniqueTitles.length > 2 ? ` e mais ${uniqueTitles.length - 2}` : '')
            message = `Novos eventos no calendário para a turma de ${nomeAluno}: ${listed}. Confira os detalhes!`
          }
        } else {
          title = '📅 Calendário Atualizado!'
          if (uniqueTitles.length <= 1) {
            message = `Evento atualizado no calendário para a turma de ${nomeAluno}: ${uniqueTitles[0] || primaryEvent.titulo}. Confira os detalhes!`
          } else {
            const listed =
              uniqueTitles.slice(0, 2).join(', ') +
              (uniqueTitles.length > 2 ? ` e mais ${uniqueTitles.length - 2}` : '')
            message = `Eventos atualizados no calendário para a turma de ${nomeAluno}: ${listed}. Confira os detalhes!`
          }
        }

        const senderMeta = senderCtx
          ? {
              sender_id: senderCtx.senderId || senderCtx.userId || null,
              sender_auth_id: senderCtx.userId || null,
              sender_name: senderCtx.senderName || primaryEvent.criado_por || null,
              sender_email: senderCtx.senderEmail || null,
              sender_cargo: senderCtx.senderCargo || null,
              sender_foto: senderCtx.senderFoto || null,
            }
          : {}

        const dailyStudentItemId = `cal_dia_${todayStr}-${student.aluno_id}`
        const studentTargetUrl = `/agenda-digital/${student.aluno_id}/calendario?id=${encodeURIComponent(String(primaryEvent.id))}&data=${encodeURIComponent(String(primaryEvent.data || todayStr))}`

        batchPromises.push(
          sendAgendaPushNotification({
            type: 'calendario',
            itemId: dailyStudentItemId,
            senderUserId: senderCtx?.userId,
            title,
            message,
            targetUserIds: student.responsaveis_ids,
            targetUrl: studentTargetUrl,
            collapseId: `cal_dia_${todayStr}_${student.aluno_id}`,
            metadata: {
              aluno_id: student.aluno_id,
              aluno_nome: nomeAluno,
              perfil_destino: 'familia',
              item_id: String(primaryEvent.id),
              event_ids: allStudentEvents.map((e: any) => String(e.id)),
              rota: 'calendario',
              data: primaryEvent.data,
              targetUrl: studentTargetUrl,
              ...senderMeta,
            },
          }).catch((err) => console.error('Evento Push Error:', err))
        )
      }

      await Promise.allSettled(batchPromises)
    }
  }

  // 5. Disparar NO MÁXIMO 1 push imediato para colaboradores diretos no dia
  if (allDirectColabIds.size > 0 && !colabAlreadyNotifiedToday) {
    const allColabEvents = [...colabNewEvents, ...colabUpdatedEvents]
    const primaryEvent = allColabEvents[0] || allEligibleRows[0]
    const uniqueTitles: string[] = []
    const seenNormTitles = new Set<string>()
    for (const ev of allColabEvents) {
      const cleanTitle = String(ev.titulo || 'Evento Escolar').trim()
      const normTitle = cleanTitle.toLowerCase()
      if (cleanTitle && !seenNormTitles.has(normTitle)) {
        seenNormTitles.add(normTitle)
        uniqueTitles.push(cleanTitle)
      }
    }

    const colabMessage =
      uniqueTitles.length <= 1
        ? `O evento "${uniqueTitles[0] || primaryEvent.titulo}" foi adicionado à sua agenda.`
        : `Novos eventos foram adicionados à sua agenda: ${uniqueTitles.slice(0, 2).join(', ')}.`

    const senderMeta = senderCtx
      ? {
          sender_id: senderCtx.senderId || senderCtx.userId || null,
          sender_auth_id: senderCtx.userId || null,
          sender_name: senderCtx.senderName || primaryEvent.criado_por || null,
          sender_email: senderCtx.senderEmail || null,
          sender_cargo: senderCtx.senderCargo || null,
          sender_foto: senderCtx.senderFoto || null,
        }
      : {}

    const colabTargetUrl = `/agenda-digital/colaborador/calendario?id=${encodeURIComponent(String(primaryEvent.id))}&data=${encodeURIComponent(String(primaryEvent.data || todayStr))}`

    await sendAgendaPushNotification({
      type: 'calendario',
      itemId: `cal_dia_${todayStr}`,
      senderUserId: senderCtx?.userId,
      title: '📅 Novo Evento!',
      message: colabMessage,
      targetUserIds: Array.from(allDirectColabIds),
      targetUrl: colabTargetUrl,
      collapseId: `cal_dia_${todayStr}_colab`,
      metadata: {
        perfil_destino: 'colaborador',
        item_id: String(primaryEvent.id),
        event_ids: allColabEvents.map((e: any) => String(e.id)),
        rota: 'calendario',
        data: primaryEvent.data,
        targetUrl: colabTargetUrl,
        ...senderMeta,
      },
    }).catch((err) => console.error('Evento Push Colab Error:', err))
  }

  // 6. Se algum dos eventos criados/atualizados ocorre amanhã (véspera às 20:00 MS dentro das próximas 24h),
  // acionar a rotina consolidada de lembretes para aquela data (garantindo apenas 1 lembrete por aluno na data).
  for (const eventDateStr of affectedDates) {
    const { diffHours } = getEve20hSchedule(eventDateStr)
    const shouldSendReminder = diffHours > 0 && diffHours <= 24
    if (shouldSendReminder) {
      await runCalendarRemindersForDate({
        supabase,
        targetDate: eventDateStr,
        senderUserId: senderCtx?.userId,
        source: 'criacao_evento_calendario',
        allowScheduleAhead: true,
      }).catch((err) => console.error(`[Eventos Reminder Schedule Error][${eventDateStr}]:`, err))
    }
  }
}

export async function POST(request: Request) {
  const { user, dbUser, cargo, perfil, errorResponse } = await requireStaff(request)
  if (errorResponse || !user) return errorResponse!

  const senderCtx: SenderContext = {
    userId: user.id,
    senderId: dbUser?.id || user.id,
    senderName: dbUser?.nome || user.user_metadata?.nome || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Colaborador'),
    senderEmail: dbUser?.email || user.email,
    senderCargo: cargo || perfil || dbUser?.cargo || dbUser?.perfil || 'Colaborador(a)',
    senderFoto: dbUser?.dados?.foto || dbUser?.dados?.avatar || user.user_metadata?.foto || null,
  }

  try {
    const body = await request.json()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(b => buildRowAuth(b, senderCtx.senderName))

      // Buscar eventos existentes em lotes de 200 para evitar estouro de URL no PostgREST
      const existingMap = new Map<string, any>()
      const allIds = rows.map(r => r.id).filter(Boolean)
      const CHUNK_SIZE = 200
      for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
        const chunkIds = allIds.slice(i, i + CHUNK_SIZE)
        const { data: existingChunk, error: fetchErr } = await supabase
          .from('eventos_agenda')
          .select('id, titulo, data, turmas')
          .in('id', chunkIds)
        if (fetchErr) {
          throw new Error(`Falha ao verificar eventos existentes: ${fetchErr.message}`)
        }
        for (const e of existingChunk || []) {
          existingMap.set(e.id, e)
        }
      }

      const newRows: any[] = []
      const updatedRows: any[] = []
      const rowsToUpsert: any[] = []
      const isFullArraySync = rows.length > 15
      const nowMs = Date.now()

      for (const r of rows) {
        const prev = existingMap.get(r.id)
        if (!prev) {
          // Proteção contra ressurreição de eventos excluídos quando uma aba antiga envia o array completo via setEventosAgenda:
          // Se for sincronização de array completo e o item possuir createdAt com mais de 10 minutos, ele já havia sido excluído no banco.
          if (isFullArraySync) {
            const rawCreatedAt = r.dados?.createdAt || r.dados?.created_at || (r as any).created_at
            const createdMs = rawCreatedAt ? Date.parse(String(rawCreatedAt)) : NaN
            if (!isNaN(createdMs) && nowMs - createdMs > 10 * 60 * 1000) {
              continue
            }
          }
          newRows.push(r)
          rowsToUpsert.push(r)
        } else {
          rowsToUpsert.push(r)
          const titleChanged = prev.titulo !== r.titulo
          const dateChanged = prev.data !== r.data
          const turmasChanged = JSON.stringify(prev.turmas || []) !== JSON.stringify(r.turmas || [])
          if (titleChanged || dateChanged || turmasChanged) {
            updatedRows.push(r)
          }
        }
      }

      if (rowsToUpsert.length > 0) {
        const { error } = await supabase.from('eventos_agenda').upsert(rowsToUpsert)
        if (error) throw new Error(error.message)
      }

      if (newRows.length > 0 || updatedRows.length > 0) {
        await dispatchCalendarPushNotificationsBatch(supabase, newRows, updatedRows, senderCtx)
      }

      return NextResponse.json({
        ok: true,
        count: rowsToUpsert.length,
        newCount: newRows.length,
        updatedCount: updatedRows.length,
      })
    }

    const row = buildRowAuth(body, senderCtx.senderName)
    const { data: prevRow } = await supabase
      .from('eventos_agenda')
      .select('id, titulo, data, turmas')
      .eq('id', row.id)
      .maybeSingle()

    const { data, error } = await supabase.from('eventos_agenda').upsert(row).select().single()
    if (error) throw new Error(error.message)

    if (!prevRow) {
      await dispatchCalendarPushNotificationsBatch(supabase, [data], [], senderCtx)
    } else {
      const hasChanges =
        prevRow.titulo !== row.titulo ||
        prevRow.data !== row.data ||
        JSON.stringify(prevRow.turmas || []) !== JSON.stringify(row.turmas || [])
      if (hasChanges) {
        await dispatchCalendarPushNotificationsBatch(supabase, [], [data], senderCtx)
      }
    }

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  return POST(request)
}

function buildRowAuth(body: any, fallbackAuthor?: string) {
  const {
    id, titulo, descricao, tipo, data,
    horaInicio, hora_inicio,
    horaFim, hora_fim,
    turmas, local, cor, recorrente,
    criadoPor, criado_por,
    unidade, created_at, updated_at,
    dados,
    ...rest
  } = body
  const baseDados = (dados && typeof dados === 'object') ? { ...dados } : {}
  delete baseDados.dados
  return {
    id: id || crypto.randomUUID(),
    titulo: titulo || 'Evento sem título',
    descricao: descricao || '',
    tipo: tipo || 'evento',
    data: data || '',
    hora_inicio: horaInicio ?? hora_inicio ?? '',
    hora_fim: horaFim ?? hora_fim ?? '',
    turmas: Array.isArray(turmas) ? turmas : [],
    local: local || '',
    cor: cor || '#f59e0b',
    recorrente: recorrente || false,
    criado_por: criadoPor ?? criado_por ?? fallbackAuthor ?? '',
    unidade: unidade || '',
    dados: { ...baseDados, ...rest },
  }
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(request.url)
    let id = url.searchParams.get('id')

    if (!id) {
      try {
        const body = await request.json()
        if (body?.id) id = body.id
      } catch (e) {
        // Sem corpo JSON
      }
    }

    if (!id || !String(id).trim()) {
      return NextResponse.json(
        { error: 'O parâmetro id é obrigatório para exclusão de evento.' },
        { status: 400 }
      )
    }

    const cleanId = String(id).trim()
    const { data: existingEv } = await supabase
      .from('eventos_agenda')
      .select('data')
      .eq('id', cleanId)
      .maybeSingle()

    const { error } = await supabase.from('eventos_agenda').delete().eq('id', cleanId)
    if (error) throw new Error(error.message)

    if (existingEv?.data) {
      invalidateCalendarReminderCacheForDate(String(existingEv.data))
    }

    return NextResponse.json({ ok: true, id: cleanId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

