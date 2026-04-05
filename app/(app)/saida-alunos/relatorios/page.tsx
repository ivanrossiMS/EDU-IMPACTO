'use client'
import { useState, useMemo } from 'react'
import { SaidaProvider, useSaida, PickupCall } from '@/lib/saidaContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { Download, FileText, Filter, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'

function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando', called: 'Chamado', confirmed: 'Confirmado',
  cancelled: 'Cancelado', recalled: 'Rechamado',
}

function RelatoriosContent() {
  const { activeCalls, logs } = useSaida()
  const isMobile = useIsMobile()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [searchStudent, setSearchStudent] = useState('')
  const [searchGuardian, setSearchGuardian] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    return activeCalls.filter(c => {
      if (dateFrom && new Date(c.calledAt) < new Date(dateFrom)) return false
      if (dateTo   && new Date(c.calledAt) > new Date(dateTo + 'T23:59:59')) return false
      if (searchStudent && !c.studentName.toLowerCase().includes(searchStudent.toLowerCase())) return false
      if (searchGuardian && !c.guardianName.toLowerCase().includes(searchGuardian.toLowerCase())) return false
      if (statusFilter && c.status !== statusFilter) return false
      return true
    }).sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime())
  }, [activeCalls, dateFrom, dateTo, searchStudent, searchGuardian, statusFilter])

  const exportExcel = () => {
    const rows = filtered.map(c => ({
      'Aluno':        c.studentName,
      'Turma':        c.studentClass,
      'Responsável':  c.guardianName,
      'Origem':       c.source === 'rfid' ? 'RFID' : 'Manual',
      'RFID':         c.rfidCode ?? '—',
      'Chamado em':   fmtDate(c.calledAt),
      'Confirmado em':fmtDate(c.confirmedAt),
      'Status':       STATUS_LABEL[c.status] ?? c.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Saída de Alunos')
    XLSX.writeFile(wb, `relatorio-saida-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const exportCSV = () => {
    const header = 'Aluno,Turma,Responsável,Chamado em,Confirmado em,Status\n'
    const rows = filtered.map(c =>
      `"${c.studentName}","${c.studentClass}","${c.guardianName}","${fmtDate(c.calledAt)}","${fmtDate(c.confirmedAt)}","${STATUS_LABEL[c.status] ?? c.status}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'relatorio-saida.csv'; a.click()
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 20 : 26, margin: '0 0 4px' }}>
          📊 Relatórios de Saída
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
          {filtered.length} registros encontrados
        </p>
      </div>

      {/* Filters */}
      <div style={{
        background: 'hsl(var(--bg-elevated))', borderRadius: 16,
        border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Filter size={15} color="#818cf8"/>
          <span style={{ fontWeight: 800, fontSize: 13 }}>Filtros</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {/* Date from */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>DE</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Date to */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>ATÉ</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Student */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>ALUNO</label>
            <input value={searchStudent} onChange={e => setSearchStudent(e.target.value)} placeholder="Nome..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Guardian */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>RESPONSÁVEL</label>
            <input value={searchGuardian} onChange={e => setSearchGuardian(e.target.value)} placeholder="Nome..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Status */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>STATUS</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}>
              <option value="">Todos</option>
              <option value="waiting">Aguardando</option>
              <option value="confirmed">Confirmado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexDirection: isMobile ? 'column' : 'row', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
        <button onClick={exportCSV}
          style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <FileText size={13}/> Exportar CSV
        </button>
        <button onClick={exportExcel}
          style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10b981', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Download size={13}/> Exportar Excel
        </button>
      </div>

      {/* Table — desktop | Cards — mobile */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum registro encontrado
            </div>
          ) : filtered.map(c => {
            const statusColor = ({ confirmed: '#10b981', cancelled: '#ef4444', waiting: '#f59e0b', called: '#f59e0b', recalled: '#f59e0b' } as Record<string,string>)[c.status] ?? '#64748b'
            return (
              <div key={c.id} style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 14, padding: '14px 16px', borderLeft: `4px solid ${statusColor}` }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{c.studentName}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>{c.studentClass} · {c.guardianName}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: `${statusColor}10`, color: statusColor, border: `1px solid ${statusColor}25`, fontWeight: 700 }}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: c.source === 'rfid' ? 'rgba(6,182,212,0.1)' : 'rgba(167,139,250,0.1)', color: c.source === 'rfid' ? '#06b6d4' : '#a78bfa', fontWeight: 700 }}>
                    {c.source === 'rfid' ? '📡 RFID' : '🖱 Manual'}
                  </span>
                  <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', padding: '2px 0' }}>{fmtTime(c.calledAt)}</span>
                  {c.confirmedAt && <span style={{ fontSize: 10, color: '#10b981', padding: '2px 0' }}>→ {fmtTime(c.confirmedAt)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                {['Aluno','Turma','Responsável','Origem','Chamado em','Confirmado em','Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: 'hsl(var(--text-muted))', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  Nenhum registro encontrado
                </td></tr>
              ) : filtered.map((c, i) => {
                const statusColor = ({ confirmed: '#10b981', cancelled: '#ef4444', waiting: '#f59e0b', called: '#f59e0b', recalled: '#f59e0b' } as Record<string,string>)[c.status] ?? '#64748b'
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--bg-overlay))' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.studentName}</td>
                    <td style={{ padding: '10px 14px', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{c.studentClass}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{c.guardianName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: c.source === 'rfid' ? 'rgba(6,182,212,0.1)' : 'rgba(167,139,250,0.1)', color: c.source === 'rfid' ? '#06b6d4' : '#a78bfa', fontWeight: 700 }}>
                        {c.source === 'rfid' ? '📡 RFID' : '🖱 Manual'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'hsl(var(--text-muted))', fontFamily: 'monospace', fontSize: 11 }}>{fmtTime(c.calledAt)}</td>
                    <td style={{ padding: '10px 14px', color: '#10b981', fontFamily: 'monospace', fontSize: 11 }}>{fmtTime(c.confirmedAt)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 700, background: `${statusColor}10`, color: statusColor, border: `1px solid ${statusColor}25` }}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* System Logs */}
      <div style={{ marginTop: 36 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>🗒️ Log do Sistema (últimos 20)</div>
        <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.slice(0, 20).map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 14, fontSize: 11, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-muted))', flexShrink: 0, fontSize: 10 }}>
                {new Date(l.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{
                padding: '1px 7px', borderRadius: 5, fontSize: 9, fontWeight: 800, flexShrink: 0,
                background: l.type.includes('CONFIRM') ? 'rgba(16,185,129,0.1)' : l.type.includes('CANCEL') ? 'rgba(239,68,68,0.08)' : 'rgba(129,140,248,0.1)',
                color: l.type.includes('CONFIRM') ? '#10b981' : l.type.includes('CANCEL') ? '#ef4444' : '#818cf8',
              }}>{l.type}</span>
              <span style={{ color: 'hsl(var(--text-muted))' }}>{l.description}</span>
            </div>
          ))}
          {logs.length === 0 && <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '16px 0' }}>Sem logs ainda</div>}
        </div>
      </div>
    </div>
  )
}

export default function RelatoriosPage() {
  return (
    <SaidaProvider>
      <RelatoriosContent />
    </SaidaProvider>
  )
}
