import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireStaff } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = await createClient()
    
    // Contagem real de alunos ativos cadastrados no sistema ERP
    let query: any = supabase
      .from('alunos')
      .select('id, status, dados', { count: 'exact' })

    if (typeof query.neq === 'function') {
      query = query.neq('dados->>situacao', 'Inativo').neq('dados->>status', 'inativo')
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ total_alunos: 0, ativo: true, fonte: 'banco_dados' })
    }

    const ativosCount = Array.isArray(data)
      ? data.filter((a: any) => {
          const sit = String(a?.dados?.situacao || a?.dados?.status || a?.status || 'ativo').toLowerCase()
          return !['inativo', 'cancelado', 'transferido', 'desistente', 'evadido'].includes(sit) && a?.dados?.ativo !== false
        }).length
      : (count || 0)

    return NextResponse.json({ total_alunos: ativosCount, ativo: true, fonte: 'banco_dados' })
  } catch (e) {
    return NextResponse.json({ total_alunos: 0, ativo: true, fonte: 'banco_dados' })
  }
}
