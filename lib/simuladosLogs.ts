/**
 * Utilitários e tipagem para histórico de movimentações (auditoria) e rastreamento
 * de reabertura para elaboração de Provas e Simulados.
 */

export type TipoAcaoMovimentacao =
  | 'reabrir'
  | 'enviar'
  | 'aprovar'
  | 'devolver'
  | 'publicar'
  | 'criar'
  | 'custom'

export interface MovimentacaoLog {
  id: string
  data_hora: string // Formato ISO 8601
  usuario_id?: string
  usuario_nome: string
  usuario_perfil?: string
  usuario_foto?: string
  acao: TipoAcaoMovimentacao
  titulo_acao: string
  status_anterior?: string
  status_novo?: string
  id_requisicao?: string
  disciplina_nome?: string
  professor_nome?: string
  observacao?: string
}

export interface RequisicaoMeta {
  reaberto?: boolean
  reaberto_em?: string
  reaberto_por_id?: string
  reaberto_por_nome?: string
  reaberto_por_perfil?: string
}

/**
 * Normaliza qualquer valor recebido de config_estudio em um Record puro.
 */
export function parseConfigEstudio(config: any): Record<string, any> {
  if (!config) return {}
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  if (typeof config === 'object' && !Array.isArray(config)) {
    return { ...config }
  }
  return {}
}

/**
 * Gera um ID único e seguro para o registro de log.
 */
export function generateLogId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Cria um objeto padronizado de MovimentacaoLog.
 */
export function createMovimentacaoLog(params: {
  usuario?: { id?: string; nome?: string; perfil?: string; cargo?: string; foto?: string } | null
  acao: TipoAcaoMovimentacao
  titulo_acao?: string
  status_anterior?: string
  status_novo?: string
  id_requisicao?: string
  disciplina_nome?: string
  professor_nome?: string
  observacao?: string
}): MovimentacaoLog {
  const defaultTitulos: Record<TipoAcaoMovimentacao, string> = {
    reabrir: 'Reabertura para Elaboração',
    enviar: 'Envio para Revisão da Coordenação',
    aprovar: 'Aprovação de Conteúdo',
    devolver: 'Devolução para Revisão do Professor',
    publicar: 'Publicação Oficial',
    criar: 'Criação da Avaliação',
    custom: 'Movimentação Registrada'
  }

  const u = params.usuario
  const nomeUsuario = u?.nome?.trim() || 'Usuário'
  const perfilUsuario = u?.perfil?.trim() || u?.cargo?.trim() || 'Colaborador'

  return {
    id: generateLogId(),
    data_hora: new Date().toISOString(),
    usuario_id: u?.id || undefined,
    usuario_nome: nomeUsuario,
    usuario_perfil: perfilUsuario,
    usuario_foto: u?.foto || undefined,
    acao: params.acao,
    titulo_acao: params.titulo_acao || defaultTitulos[params.acao] || 'Atualização de Status',
    status_anterior: params.status_anterior,
    status_novo: params.status_novo,
    id_requisicao: params.id_requisicao,
    disciplina_nome: params.disciplina_nome,
    professor_nome: params.professor_nome,
    observacao: params.observacao
  }
}

/**
 * Adiciona um novo log ao histórico e atualiza metadados de requisição no config_estudio,
 * mantendo o histórico limitado e seguro contra sobrescritas.
 */
