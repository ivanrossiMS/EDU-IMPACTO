'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useData, ConfigSerie, newId } from '@/lib/dataContext'
import { useState, useEffect } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import { CardSkeleton } from '@/components/skeletons/CardSkeleton'
import { UpdatingIndicator } from '@/components/skeletons/States'
import { Plus, Edit2, Trash2, Check, X, BookOpen, Building2, Sparkles, AlertCircle } from 'lucide-react'

const LEVEL_COLORS: Record<string, string> = {
  'EI': '#ec4899', 'EF1': '#3b82f6', 'EF2': '#8b5cf6', 'EM': '#10b981', 'EJA': '#f59e0b',
}

export default function SeriesPage() {
  const { data: rawConfig, isLoading, isFetching } = useApiQuery<{ valor: ConfigSerie[] }>(['config-series'], '/api/configuracoes?chave=cfgSeries')
  const { data: rawNiveis } = useApiQuery<{ valor: any[] }>(['config-niveis-ensino'], '/api/configuracoes?chave=cfgNiveisEnsino')
  const { data: rawMantenedores } = useApiQuery<any[]>(['mantenedores'], '/api/configuracoes/mantenedores')
  
  const [cfgSeries, setCfgSeries] = useState<ConfigSerie[]>([])
  const cfgNiveisEnsino = rawNiveis?.valor || []
  const mantenedores = rawMantenedores || []
  const todasUnidades = (mantenedores || []).flatMap((m: any) => m.unidades ?? [])

  useEffect(() => {
    if (rawConfig?.valor) {
      setCfgSeries(rawConfig.valor)
    }
  }, [rawConfig])
  const niveisAtivos = (cfgNiveisEnsino || []).filter(n => n.situacao === 'ativo')

  type FormSerie = { nome: string; nivelEnsinoId: string; situacao: 'ativo' | 'inativo'; unidadeIds: string[] }
  const BLANK: FormSerie = { nome: '', nivelEnsinoId: '', situacao: 'ativo', unidadeIds: [] }

  const [form, setForm] = useState<FormSerie>(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Gerar proximo código sequencial "01", "02", etc.
  const gerarProximoCodigo = () => {
    if (!cfgSeries || cfgSeries.length === 0) return '01'
    const codigosNum = cfgSeries.map(s => parseInt(s.codigo, 10)).filter(n => !isNaN(n))
    if (codigosNum.length === 0) return '01'
    return String(Math.max(...codigosNum) + 1).padStart(2, '0')
  }

  const codigoPreview = editId ? editCodigo : gerarProximoCodigo()

  const openNew = () => {
    setEditId(null); setEditCodigo(''); setForm(BLANK); setShowForm(true)
  }

  const openEdit = (s: ConfigSerie) => {
    setEditId(s.id); setEditCodigo(s.codigo)
    setForm({ nome: s.nome, nivelEnsinoId: s.nivelEnsinoId, situacao: s.situacao, unidadeIds: s.unidadeIds ?? [] })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.nome.trim() || !form.nivelEnsinoId) return
    const codigo = editId ? editCodigo : gerarProximoCodigo()

    if (editId) {
      setCfgSeries(prev => prev.map(s => s.id === editId ? { ...s, ...form, codigo } : s))
    } else {
      const novoId = newId('SER')
      setCfgSeries(prev => {
        // Prevencao duplicidade basica
        if (prev.some(s => s.nome.toLowerCase() === form.nome.trim().toLowerCase() && s.nivelEnsinoId === form.nivelEnsinoId)) {
          alert('Já existe uma série com este nome para este nível de ensino!')
          return prev
        }
        return [...prev, { ...form, id: novoId, codigo, createdAt: new Date().toISOString() }]
      })
    }
    setShowForm(false)
  }

  const handleToggle = (id: string) =>
    setCfgSeries(prev => prev.map(s => s.id === id ? { ...s, situacao: s.situacao === 'ativo' ? 'inativo' : 'ativo' } : s))

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja apagar esta série? Isso afetará turmas vinculadas a ela.')) {
      setCfgSeries(prev => prev.filter(s => s.id !== id))
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Séries e Anos</span>
            {isFetching && <UpdatingIndicator />}
          </h1>
          <p className="page-subtitle">Gerenciamento independente das séries vinculadas aos Níveis de Ensino</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} /> Nova Série</button>
        </div>
      </div>

      {isLoading && cfgSeries.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: '20px', minHeight: 160 }}><CardSkeleton /></div>
            <div className="card" style={{ padding: '20px', minHeight: 160 }}><CardSkeleton /></div>
            <div className="card" style={{ padding: '20px', minHeight: 160 }}><CardSkeleton /></div>
          </div>
        ) : cfgSeries.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px dashed hsl(var(--border-subtle))' }}>
            <BookOpen size={48} style={{ opacity: 0.1, margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Nenhuma série cadastrada</h3>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', maxWidth: 400, margin: '8px auto 20px' }}>
              As séries operam vinculadas aos Níveis de Ensino. Você já pode criar sua primeira série.
            </p>
            <button className="btn btn-primary" onClick={openNew}><Plus size={14} /> Cadastrar Série</button>
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
          {cfgSeries.sort((a, b) => Number(a.codigo) - Number(b.codigo)).map(s => {
            const nivel = cfgNiveisEnsino?.find(n => n.id === s.nivelEnsinoId)
            const cor = nivel ? (LEVEL_COLORS[nivel.codigo] || '#3b82f6') : '#6b7280'
            const extColor = s.situacao === 'inativo' ? '#9ca3af' : cor

            return (
              <div key={s.id} className="card" style={{ padding: '20px', borderLeft: `4px solid ${extColor}`, opacity: s.situacao === 'inativo' ? 0.6 : 1 }}>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ 
                    background: `${extColor}15`, color: extColor, 
                    fontWeight: 900, fontSize: 18, fontFamily: 'monospace', 
                    padding: '8px 12px', borderRadius: 10, flexShrink: 0,
                    border: `1px solid ${extColor}30`
                  }}>
                    {s.codigo}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', lineHeight: 1.2, marginBottom: 4 }}>
                        {s.nome}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(s)}><Edit2 size={12} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(s.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                      <BookOpen size={12} /> {nivel ? nivel.nome : 'Nível Desconhecido'}
                    </div>

                    {(s.unidadeIds ?? []).length > 0 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                        {(s.unidadeIds ?? []).map(uid => {
                          const u = todasUnidades.find(x => x.id === uid)
                          return u ? (
                            <span key={uid} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-secondary))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Building2 size={9} />{u.nomeFantasia || u.razaoSocial}
                            </span>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                        <AlertCircle size={10} /> Sem unidades vinculadas
                      </div>
                    )}

                    <button onClick={() => handleToggle(s.id)}
                      style={{ 
                        width: '100%', padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${s.situacao === 'ativo' ? 'rgba(16,185,129,0.3)' : 'rgba(156,163,175,0.3)'}`,
                        background: s.situacao === 'ativo' ? 'rgba(16,185,129,0.05)' : 'rgba(156,163,175,0.05)',
                        color: s.situacao === 'ativo' ? '#10b981' : '#6b7280'
                      }}>
                      {s.situacao === 'ativo' ? '✓ Ativa' : '✗ Inativa — clicar para ativar'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
{/* Modal CRUD */}
      {showForm && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 540, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', marginBottom: 24 }}>

            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{editId ? 'Editar Série / Ano' : 'Nova Série / Ano'}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap:4 }}>Código <Sparkles size={10} color="#f59e0b"/></label>
                  <div style={{ height: 38, background: 'hsl(var(--bg-overlay))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontFamily: 'monospace', fontSize: 16, border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-muted))' }}>
                    {codigoPreview}
                  </div>
                </div>
                <div>
                  <label className="form-label">Descrição (Nome da Série) *</label>
                  <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: 1º Ano, Berçário, Fase I..." autoFocus />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 20 }}>
                <div>
                  <label className="form-label">Nível de Ensino *</label>
                  <select className="form-input" value={form.nivelEnsinoId} onChange={e => setForm(p => ({ ...p, nivelEnsinoId: e.target.value }))}>
                    <option value="">Selecionar...</option>
                    {niveisAtivos.map(n => (
                      <option key={n.id} value={n.id}>{n.nome}</option>
                    ))}
                  </select>
                  {niveisAtivos.length === 0 && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>Nenhum nível ativo encontrado.</div>}
                </div>
                <div>
                  <label className="form-label">Situação</label>
                  <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                    <option value="ativo">✓ Ativa</option>
                    <option value="inativo">✗ Inativa</option>
                  </select>
                </div>
              </div>

              {/* Unidades */}
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Building2 size={13} /> Unidades que oferecem esta série
                </label>
                {todasUnidades.length === 0 ? (
                  <div style={{ padding: '12px', background: 'rgba(245,158,11,0.05)', border: '1px dashed rgba(245,158,11,0.5)', borderRadius: 8, fontSize: 12, color: '#f59e0b' }}>
                    Nenhuma unidade cadastrada.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                    {todasUnidades.map(u => {
                      const checked = form.unidadeIds.includes(u.id)
                      return (
                        <label key={u.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          background: checked ? 'rgba(99,102,241,0.08)' : 'hsl(var(--bg-elevated))',
                          border: `1px solid ${checked ? 'rgba(99,102,241,0.4)' : 'hsl(var(--border-subtle))'}`,
                          transition: 'all 0.15s'
                        }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setForm(p => ({
                              ...p,
                              unidadeIds: checked
                                ? p.unidadeIds.filter(id => id !== u.id)
                                : [...p.unidadeIds, u.id]
                            }))}
                            style={{ accentColor: '#6366f1', width: 14, height: 14 }}
                          />
                          <div style={{ flex: 1, fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? '#6366f1' : 'inherit' }}>
                            {u.nomeFantasia || u.razaoSocial}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
               <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={handleSave} disabled={!form.nome.trim() || !form.nivelEnsinoId}>
                 <Check size={13} /> {editId ? 'Salvar Alterações' : 'Cadastrar Série'}
               </button>
            </div>

          </motion.div>
        
</motion.div>
)}</AnimatePresence>
    </div>
  )
}
