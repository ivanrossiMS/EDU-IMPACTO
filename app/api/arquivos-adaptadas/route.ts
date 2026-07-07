import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const filterAno = url.searchParams.get('filterAno') || ''
    const filterTurma = url.searchParams.get('filterTurma') || ''

    const supabaseAdmin = getAdminClient()

    let query = supabaseAdmin
      .from('arquivos_adaptadas')
      .select(`
        id, turma, ano_letivo, titulo, file_url, created_at, tamanho_bytes, bimestre,
        alunos!inner (id, nome)
      `)
      .order('created_at', { ascending: false })

    if (filterAno) {
      query = query.eq('ano_letivo', filterAno)
    }
    if (filterTurma) {
      query = query.eq('turma', filterTurma)
    }
    if (search) {
      query = query.ilike('alunos.nome', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[API arquivos-adaptadas] erro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    console.error('[API arquivos-adaptadas] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
