'use client'

import React, { useState, useEffect } from 'react'
import { MessageSquareWarning, Plus, Search, Filter, X, Trash2, Edit2, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'

type Atendimento = {
  id: string
  tipo: string
  solicitante: string
  assunto: string
  data: string
  status: string
}

export default function Atendimentos() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    tipo: 'Dúvida',
    solicitante: '',
    assunto: '',
    data: new Date().toISOString().split('T')[0],
    status: 'novo'
  })

  useEffect(() => {
    fetchAtendimentos()
  }, [])

  const fetchAtendimentos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gestao-pessoas/atendimentos')
      if (res.ok) {
        const data = await res.json()
        setAtendimentos(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPanel = (at?: Atendimento) => {
    if (at) {
      setEditId(at.id)
      setFormData({
        tipo: at.tipo || 'Dúvida',
        solicitante: at.solicitante || '',
        assunto: at.assunto || '',
        data: at.data ? new Date(at.data).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        status: at.status || 'novo'
      })
    } else {
      setEditId(null)
      setFormData({ tipo: 'Dúvida', solicitante: '', assunto: '', data: new Date().toISOString().split('T')[0], status: 'novo' })
    }
    setIsPanelOpen(true)
  }

  const handleSaveAtendimento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editId ? `/api/gestao-pessoas/atendimentos/${editId}` : '/api/gestao-pessoas/atendimentos'
      const method = editId ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsPanelOpen(false)
        fetchAtendimentos()
      } else {
        alert('Erro ao salvar atendimento')
      }
    } catch (error) {
      console.error(error)
      alert('Erro de conexão')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este atendimento?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/atendimentos/${id}`, { method: 'DELETE' })
      if (res.ok) fetchAtendimentos()
    } catch (e) {
      console.error(e)
    }
  }

  const handleResolve = async (id: string) => {
    if (!confirm('Confirmar resolução deste atendimento?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/atendimentos/${id}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolvido' })
      })
      if (res.ok) fetchAtendimentos()
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = atendimentos.filter(a => 
    a.tipo?.toLowerCase().includes(busca.toLowerCase()) || 
    a.solicitante?.toLowerCase().includes(busca.toLowerCase()) ||
    a.assunto?.toLowerCase().includes(busca.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolvido': return { bg: '#dcfce7', color: '#166534', border: '#86efac' }
      case 'em andamento': return { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' }
      default: return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' } // novo
    }
  }

  const getTipoColor = (tipo: string) => {
    if (tipo.includes('Férias')) return '#f59e0b'
    if (tipo.includes('Acidente')) return '#ef4444'
    if (tipo.includes('Denúncia')) return '#8b5cf6'
    return '#0ea5e9' // Dúvida ou outro
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)' }}>
              <MessageSquareWarning size={24} color="#fff" strokeWidth={2.5} />
            </div>
            Atendimentos Internos
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Suporte ao colaborador, dúvidas de RH, solicitações e ouvidoria.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Filter size={18} color="#64748b" />
            Filtrar
          </button>
          <button onClick={() => handleOpenPanel()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#0ea5e9', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
            <Plus size={18} />
            Novo Atendimento
          </button>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar por tipo, solicitante ou assunto..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, outline: 'none', transition: 'all 0.2s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(14,165,233,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {loading ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Carregando atendimentos...</div>
        ) : filtered.length === 0 ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Nenhum atendimento registrado.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo / Assunto</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solicitante</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const sColor = getStatusColor(a.status)
                  return (
                    <tr key={a.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: getTipoColor(a.tipo) }}></span>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{a.tipo}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileText size={14} /> {a.assunto}
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                           <div style={{ width: 28, height: 28, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12, fontWeight: 800 }}>
                             {a.solicitante.charAt(0)}
                           </div>
                           {a.solicitante}
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ fontSize: 14, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} color="#64748b" />
                          {a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '-'}
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: 100, background: sColor.bg, color: sColor.color, border: `1px solid ${sColor.border}`, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          {a.status !== 'resolvido' && (
                            <button onClick={() => handleResolve(a.id)} style={{ padding: 8, borderRadius: 8, background: '#dcfce7', border: '1px solid #86efac', color: '#166534', cursor: 'pointer', transition: 'all 0.2s' }} title="Marcar como Resolvido" onMouseEnter={e => { e.currentTarget.style.background = '#bbf7d0' }} onMouseLeave={e => { e.currentTarget.style.background = '#dcfce7' }}>
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          <button onClick={() => handleOpenPanel(a)} style={{ padding: 8, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }} title="Editar Atendimento" onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0' }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9' }}>
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(a.id)} style={{ padding: 8, borderRadius: 8, background: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir" onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#b91c1c' }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444' }}>
                            <Trash2 size={16} />
                          </button>
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

      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={editId ? 'Editar Atendimento' : 'Novo Atendimento'}
        subtitle="Preencha os dados do atendimento, solicitação ou ouvidoria."
      >
        <form onSubmit={handleSaveAtendimento} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Tipo de Atendimento</label>
            <select required value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }}>
              <option>Dúvida</option>
              <option>Solicitação de Férias</option>
              <option>Relato de Acidente</option>
              <option>Denúncia / Ouvidoria</option>
              <option>Solicitação de EPI</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Solicitante</label>
            <input required value={formData.solicitante} onChange={e => setFormData({...formData, solicitante: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Nome do colaborador" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Data do Registro</label>
            <input required type="date" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontFamily: 'inherit', fontSize: 14 }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Assunto / Descrição</label>
            <textarea required value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} rows={4} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', resize: 'vertical', fontSize: 14 }} placeholder="Descreva brevemente o assunto ou relato..." />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Status</label>
            <select required value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }}>
              <option value="novo">Novo</option>
              <option value="em andamento">Em Andamento</option>
              <option value="resolvido">Resolvido</option>
            </select>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => setIsPanelOpen(false)} style={{ padding: '14px 24px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
              Cancelar
            </button>
            <button type="submit" style={{ padding: '14px 24px', borderRadius: 12, background: '#0ea5e9', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,165,233,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              {editId ? 'Salvar Alterações' : 'Criar Atendimento'}
            </button>
          </div>
        </form>
      </SidePanel>
    </div>
  )
}
