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
  const [formData, setFormData] = useState({ nome: '', cor: '#3b82f6', id_professor: '', quantidade_questoes: 10 })
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
      setFormData({ nome: item.nome, cor: item.cor || '#3b82f6', id_professor: item.id_professor || '', quantidade_questoes: item.quantidade_questoes || 10 })
    } else {
      setEditingId(null)
      setFormData({ nome: '', cor: '#3b82f6', id_professor: '', quantidade_questoes: 10 })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nome) return alert('O nome é obrigatório')
    setIsSaving(true)
    try {
      const payload = { ...formData, id_professor: formData.id_professor || null }
      if (editingId) {
        await supabase.from('simulados_disciplinas').update(payload).eq('id', editingId)
      } else {
        await supabase.from('simulados_disciplinas').insert([payload])
      }
      await refresh()
      setIsModalOpen(false)
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar')
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {filtered.map((item, i) => (
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
                        {professores.find(p => p.id === item.id_professor)?.nome || item.system_users?.nome || 'Não vinculado'}
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
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Professor(a) Titular</label>
                  <select value={formData.id_professor} onChange={e => setFormData({...formData, id_professor: e.target.value})} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'}>
                    <option value="">Nenhum professor vinculado</option>
                    {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
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
