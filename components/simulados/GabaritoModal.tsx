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
        reqs.forEach((r: any) => {
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
        const sorted = [...q].sort((a: any, b: any) => {
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
    <div className="gabarito-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <style>{`
        .modal-close-btn-modern {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #ef4444;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.08);
        }
        .modal-close-btn-modern:hover {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.5);
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);
          transform: translateY(-1px);
        }
        .modal-close-btn-modern:active {
          transform: scale(0.92);
        }
        .mobile-header-close {
          display: none;
        }
        .desktop-header-close {
          display: flex;
        }
        @media (max-width: 640px) {
          .gabarito-modal-overlay {
            padding: 10px !important;
          }
          .gabarito-modal-box {
            height: 94vh !important;
            border-radius: 20px !important;
          }
          .gabarito-modal-header {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 14px 16px !important;
            gap: 12px !important;
          }
          .mobile-header-top {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
            gap: 10px !important;
          }
          .mobile-header-close {
            display: flex !important;
          }
          .desktop-header-close {
            display: none !important;
          }
          .gabarito-modal-actions {
            width: 100% !important;
            display: flex !important;
          }
          .gabarito-modal-actions button {
            flex: 1 !important;
            justify-content: center !important;
          }
        }
      `}</style>

      {/* Container Principal */}
      <div 
        className="gabarito-modal-box"
        style={{ 
          background: 'hsl(var(--bg-app))', 
          width: '100%', 
          maxWidth: 900, 
          height: '90vh', 
          borderRadius: 24, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          boxShadow: '0 32px 64px rgba(0,0,0,0.3)',
          border: '1px solid hsl(var(--border-subtle))'
        }}
      >
        {/* Header Modal (No Print) */}
        <div className="no-print gabarito-modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-surface))', gap: 16 }}>
          <div className="mobile-header-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                <CheckSquare size={20} color="white" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gabarito Oficial</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{simulado?.titulo || 'Gerado pelo sistema EDU-IMPACTO'}</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button 
              className="modal-close-btn-modern mobile-header-close"
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar modal"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          
          <div className="gabarito-modal-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#10b981', color: 'white', padding: '10px 18px', borderRadius: 12, border: 'none', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.25)', fontSize: 13, transition: 'all 0.2s' }}>
              <Printer size={16} /> Imprimir Gabarito
            </button>
            <button 
              className="modal-close-btn-modern desktop-header-close" 
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar modal"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Área de Impressão */}
        <div id="gabarito-print-area" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', background: '#ffffff', color: '#0f172a' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>Gerando gabarito...</div>
          ) : (
            <>
              {/* Header do Documento */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 12px', textTransform: 'uppercase' }}>Gabarito: {simulado?.titulo || 'Simulado'}</h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                    <Calendar size={14} /> <span>Aplicação: {simulado?.data_aplicacao ? new Date(simulado.data_aplicacao).toLocaleDateString('pt-BR') : 'Data não definida'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                    <Layers size={14} /> <span>{simulado?.simulados_bimestres?.nome || 'Sem Bimestre'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                    <Users size={14} /> <span>Turmas: {simulado?.turmas?.join(', ') || 'Geral'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                    <FileText size={14} color="#3b82f6" /> <span style={{ color: '#3b82f6' }}>Total: {questoes.filter(q => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio).length} Questões</span>
                  </div>
                </div>
              </div>

              {/* Grid Moderno de Respostas Agrupadas por Disciplina */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const meQuestoes = questoes.filter(q => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio)
                  const grouped: Record<string, typeof meQuestoes> = {}
                  meQuestoes.forEach(q => {
                    const disc = q.simulados_disciplinas?.nome || 'Geral'
                    if (!grouped[disc]) grouped[disc] = []
                    grouped[disc].push(q)
                  })

                  return Object.entries(grouped).map(([disciplina, questoesDisciplina]) => (
                    <div key={disciplina} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, breakInside: 'avoid' }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 6 }}>
                        {disciplina}
                      </h3>
                      <div style={{ columnCount: 2, columnGap: 16 }}>
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
                                borderRadius: 8,
                                padding: '8px 12px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                marginBottom: 8,
                                breakInside: 'avoid',
                                pageBreakInside: 'avoid'
                              }}
                            >
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                                Questão {num.toString().padStart(2, '0')}
                              </span>
                              <div 
                                className="gabarito-bubble"
                                style={{ 
                                  width: 28, 
                                  height: 28, 
                                  borderRadius: '50%', 
                                  background: letraCorreta !== '?' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                                  color: letraCorreta !== '?' ? '#10b981' : '#ef4444', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  fontSize: 14, 
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
