'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Plus, Trash2, Edit2, Search, User, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function DisciplinasPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ nome: '', cor: '#3b82f6', professores_ids: [] as string[], quantidade_questoes: 10, segmento: 'Ens. Fund2/Médio' })
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [professores, setProfessores] = useState<any[]>([])

  const refresh = async () => {
    setLoading(true)
    const { data: disc } = await supabase.from('simulados_disciplinas').select('*, system_users(nome)').order('nome')
    setData(disc || [])
    setLoading(false)
  }

  const loadProfessores = async () => {
    try {
      const res = await fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
      if (res.ok) {
        const json = await res.json()
        const data = json.data || json
        setProfessores(data.filter((u: any) => u.perfil === 'Professor' && u.status === 'ativo'))
      }
    } catch(e) {}
  }

  useEffect(() => { refresh(); loadProfessores() }, [])
  

  const handleOpen = (item?: any) => {
    if (item) {
      setEditingId(item.id)
      
      // Migration from single id_professor to array
      let initialProfs: string[] = [];
      if (typeof item.professores_ids === 'string') {
        try { initialProfs = JSON.parse(item.professores_ids) } catch(e) {}
      } else if (Array.isArray(item.professores_ids)) {
        initialProfs = item.professores_ids;
      } else if (item.id_professor) {
        initialProfs = [item.id_professor];
      }

      setFormData({ 
        nome: item.nome, 
        cor: item.cor || '#3b82f6', 
        professores_ids: initialProfs, 
        quantidade_questoes: item.quantidade_questoes || 10,
        segmento: (item.segmento === 'Ens. Médio' || item.segmento === 'Ens. Fundamental II' || item.segmento === 'Ens. Funf2/Médio') ? 'Ens. Fund2/Médio' : (item.segmento || 'Ens. Fund2/Médio')
      })
    } else {
      setEditingId(null)
      setFormData({ nome: '', cor: '#3b82f6', professores_ids: [], quantidade_questoes: 10, segmento: 'Ens. Fund2/Médio' })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nome) return alert('O nome é obrigatório')
    setIsSaving(true)
    try {
      // Garantir que será salvo como array JSON corretamente ou converter se necessário
      const payload = { ...formData, professores_ids: JSON.stringify(formData.professores_ids) }
      
      if (editingId) {
        const { error } = await supabase.from('simulados_disciplinas').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('simulados_disciplinas').insert([payload])
        if (error) throw error
      }
      await refresh()
      setIsModalOpen(false)
    } catch (e: any) {
      console.error(e)
      alert(`Erro ao salvar. Verifique se a coluna "professores_ids" existe.\n\nDetalhes do erro: ${e.message || 'Desconhecido'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir?')) return
    await supabase.from('simulados_disciplinas').delete().eq('id', id)
    await refresh()
  }

  const filtered = data?.filter(item => item.nome.toLowerCase().includes(search.toLowerCase())) || []

  const grouped = filtered.reduce((acc, item) => {
    let seg = item.segmento || 'Sem Segmento';
    if (seg === 'Ens. Médio' || seg === 'Ens. Fundamental II' || seg === 'Ens. Funf2/Médio') {
      seg = 'Ens. Fund2/Médio';
    }
    if (!acc[seg]) acc[seg] = [];
    acc[seg].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const order = ['Ed. Infantil', 'Ens. Fundamental I', 'Ens. Fund2/Médio', 'Sem Segmento'];
  const sortedSegments = Object.keys(grouped).sort((a, b) => {
    const idxA = order.indexOf(a);
    const idxB = order.indexOf(b);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ 
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
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
              <BookOpen size={32} color="#3b82f6" />
            </div>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.03em' }}>Disciplinas</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '6px 0 0', fontSize: 15 }}>Crie as matérias para as provas</p>
            </div>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpen()}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', fontWeight: 800, border: 'none', boxShadow: '0 10px 25px -10px rgba(59,130,246,0.6)', cursor: 'pointer' }}
          >
            <Plus size={20} /> Nova Disciplina
          </motion.button>
        </div>

        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: '24px 32px' }}>
          
          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Pesquisar disciplinas..." 
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '16px 20px 16px 52px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
              />
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 40, height: 40, border: '4px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'hsl(var(--bg-app))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 24, padding: 80, textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(59,130,246,0.05)', color: '#3b82f6', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={36} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Nenhuma disciplina encontrada</h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, maxWidth: 400, margin: '0 auto' }}>Cadastre disciplinas para estruturar seus simulados.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
              {sortedSegments.map(segmento => (
                <div key={segmento}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 8, height: 24, borderRadius: 4, background: '#3b82f6' }} />
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>{segmento}</h2>
                    <div style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {grouped[segmento].length} disciplina{grouped[segmento].length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
                    {grouped[segmento].map((item: any, i: number) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  key={item.id} 
                  style={{ display: 'flex', flexDirection: 'column', padding: 24, background: 'hsl(var(--bg-app))', borderRadius: 20, border: '1px solid hsl(var(--border-subtle))', transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.borderColor = item.cor || '#3b82f6'
                    e.currentTarget.style.boxShadow = `0 10px 25px -5px ${item.cor ? item.cor + '22' : 'rgba(59,130,246,0.1)'}`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: item.cor || '#3b82f6' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: item.cor ? item.cor + '15' : 'rgba(59,130,246,0.1)', color: item.cor || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={20} />
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>{item.nome}</div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleOpen(item)} style={{ background: 'rgba(100, 116, 139, 0.1)', border: 'none', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-primary))', transition: 'background 0.2s' }}>
                        <Edit2 size={16} />
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.1, background: 'rgba(239,68,68,0.15)' }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239,68,68,0.05)', border: 'none', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s' }}>
                        <Trash2 size={16} />
                      </motion.button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'hsl(var(--bg-surface))', padding: '16px', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <User size={16} color="hsl(var(--text-muted))" />
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                        {(() => {
                          const profsIds = item.professores_ids || (item.id_professor ? [item.id_professor] : []);
                          const profs = professores.filter(p => profsIds.includes(p.id));
                          if (profs.length > 0) return profs.map(p => p.nome).join(', ');
                          return item.system_users?.nome || 'Não vinculado';
                        })()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={16} color="hsl(var(--text-muted))" />
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                        {item.quantidade_questoes || 0} questões padrão
                      </div>
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
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 style={{ color: 'hsl(var(--text-primary))', margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{editingId ? 'Editar Disciplina' : 'Nova Disciplina'}</h2>
                  <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Preencha os detalhes da matéria</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Nome (Ex: Matemática)</label>
                  <input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Segmento</label>
                  <select value={formData.segmento} onChange={e => setFormData({...formData, segmento: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'}>
                    <option value="Ed. Infantil">Ed. Infantil</option>
                    <option value="Ens. Fundamental I">Ens. Fundamental I</option>
                    <option value="Ens. Fund2/Médio">Ens. Fund2/Médio</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Professores Vinculados</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto', padding: '12px', background: 'hsl(var(--bg-app))', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))' }}>
                    {professores.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'hsl(var(--text-primary))', fontSize: 14 }}>
                        <input 
                          type="checkbox" 
                          checked={formData.professores_ids.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, professores_ids: [...formData.professores_ids, p.id]})
                            } else {
                              setFormData({...formData, professores_ids: formData.professores_ids.filter(id => id !== p.id)})
                            }
                          }}
                          style={{ width: 18, height: 18, accentColor: '#3b82f6', cursor: 'pointer' }}
                        />
                        {p.nome}
                      </label>
                    ))}
                    {professores.length === 0 && (
                      <div style={{ color: 'hsl(var(--text-muted))', fontSize: 13, textAlign: 'center' }}>Nenhum professor cadastrado</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Qtd. Questões Padrão</label>
                    <input type="number" min="1" max="100" value={formData.quantidade_questoes} onChange={e => setFormData({...formData, quantidade_questoes: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Cor do Tema</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input type="color" value={formData.cor} onChange={e => setFormData({...formData, cor: e.target.value})} style={{ width: 50, height: 50, padding: 0, border: '2px solid hsl(var(--bg-app))', borderRadius: 12, cursor: 'pointer', background: 'transparent', boxShadow: '0 0 0 1px hsl(var(--border-subtle))' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
                <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface))'} onMouseLeave={e => e.currentTarget.style.background = 'hsl(var(--bg-app))'}>Cancelar</button>
                <button onClick={handleSave} disabled={isSaving} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, boxShadow: '0 8px 20px -8px rgba(59,130,246,0.6)', opacity: isSaving ? 0.7 : 1 }}>{isSaving ? 'Salvando...' : 'Salvar Disciplina'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
