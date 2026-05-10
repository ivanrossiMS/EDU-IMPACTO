// ═══════════════════════════════════════════════════════════
// EXPORTAÇÃO PDF — Gera HTML formatado para impressão
// ═══════════════════════════════════════════════════════════

import { ColumnDef } from './reportDefinitions'

interface ExportPDFOptions {
  title: string
  subtitle?: string
  data: Record<string, unknown>[]
  columns: ColumnDef[]
  filters?: Record<string, string>
  nomeEscola: string
  cnpj?: string
  logo?: string | null
  userName: string
  totals?: Record<string, number>
  orientation?: 'portrait' | 'landscape'
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtCell(value: unknown, col: ColumnDef): string {
  if (col.type === 'signature') return `<div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-top: 6px; width: 100%; min-width: 180px;"></div>`
  
  if (value === null || value === undefined || value === '') return '—'
  if (col.type === 'currency') return `R$ ${fmt(Number(value) || 0)}`
  if (col.type === 'percent') return `${Number(value || 0).toFixed(1)}%`
  if (col.type === 'number') return String(value)
  if (col.type === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

export function exportPDF(opts: ExportPDFOptions): void {
  const { title, subtitle, data, columns, filters, nomeEscola, cnpj, logo, userName, totals, orientation = 'landscape' } = opts
  const now = new Date().toLocaleString('pt-BR')
  const filterText = filters
    ? Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join(' &nbsp;|&nbsp; ')
    : ''

  const headerRow = columns.map(c => `<th style="padding:12px 14px;text-align:${c.align || 'left'};font-size:13px;font-weight:800;color:#1e293b;background-color:#f1f5f9;border-bottom:2px solid #3b82f6;white-space:nowrap;">${c.label}</th>`).join('')

  const bodyRows = data.map((row, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc'
    const cells = columns.map(c => {
      let val = row[c.key]
      if (c.key === '_indice') val = i + 1
      return `<td style="padding:10px 14px;font-size:12px;text-align:${c.align || 'left'};color:#475569;border-bottom:1px solid #e2e8f0;vertical-align:middle;">${fmtCell(val, c)}</td>`
    }).join('')
    return `<tr style="background:${bg}; page-break-inside: avoid;">${cells}</tr>`
  }).join('')

  const totalRow = totals
    ? `<tr style="background:#eff6ff;font-weight:800; page-break-inside: avoid;">${columns.map(c => {
        const t = totals[c.key]
        return `<td style="padding:12px 14px;font-size:12px;text-align:${c.align || 'left'};border-top:2px solid #3b82f6;color:#1e293b;">${t !== undefined ? (c.type === 'currency' ? `R$ ${fmt(t)}` : c.type === 'percent' ? `${t.toFixed(1)}%` : String(t)) : ''}</td>`
      }).join('')}</tr>`
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  @page { size: A4 ${orientation}; margin: 12mm 15mm; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #0f172a; background: #fff; }
  .header { display: flex; align-items: center; gap: 20px; padding-bottom: 16px; border-bottom: 3px solid #3b82f6; margin-bottom: 16px; }
  .logo { width: 64px; height: 64px; object-fit: contain; }
  .meta { font-size: 11px; color: #64748b; margin-top: 6px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  th:first-child { border-top-left-radius: 8px; }
  th:last-child { border-top-right-radius: 8px; }
  .filters { font-size: 12px; color: #475569; margin-bottom: 16px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6; }
  .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 16px; page-break-inside: avoid; }
  .count-badge { display: inline-block; margin-top: 16px; font-size: 12px; font-weight: 700; color: #1d4ed8; background: #eff6ff; padding: 8px 16px; border-radius: 20px; border: 1px solid #bfdbfe; float: right; page-break-inside: avoid; }
</style></head><body>
<div class="header">
  ${logo ? `<img src="${logo}" class="logo" />` : ''}
  <div>
    <div style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">${nomeEscola}</div>
    ${cnpj ? `<div style="font-size:11px;color:#64748b;font-weight:600;margin-top:2px;">CNPJ: ${cnpj}</div>` : ''}
  </div>
  <div style="margin-left:auto;text-align:right;">
    <div style="font-size:20px;font-weight:800;color:#3b82f6;letter-spacing:-0.5px;">${title}</div>
    ${subtitle ? `<div style="font-size:12px;color:#475569;font-weight:600;margin-top:4px;">${subtitle}</div>` : ''}
    <div class="meta">Gerado em <strong>${now}</strong> por <strong>${userName}</strong></div>
  </div>
</div>
${filterText ? `<div class="filters">Filtros Ativos: <span style="margin-left:6px;font-weight:400;">${filterText}</span></div>` : ''}
<table>
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${bodyRows}${totalRow}</tbody>
</table>
<div class="count-badge">${data.length} registro(s) listado(s)</div>
<div style="clear: both;"></div>
<div class="footer">
  <span><strong>${nomeEscola}</strong> — Sistema de Relatórios Ultra Premium</span>
  <span>Página gerada em ${now}</span>
</div>
</body></html>`

  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) { alert('Permita popups para exportar o PDF.'); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 600)
}
