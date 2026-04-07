'use client'

import { useState, useRef, useEffect } from 'react'
import { FileText, Download, Search, Plus, CheckCircle, Clock, AlertCircle, Archive, Trash2, Save, X, FolderOpen, ChevronRight, Users, FileCheck, Lock, RefreshCw } from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { newId } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'

const TIPOS_DOC = ['Declaração de Matrícula', 'Histórico Escolar', 'Declaração de Frequência', 'Atestado de Série', 'Transferência', 'Nada Consta Financeiro']

type StatusDoc = 'pronto' | 'andamento' | 'bloqueado'
interface Solicitacao {
  id: string; aluno: string; tipo: string; data: string; status: StatusDoc; retirada: string
}
const BLANK: Omit<Solicitacao, 'id' | 'data'> = { aluno: '', tipo: TIPOS_DOC[0], status: 'andamento', retirada: 'Presencial' }

const S_CFG: Record<StatusDoc, { color: string; badge: string; label: string; icon: React.ReactNode }> = {
  pronto:    { color: '#10b981', badge: 'badge-success', label: 'Pronto',               icon: <CheckCircle size={11} /> },
  andamento: { color: '#3b82f6', badge: 'badge-primary', label: 'Em andamento',          icon: <Clock size={11} /> },
  bloqueado: { color: '#ef4444', badge: 'badge-danger',  label: 'Bloqueado (inadim.)', icon: <AlertCircle size={11} /> },
}

// ── Arquivo digital: categorias e arquivos fictícios por aluno ───────────────
const ARQUIVO_CATS = [
  { key: 'prontuarios', label: 'Prontuários Alunos', icon: '🎓', color: '#3b82f6',
    getFiles: (alunos: any[]) => alunos.map(a => ({ nome: `Prontuário - ${a.nome}`, tipo: 'PDF', data: '2025', size: '245 KB' })) },
  { key: 'contratos',   label: 'Contratos',           icon: '📝', color: '#8b5cf6',
    getFiles: (alunos: any[]) => alunos.map(a => ({ nome: `Contrato Código - ${a.nome}`, tipo: 'PDF', data: '2025', size: '122 KB' })) },
  { key: 'funcionarios', label: 'Docs. Funcionários', icon: '👤', color: '#10b981',
    getFiles: (_: any[], func: any[]) => func.map(f => ({ nome: `Admissão - ${f.nome}`, tipo: 'PDF', data: '2025', size: '98 KB' })) },
  { key: 'atas',        label: 'Atas Conselho',        icon: '📋', color: '#f59e0b',
    getFiles: () => [
      { nome: 'Ata Conselho Classe - 1º Bim 2025', tipo: 'PDF', data: '2025-06', size: '340 KB' },
      { nome: 'Ata Conselho Classe - 2º Bim 2025', tipo: 'PDF', data: '2025-08', size: '290 KB' },
    ] },
  { key: 'transferencias', label: 'Transferências', icon: '🔄', color: '#ef4444',
    getFiles: (_: any[], __: any[], sol: any[]) => sol.filter(s => s.tipo === 'Transferência').map(s => ({ nome: `Transf. - ${s.aluno}`, tipo: 'PDF', data: s.data, size: '78 KB' })) },
  { key: 'lgpd',        label: 'LGPD / Autorizações', icon: '🔒', color: '#6b7280',
    getFiles: (alunos: any[]) => alunos.map(a => ({ nome: `Autorização LGPD - ${a.nome}`, tipo: 'PDF', data: '2025', size: '56 KB' })) },
]

