import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { enhanceQuestionsWithAI } from '@/lib/server/docxMathParser'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { questoes } = body

    if (!questoes || !Array.isArray(questoes)) {
      return NextResponse.json({ error: 'Array de questões é obrigatório.' }, { status: 400 })
    }

    const enhanced = await enhanceQuestionsWithAI(questoes)
    return NextResponse.json({ success: true, questoes: enhanced })
  } catch (err: any) {
    console.error('[transcrever-ia] Erro ao transcrever:', err)
    return NextResponse.json({ error: err.message || 'Erro ao transcrever fórmulas.' }, { status: 500 })
  }
}
