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
  // Se já foi publicado, esse status prevalece (pode ser forçado pelo coordenador)
  if (item.status === 'publicado') return 'publicado'
  
  const reqs = type === 'prova' ? item.provas_upload_requisicoes 
             : type === 'simulado' ? item.simulados_upload_requisicoes
             : item.redacao_upload_requisicoes;
             
  if (!reqs || reqs.length === 0) return item.status || 'aguardando'
  
  const allQs = Array.isArray(item.questoes_json) ? item.questoes_json : []

  // Verifica se todas as requisições foram concluídas ou aprovadas
  const allApproved = reqs.every((r: any) => r.status === 'aprovado' || r.status === 'concluido' || r.status === 'publicado')
  if (allApproved) return 'aprovado'

  // Verifica se alguma requisição foi expressamente rejeitada
  if (reqs.some((r: any) => r.status === 'rejeitado' || r.status === 'reprovado')) {
    return 'aguardando'
  }

  // Verifica se cada requisição está enviada ou possui questões cadastradas
  const isReqDoneOrUploaded = (r: any) => {
    if (r.status === 'enviado' || r.status === 'em_revisao' || r.status === 'aprovado' || r.status === 'concluido' || !!r.enviado_em) {
      return true
    }
    if (allQs.length > 0 && allQs.some((q: any) => isQuestionForRequisicao(q, r, reqs, true))) {
      return true
    }
    return false
  }

  // Se todas as requisições já enviaram ou possuem questões
  if (reqs.every(isReqDoneOrUploaded)) {
    return 'em_revisao'
  }

  // Se pelo menos uma enviou ou tem questões
  if (reqs.some(isReqDoneOrUploaded)) {
    return 'em_revisao'
  }

  return 'aguardando'
}

/**
 * Determina com precisão e robustez se uma questão pertence a uma requisição específica.
 * Suporta simulados adaptados/duplicados onde os IDs das requisições mudaram,
 * itens com requisição única, e correspondência por disciplina e professor.
 */
export function isQuestionForRequisicao(
  q: any,
  req: any,
  allReqs: any[] = [],
  excludeTextoApoio: boolean = false
): boolean {
  if (!q || !req) return false

  // Se solicitado excluir textos de apoio (ex: contagem de questões)
  if (excludeTextoApoio) {
    if (q.tipo_questao === 'texto_apoio' || q.is_texto_apoio || q.isTextoApoio) {
      return false
    }
  }

  // 1. Match direto e exato pelo ID da requisição
  if (q.id_requisicao && q.id_requisicao === req.id) {
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

  // 5. Correspondência por Professor (ID ou Nome normalizado)
  const qProfId = q.id_professor
  const reqProfId = req.id_professor
  const profIdMatch = !qProfId || !reqProfId || qProfId === reqProfId

  const qProfName = normalizeStr(q.professor_nome)
  const reqProfName = normalizeStr(req.professor_nome)

  const profNameMatch =
    !qProfName ||
    !reqProfName ||
    qProfName === reqProfName ||
    qProfName.includes(reqProfName) ||
    reqProfName.includes(qProfName)

  const profMatch = profIdMatch || profNameMatch

  // Se disciplina e professor batem
  if (discMatch && profMatch) {
    return true
  }

  // Se apenas a disciplina bate e não há outra requisição concorrente para esta disciplina
  if (discMatch && Array.isArray(allReqs)) {
    const otherReqsSameDisc = allReqs.filter((r: any) => {
      if (r.id === req.id) return false
      const rName = normalizeStr(r.disciplina_nome)
      return (reqDiscId && r.id_disciplina === reqDiscId) || (qDiscName && rName === qDiscName)
    })
    if (otherReqsSameDisc.length === 0) {
      return true
    }
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

  const profMatch = !a.id_professor || !req.id_professor || a.id_professor === req.id_professor
  return Boolean(discMatch && profMatch)
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



