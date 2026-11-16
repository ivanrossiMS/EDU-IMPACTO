import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { dbGetProvaById, dbSaveProva } from '@/lib/provas-online/db'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, dbUser, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const perfil = dbUser?.perfil || ''
  const isAllowed = ['Master', 'Administrador Master', 'Diretor Geral', 'Direção', 'Administrador', 'Coordenador', 'Coordenadora'].includes(perfil) ||
    ['PROFESSORA', 'Professor'].includes(dbUser?.cargo || '')

  if (!isAllowed) {
    return NextResponse.json({ error: 'Permissão negada. Apenas coordenadores e gestores podem aprovar avaliações.' }, { status: 403 })
  }

  const { id } = await params
  const prova = await dbGetProvaById(id)
  if (!prova) {
    return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
  }

  const aprovadorNome = dbUser?.nome || user.user_metadata?.nome || user.email || 'Coordenação'
  const now = new Date().toISOString()

  try {
    const updated = await dbSaveProva({
      ...prova,
      statusAprovacao: 'aprovada',
      aprovadoPor: aprovadorNome,
      dataAprovacao: now,
      updatedAt: now
    })

    return NextResponse.json({
      ok: true,
      message: 'Avaliação aprovada e liberada para os alunos com sucesso!',
      prova: updated
    })
  } catch (err: any) {
    console.error('[POST /api/provas-online/[id]/aprovar error]', err)
    return NextResponse.json({ error: err.message || 'Erro ao aprovar avaliação' }, { status: 500 })
  }
}
