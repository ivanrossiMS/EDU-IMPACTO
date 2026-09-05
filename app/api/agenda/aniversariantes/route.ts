import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

interface CacheEntry {
  data: any[]
  timestamp: number
}

// Cache em memória no processo com TTL curto (2 minutos)
const serverNiversCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 2 * 60 * 1000

const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
  'Vary': 'Accept-Encoding, Cookie'
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    const turmaQuery = (searchParams.get('turma') || '').trim()

    if (!mes || isNaN(Number(mes))) {
      return NextResponse.json({ error: 'Mês inválido ou não informado' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const mesNum = parseInt(mes, 10)
    if (mesNum < 1 || mesNum > 12) {
      return NextResponse.json({ error: 'Mês fora do intervalo (1 a 12)' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const mesStr = String(mesNum).padStart(2, '0')
    const cacheKey = `${mesStr}_${turmaQuery ? turmaQuery.toLowerCase() : 'all'}`

    // Verificar cache em memória do processo
    const cached = serverNiversCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: NO_CACHE_HEADERS
      })
    }

    const supabase = await getAdminClient()

    // Consultas paralelas:
    // 1. Alunos com filtro de mês direto no banco + status ativo
    // 2. Funcionários (apenas se turma não for especificada ou para admin/colaborador)
    // 3. Tabela de turmas para resolver nomes instantaneamente
    const [alunosRes, profsRes, turmasRes] = await Promise.all([
      supabase
        .from('alunos')
        .select('id, nome, turma, data_nascimento, foto, dados')
        .or(`data_nascimento.ilike.%-${mesStr}-%,data_nascimento.ilike.%/${mesStr}/%`)
        .or('status.neq.inativo,status.is.null'),
      !turmaQuery
        ? supabase
            .from('funcionarios')
            .select('id, nome, cargo, data_nascimento, dados')
            .not('data_nascimento', 'is', null)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('turmas')
        .select('id, nome, codigo')
    ])

    if (alunosRes.error) throw alunosRes.error
    if (profsRes.error) throw profsRes.error

    // Mapeamento de Turmas (ID e Código -> Nome)
    const turmaMap = new Map<string, string>()
    for (const t of turmasRes.data || []) {
      if (t.id != null) turmaMap.set(String(t.id).trim(), String(t.nome || '').trim())
      if (t.codigo) turmaMap.set(String(t.codigo).trim(), String(t.nome || '').trim())
    }

    // Chaves de busca caso turmaQuery tenha sido informada
    const turmaFilterKeys = new Set<string>()
    if (turmaQuery) {
      const qLower = turmaQuery.toLowerCase().trim()
      turmaFilterKeys.add(qLower)
      const qBase = qLower.split('-')[0].trim()
      if (qBase) turmaFilterKeys.add(qBase)

      // Se turmaQuery for ID de turma, adiciona nome e código mapeados
      if (turmaMap.has(turmaQuery)) {
        const nomeMapeado = (turmaMap.get(turmaQuery) || '').toLowerCase().trim()
        if (nomeMapeado) {
          turmaFilterKeys.add(nomeMapeado)
          const baseMapeado = nomeMapeado.split('-')[0].trim()
          if (baseMapeado) turmaFilterKeys.add(baseMapeado)
        }
      }
      for (const t of turmasRes.data || []) {
        if (!t) continue
        const tId = String(t.id || '').trim().toLowerCase()
        const tCod = String(t.codigo || '').trim().toLowerCase()
        const tNome = String(t.nome || '').trim().toLowerCase()
        if (tId === qLower || tCod === qLower || tNome === qLower || tNome.split('-')[0].trim() === qBase) {
          if (tId) turmaFilterKeys.add(tId)
          if (tCod) turmaFilterKeys.add(tCod)
          if (tNome) {
            turmaFilterKeys.add(tNome)
            const b = tNome.split('-')[0].trim()
            if (b) turmaFilterKeys.add(b)
          }
        }
      }
    }

    // Validação estrita de mês no JavaScript para garantir precisão
    const isMonthMatch = (dateStr?: string | null) => {
      if (!dateStr) return false
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-')
        return parts[1] === mesStr
      }
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/')
        return parts[1] === mesStr
      }
      return false
    }

    const niversAlunos = (alunosRes.data || [])
      .filter(a => isMonthMatch(a.data_nascimento))
      .filter(a => {
        if (!turmaQuery) return true
        const rawTurma = String(a.turma || '').trim().toLowerCase()
        const nomeTurma = (turmaMap.get(String(a.turma || '').trim()) || a.dados?.turma_nome || '').toLowerCase().trim()
        const nomeBase = nomeTurma.split('-')[0].trim()

        if (rawTurma && turmaFilterKeys.has(rawTurma)) return true
        if (nomeTurma && turmaFilterKeys.has(nomeTurma)) return true
        if (nomeBase && turmaFilterKeys.has(nomeBase)) return true
        return false
      })
      .map(a => {
        const rawTurma = String(a.turma || '').trim()
        let resolvedTurmaNome = turmaMap.get(rawTurma) || ''
        if (!resolvedTurmaNome && a.dados?.turma_nome) {
          resolvedTurmaNome = String(a.dados.turma_nome).trim()
        }
        if (!resolvedTurmaNome) {
          resolvedTurmaNome = rawTurma
        }

        return {
          id: a.id,
          nome: a.nome,
          turma: rawTurma,
          turma_nome: resolvedTurmaNome,
          turmaNome: resolvedTurmaNome,
          data_nascimento: a.data_nascimento,
          foto: a.foto || (a as any).foto_url || null,
          tipo: 'Aluno'
        }
      })

    const niversProfs = (profsRes.data || [])
      .filter((p: any) => isMonthMatch(p.data_nascimento))
      .map((p: any) => ({
        id: p.id,
        nome: p.nome,
        cargo: p.cargo || 'Colaborador',
        data_nascimento: p.data_nascimento,
        foto: p.dados?.foto || p.dados?.avatarUrl || null,
        tipo: 'Colaborador'
      }))

    const result = [
      ...niversAlunos,
      ...niversProfs
    ]

    // Salvar no cache em memória
    serverNiversCache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result, {
      headers: NO_CACHE_HEADERS
    })
  } catch (err: any) {
    console.error('[API /api/agenda/aniversariantes] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 400, headers: NO_CACHE_HEADERS })
  }
}
