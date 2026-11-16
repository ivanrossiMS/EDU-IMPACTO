import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
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
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const { id: provaId } = await params
  const prova = await dbGetProvaById(provaId)
  if (!prova) {
    return NextResponse.json({ error: 'Prova não encontrada' }, { status: 404 })
  }

  const body = await request.json()
  const { questaoId, motivo, preview } = body
  const rawPolitica = body.politica || body.metodo
  const politica: 'pontos_para_todos' | 'redistribuir_demais' =
    rawPolitica === 'redistribuir' || rawPolitica === 'redistribuir_demais'
      ? 'redistribuir_demais'
      : 'pontos_para_todos'

  if (!questaoId || !rawPolitica) {
    return NextResponse.json({ error: 'questaoId e politica são obrigatórios' }, { status: 400 })
  }

  const questoes = prova.questoes || []
  const targetQ = questoes.find(q => q.id === questaoId)
  if (!targetQ) {
    return NextResponse.json({ error: 'Questão não encontrada nesta prova' }, { status: 404 })
  }

  const tentativas = await dbGetTentativasByProvaId(provaId)
  const submittedTentativas = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')
  const qPoints = Number(targetQ.pontuacao || 1)

  // Calculate simulated impact on every submitted attempt
  const impactAnalysis = submittedTentativas.map(t => {
    const currentResp = t.respostas?.[questaoId]
    const pontosAtuais = Number(currentResp?.pontuacaoObtida ?? (currentResp as any)?.pontosAtribuidos ?? (currentResp as any)?.nota ?? 0)
    let novaNota = Number(t.notaFinal || 0)

    if (politica === 'pontos_para_todos') {
      const ganho = Math.max(0, qPoints - pontosAtuais)
      novaNota = Math.round((novaNota + ganho) * 100) / 100
    } else if (politica === 'redistribuir_demais') {
      const totalOriginal = Number(prova.valorTotal || 10)
      const validMaxPoints = totalOriginal - qPoints
      if (validMaxPoints > 0) {
        const studentScoreWithoutQ = Math.max(0, novaNota - pontosAtuais)
        novaNota = Math.round(((studentScoreWithoutQ / validMaxPoints) * totalOriginal) * 100) / 100
      }
    }

    const diferenca = Math.round((novaNota - Number(t.notaFinal || 0)) * 100) / 100
    return {
      tentativaId: t.id,
      alunoId: t.alunoId,
      alunoNome: t.alunoNome,
      notaAnterior: Number(t.notaFinal || 0),
      novaNota,
      diferenca
    }
  })

  const mediaAnterior = impactAnalysis.length > 0
    ? Math.round((impactAnalysis.reduce((acc, i) => acc + i.notaAnterior, 0) / impactAnalysis.length) * 100) / 100
    : 0
  const novaMedia = impactAnalysis.length > 0
    ? Math.round((impactAnalysis.reduce((acc, i) => acc + i.novaNota, 0) / impactAnalysis.length) * 100) / 100
    : 0
  const alunosBeneficiados = impactAnalysis.filter(i => i.diferenca > 0).length

  // If preview mode, return impact analysis without mutating database
  if (preview) {
    return NextResponse.json({
      preview: true,
      questaoId,
      enunciado: targetQ.enunciado,
      politica,
      totalAlunosAfetados: impactAnalysis.length,
      alunosImpactados: alunosBeneficiados,
      alunosBeneficiados,
      mediaAtual: mediaAnterior,
      mediaAnterior,
      mediaSimulada: novaMedia,
      novaMediaPrevista: novaMedia,
      novaMedia,
      simulacao: {
        mediaAnterior,
        novaMedia,
        alunosBeneficiados
      },
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
  const nowIso = new Date().toISOString()

  for (const item of impactAnalysis) {
    const t = submittedTentativas.find(x => x.id === item.tentativaId)
    if (t) {
      const currentResp = t.respostas?.[questaoId]
      const pontosAtuais = Number(currentResp?.pontuacaoObtida ?? (currentResp as any)?.pontosAtribuidos ?? (currentResp as any)?.nota ?? 0)
      const novosPontosQ = (politica === 'pontos_para_todos') ? qPoints : 0
      const deltaQ = novosPontosQ - pontosAtuais

      t.respostas = t.respostas || {}
      t.respostas[questaoId] = {
        ...(currentResp || { questaoId, versao: 1, salvoEm: nowIso }),
        corrigida: true,
        pontuacaoObtida: novosPontosQ,
        comentarioProfessor: `[Questão Anulada: ${motivo || 'Pontuação recalculada'}]`
      }

      if (targetQ.tipo === 'dissertativa') {
        t.pontuacaoDissertativa = Math.max(0, Math.round((Number(t.pontuacaoDissertativa || 0) + deltaQ) * 100) / 100)
      } else {
        t.pontuacaoObjetiva = Math.max(0, Math.round((Number(t.pontuacaoObjetiva || 0) + deltaQ) * 100) / 100)
      }
      t.notaFinal = item.novaNota
      t.updatedAt = nowIso
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
