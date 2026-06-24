import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    
    const url = new URL(request.url)
    const fromDate = url.searchParams.get('from')
    const toDate = url.searchParams.get('to')
    const studentId = url.searchParams.get('studentId')
    
    let query = supabase.from('saida_calls').select('*').order('created_at', { ascending: false }).limit(200)
    
    if (studentId) {
      query = query.eq('dados->>studentId', studentId)
    }
    
    if (fromDate) {
      query = query.gte('created_at', fromDate + 'T00:00:00')
    } else {
      // Filter for today's calls only if no from date provided
      // Usa o timezone de Brasília para garantir que "hoje" seja calculado corretamente mesmo no servidor (que roda em UTC)
      const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Sao_Paulo', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      })
      const todayStr = formatter.format(new Date())
      query = query.gte('created_at', `${todayStr}T00:00:00-03:00`)
    }
    
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59')
    }
    
    const { data, error } = await query
      
    if (error) throw new Error(error.message)
    
    const result = (data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))
    
    return NextResponse.json(result, {
      headers: { 
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
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
        // Apenas retornamos OK sem deletar nada no banco.
        // O frontend usa um array vazio (via setActiveCalls([])) para limpar a tela
        // no fim do expediente (23:59), mas as chamadas DEVEM permanecer no banco
        // para aparecerem no Histórico / Relatórios.
        return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(buildRow)
      const { error } = await supabase.from('saida_calls').upsert(rows)
      if (error) throw new Error(error.message)
      
      // Processar Notificações de Saída
      for (const row of rows) {
        if (row.dados?.status === 'confirmed' && row.dados?.studentId) {
          try {
            const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')
            const { getResponsavelIdsForTargets } = await import('@/lib/server/notificationHelper')
            const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', row.dados.studentId).single()
            if (aluno) {
              const targetIds = await getResponsavelIdsForTargets({ targetStudents: [row.dados.studentId] })
              if (targetIds.length > 0) {
                await sendAgendaPushNotification({
                  type: 'frequencia',
                  itemId: String(row.id),
                  title: '🎓 Saída Confirmada',
                  message: `A saída de ${aluno.nome} foi confirmada na portaria.`,
                  targetUserIds: targetIds,
                  targetUrl: `/agenda-digital/frequencia`
                })
              }
            }
          } catch (e) {
            console.error('Saida Push Error:', e)
          }
        }
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    const { data, error } = await supabase.from('saida_calls').upsert(row).select().single()
    if (error) throw new Error(error.message)

    if (data.dados?.status === 'confirmed' && data.dados?.studentId) {
      try {
        const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')
        const { getResponsavelIdsForTargets } = await import('@/lib/server/notificationHelper')
        const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', data.dados.studentId).single()
        if (aluno) {
          const targetIds = await getResponsavelIdsForTargets({ targetStudents: [data.dados.studentId] })
          if (targetIds.length > 0) {
            sendAgendaPushNotification({
              type: 'frequencia',
              itemId: String(data.id),
              title: '🎓 Saída Confirmada',
              message: `A saída de ${aluno.nome} foi confirmada na portaria.`,
              targetUserIds: targetIds,
              targetUrl: `/agenda-digital/frequencia`
            }).catch(e => console.error('Saida Push Error:', e))
          }
        }
      } catch (e) {
        console.error('Saida Push Error:', e)
      }
    }

    return NextResponse.json({ id: data.id, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const supabase = await createProtectedClient()
    const { error } = await supabase.from('saida_calls').delete().eq('id', id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRow(body: any) {
  const { id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    dados: rest,
  }
}
