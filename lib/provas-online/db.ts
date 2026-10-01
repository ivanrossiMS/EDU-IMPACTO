import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  ProvaOnline,
  QuestaoProva,
  ItemBancoQuestoes,
  TentativaAluno,
  OcorrenciaMonitoramento,
  MensagemProva,
  ExcecaoAutorizada
} from '@/types/provas-online'

/**
 * Resilient Database Repository for Provas Online.
 * Reads and writes directly to Supabase via Service Role client.
 * Seamlessly handles dedicated relational tables and resilient collection storage fallback.
 */

// Helper to check if Supabase error is table not existing in schema cache
function isTableMissingError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  const code = err.code || ''
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('relation') ||
    msg.includes('schema cache')
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVAS (EXAMS)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetProvas(): Promise<ProvaOnline[]> {
  const sb = getAdminClient()

  // 1. Try dedicated table
  try {
    const { data, error } = await sb
      .from('provas_online')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return data.map(row => ({
        ...row,
        ...(row.dados || {}),
        id: row.id,
        titulo: row.titulo || row.dados?.titulo,
        disciplina: row.disciplina || row.dados?.disciplina,
        status: row.status || row.dados?.status || 'rascunho',
        dataAbertura: row.data_abertura || row.dados?.dataAbertura,
        dataEncerramento: row.data_encerramento || row.dados?.dataEncerramento,
        duracaoMinutos: Number(row.duracao_minutos || row.dados?.duracaoMinutos || 60),
        valorTotal: Number(row.valor_total || row.dados?.valorTotal || 10),
        configuracaoLayout: row.configuracao_layout || row.dados?.configuracaoLayout,
        configuracaoMonitoramento: row.configuracao_monitoramento || row.dados?.configuracaoMonitoramento,
        configuracaoDivulgacao: row.configuracao_divulgacao || row.dados?.configuracaoDivulgacao,
        turmas: row.turmas || row.dados?.turmas || [],
        series: row.series || row.dados?.series || [],
        professorId: row.professor_id || row.dados?.professorId,
        professorNome: row.professor_nome || row.dados?.professorNome,
      }))
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetProvas dedicated table error]', err)
  }

  // 2. Resilient Fallback: read from relatorios_records with prefix 'provas_online:'
  try {
    const { data, error } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', 'provas_online:%')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row: any) => ({
      ...row.dados,
      id: row.id.replace('provas_online:', ''),
      createdAt: row.created_at,
      updatedAt: row.dados?.updatedAt || row.created_at
    }))
  } catch (e: any) {
    console.error('[dbGetProvas fallback error]', e)
    return []
  }
}

export async function dbGetProvaById(id: string): Promise<ProvaOnline | null> {
  const sb = getAdminClient()

  // 1. Try dedicated table
  try {
    const { data, error } = await sb
      .from('provas_online')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!error && data) {
      // Also fetch questions
      const questoes = await dbGetQuestoesByProvaId(id)
      return {
        ...data,
        ...(data.dados || {}),
        id: data.id,
        titulo: data.titulo || data.dados?.titulo,
        disciplina: data.disciplina || data.dados?.disciplina,
        status: data.status || data.dados?.status || 'rascunho',
        dataAbertura: data.data_abertura || data.dados?.dataAbertura,
        dataEncerramento: data.data_encerramento || data.dados?.dataEncerramento,
        duracaoMinutos: Number(data.duracao_minutos || data.dados?.duracaoMinutos || 60),
        valorTotal: Number(data.valor_total || data.dados?.valorTotal || 10),
        configuracaoLayout: data.configuracao_layout || data.dados?.configuracaoLayout,
        configuracaoMonitoramento: data.configuracao_monitoramento || data.dados?.configuracaoMonitoramento,
        configuracaoDivulgacao: data.configuracao_divulgacao || data.dados?.configuracaoDivulgacao,
        turmas: data.turmas || data.dados?.turmas || [],
        series: data.series || data.dados?.series || [],
        professorId: data.professor_id || data.dados?.professorId,
        professorNome: data.professor_nome || data.dados?.professorNome,
        questoes
      }
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetProvaById dedicated table error]', err)
  }

  // 2. Resilient Fallback
  try {
    const { data, error } = await sb
      .from('relatorios_records')
      .select('*')
      .eq('id', `provas_online:${id}`)
      .maybeSingle()

    if (error || !data) return null

    const questoes = await dbGetQuestoesByProvaId(id)
    return {
      ...data.dados,
      id: id,
      questoes,
      createdAt: data.created_at,
      updatedAt: data.dados?.updatedAt || data.created_at
    }
  } catch (e: any) {
    console.error('[dbGetProvaById fallback error]', e)
    return null
  }
}

