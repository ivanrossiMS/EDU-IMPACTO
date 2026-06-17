'use client'

import React, { useState, useEffect } from 'react'
import { GraduationCap, Plus, Search, Filter, X, Trash2, Edit2 } from 'lucide-react'

type Treinamento = {
  id: string
  nome: string
  descricao: string
  publico_alvo: string
  cargos_obrigatorios: string
  validade: string
  status: string
}

export default function Treinamentos() {
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    publico_alvo: '',
    cargos_obrigatorios: '',
    validade: '',
    status: 'ativo'
  })

  useEffect(() => {
    fetchTreinamentos()
  }, [])

  const fetchTreinamentos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gestao-pessoas/treinamentos')
      if (res.ok) {
        const data = await res.json()
        setTreinamentos(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTreinamento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/gestao-pessoas/treinamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsModalOpen(false)
        fetchTreinamentos()
        setFormData({ nome: '', descricao: '', publico_alvo: '', cargos_obrigatorios: '', validade: '', status: 'ativo' })
      } else {
        alert('Erro ao salvar treinamento')
      }
    } catch (error) {
      console.error(error)
      alert('Erro de conexão')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este treinamento?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/treinamentos/${id}`, { method: 'DELETE' })
      if (res.ok) fetchTreinamentos()
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = treinamentos.filter(t => 
    t.nome?.toLowerCase().includes(busca.toLowerCase()) || 
    t.publico_alvo?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={24} color="#fff" />
            </div>
            Treinamentos e Capacitações
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Controle de treinamentos obrigatórios (NRs) e desenvolvimento de colaboradores.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Filter size={18} color="#64748b" />
            Filtrar
          </button>
          <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#8b5cf6', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
            <Plus size={18} />
            Novo Treinamento
          </button>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome do treinamento..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)' }}
            />
          </div>
        </div>

        {loading ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Carregando treinamentos...</div>
        ) : filtered.length === 0 ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Nenhum treinamento encontrado. Clique em "Novo Treinamento" para começar.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome / Descrição</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Público Alvo</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Validade</th>
                <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{t.nome}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{t.descricao}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 4 }}>{t.publico_alvo || 'Geral'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Cargos: {t.cargos_obrigatorios || 'Todos'}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: 14, color: '#334155' }}>{t.validade || 'Indeterminada'}</div>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(t.id)} style={{ padding: 8, borderRadius: 8, background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir" onMouseEnter={e => e.currentTarget.style.background = '#fecaca'} onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Novo Treinamento */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 600, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Novo Treinamento</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveTreinamento} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Nome do Treinamento</label>
                <input required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Ex: NR-10 Basico" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Descrição</label>
                <input required value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Breve descrição do curso" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Público Alvo</label>
                  <input value={formData.publico_alvo} onChange={e => setFormData({...formData, publico_alvo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Ex: Eletricistas" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Validade</label>
                  <input value={formData.validade} onChange={e => setFormData({...formData, validade: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Ex: 2 anos" />
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: 12, background: '#f1f5f9', border: 'none', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '12px 24px', borderRadius: 12, background: '#8b5cf6', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                  Salvar Treinamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
