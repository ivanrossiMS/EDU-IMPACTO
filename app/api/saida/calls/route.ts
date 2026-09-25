import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { resolveCollaboratorUsers } from '@/lib/server/collaboratorLookup'

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
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 500
    let query = supabase.from('saida_calls').select('id, dados, created_at').order('created_at', { ascending: false }).limit(limit)
    
    if (studentId) {
      query = query.eq('dados->>studentId', studentId)
    }
    
    const dateParam = url.searchParams.get('date')
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Campo_Grande', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    })
    const todayStr = formatter.format(new Date())

    // Define os limites de data considerando fuso America/Campo_Grande (-04:00)
    const effectiveFrom = fromDate || dateParam || (!toDate ? todayStr : null)
    const targetDate = effectiveFrom || todayStr
    if (effectiveFrom) {
      query = query.gte('created_at', `${effectiveFrom}T00:00:00-04:00`)
    }
    
    const effectiveTo = toDate || dateParam
    if (effectiveTo) {
      query = query.lte('created_at', `${effectiveTo}T23:59:59.999-04:00`)
    }
    
    let freqQuery = supabase
      .from('frequencias')
      .select('id, aluno_id, turma_id, data, dados, created_at')

    if (effectiveFrom) {
      freqQuery = freqQuery.gte('data', effectiveFrom)
    }

    if (effectiveTo) {
      freqQuery = freqQuery.lte('data', effectiveTo)
    } else if (!fromDate && !toDate) {
      freqQuery = freqQuery.lte('data', todayStr)
    }

    let eventosQuery = supabase
      .from('portaria_eventos')
      .select('id, aluno_id, aluno_nome, data_hora, dispositivo_nome, status, tipo')
      .eq('tipo', 'saida')
      .eq('status', 'sucesso')

    if (effectiveFrom) {
      eventosQuery = eventosQuery.gte('data_hora', `${effectiveFrom}T00:00:00-04:00`)
    }
    if (effectiveTo) {
      eventosQuery = eventosQuery.lte('data_hora', `${effectiveTo}T23:59:59.999-04:00`)
    }

    // Executa as consultas ao Supabase em paralelo para reduzir tempo de resposta
    const [callsRes, freqRes, eventosRes] = await Promise.all([
      query,
      freqQuery,
      Promise.resolve(eventosQuery).catch(() => ({ data: [] as any[] }))
    ])
    if (callsRes.error) throw new Error(callsRes.error.message)
    
    const data = callsRes.data
    const freqRecords: any[] = freqRes.data || []
    const exitEvents: any[] = (eventosRes && 'data' in eventosRes && Array.isArray((eventosRes as any).data)) ? (eventosRes as any).data : []
    let rawResult: any[] = (data || []).map((row: any) => ({ id: row.id, ...(row.dados || {}) }))

    const existingStudentIds = new Set(rawResult.map((c: any) => String(c.studentId || '').trim()))

    if (freqRecords && freqRecords.length > 0) {
      const missingStudentIds = freqRecords
        .filter((f: any) => f.dados && (f.dados.saidaHorario || f.dados.saidaResponsavel))
        .map((f: any) => String(f.aluno_id).trim())
        .filter((id: string) => id && !existingStudentIds.has(id))

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
        const sOrigem = fRecord.dados?.saidaOrigem
        if (sHorario || sResp) {
          const isCatraca = sOrigem === 'catraca' || (sResp && sResp.toLowerCase().includes('catraca'))
          const isSolo = isCatraca || (sResp && sResp.toLowerCase().includes('sozinho'))
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
              guardianId: isCatraca ? 'catraca-saida' : (isSolo ? 'sozinho' : 'frequencia-diario'),
              guardianName: sResp || (isSolo ? 'Saiu Sozinho' : 'Responsável Cadastrado'),
              calledAt: sHorario || fRecord.created_at || `${recordDate}T12:00:00-04:00`,
              confirmedAt: sHorario || fRecord.created_at || `${recordDate}T12:00:00-04:00`,
              status: 'confirmed',
              source: isCatraca ? 'catraca' : 'frequencia',
              tipo: isSolo ? 'sozinho' : undefined,
              origem: isCatraca ? 'catraca_idface' : (isSolo ? 'manual' : undefined)
            })
          } else {
            const existingCall = rawResult.find((c: any) => String(c.studentId || '').trim() === aId)
            if (existingCall && isSolo) {
              if (!existingCall.tipo) existingCall.tipo = 'sozinho'
              if (isCatraca && !existingCall.origem) existingCall.origem = 'catraca_idface'
            }
          }
        }
      }
    }

    if (exitEvents && exitEvents.length > 0) {
      const missingEventStudentIds = exitEvents
        .map((e: any) => String(e.aluno_id || '').trim())
        .filter((id: string) => id && !existingStudentIds.has(id))

      let missingAlunosMap: Record<string, any> = {}
      if (missingEventStudentIds.length > 0) {
        const { data: dbAlunos } = await supabase
          .from('alunos')
          .select('id, nome, turma, foto, foto_url')
          .in('id', missingEventStudentIds)
        if (dbAlunos) {
          dbAlunos.forEach((a: any) => {
            missingAlunosMap[String(a.id)] = a
          })
        }
      }

      for (const ev of exitEvents) {
        const aId = String(ev.aluno_id || '').trim()
        if (!aId) continue
        const dispNome = ev.dispositivo_nome || 'Catraca de Saída'
        if (!existingStudentIds.has(aId)) {
          existingStudentIds.add(aId)
          const al = missingAlunosMap[aId]
          const recordDate = ev.data_hora ? ev.data_hora.slice(0, 10) : targetDate
          rawResult.push({
            id: `catraca-saida-${aId}-${recordDate}`,
            studentId: aId,
            studentName: ev.aluno_nome || al?.nome || aId,
            studentClass: al?.turma || '',
            studentPhoto: al?.foto || al?.foto_url || null,
            guardianId: 'catraca-saida',
            guardianName: `Saiu Sozinho (${dispNome})`,
            calledAt: ev.data_hora || `${recordDate}T12:00:00-04:00`,
            confirmedAt: ev.data_hora || `${recordDate}T12:00:00-04:00`,
            status: 'confirmed',
            tipo: 'sozinho',
            origem: 'catraca_idface',
            dispositivoNome: dispNome,
            source: 'catraca'
          })
        } else {
          const existingCall = rawResult.find((c: any) => String(c.studentId || '').trim() === aId)
          if (existingCall) {
            existingCall.tipo = 'sozinho'
            existingCall.origem = 'catraca_idface'
            if (!existingCall.dispositivoNome) existingCall.dispositivoNome = dispNome
          }
        }
      }
    }

    // Retroalimentação / Enriquecimento de foto para chamadas que possuem studentId mas vieram sem foto
    const callsMissingPhoto = rawResult.filter((c: any) => !c.studentPhoto && c.studentId)
    if (callsMissingPhoto.length > 0) {
      const studentIdsToFetch = Array.from(new Set(callsMissingPhoto.map((c: any) => String(c.studentId).trim()).filter(Boolean)))
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
        .filter((c: any) => c.status === 'confirmed' && c.studentId != null)
        .map((c: any) => String(c.studentId))
    )

    // Normalize: if a student has a confirmed call, mark any un-reverted waiting/called calls for that student as confirmed
    const result = rawResult.map((c: any) => {
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
      
      // Processar Notificações de Saída e Chamada de Portaria em paralelo
      const pushTasks = rows.map(async (row: any) => {
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
        } else if (row.dados?.status === 'special_auth') {
          const isNewCall = !existing || existing.status !== 'special_auth'
          if (isNewCall) {
            await dispatchSpecialAuthNotification({
              callId: row.id,
              studentId: row.dados?.studentId,
              studentName: row.dados?.studentName,
              studentClass: row.dados?.studentClass,
              authorizedPerson: row.dados?.guardianName,
              targetTime: row.dados?.targetTime,
              operatorName: row.dados?.operatorId,
              studentPhoto: row.dados?.studentPhoto,
            })
          }
        }
      })
      await Promise.allSettled(pushTasks)

      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)

    const supabaseService = getAdminClient()
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayStr = formatter.format(new Date())

    const studentId = row.dados?.studentId ? String(row.dados.studentId) : null
    const incomingStatus = row.dados?.status
    const isRevert = !!row.dados?.isRevert

    // Consultas preliminares em paralelo: foto faltante, chamadas do aluno hoje, e registro existente
    const photoPromise = (studentId && !row.dados?.studentPhoto)
      ? supabaseService.from('alunos').select('foto, foto_url').eq('id', studentId).maybeSingle()
      : Promise.resolve({ data: null })

    const studentCallsPromise = (studentId && (incomingStatus === 'waiting' || incomingStatus === 'called') && !isRevert)
      ? supabaseService
          .from('saida_calls')
          .select('id, dados')
          .eq('dados->>studentId', studentId)
          .gte('created_at', `${todayStr}T00:00:00-04:00`)
      : Promise.resolve({ data: null })

    const existingRowPromise = supabaseService.from('saida_calls').select('dados').eq('id', row.id).maybeSingle()

    const [photoRes, studentCallsRes, existingRowRes] = await Promise.all([
      photoPromise,
      studentCallsPromise,
      existingRowPromise,
    ])

    const sPhoto = photoRes?.data as any
    if (sPhoto?.foto || sPhoto?.foto_url) {
      row.dados.studentPhoto = sPhoto.foto || sPhoto.foto_url
    }

    if (studentCallsRes?.data) {
      const studentCallsToday = studentCallsRes.data as any[]
      const confirmedEntry = studentCallsToday.find(r => {
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

    const existingRow = existingRowRes?.data as any
    
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

        const updateSiblingPromises = (siblingCalls || []).map(async sRow => {
          if (sRow.id === data.id) return
          let sDados = sRow.dados
          if (typeof sDados === 'string') { try { sDados = JSON.parse(sDados) } catch(e){} }
          if (sDados && (sDados.status === 'waiting' || sDados.status === 'called') && !sDados.isRevert) {
            sDados.status = 'confirmed'
            sDados.confirmedAt = data.dados?.confirmedAt || new Date().toISOString()
            await supabaseService.from('saida_calls').update({ dados: sDados }).eq('id', sRow.id)
          }
        })
        await Promise.all(updateSiblingPromises)
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
    } else if (data.dados?.status === 'special_auth') {
      const isNewCall = !existingRow || previousStatus !== 'special_auth'
      if (isNewCall) {
        await dispatchSpecialAuthNotification({
          callId: data.id,
          studentId: data.dados?.studentId,
          studentName: data.dados?.studentName,
          studentClass: data.dados?.studentClass,
          authorizedPerson: data.dados?.guardianName,
          targetTime: data.dados?.targetTime,
          operatorName: data.dados?.operatorId,
          studentPhoto: data.dados?.studentPhoto,
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
        targetUrl: `/agenda-digital/${rawStudentId}/frequencia`,
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

async function dispatchSpecialAuthNotification({
  callId,
  studentId,
  studentName,
  studentClass,
  authorizedPerson,
  targetTime,
  operatorName,
  studentPhoto,
}: {
  callId: string
  studentId?: string
  studentName?: string
  studentClass?: string
  authorizedPerson?: string
  targetTime?: string
  operatorName?: string
  studentPhoto?: string | null
}) {
  try {
    const supabaseService = getAdminClient()

    // 1. Fetch current saida_config to check if notifications are enabled and get target user IDs
    const { data: configRow } = await supabaseService
      .from('saida_config')
      .select('dados')
      .eq('id', 'default')
      .maybeSingle()

    const configDados = (configRow?.dados && typeof configRow.dados === 'object') ? configRow.dados : {}
    const isEnabled = configDados.specialAuthNotificationsEnabled !== false
    const targetUserIds: string[] = Array.isArray(configDados.specialAuthNotificationUserIds)
      ? configDados.specialAuthNotificationUserIds.filter(Boolean)
      : []

    if (!isEnabled || targetUserIds.length === 0) {
      console.log('[API Saida] Notificação de Autorização Especial: desativada ou nenhum colaborador configurado.')
      return
    }

    // 2. Fetch collaborator users safely (avoiding PostgreSQL 22P02 UUID cast errors)
    const effectiveUsers = await resolveCollaboratorUsers(supabaseService, targetUserIds)

    if (effectiveUsers.length === 0) {
      console.warn('[API Saida] Colaboradores configurados não encontrados no banco de dados:', targetUserIds)
      return
    }

    const { formatFriendlyStudentName } = await import('@/lib/studentNameHelper')
    const rawNomeAluno = studentName || 'o aluno'
    const nomeAmigavel = formatFriendlyStudentName(rawNomeAluno)
    const horaStr = targetTime && targetTime !== 'Indefinido' ? ` às ${targetTime}` : ''

    const pushTargets = new Set<string>()
    effectiveUsers.forEach(u => {
      if (u.id) pushTargets.add(String(u.id))
      if (u.auth_id) pushTargets.add(String(u.auth_id))
      if (u.email) pushTargets.add(String(u.email).toLowerCase().trim())
    })

    // 3. Dispatch OneSignal Mobile Push Notification if enabled
    const pushEnabled = configDados.specialAuthNotifyPush !== false
    if (pushEnabled) {
      const { sendAgendaPushNotification } = await import('@/lib/server/agendaNotifications')

      // Resolver subscriptions físicas diretas no OneSignal em paralelo
      const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
      const apiKey = process.env.ONESIGNAL_REST_API_KEY || ''
      const directSubIds: string[] = []

      if (appId && apiKey) {
        const subQueries = effectiveUsers.map(async u => {
          const idCandidates = [u.id, u.auth_id, u.email].filter(Boolean).map(String)
          for (const ident of idCandidates) {
            try {
              const res = await fetch(`https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(ident)}`, {
                headers: { Authorization: `Basic ${apiKey}` },
                cache: 'no-store'
              })
              if (res.ok) {
                const data = await res.json()
                const subs = Array.isArray(data.subscriptions) ? data.subscriptions : []
                for (const s of subs) {
                  if (s.id && s.enabled !== false && s.notification_types !== -99) {
                    directSubIds.push(s.id)
                  }
                }
                if (subs.length > 0) break
              }
            } catch {}
          }
        })
        await Promise.allSettled(subQueries)
      }

      const pushItemId = `special_auth_${callId}_${Date.now()}`
      await sendAgendaPushNotification({
        type: 'saida',
        itemId: pushItemId,
        title: '📝 Autorização Especial: Saída Liberada',
        message: `${nomeAmigavel}${studentClass ? ` (${studentClass})` : ''} liberado(a) para retirada por ${authorizedPerson || 'Pessoa Autorizada'}${horaStr}.`,
        targetUserIds: Array.from(pushTargets),
        targetSubscriptionIds: directSubIds.length > 0 ? Array.from(new Set(directSubIds)) : undefined,
        targetUrl: '/saida-alunos/chamadas',
        metadata: {
          tipo: 'autorizacao_especial',
          aluno_id: studentId || '',
          call_id: String(callId),
          perfil_destino: 'colaborador',
          targetUrl: '/saida-alunos/chamadas'
        }
      })
      console.log(`[API Saida] Push de Autorização Especial enviado para ${effectiveUsers.length} colaboradores (${directSubIds.length} aparelhos diretos):`, effectiveUsers.map(u => u.nome))
    }

    // 4. Emitir broadcast Realtime via Supabase para todas as instâncias conectadas
    try {
      const channel = supabaseService.channel('saida_calls_shared_room')
      await channel.send({
        type: 'broadcast',
        event: 'SPECIAL_AUTH_NOTIFY',
        payload: {
          data: {
            id: callId,
            studentName: studentName || 'Aluno',
            studentClass: studentClass || '',
            authorizedPerson: authorizedPerson || 'Pessoa Autorizada',
            targetTime: targetTime || '',
            studentPhoto: studentPhoto || null,
            targetUserIds: Array.from(pushTargets),
            isTest: false
          }
        }
      })
      await supabaseService.removeChannel(channel)
    } catch (realtimeErr) {
      console.warn('[API Saida] Falha no broadcast Realtime de Autorização Especial:', realtimeErr)
    }
  } catch (err: any) {
    console.error('[API Saida] Erro ao disparar notificação de Autorização Especial:', err.message)
  }
}