export async function dbSaveProva(prova: Partial<ProvaOnline> & { id: string }): Promise<ProvaOnline> {
  const sb = getAdminClient()
  const now = new Date().toISOString()
  const completeProva: ProvaOnline = {
    ...prova,
    id: prova.id,
    titulo: prova.titulo || 'Prova Sem Título',
    disciplina: prova.disciplina || '',
    turmas: prova.turmas || [],
    series: prova.series || [],
    anoLetivo: prova.anoLetivo || 2026,
    bimestre: prova.bimestre || 1,
    finalidade: prova.finalidade || 'avaliacao',
    professorId: prova.professorId || '',
    professorNome: prova.professorNome || 'Professor',
    status: prova.status || 'rascunho',
    aprovacaoRequerida: prova.aprovacaoRequerida ?? false,
    statusAprovacao: prova.statusAprovacao || (prova.aprovacaoRequerida ? 'pendente' : 'aprovada'),
    valorTotal: Number(prova.valorTotal || 10),
    quantidadeTentativas: Number(prova.quantidadeTentativas || 1),
    politicaTentativas: prova.politicaTentativas || 'maior_nota',
    dataAbertura: prova.dataAbertura || now,
    dataEncerramento: prova.dataEncerramento || new Date(Date.now() + 86400000 * 7).toISOString(),
    duracaoMinutos: Number(prova.duracaoMinutos || 60),
    configuracaoLayout: prova.configuracaoLayout || {
      questaoPorPagina: false,
      navegacaoLivre: true,
      permitirVoltar: true,
      embaralharQuestoes: false,
      embaralharAlternativas: false
    },
    configuracaoMonitoramento: prova.configuracaoMonitoramento || {
      solicitarTelaCheia: false,
      registrarSaidaTela: true,
      bloquearColar: false,
      acaoOcorrencia: 'alertar'
    },
    configuracaoDivulgacao: prova.configuracaoDivulgacao || {
      liberarGabarito: 'apos_encerramento',
      liberarNota: 'apos_correcao',
      liberarComentarios: true
    },
    createdAt: prova.createdAt || now,
    updatedAt: now
  }

  // 1. Try dedicated table
  try {
    const row = {
      id: completeProva.id,
      titulo: completeProva.titulo,
      descricao: completeProva.descricao || null,
      disciplina: completeProva.disciplina,
      turmas: completeProva.turmas,
      series: completeProva.series,
      ano_letivo: typeof completeProva.anoLetivo === 'number' ? completeProva.anoLetivo : 2026,
      bimestre: completeProva.bimestre,
      finalidade: completeProva.finalidade,
      professor_id: completeProva.professorId,
      professor_nome: completeProva.professorNome,
      instrucoes: completeProva.instrucoes || null,
      materiais_permitidos: completeProva.materiaisPermitidos || null,
      status: completeProva.status,
      aprovacao_requerida: completeProva.aprovacaoRequerida,
      status_aprovacao: completeProva.statusAprovacao,
      aprovado_por: completeProva.aprovadoPor || null,
      data_aprovacao: completeProva.dataAprovacao || null,
      motivo_rejeicao: completeProva.motivoRejeicao || null,
      valor_total: completeProva.valorTotal,
      quantidade_tentativas: completeProva.quantidadeTentativas,
      politica_tentativas: completeProva.politicaTentativas,
      data_abertura: completeProva.dataAbertura,
      data_limite_inicio: completeProva.dataLimiteInicio || null,
      data_encerramento: completeProva.dataEncerramento,
      duracao_minutos: completeProva.duracaoMinutos,
      codigo_liberacao: completeProva.codigoLiberacao || null,
      configuracao_layout: completeProva.configuracaoLayout,
      configuracao_monitoramento: completeProva.configuracaoMonitoramento,
      configuracao_divulgacao: completeProva.configuracaoDivulgacao,
      alunos_especificos: completeProva.alunosEspecificos || null,
      integracao_notas: completeProva.integracaoNotas || null,
      publicado_em: completeProva.publicadoEm || null,
      dados: completeProva,
      updated_at: now
    }

    const { error } = await sb.from('provas_online').upsert(row)
    if (!error) {
      if (prova.questoes && Array.isArray(prova.questoes)) {
        await dbSaveQuestoes(completeProva.id, prova.questoes)
      }
      return completeProva
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbSaveProva dedicated error]', err)
  }

  // 2. Resilient Fallback: relatorios_records
  try {
    const { error } = await sb.from('relatorios_records').upsert({
      id: `provas_online:${completeProva.id}`,
      dados: completeProva
    })
    if (error) throw error

    if (prova.questoes && Array.isArray(prova.questoes)) {
      await dbSaveQuestoes(completeProva.id, prova.questoes)
    }
    return completeProva
  } catch (e: any) {
    console.error('[dbSaveProva fallback error]', e)
    throw e
  }
}

