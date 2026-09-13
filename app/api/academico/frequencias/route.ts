import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets, getStudentTargetsForComunicados } from '@/lib/server/notificationHelper'

import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()
  const { searchParams } = new URL(request.url)
  const turmaId = searchParams.get('turma_id')
  const turmaIdsParam = searchParams.get('turma_ids')
  const alunoId = searchParams.get('aluno_id')
  const data = searchParams.get('data')
  
  let dataInicioVal = searchParams.get('data_inicio')
  let dataFimVal = searchParams.get('data_fim')
  const mesVal = searchParams.get('mes')
  const anoVal = searchParams.get('ano')

  if (mesVal && !dataInicioVal) {
    dataInicioVal = `${mesVal}-01`
    dataFimVal = `${mesVal}-31`
  } else if (anoVal && !dataInicioVal) {
    dataInicioVal = `${anoVal}-01-01`
    dataFimVal = `${anoVal}-12-31`
  }

  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 10000

  // Pre-resolve turmas and students if turma filtering is requested
  let studentIds: string[] = []
  let turmaIds: string[] = []

  if (turmaId || turmaIdsParam) {
    const rawTurmaIds = turmaIdsParam 
      ? turmaIdsParam.split(',').map(s => s.trim()).filter(Boolean)
      : (turmaId ? [turmaId.trim()] : [])

    turmaIds = rawTurmaIds

    const { data: allTurmas } = await supabase.from('turmas').select('*')
    const { data: allAlunos } = await supabase.from('alunos').select('id, turma, status, dados').or('status.neq.inativo,status.is.null')

    const matchedTurmaObjs = (allTurmas || []).filter(t => 
      rawTurmaIds.some(tid => String(t.id) === tid || String(t.codigo) === tid || String(t.nome) === tid)
    )

    const resolvedIds = (allAlunos || [])
      .filter(a => matchedTurmaObjs.some(t => isAlunoCursandoTurma(a, t, undefined, allTurmas || [])))
      .map(a => String(a.id))

    studentIds = resolvedIds
  }

  const applyFilters = (qb: any) => {
    let q = qb
    if (data) q = q.eq('data', data)
    if (dataInicioVal) q = q.gte('data', dataInicioVal)
    if (dataFimVal) q = q.lte('data', dataFimVal)
    if (alunoId) q = q.eq('aluno_id', alunoId)

    if (turmaId) {
      if (studentIds.length > 0 && studentIds.length <= 100) {
        q = q.or(`turma_id.eq.${turmaId},aluno_id.in.(${studentIds.join(',')})`)
      } else {
        q = q.eq('turma_id', turmaId)
      }
    } else if (turmaIds && turmaIds.length > 0) {
      if (studentIds.length > 0 && studentIds.length <= 100) {
        q = q.or(`turma_id.in.(${turmaIds.join(',')}),aluno_id.in.(${studentIds.join(',')})`)
      } else {
        q = q.in('turma_id', turmaIds)
      }
    }
    return q
  }

  // Determine total matching rows to bypass PostgREST max-rows cap (1000)
  let count = 0
  if (limit > 1000) {
    const countQuery = applyFilters(supabase.from('frequencias').select('*', { count: 'exact', head: true }))
    const { count: c, error: cErr } = await countQuery
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    count = c || 0
  }

  let rows: any[] = []
  if (count <= 1000 || limit <= 1000) {
    const singleQuery = applyFilters(
      supabase.from('frequencias').select('*').order('data', { ascending: false }).limit(limit)
    )
    const { data: pageData, error } = await singleQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows = pageData || []
  } else {
    // Parallel pagination across chunks of 1,000 to fetch up to limit
    const effectiveTotal = Math.min(count, limit)
    const pageSize = 1000
    const numPages = Math.ceil(effectiveTotal / pageSize)
    const pagePromises: Promise<any[]>[] = []

    for (let i = 0; i < numPages; i++) {
      const from = i * pageSize
      const to = Math.min(from + pageSize - 1, effectiveTotal - 1)
      pagePromises.push(
        applyFilters(
          supabase
            .from('frequencias')
            .select('*')
            .order('data', { ascending: false })
            .range(from, to)
        ).then((res: any) => {
          if (res.error) throw res.error
          return res.data || []
        })
      )
    }

    const pageResults = await Promise.all(pagePromises)
    rows = pageResults.flat()
  }

  // Deduplicate records keeping the most recent update per student per date
  const map = new Map<string, any>()
  rows.forEach(row => {
    const key = `${row.aluno_id}_${String(row.data).split('T')[0]}`
    if (!map.has(key)) {
      map.set(key, row)
    } else {
      const existing = map.get(key)
      const existingDate = new Date(existing.updated_at || existing.created_at || existing.data).getTime()
      const newDate = new Date(row.updated_at || row.created_at || row.data).getTime()
      if (newDate > existingDate) {
        map.set(key, row)
      }
    }
  })

  const finalRows = Array.from(map.values())
  return NextResponse.json(finalRows.map(row => ({ ...row, ...(row.dados || {}) })))
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();

  let userName = user.user_metadata?.nome || user.user_metadata?.name || ''
  if (!userName && user.email) {
    try {
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('nome')
        .or(`id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle()
      if (dbUser?.nome) {
        userName = dbUser.nome
      } else {
        userName = user.email.split('@')[0]
      }
    } catch {}
  }

  try {
    const body = await request.json()
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      
      const items = body.map(f => buildRow(f, userName, user.id))
      const rows = items.map(i => i.row)

      const { error } = await supabase.from('frequencias').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Lote otimizado para não dar timeout no Vercel/Netlify
      const targetData = await getStudentTargetsForComunicados({ targetStudents: rows.map(r => String(r.aluno_id)) })
      
      const pushPromises = items.map(async (item) => {
        // Se notifyPush for explicitamente false (nenhuma alteração de frequência), ignora o disparo
        if (item.notifyPush === false) return

        const row = item.row
        const rowAlunoIdClean = String(row.aluno_id || '').replace(/^0+/, '')
        const studentInfo = targetData.students.find(s => {
          const sIdClean = String(s.aluno_id || '').replace(/^0+/, '')
          return String(s.aluno_id) === String(row.aluno_id) || sIdClean === rowAlunoIdClean
        })
        if (!studentInfo || studentInfo.responsaveis_ids.length === 0) return

        const nomeAluno = studentInfo.aluno_nome || 'o aluno'
        const isJustified = Boolean(row.justificativa && String(row.justificativa).trim().length > 0)
        const isPresent = row.presente !== false && !isJustified

        let pushTitle = '✅ Presença Confirmada'
        let pushMsg = `A presença de ${nomeAluno} foi confirmada na escola.`

        if (isJustified) {
          pushTitle = '📋 Falta Justificada'
          pushMsg = `Foi registrada uma falta justificada para ${nomeAluno}.`
        } else if (!isPresent) {
          pushTitle = '❌ Falta Registrada'
          pushMsg = `Foi registrada uma falta para ${nomeAluno}.`
        }

        // ItemId único por salvamento usando timestamp para evitar travamento na deduplicação de push
        const pushItemId = `${row.id}_${Date.now()}`

        try {
          await sendAgendaPushNotification({
            type: 'frequencia',
            itemId: pushItemId,
            title: pushTitle,
            message: pushMsg,
            targetUserIds: studentInfo.responsaveis_ids,
            targetUrl: `/agenda-digital/frequencia`,
            metadata: {
              aluno_id: String(row.aluno_id),
              turma_id: String(row.turma_id),
              data: String(row.data)
            }
          })
        } catch (err) {
          console.error('Frequencia Push Error:', err)
        }
      })

      // Executa os envios em paralelo e não bloqueia 100% caso demore muito, enviando em chunks
      const chunkSize = 50
      for (let i = 0; i < pushPromises.length; i += chunkSize) {
        await Promise.all(pushPromises.slice(i, i + chunkSize))
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const item = buildRow(body, userName, user.id)
    const { data, error } = await supabase.from('frequencias').upsert(item.row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (item.notifyPush !== false) {
      const targetIds = await getResponsavelIdsForTargets({ targetStudents: [data.aluno_id] })
      if (targetIds.length > 0) {
        const { data: aluno } = await supabase.from('alunos').select('nome').eq('id', data.aluno_id).single()
        const nomeAluno = aluno?.nome ? aluno.nome : 'o aluno'
        
        const isJustified = Boolean(data.justificativa && String(data.justificativa).trim().length > 0)
        const isPresent = data.presente !== false && !isJustified

        let pushTitle = '✅ Presença Confirmada'
        let pushMsg = `A presença de ${nomeAluno} foi confirmada na escola.`

        if (isJustified) {
          pushTitle = '📋 Falta Justificada'
          pushMsg = `Foi registrada uma falta justificada para ${nomeAluno}.`
        } else if (!isPresent) {
          pushTitle = '❌ Falta Registrada'
          pushMsg = `Foi registrada uma falta para ${nomeAluno}.`
        }

        const pushItemId = `${data.id}_${Date.now()}`

        sendAgendaPushNotification({
          type: 'frequencia',
          itemId: pushItemId,
          title: pushTitle,
          message: pushMsg,
          targetUserIds: targetIds,
          targetUrl: `/agenda-digital/frequencia`,
          metadata: {
            aluno_id: String(data.aluno_id),
            turma_id: String(data.turma_id),
            data: String(data.data)
          }
        }).catch(err => console.error('Frequencia Push Error:', err))
      }
    }

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const all = searchParams.get('all')
  const alunoId = searchParams.get('aluno_id') || searchParams.get('alunoId')
  const dataStr = searchParams.get('data')
  
  if (all === 'true') {
    const { error } = await supabase.from('frequencias').delete().neq('id', 'non-existent-id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, message: 'Todos os registros foram excluídos.' })
  }
  
  let deleteError: any = null

  if (alunoId && dataStr) {
    const cleanDate = String(dataStr).split('T')[0]
    const { error: err1 } = await supabase
      .from('frequencias')
      .delete()
      .eq('aluno_id', alunoId)
      .gte('data', `${cleanDate}T00:00:00`)
      .lte('data', `${cleanDate}T23:59:59`)

    const { error: err2 } = await supabase
      .from('frequencias')
      .delete()
      .eq('aluno_id', alunoId)
      .eq('data', cleanDate)

    const { error: err3 } = await supabase
      .from('frequencias')
      .delete()
      .eq('aluno_id', alunoId)
      .like('data', `${cleanDate}%`)

    if (err1 || err2 || err3) deleteError = err1 || err2 || err3
  }

  if (id) {
    const { error: errId } = await supabase.from('frequencias').delete().eq('id', id)
    if (errId) deleteError = errId
  }

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

function buildRow(f: any, userName?: string, userId?: string) {
  const { id, alunoId, turmaId, data, presente, justificativa, anoLetivo, registradoPor, origem, horaRegistro, notifyPush, dados, ...rest } = f
  const currentYear = new Date().getFullYear().toString()
  const year = anoLetivo || currentYear
  const diarioId = `DIARIO-${turmaId}-${year}`
  
  const mergedExtra = { ...(dados || {}), ...rest }

  let finalRegistradoPor = registradoPor || mergedExtra.registradoPor
  const isCatraca = origem === 'catraca' || String(finalRegistradoPor || '').toLowerCase().includes('catraca') || String(finalRegistradoPor || '').toLowerCase().includes('idface')
  const isTotem = origem === 'totem' || String(finalRegistradoPor || '').toLowerCase().includes('totem')

  if (!isCatraca && !isTotem && userName) {
    if (!finalRegistradoPor || finalRegistradoPor === 'Manual' || finalRegistradoPor === 'Manual (Auto)') {
      finalRegistradoPor = `Manual (${userName})`
    }
  } else if (!finalRegistradoPor) {
    finalRegistradoPor = 'Manual'
  }

  const row = {
    id: id || `FREQ-${alunoId || f.aluno_id}-${data}`,
    aluno_id: alunoId || f.aluno_id || '',
    turma_id: turmaId || f.turma_id || '',
    data: data || new Date().toISOString().split('T')[0],
    presente: presente !== undefined ? Boolean(presente) : true,
    justificativa: justificativa || '',
    dados: {
      ...mergedExtra,
      diarioId,
      anoLetivo: year,
      registradoPor: finalRegistradoPor,
      usuarioNome: userName || mergedExtra.usuarioNome || null,
      usuarioId: userId || mergedExtra.usuarioId || null,
      origem: origem || mergedExtra.origem || 'manual',
      horaRegistro: horaRegistro || mergedExtra.horaRegistro || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    },
  }

  return {
    row,
    notifyPush: notifyPush !== undefined ? Boolean(notifyPush) : true
  }
}

