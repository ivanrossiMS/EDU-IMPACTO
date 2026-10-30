/**
 * app/api/cron/lembretes-calendario/route.ts
 *
 * Robô Diário de Notificações de Véspera do Calendário Escolar.
 *
 * Execução:
 * - Agendado no Vercel Cron diariamente às 00:00 UTC (20:00 MS / GMT-0400) e também
 *   acionado oportunisticamente pelo motor de lembretes (calendarReminders.ts) no Netlify.
 * - Identifica eventos escolares da data de amanhã (fuso MS: America/Campo_Grande).
 * - Consolida múltiplos eventos da mesma data por aluno, disparando NO MÁXIMO 1 push
 *   de lembrete por aluno para aquela data.
 */

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { requireAuth } from '@/lib/server/authGuard'
import {
  getTomorrowCampoGrandeDateStr,
  runCalendarRemindersForDate,
} from '@/lib/server/calendarReminders'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getSupabaseAdmin() {
  return getAdminClient()
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

export async function GET(request: Request) {
  const auth = await verifyCallerAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true' || url.searchParams.get('dry_run') === 'true'
  const customDate = url.searchParams.get('date') || url.searchParams.get('data')

  const targetDate = customDate || getTomorrowCampoGrandeDateStr()
  console.log(`[Cron Lembretes Calendário] Iniciando verificação para a data: ${targetDate} (dryRun=${dryRun})`)

  const supabase = getSupabaseAdmin()

  try {
    const summary = await runCalendarRemindersForDate({
      supabase,
      targetDate,
      dryRun,
      source: 'cron_lembrete_calendario',
      allowScheduleAhead: true,
    })

    console.log('[Cron Lembretes Calendário] Execução concluída:', JSON.stringify(summary))
    return NextResponse.json(summary)
  } catch (err: any) {
    console.error('[Cron Lembretes Calendário GET Error]:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao processar cron.' }, { status: 500 })
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
  const dryRun = Boolean(body?.dryRun || url.searchParams.get('dryRun') === 'true' || url.searchParams.get('dry_run') === 'true')
  const targetDate = body?.targetDate || body?.date || body?.data || url.searchParams.get('date') || url.searchParams.get('data') || getTomorrowCampoGrandeDateStr()

  const supabase = getSupabaseAdmin()

  try {
    const summary = await runCalendarRemindersForDate({
      supabase,
      targetDate,
      dryRun,
      source: 'cron_lembrete_calendario',
      allowScheduleAhead: true,
    })
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[Cron Lembretes Calendário POST Error]:', error)
    return NextResponse.json({ error: error.message || 'Erro interno ao processar cron.' }, { status: 500 })
  }
}
