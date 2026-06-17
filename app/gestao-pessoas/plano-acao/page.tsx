'use client'

import React, { useState, useEffect } from 'react'
import { Activity, Plus, Search, Filter, X, Trash2, CheckCircle } from 'lucide-react'

type Acao = {
  id: string
  titulo: string
  setor: string
  responsavel: string
  prazo: string
  status: string
  prioridade: string
}

export default function PlanoAcao() {
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    setor: '',
    responsavel: '',
    prazo: '',
    prioridade: 'normal',
    status: 'aberta'
  })

  useEffect(() => {
    fetchAcoes()
  }, [])

  const fetchAcoes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gestao-pessoas/acoes')
      if (res.ok) {
        const data = await res.json()
        setAcoes(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAcao = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/gestao-pessoas/acoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsModalOpen(false)
        fetchAcoes()
        setFormData({ titulo: '', setor: '', responsavel: '', prazo: '', prioridade: 'normal', status: 'aberta' })
      } else {
        alert('Erro ao salvar plano de ação')
      }
    } catch (error) {
      console.error(error)
      alert('Erro de conexão')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta ação?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/acoes/${id}`, { method: 'DELETE' })
      if (res.ok) fetchAcoes()
    } catch (e) {
      console.error(e)
    }
  }

  const handleComplete = async (id: string) => {
    try {
      const res = await fetch(`/api/gestao-pessoas/acoes/${id}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'concluida' })
      })
      if (res.ok) fetchAcoes()
    } catch (e) {
      console.error(e)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'concluida': return { bg: '#d1fae5', color: '#047857' }
      case 'vencida': return { bg: '#fee2e2', color: '#b91c1c' }
      default: return { bg: '#e0f2fe', color: '#0369a1' } // aberta
    }
  }

  const filtered = acoes.filter(a => 
    a.titulo?.toLowerCase().includes(busca.toLowerCase()) || 
    a.responsavel?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={24} color="#fff" />
            </div>
            Plano de Ação
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Acompanhamento de medidas mitigadoras e melhorias contínuas.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Filter size={18} color="#64748b" />
            Filtrar
          </button>
          <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            <Plus size={18} />
            Nova Ação
          </button>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar por título ou responsável..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)' }}
            />
          </div>
        </div>

        {loading ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Carregando planos de ação...</div>
        ) : filtered.length === 0 ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Nenhum plano de ação encontrado. Clique em "Nova Ação" para começar.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ação (O que?)</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável (Quem?)</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prazo (Quando?)</th>
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
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{a.titulo}</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Setor: {a.setor}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{a.responsavel}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 14, color: '#334155' }}>
                        {a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : 'Não definido'}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: 100, background: sColor.bg, color: sColor.color, fontSize: 13, fontWeight: 800 }}>
                        {a.status?.toUpperCase() || 'ABERTA'}
                      </span>
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        {a.status !== 'concluida' && (
                          <button onClick={() => handleComplete(a.id)} style={{ padding: 8, borderRadius: 8, background: '#d1fae5', border: 'none', color: '#059669', cursor: 'pointer', transition: 'all 0.2s' }} title="Marcar como Concluída" onMouseEnter={e => e.currentTarget.style.background = '#a7f3d0'} onMouseLeave={e => e.currentTarget.style.background = '#d1fae5'}>
                            <CheckCircle size={16} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(a.id)} style={{ padding: 8, borderRadius: 8, background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir Ação" onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Nova Ação */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 600, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Nova Ação</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveAcao} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Título da Ação</label>
                <input required value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Ex: Instalação de corrimão" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Setor</label>
                  <input required value={formData.setor} onChange={e => setFormData({...formData, setor: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Ex: Manutenção" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Responsável</label>
                  <input required value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Nome do colaborador" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Prazo (Data limite)</label>
                  <input required type="date" value={formData.prazo} onChange={e => setFormData({...formData, prazo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Prioridade</label>
                  <select required value={formData.prioridade} onChange={e => setFormData({...formData, prioridade: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}>
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: 12, background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '12px 24px', borderRadius: 12, background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                  Salvar Ação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
