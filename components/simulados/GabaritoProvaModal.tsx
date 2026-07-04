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
                    <FileText size={14} color="#3b82f6" /> <span style={{ color: '#3b82f6' }}>Total: {questoes.length} Questões</span>
                  </div>
                </div>
              </div>

              {/* Grid de Respostas */}
              <div className="print-grid-container" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, breakInside: 'avoid' }}>
                <div className="print-grid-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {[
                    questoes.slice(0, Math.ceil(questoes.length / 2)),
                    questoes.slice(Math.ceil(questoes.length / 2))
                  ].map((colQuestoes, colIndex) => (
                    <div key={colIndex} style={{ display: 'flex', flexDirection: 'column' }}>
                      {colQuestoes.map((q, idx) => {
                        const num = colIndex === 0 ? idx + 1 : Math.ceil(questoes.length / 2) + idx + 1
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
