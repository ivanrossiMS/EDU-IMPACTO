'use client'

import React, { useEffect, useState } from 'react'
import { X, Printer, CheckSquare, Layers, Calendar, Users, FileText, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isTextoApoio, isQuestionForRequisicao } from '@/lib/utils'

interface GabaritoProvaModalProps {
  provaUploadId: string
  onClose: () => void
}

function getDisciplineName(q: any, idx: number, reqs: any[] = []): string {
  const direct = q.disciplina_nome || q.disciplina
  if (direct && typeof direct === 'string' && direct.trim() && direct.trim().toLowerCase() !== 'geral') {
    return direct.trim()
  }

  if (Array.isArray(reqs) && reqs.length > 0) {
    if (q.id_requisicao) {
      const found = reqs.find((r: any) => r.id === q.id_requisicao)
      if (found?.disciplina_nome?.trim()) return found.disciplina_nome.trim()
    }
    const discId = q.id_disciplina || q.disciplina_id
    if (discId) {
      const found = reqs.find((r: any) => r.id_disciplina === discId)
      if (found?.disciplina_nome?.trim()) return found.disciplina_nome.trim()
    }
    const matched = reqs.find((r: any) => isQuestionForRequisicao(q, r, reqs, false))
    if (matched?.disciplina_nome?.trim()) return matched.disciplina_nome.trim()

    if (reqs.length === 1 && reqs[0]?.disciplina_nome?.trim()) {
      return reqs[0].disciplina_nome.trim()
    }

    let accumulated = 0
    for (const r of reqs) {
      const count = Number(r.qtd_questoes) || 0
      if (idx >= accumulated && idx < accumulated + count) {
        if (r.disciplina_nome?.trim()) return r.disciplina_nome.trim()
      }
      accumulated += count
    }
  }

  if (direct && typeof direct === 'string' && direct.trim()) {
    return direct.trim()
  }

  return 'Geral'
}

