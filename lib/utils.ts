import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEFAULT_PROVA_INSTRUCOES = `Atenção às orientações:
• Deve ser realizada exclusivamente a caneta azul ou preta. • Preencha corretamente nome completo. • Não é permitido o uso de corretivo, celular ou outros dispositivos. • Respostas ilegíveis ou com rasuras poderão ser desconsideradas.`

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

/**
 * Converte qualquer representação numérica ou monetária (number, "1234.56", "R$ 1.234,56")
 * em um número de ponto flutuante seguro.
 */
export function parseCurrencyNumeric(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  const s = String(value).trim()
  if (!s) return 0
  if (s.includes(',')) {
    const normalized = s.replace(/[R$\s.]/g, '').replace(',', '.')
    const n = parseFloat(normalized)
    return Number.isFinite(n) ? n : 0
  }
  const clean = s.replace(/[^0-9.-]/g, '')
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : 0
}

/**
 * Formata um valor (number ou string decimal) para exibição em inputs de moeda BRL ("R$ 1.234,56").
 * Se emptyWhenZero=true e o valor for vazio/zero, retorna '' para exibir o placeholder "R$ 0,00".
 */
export function formatCurrencyInput(
  value: string | number | null | undefined,
  emptyWhenZero = false
): string {
  if (emptyWhenZero && (value === '' || value === null || value === undefined)) return ''
  const num = parseCurrencyNumeric(value)
  if (emptyWhenZero && num === 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Processa o evento onChange de um input de moeda (máscara centavos da direita para a esquerda).
 * Retorna string decimal padrão (ex: "1234.56") pronta para armazenar no state ou converter com Number().
 */
export function handleCurrencyInputChange(rawValue: string, emptyWhenZero = false): string {
  const digits = String(rawValue || '').replace(/\D/g, '')
  if (!digits) return emptyWhenZero ? '' : '0'
  const cents = parseInt(digits, 10)
  if (!Number.isFinite(cents) || cents === 0) return emptyWhenZero ? '' : '0'
  return (cents / 100).toFixed(2)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatDate(date: string | Date | null | undefined, style: 'short' | 'long' | 'relative' = 'short'): string {
  if (!date) return '—'
  
  let d: Date
  if (typeof date === 'string') {
    if (date.includes('/')) return date; // Already dd/mm/yyyy
    const ds = (date.length === 10 && date.includes('-')) ? `${date}T12:00:00` : date
    d = new Date(ds)
  } else {
    d = date
  }
  if (style === 'relative') {
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min atrás`
    if (hours < 24) return `${hours}h atrás`
    if (days < 7) return `${days}d atrás`
    return d.toLocaleDateString('pt-BR')
  }
  if (style === 'long') {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  return d.toLocaleDateString('pt-BR')
}

/**
 * Converte qualquer string de data para o formato brasileiro DD/MM/YYYY.
 * Aceita: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss (ISO), DD/MM/YYYY (passthrough).
 * Uso seguro para células de tabela sem risco de erro de timezone.
 */
export function fmtIsoDate(v: string | null | undefined): string {
  if (!v) return '—'
  const s = String(v)
  // Já está em DD/MM/YYYY
  if (s.includes('/')) return s.length >= 10 ? s.slice(0, 10) : s
  // ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm
  const clean = s.length > 10 ? s.slice(0, 10) : s
  const parts = clean.split('-')
  if (parts.length !== 3) return s
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  let d: Date
  if (typeof date === 'string') {
    const ds = (date.length === 10 && date.includes('-')) ? `${date}T12:00:00` : date
    d = new Date(ds)
  } else {
    d = date
  }
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

/**
 * Formata o nome do professor para exibição nos cabeçalhos das provas (Ex: "Ivan R.", "Wennsllen R.").
 * Pega o primeiro nome com o sobrenome abreviado.
 */
export function formatProfessorHeaderName(nome: string): string {
  if (!nome || !nome.trim()) return ''
  if (nome.includes(',')) {
    return nome.split(',').map(n => formatProfessorHeaderName(n)).filter(Boolean).join(', ')
  }

  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''

  const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()

  if (parts.length === 1) return firstName

  const preps = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  let lastPart = parts[parts.length - 1]
  for (let i = parts.length - 1; i >= 1; i--) {
    if (!preps.has(parts[i].toLowerCase())) {
      lastPart = parts[i]
      break
    }
  }

  const lastInitial = lastPart.charAt(0).toUpperCase()
  return `${firstName} ${lastInitial}.`
}

/**
 * Retorna apenas o primeiro e segundo nome de uma pessoa.
 * Preserva preposições entre nomes caso o segundo termo seja preposição (ex: "Juliane de Fátima" ou "João da Silva").
 * Exemplo: "Maria Auxiliadora de Araujo Honorio" -> "Maria Auxiliadora"
 */
export function formatFirstAndSecondName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return ''
  const trimmed = rawName.trim()
  if (!trimmed) return ''

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return trimmed

  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', "d'"])

  if (prepositions.has(parts[1].toLowerCase()) && parts[2]) {
    return `${parts[0]} ${parts[1]} ${parts[2]}`
  }

  return `${parts[0]} ${parts[1]}`
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getRiskColor(risk: 'alto' | 'medio' | 'baixo' | string): string {
  switch (risk) {
    case 'alto': return '#f87171'
    case 'medio': return '#fbbf24'
    case 'baixo': return '#34d399'
    default: return '#6b7280'
  }
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    'ativo': '#34d399', 'active': '#34d399',
    'inativo': '#6b7280', 'inactive': '#6b7280',
    'pendente': '#fbbf24', 'pending': '#fbbf24',
    'pago': '#34d399', 'paid': '#34d399',
    'atrasado': '#f87171', 'overdue': '#f87171',
    'cancelado': '#ef4444', 'cancelled': '#ef4444',
    'transferido': '#60a5fa',
    'matriculado': '#34d399',
  }
  return map[status.toLowerCase()] || '#6b7280'
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const SERIES_LABELS: Record<string, string> = {
  'EI': 'Educação Infantil',
  'EF1': 'Fundamental I',
  'EF2': 'Fundamental II',
  'EM': 'Ensino Médio',
  'EJA': 'EJA',
}

export function formatPhone(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : ''
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)})${digits.slice(2)}`
  }
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function getDerivedStatus(item: any, type: 'prova' | 'simulado' | 'redacao'): string {
  if (!item) return 'aguardando'
  // 1. Status definitivo explícito no item (publicado tem prioridade máxima)
  if (item.status === 'publicado') return 'publicado'
  
  const reqs = type === 'prova' ? item.provas_upload_requisicoes 
             : type === 'simulado' ? item.simulados_upload_requisicoes
             : item.redacao_upload_requisicoes;
             
  if (!reqs || reqs.length === 0) return item.status || 'aguardando'
  
  const allQs = Array.isArray(item.questoes_json) ? item.questoes_json : []

  // 2. Se a prova/simulado em si foi explicitamente aprovada ou concluída
  if (item.status === 'aprovado' || item.status === 'concluido') {
    return 'aprovado'
  }

  // 3. Se a prova/simulado em si foi explicitamente reprovada ou devolvida
  if (item.status === 'reprovado' || item.status === 'rejeitado') {
    return 'reprovado'
  }

  // 4. Se alguma requisição foi expressamente devolvida / rejeitada / reprovada
  const hasReprovada = reqs.some((r: any) => r.status === 'rejeitado' || r.status === 'reprovado')
  if (hasReprovada) {
    return 'reprovado'
  }

  // 5. Verifica se todas as requisições foram concluídas ou aprovadas
  const allApproved = reqs.length > 0 && reqs.every((r: any) => r.status === 'aprovado' || r.status === 'concluido' || r.status === 'publicado')
  if (allApproved) return 'aprovado'

  // 6. Verifica se o item ou alguma requisição foi expressamente enviada para revisão
  // IMPORTANTE: Ter questões cadastradas ou salvas como rascunho (pendente) NÃO coloca em revisão!
  // Apenas a ação explícita de 'Salvar e Enviar para Revisão' (status === 'enviado' ou 'em_revisao')
  const hasEnviada = reqs.some((r: any) => r.status === 'enviado' || r.status === 'em_revisao')
  if (hasEnviada || item.status === 'em_revisao') {
    return 'em_revisao'
  }

  return 'aguardando'
}

/**
 * Determina com precisão e robustez se um item é um texto de apoio.
 * Textos de apoio não são questões reais: não possuem alternativas nem gabarito,
 * não recebem numeração de questão e NÃO devem ser exibidos nem somados como questão nos gabaritos.
 */
export function isTextoApoio(q: any): boolean {
  if (!q) return false
  return Boolean(
    q.tipo_questao === 'texto_apoio' ||
    q.is_texto_apoio ||
    q.isTextoApoio ||
    q.tipo === 'texto_apoio' ||
    q.tipo === 'texto' ||
    q.numero === 0
  )
}

/**
 * Determina com precisão e robustez se uma questão pertence a uma requisição específica.
 * Suporta simulados adaptados/duplicados onde os IDs das requisições mudaram,
 * itens com requisição única, correspondência por professor único, e disciplina.
 */
export function isQuestionForRequisicao(
  q: any,
  req: any,
  allReqs: any[] = [],
  excludeTextoApoio: boolean = false
): boolean {
  if (!q || !req) return false

  // Se solicitado excluir textos de apoio (ex: contagem de questões)
  if (excludeTextoApoio && isTextoApoio(q)) {
    return false
  }

  // 1. Match direto e exato pelo ID da requisição
  if (q.id_requisicao && req.id && q.id_requisicao === req.id) {
    return true
  }

  // 2. Se o simulado/prova possui apenas 1 requisição no total, todas as questões pertencem a ela!
  if (Array.isArray(allReqs) && allReqs.length === 1) {
    if (!req.id || allReqs[0].id === req.id) {
      return true
    }
  }

  // 3. Se q.id_requisicao aponta explicitamente para OUTRA requisição válida deste mesmo item:
  if (
    q.id_requisicao &&
    Array.isArray(allReqs) &&
    allReqs.some((r: any) => r.id === q.id_requisicao && r.id !== req.id)
  ) {
    return false
  }

  const normalizeStr = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  // 4. Correspondência por Disciplina (ID ou Nome normalizado)
  const qDiscId = q.id_disciplina || q.disciplina_id
  const reqDiscId = req.id_disciplina
  const discIdMatch = Boolean(qDiscId && reqDiscId && qDiscId === reqDiscId)

  const qDiscName = normalizeStr(q.disciplina_nome || q.disciplina)
  const reqDiscName = normalizeStr(req.disciplina_nome)

  const discNameMatch = Boolean(
    qDiscName &&
    reqDiscName &&
    (qDiscName === reqDiscName ||
      qDiscName.includes(reqDiscName) ||
      reqDiscName.includes(qDiscName))
  )

  const discMatch = discIdMatch || discNameMatch
  const hasDiscOnQuestion = Boolean(qDiscId || qDiscName)

  // 5. Correspondência por Professor (ID ou Nome normalizado)
  const qProfId = q.id_professor
  const reqProfId = req.id_professor
  const profIdMatch = Boolean(qProfId && reqProfId && qProfId === reqProfId)

  const qProfName = normalizeStr(q.professor_nome)
  const reqProfName = normalizeStr(req.professor_nome)

  const profNameMatch = Boolean(
    qProfName &&
    reqProfName &&
    (qProfName === reqProfName ||
      qProfName.includes(reqProfName) ||
      reqProfName.includes(qProfName))
  )

  const profMatch = profIdMatch || profNameMatch
  const hasProfOnQuestion = Boolean(qProfId || qProfName)

  // Se disciplina e professor batem com precisão
  if (discMatch && profMatch) {
    return true
  }

  // Se a questão possui professor e bate com esta requisição:
  if (profMatch) {
    // Se a questão também possui disciplina explícita que bate com outra requisição deste mesmo simulado:
    if (hasDiscOnQuestion && !discMatch) {
      const matchesAnotherReqDisc = Array.isArray(allReqs) && allReqs.some((r: any) => {
        if (r.id === req.id) return false
        const rDId = r.id_disciplina
        const rDName = normalizeStr(r.disciplina_nome)
        return (qDiscId && rDId && qDiscId === rDId) || (qDiscName && rDName && (qDiscName === rDName || qDiscName.includes(rDName) || rDName.includes(qDiscName)))
      })
      if (matchesAnotherReqDisc) return false
    }

    // Se este professor não possui outra requisição concorrente neste simulado:
    const otherReqsSameProf = Array.isArray(allReqs)
      ? allReqs.filter((r: any) => {
          if (r.id === req.id) return false
          const rPId = r.id_professor
          const rPName = normalizeStr(r.professor_nome)
          return (qProfId && rPId && qProfId === rPId) || (qProfName && rPName && (qProfName === rPName || qProfName.includes(rPName) || rPName.includes(qProfName)))
        })
      : []

    if (otherReqsSameProf.length === 0) {
      return true
    }
  }

  // Se a questão possui disciplina e bate com esta requisição:
  if (discMatch) {
    if (hasProfOnQuestion && !profMatch) {
      const matchesAnotherReqProf = Array.isArray(allReqs) && allReqs.some((r: any) => {
        if (r.id === req.id) return false
        const rPId = r.id_professor
        const rPName = normalizeStr(r.professor_nome)
        return (qProfId && rPId && qProfId === rPId) || (qProfName && rPName && (qProfName === rPName || qProfName.includes(rPName) || rPName.includes(qProfName)))
      })
      if (matchesAnotherReqProf) return false
    }

    const otherReqsSameDisc = Array.isArray(allReqs)
      ? allReqs.filter((r: any) => {
          if (r.id === req.id) return false
          const rDId = r.id_disciplina
          const rDName = normalizeStr(r.disciplina_nome)
          return (reqDiscId && rDId === reqDiscId) || (qDiscName && rDName === qDiscName)
        })
      : []

    if (otherReqsSameDisc.length === 0) {
      return true
    }
  }

  // Se a questão aponta explicitamente para outro professor válido:
  if (qProfId && Array.isArray(allReqs) && allReqs.some((r: any) => r.id !== req.id && r.id_professor === qProfId)) {
    return false
  }

  return false
}

/**
 * Localiza o arquivo original (.docx) associado à requisição ativa,
 * com suporte a requisições únicas e simulados adaptados.
 */
export function isFileForRequisicao(a: any, req: any, allReqs: any[] = []): boolean {
  if (!a || !req) return false
  if (a.id_requisicao && a.id_requisicao === req.id) return true
  if (Array.isArray(allReqs) && allReqs.length === 1) {
    if (!req.id || allReqs[0].id === req.id) return true
  }
  if (
    a.id_requisicao &&
    Array.isArray(allReqs) &&
    allReqs.some((r: any) => r.id === a.id_requisicao && r.id !== req.id)
  ) {
    return false
  }

  const normalizeStr = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  const discMatch =
    (a.id_disciplina && req.id_disciplina && a.id_disciplina === req.id_disciplina) ||
    (normalizeStr(a.disciplina_nome) && normalizeStr(req.disciplina_nome) &&
      normalizeStr(a.disciplina_nome) === normalizeStr(req.disciplina_nome))

  const profMatch = Boolean(
    (!a.id_professor && !a.professor_nome) ||
    (a.id_professor && req.id_professor && a.id_professor === req.id_professor) ||
    (normalizeStr(a.professor_nome) && normalizeStr(req.professor_nome) &&
      normalizeStr(a.professor_nome) === normalizeStr(req.professor_nome))
  )

  if (discMatch && profMatch) return true

  if (a.id_professor && req.id_professor && a.id_professor === req.id_professor) {
    const otherSameProf = Array.isArray(allReqs) && allReqs.some((r: any) => r.id !== req.id && r.id_professor === a.id_professor)
    if (!otherSameProf) return true
  }

  if (discMatch && Array.isArray(allReqs)) {
    const otherSameDisc = allReqs.some((r: any) => r.id !== req.id && ((req.id_disciplina && r.id_disciplina === req.id_disciplina) || normalizeStr(r.disciplina_nome) === normalizeStr(req.disciplina_nome)))
    if (!otherSameDisc) return true
  }

  return false
}

export interface OriginalFileRecord {
  id?: string
  url: string
  nome: string
  tamanho?: number
  path?: string
  id_requisicao?: string | null
  id_disciplina?: string | null
  id_professor?: string | null
  disciplina_nome?: string | null
  professor_nome?: string | null
  uploaded_at?: string
}

function parseConfigEstudioObject(rawConfig: any): Record<string, any> {
  if (!rawConfig) return {}
  if (typeof rawConfig === 'string') {
    try {
      const parsed = JSON.parse(rawConfig)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof rawConfig === 'object' ? rawConfig : {}
}

/**
 * Resolve o arquivo original (.docx) para uma requisição (ou visão geral quando `req` é omitido),
 * usando `arquivos_originais` com fallback seguro para `config_estudio.arquivo_original_url`
 * em avaliações de requisição única ou modo geral.
 */
export function resolveOriginalFileForRequisicao(
  configEstudio: any,
  req?: any,
  allReqs: any[] = []
): OriginalFileRecord | null {
  const cfg = parseConfigEstudioObject(configEstudio)
  const arquivosList: OriginalFileRecord[] = Array.isArray(cfg.arquivos_originais)
    ? cfg.arquivos_originais.filter((a: any) => a && typeof a === 'object' && Boolean(a.url))
    : []

  if (req) {
    const matched = arquivosList.find((a) => isFileForRequisicao(a, req, allReqs))
    if (matched) return matched

    const isSingleReq = !Array.isArray(allReqs) || allReqs.length <= 1
    if (isSingleReq) {
      if (arquivosList.length === 1) return arquivosList[0]
      if (cfg.arquivo_original_url) {
        return {
          url: cfg.arquivo_original_url,
          nome: cfg.arquivo_original_nome || 'arquivo_original.docx',
          tamanho: cfg.arquivo_original_tamanho,
          path: cfg.arquivo_original_path,
          id_requisicao: req.id || null,
          uploaded_at: cfg.arquivo_original_uploaded_at,
        }
      }
    }
    return null
  }

  if (arquivosList.length > 0) return arquivosList[0]
  if (cfg.arquivo_original_url) {
    return {
      url: cfg.arquivo_original_url,
      nome: cfg.arquivo_original_nome || 'arquivo_original.docx',
      tamanho: cfg.arquivo_original_tamanho,
      path: cfg.arquivo_original_path,
      uploaded_at: cfg.arquivo_original_uploaded_at,
    }
  }
  return null
}

/**
 * Insere ou atualiza a referência do arquivo original em `config_estudio.arquivos_originais`
 * e nos campos de fallback `arquivo_original_*`, sem remover arquivos de outras disciplinas.
 */
export function upsertOriginalFileInConfig(
  configEstudio: any,
  entry: OriginalFileRecord
): Record<string, any> {
  const cfg = parseConfigEstudioObject(configEstudio)
  const currentArquivos: OriginalFileRecord[] = Array.isArray(cfg.arquivos_originais)
    ? cfg.arquivos_originais.filter((a: any) => a && typeof a === 'object' && Boolean(a.url))
    : []

  const normalizedEntry: OriginalFileRecord = {
    id: entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: entry.url,
    nome: entry.nome,
    ...(entry.tamanho !== undefined ? { tamanho: entry.tamanho } : {}),
    ...(entry.path ? { path: entry.path } : {}),
    id_requisicao: entry.id_requisicao || null,
    id_disciplina: entry.id_disciplina || null,
    id_professor: entry.id_professor || null,
    uploaded_at: entry.uploaded_at || new Date().toISOString(),
  }

  const nextArquivos = currentArquivos.filter((a) => {
    if (normalizedEntry.id_requisicao && a.id_requisicao === normalizedEntry.id_requisicao) return false
    if (
      !normalizedEntry.id_requisicao &&
      normalizedEntry.id_disciplina &&
      a.id_disciplina === normalizedEntry.id_disciplina &&
      !a.id_requisicao
    ) {
      return false
    }
    if (
      !normalizedEntry.id_requisicao &&
      !normalizedEntry.id_disciplina &&
      normalizedEntry.id_professor &&
      a.id_professor === normalizedEntry.id_professor &&
      !a.id_requisicao &&
      !a.id_disciplina
    ) {
      return false
    }
    if (a.url === normalizedEntry.url) return false
    return true
  })
  nextArquivos.push(normalizedEntry)

  return {
    ...cfg,
    arquivos_originais: nextArquivos,
    arquivo_original_url: normalizedEntry.url,
    arquivo_original_nome: normalizedEntry.nome,
    ...(normalizedEntry.tamanho !== undefined ? { arquivo_original_tamanho: normalizedEntry.tamanho } : {}),
    ...(normalizedEntry.path ? { arquivo_original_path: normalizedEntry.path } : {}),
    arquivo_original_uploaded_at: normalizedEntry.uploaded_at,
  }
}

/**
 * Mescla alterações de layout/configuração em `config_estudio` preservando
 * `arquivos_originais` e campos `arquivo_original_*` persistidos no banco,
 * evitando que auto-saves com estado em memória obsoleto apaguem os DOCX originais.
 */
export function mergeConfigEstudioPreservingOriginalFiles(
  dbConfig: any,
  nextConfig: any
): Record<string, any> {
  const dbObj = parseConfigEstudioObject(dbConfig)
  const nextObj = parseConfigEstudioObject(nextConfig)
  const merged: Record<string, any> = { ...dbObj, ...nextObj }

  const dbFiles: OriginalFileRecord[] = Array.isArray(dbObj.arquivos_originais)
    ? dbObj.arquivos_originais.filter((a: any) => a && typeof a === 'object' && Boolean(a.url))
    : []
  const nextFiles: OriginalFileRecord[] = Array.isArray(nextObj.arquivos_originais)
    ? nextObj.arquivos_originais.filter((a: any) => a && typeof a === 'object' && Boolean(a.url))
    : []

  const getTs = (entry: any) => {
    const ms = Date.parse(entry?.uploaded_at || '')
    return Number.isFinite(ms) ? ms : 0
  }

  const combinedFiles: OriginalFileRecord[] = [...nextFiles]
  for (const dbFile of dbFiles) {
    const existingIdx = combinedFiles.findIndex(
      (f) =>
        f.url === dbFile.url ||
        (dbFile.id_requisicao && f.id_requisicao === dbFile.id_requisicao)
    )
    if (existingIdx === -1) {
      combinedFiles.push(dbFile)
    } else if (getTs(dbFile) > getTs(combinedFiles[existingIdx])) {
      // Se o banco já recebeu um upload mais recente para a mesma requisição, mantém o mais novo
      combinedFiles[existingIdx] = dbFile
    }
  }

  if (combinedFiles.length > 0 || Array.isArray(dbObj.arquivos_originais) || Array.isArray(nextObj.arquivos_originais)) {
    merged.arquivos_originais = combinedFiles
  }

  const dbTopTs = getTs({ uploaded_at: dbObj.arquivo_original_uploaded_at })
  const nextTopTs = getTs({ uploaded_at: nextObj.arquivo_original_uploaded_at })
  const dbTopIsNewer = Boolean(dbObj.arquivo_original_url) && (!nextObj.arquivo_original_url || dbTopTs > nextTopTs)

  if (dbTopIsNewer) {
    merged.arquivo_original_url = dbObj.arquivo_original_url
    if (dbObj.arquivo_original_nome !== undefined) merged.arquivo_original_nome = dbObj.arquivo_original_nome
    if (dbObj.arquivo_original_tamanho !== undefined) merged.arquivo_original_tamanho = dbObj.arquivo_original_tamanho
    if (dbObj.arquivo_original_path !== undefined) merged.arquivo_original_path = dbObj.arquivo_original_path
    if (dbObj.arquivo_original_uploaded_at !== undefined) merged.arquivo_original_uploaded_at = dbObj.arquivo_original_uploaded_at
  }

  return merged
}

/**
 * Persiste `config_estudio` no(s) registro(s) correspondente(s) preservando metadados
 * de arquivos originais já gravados no banco (inclusive em saves concorrentes ou auto-save).
 */
export async function saveStudioConfigPreservingFiles(
  supabaseClient: any,
  ids: string[],
  updatedConfigEstudio: any,
  instrucoes?: any
): Promise<Record<string, any> | null> {
  const tables = ['provas_upload', 'simulados_upload', 'redacao_upload', 'simulados']
  let latestMergedConfig: Record<string, any> | null = null

  for (const targetId of ids) {
    if (!targetId) continue
    for (const table of tables) {
      try {
        const { data: existingRow, error: selectErr } = await supabaseClient
          .from(table)
          .select('config_estudio')
          .eq('id', targetId)
          .maybeSingle()

        if (selectErr || !existingRow) continue

        const mergedConfig = mergeConfigEstudioPreservingOriginalFiles(
          existingRow.config_estudio,
          updatedConfigEstudio
        )
        latestMergedConfig = mergedConfig

        await supabaseClient
          .from(table)
          .update({
            config_estudio: mergedConfig,
            ...(table !== 'redacao_upload' && instrucoes !== undefined ? { instrucoes } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      } catch {
        // Ignora tabelas sem o registro ou colunas opcionais
      }
    }
  }

  return latestMergedConfig
}

/**
 * Valida se a string fornecida representa uma foto de aluno válida (base64 ou URL real).
 * Rejeita strings vazias, base64 vazios ("data:image/jpeg;base64,"), respostas JSON de erro da catraca e avatares SVG mockados.
 */
export function isValidStudentPhoto(foto: string | null | undefined): boolean {
  if (!foto || typeof foto !== 'string') return false
  const trimmed = foto.trim()
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '""') return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('blob:')) {
    return true
  }
  if (trimmed === 'data:image/jpeg;base64,') return false
  if (trimmed.startsWith('data:image/svg+xml')) return false
  // Rejeita JSONs de erro da catraca codificados em base64 (começam com ey... {"... ou e3... {})
  if (trimmed.startsWith('data:image/jpeg;base64,ey') || trimmed.startsWith('data:image/jpeg;base64,e3')) return false
  if (trimmed.startsWith('data:image/png;base64,ey') || trimmed.startsWith('data:image/png;base64,e3')) return false
  if (trimmed.length < 200) return false
  return true
}

export async function downloadOriginalFile(url: string, filename?: string) {
  if (!url) return
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'arquivo_original.docx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
  } catch (err) {
    console.error('Erro no download:', err)
    window.open(url, '_blank')
  }
}

/**
 * Detecta se um texto possui resíduos do marcador [[GABARITO]] ou colchete '[' órfão no final
 * (preservando intervalos matemáticos legítimos como [0, 1[ ou ]0, 1[).
 */
export function hasGabaritoBracketArtifact(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false
  if (/\[\[?GABARITO\]?\]?|\[?GABARITO\]\]/i.test(str)) return true
  const isMathInterval = /[\[\]][^,\[\]]+,[^,\[\]]+\[(?:\s*<\/[a-z0-9]+>\s*)*$/i.test(str)
  if (isMathInterval) return false
  return /\[(\s*(?:<\/[a-z0-9]+>\s*)*)$/i.test(str.trim())
}

/**
 * Remove resíduos de [[GABARITO]] ou colchete '[' órfão no final do texto da alternativa/enunciado.
 */
export function cleanGabaritoBracketArtifact(str?: string | null): string {
  if (!str || typeof str !== 'string') return ''
  let res = str
    .replace(/\[\[GABARITO\]\]/gi, '')
    .replace(/\[\[?GABARITO\]?\]?/gi, '')
    .replace(/\[?GABARITO\]\]/gi, '')

  const isMathInterval = /[\[\]][^,\[\]]+,[^,\[\]]+\[(?:\s*<\/[a-z0-9]+>\s*)*$/i.test(res)
  if (!isMathInterval) {
    res = res.replace(/\[(\s*(?:<\/[a-z0-9]+>\s*)*)$/i, '$1')
  }
  return res.trim()
}

/**
 * Verifica se o usuário atual possui perfil de colaborador/professor (e não gestão/coordenação/admin).
 */
export function isCollaboratorRole(user: any, currentUserPerfil?: string | null): boolean {
  const roleStr = String(currentUserPerfil || user?.perfil || user?.cargo || '').toLowerCase().trim()
  if (!roleStr) return false
  const adminOrCoord = [
    'administrador',
    'administrador master',
    'master',
    'diretor',
    'diretora',
    'direcao',
    'direção',
    'coordenador',
    'coordenadora',
    'coordenacao',
    'coordenação',
    'supervisor',
    'supervisora'
  ]
  if (adminOrCoord.some(r => roleStr.includes(r))) return false
  return (
    roleStr === 'professor' ||
    roleStr === 'colaborador' ||
    roleStr.includes('prof') ||
    roleStr.includes('docente') ||
    roleStr.includes('colaborador')
  )
}

/**
 * Verifica com máxima precisão se uma requisição (disciplina/professor) pertence ao colaborador logado,
 * comparando todos os IDs possíveis (auth id, colaborador_id, system_user_id) e nome normalizado.
 */
export function isUserRequisicaoOwner(user: any, req: any): boolean {
  if (!user || !req) return false
  const userIds = [
    user.id,
    user.colaborador_id,
    user.system_user_id,
    user.professor_id
  ].filter(Boolean).map(id => String(id).trim())

  const reqProfId = req.id_professor ? String(req.id_professor).trim() : ''
  if (reqProfId && userIds.includes(reqProfId)) {
    return true
  }

  const normalizeName = (s?: string | null) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const uName = normalizeName(user.nome)
  const rName = normalizeName(req.professor_nome || req.professores?.nome)
  if (uName && rName && uName === rName) {
    return true
  }
  return false
}

/**
 * Verifica se o simulado/prova/redação foi criado diretamente pelo usuário logado.
 */
export function isUserCreator(user: any, item: any): boolean {
  if (!user || !item) return false
  const userIds = [
    user.id,
    user.colaborador_id,
    user.system_user_id,
    user.professor_id
  ].filter(Boolean).map(id => String(id).trim())

  const creatorId = item.criado_por ? String(item.criado_por).trim() : ''
  if (creatorId && userIds.includes(creatorId)) {
    return true
  }
  return false
}

/**
 * Normaliza questões onde as alternativas possuem tags [IMAGEM N] ou onde as imagens
 * pertencem às alternativas mas ficaram retidas em q.imagens.
 * Também higieniza resíduos de [[GABARITO]] ou '[' órfão no final da alternativa correta.
 */
export function normalizeQuestionImages(q: any): any {
  if (!q) return q

  let enunciadoChanged = false
  let cleanedEnunciado = q.enunciado || ''
  if (hasGabaritoBracketArtifact(cleanedEnunciado)) {
    cleanedEnunciado = cleanGabaritoBracketArtifact(cleanedEnunciado)
    enunciadoChanged = true
  }

  if (!Array.isArray(q.alternativas) || q.alternativas.length === 0) {
    return enunciadoChanged ? { ...q, enunciado: cleanedEnunciado } : q
  }

  const imagens = Array.isArray(q.imagens) ? [...q.imagens] : []
  let changed = enunciadoChanged
  const usedImageIndices = new Set<number>()
  let detectedGabaritoIndex = -1

  const updatedAlternativas = q.alternativas.map((alt: any, idx: number) => {
    let altText = alt.text ?? alt.texto ?? ''
    let altImgUrl = alt.imagem_url

    if (hasGabaritoBracketArtifact(altText)) {
      altText = cleanGabaritoBracketArtifact(altText)
      detectedGabaritoIndex = idx
      changed = true
    }

    const match = altText.match(/\[IMAGEM\s+(\d+)\]/i)
    if (match) {
      const imgNum = parseInt(match[1], 10)
      const imgIdx = imgNum - 1
      if (imgIdx >= 0 && imgIdx < imagens.length) {
        const rawImg = imagens[imgIdx]
        const src = typeof rawImg === 'string' ? rawImg : rawImg?.src
        if (src) {
          const hashIdx = src.indexOf('#')
          const baseSrc = hashIdx >= 0 ? src.substring(0, hashIdx) : src
          const hashStr = hashIdx >= 0 ? src.substring(hashIdx + 1) : ''
          const params = new URLSearchParams(hashStr)
          if (!params.has('w')) params.set('w', '100')
          if (params.get('a') === 'right') params.delete('a')
          const finalHash = params.toString()
          altImgUrl = finalHash ? `${baseSrc}#${finalHash}` : baseSrc

          altText = altText
            .replace(/\[IMAGEM\s+\d+\]/gi, '')
            .replace(/<\/?(?:b|strong|i|em|span|p|div)\b[^>]*>/gi, '')
            .trim()

          usedImageIndices.add(imgIdx)
          changed = true
        }
      }
    }

    return {
      ...alt,
      text: altText,
      ...(alt.texto !== undefined ? { texto: altText } : {}),
      ...(altImgUrl ? { imagem_url: altImgUrl } : {})
    }
  })

  // Se uma alternativa tinha resíduo de [[GABARITO]] / '[' e nenhuma estava marcada como correta ainda, restaura a marcação
  const hasAnyCorrect = updatedAlternativas.some((a: any) => a.correct === true || a.correta === true || a.eh_correta === true)
  if (!hasAnyCorrect && detectedGabaritoIndex >= 0 && updatedAlternativas[detectedGabaritoIndex]) {
    updatedAlternativas[detectedGabaritoIndex] = {
      ...updatedAlternativas[detectedGabaritoIndex],
      correct: true,
      ...(updatedAlternativas[detectedGabaritoIndex].correta !== undefined ? { correta: true } : {})
    }
    changed = true
  }

  // Fallback: se nenhuma alternativa tinha [IMAGEM N], mas todas têm texto vazio,
  // q.imagens tem a mesma quantidade de alternativas e enunciado não referencia imagens
  if (usedImageIndices.size === 0 && imagens.length > 0 && imagens.length === q.alternativas.length) {
    const allAltsEmpty = q.alternativas.every((a: any) => !a.text || !a.text.trim())
    const enunciadoHasImages = cleanedEnunciado.includes('[IMAGEM')
    const altsAlreadyHaveImages = q.alternativas.some((a: any) => a.imagem_url)
    if (allAltsEmpty && !enunciadoHasImages && !altsAlreadyHaveImages) {
      const remappedAlts = q.alternativas.map((alt: any, i: number) => {
        const rawImg = imagens[i]
        const src = typeof rawImg === 'string' ? rawImg : rawImg?.src
        const hashIdx = src.indexOf('#')
        const baseSrc = hashIdx >= 0 ? src.substring(0, hashIdx) : src
        const hashStr = hashIdx >= 0 ? src.substring(hashIdx + 1) : ''
        const params = new URLSearchParams(hashStr)
        if (!params.has('w')) params.set('w', '100')
        if (params.get('a') === 'right') params.delete('a')
        const finalHash = params.toString()
        const finalUrl = finalHash ? `${baseSrc}#${finalHash}` : baseSrc

        return {
          ...alt,
          text: '',
          imagem_url: finalUrl
        }
      })
      return {
        ...q,
        enunciado: cleanedEnunciado,
        imagens: [],
        alternativas: remappedAlts
      }
    }
  }

  if (changed) {
    const oldToNewIndex = new Map<number, number>()
    const newImagens: any[] = []
    imagens.forEach((img, oldIdx) => {
      if (!usedImageIndices.has(oldIdx)) {
        oldToNewIndex.set(oldIdx, newImagens.length)
        newImagens.push(img)
      }
    })

    let newEnunciado = cleanedEnunciado
    if (newImagens.length !== imagens.length) {
      newEnunciado = newEnunciado.replace(/\[IMAGEM\s+(\d+)\]/gi, (match: string, numStr: string) => {
        const oldIdx = parseInt(numStr, 10) - 1
        if (oldToNewIndex.has(oldIdx)) {
          return `[IMAGEM ${oldToNewIndex.get(oldIdx)! + 1}]`
        }
        return match
      })
    }

    const correctLetter = getQuestionCorrectAnswer({ ...q, alternativas: updatedAlternativas })
    const updatedGabarito = correctLetter !== '?' ? correctLetter : q.gabarito

    return {
      ...q,
      enunciado: newEnunciado,
      imagens: newImagens,
      alternativas: updatedAlternativas,
      ...(updatedGabarito ? { gabarito: updatedGabarito } : {})
    }
  }

  return q
}

/**
 * Sincroniza todas as flags de gabarito de uma questão (correct, eh_correta, correta, gabarito)
 * para eliminar inconsistências entre o editor, visualizadores e modais de gabarito.
 */
export function syncQuestionGabarito(q: any): any {
  if (!q || !Array.isArray(q.alternativas) || q.alternativas.length === 0) return q

  const correctLetter = getQuestionCorrectAnswer(q)
  if (!correctLetter || correctLetter === '?') {
    return q
  }

  const updatedAlts = q.alternativas.map((alt: any) => {
    const l = (alt.letter || alt.letra || '').toUpperCase().trim()
    const isMatch = Boolean(l && l === correctLetter)
    return {
      ...alt,
      letter: alt.letter || alt.letra || l,
      letra: alt.letra || alt.letter || l,
      correct: isMatch,
      eh_correta: isMatch,
      correta: isMatch,
      is_correta: isMatch,
      isCorrect: isMatch,
    }
  })

  return {
    ...q,
    alternativas: updatedAlts,
    gabarito: correctLetter
  }
}

export function normalizeQuestoesList(questoes: any[]): any[] {
  if (!Array.isArray(questoes)) return []
  return questoes.map(q => syncQuestionGabarito(normalizeQuestionImages(q)))
}

/**
 * Extrai a letra da alternativa correta com máxima resiliência:
 * 1. Alternativa com correct === true (ou correta/eh_correta === true sem flag correct === false)
 * 2. Campo q.gabarito direto na questão se for letra válida (A-Z)
 * 3. Fallbacks de alternativas (eh_correta, correta, simulados_alternativas, provas_alternativas)
 * 4. Fallbacks adicionais de campos de texto
 */
export function getQuestionCorrectAnswer(q: any): string {
  if (!q) return '?'

  const alts = Array.isArray(q.alternativas) && q.alternativas.length > 0
    ? q.alternativas
    : (Array.isArray(q.simulados_alternativas) && q.simulados_alternativas.length > 0
        ? q.simulados_alternativas
        : (Array.isArray(q.provas_alternativas) && q.provas_alternativas.length > 0 ? q.provas_alternativas : null))

  // 1. Sinal mais forte: alternativa explicitamente marcada com correct === true
  if (alts) {
    const explicitTrue = alts.find((a: any) => a.correct === true || a.correct === 'true')
    if (explicitTrue) {
      const l = explicitTrue.letter || explicitTrue.letra
      if (l && typeof l === 'string' && l.trim()) {
        return l.trim().toUpperCase()
      }
    }
  }

  // 2. Campo gabarito direto na questão (se for letra única A-Z)
  if (q.gabarito && typeof q.gabarito === 'string' && q.gabarito.trim()) {
    const g = q.gabarito.trim().toUpperCase()
    if (/^[A-Z]$/.test(g)) {
      return g
    }
  }

  // 3. Alternativas com eh_correta / correta, ignorando alternativas explicitamente desmarcadas (correct === false)
  if (alts) {
    const fallbackAlt = alts.find((a: any) =>
      (a.eh_correta === true || a.eh_correta === 'true' ||
       a.correta === true || a.correta === 'true' ||
       a.is_correta === true || a.is_correta === 'true' ||
       a.isCorrect === true || a.isCorrect === 'true') &&
      a.correct !== false && a.correct !== 'false'
    )
    if (fallbackAlt) {
      const l = fallbackAlt.letter || fallbackAlt.letra
      if (l && typeof l === 'string' && l.trim()) {
        return l.trim().toUpperCase()
      }
    }

    // Último recurso em alts: qualquer que tenha flag positiva
    const anyTrue = alts.find((a: any) =>
      a.eh_correta === true || a.eh_correta === 'true' ||
      a.correta === true || a.correta === 'true'
    )
    if (anyTrue) {
      const l = anyTrue.letter || anyTrue.letra
      if (l && typeof l === 'string' && l.trim()) {
        return l.trim().toUpperCase()
      }
    }
  }

  // 4. Fallbacks adicionais
  const fallback = q.resposta_correta || q.resposta || q.gabarito_oficial || q.correta
  if (fallback && typeof fallback === 'string' && fallback.trim()) {
    const f = fallback.trim().toUpperCase()
    if (/^[A-Z]$/.test(f)) {
      return f
    }
  }

  return '?'
}

/**
 * Retorna as questões do simulado ordenadas e numeradas com fidelidade absoluta
 * à impressão oficial do simulado (Estúdio de Edição / PaginationEngine):
 * - Ordena requisições conforme config_estudio.ordem_requisicoes ou ordem_disciplinas.
 * - Mapeia as questões por requisição/disciplina via isQuestionForRequisicao.
 * - Inclui eventuais questões órfãs ao final.
 * - Filtra questões marcadas como excluídas (q.excluida ou config_estudio.questoes_excluidas).
 * - Numera sequencialmente 1..N (textos de apoio recebem numero 0).
 */
export function getSimuladoPrintOrderedQuestoes(
  simuladoData: any,
  rawReqs?: any[]
): any[] {
  if (!simuladoData) return []

  const allQuestions = Array.isArray(simuladoData.questoes_json)
    ? normalizeQuestoesList(simuladoData.questoes_json)
    : []

  if (allQuestions.length === 0) return []

  // 1. Coleta e ordena as requisições de acordo com a configuração salva do estúdio
  let reqs = Array.isArray(rawReqs) && rawReqs.length > 0
    ? [...rawReqs]
    : (Array.isArray(simuladoData.simulados_upload_requisicoes) ? [...simuladoData.simulados_upload_requisicoes] : [])

  const configEstudio = simuladoData.config_estudio || {}
  const savedOrder = Array.isArray(configEstudio.ordem_requisicoes) ? configEstudio.ordem_requisicoes : []
  const savedDiscOrder = Array.isArray(configEstudio.ordem_disciplinas) ? configEstudio.ordem_disciplinas : []

  if (savedOrder.length > 0) {
    reqs.sort((a: any, b: any) => {
      const idxA = savedOrder.indexOf(a.id)
      const idxB = savedOrder.indexOf(b.id)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return 0
    })
  } else if (savedDiscOrder.length > 0) {
    reqs.sort((a: any, b: any) => {
      const idxA = savedDiscOrder.indexOf(a.id_disciplina)
      const idxB = savedDiscOrder.indexOf(b.id_disciplina)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return 0
    })
  }

  // 2. Ordena as questões exatamente como o motor de impressão de simulados
  let orderedQuestions: any[] = []
  const matchedItems = new Set<any>()

  if (reqs.length > 0) {
    orderedQuestions = reqs.flatMap((req: any) => {
      const matching = allQuestions.filter((q: any) => isQuestionForRequisicao(q, req, reqs, false))
      const discName = req.disciplina_nome || req.simulados_disciplinas?.nome || ''
      return matching.map((q: any) => {
        matchedItems.add(q)
        return {
          ...q,
          id_requisicao: req.id,
          id_disciplina: req.id_disciplina || q.id_disciplina,
          disciplina_nome: q.disciplina_nome || discName,
          disciplina: q.disciplina || q.disciplina_nome || discName,
          id_professor: req.id_professor || q.id_professor,
          professor_nome: req.professor_nome || q.professor_nome,
        }
      })
    })

    // Adiciona eventuais questões não associadas a nenhuma requisição
    const unassigned = allQuestions.filter((q: any) => !matchedItems.has(q))
    orderedQuestions = [...orderedQuestions, ...unassigned]
  } else {
    orderedQuestions = [...allQuestions]
  }

  // 3. Filtra questões excluídas pelo usuário
  const excludedIds = new Set<string>(
    Array.isArray(configEstudio.questoes_excluidas) ? configEstudio.questoes_excluidas : []
  )

  const activeQuestions = orderedQuestions.filter((q: any) => {
    if (q.excluida === true) return false
    const idKey = q._internalId || q.id
    if (idKey && excludedIds.has(String(idKey))) return false
    return true
  })

  // 4. Numera sequencialmente idêntico ao A4 da impressão
  let numCounter = 1
  return activeQuestions.map((q: any) => {
    const isApoio = isTextoApoio(q)
    return {
      ...q,
      numero: isApoio ? 0 : numCounter++
    }
  })
}

/**
 * Dispara o download de arquivos de mídia (imagens e vídeos) no navegador ou app móvel.
 */
export async function downloadMediaFile(url: string, defaultName: string = 'momento-escolar'): Promise<void> {
  if (!url || typeof window === 'undefined') return
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl

    let filename = defaultName
    try {
      const urlObj = new URL(url, window.location.href)
      const pathname = urlObj.pathname
      const parts = pathname.split('/')
      const lastPart = parts[parts.length - 1]
      if (lastPart && lastPart.includes('.')) {
        filename = decodeURIComponent(lastPart)
      } else {
        const mime = blob.type || ''
        const ext = mime.includes('video') ? 'mp4' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
        filename = `${defaultName}.${ext}`
      }
    } catch {
      filename = defaultName
    }

    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
  } catch {
    // Fallback direto via elemento âncora
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.download = defaultName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

export { validarCPF, formatarCPF } from '@/lib/contracts/sealUtils'

function claimUniqueScopedId(
  baseId: string,
  used: Set<string>,
  scopeTag?: unknown,
  indexHint?: number
): string {
  let candidate = baseId
  if (used.has(candidate) && scopeTag !== undefined && scopeTag !== null && String(scopeTag) !== '') {
    const scoped = `${baseId}__${String(scopeTag)}`
    if (!used.has(scoped)) {
      candidate = scoped
    }
  }
  if (used.has(candidate)) {
    let dupCounter = 1
    const prefix = indexHint !== undefined ? `${baseId}__dup-${indexHint}` : `${baseId}__dup`
    candidate = `${prefix}-${dupCounter}`
    while (used.has(candidate)) {
      dupCounter++
      candidate = `${prefix}-${dupCounter}`
    }
  }
  used.add(candidate)
  return candidate
}

/**
 * Garante identificadores únicos e determinísticos (`_internalId` e `_uid`) para cada questão
 * e alternativa, evitando colisões de chave React quando questões de diferentes disciplinas
 * ou uploads são combinadas no mesmo simulado/prova.
 */
export function ensureUniqueQuestionIds(qs: any[], existing?: any[]): any[] {
  const existingBuckets = new Map<string, any[]>()
  ;(existing || []).forEach((item: any) => {
    const rawKey = item?.id ?? item?._internalId ?? item?.numero
    if (rawKey === undefined || rawKey === null || rawKey === '') return
    const key = String(rawKey)
    const list = existingBuckets.get(key)
    if (list) list.push(item)
    else existingBuckets.set(key, [item])
  })

  const usedQuestionIds = new Set<string>()
  const usedAltIds = new Set<string>()

  return (qs || []).map((q, qIdx) => {
    const rawLookup = q?.id ?? q?._internalId ?? q?.numero
    const bucket = rawLookup !== undefined && rawLookup !== null && rawLookup !== ''
      ? existingBuckets.get(String(rawLookup))
      : undefined
    const prev = bucket && bucket.length > 0 ? bucket.shift() : undefined

    const rawQId = q?._internalId || prev?._internalId || q?.id || `q-${qIdx}-${q?.numero ?? 'x'}`
    const scopeTag = q?.id_requisicao || q?.id_disciplina || q?.disciplina_id
    const qInternalId = claimUniqueScopedId(String(rawQId), usedQuestionIds, scopeTag, qIdx)

    return {
      ...q,
      _internalId: qInternalId,
      alternativas: (q?.alternativas || []).map((alt: any, aIdx: number) => {
        const prevAlt = prev?.alternativas?.[aIdx]
        const rawAltId =
          alt?._uid ||
          prevAlt?._uid ||
          alt?.id ||
          `alt-${qInternalId}-${aIdx}-${alt?.letter || alt?.letra || ''}`
        const altUid = claimUniqueScopedId(
          String(rawAltId),
          usedAltIds,
          `${qInternalId}-${aIdx}`,
          aIdx
        )
        return {
          ...alt,
          _uid: altUid,
        }
      }),
    }
  })
}

/**
 * Faz a correspondência de uma questão pelo `_internalId` único quando disponível,
 * recorrendo a `id`/`numero` apenas para itens sem `_internalId`.
 */
export function matchQuestionById(q: any, qId: string): boolean {
  if (!q) return false
  if (q._internalId !== undefined && q._internalId !== null && q._internalId !== '') {
    return String(q._internalId) === String(qId)
  }
  return (
    (q.id !== undefined && q.id !== null && q.id !== '' && String(q.id) === String(qId)) ||
    (q.numero !== undefined && (String(q.numero) === String(qId) || `q-${q.numero}` === String(qId)))
  )
}

/**
 * Retorna true caso alguma questão ou alternativa não possua identificador único válido
 * (ex.: estado em memória preservado antes da deduplicação via Fast Refresh).
 */
export function hasDuplicateQuestionIds(qs: any[]): boolean {
  const seenQIds = new Set<string>()
  const seenAltIds = new Set<string>()
  for (const q of qs || []) {
    const qId = q?._internalId
    if (!qId || typeof qId !== 'string' || seenQIds.has(qId)) return true
    seenQIds.add(qId)
    for (const alt of q?.alternativas || []) {
      const aId = alt?._uid
      if (!aId || typeof aId !== 'string' || seenAltIds.has(aId)) return true
      seenAltIds.add(aId)
    }
  }
  return false
}

export interface QuestionMeasureMeta {
  qKey: string
  altKeys: string[]
}

/**
 * Gera chaves únicas por índice para o DOM de medição do PaginationEngine
 * sem mutar `q.id` nem `a.id` entregues aos callbacks de edição.
 */
export function buildQuestionMeasureMeta(questoes: any[]): QuestionMeasureMeta[] {
  const usedQIds = new Set<string>()
  return (questoes || []).map((q: any, idx: number) => {
    const rawQId =
      q?.id !== undefined && q?.id !== null && q?.id !== ''
        ? String(q.id)
        : q?._internalId !== undefined && q?._internalId !== null && q?._internalId !== ''
          ? String(q._internalId)
          : `q-idx-${idx}`

    let qKey = rawQId
    if (usedQIds.has(qKey)) {
      let suffix = 0
      do {
        qKey = suffix === 0 ? `${rawQId}__idx-${idx}` : `${rawQId}__idx-${idx}-${suffix}`
        suffix++
      } while (usedQIds.has(qKey))
    }
    usedQIds.add(qKey)

    const usedAltIds = new Set<string>()
    const altKeys = (q?.simulados_alternativas || []).map((a: any, aIdx: number) => {
      const rawAltId =
        a?.id !== undefined && a?.id !== null && a?.id !== ''
          ? String(a.id)
          : a?._uid !== undefined && a?._uid !== null && a?._uid !== ''
            ? String(a._uid)
            : `alt-idx-${aIdx}`

      let altKey = rawAltId
      if (usedAltIds.has(altKey)) {
        let suffix = 0
        do {
          altKey = suffix === 0 ? `${rawAltId}__idx-${aIdx}` : `${rawAltId}__idx-${aIdx}-${suffix}`
          suffix++
        } while (usedAltIds.has(altKey))
      }
      usedAltIds.add(altKey)
      return altKey
    })

    return { qKey, altKeys }
  })
}
