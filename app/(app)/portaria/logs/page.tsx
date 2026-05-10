'use client'

import { useState, useMemo } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  FileText, Search, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, Activity, Scan, Eye, X, Code
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function PortariaLogsPage() {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroData, setFiltroData] = useState(new Date().toISOString().slice(0, 10))
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null)

  const { data: eventosRes, isLoading } = useApiQuery<{ data: any[] }>(
    ['portaria-logs', filtroData, filtroStatus],
    '/api/portaria/eventos',
    {
      data_inicio: `${filtroData}T00:00:00`,
      data_fim: `${filtroData}T23:59:59`,
      limit: '1000',
      ...(filtroStatus !== 'Todos' ? { status: filtroStatus } : {}),
    },
    { staleTime: 15000 }
  )
  const eventos = eventosRes?.data || []

  const filtered = useMemo(() => {
    if (!busca) return eventos
    const q = busca.toLowerCase()
    return eventos.filter(e =>
      (e.aluno_nome || '').toLowerCase().includes(q) ||
      (e.user_id_equipamento || '').includes(q) ||
      (e.dispositivo_nome || '').toLowerCase().includes(q) ||
      (e.status || '').includes(q)
    )
  }, [eventos, busca])

  const statusCounts = useMemo(() => ({
    total: eventos.length,
    sucesso: eventos.filter(e => e.status === 'sucesso').length,
    falha: eventos.filter(e => e.status === 'falha').length,
    inconsistencia: eventos.filter(e => e.status === 'inconsistencia').length,
  }), [eventos])

  const statusBadge = (st: string) => {
    if (st === 'sucesso') return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: '✅ Sucesso' }
    if (st === 'falha') return { bg: 'rgba(244,63,94,0.1)', color: '#f43f5e', label: '❌ Falha' }
    return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: '⚠️ Inconsistência' }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <FileText size={22} color={ACCENT} />
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0 }}>Logs & Auditoria</h1>
        </div>
        <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
          Histórico completo de eventos do iDFace · Payload bruto incluído
        </p>
      </div>

      {/* Status summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: statusCounts.total, color: '#94a3b8' },
          { label: 'Sucesso', value: statusCounts.sucesso, color: '#10b981' },
          { label: 'Falhas', value: statusCounts.falha, color: '#f43f5e' },
          { label: 'Inconsistências', value: statusCounts.inconsistencia, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '8px 16px', borderRadius: 10,
            background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{s.label}</span>
            <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))' }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap',
        padding: '10px 16px', borderRadius: 14,
        background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input
            className="form-input"
            placeholder="Buscar por aluno, código, dispositivo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, height: 36, borderRadius: 10, fontSize: 13 }}
          />
        </div>
        <input
          type="date"
          className="form-input"
          value={filtroData}
          onChange={e => setFiltroData(e.target.value)}
          style={{ height: 36, borderRadius: 10, fontSize: 12, fontWeight: 600 }}
        />
        <select
          className="form-input"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          style={{ height: 36, borderRadius: 10, fontSize: 12, fontWeight: 600, minWidth: 150 }}
        >
          <option value="Todos">Todos Status</option>
          <option value="sucesso">Sucesso</option>
          <option value="falha">Falha</option>
          <option value="inconsistencia">Inconsistência</option>
        </select>
      </div>

      {/* Log entries */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 18, overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
            <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13 }}>Carregando logs...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
            <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>Nenhum log encontrado para esta data.</div>
          </div>
        ) : (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            {filtered.map((e, i) => {
              const badge = statusBadge(e.status)
              const isExpanded = expandedPayload === e.id
              return (
                <div key={e.id || i} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <div
                    style={{
                      display: 'grid', gridTemplateColumns: '150px 80px 1fr 130px 120px 40px',
                      gap: 10, padding: '10px 20px', alignItems: 'center',
                      transition: 'background 0.15s', cursor: 'pointer',
                      background: e.status !== 'sucesso' ? `${badge.bg}` : 'transparent',
                    }}
                    onClick={() => setExpandedPayload(isExpanded ? null : e.id)}
                  >
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                      {new Date(e.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: 'monospace' }}>
                      {e.user_id_equipamento || '—'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.aluno_nome || 'Não identificado'}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {e.dispositivo_nome || '—'}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: badge.bg, color: badge.color, textAlign: 'center' }}>
                      {badge.label}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Code size={13} style={{ color: 'hsl(var(--text-muted))', opacity: 0.6, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </div>

                  {/* Expanded payload */}
                  {isExpanded && (
                    <div style={{ padding: '0 20px 14px', background: 'hsl(var(--bg-base))' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>PAYLOAD BRUTO</div>
                      <pre style={{
                        background: 'hsl(var(--bg-elevated))', borderRadius: 10, padding: 12,
                        fontSize: 10, overflow: 'auto', maxHeight: 200, fontFamily: 'monospace',
                        color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))',
                        margin: 0,
                      }}>
                        {JSON.stringify(e.payload_raw, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
