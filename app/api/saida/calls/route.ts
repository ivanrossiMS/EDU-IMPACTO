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
    let query = supabase.from('saida_calls').select('*').order('created_at', { ascending: false }).limit(1500)
    
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
      
      // Buscar status anterior para evitar disparos duplicados de notificação
      const ids = rows.map((r: any) => r.id)
      
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseService = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false }, global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
      )
      
      const { data: existingRows } = await supabaseService.from('saida_calls').select('id, dados').in('id', ids)
      
      const existingStatusMap = new Map((existingRows || []).map(r => {
        let status = null
        if (typeof r.dados === 'string') {
          try { status = JSON.parse(r.dados).status } catch(e){}
        } else if (r.dados) {
          status = (r.dados as any).status
        }
        return [r.id, status]
      }))

      const { error } = await supabaseService.from('saida_calls').upsert(rows)
      if (error) throw new Error(error.message)
      
      // Processar Notificações de Saída
      for (const row of rows) {
        const wasConfirmed = existingStatusMap.get(row.id) === 'confirmed'
        const isConfirmed = row.dados?.status === 'confirmed'

        if (isConfirmed && !wasConfirmed && row.dados?.studentId) {
          try {
            const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')
            const { getResponsavelIdsForTargets } = await import('@/lib/server/notificationHelper')
            const { data: aluno } = await supabase.from('alunos').select('nome, turma').eq('id', row.dados.studentId).single()
            if (aluno) {
              // Create frequencia record
              const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
              const freqId = `FREQ-${row.dados.studentId}-${today}`
              const anoLetivo = new Date().getFullYear().toString()
              
              await supabase.from('frequencias').upsert({
                id: freqId,
                aluno_id: row.dados.studentId,
                turma_id: aluno.turma || '',
                data: today,
                presente: true,
                dados: {
                  saidaHorario: row.dados.confirmedAt || new Date().toISOString(),
                  saidaResponsavel: row.dados.guardianName || '',
                  anoLetivo,
                  diarioId: `DIARIO-${aluno.turma || ''}-${anoLetivo}`
                }
              })
              
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

    // Buscar status anterior
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false }, global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    )
    const { data: existingRow } = await supabaseService.from('saida_calls').select('dados').eq('id', row.id).maybeSingle()
    
    let wasConfirmed = false
    if (existingRow?.dados) {
      if (typeof existingRow.dados === 'string') {
        try { wasConfirmed = JSON.parse(existingRow.dados).status === 'confirmed' } catch(e){}
      } else {
        wasConfirmed = (existingRow.dados as any).status === 'confirmed'
      }
    }

    const { data, error } = await supabaseService.from('saida_calls').upsert(row).select().single()
    if (error) throw new Error(error.message)

    const isConfirmed = data.dados?.status === 'confirmed'

    if (isConfirmed && !wasConfirmed && data.dados?.studentId) {
      try {
        const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')
        const { getResponsavelIdsForTargets } = await import('@/lib/server/notificationHelper')
        const { data: aluno } = await supabase.from('alunos').select('nome, turma').eq('id', data.dados.studentId).single()
        if (aluno) {
          // Create frequencia record
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
          const freqId = `FREQ-${data.dados.studentId}-${today}`
          const anoLetivo = new Date().getFullYear().toString()
          
          await supabase.from('frequencias').upsert({
            id: freqId,
            aluno_id: data.dados.studentId,
            turma_id: aluno.turma || '',
            data: today,
            presente: true,
            dados: {
              saidaHorario: data.dados.confirmedAt || new Date().toISOString(),
              saidaResponsavel: data.dados.guardianName || '',
              anoLetivo,
              diarioId: `DIARIO-${aluno.turma || ''}-${anoLetivo}`
            }
          })

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

    const { createClient } = await import('@supabase/supabase-js')
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false }, global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) } }
    )

    const { error } = await supabaseService.from('saida_calls').delete().eq('id', id)
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
