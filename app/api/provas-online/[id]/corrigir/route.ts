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
      respostas: t.respostas || {}
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
  if (acao === 'salvar_correcao_dissertativa') {
    if (!tentativaId || !questaoId) {
      return NextResponse.json({ error: 'tentativaId e questaoId são obrigatórios' }, { status: 400 })
    }

    const tentativa = await dbGetTentativaById(tentativaId)
    if (!tentativa) {
      return NextResponse.json({ error: 'Tentativa não encontrada' }, { status: 404 })
    }

    const currentAnswers = { ...(tentativa.respostas || {}) }
    const currentResp = currentAnswers[questaoId] || {
      questaoId,
      versao: 1,
      salvoEm: new Date().toISOString()
    }

    const awardedScore = Math.max(0, Number(nota) || 0)

    currentAnswers[questaoId] = {
      ...currentResp,
      corrigida: true,
      pontuacaoObtida: awardedScore,
      comentarioProfessor: comentario || '',
      correcaoCriterios: criteriosPontos || {},
      corrigidoPor: graderName,
      corrigidoEm: new Date().toISOString()
    }

    // Recalcular pontuação dissertativa e nota final
    const questoesDissertativas = (prova.questoes || []).filter(q => q.tipo === 'dissertativa')
    let totalDissertativa = 0
    let allGraded = true

    for (const q of questoesDissertativas) {
      const r = currentAnswers[q.id]
      if (!r || !r.corrigida) {
        allGraded = false
      } else {
        totalDissertativa += Number(r.pontuacaoObtida || 0)
      }
    }

    totalDissertativa = Math.round(totalDissertativa * 100) / 100
    const pontuacaoObjetiva = Number(tentativa.pontuacaoObjetiva || 0)
    const notaFinal = Math.round((pontuacaoObjetiva + totalDissertativa) * 100) / 100

    tentativa.respostas = currentAnswers
    tentativa.pontuacaoDissertativa = totalDissertativa
    tentativa.notaFinal = notaFinal
    tentativa.statusCorrecao = allGraded ? 'corrigida' : 'parcial'
    tentativa.updatedAt = new Date().toISOString()

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
      prova.configuracaoDivulgacao.liberarGabarito = 'imediato'
      prova.configuracaoDivulgacao.liberarNota = 'apos_correcao'
    }
    await dbSaveProva(prova)

    return NextResponse.json({
      ok: true,
      message: 'Resultados e gabaritos publicados com sucesso aos alunos e responsáveis.'
    })
  }

  return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 })
}
