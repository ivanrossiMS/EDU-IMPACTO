import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const userId = user.user_metadata?.uid_legacy || user.id
  const supabase = getAdminClient()

  try {
    const body = await request.json()
    const { emocao_geral, motivos, burnout_q1, burnout_q2, burnout_q3, burnout_q4, burnout_q5, quer_conversar } = body

    // Calculate risk
    // Assumption: q1..q5 are 1 to 5. Where 1 is bad, 5 is good.
    const totalScore = (burnout_q1 || 3) + (burnout_q2 || 3) + (burnout_q3 || 3) + (burnout_q4 || 3) + (burnout_q5 || 3)
    let risco_burnout = 'Baixo risco'
    if (totalScore <= 12) {
      risco_burnout = 'Alto risco'
    } else if (totalScore <= 18) {
      risco_burnout = 'Atenção'
    }

    const { data, error } = await supabase
      .from('colaborador_checkin')
      .insert({
        usuario_id: userId,
        emocao_geral: emocao_geral || 'Regular',
        motivos: motivos || [],
        burnout_q1,
        burnout_q2,
        burnout_q3,
        burnout_q4,
        burnout_q5,
        risco_burnout,
        quer_conversar: quer_conversar || null
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
         return NextResponse.json({ error: 'A tabela colaborador_checkin não foi criada no banco de dados ainda.' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ success: true, risco_burnout })
  } catch (err: any) {
    console.error('Erro ao salvar checkin:', err)
    return NextResponse.json({ error: 'Erro interno ao salvar check-in' }, { status: 500 })
  }
}
