import { NextResponse } from 'next/server'

// ⚠️ ENDPOINT DE DEBUG REMOVIDO POR SEGURANÇA
// Expunha 200 registros de alunos + dados de parcelas sem autenticação.
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ 
    message: 'Debug endpoint disabled in this environment.' 
  }, { status: 410 })
}
