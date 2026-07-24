import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
  
  const statuses = reqs.map((r: any) => r.status)
  
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