export async function dbDeleteProva(id: string): Promise<boolean> {
  const sb = getAdminClient()

  try {
    await sb.from('provas_online').delete().eq('id', id)
  } catch {}

  try {
    await sb.from('relatorios_records').delete().eq('id', `provas_online:${id}`)
    await sb.from('relatorios_records').delete().eq('id', `provas_online_questoes:${id}`)
  } catch {}

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTÕES (QUESTIONS)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetQuestoesByProvaId(provaId: string): Promise<QuestaoProva[]> {
  const sb = getAdminClient()

  // 1. Try dedicated table
  try {
    const { data, error } = await sb
      .from('provas_online_questoes')
      .select('*')
      .eq('prova_id', provaId)
      .order('ordem', { ascending: true })

    if (!error && Array.isArray(data)) {
      return data.map(q => ({
        ...q,
        ...(q.dados || {}),
        id: q.id,
        provaId: q.prova_id,
        ordem: q.ordem,
        tipo: q.tipo,
        enunciado: q.enunciado,
        pontuacao: Number(q.pontuacao || 1),
        alternativas: q.alternativas || q.dados?.alternativas || [],
        itensVF: q.itens_vf || q.dados?.itensVF || [],
        configPontuacaoParcial: q.config_pontuacao_parcial || q.dados?.configPontuacaoParcial,
        respostaEsperada: q.resposta_esperada || q.dados?.respostaEsperada,
        criteriosAvaliacao: q.criterios_avaliacao || q.dados?.criteriosAvaliacao,
        explicacaoResposta: q.explicacao_resposta || q.dados?.explicacaoResposta,
        anulada: q.anulada ?? false
      }))
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetQuestoes dedicated error]', err)
  }

  // 2. Resilient Fallback
  try {
    const { data, error } = await sb
      .from('relatorios_records')
      .select('*')
      .eq('id', `provas_online_questoes:${provaId}`)
      .maybeSingle()

    if (error || !data) return []
    return Array.isArray(data.dados?.questoes) ? data.dados.questoes : []
  } catch (e: any) {
    console.error('[dbGetQuestoes fallback error]', e)
    return []
  }
}

export async function dbSaveQuestoes(provaId: string, questoes: QuestaoProva[]): Promise<boolean> {
  const sb = getAdminClient()
  const ordered = questoes.map((q, idx) => ({
    ...q,
    id: q.id || crypto.randomUUID(),
    provaId,
    ordem: idx
  }))

  // 1. Try dedicated table
  try {
    // Delete existing and insert new
    await sb.from('provas_online_questoes').delete().eq('prova_id', provaId)

    const rows = ordered.map(q => ({
      id: q.id,
      prova_id: provaId,
      banco_questao_id: q.bancoQuestaoId || null,
      ordem: q.ordem,
      tipo: q.tipo,
      enunciado: q.enunciado,
      pontuacao: q.pontuacao,
      alternativas: q.alternativas || null,
      itens_vf: q.itensVF || null,
      config_pontuacao_parcial: q.configPontuacaoParcial || null,
      resposta_esperada: q.respostaEsperada || null,
      criterios_avaliacao: q.criteriosAvaliacao || null,
      limite_palavras: q.limitePalavras || null,
      permite_anexo_resolucao: q.permiteAnexoResolucao ?? false,
      explicacao_resposta: q.explicacaoResposta || null,
      anulada: q.anulada ?? false,
      motivo_anulacao: q.motivoAnulacao || null,
      politica_anulacao: q.politicaAnulacao || null,
      tags: q.tags || [],
      habilidade_bncc: q.habilidadeBNCC || null,
      dificuldade: q.dificuldade || 'media',
      dados: q
    }))

    const { error } = await sb.from('provas_online_questoes').insert(rows)
    if (!error) return true
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbSaveQuestoes dedicated error]', err)
  }

  // 2. Resilient Fallback: relatorios_records
  try {
    const { error } = await sb.from('relatorios_records').upsert({
      id: `provas_online_questoes:${provaId}`,
      dados: { provaId, questoes: ordered, updatedAt: new Date().toISOString() }
    })
    if (error) throw error
    return true
  } catch (e: any) {
    console.error('[dbSaveQuestoes fallback error]', e)
    throw e
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BANCO DE QUESTÕES (QUESTION BANK)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetBancoQuestoes(filters?: {
  disciplina?: string
  serie?: string
  dificuldade?: string
  search?: string
}): Promise<ItemBancoQuestoes[]> {
  const sb = getAdminClient()

  // 1. Try dedicated table
  try {
    let q = sb.from('provas_online_banco').select('*').eq('ativo', true).order('created_at', { ascending: false })
    if (filters?.disciplina) q = q.eq('disciplina', filters.disciplina)
    if (filters?.serie) q = q.eq('serie', filters.serie)
    if (filters?.dificuldade) q = q.eq('nivel_dificuldade', filters.dificuldade)

    const { data, error } = await q
    if (!error && Array.isArray(data)) {
      let items = data.map(row => ({
        ...row,
        ...(row.dados || {}),
        id: row.id,
        nivelDificuldade: row.nivel_dificuldade || row.dados?.nivelDificuldade || 'media',
        pontuacaoSugerida: Number(row.pontuacao_sugerida || row.dados?.pontuacaoSugerida || 1),
        habilidadeBNCC: row.habilidade_bncc || row.dados?.habilidadeBNCC,
        createdAt: row.created_at
      }))

      if (filters?.search) {
        const s = filters.search.toLowerCase()
        items = items.filter(i => 
          i.enunciado?.toLowerCase().includes(s) || 
          i.assunto?.toLowerCase().includes(s) || 
          i.habilidadeBNCC?.toLowerCase().includes(s)
        )
      }
      return items
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetBancoQuestoes dedicated error]', err)
  }

  // 2. Resilient Fallback
  try {
    const { data, error } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', 'provas_online_banco:%')
      .order('created_at', { ascending: false })

    if (error) throw error

    let items: ItemBancoQuestoes[] = (data || []).map((r: any) => ({
      ...r.dados,
      id: r.id.replace('provas_online_banco:', ''),
      createdAt: r.created_at
    }))

    items = items.filter(i => i.ativo !== false)

    if (filters?.disciplina) items = items.filter(i => i.disciplina === filters.disciplina)
    if (filters?.serie) items = items.filter(i => i.serie === filters.serie)
    if (filters?.dificuldade) items = items.filter(i => i.nivelDificuldade === filters.dificuldade)
    if (filters?.search) {
      const s = filters.search.toLowerCase()
      items = items.filter(i => 
        i.enunciado?.toLowerCase().includes(s) || 
        i.assunto?.toLowerCase().includes(s) || 
        i.habilidadeBNCC?.toLowerCase().includes(s)
      )
    }

    return items
  } catch (e: any) {
    console.error('[dbGetBancoQuestoes fallback error]', e)
    return []
  }
}

export async function dbSaveBancoQuestao(item: ItemBancoQuestoes): Promise<ItemBancoQuestoes> {
  const sb = getAdminClient()
  const id = item.id || crypto.randomUUID()
  const cleanItem: ItemBancoQuestoes = {
    ...item,
    id,
    ativo: item.ativo ?? true,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // 1. Dedicated table
  try {
    const row = {
      id,
      disciplina: cleanItem.disciplina,
      serie: cleanItem.serie,
      assunto: cleanItem.assunto,
      habilidade_bncc: cleanItem.habilidadeBNCC || null,
      nivel_dificuldade: cleanItem.nivelDificuldade || 'media',
      tipo: cleanItem.tipo,
      enunciado: cleanItem.enunciado,
      pontuacao_sugerida: cleanItem.pontuacaoSugerida || 1.0,
      alternativas: cleanItem.alternativas || null,
      itens_vf: cleanItem.itensVF || null,
      config_pontuacao_parcial: cleanItem.configPontuacaoParcial || null,
      resposta_esperada: cleanItem.respostaEsperada || null,
      criterios_avaliacao: cleanItem.criteriosAvaliacao || null,
      limite_palavras: cleanItem.limitePalavras || null,
      permite_anexo_resolucao: cleanItem.permiteAnexoResolucao ?? false,
      explicacao_resposta: cleanItem.explicacaoResposta || null,
      tags: cleanItem.tags || [],
      criado_por: cleanItem.criadoPor || null,
      ativo: cleanItem.ativo,
      dados: cleanItem
    }
    const { error } = await sb.from('provas_online_banco').upsert(row)
    if (!error) return cleanItem
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbSaveBancoQuestao dedicated error]', err)
  }

  // 2. Resilient Fallback
  try {
    const { error } = await sb.from('relatorios_records').upsert({
      id: `provas_online_banco:${id}`,
      dados: cleanItem
    })
    if (error) throw error
    return cleanItem
  } catch (e: any) {
    console.error('[dbSaveBancoQuestao fallback error]', e)
    throw e
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TENTATIVAS (STUDENT ATTEMPTS)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetTentativasByProvaId(provaId: string): Promise<TentativaAluno[]> {
  const sb = getAdminClient()

  // 1. Try dedicated table
  try {
    const { data, error } = await sb
      .from('provas_online_tentativas')
      .select('*')
      .eq('prova_id', provaId)
      .order('iniciada_em', { ascending: false })

    if (!error && Array.isArray(data)) {
      return data.map(row => ({
        ...row,
        ...(row.dados || {}),
        id: row.id,
        provaId: row.prova_id,
        alunoId: row.aluno_id,
        alunoNome: row.aluno_nome,
        alunoMatricula: row.aluno_matricula,
        turmaId: row.turma_id,
        status: row.status,
        iniciadaEm: row.iniciada_em,
        prazoLimite: row.prazo_limite,
        tempoAdicionalMinutos: Number(row.tempo_adicional_minutos || 0),
        entregueEm: row.entregue_em,
        ultimaAtividade: row.ultima_atividade,
        ordemQuestoes: row.ordem_questoes || row.dados?.ordemQuestoes || [],
        respostas: row.respostas || row.dados?.respostas || {},
        versaoRespostas: Number(row.versao_respostas || 0),
        pontuacaoObjetiva: Number(row.pontuacao_objetiva || 0),
        pontuacaoDissertativa: Number(row.pontuacao_dissertativa || 0),
        notaFinal: Number(row.nota_final || 0),
        statusCorrecao: row.status_correcao || 'pendente',
        comprovanteCodigo: row.comprovante_codigo || row.dados?.comprovanteCodigo || ''
      }))
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetTentativas dedicated error]', err)
  }

  // 2. Resilient Fallback
  try {
    const { data, error } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', `provas_online_tentativas:${provaId}:%`)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((r: any) => ({
      ...r.dados,
      id: r.id.split(':').pop(),
      createdAt: r.created_at
    }))
  } catch (e: any) {
    console.error('[dbGetTentativas fallback error]', e)
    return []
  }
}

export async function dbGetTentativaById(tentativaId: string): Promise<TentativaAluno | null> {
  const sb = getAdminClient()

  // 1. Try dedicated table
  try {
    const { data, error } = await sb
      .from('provas_online_tentativas')
      .select('*')
      .eq('id', tentativaId)
      .maybeSingle()

    if (!error && data) {
      return {
        ...data,
        ...(data.dados || {}),
        id: data.id,
        provaId: data.prova_id,
        alunoId: data.aluno_id,
        alunoNome: data.aluno_nome,
        alunoMatricula: data.aluno_matricula,
        turmaId: data.turma_id,
        status: data.status,
        iniciadaEm: data.iniciada_em,
        prazoLimite: data.prazo_limite,
        tempoAdicionalMinutos: Number(data.tempo_adicional_minutos || 0),
        entregueEm: data.entregue_em,
        ultimaAtividade: data.ultima_atividade,
        ordemQuestoes: data.ordem_questoes || data.dados?.ordemQuestoes || [],
        respostas: data.respostas || data.dados?.respostas || {},
        versaoRespostas: Number(data.versao_respostas || 0),
        pontuacaoObjetiva: Number(data.pontuacao_objetiva || 0),
        pontuacaoDissertativa: Number(data.pontuacao_dissertativa || 0),
        notaFinal: Number(data.nota_final || 0),
        statusCorrecao: data.status_correcao || 'pendente',
        comprovanteCodigo: data.comprovante_codigo || data.dados?.comprovanteCodigo || ''
      }
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetTentativaById dedicated error]', err)
  }

  // 2. Resilient Fallback: search by suffix in relatorios_records
  try {
    const { data, error } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', `%:${tentativaId}`)
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    return {
      ...data.dados,
      id: tentativaId,
      createdAt: data.created_at
    }
  } catch (e: any) {
    console.error('[dbGetTentativaById fallback error]', e)
    return null
  }
}

export async function dbSaveTentativa(tentativa: TentativaAluno): Promise<TentativaAluno> {
  const sb = getAdminClient()
  const now = new Date().toISOString()
  const completeTentativa: TentativaAluno = {
    ...tentativa,
    updatedAt: now
  }

  // 1. Try dedicated table
  try {
    const row = {
      id: completeTentativa.id,
      prova_id: completeTentativa.provaId,
      aluno_id: completeTentativa.alunoId,
      aluno_nome: completeTentativa.alunoNome,
      aluno_matricula: completeTentativa.alunoMatricula || null,
      turma_id: completeTentativa.turmaId,
      numero_tentativa: completeTentativa.numeroTentativa,
      session_token: completeTentativa.sessionToken,
      status: completeTentativa.status,
      iniciada_em: completeTentativa.iniciadaEm,
      prazo_limite: completeTentativa.prazoLimite,
      tempo_adicional_minutos: completeTentativa.tempoAdicionalMinutos || 0,
      motivo_tempo_adicional: completeTentativa.motivoTempoAdicional || null,
      autorizado_por: completeTentativa.autorizadoPor || null,
      entregue_em: completeTentativa.entregueEm || null,
      ultima_atividade: completeTentativa.ultimaAtividade || now,
      ordem_questoes: completeTentativa.ordemQuestoes,
      respostas: completeTentativa.respostas,
      versao_respostas: completeTentativa.versaoRespostas,
      pontuacao_objetiva: completeTentativa.pontuacaoObjetiva,
      pontuacao_dissertativa: completeTentativa.pontuacaoDissertativa,
      nota_final: completeTentativa.notaFinal,
      status_correcao: completeTentativa.statusCorrecao,
      comprovante_codigo: completeTentativa.comprovanteCodigo,
      dados: completeTentativa,
      updated_at: now
    }

    const { error } = await sb.from('provas_online_tentativas').upsert(row)
    if (!error) return completeTentativa
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbSaveTentativa dedicated error]', err)
  }

  // 2. Resilient Fallback: relatorios_records
  try {
    const key = `provas_online_tentativas:${completeTentativa.provaId}:${completeTentativa.id}`
    const { error } = await sb.from('relatorios_records').upsert({
      id: key,
      dados: completeTentativa
    })
    if (error) throw error
    return completeTentativa
  } catch (e: any) {
    console.error('[dbSaveTentativa fallback error]', e)
    throw e
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OCORRÊNCIAS & MONITORAMENTO (PROCTORING INCIDENTS)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbRecordOcorrencia(ocorrencia: OcorrenciaMonitoramento): Promise<OcorrenciaMonitoramento> {
  const sb = getAdminClient()
  const id = ocorrencia.id || crypto.randomUUID()
  const clean: OcorrenciaMonitoramento = {
    ...ocorrencia,
    id,
    createdAt: ocorrencia.createdAt || new Date().toISOString()
  }

  // 1. Try dedicated table
  try {
    const row = {
      id,
      tentativa_id: clean.tentativaId,
      aluno_id: clean.alunoId,
      aluno_nome: clean.alunoNome,
      tipo: clean.tipo,
      descricao: clean.descricao,
      duracao_segundos: clean.duracaoSegundos || null,
      detalhes: clean.detalhes || null,
      created_at: clean.createdAt
    }
    const { error } = await sb.from('provas_online_ocorrencias').insert(row)
    if (!error) return clean
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbRecordOcorrencia dedicated error]', err)
  }

  // 2. Resilient Fallback: relatorios_records
  try {
    await sb.from('relatorios_records').insert({
      id: `provas_online_ocorrencias:${clean.tentativaId}:${id}`,
      dados: clean
    })
    return clean
  } catch (e: any) {
    console.error('[dbRecordOcorrencia fallback error]', e)
    return clean
  }
}

export async function dbGetOcorrenciasByTentativaId(tentativaId: string): Promise<OcorrenciaMonitoramento[]> {
  const sb = getAdminClient()

  // 1. Try dedicated table
  try {
    const { data, error } = await sb
      .from('provas_online_ocorrencias')
      .select('*')
      .eq('tentativa_id', tentativaId)
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return data.map(r => ({
        id: r.id,
        tentativaId: r.tentativa_id,
        alunoId: r.aluno_id,
        alunoNome: r.aluno_nome,
        tipo: r.tipo,
        descricao: r.descricao,
        duracaoSegundos: r.duracao_segundos,
        detalhes: r.detalhes,
        createdAt: r.created_at
      }))
    }
  } catch (err: any) {
    if (!isTableMissingError(err)) console.error('[dbGetOcorrencias dedicated error]', err)
  }

  // 2. Resilient Fallback
  try {
    const { data } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', `provas_online_ocorrencias:${tentativaId}:%`)
      .order('created_at', { ascending: false })

    return (data || []).map((r: any) => ({
      ...r.dados,
      id: r.id.split(':').pop(),
      createdAt: r.created_at
    }))
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MENSAGENS / COMUNICADOS DA PROVA (EXAM NOTICES)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbSendMessage(msg: MensagemProva): Promise<MensagemProva> {
  const sb = getAdminClient()
  const id = msg.id || crypto.randomUUID()
  const clean: MensagemProva = {
    ...msg,
    id,
    createdAt: msg.createdAt || new Date().toISOString()
  }

  // 1. Dedicated table
  try {
    const row = {
      id,
      prova_id: clean.provaId,
      tentativa_id: clean.tentativaId || null,
      remetente_id: clean.remetenteId,
      remetente_nome: clean.remetenteNome,
      remetente_cargo: clean.remetenteCargo,
      mensagem: clean.mensagem,
      tipo: clean.tipo || 'geral',
      lida: false,
      created_at: clean.createdAt
    }
    const { error } = await sb.from('provas_online_mensagens').insert(row)
    if (!error) return clean
  } catch {}

  // 2. Fallback
  try {
    await sb.from('relatorios_records').insert({
      id: `provas_online_mensagens:${clean.provaId}:${id}`,
      dados: clean
    })
  } catch {}

  return clean
}

export async function dbGetMessages(provaId: string, tentativaId?: string): Promise<MensagemProva[]> {
  const sb = getAdminClient()

  // 1. Dedicated table
  try {
    let q = sb
      .from('provas_online_mensagens')
      .select('*')
      .eq('prova_id', provaId)
      .order('created_at', { ascending: true })

    const { data, error } = await q
    if (!error && Array.isArray(data)) {
      return data
        .filter(r => !tentativaId || !r.tentativa_id || r.tentativa_id === tentativaId)
        .map(r => ({
          id: r.id,
          provaId: r.prova_id,
          tentativaId: r.tentativa_id,
          remetenteId: r.remetente_id,
          remetenteNome: r.remetente_nome,
          remetenteCargo: r.remetente_cargo,
          mensagem: r.mensagem,
          tipo: r.tipo,
          lida: r.lida,
          createdAt: r.created_at
        }))
    }
  } catch {}

  // 2. Fallback
  try {
    const { data } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', `provas_online_mensagens:${provaId}:%`)
      .order('created_at', { ascending: true })

    const list = (data || []).map((r: any) => ({
      ...r.dados,
      id: r.id.split(':').pop(),
      createdAt: r.created_at
    }))

    return list.filter((m: MensagemProva) => !tentativaId || !m.tentativaId || m.tentativaId === tentativaId)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEÇÕES E TEMPO ADICIONAL (EXCEPTIONS & AUDIT LOGS)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbSaveExcecao(excecao: ExcecaoAutorizada): Promise<ExcecaoAutorizada> {
  const sb = getAdminClient()
  const id = excecao.id || crypto.randomUUID()
  const clean: ExcecaoAutorizada = {
    ...excecao,
    id,
    createdAt: excecao.createdAt || new Date().toISOString()
  }

  // 1. Dedicated table
  try {
    const row = {
      id,
      prova_id: clean.provaId,
      aluno_id: clean.alunoId,
      tipo_excecao: clean.tipoExcecao,
      minutos_adicionais: clean.minutosAdicionais || null,
      justificativa: clean.justificativa,
      autorizado_por: clean.autorizadoPor,
      dados: clean.dados || null,
      created_at: clean.createdAt
    }
    const { error } = await sb.from('provas_online_excecoes').insert(row)
    if (!error) return clean
  } catch {}

  // 2. Fallback
  try {
    await sb.from('relatorios_records').insert({
      id: `provas_online_excecoes:${clean.provaId}:${id}`,
      dados: clean
    })
  } catch {}

  return clean
}

export async function dbGetExcecoes(provaId: string): Promise<ExcecaoAutorizada[]> {
  const sb = getAdminClient()

  try {
    const { data, error } = await sb
      .from('provas_online_excecoes')
      .select('*')
      .eq('prova_id', provaId)
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return data.map(r => ({
        id: r.id,
        provaId: r.prova_id,
        alunoId: r.aluno_id,
        tipoExcecao: r.tipo_excecao,
        minutosAdicionais: r.minutos_adicionais,
        justificativa: r.justificativa,
        autorizadoPor: r.autorizado_por,
        dados: r.dados,
        createdAt: r.created_at
      }))
    }
  } catch {}

  try {
    const { data } = await sb
      .from('relatorios_records')
      .select('*')
      .like('id', `provas_online_excecoes:${provaId}:%`)
      .order('created_at', { ascending: false })

    return (data || []).map((r: any) => ({
      ...r.dados,
      id: r.id.split(':').pop(),
      createdAt: r.created_at
    }))
  } catch {
    return []
  }
}
