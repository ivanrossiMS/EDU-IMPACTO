'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApiQuery } from '@/hooks/useApi'
import React, { useMemo, useState } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, Shield, Heart, School, Calendar, User, Clock, FileText, ImageIcon, Check, Loader2, Info } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApp } from '@/lib/context'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function ADOcorrenciasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital()
  const { currentUser } = useApp()
  const [signingIds, setSigningIds] = useState<Record<string, boolean>>({})

  const { aluno } = useSelectedStudent()
  
  // Consumindo dados via API usando React Query (mesma da página Admin para garantir os dados mapeados 'dados')
  const endpoint = aluno?.id ? `/api/ocorrencias?aluno_id=${aluno.id}` : ''
  const { data: rawOcorrencias, refetch, isLoading } = useApiQuery<any[]>(['ocorrencias', aluno?.id], endpoint, undefined, { enabled: !!endpoint })
  const ocorrencias = rawOcorrencias || []

  // Impede visualização se a coordenação/admin bloqueou no config
  if (adConfig?.permissoes?.visualizarOcorrencias === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização de histórico comportamental e ocorrências está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  // Ordena por data (mais recente no topo) e garante match
  const ocorrenciasDoAluno = useMemo(() => {
    return ocorrencias
      .filter(o => String(o.aluno_id) === String(aluno?.id) || String(o.alunoId) === String(aluno?.id))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [ocorrencias, aluno?.id])

  // Agrupa os itens por Ano Letivo e Turma
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

    // Ano em ordem decrescente, e Turma em alfabética
    return Object.values(groups).sort((a, b) => {
      if (b.ano !== a.ano) return b.ano.localeCompare(a.ano)
      return a.turma.localeCompare(b.turma)
    })
  }, [ocorrenciasDoAluno, aluno?.turma])

  // Estatísticas para o cabeçalho
  const stats = useMemo(() => {
    const totais = ocorrenciasDoAluno.length
    const pendentes = ocorrenciasDoAluno.filter(o => {
      const lowerTipo = (o.tipo || '').toLowerCase()
      const isElogio = lowerTipo === 'elogio' || lowerTipo === 'parabéns' || lowerTipo === 'parabens'
      return !o.ciencia_responsavel && !isElogio
    }).length
    const graves = ocorrenciasDoAluno.filter(o => o.gravidade === 'grave').length
    return { pendentes, totais, graves }
  }, [ocorrenciasDoAluno])

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
        refetch() // Atualiza cache Query
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
    <div style={{ paddingBottom: 60, minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* Dynamic Header Premium */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ 
          padding: '32px 24px', 
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
          borderRadius: '0 0 32px 32px', 
          marginBottom: 24, 
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Abstract Background Design */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(56, 189, 248, 0) 70%)' }} />
        
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 10 }}>
          <Shield size={26} style={{ color: '#38bdf8' }} />
          Histórico Disciplinar
        </h2>
        
        {!isLoading && aluno && ocorrenciasDoAluno.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 24, position: 'relative', zIndex: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', padding: '14px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: 22, color: '#fff', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{stats.totais}</div>
            </div>
            {stats.pendentes > 0 ? (
              <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)', padding: '14px 16px', borderRadius: 20, border: '1px solid rgba(245, 158, 11, 0.3)', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: 13, color: '#fcd34d', fontWeight: 600, marginBottom: 4 }}>Pendentes</div>
                <div style={{ fontSize: 22, color: '#fbbf24', fontWeight: 800, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {stats.pendentes}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 12px #fbbf24', animation: 'pulse 2s infinite' }} />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)', padding: '14px 16px', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.3)', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: 13, color: '#6ee7b7', fontWeight: 600, marginBottom: 4 }}>Tudo certo</div>
                <div style={{ fontSize: 22, color: '#34d399', fontWeight: 800, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={20} strokeWidth={3} />
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <div style={{ padding: '0 20px' }}>
        {isLoading || !aluno ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map(idx => (
               <div key={idx} style={{ padding: 24, display: 'flex', gap: 18, background: '#fff', borderRadius: 24, border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: '#f1f5f9', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                     <div style={{ width: '40%', height: 20, background: '#f1f5f9', borderRadius: 6, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
                     <div style={{ width: '80%', height: 14, background: '#f1f5f9', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                     <div style={{ width: '60%', height: 14, background: '#f1f5f9', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
                  </div>
               </div>
            ))}
          </div>
        ) : groupedOcorrencias.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <div style={{ background: '#fff', padding: 40, borderRadius: 32, textAlign: 'center', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
               <div style={{ width: 80, height: 80, borderRadius: 40, background: '#f0fdf4', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                  <Heart size={40} />
               </div>
               <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>Sem Ocorrências!</h3>
               <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                 Que excelente notícia! O aluno não possui nenhum registro disciplinar ou comportamental.
               </p>
            </div>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <AnimatePresence>
              {groupedOcorrencias.map((group, groupIdx) => (
                <motion.div 
                  key={group.key} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ duration: 0.5, delay: groupIdx * 0.1 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                >
                  {/* Group Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 8 }}>
                    <span style={{ background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 12, letterSpacing: 0.5 }}>
                      {group.ano}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 800, color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>
                      <School size={16} style={{ color: '#64748b' }} />
                      {group.turma}
                    </div>
                  </div>

                  {/* Lista de Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {group.items.map((o, idx) => {
                      const lowerTipo = (o.tipo || '').toLowerCase()
                      const isElogio = lowerTipo === 'elogio' || lowerTipo === 'parabéns' || lowerTipo === 'parabens'
                      const isAdvertencia = lowerTipo.includes('advertencia') || lowerTipo.includes('advertência') || o.gravidade === 'grave'
                      
                      const IconBase = isElogio ? Heart : (isAdvertencia ? AlertTriangle : AlertCircle)
                      const colorHex = isElogio ? '#10b981' : (isAdvertencia ? '#ef4444' : '#f59e0b')
                      const gravText = o.gravidade ? (o.gravidade === 'media' ? 'Média' : o.gravidade === 'grave' ? 'Grave' : 'Leve') : 'Comportamental'

                      // Extrair e limpar a assinatura do log no backend
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
                        <motion.div 
                          key={o.id} 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.4, delay: (groupIdx * 0.1) + (idx * 0.05) }}
                          style={{ 
                            background: '#fff', 
                            borderRadius: 16, 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)', 
                            border: '1px solid #f1f5f9', 
                            overflow: 'hidden',
                            position: 'relative'
                          }}
                        >
                          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: colorHex }} />
                          
                          <div style={{ padding: '12px 12px 12px 16px' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              {/* Ícone */}
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${colorHex}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                <IconBase size={18} color={colorHex} />
                              </div>
                              
                              {/* Conteúdo Principal */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {o.tipo}
                                  </h3>
                                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                                    {o.data ? new Date(o.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                                  </span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                  {!isElogio && o.gravidade && (
                                    <span style={{ fontSize: 9, background: `${colorHex}15`, color: colorHex, padding: '2px 6px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
                                      {gravText}
                                    </span>
                                  )}
                                  <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <User size={10} />
                                    {lancado || o.responsavel || 'Coordenação'}
                                  </div>
                                </div>

                                <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {cleanedDesc || o.descricao}
                                </p>
                              </div>
                            </div>

                            {/* Rodapé Dinâmico (Anexo & Ciência) */}
                            {(!isElogio || o.anexoUrl) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                                
                                {o.anexoUrl ? (
                                  <a href={o.anexoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 700, background: '#eff6ff', padding: '6px 10px', borderRadius: 6 }}>
                                    <FileText size={12} /> Ver Anexo
                                  </a>
                                ) : <div />}

                                {!isElogio && (
                                  !o.ciencia_responsavel ? (
                                    <button 
                                      onClick={() => handleAssinar(o.id)} 
                                      disabled={!!signingIds[o.id]}
                                      style={{ 
                                        background: '#f59e0b', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'center', cursor: signingIds[o.id] ? 'not-allowed' : 'pointer', opacity: signingIds[o.id] ? 0.8 : 1, boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
                                      }}
                                    >
                                      {signingIds[o.id] ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Info size={12} />}
                                      Assinar Ciência
                                    </button>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '6px 10px', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                                      <Check size={12} strokeWidth={3} /> Ciência Assinada
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
        }
      `}</style>
    </div>
  )
}
