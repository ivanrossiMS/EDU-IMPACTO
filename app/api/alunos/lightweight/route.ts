import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'
import { lightweightAlunosCache as inMemoryCache } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'
// Limita o tempo total da rota a 30 segundos (evita o hang de 66min)
export const maxDuration = 30

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutos

export async function GET(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const url = new URL(req.url)
    const search = (url.searchParams.get('search') || '').trim()
    const page   = Math.max(1, parseInt(url.searchParams.get('page')  || '1'))
    // Limite padrão 500, máximo 2000 — evita full-table scan em instâncias grandes
    const limit  = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '500')), 2000)
    const from   = (page - 1) * limit
    const to     = from + limit - 1

    const cacheKey = url.search;
    if (!search) {
      if (inMemoryCache.has(cacheKey)) {
        const entry = inMemoryCache.get(cacheKey)!;
        if (Date.now() - entry.ts < CACHE_TTL_MS) {
          return NextResponse.json(entry.data, {
            headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=300' }
          });
        }
      }
    }

    // AbortController com timeout de 25s — evita hang indefinido na query
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)

    const turma = (url.searchParams.get('turma') || '').trim()
    const anoParam = (url.searchParams.get('ano') || url.searchParams.get('anoLetivo') || '').trim()

    let targetTurmaObj: any = null
    let allTurmasList: any[] = []
    if (turma) {
      const { data: tData } = await supabase
        .from('turmas')
        .select('id, nome, codigo, ano, serie, dados')
        .or(`id.eq.${turma},nome.eq.${turma},codigo.eq.${turma}`)
        .limit(1)
        .maybeSingle()
      if (tData) {
        targetTurmaObj = tData
        allTurmasList = [tData]
      } else {
        targetTurmaObj = turma
      }
    }

    // Seleção mínima — apenas campos usados em listas e seletores
    let query = supabase
      .from('alunos')
      .select(`
        id, nome, matricula, turma, status, email, telefone,
        emailAlt:dados->>email,
        telefoneAlt:dados->>telefone,
        celularAlt:dados->>celular,
        anoLetivo:dados->>anoLetivo, 
        anoLetivoAlt:dados->>ano_letivo, 
        fotoAlt:dados->>foto, 
        fotoUrlAlt:dados->>avatarUrl, 
        responsaveis:dados->responsaveis,
        historicoTurmas:dados->historicoTurmas,
        isIntegralIntermediario:dados->isIntegralIntermediario,
        integral_tipo:dados->integral_tipo,
        modalidade:dados->modalidade,
        turno:dados->turno,
        autorizadoSairSozinho:dados->autorizadoSairSozinho,
        saude:dados->saude
      `, { count: 'exact' })
      .or('status.neq.inativo,status.is.null')
      .order('nome')

    if (turma) {
      const turmaTokens = Array.from(new Set([
        turma,
        targetTurmaObj?.id ? String(targetTurmaObj.id) : null,
        targetTurmaObj?.codigo ? String(targetTurmaObj.codigo) : null,
        targetTurmaObj?.nome ? String(targetTurmaObj.nome) : null,
      ].filter(Boolean))) as string[]

      const orClauses: string[] = []
      turmaTokens.forEach(tok => {
        const safe = /[ ,()\/]/.test(tok) ? `"${tok.replace(/"/g, '\\"')}"` : tok
        orClauses.push(`turma.eq.${safe}`)
        orClauses.push(`dados->>turma.eq.${safe}`)
        orClauses.push(`dados->historicoTurmas.cs.[{"serieTurma":"${tok}"}]`)
        orClauses.push(`dados->historicoTurmas.cs.[{"turma":"${tok}"}]`)
      })
      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','))
      }
    }

    query = query.range(from, to)

    if (search) {
      query = query.or(`nome.ilike.%${search}%,matricula.ilike.%${search}%`)
    }

    let data: any, error: any, count: number | null
    try {
      ;({ data, error, count } = await query)
    } finally {
      clearTimeout(timeoutId)
    }

    if (controller.signal.aborted) {
      console.error('[API alunos/lightweight] Query abortada por timeout (>25s)')
      return NextResponse.json(
        { error: 'Query timeout — tente novamente em instantes.' },
        { status: 504 }
      )
    }

    if (error) {
      console.error('[API alunos/lightweight] erro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let formatted = (data as Record<string, unknown>[] || []).map((aluno: Record<string, unknown>) => {
      const rawFoto = (aluno as any).fotoAlt || (aluno as any).fotoUrlAlt || null
      const safeFoto = (typeof rawFoto === 'string' && !rawFoto.startsWith('data:image/')) ? rawFoto : null
      const rawSair = (aluno as any).autorizadoSairSozinho ?? (aluno as any).saude?.autorizaSaida
      const autorizadoSairSozinho = rawSair === true || (typeof rawSair === 'string' && ['true', 'sim', 's', '1', 'autorizado'].includes(rawSair.trim().toLowerCase()))

      return {
        id: String(aluno.id),
        nome: String(aluno.nome || ''),
        matricula: aluno.matricula || '',
        turma: aluno.turma || '',
        email: ((aluno.email as string) || (aluno as any).emailAlt || '').trim(),
        telefone: ((aluno.telefone as string) || (aluno as any).telefoneAlt || (aluno as any).celularAlt || '').trim(),
        anoLetivo: (aluno as any).anoLetivo || (aluno as any).anoLetivoAlt || '',
        foto: safeFoto,
        responsaveis: (aluno as any).responsaveis || [],
        historicoTurmas: (aluno as any).historicoTurmas || [],
        isIntegralIntermediario: (aluno as any).isIntegralIntermediario,
        integral_tipo: (aluno as any).integral_tipo,
        modalidade: (aluno as any).modalidade,
        turno: (aluno as any).turno,
        autorizadoSairSozinho,
        saude: { ...((aluno as any).saude || {}), autorizaSaida: autorizadoSairSozinho },
        status: aluno.status || 'ativo'
      }
    })

    const effectiveAno = targetTurmaObj?.ano ? String(targetTurmaObj.ano) : (anoParam || undefined)
    if (turma) {
      formatted = formatted.filter((aluno: any) =>
        isAlunoCursandoTurma(aluno, targetTurmaObj || turma, effectiveAno, allTurmasList)
      )
    }

    if (anoParam && !turma) {
      formatted = formatted.filter((aluno: any) => {
        const hist = (aluno as any).historicoTurmas || aluno.dados?.historicoTurmas
        if (Array.isArray(hist) && hist.length > 0) {
          return hist.some((h: any) => String(h.anoLetivo || h.ano || '').trim() === anoParam)
        }
        const sAno = String((aluno as any).anoLetivo || (aluno as any).ano_letivo || aluno.dados?.anoLetivo || aluno.dados?.ano_letivo || '').trim()
        return sAno === anoParam
      })
    }

    const responseData = { data: formatted, total: (turma || (anoParam && !turma)) ? formatted.length : (count || 0), page, limit };
    
    if (!search) {
      inMemoryCache.set(cacheKey, { data: responseData, ts: Date.now() });
    }

    return NextResponse.json(
      responseData,
      {
        headers: {
          // Cache privado de 5 minutos + revalidação em background
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=300'
        }
      }
    )
  } catch (err: any) {
    console.error('[API alunos/lightweight] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
