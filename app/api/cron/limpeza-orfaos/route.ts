/**
 * app/api/cron/limpeza-orfaos/route.ts
 *
 * Endpoint do robô de limpeza automática de arquivos órfãos no Supabase Storage.
 *
 * Execução automática:
 * - Agendado no Vercel Cron diariamente às 03:00 UTC.
 * - Checa a regra dos 30 dias: só efetua a faxina se já transcorreram 30 dias desde a última execução.
 * - Suporta execução forçada via query string ?force=true para testes e acionamento manual.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  runOrphanCleanup,
  getStorageAutoCleanConfig,
  updateStorageAutoCleanConfig,
} from '@/lib/server/orphanStorageCleaner'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Permite até 2 minutos para processamento de limpeza em lote

async function verifyCallerAuth(request: Request): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Token secreto de cron (Vercel Cron ou serviço externo)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { authorized: true }
  }

  // 2. Header oficial do Vercel Cron
  if (request.headers.get('x-vercel-cron') === '1' || request.headers.get('user-agent')?.includes('vercel-cron')) {
    return { authorized: true }
  }

  // 3. Chamadas internas em localhost
  const host = request.headers.get('host') || ''
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return { authorized: true }
  }

  // 3. Usuário autenticado com perfil administrativo
  try {
    const { user, errorResponse } = await requireAuth()
    if (!errorResponse && user) {
      const supabase = getAdminClient()
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('perfil, cargo')
        .eq('id', user.id)
        .maybeSingle()

      const ALLOWED_ROLES = [
        'Direção',
        'Diretor Geral',
        'Administrador',
        'Administrador Master',
        'Admin',
        'Master',
      ]
      const perfil = dbUser?.perfil || (user.user_metadata?.perfil as string) || ''
      const cargo = dbUser?.cargo || (user.user_metadata?.cargo as string) || ''

      if (ALLOWED_ROLES.some((r) => perfil.includes(r) || cargo.includes(r))) {
        return { authorized: true }
      }
    }
  } catch {}

  return { authorized: false, reason: 'Unauthorized: Requer token de cron ou perfil administrativo.' }
}

export async function GET(request: Request) {
  const auth = await verifyCallerAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'
  const infoOnly = url.searchParams.get('info') === 'true'

  if (infoOnly) {
    const config = await getStorageAutoCleanConfig()
    return NextResponse.json({ config })
  }

  try {
    const result = await runOrphanCleanup({
      force,
      triggeredBy: force ? 'admin' : 'cron',
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Cron Limpeza Órfãos GET Error]:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar limpeza de órfãos.' },
      { status: 500 }
    )
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
  const force = body?.force === true || url.searchParams.get('force') === 'true'

  // Atualizar configurações caso enviado no payload
  if (body?.config && typeof body.config === 'object') {
    const updated = await updateStorageAutoCleanConfig(body.config)
    return NextResponse.json({ ok: true, config: updated })
  }

  try {
    const result = await runOrphanCleanup({
      force,
      triggeredBy: force ? 'admin' : 'cron',
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Cron Limpeza Órfãos POST Error]:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar limpeza de órfãos.' },
      { status: 500 }
    )
  }
}
