'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, Plus, Search, Filter, MoreVertical, Eye, Trash2 } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useRouter } from 'next/navigation'
import { SidePanel } from '@/components/ui/SidePanel'

type Denuncia = {
  id: string
  protocolo: string
  tipo: string
  descricao: string
  data_ocorrencia: string
  setor: string
  envolvidos: string
  anonimo: boolean
  status: string
  created_at: string
}

export default function DenunciasAdminPage() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [denuncias, setDenuncias] = useState<Denuncia[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('todas')
  const [viewDenuncia, setViewDenuncia] = useState<Denuncia | null>(null)

  useEffect(() => {
    fetchDenuncias()
  }, [])

  const fetchDenuncias = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gestao-pessoas/denuncias')
      if (res.ok) {
        const data = await res.json()
        setDenuncias(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta denúncia permanentemente?')) return
    try {
      const res = await fetch(`/api/gestao-pessoas/denuncias/${id}`, { method: 'DELETE' })
      if (res.ok) fetchDenuncias()
    } catch (e) {
      console.error(e)
    }
  }

  const handleStatusChange = async (id: string, currentStatus: string, targetStatus?: string) => {
    let nextStatus = targetStatus
    if (!nextStatus) {
      if (currentStatus === 'nova') nextStatus = 'em_analise'
      else if (currentStatus === 'em_analise') nextStatus = 'concluida'
      else if (currentStatus === 'concluida') nextStatus = 'nova'
      else nextStatus = 'nova'
    }

    try {
      const res = await fetch(`/api/gestao-pessoas/denuncias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })
      if (res.ok) {
        setDenuncias(prev => prev.map(d => d.id === id ? { ...d, status: nextStatus as string } : d))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = denuncias.filter(d => {
    if (filterStatus !== 'todas' && d.status !== filterStatus) return false
    if (searchTerm && !d.protocolo?.toLowerCase().includes(searchTerm.toLowerCase()) && !d.tipo?.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nova': return { bg: '#fee2e2', text: '#ef4444', label: 'Nova' }
      case 'em_analise': return { bg: '#fef3c7', text: '#d97706', label: 'Em Análise' }
      case 'concluida': return { bg: '#ecfdf5', text: '#10b981', label: 'Concluída' }
      default: return { bg: '#f1f5f9', text: '#64748b', label: 'Desconhecido' }
    }
  }

  return (
    <div style={{ minHeight: '100%', padding: isMobile ? 16 : 40, background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={24} color="#ef4444" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Gestão de Denúncias</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Tratamento sigiloso de relatos do Canal de Ética.</p>
          </div>
        </div>

        <button 
          onClick={() => router.push('/gestao-pessoas/denuncias/nova')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Plus size={18} /> Nova Denúncia
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Buscar por protocolo ou tipo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '6px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          {['todas', 'nova', 'em_analise', 'concluida'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: filterStatus === status ? '#0f172a' : 'transparent',
                color: filterStatus === status ? '#fff' : '#64748b',
              }}
            >
              {status === 'todas' ? 'Todas' : getStatusColor(status).label}
            </button>
          ))}
        </div>
      </div>

      {/* List/Kanban */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Protocolo</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Data</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tipo / Setor</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Identificação</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px 24px', width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const status = getStatusColor(d.status)
              return (
                <motion.tr 
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '0.05em' }}>{d.protocolo}</div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 14, color: '#64748b' }}>
                    {d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{d.tipo}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{d.setor}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {d.anonimo 
                      ? <span style={{ display: 'inline-block', padding: '4px 10px', background: '#f1f5f9', color: '#64748b', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Anônimo</span>
                      : <span style={{ display: 'inline-block', padding: '4px 10px', background: '#eff6ff', color: '#3b82f6', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Identificado</span>
                    }
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span 
                      onClick={() => handleStatusChange(d.id, d.status)}
                      title="Clique para avançar o status"
                      style={{ 
                        display: 'inline-block', padding: '6px 12px', background: status.bg, 
                        color: status.text, borderRadius: 20, fontSize: 12, fontWeight: 700, 
                        cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none' 
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button onClick={() => setViewDenuncia(d)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Ver Detalhes">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleDelete(d.id)} style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando denúncias...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            Nenhuma denúncia encontrada para os filtros atuais.
          </div>
        ) : null}
      </div>

      <SidePanel
        isOpen={!!viewDenuncia}
        onClose={() => setViewDenuncia(null)}
        title={`Protocolo: ${viewDenuncia?.protocolo || ''}`}
        subtitle="Visualização confidencial da denúncia"
      >
        {viewDenuncia && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14, color: '#334155' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Data do Registro</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{new Date(viewDenuncia.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Tipo / Setor Envolvido</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{viewDenuncia.tipo} {viewDenuncia.setor ? `— ${viewDenuncia.setor}` : ''}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Pessoas Envolvidas</div>
              <div style={{ fontSize: 15 }}>{viewDenuncia.envolvidos || 'Não informado'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Data da Ocorrência</div>
              <div style={{ fontSize: 15 }}>{viewDenuncia.data_ocorrencia ? new Date(viewDenuncia.data_ocorrencia).toLocaleDateString('pt-BR') : 'Não informada'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Identificação do Relator</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: viewDenuncia.anonimo ? '#64748b' : '#3b82f6' }}>
                {viewDenuncia.anonimo ? 'Anônimo' : 'Identificado (ID no banco)'}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Relato Completo</div>
              <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{viewDenuncia.descricao}</div>
            </div>
            
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Atualizar Status</div>
              <div style={{ display: 'flex', gap: 6, background: '#e2e8f0', padding: 4, borderRadius: 12 }}>
                {[
                  { id: 'nova', label: 'Nova', activeColor: '#ef4444' },
                  { id: 'em_analise', label: 'Em Análise', activeColor: '#d97706' },
                  { id: 'concluida', label: 'Concluída', activeColor: '#10b981' }
                ].map(s => {
                  const isActive = viewDenuncia.status === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        handleStatusChange(viewDenuncia.id, viewDenuncia.status, s.id)
                        setViewDenuncia({ ...viewDenuncia, status: s.id })
                      }}
                      style={{
                        flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                        background: isActive ? '#fff' : 'transparent',
                        color: isActive ? s.activeColor : '#64748b',
                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </SidePanel>

    </div>
  )
}
