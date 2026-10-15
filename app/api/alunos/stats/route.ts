import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'
import { isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    // Query com campos necessários para estatísticas e modalidade integral
    const [{ data: students, error }, { allTurmas, allGrupos }] = await Promise.all([
      supabase.from('alunos').select('id, status, turno, turma, serie, unidade, dados'),
      getCachedTurmasAndGrupos()
    ])

    if (error) {
      console.error('[API alunos/stats] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const allStudents = students || []
    let total = allStudents.length
    let ativos = 0
    let inativos = 0
    let integral = 0
    let integralAtivos = 0

    for (const s of allStudents) {
      const isAtivo = s.status !== 'inativo' && s.status !== 'Inativo'
      if (isAtivo) {
        ativos++
      } else {
        inativos++
      }

      const isIntegral = isAlunoIntegralIntermediario(s, allTurmas || [], allGrupos || [])
      if (isIntegral) {
        integral++
        if (isAtivo) {
          integralAtivos++
        }
      }
    }

    return NextResponse.json({
      total,
      ativos,
      inativos,
      integral: integralAtivos,
      integralAtivos,
      integralTotal: integral
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (e: any) {
    console.error('[API alunos/stats] Exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
