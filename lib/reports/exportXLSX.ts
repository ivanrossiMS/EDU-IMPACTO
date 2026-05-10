// ═══════════════════════════════════════════════════════════
// EXPORTAÇÃO XLSX — Gera planilha Excel via lib xlsx
// ═══════════════════════════════════════════════════════════

import * as XLSX from 'xlsx'
import { ColumnDef } from './reportDefinitions'

interface ExportXLSXOptions {
  title: string
  data: Record<string, unknown>[]
  columns: ColumnDef[]
  filters?: Record<string, string>
  userName: string
  totals?: Record<string, number>
}

function fmtVal(value: unknown, col: ColumnDef): string | number {
  if ((col.type as string) === 'signature') return ''
  if (value === null || value === undefined || value === '') return ''
  if (col.type === 'currency' || col.type === 'number' || col.type === 'percent') return Number(value) || 0
  if (col.type === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

export function exportXLSX(opts: ExportXLSXOptions): void {
  const { title, data, columns, filters, userName, totals } = opts
  const now = new Date().toLocaleString('pt-BR')

  // Header info row
  const infoRows: (string | number)[][] = [
    [title],
    [`Gerado em: ${now} | Usuário: ${userName}`],
  ]
  if (filters) {
    const filterText = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')
    if (filterText) infoRows.push([`Filtros: ${filterText}`])
  }
  infoRows.push([]) // blank row

  // Column headers
  const headers = columns.map(c => c.label)
  infoRows.push(headers)

  // Data rows
  const dataRows = data.map((row, i) => columns.map(c => {
    if (c.key === '_indice') return i + 1
    return fmtVal(row[c.key], c)
  }))

  // Totals row
  if (totals) {
    const totalRow = columns.map(c => {
      const t = totals[c.key]
      if (t !== undefined) return t
      if (c === columns[0]) return 'TOTAL'
      return ''
    })
    dataRows.push(totalRow)
  }

  const allRows = [...infoRows, ...dataRows]

  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // Column widths
  ws['!cols'] = columns.map(c => ({ wch: Math.max(c.label.length + 4, c.width ? Math.floor(c.width / 7) : 15) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')

  const filename = `${title.replace(/[^a-zA-Z0-9áàãâéêíóôúçÁÀÃÂÉÊÍÓÔÚÇ ]/g, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}
