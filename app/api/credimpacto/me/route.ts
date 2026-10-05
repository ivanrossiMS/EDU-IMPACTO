import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const resolved = await resolveCredImpactoUser(user)
    return NextResponse.json({
      id: resolved.id,
      systemUserId: resolved.systemUserId,
      funcionarioId: resolved.funcionarioId,
      nome: resolved.nome,
      email: resolved.email,
      cpf: resolved.cpf,
      cargo: resolved.cargo,
      perfil: resolved.perfil,
      matricula: resolved.matricula,
      salarioBase: resolved.salarioBase,
      unidade: resolved.unidade,
      isAdminOrFinance: resolved.isAdminOrFinance
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao consultar usuário' }, { status: 500 })
  }
}
