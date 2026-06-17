'use client'

import React, { useState, useEffect } from 'react'
import { ClipboardCheck, Plus, Search, Filter, X, Trash2, Edit2, Calendar, MapPin, CheckCircle } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'

type Checklist = {
  id: string
  tipo: string
  local: string
  responsavel: string
  data: string
  status: string
}

export default function Checklists() {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    tipo: 'Inspeção de EPI',
    local: '',
    responsavel: '',
    data: '',
    status: 'aberto'
  })

  useEffect(() => {
    fetchChecklists()
  }, [])

  const fetchChecklists = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gestao-pessoas/checklists')
      if (res.ok) {
        const data = await res.json()
        setChecklists(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPanel = (c?: Checklist) => {
    if (c) {
      setEditId(c.id)
      setFormData({
        tipo: c.tipo || 'Inspeção de EPI',
        local: c.local || '',
        responsavel: c.responsavel || '',
        data: c.data ? new Date(c.data).toISOString().split('T')[0] : '',
        status: c.status || 'aberto'
      })
    } else {
      setEditId(null)
      setFormData({ tipo: 'Inspeção de EPI', local: '', responsavel: '', data: '', status: 'aberto' })
    }
    setIsPanelOpen(true)
  }

  const handleSaveChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editId ? `/api/gestao-pessoas/checklists/${editId}` : '/api/gestao-pessoas/checklists'
      const method = editId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsPanelOpen(false)
        fetchChecklists()
      } else {
        alert('Erro ao criar/editar checklist')
      }
    } catch (error) {
      console.error(error)
      alert('Erro de conexão')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este checklist?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/checklists/${id}`, { method: 'DELETE' })
      if (res.ok) fetchChecklists()
    } catch (e) {
      console.error(e)
    }
  }

  const handleComplete = async (id: string) => {
    if (!confirm('Deseja marcar esta inspeção como concluída?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/checklists/${id}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'concluido' })
      })
      if (res.ok) fetchChecklists()
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = checklists.filter(c => 
    c.tipo?.toLowerCase().includes(busca.toLowerCase()) || 
    c.local?.toLowerCase().includes(busca.toLowerCase()) ||
    c.responsavel?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
              <ClipboardCheck size={24} color="#fff" strokeWidth={2.5} />
            </div>
            Checklists de Inspeção
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Auditorias, verificações de segurança, 5S e conformidade de equipamentos.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Filter size={18} color="#64748b" />
            Filtrar
          </button>
          <button onClick={() => handleOpenPanel()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#10b981', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
            <Plus size={18} />
            Agendar Inspeção
          </button>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar por tipo, local ou responsável..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, outline: 'none', transition: 'all 0.2s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {loading ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Carregando cronograma de checklists...</div>
        ) : filtered.length === 0 ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Nenhum checklist programado. Clique em "Agendar Inspeção" para começar.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de Inspeção</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Prevista</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{c.tipo}</div>
                      <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} /> {c.local}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{c.responsavel || 'Não definido'}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#475569' }}>
                        <Calendar size={14} color="#64748b" />
                        {c.data ? new Date(c.data).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: 100, background: c.status === 'concluido' ? '#dcfce7' : '#eff6ff', color: c.status === 'concluido' ? '#166534' : '#1e3a8a', border: `1px solid ${c.status === 'concluido' ? '#86efac' : '#bfdbfe'}`, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {c.status === 'concluido' ? 'Concluído' : 'Agendado'}
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        {c.status !== 'concluido' && (
                          <button onClick={() => handleComplete(c.id)} style={{ padding: 8, borderRadius: 8, background: '#dcfce7', border: '1px solid #86efac', color: '#166534', cursor: 'pointer', transition: 'all 0.2s' }} title="Concluir" onMouseEnter={e => { e.currentTarget.style.background = '#bbf7d0' }} onMouseLeave={e => { e.currentTarget.style.background = '#dcfce7' }}>
                            <CheckCircle size={16} />
                          </button>
                        )}
                        <button onClick={() => handleOpenPanel(c)} style={{ padding: 8, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }} title="Editar" onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0' }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9' }}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(c.id)} style={{ padding: 8, borderRadius: 8, background: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir" onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#b91c1c' }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={editId ? 'Editar Inspeção' : 'Agendar Inspeção'}
        subtitle="Defina o local e o tipo de checklist que será aplicado."
      >
        <form onSubmit={handleSaveChecklist} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Tipo de Inspeção</label>
            <select required value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }}>
              <option>Inspeção de EPI (NR-06)</option>
              <option>Inspeção de Extintores (NR-23)</option>
              <option>Condições de Ambiente (NR-24)</option>
              <option>Auditoria 5S</option>
              <option>Inspeção Veicular</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Local da Inspeção</label>
            <input required value={formData.local} onChange={e => setFormData({...formData, local: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Ex: Refeitório, Laboratório Químico..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Responsável</label>
              <input required value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Nome" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Data Prevista</label>
              <input required type="date" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontFamily: 'inherit', fontSize: 14 }} />
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => setIsPanelOpen(false)} style={{ padding: '14px 24px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
              Cancelar
            </button>
            <button type="submit" style={{ padding: '14px 24px', borderRadius: 12, background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              {editId ? 'Salvar Alterações' : 'Agendar Inspeção'}
            </button>
          </div>
        </form>
      </SidePanel>
    </div>
  )
}
