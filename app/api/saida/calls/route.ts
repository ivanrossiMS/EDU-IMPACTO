import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

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
    let query = supabase.from('saida_calls').select('id, dados, created_at').order('created_at', { ascending: false }).limit(300)
    
    if (studentId) {
      query = query.eq('dados->>studentId', studentId)
    }
    
    const dateParam = url.searchParams.get('date') || fromDate
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Campo_Grande', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    })
    const todayStr = dateParam || formatter.format(new Date())

    query = query.gte('created_at', `${todayStr}T00:00:00-04:00`)
    
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59')
    }
    
    const { data, error } = await query
      
    if (error) throw new Error(error.message)
    
    let rawResult = (data || []).map(row => ({ id: row.id, ...(row.dados || {}) }))

    // Buscar saídas registradas na tabela de frequências para garantir histórico completo
    const targetDate = fromDate || todayStr
    const { data: freqRecords } = await supabase
      .from('frequencias')
      .select('id, aluno_id, turma_id, data, dados, created_at')
      .gte('data', targetDate)

    const existingStudentIds = new Set(rawResult.map(c => String(c.studentId || '').trim()))

    if (freqRecords && freqRecords.length > 0) {
      const missingStudentIds = freqRecords
        .filter(f => f.dados && (f.dados.saidaHorario || f.dados.saidaResponsavel))
        .map(f => String(f.aluno_id).trim())
        .filter(id => id && !existingStudentIds.has(id))

      let alunosMap: Record<string, any> = {}
      if (missingStudentIds.length > 0) {
        const { data: dbAlunos } = await supabase
          .from('alunos')
          .select('id, nome, turma, foto, foto_url')
          .in('id', missingStudentIds)
        if (dbAlunos) {
          dbAlunos.forEach((a: any) => {
            alunosMap[String(a.id)] = a
          })
        }
      }

      for (const fRecord of freqRecords) {
        const aId = String(fRecord.aluno_id || '').trim()
        if (!aId) continue
        const sHorario = fRecord.dados?.saidaHorario
        const sResp = fRecord.dados?.saidaResponsavel
        if (sHorario || sResp) {
          if (!existingStudentIds.has(aId)) {
            existingStudentIds.add(aId)
            const al = alunosMap[aId]
            const recordDate = fRecord.data || targetDate
            rawResult.push({
              id: `freq-saida-${aId}-${recordDate}`,
              studentId: aId,
              studentName: al?.nome || aId,
              studentClass: al?.turma || fRecord.turma_id || '',
              studentPhoto: al?.foto || al?.foto_url || null,
              guardianId: 'frequencia-diario',
              guardianName: sResp || 'Responsável Cadastrado',
              calledAt: sHorario || fRecord.created_at || `${recordDate}T12:00:00-04:00`,
              confirmedAt: sHorario || fRecord.created_at || `${recordDate}T12:00:00-04:00`,
              status: 'confirmed',
              source: 'frequencia'
            })
          }
        }
      }
    }

    // Retroalimentação / Enriquecimento de foto para chamadas que possuem studentId mas vieram sem foto
    const callsMissingPhoto = rawResult.filter(c => !c.studentPhoto && c.studentId)
    if (callsMissingPhoto.length > 0) {
      const studentIdsToFetch = Array.from(new Set(callsMissingPhoto.map(c => String(c.studentId).trim()).filter(Boolean)))
      if (studentIdsToFetch.length > 0) {
        const { data: dbAlunosPhotos } = await supabase
          .from('alunos')
          .select('id, foto, foto_url')
          .in('id', studentIdsToFetch)
        if (dbAlunosPhotos && dbAlunosPhotos.length > 0) {
          const photoMap = new Map(dbAlunosPhotos.map(p => [String(p.id), p.foto || p.foto_url]))
          for (const c of callsMissingPhoto) {
            const p = photoMap.get(String(c.studentId).trim())
            if (p) {
              c.studentPhoto = p
            }
          }
        }
      }
    }

    // Build set of studentIds that have a confirmed call today
    const confirmedStudentIds = new Set(
      rawResult
        .filter(c => c.status === 'confirmed' && c.studentId != null)
        .map(c => String(c.studentId))
    )

    // Normalize: if a student has a confirmed call, mark any un-reverted waiting/called calls for that student as confirmed
    const result = rawResult.map(c => {
      if (c.studentId != null && confirmedStudentIds.has(String(c.studentId)) && (c.status === 'waiting' || c.status === 'called') && !c.isRevert) {
        return { ...c, status: 'confirmed' }
      }
      return c
    })
    
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
        return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(buildRow)
      const ids = rows.map((r: any) => r.id)
      
      const supabaseService = getAdminClient()

      // Backfill photo if missing
      const missingPhotoIds = rows
        .filter((r: any) => !r.dados?.studentPhoto && r.dados?.studentId)
        .map((r: any) => String(r.dados.studentId).trim())
      if (missingPhotoIds.length > 0) {
        const { data: sPhotos } = await supabaseService.from('alunos').select('id, foto, foto_url').in('id', missingPhotoIds)
        if (sPhotos) {
          const map = new Map(sPhotos.map(s => [String(s.id), s.foto || s.foto_url]))
          rows.forEach((r: any) => {
            if (!r.dados?.studentPhoto && r.dados?.studentId) {
              const p = map.get(String(r.dados.studentId).trim())
              if (p) r.dados.studentPhoto = p
            }
          })
        }
      }
      
      const { data: existingRows } = await supabaseService.from('saida_calls').select('id, dados').in('id', ids)
      
      const existingStatusMap = new Map((existingRows || []).map(r => {
        let status = null
        let calledAt = null
        if (typeof r.dados === 'string') {
          try { 
            const d = JSON.parse(r.dados)
            status = d.status 
            calledAt = d.calledAt
          } catch(e){}
        } else if (r.dados) {
          status = (r.dados as any).status
          calledAt = (r.dados as any).calledAt
        }
        return [r.id, { status, calledAt }]
      }))

      const { error } = await supabaseService.from('saida_calls').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(error.message)
      
      // Processar Notificações de Saída e Chamada de Portaria
      for (const row of rows) {
        const existing = existingStatusMap.get(row.id)
        const isConfirmed = row.dados?.status === 'confirmed'
        const studentId = row.dados?.studentId ? String(row.dados.studentId) : null

        if (isConfirmed && studentId) {
          await dispatchSaidaConfirmadaPush({
            callId: row.id,
            studentId,
            studentName: row.dados?.studentName,
            studentClass: row.dados?.studentClass,
            confirmedAt: row.dados?.confirmedAt,
            guardianName: row.dados?.guardianName,
          })
        } else if ((row.dados?.status === 'waiting' || row.dados?.status === 'called') && !row.dados?.isRevert && studentId) {
          const isNewCall = !existing
          const isStatusChanged = existing && existing.status !== row.dados.status
          const isRecall = existing && existing.status === 'waiting' && existing.calledAt && row.dados.calledAt && (new Date(row.dados.calledAt).getTime() - new Date(existing.calledAt).getTime() > 15000)

          if (isNewCall || isStatusChanged || isRecall) {
            await dispatchChamadaPortariaPush({
              callId: row.id,
              studentId,
              studentName: row.dados?.studentName,
              studentClass: row.dados?.studentClass,
              calledAt: row.dados?.calledAt,
            })
          }
        }
      }

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)

    const supabaseService = getAdminClient()
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayStr = formatter.format(new Date())

    const studentId = row.dados?.studentId ? String(row.dados.studentId) : null
    if (studentId && !row.dados?.studentPhoto) {
      const { data: sPhoto } = await supabaseService.from('alunos').select('foto, foto_url').eq('id', studentId).maybeSingle()
      if (sPhoto?.foto || sPhoto?.foto_url) {
        row.dados.studentPhoto = sPhoto.foto || sPhoto.foto_url
      }
    }
    const incomingStatus = row.dados?.status
    const isRevert = !!row.dados?.isRevert

    if (studentId && (incomingStatus === 'waiting' || incomingStatus === 'called') && !isRevert) {
      const { data: studentCallsToday } = await supabaseService
        .from('saida_calls')
        .select('id, dados')
        .eq('dados->>studentId', studentId)
        .gte('created_at', `${todayStr}T00:00:00-04:00`)

      const confirmedEntry = (studentCallsToday || []).find(r => {
        let d = r.dados
        if (typeof d === 'string') { try { d = JSON.parse(d) } catch(e){} }
        return d?.status === 'confirmed'
      })

      if (confirmedEntry) {
        console.warn(`[API Saida] Blocked setting status '${incomingStatus}' for student ${studentId} (${row.dados?.studentName}) - Already confirmed today.`)
        let cDados = confirmedEntry.dados
        if (typeof cDados === 'string') { try { cDados = JSON.parse(cDados) } catch(e){} }
        return NextResponse.json({ id: confirmedEntry.id, ...(cDados || {}) }, { status: 200 })
      }
    }

    const { data: existingRow } = await supabaseService.from('saida_calls').select('dados').eq('id', row.id).maybeSingle()
    
    let wasConfirmed = false
    let previousStatus: string | null = null
    let previousCalledAt: string | null = null
    if (existingRow?.dados) {
      let existingDados: any = {}
      if (typeof existingRow.dados === 'string') {
        try { existingDados = JSON.parse(existingRow.dados) } catch(e){}
      } else {
        existingDados = existingRow.dados
      }
      wasConfirmed = existingDados.status === 'confirmed'
      previousStatus = existingDados.status
      previousCalledAt = existingDados.calledAt

      if ((wasConfirmed || existingDados.status === 'cancelled') && (row.dados.status === 'waiting' || row.dados.status === 'called') && !isRevert) {
        const incomingCalledAt = new Date(row.dados.calledAt || 0).getTime()
        const existingConfirmedAt = new Date(existingDados.confirmedAt || 0).getTime()
        if (incomingCalledAt < existingConfirmedAt) {
          console.warn(`[API Saida] Stale update prevented for call ${row.id}. Incoming status: ${row.dados.status}, Existing status: ${existingDados.status}`)
          return NextResponse.json({ id: row.id, ...(existingDados || {}) }, { status: 200 })
        }
      }
    }

    const { data, error } = await supabaseService.from('saida_calls').upsert(row).select().single()
    if (error) throw new Error(error.message)

    const isConfirmed = data.dados?.status === 'confirmed'

    // If this call is now confirmed, also update any other active/waiting call for this student created today in the DB
    if (isConfirmed && studentId) {
      try {
        const { data: siblingCalls } = await supabaseService
          .from('saida_calls')
          .select('id, dados')
          .eq('dados->>studentId', studentId)
          .gte('created_at', `${todayStr}T00:00:00-04:00`)

        for (const sRow of (siblingCalls || [])) {
          if (sRow.id === data.id) continue
          let sDados = sRow.dados
          if (typeof sDados === 'string') { try { sDados = JSON.parse(sDados) } catch(e){} }
          if (sDados && (sDados.status === 'waiting' || sDados.status === 'called') && !sDados.isRevert) {
            sDados.status = 'confirmed'
            sDados.confirmedAt = data.dados?.confirmedAt || new Date().toISOString()
            await supabaseService.from('saida_calls').update({ dados: sDados }).eq('id', sRow.id)
          }
        }
      } catch (errSibling) {
        console.error('Error updating sibling calls in DB:', errSibling)
      }
    }

    if (isConfirmed && studentId) {
      await dispatchSaidaConfirmadaPush({
        callId: data.id,
        studentId,
        studentName: data.dados?.studentName,
        studentClass: data.dados?.studentClass,
        confirmedAt: data.dados?.confirmedAt,
        guardianName: data.dados?.guardianName,
      })
    } else if ((data.dados?.status === 'waiting' || data.dados?.status === 'called') && !isRevert && studentId) {
      const isNewCall = !existingRow
      const isStatusChanged = previousStatus && previousStatus !== data.dados.status
      const isRecall = previousStatus === 'waiting' && previousCalledAt && data.dados.calledAt && (new Date(data.dados.calledAt).getTime() - new Date(previousCalledAt).getTime() > 15000)

      if (isNewCall || isStatusChanged || isRecall) {
        await dispatchChamadaPortariaPush({
          callId: data.id,
          studentId,
          studentName: data.dados?.studentName,
          studentClass: data.dados?.studentClass,
          calledAt: data.dados?.calledAt,
        })
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
    const body = await request.json()
    const { id, clearToday } = body
    const supabaseService = getAdminClient()

    if (clearToday) {
      const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Campo_Grande', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      })
      const todayStr = formatter.format(new Date())
      const { error } = await supabaseService
        .from('saida_calls')
        .delete()
        .gte('created_at', `${todayStr}T00:00:00-04:00`)

      if (error) throw new Error(error.message)

      return NextResponse.json({ ok: true, clearedToday: true })
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

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

function formatHoraSaida(rawTime?: string | null): string {
  if (!rawTime) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' }).format(new Date())
  }
  if (/^\d{2}:\d{2}$/.test(rawTime)) {
    return rawTime
  }
  const dateStr = rawTime.includes('T') && !rawTime.endsWith('Z') && !rawTime.includes('-') && !rawTime.includes('+')
    ? `${rawTime}-04:00`
    : rawTime
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' }).format(new Date())
  }
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' }).format(date)
}

async function dispatchChamadaPortariaPush({
  callId,
  studentId,
  studentName,
  studentClass,
  calledAt,
}: {
  callId: string
  studentId: string
  studentName?: string
  studentClass?: string
  calledAt?: string
}) {
  try {
    const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')
    const { getResponsavelIdsForTargets } = await import('@/lib/server/notificationHelper')
    const { formatFriendlyStudentName } = await import('@/lib/studentNameHelper')
    const supabaseService = getAdminClient()

    const rawStudentId = String(studentId).trim()
    const unpaddedId = rawStudentId.replace(/^0+/, '')
    const studentTargets = Array.from(new Set([rawStudentId, unpaddedId, unpaddedId.padStart(6, '0')].filter(Boolean)))

    const { data: aluno } = await supabaseService
      .from('alunos')
      .select('nome, turma')
      .or(`id.eq.${rawStudentId},matricula.eq.${rawStudentId}`)
      .limit(1)
      .maybeSingle()

    const rawNomeAluno = aluno?.nome || studentName || 'o aluno'
    const nomeAmigavel = formatFriendlyStudentName(rawNomeAluno)

    const targetIds = await getResponsavelIdsForTargets({ targetStudents: studentTargets })
    if (targetIds.length > 0) {
      const callTime = calledAt ? new Date(calledAt).getTime() : Date.now()
      const pushItemId = `chamada_${callId}_${callTime}`

      await sendAgendaPushNotification({
        type: 'saida',
        itemId: pushItemId,
        title: '🚗 Chamada de Portaria',
        message: `${nomeAmigavel} foi chamado na portaria para saída e está se dirigindo ao portão principal.`,
        targetUserIds: targetIds,
        targetUrl: `/agenda-digital/${rawStudentId}`,
        metadata: {
          aluno_id: rawStudentId,
          saida_id: String(callId),
          tipo: 'chamada_portaria',
        },
      })
      console.log(`[API Saida] Push de Chamada de Portaria disparado para ${nomeAmigavel} (${targetIds.length} destinatários)`)
    } else {
      console.warn(`[API Saida] Nenhum destinatário resolvido para Chamada de Portaria do aluno ${rawStudentId}`)
    }
  } catch (err: any) {
    console.error('[API Saida] Erro ao disparar push de Chamada de Portaria:', err.message)
  }
}

async function dispatchSaidaConfirmadaPush({
  callId,
  studentId,
  studentName,
  studentClass,
  confirmedAt,
  guardianName,
}: {
  callId: string
  studentId: string
  studentName?: string
  studentClass?: string
  confirmedAt?: string
  guardianName?: string
}) {
  try {
    const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')
    const { getResponsavelIdsForTargets } = await import('@/lib/server/notificationHelper')
    const { formatFriendlyStudentName } = await import('@/lib/studentNameHelper')
    const supabaseService = getAdminClient()

    const rawStudentId = String(studentId).trim()
    const unpaddedId = rawStudentId.replace(/^0+/, '')
    const studentTargets = Array.from(new Set([rawStudentId, unpaddedId, unpaddedId.padStart(6, '0')].filter(Boolean)))

    const { data: aluno } = await supabaseService
      .from('alunos')
      .select('nome, turma')
      .or(`id.eq.${rawStudentId},matricula.eq.${rawStudentId}`)
      .limit(1)
      .maybeSingle()

    const rawNomeAluno = aluno?.nome || studentName || 'o aluno'
    const nomeAmigavel = formatFriendlyStudentName(rawNomeAluno)
    const turmaAluno = aluno?.turma || studentClass || ''

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const freqId = `FREQ-${rawStudentId}-${today}`
    const anoLetivo = new Date().getFullYear().toString()

    const { data: existingFreq } = await supabaseService.from('frequencias').select('presente, tempos, dados').eq('id', freqId).maybeSingle()

    await supabaseService.from('frequencias').upsert({
      id: freqId,
      aluno_id: rawStudentId,
      turma_id: turmaAluno,
      data: today,
      presente: existingFreq?.presente ?? true,
      tempos: existingFreq?.tempos || null,
      dados: {
        ...(existingFreq?.dados || {}),
        saidaHorario: confirmedAt || new Date().toISOString(),
        saidaResponsavel: guardianName || '',
        saidaOrigem: 'manual',
        anoLetivo,
        diarioId: `DIARIO-${turmaAluno}-${anoLetivo}`
      }
    })

    const targetIds = await getResponsavelIdsForTargets({ targetStudents: studentTargets })
    if (targetIds.length > 0) {
      const horaSaida = formatHoraSaida(confirmedAt)
      const pushItemId = `saida_${callId}_${Date.now()}`

      await sendAgendaPushNotification({
        type: 'saida',
        itemId: pushItemId,
        title: '🎓 Saída Confirmada',
        message: `A saída de ${nomeAmigavel} foi confirmada na portaria às ${horaSaida}.`,
        targetUserIds: targetIds,
        targetUrl: `/agenda-digital/frequencia`,
        metadata: {
          aluno_id: rawStudentId,
          saida_id: String(callId)
        }
      })
      console.log(`[API Saida] Push de Saída Confirmada disparado para ${nomeAmigavel} (${targetIds.length} destinatários)`)
    }
  } catch (err: any) {
    console.error('[API Saida] Erro ao disparar push de Saída Confirmada:', err.message)
  }
}
