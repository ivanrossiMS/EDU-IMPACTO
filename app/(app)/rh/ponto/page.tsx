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

interface HorarioDetalheDia {
  dia: string
  folga: boolean
  entrada1: string
  saida1: string
  entrada2: string
  saida2: string
  entrada3: string
  saida3: string
  tolExtra: string
  tolFalta: string
  carga: string
}

interface HorarioRegistro {
  id: string
  numero: string
  descricao: string
  tipo: string
  desativado: boolean
  dias: HorarioDetalheDia[]
}

const BLANK: Omit<RegistroPonto, 'id'> = {
  funcionarioId: '', data: new Date().toISOString().slice(0, 10),
  entrada: '07:30', saidaAlmoco: '11:30', retornoAlmoco: '13:00', saida: '17:30',
  justificativa: '', tipo: 'normal'
}

const FORMAT_DIAS_VAZIOS = (): HorarioDetalheDia[] => [
  { dia: 'Segunda-feira', folga: false, entrada1: '08:00', saida1: '12:30', entrada2: '14:00', saida2: '18:18', entrada3: '', saida3: '', tolExtra: '5', tolFalta: '5', carga: '08:48' },
  { dia: 'Terça-feira', folga: false, entrada1: '08:00', saida1: '12:30', entrada2: '14:00', saida2: '18:18', entrada3: '', saida3: '', tolExtra: '5', tolFalta: '5', carga: '08:48' },
  { dia: 'Quarta-feira', folga: false, entrada1: '08:00', saida1: '12:30', entrada2: '14:00', saida2: '18:18', entrada3: '', saida3: '', tolExtra: '5', tolFalta: '5', carga: '08:48' },
  { dia: 'Quinta-feira', folga: false, entrada1: '08:00', saida1: '12:30', entrada2: '14:00', saida2: '18:18', entrada3: '', saida3: '', tolExtra: '5', tolFalta: '5', carga: '08:48' },
  { dia: 'Sexta-feira', folga: false, entrada1: '08:00', saida1: '12:30', entrada2: '14:00', saida2: '18:18', entrada3: '', saida3: '', tolExtra: '5', tolFalta: '5', carga: '08:48' },
  { dia: 'Sábado', folga: true, entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '', tolExtra: '5', tolFalta: '5', carga: '00:00' },
  { dia: 'Domingo', folga: true, entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '', tolExtra: '5', tolFalta: '5', carga: '00:00' },
]

