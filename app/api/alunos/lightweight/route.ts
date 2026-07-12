import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

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

    // Seleção mínima — apenas campos usados em listas e seletores
    let query = supabase
      .from('alunos')
      .select('id, nome, matricula, turma, status, foto, dados', { count: 'exact' })
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
      anoLetivo: (aluno as any).dados?.anoLetivo || (aluno as any).dados?.ano_letivo || '',
      foto: (aluno as any).foto || (aluno as any).foto_url || (aluno as any).dados?.foto || (aluno as any).dados?.avatarUrl || null,
      responsaveis: (aluno as any).dados?.responsaveis || (aluno as any).responsaveis || [],
      status: aluno.status || 'ativo'
    }))

    return NextResponse.json(
      { data: formatted, total: count || 0, page, limit },
      {
        headers: {
          // Cache privado de 60s + revalidação em background — seguro pois é por usuário
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
        }
      }
    )
  } catch (err: any) {
    console.error('[API alunos/lightweight] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

