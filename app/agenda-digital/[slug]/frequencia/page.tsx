'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import React, { useState, useMemo, use } from 'react'
import { Upload, CheckCircle2, AlertTriangle, AlertCircle, FileText, Activity, Loader2 } from 'lucide-react'
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

  // Buscar eventos de portaria (acesso à catraca) do aluno
  const { data: eventosPortaria = [] } = useApiQuery<any[]>(
    ['portaria-eventos-aluno', resolvedParams.slug],
    '/api/portaria/eventos',
    { aluno_id: resolvedParams.slug },
    { enabled: !!resolvedParams.slug }
  )

  // Mapear primeiro horário de acesso de portaria do dia
  const entradaCatracaMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (!eventosPortaria || !Array.isArray(eventosPortaria)) return map

    // Ordenar de forma crescente para capturar a primeira entrada do dia
    const sorted = [...eventosPortaria].sort((a, b) => {
      const timeA = a.data_hora || ''
      const timeB = b.data_hora || ''
      return timeA.localeCompare(timeB)
    })

    sorted.forEach(e => {
      if (!e.data_hora) return
      const datePart = e.data_hora.slice(0, 10) // YYYY-MM-DD
      if (!map[datePart]) {
        try {
          const dateObj = new Date(e.data_hora)
          const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          map[datePart] = timeFormatted
        } catch {
          map[datePart] = e.data_hora.slice(11, 16)
        }
      }
    })
    return map
  }, [eventosPortaria])

  const historicoReal = useMemo(() => {
    const list: Array<{ data: string; status: 'P' | 'F' | 'J' | 'A' }> = []
    
    ;(frequenciasDb || []).forEach(f => {
      let status: 'P' | 'F' | 'J' | 'A' = 'P'
      
      if (f.justificativa === 'Justificada' || f.justificativa?.toLowerCase().includes('justifica')) {
        status = 'J'
      } else if (!f.presente) {
        status = 'F'
      }

      list.push({
        data: f.data,
        status
      })
    })
    
    // Sort by date descending
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

  return (
    <div>
      <div className="ad-frequencia-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Frequência Escolar</h2>
        <button onClick={() => setAtestadoModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={16} /> Enviar Atestado
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="card ad-freq-card" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))', border: '1px solid rgba(99,102,241,0.2)', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <Activity size={120} style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.05, color: 'hsl(var(--primary))' }} />
          <div className="ad-freq-label" style={{ fontSize: 13, color: 'hsl(var(--primary))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Presença Atual</div>
          <div className="ad-freq-number" style={{ fontSize: 48, fontWeight: 800, color: 'hsl(var(--text-main))', fontFamily: 'Outfit, sans-serif' }}>{presencaPorcentagem}%</div>
          <div className="ad-freq-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
            {totalAulas > 0 ? `Com base em ${totalAulas} registros de chamada` : 'Frequência curricular geral'}
          </div>
        </div>
        <div className="card ad-freq-card" style={{ padding: 24, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div className="ad-freq-label" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Faltas Injustificadas</div>
          <div className="ad-freq-number" style={{ fontSize: 36, fontWeight: 800, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>{totalFaltasInjustificadas}</div>
          <div className="ad-freq-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Registros de ausência sem justificativa</div>
        </div>
        <div className="card ad-freq-card" style={{ padding: 24, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div className="ad-freq-label" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Ausências Justificadas</div>
          <div className="ad-freq-number" style={{ fontSize: 36, fontWeight: 800, color: '#3b82f6', fontFamily: 'Outfit, sans-serif' }}>{totalAusenciasJustificadas}</div>
          <div className="ad-freq-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Com atestado ou justificativa aceita</div>
        </div>
      </div>

      {/* Dynamic Monthly Chart */}
      {distribuicaoMensal.length > 0 && (
        <div className="card ad-freq-chart-card" style={{ padding: 24, marginBottom: 32, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Distribuição Mensal</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5%', height: 160, paddingBottom: 8, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            {distribuicaoMensal.map((item, i) => (
               <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%' }}>
                 <div style={{ 
                   width: '100%', 
                   maxWidth: 48, 
                   background: item.p >= 95 ? 'hsl(var(--primary))' : '#f59e0b',
                   height: `${item.p}%`, 
                   borderRadius: '6px 6px 0 0',
                   transition: 'height 1s',
                   marginTop: 'auto'
                 }}></div>
                 <div style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-muted))', marginTop: 8 }}>{item.m} ({item.p}%)</div>
               </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent History */}
      <div className="card ad-freq-hist-card" style={{ padding: 0, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <div className="ad-freq-hist-header" style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface-alt))' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Histórico Recente</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {paginatedHistory.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
              Nenhum registro de frequência localizado para este aluno.
            </div>
          ) : (
            paginatedHistory.map((h, i) => {
              const dataObj = new Date(h.data + 'T00:00:00')
              const dataFormatada = dataObj.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })
              const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)
              
              const isPresenca = h.status === 'P'
              const isFaltaJustificada = h.status === 'J'
              const entradaTime = entradaCatracaMap[h.data]
              
              return (
                <div key={i} className="ad-freq-hist-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: i < paginatedHistory.length - 1 ? '1px solid hsl(var(--border-subtle))' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <div className="avatar" style={{ 
                       background: isPresenca ? '#f0fdf4' : isFaltaJustificada ? '#eff6ff' : '#fef2f2', 
                       color: isPresenca ? '#16a34a' : isFaltaJustificada ? '#3b82f6' : '#ef4444', 
                       padding: 8, 
                       borderRadius: 8 
                     }}>
                       {isPresenca ? <CheckCircle2 size={20} /> : isFaltaJustificada ? <FileText size={20} /> : <AlertTriangle size={20} />}
                     </div>
                     <div>
                       <div className="ad-freq-hist-title" style={{ fontWeight: 600, color: 'hsl(var(--text-main))' }}>
                         {isPresenca ? 'Presença Registrada' : isFaltaJustificada ? 'Ausência Justificada' : 'Falta Integral'}
                       </div>
                       <div className="ad-freq-hist-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                         <span>{dataCapitalizada}</span>
                         {entradaTime ? (
                           <span style={{ 
                             display: 'inline-flex', 
                             alignItems: 'center', 
                             gap: 4, 
                             fontSize: 11, 
                             fontWeight: 700, 
                             color: '#4f46e5', 
                             background: 'rgba(79, 70, 229, 0.06)', 
                             padding: '2px 8px', 
                             borderRadius: 6,
                             border: '1px solid rgba(79, 70, 229, 0.12)'
                           }}>
                             <Activity size={12} /> Entrada Catraca: {entradaTime}h
                           </span>
                         ) : (
                           <span style={{ 
                             display: 'inline-flex', 
                             alignItems: 'center', 
                             gap: 4, 
                             fontSize: 11, 
                             fontWeight: 500, 
                             color: '#64748b', 
                             background: '#f1f5f9', 
                             padding: '2px 8px', 
                             borderRadius: 6
                           }}>
                             Sem registro de catraca
                           </span>
                         )}
                       </div>
                     </div>
                  </div>
                  <div className={`badge badge-${isPresenca ? 'success' : isFaltaJustificada ? 'primary' : 'error'}`}>
                    {isPresenca ? 'Presente' : isFaltaJustificada ? 'Justificada' : 'Injustificada'}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderTop: '1px solid hsl(var(--border-subtle))',
            background: 'hsl(var(--bg-surface-alt))'
          }}>
            <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({historicoReal.length} registros)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="btn btn-secondary btn-sm" 
                style={{ 
                  height: 32, 
                  padding: '0 12px', 
                  fontSize: 12, 
                  fontWeight: 600, 
                  borderRadius: 8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Anterior
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="btn btn-secondary btn-sm" 
                style={{ 
                  height: 32, 
                  padding: '0 12px', 
                  fontSize: 12, 
                  fontWeight: 600, 
                  borderRadius: 8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {atestadoModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAtestadoModal(false)}>
            <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', padding: 32, borderRadius: 24, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Enviar Atestado Médico</h3>
              {!atestadoSent ? (
                <form onSubmit={handleUpload}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>Data da Falta</label>
                    <input type="date" className="form-input" required style={{ borderRadius: 8, padding: '10px 14px' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label>Anexar Documento</label>
                    <div style={{ border: '2px dashed hsl(var(--border-subtle))', padding: 32, borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: 'hsl(var(--bg-surface-alt))' }}>
                      <FileText size={32} style={{ margin: '0 auto 8px', color: 'hsl(var(--primary))' }} />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Clique para selecionar</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>JPG, PNG ou PDF</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAtestadoModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enviar via APP</button>
                  </div>
                </form>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 16px' }} />
                  <h4 style={{ fontSize: 18, fontWeight: 700 }}>Atestado Enviado!</h4>
                  <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginTop: 8 }}>A nossa secretaria irá analisar o documento em breve.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
