import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { createClient } from '@supabase/supabase-js'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const accessStartDate = await getLoggedUserAccessStartDate()
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')
    
    let query = supabase.from('eventos_agenda').select('*')
    
    if (accessStartDate) {
      const accessStartDateStr = accessStartDate.toISOString().substring(0, 10)
      query = query.gte('data', accessStartDateStr)
    }

    if (limitParam) {
      const limit = parseInt(limitParam)
      const offset = offsetParam ? parseInt(offsetParam) : 0
      query = query.range(offset, offset + limit - 1)
    } else {
      query = query.limit(30)
    }

    query = query.order('data', { ascending: false })

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const result = (data || []).map(row => ({ 
      ...row, 
      horaInicio: row.hora_inicio,
      horaFim: row.hora_fim,
      criadoPor: row.criado_por,
      ...(row.dados || {}) 
    }))
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRowAuth)
      const { error } = await supabase.from('eventos_agenda').upsert(rows)
      if (error) throw new Error(error.message)
      
      // Disparar Push (Background)
      for (const row of rows) {
        const targetIds = await getResponsavelIdsForTargets({ targetClasses: row.turmas })
        if (targetIds.length > 0) {
          // Notificação Imediata
          await sendAgendaPushNotification({
            type: 'calendario',
            itemId: String(row.id),
            title: '📅 Novo Evento!',
            message: `O evento "${row.titulo}" foi adicionado à sua agenda.`,
            targetUserIds: targetIds,
            targetUrl: '/agenda-digital/calendario'
          }).catch(err => console.error('Evento Push Error:', err))

          // Lembrete Agendado para 1 dia antes às 20h
          if (row.data) {
            const eventDate = new Date(`${row.data}T12:00:00Z`);
            eventDate.setUTCDate(eventDate.getUTCDate() - 1);
            const sendAfterStr = `${eventDate.toISOString().split('T')[0]} 20:00:00 GMT-0300`;
            const sendAfterDate = new Date(`${eventDate.toISOString().split('T')[0]}T20:00:00-03:00`);
            
            if (sendAfterDate > new Date()) {
              await sendAgendaPushNotification({
                type: 'calendario',
                itemId: `${row.id}-reminder`,
                title: '⏰ Lembrete: Amanhã!',
                message: `Amanhã temos o evento: ${row.titulo}. Não se esqueça!`,
                targetUserIds: targetIds,
                targetUrl: '/agenda-digital/calendario',
                sendAfter: sendAfterStr
              }).catch(err => console.error('Evento Reminder Error:', err))
            }
          }
        }
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('eventos_agenda').upsert(row).select().single()
    if (error) throw new Error(error.message)

    // Disparar Push (Background)
    const targetIds = await getResponsavelIdsForTargets({ targetClasses: data.turmas })
    if (targetIds.length > 0) {
      // Notificação Imediata
      sendAgendaPushNotification({
        type: 'calendario',
        itemId: String(data.id),
        title: '📅 Novo Evento!',
        message: `O evento "${data.titulo}" foi adicionado à sua agenda.`,
        targetUserIds: targetIds,
        targetUrl: '/agenda-digital/calendario'
      }).catch(err => console.error('Evento Push Error:', err))

      // Lembrete Agendado
      if (data.data) {
        const eventDate = new Date(`${data.data}T12:00:00Z`);
        eventDate.setUTCDate(eventDate.getUTCDate() - 1);
        const sendAfterStr = `${eventDate.toISOString().split('T')[0]} 20:00:00 GMT-0300`;
        const sendAfterDate = new Date(`${eventDate.toISOString().split('T')[0]}T20:00:00-03:00`);
        
        if (sendAfterDate > new Date()) {
          sendAgendaPushNotification({
            type: 'calendario',
            itemId: `${data.id}-reminder`,
            title: '⏰ Lembrete: Amanhã!',
            message: `Amanhã temos o evento: ${data.titulo}. Não se esqueça!`,
            targetUserIds: targetIds,
            targetUrl: '/agenda-digital/calendario',
            sendAfter: sendAfterStr
          }).catch(err => console.error('Evento Reminder Error:', err))
        }
      }
    }

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, titulo, descricao, tipo, data, horaInicio, horaFim, turmas, local, cor, recorrente, criadoPor, unidade, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    titulo: titulo || 'Evento sem título',
    descricao: descricao || '',
    tipo: tipo || 'evento',
    data: data || '',
    hora_inicio: horaInicio || '',
    hora_fim: horaFim || '',
    turmas: Array.isArray(turmas) ? turmas : [],
    local: local || '',
    cor: cor || '#f59e0b',
    recorrente: recorrente || false,
    criado_por: criadoPor || '',
    unidade: unidade || '',
    dados: rest,
  }
}
