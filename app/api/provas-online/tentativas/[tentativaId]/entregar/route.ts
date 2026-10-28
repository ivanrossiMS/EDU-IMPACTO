import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetTentativaById,
  dbSaveTentativa,
  dbGetProvaById
} from '@/lib/provas-online/db'
import { gradeObjectiveQuestion, generateVoucherCode } from '@/lib/provas-online/engine'
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
      .select('id, matricula, email, dados')
      .or(`id.eq."${tentativa.alunoId}",matricula.eq."${tentativa.alunoId}"`)
      .maybeSingle()

    if (aluno) {
      const userEmail = String(user.email || '').trim().toLowerCase()
      const alunoEmail = String(aluno.email || aluno.dados?.email || '').trim().toLowerCase()
      const respEmail = String((aluno as any).email_responsavel || aluno.dados?.email_responsavel || '').trim().toLowerCase()
      const userCpf = String(user.user_metadata?.cpf || '').replace(/\D/g, '')
      const respCpf = String((aluno as any).cpf_responsavel || aluno.dados?.cpf_responsavel || '').replace(/\D/g, '')
      const respId = String(user.user_metadata?.responsavel_id || '')

      if (
        (userEmail && (userEmail === alunoEmail || userEmail === respEmail)) ||
        (userCpf && respCpf && userCpf === respCpf) ||
        (respId && String((aluno as any).responsavel_id || aluno.dados?.responsavel_id || '') === respId)
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

export async function POST(
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

  if (tentativa.status === 'suspensa') {
    return NextResponse.json(
      { error: 'Esta tentativa está suspensa e não pode ser entregue sem liberação do aplicador.' },
      { status: 403 }
    )
  }

  const prova = await dbGetProvaById(tentativa.provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova vinculada não encontrada' }, { status: 404 })
  }

  const hideScore = Boolean(
    prova.configuracaoDivulgacao?.liberarNota &&
    String(prova.configuracaoDivulgacao.liberarNota) !== 'imediato' &&
    !(prova as any).notasLiberadas &&
    !(prova.configuracaoDivulgacao as any)?.notasLiberadas
  )

  const maskTentativaScores = (t: any) => {
    if (!t || !hideScore) return t
    const maskedRespostas: Record<string, any> = {}
    for (const [k, v] of Object.entries(t.respostas || {})) {
      if (v && typeof v === 'object') {
        const { pontuacaoObtida: _p, corrigida: _c, comentarioProfessor: _cp, ...rest } = v as any
        maskedRespostas[k] = rest
      } else {
        maskedRespostas[k] = v
      }
    }
    return {
      ...t,
      pontuacaoObjetiva: null,
      pontuacaoDissertativa: null,
      notaFinal: null,
      respostas: maskedRespostas
    }
  }

  // Idempotency: if already submitted, return existing confirmation
  if (tentativa.status === 'entregue' || tentativa.status === 'expirada') {
    const maskedExisting = maskTentativaScores(tentativa)
    return NextResponse.json({
      ok: true,
      jaEntregue: true,
      tentativa: maskedExisting,
      comprovanteCodigo: tentativa.comprovanteCodigo,
      entregueEm: tentativa.entregueEm,
      pontuacaoObjetiva: hideScore ? null : tentativa.pontuacaoObjetiva,
      notaFinal: hideScore ? null : tentativa.notaFinal,
      message: 'Esta tentativa já havia sido finalizada com sucesso.'
    })
  }

  const body = await request.json().catch(() => ({}))

  if (tentativa.sessionToken && body.sessionToken && body.sessionToken !== tentativa.sessionToken) {
    return NextResponse.json({
      error: 'Sessão concorrente detectada: o token de sessão não corresponde à sessão ativa.',
      sessaoConcorrente: true
    }, { status: 409 })
  }

  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const deadlineMs = tentativa.prazoLimite ? new Date(tentativa.prazoLimite).getTime() : Infinity
  const toleranceMs = 120 * 1000
  const isWithinDeadlineWithTolerance = isNaN(deadlineMs) || nowMs <= deadlineMs + toleranceMs

  const mergedAnswers = { ...(tentativa.respostas || {}) }

  // Only accept new answers from body if within deadline (+120s network latency tolerance)
  if (isWithinDeadlineWithTolerance) {
    const rawAnswers = body.respostas || {}
    const finalAnswers: Record<string, RespostaQuestaoTentativa> = Array.isArray(rawAnswers)
      ? Object.fromEntries(rawAnswers.filter((r: any) => r && r.questaoId).map((r: any) => [r.questaoId, r]))
      : rawAnswers

    for (const [qId, ans] of Object.entries(finalAnswers)) {
      const safeAns = sanitizeStudentAnswerInput(ans)
      mergedAnswers[qId] = {
        ...(mergedAnswers[qId] || {}),
        ...safeAns,
        questaoId: qId,
        salvoEm: nowIso,
        versao: (mergedAnswers[qId]?.versao || 0) + 1
      }
    }
  }

  // Auto-grade objective questions on the server
  let pontuacaoObjetiva = 0
  let temDissertativaPendente = false
  const questoes = prova.questoes || []

  for (let qIdx = 0; qIdx < questoes.length; qIdx++) {
    const q = questoes[qIdx]
    let resp = mergedAnswers[q.id]
    if (!resp && mergedAnswers[String(qIdx)]) {
      resp = mergedAnswers[String(qIdx)]
      mergedAnswers[q.id] = resp
    } else if (!resp) {
      const found = Object.values(mergedAnswers).find((r: any) => r?.questaoId === q.id)
      if (found) {
        resp = found
        mergedAnswers[q.id] = resp
      }
    }
    if (q.tipo === 'dissertativa') {
      temDissertativaPendente = true
      // Preserve any existing teacher correction if already reviewed
      if (resp && resp.corrigida) {
        // already graded by teacher
      } else {
        if (resp) {
          resp.corrigida = false
          resp.pontuacaoObtida = 0
        }
      }
    } else {
      // Objective questions: auto-grade now!
      const { pontuacaoObtida } = gradeObjectiveQuestion(q, resp)
      pontuacaoObjetiva += pontuacaoObtida
      if (resp) {
        resp.corrigida = true
        resp.pontuacaoObtida = pontuacaoObtida
      }
    }
  }

  pontuacaoObjetiva = Math.round(pontuacaoObjetiva * 100) / 100
  const pontuacaoDissertativa = Number(tentativa.pontuacaoDissertativa || 0)
  const notaFinal = Math.round((pontuacaoObjetiva + pontuacaoDissertativa) * 100) / 100

  // Status de correção:
  // Se não tem questões dissertativas, a prova já está 100% corrigida!
  // Se tem dissertativas, fica 'pendente' ou 'parcial'.
  const statusCorrecao = temDissertativaPendente ? 'pendente' : 'corrigida'

  // Generate official digital receipt voucher
  const comprovanteCodigo = tentativa.comprovanteCodigo || generateVoucherCode(prova.id, tentativa.alunoId, tentativa.id, nowIso)

  tentativa.status = 'entregue'
  tentativa.entregueEm = nowIso
  tentativa.respostas = mergedAnswers
  tentativa.versaoRespostas = tentativa.versaoRespostas + 1
  tentativa.pontuacaoObjetiva = pontuacaoObjetiva
  tentativa.notaFinal = notaFinal
  tentativa.statusCorrecao = statusCorrecao
  tentativa.comprovanteCodigo = comprovanteCodigo
  tentativa.updatedAt = nowIso

  const savedTentativa = await dbSaveTentativa(tentativa)
  const responseTentativa = maskTentativaScores(savedTentativa)

  return NextResponse.json({
    ok: true,
    tentativa: responseTentativa,
    comprovanteCodigo,
    entregueEm: nowIso,
    pontuacaoObjetiva: hideScore ? null : pontuacaoObjetiva,
    notaFinal: hideScore ? null : notaFinal,
    statusCorrecao,
    message: 'Prova entregue com sucesso! Comprovante digital gerado.'
  })
}
