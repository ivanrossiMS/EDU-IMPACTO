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
