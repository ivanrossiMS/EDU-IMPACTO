'use client'

import { useData } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Check, X, Calendar, Lock, Unlock } from 'lucide-react'

export default function AnoLetivoPage() {
  const { cfgCalendarioLetivo = [], setCfgCalendarioLetivo } = useData()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [novoAno, setNovoAno] = useState('')

  const handleCreate = () => {
    if (!novoAno) return
    const id = Math.floor(1000 + Math.random() * 9000).toString() // ID curto numeral
    const novo = {
      id,
      ano: novoAno,
      status: 'Aberto', // Aberto, Encerrado
      criadoEm: new Date().toISOString()
    }
    setCfgCalendarioLetivo([...cfgCalendarioLetivo, novo])
    setNovoAno('')
    setIsModalOpen(false)
  }

  const toggleStatus = (id: string) => {
    setCfgCalendarioLetivo(cfgCalendarioLetivo.map(c => 
      c.id === id ? { ...c, status: c.status === 'Aberto' ? 'Encerrado' : 'Aberto' } : c
    ))
  }

  const setVigente = (id: string) => {
    setCfgCalendarioLetivo(cfgCalendarioLetivo.map(c => 
      ({ ...c, isVigente: c.id === id })
    ))
  }

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, color: '#0f172a', margin: 0 }}>Anos Letivos</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Gerenciamento de anos letivos do ERP</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ height: '40px', padding: '0 20px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
        >
          <Plus size={16} /> Novo Ano Letivo
        </button>
      </div>

      {/* Lista de Anos Letivos */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ano Letivo</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Vigente</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Criado Em</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {cfgCalendarioLetivo.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{c.id}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#0f172a' }}>{c.ano}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                  <span style={{ padding: '4px 8px', background: c.status === 'Aberto' ? '#dbeafe' : '#fee2e2', color: c.status === 'Aberto' ? '#1e40af' : '#ef4444', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                    {c.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                  {c.isVigente ? (
                    <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      Vigente
                    </span>
                  ) : (
                    <button 
                      onClick={() => setVigente(c.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '12px', fontWeight: 700 }}
                    >
                      Definir como Vigente
                    </button>
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{c.criadoEm ? new Date(c.criadoEm).toLocaleDateString('pt-BR') : '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button 
                    onClick={() => toggleStatus(c.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: c.status === 'Aberto' ? '#ef4444' : '#10b981', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {c.status === 'Aberto' ? <Lock size={14} /> : <Unlock size={14} />}
                    {c.status === 'Aberto' ? 'Encerrar' : 'Abrir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Novo Ano */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 20, color: '#0f172a', margin: 0 }}>Novo Ano Letivo</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Ano *</label>
                <input 
                  className="form-input" 
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px' }}
                  placeholder="Ex: 2026" 
                  value={novoAno}
                  onChange={e => setNovoAno(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button onClick={() => setIsModalOpen(false)} style={{ height: '36px', padding: '0 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleCreate} style={{ height: '36px', padding: '0 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
