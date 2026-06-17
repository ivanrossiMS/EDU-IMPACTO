'use client'

import React, { useState, useEffect } from 'react'
import { MessageSquareWarning, Plus, Search, Filter, X, Trash2 } from 'lucide-react'

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
  const [isModalOpen, setIsModalOpen] = useState(false)
  
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

  const handleSaveAtendimento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/gestao-pessoas/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsModalOpen(false)
        fetchAtendimentos()
        setFormData({ tipo: 'Dúvida', solicitante: '', assunto: '', data: new Date().toISOString().split('T')[0], status: 'novo' })
      } else {
        alert('Erro ao criar atendimento')
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

  const filtered = atendimentos.filter(a => 
    a.tipo?.toLowerCase().includes(busca.toLowerCase()) || 
    a.solicitante?.toLowerCase().includes(busca.toLowerCase()) ||
    a.assunto?.toLowerCase().includes(busca.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolvido': return { bg: '#d1fae5', color: '#047857' }
      case 'em andamento': return { bg: '#fef3c7', color: '#b45309' }
      default: return { bg: '#e0f2fe', color: '#0369a1' } // novo
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquareWarning size={24} color="#fff" />
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
          <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#0ea5e9', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}>
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
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,165,233,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)' }}
            />
          </div>
        </div>

        {loading ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Carregando atendimentos...</div>
        ) : filtered.length === 0 ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Nenhum atendimento registrado.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
              {filtered.map((a) => {
                const sColor = getStatusColor(a.status)
                return (
                  <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{a.tipo}</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>{a.assunto}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{a.solicitante}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 14, color: '#334155' }}>{a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '-'}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: 100, background: sColor.bg, color: sColor.color, fontSize: 13, fontWeight: 800 }}>
                        {a.status?.toUpperCase() || 'NOVO'}
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(a.id)} style={{ padding: 8, borderRadius: 8, background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir" onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Novo Atendimento */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 500, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Novo Atendimento</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveAtendimento} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Tipo de Atendimento</label>
                <select required value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}>
                  <option>Dúvida</option>
                  <option>Solicitação de Férias</option>
                  <option>Relato de Acidente</option>
                  <option>Denúncia / Ouvidoria</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Solicitante</label>
                <input required value={formData.solicitante} onChange={e => setFormData({...formData, solicitante: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Nome do colaborador" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Assunto / Descrição</label>
                <textarea required value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} rows={3} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', resize: 'none' }} placeholder="Descreva brevemente o assunto..." />
              </div>

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: 12, background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '12px 24px', borderRadius: 12, background: '#0ea5e9', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}>
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
