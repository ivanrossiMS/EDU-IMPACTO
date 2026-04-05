'use client'

import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { formatCurrency } from '@/lib/utils'
import {
  Clock3, Search, Calendar, Check, X, Plus, Pencil, Trash2,
  TrendingUp, TrendingDown, AlertCircle, Users2, Timer, CheckCircle
} from 'lucide-react'

interface RegistroPonto {
  id: string
  funcionarioId: string
  data: string
  entrada: string
  saidaAlmoco: string
  retornoAlmoco: string
  saida: string
  justificativa?: string
  tipo: 'normal' | 'falta' | 'atestado' | 'feriado' | 'folga'
}

const BLANK: Omit<RegistroPonto, 'id'> = {
  funcionarioId: '', data: new Date().toISOString().slice(0, 10),
  entrada: '07:30', saidaAlmoco: '11:30', retornoAlmoco: '13:00', saida: '17:30',
  justificativa: '', tipo: 'normal'
}

function calcHoras(entrada: string, saidaAlmoco: string, retornoAlmoco: string, saida: string) {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const manha = toMin(saidaAlmoco) - toMin(entrada)
  const tarde = toMin(saida) - toMin(retornoAlmoco)
  const total = Math.max(0, manha + tarde)
  const horas = Math.floor(total / 60)
  const min = total % 60
  return { total, str: `${horas}h${min > 0 ? String(min).padStart(2, '0') : ''}` }
}

const HORAS_DIA = 8 * 60

