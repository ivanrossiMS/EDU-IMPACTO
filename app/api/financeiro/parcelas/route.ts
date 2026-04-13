import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const aluno_id = searchParams.get('aluno_id')
    const status = searchParams.get('status')
    
    // Parâmetros de paginação e UI padrão
    const limit = Number(searchParams.get('limit')) || 500
    const offset = Number(searchParams.get('offset')) || 0

    const supabase = await createProtectedClient()

    let query = supabase
      .from('fin_parcelas')
      .select(`
        *,
        fin_eventos!inner(
          aluno_id,
          tipo,
          descricao,
          plano_contas_id
        )
      `, { count: 'exact' })
      
    if (aluno_id) {
        query = query.eq('fin_eventos.aluno_id', aluno_id)
    }
    
    if (status) {
        query = query.eq('status', status)
    }

    const { data, count, error } = await query
      .order('vencimento', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("[PgSQL Fetch Error]", error)
      return NextResponse.json({ error: 'Erro ao extrair parcelas O(1): ' + error.message }, { status: 400 })
    }

    return NextResponse.json({
        data,
        metadata: {
            totalCount: count,
            pageLimit: limit,
            offset
        }
    })
  } catch (err: any) {
    return NextResponse.json({ error: "Erro crítico no motor de leitura financeira." }, { status: 500 })
  }
}
