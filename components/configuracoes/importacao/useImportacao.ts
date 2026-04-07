'use client'
import { useState, useCallback } from 'react'

export interface ImportLog {
  id: string
  dataHora: string
  modulo: string
  arquivo: string
  total: number
  inseridos: number
  atualizados: number
  erros: number
  ignorados: number
  status: 'sucesso' | 'parcial' | 'erro'
  usuario: string
  snapshot?: string // key do localStorage para rollback
}

export interface ParsedRow {
  [key: string]: string
}

export interface ValidationResult {
  linha: number
  valida: boolean
  dados: ParsedRow
  erros: string[]
  avisos: string[]
}

export function useImportLog() {
  const KEY = 'edu-import-logs'
  const [logs, setLogs] = useState<ImportLog[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  const addLog = useCallback((log: ImportLog) => {
    setLogs(prev => {
      const next = [log, ...prev].slice(0, 100)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { logs, addLog }
}

/** Parse CSV text → array of row objects */
export function parseCsv(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(/[,;|\t]/).map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(/[,;|\t]/).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: ParsedRow = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

/** Read XLSX file → array of row objects (uses SheetJS loaded dynamically) */
export async function parseXlsx(file: File): Promise<ParsedRow[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: '' })
}

/** Auto-map spreadsheet headers to system fields */
export function autoMap(headers: string[], systemFields: { key: string; aliases: string[] }[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  headers.forEach(h => {
    const norm = h.toLowerCase().replace(/[_\s-]/g, '')
    for (const f of systemFields) {
      const match = f.aliases.some(a => norm.includes(a.toLowerCase().replace(/[_\s-]/g, '')))
      if (match) { mapping[h] = f.key; break }
    }
  })
  return mapping
}

/** Download a string as a file */
export function downloadText(content: string, filename: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/** Download as XLSX using SheetJS */
export async function downloadXlsxTemplate(fields: string[], filename: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([fields])
  XLSX.utils.book_append_sheet(wb, ws, "Modelo")
  XLSX.writeFile(wb, filename)
}

/** Generate CSV model string from field definitions */
export function buildModel(fields: string[]): string {
  return fields.join(';') + '\n'
}

/** Snapshot current localStorage key for rollback */
export function snapshot(lsKey: string): string {
  const snapKey = `edu-snap-${lsKey}-${Date.now()}`
  const current = localStorage.getItem(lsKey) || '[]'
  localStorage.setItem(snapKey, current)
  return snapKey
}

/** Rollback using a snapshot key */
export function rollback(lsKey: string, snapKey: string): boolean {
  const data = localStorage.getItem(snapKey)
  if (!data) return false
  localStorage.setItem(lsKey, data)
  return true
}

export function normalizeDate(v: string): string {
  if (!v) return ''
  const dd = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dd) return `${dd[3]}-${dd[2]}-${dd[1]}`
  return v
}

export function normalizeMoney(v: string): number {
  if (!v) return 0
  return parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

export function validateCPF(cpf: string): boolean {
  if (!cpf) return true
  const n = cpf.replace(/\D/g, '')
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false
  let d1 = 0, d2 = 0
  for (let i = 0; i < 9; i++) d1 += +n[i] * (10 - i)
  d1 = ((d1 * 10) % 11) % 10
  for (let i = 0; i < 10; i++) d2 += +n[i] * (11 - i)
  d2 = ((d2 * 10) % 11) % 10
  return d1 === +n[9] && d2 === +n[10]
}
