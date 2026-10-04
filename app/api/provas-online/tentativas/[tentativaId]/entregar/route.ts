import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import {
  dbGetTentativaById,
  dbSaveTentativa,
  dbGetProvaById,
  dbRecordOcorrencia
} from '@/lib/provas-online/db'
import { gradeObjectiveQuestion, generateVoucherCode } from '@/lib/provas-online/engine'
import { RespostaQuestaoTentativa } from '@/types/provas-online'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tentativaId: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { tentativaId } = await params
  const tentativa = await dbGetTentativaById(tentativaId)
  if (!tentativa) {
    return NextResponse.json({ error: 'Tentativa não encontrada' }, { status: 404 })
  }

  // Idempotency: if already submitted, return existing confirmation
  if (tentativa.status === 'entregue' || tentativa.status === 'expirada') {
    return NextResponse.json({
      ok: true,
      jaEntregue: true,
      tentativa,
      comprovanteCodigo: tentativa.comprovanteCodigo,
      entregueEm: tentativa.entregueEm,
      message: 'Esta tentativa já havia sido finalizada com sucesso.'
    })
  }

  const prova = await dbGetProvaById(tentativa.provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova vinculada não encontrada' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))

  // Optional: final batch of answers passed during submission
  const rawAnswers = body.respostas || {}
  const finalAnswers: Record<string, RespostaQuestaoTentativa> = Array.isArray(rawAnswers)
    ? Object.fromEntries(rawAnswers.filter((r: any) => r && r.questaoId).map((r: any) => [r.questaoId, r]))
    : rawAnswers
  const mergedAnswers = { ...(tentativa.respostas || {}) }
  const nowIso = new Date().toISOString()

  for (const [qId, ans] of Object.entries(finalAnswers)) {
    mergedAnswers[qId] = {
      ...(mergedAnswers[qId] || {}),
      ...ans,
      salvoEm: nowIso,
      versao: (mergedAnswers[qId]?.versao || 0) + 1
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

  return NextResponse.json({
    ok: true,
    tentativa: savedTentativa,
    comprovanteCodigo,
    entregueEm: nowIso,
    pontuacaoObjetiva,
    statusCorrecao,
    message: 'Prova entregue com sucesso! Comprovante digital gerado.'
  })
}