export function appendMovimentacaoLog(
  currentConfig: any,
  log: MovimentacaoLog,
  reqMetaUpdate?: {
    reqId: string
    meta: Partial<RequisicaoMeta>
  },
  avaliacaoMetaUpdate?: {
    avaliacao_reaberta?: boolean
    avaliacao_reaberta_em?: string
    avaliacao_reaberta_por?: string
  }
): Record<string, any> {
  const cfg = parseConfigEstudio(currentConfig)
  const existingLogs: MovimentacaoLog[] = Array.isArray(cfg.historico_movimentacoes)
    ? [...cfg.historico_movimentacoes]
    : []

  // Insere o novo log no início da linha do tempo
  const nextLogs = [log, ...existingLogs.filter(l => l && l.id !== log.id)].slice(0, 150)

  const existingMetas: Record<string, RequisicaoMeta> =
    cfg.requisicoes_meta && typeof cfg.requisicoes_meta === 'object' && !Array.isArray(cfg.requisicoes_meta)
      ? { ...cfg.requisicoes_meta }
      : {}

  if (reqMetaUpdate && reqMetaUpdate.reqId) {
    existingMetas[reqMetaUpdate.reqId] = {
      ...(existingMetas[reqMetaUpdate.reqId] || {}),
      ...reqMetaUpdate.meta
    }
  }

  const result: Record<string, any> = {
    ...cfg,
    historico_movimentacoes: nextLogs,
    requisicoes_meta: existingMetas
  }

  if (avaliacaoMetaUpdate) {
    if (avaliacaoMetaUpdate.avaliacao_reaberta !== undefined) {
      result.avaliacao_reaberta = avaliacaoMetaUpdate.avaliacao_reaberta
    }
    if (avaliacaoMetaUpdate.avaliacao_reaberta_em !== undefined) {
      result.avaliacao_reaberta_em = avaliacaoMetaUpdate.avaliacao_reaberta_em
    }
    if (avaliacaoMetaUpdate.avaliacao_reaberta_por !== undefined) {
      result.avaliacao_reaberta_por = avaliacaoMetaUpdate.avaliacao_reaberta_por
    }
  }

  return result
}

/**
 * Verifica se uma requisição (disciplina) específica foi reaberta para elaboração
 * e ainda está aguardando envio (status pendente).
 */
export function isRequisicaoReaberta(req: any, avaliacao: any): boolean {
  if (!req) return false
  const status = req.status || 'pendente'

  // Só é considerada reaberta se seu estado atual é pendente de elaboração
  if (status !== 'pendente') return false

  const cfg = parseConfigEstudio(avaliacao?.config_estudio)
  const meta = cfg.requisicoes_meta?.[req.id]

  if (meta && Boolean(meta.reaberto)) {
    return true
  }

  if (Boolean(cfg.avaliacao_reaberta)) {
    return true
  }

  return false
}

/**
 * Verifica se a prova ou simulado em si está no estado reaberto.
 */
export function isAvaliacaoReaberta(avaliacao: any): boolean {
  if (!avaliacao) return false
  const cfg = parseConfigEstudio(avaliacao.config_estudio)

  if (Boolean(cfg.avaliacao_reaberta) && (avaliacao.status === 'aguardando' || !avaliacao.status)) {
    return true
  }

  const reqs = Array.isArray(avaliacao.provas_upload_requisicoes)
    ? avaliacao.provas_upload_requisicoes
    : Array.isArray(avaliacao.simulados_upload_requisicoes)
      ? avaliacao.simulados_upload_requisicoes
      : []

  if (reqs.length > 0) {
    return reqs.some((r: any) => isRequisicaoReaberta(r, avaliacao))
  }

  return false
}

/**
 * Retorna as iniciais de um nome (ex: "Iris Lima de Souza" => "IS")
 */
export function getTeacherInitials(name?: string): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/).filter(p => !['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase()))
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Formata o nome abreviado (ex: "Iris Lima de Souza" => "Iris L. S.")
 */
export function formatTeacherShortName(name?: string): string {
  if (!name) return 'Não atribuído'
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name

  const firstName = parts[0]
  const lastInitials = parts.slice(1).map(p => {
    const clean = p.replace(/\./g, '').trim()
    if (!clean) return ''
    if (['de', 'da', 'do', 'dos', 'das'].includes(clean.toLowerCase())) return ''
    return clean[0].toUpperCase() + '.'
  }).filter(Boolean)

  if (lastInitials.length === 0) return firstName
  return `${firstName} ${lastInitials.join(' ')}`
}

/**
 * Formata data e horário no padrão brasileiro: "13/11/2026 às 16:04:12"
 */
export function formatDataHoraBR(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—'
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return '—'

  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const seg = String(d.getSeconds()).padStart(2, '0')

  return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`
}

/**
 * Formata tempo decorrido amigável (ex: "há 5 minutos", "há 2 horas", "hoje", "ontem")
 */
export function formatTempoRelativoBR(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ''
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return ''

  const agora = new Date()
  const diffMs = agora.getTime() - d.getTime()
  if (diffMs < 0) return 'agora'

  const seg = Math.floor(diffMs / 1000)
  if (seg < 45) return 'agora mesmo'
  const min = Math.floor(seg / 60)
  if (min < 60) return `há ${min} min atrás`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `há ${horas}h atrás`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  if (meses === 1) return 'há 1 mês'
  return `há ${meses} meses`
}
