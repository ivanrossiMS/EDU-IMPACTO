import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const limit = limitParam ? parseInt(limitParam, 10) : 30
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0

    const accessStartDate = await getLoggedUserAccessStartDate(true)
    let query = supabase.from('momentos').select('*')
    if (accessStartDate) {
      query = query.gte('created_at', accessStartDate.toISOString())
    }
    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (error) throw new Error(error.message)
    const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) {
         // Se array vazio, talvez queira apagar tudo? 
         // O useSupabaseArray manda o estado atual. Se mandou [], apaga o que não está no []?
         // Na vdd upsert([]) não faz nada. 
         return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(buildRowAuth)
      console.log(`[API Momentos] Upserting ${rows.length} items...`)
      
      const { error } = await supabase.from('momentos').upsert(rows)
      if (error) {
        console.error('[API Momentos] Upsert Error:', error)
        throw new Error(error.message)
      }

      // Disparar Push (Background)
      rows.forEach(async (row: any) => {
        const targetIds = await getResponsavelIdsForTargets(row.dados)
        if (targetIds.length > 0) {
           sendAgendaPushNotification({
              type: 'momentos',
              itemId: String(row.id),
              title: '📸 Novo Momento Publicado!',
              message: `Novas fotos ou vídeos foram compartilhados com você. Venha conferir!`,
              targetUserIds: targetIds,
              targetUrl: '/agenda-digital/momentos'
           }).catch(err => console.error('Momento Push Error:', err))
        }
      })

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('momentos').upsert(row).select().single()
    if (error) {
       console.error('[API Momentos] Single Upsert Error:', error)
       throw new Error(error.message)
    }

    getResponsavelIdsForTargets(data.dados).then(targetIds => {
      if (targetIds.length > 0) {
         sendAgendaPushNotification({
            type: 'momentos',
            itemId: String(data.id),
            title: '📸 Novo Momento Publicado!',
            message: `Novas fotos ou vídeos foram compartilhados com você. Venha conferir!`,
            targetUserIds: targetIds,
            targetUrl: '/agenda-digital/momentos'
         }).catch(err => console.error('Momento Push Error:', err))
      }
    })

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    console.error('[API Momentos] General Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    dados: rest,
  }
}
