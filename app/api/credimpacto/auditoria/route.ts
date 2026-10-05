import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetAuditLogs } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const entidadeId = searchParams.get('entidade_id') || undefined

    const resolved = await resolveCredImpactoUser(user)
    if (!resolved.isAdminOrFinance) {
      return NextResponse.json({ error: 'Acesso restrito à auditoria administrativa.' }, { status: 403 })
    }

    const logs = await dbGetAuditLogs(entidadeId)
    return NextResponse.json(logs)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao consultar auditoria' }, { status: 500 })
  }
}
