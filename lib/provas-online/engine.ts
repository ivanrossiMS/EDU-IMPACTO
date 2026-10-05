import {
  ProvaOnline,
  QuestaoProva,
  TentativaAluno,
  RespostaQuestaoTentativa,
  ConfigPontuacaoParcial
} from '@/types/provas-online'

/**
 * Business Logic Engine for Provas Online.
 * Authoritative calculations executed exclusively on the server.
 */

/**
 * Calculates the exact server deadline for an attempt.
 * Respects: iniciadaEm + (duracaoMinutos + tempoAdicionalMinutos) AND dataEncerramento.
 */
export function calculateServerDeadline(
  prova: ProvaOnline,
  iniciadaEmIso: string,
  tempoAdicionalMinutos = 0
): string {
  const startTime = new Date(iniciadaEmIso).getTime()
  const totalDurationMinutes = Number(prova.duracaoMinutos || 60) + Number(tempoAdicionalMinutos || 0)
  const individualEnd = startTime + totalDurationMinutes * 60 * 1000

  const schoolClosingEnd = prova.dataEncerramento ? new Date(prova.dataEncerramento).getTime() : NaN

  // O prazo efetivo é o menor entre o término da duração individual e o encerramento da aplicação
  const effectiveDeadlineTime = !isNaN(schoolClosingEnd) && schoolClosingEnd > startTime
    ? Math.min(individualEnd, schoolClosingEnd)
    : individualEnd

  return new Date(effectiveDeadlineTime).toISOString()
}

/**
 * Verifies if an exam is currently available for a student to start.
 */
export function checkExamAvailabilityForStudent(
  prova: ProvaOnline,
  alunoId: string,
  attemptsCount: number
): { canStart: boolean; reason?: string } {
  const now = Date.now()
  const abertura = prova.dataAbertura ? new Date(prova.dataAbertura).getTime() : 0
  const encerramento = prova.dataEncerramento ? new Date(prova.dataEncerramento).getTime() : Infinity

  if (prova.status === 'rascunho') {
    return { canStart: false, reason: 'Esta prova ainda é um rascunho e não foi publicada pelo professor.' }
  }

  if (prova.aprovacaoRequerida && prova.statusAprovacao !== 'aprovada') {
    return { canStart: false, reason: 'Esta prova aguarda aprovação da coordenação pedagógica.' }
  }

  if (abertura > 0 && now < abertura) {
    return { canStart: false, reason: `Esta prova será liberada em ${new Date(prova.dataAbertura).toLocaleString('pt-BR')}.` }
  }

  if (!isNaN(encerramento) && now > encerramento) {
    return { canStart: false, reason: 'O período de aplicação desta prova já foi encerrado.' }
  }

  if (prova.dataLimiteInicio) {
    const limiteInicio = new Date(prova.dataLimiteInicio).getTime()
    if (!isNaN(limiteInicio) && now > limiteInicio) {
      return { canStart: false, reason: `O horário limite para iniciar esta prova encerrou às ${new Date(prova.dataLimiteInicio).toLocaleTimeString('pt-BR')}.` }
    }
  }

  // Verificar se o aluno está na lista se houver restrição específica para alunos selecionados
  if (prova.alunosModo === 'especificos' && prova.alunosEspecificos && prova.alunosEspecificos.length > 0) {
    if (!prova.alunosEspecificos.includes(alunoId)) {
      return { canStart: false, reason: 'Você não está na lista de participantes autorizados para esta prova.' }
    }
  }

  if (attemptsCount >= Number(prova.quantidadeTentativas || 1)) {
    return { canStart: false, reason: `Você já atingiu o limite de ${prova.quantidadeTentativas} tentativa(s) permitida(s).` }
  }

  return { canStart: true }
}

/**
 * Sanitizes exam questions and answers for students/parents.
 * CRITICAL SECURITY: Strips correct answer keys, rubrics, and expected answers
 * unless the publication criteria configured by the school are satisfied.
 */
export function sanitizeExamForParticipant(
  prova: ProvaOnline,
  canViewResults: boolean = false
): ProvaOnline {
  const sanitizedQuestoes = (prova.questoes || []).map(q => {
    const safeQ: QuestaoProva = {
      ...q,
      // If results are NOT released yet, hide sensitive fields
      respostaEsperada: canViewResults ? q.respostaEsperada : undefined,
      explicacaoResposta: canViewResults ? q.explicacaoResposta : undefined,
      alternativas: (q.alternativas || []).map(alt => ({
        id: alt.id,
        letra: alt.letra,
        texto: alt.texto,
        ordem: alt.ordem,
        correta: canViewResults ? alt.correta : false // Mask correct answer
      })),
      itensVF: (q.itensVF || []).map(item => ({
        id: item.id,
        afirmacao: item.afirmacao,
        ordem: item.ordem,
        correta: canViewResults ? item.correta : false // Mask correct answer
      }))
    }
    return safeQ
  })

  const hasPin = Boolean(prova.codigoLiberacao && String(prova.codigoLiberacao).trim() !== '')

  return {
    ...prova,
    questoes: sanitizedQuestoes,
    exigeCodigoAcesso: hasPin,
    codigoLiberacao: undefined, // Never send release PIN to student browser
    materiaisPermitidos: undefined
  }
}

