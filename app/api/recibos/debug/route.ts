import { NextResponse } from 'next/server'

// ⚠️ ENDPOINT REMOVIDO POR SEGURANÇA
// Este endpoint de debug expunha dados sensíveis de alunos e títulos sem autenticação.
// Remova este arquivo em produção.
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ 
    message: 'Debug endpoint disabled. Use /api/recibos for production use.' 
  }, { status: 410 })
}
