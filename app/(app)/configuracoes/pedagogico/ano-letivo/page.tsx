'use client'

import { useData } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Check, X, Calendar, Lock, Unlock, Trash2, AlertTriangle } from 'lucide-react'

export default function AnoLetivoPage() {
  const { cfgCalendarioLetivo = [], setCfgCalendarioLetivo, turmas = [], logSystemAction } = useData()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [novoAno, setNovoAno] = useState('')
  const [anoParaExcluir, setAnoParaExcluir] = useState<any | null>(null)

  const handleCreate = () => {
    const anoTrimmed = novoAno.trim()
    if (!anoTrimmed) return
    if (cfgCalendarioLetivo.some(c => String(c.ano).trim() === anoTrimmed)) {
      alert('Já existe um ano letivo cadastrado com este ano.')
      return
    }
    const id = Math.floor(1000 + Math.random() * 9000).toString() // ID curto numeral
    const novo = {
      id,
      ano: anoTrimmed,
      status: 'Aberto', // Aberto, Encerrado
      criadoEm: new Date().toISOString()
    }
    setCfgCalendarioLetivo([...cfgCalendarioLetivo, novo])
    if (logSystemAction) {
      logSystemAction('Pedagógico', 'Criar Ano Letivo', `Ano letivo ${anoTrimmed} (ID: ${id}) criado`, { id, ano: anoTrimmed })
    }
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

  const confirmDelete = () => {
    if (!anoParaExcluir) return
    if (anoParaExcluir.isVigente) return

    setCfgCalendarioLetivo(cfgCalendarioLetivo.filter(c => c.id !== anoParaExcluir.id))
    if (logSystemAction) {
      logSystemAction(
        'Pedagógico',
        'Excluir Ano Letivo',
        `Ano letivo ${anoParaExcluir.ano} (ID: ${anoParaExcluir.id}) foi excluído`,
        { id: anoParaExcluir.id, ano: anoParaExcluir.ano }
      )
    }
    setAnoParaExcluir(null)
  }

  const turmasDoAnoExclusao = anoParaExcluir
    ? turmas.filter(t => String(t.ano) === String(anoParaExcluir.ano))
    : []

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
            {cfgCalendarioLetivo.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum ano letivo cadastrado.
                </td>
              </tr>
            ) : (
              cfgCalendarioLetivo.map(c => (
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
                  <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px' }}>
                    <button 
                      onClick={() => toggleStatus(c.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: c.status === 'Aberto' ? '#ef4444' : '#10b981', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {c.status === 'Aberto' ? <Lock size={14} /> : <Unlock size={14} />}
                      {c.status === 'Aberto' ? 'Encerrar' : 'Abrir'}
                    </button>
                    <button 
                      onClick={() => setAnoParaExcluir(c)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Excluir ano letivo"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
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

      {/* Modal Confirmar Exclusão */}
      {anoParaExcluir && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '440px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <Trash2 size={18} />
                </div>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 18, color: '#0f172a', margin: 0 }}>Excluir Ano Letivo</h2>
              </div>
              <button onClick={() => setAnoParaExcluir(null)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            {anoParaExcluir.isVigente ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', color: '#991b1b', fontSize: '13px', lineHeight: 1.5 }}>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Não é permitido excluir o ano vigente</strong>
                  O ano letivo <strong>{anoParaExcluir.ano}</strong> está definido como <strong>Vigente</strong> no sistema. Por segurança e para garantir a integridade dos dados, defina outro ano como vigente antes de excluí-lo.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button 
                    onClick={() => setAnoParaExcluir(null)} 
                    style={{ height: '36px', padding: '0 18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '14px', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                  Tem certeza que deseja excluir o ano letivo <strong>{anoParaExcluir.ano}</strong> (ID: {anoParaExcluir.id})? Esta ação não poderá ser desfeita.
                </p>

                {turmasDoAnoExclusao.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px', color: '#92400e', fontSize: '12px', lineHeight: 1.4 }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
                    <div>
                      <strong>Aviso:</strong> Há <strong>{turmasDoAnoExclusao.length} turma(s)</strong> vinculada(s) a este ano letivo no ERP.
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button 
                    onClick={() => setAnoParaExcluir(null)} 
                    style={{ height: '36px', padding: '0 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDelete} 
                    style={{ height: '36px', padding: '0 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} /> Sim, Excluir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

