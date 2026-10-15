import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetTentativaById,
  dbSaveTentativa,
  dbGetProvaById,
  dbGetMessages
} from '@/lib/provas-online/db'
import { sanitizeExamForParticipant, autoGradeTentativa } from '@/lib/provas-online/engine'
import { RespostaQuestaoTentativa } from '@/types/provas-online'

export const dynamic = 'force-dynamic'

async function canAccessTentativa(user: any, isStaff: boolean, tentativa: any): Promise<boolean> {
  if (isStaff) return true
  if (!user || !tentativa) return false
  const metaAlunoId = user.user_metadata?.aluno_id ? String(user.user_metadata.aluno_id) : ''
  const metaMatricula = user.user_metadata?.matricula ? String(user.user_metadata.matricula) : ''
  const alunosIds: string[] = Array.isArray(user.user_metadata?.alunos_ids)
    ? user.user_metadata.alunos_ids.map(String)
    : []

  if (
    tentativa.alunoId === user.id ||
    (metaAlunoId && (tentativa.alunoId === metaAlunoId || tentativa.alunoMatricula === metaAlunoId)) ||
    (metaMatricula && (tentativa.alunoMatricula === metaMatricula || tentativa.alunoId === metaMatricula)) ||
    alunosIds.includes(String(tentativa.alunoId))
  ) {
    return true
  }

  try {
    const adminClient = getAdminClient()
    const { data: aluno } = await adminClient
      .from('alunos')
      .select('id, matricula, email, email_responsavel, cpf_responsavel, responsavel_id, dados')
      .or(`id.eq."${tentativa.alunoId}",matricula.eq."${tentativa.alunoId}"`)
      .maybeSingle()

    if (aluno) {
      const userEmail = String(user.email || '').trim().toLowerCase()
      const alunoEmail = String(aluno.email || aluno.dados?.email || '').trim().toLowerCase()
      const respEmail = String(aluno.email_responsavel || aluno.dados?.email_responsavel || '').trim().toLowerCase()
      const userCpf = String(user.user_metadata?.cpf || '').replace(/\D/g, '')
      const respCpf = String(aluno.cpf_responsavel || aluno.dados?.cpf_responsavel || '').replace(/\D/g, '')
      const respId = String(user.user_metadata?.responsavel_id || '')

      if (
        (userEmail && (userEmail === alunoEmail || userEmail === respEmail)) ||
        (userCpf && respCpf && userCpf === respCpf) ||
        (respId && String(aluno.responsavel_id || '') === respId)
      ) {
        return true
      }
    }
  } catch {}

  return false
}