export function GabaritoProvaModal({ provaUploadId, onClose }: GabaritoProvaModalProps) {
  const [loading, setLoading] = useState(true)
  const [prova, setProva] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('todas')

  const questoesValidas = React.useMemo(() => {
    return (questoes || []).filter((q: any) => !isTextoApoio(q))
  }, [questoes])

  const disciplinasAgrupadas = React.useMemo(() => {
    const reqs = prova?.provas_upload_requisicoes || []
    const groups: {
      disciplina: string
      questoes: { q: any; num: number; letra: string }[]
    }[] = []

    questoesValidas.forEach((q: any, idx: number) => {
      const num = q.numero && typeof q.numero === 'number' && q.numero > 0 ? q.numero : idx + 1
      const alt = q.alternativas?.find((a: any) => a.correct || a.eh_correta)
      const letra = alt ? (alt.letter || alt.letra) : (q.gabarito ? String(q.gabarito).toUpperCase() : '?')
      const discNome = getDisciplineName(q, idx, reqs)

      let group = groups.find(g => g.disciplina.toLowerCase() === discNome.toLowerCase())
      if (!group) {
        group = { disciplina: discNome, questoes: [] }
        groups.push(group)
      }
      group.questoes.push({ q, num, letra })
    })

    groups.forEach(g => {
      g.questoes.sort((a, b) => a.num - b.num)
    })

    return groups
  }, [questoesValidas, prova])

  const disciplinasVisiveis = React.useMemo(() => {
    if (selectedDiscipline === 'todas') return disciplinasAgrupadas
    return disciplinasAgrupadas.filter(g => g.disciplina.toLowerCase() === selectedDiscipline.toLowerCase())
  }, [disciplinasAgrupadas, selectedDiscipline])

  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from('provas_upload')
          .select('*, provas_upload_requisicoes(*)')
          .eq('id', provaUploadId)
          .single()
        const p = data as any
        if (error) throw error

        let bimestreNome = 'Sem Bimestre'
        if (p?.id_bimestre) {
          const { data: b } = await supabase.from('simulados_bimestres').select('nome').eq('id', p.id_bimestre).single()
          if (b) bimestreNome = (b as any).nome
        }

        let reqs = p?.provas_upload_requisicoes || []
        if (!reqs || reqs.length === 0) {
          const { data: rData } = await supabase
            .from('provas_upload_requisicoes')
            .select('*')
            .eq('id_prova_upload', provaUploadId)
          if (rData && rData.length > 0) reqs = rData
        }

        if (p) {
          setProva({ ...p, simulados_bimestres: { nome: bimestreNome }, provas_upload_requisicoes: reqs })
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
        html, body {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          height: auto !important;
          min-height: 100% !important;
        }
        .gabarito-modal-overlay {
          position: static !important;
          inset: auto !important;
          background: transparent !important;
          background-color: transparent !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 100% !important;
          display: block !important;
          box-shadow: none !important;
          border: none !important;
        }
        .gabarito-modal-box {
          position: static !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          box-shadow: none !important;
          border: none !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
          border-radius: 0 !important;
        }
        body * { visibility: hidden; }
        #gabarito-print-area, #gabarito-print-area * { visibility: visible; }
        #gabarito-print-area {
          position: absolute; left: 0; top: 0; width: 100%;
          min-height: 100%;
          padding: 0 !important; margin: 0 !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        .no-print { display: none !important; }
        
        #gabarito-print-area h1 { font-size: 16px !important; margin-bottom: 6px !important; }
        #gabarito-print-area .print-header-info { font-size: 10px !important; gap: 8px !important; }
        #gabarito-print-area .print-header-info svg { width: 12px !important; height: 12px !important; }
        #gabarito-print-area > div:first-child { margin-bottom: 12px !important; }
        
        #gabarito-print-area .print-grid-container {
          padding: 4px !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          border: none !important;
          gap: 10px !important;
        }
        .gabarito-disciplina-block {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          margin-bottom: 10px !important;
          padding: 8px 10px !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }
        .gabarito-disciplina-header {
          margin-bottom: 6px !important;
          padding-bottom: 4px !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .gabarito-disciplina-header h3 {
          font-size: 11px !important;
          font-weight: 800 !important;
          color: #000000 !important;
        }
        .gabarito-disciplina-badge {
          font-size: 9px !important;
          padding: 1px 6px !important;
          border: 1px solid #cbd5e1 !important;
          color: #000000 !important;
          background: #f8fafc !important;
        }
        #gabarito-print-area .print-grid-columns { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important; column-count: auto !important; }
        
        .gabarito-list-item {
          padding: 3px 6px !important;
          margin-bottom: 4px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 4px !important;
          box-shadow: none !important;
          background: #ffffff !important;
        }
        .gabarito-list-item span { font-size: 10px !important; color: #000000 !important; }
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
                    <FileText size={14} color="#3b82f6" /> <span style={{ color: '#3b82f6' }}>Total: {questoesValidas.length} Questões</span>
                  </div>
                  {disciplinasAgrupadas.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                      <BookOpen size={14} /> <span>{disciplinasAgrupadas.length} Disciplinas</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Filtros rápidos por Disciplina (No Print) */}
              {disciplinasAgrupadas.length > 1 && (
                <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDiscipline('todas')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: selectedDiscipline === 'todas' ? '1px solid #10b981' : '1px solid #e2e8f0',
                      background: selectedDiscipline === 'todas' ? '#10b981' : '#ffffff',
                      color: selectedDiscipline === 'todas' ? '#ffffff' : '#64748b',
                      boxShadow: selectedDiscipline === 'todas' ? '0 2px 8px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Todas as Disciplinas
                    <span style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: selectedDiscipline === 'todas' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                      color: selectedDiscipline === 'todas' ? '#ffffff' : '#64748b'
                    }}>
                      {questoesValidas.length}
                    </span>
                  </button>
                  {disciplinasAgrupadas.map(group => {
                    const isSelected = selectedDiscipline.toLowerCase() === group.disciplina.toLowerCase()
                    return (
                      <button
                        key={group.disciplina}
                        type="button"
                        onClick={() => setSelectedDiscipline(isSelected ? 'todas' : group.disciplina)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #10b981' : '1px solid #e2e8f0',
                          background: isSelected ? '#10b981' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#64748b',
                          boxShadow: isSelected ? '0 2px 8px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {group.disciplina}
                        <span style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#64748b'
                        }}>
                          {group.questoes.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Grid de Respostas Agrupadas por Disciplina */}
              <div className="print-grid-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {disciplinasVisiveis.map((group) => {
                  const qList = group.questoes
                  const startNum = qList[0]?.num
                  const endNum = qList[qList.length - 1]?.num
                  const rangeText = qList.length === 1
                    ? `Questão ${String(startNum).padStart(2, '0')}`
                    : `Questões ${String(startNum).padStart(2, '0')} a ${String(endNum).padStart(2, '0')}`

                  const half = Math.ceil(qList.length / 2)
                  const col1 = qList.slice(0, half)
                  const col2 = qList.slice(half)

                  return (
                    <div
                      key={group.disciplina}
                      className="gabarito-disciplina-block"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 14,
                        padding: '16px 20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      {/* Cabeçalho da Disciplina */}
                      <div
                        className="gabarito-disciplina-header"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 14,
                          paddingBottom: 10,
                          borderBottom: '1px solid #e2e8f0',
                          flexWrap: 'wrap',
                          gap: 8
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.15))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#10b981',
                            flexShrink: 0
                          }}>
                            <BookOpen size={16} />
                          </div>
                          <h3 style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 800,
                            color: '#0f172a',
                            letterSpacing: '-0.01em',
                            textTransform: 'uppercase'
                          }}>
                            {group.disciplina}
                          </h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="gabarito-disciplina-badge"
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#059669',
                              background: 'rgba(16,185,129,0.1)',
                              padding: '3px 10px',
                              borderRadius: 999,
                              border: '1px solid rgba(16,185,129,0.25)'
                            }}
                          >
                            {qList.length} {qList.length === 1 ? 'questão' : 'questões'}
                          </span>
                          <span
                            className="gabarito-disciplina-badge"
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#64748b',
                              background: '#ffffff',
                              padding: '3px 10px',
                              borderRadius: 999,
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            {rangeText}
                          </span>
                        </div>
                      </div>

                      {/* Grid de Questões */}
                      <div className="print-grid-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                        {[col1, col2].filter(col => col.length > 0).map((colQuestoes, colIndex) => (
                          <div key={colIndex} style={{ display: 'flex', flexDirection: 'column' }}>
                            {colQuestoes.map(({ q, num, letra }) => (
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
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
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
                                    width: 30,
                                    height: 30,
                                    borderRadius: '50%',
                                    background: letra !== '?' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                                    color: letra !== '?' ? '#10b981' : '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 14,
                                    fontWeight: 800,
                                    border: letra !== '?' ? '2px solid rgba(16,185,129,0.3)' : '2px dashed rgba(239,68,68,0.3)'
                                  }}
                                >
                                  {letra}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
