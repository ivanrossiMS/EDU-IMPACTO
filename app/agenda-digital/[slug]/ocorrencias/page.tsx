'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApiQuery } from '@/hooks/useApi'
import React, { useMemo, useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, Eye, Check, Loader2, Filter, FileText } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

export default function ADOcorrenciasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital()
  const { currentUser } = useApp()
  const [signingIds, setSigningIds] = useState<Record<string, boolean>>({})
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const { aluno } = useSelectedStudent()
  const { turmas = [] } = useData()
  
  const endpoint = aluno?.id ? `/api/ocorrencias?aluno_id=${aluno.id}` : ''
  const { data: rawOcorrencias, refetch, isLoading } = useApiQuery<any[]>(['ocorrencias', aluno?.id], endpoint, undefined, { enabled: !!endpoint, noCache: true })
  const ocorrencias = rawOcorrencias || []
  
  const queryClient = useQueryClient()

  useAgendaRealtime({
    table: 'ocorrencias',
    toastConfig: {
      enabled: true,
      insertMessage: () => `Nova ocorrência registrada!`,
      updateMessage: () => `Ocorrência atualizada!`,
      icon: <AlertTriangle size={18} color="#ef4444" />
    },
    onInsert: (payload) => {
      if (payload && payload.new) {
        queryClient.setQueryData(['ocorrencias', aluno?.id], (old: any) => {
          if (!old) return [payload.new];
          return [payload.new, ...old];
        });
      }
    },
    onUpdate: (payload) => {
      if (payload && payload.new) {
        queryClient.setQueryData(['ocorrencias', aluno?.id], (old: any) => {
          if (!old) return old;
          return old.map((item: any) => item.id === payload.new.id ? payload.new : item);
        });
      }
    },
    onDelete: (payload) => {
      if (payload && payload.old) {
        queryClient.setQueryData(['ocorrencias', aluno?.id], (old: any) => {
          if (!old) return old;
          return old.filter((item: any) => item.id !== payload.old.id);
        });
      }
    }
  });

  if (adConfig?.permissoes?.visualizarOcorrencias === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <div style={{ background: '#fff', padding: 40, borderRadius: 32, textAlign: 'center', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', maxWidth: 500 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
            <AlertCircle size={40} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Acesso Restrito</h3>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            A visualização de histórico comportamental e ocorrências está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica.
          </p>
        </div>
      </div>
    )
  }

  const ocorrenciasDoAluno = useMemo(() => {
    return ocorrencias
      .filter(o => String(o.aluno_id) === String(aluno?.id) || String(o.alunoId) === String(aluno?.id))
      .sort((a, b) => {
        const dateCompare = (b.data || '').localeCompare(a.data || '')
        if (dateCompare !== 0) return dateCompare
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [ocorrencias, aluno?.id])

  const anosDisponiveis = useMemo(() => {
    const years = ocorrenciasDoAluno.map(o => o.ano || (o.data ? o.data.substring(0, 4) : new Date().getFullYear().toString()))
    const uniqueYears = Array.from(new Set(years)).sort((a, b) => b.localeCompare(a))
    if (uniqueYears.length === 0) {
      uniqueYears.push(new Date().getFullYear().toString())
    }
    return uniqueYears
  }, [ocorrenciasDoAluno])

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !selectedYear) {
      setSelectedYear(anosDisponiveis[0])
    }
  }, [anosDisponiveis, selectedYear])

  const ocorrenciasFiltradas = useMemo(() => {
    if (!selectedYear) return []
    return ocorrenciasDoAluno.filter(o => {
      const ano = o.ano || (o.data ? o.data.substring(0, 4) : new Date().getFullYear().toString())
      return ano === selectedYear;
    })
  }, [ocorrenciasDoAluno, selectedYear])

  // Group by date
  const groupedOcorrencias = useMemo(() => {
    const groups: { date: string, items: any[] }[] = []
    ocorrenciasFiltradas.forEach(o => {
      const oDate = o.data || new Date(o.created_at).toISOString().split('T')[0]
      let group = groups.find(g => g.date === oDate)
      if (!group) {
        group = { date: oDate, items: [] }
        groups.push(group)
      }
      group.items.push(o)
    })
    return groups
  }, [ocorrenciasFiltradas])

  useEffect(() => {
    if (!aluno?.id || ocorrenciasFiltradas.length === 0) return;
    const unreadIds = ocorrenciasFiltradas
      .filter(o => {
        const leituras = (o as any).dados?.leituras || (o as any).leituras || {};
        return !leituras[aluno.id];
      })
      .map(o => o.id);

    if (unreadIds.length > 0) {
      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'ocorrencia', ids: unreadIds, alunoId: aluno.id })
      })
      .then(res => {
        if (res.ok) window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
      })
      .catch(err => console.error(err));
    }
  }, [ocorrenciasFiltradas, aluno?.id]);

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
        refetch()
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

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    const today = new Date()
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    const parts = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).split(' de ')
    let monthShort = parts[1].replace('.', '').substring(0, 3)
    const formatted = `${parts[0]} de ${monthShort}.`
    if (isToday) return `Hoje, ${formatted}`
    return formatted
  }

  return (
    <div style={{ padding: '24px 20px 100px 20px', minHeight: '100vh', background: '#fdfdfd', fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      {/* Header aligned with the image */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#fef2f2', padding: 8, borderRadius: 10 }}>
            <FileText size={20} color="#f97316" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#0f172a' }}>Ocorrências</h1>
        </div>
        
        <button style={{ 
          background: '#fff', 
          border: '1px solid #e2e8f0', 
          borderRadius: 20, 
          padding: '8px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6,
          fontSize: 14,
          fontWeight: 600,
          color: '#475569',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <Filter size={14} /> Filtros <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {isLoading || !aluno ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(idx => (
             <div key={idx} style={{ padding: 24, display: 'flex', gap: 18, background: '#fff', borderRadius: 24, border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f1f5f9', animation: 'pulse-skeleton 1.5s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                   <div style={{ width: '40%', height: 20, background: '#f1f5f9', borderRadius: 6, marginBottom: 10, animation: 'pulse-skeleton 1.5s infinite' }} />
                   <div style={{ width: '80%', height: 14, background: '#f1f5f9', borderRadius: 6, marginBottom: 8, animation: 'pulse-skeleton 1.5s infinite' }} />
                   <div style={{ width: '60%', height: 14, background: '#f1f5f9', borderRadius: 6, animation: 'pulse-skeleton 1.5s infinite' }} />
                </div>
             </div>
          ))}
        </div>
      ) : ocorrenciasFiltradas.length === 0 ? (
        <div style={{ background: '#fff', padding: '56px 40px', borderRadius: 28, textAlign: 'center', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.01)' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Nenhuma ocorrência</h3>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            Tudo certo por aqui! Não existem registros disciplinares ou de ocorrências para este aluno.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical continuous timeline line */}
          <div style={{ position: 'absolute', top: 32, bottom: 0, left: 14, width: 1, background: '#e2e8f0', zIndex: 0 }} />

          <AnimatePresence>
            {groupedOcorrencias.map((group, gIdx) => (
              <div key={group.date}>
                {/* Date separator */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0 24px 0', position: 'relative', zIndex: 1 }}>
                   <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                   <div style={{ padding: '0 16px', fontSize: 13, fontWeight: 700, color: '#64748b' }}>
                      {formatDateSeparator(group.date)}
                   </div>
                   <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>

                {group.items.map((o, idx) => {
                  const lowerTipo = (o.tipo || '').toLowerCase()
                  const isElogio = lowerTipo === 'elogio' || lowerTipo === 'parabéns' || lowerTipo === 'parabens'
                  const isAdvertencia = lowerTipo.includes('advertencia') || lowerTipo.includes('advertência') || o.gravidade === 'grave' || o.gravidade === 'media'
                  
                  const isLeve = !isAdvertencia && !isElogio

                  const gravBg = isLeve ? '#fef3c7' : '#fee2e2'
                  const gravColor = isLeve ? '#d97706' : '#dc2626'
                  const gravText = o.gravidade ? (o.gravidade === 'media' ? 'MÉDIA' : o.gravidade === 'grave' ? 'GRAVE' : 'LEVE') : (isLeve ? 'LEVE' : 'MÉDIA')

                  const borderColor = isLeve ? '#fcd34d' : '#fca5a5'
                  const iconColor = isLeve ? '#f59e0b' : '#ef4444'

                  const lines = (o.descricao || '').split('\n')
                  let lancado = ''
                  const descLines: string[] = []

                  lines.forEach((line: string) => {
                    if (line.startsWith('[Lançado por:')) {
                      lancado = line.replace('[Lançado por: ', '').replace(']', '')
                    } else if (!line.startsWith('[Editado por:') && !line.startsWith('[Confirmado por:')) {
                      descLines.push(line)
                    }
                  })
                  const cleanedDesc = descLines.join('\n').trim()

                  const textStr = cleanedDesc || o.descricao || ''
                  const isExpanded = !!expandedIds[o.id]
                  const maxLength = 100
                  const shouldTruncate = textStr.length > maxLength && !isExpanded
                  const displayText = shouldTruncate ? textStr.slice(0, maxLength).trim() + '...' : textStr

                  const timeStr = new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  
                  return (
                    <motion.div 
                      key={o.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, delay: (gIdx * 0.1) + (idx * 0.05) }}
                      style={{ 
                        position: 'relative',
                        paddingLeft: 40,
                        marginBottom: 20
                      }}
                    >
                      {/* Timeline Dot centered on the vertical line (which is at left: 14px) => dot center at 14px */}
                      <div style={{ 
                        position: 'absolute', 
                        left: 14, 
                        top: 28, 
                        transform: 'translate(-50%, -50%)', 
                        zIndex: 2,
                        width: 16, 
                        height: 16, 
                        borderRadius: '50%', 
                        background: '#fff', 
                        border: `2px solid ${borderColor}`,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 0 0 4px #fdfdfd'
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: iconColor }} />
                      </div>

                      {/* Card Body */}
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderRadius: 20,
                        padding: '20px 20px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                      }}>
                        {/* Title Row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isLeve ? (
                              <div style={{ border: `1px solid ${iconColor}`, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertCircle size={14} color={iconColor} strokeWidth={2.5} />
                              </div>
                            ) : (
                              <div style={{ border: `1px solid ${iconColor}`, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertTriangle size={14} color={iconColor} strokeWidth={2.5} />
                              </div>
                            )}
                            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>{o.tipo}</h3>
                            <span style={{ 
                              fontSize: 10, 
                              background: gravBg, 
                              color: gravColor, 
                              padding: '4px 8px', 
                              borderRadius: 12, 
                              fontWeight: 800, 
                              textTransform: 'uppercase', 
                              letterSpacing: 0.5 
                            }}>
                              {gravText}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 700 }}>{timeStr}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </div>

                        {/* Meta Info Rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 4px' }}>4º</div>
                            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                              {o.turmaNome || o.dados?.turma || aluno?.turma || '4º Ano A'} • {aluno?.turno || 'Matutino'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                              {lancado || o.responsavel || 'Coordenação'}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                          {displayText}
                          {shouldTruncate && (
                            <span 
                              onClick={() => setExpandedIds(p => ({...p, [o.id]: true}))} 
                              style={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer', marginLeft: 4 }}
                            >
                              Ver mais
                            </span>
                          )}
                        </p>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button style={{ 
                            flex: 1, 
                            minWidth: 120, 
                            background: '#fff', 
                            border: '1px solid #e2e8f0', 
                            color: '#475569', 
                            fontWeight: 700, 
                            fontSize: 13, 
                            padding: '10px 0', 
                            borderRadius: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}>
                            <Eye size={15} /> Ver detalhes
                          </button>
                          
                          <button 
                            onClick={() => !o.ciencia_responsavel && handleAssinar(o.id)}
                            disabled={!!signingIds[o.id] || o.ciencia_responsavel}
                            style={{ 
                              flex: 1, 
                              minWidth: 140, 
                              background: o.ciencia_responsavel ? '#ecfdf5' : '#f59e0b', 
                              border: o.ciencia_responsavel ? '1px solid #a7f3d0' : 'none', 
                              color: o.ciencia_responsavel ? '#059669' : '#fff', 
                              fontWeight: 700, 
                              fontSize: 13, 
                              padding: '10px 0', 
                              borderRadius: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              cursor: (signingIds[o.id] || o.ciencia_responsavel) ? 'default' : 'pointer'
                            }}
                          >
                            {signingIds[o.id] ? (
                              <Loader2 size={15} className="spin-animation" />
                            ) : (
                              <Check size={15} strokeWidth={3.5} />
                            )}
                            {o.ciencia_responsavel ? 'Ciência Assinada' : 'Assinar ciência'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* WhatsApp FAB */}
      <a 
        href="#" 
        style={{ 
          position: 'fixed', 
          bottom: 100, 
          right: 20, 
          width: 50, 
          height: 50, 
          borderRadius: 25, 
          background: '#25D366', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          boxShadow: '0 4px 14px rgba(37,211,102,0.4)',
          zIndex: 100
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.38c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.575-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.98 1.005-3.645-.235-.373a9.86 9.86 0 0 1-1.51-5.26c0-5.445 4.439-9.884 9.888-9.884 2.64 0 5.122 1.027 6.988 2.895A9.82 9.82 0 0 1 21.94 11.9c0 5.444-4.439 9.882-9.889 9.882M12.051 2C6.538 2 2.054 6.485 2.054 11.996c0 1.76.463 3.483 1.344 5.002L2 22l5.147-1.35a9.88 9.88 0 0 0 4.904 1.303h.004C17.568 21.953 22 17.468 22 11.955A9.97 9.97 0 0 0 19.09 4.912 9.94 9.94 0 0 0 12.051 2" />
        </svg>
      </a>

      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-skeleton {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
