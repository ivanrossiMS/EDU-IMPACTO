import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetProvaById,
  dbSaveProva,
  dbGetTentativasByProvaId,
  dbGetTentativaById,
  dbSaveTentativa,
  dbSaveQuestoes,
  dbSaveExcecao
} from '@/lib/provas-online/db'
import { repairExamQuestoes } from '@/lib/provas-online/textSanitizer'
import { autoGradeTentativa } from '@/lib/provas-online/engine'

export const dynamic = 'force-dynamic'

/**
 * GET: Fetch all submissions and essay questions for grading.
 * Query param: modo=aluno ou modo=questao, anonimo=true|false
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireStaff(request)
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

  // Fetch eligible class students so teacher can also launch printed answer sheets (OMR)
  const adminClient = getAdminClient()
  let alunosElegiveis: any[] = []
  try {
    let alunosQuery = adminClient.from('alunos').select('id, nome, matricula, turma, status')
    if (prova.alunosModo === 'especificos' && prova.alunosEspecificos && prova.alunosEspecificos.length > 0) {
      alunosQuery = alunosQuery.in('id', prova.alunosEspecificos)
    } else if (prova.turmas && prova.turmas.length > 0) {
      const { data: turmasDb } = await adminClient.from('turmas').select('id, codigo, nome')
      const turmaTokens = new Set<string>()
      for (const t of prova.turmas) {
        turmaTokens.add(String(t).trim())
        const match = (turmasDb || []).find(row =>
          String(row.nome).toLowerCase() === String(t).toLowerCase() ||
          String(row.id).toLowerCase() === String(t).toLowerCase() ||
          String(row.codigo).toLowerCase() === String(t).toLowerCase()
        )
        if (match) {
          if (match.id) turmaTokens.add(String(match.id).trim())
          if (match.codigo) turmaTokens.add(String(match.codigo).trim())
          if (match.nome) turmaTokens.add(String(match.nome).trim())
        }
      }
      alunosQuery = alunosQuery.in('turma', Array.from(turmaTokens))
    }
    const { data: rows } = await alunosQuery
    alunosElegiveis = (rows || [])
      .filter((a: any) => !a.status || ['ativo', 'matriculado', 'cursando'].includes(String(a.status).toLowerCase()))
      .sort((a: any, b: any) => String(a.nome || '').localeCompare(String(b.nome || '')))
  } catch {}

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
    alunosElegiveis,
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
  const { user, errorResponse } = await requireStaff(request)
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

  // 3. Reparar e Higienizar Textos das Questões Permanentemente
  if (acao === 'reparar_textos') {
    const repairedQuestoes = repairExamQuestoes(prova.questoes || [])
    await dbSaveQuestoes(provaId, repairedQuestoes)
    return NextResponse.json({
      ok: true,
      message: 'Textos das questões higienizados e alternativas reparadas com sucesso!',
      totalQuestoes: repairedQuestoes.length,
      questoes: repairedQuestoes
    })
  }

  // 4. Simular ou Efetivar Anulação de Questão
  if (acao === 'simular_anulacao' || acao === 'anular_questao') {
    const isPreview = acao === 'simular_anulacao' || body.preview === true
    const rawPolitica = body.politica || body.metodo || 'pontuar_todos'
    const politica: 'pontos_para_todos' | 'redistribuir_demais' =
      rawPolitica === 'redistribuir' || rawPolitica === 'redistribuir_demais'
        ? 'redistribuir_demais'
        : 'pontos_para_todos'
    const motivo = body.motivo || 'Questão anulada pelo professor/coordenação'

    if (!questaoId) {
      return NextResponse.json({ error: 'questaoId é obrigatório' }, { status: 400 })
    }

    const questoes = prova.questoes || []
    const targetQ = questoes.find(q => q.id === questaoId)
    if (!targetQ) {
      return NextResponse.json({ error: 'Questão não encontrada nesta prova' }, { status: 404 })
    }

    const tentativas = await dbGetTentativasByProvaId(provaId)
    const submittedTentativas = tentativas.filter(t => t.status === 'entregue' || t.status === 'expirada')
    const qPoints = Number(targetQ.pontuacao || 1)

    const impactAnalysis = submittedTentativas.map(t => {
      const currentResp = t.respostas?.[questaoId]
      const pontosAtuais = Number(currentResp?.pontuacaoObtida ?? (currentResp as any)?.pontosAtribuidos ?? (currentResp as any)?.nota ?? 0)
      let novaNota = Number(t.notaFinal || 0)

      if (politica === 'pontos_para_todos') {
        const ganho = Math.max(0, qPoints - pontosAtuais)
        novaNota = Math.round((novaNota + ganho) * 100) / 100
      } else {
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

    if (isPreview) {
      return NextResponse.json({
        ok: true,
        preview: true,
        simulacao: {
          mediaAnterior,
          novaMedia,
          alunosBeneficiados
        },
        mediaAtual: mediaAnterior,
        mediaSimulada: novaMedia,
        alunosImpactados: alunosBeneficiados,
        impactoAlunos: impactAnalysis
      })
    }

    targetQ.anulada = true
    targetQ.motivoAnulacao = motivo
    targetQ.politicaAnulacao = politica

    await dbSaveProva(prova)

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
          comentarioProfessor: `[Questão Anulada: ${motivo}]`
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

    await dbSaveExcecao({
      id: crypto.randomUUID(),
      provaId,
      alunoId: 'TODOS',
      tipoExcecao: 'desbloqueio',
      justificativa: `Questão ${(targetQ.ordem || 0) + 1} anulada. Política: ${politica}. Motivo: ${motivo}`,
      autorizadoPor: graderName,
      dados: { questaoId, politica, motivo },
      createdAt: nowIso
    })

    return NextResponse.json({
      ok: true,
      message: 'Questão anulada e todas as notas recalculadas com sucesso!',
      impactoAlunos: impactAnalysis
    })
  }

  // 5. Lançar Prova Impressa / Cartão-Resposta (OMR Manual)
  if (acao === 'lancar_cartao_impresso') {
    const { alunoId, alunoNome, alunoMatricula, turmaId, respostasCartao } = body
    if (!alunoId || !respostasCartao) {
      return NextResponse.json({ error: 'Selecione o estudante e preencha o cartão-resposta.' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const allTentativas = await dbGetTentativasByProvaId(provaId)
    const existingTentativa = allTentativas.find(t => t.alunoId === alunoId)

    const formattedRespostas: Record<string, any> = { ...(existingTentativa?.respostas || {}) }
    for (const q of (prova.questoes || [])) {
      const entry = respostasCartao[q.id]
      if (!entry) continue

      if (q.tipo === 'multipla_escolha') {
        if (entry.alternativaIdSelecionada) {
          formattedRespostas[q.id] = {
            questaoId: q.id,
            alternativaIdSelecionada: entry.alternativaIdSelecionada,
            respostaOpcaoId: entry.alternativaIdSelecionada,
            versao: 1,
            salvoEm: nowIso
          }
        }
      } else if (q.tipo === 'multipla_selecao') {
        const ids = Array.isArray(entry.alternativasIdsSelecionadas) ? entry.alternativasIdsSelecionadas : []
        formattedRespostas[q.id] = {
          questaoId: q.id,
          alternativasIdsSelecionadas: ids,
          respostaOpcoesIds: ids,
          versao: 1,
          salvoEm: nowIso
        }
      } else if (q.tipo === 'verdadeiro_falso') {
        if (entry.respostaVF && typeof entry.respostaVF === 'object') {
          formattedRespostas[q.id] = {
            questaoId: q.id,
            respostaVF: entry.respostaVF,
            versao: 1,
            salvoEm: nowIso
          }
        }
      } else if (q.tipo === 'dissertativa') {
        const hasNota = entry.notaDissertativa !== undefined && entry.notaDissertativa !== '' && entry.notaDissertativa !== null
        const awarded = hasNota ? Math.max(0, Math.min(Number(q.pontuacao || 1), Number(entry.notaDissertativa) || 0)) : 0
        formattedRespostas[q.id] = {
          questaoId: q.id,
          respostaDissertativa: entry.textoDissertativo || '[Realizada em Caderno Impresso]',
          textoDissertativo: entry.textoDissertativo || '[Realizada em Caderno Impresso]',
          corrigida: hasNota,
          pontuacaoObtida: awarded,
          pontosAtribuidos: awarded,
          nota: awarded,
          comentarioProfessor: entry.comentarioProfessor || 'Nota lançada via Cartão-Resposta Impresso',
          corrigidoPor: graderName,
          corrigidoEm: hasNota ? nowIso : undefined,
          versao: 1,
          salvoEm: nowIso
        }
      }
    }

    const baseTentativa: any = existingTentativa || {
      id: crypto.randomUUID(),
      provaId,
      alunoId,
      alunoNome: alunoNome || 'Estudante',
      alunoMatricula: alunoMatricula || '',
      turmaId: turmaId || prova.turmas?.[0] || '',
      numeroTentativa: 1,
      status: 'entregue',
      iniciadaEm: nowIso,
      prazoLimite: nowIso,
      entregueEm: nowIso,
      tempoAdicionalMinutos: 0,
      ordemQuestoes: (prova.questoes || []).map((q: any) => q.id),
      ordemAlternativas: {},
      respostas: formattedRespostas,
      versaoRespostas: 1,
      pontuacaoObjetiva: 0,
      pontuacaoDissertativa: 0,
      notaFinal: 0,
      statusCorrecao: 'pendente',
      createdAt: nowIso,
      updatedAt: nowIso
    }

    baseTentativa.respostas = formattedRespostas
    baseTentativa.status = 'entregue'
    baseTentativa.entregueEm = baseTentativa.entregueEm || nowIso

    // Calculate essay total first
    let totalDiss = 0
    for (const q of (prova.questoes || [])) {
      if (q.tipo === 'dissertativa') {
        const r = formattedRespostas[q.id]
        if (r && r.corrigida) {
          totalDiss += Number(r.pontuacaoObtida || 0)
        }
      }
    }
    baseTentativa.pontuacaoDissertativa = Math.round(totalDiss * 100) / 100

    const graded = autoGradeTentativa(prova, baseTentativa)
    baseTentativa.pontuacaoObjetiva = graded.pontuacaoObjetiva
    baseTentativa.pontuacaoDissertativa = graded.pontuacaoDissertativa
    baseTentativa.notaFinal = graded.notaFinal
    baseTentativa.statusCorrecao = graded.statusCorrecao
    baseTentativa.respostas = graded.respostas
    baseTentativa.comprovanteCodigo = graded.comprovanteCodigo
    baseTentativa.updatedAt = nowIso

    const saved = await dbSaveTentativa(baseTentativa)

    return NextResponse.json({
      ok: true,
      tentativa: saved,
      message: `Cartão-resposta impresso de ${baseTentativa.alunoNome} lançado e corrigido com sucesso! Nota: ${saved.notaFinal.toFixed(2)}`
    })
  }

  return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 })
}