function calcCargaDia(d: HorarioDetalheDia) {
  if (d.folga) return '00:00'
  const toMin = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
  
  let total = 0
  if (d.entrada1 && d.saida1) total += Math.max(0, toMin(d.saida1) - toMin(d.entrada1))
  if (d.entrada2 && d.saida2) total += Math.max(0, toMin(d.saida2) - toMin(d.entrada2))
  if (d.entrada3 && d.saida3) total += Math.max(0, toMin(d.saida3) - toMin(d.entrada3))
  
  const horas = Math.floor(total / 60)
  const min = total % 60
  return `${String(horas).padStart(2, '0')}:${String(min).padStart(2, '0')}`
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
  const [horarios, setHorarios] = useLocalStorage<HorarioRegistro[]>('edu-ponto-eletronico-horarios', [])
  
  const [tab, setTab] = useState<'dashboard' | 'horarios'>('dashboard')
  
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

  const [horarioModal, setHorarioModal] = useState<'add' | 'edit' | null>(null)
  const [editHorarioId, setEditHorarioId] = useState<string | null>(null)
  const [horarioForm, setHorarioForm] = useState<Omit<HorarioRegistro, 'id'>>({
    numero: String((horarios?.length || 0) + 1), descricao: '', tipo: 'Semanal', desativado: false, dias: FORMAT_DIAS_VAZIOS()
  })

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

  const openAddHorario = () => {
    setHorarioForm({ numero: String(horarios.length + 1), descricao: '', tipo: 'Semanal', desativado: false, dias: FORMAT_DIAS_VAZIOS() })
    setEditHorarioId(null)
    setHorarioModal('add')
  }
  
  const openEditHorario = (h: HorarioRegistro) => {
    setHorarioForm({ ...h })
    setEditHorarioId(h.id)
    setHorarioModal('edit')
  }

  const handleSaveHorario = () => {
    if (!horarioForm.numero || !horarioForm.descricao) { alert('Preencha os campos obrigatórios'); return; }
    if (editHorarioId) {
      setHorarios(prev => prev.map(h => h.id === editHorarioId ? { ...horarioForm, id: editHorarioId } : h))
    } else {
      setHorarios(prev => [...prev, { ...horarioForm, id: `HR${Date.now()}` }])
    }
    setHorarioModal(null)
  }

  const handleDeleteHorario = (id: string) => {
    if(confirm('Tem certeza que deseja excluir esse horário?')) {
      setHorarios(prev => prev.filter(h => h.id !== id))
    }
  }

  // Auto Recalcular Carga no form
  const atualizarCargaFormulario = (newDias: HorarioDetalheDia[]) => {
    const updated = newDias.map(d => ({ ...d, carga: calcCargaDia(d) }))
    setHorarioForm(prev => ({ ...prev, dias: updated }))
  }

  const atualizarDia = (index: number, obj: Partial<HorarioDetalheDia>) => {
    const newDias = [...horarioForm.dias]
    newDias[index] = { ...newDias[index], ...obj }
    if (obj.folga === true) {
      newDias[index].entrada1 = ''; newDias[index].saida1 = '';
      newDias[index].entrada2 = ''; newDias[index].saida2 = '';
      newDias[index].entrada3 = ''; newDias[index].saida3 = '';
    }
    atualizarCargaFormulario(newDias)
  }

  const replicarSegSex = () => {
    if (!horarioForm.dias[0]) return
    const seg = horarioForm.dias[0]
    const newDias = [...horarioForm.dias]
    for (let i = 1; i < 5; i++) { // Terça a Sexta
      newDias[i] = { 
        ...newDias[i], 
        folga: seg.folga,
        entrada1: seg.entrada1, saida1: seg.saida1,
        entrada2: seg.entrada2, saida2: seg.saida2,
        entrada3: seg.entrada3, saida3: seg.saida3,
        tolExtra: seg.tolExtra, tolFalta: seg.tolFalta
      }
    }
    atualizarCargaFormulario(newDias)
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

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 24, padding: '0 12px' }}>
        <button 
          onClick={() => setTab('dashboard')}
          style={{ padding: '12px 4px', fontWeight: 600, color: tab === 'dashboard' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', borderBottom: tab === 'dashboard' ? '2px solid hsl(var(--primary))' : '2px solid transparent', cursor: 'pointer', background: 'none', transition: 'all 0.2s', fontSize: 14 }}>
            Dashboard & Frequência
        </button>
        <button 
          onClick={() => setTab('horarios')}
          style={{ padding: '12px 4px', fontWeight: 600, color: tab === 'horarios' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', borderBottom: tab === 'horarios' ? '2px solid hsl(var(--primary))' : '2px solid transparent', cursor: 'pointer', background: 'none', transition: 'all 0.2s', fontSize: 14 }}>
            Horários de Trabalho
        </button>
      </div>

      {tab === 'dashboard' && (
        <>
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
      </>)}

      {tab === 'horarios' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Catálogo de Horários</h2>
              <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Crie as grades de horários para vincular aos funcionários depois.</p>
            </div>
            <button className="btn btn-primary" onClick={openAddHorario}><Plus size={14} />Novo Horário</button>
          </div>

          {horarios.length === 0 ? (
            <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <Clock3 size={48} style={{ opacity: 0.1, margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 700 }}>Nenhum horário configurado ainda.</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Número</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'center' }}>Desativado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {horarios.map(h => (
                    <tr key={h.id} style={{ opacity: h.desativado ? 0.5 : 1 }}>
                      <td><div style={{ fontWeight: 700 }}>{h.numero}</div></td>
                      <td><div style={{ fontWeight: 600 }}>{h.descricao}</div></td>
                      <td><span className="badge badge-neutral">{h.tipo}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        {h.desativado ? <span className="badge badge-danger">Sim</span> : <span style={{ color: 'hsl(var(--text-muted))' }}>Não</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                           <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEditHorario(h)}><Pencil size={11} /></button>
                           <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#f87171' }} onClick={() => handleDeleteHorario(h.id)}><Trash2 size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
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

      {/* MODAL CRIADOR DE HORARIOS (Ultra Premium) */}
      {horarioModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 1100, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'var(--gradient-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <div style={{ width: 36, height: 36, borderRadius: 10, background: 'hsl(var(--primary))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Clock3 size={18} />
                 </div>
                 <div>
                   <div style={{ fontWeight: 800, fontSize: 16 }}>{horarioModal === 'add' ? 'Novo Horário de Trabalho' : 'Editar Horário'}</div>
                   <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{horarioModal === 'add' ? 'Configure a grade semanal' : 'Alteração de regras de ponto'}</div>
                 </div>
              </div>
              <button onClick={() => setHorarioModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
               {/* ROW 1: BASICS */}
               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,3fr) minmax(0,2fr) minmax(0,1fr)', gap: 16, marginBottom: 24 }}>
                 <div>
                    <label className="form-label">Número <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="form-input" style={{ fontWeight: 800 }} value={horarioForm.numero} onChange={e => setHorarioForm(p => ({ ...p, numero: e.target.value }))} />
                 </div>
                 <div>
                    <label className="form-label">Descrição <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="form-input" placeholder="Ex: Inspetor, Secretaria" value={horarioForm.descricao} onChange={e => setHorarioForm(p => ({ ...p, descricao: e.target.value }))} />
                 </div>
                 <div>
                    <label className="form-label">Tipo de Horário <span style={{ color: '#ef4444' }}>*</span></label>
                    <select className="form-input" value={horarioForm.tipo} onChange={e => setHorarioForm(p => ({ ...p, tipo: e.target.value }))}>
                       <option value="Semanal">Semanal (7 dias)</option>
                       <option value="Mensal">Mensal (Custom)</option>
                    </select>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
                       <input type="checkbox" style={{ width: 16, height: 16, cursor: 'pointer' }} checked={horarioForm.desativado} onChange={e => setHorarioForm(p => ({ ...p, desativado: e.target.checked }))} />
                       Desativado
                    </label>
                 </div>
               </div>

               {/* GRADE SEMANAL */}
               <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                   <thead style={{ background: 'hsl(var(--bg-elevated))' }}>
                     <tr>
                       <th style={{ padding: '12px 16px', fontWeight: 700, width: 140 }}>Dia / Folga</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center' }}>Entrada 1</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center' }}>Saída 1</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center' }}>Entrada 2</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center' }}>Saída 2</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center' }}>Entrada 3</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center' }}>Saída 3</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center', width: 70 }}>Tol. Extra</th>
                       <th style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'center', width: 70 }}>Tol. Falta</th>
                       <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'center', background: 'rgba(52,211,153,0.1)', color: '#047857', width: 90 }}>Carga</th>
                     </tr>
                   </thead>
                   <tbody>
                     {horarioForm.dias.map((d, index) => (
                        <tr key={index} style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: d.folga ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                           <td style={{ padding: '10px 16px' }}>
                             <div style={{ fontWeight: 700, color: d.dia === 'Sábado' || d.dia === 'Domingo' ? '#6366f1' : 'hsl(var(--text-color))' }}>{d.dia}</div>
                             <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', marginTop: 4, color: d.folga ? '#ef4444' : 'hsl(var(--text-muted))' }}>
                               <input type="checkbox" checked={d.folga} onChange={e => atualizarDia(index, { folga: e.target.checked })} style={{ cursor: 'pointer' }} /> Folga DSR
                             </label>
                           </td>
                           <td style={{ padding: '8px' }}><input type="time" disabled={d.folga} value={d.entrada1} onChange={e => atualizarDia(index, { entrada1: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, background: d.folga ? 'hsl(var(--bg-elevated))' : 'fff', textAlign: 'center' }} /></td>
                           <td style={{ padding: '8px' }}><input type="time" disabled={d.folga} value={d.saida1} onChange={e => atualizarDia(index, { saida1: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, background: d.folga ? 'hsl(var(--bg-elevated))' : 'fff', textAlign: 'center' }} /></td>
                           <td style={{ padding: '8px' }}><input type="time" disabled={d.folga} value={d.entrada2} onChange={e => atualizarDia(index, { entrada2: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, background: d.folga ? 'hsl(var(--bg-elevated))' : 'fff', textAlign: 'center' }} /></td>
                           <td style={{ padding: '8px' }}><input type="time" disabled={d.folga} value={d.saida2} onChange={e => atualizarDia(index, { saida2: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, background: d.folga ? 'hsl(var(--bg-elevated))' : 'fff', textAlign: 'center' }} /></td>
                           <td style={{ padding: '8px' }}><input type="time" disabled={d.folga} value={d.entrada3} onChange={e => atualizarDia(index, { entrada3: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, background: d.folga ? 'hsl(var(--bg-elevated))' : 'fff', textAlign: 'center' }} /></td>
                           <td style={{ padding: '8px' }}><input type="time" disabled={d.folga} value={d.saida3} onChange={e => atualizarDia(index, { saida3: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, background: d.folga ? 'hsl(var(--bg-elevated))' : 'fff', textAlign: 'center' }} /></td>
                           
                           {/* Tolerancias */}
                           <td style={{ padding: '8px' }}><input type="number" min="0" value={d.tolExtra} onChange={e => atualizarDia(index, { tolExtra: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, textAlign: 'center', background: 'transparent' }} /></td>
                           <td style={{ padding: '8px' }}><input type="number" min="0" value={d.tolFalta} onChange={e => atualizarDia(index, { tolFalta: e.target.value })} style={{ width: '100%', padding: '6px', fontSize: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 4, textAlign: 'center', background: 'transparent' }} /></td>
                           
                           {/* Carga Info */}
                           <td style={{ padding: '8px 16px', textAlign: 'center', background: 'rgba(52,211,153,0.05)', fontWeight: 800, color: d.carga === '00:00' ? 'hsl(var(--text-muted))' : '#047857' }}>{d.carga}</td>
                        </tr>
                     ))}
                   </tbody>
                 </table>
                 
                 {/* FOOTER ACTIONS */}
                 <div style={{ background: 'hsl(var(--bg-elevated))', padding: '12px 16px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={replicarSegSex} style={{ fontSize: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none' }}>
                      <CheckCircle size={14} /> Replicar Seg-Sex (Copiar de Seg)
                    </button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, fontWeight: 700 }}>
                       Carga Horária Semanal:
                       <span style={{ fontSize: 16, background: '#3b82f6', color: '#fff', padding: '4px 12px', borderRadius: 8 }}>
                          {(() => {
                             const totalMins = horarioForm.dias.reduce((acc, d) => {
                                const [h, m] = d.carga.split(':').map(Number);
                                return acc + (h * 60 + m)
                             }, 0)
                             return `${Math.floor(totalMins / 60)}h${totalMins % 60 > 0 ? String(totalMins % 60).padStart(2, '0') : ''}`
                          })()}
                       </span>
                    </div>
                 </div>
               </div>

            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--gradient-subtle)' }}>
              <button className="btn btn-secondary" onClick={() => setHorarioModal(null)} style={{ width: 120 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveHorario} style={{ width: 140 }}>
                <Check size={16} /> Salvar Horário
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
