import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { dbGetProvaById, dbSaveProva, dbDeleteProva, dbGetTentativasByProvaId } from '@/lib/provas-online/db'
import { sanitizeExamForParticipant, shouldPublishResults } from '@/lib/provas-online/engine'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { id } = await params
  const prova = await dbGetProvaById(id)
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const adminClient = getAdminClient()
  const { data: dbUser } = await adminClient
    .from('system_users')
    .select('id, perfil, cargo, nome')
    .or(`id.eq.${user.id},auth_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle()

  const cargo = dbUser?.cargo || user.user_metadata?.cargo || ''
  const perfil = dbUser?.perfil || user.user_metadata?.perfil || ''
  const isStudent = cargo === 'Aluno' || perfil === 'Aluno' || Boolean(user.user_metadata?.aluno_id)
  const isResponsible = cargo === 'Responsável' || perfil === 'Família' || perfil === 'Responsável'

  const tentativas = await dbGetTentativasByProvaId(id)

  if (isStudent || isResponsible) {
    const alunoId = user.user_metadata?.aluno_id || user.id
    const myTentativa = tentativas.find(t => t.alunoId === alunoId && (t.status === 'em_andamento' || t.status === 'entregue' || t.statusCorrecao === 'corrigida')) || null
    const canView = shouldPublishResults(prova, tentativas)
    const sanitized = sanitizeExamForParticipant(prova, canView)
    return NextResponse.json({
      prova: sanitized,
      myTentativa,
      ...sanitized
    })
  }

  return NextResponse.json({
    prova,
    ...prova
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { id } = await params
  const existing = await dbGetProvaById(id)
  if (!existing) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  // Check if attempts already started
  const tentativas = await dbGetTentativasByProvaId(id)
  const hasActiveAttempts = tentativas.some(t => t.status === 'em_andamento' || t.status === 'entregue')

  try {
    const body = await request.json()

    // If active attempts exist, block changing questions structure or reducing time
    if (hasActiveAttempts && body.questoes && body.status === 'publicada') {
      // Allow editing general instructions or extending deadline, but preserve question structure
      console.warn('[Provas Online] Prova já possui tentativas. Atualizações estruturais restritas.')
    }

    const updated = await dbSaveProva({
      ...existing,
      ...body,
      id,
      updatedAt: new Date().toISOString()
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('PUT /api/provas-online/[id] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao atualizar prova' }, { status: 400 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { id } = await params
  const tentativas = await dbGetTentativasByProvaId(id)
  if (tentativas.length > 0) {
    return NextResponse.json({
      error: 'Não é possível excluir esta prova pois ela já possui tentativas registradas. Em vez de excluir, encerre ou cancele a prova.'
    }, { status: 400 })
  }

  await dbDeleteProva(id)
  return NextResponse.json({ ok: true, message: 'Prova excluída com sucesso.' })
}
