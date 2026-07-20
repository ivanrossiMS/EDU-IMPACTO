'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Plus, Search, Filter, MoreVertical, Eye, Trash2, AlertTriangle, X, Info, AlertOctagon, Scale, UserX } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useRouter } from 'next/navigation'
import { SidePanel } from '@/components/ui/SidePanel'
import { useApp } from '@/lib/context'

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
  relator_id?: string | null
}

export default function DenunciasAdminPage() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const { currentUser } = useApp()
  const [denuncias, setDenuncias] = useState<Denuncia[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('todas')
  const [viewDenuncia, setViewDenuncia] = useState<Denuncia | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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

  const confirmDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/gestao-pessoas/denuncias/${id}`, { method: 'DELETE' })
      if (res.ok) fetchDenuncias()
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteConfirmId(null)
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

  const isAdmin = currentUser?.cargo === 'Administrador Master' || currentUser?.perfil === 'Administrador'

  const filtered = denuncias.filter(d => {
    if (!isAdmin && d.relator_id !== currentUser?.id) return false
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

      {/* Info Banner */}
      <div style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', border: '1px solid #fecdd3', borderRadius: 24, padding: 32, marginBottom: 32, display: 'flex', gap: 24, alignItems: 'flex-start', boxShadow: '0 10px 30px -10px rgba(225, 29, 72, 0.15)', position: 'relative', overflow: 'hidden' }}>
        {/* Decoration */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 150, height: 150, background: 'radial-gradient(circle, rgba(251,113,133,0.2) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
        
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', flexShrink: 0, color: '#e11d48' }}>
          <Info size={28} strokeWidth={2.5} />
        </div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Sobre o Canal de Denúncias</h2>
          <p style={{ margin: '0 0 20px 0', fontSize: 15, color: '#334155', lineHeight: 1.6, maxWidth: 800 }}>
            Ambiente seguro e totalmente sigiloso para relatar infrações ao Código de Ética. Você pode optar pelo anonimato total. Garantimos a não retaliação a quem relatar de boa-fé.
          </p>
          
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#e11d48', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <UserX size={16} /> Assédio Moral ou Sexual
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#c026d3', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <Scale size={16} /> Discriminação
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#ea580c', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <AlertOctagon size={16} /> Fraudes e Corrupção
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4f46e5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <ShieldAlert size={16} /> Desvios de Conduta
            </div>
          </div>
        </div>
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
                      onClick={() => isAdmin && handleStatusChange(d.id, d.status)}
                      title={isAdmin ? "Clique para avançar o status" : "Status atual da denúncia"}
                      style={{ 
                        display: 'inline-block', padding: '6px 12px', background: status.bg, 
                        color: status.text, borderRadius: 20, fontSize: 12, fontWeight: 700, 
                        cursor: isAdmin ? 'pointer' : 'default', transition: 'all 0.2s', userSelect: 'none' 
                      }}
                      onMouseEnter={e => { if (isAdmin) e.currentTarget.style.opacity = '0.8' }}
                      onMouseLeave={e => { if (isAdmin) e.currentTarget.style.opacity = '1' }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button onClick={() => setViewDenuncia(d)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Ver Detalhes">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => setDeleteConfirmId(d.id)} style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Excluir">
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
            
            {isAdmin && (
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
            )}
          </div>
        )}
      </SidePanel>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}
              onClick={() => setDeleteConfirmId(null)}
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{ 
                position: 'relative', width: '100%', maxWidth: 400, background: '#fff', 
                borderRadius: 24, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
              }}
            >
              <button 
                onClick={() => setDeleteConfirmId(null)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: '50%', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X size={20} />
              </button>

              <div style={{ width: 64, height: 64, background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <AlertTriangle size={32} color="#ef4444" strokeWidth={2} />
              </div>

              <h3 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
                Excluir Denúncia?
              </h3>
              <p style={{ margin: '0 0 32px 0', fontSize: 15, color: '#64748b', lineHeight: 1.5 }}>
                Esta ação não pode ser desfeita. A denúncia e todo o seu histórico serão removidos permanentemente.
              </p>

              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  style={{ flex: 1, padding: '12px 0', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => confirmDelete(deleteConfirmId)}
                  style={{ flex: 1, padding: '12px 0', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                  onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                >
                  Sim, Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
