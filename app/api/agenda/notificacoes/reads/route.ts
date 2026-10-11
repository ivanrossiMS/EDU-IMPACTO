import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agenda/notificacoes/reads
 * Retorna lista de IDs de notificações que já foram lidas por este usuário.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const systemUserId = searchParams.get('systemUserId')
    const colaboradorId = searchParams.get('colaboradorId')

    const userIds = [userId, systemUserId, colaboradorId]
      .filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim().length > 0))
      .map(id => id.trim())

    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, reads: [] })
    }

    const { data, error } = await supabaseServer
      .from('agenda_notification_reads')
      .select('content_id')
      .in('usuario_id', userIds)
      .limit(3000)

    if (error) {
      console.warn('[NotifReads API] Erro ao buscar leituras no Supabase:', error.message)
      return NextResponse.json({ ok: true, reads: [] })
    }

    const reads = Array.from(
      new Set(
        (data || [])
          .map((r: any) => String(r.content_id || '').trim())
          .filter(Boolean)
      )
    )

    return NextResponse.json({ ok: true, reads })
  } catch (err: any) {
    console.error('[NotifReads API] Erro inesperado no GET:', err)
    return NextResponse.json({ ok: false, reads: [], error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/agenda/notificacoes/reads
 * Registra leitura de uma ou mais notificações para um colaborador individual.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, perfil = 'colaborador', items } = body

    if (!userId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const records: any[] = []
    const seen = new Set<string>()

    for (const item of items) {
      if (!item) continue
      const type = String(item.type || 'geral').trim()
      const rawId = item.rawId ? String(item.rawId).trim() : ''
      const notifId = item.id ? String(item.id).trim() : ''

      if (notifId) {
        const key = `${userId}::${type}::${notifId}`
        if (!seen.has(key)) {
          seen.add(key)
          records.push({
            usuario_id: String(userId),
            perfil: String(perfil),
            content_type: type,
            content_id: notifId,
            read_at: now
          })
        }
      }

      if (rawId && rawId !== notifId) {
        const rawKey = `${userId}::${type}::${rawId}`
        if (!seen.has(rawKey)) {
          seen.add(rawKey)
          records.push({
            usuario_id: String(userId),
            perfil: String(perfil),
            content_type: type,
            content_id: rawId,
            read_at: now
          })
        }
      }
    }

    if (records.length > 0) {
      const { error } = await supabaseServer
        .from('agenda_notification_reads')
        .upsert(records, { onConflict: 'usuario_id,content_type,content_id' })

      if (error) {
        console.warn('[NotifReads API] Erro no upsert de agenda_notification_reads:', error.message)
      }
    }

    return NextResponse.json({ ok: true, count: records.length })
  } catch (err: any) {
    console.error('[NotifReads API] Erro inesperado no POST:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
