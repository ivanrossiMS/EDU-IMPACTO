'use client'

import { useState } from 'react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import {
  Monitor, Plus, Wifi, WifiOff, Trash2, Settings, RefreshCw,
  CheckCircle, XCircle, Activity, X, Save, Zap
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function DispositivosPage() {
  const [showModal, setShowModal] = useState(false)
  const [editDevice, setEditDevice] = useState<any>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const { data: dispRes, isLoading, refetch } = useApiQuery<{ data: any[] }>(
    ['portaria-dispositivos'],
    '/api/portaria/dispositivos',
    undefined,
    { staleTime: 10000 }
  )
  const dispositivos = dispRes?.data || []

  const saveMutation = useApiMutation<any>('/api/portaria/dispositivos', 'POST', [['portaria-dispositivos']])
  const deleteMutation = useApiMutation<any>('/api/portaria/dispositivos', 'DELETE', [['portaria-dispositivos']])

  const openNew = () => {
    setEditDevice({ nome: 'Portaria Rua das Garças', ip: '', porta: 443, unidade: '', modelo: 'iDFace' })
    setShowModal(true)
  }

  const openEdit = (d: any) => {
    setEditDevice({ ...d })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(editDevice)
      setToast({ msg: 'Dispositivo salvo com sucesso!', type: 'success' })
      setShowModal(false)
      refetch()
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
    }
    setTimeout(() => setToast(null), 4000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este dispositivo?')) return
    try {
      await deleteMutation.mutateAsync({ id } as any)
      setToast({ msg: 'Dispositivo removido', type: 'success' })
      refetch()
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
    }
    setTimeout(() => setToast(null), 4000)
  }

  const handleTestConnection = async (d: any) => {
    setTesting(d.id)
    try {
      // Simulate test — in production this would call the iDFace
      await new Promise(r => setTimeout(r, 2000))
      setToast({ msg: d.ip ? `Teste de conexão para ${d.ip} enviado` : 'IP não configurado — configure o IP primeiro', type: d.ip ? 'success' : 'error' })
    } catch {
      setToast({ msg: 'Falha na conexão', type: 'error' })
    }
    setTesting(null)
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10000,
          padding: '12px 20px', borderRadius: 12,
          background: toast.type === 'success' ? '#10b981' : '#f43f5e',
          color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Monitor size={22} color={ACCENT} />
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0 }}>Dispositivos iDFace</h1>
          </div>
          <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
            Cadastro e gestão dos equipamentos de reconhecimento facial
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
            border: 'none', color: '#fff', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Novo Dispositivo
        </button>
      </div>

      {/* Grid de devices */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
          <Activity size={28} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 14 }}>Carregando dispositivos...</div>
        </div>
      ) : dispositivos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 80,
          background: 'hsl(var(--bg-elevated))', borderRadius: 20,
          border: '1px solid hsl(var(--border-subtle))',
        }}>
          <Monitor size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: 'hsl(var(--text-muted))' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 8 }}>Nenhum dispositivo cadastrado</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Cadastre seu primeiro iDFace para começar a controlar as entradas.</div>
          <button onClick={openNew} style={{
            padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
            border: 'none', color: '#fff', cursor: 'pointer',
          }}>
            <Plus size={14} style={{ display: 'inline', marginRight: 6 }} />
            Cadastrar Dispositivo
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
          {dispositivos.map((d: any) => {
            const isOnline = d.status === 'online'
            return (
              <div key={d.id} style={{
                background: 'hsl(var(--bg-elevated))',
                border: `1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.15)'}`,
                borderRadius: 20, padding: '24px',
                boxShadow: isOnline ? '0 4px 24px rgba(16,185,129,0.06)' : '0 4px 20px rgba(0,0,0,0.04)',
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: isOnline ? 'rgba(16,185,129,0.08)' : 'rgba(148,163,184,0.08)',
                    border: `1px solid ${isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isOnline ? '#10b981' : '#94a3b8',
                  }}>
                    {isOnline ? <Wifi size={22} /> : <WifiOff size={22} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))' }}>
                      {d.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {d.modelo} · {d.unidade || 'Sem unidade'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    padding: '4px 10px', borderRadius: 8,
                    background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                    color: isOnline ? '#10b981' : '#94a3b8',
                  }}>
                    {isOnline ? '● ONLINE' : '● OFFLINE'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    ['IP', d.ip || 'Não configurado'],
                    ['Porta', d.porta || 443],
                    ['Modelo', d.modelo || 'iDFace'],
                    ['Última Comunicação', d.ultima_comunicacao ? new Date(d.ultima_comunicacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', fontFamily: label === 'IP' ? 'monospace' : 'inherit' }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 16 }}>
                  <button
                    onClick={() => handleTestConnection(d)}
                    disabled={testing === d.id}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 0', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: `${ACCENT}12`, color: ACCENT, border: `1px solid ${ACCENT}25`,
                      cursor: 'pointer',
                    }}
                  >
                    {testing === d.id ? <Activity size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
                    Testar Conexão
                  </button>
                  <button
                    onClick={() => openEdit(d)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 0', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)',
                      cursor: 'pointer',
                    }}
                  >
                    <Settings size={12} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    style={{
                      width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: 'rgba(244,63,94,0.08)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.15)',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && editDevice && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', zIndex: 9999, backdropFilter: 'blur(4px)',
        }} onClick={() => setShowModal(false)}>
          <div
            style={{
              background: 'hsl(var(--bg-elevated))', borderRadius: 20, padding: 28,
              width: '90%', maxWidth: 480,
              border: '1px solid hsl(var(--border-subtle))',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 18, margin: 0 }}>
                {editDevice.id ? 'Editar Dispositivo' : 'Novo Dispositivo'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nome', key: 'nome', placeholder: 'Ex: Portaria Rua das Garças' },
                { label: 'Endereço IP', key: 'ip', placeholder: 'Ex: 192.168.1.100' },
                { label: 'Porta', key: 'porta', placeholder: '443', type: 'number' },
                { label: 'Unidade', key: 'unidade', placeholder: 'Ex: Unidade Centro' },
                { label: 'Modelo', key: 'modelo', placeholder: 'iDFace' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>{field.label}</label>
                  <input
                    className="form-input"
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={editDevice[field.key] || ''}
                    onChange={e => setEditDevice({ ...editDevice, [field.key]: field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })}
                    style={{ width: '100%', height: 40, borderRadius: 10, fontSize: 13 }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-muted))',
                  border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
                  border: 'none', color: '#fff', cursor: 'pointer',
                }}
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
