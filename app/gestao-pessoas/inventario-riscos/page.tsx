'use client'

import React, { useState, useEffect } from 'react'
import { ShieldAlert, Plus, Search, Filter, X, Trash2, Edit2, AlertCircle } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'

type Risco = {
  id: string
  setor: string
  atividade: string
  perigo_identificado: string
  tipo_risco: string
  probabilidade: string
  severidade: string
  nivel_risco: string
}

export default function InventarioRiscos() {
  const [riscos, setRiscos] = useState<Risco[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    setor: '',
    atividade: '',
    perigo_identificado: '',
    tipo_risco: 'Físico',
    probabilidade: '1',
    severidade: '1'
  })

  useEffect(() => {
    fetchRiscos()
  }, [])

  const fetchRiscos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gestao-pessoas/riscos')
      if (res.ok) {
        const data = await res.json()
        setRiscos(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const calcularNivel = (p: number, s: number) => {
    const calc = p * s
    if (calc >= 15) return 'Crítico'
    if (calc >= 9) return 'Alto'
    if (calc >= 4) return 'Médio'
    return 'Baixo'
  }

  const handleOpenPanel = (risco?: Risco) => {
    if (risco) {
      setEditId(risco.id)
      setFormData({
        setor: risco.setor || '',
        atividade: risco.atividade || '',
        perigo_identificado: risco.perigo_identificado || '',
        tipo_risco: risco.tipo_risco || 'Físico',
        probabilidade: risco.probabilidade || '1',
        severidade: risco.severidade || '1'
      })
    } else {
      setEditId(null)
      setFormData({
        setor: '', atividade: '', perigo_identificado: '', tipo_risco: 'Físico', probabilidade: '1', severidade: '1'
      })
    }
    setIsPanelOpen(true)
  }

  const handleSaveRisco = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseInt(formData.probabilidade)
    const s = parseInt(formData.severidade)
    const payload = {
      ...formData,
      nivel_risco: calcularNivel(p, s)
    }

    try {
      const url = editId ? `/api/gestao-pessoas/riscos/${editId}` : '/api/gestao-pessoas/riscos'
      const method = editId ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setIsPanelOpen(false)
        fetchRiscos()
      } else {
        alert('Erro ao salvar risco')
      }
    } catch (error) {
      console.error(error)
      alert('Erro de conexão')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este risco? A exclusão não pode ser desfeita.')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/riscos/${id}`, { method: 'DELETE' })
      if (res.ok) fetchRiscos()
    } catch (e) {
      console.error(e)
    }
  }

  const getBadgeColor = (nivel: string) => {
    switch (nivel?.toLowerCase()) {
      case 'crítico': return { bg: '#9f1239', color: '#fff', border: '#e11d48' }
      case 'alto': return { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' }
      case 'médio': return { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' }
      default: return { bg: '#d1fae5', color: '#047857', border: '#6ee7b7' }
    }
  }

  const getTypeColor = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case 'acidente': return '#ef4444'
      case 'químico': return '#3b82f6'
      case 'ergonômico': return '#f59e0b'
      case 'físico': return '#10b981'
      case 'biológico': return '#8b5cf6'
      default: return '#64748b'
    }
  }

  const filtered = riscos.filter(r => 
    r.setor?.toLowerCase().includes(busca.toLowerCase()) || 
    r.atividade?.toLowerCase().includes(busca.toLowerCase()) ||
    r.perigo_identificado?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)' }}>
              <ShieldAlert size={24} color="#fff" strokeWidth={2.5} />
            </div>
            Inventário de Riscos
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Mapeamento de perigos e avaliação de riscos ocupacionais (Matriz de Risco NR-01).
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Filter size={18} color="#64748b" />
            Filtrar
          </button>
          <button onClick={() => handleOpenPanel()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, background: '#f59e0b', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
            <Plus size={18} />
            Mapear Risco
          </button>
        </div>
      </div>

      {/* Tabela de Inventário */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar por setor, atividade ou perigo..." 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14, outline: 'none', transition: 'all 0.2s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(245,158,11,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {loading ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Carregando matriz de riscos...</div>
        ) : filtered.length === 0 ? (
           <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
             Nenhum risco mapeado. Clique em "Mapear Risco" para começar.
           </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Setor / Atividade</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perigo Identificado</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Matriz (P x S)</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nível de Risco</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const badge = getBadgeColor(r.nivel_risco)
                  const p = parseInt(r.probabilidade) || 0
                  const s = parseInt(r.severidade) || 0
                  return (
                    <tr key={r.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{r.setor}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{r.atividade}</div>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: getTypeColor(r.tipo_risco) }}></span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{r.tipo_risco}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{r.perigo_identificado}</div>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 8 }}>
                          <span style={{ color: '#0f172a', fontWeight: 800 }}>{p}</span>
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>x</span>
                          <span style={{ color: '#0f172a', fontWeight: 800 }}>{s}</span>
                          <span style={{ color: '#94a3b8', margin: '0 4px' }}>=</span>
                          <span style={{ color: '#0f172a', fontWeight: 900, fontSize: 16 }}>{p * s}</span>
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: 100, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          {r.nivel_risco}
                        </span>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => handleOpenPanel(r)} style={{ padding: 8, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a' }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569' }}>
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(r.id)} style={{ padding: 8, borderRadius: 8, background: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#b91c1c' }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444' }}>
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
        title={editId ? 'Editar Risco' : 'Mapear Novo Risco'}
        subtitle="Identifique o perigo e avalie a probabilidade e severidade."
      >
        <form onSubmit={handleSaveRisco} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fffbeb', padding: 16, borderRadius: 12, border: '1px solid #fcd34d' }}>
            <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
              O Nível de Risco será calculado automaticamente multiplicando Probabilidade x Severidade.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Setor</label>
              <input required value={formData.setor} onChange={e => setFormData({...formData, setor: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Ex: Manutenção" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Atividade</label>
              <input required value={formData.atividade} onChange={e => setFormData({...formData, atividade: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14 }} placeholder="Ex: Trabalho em altura" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Tipo de Risco</label>
            <select required value={formData.tipo_risco} onChange={e => setFormData({...formData, tipo_risco: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14, cursor: 'pointer' }}>
              <option>Físico</option>
              <option>Químico</option>
              <option>Biológico</option>
              <option>Ergonômico</option>
              <option>Acidente</option>
              <option>Psicossocial</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Perigo Identificado (Fator de Risco)</label>
            <textarea required value={formData.perigo_identificado} onChange={e => setFormData({...formData, perigo_identificado: e.target.value})} rows={3} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14, resize: 'vertical' }} placeholder="Descreva o perigo em detalhes..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Probabilidade (1 a 5)</label>
              <select required value={formData.probabilidade} onChange={e => setFormData({...formData, probabilidade: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: 14 }}>
                <option value="1">1 - Rara</option>
                <option value="2">2 - Improvável</option>
                <option value="3">3 - Possível</option>
                <option value="4">4 - Provável</option>
                <option value="5">5 - Muito Provável</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Severidade (1 a 5)</label>
              <select required value={formData.severidade} onChange={e => setFormData({...formData, severidade: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: 14 }}>
                <option value="1">1 - Leve</option>
                <option value="2">2 - Moderada</option>
                <option value="3">3 - Séria</option>
                <option value="4">4 - Crítica</option>
                <option value="5">5 - Catastrófica</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => setIsPanelOpen(false)} style={{ padding: '14px 24px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
              Cancelar
            </button>
            <button type="submit" style={{ padding: '14px 24px', borderRadius: 12, background: '#f59e0b', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.3)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              {editId ? 'Salvar Alterações' : 'Salvar Risco'}
            </button>
          </div>
        </form>
      </SidePanel>
    </div>
  )
}
