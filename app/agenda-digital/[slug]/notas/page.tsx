'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useState, useMemo, useEffect } from 'react'
import { GraduationCap, Download, ChevronRight, TrendingUp, TrendingDown, AlertCircle, FileText, BarChart2 } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { motion, AnimatePresence } from 'framer-motion'

export default function ADNotasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital();

  if (adConfig?.permissoes?.visualizarNotas === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização de boletim e notas está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica. Para mais informações, entre em contato com a secretaria."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    );
  }

  const { aluno } = useSelectedStudent()

  // Fetch real data
  const { data: responseData, isLoading } = useApiQuery<any>(
    ['boletins', aluno?.id || ''],
    `/api/boletins?aluno_id=${aluno?.id}`,
    {},
    { enabled: !!aluno?.id }
  )

  const boletins = responseData?.data || []

  // Extract periods (bimestres) available
  const bimestresDisponiveis = useMemo(() => {
    if (!boletins.length) return []
    return boletins.map((b: any) => {
      const dados = typeof b.dados === 'string' ? JSON.parse(b.dados) : b.dados
      return { id: b.id, nome: dados.bimestre, dados }
    }).sort((a: any, b: any) => a.nome.localeCompare(b.nome))
  }, [boletins])

  const [selectedBimestreId, setSelectedBimestreId] = useState<string | null>(null)

  // Auto-select first available period
  useEffect(() => {
    if (bimestresDisponiveis.length > 0 && !selectedBimestreId) {
      setSelectedBimestreId(bimestresDisponiveis[0].id)
    }
  }, [bimestresDisponiveis, selectedBimestreId])

  const boletimAtual = useMemo(() => {
    if (!selectedBimestreId) return null
    return bimestresDisponiveis.find((b: any) => b.id === selectedBimestreId)
  }, [selectedBimestreId, bimestresDisponiveis])

  const disciplinas = useMemo(() => {
    if (!boletimAtual || !boletimAtual.dados.disciplinas) return []
    return boletimAtual.dados.disciplinas.map((d: any) => ({
      ...d,
      mediaFNum: parseFloat(String(d.mediaF).replace(',', '.')) || 0
    }))
  }, [boletimAtual])

  const mediaGlobal = useMemo(() => {
     if (!disciplinas.length) return 0
     const sum = disciplinas.reduce((acc: number, curr: any) => acc + curr.mediaFNum, 0)
     return parseFloat((sum / disciplinas.length).toFixed(1))
  }, [disciplinas])

  const isAcima = mediaGlobal >= 7.0

  if (!aluno) return null

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div className="spinner" style={{ width: 40, height: 40, border: '4px solid rgba(37,99,235,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: '#64748b', fontSize: 15, fontWeight: 500 }}>Buscando notas do aluno...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (boletins.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Nenhum Boletim"
          description="Ainda não há notas ou boletins lançados para este aluno no sistema."
          icon={<FileText size={48} style={{ color: '#94a3b8', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, color: '#0f172a' }}>Boletim e Notas</h2>
        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 600, padding: '8px 16px', borderRadius: 12 }}>
          <Download size={16} /> <span className="hide-on-mobile">Baixar PDF</span>
        </button>
      </div>

      {/* Seletor de Bimestre Ultra Moderno */}
      {bimestresDisponiveis.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 8, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {bimestresDisponiveis.map((b: any) => (
            <button
              key={b.id}
              onClick={() => setSelectedBimestreId(b.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                whiteSpace: 'nowrap',
                transition: 'all 0.3s',
                cursor: 'pointer',
                background: selectedBimestreId === b.id ? '#0f172a' : '#f1f5f9',
                color: selectedBimestreId === b.id ? '#ffffff' : '#64748b',
                boxShadow: selectedBimestreId === b.id ? '0 4px 12px rgba(15,23,42,0.15)' : 'none'
              }}
            >
              {b.nome}
            </button>
          ))}
        </div>
      )}

      {boletimAtual && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
          {/* Card Resumo Global */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            key={boletimAtual.id}
            style={{ 
              padding: 32, 
              background: isAcima ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', 
              color: 'white', 
              borderRadius: 24,
              border: 'none', 
              position: 'relative', 
              overflow: 'hidden',
              boxShadow: isAcima ? '0 20px 40px -15px rgba(37,99,235,0.4)' : '0 20px 40px -15px rgba(239,68,68,0.4)'
            }}
          >
             <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', filter: 'blur(50px)' }} />
             <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, background: 'rgba(0,0,0,0.1)', borderRadius: '50%', filter: 'blur(40px)' }} />
             
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, position: 'relative' }}>
               <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                 <GraduationCap size={20} />
               </div>
               <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: 13, opacity: 0.95 }}>Média Global</div>
             </div>
             
             <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, position: 'relative' }}>
               <div style={{ fontSize: 72, fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1, textShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                 {mediaGlobal.toFixed(1)}
               </div>
             </div>
             
             <div style={{ fontSize: 14, opacity: 0.9, marginTop: 12, fontWeight: 500, position: 'relative' }}>
               Referente ao {boletimAtual.nome} {boletimAtual.dados.ano ? `de ${boletimAtual.dados.ano}` : ''}
             </div>

             <div style={{ marginTop: 24, padding: '14px 20px', background: 'rgba(0,0,0,0.25)', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
               {isAcima ? <TrendingUp size={20} color="#34d399"/> : <TrendingDown size={20} color="#fca5a5"/>}
               <span style={{ fontSize: 14, fontWeight: 600 }}>
                 {isAcima ? 'Desempenho dentro do esperado' : 'Requer atenção e acompanhamento'}
               </span>
             </div>
          </motion.div>

          {/* Tabela de Disciplinas Modernizada */}
          <div style={{ background: '#fff', borderRadius: 24, padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={16} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>Rendimento por Disciplina</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={selectedBimestreId} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {disciplinas.map((d: any, i: number) => {
                    const isPassed = d.mediaFNum >= 7.0
                    return (
                      <div key={i} style={{ 
                        padding: '16px', 
                        background: '#f8fafc', 
                        borderRadius: 16, 
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15, marginBottom: 4 }}>{d.nome}</div>
                            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12 }}>
                              <span>AVM: <strong>{d.avm}</strong></span>
                              <span>AVB: <strong>{d.avb}</strong></span>
                            </div>
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: isPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isPassed ? '#059669' : '#dc2626',
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            fontWeight: 800,
                            fontSize: 18,
                            fontFamily: 'Outfit, sans-serif',
                            border: `1px solid ${isPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            {d.mediaF}
                          </div>
                        </div>

                        {/* Barra de Progresso Animada */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(d.mediaFNum * 10, 100)}%` }}
                              transition={{ duration: 1, ease: "easeOut", delay: 0.1 * i }}
                              style={{ 
                                height: '100%', 
                                background: isPassed ? '#10b981' : '#ef4444', 
                                borderRadius: 3 
                              }} 
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isPassed ? '#10b981' : '#ef4444', minWidth: 70, textAlign: 'right' }}>
                            {isPassed ? 'Aprovado' : 'Atenção'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 480px) {
          .hide-on-mobile { display: none; }
        }
      `}} />
    </motion.div>
  )
}
