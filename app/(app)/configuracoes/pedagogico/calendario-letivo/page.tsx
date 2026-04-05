'use client'

import { useData, ConfigCalendarioLetivo, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import {
  Calendar, Plus, Save, Trash2, Edit3, X,
  BookOpen, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'

const ANO_ATUAL = new Date().getFullYear()

type FormCal = Omit<ConfigCalendarioLetivo, 'id' | 'createdAt'>

const BLANK: FormCal = {
  ano: ANO_ATUAL,
  totalDiasLetivos: 200,
  frequenciaMinima: 75,
  dataInicio: `${ANO_ATUAL}-02-01`,
  dataFim: `${ANO_ATUAL}-12-15`,
  observacoes: '',
}

function Modal({ form, onChange, onSave, onClose, editing }: {
  form: FormCal; onChange: (f: FormCal) => void; onSave: () => void; onClose: () => void; editing: boolean
}) {
  const s = <K extends keyof FormCal>(k: K, v: FormCal[K]) => onChange({ ...form, [k]: v })

  // Calcular dias trabalhados entre as datas
  const diasCalc = useMemo(() => {
    if (!form.dataInicio || !form.dataFim) return 0
    const ini = new Date(form.dataInicio), fim = new Date(form.dataFim)
    let dias = 0, cur = new Date(ini)
    while (cur <= fim) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) dias++
      cur.setDate(cur.getDate() + 1)
    }
    return dias
  }, [form.dataInicio, form.dataFim])

  const maxFaltas = Math.floor(form.totalDiasLetivos * (1 - form.frequenciaMinima / 100))

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560, width: '100%', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="#6366f1" />
            </div>
            {editing ? 'Editar Calendário Letivo' : 'Novo Calendário Letivo'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="form-label">Ano Letivo *</label>
            <input className="form-input" type="number" min={2020} max={2040}
              value={form.ano} onChange={e => s('ano', +e.target.value)} />
          </div>
          <div>
            <label className="form-label">Total de Dias Letivos *</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type="number" min={100} max={365}
                value={form.totalDiasLetivos} onChange={e => s('totalDiasLetivos', +e.target.value)}
                style={{ paddingRight: 48 }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'hsl(var(--text-muted))' }}>dias</span>
            </div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
              Mínimo LDB: 200 dias · Calculado no período: {diasCalc} dias úteis
            </div>
          </div>

          <div>
            <label className="form-label">Frequência Mínima *</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type="number" min={50} max={100}
                value={form.frequenciaMinima} onChange={e => s('frequenciaMinima', +e.target.value)}
                style={{ paddingRight: 32 }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#6366f1', fontWeight: 700 }}>%</span>
            </div>
            <div style={{ fontSize: 10, color: form.frequenciaMinima < 75 ? '#ef4444' : 'hsl(var(--text-muted))', marginTop: 3 }}>
              {form.frequenciaMinima < 75 && '⚠ Abaixo da exigência mínima (LDB Art. 24) · '}
              Máximo de faltas: {maxFaltas} aulas
            </div>
          </div>

          <div>
            <label className="form-label">Data de Início</label>
            <input className="form-input" type="date" value={form.dataInicio} onChange={e => s('dataInicio', e.target.value)} />
          </div>

          <div style={{ gridColumn: '2 / -1' }}>
            <label className="form-label">Data de Encerramento</label>
            <input className="form-input" type="date" value={form.dataFim} onChange={e => s('dataFim', e.target.value)} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observações</label>
            <textarea className="form-input" rows={2}
              placeholder="Recessos, feriados programados, alterações no calendário..."
              value={form.observacoes} onChange={e => s('observacoes', e.target.value)} />
          </div>
        </div>

        {/* Preview dinâmico */}
        <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: '#6366f1' }}>📊 Cálculo Automático</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Dias Letivos', value: form.totalDiasLetivos },
              { label: 'Freq. Mínima', value: `${form.frequenciaMinima}%` },
              { label: 'Máx. Faltas', value: maxFaltas },
              { label: 'Mín. Presenças', value: form.totalDiasLetivos - maxFaltas },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#6366f1', fontFamily: 'Outfit,sans-serif' }}>{item.value}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={onSave}
            disabled={!form.ano || !form.totalDiasLetivos || !form.frequenciaMinima}>
            <Save size={13} /> {editing ? 'Salvar Alterações' : 'Criar Calendário'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarioLetivoPage() {
  const { cfgCalendarioLetivo, setCfgCalendarioLetivo } = useData()
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormCal>(BLANK)

  const calendarioAtual = useMemo(() =>
    cfgCalendarioLetivo.find(c => c.ano === ANO_ATUAL), [cfgCalendarioLetivo])

  const openNew = () => {
    setEditingId(null)
    setForm({ ...BLANK, ano: ANO_ATUAL })
    setModal(true)
  }

  const openEdit = (id: string) => {
    const c = cfgCalendarioLetivo.find(x => x.id === id)
    if (!c) return
    setEditingId(id)
    setForm({ ano: c.ano, totalDiasLetivos: c.totalDiasLetivos, frequenciaMinima: c.frequenciaMinima, dataInicio: c.dataInicio, dataFim: c.dataFim, observacoes: c.observacoes })
    setModal(true)
  }

  const handleSave = () => {
    if (editingId) {
      setCfgCalendarioLetivo(prev => prev.map(c => c.id === editingId ? { ...c, ...form } : c))
    } else {
      const novo: ConfigCalendarioLetivo = { ...form, id: newId('CAL'), createdAt: new Date().toISOString() }
      setCfgCalendarioLetivo(prev => [novo, ...prev])
    }
    setModal(false)
  }

  const handleDelete = (id: string) => setCfgCalendarioLetivo(prev => prev.filter(c => c.id !== id))

  const maxFaltas = (c: ConfigCalendarioLetivo) => Math.floor(c.totalDiasLetivos * (1 - c.frequenciaMinima / 100))

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Calendário Letivo</h1>
          <p className="page-subtitle">
            Defina os dias letivos e frequência mínima exigida por lei (LDB, Art. 24)
          </p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)' }} onClick={openNew}>
          <Plus size={13} /> Novo Calendário
        </button>
      </div>

      {/* Info LDB */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, marginBottom: 24, borderLeft: '4px solid #3b82f6' }}>
        <BookOpen size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#3b82f6', marginBottom: 4 }}>Base Legal — LDB Art. 24</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
            A carga horária mínima é de <strong>200 dias letivos</strong> (800h/ano no EF e EM).
            O aluno que não atingir <strong>75% de frequência</strong> está sujeito à reprovação por faltas,
            independentemente das notas. Configure o calendário aqui para que o sistema calcule automaticamente
            os alertas de frequência crítica.
          </div>
        </div>
      </div>

      {/* KPIs do ano atual */}
      {calendarioAtual && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Ano Letivo Atual', value: calendarioAtual.ano, color: '#6366f1', icon: '📅' },
            { label: 'Dias Letivos', value: calendarioAtual.totalDiasLetivos, color: '#3b82f6', icon: '📚' },
            { label: 'Freq. Mínima', value: `${calendarioAtual.frequenciaMinima}%`, color: '#10b981', icon: '✅' },
            { label: 'Máx. Faltas Permitidas', value: maxFaltas(calendarioAtual), color: '#ef4444', icon: '❌' },
          ].map(c => (
            <div key={c.label} style={{ padding: '18px 20px', background: 'hsl(var(--bg-elevated))', borderRadius: 14, border: `1px solid ${c.color}20`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color }} />
              <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: c.color, fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {cfgCalendarioLetivo.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum calendário letivo configurado</div>
          <div style={{ fontSize: 12, marginBottom: 20 }}>
            Configure o calendário do ano letivo para habilitar alertas automáticos de frequência.
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={14} /> Configurar Calendário {ANO_ATUAL}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[...cfgCalendarioLetivo].sort((a, b) => b.ano - a.ano).map(cal => {
            const isCurrent = cal.ano === ANO_ATUAL
            const mf = maxFaltas(cal)
            const minPresencas = cal.totalDiasLetivos - mf
            const diasUteis = (() => {
              if (!cal.dataInicio || !cal.dataFim) return 0
              const ini = new Date(cal.dataInicio), fim = new Date(cal.dataFim)
              let d = 0, cur = new Date(ini)
              while (cur <= fim) { if (cur.getDay() !== 0 && cur.getDay() !== 6) d++; cur.setDate(cur.getDate() + 1) }
              return d
            })()

            return (
              <div key={cal.id} className="card" style={{ padding: '22px 24px', borderLeft: `4px solid ${isCurrent ? '#6366f1' : '#6b7280'}`, position: 'relative' }}>
                {isCurrent && (
                  <div style={{ position: 'absolute', top: 16, right: 16 }}>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 700, border: '1px solid rgba(99,102,241,0.25)' }}>
                      ✓ Ano atual
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: isCurrent ? 'rgba(99,102,241,0.12)' : 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20 }}>📅</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: isCurrent ? '#6366f1' : 'hsl(var(--text-primary))' }}>{cal.ano}</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                      {cal.dataInicio && cal.dataFim
                        ? `${new Date(cal.dataInicio).toLocaleDateString('pt-BR')} a ${new Date(cal.dataFim).toLocaleDateString('pt-BR')}`
                        : 'Datas não definidas'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
                  {[
                    { label: 'Dias Letivos', value: cal.totalDiasLetivos, color: '#3b82f6', icon: '📚' },
                    { label: 'Freq. Mínima', value: `${cal.frequenciaMinima}%`, color: '#10b981', icon: '✅' },
                    { label: 'Máx. Faltas', value: mf, color: '#ef4444', icon: '❌' },
                    { label: 'Mín. Presenças', value: minPresencas, color: '#6366f1', icon: '✓' },
                    { label: 'Dias Úteis Período', value: diasUteis, color: '#f59e0b', icon: '📆' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '10px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: `1px solid ${item.color}15` }}>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>{item.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: item.color, fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>{item.value}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Alertas */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {cal.frequenciaMinima < 75 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertTriangle size={11} /> Frequência mínima abaixo da exigência LDB (75%)
                    </div>
                  )}
                  {cal.totalDiasLetivos < 200 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.2)' }}>
                      <AlertTriangle size={11} /> Dias letivos abaixo do mínimo LDB (200 dias)
                    </div>
                  )}
                  {cal.frequenciaMinima >= 75 && cal.totalDiasLetivos >= 200 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)' }}>
                      <CheckCircle2 size={11} /> Configuração em conformidade com a LDB
                    </div>
                  )}
                  {cal.observacoes && (
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 'auto' }}>
                      📝 {cal.observacoes}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cal.id)}>
                    <Edit3 size={12} /> Editar
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(cal.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && <Modal form={form} onChange={setForm} onSave={handleSave} onClose={() => setModal(false)} editing={!!editingId} />}
    </div>
  )
}
