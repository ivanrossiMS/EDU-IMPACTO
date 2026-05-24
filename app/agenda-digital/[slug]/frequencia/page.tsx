'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useMemo, use } from 'react'
import { Upload, CheckCircle2, AlertTriangle, AlertCircle, FileText, Activity, Clock, ShieldCheck, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'

export default function ADFrequenciaPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital()
  
  if (adConfig?.permissoes?.visualizarFrequencia === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização de histórico de frequência está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica. Para mais informações, entre em contato com a secretaria."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  const { aluno } = useSelectedStudent()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
  const [atestadoModal, setAtestadoModal] = useState(false)
  const [atestadoSent, setAtestadoSent] = useState(false)

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Resetar página quando o aluno mudar
  React.useEffect(() => {
    setCurrentPage(1)
  }, [resolvedParams.slug])

  // Fetch real student attendance logs from database based on turma and alunoId
  const { data: frequenciasDb = [], isLoading: isLoadingFrequencias } = useApiQuery<any[]>(
    ['frequencias-aluno', resolvedParams.slug, aluno?.turma],
    '/api/academico/frequencias',
    { aluno_id: resolvedParams.slug, turma_id: aluno?.turma || '' },
    { enabled: !!resolvedParams.slug && !!aluno?.turma }
  )

  // O eventosPortaria ainda é útil como fallback, caso a sincronização da frequência atrase.
  const { data: eventosPortaria = [] } = useApiQuery<any[]>(
    ['portaria-eventos-aluno', resolvedParams.slug],
    '/api/portaria/eventos',
    { aluno_id: resolvedParams.slug },
    { enabled: !!resolvedParams.slug }
  )

  const entradaCatracaMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (!eventosPortaria || !Array.isArray(eventosPortaria)) return map
    const sorted = [...eventosPortaria].sort((a, b) => (a.data_hora || '').localeCompare(b.data_hora || ''))
    sorted.forEach(e => {
      if (!e.data_hora) return
      const datePart = e.data_hora.slice(0, 10)
      if (!map[datePart]) {
        try {
          const dateObj = new Date(e.data_hora)
          map[datePart] = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        } catch {
          map[datePart] = e.data_hora.slice(11, 16)
        }
      }
    })
    return map
  }, [eventosPortaria])

  const historicoReal = useMemo(() => {
    const list: Array<{ data: string; status: 'P' | 'F' | 'J' | 'A'; horaRegistro?: string; registradoPor?: string }> = []
    
    ;(frequenciasDb || []).forEach(f => {
      let status: 'P' | 'F' | 'J' | 'A' = 'P'
      
      if (f.justificativa === 'Justificada' || f.justificativa?.toLowerCase().includes('justifica')) {
        status = 'J'
      } else if (!f.presente) {
        status = 'F'
      }

      list.push({
        data: f.data,
        status,
        horaRegistro: f.horaRegistro || f.dados?.horaRegistro,
        registradoPor: f.registradoPor || f.dados?.registradoPor
      })
    })
    
    return list.sort((a, b) => b.data.localeCompare(a.data))
  }, [frequenciasDb])

  // Aggregate stats
  const totalAulas = historicoReal.length
  const totalPresencas = historicoReal.filter(h => h.status === 'P').length
  const totalFaltasInjustificadas = historicoReal.filter(h => h.status === 'F' || h.status === 'A').length
  const totalAusenciasJustificadas = historicoReal.filter(h => h.status === 'J').length
  
  const presencaPorcentagem = totalAulas > 0 
    ? Math.round((totalPresencas / totalAulas) * 100) 
    : (aluno?.frequencia || 100)

  // Compute dynamic monthly presence rate
  const distribuicaoMensal = useMemo(() => {
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const grupos: Record<string, { presencas: number; total: number; label: string }> = {}
    
    historicoReal.forEach(h => {
      const parts = h.data.split('-')
      if (parts.length < 2) return
      const anoMes = `${parts[0]}-${parts[1]}`
      const mesIndex = parseInt(parts[1]) - 1
      const label = mesesNomes[mesIndex]
      
      if (!grupos[anoMes]) {
        grupos[anoMes] = { presencas: 0, total: 0, label }
      }
      grupos[anoMes].total += 1
      if (h.status === 'P') {
        grupos[anoMes].presencas += 1
      }
    })
    
    const sortedKeys = Object.keys(grupos).sort().slice(-5)
    return sortedKeys.map(k => {
      const g = grupos[k]
      return {
        m: g.label,
        p: Math.round((g.presencas / g.total) * 100)
      }
    })
  }, [historicoReal])

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault()
    setAtestadoSent(true)
    setTimeout(() => {
      setAtestadoModal(false)
      setAtestadoSent(false)
    }, 2000)
  }

  // Configurações de paginação
  const totalPages = Math.ceil(historicoReal.length / itemsPerPage) || 1
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return historicoReal.slice(start, start + itemsPerPage)
  }, [historicoReal, currentPage, itemsPerPage])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 100, fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-freq-header-bar {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .ad-freq-summary-grid {
            grid-template-columns: 1fr !important;
          }
          .ad-freq-hist-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .ad-freq-hist-badge {
            align-self: flex-start !important;
          }
        }
      `}} />

      {/* Header Premium */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
        className="ad-freq-header-bar"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}
      >
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: 'hsl(var(--text-main))', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)' }}>
              <Activity size={22} />
            </div>
            Frequência
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            Acompanhe o histórico de presenças e horários de entrada via iDFace.
          </p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setAtestadoModal(true)} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white',
            padding: '12px 24px', borderRadius: 16, border: 'none', fontWeight: 800, fontSize: 14,
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)'
          }}
        >
          <Upload size={18} /> Enviar Atestado
        </motion.button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="ad-freq-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        
        {/* Card Presença */}
        <motion.div variants={cardVariants} style={{ padding: 24, background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: 24, border: '1px solid rgba(59, 130, 246, 0.1)', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 140, height: 140, background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> Presença Atual
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#1e293b', letterSpacing: '-0.03em', lineHeight: 1 }}>{presencaPorcentagem}%</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: 500 }}>
            {totalAulas > 0 ? `Baseado em ${totalAulas} registros de chamada` : 'Frequência curricular geral'}
          </div>
        </motion.div>

        {/* Card Faltas */}
        <motion.div variants={cardVariants} style={{ padding: 24, background: '#ffffff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> Faltas (Injustificadas)
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>{totalFaltasInjustificadas}</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, fontWeight: 500 }}>Ausências sem justificativa</div>
        </motion.div>

        {/* Card Justificadas */}
        <motion.div variants={cardVariants} style={{ padding: 24, background: '#ffffff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} /> Ausências Justificadas
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>{totalAusenciasJustificadas}</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, fontWeight: 500 }}>Com atestado validado</div>
        </motion.div>
      </motion.div>

      {/* Dynamic Monthly Chart & History Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        
        {distribuicaoMensal.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ padding: 28, background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 15px 35px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 28, color: '#1e293b' }}>Distribuição Mensal</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, paddingBottom: 16, borderBottom: '2px solid #f8fafc' }}>
              {distribuicaoMensal.map((item, i) => (
                 <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, height: '100%' }}>
                   <div style={{ width: '100%', maxWidth: 40, background: '#f1f5f9', height: '100%', borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
                     <motion.div 
                       initial={{ height: 0 }} animate={{ height: `${item.p}%` }} transition={{ duration: 1, type: "spring", stiffness: 50 }}
                       style={{ 
                         position: 'absolute', bottom: 0, left: 0, right: 0,
                         background: item.p >= 95 ? 'linear-gradient(0deg, #3b82f6 0%, #60a5fa 100%)' : 'linear-gradient(0deg, #f59e0b 0%, #fbbf24 100%)',
                         borderRadius: 12
                       }} 
                     />
                   </div>
                   <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b' }}>{item.m}</div>
                 </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent History */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 15px 35px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#1e293b' }}>Histórico Recente</h3>
            {isLoadingFrequencias && <Loader2 size={18} className="spin" color="#94a3b8" />}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {paginatedHistory.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Activity size={48} color="#e2e8f0" style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>Nenhum registro encontrado</div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Os dados de frequência e catraca aparecerão aqui.</div>
              </div>
            ) : (
              paginatedHistory.map((h, i) => {
                const dataObj = new Date(h.data + 'T00:00:00')
                const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })
                const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)
                
                const isPresenca = h.status === 'P'
                const isFaltaJustificada = h.status === 'J'
                
                // Prioritize 'horaRegistro' from 'frequenciasDb' directly. Fallback to 'entradaCatracaMap'.
                const entradaTime = h.horaRegistro || entradaCatracaMap[h.data]
                
                // Check if it was registered by IDFace explicitly or if it has an entry time.
                const isIdFace = (h.registradoPor && h.registradoPor.toLowerCase().includes('idface')) || entradaTime
                
                return (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="ad-freq-hist-item" 
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      padding: '20px 28px', borderBottom: i < paginatedHistory.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background 0.2s'
                    }}
                    whileHover={{ background: '#f8fafc' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                       <div style={{ 
                         background: isPresenca ? '#f0fdf4' : isFaltaJustificada ? '#eff6ff' : '#fef2f2', 
                         color: isPresenca ? '#16a34a' : isFaltaJustificada ? '#3b82f6' : '#ef4444', 
                         padding: 12, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'
                       }}>
                         {isPresenca ? <CheckCircle2 size={24} /> : isFaltaJustificada ? <FileText size={24} /> : <AlertTriangle size={24} />}
                       </div>
                       <div>
                         <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                           {isPresenca ? 'Presença Confirmada' : isFaltaJustificada ? 'Ausência Justificada' : 'Falta Registrada'}
                         </div>
                         <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4, fontWeight: 500 }}>
                           <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {dataCapitalizada}</span>
                           
                           {isIdFace ? (
                             <span style={{ 
                               display: 'inline-flex', alignItems: 'center', gap: 4, 
                               fontSize: 11, fontWeight: 800, color: '#0ea5e9', 
                               background: '#e0f2fe', padding: '4px 10px', borderRadius: 8, border: '1px solid #bae6fd'
                             }}>
                               <ShieldCheck size={14} /> iDFace: {entradaTime?.slice(0,5)}h
                             </span>
                           ) : isPresenca ? (
                             <span style={{ 
                               display: 'inline-flex', alignItems: 'center', gap: 4, 
                               fontSize: 11, fontWeight: 800, color: '#64748b', 
                               background: '#f1f5f9', padding: '4px 10px', borderRadius: 8 
                             }}>
                               Lançamento Manual (Professor)
                             </span>
                           ) : null}
                         </div>
                       </div>
                    </div>
                    <div className="ad-freq-hist-badge" style={{
                      padding: '6px 14px', borderRadius: 12, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
                      background: isPresenca ? '#dcfce7' : isFaltaJustificada ? '#dbeafe' : '#fee2e2',
                      color: isPresenca ? '#166534' : isFaltaJustificada ? '#1e40af' : '#991b1b'
                    }}>
                      {isPresenca ? 'Presente' : isFaltaJustificada ? 'Justificada' : 'Injustificada'}
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                Página <strong style={{ color: '#1e293b' }}>{currentPage}</strong> de <strong style={{ color: '#1e293b' }}>{totalPages}</strong> <span style={{ opacity: 0.6 }}>({historicoReal.length} registros)</span>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                  disabled={currentPage === 1}
                  style={{ 
                    height: 36, padding: '0 16px', fontSize: 13, fontWeight: 700, borderRadius: 12, 
                    background: '#fff', border: '1px solid #e2e8f0', color: '#334155',
                    display: 'flex', alignItems: 'center', gap: 6, 
                    opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                  disabled={currentPage === totalPages}
                  style={{ 
                    height: 36, padding: '0 16px', fontSize: 13, fontWeight: 700, borderRadius: 12, 
                    background: '#fff', border: '1px solid #e2e8f0', color: '#334155',
                    display: 'flex', alignItems: 'center', gap: 6, 
                    opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  Próxima <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Upload Atestado Modal */}
      <AnimatePresence>
        {atestadoModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }} 
            onClick={() => setAtestadoModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              transition={{ type: "spring", stiffness: 300, damping: 25 }} 
              style={{ background: '#fff', padding: 32, borderRadius: 28, width: '100%', maxWidth: 420, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} 
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: '#0f172a', letterSpacing: '-0.02em' }}>Enviar Atestado</h3>
              <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500, marginBottom: 24 }}>Justifique ausências anexando um documento válido.</p>
              
              {!atestadoSent ? (
                <form onSubmit={handleUpload}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Data da Ausência</label>
                    <input type="date" required style={{ width: '100%', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 16px', fontSize: 15, fontWeight: 500, color: '#1e293b', outline: 'none', background: '#f8fafc' }} />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Anexar Arquivo</label>
                    <div style={{ border: '2px dashed #cbd5e1', padding: '32px 20px', borderRadius: 16, textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
                      <FileText size={32} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#334155' }}>Clique para procurar</div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Formatos aceitos: JPG, PNG, PDF</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => setAtestadoModal(false)} style={{ flex: 1, padding: '14px', borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" style={{ flex: 2, padding: '14px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)' }}>Enviar Atestado</button>
                  </div>
                </form>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                    <CheckCircle2 size={72} color="#10b981" style={{ margin: '0 auto 20px' }} />
                  </motion.div>
                  <h4 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Enviado com Sucesso!</h4>
                  <p style={{ fontSize: 15, color: '#64748b', marginTop: 8, fontWeight: 500 }}>O atestado será analisado pela secretaria.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
