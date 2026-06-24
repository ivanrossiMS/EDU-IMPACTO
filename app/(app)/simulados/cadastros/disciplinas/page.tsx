'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Plus, Trash2, Edit2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

export default function DisciplinasPage() {
  const [data, setRaw, { loading, refresh }] = useSupabaseArray<any>('simulados_disciplinas', [])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ nome: '', cor: '#3b82f6' })
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  

  const handleOpen = (item?: any) => {
    if (item) {
      setEditingId(item.id)
      setFormData({ nome: item.nome, cor: item.cor || '#3b82f6' })
    } else {
      setEditingId(null)
      setFormData({ nome: '', cor: '#3b82f6' })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nome) return alert('O nome é obrigatório')
    setIsSaving(true)
    try {
      if (editingId) {
        await supabase.from('simulados_disciplinas').update({ ...formData }).eq('id', editingId)
      } else {
        await supabase.from('simulados_disciplinas').insert([{ ...formData }])
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
    <div style={{ padding: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
            <BookOpen size={24} color="#f43f5e" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Disciplinas</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Disciplinas disponíveis para as provas</p>
          </div>
        </div>
        <button 
          onClick={() => handleOpen()}
          style={{ background: 'linear-gradient(135deg, #f43f5e, #be123c)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <Plus size={18} /> Nova Disciplina
        </button>
      </div>

      <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: 14 }} />
            <input 
              type="text" 
              placeholder="Buscar disciplinas..." 
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none' }} 
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Carregando...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: 'hsl(var(--bg-app))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: item.cor || '#3b82f6', boxShadow: `0 0 10px ${item.cor || '#3b82f6'}` }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{item.nome}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleOpen(item)} style={{ background: 'rgba(100, 116, 139, 0.1)', border: 'none', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-primary))' }}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Nenhuma disciplina encontrada.</div>}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setIsModalOpen(false)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'relative', width: '100%', maxWidth: 500, background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 32, border: '1px solid hsl(var(--border-subtle))' }}>
            <h2 style={{ color: 'hsl(var(--text-primary))', margin: '0 0 24px', fontSize: 20 }}>{editingId ? 'Editar Disciplina' : 'Nova Disciplina'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 8 }}>Nome (Ex: Matemática)</label>
                <input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15 }} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 8 }}>Cor Identificadora</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="color" value={formData.cor} onChange={e => setFormData({...formData, cor: e.target.value})} style={{ width: 48, height: 48, padding: 0, border: 'none', borderRadius: 12, cursor: 'pointer', background: 'transparent' }} />
                  <div style={{ color: 'hsl(var(--text-primary))', fontSize: 14 }}>{formData.cor}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'transparent', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} disabled={isSaving} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'linear-gradient(135deg, #f43f5e, #be123c)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{isSaving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