/**
 * Server-side objective question auto-grader.
 * Evaluates Single Choice, Multiple Choice (with partial points), and True/False.
 */
export function gradeObjectiveQuestion(
  questao: QuestaoProva,
  resposta?: RespostaQuestaoTentativa
): { pontuacaoObtida: number; corrigida: boolean } {
  if (questao.anulada) {
    // If annulled with points to all, award full points
    if (questao.politicaAnulacao === 'pontos_para_todos') {
      return { pontuacaoObtida: Number(questao.pontuacao || 1), corrigida: true }
    }
    return { pontuacaoObtida: 0, corrigida: true }
  }

  if (!resposta) {
    return { pontuacaoObtida: 0, corrigida: true }
  }

  const maxPoints = Number(questao.pontuacao || 1)

  // 1. Múltipla Escolha (Única alternativa)
  if (questao.tipo === 'multipla_escolha') {
    const correta = (questao.alternativas || []).find(a => a.correta)
    const selectedId = (resposta as any)?.alternativaIdSelecionada || resposta?.respostaOpcaoId
    if (correta && selectedId === correta.id) {
      return { pontuacaoObtida: maxPoints, corrigida: true }
    }
    return { pontuacaoObtida: 0, corrigida: true }
  }

  // 2. Múltipla Seleção (Várias alternativas corretas)
  if (questao.tipo === 'multipla_selecao') {
    const corretas = (questao.alternativas || []).filter(a => a.correta).map(a => a.id)
    const incorretas = (questao.alternativas || []).filter(a => !a.correta).map(a => a.id)
    const rawSelecionadas = (resposta as any)?.alternativasIdsSelecionadas || resposta?.respostaOpcoesIds
    const selecionadas = Array.isArray(rawSelecionadas) ? rawSelecionadas : []

    const config: ConfigPontuacaoParcial = questao.configPontuacaoParcial || {
      permiteParcial: true,
      tipoCalculo: 'proporcional'
    }

    if (!config.permiteParcial || config.tipoCalculo === 'estrita') {
      // Estrita: precisa selecionar TODAS as corretas e NENHUMA incorreta
      const acertouTodas = corretas.length === selecionadas.length && corretas.every(c => selecionadas.includes(c))
      return { pontuacaoObtida: acertouTodas ? maxPoints : 0, corrigida: true }
    }

    if (config.tipoCalculo === 'proporcional') {
      // Proporcional: Se marcou qualquer incorreta, pontuação 0. Se marcou apenas corretas, fração proporcional.
      const marcouIncorreta = selecionadas.some(s => incorretas.includes(s))
      if (marcouIncorreta || corretas.length === 0) {
        return { pontuacaoObtida: 0, corrigida: true }
      }
      const acertos = selecionadas.filter(s => corretas.includes(s)).length
      const score = Math.round((acertos / corretas.length) * maxPoints * 100) / 100
      return { pontuacaoObtida: score, corrigida: true }
    }

    if (config.tipoCalculo === 'acertos_menos_erros') {
      // Acertos menos erros
      const acertos = selecionadas.filter(s => corretas.includes(s)).length
      const erros = selecionadas.filter(s => incorretas.includes(s)).length
      const saldo = Math.max(0, acertos - erros)
      const score = Math.round((saldo / (corretas.length || 1)) * maxPoints * 100) / 100
      return { pontuacaoObtida: score, corrigida: true }
    }

    return { pontuacaoObtida: 0, corrigida: true }
  }

  // 3. Verdadeiro ou Falso
  if (questao.tipo === 'verdadeiro_falso') {
    const itens = questao.itensVF || []
    if (itens.length === 0) return { pontuacaoObtida: 0, corrigida: true }

    // Suporta tanto respostaVF quanto itensVouF
    const respostasVF: Record<string, boolean> = {}
    if (resposta?.respostaVF && typeof resposta.respostaVF === 'object') {
      Object.assign(respostasVF, resposta.respostaVF)
    }
    if ((resposta as any)?.itensVouF) {
      const ivf = (resposta as any).itensVouF
      if (Array.isArray(ivf)) {
        ivf.forEach((item: any) => {
          if (item && item.id) {
            const val = item.respostaAluno !== undefined ? item.respostaAluno : item.valor !== undefined ? item.valor : item.resposta
            if (val !== undefined) respostasVF[item.id] = Boolean(val)
          }
        })
      } else if (typeof ivf === 'object') {
        Object.entries(ivf).forEach(([k, v]: [string, any]) => {
          const val = v?.respostaAluno !== undefined ? v.respostaAluno : v?.valor !== undefined ? v.valor : v
          if (val !== undefined) respostasVF[k] = Boolean(val)
        })
      }
    }

    let acertos = 0

    itens.forEach(item => {
      const alunoResp = respostasVF[item.id]
      if (alunoResp !== undefined && alunoResp === item.correta) {
        acertos++
      }
    })

    const score = Math.round((acertos / itens.length) * maxPoints * 100) / 100
    return { pontuacaoObtida: score, corrigida: true }
  }

  // 4. Dissertativa (requer correção manual)
  if (questao.tipo === 'dissertativa') {
    // Retorna nota já lançada pelo professor ou 0 com pendente
    return {
      pontuacaoObtida: Number(resposta?.pontuacaoObtida || 0),
      corrigida: Boolean(resposta?.corrigida)
    }
  }

  return { pontuacaoObtida: 0, corrigida: false }
}

