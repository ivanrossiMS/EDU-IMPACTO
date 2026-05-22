'use client'

import { useState, useMemo } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  Search, Clock, CheckCircle, XCircle, AlertTriangle, Filter,
  Download, Eye, Scan, ChevronDown, X, Activity
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function PortariaEntradasPage() {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroData, setFiltroData] = useState(new Date().toISOString().slice(0, 10))
  const [modalEvento, setModalEvento] = useState<any>(null)

  const formatDateTimeUTC = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const year = d.getUTCFullYear()
    const h = String(d.getUTCHours()).padStart(2, '0')
    const m = String(d.getUTCMinutes()).padStart(2, '0')
    const s = String(d.getUTCSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} ${h}:${m}:${s}`
  }

  const { data: eventosRes, isLoading } = useApiQuery<{ data: any[] }>(
    ['portaria-entradas', filtroData],
    '/api/portaria/eventos',
    {
      data_inicio: `${filtroData}T00:00:00`,
      data_fim: `${filtroData}T23:59:59`,
      limit: '500',
      ...(filtroStatus !== 'Todos' ? { status: filtroStatus.toLowerCase() } : {}),
    },
    { staleTime: 5000 }
  )
  const eventos = eventosRes?.data || []

  const filtered = useMemo(() => {
    if (!busca) return eventos
    const q = busca.toLowerCase()
    return eventos.filter(e =>
      (e.aluno_nome || '').toLowerCase().includes(q) ||
      (e.user_id_equipamento || '').includes(q)
    )
  }, [eventos, busca])

  const statusBadge = (st: string) => {
    if (st === 'sucesso') return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', icon: <CheckCircle size={12} />, label: 'Sucesso' }
    if (st === 'falha') return { bg: 'rgba(244,63,94,0.1)', color: '#f43f5e', icon: <XCircle size={12} />, label: 'Falha' }
    return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', icon: <AlertTriangle size={12} />, label: 'Inconsistência' }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Clock size={22} color={ACCENT} />
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0, letterSpacing: '-0.03em' }}>
            Entradas em Tempo Real
          </h1>
        </div>
        <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
          Atualização automática a cada 5 segundos · {filtered.length} eventos
        </p>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: 14,
        background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input
            className="form-input"
            placeholder="Buscar por nome ou código..."
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
          style={{ height: 36, borderRadius: 10, fontSize: 12, fontWeight: 600, minWidth: 130 }}
        >
          <option value="Todos">Todos Status</option>
          <option value="sucesso">✅ Sucesso</option>
          <option value="falha">❌ Falha</option>
          <option value="inconsistencia">⚠️ Inconsistência</option>
        </select>
      </div>

      {/* Tabela */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 18, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '140px 80px 1.2fr 1.2fr 1.2fr 100px 60px',
          gap: 12, padding: '12px 20px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
        }}>
          {['DATA/HORA', 'CÓDIGO', 'ALUNO', 'TURMA', 'DISPOSITIVO', 'STATUS', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
          ))}
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
            <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13 }}>Carregando entradas...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
            <Scan size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Nenhum evento encontrado para esta data.</div>
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {filtered.map((e, i) => {
              const badge = statusBadge(e.status)
              const nomeTurma = e.aluno_turma ? (e.aluno_turma.includes(' - ') ? e.aluno_turma.split(' - ')[1] : e.aluno_turma) : '—'
              return (
                <div
                  key={e.id || i}
                  style={{
                    display: 'grid', gridTemplateColumns: '140px 80px 1.2fr 1.2fr 1.2fr 100px 60px',
                    gap: 12, padding: '12px 20px', alignItems: 'center',
                    borderBottom: '1px solid hsl(var(--border-subtle))',
                    transition: 'background 0.15s', cursor: 'pointer',
                  }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'hsl(var(--bg-base))')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                  onClick={() => setModalEvento(e)}
                >
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontFamily: 'monospace', fontWeight: 600 }}>
                    {formatDateTimeUTC(e.data_hora)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, fontFamily: 'monospace' }}>
                    {e.user_id_equipamento || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                      flexShrink: 0
                    }}>
                      {e.aluno_foto ? (
                        <img src={e.aluno_foto} alt={e.aluno_nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ fontSize: 8, fontWeight: 800, color: 'hsl(var(--text-muted))' }}>
                          {(e.aluno_nome || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.aluno_nome || '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nomeTurma}
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.dispositivo_nome || 'Desconhecido'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: badge.bg, color: badge.color }}>
                    {badge.icon} {badge.label}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Eye size={14} style={{ color: 'hsl(var(--text-muted))', opacity: 0.6 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Detalhes */}
      {modalEvento && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', zIndex: 9999, backdropFilter: 'blur(4px)',
        }} onClick={() => setModalEvento(null)}>
          <div
            style={{
              background: 'hsl(var(--bg-elevated))', borderRadius: 20, padding: 28,
              width: '90%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto',
              border: '1px solid hsl(var(--border-subtle))',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{
                  width: 50, height: 62, borderRadius: 10,
                  background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)', flexShrink: 0
                }}>
                  {modalEvento.aluno_foto ? (
                    <img src={modalEvento.aluno_foto} alt="Official ERP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Sem Foto</div>
                  )}
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 18, margin: 0, color: 'hsl(var(--text-primary))' }}>
                    {modalEvento.aluno_nome || 'Usuário Não Cadastrado'}
                  </h2>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                    Turma: {modalEvento.aluno_turma || 'Sem turma'} · Turno: {modalEvento.aluno_turno || 'Todos'}
                  </div>
                </div>
              </div>
              <button onClick={() => setModalEvento(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                ['Aluno', modalEvento.aluno_nome || '—'],
                ['Código', modalEvento.user_id_equipamento || '—'],
                ['Data/Hora', formatDateTimeUTC(modalEvento.data_hora)],
                ['Dispositivo', modalEvento.dispositivo_nome || '—'],
                ['Status', modalEvento.status],
                ['Confiança', `${modalEvento.confianca || 0}%`],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{val}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 8 }}>Payload Bruto (JSON)</div>
              <pre style={{
                background: 'hsl(var(--bg-base))', borderRadius: 12, padding: 14,
                fontSize: 11, overflow: 'auto', maxHeight: 200, fontFamily: 'monospace',
                color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))',
              }}>
                {JSON.stringify(modalEvento.payload_raw, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
