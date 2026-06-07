import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'

// ⚠️ ENDPOINT DE DEBUG REMOVIDO POR SEGURANÇA
// Expunha 200 registros de alunos + dados de parcelas sem autenticação.
export async function GET() {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ 
    message: 'Debug endpoint disabled in this environment.' 
  }, { status: 410 })
}
