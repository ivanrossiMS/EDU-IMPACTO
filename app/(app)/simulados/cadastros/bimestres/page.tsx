'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Plus, Trash2, Edit2, Search, Calendar, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useData } from '@/lib/dataContext'

export default function BimestresPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ nome: '', data_inicio: '', data_fim: '', status: 'ativo', ano_letivo: '' })
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { cfgCalendarioLetivo = [] } = useData()

  const refresh = async () => {
    setLoading(true)
    const { data: bims } = await supabase.from('simulados_bimestres').select('*').order('nome')
    setData(bims || [])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])
  

  const handleOpen = (item?: any) => {
    if (item) {
      setEditingId(item.id)
      setFormData({ nome: item.nome, data_inicio: item.data_inicio || '', data_fim: item.data_fim || '', status: item.status, ano_letivo: item.ano_letivo || '' })
    } else {
      setEditingId(null)
      const anoAtivo = cfgCalendarioLetivo.find((a: any) => a.status === 'Aberto')?.ano || ''
      setFormData({ nome: '', data_inicio: '', data_fim: '', status: 'ativo', ano_letivo: anoAtivo })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nome) return alert('O nome é obrigatório')
    setIsSaving(true)
    try {
      if (editingId) {
        const { error } = await (supabase as any).from('simulados_bimestres').update({ ...formData }).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await (supabase as any).from('simulados_bimestres').insert([{ ...formData }])
        if (error) throw error
      }
      await refresh()
      setIsModalOpen(false)
    } catch (e: any) {
      console.error(e)
      alert('Erro ao salvar: ' + (e.message || 'Desconhecido'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir?')) return
    await (supabase as any).from('simulados_bimestres').delete().eq('id', id)
    await refresh()
  }

  const filtered = data?.filter(item => item.nome.toLowerCase().includes(search.toLowerCase())) || []

  const getYear = (item: any) => {
    if (item.ano_letivo) return item.ano_letivo;
    const match = item.nome.match(/\b(20\d{2})\b/);
    if (match) return match[1];
    if (item.data_inicio) return item.data_inicio.substring(0, 4);
    return 'Sem Ano';
  }

  const grouped = filtered.reduce((acc, item) => {
    const year = getYear(item);
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedYears = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="bimestres-container" style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        @media (max-width: 768px) {
          .bimestres-container { padding: 16px !important; margin: 0 !important; }
          .responsive-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; padding: 20px !important; }
          .responsive-header h1 { font-size: 24px !important; }
          .responsive-btn { width: 100% !important; justify-content: center !important; }
        }
      `}</style>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div className="responsive-header" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 40,
          background: 'linear-gradient(135deg, hsl(var(--bg-surface)) 0%, hsl(var(--bg-elevated)) 100%)',
          padding: '28px 36px',
          borderRadius: 24,
          border: '1px solid hsl(var(--border-subtle))',
          boxShadow: '0 10px 30px -15px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
              <Layers size={32} color="#f43f5e" />
            </div>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.03em' }}>Bimestres</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '6px 0 0', fontSize: 15 }}>Ciclos e períodos para os simulados</p>
            </div>
          </div>
          
          <motion.button 
            className="responsive-btn"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpen()}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 14, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', color: '#fff', fontWeight: 800, border: 'none', boxShadow: '0 10px 25px -10px rgba(244,63,94,0.6)', cursor: 'pointer' }}
          >
            <Plus size={20} /> Novo Bimestre
          </motion.button>
        </div>

        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: '24px 32px' }}>
          
          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Pesquisar bimestres..." 
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '16px 20px 16px 52px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                onFocus={e => e.target.style.borderColor = '#f43f5e'}
                onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
              />
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 40, height: 40, border: '4px solid rgba(244,63,94,0.2)', borderTopColor: '#f43f5e', borderRadius: '50%' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'hsl(var(--bg-app))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 24, padding: 80, textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(244,63,94,0.05)', color: '#f43f5e', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={36} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Nenhum bimestre encontrado</h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, maxWidth: 400, margin: '0 auto' }}>Adicione bimestres para organizar seus simulados no tempo.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
              {sortedYears.map((year, yIdx) => (
                <div key={year}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 8, height: 24, borderRadius: 4, background: '#f43f5e' }} />
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>Ano Letivo {year}</h2>
                    <div style={{ padding: '4px 10px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {grouped[year].length} bimestre{grouped[year].length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
                    {grouped[year].map((item: any, i: number) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        key={item.id} 
                        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16, background: 'hsl(var(--bg-app))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.borderColor = '#f43f5e'
                          e.currentTarget.style.boxShadow = '0 8px 20px -5px rgba(244,63,94,0.1)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em', marginBottom: 6 }}>{item.nome}</div>
                            {item.status === 'ativo' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 100, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}><CheckCircle2 size={10} /> Ativo</div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 100, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}><XCircle size={10} /> Inativo</div>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', gap: 4 }}>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleOpen(item)} style={{ background: 'rgba(100, 116, 139, 0.1)', border: 'none', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-primary))', transition: 'background 0.2s' }}>
                              <Edit2 size={14} />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1, background: 'rgba(239,68,68,0.15)' }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239,68,68,0.05)', border: 'none', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s' }}>
                              <Trash2 size={14} />
                            </motion.button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'hsl(var(--bg-surface))', padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                          <Calendar size={14} color="hsl(var(--text-secondary))" />
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                            {item.data_inicio ? `${item.data_inicio.split('-').reverse().join('/')} até ${item.data_fim.split('-').reverse().join('/')}` : 'Período não definido'}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} style={{ position: 'relative', width: '100%', maxWidth: 500, background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 32, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.3)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={24} />
                </div>
                <div>
                  <h2 style={{ color: 'hsl(var(--text-primary))', margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{editingId ? 'Editar Bimestre' : 'Novo Bimestre'}</h2>
                  <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Preencha as informações do período</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Ano Letivo</label>
                  <select value={formData.ano_letivo} onChange={e => setFormData({...formData, ano_letivo: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }} onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'}>
                    <option value="">Selecione um ano letivo</option>
                    {cfgCalendarioLetivo.map((ano: any) => (
                      <option key={ano.id} value={ano.ano}>{ano.ano}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Nome (Ex: 1º Bimestre)</label>
                  <input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Data Início</label>
                    <input type="date" value={formData.data_inicio} onChange={e => setFormData({...formData, data_inicio: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Data Fim</label>
                    <input type="date" value={formData.data_fim} onChange={e => setFormData({...formData, data_fim: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#f43f5e'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
                <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'} onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--bg-app))'}>Cancelar</button>
                <button onClick={handleSave} disabled={isSaving} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, #f43f5e, #be123c)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, boxShadow: '0 8px 20px -8px rgba(244,63,94,0.6)', opacity: isSaving ? 0.7 : 1 }}>{isSaving ? 'Salvando...' : 'Salvar Bimestre'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
