'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Printer, ChevronLeft, Type, CheckSquare, Save, Settings, Info, X } from 'lucide-react'

export default function AdaptarSimuladoPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [simulado, setSimulado] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [requisicoes, setRequisicoes] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fontSize, setFontSize] = useState<number>(14) // base font size in px
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      if (!id) return

      const { data: confData } = await supabase.from('simulados_configuracoes').select('*').eq('id', 'default').single()
      setConfig(confData)

      const { data: simData } = await supabase.from('simulados').select('*').eq('id', id).single()
      if (simData) {
        setSimulado({ ...simData, titulo: `${simData.titulo} (Adaptado)` })
      }

      const { data: reqs } = await supabase.from('simulados_requisicoes').select('*').eq('id_simulado', id).order('created_at', { ascending: true })
      if (reqs) setRequisicoes(reqs)

      const { data: qData } = await supabase.from('simulados_questoes').select(`
        *,
        simulados_disciplinas(nome),
        simulados_alternativas(*)
      `).eq('id_simulado', id)

      if (qData) {
        qData.sort((a: any, b: any) => a.ordem - b.ordem)
        qData.forEach((q: any) => {
          q.simulados_alternativas?.sort((a: any, b: any) => a.letra.localeCompare(b.letra))
        })
        setQuestoes(qData)
        setSelectedIds(new Set(qData.map((q: any) => q.id)))
      }

      setLoading(false)
    }
    loadData()
  }, [id])

  // --- Print Styles Injection ---
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        .print-area, .print-area * { visibility: visible; }
        .print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white !important;
          color: black !important;
        }
        .no-print { display: none !important; }
        .print-page-break { break-after: page; }
        .questao-container { break-inside: avoid; margin-bottom: 24px; }
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  const handleToggleQuestion = (qId: string) => {
    const next = new Set(selectedIds)
    if (next.has(qId)) next.delete(qId)
    else next.add(qId)
    setSelectedIds(next)
  }

  const handleEditEnunciado = (qId: string, newText: string) => {
    setQuestoes(prev => prev.map(q => q.id === qId ? { ...q, enunciado: newText } : q))
  }

  const handleEditAlternativa = (qId: string, altId: string, newText: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          simulados_alternativas: q.simulados_alternativas.map((a: any) => a.id === altId ? { ...a, texto: newText } : a)
        }
      }
      return q
    }))
  }

  const handleRemoveAlternativa = (qId: string, altId: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        const remaining = q.simulados_alternativas.filter((a: any) => a.id !== altId)
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        return {
          ...q,
          simulados_alternativas: remaining.map((a: any, idx: number) => ({
            ...a,
            letra: letters[idx] || a.letra
          }))
        }
      }
      return q
    }))
  }

  const handleSaveAndPrint = async () => {
    if (!confirm('Deseja salvar esta adaptação no banco e imprimir?')) return
    setSaving(true)

    try {
      // 1. Clone Simulado
      const { data: newSimulado, error: simErr } = await supabase.from('simulados').insert({
        titulo: simulado.titulo,
        data_aplicacao: simulado.data_aplicacao,
        id_bimestre: simulado.id_bimestre,
        status: 'rascunho',
        turmas: simulado.turmas
      }).select().single()

      if (simErr) throw simErr

      // 2. Clone Requisições
      if (requisicoes.length > 0) {
        const newReqs = requisicoes.map(r => ({
          id_simulado: newSimulado.id,
          id_disciplina: r.id_disciplina,
          id_professor: r.id_professor,
          quantidade_questoes: r.quantidade_questoes,
          assunto_orientacao: r.assunto_orientacao
        }))
        await supabase.from('simulados_requisicoes').insert(newReqs)
      }

      // 3. Clone selected Questoes and Alternativas
      const selectedList = questoes.filter(q => selectedIds.has(q.id))
      
      for (const q of selectedList) {
        const { data: newQ, error: qErr } = await supabase.from('simulados_questoes').insert({
          id_simulado: newSimulado.id,
          id_disciplina: q.id_disciplina,
          id_professor: q.id_professor,
          enunciado: q.enunciado,
          imagens: q.imagens,
          ordem: q.ordem
        }).select().single()

        if (qErr) continue

        if (q.simulados_alternativas && q.simulados_alternativas.length > 0) {
          const newAlts = q.simulados_alternativas.map((a: any) => ({
            id_questao: newQ.id,
            letra: a.letra,
            texto: a.texto,
            eh_correta: a.eh_correta
          }))
          await supabase.from('simulados_alternativas').insert(newAlts)
        }
      }

      // Automatically trigger print after slight delay
      setTimeout(() => {
        window.print()
        setSaving(false)
        router.push('/simulados/lista')
      }, 500)

    } catch (e: any) {
      alert('Erro ao salvar adaptação: ' + e.message)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <Loader2 className="animate-spin" size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Carregando estúdio de adaptação...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Sidebar de Configurações (No Print) */}
      <div className="no-print" style={{ width: 380, background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 24 }}>
            <ChevronLeft size={18} /> Voltar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={20} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Estúdio de Adaptação</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: 0 }}>Molde a prova visualmente para alunos com necessidades específicas. Remova questões indesejadas e altere o tamanho da fonte global.</p>
        </div>

        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <Type size={16} color="#3b82f6" /> Tamanho da Fonte (Global)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[12, 14, 16, 18, 20, 24].map(size => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    background: fontSize === size ? '#3b82f6' : '#f8fafc',
                    color: fontSize === size ? 'white' : '#475569',
                    border: `1px solid ${fontSize === size ? '#3b82f6' : '#e2e8f0'}`,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: 14
                  }}
                >
                  {size}pt
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <CheckSquare size={16} color="#10b981" /> Resumo de Seleção
            </label>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#475569', fontSize: 14 }}>Questões Originais</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{questoes.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569', fontSize: 14 }}>Questões Selecionadas</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{selectedIds.size}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(245,158,11,0.1)', padding: 16, borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Info size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
              <p style={{ color: '#b45309', fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                Dica: Clique no texto das questões e alternativas na área central para editá-los diretamente. Suas edições serão salvas em uma cópia independente.
              </p>
            </div>
          </div>

        </div>

        <div style={{ padding: '24px 32px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button 
            disabled={saving}
            onClick={handleSaveAndPrint} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: '#3b82f6', color: 'white', padding: '16px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 15, cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 16px rgba(59,130,246,0.2)' }}
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {saving ? 'Salvando...' : 'Salvar e Imprimir'}
          </button>
        </div>
      </div>

      {/* Área Central (Canvas / Papel) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="print-area" style={{ width: '210mm', minHeight: '297mm', background: 'white', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', boxSizing: 'border-box' }}>
          
          {/* Imagem de Fundo (Demais Páginas - Se repete em todas) */}
          {config?.modelo_pdf_outras_paginas_url && (
            <div className="print-repeating-bg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <img 
                src={config.modelo_pdf_outras_paginas_url} 
                alt="Fundo Outras Páginas" 
                style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '297mm', objectFit: 'fill' }} 
              />
            </div>
          )}

          {/* Imagem de Fundo (Capa A4 Completo - APENAS NA PRIMEIRA PÁGINA) */}
          {config?.modelo_pdf_url && (
            <div className="print-cover-image" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '297mm', zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
              <img 
                src={config.modelo_pdf_url} 
                alt="Capa" 
                style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '297mm', objectFit: 'fill', backgroundColor: 'white' }} 
              />
            </div>
          )}

          {/* Header da Impressão Absoluto */}
          {config?.modelo_pdf_url && (
            <div className="simulado-title" style={{
              position: 'absolute',
              top: '20mm',
              right: '25mm',
              width: '75mm',
              height: '24mm',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontWeight: 900,
              fontSize: '13pt', 
              color: '#1e293b',
              zIndex: 3
            }}>
              {simulado.titulo}
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 2, padding: '0 15mm' }}>
            
            {/* Espaçador ou Fallback */}
            {config?.modelo_pdf_url ? (
              <div style={{ height: '68mm' }}></div>
            ) : (
              <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '20px', paddingTop: '15mm', display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{simulado.titulo}</h1>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#333' }}>ALUNO(A): __________________________________________________  TURMA: _________</p>
                </div>
              </div>
            )}

            {/* Lista de Questões Adaptáveis em Duas Colunas */}
            <div style={{ 
              fontSize: `${fontSize}px`, 
              lineHeight: 1.6, 
              color: '#000',
              columnCount: 2,
              columnGap: '12mm',
              columnRule: '1px solid #94a3b8',
              textAlign: 'justify'
            }}>
              {(() => {
                let displayCounter = 1;
                return questoes.map((q, idx) => {
                  const isSelected = selectedIds.has(q.id)
                  const currentNumber = isSelected ? displayCounter++ : '-';
                  
                  return (
                    <div 
                      key={q.id} 
                      className={`questao-container ${!isSelected ? 'no-print' : ''}`}
                      style={{ 
                        position: 'relative',
                        padding: '16px 8px', 
                        marginBottom: 24,
                        borderRadius: 12,
                        border: isSelected ? '1px solid transparent' : '1px dashed #cbd5e1',
                        background: isSelected ? 'transparent' : 'rgba(248,250,252,0.8)',
                        opacity: isSelected ? 1 : 0.4,
                        transition: 'all 0.2s',
                        breakInside: 'auto'
                      }}
                    >
                      {/* Controles Overlay (No Print) */}
                      <div className="no-print" style={{ position: 'absolute', right: -10, top: -10, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'white', padding: '6px 10px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: 12 }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleToggleQuestion(q.id)}
                            style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                          />
                          {isSelected ? 'Incluir' : 'Ignorar'}
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                          fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                        }}>
                          {currentNumber}
                        </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div 
                          contentEditable={isSelected}
                          suppressContentEditableWarning
                          onBlur={(e) => handleEditEnunciado(q.id, e.currentTarget.innerHTML)}
                          dangerouslySetInnerHTML={{ __html: q.enunciado }}
                          style={{ 
                            outline: 'none', 
                            minHeight: '1.5em',
                            border: isSelected ? '1px dashed transparent' : 'none',
                            borderRadius: 4,
                            padding: '0 4px',
                            cursor: isSelected ? 'text' : 'default',
                            wordBreak: 'break-word',
                            marginBottom: 12
                          }}
                          onFocus={e => { if(isSelected) e.currentTarget.style.border = '1px dashed #94a3b8'; e.currentTarget.style.background = 'rgba(241,245,249,0.8)' }}
                          onBlurCapture={e => { e.currentTarget.style.border = '1px dashed transparent'; e.currentTarget.style.background = 'transparent' }}
                        />
                        
                        {q.imagens && q.imagens.length > 0 && (
                          <div style={{ marginTop: 16, marginBottom: 16, textAlign: 'center', breakInside: 'avoid' }}>
                            {q.imagens.map((img: string, i: number) => (
                              <img key={i} src={img} alt="Imagem da questão" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', margin: '0 auto' }} />
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, breakInside: 'avoid' }}>
                          {q.simulados_alternativas?.map((alt: any) => (
                            <div key={alt.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '24px', height: '24px', minWidth: '24px', border: '2px solid #cbd5e1',
                                color: '#334155', fontWeight: 'bold', borderRadius: '50%', fontSize: '10pt', marginTop: '2px'
                              }}>
                                {alt.letra}
                              </div>
                              <div 
                                contentEditable={isSelected}
                                suppressContentEditableWarning
                                onBlur={(e) => handleEditAlternativa(q.id, alt.id, e.currentTarget.innerHTML)}
                                dangerouslySetInnerHTML={{ __html: alt.texto }}
                                style={{ 
                                  outline: 'none', 
                                  flex: 1,
                                  border: isSelected ? '1px dashed transparent' : 'none',
                                  borderRadius: 4,
                                  padding: '0 4px',
                                  cursor: isSelected ? 'text' : 'default',
                                  wordBreak: 'break-word'
                                }}
                                onFocus={e => { if(isSelected) e.currentTarget.style.border = '1px dashed #94a3b8'; e.currentTarget.style.background = 'rgba(241,245,249,0.8)' }}
                                onBlurCapture={e => { e.currentTarget.style.border = '1px dashed transparent'; e.currentTarget.style.background = 'transparent' }}
                              />
                              {isSelected && q.simulados_alternativas.length > 2 && (
                                <button
                                  className="no-print"
                                  onClick={() => handleRemoveAlternativa(q.id, alt.id)}
                                  style={{
                                    background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2, transition: 'background 0.2s'
                                  }}
                                  title="Remover alternativa"
                                  onMouseOver={e => e.currentTarget.style.background = '#fecaca'}
                                  onMouseOut={e => e.currentTarget.style.background = '#fee2e2'}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })})()}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
