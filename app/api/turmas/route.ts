import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'
import { isAlunoCursandoTurma, isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'
import { getCachedTurmasAndGrupos, getCachedActiveAlunos, invalidateTurmasCache } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

const turmasRouteCache = new Map<string, { payload: any, expires: number }>()
const turmasRouteInflight = new Map<string, Promise<any>>()

function clearLocalTurmasRouteCache() {
  turmasRouteCache.clear()
  invalidateTurmasCache()
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = supabaseServer
    const url = new URL(request.url)
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    const all = url.searchParams.get('all') === 'true' || (!pageParam && !limitParam)

    const page = parseInt(pageParam || '1')
    const limit = parseInt(limitParam || '10')
    const search = url.searchParams.get('search') || ''
    const ano = url.searchParams.get('ano') || ''
    const segmento = url.searchParams.get('segmento') || ''
    const statsParam = url.searchParams.get('stats')
    const includeStats = statsParam === 'true' || (statsParam !== 'false' && !all)

    const cacheKey = `${all ? 'all' : `${page}_${limit}`}_${search}_${ano}_${segmento}_${includeStats ? '1' : '0'}`
    const nowMs = Date.now()
    const cached = turmasRouteCache.get(cacheKey)
    if (cached && cached.expires > nowMs) {
      return NextResponse.json(cached.payload, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
      })
    }

    let promise = turmasRouteInflight.get(cacheKey)
    if (!promise) {
      promise = (async () => {
        const from = (page - 1) * limit
        const to = from + limit - 1

        let query = supabase
          .from('turmas')
          .select('*', { count: 'exact' })

        if (search) {
          query = query.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%`)
        }

        if (ano) {
          query = query.eq('ano', parseInt(ano))
        }

        // Como segmento é guardado em dados->segmento, precisamos filtrar via JSONB
        if (segmento) {
          query = query.filter('dados->>segmento', 'eq', segmento)
        }

        let queryExec = query.order('nome')
        if (!all) {
          queryExec = queryExec.range(from, to)
        }

        const { data, error, count } = await queryExec

        if (error) throw error

        let totalAlunosMatriculados = 0
        let totalAlunosIntegral = 0
        let capacidadeTotal = 0
        let vagasOcupadasPercent = 0

        if (includeStats) {
          // Buscar todos os alunos ativos e turmas com cache em memória (TTL 45-60s) para evitar scans repetidos
          const [activeAlunos, { allTurmas }] = await Promise.all([
            getCachedActiveAlunos(),
            getCachedTurmasAndGrupos()
          ])

          const yearFilter = ano ? parseInt(ano) : null
          const alunosDoAno = yearFilter
            ? activeAlunos.filter((a: any) => {
                const hist = a.historicoTurmas || a.dados?.historicoTurmas
                if (Array.isArray(hist) && hist.length > 0) {
                  return hist.some((h: any) => String(h.anoLetivo || h.ano || '').trim() === String(yearFilter))
                }
                const sAno = String(a.anoLetivo || a.ano_letivo || a.dados?.anoLetivo || a.dados?.ano_letivo || '').trim()
                return sAno === String(yearFilter)
              })
            : activeAlunos

          totalAlunosMatriculados = alunosDoAno.length
          totalAlunosIntegral = alunosDoAno.filter((a: any) => isAlunoIntegralIntermediario(a, allTurmas, [], yearFilter || undefined)).length

          const turmasDoAno = yearFilter
            ? (allTurmas || []).filter((t: any) => parseInt(t.ano) === yearFilter)
            : (allTurmas || [])

          capacidadeTotal = turmasDoAno.reduce((acc: number, t: any) => acc + (parseInt(t.capacidade) || 30), 0)
          vagasOcupadasPercent = capacidadeTotal > 0 ? Math.round((totalAlunosMatriculados / capacidadeTotal) * 100) : 0

          // Calcular matriculados por turma em tempo real para os itens da tabela
          if (data && data.length > 0) {
            data.forEach((t: any) => {
              const countAlunos = activeAlunos.filter((a: any) => isAlunoCursandoTurma(a, t, t.ano, allTurmas)).length;
              t.matriculados = countAlunos;
            })
          }
        }

        const payload = {
          data: data || [],
          total: count || 0,
          stats: {
            totalTurmas: count || 0,
            totalAlunosMatriculados,
            totalAlunosIntegral,
            capacidadeTotal,
            vagasOcupadasPercent
          },
          page,
          limit
        }
        turmasRouteCache.set(cacheKey, { payload, expires: Date.now() + 60_000 })
        return payload
      })().finally(() => {
        turmasRouteInflight.delete(cacheKey)
      })
      turmasRouteInflight.set(cacheKey, promise)
    }

    const payload = await promise
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()

    // Se Array.isArray(body) for recebido (chamado por setTurmas do useSupabaseArray, ex: Padrão de Pagamento)
    if (Array.isArray(body)) {
      const { data: existingTurmas } = await supabaseServer.from('turmas').select('*')
      const existingMap = new Map<string, any>()
      ;(existingTurmas || []).forEach((t: any) => {
        if (t.id) existingMap.set(String(t.id), t)
      })

      const rowsToUpsert = body
        .filter((item: any) => item && (item.id || item.nome))
        .map((item: any) => {
          const id = String(item.id || item.codigo || Math.floor(1000 + Math.random() * 9000))
          const existing = existingMap.get(id)
          const existingDados = existing?.dados || {}
          const itemDados = item.dados || {}
          const {
            id: _id, codigo, nome, serie, turno, professor, sala,
            capacidade, matriculados, unidade, ano, dados: _dados,
            created_at, updated_at, ...extraFields
          } = item

          return {
            id,
            codigo: codigo || existing?.codigo || id,
            nome: nome ?? existing?.nome ?? '',
            serie: serie ?? existing?.serie ?? '',
            turno: turno ?? existing?.turno ?? '',
            professor: professor ?? existing?.professor ?? '',
            sala: sala ?? existing?.sala ?? '',
            capacidade: parseInt(capacidade) || existing?.capacidade || 30,
            matriculados: matriculados ?? existing?.matriculados ?? 0,
            unidade: unidade ?? existing?.unidade ?? '',
            ano: parseInt(ano) || existing?.ano || new Date().getFullYear(),
            dados: {
              ...existingDados,
              ...itemDados,
              ...extraFields,
              status: itemDados.status ?? extraFields.status ?? existingDados.status ?? 'ativa',
              segmento: extraFields.segmento ?? itemDados.segmento ?? existingDados.segmento ?? '',
              padraoPagamentoIds: item.padraoPagamentoIds ?? itemDados.padraoPagamentoIds ?? existingDados.padraoPagamentoIds
            }
          }
        })

      if (rowsToUpsert.length > 0) {
        const { error } = await supabaseServer.from('turmas').upsert(rowsToUpsert, { onConflict: 'id' })
        if (error) throw error
      }

      clearLocalTurmasRouteCache()
      return NextResponse.json({ success: true, count: rowsToUpsert.length })
    }

    const { nome, serie, segmento, turno, sala, capacidade, professor, unidade, ano, ...extraFields } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome da turma é obrigatório' }, { status: 400 })
    }

    // ⚡ OTIMIZAÇÃO: Geração sem loop de rede sequencial (1 única leitura local de checagem)
    let id = body.id ? String(body.id).trim() : ''
    if (!id) {
      const { data: recentTurmas } = await supabaseServer.from('turmas').select('id').order('created_at', { ascending: false }).limit(50)
      const existingIds = new Set((recentTurmas || []).map((t: any) => String(t.id)))
      let cand = Math.floor(1000 + Math.random() * 9000).toString()
      let attempts = 0
      while (existingIds.has(cand) && attempts < 15) {
        cand = Math.floor(1000 + Math.random() * 9000).toString()
        attempts++
      }
      id = existingIds.has(cand) ? `${cand}-${Date.now().toString(36).slice(-3).toUpperCase()}` : cand
    }
    
    const newTurma = {
      id,
      codigo: id, // Usando o mesmo ID como código
      nome,
      serie: serie || '',
      turno: turno || '',
      professor: professor || '',
      sala: sala || '',
      capacidade: parseInt(capacidade) || 30,
      matriculados: 0,
      unidade: unidade || '',
      ano: parseInt(ano) || new Date().getFullYear(),
      dados: {
        ...(body.dados || {}),
        ...extraFields,
        status: 'ativa',
        segmento: segmento || body.dados?.segmento || '',
        dataMatricula: new Date().toISOString().split('T')[0]
      }
    }

    const { data, error } = await supabaseServer
      .from('turmas')
      .insert(newTurma)
      .select()

    if (error) throw error

    clearLocalTurmasRouteCache()
    return NextResponse.json({ success: true, data: data?.[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { id, nome, serie, segmento, turno, sala, capacidade, professor, unidade, ano, dados: bodyDados, ...extraFields } = body

    if (!id) {
      return NextResponse.json({ error: 'ID da turma é obrigatório' }, { status: 400 })
    }

    const { data: existing } = await supabaseServer
      .from('turmas')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    const updatedTurma = {
      nome: nome ?? existing?.nome,
      serie: serie ?? existing?.serie,
      turno: turno ?? existing?.turno,
      professor: professor !== undefined ? professor : (existing?.professor ?? ''),
      sala: sala !== undefined ? sala : (existing?.sala ?? ''),
      capacidade: parseInt(capacidade) || existing?.capacidade || 30,
      unidade: unidade !== undefined ? unidade : (existing?.unidade ?? ''),
      ano: parseInt(ano) || existing?.ano || new Date().getFullYear(),
      dados: {
        ...(existing?.dados || {}),
        ...(bodyDados || {}),
        ...extraFields,
        segmento: segmento ?? bodyDados?.segmento ?? existing?.dados?.segmento ?? ''
      }
    }

    const { data, error } = await supabaseServer
      .from('turmas')
      .update(updatedTurma)
      .eq('id', id)
      .select()

    if (error) throw error

    clearLocalTurmasRouteCache()
    return NextResponse.json({ success: true, data: data?.[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { requireStaff } = await import('@/lib/server/authGuard')
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID da turma é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('turmas')
      .delete()
      .eq('id', id)
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Turma não encontrada ou já excluída.' }, { status: 404 })
    }

    clearLocalTurmasRouteCache()
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
