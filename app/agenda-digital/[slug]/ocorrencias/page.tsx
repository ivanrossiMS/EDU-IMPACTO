'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import React, { useMemo, use, useState } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, CheckCircle2, Shield, Heart, School, Calendar, User, Clock, FileText, ImageIcon } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function ADOcorrenciasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital()
  const { currentUser } = useApp()
  const [signingIds, setSigningIds] = useState<Record<string, boolean>>({})

  const { aluno } = useSelectedStudent()
  
  const endpoint = aluno?.id ? `ocorrencias?aluno_id=${aluno.id}` : 'ocorrencias?limit=0'
  const [ocorrencias, setOcorrencias, { loading }] = useSupabaseArray<any>(endpoint)

  if (adConfig?.permissoes?.visualizarOcorrencias === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização de histórico comportamental e ocorrências está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica. Para mais informações, entre em contato com a secretaria."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  // Filter occurrences for this student, ordered by date descending
  const ocorrenciasDoAluno = useMemo(() => {
    return (ocorrencias || [])
      // Backend already filters by aluno_id, but just to be safe:
      .filter(o => o.aluno_id === aluno?.id || o.alunoId === aluno?.id)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [ocorrencias, aluno?.id])

  // Group occurrences by Academic Year (Ano Letivo) and Class (Turma)
  const groupedOcorrencias = useMemo(() => {
    const groups: Record<string, { key: string; turma: string; ano: string; items: typeof ocorrenciasDoAluno }> = {}

    ocorrenciasDoAluno.forEach(o => {
      const ano = o.ano || (o.data ? o.data.substring(0, 4) : new Date().getFullYear().toString())
      const turmaNome = o.turma || aluno?.turma || 'Sem Turma'
      const key = `${ano}_${turmaNome}`

      if (!groups[key]) {
        groups[key] = {
          key,
          turma: turmaNome,
          ano,
          items: []
        }
      }
      groups[key].items.push(o)
    })

    // Sort groups by year descending, then class name ascending
    return Object.values(groups).sort((a, b) => {
      if (b.ano !== a.ano) return b.ano.localeCompare(a.ano)
      return a.turma.localeCompare(b.turma)
    })
  }, [ocorrenciasDoAluno, aluno?.turma])

  const handleAssinar = async (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return

    setSigningIds(prev => ({ ...prev, [id]: true }))
    
    const now = new Date()
    const dataHora = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const userLabel = currentUser?.nome || 'Responsável'
    const confirmInfo = `[Confirmado por: ${userLabel} em ${dataHora}]`
    
    const payload = {
      ...oc,
      ciencia_responsavel: true,
      descricao: oc.descricao ? `${oc.descricao}\n${confirmInfo}` : confirmInfo
    }

    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (response.ok) {
        if (setOcorrencias) {
          setOcorrencias(prev => prev.map(o => o.id === id ? payload : o))
        }
      } else {
        const err = await response.json().catch(() => ({}))
        alert('Erro ao registrar ciência: ' + (err.error || response.statusText))
      }
    } catch (error: any) {
      alert('Erro de conexão ao servidor: ' + error.message)
    } finally {
      setSigningIds(prev => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div>
      <div className="ad-ocorrencias-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Histórico Comportamental</h2>
      </div>

      {loading || !aluno ? (
        // Modern Skeleton for Occurrences
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(idx => (
             <div key={idx} className="card ad-oco-card" style={{ padding: 20, display: 'flex', gap: 18, background: 'rgba(255,255,255,0.7)', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: '#e2e8f0', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                   <div style={{ width: '40%', height: 20, background: '#e2e8f0', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                   <div style={{ width: '80%', height: 14, background: '#e2e8f0', borderRadius: 6, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
                   <div style={{ width: '60%', height: 14, background: '#e2e8f0', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
                </div>
             </div>
          ))}
        </div>
      ) : groupedOcorrencias.length === 0 ? (
        <EmptyStateCard 
          title="Sem Ocorrências"
          description="O aluno ainda não possui nenhum registro disciplinar ou pedagógico."
          icon={<Shield size={48} style={{ opacity: 0.2 }} />}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {groupedOcorrencias.map(group => (
            <div key={group.key} className="ad-oco-group" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Group Header (Turma and Ano) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid #e2e8f0', paddingBottom: 8, marginTop: 8 }}>
                <span style={{ background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 12, letterSpacing: 0.5 }}>
                  {group.ano}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 800, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>
                  <School size={16} style={{ color: '#64748b' }} />
                  {group.turma}
                </div>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginLeft: 'auto' }}>
                  {group.items.length} registro(s)
                </span>
              </div>

              {/* Grouped Occurrences List */}
              <div className="ad-oco-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {group.items.map(o => {
                  const lowerTipo = (o.tipo || '').toLowerCase()
                  const isElogio = lowerTipo === 'elogio' || lowerTipo === 'parabéns' || lowerTipo === 'parabens'
                  const isAdvertencia = lowerTipo.includes('advertencia') || lowerTipo.includes('advertência') || o.gravidade === 'grave'
                  
                  const IconBase = isElogio ? Heart : (isAdvertencia ? AlertTriangle : AlertCircle)
                  const colorHex = isElogio ? '#10b981' : (isAdvertencia ? '#ef4444' : '#f59e0b')
                  const gravText = o.gravidade ? (o.gravidade === 'media' ? 'Média' : o.gravidade === 'grave' ? 'Grave' : 'Leve') : ''

                  // Clean description from logs/metadata
                  const lines = (o.descricao || '').split('\n')
                  let lancado = ''
                  let editado = ''
                  let confirmado = ''
                  const descLines: string[] = []

                  lines.forEach((line: string) => {
                    if (line.startsWith('[Lançado por:')) {
                      lancado = line.replace('[Lançado por: ', '').replace(']', '')
                    } else if (line.startsWith('[Editado por:')) {
                      editado = line.replace('[Editado por: ', '').replace(']', '')
                    } else if (line.startsWith('[Confirmado por:')) {
                      confirmado = line.replace('[Confirmado por: ', '').replace(']', '')
                    } else {
                      descLines.push(line)
                    }
                  })
                  const cleanedDesc = descLines.join('\n').trim()

                  return (
                    <div key={o.id} className="card ad-oco-card" style={{ padding: 20, display: 'flex', gap: 18, borderLeft: `4px solid ${colorHex}`, background: '#fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', borderTop: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      <div className="ad-oco-icon" style={{ 
                        width: 44, height: 44, borderRadius: 22, 
                        background: `${colorHex}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                      }}>
                        <IconBase size={22} color={colorHex} />
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ad-oco-title-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 className="ad-oco-title" style={{ fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'capitalize', color: '#1e293b' }}>
                              {o.tipo}
                            </h3>
                            {o.gravidade && (
                              <span style={{ fontSize: 10, background: `${colorHex}15`, color: colorHex, padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                                {gravText}
                              </span>
                            )}
                          </div>
                          <span className="ad-oco-date" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={13} />
                            {o.data ? new Date(o.data + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                          </span>
                        </div>
                        
                        <p className="ad-oco-desc" style={{ fontSize: 14, color: '#334155', marginBottom: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {cleanedDesc || o.descricao}
                        </p>
                        
                        {o.anexoUrl && (
                          <div style={{ marginTop: 12, marginBottom: 16 }}>
                            <a href={o.anexoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 12, textDecoration: 'none', transition: 'all 0.2s', width: '100%', maxWidth: '400px' }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {o.anexoTipo?.includes('image') ? <ImageIcon size={18} /> : <FileText size={18} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {o.anexoNome || 'Documento Anexado'}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                  {o.anexoTamanho ? (o.anexoTamanho / 1024).toFixed(1) + ' KB' : 'Clique para visualizar'}
                                </div>
                              </div>
                            </a>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 10 }}>
                          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <User size={12} />
                            <span>Registrado por: <strong>{lancado || o.responsavel || 'Coordenação'}</strong></span>
                          </div>
                          {editado && (
                            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} />
                              <span>Última edição: <strong>{editado}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Confirmation Box */}
                        {!isElogio && (
                          <div style={{ marginTop: 16 }}>
                            {!o.ciencia_responsavel ? (
                              <div className="ad-oco-assinatura-box" style={{ 
                                 background: 'rgba(245,158,11,0.04)', 
                                 padding: '12px 16px', 
                                 borderRadius: 8,
                                 display: 'flex',
                                 justifyContent: 'space-between',
                                 alignItems: 'center',
                                 border: '1px solid rgba(245,158,11,0.15)',
                                 flexWrap: 'wrap',
                                 gap: 12
                               }}>
                                <div className="ad-oco-assinatura-text" style={{ fontSize: 13, color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <AlertCircle size={14} />
                                  Este registro requer sua assinatura digital de ciência.
                                </div>
                                <button 
                                  onClick={() => handleAssinar(o.id)} 
                                  disabled={!!signingIds[o.id]}
                                  className="btn btn-primary btn-sm ad-oco-assinatura-btn"
                                  style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#fff', fontWeight: 700, padding: '6px 16px', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                  {signingIds[o.id] ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: 12, height: 12, borderWidth: '2px', display: 'inline-block', borderRadius: '50%', borderStyle: 'solid', borderColor: '#fff transparent #fff transparent', animation: 'spin 1s linear infinite' }}></span>
                                      Processando...
                                    </>
                                  ) : (
                                    'Estou Ciente'
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: 4, background: 'rgba(16,185,129,0.04)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981', fontWeight: 700 }}>
                                  <CheckCircle size={15} />
                                  <span>Ciência confirmada</span>
                                </div>
                                {confirmado && (
                                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 21 }}>
                                    <Clock size={11} />
                                    <span>{confirmado}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Dynamic Spin Animation Style */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