export default function PontoEletronicoPage() {
  const { funcionarios } = useData()
  const [registros, setRegistros] = useLocalStorage<RegistroPonto[]>('edu-ponto-eletronico', [])
  const [search, setSearch] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [periodoFim, setPeriodoFim] = useState(new Date().toISOString().slice(0, 10))
  const [filtroFunc, setFiltroFunc] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<RegistroPonto, 'id'>>(BLANK)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [vistaFunc, setVistaFunc] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const today = new Date().toISOString().slice(0, 10)

  const filtPeriodo = useMemo(() => registros.filter(r =>
    r.data >= periodoInicio && r.data <= periodoFim &&
    (!filtroFunc || r.funcionarioId === filtroFunc)
  ), [registros, periodoInicio, periodoFim, filtroFunc])

  // Estatísticas por funcionário
  const stats = useMemo(() => funcionarios
    .filter(f => f.status.toLowerCase() === 'ativo' || f.status === 'Ativo')
    .map(f => {
      const regs = filtPeriodo.filter(r => r.funcionarioId === f.id)
      const normais = regs.filter(r => r.tipo === 'normal')
      const faltas = regs.filter(r => r.tipo === 'falta').length
      const atestados = regs.filter(r => r.tipo === 'atestado').length
      const minTrabalhados = normais.reduce((s, r) => s + calcHoras(r.entrada, r.saidaAlmoco, r.retornoAlmoco, r.saida).total, 0)
      const minExtras = normais.reduce((s, r) => {
        const { total } = calcHoras(r.entrada, r.saidaAlmoco, r.retornoAlmoco, r.saida)
        return s + Math.max(0, total - HORAS_DIA)
      }, 0)
      return { f, dias: normais.length, faltas, atestados, minTrabalhados, minExtras }
    })
    .filter(s => !search || s.f.nome.toLowerCase().includes(search.toLowerCase())),
    [funcionarios, filtPeriodo, search]
  )

  const totalFaltas = stats.reduce((s, r) => s + r.faltas, 0)
  const totalExtras = stats.reduce((s, r) => s + r.minExtras, 0)
  const totalDias = stats.reduce((s, r) => s + r.dias, 0)

  const funcNome = (id: string) => funcionarios.find(f => f.id === id)?.nome || '—'

  const openAdd = () => { setForm({ ...BLANK }); setEditId(null); setModal('add') }
  const openEdit = (r: RegistroPonto) => {
    setForm({ funcionarioId: r.funcionarioId, data: r.data, entrada: r.entrada, saidaAlmoco: r.saidaAlmoco, retornoAlmoco: r.retornoAlmoco, saida: r.saida, justificativa: r.justificativa, tipo: r.tipo })
    setEditId(r.id); setModal('edit')
  }
  const handleSave = () => {
    if (!form.funcionarioId || !form.data) return
    if (editId) {
      setRegistros(prev => prev.map(r => r.id === editId ? { ...form, id: editId } : r))
    } else {
      setRegistros(prev => [...prev, { ...form, id: `PT${Date.now()}` }])
    }
    setModal(null)
  }
  const handleDelete = () => {
    if (confirmId) setRegistros(prev => prev.filter(r => r.id !== confirmId))
    setConfirmId(null)
  }

  const hStr = (min: number) => {
    const h = Math.floor(min / 60); const m = min % 60
    return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
  }

  const TIPO_CFG = {
    normal:   { color: '#10b981', label: 'Normal' },
    falta:    { color: '#ef4444', label: 'Falta' },
    atestado: { color: '#f59e0b', label: 'Atestado' },
    feriado:  { color: '#8b5cf6', label: 'Feriado' },
    folga:    { color: '#06b6d4', label: 'Folga' },
  }

  const vistaRegs = vistaFunc ? registros.filter(r => r.funcionarioId === vistaFunc && r.data >= periodoInicio && r.data <= periodoFim).sort((a, b) => b.data.localeCompare(a.data)) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ponto Eletrônico</h1>
          <p className="page-subtitle">Controle de frequência e banco de horas dos colaboradores</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Timer size={13} />Exportar Relatório</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} />Registrar Ponto</button>
        </div>
      </div>

      {/* Período */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} color="#60a5fa" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Período:</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>De:</span>
          <input type="date" className="form-input" style={{ width: 145 }} value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Até:</span>
          <input type="date" className="form-input" style={{ width: 145 }} value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Funcionários Ativos', value: funcionarios.filter(f => f.status.toLowerCase() === 'ativo' || f.status === 'Ativo').length, color: '#3b82f6', icon: '👥' },
          { label: 'Dias Registrados', value: totalDias, color: '#34d399', icon: '📅' },
          { label: 'Faltas no Período', value: totalFaltas, color: '#f87171', icon: '⚠️' },
          { label: 'Horas Extras', value: hStr(totalExtras), color: '#f59e0b', icon: '⏰' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros Tabela */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar funcionário..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 220 }} value={filtroFunc} onChange={e => setFiltroFunc(e.target.value)}>
            <option value="">Todos os funcionários</option>
            {funcionarios.filter(f => f.status.toLowerCase() === 'ativo' || f.status === 'Ativo').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela resumo por funcionário */}
      {funcionarios.filter(f => f.status.toLowerCase() === 'ativo' || f.status === 'Ativo').length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Users2 size={48} style={{ opacity: 0.1, margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 700 }}>Nenhum funcionário ativo cadastrado</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Cargo</th>
                <th style={{ textAlign: 'center' }}>Dias Trab.</th>
                <th style={{ textAlign: 'center' }}>Faltas</th>
                <th style={{ textAlign: 'center' }}>Atestados</th>
                <th style={{ textAlign: 'center' }}>H. Extras</th>
                <th>Ver Registros</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(({ f, dias, faltas, atestados, minExtras }) => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nome}</div>
                  </td>
                  <td><span className="badge badge-neutral">{f.cargo}</span></td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#34d399' }}>{dias}</td>
                  <td style={{ textAlign: 'center' }}>
                    {faltas > 0 ? <span className="badge badge-danger">{faltas}</span> : <span style={{ color: 'hsl(var(--text-muted))', fontSize: 12 }}>0</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {atestados > 0 ? <span className="badge badge-warning">{atestados}</span> : <span style={{ color: 'hsl(var(--text-muted))', fontSize: 12 }}>0</span>}
                  </td>
                  <td style={{ textAlign: 'center', color: minExtras > 0 ? '#f59e0b' : 'hsl(var(--text-muted))', fontWeight: minExtras > 0 ? 700 : 400 }}>
                    {minExtras > 0 ? `+${hStr(minExtras)}` : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setVistaFunc(f.id)}>
                      <Clock3 size={11} />Ver Marcações
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal registrar ponto */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 560, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{modal === 'add' ? 'Registrar Ponto' : 'Editar Registro'}</div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Funcionário *</label>
                  <select className="form-input" value={form.funcionarioId} onChange={e => set('funcionarioId', e.target.value)}>
                    <option value="">Selecionar</option>
                    {funcionarios.filter(f => f.status.toLowerCase() === 'ativo' || f.status === 'Ativo').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Data *</label>
                  <input type="date" className="form-input" value={form.data} onChange={e => set('data', e.target.value)} max={today} />
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                    {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                {form.tipo === 'normal' && (
                  <>
                    <div>
                      <label className="form-label">Entrada</label>
                      <input type="time" className="form-input" value={form.entrada} onChange={e => set('entrada', e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Saída Almoço</label>
                      <input type="time" className="form-input" value={form.saidaAlmoco} onChange={e => set('saidaAlmoco', e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Retorno Almoço</label>
                      <input type="time" className="form-input" value={form.retornoAlmoco} onChange={e => set('retornoAlmoco', e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Saída</label>
                      <input type="time" className="form-input" value={form.saida} onChange={e => set('saida', e.target.value)} />
                    </div>
                    {form.entrada && form.saida && (
                      <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: 'rgba(52,211,153,0.08)', borderRadius: 8, fontSize: 13 }}>
                        Total trabalhado: <strong style={{ color: '#34d399' }}>{calcHoras(form.entrada, form.saidaAlmoco, form.retornoAlmoco, form.saida).str}</strong>
                        {calcHoras(form.entrada, form.saidaAlmoco, form.retornoAlmoco, form.saida).total > HORAS_DIA && (
                          <span style={{ color: '#f59e0b', marginLeft: 12 }}>+{hStr(calcHoras(form.entrada, form.saidaAlmoco, form.retornoAlmoco, form.saida).total - HORAS_DIA)} extras</span>
                        )}
                      </div>
                    )}
                  </>
                )}
                {form.tipo !== 'normal' && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Justificativa</label>
                    <input className="form-input" value={form.justificativa || ''} onChange={e => set('justificativa', e.target.value)} placeholder="Ex: CID-10, atestado médico..." />
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.funcionarioId || !form.data}>
                <Check size={14} />{modal === 'add' ? 'Registrar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal marcações do funcionário */}
      {vistaFunc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 16, width: '100%', maxWidth: 680, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Marcações — {funcNome(vistaFunc)}</div>
              <button onClick={() => setVistaFunc(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {vistaRegs.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhum registro neste período.</div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Data</th><th>Tipo</th><th>Entrada</th><th>Intervalo</th><th>Saída</th><th>Total</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                      {vistaRegs.map(r => {
                        const cfg = TIPO_CFG[r.tipo]
                        const horas = r.tipo === 'normal' ? calcHoras(r.entrada, r.saidaAlmoco, r.retornoAlmoco, r.saida) : { str: '—', total: 0 }
                        return (
                          <tr key={r.id}>
                            <td style={{ fontSize: 13 }}>{new Date(r.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                            <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: `${cfg.color}20`, color: cfg.color, fontWeight: 700 }}>{cfg.label}</span></td>
                            <td style={{ fontSize: 12 }}>{r.tipo === 'normal' ? r.entrada : '—'}</td>
                            <td style={{ fontSize: 12 }}>{r.tipo === 'normal' ? `${r.saidaAlmoco} - ${r.retornoAlmoco}` : '—'}</td>
                            <td style={{ fontSize: 12 }}>{r.tipo === 'normal' ? r.saida : '—'}</td>
                            <td style={{ fontWeight: 700, color: horas.total > HORAS_DIA ? '#f59e0b' : '#34d399' }}>{horas.str}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { openEdit(r); setVistaFunc(null) }}><Pencil size={11} /></button>
                                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#f87171' }} onClick={() => setConfirmId(r.id)}><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 14, width: 380, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', fontWeight: 700, color: '#f87171', display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertCircle size={16} />Excluir Registro
            </div>
            <div style={{ padding: '20px 24px', fontSize: 13, color: 'hsl(var(--text-muted))' }}>Este registro de ponto será removido permanentemente.</div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
