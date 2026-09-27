import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache em memória de alta performance com TTL de 60 segundos
interface CacheEntry {
  data: any
  expiresAt: number
}
const turmaStudentsCache = new Map<string, CacheEntry>()

function formatParentesco(p?: string | null): string {
  if (!p) return 'Responsável'
  const lower = p.toLowerCase().trim()
  if (lower === 'mae' || lower === 'mãe') return 'Mãe'
  if (lower === 'pai') return 'Pai'
  if (lower === 'avo_m' || lower === 'avó') return 'Avó'
  if (lower === 'avo_p' || lower === 'avô') return 'Avô'
  if (lower === 'tio' || lower === 'tia') return 'Tio(a)'
  if (lower === 'outro') return 'Responsável'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const rawGrupoId = searchParams.get('grupo_id')
    const rawTurmaId = searchParams.get('turma_id')

    if (!rawGrupoId && !rawTurmaId) {
      return NextResponse.json({ error: 'grupo_id ou turma_id é obrigatório' }, { status: 400 })
    }

    // Verificar cache em memória
    const cacheKey = `${rawGrupoId || ''}_${rawTurmaId || ''}`
    const cached = turmaStudentsCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          'X-Cache': 'HIT'
        }
      })
    }

    let alunoIds: string[] = []
    let turmaNome = ''

    // 1. Resolução inteligente do grupo (aceita grupo_id ou turma_id intercambiáveis)
    const candidateIds = Array.from(new Set([rawGrupoId, rawTurmaId].filter(Boolean))) as string[]

    if (candidateIds.length > 0) {
      const orParts = candidateIds.flatMap(id => {
        const clean = id.replace(/^sync-/, '')
        return [
          `id.eq."${id}"`,
          `dados->>syncId.eq."${id}"`,
          `dados->>turma_id.eq."${id}"`,
          `dados->>syncId.eq."${clean}"`,
          `dados->>turma_id.eq."${clean}"`
        ]
      })

      const { data: grp } = await supabase
        .from('agenda_grupos')
        .select('id, dados')
        .or(orParts.join(','))
        .limit(1)
        .maybeSingle()

      if (grp) {
        turmaNome = grp.dados?.nome || ''
        alunoIds = Array.isArray(grp.dados?.alunosIds) ? grp.dados.alunosIds.map(String) : []
      }
    }

    // Se alunoIds ainda estiver vazio, buscar na tabela alunos pela turma
    if (alunoIds.length === 0 && candidateIds.length > 0) {
      const turmaSearchIds = candidateIds.flatMap(id => [id, id.replace(/^sync-/, '')])
      const { data: alunosTurma } = await supabase
        .from('alunos')
        .select('id')
        .in('turma', turmaSearchIds)
        .limit(200)

      if (alunosTurma) {
        alunoIds = alunosTurma.map(a => String(a.id))
      }
    }

    if (alunoIds.length === 0) {
      const emptyResult = {
        grupoId: rawGrupoId,
        turmaId: rawTurmaId,
        turmaNome,
        alunos: []
      }
      return NextResponse.json(emptyResult)
    }

    // 2 & 3. Buscar detalhes dos alunos e vínculos com responsáveis em PARALELO
    const [alunosRes, linksRes] = await Promise.all([
      supabase
        .from('alunos')
        .select('id, nome, foto, turma')
        .in('id', alunoIds),
      supabase
        .from('aluno_responsavel')
        .select('aluno_id, responsavel_id, parentesco, tipo, resp_financeiro, resp_pedagogico')
        .in('aluno_id', alunoIds)
    ])

    if (alunosRes.error) throw alunosRes.error

    const alunosRows = alunosRes.data || []
    const linksRows = linksRes.data || []
    const respIds = Array.from(new Set(linksRows.map(l => String(l.responsavel_id))))

    // 4. Buscar dados dos responsáveis
    let respMap = new Map<string, any>()
    if (respIds.length > 0) {
      const { data: respsRows } = await supabase
        .from('responsaveis')
        .select('id, nome, email, telefone, celular')
        .in('id', respIds)

      ;(respsRows || []).forEach(r => {
        respMap.set(String(r.id), r)
      })
    }

    // 5. Montar estrutura aninhada de alunos e seus responsáveis
    const alunos = alunosRows
      .map(a => {
        const studentLinks = linksRows.filter(l => String(l.aluno_id) === String(a.id))
        
        const responsaveis = studentLinks.map(link => {
          const r = respMap.get(String(link.responsavel_id))
          return {
            id: String(link.responsavel_id),
            nome: r?.nome || 'Responsável',
            parentesco: formatParentesco(link.parentesco || link.tipo),
            telefone: r?.celular || r?.telefone || null,
            email: r?.email || null,
            respFinanceiro: !!link.resp_financeiro,
            respPedagogico: !!link.resp_pedagogico
          }
        })

        // Ordenar responsáveis: Mãe primeiro, Pai segundo, outros a seguir
        responsaveis.sort((x, y) => {
          const getPriority = (p: string) => {
            if (p === 'Mãe') return 1
            if (p === 'Pai') return 2
            return 3
          }
          const prioX = getPriority(x.parentesco)
          const prioY = getPriority(y.parentesco)
          if (prioX !== prioY) return prioX - prioY
          return x.nome.localeCompare(y.nome)
        })

        return {
          id: String(a.id),
          nome: a.nome,
          foto: a.foto || null,
          turma: a.turma,
          responsaveis
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome))

    const result = {
      grupoId: rawGrupoId,
      turmaId: rawTurmaId,
      turmaNome,
      alunos
    }

    // Armazenar no cache em memória
    turmaStudentsCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 60_000
    })

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'X-Cache': 'MISS'
      }
    })

  } catch (err: any) {
    console.error('Erro ao buscar alunos da turma:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
