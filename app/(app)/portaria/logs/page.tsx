'use client'

import { useState, useMemo } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  FileText, Search, AlertTriangle, CheckCircle, XCircle,
  Activity, Eye, X, Code, Camera, ShieldAlert, Cpu, Calendar
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function PortariaLogsPage() {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroData, setFiltroData] = useState(new Date().toISOString().slice(0, 10))
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null)
  const [loadedPhotos, setLoadedPhotos] = useState<Record<string, string>>({})
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null)

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

  const handleExpand = async (id: string) => {
    if (expandedPayload === id) {
      setExpandedPayload(null)
      return
    }
    setExpandedPayload(id)
    if (!loadedPhotos[id]) {
      setLoadingPhotoId(id)
      try {
        const res = await fetch(`/api/portaria/eventos?id=${id}`)
        const json = await res.json()
        const fetchedPhoto = json.data?.[0]?.foto_captura || ''
        setLoadedPhotos(prev => ({ ...prev, [id]: fetchedPhoto }))
      } catch (err) {
        console.error('Erro ao buscar foto de captura:', err)
      } finally {
        setLoadingPhotoId(null)
      }
    }
  }

  const { data: eventosRes, isLoading, refetch } = useApiQuery<{ data: any[] }>(
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
    if (st === 'sucesso') return { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', color: '#10b981', label: '✅ Sucesso' }
    if (st === 'falha') return { bg: 'rgba(244,63,94,0.06)', border: 'rgba(244,63,94,0.2)', color: '#f43f5e', label: '❌ Falha' }
    return { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b', label: '⚠️ Inconsistência' }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 15px ${ACCENT}30`
            }}>
              <FileText size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0, letterSpacing: '-0.02em' }}>Logs & Auditoria</h1>
              <p style={{ fontSize: 12.5, color: 'hsl(var(--text-muted))', margin: 0 }}>
                Histórico de tráfego de rede e payloads brutos do webhook ControliD iDFace
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Hoje', value: statusCounts.total, color: 'hsl(var(--text-primary))', icon: <FileText size={14} /> },
          { label: 'Sucesso', value: statusCounts.sucesso, color: '#10b981', icon: <CheckCircle size={14} /> },
          { label: 'Falhas / Bloqueados', value: statusCounts.falha, color: '#f43f5e', icon: <XCircle size={14} /> },
          { label: 'Inconsistências', value: statusCounts.inconsistencia, color: '#f59e0b', icon: <AlertTriangle size={14} /> },
        ].map(s => (
          <div key={s.label} style={{
            padding: '10px 18px', borderRadius: 12,
            background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 15px rgba(0,0,0,0.01)'
          }}>
            <div style={{ color: s.color, display: 'flex', alignItems: 'center' }}>{s.icon}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</span>
            <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap',
        padding: '10px 16px', borderRadius: 14,
        background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input
            className="form-input"
            placeholder="Buscar por aluno, código do leitor, dispositivo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, height: 38, borderRadius: 10, fontSize: 13 }}
          />
        </div>
        <input
          type="date"
          className="form-input"
          value={filtroData}
          onChange={e => setFiltroData(e.target.value)}
          style={{ height: 38, borderRadius: 10, fontSize: 12, fontWeight: 700, paddingLeft: 8, paddingRight: 8 }}
        />
        <select
          className="form-input"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          style={{ height: 38, borderRadius: 10, fontSize: 12, fontWeight: 700, minWidth: 150 }}
        >
          <option value="Todos">Filtro por Status</option>
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
        boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '160px 80px 1.2fr 1.2fr 1.2fr 140px 50px',
          gap: 12, padding: '14px 20px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
          background: 'hsl(var(--bg-base))'
        }}>
          {['HORÁRIO PING', 'ID LEITOR', 'ALUNO IDENTIFICADO', 'TURMA', 'DISPOSITIVO', 'STATUS EVENTO', 'AÇÃO'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
          ))}
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
            <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Varrendo arquivos de log...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
            <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <div style={{ fontSize: 13 }}>Nenhum log de conexão registrado para a data escolhida.</div>
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {filtered.map((e, i) => {
              const badge = statusBadge(e.status)
              const isExpanded = expandedPayload === e.id
              const nomeTurma = e.aluno_turma ? (e.aluno_turma.includes(' - ') ? e.aluno_turma.split(' - ')[1] : e.aluno_turma) : '—'
              return (
                <div key={e.id || i} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <div
                    style={{
                      display: 'grid', gridTemplateColumns: '160px 80px 1.2fr 1.2fr 1.2fr 140px 50px',
                      gap: 12, padding: '11px 20px', alignItems: 'center',
                      transition: 'background 0.15s', cursor: 'pointer',
                      background: e.status !== 'sucesso' ? badge.bg : 'transparent',
                    }}
                    onClick={() => handleExpand(e.id)}
                    onMouseEnter={ev => {
                      if (e.status === 'sucesso') ev.currentTarget.style.background = 'hsl(var(--bg-base))'
                    }}
                    onMouseLeave={ev => {
                      if (e.status === 'sucesso') ev.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                      {formatDateTimeUTC(e.data_hora)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, fontFamily: 'monospace' }}>
                      {e.user_id_equipamento || '—'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.aluno_nome || 'Não identificado'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nomeTurma}
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.dispositivo_nome || '—'}
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, textAlign: 'center' }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Code size={14} style={{ color: isExpanded ? ACCENT : 'hsl(var(--text-muted))', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </div>

                  {/* Expanded Payload com Fotos Comparativas e JSON */}
                  {isExpanded && (
                    <div style={{
                      padding: '20px 24px', background: 'hsl(var(--bg-base))',
                      borderTop: '1px solid hsl(var(--border-subtle))',
                      borderBottom: '1px solid hsl(var(--border-subtle))',
                      animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20
                    }}>
                      
                      {/* Lado Esquerdo: Imagens Comparativas + Metadados */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 900, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Camera size={13} color={ACCENT} /> Comparação Facial (Oficial ERP vs Catraca)
                        </div>
                        
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                          
                          {/* Foto Oficial ERP */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              width: 90, height: 115, borderRadius: 12,
                              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', position: 'relative', boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                            }}>
                              {e.aluno_foto ? (
                                <img src={e.aluno_foto} alt="Official ERP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Sem Foto</div>
                              )}
                              <span style={{ position: 'absolute', bottom: 4, left: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 7.5, padding: '1px 0', borderRadius: 3, fontWeight: 800, textAlign: 'center' }}>
                                ERP OFICIAL
                              </span>
                            </div>
                          </div>

                          {/* Foto Capturada iDFace */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              width: 90, height: 115, borderRadius: 12,
                              background: 'hsl(var(--bg-elevated))', border: `2px solid ${ACCENT}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', position: 'relative', boxShadow: `0 4px 12px ${ACCENT}15`
                            }}>
                              {loadingPhotoId === e.id ? (
                                <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                                  <Activity size={14} style={{ animation: 'spin 1s linear infinite', marginBottom: 2 }} />
                                  <span style={{ fontSize: 8, fontWeight: 700 }}>Buscando...</span>
                                </div>
                              ) : loadedPhotos[e.id] ? (
                                <img src={loadedPhotos[e.id]} alt="iDFace Capture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                                  <Camera size={16} style={{ opacity: 0.4, margin: '0 auto 2px' }} />
                                  <span style={{ fontSize: 8, fontWeight: 700 }}>Sem Foto</span>
                                </div>
                              )}
                              <span style={{ position: 'absolute', bottom: 4, left: 4, right: 4, background: ACCENT, color: '#fff', fontSize: 7.5, padding: '1px 0', borderRadius: 3, fontWeight: 800, textAlign: 'center' }}>
                                CATRACA LIVE
                              </span>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                                {e.aluno_nome || 'Acesso Recusado'}
                              </div>
                              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                                Turma: {e.aluno_turma || 'Sem turma'} · Turno: {e.aluno_turno || 'Todos'}
                              </div>
                              <div style={{ fontSize: 9.5, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                                ID iDFace: {e.user_id_equipamento}
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'hsl(var(--bg-elevated))', color: ACCENT }}>
                                🎯 Confiança: {e.confianca || 98}%
                              </span>
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'hsl(var(--bg-elevated))', color: '#10b981' }}>
                                🔓 Relé: OK
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: Payload JSON Bruto */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 900, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Cpu size={13} color="#f59e0b" /> Payload Recebido (JSON HTTP Post)
                        </div>
                        <pre style={{
                          background: '#090d16', border: '1px solid #111b2d',
                          borderRadius: 14, padding: 14, overflow: 'auto',
                          maxHeight: 140, fontFamily: 'monospace', fontSize: 10.5,
                          color: '#00ffcc', margin: 0, lineHeight: 1.4
                        }}>
                          {JSON.stringify(e.payload_raw, null, 2)}
                        </pre>
                      </div>

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideIn { from { height: 0; opacity: 0; } to { height: auto; opacity: 1; } }
      `}</style>
    </div>
  )
}
