import { supabaseServer } from '@/lib/supabaseServer'

// Cache curto caso a tabela agenda_notification_deliveries ainda não tenha sido migrada no banco
let deliveriesTableMissingUntil = 0
const TABLE_CHECK_COOLDOWN_MS = 5 * 60 * 1000

function isMissingTableError(error: any): boolean {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '').toLowerCase()
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  )
}

export interface DeliveryRecordInput {
  usuario_id: string
  perfil: 'familiar' | 'aluno' | 'colaborador' | 'admin'
  content_type?: string
  content_id: string
  aluno_id?: string | null
  channel?: 'feed' | 'push'
}

/**
 * Registra em lote a entrega efetiva de comunicados no feed do usuário (não bloqueante).
 * Caso a tabela `agenda_notification_deliveries` ainda não exista no ambiente,
 * silencia o erro por 5 minutos para não impactar a performance do feed.
 */
export async function recordFeedDeliveries(items: DeliveryRecordInput[]): Promise<void> {
  if (!items || items.length === 0) return
  if (Date.now() < deliveriesTableMissingUntil) return

  try {
    const nowIso = new Date().toISOString()
    const uniqueMap = new Map<string, any>()

    for (const item of items) {
      const uid = String(item.usuario_id || '').trim()
      const cid = String(item.content_id || '').trim()
      if (!uid || !cid) continue

      const ctype = String(item.content_type || 'comunicado').trim()
      const alunoId = item.aluno_id ? String(item.aluno_id).trim() : null
      const dedupKey = `${uid}::${ctype}::${cid}::${alunoId || 'none'}`

      if (!uniqueMap.has(dedupKey)) {
        uniqueMap.set(dedupKey, {
          usuario_id: uid,
          perfil: item.perfil || 'familiar',
          content_type: ctype,
          content_id: cid,
          aluno_id: alunoId,
          channel: item.channel || 'feed',
          delivered_at: nowIso,
        })
      }
    }

    const rows = Array.from(uniqueMap.values())
    if (rows.length === 0) return

    // Insert ignoring duplicates so we preserve the FIRST delivery timestamp
    const { error } = await supabaseServer
      .from('agenda_notification_deliveries')
      .upsert(rows, {
        onConflict: 'usuario_id,content_type,content_id,COALESCE(aluno_id, \'none\')',
        ignoreDuplicates: true,
      })

    if (error) {
      if (isMissingTableError(error)) {
        deliveriesTableMissingUntil = Date.now() + TABLE_CHECK_COOLDOWN_MS
        return
      }
      // Fallback: if expression index name isn't matched by PostgREST onConflict, try plain insert ignoring 23505
      const { error: fallbackErr } = await supabaseServer
        .from('agenda_notification_deliveries')
        .insert(rows)
      if (fallbackErr && isMissingTableError(fallbackErr)) {
        deliveriesTableMissingUntil = Date.now() + TABLE_CHECK_COOLDOWN_MS
      }
    }
  } catch {
    // Non-critical telemetry: never break caller
  }
}

export interface DeliveryRow {
  usuario_id: string
  content_id: string
  aluno_id: string | null
  channel: string | null
  delivered_at: string
}

/**
 * Busca registros de entrega para uma lista de content_ids (retorna [] se a tabela não existir).
 */
export async function fetchDeliveriesForContentIds(contentIds: string[]): Promise<DeliveryRow[]> {
  if (!contentIds || contentIds.length === 0) return []
  if (Date.now() < deliveriesTableMissingUntil) return []

  try {
    const CHUNK_SIZE = 120
    const results: DeliveryRow[] = []

    for (let i = 0; i < contentIds.length; i += CHUNK_SIZE) {
      const chunk = contentIds.slice(i, i + CHUNK_SIZE)
      const { data, error } = await supabaseServer
        .from('agenda_notification_deliveries')
        .select('usuario_id, content_id, aluno_id, channel, delivered_at')
        .in('content_id', chunk)

      if (error) {
        if (isMissingTableError(error)) {
          deliveriesTableMissingUntil = Date.now() + TABLE_CHECK_COOLDOWN_MS
          return []
        }
        continue
      }
      if (Array.isArray(data)) {
        results.push(...(data as DeliveryRow[]))
      }
    }

    return results
  } catch {
    return []
  }
}
