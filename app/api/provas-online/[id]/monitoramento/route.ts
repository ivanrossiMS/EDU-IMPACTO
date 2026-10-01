import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  dbGetProvaById,
  dbGetTentativasByProvaId,
  dbSaveTentativa,
  dbGetTentativaById,
  dbGetOcorrenciasByTentativaId,
  dbSendMessage,
  dbGetMessages,
  dbSaveExcecao
} from '@/lib/provas-online/db'

export const dynamic = 'force-dynamic'

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

  const adminClient = getAdminClient()

  // 1. Fetch all students in the assigned classes or target list
  let alunosQuery = adminClient.from('alunos').select('id, nome, matricula, turma, serie, foto, status')
  if (prova.alunosEspecificos && prova.alunosEspecificos.length > 0) {
    alunosQuery = alunosQuery.in('id', prova.alunosEspecificos)
  } else if (prova.turmas && prova.turmas.length > 0) {
    alunosQuery = alunosQuery.in('turma', prova.turmas)
  }

  const { data: expectedStudents } = await alunosQuery
  const validStudents = (expectedStudents || []).filter(
    (a: any) => !a.status || ['ativo', 'matriculado', 'cursando'].includes(a.status.toLowerCase())
  )

  // 2. Fetch attempts
  const tentativas = await dbGetTentativasByProvaId(provaId)
  const totalQuestoes = (prova.questoes || []).length || 1
  const now = Date.now()

  // Process attempts with live connection estimates and time left
  const studentRows = validStudents.map((aluno: any) => {
    const studentTentativas = tentativas.filter(t => t.alunoId === aluno.id)
    const activeTentativa = studentTentativas.find(t => t.status === 'em_andamento')
    const submittedTentativa = studentTentativas.find(t => t.status === 'entregue' || t.status === 'expirada')
    const currentTentativa = activeTentativa || submittedTentativa || studentTentativas[0] || null

    if (!currentTentativa) {
      return {
        alunoId: aluno.id,
        alunoNome: aluno.nome,
        alunoMatricula: aluno.matricula,
        alunoFoto: aluno.foto,
        turma: aluno.turma,
        situacao: 'nao_iniciada',
        statusConexao: 'desconectado',
        questoesRespondidas: 0,
        percentualConcluido: 0,
        tempoRestanteSegundos: null,
        tentativaId: null,
        ocorrenciasCount: 0,
        notaFinal: null
      }
    }

    const prazo = new Date(currentTentativa.prazoLimite).getTime()
    const tempoRestanteSegundos = Math.max(0, Math.floor((prazo - now) / 1000))
    const ultimaAtividade = new Date(currentTentativa.ultimaAtividade || currentTentativa.iniciadaEm).getTime()
    const diffActivity = (now - ultimaAtividade) / 1000

    // Infer connection state:
    // < 45s: online, 45s-120s: instável, > 120s: sem sinal
    let statusConexao: 'online' | 'instavel' | 'sem_sinal' = 'online'
    if (diffActivity > 120) statusConexao = 'sem_sinal'
    else if (diffActivity > 45) statusConexao = 'instavel'

    const respostasMap = currentTentativa.respostas || {}
    let respondidas = 0
    const examQuestions = prova.questoes || []
    examQuestions.forEach((q: any, qIdx: number) => {
      const r = respostasMap[q.id] || respostasMap[String(qIdx)] || Object.values(respostasMap).find((item: any) => item?.questaoId === q.id)
      if (r) {
        const hasMC = Boolean(r.alternativaIdSelecionada || r.respostaOpcaoId)
        const hasMS = Boolean((r.alternativasIdsSelecionadas && r.alternativasIdsSelecionadas.length > 0) || (r.respostaOpcoesIds && r.respostaOpcoesIds.length > 0))
        const hasVF = Boolean((r.itensVouF && (Array.isArray(r.itensVouF) ? r.itensVouF.length > 0 : Object.keys(r.itensVouF).length > 0)) || (r.respostaVF && Object.keys(r.respostaVF).length > 0))
        const hasEssay = Boolean((r.textoDissertativo && r.textoDissertativo.trim().length > 0) || (r.respostaTexto && r.respostaTexto.trim().length > 0) || (r.respostaDissertativa && r.respostaDissertativa.trim().length > 0))
        if (hasMC || hasMS || hasVF || hasEssay) {
          respondidas++
        }
      }
    })

    const percentualConcluido = Math.min(100, Math.round((respondidas / totalQuestoes) * 100))

    let situacao = currentTentativa.status
    if (currentTentativa.status === 'em_andamento' && now > prazo) {
      situacao = 'expirada'
    }

    return {
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      alunoMatricula: aluno.matricula,
      alunoFoto: aluno.foto,
      turma: aluno.turma,
      situacao,
      statusConexao: currentTentativa.status === 'entregue' ? 'finalizado' : statusConexao,
      ultimaAtividade: currentTentativa.ultimaAtividade,
      tempoRestanteSegundos,
      tempoAdicionalMinutos: currentTentativa.tempoAdicionalMinutos || 0,
      questoesRespondidas: respondidas,
      totalQuestoes,
      percentualConcluido,
      tentativaId: currentTentativa.id,
      comprovanteCodigo: currentTentativa.comprovanteCodigo,
      pontuacaoObjetiva: currentTentativa.pontuacaoObjetiva,
      notaFinal: currentTentativa.notaFinal,
      statusCorrecao: currentTentativa.statusCorrecao
    }
  })

  // Messages / Announcements
  const mensagens = await dbGetMessages(provaId)

  // Aggregate stats
  const totalEsperados = validStudents.length
  const naoIniciados = studentRows.filter(s => s.situacao === 'nao_iniciada').length
  const emAndamento = studentRows.filter(s => s.situacao === 'em_andamento').length
  const suspensos = studentRows.filter(s => s.situacao === 'suspensa').length
  const entregues = studentRows.filter(s => s.situacao === 'entregue' || s.situacao === 'expirada').length

  return NextResponse.json({
    prova: {
      id: prova.id,
      titulo: prova.titulo,
      disciplina: prova.disciplina,
      duracaoMinutos: prova.duracaoMinutos,
      dataAbertura: prova.dataAbertura,
      dataEncerramento: prova.dataEncerramento,
      valorTotal: prova.valorTotal,
      codigoLiberacao: prova.codigoLiberacao
    },
    metricas: {
      totalEsperados,
      naoIniciaram: naoIniciados,
      naoIniciados,
      emAndamento,
      onlineAgora: studentRows.filter(s => s.statusConexao === 'online').length,
      suspensas: suspensos,
      suspensos,
      entregues,
      comOcorrencias: studentRows.filter(s => (s.ocorrenciasCount || 0) > 0).length
    },
    stats: {
      totalEsperados,
      naoIniciaram: naoIniciados,
      naoIniciados,
      emAndamento,
      onlineAgora: studentRows.filter(s => s.statusConexao === 'online').length,
      suspensas: suspensos,
      suspensos,
      entregues,
      comOcorrencias: studentRows.filter(s => (s.ocorrenciasCount || 0) > 0).length
    },
    alunos: studentRows,
    mensagens,
    servidorAgora: new Date(now).toISOString()
  })
}

