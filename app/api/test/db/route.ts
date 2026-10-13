import { NextResponse } from 'next/server'
import { requireProfile } from '@/lib/server/authGuard'

export async function GET(request: Request) {
  const { errorResponse } = await requireProfile(['Master', 'Diretor Geral', 'Administrador', 'Administrador Master'], request)
  if (errorResponse) return errorResponse

  return NextResponse.json({ success: true })
}
