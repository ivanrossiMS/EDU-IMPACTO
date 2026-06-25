'use client'

import React, { useEffect, useState } from 'react'
import { X, Printer, CheckSquare, Layers, Calendar, Users, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface GabaritoModalProps {
  simuladoId: string
  onClose: () => void
}

export function GabaritoModal({ simuladoId, onClose }: GabaritoModalProps) {
  const [loading, setLoading] = useState(true)
  const [simulado, setSimulado] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      // 1. Get simulado info
      const { data: sim } = await supabase.from('simulados').select('*, simulados_bimestres(nome)').eq('id', simuladoId).single()
      if (sim) setSimulado(sim)

      // 2. Get simulado requisicoes to know the discipline order
      const { data: reqs } = await supabase
        .from('simulados_requisicoes')
        .select('id_disciplina, created_at')
        .eq('id_simulado', simuladoId)
        .order('created_at', { ascending: true })
      
      const disciplineOrder: string[] = []
      if (reqs) {
        reqs.forEach(r => {
          if (!disciplineOrder.includes(r.id_disciplina)) {
            disciplineOrder.push(r.id_disciplina)
          }
        })
      }

      // 3. Get questoes and alternativas
      const { data: q } = await supabase
        .from('simulados_questoes')
        .select('*, simulados_disciplinas(nome), simulados_alternativas(id, letra, eh_correta)')
        .eq('id_simulado', simuladoId)

      if (q) {
        const sorted = [...q].sort((a, b) => {
          const indexA = disciplineOrder.indexOf(a.id_disciplina)
          const indexB = disciplineOrder.indexOf(b.id_disciplina)
          
          if (indexA !== indexB) {
            const aRank = indexA !== -1 ? indexA : 9999
            const bRank = indexB !== -1 ? indexB : 9999
            return aRank - bRank
          }
          
          const orderA = a.ordem || 0
          const orderB = b.ordem || 0
          if (orderA !== orderB) return orderA - orderB
          
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
        setQuestoes(sorted)
      }

      setLoading(false)
    }

    loadData()
  }, [simuladoId])

  const handlePrint = () => {
    window.print()
  }

  // Print Styles Injection
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #gabarito-print-area, #gabarito-print-area * {
          visibility: visible;
        }
        #gabarito-print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 20px;
          background: white !important;
          color: black !important;
        }
        .no-print {
          display: none !important;
        }
        .gabarito-bubble {
          border: 2px solid #000 !important;
          color: #000 !important;
          background: #fff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .gabarito-card {
          border: 1px solid #ccc !important;
          break-inside: avoid;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      {/* Container Principal */}
      <div 
        style={{ 
          background: 'hsl(var(--bg-app))', 
          width: '100%', 
          maxWidth: 900, 
          height: '90vh', 
          borderRadius: 24, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          border: '1px solid hsl(var(--border-subtle))'
        }}
      >
        {/* Header Modal (No Print) */}
        <div className="no-print" style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-surface))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              <CheckSquare size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Gabarito Oficial</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 13 }}>Gerado pelo sistema EDU-IMPACTO</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#10b981', color: 'white', padding: '10px 16px', borderRadius: 10, border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)', transition: 'all 0.2s' }}>
              <Printer size={18} /> Imprimir Gabarito
            </button>
            <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Área de Impressão */}
        <div id="gabarito-print-area" style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: '#ffffff', color: '#0f172a' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>Gerando gabarito...</div>
          ) : (
            <>
              {/* Header do Documento */}
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>{simulado?.titulo || 'Simulado'}</h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 14 }}>
                    <Calendar size={16} /> <span>Aplicação: {simulado?.data_aplicacao ? new Date(simulado.data_aplicacao).toLocaleDateString('pt-BR') : 'Data não definida'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 14 }}>
                    <Layers size={16} /> <span>{simulado?.simulados_bimestres?.nome || 'Sem Bimestre'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 14 }}>
                    <Users size={16} /> <span>Turmas: {simulado?.turmas?.join(', ') || 'Geral'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}>
                    <FileText size={16} color="#3b82f6" /> <span style={{ color: '#3b82f6' }}>Total: {questoes.length} Questões</span>
                  </div>
                </div>
              </div>

              {/* Grid Moderno de Respostas Agrupadas por Disciplina */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {(() => {
                  const grouped: Record<string, typeof questoes> = {}
                  questoes.forEach(q => {
                    const disc = q.simulados_disciplinas?.nome || 'Geral'
                    if (!grouped[disc]) grouped[disc] = []
                    grouped[disc].push(q)
                  })

                  return Object.entries(grouped).map(([disciplina, questoesDisciplina]) => (
                    <div key={disciplina} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, breakInside: 'avoid' }}>
                      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>
                        {disciplina}
                      </h3>
                      <div style={{ columnCount: 2, columnGap: 24 }}>
                        {questoesDisciplina.map((q) => {
                          const num = questoes.findIndex(item => item.id === q.id) + 1
                          const alternativaCorreta = q.simulados_alternativas?.find((a: any) => a.eh_correta)
                          const letraCorreta = alternativaCorreta ? alternativaCorreta.letra : '?'

                          return (
                            <div 
                              key={q.id} 
                              className="gabarito-list-item"
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 12,
                                padding: '12px 16px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                marginBottom: 12,
                                breakInside: 'avoid',
                                pageBreakInside: 'avoid'
                              }}
                            >
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                                Questão {num.toString().padStart(2, '0')}
                              </span>
                              <div 
                                className="gabarito-bubble"
                                style={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: '50%', 
                                  background: letraCorreta !== '?' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                                  color: letraCorreta !== '?' ? '#10b981' : '#ef4444', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  fontSize: 16, 
                                  fontWeight: 800,
                                  border: letraCorreta !== '?' ? '2px solid rgba(16,185,129,0.2)' : '2px dashed rgba(239,68,68,0.3)'
                                }}
                              >
                                {letraCorreta}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
              </div>
              
              {questoes.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: 'hsl(var(--text-secondary))', padding: 60, border: '1px dashed hsl(var(--border-subtle))', borderRadius: 20 }}>
                  <p>Este simulado ainda não possui questões cadastradas.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