/**
 * Auto-grades objective questions and calculates total scores for an attempt.
 * Updates answers map, calculates pontuacaoObjetiva, notaFinal, statusCorrecao,
 * and generates a voucher code if missing.
 */
export function autoGradeTentativa(
  prova: ProvaOnline,
  tentativa: TentativaAluno
): {
  pontuacaoObjetiva: number
  pontuacaoDissertativa: number
  notaFinal: number
  statusCorrecao: 'pendente' | 'corrigida'
  respostas: Record<string, RespostaQuestaoTentativa>
  comprovanteCodigo: string
} {
  const questoes = prova.questoes || []
  const respostas = { ...(tentativa.respostas || {}) }
  let pontuacaoObjetiva = 0
  let temDissertativaPendente = false

  for (let qIdx = 0; qIdx < questoes.length; qIdx++) {
    const q = questoes[qIdx]
    let resp = respostas[q.id]
    if (!resp && respostas[String(qIdx)]) {
      resp = respostas[String(qIdx)]
      respostas[q.id] = resp
    } else if (!resp) {
      const found = Object.values(respostas).find((r: any) => r?.questaoId === q.id)
      if (found) {
        resp = found
        respostas[q.id] = resp
      }
    }

    if (q.tipo === 'dissertativa') {
      if (resp && resp.corrigida) {
        // Já corrigida pelo professor
      } else {
        temDissertativaPendente = true
        if (resp) {
          resp.corrigida = false
          resp.pontuacaoObtida = 0
        }
      }
    } else {
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
  const statusCorrecao = temDissertativaPendente ? 'pendente' : 'corrigida'
  const comprovanteCodigo = tentativa.comprovanteCodigo || generateVoucherCode(
    prova.id,
    tentativa.alunoId,
    tentativa.id,
    tentativa.entregueEm || tentativa.iniciadaEm || new Date().toISOString()
  )

  return {
    pontuacaoObjetiva,
    pontuacaoDissertativa,
    notaFinal,
    statusCorrecao,
    respostas,
    comprovanteCodigo
  }
}

/**
 * Generates an official, verifiable digital submission voucher code.
 */
export function generateVoucherCode(
  provaId: string,
  alunoId: string,
  tentativaId: string,
  submittedAtIso: string
): string {
  const pSub = provaId.replace(/\D/g, '').slice(-4) || '7102'
  const aSub = alunoId.replace(/\D/g, '').slice(-4) || '8831'
  const tSub = tentativaId.replace(/\D/g, '').slice(-4) || '9240'
  const timeSub = Math.floor(new Date(submittedAtIso).getTime() / 1000).toString(16).toUpperCase()
  
  return `IMP-PRV-${pSub}-${aSub}-${tSub}-${timeSub}`
}

/**
 * Checks whether answer keys and feedback should be published to participants.
 */
export function shouldPublishResults(
  prova: ProvaOnline,
  allTentativas: TentativaAluno[] = []
): boolean {
  const modo = prova?.configuracaoDivulgacao?.liberarGabarito || 'apos_encerramento'
  if (modo === 'imediato') {
    return true
  }

  if (modo === 'manual') {
    return prova.status === 'publicada'
  }

  // 'apos_encerramento': Verificar se o prazo geral de encerramento já passou E
  // se todas as tentativas abertas com tempo adicional já foram finalizadas
  const now = Date.now()
  const encerramento = new Date(prova.dataEncerramento).getTime()

  if (now < encerramento) return false

  const anyActiveTentativa = allTentativas.some(t => {
    if (t.status !== 'em_andamento') return false
    const prazo = new Date(t.prazoLimite).getTime()
    return now < prazo
  })

  return !anyActiveTentativa
}
