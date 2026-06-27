import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'

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
    const result = (data || []).map(row => {
      const merged = { ...row, ...(row.dados || {}) }
      if (merged.midias && Array.isArray(merged.midias)) {
        merged.midias = merged.midias.map((m: any) => {
          if (m.url && m.url.startsWith('data:image/') && m.url.length > 500) {
             m.url = m.thumbnail_url || null; // fallback para thumb se base64 for pesado
          }
          if (m.thumbnail_url && m.thumbnail_url.startsWith('data:image/') && m.thumbnail_url.length > 500) {
             m.thumbnail_url = null;
          }
          return m;
        });
      }
      return merged;
    })
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
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) {
         return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(buildRowAuth)
      console.log(`[API Momentos] Upserting ${rows.length} items...`)
      
      // Obter IDs existentes para não mandar push repetido
      const incomingIds = rows.map((r: any) => r.id)
      const { data: existingRecords } = await supabase
        .from('momentos')
        .select('id')
        .in('id', incomingIds)
        
      const existingIds = new Set((existingRecords || []).map(r => r.id))
      const newRows = rows.filter((r: any) => !existingIds.has(r.id))

      const { error } = await supabase.from('momentos').upsert(rows)
      if (error) {
        console.error('[API Momentos] Upsert Error:', error)
        throw new Error(error.message)
      }

      // Disparar Push APENAS para novos
      const allPushPromises: Promise<any>[] = [];
      for (const row of newRows) {
        const { students, directColaboradores } = await getStudentTargetsForComunicados(row.dados)
        
        for (const student of students) {
          if (student.responsaveis_ids.length > 0) {
            allPushPromises.push(
              sendAgendaPushNotification({
                type: 'momentos',
                itemId: String(row.id),
                title: '📸 Novo Momento Publicado!',
                message: `Novas fotos ou vídeos de ${student.aluno_nome} foram compartilhados com você. Venha conferir!`,
                targetUserIds: student.responsaveis_ids,
                targetUrl: '/agenda-digital/momentos',
                metadata: { aluno_id: student.aluno_id }
              }).catch(err => console.error('Momento Push Error:', err))
            )
          }
        }
      }
      await Promise.allSettled(allPushPromises);

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    
    // Verificar se já existe antes do single upsert
    const { data: existingSingle } = await supabase.from('momentos').select('id').eq('id', row.id).maybeSingle()
    const isNew = !existingSingle

    const { data, error } = await supabase.from('momentos').upsert(row).select().single()
    if (error) {
       console.error('[API Momentos] Single Upsert Error:', error)
       throw new Error(error.message)
    }

    if (isNew) {
      const { students, directColaboradores } = await getStudentTargetsForComunicados(data.dados);
      const pushPromises = [];
      
      for (const student of students) {
        if (student.responsaveis_ids.length > 0) {
          pushPromises.push(
            sendAgendaPushNotification({
              type: 'momentos',
              itemId: String(data.id),
              title: '📸 Novo Momento Publicado!',
              message: `Novas fotos ou vídeos de ${student.aluno_nome} foram compartilhados com você. Venha conferir!`,
              targetUserIds: student.responsaveis_ids,
              targetUrl: '/agenda-digital/momentos',
              metadata: { aluno_id: student.aluno_id }
            }).catch(err => console.error('Momento Push Error:', err))
          )
        }
      }
      await Promise.allSettled(pushPromises);
    }

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

export async function DELETE(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID não informado' }, { status: 400 })

    const supabase = await createProtectedClient()
    const { error } = await supabase.from('momentos').delete().eq('id', id)
    
    if (error) throw new Error(error.message)
    
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

