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

export function isQuestionForRequisicao(
  q: any,
  req: any,
  allReqs: any[] = []
): boolean {
  if (!req) return true
  if (!q) return false

  const currentReqIds = new Set(allReqs.map((r: any) => r?.id).filter(Boolean))

  // 1. Correspondência direta por id_requisicao quando pertence a este exame
  if (q.id_requisicao && currentReqIds.has(q.id_requisicao)) {
    return q.id_requisicao === req.id
  }

  // 2. Se o exame possui apenas 1 requisição, todas as questões pertencem a ela
  if (allReqs.length <= 1) {
    return true
  }

  const normalize = (s: any) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  const reqDiscNome = normalize(req.disciplina_nome)
  const qDiscNome = normalize(q.disciplina_nome || q.disciplina)
  const reqDiscId = req.id_disciplina ? String(req.id_disciplina).trim() : ''
  const qDiscId = (q.id_disciplina || q.disciplina_id) ? String(q.id_disciplina || q.disciplina_id).trim() : ''

  const discMatches =
    (reqDiscId && qDiscId && reqDiscId === qDiscId) ||
    (reqDiscNome && qDiscNome && reqDiscNome === qDiscNome)

  const reqProfNome = normalize(req.professor_nome)
  const qProfNome = normalize(q.professor_nome)
  const reqProfId = req.id_professor ? String(req.id_professor).trim() : ''
  const qProfId = q.id_professor ? String(q.id_professor).trim() : ''

  const profMatches =
    !qProfId && !qProfNome
      ? true
      : (reqProfId && qProfId && reqProfId === qProfId) ||
        (reqProfNome && qProfNome && reqProfNome === qProfNome)

  // Se disciplina e professor batem
  if (discMatches && profMatches) {
    return true
  }

  // Se disciplina bate e não há múltiplas requisições da mesma disciplina
  if (discMatches) {
    const reqsWithSameDisc = allReqs.filter(r =>
      (reqDiscId && r.id_disciplina === reqDiscId) ||
      (reqDiscNome && normalize(r.disciplina_nome) === reqDiscNome)
    )
    if (reqsWithSameDisc.length <= 1) {
      return true
    }
  }

  // Fallback: se a questão não tem disciplina definida, mas o professor bate
  if (!qDiscId && !qDiscNome && profMatches) {
    return true
  }

  return false
}

export function isQuestionCountableForRequisicao(
  q: any,
  req: any,
  allReqs: any[] = []
): boolean {
  if (!q) return false
  if (q.tipo_questao === 'texto_apoio' || q.is_texto_apoio || q.isTextoApoio) return false
  return isQuestionForRequisicao(q, req, allReqs)
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

  const statuses = reqs.map((r: any) => {
    // Se há questões cadastradas para esta requisição, não deve ficar como pendente
    const hasQs = allQs.some((q: any) => isQuestionCountableForRequisicao(q, r, reqs))
    if (r.status === 'pendente' && hasQs) {
      return 'enviado'
    }
    return r.status
  })
  
  // Se existe algum professor que ainda está pendente ou teve upload rejeitado,
  // ou se a requisição acabou de ser criada, no geral o painel fica "Aguardando"
  if (statuses.some((s: string) => s === 'pendente' || s === 'rejeitado')) {
    return 'aguardando'
  }
  
  // Se TODOS os professores já enviaram e o coordenador aprovou TODOS, então a prova está aprovada
  if (statuses.every((s: string) => s === 'aprovado' || s === 'publicado')) {
    return 'aprovado'
  }
  
  // Se todos enviaram mas ainda não foram todos aprovados, então está em revisão
  return 'em_revisao'
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