/**
 * Proctoring actions by teacher:
 * - add_time (+5, +10, +15 mins)
 * - resume / unlock attempt
 * - force_submit
 * - broadcast / private notice
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
  const { acao, tentativaId, minutos, justificativa, mensagem, tipoMensagem, alunoId } = body

  const adminClient = getAdminClient()
  const { data: dbUser } = await adminClient
    .from('system_users')
    .select('id, nome, perfil')
    .or(`id.eq.${user.id},auth_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle()

  const authorName = dbUser?.nome || user.user_metadata?.nome || 'Professor Aplicador'

  // 1. Enviar Mensagem / Comunicado (Geral ou Individual)
  if (acao === 'enviar_mensagem') {
    if (!mensagem || mensagem.trim() === '') {
      return NextResponse.json({ error: 'Conteúdo da mensagem é obrigatório' }, { status: 400 })
    }

    const novaMsg = await dbSendMessage({
      id: crypto.randomUUID(),
      provaId,
      tentativaId: tentativaId || null,
      alunoId: alunoId || null,
      remetenteId: user.id,
      remetenteNome: authorName,
      remetenteCargo: dbUser?.perfil || 'Professor',
      mensagem: mensagem.trim(),
      tipo: tipoMensagem || 'geral',
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({ ok: true, mensagem: novaMsg })
  }

  // 1.5 Acrescentar tempo adicional coletivo para toda a turma em prova
  if (acao === 'acrescentar_tempo_turma') {
    const mins = Number(minutos) || 10
    if (mins <= 0) {
      return NextResponse.json({ error: 'Quantidade de minutos inválida' }, { status: 400 })
    }

    const todasTentativas = await dbGetTentativasByProvaId(provaId)
    const ativas = todasTentativas.filter(t => t.status === 'em_andamento' || t.status === 'suspensa')

    let countAtualizadas = 0
    for (const t of ativas) {
      const currentDeadline = new Date(t.prazoLimite).getTime()
      const newDeadline = new Date(currentDeadline + mins * 60 * 1000).toISOString()
      t.tempoAdicionalMinutos = (t.tempoAdicionalMinutos || 0) + mins
      t.prazoLimite = newDeadline
      t.motivoTempoAdicional = justificativa || 'Acréscimo de tempo coletivo concedido para a turma'
      t.autorizadoPor = authorName
      if (t.status === 'suspensa') t.status = 'em_andamento'

      await dbSaveTentativa(t)
      await dbSaveExcecao({
        id: crypto.randomUUID(),
        provaId,
        alunoId: t.alunoId,
        tipoExcecao: 'tempo_adicional',
        minutosAdicionais: mins,
        justificativa: justificativa || 'Acréscimo coletivo para a turma',
        autorizadoPor: authorName,
        createdAt: new Date().toISOString()
      })
      countAtualizadas++
    }

    // Comunicado automático no chat/notificação da prova
    await dbSendMessage({
      id: crypto.randomUUID(),
      provaId,
      tentativaId: null,
      alunoId: null,
      remetenteId: user.id,
      remetenteNome: authorName,
      remetenteCargo: dbUser?.perfil || 'Professor',
      mensagem: `Atenção: Foram concedidos +${mins} minutos adicionais para a realização desta avaliação. Motivo: ${justificativa || 'Ajuste de cronograma em sala'}.`,
      tipo: 'geral',
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({
      ok: true,
      alunosImpactados: countAtualizadas,
      message: `Foram acrescentados +${mins} minutos para ${countAtualizadas} aluno(s) em prova.`
    })
  }

  // 2. Ações sobre tentativa específica (requer tentativaId)
  if (!tentativaId) {
    return NextResponse.json({ error: 'ID da tentativa é obrigatório' }, { status: 400 })
  }

  const tentativa = await dbGetTentativaById(tentativaId)
  if (!tentativa) {
    return NextResponse.json({ error: 'Tentativa não encontrada' }, { status: 404 })
  }

  // 2.1 Acrescentar tempo adicional
  if (acao === 'acrescentar_tempo') {
    const mins = Number(minutos) || 5
    if (mins <= 0) {
      return NextResponse.json({ error: 'Quantidade de minutos inválida' }, { status: 400 })
    }

    const currentDeadline = new Date(tentativa.prazoLimite).getTime()
    const newDeadline = new Date(currentDeadline + mins * 60 * 1000).toISOString()

    tentativa.tempoAdicionalMinutos = (tentativa.tempoAdicionalMinutos || 0) + mins
    tentativa.prazoLimite = newDeadline
    tentativa.motivoTempoAdicional = justificativa || 'Tempo adicional concedido pelo professor aplicador'
    tentativa.autorizadoPor = authorName

    // Se estiver expirada ou suspensa, reativa para em_andamento
    if (tentativa.status === 'expirada' || tentativa.status === 'suspensa') {
      tentativa.status = 'em_andamento'
    }

    await dbSaveTentativa(tentativa)

    // Salvar no histórico oficial de exceções
    await dbSaveExcecao({
      id: crypto.randomUUID(),
      provaId,
      alunoId: tentativa.alunoId,
      tipoExcecao: 'tempo_adicional',
      minutosAdicionais: mins,
      justificativa: justificativa || 'Ajuste de tempo em sala',
      autorizadoPor: authorName,
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({
      ok: true,
      novoPrazoLimite: newDeadline,
      totalMinutosAdicionais: tentativa.tempoAdicionalMinutos,
      message: `Foram acrescentados +${mins} minutos à tentativa de ${tentativa.alunoNome}.`
    })
  }

  // 2.2 Desbloquear / Retomar tentativa suspensa
  if (acao === 'desbloquear') {
    tentativa.status = 'em_andamento'
    tentativa.updatedAt = new Date().toISOString()
    await dbSaveTentativa(tentativa)

    await dbSaveExcecao({
      id: crypto.randomUUID(),
      provaId,
      alunoId: tentativa.alunoId,
      tipoExcecao: 'desbloqueio',
      justificativa: justificativa || 'Desbloqueio autorizado pelo professor após verificação de ocorrência',
      autorizadoPor: authorName,
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({
      ok: true,
      message: `A tentativa de ${tentativa.alunoNome} foi liberada para continuação.`
    })
  }

  // 2.3 Forçar encerramento
  if (acao === 'forcar_encerramento') {
    tentativa.status = 'entregue'
    tentativa.entregueEm = new Date().toISOString()
    await dbSaveTentativa(tentativa)

    await dbSaveExcecao({
      id: crypto.randomUUID(),
      provaId,
      alunoId: tentativa.alunoId,
      tipoExcecao: 'reabertura',
      justificativa: justificativa || 'Encerramento administrativo forçado pelo aplicador',
      autorizadoPor: authorName,
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({
      ok: true,
      message: `A tentativa de ${tentativa.alunoNome} foi encerrada administrativamente.`
    })
  }

  return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 })
}
