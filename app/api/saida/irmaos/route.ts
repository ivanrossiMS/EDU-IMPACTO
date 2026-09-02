import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { isValidStudentPhoto } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// ── IN-MEMORY CACHES FOR ULTRA SPEED (<1ms) ───────────────────────────────────
interface CacheEntry {
  data: any
  expiresAt: number
}
const serverCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 1000 // 60 seconds

let cachedTurmasMap: Map<string, string> | null = null
let turmasCacheExpiresAt = 0

function normalizeStr(str: any): string {
  if (!str) return ''
  const s = typeof str === 'object' ? (str.nome || str.name || str.nomeCompleto || '') : String(str)
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

async function getTurmasMap(supabase: any): Promise<Map<string, string>> {
  const now = Date.now()
  if (cachedTurmasMap && now < turmasCacheExpiresAt) {
    return cachedTurmasMap
  }

  const { data } = await supabase.from('turmas').select('id, nome, codigo')
  const map = new Map<string, string>()
  ;(data || []).forEach((t: any) => {
    if (t.id) map.set(String(t.id), t.nome || t.codigo || '')
    if (t.codigo) map.set(String(t.codigo), t.nome || t.codigo || '')
  })

  cachedTurmasMap = map
  turmasCacheExpiresAt = now + 5 * 60 * 1000 // 5 minutes
  return map
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const guardianId = (url.searchParams.get('guardianId') || '').trim()
    const guardianName = (url.searchParams.get('guardianName') || '').trim()
    const currentStudentId = (url.searchParams.get('studentId') || '').trim()

    if (!guardianId && !guardianName && !currentStudentId) {
      return NextResponse.json({ error: 'guardianId, guardianName ou studentId é obrigatório' }, { status: 400 })
    }

    // Check in-memory cache for instant response
    const cacheKey = `${guardianId}|${guardianName.toLowerCase()}|${currentStudentId}`
    const cached = serverCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
      })
    }

    const supabase = getAdminClient()
    const turmasMapPromise = getTurmasMap(supabase)

    const targetRespIds = new Set<string>()
    const targetRespNames = new Set<string>()

    if (guardianId && !guardianId.startsWith('erp-') && !guardianId.startsWith('saude-') && !guardianId.startsWith('resp-') && !guardianId.startsWith('special')) {
      targetRespIds.add(guardianId)
    }

    if (guardianName) {
      targetRespNames.add(normalizeStr(guardianName))
    }

    // Step 1: Parallel targeted lookup
    let respQueryRes: any = { data: [] }
    const turmasMap = await turmasMapPromise

    if (guardianName) {
      const cleanName = guardianName.replace(/[%_]/g, '')
      respQueryRes = await supabase
        .from('responsaveis')
        .select('id, nome, telefone, email, rfid, proibido')
        .ilike('nome', `%${cleanName}%`)
    }

    ;(respQueryRes?.data || []).forEach((r: any) => {
      if (r.id) targetRespIds.add(String(r.id).trim())
      if (r.nome) targetRespNames.add(normalizeStr(r.nome))
    })

    // Step 2: Fetch student links exclusively for THIS responsible
    const studentLinksMap = new Map<string, string>() // studentId -> parentesco

    if (targetRespIds.size > 0) {
      const { data: links } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, parentesco, responsavel_id')
        .in('responsavel_id', Array.from(targetRespIds))

      ;(links || []).forEach((l: any) => {
        if (l.aluno_id) {
          studentLinksMap.set(String(l.aluno_id).trim(), l.parentesco || 'Responsável')
        }
      })
    }

    const linkedStudentIds = Array.from(studentLinksMap.keys())
    if (currentStudentId && !linkedStudentIds.includes(currentStudentId)) {
      linkedStudentIds.push(currentStudentId)
    }

    // Step 3: Fast targeted student fetch (only the linked student IDs!)
    let rawStudents: any[] = []
    if (linkedStudentIds.length > 0) {
      const { data: stData } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, serie, turno, status, foto, dados, responsavel, responsavel_financeiro, responsavel_pedagogico')
        .in('id', linkedStudentIds)

      rawStudents = stData || []
    }

    // Also if guardianName is provided, check if any student has direct text match in responsavel
    if (guardianName && rawStudents.length <= 1) {
      const cleanName = guardianName.replace(/[%_]/g, '')
      const { data: textMatched } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, serie, turno, status, foto, dados, responsavel, responsavel_financeiro, responsavel_pedagogico')
        .or(`responsavel.ilike.%${cleanName}%,responsavel_pedagogico.ilike.%${cleanName}%,responsavel_financeiro.ilike.%${cleanName}%`)
        .limit(10)

      ;(textMatched || []).forEach((st: any) => {
        if (!rawStudents.some(x => String(x.id).trim() === String(st.id).trim())) {
          rawStudents.push(st)
          if (!studentLinksMap.has(String(st.id).trim())) {
            studentLinksMap.set(String(st.id).trim(), 'Responsável')
          }
        }
      })
    }

    // Step 4: Map & Format Response
    const siblings = rawStudents
      .filter((st: any) => st.status !== 'inativo')
      .map((st: any) => {
        const sId = String(st.id).trim()
        const rawFoto = st.foto || st.dados?.foto || st.dados?.avatarUrl || st.dados?.fotoUrl || null
        const resolvedFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null
        const turmaNome = turmasMap.get(String(st.turma)) || st.turma || st.dados?.turmaNome || 'Turma não informada'
        const autorizaSaida = st.dados?.autorizadoSairSozinho === true
        const isCurrent = currentStudentId ? sId === currentStudentId || String(st.matricula).trim() === currentStudentId : false

        return {
          id: st.id,
          nome: st.nome,
          matricula: st.matricula,
          turma: st.turma,
          turmaNome,
          turno: st.turno || st.dados?.turno || '',
          foto: resolvedFoto,
          autorizadoSairSozinho: autorizaSaida,
          parentescoVinculo: studentLinksMap.get(sId) || 'Responsável',
          isCurrentStudent: isCurrent,
          responsaveis: st.dados?.responsaveis || []
        }
      })

    // Sort: uncalled/other siblings first, current student last
    siblings.sort((a, b) => {
      if (a.isCurrentStudent && !b.isCurrentStudent) return 1
      if (!a.isCurrentStudent && b.isCurrentStudent) return -1
      return a.nome.localeCompare(b.nome)
    })

    const responsePayload = {
      guardianId,
      guardianName,
      total: siblings.length,
      siblings
    }

    // Store in cache
    serverCache.set(cacheKey, {
      data: responsePayload,
      expiresAt: Date.now() + CACHE_TTL_MS
    })

    return NextResponse.json(responsePayload, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
    })
  } catch (err: any) {
    console.error('Error in fast /api/saida/irmaos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
