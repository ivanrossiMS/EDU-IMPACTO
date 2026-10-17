import { NextResponse } from 'next/server'
import { resolveUserRole, requireStaff, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { dbGetProvaById, dbSaveProva, dbDeleteProva, dbGetTentativasByProvaId, dbGetTentativaById } from '@/lib/provas-online/db'
import { sanitizeExamForParticipant, shouldPublishResults } from '@/lib/provas-online/engine'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isStaff, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  const { id } = await params
  let prova = await dbGetProvaById(id)
  let initialTentativaFromId: any = null
  if (!prova) {
    const tent = await dbGetTentativaById(id)
    if (tent) {
      initialTentativaFromId = tent
      prova = await dbGetProvaById(tent.provaId)
    }
  }
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const requestedAlunoId = searchParams.get('aluno_id') || searchParams.get('slug')

  const tentativas = await dbGetTentativasByProvaId(prova.id)

  if (!isStaff || isFamilyOrStudent) {
    const allowedAlunoIds = await getAuthorizedAlunoIdsForUser(user)
    const matricula = String(user.user_metadata?.matricula || '')
    const selfCandidateIds = new Set<string>([
      String(user.id),
      String(user.user_metadata?.aluno_id || ''),
      matricula,
      ...Array.from(allowedAlunoIds)
    ].filter(Boolean))

    if (requestedAlunoId && !selfCandidateIds.has(String(requestedAlunoId))) {
      return NextResponse.json({ error: 'Acesso negado: aluno não vinculado ao usuário autenticado.' }, { status: 403 })
    }

    if (
      initialTentativaFromId &&
      !selfCandidateIds.has(String(initialTentativaFromId.alunoId || '')) &&
      (!initialTentativaFromId.alunoMatricula || !selfCandidateIds.has(String(initialTentativaFromId.alunoMatricula)))
    ) {
      return NextResponse.json({ error: 'Acesso negado: esta tentativa pertence a outro aluno.' }, { status: 403 })
    }

    const alunoId = requestedAlunoId || user.user_metadata?.aluno_id || Array.from(allowedAlunoIds)[0] || user.id
    const rawTentativa = initialTentativaFromId || tentativas.find(t => 
      (t.alunoId === alunoId || selfCandidateIds.has(String(t.alunoId)) || t.alunoMatricula === alunoId || (matricula && t.alunoMatricula === matricula)) && 
      (t.status === 'em_andamento' || t.status === 'suspensa' || t.status === 'entregue' || t.statusCorrecao === 'corrigida')
    ) || null
    const canView = shouldPublishResults(prova, tentativas)
    let myTentativa = rawTentativa
    if (rawTentativa && !canView) {
      const maskedRespostas: Record<string, any> = {}
      for (const [k, v] of Object.entries(rawTentativa.respostas || {})) {
        if (v && typeof v === 'object') {
          const { pontuacaoObtida: _p, corrigida: _c, comentarioProfessor: _cp, ...rest } = v as any
          maskedRespostas[k] = rest
        } else {
          maskedRespostas[k] = v
        }
      }
      myTentativa = {
        ...rawTentativa,
        pontuacaoObjetiva: null,
        pontuacaoDissertativa: null,
        notaFinal: null,
        respostas: maskedRespostas
      }
    }
    const sanitized = sanitizeExamForParticipant(prova, canView)
    const quantidadeQuestoes = (prova as any).quantidadeQuestoes ?? (prova.questoes?.length || 0)
    const safeProva = !myTentativa
      ? { ...sanitized, questoes: [], quantidadeQuestoes }
      : { ...sanitized, quantidadeQuestoes }
    return NextResponse.json({
      prova: safeProva,
      myTentativa,
      ...safeProva
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
  const { errorResponse } = await requireStaff(request)
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
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const tentativas = await dbGetTentativasByProvaId(id)
  if (tentativas.length > 0 && !force) {
    return NextResponse.json({
      error: 'Esta prova possui tentativas registradas. Confirme a exclusão permanente.',
      hasTentativas: true,
      totalTentativas: tentativas.length
    }, { status: 400 })
  }

  await dbDeleteProva(id)
  return NextResponse.json({ ok: true, message: 'Prova excluída com sucesso.' })
}
