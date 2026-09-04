import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

interface CacheEntry {
  data: any[]
  timestamp: number
}

// Cache em memória no servidor com TTL de 10 minutos (evita round-trips repetitivos)
const serverNiversCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')

    if (!mes || isNaN(Number(mes))) {
      return NextResponse.json({ error: 'Mês inválido ou não informado' }, { status: 400 })
    }

    const mesStr = String(mes).padStart(2, '0')

    // Verificar cache em memória do servidor
    const cached = serverNiversCache.get(mesStr)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600' }
      })
    }

    const supabase = await getAdminClient()

    // Consultas paralelas de altíssima performance:
    // 1. Alunos com filtro de mês direto no banco + fotos inclusas
    // 2. Funcionários (apenas ~60 registros, filtrados por mês na memória por ser coluna 'date' no Postgres)
    // 3. Tabela de turmas para resolver nomes instantaneamente
    const [alunosRes, profsRes, turmasRes] = await Promise.all([
      supabase
        .from('alunos')
        .select('id, nome, turma, data_nascimento, foto, dados')
        .or(`data_nascimento.ilike.%-${mesStr}-%,data_nascimento.ilike.%/${mesStr}/%`)
        .or('status.neq.inativo,status.is.null'),
      supabase
        .from('funcionarios')
        .select('id, nome, cargo, data_nascimento, dados')
        .not('data_nascimento', 'is', null),
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
      .filter(p => isMonthMatch(p.data_nascimento))
      .map(p => ({
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
    serverNiversCache.set(mesStr, { data: result, timestamp: Date.now() })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600' }
    })
  } catch (err: any) {
    console.error('[API /api/agenda/aniversariantes] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
