import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetProvaById,
  dbSaveProva,
  dbGetTentativasByProvaId,
  dbSaveTentativa,
  dbSaveExcecao
} from '@/lib/provas-online/db'

export const dynamic = 'force-dynamic'

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
  const { questaoId, motivo, politica, preview } = body
  // politica: 'pontos_para_todos' | 'redistribuir_demais'

  if (!questaoId || !politica) {
    return NextResponse.json({ error: 'questaoId e politica são obrigatórios' }, { status: 400 })
  }

  const questoes = prova.questoes || []
  const targetQ = questoes.find(q => q.id === questaoId)
  if (!targetQ) {
    return NextResponse.json({ error: 'Questão não encontrada nesta prova' }, { status: 404 })
  }

  const tentativas = await dbGetTentativasByProvaId(provaId)
  const qPoints = Number(targetQ.pontuacao || 1)

  // Calculate simulated impact on every attempt
  const impactAnalysis = tentativas.map(t => {
    const currentResp = t.respostas?.[questaoId]
    const pontosAtuais = Number(currentResp?.pontuacaoObtida || 0)
    let novaNota = t.notaFinal

    if (politica === 'pontos_para_todos') {
      const ganho = Math.max(0, qPoints - pontosAtuais)
      novaNota = Math.round((t.notaFinal + ganho) * 100) / 100
    } else if (politica === 'redistribuir_demais') {
      // Redistribute: scale remaining points to total exam value
      const totalOriginal = Number(prova.valorTotal || 10)
      const validMaxPoints = totalOriginal - qPoints
      if (validMaxPoints > 0) {
        const studentScoreWithoutQ = Math.max(0, t.notaFinal - pontosAtuais)
        novaNota = Math.round(((studentScoreWithoutQ / validMaxPoints) * totalOriginal) * 100) / 100
      }
    }

    return {
      tentativaId: t.id,
      alunoId: t.alunoId,
      alunoNome: t.alunoNome,
      notaAnterior: t.notaFinal,
      novaNota,
      diferenca: Math.round((novaNota - t.notaFinal) * 100) / 100
    }
  })

  // If preview mode, return impact analysis without mutating database
  if (preview) {
    return NextResponse.json({
      preview: true,
      questaoId,
      enunciado: targetQ.enunciado,
      politica,
      totalAlunosAfetados: impactAnalysis.length,
      mediaAnterior: impactAnalysis.length > 0 
        ? Math.round((impactAnalysis.reduce((acc, i) => acc + i.notaAnterior, 0) / impactAnalysis.length) * 100) / 100 
        : 0,
      novaMediaPrevista: impactAnalysis.length > 0 
        ? Math.round((impactAnalysis.reduce((acc, i) => acc + i.novaNota, 0) / impactAnalysis.length) * 100) / 100 
        : 0,
      impactoAlunos: impactAnalysis
    })
  }

  // Apply annulment!
  targetQ.anulada = true
  targetQ.motivoAnulacao = motivo || 'Questão anulada pelo professor/coordenação'
  targetQ.politicaAnulacao = politica

  await dbSaveProva(prova)

  // Update all student attempts with new grades
  const adminClient = getAdminClient()
  const { data: dbUser } = await adminClient
    .from('system_users')
    .select('nome')
    .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
    .maybeSingle()

  const authorName = dbUser?.nome || user.user_metadata?.nome || 'Coordenação'

  for (const item of impactAnalysis) {
    const t = tentativas.find(x => x.id === item.tentativaId)
    if (t) {
      t.notaFinal = item.novaNota
      if (t.respostas && t.respostas[questaoId]) {
        t.respostas[questaoId].pontuacaoObtida = (politica === 'pontos_para_todos') ? qPoints : 0
        t.respostas[questaoId].comentarioProfessor = `[Questão Anulada: ${motivo || 'Pontuação recalculada'}]`
      }
      await dbSaveTentativa(t)
    }
  }

  // Log in exceptions/audit
  await dbSaveExcecao({
    id: crypto.randomUUID(),
    provaId,
    alunoId: 'TODOS',
    tipoExcecao: 'desbloqueio',
    justificativa: `Questão ${targetQ.ordem + 1} anulada. Política: ${politica}. Motivo: ${motivo}`,
    autorizadoPor: authorName,
    dados: { questaoId, politica, motivo },
    createdAt: new Date().toISOString()
  })

  return NextResponse.json({
    ok: true,
    message: `Questão anulada com sucesso com a política '${politica}'. Todas as notas foram recalculadas.`,
    impactoAlunos: impactAnalysis
  })
}
