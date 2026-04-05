'use client'
import { useData, ConfigTipoOcorrencia, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Check, AlertTriangle, Bell, BellOff } from 'lucide-react'

const GRAV_CFG = {
  leve:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: '🟡 Leve' },
  media: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: '🔴 Média' },
  grave: { color: '#7f1d1d', bg: 'rgba(127,29,29,0.2)',   label: '⛔ Grave' },
}

const BLANK: Omit<ConfigTipoOcorrencia, 'id' | 'createdAt'> = {
  codigo: '', descricao: '', gravidade: 'leve', notificarResponsavel: true, pontosEscalonamento: 3, situacao: 'ativo',
}

export default function TipoOcorrenciasPage() {
  const { cfgTiposOcorrencia, setCfgTiposOcorrencia } = useData()
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Gera código sequencial garantindo unicidade (OC001, OC002...)
  const gerarCodigo = (): string => {
    const existentes = cfgTiposOcorrencia.map(t => t.codigo)
    let i = cfgTiposOcorrencia.length + 1
    let cod = `OC${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `OC${String(i).padStart(3, '0')}` }
    return cod
  }
  const codigoPreview = editId ? form.codigo : gerarCodigo()

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (t: ConfigTipoOcorrencia) => {
    setEditId(t.id)
    setForm({ codigo: t.codigo, descricao: t.descricao, gravidade: t.gravidade, notificarResponsavel: t.notificarResponsavel, pontosEscalonamento: t.pontosEscalonamento, situacao: t.situacao })
    setShowForm(true)
  }
  const handleDelete = (id: string) => setCfgTiposOcorrencia(prev => prev.filter(t => t.id !== id))
  const handleSave = () => {
    if (!form.descricao.trim()) return
    const codigo = editId ? form.codigo : gerarCodigo()
    if (editId) {
      setCfgTiposOcorrencia(prev => prev.map(t => t.id === editId ? { ...t, ...form, codigo } : t))
    } else {
      const novo: ConfigTipoOcorrencia = { ...form, codigo, id: newId('TO'), createdAt: new Date().toISOString() }
      setCfgTiposOcorrencia(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  const SUGESTOES = ['Indisciplina', 'Atraso recorrente', 'Bullying', 'Briga', 'Uso de celular', 'Desrespeito ao professor', 'Dano ao patrimônio', 'Evasão de aula', 'Linguagem inadequada', 'Porte de objetos proibidos']

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tipos de Ocorrências</h1>
          <p className="page-subtitle">Configure os tipos e gravidades para registro disciplinar</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Tipo</button>
      </div>

      {/* KPIs por gravidade */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {(['leve', 'media', 'grave'] as const).map(g => {
          const cfg = GRAV_CFG[g]
          const count = cfgTiposOcorrencia.filter(t => t.gravidade === g).length
          return (
            <div key={g} className="kpi-card" style={{ borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: cfg.color, fontFamily: 'Outfit, sans-serif' }}>{count}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{cfg.label}</div>
            </div>
          )
        })}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>{editId ? 'Editar Tipo' : 'Novo Tipo de Ocorrência'}</div>

          {!editId && (
            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Sugestões rápidas</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SUGESTOES.map(s => (
                  <button key={s} type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                    onClick={() => setForm(p => ({ ...p, descricao: s }))}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, marginBottom: 12 }}>
            {/* Código auto-gerado — somente leitura */}
            <div>
              <label className="form-label">Código</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-elevated))' }}>
                <span style={{ padding: '0 8px', fontSize: 10, color: 'hsl(var(--text-muted))', borderRight: '1px solid hsl(var(--border-subtle))', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>AUTO</span>
                <span style={{ padding: '0 10px', fontWeight: 900, fontSize: 14, fontFamily: 'monospace', color: GRAV_CFG[form.gravidade].color, letterSpacing: '0.05em' }}>
                  {codigoPreview}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 3 }}>Sequencial automático</div>
            </div>
            <div>
              <label className="form-label">Descrição *</label>
              <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Indisciplina em sala" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Gravidade</label>
              <select className="form-input" value={form.gravidade} onChange={e => setForm(p => ({ ...p, gravidade: e.target.value as 'leve' | 'media' | 'grave' }))}>
                <option value="leve">🟡 Leve</option>
                <option value="media">🔴 Média</option>
                <option value="grave">⛔ Grave</option>
              </select>
            </div>
            <div>
              <label className="form-label">Pontos p/ escalonar</label>
              <input className="form-input" type="number" min={1} max={20} value={form.pontosEscalonamento}
                onChange={e => setForm(p => ({ ...p, pontosEscalonamento: +e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Notif. Responsável</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setForm(p => ({ ...p, notificarResponsavel: true }))}
                  className={`btn btn-sm ${form.notificarResponsavel ? 'btn-primary' : 'btn-secondary'}`}><Bell size={11} />Sim</button>
                <button type="button" onClick={() => setForm(p => ({ ...p, notificarResponsavel: false }))}
                  className={`btn btn-sm ${!form.notificarResponsavel ? 'btn-primary' : 'btn-secondary'}`}><BellOff size={11} />Não</button>
              </div>
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />{editId ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      )}

      {/* Cards de tipos */}
      {cfgTiposOcorrencia.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <AlertTriangle size={44} style={{ margin: '0 auto 14px', opacity: 0.2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum tipo cadastrado</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>Crie tipos de ocorrência para organizar registros disciplinares.</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Cadastrar primeiro tipo</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Código</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'center' }}>Gravidade</th>
                <th style={{ textAlign: 'center' }}>Pontos</th>
                <th style={{ textAlign: 'center' }}>Notif. Resp.</th>
                <th style={{ textAlign: 'center' }}>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cfgTiposOcorrencia.map(t => {
                const gc = GRAV_CFG[t.gravidade]
                return (
                  <tr key={t.id}>
                    <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: gc.color }}>{t.codigo}</code></td>
                    <td style={{ fontWeight: 600 }}>{t.descricao}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: gc.bg, color: gc.color, fontWeight: 700 }}>{gc.label}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: t.pontosEscalonamento <= 2 ? '#f87171' : 'hsl(var(--text-secondary))' }}>{t.pontosEscalonamento}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {t.notificarResponsavel ? <Bell size={14} color="#34d399" /> : <BellOff size={14} color="hsl(var(--text-muted))" />}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${t.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{t.situacao === 'ativo' ? '✓ Ativo' : '✗ Inativo'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(t)}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button>
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
  )
}