function sanitizeStudentAnswerInput(ans: any) {
  if (!ans || typeof ans !== 'object') return {}
  const {
    corrigida: _corrigida,
    pontuacaoObtida: _pontuacaoObtida,
    pontosAtribuidos: _pontosAtribuidos,
    nota: _nota,
    comentarioProfessor: _comentarioProfessor,
    ...safeAns
  } = ans
  return safeAns
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tentativaId: string }> }
) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  const { tentativaId } = await params
  const tentativa = await dbGetTentativaById(tentativaId)
  if (!tentativa) {
    return NextResponse.json({ error: 'Tentativa não encontrada' }, { status: 404 })
  }

  const allowed = await canAccessTentativa(user, isStaff, tentativa)
  if (!allowed) {
    return NextResponse.json({ error: 'Acesso negado a esta tentativa.' }, { status: 403 })
  }

  const prova = await dbGetProvaById(tentativa.provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova vinculada não encontrada' }, { status: 404 })
  }

  const now = Date.now()
  const deadline = new Date(tentativa.prazoLimite).getTime()
  const tempoRestanteSegundos = Math.max(0, Math.floor((deadline - now) / 1000))

  // Auto-close if deadline expired and still in progress
  if (now > deadline && tentativa.status === 'em_andamento') {
    tentativa.status = 'expirada'
    tentativa.entregueEm = new Date(deadline).toISOString()
    const graded = autoGradeTentativa(prova, tentativa)
    tentativa.pontuacaoObjetiva = graded.pontuacaoObjetiva
    tentativa.notaFinal = graded.notaFinal
    tentativa.statusCorrecao = graded.statusCorrecao
    tentativa.comprovanteCodigo = graded.comprovanteCodigo
    tentativa.respostas = graded.respostas
    await dbSaveTentativa(tentativa)
  }

  // Sanitize questions
  const sanitizedProva = sanitizeExamForParticipant(prova, false)

  // Reorder questions and alternatives according to tentativa.ordemQuestoes
  const orderedQuestions = (tentativa.ordemQuestoes || []).map(orderItem => {
    const originalQ = sanitizedProva.questoes?.find(q => q.id === orderItem.questaoId)
    if (!originalQ) return null

    let alts = originalQ.alternativas || []
    if (orderItem.alternativasOrdem && orderItem.alternativasOrdem.length > 0) {
      const orderMap = new Map(orderItem.alternativasOrdem.map((altId, idx) => [altId, idx]))
      alts = [...alts].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
    }

    return {
      ...originalQ,
      alternativas: alts
    }
  }).filter(Boolean)

  const todasMensagens = await dbGetMessages(tentativa.provaId)
  const mensagensRelevantes = todasMensagens.filter(m => 
    !m.tentativaId || m.tentativaId === tentativaId || m.alunoId === tentativa.alunoId
  )

  return NextResponse.json({
    tentativa: {
      ...tentativa,
      respostas: tentativa.respostas || {}
    },
    prova: {
      ...sanitizedProva,
      questoes: orderedQuestions
    },
    mensagens: mensagensRelevantes,
    mensagensNaoLidas: mensagensRelevantes,
    servidorAgora: new Date(now).toISOString(),
    tempoRestanteSegundos,
    expirada: now > deadline
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tentativaId: string }> }
) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  const { tentativaId } = await params
  const tentativa = await dbGetTentativaById(tentativaId)
  if (!tentativa) {
    return NextResponse.json({ error: 'Tentativa não encontrada' }, { status: 404 })
  }

  const allowed = await canAccessTentativa(user, isStaff, tentativa)
  if (!allowed) {
    return NextResponse.json({ error: 'Acesso negado a esta tentativa.' }, { status: 403 })
  }

  const now = Date.now()
  const deadline = new Date(tentativa.prazoLimite).getTime()

  // 1. Enforce Server-authoritative Deadline
  if (now > deadline) {
    if (tentativa.status === 'em_andamento') {
      tentativa.status = 'expirada'
      tentativa.entregueEm = new Date(deadline).toISOString()
      const prova = await dbGetProvaById(tentativa.provaId)
      if (prova) {
        const graded = autoGradeTentativa(prova, tentativa)
        tentativa.pontuacaoObjetiva = graded.pontuacaoObjetiva
        tentativa.notaFinal = graded.notaFinal
        tentativa.statusCorrecao = graded.statusCorrecao
        tentativa.comprovanteCodigo = graded.comprovanteCodigo
        tentativa.respostas = graded.respostas
      }
      await dbSaveTentativa(tentativa)
    }
    return NextResponse.json({
      error: 'O tempo limite desta prova expirou no servidor. As alterações não puderam ser salvas após o encerramento do prazo.',
      expirada: true
    }, { status: 410 })
  }

  // 2. Enforce Attempt Status
  if (tentativa.status !== 'em_andamento') {
    return NextResponse.json({
      error: `Esta tentativa já foi finalizada (${tentativa.status}). Não é possível modificar respostas após o encerramento.`,
      status: tentativa.status
    }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))

  // 3. Prevent Concurrent Dual-Session Cheating
  if (body.sessionToken && tentativa.sessionToken && body.sessionToken !== tentativa.sessionToken) {
    return NextResponse.json({
      error: 'Sessão concorrente detectada: esta tentativa foi aberta em outra aba ou dispositivo. Para segurança da prova, apenas uma sessão pode estar ativa.',
      sessaoConcorrente: true
    }, { status: 409 })
  }

  // 4. Update Answers with Optimistic Locking / Versioning
  const rawAnswers = body.respostas || {}
  const answersPatch: Record<string, RespostaQuestaoTentativa> = Array.isArray(rawAnswers)
    ? Object.fromEntries(rawAnswers.filter((r: any) => r && r.questaoId).map((r: any) => [r.questaoId, r]))
    : rawAnswers
  const clientVersao = Number(body.versaoRespostas || 0)

  const currentRespostas = { ...(tentativa.respostas || {}) }
  const nowIso = new Date().toISOString()

  for (const [qId, ans] of Object.entries(answersPatch)) {
    const existing = currentRespostas[qId]
    // If incoming answer version is older than what we already confirmed, don't overwrite with old state
    if (existing && existing.versao > (ans?.versao || 0)) {
      continue
    }

    const safeAns = sanitizeStudentAnswerInput(ans)

    currentRespostas[qId] = {
      ...existing,
      ...safeAns,
      questaoId: qId,
      salvoEm: nowIso,
      versao: (safeAns.versao || (existing?.versao || 0) + 1)
    }
  }

  if (Array.isArray(body.questoesRevisao)) {
    tentativa.questoesRevisao = body.questoesRevisao
  }

  const nextVersao = Math.max(tentativa.versaoRespostas + 1, clientVersao + 1)
  tentativa.respostas = currentRespostas
  tentativa.versaoRespostas = nextVersao
  tentativa.ultimaAtividade = nowIso
  tentativa.updatedAt = nowIso

  await dbSaveTentativa(tentativa)

  const tempoRestanteSegundos = Math.max(0, Math.floor((deadline - now) / 1000))

  return NextResponse.json({
    ok: true,
    versao: nextVersao,
    salvoEm: nowIso,
    tempoRestanteSegundos,
    totalRespondidas: Object.values(currentRespostas).filter(r => 
      r.respostaOpcaoId || 
      (r.respostaOpcoesIds && r.respostaOpcoesIds.length > 0) || 
      (r.respostaVF && Object.keys(r.respostaVF).length > 0) || 
      (r.respostaDissertativa && r.respostaDissertativa.trim().length > 0)
    ).length
  })
}

export const PUT = PATCH

