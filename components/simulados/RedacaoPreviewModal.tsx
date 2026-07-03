import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Printer, Save, Loader2, Settings, Type, LayoutList, Columns, CheckSquare, Info, ChevronLeft, Move, X } from 'lucide-react'
import { PaginationEngine } from '@/components/simulados/PaginationEngine'
import { IgnoredQuestionsList } from '@/components/simulados/IgnoredQuestionsList'
import { supabase } from '@/lib/supabase'

export interface Alternative { letter: string; text: string; correct: boolean }
export interface Questao {
  numero: number
  enunciado: string
  alternativas: Alternative[]
  imagens: { src: string; contentType: string }[]
  gabarito: string
  pontuacao: number
  expandido: boolean
  id_professor?: string
  tipo_questao?: 'multipla_escolha' | 'descritiva'
  estilo_espaco?: 'em_branco' | 'pautado'
  linhas_resposta?: number
}

export function RedacaoPreviewModal({ questoes, setQuestoes, prova, config, onClose, onSave, saving, isReadOnly = false, printOnMount }: {
  questoes: Questao[]
  setQuestoes: React.Dispatch<React.SetStateAction<Questao[]>>
  prova: any
  config: any
  onClose: () => void
  onSave?: (updated?: Questao[]) => void
  saving?: boolean
  isReadOnly?: boolean
  printOnMount?: boolean
}) {
  const [columns, setColumns] = useState<number>(1)
  const [enunciadoFontSize, setEnunciadoFontSize] = useState<number>(14)
  const [alternativasFontSize, setAlternativasFontSize] = useState<number>(12)
  const [alternativasLayout, setAlternativasLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(questoes.map((_, i) => `q-preview-${i}`)))
  
  const defaultHeaderLayout = {
    title: { label: "Título", x: 60, y: 6.5, fontSize: 13, width: 25, align: "left" },
    disciplina: { label: "Disciplina", x: 62.3, y: 8.9, fontSize: 8, width: 15, align: "left" },
    professor: { label: "Professor", x: 84.2, y: 8.9, fontSize: 8, width: 10, align: "left" },
    data: { label: "Data", x: 59.5, y: 11.4, fontSize: 8, width: 15, align: "left" },
    turma: { label: "Turma", x: 81.9, y: 11.4, fontSize: 8, width: 10, align: "left" },
    valor: { label: "Valor", x: 75.8, y: 16.5, fontSize: 8, width: 10, align: "left" },
    nota: { label: "Nota", x: 75.8, y: 18.0, fontSize: 8, width: 10, align: "left" }
  }
  const [headerLayout, setHeaderLayout] = useState<any>(() => {
    const layout = config?.redacao_enem_header_layout || defaultHeaderLayout
    if (layout && layout.title) {
      layout.title.fontSize = 13
    }
    return layout
  })
  const [isEditHeaderMode, setIsEditHeaderMode] = useState(false)
  const pageA4Ref = useRef<HTMLDivElement>(null)
  const [savingHeader, setSavingHeader] = useState(false)
  const [showBackModal, setShowBackModal] = useState(false)
  const [localQuestoes, setLocalQuestoes] = useState<Questao[]>(questoes)

  const handleSaveHeaderLayout = async () => {
    if (!config || !config.id) return
    setSavingHeader(true)
    try {
      const { error } = await supabase
        .from('simulados_configuracoes')
        .update({ redacao_enem_header_layout: headerLayout })
        .eq('id', config.id)
      
      if (error) throw error
      alert('Posições do cabeçalho salvas com sucesso!')
      setIsEditHeaderMode(false)
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSavingHeader(false)
    }
  }

  const handleUpdateHeaderField = (key: string, newField: any) => {
    setHeaderLayout((prev: any) => ({ ...prev, [key]: newField }))
  }

  const handleToggleQuestion = (qId: string) => {
    const next = new Set(selectedIds)
    if (next.has(qId)) next.delete(qId)
    else next.add(qId)
    setSelectedIds(next)
  }

  const handlePrint = () => {
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const handleSaveAndPrint = async () => {
    if (onSave) {
      await onSave()
    }
    handlePrint()
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    if (printOnMount) {
      handlePrint()
    }
  }, [printOnMount])

  const mappedQuestoes = localQuestoes.map((q, idx) => {
    let enunciadoHtml = q.enunciado

    // Clean up excessive newlines
    enunciadoHtml = enunciadoHtml.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    enunciadoHtml = enunciadoHtml.replace(/(?:\r\n|\r|\n){3,}/g, '\n\n')

    return {
      id: `q-preview-${idx}`,
      ordem: idx,
      tipo_questao: q.tipo_questao || 'multipla_escolha',
      enunciado: `<div style="white-space: pre-wrap;">${enunciadoHtml.trim()}</div>`,
      imagens: q.imagens?.map(img => img.src) || [],
      simulados_alternativas: q.alternativas.map((alt, i) => ({
        id: `alt-preview-${i}`,
        letra: alt.letter,
        texto: alt.text,
        eh_correta: alt.correct,
        imagem_url: alt.imagem_url
      })),
      id_disciplina: null
    }
  })

  if (!mounted) return null

  return createPortal(
    <motion.div
      id="print-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(241, 245, 249, 1)',
        display: 'flex', flexDirection: 'row',
      }}
    >
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          body > *:not(#print-root) {
            display: none !important;
          }
          #print-root {
            position: static !important;
            display: block !important;
            height: auto !important;
            background: white !important;
          }
          .canvas-layout {
            display: block !important;
            overflow: visible !important;
            padding: 0 !important;
            height: auto !important;
          }
          .print-wrapper {
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Sidebar de Configurações (No Print) */}
      <div className="no-print sidebar-layout" style={{ width: 380, background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.02)', zIndex: 10, flexShrink: 0 }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={20} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Estúdio de Edição</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: 0 }}>Molde a prova visualmente para alunos com necessidades específicas. Remova questões indesejadas e altere o tamanho da fonte global.</p>
        </div>

        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
              <Type size={16} color="#3b82f6" /> Tamanho do Enunciado
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[12, 14, 16, 18, 20, 24].map(size => (
                <button
                  key={`enunciado-${size}`}
                  onClick={() => setEnunciadoFontSize(size)}
                  style={{
                    padding: '8px',
                    borderRadius: 8,
                    background: enunciadoFontSize === size ? '#3b82f6' : '#f8fafc',
                    color: enunciadoFontSize === size ? 'white' : '#475569',
                    border: `1px solid ${enunciadoFontSize === size ? '#3b82f6' : '#e2e8f0'}`,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: 13
                  }}
                >
                  {size}pt
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
              <Type size={16} color="#3b82f6" /> Tamanho das Alternativas
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[12, 14, 16, 18, 20, 24].map(size => (
                <button
                  key={`alt-${size}`}
                  onClick={() => setAlternativasFontSize(size)}
                  style={{
                    padding: '8px',
                    borderRadius: 8,
                    background: alternativasFontSize === size ? '#3b82f6' : '#f8fafc',
                    color: alternativasFontSize === size ? 'white' : '#475569',
                    border: `1px solid ${alternativasFontSize === size ? '#3b82f6' : '#e2e8f0'}`,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: 13
                  }}
                >
                  {size}pt
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <LayoutList size={16} color="#3b82f6" /> Layout da Prova
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setColumns(1)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: columns === 1 ? '#3b82f6' : '#f8fafc',
                  color: columns === 1 ? 'white' : '#475569',
                  border: `1px solid ${columns === 1 ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <LayoutList size={16} /> 1 Coluna
              </button>
              <button
                onClick={() => setColumns(2)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: columns === 2 ? '#3b82f6' : '#f8fafc',
                  color: columns === 2 ? 'white' : '#475569',
                  border: `1px solid ${columns === 2 ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Columns size={16} /> 2 Colunas
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <LayoutList size={16} color="#8b5cf6" /> Layout das Alternativas
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setAlternativasLayout('vertical')}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: alternativasLayout === 'vertical' ? '#8b5cf6' : '#f8fafc',
                  color: alternativasLayout === 'vertical' ? 'white' : '#475569',
                  border: `1px solid ${alternativasLayout === 'vertical' ? '#8b5cf6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                Vertical
              </button>
              <button
                onClick={() => setAlternativasLayout('horizontal')}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: alternativasLayout === 'horizontal' ? '#8b5cf6' : '#f8fafc',
                  color: alternativasLayout === 'horizontal' ? 'white' : '#475569',
                  border: `1px solid ${alternativasLayout === 'horizontal' ? '#8b5cf6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                Horizontal
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <Move size={16} color="#3b82f6" /> Cabeçalho (Fundo PNG)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => setIsEditHeaderMode(!isEditHeaderMode)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: isEditHeaderMode ? '#ef4444' : '#f8fafc',
                  color: isEditHeaderMode ? 'white' : '#475569',
                  border: `1px solid ${isEditHeaderMode ? '#ef4444' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {isEditHeaderMode ? <X size={16} /> : <Move size={16} />}
                {isEditHeaderMode ? 'Sair da Edição' : 'Editar Posições'}
              </button>

              {isEditHeaderMode && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                     onClick={handleSaveHeaderLayout}
                     disabled={savingHeader}
                     style={{
                       flex: 1, padding: '10px', borderRadius: 8,
                       background: '#10b981', color: 'white', border: 'none',
                       fontWeight: 600, cursor: 'pointer', fontSize: 13,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                     }}
                  >
                    {savingHeader ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Salvar Posições
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <CheckSquare size={16} color="#10b981" /> Resumo de Seleção
            </label>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#475569', fontSize: 14 }}>Questões Originais</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{localQuestoes.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569', fontSize: 14 }}>Questões Selecionadas</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{selectedIds.size}</span>
              </div>
            </div>
          </div>

        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(226, 232, 240, 0.8)', background: 'rgba(248, 250, 252, 0.9)', backdropFilter: 'blur(10px)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            disabled={saving}
            onClick={() => setShowBackModal(true)} 
            style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 700, fontSize: 13, padding: '0 12px' }}
            title="Voltar sem Salvar"
          >
            <ArrowLeft size={16} />
            Sair
          </button>
          
          <button 
            disabled={saving}
            onClick={handlePrint} 
            style={{ 
              flex: 1, 
              height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, 
              borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.2)', 
              background: onSave ? 'rgba(59, 130, 246, 0.1)' : '#3b82f6', 
              color: onSave ? '#3b82f6' : 'white', 
              cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s', fontWeight: 700, fontSize: 13, padding: '0 12px' 
            }}
            title="Imprimir / PDF"
          >
            <Printer size={16} />
            Imprimir
          </button>

          {onSave && (
            <button 
              disabled={saving}
              onClick={async () => {
                setQuestoes(localQuestoes)
                if (onSave) await onSave(localQuestoes)
                onClose()
              }} 
              style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: 12, border: 'none', cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)', fontWeight: 700, fontSize: 13, padding: '0 12px' }}
              title="Salvar e Fechar"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando' : 'Salvar'}
            </button>
          )}
        </div>
      </div>

      {showBackModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'white', padding: 32, borderRadius: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>Tem certeza?</h2>
            <p style={{ color: '#475569', fontSize: 15, margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Você está prestes a voltar. Todas as modificações visuais não salvas serão perdidas.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowBackModal(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
                Sim, Voltar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Área Central (Canvas / Papel) */}
      <div className="canvas-layout" style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="print-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PaginationEngine
            questoes={mappedQuestoes.filter(q => selectedIds.has(q.id))}
            columns={columns}
            enunciadoFontSize={enunciadoFontSize}
            alternativasFontSize={alternativasFontSize}
            config={config}
            simulado={{ ...prova, isRedacao: true }}
            alternativasLayout={alternativasLayout}
            isEditHeaderMode={isEditHeaderMode}
            headerLayout={headerLayout}
            onUpdateHeaderField={handleUpdateHeaderField}
            pageA4Ref={pageA4Ref}
            onEditEnunciado={isReadOnly ? undefined : (qId, newText) => {
              const qIdx = parseInt(qId.replace('q-preview-', ''))
              setLocalQuestoes(prev => prev.map((q, i) => {
                if (i !== qIdx) return q
                
                // Remove the wrapper div if it exists so we don't nest it indefinitely
                let cleanedText = newText
                if (cleanedText.startsWith('<div style="white-space: pre-wrap;">') && cleanedText.endsWith('</div>')) {
                  cleanedText = cleanedText.substring(36, cleanedText.length - 6)
                }
                
                return { ...q, enunciado: cleanedText }
              }))
            }}
            onEditAlternativa={isReadOnly ? undefined : (qId, aId, text) => {
              const qIdx = parseInt(qId.replace('q-preview-', ''))
              const aIdx = parseInt(aId.replace('alt-preview-', ''))
              setLocalQuestoes(prev => prev.map((q, i) => {
                if (i !== qIdx) return q
                const newAlts = [...q.alternativas]
                newAlts[aIdx] = { ...newAlts[aIdx], text }
                return { ...q, alternativas: newAlts }
              }))
            }}
            onRemoveAlternativa={isReadOnly ? undefined : (qId, aId) => {
              const qIdx = parseInt(qId.replace('q-preview-', ''))
              const aIdx = parseInt(aId.replace('alt-preview-', ''))
              setLocalQuestoes(prev => prev.map((q, i) => {
                if (i !== qIdx) return q
                return { ...q, alternativas: q.alternativas.filter((_, ai) => ai !== aIdx) }
              }))
            }}
            onEditAlternativaImage={isReadOnly ? undefined : (qId, aId, url) => {
              const qIdx = parseInt(qId.replace('q-preview-', ''))
              const aIdx = parseInt(aId.replace('alt-preview-', ''))
              setLocalQuestoes(prev => prev.map((q, i) => {
                if (i !== qIdx) return q
                const newAlts = [...q.alternativas]
                newAlts[aIdx] = { ...newAlts[aIdx], imagem_url: url } // Need to store it somewhere in our preview model
                return { ...q, alternativas: newAlts }
              }))
            }}
            onEditEnunciadoImage={isReadOnly ? undefined : (qId, imgIndex, newUrl) => {
              const qIdx = parseInt(qId.replace('q-preview-', ''))
              setLocalQuestoes(prev => prev.map((q, i) => {
                if (i !== qIdx) return q
                const newImagens = [...(q.imagens || [])]
                if (!newUrl) {
                  newImagens.splice(imgIndex, 1)
                } else {
                  newImagens[imgIndex] = { ...newImagens[imgIndex], src: newUrl } // since preview maps src to string
                }
                return { ...q, imagens: newImagens }
              }))
            }}
            onToggleQuestion={handleToggleQuestion}
          />
        </div>
        <IgnoredQuestionsList
          questoes={mappedQuestoes.filter(q => !selectedIds.has(q.id))}
          onToggle={handleToggleQuestion}
        />
      </div>
    </motion.div>,
    document.body
  )
}
