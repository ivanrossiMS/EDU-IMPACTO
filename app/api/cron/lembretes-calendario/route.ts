/**
 * app/api/cron/lembretes-calendario/route.ts
 *
 * Robô Diário de Notificações de Véspera do Calendário Escolar.
 *
 * Execução:
 * - Agendado no Vercel Cron diariamente às 00:00 UTC (20:00 MS / GMT-0400).
 * - Identifica eventos escolares da data de amanhã (fuso MS: America/Campo_Grande).
 * - Dispara push notification de lembrete com nome do aluno para os responsáveis e colaboradores.
 * - Anti-duplicidade atômica via agenda_push_logs (item_id: {eventoId}-{alunoId}-reminder).
 */

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'
import { requireAuth } from '@/lib/server/authGuard'
import { getPushPauseStatus } from '@/lib/server/pushPauseService'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getSupabaseAdmin() {
  return getAdminClient()
}

function getTomorrowDateStr(targetTimezone = 'America/Campo_Grande'): string {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: targetTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrow)
}

async function verifyCallerAuth(request: Request): Promise<{ authorized: boolean; reason?: string }> {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { authorized: true }
  }

  if (!process.env.CRON_SECRET && request.headers.get('x-vercel-cron') === '1') {
    return { authorized: true }
  }

  const host = request.headers.get('host') || ''
  if (process.env.NODE_ENV === 'development' && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    return { authorized: true }
  }

  const { user, errorResponse } = await requireAuth(request)
  if (!errorResponse && user) {
    const supabase = getSupabaseAdmin()
    const conds: string[] = []
    if (user.id) conds.push(`id.eq.${user.id}`, `auth_id.eq.${user.id}`)
    if (user.email) conds.push(`email.ilike.${user.email.trim()}`)
    const { data: dbUser } = await supabase
      .from('system_users')
      .select('perfil, cargo, status')
      .or(conds.join(','))
      .limit(1)
      .maybeSingle()

    if (dbUser && String(dbUser.status || 'ativo').toLowerCase() !== 'inativo') {
      const ALLOWED_ROLES = [
        'Master', 'Direção', 'Diretor Geral', 'Administrador', 'Administrador Master',
        'Admin', 'Financeiro', 'Secretaria', 'Coordenação'
      ]
      const perfil = dbUser.perfil || ''
      const cargo = dbUser.cargo || ''

      if (ALLOWED_ROLES.some(r => perfil.includes(r) || cargo.includes(r))) {
        return { authorized: true }
      }
    }
  }

  return { authorized: false, reason: 'Unauthorized: Requer token de cron ou perfil administrativo.' }
}

