import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { resolveCollaboratorUsers } from '@/lib/server/collaboratorLookup'

export const dynamic = 'force-dynamic'

// Cache em memória no servidor (TTL 300s) para evitar sobrecarga repetitiva na tabela alunos
const serverAlunosCache = new Map<string, { data: any, expires: number }>()

// Cache curto + deduplicação in-flight para GET /api/saida/calls
const saidaCallsResponseCache = new Map<string, { data: any[], expires: number }>()
const saidaCallsInflight = new Map<string, Promise<any[]>>()

function invalidateSaidaCallsCache() {
  saidaCallsResponseCache.clear()
}

async function fetchAlunosBatch(supabaseClient: any, ids: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {}
  const now = Date.now()
  const missingIds: string[] = []

  const cleanIds = Array.from(new Set(ids.map(id => String(id).trim()).filter(Boolean)))
  for (const id of cleanIds) {
    const cached = serverAlunosCache.get(id)
    if (cached && cached.expires > now) {
      if (cached.data) result[id] = cached.data
    } else {
      missingIds.push(id)
    }
  }

  if (missingIds.length === 0) return result

  // Chunking em blocos de até 60 IDs para evitar URLs gigantescas que geram HTTP 500 no PostgREST
  const CHUNK_SIZE = 60
  const foundSet = new Set<string>()
  for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
    const chunk = missingIds.slice(i, i + CHUNK_SIZE)
    const { data } = await supabaseClient
      .from('alunos')
      .select('id, matricula, nome, turma, foto, foto_url, dados_foto:dados->>foto, dados_avatar:dados->>avatarUrl, dados_foto_url:dados->>fotoUrl')
      .in('id', chunk)

    if (data && Array.isArray(data)) {
      data.forEach((a: any) => {
        const resolvedPhoto = a.foto || a.foto_url || a.dados_foto || a.dados_avatar || a.dados_foto_url || null
        const normalized = {
          id: a.id,
          matricula: a.matricula,
          nome: a.nome,
          turma: a.turma,
          foto: resolvedPhoto,
          foto_url: a.foto_url || resolvedPhoto
        }
        const strId = String(a.id).trim()
        foundSet.add(strId)
        result[strId] = normalized
        serverAlunosCache.set(strId, { data: normalized, expires: now + 300000 })
        if (a.matricula) {
          const strMat = String(a.matricula).trim()
          foundSet.add(strMat)
          result[strMat] = normalized
          serverAlunosCache.set(strMat, { data: normalized, expires: now + 300000 })
        }
      })
    }
  }

  // Cache negative lookups briefly (60s) to avoid hammering DB for unknown IDs
  for (const id of missingIds) {
    if (!foundSet.has(id)) {
      serverAlunosCache.set(id, { data: null, expires: now + 60000 })
    }
  }

  return result
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const fromDate = url.searchParams.get('from')
    const toDate = url.searchParams.get('to')
    const studentId = url.searchParams.get('studentId')
    const onlySpecialAuth = url.searchParams.get('onlySpecialAuth') === 'true'
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 500

    const supabase = getAdminClient()

    let studentIdsToMatch = studentId ? [String(studentId).trim()] : []
    if (studentId) {
      // Obter id e matricula para filtrar de forma completa e resiliente
      const { data: dbAluno } = await supabase
        .from('alunos')
        .select('id, matricula')
        .or(`id.eq.${studentId},matricula.eq.${studentId}`)
        .limit(1)
        .maybeSingle()

      if (dbAluno) {
        if (dbAluno.id) studentIdsToMatch.push(String(dbAluno.id).trim())
        if (dbAluno.matricula) studentIdsToMatch.push(String(dbAluno.matricula).trim())
      }
      studentIdsToMatch = Array.from(new Set(studentIdsToMatch.filter(Boolean)))
    }

    // Autorização de acesso:
    // 1. Se studentId for fornecido:
    //    - Staff tem acesso irrestrito.
    //    - Família/Aluno autenticado só tem acesso se vinculado ao aluno (proteção IDOR).
    // 2. Se studentId NÃO for fornecido, mas fromDate ou toDate foram informados:
    //    - Consulta histórica de relatórios gerais da escola inteira exige perfil de Staff.
    // 3. Sem studentId e sem período histórico (ou apenas date=hoje):
    //    - Painel operacional do dia a dia da escola (Monitor TV / Portaria / Tablet), público na rede interna.
    if (studentId) {
      const { resolveUserRole } = await import('@/lib/server/authGuard')
      const { user, isStaff, errorResponse } = await resolveUserRole(request)
      if (errorResponse) return errorResponse

      if (!isStaff) {
        if (!user) {
          return NextResponse.json({ error: 'Autenticação necessária para consultar chamadas deste aluno.' }, { status: 401 })
        }
        const { checkResponsavelRelationship } = await import('@/lib/server/notificationHelper')
        const checkId = user.user_metadata?.responsavel_id || user.user_metadata?.aluno_id || user.id
        
        let hasAccess = false
        for (const targetId of studentIdsToMatch) {
          if (await checkResponsavelRelationship(String(checkId), targetId, user.email)) {
            hasAccess = true
            break
          }
        }

        if (!hasAccess) {
          return NextResponse.json({ error: 'Acesso negado às chamadas de saída deste aluno.' }, { status: 403 })
        }
      }
    } else if (fromDate || toDate) {
      const { requireStaff } = await import('@/lib/server/authGuard')
      const { errorResponse } = await requireStaff(request)
      if (errorResponse) return errorResponse
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
    const effectiveTo = toDate || dateParam || (!fromDate ? todayStr : null)

    const cacheKey = `${effectiveFrom || ''}_${effectiveTo || ''}_${studentIdsToMatch.join(',')}_${limit}_${onlySpecialAuth ? 'special' : 'all'}`
    const fullCacheKey = `${effectiveFrom || ''}_${effectiveTo || ''}_${studentIdsToMatch.join(',')}_${limit}_all`
    const nowMs = Date.now()
    const cachedResp = saidaCallsResponseCache.get(cacheKey)
    if (cachedResp && cachedResp.expires > nowMs) {
      return NextResponse.json(cachedResp.data, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache'
        }
      })
    }

    // Se for onlySpecialAuth e já houver cache ou request in-flight da lista completa do mesmo dia, reaproveita sem bater no banco!
    if (onlySpecialAuth) {
      const cachedFull = saidaCallsResponseCache.get(fullCacheKey)
      if (cachedFull && cachedFull.expires > nowMs) {
        const specialFiltered = cachedFull.data.filter((c: any) => c.status === 'special_auth' || c.guardianId === 'special' || c.guardianId === 'special-auth')
        return NextResponse.json(specialFiltered, {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'Pragma': 'no-cache'
          }
        })
      }
    }

    const existingPromise = saidaCallsInflight.get(cacheKey)
    if (existingPromise) {
      const sharedResult = await existingPromise
      return NextResponse.json(sharedResult, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache'
        }
      })
    }

    const computePromise = (async () => {
      const isUnboundedStudentHistory =
        studentIdsToMatch.length > 0 &&
        effectiveFrom === '2020-01-01' &&
        (!effectiveTo || effectiveTo >= '2030-01-01')

      let query = supabase.from('saida_calls').select('id, dados, created_at').order('created_at', { ascending: false }).limit(limit)
      
      if (studentIdsToMatch.length === 1) {
        query = query.eq('dados->>studentId', studentIdsToMatch[0])
      } else if (studentIdsToMatch.length > 1) {
        query = query.or(studentIdsToMatch.map(id => `dados->>studentId.eq.${id}`).join(','))
      }
      
      if (effectiveFrom && !isUnboundedStudentHistory) {
        query = query.gte('created_at', `${effectiveFrom}T00:00:00-04:00`)
      }
      if (effectiveTo && !isUnboundedStudentHistory) {
        query = query.lte('created_at', `${effectiveTo}T23:59:59.999-04:00`)
      }

      // Query adicional para autorizações especiais multi-dias criadas em dias anteriores mas vigentes no período
      // Desnecessária quando isUnboundedStudentHistory = true pois a query principal já traz todo o histórico do aluno
      let multiDaySpecialQuery: any = null
      if (!isUnboundedStudentHistory) {
        multiDaySpecialQuery = supabase
          .from('saida_calls')
          .select('id, dados, created_at')
          .eq('dados->>status', 'special_auth')
          .gte('dados->>validUntil', effectiveFrom || todayStr)
          .limit(200)

        if (studentIdsToMatch.length === 1) {
          multiDaySpecialQuery = multiDaySpecialQuery.eq('dados->>studentId', studentIdsToMatch[0])
        } else if (studentIdsToMatch.length > 1) {
          multiDaySpecialQuery = multiDaySpecialQuery.or(studentIdsToMatch.map(id => `dados->>studentId.eq.${id}`).join(','))
        }
        if (effectiveTo) {
          multiDaySpecialQuery = multiDaySpecialQuery.lte('dados->>validFrom', effectiveTo)
        }
      }

      const toCampoGrandeYmd = (dt?: string | null): string => {
        if (!dt) return ''
        if (/^\d{4}-\d{2}-\d{2}$/.test(dt.trim())) return dt.trim()
        try {
          const d = new Date(dt.includes('T') && !dt.endsWith('Z') && !dt.includes('-') && !dt.includes('+') ? `${dt}-04:00` : dt)
          if (!isNaN(d.getTime())) {
            return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(d)
          }
        } catch {}
        return dt.slice(0, 10)
      }

      const normalizeSpecialAuthForDate = (c: any, refDate: string) => {
        if (c.status !== 'special_auth') return c
        const confirmedDates: Record<string, string> =
          c.confirmedDates && typeof c.confirmedDates === 'object' ? { ...c.confirmedDates } : {}
        if (c.confirmedOut && c.confirmedAt) {
          const legYmd = toCampoGrandeYmd(c.confirmedAt)
          if (legYmd && !confirmedDates[legYmd]) {
            confirmedDates[legYmd] = c.confirmedAt
          }
        }
        const confirmedAtOnRef = confirmedDates[refDate] || undefined
        return {
          ...c,
          confirmedDates,
          confirmedOut: Boolean(confirmedAtOnRef),
          confirmedAt: confirmedAtOnRef,
        }
      }

      // Fast-path para NotificationPopover: busca apenas saida_calls primeiro
      if (onlySpecialAuth) {
        const [callsRes, multiSpecialRes] = await Promise.all([
          query,
          Promise.resolve(multiDaySpecialQuery).catch(() => ({ data: [] as any[] }))
        ])
        if (callsRes.error) throw new Error(callsRes.error.message)
        const mergedRowsMap = new Map<string, any>()
        for (const row of (callsRes.data || [])) mergedRowsMap.set(row.id, row)
        for (const row of ((multiSpecialRes as any)?.data || [])) {
          if (!mergedRowsMap.has(row.id)) mergedRowsMap.set(row.id, row)
        }
        let rawCalls: any[] = Array.from(mergedRowsMap.values()).map((row: any) => ({ id: row.id, ...(row.dados || {}) }))
        const specialAuths = rawCalls
          .filter((c: any) => {
            if (!(c.status === 'special_auth' || c.guardianId === 'special' || c.guardianId === 'special-auth')) return false
            const callDate = toCampoGrandeYmd(c.calledAt || c.confirmedAt) || todayStr
            const vFrom = (typeof c.validFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.validFrom)) ? c.validFrom : callDate
            const vUntil = (typeof c.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.validUntil)) ? c.validUntil : vFrom
            if (effectiveFrom && vUntil < effectiveFrom) return false
            if (effectiveTo && vFrom > effectiveTo) return false
            return true
          })
          .map((c: any) => normalizeSpecialAuthForDate(c, targetDate))

        if (specialAuths.length === 0) {
          return []
        }
        const specialAuthIds = new Set(specialAuths.map((c: any) => c.id))
        const specialStudentIds = Array.from(new Set(specialAuths.map((c: any) => String(c.studentId || '').trim()).filter(Boolean)))
        const confirmedCalls = rawCalls.filter((c: any) => {
          if (specialAuthIds.has(c.id) || c.status !== 'confirmed' || !specialStudentIds.includes(String(c.studentId || '').trim())) return false
          const cDate = toCampoGrandeYmd(c.confirmedAt || c.calledAt)
          return !cDate || cDate === targetDate
        })
        const combined = [...specialAuths, ...confirmedCalls]
        const missingPhotos = combined.filter((c: any) => !c.studentPhoto && c.studentId)
        if (missingPhotos.length > 0) {
          const photoMap = await fetchAlunosBatch(supabase, missingPhotos.map((c: any) => String(c.studentId)))
          for (const c of missingPhotos) {
            const p = photoMap[String(c.studentId).trim()]
            if (p?.foto || p?.foto_url) {
              c.studentPhoto = p.foto || p.foto_url
            }
          }
        }
        return combined
      }
      
      let freqQuery = supabase
        .from('frequencias')
        .select('id, aluno_id, turma_id, data, dados, created_at')
        .or('dados->>saidaHorario.not.is.null,dados->saidas.not.is.null,dados->>saidaCancelada.eq.true,dados->>usuarioNome.not.is.null')

      if (studentIdsToMatch.length === 1) {
        freqQuery = freqQuery.eq('aluno_id', studentIdsToMatch[0])
      } else if (studentIdsToMatch.length > 1) {
        freqQuery = freqQuery.in('aluno_id', studentIdsToMatch)
      }

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

      if (studentIdsToMatch.length === 1) {
        eventosQuery = eventosQuery.eq('aluno_id', studentIdsToMatch[0])
      } else if (studentIdsToMatch.length > 1) {
        eventosQuery = eventosQuery.in('aluno_id', studentIdsToMatch)
      }

      if (effectiveFrom) {
        eventosQuery = eventosQuery.gte('data_hora', `${effectiveFrom}T00:00:00-04:00`)
      }
      if (effectiveTo) {
        eventosQuery = eventosQuery.lte('data_hora', `${effectiveTo}T23:59:59.999-04:00`)
      }
      eventosQuery = eventosQuery.limit(Math.min(limit, 1000))
      freqQuery = freqQuery.limit(Math.min(limit, 1000))

      // Executa as consultas ao Supabase em paralelo para reduzir tempo de resposta
      const [callsRes, multiSpecialRes, freqRes, eventosRes] = await Promise.all([
        query,
        Promise.resolve(multiDaySpecialQuery).catch(() => ({ data: [] as any[] })),
        freqQuery,
        Promise.resolve(eventosQuery).catch(() => ({ data: [] as any[] }))
      ])
      if (callsRes.error) throw new Error(callsRes.error.message)
      
      const mergedDataMap = new Map<string, any>()
      for (const row of (callsRes.data || [])) mergedDataMap.set(row.id, row)
      for (const row of ((multiSpecialRes as any)?.data || [])) {
        if (!mergedDataMap.has(row.id)) mergedDataMap.set(row.id, row)
      }
      const data = Array.from(mergedDataMap.values())
      const freqRecords: any[] = freqRes.data || []
      const exitEvents: any[] = (eventosRes && 'data' in eventosRes && Array.isArray((eventosRes as any).data)) ? (eventosRes as any).data : []
      let rawResult: any[] = (data || []).map((row: any) => ({ id: row.id, created_at: row.created_at, ...(row.dados || {}) }))

      // Filtrar para garantir que apenas chamadas cuja data efetiva (calledAt / confirmedAt) ou período de validade (special_auth) corresponde ao período solicitado sejam retornadas
      if (effectiveFrom || effectiveTo) {
        rawResult = rawResult.filter((c: any) => {
          if (c.status === 'special_auth') {
            const callDate = toCampoGrandeYmd(c.calledAt || c.confirmedAt) || todayStr
            const vFrom = (typeof c.validFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.validFrom)) ? c.validFrom : callDate
            const vUntil = (typeof c.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.validUntil)) ? c.validUntil : vFrom
            if (effectiveFrom && vUntil < effectiveFrom) return false
            if (effectiveTo && vFrom > effectiveTo) return false
            return true
          }
          const dt = c.calledAt || c.confirmedAt
          if (!dt) return true
          const callDate = toCampoGrandeYmd(dt)
          if (effectiveFrom && callDate < effectiveFrom) return false
          if (effectiveTo && callDate > effectiveTo) return false
          return true
        })
      }

      // Normaliza o status diário de confirmação de autorizações especiais para a data alvo (targetDate)
      rawResult = rawResult.map((c: any) => c.status === 'special_auth' ? normalizeSpecialAuthForDate(c, targetDate) : c)

      // Identifica saídas explicitamente canceladas no Diário de Frequência para não reexibir eventos de catraca/chamadas antigas
      const cancelledSaidaKeys = new Set<string>()
      for (const fRecord of (freqRecords || [])) {
        if (fRecord.dados?.saidaCancelada === true && !fRecord.dados?.saidaHorario) {
          const aId = String(fRecord.aluno_id || '').trim()
          const dt = String(fRecord.data || targetDate).trim()
          if (aId && dt) {
            cancelledSaidaKeys.add(`${aId}_${dt}`)
            const normId = aId.replace(/^0+/, '') || '0'
            cancelledSaidaKeys.add(`${normId}_${dt}`)
          }
        }
      }

      if (cancelledSaidaKeys.size > 0) {
        rawResult = rawResult.filter((c: any) => {
          if (c.status !== 'confirmed') return true
          const sId = String(c.studentId || '').trim()
          const normId = sId.replace(/^0+/, '') || '0'
          const callDate = toCampoGrandeYmd(c.confirmedAt || c.calledAt || c.created_at) || targetDate
          return !cancelledSaidaKeys.has(`${sId}_${callDate}`) && !cancelledSaidaKeys.has(`${normId}_${callDate}`)
        })
      }

      const getCallTimeKey = (sId: string, dtStr?: string) => {
        if (!sId || !dtStr) return ''
        try {
          const safeStr = dtStr.includes('T') && !dtStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(dtStr) ? `${dtStr}-04:00` : dtStr
          const d = new Date(safeStr)
          if (isNaN(d.getTime())) return `${sId}_${String(dtStr).slice(0, 16)}`
          const ymd = toCampoGrandeYmd(safeStr)
          const hm = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' })
          return `${sId}_${ymd}_${hm}`
        } catch {
          return `${sId}_${String(dtStr).slice(0, 16)}`
        }
      }

      const extractExplicitSaidaOperator = (fDados: any): string | undefined => {
        if (!fDados || typeof fDados !== 'object') return undefined
        for (const candidate of [fDados.saidaUsuario, fDados.confirmedBy, fDados.operatorId, fDados.authorizedBy]) {
          if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
        }
        return undefined
      }

      const extractFreqUserOperator = (fDados: any): string | undefined => {
        if (!fDados || typeof fDados !== 'object') return undefined
        const explicit = extractExplicitSaidaOperator(fDados)
        if (explicit) return explicit
        if (typeof fDados.usuarioNome === 'string' && fDados.usuarioNome.trim()) {
          return fDados.usuarioNome.trim()
        }
        const reg = typeof fDados.registradoPor === 'string' ? fDados.registradoPor.trim() : ''
        if (reg) {
          const m = reg.match(/^Manual\s*\((.+)\)$/i)
          if (m && m[1] && m[1].trim().toLowerCase() !== 'auto') {
            return m[1].trim()
          }
          const lower = reg.toLowerCase()
          if (lower !== 'manual' && lower !== 'manual (auto)' && !lower.includes('catraca') && !lower.includes('idface') && !lower.includes('totem')) {
            return reg
          }
        }
        return undefined
      }

      const extractDiarioManualOperator = (fDados: any): string | undefined => {
        if (!fDados || typeof fDados !== 'object') return undefined
        const explicit = extractExplicitSaidaOperator(fDados)
        if (explicit) return explicit
        // Somente considera usuarioNome / registradoPor da frequência como lançamento manual quando a saída foi lançada manualmente no Diário
        if (String(fDados.saidaOrigem || '').toLowerCase() !== 'manual') return undefined
        return extractFreqUserOperator(fDados)
      }

      const existingCallKeys = new Set(rawResult.map((c: any) => getCallTimeKey(c.studentId, c.confirmedAt || c.calledAt)).filter(Boolean))
      const existingCallIds = new Set(rawResult.map((c: any) => String(c.id || '').trim()).filter(Boolean))

      // Mapa de operador por aluno+data vindo de autorizações especiais (special_auth)
      const specialAuthOperatorByStudent = new Map<string, string>()
      for (const c of rawResult) {
        if ((c.status === 'special_auth' || c.guardianId === 'special' || c.guardianId === 'special-auth') && c.studentId && (c.operatorId || c.authorizedBy)) {
          const sId = String(c.studentId).trim()
          const op = String(c.authorizedBy || c.operatorId).trim()
          if (sId && op) {
            specialAuthOperatorByStudent.set(sId, op)
            const cDate = toCampoGrandeYmd(c.confirmedAt || c.calledAt || c.created_at) || targetDate
            specialAuthOperatorByStudent.set(`${sId}_${cDate}`, op)
          }
        }
      }

      // Pré-filtra apenas frequências que efetivamente possuem registro de saída (e não foram canceladas)
      const freqRecordsWithSaidas = (freqRecords || []).filter((fRecord: any) => {
        if (fRecord.dados?.saidaCancelada === true && !fRecord.dados?.saidaHorario) return false
        const hasArraySaidas = Array.isArray(fRecord.dados?.saidas) && fRecord.dados.saidas.length > 0
        const hasSingleSaida = Boolean(fRecord.dados?.saidaHorario)
        return hasArraySaidas || hasSingleSaida
      })

      // Mapas de operador por aluno+data e por turma+data (separando saída explícita vs operador da frequência / turma)
      const freqExplicitOperatorByStudentDate = new Map<string, string>()
      const freqUserOperatorByStudentDate = new Map<string, string>()
      const freqManualOperatorByStudentDate = new Map<string, string>()
      const freqTurmaByStudentDate = new Map<string, string>()
      const freqTurmaOpCounts = new Map<string, Record<string, number>>()

      for (const fRecord of (freqRecords || [])) {
        const aId = String(fRecord.aluno_id || '').trim()
        const recordDate = fRecord.data || targetDate
        const tId = fRecord.turma_id ? String(fRecord.turma_id).trim() : ''
        const userOp = extractFreqUserOperator(fRecord.dados)

        if (tId && userOp) {
          const tKey = `${tId}_${recordDate}`
          const counts = freqTurmaOpCounts.get(tKey) || {}
          counts[userOp] = (counts[userOp] || 0) + 1
          freqTurmaOpCounts.set(tKey, counts)
        }

        if (!aId) continue
        const normId = aId.replace(/^0+/, '') || '0'

        if (tId) {
          freqTurmaByStudentDate.set(`${aId}_${recordDate}`, tId)
          freqTurmaByStudentDate.set(`${normId}_${recordDate}`, tId)
        }

        const explicitOp = extractExplicitSaidaOperator(fRecord.dados)
        if (explicitOp) {
          freqExplicitOperatorByStudentDate.set(`${aId}_${recordDate}`, explicitOp)
          freqExplicitOperatorByStudentDate.set(`${normId}_${recordDate}`, explicitOp)
        }

        if (userOp) {
          freqUserOperatorByStudentDate.set(`${aId}_${recordDate}`, userOp)
          freqUserOperatorByStudentDate.set(`${normId}_${recordDate}`, userOp)
        }

        const diarioOp = extractDiarioManualOperator(fRecord.dados)
        if (diarioOp) {
          freqManualOperatorByStudentDate.set(`${aId}_${recordDate}`, diarioOp)
          freqManualOperatorByStudentDate.set(`${normId}_${recordDate}`, diarioOp)
        }
      }

      const freqOperatorByTurmaDate = new Map<string, string>()
      for (const [tKey, counts] of freqTurmaOpCounts.entries()) {
        const topOp = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (topOp) freqOperatorByTurmaDate.set(tKey, topOp)
      }

      // Busca única unificada de alunos para enriquecer frequências, eventos de catraca e chamadas
      const unifiedStudentIds = new Set<string>()
      for (const f of freqRecordsWithSaidas) {
        const id = String(f.aluno_id || '').trim()
        if (id) unifiedStudentIds.add(id)
      }
      for (const ev of exitEvents) {
        const id = String(ev.aluno_id || '').trim()
        if (id) unifiedStudentIds.add(id)
      }
      for (const c of rawResult) {
        if (c.studentId) {
          const id = String(c.studentId).trim()
          if (id) unifiedStudentIds.add(id)
        }
      }

      const unifiedAlunosMap: Record<string, any> = unifiedStudentIds.size > 0
        ? await fetchAlunosBatch(supabase, Array.from(unifiedStudentIds))
        : {}

      if (freqRecordsWithSaidas.length > 0) {
        for (const fRecord of freqRecordsWithSaidas) {
          const aId = String(fRecord.aluno_id || '').trim()
          if (!aId) continue
          const recordDate = fRecord.data || targetDate
          const al = unifiedAlunosMap[aId]
          const freqOp = extractDiarioManualOperator(fRecord.dados)
          const specialOpForSynth = specialAuthOperatorByStudent.get(`${aId}_${recordDate}`) || specialAuthOperatorByStudent.get(aId)

          const todasSaidas = Array.isArray(fRecord.dados?.saidas) && fRecord.dados.saidas.length > 0
            ? fRecord.dados.saidas
            : (fRecord.dados?.saidaHorario ? [{
                hora: formatHoraSaida(fRecord.dados.saidaHorario),
                dispositivo: fRecord.dados.saidaResponsavel,
                data_hora: String(fRecord.dados.saidaHorario).includes('T')
                  ? fRecord.dados.saidaHorario
                  : `${recordDate}T${formatHoraSaida(fRecord.dados.saidaHorario)}:00-04:00`
              }] : [])

          for (const s of todasSaidas) {
            const sHorario = s.hora ? formatHoraSaida(s.hora) : undefined
            const sResp = s.dispositivo || fRecord.dados?.saidaResponsavel
            const sOrigem = fRecord.dados?.saidaOrigem
            if (sHorario || sResp) {
              const isCatraca = sOrigem === 'catraca' || (sResp && String(sResp).toLowerCase().includes('catraca'))
              const isRfid = sOrigem === 'rfid'
              const isSolo = isCatraca || (sResp && String(sResp).toLowerCase().includes('sozinho'))
              const expectedIso = `${recordDate}T${sHorario || '12:00'}:00-04:00`
              let callTime = expectedIso
              if (s.data_hora) {
                const candidateTime = String(s.data_hora).includes('T') && (String(s.data_hora).endsWith('Z') || /\.\d+/.test(String(s.data_hora)))
                  ? String(s.data_hora)
                  : String(s.data_hora).replace(/(?:Z|\+00(?::00)?)$/i, '-04:00')
                if (!sHorario || formatHoraSaida(candidateTime) === sHorario) {
                  callTime = candidateTime
                }
              }
              const synthId = `freq-saida-${aId}-${recordDate}-${String(sHorario || '').replace(':', '')}`
              const callKey = getCallTimeKey(aId, callTime)
              if (!existingCallKeys.has(callKey) && !existingCallIds.has(synthId)) {
                if (callKey) existingCallKeys.add(callKey)
                existingCallIds.add(synthId)
                const itemOp = s.usuario || s.operatorId || ((!isCatraca && !isRfid) ? (specialOpForSynth || freqOp) : specialOpForSynth)
                rawResult.push({
                  id: synthId,
                  studentId: aId,
                  studentName: al?.nome || aId,
                  studentClass: al?.turma || fRecord.turma_id || '',
                  studentPhoto: al?.foto || al?.foto_url || null,
                  guardianId: isCatraca ? 'catraca-saida' : (isRfid ? 'rfid' : (isSolo ? 'sozinho' : 'frequencia-diario')),
                  guardianName: sResp || (isSolo ? 'Saiu Sozinho' : 'Responsável Cadastrado'),
                  operatorId: itemOp,
                  authorizedBy: itemOp,
                  calledAt: callTime,
                  confirmedAt: callTime,
                  created_at: callTime,
                  status: 'confirmed',
                  source: isCatraca ? 'catraca' : (isRfid ? 'rfid' : (sOrigem === 'chamadas' ? 'chamadas' : 'frequencia')),
                  tipo: isSolo ? 'sozinho' : undefined,
                  origem: isCatraca ? 'catraca_idface' : (isRfid ? 'rfid' : (sOrigem || (isSolo ? 'manual' : undefined)))
                })
              }
            }
          }
        }
      }

      if (exitEvents && exitEvents.length > 0) {
        for (const ev of exitEvents) {
          const aId = String(ev.aluno_id || '').trim()
          if (!aId) continue
          const normId = aId.replace(/^0+/, '') || '0'
          const dispNome = ev.dispositivo_nome || 'Catraca de Saída'
          const recordDate = ev.data_hora ? ev.data_hora.slice(0, 10) : targetDate
          if (cancelledSaidaKeys.has(`${aId}_${recordDate}`) || cancelledSaidaKeys.has(`${normId}_${recordDate}`)) {
            continue
          }
          const rawTimePart = ev.data_hora ? ev.data_hora.slice(11, 19) : '12:00:00'
          const normalizedExitIso = `${recordDate}T${rawTimePart.length === 5 ? rawTimePart + ':00' : (rawTimePart || '12:00:00')}-04:00`
          const evTimeKey = getCallTimeKey(aId, normalizedExitIso)
          const timeToken = ev.data_hora ? ev.data_hora.slice(11, 16).replace(':', '') : '1200'
          const synthCatracaId = `catraca-saida-${aId}-${recordDate}-${timeToken}`
          if (!existingCallKeys.has(evTimeKey) && !existingCallIds.has(synthCatracaId)) {
            if (evTimeKey) existingCallKeys.add(evTimeKey)
            existingCallIds.add(synthCatracaId)
            const al = unifiedAlunosMap[aId]
            rawResult.push({
              id: synthCatracaId,
              studentId: aId,
              studentName: ev.aluno_nome || al?.nome || aId,
              studentClass: al?.turma || '',
              studentPhoto: al?.foto || al?.foto_url || null,
              guardianId: 'catraca-saida',
              guardianName: `Saiu Sozinho (${dispNome})`,
              calledAt: normalizedExitIso,
              confirmedAt: normalizedExitIso,
              created_at: normalizedExitIso,
              status: 'confirmed',
              tipo: 'sozinho',
              origem: 'catraca_idface',
              dispositivoNome: dispNome,
              source: 'catraca'
            })
          }
        }
      }

      if (studentIdsToMatch.length > 0) {
        const matchSet = new Set(studentIdsToMatch)
        rawResult = rawResult.filter((c: any) => matchSet.has(String(c.studentId || '').trim()))
      }

      // Deduplicação final por chave de minuto + garantia de ID único para evitar duplicidade de chaves no React
      const uniqueMap = new Map<string, any>()
      for (const c of rawResult) {
        const k = c.status === 'special_auth' ? `special_auth_${c.id}` : (getCallTimeKey(c.studentId, c.confirmedAt || c.calledAt) || c.id)
        if (!uniqueMap.has(k)) {
          uniqueMap.set(k, c)
        } else {
          const old = uniqueMap.get(k)
          // Se um registro confirmado e um cancelado colidirem ou mesmo ID colidir, preserva o mais relevante e mescla metadados
          const preferred = (old.status === 'confirmed' && c.status === 'cancelled') ? old : c
          const secondary = preferred === old ? c : old
          uniqueMap.set(k, {
            ...secondary,
            ...preferred,
            studentPhoto: old.studentPhoto || c.studentPhoto,
            operatorId: preferred.operatorId || secondary.operatorId,
            authorizedBy: preferred.authorizedBy || secondary.authorizedBy || preferred.operatorId || secondary.operatorId,
            confirmedBy: preferred.confirmedBy || secondary.confirmedBy,
          })
        }
      }

      const byIdMap = new Map<string, any>()
      for (const c of uniqueMap.values()) {
        const idKey = String(c.id || '').trim() || crypto.randomUUID()
        if (!byIdMap.has(idKey)) {
          byIdMap.set(idKey, c)
        } else {
          const old = byIdMap.get(idKey)
          const preferred = (c.status === 'confirmed' && old.status !== 'confirmed') ? c : old
          const secondary = preferred === old ? c : old
          byIdMap.set(idKey, {
            ...secondary,
            ...preferred,
            studentPhoto: old.studentPhoto || c.studentPhoto,
            operatorId: preferred.operatorId || secondary.operatorId,
            authorizedBy: preferred.authorizedBy || secondary.authorizedBy || preferred.operatorId || secondary.operatorId,
            confirmedBy: preferred.confirmedBy || secondary.confirmedBy,
          })
        }
      }
      rawResult = Array.from(byIdMap.values())

      // Mapa de usuário que confirmou a saída por aluno+data (cruzando chamadas irmãs do mesmo aluno no mesmo dia)
      const confirmedByStudentDate = new Map<string, string>()
      for (const c of rawResult) {
        const sId = c.studentId ? String(c.studentId).trim() : ''
        if (!sId) continue
        const cDate = toCampoGrandeYmd(c.confirmedAt || c.calledAt || c.created_at) || targetDate
        const isConfirmed = c.status === 'confirmed' || Boolean(c.confirmedAt) || Boolean(c.confirmedOut)
        if (!isConfirmed) continue
        const cleanGuardian = String(c.guardianName || '').trim().toLowerCase()
        const isAgendaCall =
          c.source === 'agenda_digital' ||
          c.guardianId === 'usr-fam' ||
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(c.guardianId || '').trim())
        const isSpecialRecord = c.status === 'special_auth' || c.guardianId === 'special'
        const candidate = String(
          c.confirmedBy ||
          (!isAgendaCall && !isSpecialRecord ? c.operatorId : '') ||
          ''
        ).trim()
        if (
          candidate &&
          candidate !== 'Admin Logado' &&
          candidate !== 'Sistema' &&
          !candidate.toLowerCase().includes('(app agenda digital)') &&
          (!cleanGuardian || candidate.toLowerCase() !== cleanGuardian)
        ) {
          confirmedByStudentDate.set(`${sId}_${cDate}`, candidate)
        }
      }

      // Retroalimentação / Enriquecimento de foto e operador (confirmado por / autorizado por / lançado por)
      for (const c of rawResult) {
        const sId = c.studentId ? String(c.studentId).trim() : ''
        const alunoInfo = sId ? unifiedAlunosMap[sId] : undefined
        if (!c.studentPhoto && alunoInfo) {
          if (alunoInfo.foto || alunoInfo.foto_url) {
            c.studentPhoto = alunoInfo.foto || alunoInfo.foto_url
          }
        }
        if (sId) {
          const cDate = toCampoGrandeYmd(c.confirmedAt || c.calledAt || c.created_at) || targetDate
          const specialOp = specialAuthOperatorByStudent.get(`${sId}_${cDate}`) || specialAuthOperatorByStudent.get(sId)
          const explicitFreqOp = freqExplicitOperatorByStudentDate.get(`${sId}_${cDate}`)
          const freqUserOp = freqUserOperatorByStudentDate.get(`${sId}_${cDate}`)
          const diarioManualOp = freqManualOperatorByStudentDate.get(`${sId}_${cDate}`)
          const studentTurmaId = freqTurmaByStudentDate.get(`${sId}_${cDate}`) || String(alunoInfo?.turma || c.studentClass || '').trim()
          const turmaFreqOp = studentTurmaId ? freqOperatorByTurmaDate.get(`${studentTurmaId}_${cDate}`) : undefined
          const siblingConfirmedOp = confirmedByStudentDate.get(`${sId}_${cDate}`)

          const isRfid =
            c.source === 'rfid' ||
            String(c.guardianId || '').startsWith('rfid-') ||
            Boolean(c.rfidCode)
          const isCatraca =
            c.source === 'catraca' ||
            c.guardianId === 'catraca-saida' ||
            c.origem === 'catraca_idface' ||
            String(c.id || '').startsWith('saida-catraca-') ||
            String(c.id || '').startsWith('catraca-saida-') ||
            Boolean(c.dispositivoNome) ||
            String(c.guardianName || '').toLowerCase().includes('catraca') ||
            String(c.guardianName || '').toLowerCase().includes('rua das garças')
          const isSpecialAuth =
            c.status === 'special_auth' ||
            c.guardianId === 'special' ||
            c.guardianId === 'special-auth'
          const isDiarioManual =
            c.guardianId === 'manual-infantil' ||
            c.guardianId === 'frequencia-diario' ||
            c.source === 'frequencia' ||
            String(c.id || '').startsWith('infantil-') ||
            String(c.id || '').startsWith('freq-saida-')
          const isAgendaDigitalCall =
            c.source === 'agenda_digital' ||
            c.guardianId === 'usr-fam' ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(c.guardianId || '').trim())
          const isConfirmedCall =
            c.status === 'confirmed' ||
            Boolean(c.confirmedAt) ||
            Boolean(c.confirmedOut)

          const cleanGuardian = String(c.guardianName || '').trim().toLowerCase()
          const isNotGuardian = (val?: string) => {
            if (!val || typeof val !== 'string') return false
            const v = val.trim()
            if (!v || v === 'Admin Logado' || v === 'Sistema') return false
            if (v.toLowerCase().includes('(app agenda digital)')) return false
            if (cleanGuardian && v.toLowerCase() === cleanGuardian) return false
            return true
          }

          const resolvedConfirmer =
            (isNotGuardian(c.confirmedBy) ? String(c.confirmedBy).trim() : undefined) ||
            (isNotGuardian(explicitFreqOp) ? explicitFreqOp : undefined) ||
            siblingConfirmedOp ||
            (!isAgendaDigitalCall && !isRfid && !isCatraca && c.status !== 'special_auth' && isNotGuardian(c.operatorId) ? String(c.operatorId).trim() : undefined) ||
            (isNotGuardian(freqUserOp) ? freqUserOp : undefined) ||
            (isNotGuardian(turmaFreqOp) ? turmaFreqOp : undefined)

          if (isSpecialAuth) {
            if (!c.operatorId) c.operatorId = specialOp || explicitFreqOp || diarioManualOp || freqUserOp || turmaFreqOp
            if (!c.authorizedBy) c.authorizedBy = specialOp || c.operatorId
            if (isConfirmedCall && resolvedConfirmer) {
              c.confirmedBy = resolvedConfirmer
            }
          } else if (isCatraca) {
            // Saída automatizada por Catraca Biométrica iDFace: apenas herda autorizador se houve Autorização Especial para o aluno no dia
            if (!c.authorizedBy && specialOp) {
              c.authorizedBy = specialOp
            }
          } else if (isRfid) {
            if (!c.authorizedBy && specialOp) {
              c.authorizedBy = specialOp
            }
            if (isConfirmedCall && resolvedConfirmer) {
              c.confirmedBy = resolvedConfirmer
            }
          } else if (isAgendaDigitalCall) {
            // Chamada disparada pelo próprio responsável via App Agenda Digital
            const famLabel = c.guardianName ? `${String(c.guardianName).trim()} (App Agenda Digital)` : undefined
            if (!c.operatorId) c.operatorId = famLabel || explicitFreqOp
            if (!c.authorizedBy) c.authorizedBy = famLabel || c.operatorId
            if (isConfirmedCall && resolvedConfirmer) {
              c.confirmedBy = resolvedConfirmer
            }
          } else if (isDiarioManual) {
            // Lançamento manual feito pelo professor/equipe no Diário de Frequência / Educação Infantil
            if (!c.operatorId) c.operatorId = diarioManualOp || explicitFreqOp || freqUserOp || turmaFreqOp || specialOp
            if (!c.authorizedBy) c.authorizedBy = specialOp || c.operatorId
            if (isConfirmedCall) {
              c.confirmedBy = resolvedConfirmer || c.operatorId
            }
          } else {
            // Chamada manual na Portaria / Painel de Chamadas (resp-*, erp-*, saude-aut-*, sozinho, etc.)
            if (isConfirmedCall && resolvedConfirmer) {
              c.confirmedBy = resolvedConfirmer
            }
            if (!c.operatorId) c.operatorId = c.confirmedBy || c.authorizedBy || explicitFreqOp || freqUserOp || turmaFreqOp || specialOp
            if (!c.authorizedBy) c.authorizedBy = specialOp || c.operatorId || c.confirmedBy || explicitFreqOp || freqUserOp || turmaFreqOp
          }
        }
      }

    // Build set of studentId+date keys that have a confirmed call on that specific day
    const confirmedStudentDates = new Set(
      rawResult
        .filter((c: any) => c.status === 'confirmed' && c.studentId != null)
        .map((c: any) => `${c.studentId}_${toCampoGrandeYmd(c.confirmedAt || c.calledAt || c.created_at) || todayStr}`)
    )

      // Normalize: if a student has a confirmed call on that day, mark any un-reverted waiting/called calls for that student on that same day as confirmed
      const result = rawResult.map((c: any) => {
        const cDateKey = `${c.studentId}_${toCampoGrandeYmd(c.confirmedAt || c.calledAt || c.created_at) || todayStr}`
        if (c.studentId != null && confirmedStudentDates.has(cDateKey) && (c.status === 'waiting' || c.status === 'called') && !c.isRevert) {
          return { ...c, status: 'confirmed' }
        }
        return c
      }).sort((a: any, b: any) => {
        const tsA = new Date(a.confirmedAt || a.calledAt || a.created_at || 0).getTime() || 0
        const tsB = new Date(b.confirmedAt || b.calledAt || b.created_at || 0).getTime() || 0
        return tsB - tsA
      })
      return result
    })()

    saidaCallsInflight.set(cacheKey, computePromise)
    let result: any[]
    try {
      result = await computePromise
      const ttlMs = onlySpecialAuth ? 15000 : 4000
      saidaCallsResponseCache.set(cacheKey, { data: result, expires: Date.now() + ttlMs })
    } finally {
      saidaCallsInflight.delete(cacheKey)
    }

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
  const { resolveUserRole } = await import('@/lib/server/authGuard')
  const { user, dbUser, errorResponse } = await resolveUserRole(request)
  if (errorResponse) return errorResponse

  const resolvedOperatorName =
    dbUser?.nome ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : undefined)

  const applyOperatorMetadata = (dados: any, existingDados?: any) => {
    if (!dados || typeof dados !== 'object') return dados
    const currentOp = typeof dados.operatorId === 'string' ? dados.operatorId.trim() : ''
    const isGenericOp = !currentOp || currentOp === 'Admin Logado' || currentOp === 'Sistema'
    const prevOp = typeof existingDados?.operatorId === 'string' && existingDados.operatorId.trim()
      ? existingDados.operatorId.trim()
      : ''

    if (isGenericOp) {
      dados.operatorId = prevOp || resolvedOperatorName || currentOp || undefined
    }
    if (!dados.authorizedBy) {
      dados.authorizedBy = existingDados?.authorizedBy || dados.operatorId || resolvedOperatorName || undefined
    }
    const currentConfirmedBy = typeof dados.confirmedBy === 'string' ? dados.confirmedBy.trim() : ''
    const cleanGuard = typeof dados.guardianName === 'string' ? dados.guardianName.trim().toLowerCase() : ''
    const isGenericOrGuardianConfirmer =
      !currentConfirmedBy ||
      currentConfirmedBy === 'Admin Logado' ||
      currentConfirmedBy === 'Sistema' ||
      currentConfirmedBy.toLowerCase().includes('(app agenda digital)') ||
      (cleanGuard && currentConfirmedBy.toLowerCase() === cleanGuard)
    if (dados.status === 'confirmed' && isGenericOrGuardianConfirmer) {
      dados.confirmedBy = resolvedOperatorName || existingDados?.confirmedBy || (!isGenericOp ? currentOp : undefined) || prevOp || undefined
    }
    return dados
  }

  try {
    invalidateSaidaCallsCache()
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ ok: true, count: 0 })
      }
      
      const rows = body.map(buildRow)
      const ids = rows.map((r: any) => r.id)
      
      const supabaseService = getAdminClient()

      // Backfill photo in memory for notifications without bloating DB TOAST with Base64
      const resolvedPhotosById = new Map<string, string>()
      rows.forEach((r: any) => {
        if (r.dados?.studentPhoto) {
          resolvedPhotosById.set(r.id, r.dados.studentPhoto)
        }
      })
      const missingPhotoIds = rows
        .filter((r: any) => !r.dados?.studentPhoto && r.dados?.studentId)
        .map((r: any) => String(r.dados.studentId).trim())
      if (missingPhotoIds.length > 0) {
        const photoMap = await fetchAlunosBatch(supabaseService, missingPhotoIds)
        rows.forEach((r: any) => {
          if (!r.dados?.studentPhoto && r.dados?.studentId) {
            const p = photoMap[String(r.dados.studentId).trim()]
            if (p?.foto || p?.foto_url) {
              resolvedPhotosById.set(r.id, p.foto || p.foto_url)
            }
          }
        })
      }
      
      const { data: existingRows } = await supabaseService.from('saida_calls').select('id, dados').in('id', ids)
      
      const existingDadosMap = new Map<string, any>()
      const existingStatusMap = new Map((existingRows || []).map(r => {
        let status = null
        let calledAt = null
        let parsedDados: any = null
        if (typeof r.dados === 'string') {
          try { 
            parsedDados = JSON.parse(r.dados)
            status = parsedDados.status 
            calledAt = parsedDados.calledAt
          } catch(e){}
        } else if (r.dados) {
          parsedDados = r.dados
          status = (r.dados as any).status
          calledAt = (r.dados as any).calledAt
        }
        if (parsedDados) existingDadosMap.set(r.id, parsedDados)
        return [r.id, { status, calledAt }]
      }))

      rows.forEach((r: any) => {
        r.dados = sanitizeDadosForStorage(applyOperatorMetadata(r.dados, existingDadosMap.get(r.id)))
      })

      const { error } = await supabaseService.from('saida_calls').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(error.message)
      invalidateSaidaCallsCache()
      
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
            source: row.dados?.source,
            guardianId: row.dados?.guardianId,
            operatorName: row.dados?.confirmedBy || row.dados?.operatorId || resolvedOperatorName,
            senderUserId: user?.id,
            senderId: dbUser?.id || user?.id,
            senderEmail: dbUser?.email || user?.email,
            senderCargo: dbUser?.cargo || dbUser?.perfil,
            senderFoto: dbUser?.dados?.foto || dbUser?.dados?.avatar || null,
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
              guardianName: row.dados?.guardianName,
              source: row.dados?.source,
              operatorName: row.dados?.operatorId || resolvedOperatorName,
              senderUserId: user?.id,
              senderId: dbUser?.id || user?.id,
              senderEmail: dbUser?.email || user?.email,
              senderCargo: dbUser?.cargo || dbUser?.perfil,
              senderFoto: dbUser?.dados?.foto || dbUser?.dados?.avatar || null,
              isStaff: Boolean(dbUser),
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
              operatorName: row.dados?.operatorId || resolvedOperatorName,
              studentPhoto: resolvedPhotosById.get(row.id) || row.dados?.studentPhoto,
              validDays: row.dados?.validDays,
              validFrom: row.dados?.validFrom,
              validUntil: row.dados?.validUntil,
              senderUserId: user?.id,
              senderId: dbUser?.id || user?.id,
              senderEmail: dbUser?.email || user?.email,
              senderCargo: dbUser?.cargo || dbUser?.perfil,
              senderFoto: dbUser?.dados?.foto || dbUser?.dados?.avatar || null,
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
    let resolvedStudentPhoto: string | null = row.dados?.studentPhoto || null

    // Consultas preliminares em paralelo: foto faltante, chamadas do aluno hoje, e registro existente
    const photoPromise = (studentId && !resolvedStudentPhoto)
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
    if (!resolvedStudentPhoto && (sPhoto?.foto || sPhoto?.foto_url)) {
      resolvedStudentPhoto = sPhoto.foto || sPhoto.foto_url
    }

    if (studentCallsRes?.data) {
      const studentCallsToday = studentCallsRes.data as any[]
      const confirmedEntry = studentCallsToday.find(r => {
        let d = r.dados
        if (typeof d === 'string') { try { d = JSON.parse(d) } catch(e){} }
        if (d?.status !== 'confirmed') return false
        const dt = d?.confirmedAt || d?.calledAt
        let callDate = dt ? dt.slice(0, 10) : null
        try {
          if (dt) {
            const dObj = new Date(dt.includes('T') && !dt.endsWith('Z') && !dt.includes('-') && !dt.includes('+') ? `${dt}-04:00` : dt)
            if (!isNaN(dObj.getTime())) {
              callDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(dObj)
            }
          }
        } catch {}
        return !callDate || callDate === todayStr
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
    let existingDadosParsed: any = {}
    if (existingRow?.dados) {
      if (typeof existingRow.dados === 'string') {
        try { existingDadosParsed = JSON.parse(existingRow.dados) } catch(e){}
      } else {
        existingDadosParsed = existingRow.dados
      }
      wasConfirmed = existingDadosParsed.status === 'confirmed'
      previousStatus = existingDadosParsed.status
      previousCalledAt = existingDadosParsed.calledAt

      if ((wasConfirmed || existingDadosParsed.status === 'cancelled') && (row.dados.status === 'waiting' || row.dados.status === 'called') && !isRevert) {
        const incomingCalledAt = new Date(row.dados.calledAt || 0).getTime()
        const existingConfirmedAt = new Date(existingDadosParsed.confirmedAt || 0).getTime()
        if (incomingCalledAt < existingConfirmedAt) {
          console.warn(`[API Saida] Stale update prevented for call ${row.id}. Incoming status: ${row.dados.status}, Existing status: ${existingDadosParsed.status}`)
          return NextResponse.json({ id: row.id, ...(existingDadosParsed || {}) }, { status: 200 })
        }
      }
    }

    row.dados = sanitizeDadosForStorage(applyOperatorMetadata(row.dados, existingDadosParsed))

    const { data, error } = await supabaseService.from('saida_calls').upsert(row).select().single()
    if (error) throw new Error(error.message)
    invalidateSaidaCallsCache()

    const isConfirmed = data.dados?.status === 'confirmed'

    // If this call is now confirmed (or reverted), also update any other active/waiting call created today AND any active special_auth for this student in the DB
    if ((isConfirmed || isRevert) && studentId) {
      try {
        const [siblingRes, specialAuthRes] = await Promise.all([
          isConfirmed
            ? supabaseService
                .from('saida_calls')
                .select('id, dados')
                .eq('dados->>studentId', studentId)
                .gte('created_at', `${todayStr}T00:00:00-04:00`)
            : Promise.resolve({ data: [] as any[] }),
          supabaseService
            .from('saida_calls')
            .select('id, dados')
            .eq('dados->>studentId', studentId)
            .eq('dados->>status', 'special_auth')
        ])

        const updateSiblingPromises = (siblingRes.data || []).map(async sRow => {
          if (sRow.id === data.id) return
          let sDados = sRow.dados
          if (typeof sDados === 'string') { try { sDados = JSON.parse(sDados) } catch(e){} }
          if (sDados && (sDados.status === 'waiting' || sDados.status === 'called') && !sDados.isRevert) {
            sDados.status = 'confirmed'
            sDados.confirmedAt = data.dados?.confirmedAt || new Date().toISOString()
            if (resolvedOperatorName && !sDados.confirmedBy) sDados.confirmedBy = resolvedOperatorName
            if (resolvedOperatorName && !sDados.operatorId) sDados.operatorId = resolvedOperatorName
            await supabaseService.from('saida_calls').update({ dados: sanitizeDadosForStorage(sDados) }).eq('id', sRow.id)
          }
        })

        const updateSpecialAuthPromises = (specialAuthRes.data || []).map(async saRow => {
          if (saRow.id === data.id) return
          let saDados = saRow.dados
          if (typeof saDados === 'string') { try { saDados = JSON.parse(saDados) } catch(e){} }
          if (!saDados || saDados.status !== 'special_auth') return
          const vUntil = typeof saDados.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saDados.validUntil)
            ? saDados.validUntil
            : (saDados.calledAt ? String(saDados.calledAt).slice(0, 10) : todayStr)
          if (vUntil < todayStr) return

          const prevConfirmedDates = saDados.confirmedDates && typeof saDados.confirmedDates === 'object'
            ? { ...saDados.confirmedDates }
            : {}

          if (isConfirmed) {
            const confTime = data.dados?.confirmedAt || new Date().toISOString()
            prevConfirmedDates[todayStr] = confTime
            saDados.confirmedDates = prevConfirmedDates
            saDados.confirmedOut = true
            saDados.confirmedAt = confTime
            if (resolvedOperatorName) saDados.confirmedBy = resolvedOperatorName
            await supabaseService.from('saida_calls').update({ dados: sanitizeDadosForStorage(saDados) }).eq('id', saRow.id)
          } else if (isRevert) {
            delete prevConfirmedDates[todayStr]
            saDados.confirmedDates = prevConfirmedDates
            saDados.confirmedOut = false
            delete saDados.confirmedAt
            await supabaseService.from('saida_calls').update({ dados: sanitizeDadosForStorage(saDados) }).eq('id', saRow.id)
          }
        })

        await Promise.all([...updateSiblingPromises, ...updateSpecialAuthPromises])
        invalidateSaidaCallsCache()
      } catch (errSibling) {
        console.error('Error updating sibling/special_auth calls in DB:', errSibling)
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
        source: data.dados?.source,
        guardianId: data.dados?.guardianId,
        operatorName: data.dados?.confirmedBy || data.dados?.operatorId || resolvedOperatorName,
        senderUserId: user?.id,
        senderId: dbUser?.id || user?.id,
        senderEmail: dbUser?.email || user?.email,
        senderCargo: dbUser?.cargo || dbUser?.perfil,
        senderFoto: dbUser?.dados?.foto || dbUser?.dados?.avatar || null,
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
          guardianName: data.dados?.guardianName,
          source: data.dados?.source,
          operatorName: data.dados?.operatorId || resolvedOperatorName,
          senderUserId: user?.id,
          senderId: dbUser?.id || user?.id,
          senderEmail: dbUser?.email || user?.email,
          senderCargo: dbUser?.cargo || dbUser?.perfil,
          senderFoto: dbUser?.dados?.foto || dbUser?.dados?.avatar || null,
          isStaff: Boolean(dbUser),
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
          operatorName: data.dados?.operatorId || resolvedOperatorName,
          studentPhoto: resolvedStudentPhoto || data.dados?.studentPhoto,
          validDays: data.dados?.validDays,
          validFrom: data.dados?.validFrom,
          validUntil: data.dados?.validUntil,
          senderUserId: user?.id,
          senderId: dbUser?.id || user?.id,
          senderEmail: dbUser?.email || user?.email,
          senderCargo: dbUser?.cargo || dbUser?.perfil,
          senderFoto: dbUser?.dados?.foto || dbUser?.dados?.avatar || null,
        })
      }
    }

    return NextResponse.json(
      {
        id: data.id,
        ...(data.dados || {}),
        ...(resolvedStudentPhoto ? { studentPhoto: resolvedStudentPhoto } : {}),
      },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    invalidateSaidaCallsCache()
    const body = await request.json()
    const { id, studentId, date, cancelStudentDate, clearToday } = body
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
        .neq('dados->>status', 'special_auth')

      if (error) throw new Error(error.message)
      invalidateSaidaCallsCache()

      return NextResponse.json({ ok: true, clearedToday: true })
    }

    if ((studentId && date) || cancelStudentDate) {
      const rawStudentId = String(studentId || '').trim()
      const targetDate = String(date || '').trim()
      if (rawStudentId && targetDate) {
        const unpaddedId = rawStudentId.replace(/^0+/, '') || '0'
        const studentVariants = Array.from(new Set([rawStudentId, unpaddedId, unpaddedId.padStart(6, '0')].filter(Boolean)))
        const { data: studentRows } = await supabaseService
          .from('saida_calls')
          .select('id, created_at, dados')
          .in('dados->>studentId', studentVariants)

        const idsToDelete = new Set<string>()
        if (id) idsToDelete.add(String(id))
        for (const vId of studentVariants) {
          idsToDelete.add(`infantil-${vId}-${targetDate}`)
          idsToDelete.add(`saida-catraca-${vId}-${targetDate}`)
        }

        const toDateYmd = (isoStr?: string) => {
          if (!isoStr) return ''
          try {
            const normalized = isoStr.includes('T') && !isoStr.endsWith('Z') && !isoStr.includes('-') && !isoStr.includes('+')
              ? `${isoStr}-04:00`
              : isoStr
            const d = new Date(normalized)
            if (isNaN(d.getTime())) return String(isoStr).slice(0, 10)
            return new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Campo_Grande',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).format(d)
          } catch {
            return String(isoStr).slice(0, 10)
          }
        }

        for (const row of (studentRows || [])) {
          const d = row.dados || {}
          if (d.status === 'special_auth') {
            const confirmedDates = d.confirmedDates && typeof d.confirmedDates === 'object' ? { ...d.confirmedDates } : {}
            const rowConfirmDate = toDateYmd(d.confirmedAt || d.calledAt)
            if (confirmedDates[targetDate] || (d.confirmedOut && rowConfirmDate === targetDate)) {
              delete confirmedDates[targetDate]
              const updatedDados = {
                ...d,
                confirmedDates,
                confirmedOut: false,
                confirmedAt: null
              }
              await supabaseService
                .from('saida_calls')
                .update({ dados: sanitizeDadosForStorage(updatedDados) })
                .eq('id', row.id)
            }
          } else {
            const callYmd = toDateYmd(d.confirmedAt || d.calledAt || row.created_at)
            if (callYmd === targetDate || String(row.id).includes(targetDate)) {
              idsToDelete.add(String(row.id))
            }
          }
        }

        if (idsToDelete.size > 0) {
          await supabaseService
            .from('saida_calls')
            .delete()
            .in('id', Array.from(idsToDelete))
        }
        invalidateSaidaCallsCache()
        return NextResponse.json({ ok: true, deletedCount: idsToDelete.size })
      }
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const { error } = await supabaseService.from('saida_calls').delete().eq('id', id)
    if (error) throw new Error(error.message)
    invalidateSaidaCallsCache()

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

/**
 * Remove strings Base64 (data:image/...) do JSONB persistido em saida_calls
 * para evitar bloat de ~500MB na tabela TOAST do PostgreSQL e statement timeouts (57014).
 * As fotos de alunos são enriquecidas em memória via fetchAlunosBatch (cache 5min).
 */
function sanitizeDadosForStorage(dados: any) {
  if (!dados || typeof dados !== 'object') return dados
  const copy = { ...dados }
  if (typeof copy.studentPhoto === 'string' && copy.studentPhoto.startsWith('data:')) {
    delete copy.studentPhoto
  }
  if (typeof copy.guardianPhoto === 'string' && copy.guardianPhoto.startsWith('data:')) {
    delete copy.guardianPhoto
  }
  return copy
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
  guardianName,
  source,
  operatorName,
  senderUserId,
  senderId,
  senderEmail,
  senderCargo,
  senderFoto,
  isStaff,
}: {
  callId: string
  studentId: string
  studentName?: string
  studentClass?: string
  calledAt?: string
  guardianName?: string
  source?: string
  operatorName?: string
  senderUserId?: string
  senderId?: string
  senderEmail?: string
  senderCargo?: string
  senderFoto?: string | null
  isStaff?: boolean
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
      const isAppGuardian = !isStaff && (source === 'app' || source === 'app_familia' || Boolean(guardianName && !operatorName))

      await sendAgendaPushNotification({
        type: 'saida',
        itemId: pushItemId,
        senderUserId,
        title: '🚗 Chamada de Portaria',
        message: `${nomeAmigavel} foi chamado na portaria para saída e está se dirigindo ao portão principal.`,
        targetUserIds: targetIds,
        targetUrl: `/agenda-digital/${rawStudentId}`,
        metadata: {
          aluno_id: rawStudentId,
          saida_id: String(callId),
          tipo: 'chamada_portaria',
          source: source || null,
          guardian_name: guardianName || null,
          operator_name: operatorName || null,
          sender_id: senderId || senderUserId || null,
          sender_auth_id: senderUserId || null,
          sender_name: isAppGuardian ? (guardianName || null) : (operatorName || null),
          sender_email: senderEmail || null,
          sender_cargo: senderCargo || null,
          sender_foto: senderFoto || null,
          sender_type: isAppGuardian ? 'responsavel' : (operatorName ? 'colaborador' : null),
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
  source,
  guardianId,
  operatorName,
  senderUserId,
  senderId,
  senderEmail,
  senderCargo,
  senderFoto,
}: {
  callId: string
  studentId: string
  studentName?: string
  studentClass?: string
  confirmedAt?: string
  guardianName?: string
  source?: string
  guardianId?: string
  operatorName?: string
  senderUserId?: string
  senderId?: string
  senderEmail?: string
  senderCargo?: string
  senderFoto?: string | null
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
    const horaSaida = formatHoraSaida(confirmedAt)

    const srcNorm = String(source || '').toLowerCase()
    const guardIdNorm = String(guardianId || '').toLowerCase()
    let resolvedSaidaOrigem = 'chamadas'
    if (srcNorm === 'rfid' || guardIdNorm.startsWith('rfid-')) {
      resolvedSaidaOrigem = 'rfid'
    } else if (srcNorm === 'idface' || srcNorm === 'catraca' || guardIdNorm === 'catraca-saida') {
      resolvedSaidaOrigem = 'catraca'
    } else if (guardIdNorm === 'manual-infantil' || guardIdNorm === 'frequencia-diario') {
      resolvedSaidaOrigem = 'manual'
    }

    const { data: existingFreq } = await supabaseService.from('frequencias').select('presente, dados').eq('id', freqId).maybeSingle()
    const hasValidExistingEntry = Boolean(
      existingFreq &&
      existingFreq.presente !== false &&
      (existingFreq.dados?.horaEntrada ||
       (existingFreq.dados?.tempos && Object.values(existingFreq.dados.tempos).some((v: any) => v === 'P' || v === 'J')))
    )

    await supabaseService.from('frequencias').upsert({
      id: freqId,
      aluno_id: rawStudentId,
      turma_id: turmaAluno,
      data: today,
      presente: hasValidExistingEntry ? true : (existingFreq?.presente ?? false),
      dados: {
        ...(existingFreq?.dados || {}),
        saidaCancelada: false,
        saidaHorario: horaSaida,
        saidaResponsavel: guardianName || '',
        saidaOrigem: resolvedSaidaOrigem,
        ...(operatorName ? { saidaUsuario: operatorName, confirmedBy: operatorName } : {}),
        anoLetivo,
        diarioId: `DIARIO-${turmaAluno}-${anoLetivo}`
      }
    })

    const targetIds = await getResponsavelIdsForTargets({ targetStudents: studentTargets })
    if (targetIds.length > 0) {
      const pushItemId = `saida_${callId}_${Date.now()}`
      const isCatracaSaida = resolvedSaidaOrigem === 'catraca'

      await sendAgendaPushNotification({
        type: 'saida',
        itemId: pushItemId,
        senderUserId: isCatracaSaida ? undefined : senderUserId,
        title: '🎓 Saída Confirmada',
        message: `A saída de ${nomeAmigavel} foi confirmada na portaria às ${horaSaida}.`,
        targetUserIds: targetIds,
        targetUrl: `/agenda-digital/${rawStudentId}/frequencia`,
        metadata: {
          aluno_id: rawStudentId,
          saida_id: String(callId),
          origem: isCatracaSaida ? 'sincronizar_catraca' : resolvedSaidaOrigem,
          guardian_name: guardianName || null,
          operator_name: operatorName || null,
          sender_id: isCatracaSaida ? null : (senderId || senderUserId || null),
          sender_auth_id: isCatracaSaida ? null : (senderUserId || null),
          sender_name: isCatracaSaida ? 'Automático' : (operatorName || null),
          sender_email: isCatracaSaida ? null : (senderEmail || null),
          sender_cargo: isCatracaSaida ? null : (senderCargo || null),
          sender_foto: isCatracaSaida ? null : (senderFoto || null),
          sender_type: isCatracaSaida ? 'automatico' : (operatorName ? 'colaborador' : null),
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
  validDays,
  validFrom,
  validUntil,
  senderUserId,
  senderId,
  senderEmail,
  senderCargo,
  senderFoto,
}: {
  callId: string
  studentId?: string
  studentName?: string
  studentClass?: string
  authorizedPerson?: string
  targetTime?: string
  operatorName?: string
  studentPhoto?: string | null
  validDays?: number
  validFrom?: string
  validUntil?: string
  senderUserId?: string
  senderId?: string
  senderEmail?: string
  senderCargo?: string
  senderFoto?: string | null
}) {
  try {
    const supabaseService = getAdminClient()

    // 1. Emitir broadcast Realtime via Supabase para todas as instâncias conectadas no web app
    try {
      const channel = supabaseService.channel('saida_calls_shared_room')
      await channel.send({
        type: 'broadcast',
        event: 'SPECIAL_AUTH_NOTIFY',
        payload: {
          data: {
            id: callId,
            callId,
            studentId: studentId || '',
            studentName: studentName || 'Aluno',
            studentClass: studentClass || '',
            guardianName: authorizedPerson || 'Pessoa Autorizada',
            authorizedPerson: authorizedPerson || 'Pessoa Autorizada',
            targetTime: targetTime || '',
            studentPhoto: studentPhoto || null,
            operatorId: operatorName || 'Portaria',
            status: 'special_auth',
            calledAt: new Date().toISOString(),
            validDays: validDays || 1,
            validFrom,
            validUntil,
            isTest: false
          }
        }
      })
      await supabaseService.removeChannel(channel)
    } catch (realtimeErr) {
      console.warn('[API Saida] Falha no broadcast Realtime de Autorização Especial:', realtimeErr)
    }

    // 2. Fetch current saida_config to check if notifications are enabled and get target user IDs
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
      console.log('[API Saida] Notificação Push de Autorização Especial: desativada ou nenhum colaborador configurado.')
      return
    }

    // 3. Fetch collaborator users safely (avoiding PostgreSQL 22P02 UUID cast errors)
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

    // 4. Dispatch OneSignal Mobile Push Notification if enabled
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
        senderUserId,
        title: '📝 Autorização Especial: Saída Liberada',
        message: `${nomeAmigavel}${studentClass ? ` (${studentClass})` : ''} liberado(a) para retirada por ${authorizedPerson || 'Pessoa Autorizada'}${horaStr}.`,
        targetUserIds: Array.from(pushTargets),
        targetSubscriptionIds: directSubIds.length > 0 ? Array.from(new Set(directSubIds)) : undefined,
        collapseId: `saida_auth_${callId}`,
        targetUrl: '/saida-alunos/chamadas',
        metadata: {
          tipo: 'autorizacao_especial',
          aluno_id: studentId || '',
          call_id: String(callId),
          perfil_destino: 'colaborador',
          targetUrl: '/saida-alunos/chamadas',
          operator_name: operatorName || null,
          sender_id: senderId || senderUserId || null,
          sender_auth_id: senderUserId || null,
          sender_name: operatorName || null,
          sender_email: senderEmail || null,
          sender_cargo: senderCargo || null,
          sender_foto: senderFoto || null,
          sender_type: operatorName ? 'colaborador' : null,
        }
      })
      console.log(`[API Saida] Push de Autorização Especial enviado para ${effectiveUsers.length} colaboradores (${directSubIds.length} aparelhos diretos):`, effectiveUsers.map(u => u.nome))
    }
  } catch (err: any) {
    console.error('[API Saida] Erro ao disparar notificação de Autorização Especial:', err.message)
  }
}
