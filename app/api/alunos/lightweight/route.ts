import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutos
const inMemoryCache = new Map<string, { data: any; ts: number }>();

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

    // Seleção mínima — apenas campos usados em listas e seletores
    let query = supabase
      .from('alunos')
      .select(`
        id, nome, matricula, turma, status, foto, 
        anoLetivo:dados->>anoLetivo, 
        anoLetivoAlt:dados->>ano_letivo, 
        fotoAlt:dados->>foto, 
        fotoUrlAlt:dados->>avatarUrl, 
        responsaveis:dados->responsaveis
      `, { count: 'exact' })
      .or('status.neq.inativo,status.is.null')
      .order('nome')
      .range(from, to)

    if (search) {
      query = query.ilike('nome', `%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[API alunos/lightweight] erro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (data || []).map(aluno => ({
      id: String(aluno.id),
      nome: String(aluno.nome || ''),
      matricula: aluno.matricula || '',
      turma: aluno.turma || '',
      anoLetivo: (aluno as any).anoLetivo || (aluno as any).anoLetivoAlt || '',
      foto: (aluno as any).foto || (aluno as any).fotoAlt || (aluno as any).fotoUrlAlt || null,
      responsaveis: (aluno as any).responsaveis || [],
      status: aluno.status || 'ativo'
    }))

    const responseData = { data: formatted, total: count || 0, page, limit };
    
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
