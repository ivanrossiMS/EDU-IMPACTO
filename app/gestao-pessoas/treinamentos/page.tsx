'use client'

import React, { useState, useEffect } from 'react'
import { GraduationCap, Plus, Search, Filter, X, Trash2, Edit2, Clock, Users } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'

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
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
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

  const handleOpenPanel = (t?: Treinamento) => {
    if (t) {
      setEditId(t.id)
      setFormData({
        nome: t.nome || '',
        descricao: t.descricao || '',
        publico_alvo: t.publico_alvo || '',
        cargos_obrigatorios: t.cargos_obrigatorios || '',
        validade: t.validade || '',
        status: t.status || 'ativo'
      })
    } else {
      setEditId(null)
      setFormData({ nome: '', descricao: '', publico_alvo: '', cargos_obrigatorios: '', validade: '', status: 'ativo' })
    }
    setIsPanelOpen(true)
  }

  const handleSaveTreinamento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editId ? `/api/gestao-pessoas/treinamentos/${editId}` : '/api/gestao-pessoas/treinamentos'
      const method = editId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsPanelOpen(false)
        fetchTreinamentos()
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
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
              <GraduationCap size={24} color="#fff" strokeWidth={2.5} />
            </div>
            Treinamentos e Capacitações
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Controle de treinamentos obrigatórios (NRs) e desenvolvimento contínuo de colaboradores.
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
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, outline: 'none', transition: 'all 0.2s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {loading ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Carregando matriz de treinamentos...</div>
        ) : filtered.length === 0 ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Nenhum treinamento encontrado. Clique em "Novo Treinamento" para começar.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome / Descrição</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Público Alvo</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Validade</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <GraduationCap size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{t.nome}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginLeft: 48, lineHeight: 1.5 }}>{t.descricao}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Users size={16} color="#64748b" /> {t.publico_alvo || 'Geral'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Cargos: {t.cargos_obrigatorios || 'Todos'}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#475569' }}>
                        <Clock size={14} color="#64748b" />
                        {t.validade || 'Indeterminada'}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={() => handleOpenPanel(t)} style={{ padding: 8, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }} title="Editar" onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0' }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9' }}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(t.id)} style={{ padding: 8, borderRadius: 8, background: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir" onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#b91c1c' }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444' }}>
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
        title={editId ? 'Editar Treinamento' : 'Novo Treinamento'}
        subtitle="Defina o curso, público alvo e sua periodicidade."
      >
        <form onSubmit={handleSaveTreinamento} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Nome do Treinamento</label>
            <input required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Ex: NR-10 Básico - Segurança em Instalações" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Descrição</label>
            <textarea required value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} rows={3} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14, resize: 'vertical' }} placeholder="Breve descrição do conteúdo e objetivo" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Público Alvo (Área)</label>
              <input value={formData.publico_alvo} onChange={e => setFormData({...formData, publico_alvo: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Ex: Eletricistas, Operadores" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Validade</label>
              <input value={formData.validade} onChange={e => setFormData({...formData, validade: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Ex: 2 anos, 12 meses" />
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => setIsPanelOpen(false)} style={{ padding: '14px 24px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
              Cancelar
            </button>
            <button type="submit" style={{ padding: '14px 24px', borderRadius: 12, background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              {editId ? 'Salvar Alterações' : 'Criar Treinamento'}
            </button>
          </div>
        </form>
      </SidePanel>

    </div>
  )
}
