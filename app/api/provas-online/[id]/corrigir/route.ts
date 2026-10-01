import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetProvaById,
  dbSaveProva,
  dbGetTentativasByProvaId,
  dbGetTentativaById,
  dbSaveTentativa
} from '@/lib/provas-online/db'

export const dynamic = 'force-dynamic'

/**
 * GET: Fetch all submissions and essay questions for grading.
 * Query param: modo=aluno ou modo=questao, anonimo=true|false
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { id: provaId } = await params
  const prova = await dbGetProvaById(provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const isAnonimo = searchParams.get('anonimo') === 'true'

  const tentativas = await dbGetTentativasByProvaId(provaId)
  const submittedTentativas = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')

  const questoesDissertativas = (prova.questoes || []).filter(q => q.tipo === 'dissertativa')

  // Prepare payload for grading view
  const correcaoSubmissions = submittedTentativas.map((t, idx) => {
    const rawAnswers = t.respostas || {}
    const answersMap: Record<string, any> = Array.isArray(rawAnswers)
      ? Object.fromEntries(rawAnswers.filter((r: any) => r && r.questaoId).map((r: any) => [r.questaoId, r]))
      : { ...rawAnswers }

    // Normalize so each question is accessible by q.id even if stored by index
    ;(prova.questoes || []).forEach((q: any, qIdx: number) => {
      if (!answersMap[q.id]) {
        if (answersMap[String(qIdx)]) {
          answersMap[q.id] = answersMap[String(qIdx)]
        } else {
          const found = Object.values(answersMap).find((r: any) => r?.questaoId === q.id)
          if (found) answersMap[q.id] = found
        }
      }
    })

    return {
      tentativaId: t.id,
      alunoId: isAnonimo ? `anon-${idx + 1}` : t.alunoId,
      alunoNome: isAnonimo ? `Estudante #${idx + 1}` : t.alunoNome,
      alunoMatricula: isAnonimo ? '****' : t.alunoMatricula,
      turmaId: t.turmaId,
      entregueEm: t.entregueEm,
      pontuacaoObjetiva: t.pontuacaoObjetiva,
      pontuacaoDissertativa: t.pontuacaoDissertativa,
      notaFinal: t.notaFinal,
      statusCorrecao: t.statusCorrecao,
      respostas: answersMap
    }
  })

  return NextResponse.json({
    prova: {
      id: prova.id,
      titulo: prova.titulo,
      disciplina: prova.disciplina,
      valorTotal: prova.valorTotal,
      status: prova.status,
      questoes: prova.questoes
    },
    questoesDissertativas,
    submissions: correcaoSubmissions,
    totalEntregues: submittedTentativas.length,
    pendentesCorrecao: submittedTentativas.filter(t => t.statusCorrecao === 'pendente' || t.statusCorrecao === 'parcial').length
  })
}

/**
 * POST: Grade essay question or publish results.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { id: provaId } = await params
  const prova = await dbGetProvaById(provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const body = await request.json()
  const { acao, tentativaId, questaoId, nota, comentario, criteriosPontos, publicarGabaritoENota } = body

  const adminClient = getAdminClient()
  const { data: dbUser } = await adminClient
    .from('system_users')
    .select('id, nome, perfil')
    .or(`id.eq.${user.id},auth_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle()

  const graderName = dbUser?.nome || user.user_metadata?.nome || 'Professor Corretor'

  // 1. Salvar Correção de Questão Dissertativa
  if (acao === 'salvar_correcao' || acao === 'salvar_correcao_dissertativa') {
    if (!tentativaId || !questaoId) {
      return NextResponse.json({ error: 'tentativaId e questaoId são obrigatórios' }, { status: 400 })
    }

    const tentativa = await dbGetTentativaById(tentativaId)
    if (!tentativa) {
      return NextResponse.json({ error: 'Tentativa não encontrada' }, { status: 404 })
    }

    const currentAnswers = { ...(tentativa.respostas || {}) }
    let currentResp = currentAnswers[questaoId]
    if (!currentResp) {
      const qIdx = (prova.questoes || []).findIndex((q: any) => q.id === questaoId)
      if (qIdx >= 0 && currentAnswers[String(qIdx)]) {
        currentResp = currentAnswers[String(qIdx)]
      } else {
        const found = Object.values(currentAnswers).find((r: any) => r?.questaoId === questaoId)
        if (found) currentResp = found
      }
    }

    if (!currentResp) {
      currentResp = {
        questaoId,
        versao: 1,
        salvoEm: new Date().toISOString()
      }
    }

    const awardedScore = Math.max(0, Number(nota) || 0)
    const nowIso = new Date().toISOString()

    currentAnswers[questaoId] = {
      ...currentResp,
      corrigida: true,
      pontuacaoObtida: awardedScore,
      pontosAtribuidos: awardedScore,
      nota: awardedScore,
      comentarioProfessor: comentario || '',
      comentarioCorrecao: comentario || '',
      comentario: comentario || '',
      correcaoCriterios: criteriosPontos || {},
      criteriosPontos: criteriosPontos || {},
      corrigidoPor: graderName,
      corrigidoEm: nowIso,
      corrigidaEm: nowIso
    }

    // Recalcular pontuação dissertativa e nota final
    const questoesDissertativas = (prova.questoes || []).filter(q => q.tipo === 'dissertativa')
    let totalDissertativa = 0
    let allGraded = true

    for (const q of questoesDissertativas) {
      let r = currentAnswers[q.id]
      if (!r) {
        const qIdx = (prova.questoes || []).findIndex((item: any) => item.id === q.id)
        if (qIdx >= 0 && currentAnswers[String(qIdx)]) {
          r = currentAnswers[String(qIdx)]
          currentAnswers[q.id] = r
        }
      }
      if (!r || (!r.corrigida && !r.corrigidoEm && !r.corrigidaEm)) {
        allGraded = false
      } else {
        totalDissertativa += Number(r.pontuacaoObtida ?? r.pontosAtribuidos ?? r.nota ?? 0)
      }
    }

    totalDissertativa = Math.round(totalDissertativa * 100) / 100
    const pontuacaoObjetiva = Number(tentativa.pontuacaoObjetiva || 0)
    const notaFinal = Math.round((pontuacaoObjetiva + totalDissertativa) * 100) / 100

    tentativa.respostas = currentAnswers
    tentativa.pontuacaoDissertativa = totalDissertativa
    tentativa.notaFinal = notaFinal
    tentativa.statusCorrecao = allGraded ? 'corrigida' : 'parcial'
    tentativa.updatedAt = nowIso

    const saved = await dbSaveTentativa(tentativa)

    return NextResponse.json({
      ok: true,
      tentativa: saved,
      pontuacaoDissertativa: totalDissertativa,
      notaFinal,
      statusCorrecao: tentativa.statusCorrecao,
      message: 'Correção salva com sucesso.'
    })
  }

  // 2. Publicar Resultados Oficialmente
  if (acao === 'publicar_resultados') {
    prova.status = 'publicada'
    prova.publicadoEm = new Date().toISOString()
    if (publicarGabaritoENota) {
      prova.configuracaoDivulgacao = prova.configuracaoDivulgacao || {}
      prova.configuracaoDivulgacao.liberarGabarito = 'imediato'
      prova.configuracaoDivulgacao.liberarNota = 'apos_correcao'
    }
    await dbSaveProva(prova)

    // Atualiza todas as tentativas submetidas para 'corrigida' e consolida as notas
    const tentativas = await dbGetTentativasByProvaId(provaId)
    const submitted = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')
    const gradesPayload = body.grades || {} // Record<`${tentativaId}_${questaoId}`, { nota, comentario, criteriosPontos }>

    for (const t of submitted) {
      const currentAnswers = { ...(t.respostas || {}) }
      const questoesDissertativas = (prova.questoes || []).filter((q: any) => q.tipo === 'dissertativa')

      // Aplicar notas do payload se houver
      for (const q of questoesDissertativas) {
        const gradeKey = `${t.id}_${q.id}`
        const pendingGrade = gradesPayload[gradeKey]
        let r = currentAnswers[q.id]
        if (!r) {
          const qIdx = (prova.questoes || []).findIndex((item: any) => item.id === q.id)
          if (qIdx >= 0 && currentAnswers[String(qIdx)]) {
            r = currentAnswers[String(qIdx)]
          }
        }

        if (pendingGrade && pendingGrade.nota !== undefined) {
          const awarded = Math.max(0, Number(pendingGrade.nota) || 0)
          r = {
            ...(r || { questaoId: q.id, versao: 1, salvoEm: new Date().toISOString() }),
            corrigida: true,
            pontuacaoObtida: awarded,
            pontosAtribuidos: awarded,
            nota: awarded,
            comentarioProfessor: pendingGrade.comentario || '',
            comentarioCorrecao: pendingGrade.comentario || '',
            comentario: pendingGrade.comentario || '',
            correcaoCriterios: pendingGrade.criteriosPontos || {},
            criteriosPontos: pendingGrade.criteriosPontos || {},
            corrigidoPor: graderName,
            corrigidoEm: new Date().toISOString(),
            corrigidaEm: new Date().toISOString()
          }
        } else if (r && !r.corrigida) {
          // Marca como corrigida com a nota atual que tiver (ou 0)
          r.corrigida = true
          r.corrigidoEm = new Date().toISOString()
          r.corrigidaEm = new Date().toISOString()
          r.pontuacaoObtida = Number(r.pontuacaoObtida ?? r.pontosAtribuidos ?? r.nota ?? 0)
        }
        if (r) {
          currentAnswers[q.id] = r
        }
      }

      // Recalcula total dissertativa
      let totalDissertativa = 0
      for (const q of questoesDissertativas) {
        const r = currentAnswers[q.id]
        if (r) {
          totalDissertativa += Number(r.pontuacaoObtida ?? r.pontosAtribuidos ?? r.nota ?? 0)
        }
      }
      totalDissertativa = Math.round(totalDissertativa * 100) / 100
      const pontuacaoObjetiva = Number(t.pontuacaoObjetiva || 0)
      const notaFinal = Math.round((pontuacaoObjetiva + totalDissertativa) * 100) / 100

      t.respostas = currentAnswers
      t.pontuacaoDissertativa = totalDissertativa
      t.notaFinal = notaFinal
      t.statusCorrecao = 'corrigida'
      t.updatedAt = new Date().toISOString()

      await dbSaveTentativa(t)
    }

    return NextResponse.json({
      ok: true,
      message: 'Resultados e gabaritos publicados com sucesso aos alunos e responsáveis.'
    })
  }

  return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 })
}
