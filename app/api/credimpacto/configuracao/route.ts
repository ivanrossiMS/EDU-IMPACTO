import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetConfiguracao, dbSaveConfiguracao } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const config = await dbGetConfiguracao()
    return NextResponse.json(config)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar configurações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Acesso negado. Apenas o setor financeiro ou administradores podem alterar as políticas.' }, { status: 403 })
    }

    const body = await request.json()
    const saved = await dbSaveConfiguracao(body, {
      id: resolved.id,
      nome: resolved.nome,
      perfil: resolved.perfil
    })

    return NextResponse.json(saved)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao salvar configurações' }, { status: 400 })
  }
}