async function runCalendarRemindersRoutine(options: { targetDate?: string } = {}) {
  const supabase = getSupabaseAdmin()
  const logPrefix = '[Cron Lembretes Calendário]'

  // 1. Checagem de configuração global
  const { data: configRow } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'ad_config')
    .maybeSingle()

  if (configRow?.valor?.notificacoes?.pushCalendario === false) {
    console.log(`${logPrefix} Notificações de calendário desativadas em ad_config. Abortando.`)
    return { ok: true, skipped: true, reason: 'pushCalendario_disabled' }
  }

  // 2. Checagem de pausa global
  const pauseStatus = await getPushPauseStatus()
  if (pauseStatus.paused) {
    console.log(`${logPrefix} Notificações push estão pausadas globalmente. Abortando.`)
    return { ok: true, skipped: true, reason: 'notifications_paused' }
  }

  // 3. Definir a data alvo (amanhã por padrão)
  const targetDate = options.targetDate || getTomorrowDateStr()
  console.log(`${logPrefix} Buscando eventos para a data: ${targetDate}`)

  const { data: eventos, error: errEv } = await supabase
    .from('eventos_agenda')
    .select('*')
    .eq('data', targetDate)

  if (errEv) {
    console.error(`${logPrefix} Erro ao buscar eventos:`, errEv.message)
    throw new Error(errEv.message)
  }

  if (!eventos || eventos.length === 0) {
    console.log(`${logPrefix} Nenhum evento agendado para ${targetDate}.`)
    return { ok: true, targetDate, eventsCount: 0, totalPushesSent: 0 }
  }

  console.log(`${logPrefix} Encontrados ${eventos.length} evento(s) para ${targetDate}. Processando...`)

  let totalPushesSent = 0
  let totalPushesSkipped = 0
  const results = []

  for (const row of eventos) {
    const rowDados = row.dados || {}
    const turmasList = Array.isArray(row.turmas) ? row.turmas : (Array.isArray(rowDados.turmas) ? rowDados.turmas : [])
    const isTodos = turmasList.length === 0 || turmasList.some((t: any) => typeof t === 'string' && (t.toLowerCase().includes('todos') || t.toLowerCase().includes('toda a escola')))

    const targetParams = {
      turmas: turmasList,
      targetClasses: turmasList,
      grupos: rowDados.grupos || rowDados.targetGrupos || [],
      colaboradoresIds: rowDados.colaboradoresIds || rowDados.funcionariosIds || [],
      funcionariosIds: rowDados.funcionariosIds || rowDados.colaboradoresIds || [],
      alunosIds: rowDados.alunosIds || rowDados.targetStudents || [],
      destino: isTodos ? 'todos' : (rowDados.destino || 'selecionados')
    }

    const { students, directColaboradores } = await getStudentTargetsForComunicados(targetParams)

    // Handle visibilidadeUsuario
    const visibilidadeUsuario = row.dados?.visibilidadeUsuario || row.visibilidadeUsuario
    if (visibilidadeUsuario && visibilidadeUsuario !== 'Todos') {
      const { data: sysUser } = await supabase.from('system_users').select('id').ilike('nome', visibilidadeUsuario).maybeSingle()
      if (sysUser?.id) {
        directColaboradores.push(String(sysUser.id))
      } else {
        const { data: respUser } = await supabase.from('responsaveis').select('id').ilike('nome', visibilidadeUsuario).maybeSingle()
        if (respUser?.id) {
          directColaboradores.push(String(respUser.id))
        } else {
          const { data: alunoUser } = await supabase.from('alunos').select('id, nome').ilike('nome', visibilidadeUsuario).maybeSingle()
          if (alunoUser?.id) {
            const { data: vincs } = await supabase.from('aluno_responsavel').select('responsavel_id').eq('aluno_id', alunoUser.id)
            const responsaveis_ids = [String(alunoUser.id)]
            vincs?.forEach((v: any) => responsaveis_ids.push(String(v.responsavel_id)))
            students.push({
              aluno_id: String(alunoUser.id),
              aluno_nome: alunoUser.nome || 'Aluno',
              responsaveis_ids
            })
          }
        }
      }
    }

    // 1. Enviar para responsáveis/alunos
    let studentSent = 0
    let studentSkipped = 0
    if (students.length > 0) {
      const CHUNK_SIZE = 50
      for (let i = 0; i < students.length; i += CHUNK_SIZE) {
        const chunk = students.slice(i, i + CHUNK_SIZE)
        const promises = chunk.map(student => {
          if (!student.responsaveis_ids || student.responsaveis_ids.length === 0) return Promise.resolve(null)
          const nomeAluno = formatFriendlyStudentName(student.aluno_nome)
          return sendAgendaPushNotification({
            type: 'calendario',
            itemId: `${row.id}-${student.aluno_id}-reminder`,
            title: '⏰ Lembrete: Amanhã!',
            message: `Lembrete para ${nomeAluno}: amanhã temos o evento ${row.titulo}. Não se esqueça!`,
            targetUserIds: student.responsaveis_ids,
            targetUrl: `/agenda-digital/${student.aluno_id}/calendario?id=${row.id}`,
            metadata: {
              aluno_id: student.aluno_id,
              perfil_destino: 'familia',
              item_id: String(row.id),
              rota: 'calendario',
              data: row.data,
              targetUrl: `/agenda-digital/${student.aluno_id}/calendario?id=${row.id}`,
              is_reminder: true,
            }
          }).then(res => {
            if (res.success && !res.skipped) studentSent++
            else studentSkipped++
            return res
          }).catch(err => {
            console.error(`${logPrefix} Erro no push do aluno ${student.aluno_id}:`, err?.message)
            studentSkipped++
            return null
          })
        })
        await Promise.allSettled(promises)
      }
    }

    // 2. Enviar para colaboradores
    let colabSent = 0
    let colabSkipped = 0
    if (directColaboradores.length > 0) {
      const cleanColabs = Array.from(new Set(directColaboradores))
      const res = await sendAgendaPushNotification({
        type: 'calendario',
        itemId: `${row.id}-reminder`,
        title: '⏰ Lembrete: Amanhã!',
        message: `Amanhã temos o evento: ${row.titulo}. Não se esqueça!`,
        targetUserIds: cleanColabs,
        targetUrl: `/agenda-digital/colaborador/calendario?id=${row.id}`,
        metadata: {
          perfil_destino: 'colaborador',
          item_id: String(row.id),
          rota: 'calendario',
          data: row.data,
          targetUrl: `/agenda-digital/colaborador/calendario?id=${row.id}`,
          is_reminder: true,
        }
      }).catch(err => {
        console.error(`${logPrefix} Erro no push colaboradores:`, err?.message)
        return { success: false }
      })

      if (res?.success && !(res as any)?.skipped) colabSent++
      else colabSkipped++
    }

    totalPushesSent += (studentSent + colabSent)
    totalPushesSkipped += (studentSkipped + colabSkipped)

    results.push({
      eventoId: row.id,
      titulo: row.titulo,
      targetDate: row.data,
      studentsTargeted: students.length,
      colaboradoresTargeted: directColaboradores.length,
      studentPushesSent: studentSent,
      colaboradorPushesSent: colabSent
    })
  }

  console.log(`${logPrefix} Concluído. Pushes enviados: ${totalPushesSent}, ignorados/duplicados: ${totalPushesSkipped}`)
  return {
    ok: true,
    targetDate,
    eventsProcessed: eventos.length,
    totalPushesSent,
    totalPushesSkipped,
    results
  }
}

export async function GET(request: Request) {
  const auth = await verifyCallerAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const targetDate = url.searchParams.get('data') || undefined

  try {
    const result = await runCalendarRemindersRoutine({ targetDate })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Cron Lembretes Calendário GET Error]:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao processar cron.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await verifyCallerAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {}

  const url = new URL(request.url)
  const targetDate = body?.targetDate || url.searchParams.get('data') || undefined

  try {
    const result = await runCalendarRemindersRoutine({ targetDate })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Cron Lembretes Calendário POST Error]:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao processar cron.' }, { status: 500 })
  }
}
