import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const userId = user.user_metadata?.uid_legacy || user.id
  const supabase = getAdminClient()

  try {
    const body = await request.json()
    const {
      emocao_geral,
      motivos,
      burnout_q1,
      burnout_q2,
      burnout_q3,
      burnout_q4,
      burnout_q5,
      respostas_detalhadas,
      quer_conversar
    } = body

    // 1. Tentar buscar perguntas configuradas para cálculo dinâmico de score se fornecido
    let totalScore = 0
    let questionCount = 0

    if (Array.isArray(respostas_detalhadas) && respostas_detalhadas.length > 0) {
      respostas_detalhadas.forEach((item: any) => {
        const score = typeof item.score === 'number' ? item.score : 3
        totalScore += score
        questionCount++
      })
    } else {
      // Fallback para as 5 perguntas legadas
      const q1 = typeof burnout_q1 === 'number' ? burnout_q1 : 3
      const q2 = typeof burnout_q2 === 'number' ? burnout_q2 : 3
      const q3 = typeof burnout_q3 === 'number' ? burnout_q3 : 3
      const q4 = typeof burnout_q4 === 'number' ? burnout_q4 : 3
      const q5 = typeof burnout_q5 === 'number' ? burnout_q5 : 3
      totalScore = q1 + q2 + q3 + q4 + q5
      questionCount = 5
    }

    // Calcula risco proporcionalmente (Média: 1 a 5)
    // Média <= 2.4 => Alto risco
    // Média <= 3.6 => Atenção
    // Média > 3.6 => Baixo risco
    const avgScore = questionCount > 0 ? totalScore / questionCount : 3
    let risco_burnout = 'Baixo risco'
    if (avgScore <= 2.4) {
      risco_burnout = 'Alto risco'
    } else if (avgScore <= 3.6) {
      risco_burnout = 'Atenção'
    }

    const payload: any = {
      usuario_id: userId,
      emocao_geral: emocao_geral || 'Regular',
      motivos: motivos || [],
      burnout_q1: burnout_q1 || null,
      burnout_q2: burnout_q2 || null,
      burnout_q3: burnout_q3 || null,
      burnout_q4: burnout_q4 || null,
      burnout_q5: burnout_q5 || null,
      risco_burnout,
      quer_conversar: quer_conversar || null,
      respostas_json: respostas_detalhadas || {
        q1: burnout_q1,
        q2: burnout_q2,
        q3: burnout_q3,
        q4: burnout_q4,
        q5: burnout_q5
      }
    }

    const { data, error } = await supabase
      .from('colaborador_checkin')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'A tabela colaborador_checkin não foi criada no banco de dados ainda.' },
          { status: 400 }
        )
      }
      // Se a coluna respostas_json não existir, tenta novamente sem a coluna para não quebrar
      if (error.message?.includes('respostas_json')) {
        delete payload.respostas_json
        const { data: retryData, error: retryError } = await supabase
          .from('colaborador_checkin')
          .insert(payload)
          .select()
          .single()

        if (retryError) throw retryError
        return NextResponse.json({ success: true, risco_burnout, data: retryData })
      }
      throw error
    }

    return NextResponse.json({ success: true, risco_burnout, data })
  } catch (err: any) {
    console.error('Erro ao salvar checkin:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao salvar check-in' }, { status: 500 })
  }
}