// ── Autocomplete de aluno ────────────────────────────────────────────────────
function AlunoAutocomplete({ value, onChange, alunos, placeholder = 'Buscar aluno...' }: {
  value: string; onChange: (v: string) => void
  alunos: { id: string; nome: string; turma: string }[]
  placeholder?: string
}) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const suggestions = alunos.filter(a => a.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 8)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  // sync external value
  useEffect(() => { if (value !== q) setQ(value) }, [value])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Search size={12} style={{ color: 'hsl(var(--text-muted))' }} />
      </div>
      <input className="form-input" style={{ paddingLeft: 30 }} placeholder={placeholder}
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && q.length > 0 && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.35)', overflow: 'hidden', marginTop: 4 }}>
          {suggestions.map(a => (
            <button key={a.id} type="button"
              onMouseDown={() => { onChange(a.nome); setQ(a.nome); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-hover))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                {getInitials(a.nome)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.turma}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal de arquivos ────────────────────────────────────────────────────────
function ArquivoModal({ cat, files, onClose }: { cat: typeof ARQUIVO_CATS[0]; files: { nome: string; tipo: string; data: string; size: string }[]; onClose: () => void }) {
  const [busca, setBusca] = useState('')
  const filtered = files.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 20, padding: 28, width: '100%', maxWidth: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-default))' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {cat.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{cat.label}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{files.length} arquivo(s) encontrado(s)</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
            <X size={14} />
          </button>
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
          <input className="form-input" style={{ paddingLeft: 30, fontSize: 12 }} placeholder="Buscar arquivo..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              {files.length === 0 ? 'Nenhum arquivo nesta categoria' : 'Nenhum arquivo com essa busca'}
            </div>
          ) : filtered.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${cat.color}40`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))')}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${cat.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={16} style={{ color: cat.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.tipo} • {f.size} • {f.data}</div>
              </div>
              <button style={{ padding: '5px 12px', borderRadius: 8, background: `${cat.color}12`, border: `1px solid ${cat.color}30`, color: cat.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Download size={11} />Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function SecretariaPage() {
  const { alunos, funcionarios } = useData()
  const [tab, setTab] = useState<'solicitacoes' | 'docs' | 'arquivo'>('solicitacoes')
  const [solicitacoes, setSolicitacoes] = useLocalStorage<Solicitacao[]>('edu-secretaria-solicitacoes', [])
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusDoc>('todos')
  const [form, setForm] = useState<Omit<Solicitacao, 'id' | 'data'>>(BLANK)
  const [showForm, setShowForm] = useState(false)
  const [del, setDel] = useState<string | null>(null)
  const [tipoDoc, setTipoDoc] = useState(TIPOS_DOC[0])
  const [alunoSel, setAlunoSel] = useState('')
  const [arquivoCat, setArquivoCat] = useState<typeof ARQUIVO_CATS[0] | null>(null)

  const filtered = solicitacoes.filter(s => {
    const mb = !search || s.aluno.toLowerCase().includes(search.toLowerCase())
    const ms = filtroStatus === 'todos' || s.status === filtroStatus
    return mb && ms
  })
  const prontos = solicitacoes.filter(s => s.status === 'pronto').length

  const save = () => {
    if (!form.aluno.trim()) return
    setSolicitacoes(prev => [...prev, { ...form, id: newId('SEC'), data: new Date().toLocaleDateString('pt-BR') }])
    setForm(BLANK); setShowForm(false)
  }
  const concluir = (id: string) => setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status: 'pronto' } : s))
  const remove = () => { if (del) { setSolicitacoes(prev => prev.filter(s => s.id !== del)); setDel(null) } }
  const ff = (k: keyof typeof BLANK, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  // Obter arquivos da categoria selecionada
  const getFiles = (cat: typeof ARQUIVO_CATS[0]) => cat.getFiles(alunos, funcionarios, solicitacoes)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🗂️ Secretaria Escolar</h1>
          <p className="page-subtitle">Atendimento, documentos e arquivo — {prontos} prontos para retirada</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setTab('docs'); setShowForm(false) }}><Plus size={13} />Novo Documento</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Prontos para retirada', value: prontos, color: '#10b981', icon: '✅' },
          { label: 'Em andamento', value: solicitacoes.filter(s => s.status === 'andamento').length, color: '#3b82f6', icon: '⏳' },
          { label: 'Bloqueados', value: solicitacoes.filter(s => s.status === 'bloqueado').length, color: '#ef4444', icon: '🚫' },
          { label: 'Total solicitações', value: solicitacoes.length, color: '#8b5cf6', icon: '📋' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom: 16, width: 'fit-content' }}>
        <button className={`tab-trigger ${tab === 'solicitacoes' ? 'active' : ''}`} onClick={() => setTab('solicitacoes')}>📋 Solicitações</button>
        <button className={`tab-trigger ${tab === 'docs' ? 'active' : ''}`} onClick={() => setTab('docs')}>📄 Emitir Documento</button>
        <button className={`tab-trigger ${tab === 'arquivo' ? 'active' : ''}`} onClick={() => setTab('arquivo')}><Archive size={12} />Arquivo Digital</button>
      </div>

      {/* ── Solicitações ── */}
      {tab === 'solicitacoes' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar por aluno..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {([['todos', 'Todos'], ['pronto', '✅ Prontos'], ['andamento', '⏳ Andamento'], ['bloqueado', '🚫 Bloqueados']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFiltroStatus(v as any)}
                  style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: filtroStatus === v ? '#3b82f620' : 'transparent',
                    border: `1px solid ${filtroStatus === v ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                    color: filtroStatus === v ? '#3b82f6' : 'hsl(var(--text-muted))' }}>{l}</button>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(!showForm)}><Plus size={13} />Nova Solicitação</button>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginLeft: 'auto' }}>{filtered.length}/{solicitacoes.length}</span>
          </div>

          {showForm && (
            <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Registrar Solicitação</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Aluno *</label>
                  {alunos.length > 0 ? (
                    <AlunoAutocomplete value={form.aluno} onChange={v => ff('aluno', v)} alunos={alunos} />
                  ) : (
                    <input className="form-input" value={form.aluno} onChange={e => ff('aluno', e.target.value)} placeholder="Nome do aluno" />
                  )}
                </div>
                <div><label className="form-label">Tipo de Documento</label>
                  <select className="form-input" value={form.tipo} onChange={e => ff('tipo', e.target.value)}>
                    {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => ff('status', e.target.value as StatusDoc)}>
                    <option value="andamento">Em andamento</option>
                    <option value="pronto">Pronto</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
                <div><label className="form-label">Forma de retirada</label>
                  <select className="form-input" value={form.retirada} onChange={e => ff('retirada', e.target.value)}>
                    <option>Presencial</option>
                    <option>E-mail</option>
                    <option>WhatsApp</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={save}><Save size={13} />Registrar</button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: '50px 24px', textAlign: 'center' }}>
              <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                {solicitacoes.length === 0 ? 'Nenhuma solicitação' : 'Nenhuma solicitação com esses filtros'}
              </div>
              {solicitacoes.length === 0 && (
                <>
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Registre solicitações de documentos dos alunos.</div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={13} />Nova Solicitação</button>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(s => {
                const cfg = S_CFG[s.status]
                return (
                  <div key={s.id} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: cfg.color }}>
                      <FileText size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{s.aluno}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{s.tipo} · {s.retirada} · {s.data}</div>
                    </div>
                    <span className={`badge ${cfg.badge}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{cfg.icon}{cfg.label}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {s.status === 'pronto' && <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}><Download size={11} />Download</button>}
                      {s.status === 'andamento' && <button className="btn btn-success btn-sm" style={{ fontSize: 11 }} onClick={() => concluir(s.id)}><CheckCircle size={11} />Concluir</button>}
                      <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => setDel(s.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Emitir Documento ── */}
      {tab === 'docs' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Emitir Documento Escolar</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="form-label">Aluno *</label>
              {alunos.length > 0 ? (
                <AlunoAutocomplete
                  value={alunos.find(a => a.id === alunoSel)?.nome ?? alunoSel}
                  onChange={v => {
                    const found = alunos.find(a => a.nome.toLowerCase() === v.toLowerCase())
                    setAlunoSel(found ? found.id : v)
                  }}
                  alunos={alunos}
                  placeholder="Buscar aluno pelo nome..."
                />
              ) : (
                <div className="form-input" style={{ color: 'hsl(var(--text-muted))', cursor: 'default' }}>Nenhum aluno cadastrado</div>
              )}
            </div>
            <div><label className="form-label">Tipo de Documento</label>
              <select className="form-input" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="form-label">Ano de referência</label>
              <select className="form-input">{[2026, 2025, 2024, 2023].map(y => <option key={y}>{y}</option>)}</select>
            </div>
            <div><label className="form-label">Forma de entrega</label>
              <select className="form-input"><option>Presencial</option><option>E-mail</option><option>WhatsApp</option></select>
            </div>
            <div style={{ gridColumn: '1/-1' }}><label className="form-label">Finalidade (opcional)</label>
              <input className="form-input" placeholder="Ex: Abertura de conta, Código em outra escola, Bolsa..." />
            </div>
          </div>

          {/* Preview do aluno selecionado */}
          {alunoSel && (() => {
            const a = alunos.find(al => al.id === alunoSel)
            if (!a) return null
            return (
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{getInitials(a.nome)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.nome}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Turma: {a.turma} · Cód: {a.codigo || a.matricula || '—'}</div>
                </div>
              </div>
            )
          })()}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary">Pré-visualizar</button>
            <button className="btn btn-primary" disabled={!alunoSel && alunos.length > 0}><FileText size={13} />Gerar e enviar</button>
          </div>

          {alunos.length === 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', borderRadius: 10, fontSize: 12, color: '#fbbf24' }}>
              ⚠️ Cadastre alunos no módulo de Alunos para emitir documentos.
            </div>
          )}
        </div>
      )}

      {/* ── Arquivo Digital ── */}
      {tab === 'arquivo' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>📁 Arquivo Digital</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Clique em uma categoria para visualizar e baixar os arquivos</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {ARQUIVO_CATS.map(cat => {
              const files = getFiles(cat)
              return (
                <button key={cat.key} onClick={() => setArquivoCat(cat)}
                  style={{ padding: '22px 20px', borderRadius: 14, background: `${cat.color}08`, border: `1px solid ${cat.color}20`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'block', width: '100%', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${cat.color}20`; e.currentTarget.style.borderColor = `${cat.color}50` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = `${cat.color}20` }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cat.color }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 13, background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>{cat.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: cat.color, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{files.length}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>arquivo(s)</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${cat.color}15` }}>
                    <span style={{ fontSize: 11, color: cat.color, fontWeight: 700 }}>Ver arquivos</span>
                    <ChevronRight size={14} style={{ color: cat.color }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de arquivos */}
      {arquivoCat && (
        <ArquivoModal cat={arquivoCat} files={getFiles(arquivoCat)} onClose={() => setArquivoCat(null)} />
      )}

      {/* Modal de delete */}
      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, padding: 28, maxWidth: 380, border: '1px solid hsl(var(--border-default))', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, marginBottom: 20 }}>Excluir solicitação?</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={remove}><Trash2 size={13} />Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
