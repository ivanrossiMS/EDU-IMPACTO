'use client'

import React, { useEffect, useState } from 'react'
import { X, Printer, CheckSquare, Layers, Calendar, Users, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface GabaritoProvaModalProps {
  provaUploadId: string
  onClose: () => void
}

export function GabaritoProvaModal({ provaUploadId, onClose }: GabaritoProvaModalProps) {
  const [loading, setLoading] = useState(true)
  const [prova, setProva] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase.from('provas_upload').select('*').eq('id', provaUploadId).single()
        const p = data as any
        if (error) throw error

        let bimestreNome = 'Sem Bimestre'
        if (p?.id_bimestre) {
          const { data: b } = await supabase.from('simulados_bimestres').select('nome').eq('id', p.id_bimestre).single()
          if (b) bimestreNome = (b as any).nome
        }

        if (p) {
          setProva({ ...p, simulados_bimestres: { nome: bimestreNome } })
          setQuestoes(p.questoes_json || [])
        }
      } catch (err) {
        console.error('Erro ao carregar gabarito:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [provaUploadId])

  const handlePrint = () => {
    window.print()
  }

  // Print Styles Injection
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        @page { margin: 1cm; size: A4 portrait; }
        body * { visibility: hidden; }
        #gabarito-print-area, #gabarito-print-area * { visibility: visible; }
        #gabarito-print-area {
          position: absolute; left: 0; top: 0; width: 100%;
          padding: 0; background: white !important; color: black !important;
        }
        .no-print { display: none !important; }
        
        #gabarito-print-area h1 { font-size: 16px !important; margin-bottom: 6px !important; }
        #gabarito-print-area .print-header-info { font-size: 10px !important; gap: 8px !important; }
        #gabarito-print-area .print-header-info svg { width: 12px !important; height: 12px !important; }
        #gabarito-print-area > div:first-child { margin-bottom: 12px !important; }
        
        #gabarito-print-area .print-grid-container { padding: 8px !important; }
        #gabarito-print-area .print-grid-columns { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; column-count: auto !important; }
        
        .gabarito-list-item {
          padding: 3px 6px !important;
          margin-bottom: 4px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 4px !important;
          box-shadow: none !important;
        }
        .gabarito-list-item span { font-size: 10px !important; }
        .gabarito-bubble {
          width: 18px !important; height: 18px !important; font-size: 10px !important;
          border: 1px solid #000 !important; color: #000 !important; background: #fff !important;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
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
                <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prova?.titulo || 'Gerado pelo sistema EDU-IMPACTO'}</p>
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
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 12px', textTransform: 'uppercase' }}>Gabarito: {prova?.titulo || 'Prova'}</h1>
                <div className="print-header-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                    <Calendar size={14} /> <span>Aplicação: {prova?.data_aplicacao ? new Date(prova.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data não definida'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                    <Layers size={14} /> <span>{prova?.simulados_bimestres?.nome || 'Sem Bimestre'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                    <Users size={14} /> <span>Turmas: {Array.isArray(prova?.series) ? prova.series.join(', ') : (prova?.series || 'Geral')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                    <FileText size={14} color="#3b82f6" /> <span style={{ color: '#3b82f6' }}>Total: {questoes.filter(q => q.tipo_questao !== 'texto_apoio').length} Questões</span>
                  </div>
                </div>
              </div>

              {/* Grid de Respostas */}
              <div className="print-grid-container" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, breakInside: 'avoid' }}>
                {(() => {
                  const meQuestoes = questoes.filter(q => q.tipo_questao !== 'texto_apoio')
                  return (
                    <div className="print-grid-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                      {[
                        meQuestoes.slice(0, Math.ceil(meQuestoes.length / 2)),
                        meQuestoes.slice(Math.ceil(meQuestoes.length / 2))
                      ].map((colQuestoes, colIndex) => (
                        <div key={colIndex} style={{ display: 'flex', flexDirection: 'column' }}>
                          {colQuestoes.map((q, idx) => {
                            const num = colIndex === 0 ? idx + 1 : Math.ceil(meQuestoes.length / 2) + idx + 1
                        const alternativaCorreta = q.alternativas?.find((a: any) => a.correct)
                        const letraCorreta = alternativaCorreta ? alternativaCorreta.letter : '?'

                        return (
                          <div 
                            key={q.id || num} 
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
                  ))}
                </div>
              )})()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
