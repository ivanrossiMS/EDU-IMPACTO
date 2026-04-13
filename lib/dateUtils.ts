/**
 * dateUtils.ts — Utilitários de data que respeitam o fuso horário local do usuário.
 *
 * PROBLEMA: `new Date().toISOString().split('T')[0]` retorna a data em UTC.
 * Para um usuário em UTC-4, às 22h do dia 10 o sistema devolve "2026-04-11" — dia errado!
 *
 * SOLUÇÃO: Sempre usar as propriedades locais do objeto Date (getFullYear, getMonth, getDate)
 * que já respeitam o timezone configurado no dispositivo do usuário.
 */

/**
 * Retorna a data de HOJE no fuso local do usuário, no formato YYYY-MM-DD.
 * Use isto em vez de `new Date().toISOString().split('T')[0]`.
 */
export function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Converte uma string YYYY-MM-DD para um Date fixado em meio-dia local 
 * (evita erros de DST e comparações erradas por causa de horário de verão).
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

/**
 * Retorna o timestamp ISO completo da hora atual no fuso local.
 * Use em vez de `new Date().toISOString()` quando salvar registros de data/hora.
 */
export function agoraLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const absOffset = Math.abs(offset)
  const h = pad(Math.floor(absOffset / 60))
  const m = pad(absOffset % 60)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}${sign}${h}:${m}`
}

/**
 * Calcula a diferença em dias entre duas datas YYYY-MM-DD.
 * Positivo = dataPagto é DEPOIS do vencimento (atrasado).
 * Negativo = dataPagto é ANTES (em dia ou adiantado).
 */
export function diasDeAtraso(vencimento: string, dataPagto?: string): number {
  const alvo = parseLocalDate(dataPagto || hoje())
  const venc = parseLocalDate(vencimento)
  return Math.floor((alvo.getTime() - venc.getTime()) / 86400000)
}

/**
 * Formata uma data YYYY-MM-DD para exibição em DD/MM/YYYY.
 */
export function formatarData(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}
