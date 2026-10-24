import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, Reorder } from 'framer-motion'
import { ArrowLeft, Printer, Save, Loader2, Settings, Type, LayoutList, Columns, CheckSquare, Info, ChevronLeft, Move, X, Trash2, RotateCcw, FileEdit, PenTool, FileText, Maximize2, Sparkles, Eye, EyeOff, ZoomIn, ZoomOut, AlignLeft, AlignJustify, PanelLeftClose, PanelLeftOpen, CheckCircle2 } from 'lucide-react'
import { PaginationEngine } from '@/components/simulados/PaginationEngine'
import { IgnoredQuestionsList } from '@/components/simulados/IgnoredQuestionsList'
import { supabase } from '@/lib/supabase'
import { normalizeQuestionImages } from '@/lib/utils'

export interface Alternative { letter: string; text: string; correct: boolean; imagem_url?: string; letra?: string; eh_correta?: boolean }
export interface Questao {
  numero: number
  enunciado: string
  alternativas: Alternative[]
  imagens: { src: string; contentType: string }[]
  gabarito: string
  pontuacao: number
  expandido: boolean
  id_professor?: string
  professor_nome?: string
  id_disciplina?: string
  disciplina_id?: string
  disciplina_nome?: string
  disciplina?: string
  id_requisicao?: string
  tipo_questao?: 'multipla_escolha' | 'descritiva' | 'texto_apoio'
  estilo_espaco?: 'em_branco' | 'pautado'
  linhas_resposta?: number
}

export function ProvaPreviewModal({ questoes, setQuestoes, prova, config, onClose, onSave, saving, isReadOnly = false, printOnMount }: {
  questoes: Questao[]
  setQuestoes: React.Dispatch<React.SetStateAction<Questao[]>>
  prova: any
  config: any
  onClose: () => void
  onSave?: (updated?: Questao[], config_estudio?: any) => void
  saving?: boolean
  isReadOnly?: boolean
  printOnMount?: boolean
}) {
  const [columns, setColumns] = useState<number>(prova?.config_estudio?.config_colunas || 1)
  const [enunciadoFontSize, setEnunciadoFontSize] = useState<number>(prova?.config_estudio?.config_fonte_enunciado || 14)
  const [alternativasFontSize, setAlternativasFontSize] = useState<number>(prova?.config_estudio?.config_fonte_alternativa || 12)
  const [alternativasLayout, setAlternativasLayout] = useState<'vertical' | 'horizontal'>(prova?.config_estudio?.config_layout_alternativas || 'vertical')
  const [lineHeight, setLineHeight] = useState<number>(prova?.config_estudio?.config_line_height || 1.5)
  const [questionSpacing, setQuestionSpacing] = useState<number>(prova?.config_estudio?.config_question_spacing || 28)
  const [textAlign, setTextAlign] = useState<'justify' | 'left'>(prova?.config_estudio?.config_text_align || 'justify')
  const [activeTab, setActiveTab] = useState<'layout' | 'margens' | 'questoes'>('layout')
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  const [showGabarito, setShowGabarito] = useState<boolean>(true)
  const [cleanPreviewMode, setCleanPreviewMode] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(100)
  const [pagesCount, setPagesCount] = useState<number>(1)
  const ensureStableIds = (qs: any[], existing?: any[]) => {
    const existingMap = new Map((existing || []).map((q: any) => [q.id || q._internalId || q.numero, q]));
    return (qs || []).map((q, qIdx) => {
      const prev = existingMap.get(q.id || q._internalId || q.numero);
      const qInternalId = q._internalId || prev?._internalId || q.id || `q-${qIdx}-${q.numero ?? 'x'}`;
      return {
        ...q,
        _internalId: qInternalId,
        alternativas: (q.alternativas || []).map((alt: any, aIdx: number) => {
          const prevAlt = prev?.alternativas?.[aIdx];
          return {
            ...alt,
            _uid: alt._uid || prevAlt?._uid || alt.id || `alt-${qInternalId}-${aIdx}-${alt.letter || alt.letra || ''}`
          };
        })
      };
    });
  };

  const matchQuestion = (q: any, qId: string) => {
    return (q._internalId && q._internalId === qId) ||
           (q.id && q.id === qId) ||
           String(q.id) === String(qId) ||
           (q.numero !== undefined && (String(q.numero) === String(qId) || `q-${q.numero}` === String(qId)));
  };

  const findAlternativeIndex = (alts: any[], aId: string, fallbackIdx?: number, fallbackLetter?: string) => {
    let idx = -1;
    if (aId) {
      idx = alts.findIndex((a: any) => (a.id && a.id === aId) || (a._uid && a._uid === aId));
    }
    if (idx === -1 && typeof fallbackIdx === 'number' && fallbackIdx >= 0 && fallbackIdx < alts.length) {
      idx = fallbackIdx;
    }
    if (idx === -1 && fallbackLetter) {
      idx = alts.findIndex((a: any) => a.letter === fallbackLetter || a.letra === fallbackLetter);
    }
    if (idx === -1 && typeof aId === 'string' && aId.length === 1) {
      idx = alts.findIndex((a: any) => a.letter === aId || a.letra === aId);
    }
    if (idx === -1 && typeof aId === 'string' && aId.startsWith('alt-preview-')) {
      idx = parseInt(aId.replace('alt-preview-', ''));
    }
    if (idx === -1 && typeof aId === 'string' && aId.startsWith('alt-')) {
      const parts = aId.split('-');
      for (let p = 1; p < parts.length; p++) {
        const parsed = parseInt(parts[p], 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < alts.length) {
          idx = parsed;
          break;
        }
      }
    }
    return (idx >= 0 && idx < alts.length) ? idx : -1;
  };

  const initialLocal = ensureStableIds(questoes);
  const [localQuestoes, setLocalQuestoes] = useState<any[]>(initialLocal);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialLocal.map(q => q._internalId)));

  useEffect(() => {
    if (questoes && questoes.length > 0) {
      setLocalQuestoes(prev => {
        if (prev && prev.length > 0) return prev;
        return ensureStableIds(questoes, prev);
      });
      setSelectedIds(prev => {
        if (prev && prev.size > 0) return prev;
        return new Set(ensureStableIds(questoes).map(q => q._internalId));
      });
    }
  }, [questoes]);
  
  const defaultHeaderLayout = {
    title: { label: "Título", x: 60, y: 6.5, fontSize: 13, width: 25, align: "left" },
    disciplina: { label: "Disciplina", x: 62.3, y: 8.9, fontSize: 8, width: 15, align: "left" },
    professor: { label: "Professor", x: 84.2, y: 8.9, fontSize: 8, width: 10, align: "left" },
    data: { label: "Data", x: 59.5, y: 11.4, fontSize: 8, width: 15, align: "left" },
    turma: { label: "Turma", x: 81.9, y: 11.4, fontSize: 8, width: 10, align: "left" },
    valor: { label: "Valor", x: 75.8, y: 16.5, fontSize: 8, width: 10, align: "left" },
    nota: { label: "Nota", x: 75.8, y: 18.0, fontSize: 8, width: 10, align: "left" },
    orientacoes: { label: "Orientações Aluno", x: 60, y: 22.0, fontSize: 10, width: 35, align: "left", whiteSpace: "pre-wrap" }
  }
  const getAllItemIds = () => {
    const ids = [
      prova?.id,
      prova?.id_prova,
      prova?.id_prova_upload,
      prova?.id_simulado,
      prova?.id_redacao,
      (prova as any)?.simulado_id
    ].filter(Boolean)
    return Array.from(new Set(ids))
  }

  const itemId = getAllItemIds()[0]

  const saveToLocalStorage = (keyPrefix: string, data: any) => {
    if (typeof window === 'undefined') return
    const json = JSON.stringify(data)
    getAllItemIds().forEach(id => {
      try {
        localStorage.setItem(`${keyPrefix}_${id}`, json)
      } catch (e) {}
    })
  }

  const readFromLocalStorage = (keyPrefix: string) => {
    if (typeof window === 'undefined') return null
    for (const id of getAllItemIds()) {
      try {
        const saved = localStorage.getItem(`${keyPrefix}_${id}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed) return parsed
        }
      } catch (e) {}
    }
    return null
  }

  const saveToDatabaseTables = async (updatedConfigEstudio: any) => {
    const ids = getAllItemIds()
    for (const targetId of ids) {
      try {
        await (supabase as any)
          .from('provas_upload')
          .update({
            config_estudio: updatedConfigEstudio,
            ...(prova?.instrucoes !== undefined ? { instrucoes: prova.instrucoes } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', targetId)
      } catch (e) {}

      try {
        await (supabase as any)
          .from('simulados_upload')
          .update({
            config_estudio: updatedConfigEstudio,
            ...(prova?.instrucoes !== undefined ? { instrucoes: prova.instrucoes } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', targetId)
      } catch (e) {}

      try {
        await (supabase as any)
          .from('redacao_upload')
          .update({
            config_estudio: updatedConfigEstudio,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetId)
      } catch (e) {}

      try {
        await (supabase as any)
          .from('simulados')
          .update({
            config_estudio: updatedConfigEstudio,
            ...(prova?.instrucoes !== undefined ? { instrucoes: prova.instrucoes } : {}),
            updated_at: new Date().toISOString()
          })
          .eq('id', targetId)
      } catch (e) {}
    }
  }

  const getInitialHeaderLayout = () => {
    const savedLocal = readFromLocalStorage('simulador_header')
    let configEstudio = prova?.config_estudio
    if (typeof configEstudio === 'string') {
      try {
        configEstudio = JSON.parse(configEstudio)
      } catch (e) {}
    }
    const baseLayout = configEstudio?.header_layout || savedLocal || config?.provas_header_layout
    if (!baseLayout || typeof baseLayout !== 'object') return defaultHeaderLayout
    const merged: any = {}
    for (const key of Object.keys(defaultHeaderLayout)) {
      merged[key] = {
        ...(defaultHeaderLayout as any)[key],
        ...(baseLayout[key] || {})
      }
    }
    if (merged.title) merged.title.fontSize = merged.title.fontSize || 13
    if (merged.orientacoes) merged.orientacoes.whiteSpace = 'pre-wrap'
    return merged
  }

  const [hasUserEdited, setHasUserEdited] = useState(false)
  const [headerLayout, setHeaderLayout] = useState<any>(getInitialHeaderLayout)

  useEffect(() => {
    if (itemId && !hasUserEdited) {
      setHeaderLayout(getInitialHeaderLayout())
    }
  }, [itemId, JSON.stringify(prova?.config_estudio?.header_layout), config?.provas_header_layout])
  const [isEditHeaderMode, setIsEditHeaderMode] = useState(false)
  const [showMargins, setShowMargins] = useState(false)
  const [leftMarginOffset, setLeftMarginOffset] = useState<number>(() => {
    if (prova?.config_estudio?.config_margin_left !== undefined) return prova.config_estudio.config_margin_left
    const savedMargins = readFromLocalStorage('simulador_margins')
    if (savedMargins?.left !== undefined) return savedMargins.left
    return -25
  });
  const [rightMarginOffset, setRightMarginOffset] = useState<number>(() => {
    if (prova?.config_estudio?.config_margin_right !== undefined) return prova.config_estudio.config_margin_right
    const savedMargins = readFromLocalStorage('simulador_margins')
    if (savedMargins?.right !== undefined) return savedMargins.right
    return -20
  });
  const [topMarginOffset, setTopMarginOffset] = useState<number>(() => {
    if (prova?.config_estudio?.config_margin_top !== undefined) return prova.config_estudio.config_margin_top
    const savedMargins = readFromLocalStorage('simulador_margins')
    if (savedMargins?.top !== undefined) return savedMargins.top
    return -10
  });
  const [bottomMarginOffset, setBottomMarginOffset] = useState<number>(() => {
    if (prova?.config_estudio?.config_margin_bottom !== undefined) return prova.config_estudio.config_margin_bottom
    const savedMargins = readFromLocalStorage('simulador_margins')
    if (savedMargins?.bottom !== undefined) return savedMargins.bottom
    return -90
  });
  const [pageMargins, setPageMargins] = useState<{ [pageIndex: number]: { top?: number; bottom?: number; left?: number; right?: number } }>(() => {
    if (prova?.config_estudio?.page_margins) {
      return prova.config_estudio.page_margins;
    }
    const saved = readFromLocalStorage('simulador_page_margins');
    if (saved && typeof saved === 'object') return saved;
    return {};
  });
  const [adicionarPaginaRedacao, setAdicionarPaginaRedacao] = useState<boolean>(prova?.config_estudio?.adicionar_pagina_redacao || false);
  const pageA4Ref = useRef<HTMLDivElement>(null)
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingMargins, setSavingMargins] = useState(false)
  const [autoSavedTime, setAutoSavedTime] = useState<string | null>(null)
  const [showBackModal, setShowBackModal] = useState(false)

  const applyLayoutPreset = (preset: 'padrao' | 'compacto' | 'acessivel') => {
    if (preset === 'padrao') {
      setEnunciadoFontSize(14);
      setAlternativasFontSize(12);
      setLineHeight(1.5);
      setQuestionSpacing(28);
      setTextAlign('justify');
      setLeftMarginOffset(-25);
      setRightMarginOffset(-20);
      setTopMarginOffset(-10);
      setBottomMarginOffset(-90);
      setPageMargins({});
    } else if (preset === 'compacto') {
      setEnunciadoFontSize(12);
      setAlternativasFontSize(11);
      setLineHeight(1.35);
      setQuestionSpacing(18);
      setTextAlign('justify');
      setLeftMarginOffset(-32);
      setRightMarginOffset(-28);
      setTopMarginOffset(-18);
      setBottomMarginOffset(-105);
      setPageMargins({});
    } else if (preset === 'acessivel') {
      setEnunciadoFontSize(18);
      setAlternativasFontSize(16);
      setLineHeight(1.75);
      setQuestionSpacing(36);
      setTextAlign('left');
      setColumns(1);
    }
  };

  const handlePageMarginChange = (pageIndex: number, delta: { top?: number; bottom?: number; left?: number; right?: number }) => {
    setPageMargins(prev => ({
      ...prev,
      [pageIndex]: {
        ...(prev[pageIndex] || {}),
        ...delta
      }
    }));
  };

  const handleResetAllPageMargins = () => {
    setPageMargins({});
    saveToLocalStorage('simulador_page_margins', {});
  };

  const handleSaveMargins = async () => {
    setSavingMargins(true)
    try {
      const margins = {
        left: leftMarginOffset,
        right: rightMarginOffset,
        top: topMarginOffset,
        bottom: bottomMarginOffset
      }

      saveToLocalStorage('simulador_margins', margins)
      saveToLocalStorage('simulador_page_margins', pageMargins)

      const updatedConfigEstudio = {
        ...(prova?.config_estudio || {}),
        config_fonte_enunciado: enunciadoFontSize,
        config_fonte_alternativa: alternativasFontSize,
        config_colunas: columns,
        config_layout_alternativas: alternativasLayout,
        config_line_height: lineHeight,
        config_question_spacing: questionSpacing,
        config_text_align: textAlign,
        config_margin_left: leftMarginOffset,
        config_margin_right: rightMarginOffset,
        config_margin_top: topMarginOffset,
        config_margin_bottom: bottomMarginOffset,
        page_margins: pageMargins,
        adicionar_pagina_redacao: adicionarPaginaRedacao,
        header_layout: headerLayout
      }

      if (prova) {
        prova.config_estudio = updatedConfigEstudio
      }

      await saveToDatabaseTables(updatedConfigEstudio)

      alert('Margens salvas para esta prova com sucesso!')
    } catch (e: any) {
      alert('Erro ao salvar margens: ' + e.message)
    } finally {
      setSavingMargins(false)
    }
  }

  const handleSaveHeaderLayout = async () => {
    setSavingHeader(true)
    try {
      saveToLocalStorage('simulador_header', headerLayout)

      const updatedConfigEstudio = {
        ...(prova?.config_estudio || {}),
        config_fonte_enunciado: enunciadoFontSize,
        config_fonte_alternativa: alternativasFontSize,
        config_colunas: columns,
        config_layout_alternativas: alternativasLayout,
        config_line_height: lineHeight,
        config_question_spacing: questionSpacing,
        config_text_align: textAlign,
        config_margin_left: leftMarginOffset,
        config_margin_right: rightMarginOffset,
        config_margin_top: topMarginOffset,
        config_margin_bottom: bottomMarginOffset,
        page_margins: pageMargins,
        adicionar_pagina_redacao: adicionarPaginaRedacao,
        header_layout: headerLayout
      }

      if (prova) {
        prova.config_estudio = updatedConfigEstudio
      }

      await saveToDatabaseTables(updatedConfigEstudio)

      setHasUserEdited(false)
      alert('Posições do cabeçalho salvas para esta prova com sucesso!')
    } catch (e: any) {
      alert('Erro ao salvar cabeçalho: ' + e.message)
    } finally {
      setSavingHeader(false)
    }
  }

  const handleUpdateHeaderField = (key: string, newField: any) => {
    setHasUserEdited(true)
    setHeaderLayout((prev: any) => ({ ...prev, [key]: newField }))
  }

  const handleToggleQuestion = (qId: string) => {
    const next = new Set(selectedIds)
    if (next.has(qId)) next.delete(qId)
    else next.add(qId)
    setSelectedIds(next)
  }

  const [isPaginating, setIsPaginating] = useState(false)

  const handlePrint = () => {
    if (isPaginating) return
    setTimeout(() => {
      window.print()
    }, 150)
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

  // Debounced auto-save for margin and layout changes
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(async () => {
      saveToLocalStorage('simulador_margins', {
        left: leftMarginOffset,
        right: rightMarginOffset,
        top: topMarginOffset,
        bottom: bottomMarginOffset
      });
      saveToLocalStorage('simulador_page_margins', pageMargins);

      const updatedConfigEstudio = {
        ...(prova?.config_estudio || {}),
        config_fonte_enunciado: enunciadoFontSize,
        config_fonte_alternativa: alternativasFontSize,
        config_colunas: columns,
        config_layout_alternativas: alternativasLayout,
        config_line_height: lineHeight,
        config_question_spacing: questionSpacing,
        config_text_align: textAlign,
        config_margin_left: leftMarginOffset,
        config_margin_right: rightMarginOffset,
        config_margin_top: topMarginOffset,
        config_margin_bottom: bottomMarginOffset,
        page_margins: pageMargins,
        adicionar_pagina_redacao: adicionarPaginaRedacao,
        header_layout: headerLayout
      };

      if (prova) {
        prova.config_estudio = updatedConfigEstudio;
      }
      await saveToDatabaseTables(updatedConfigEstudio);
      const now = new Date();
      setAutoSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
    }, 600);

    return () => clearTimeout(timer);
  }, [leftMarginOffset, rightMarginOffset, topMarginOffset, bottomMarginOffset, pageMargins, enunciadoFontSize, alternativasFontSize, columns, alternativasLayout, lineHeight, questionSpacing, textAlign, adicionarPaginaRedacao, headerLayout, mounted]);

  const mappedQuestoes = useMemo(() => {
    return localQuestoes.map((rawQ, idx) => {
      const q = normalizeQuestionImages(rawQ)
      let enunciadoHtml = q.enunciado

      // Clean up excessive newlines
      enunciadoHtml = enunciadoHtml.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
      enunciadoHtml = enunciadoHtml.replace(/(?:\r\n|\r|\n){3,}/g, '\n\n')

      return {
        id: q._internalId,
        ordem: idx,
        tipo_questao: q.tipo_questao || 'multipla_escolha',
        enunciado: `<div style="white-space: pre-wrap;">${enunciadoHtml.trim()}</div>`,
        imagens: q.imagens?.map((img: any) => img.src) || [],
        simulados_alternativas: (q.alternativas || []).map((alt: any, i: number) => {
          const altId = alt._uid || alt.id || `alt-${q._internalId || q.id || idx}-${i}-${alt.letter || alt.letra || ''}`;
          return {
            id: altId,
            letra: alt.letter || alt.letra,
            texto: alt.text || alt.texto,
            eh_correta: alt.correct || alt.eh_correta,
            imagem_url: (alt as any).imagem_url,
            _uid: altId
          };
        }),
        id_disciplina: null
      }
    })
  }, [localQuestoes]);

  const selectedQuestoes = useMemo(() => {
    return mappedQuestoes.filter(q => selectedIds.has(q.id));
  }, [mappedQuestoes, selectedIds]);

  const unselectedQuestoes = useMemo(() => {
    return mappedQuestoes.filter(q => !selectedIds.has(q.id));
  }, [mappedQuestoes, selectedIds]);

  if (!mounted) return null

  return createPortal(
    <motion.div
      className="prova-preview-modal-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#e2e8f0',
        display: 'flex', flexDirection: 'row',
      }}
    >
      {/* Sidebar de Configurações (No Print) */}
      {!sidebarCollapsed && (
        <div className="no-print sidebar-layout" style={{ width: 370, background: 'white', borderRight: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(15,23,42,0.06)', zIndex: 10, flexShrink: 0 }}>
          {/* Header Compacto */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(37,99,235,0.25)' }}>
                  <Settings size={18} />
                </div>
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Estúdio de Edição</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Diagramação A4 Inteligente</span>
                    {autoSavedTime && (
                      <span style={{ fontSize: 10, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                        ✓ Salvo {autoSavedTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                title="Recolher painel lateral"
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            {/* Navegação por Abas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
              {[
                { id: 'layout', label: 'Texto & Layout', icon: Type },
                { id: 'margens', label: 'Margens & Topo', icon: Maximize2 },
                { id: 'questoes', label: `Questões (${selectedQuestoes.length})`, icon: CheckSquare },
              ].map(tab => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      padding: '7px 6px',
                      borderRadius: 7,
                      border: 'none',
                      background: active ? 'white' : 'transparent',
                      color: active ? '#1e293b' : '#64748b',
                      fontWeight: active ? 700 : 600,
                      fontSize: 11.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      boxShadow: active ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Icon size={13} color={active ? '#2563eb' : '#64748b'} />
                    <span style={{ whiteSpace: 'nowrap' }}>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conteúdo das Abas */}
          <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {activeTab === 'layout' && (
              <>
                {/* Presets Rápidos */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    <Sparkles size={14} color="#8b5cf6" /> Enquadramento Rápido (1 Clique)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { id: 'padrao', title: 'Padrão Ideal', desc: '14pt • Equilibrado', color: '#2563eb' },
                      { id: 'compacto', title: 'Econômico', desc: '12pt • Menos folhas', color: '#059669' },
                      { id: 'acessivel', title: 'Ampliado', desc: '18pt • Inclusão', color: '#8b5cf6' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyLayoutPreset(p.id as any)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 800, color: p.color }}>{p.title}</span>
                        <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tamanho da Fonte do Enunciado */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      <Type size={15} color="#2563eb" /> Fonte dos Enunciados
                    </label>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 6 }}>{enunciadoFontSize}px</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                    {[11, 12, 14, 16, 18, 22].map(size => (
                      <button
                        key={`enunciado-${size}`}
                        onClick={() => setEnunciadoFontSize(size)}
                        style={{
                          padding: '7px 0',
                          borderRadius: 8,
                          background: enunciadoFontSize === size ? '#2563eb' : '#f8fafc',
                          color: enunciadoFontSize === size ? 'white' : '#475569',
                          border: `1px solid ${enunciadoFontSize === size ? '#2563eb' : '#e2e8f0'}`,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tamanho da Fonte das Alternativas */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      <Type size={15} color="#6366f1" /> Fonte das Alternativas
                    </label>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 6 }}>{alternativasFontSize}px</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                    {[10, 11, 12, 14, 16, 20].map(size => (
                      <button
                        key={`alt-${size}`}
                        onClick={() => setAlternativasFontSize(size)}
                        style={{
                          padding: '7px 0',
                          borderRadius: 8,
                          background: alternativasFontSize === size ? '#6366f1' : '#f8fafc',
                          color: alternativasFontSize === size ? 'white' : '#475569',
                          border: `1px solid ${alternativasFontSize === size ? '#6366f1' : '#e2e8f0'}`,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Espaçamento entre Linhas e entre Questões */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      Entrelinhas
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                      {[
                        { label: '1.35', val: 1.35 },
                        { label: '1.5', val: 1.5 },
                        { label: '1.75', val: 1.75 }
                      ].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setLineHeight(opt.val)}
                          style={{
                            padding: '7px 4px',
                            borderRadius: 7,
                            background: lineHeight === opt.val ? '#0f172a' : '#f8fafc',
                            color: lineHeight === opt.val ? 'white' : '#475569',
                            border: `1px solid ${lineHeight === opt.val ? '#0f172a' : '#e2e8f0'}`,
                            fontWeight: 700,
                            fontSize: 11.5,
                            cursor: 'pointer'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      Espaço entre Questões
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                      {[
                        { label: 'Curto', val: 18 },
                        { label: 'Médio', val: 28 },
                        { label: 'Amplo', val: 40 }
                      ].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setQuestionSpacing(opt.val)}
                          style={{
                            padding: '7px 4px',
                            borderRadius: 7,
                            background: questionSpacing === opt.val ? '#0f172a' : '#f8fafc',
                            color: questionSpacing === opt.val ? 'white' : '#475569',
                            border: `1px solid ${questionSpacing === opt.val ? '#0f172a' : '#e2e8f0'}`,
                            fontWeight: 700,
                            fontSize: 11.5,
                            cursor: 'pointer'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Alinhamento do Texto */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Alinhamento do Texto nas Páginas
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      onClick={() => setTextAlign('justify')}
                      style={{
                        padding: '9px', borderRadius: 9,
                        background: textAlign === 'justify' ? '#2563eb' : '#f8fafc',
                        color: textAlign === 'justify' ? 'white' : '#475569',
                        border: `1px solid ${textAlign === 'justify' ? '#2563eb' : '#e2e8f0'}`,
                        fontWeight: 700, cursor: 'pointer', fontSize: 12.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      <AlignJustify size={14} /> Justificado
                    </button>
                    <button
                      onClick={() => setTextAlign('left')}
                      style={{
                        padding: '9px', borderRadius: 9,
                        background: textAlign === 'left' ? '#2563eb' : '#f8fafc',
                        color: textAlign === 'left' ? 'white' : '#475569',
                        border: `1px solid ${textAlign === 'left' ? '#2563eb' : '#e2e8f0'}`,
                        fontWeight: 700, cursor: 'pointer', fontSize: 12.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      <AlignLeft size={14} /> Alinhado à Esquerda
                    </button>
                  </div>
                </div>

                {/* Colunas da Página */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    <Columns size={14} color="#2563eb" /> Colunas por Página A4
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      onClick={() => setColumns(1)}
                      style={{
                        padding: '10px', borderRadius: 10,
                        background: columns === 1 ? '#2563eb' : '#f8fafc',
                        color: columns === 1 ? 'white' : '#475569',
                        border: `1px solid ${columns === 1 ? '#2563eb' : '#e2e8f0'}`,
                        fontWeight: 700, cursor: 'pointer', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      <LayoutList size={15} /> 1 Coluna
                    </button>
                    <button
                      onClick={() => setColumns(2)}
                      style={{
                        padding: '10px', borderRadius: 10,
                        background: columns === 2 ? '#2563eb' : '#f8fafc',
                        color: columns === 2 ? 'white' : '#475569',
                        border: `1px solid ${columns === 2 ? '#2563eb' : '#e2e8f0'}`,
                        fontWeight: 700, cursor: 'pointer', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      <Columns size={15} /> 2 Colunas (ENEM)
                    </button>
                  </div>
                </div>

                {/* Layout Padrão das Alternativas */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    <LayoutList size={14} color="#8b5cf6" /> Disposição Global das Alternativas
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      onClick={() => setAlternativasLayout('vertical')}
                      style={{
                        padding: '10px', borderRadius: 10,
                        background: alternativasLayout === 'vertical' ? '#8b5cf6' : '#f8fafc',
                        color: alternativasLayout === 'vertical' ? 'white' : '#475569',
                        border: `1px solid ${alternativasLayout === 'vertical' ? '#8b5cf6' : '#e2e8f0'}`,
                        fontWeight: 700, cursor: 'pointer', fontSize: 13
                      }}
                    >
                      Vertical (Lista)
                    </button>
                    <button
                      onClick={() => setAlternativasLayout('horizontal')}
                      style={{
                        padding: '10px', borderRadius: 10,
                        background: alternativasLayout === 'horizontal' ? '#8b5cf6' : '#f8fafc',
                        color: alternativasLayout === 'horizontal' ? 'white' : '#475569',
                        border: `1px solid ${alternativasLayout === 'horizontal' ? '#8b5cf6' : '#e2e8f0'}`,
                        fontWeight: 700, cursor: 'pointer', fontSize: 13
                      }}
                    >
                      Horizontal (Lado a Lado)
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0 0' }}>
                    💡 Dica: Passe o mouse sobre qualquer questão na folha para escolher <strong>1col, 2col ou 3col</strong> apenas para aquela questão.
                  </p>
                </div>
              </>
            )}

            {activeTab === 'margens' && (
              <>
                {/* Réguas Visuais e Presets de Margem */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Guias de Margem na Folha</span>
                    <button
                      onClick={() => setShowMargins(!showMargins)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: 'none',
                        background: showMargins ? '#2563eb' : '#e2e8f0',
                        color: showMargins ? 'white' : '#475569',
                        fontWeight: 700,
                        fontSize: 11.5,
                        cursor: 'pointer'
                      }}
                    >
                      {showMargins ? 'Visíveis' : 'Ocultas'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                    Ajuste pelos controles abaixo ou ative as guias para arrastar diretamente na folha A4.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'Padrão', l: -25, r: -20, t: -10, b: -90 },
                      { label: 'Compacta', l: -35, r: -30, t: -20, b: -110 },
                      { label: 'Ampla', l: -5, r: -5, t: 5, b: -60 },
                    ].map(m => (
                      <button
                        key={m.label}
                        type="button"
                        onClick={() => {
                          setLeftMarginOffset(m.l);
                          setRightMarginOffset(m.r);
                          setTopMarginOffset(m.t);
                          setBottomMarginOffset(m.b);
                          setPageMargins({});
                        }}
                        style={{
                          padding: '7px 6px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: 'white',
                          color: '#334155',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders Numéricos Precisos de Margem */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Margem Superior (Topo)', val: topMarginOffset, set: setTopMarginOffset, min: -60, max: 80 },
                    { label: 'Margem Inferior (Rodapé)', val: bottomMarginOffset, set: setBottomMarginOffset, min: -140, max: 0 },
                    { label: 'Margem Esquerda', val: leftMarginOffset, set: setLeftMarginOffset, min: -55, max: 40 },
                    { label: 'Margem Direita', val: rightMarginOffset, set: setRightMarginOffset, min: -55, max: 40 },
                  ].map(ctrl => (
                    <div key={ctrl.label} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{ctrl.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb' }}>{ctrl.val >= 0 ? `+${ctrl.val}` : ctrl.val}px</span>
                      </div>
                      <input
                        type="range"
                        min={ctrl.min}
                        max={ctrl.max}
                        step={2}
                        value={ctrl.val}
                        onChange={e => ctrl.set(parseInt(e.target.value, 10))}
                        style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                    </div>
                  ))}
                </div>

                {Object.keys(pageMargins).length > 0 && (
                  <button
                    onClick={handleResetAllPageMargins}
                    style={{
                      padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <RotateCcw size={13} /> Limpar Ajustes Individuais ({Object.keys(pageMargins).length} pág.)
                  </button>
                )}

                {/* Cabeçalho */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
                    <Move size={15} color="#2563eb" /> Cabeçalho da Prova
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => setIsEditHeaderMode(!isEditHeaderMode)}
                      style={{
                        padding: '10px', borderRadius: 10,
                        background: isEditHeaderMode ? '#ef4444' : '#f8fafc',
                        color: isEditHeaderMode ? 'white' : '#334155',
                        border: `1px solid ${isEditHeaderMode ? '#ef4444' : '#cbd5e1'}`,
                        fontWeight: 700, cursor: 'pointer', fontSize: 13,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                      }}
                    >
                      <FileEdit size={15} />
                      {isEditHeaderMode ? 'Concluir Edição do Cabeçalho' : 'Mover / Editar Campos do Cabeçalho'}
                    </button>

                    {isEditHeaderMode && (
                      <button
                        onClick={handleSaveHeaderLayout}
                        disabled={savingHeader}
                        style={{
                          padding: '10px', borderRadius: 10,
                          background: '#10b981', color: 'white', border: 'none',
                          fontWeight: 700, cursor: 'pointer', fontSize: 12.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        {savingHeader ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Salvar Posições do Cabeçalho
                      </button>
                    )}
                  </div>
                </div>

                {/* Folha de Redação */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                    <PenTool size={15} color="#8b5cf6" /> Folha de Redação Oficial
                  </label>
                  <p style={{ color: '#64748b', fontSize: 11.5, marginBottom: 10, lineHeight: 1.4 }}>
                    Anexa uma folha pautada de redação ao final do documento.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAdicionarPaginaRedacao(!adicionarPaginaRedacao)}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 10,
                      background: adicionarPaginaRedacao ? 'rgba(139,92,246,0.12)' : '#f8fafc',
                      color: adicionarPaginaRedacao ? '#7c3aed' : '#475569',
                      border: `1px solid ${adicionarPaginaRedacao ? '#8b5cf6' : '#cbd5e1'}`,
                      fontWeight: 700, cursor: 'pointer', fontSize: 12.5,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    {adicionarPaginaRedacao ? '✓ Folha de Redação Incluída (Remover)' : '+ Incluir Folha de Redação'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'questoes' && (
              <>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      {localQuestoes.filter((q: any) => selectedIds.has(q._internalId) && q.tipo_questao !== 'texto_apoio').length} de {localQuestoes.filter((q: any) => q.tipo_questao !== 'texto_apoio').length} questões ativas
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Arraste os itens para reordenar</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(localQuestoes.map(q => q._internalId)))}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', fontSize: 11, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                    >
                      Todas
                    </button>
                  </div>
                </div>

                {(() => {
                  let displayCount = 0;
                  const questionNumbersMap = localQuestoes.map((q: any) => {
                    if (q.tipo_questao === 'texto_apoio') return null;
                    displayCount++;
                    return displayCount;
                  });

                  return (
                    <Reorder.Group axis="y" values={localQuestoes} onReorder={setLocalQuestoes} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {localQuestoes.map((q: any, idx) => {
                        const isSelected = selectedIds.has(q._internalId);
                        const isTextoApoio = q.tipo_questao === 'texto_apoio';

                        return (
                          <Reorder.Item
                            key={q._internalId}
                            value={q}
                            style={{
                              background: isTextoApoio
                                ? (isSelected ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.03)')
                                : (isSelected ? '#ffffff' : '#f1f5f9'),
                              border: `1px solid ${
                                isTextoApoio
                                  ? (isSelected ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.18)')
                                  : (isSelected ? '#e2e8f0' : '#cbd5e1')
                              }`,
                              opacity: isSelected ? 1 : 0.55,
                              borderRadius: 10,
                              padding: '9px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              cursor: 'grab',
                              userSelect: 'none',
                              boxShadow: isSelected ? '0 1px 2px rgba(15,23,42,0.04)' : 'none'
                            }}
                          >
                            {isTextoApoio ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, minWidth: 24, borderRadius: 8, background: 'rgba(168,85,247,0.2)', color: '#9333ea' }}>
                                <FileText size={13} color="#9333ea" />
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, minWidth: 24, borderRadius: 8, background: isSelected ? '#1e293b' : '#cbd5e1', color: 'white', fontSize: 11, fontWeight: 800 }}>
                                {questionNumbersMap[idx]}
                              </div>
                            )}
                            <div style={{ flex: 1, fontSize: 12, color: isTextoApoio ? '#9333ea' : '#334155', fontWeight: isTextoApoio ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isSelected ? 'none' : 'line-through' }}>
                              {isTextoApoio ? 'Texto de Apoio' : (q.enunciado ? q.enunciado.replace(/<[^>]+>/g, '').trim() : 'Questão com Imagem')}
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleQuestion(q._internalId); }}
                              style={{ border: 'none', background: isSelected ? '#fef2f2' : '#ecfdf5', borderRadius: 6, cursor: 'pointer', padding: 5, display: 'flex' }}
                              title={isSelected ? 'Ocultar questão da impressão' : 'Restaurar questão'}
                            >
                              {isSelected ? <Trash2 size={13} color="#ef4444" /> : <RotateCcw size={13} color="#10b981" />}
                            </button>
                            <Move size={14} color={isTextoApoio ? 'rgba(168,85,247,0.4)' : '#94a3b8'} />
                          </Reorder.Item>
                        )
                      })}
                    </Reorder.Group>
                  )
                })()}
              </>
            )}
          </div>

          {/* Rodapé de Ações */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              disabled={saving}
              onClick={() => setShowBackModal(true)} 
              style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'white', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 13, padding: '0 14px' }}
              title="Voltar sem Salvar"
            >
              <ArrowLeft size={15} />
              Sair
            </button>
            
            <button 
              disabled={saving || isPaginating}
              onClick={handlePrint} 
              style={{ 
                flex: 1, 
                height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, 
                borderRadius: 10, border: '1px solid #bfdbfe', 
                background: (saving || isPaginating) ? '#94a3b8' : (onSave ? '#eff6ff' : '#2563eb'), 
                color: (saving || isPaginating) ? 'white' : (onSave ? '#2563eb' : 'white'), 
                cursor: (saving || isPaginating) ? 'wait' : 'pointer', fontWeight: 700, fontSize: 13, padding: '0 12px' 
              }}
              title="Imprimir / Salvar PDF"
            >
              {isPaginating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Paginando...
                </>
              ) : (
                <>
                  <Printer size={15} />
                  Imprimir / PDF
                </>
              )}
            </button>

            {onSave && (
              <button 
                disabled={saving}
                onClick={async () => {
                  setQuestoes(localQuestoes)
                  saveToLocalStorage('simulador_margins', {
                    left: leftMarginOffset,
                    right: rightMarginOffset,
                    top: topMarginOffset,
                    bottom: bottomMarginOffset
                  })
                  saveToLocalStorage('simulador_page_margins', pageMargins)
                  saveToLocalStorage('simulador_header', headerLayout)

                  const updatedConfigEstudio = {
                    ...(prova?.config_estudio || {}),
                    config_fonte_enunciado: enunciadoFontSize,
                    config_fonte_alternativa: alternativasFontSize,
                    config_colunas: columns,
                    config_layout_alternativas: alternativasLayout,
                    config_line_height: lineHeight,
                    config_question_spacing: questionSpacing,
                    config_text_align: textAlign,
                    config_margin_left: leftMarginOffset,
                    config_margin_right: rightMarginOffset,
                    config_margin_top: topMarginOffset,
                    config_margin_bottom: bottomMarginOffset,
                    page_margins: pageMargins,
                    adicionar_pagina_redacao: adicionarPaginaRedacao,
                    header_layout: headerLayout
                  }

                  await saveToDatabaseTables(updatedConfigEstudio)

                  if (onSave) await onSave(localQuestoes, updatedConfigEstudio)
                  onClose()
                }} 
                style={{ flex: 1, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.25)', fontWeight: 700, fontSize: 13, padding: '0 12px' }}
                title="Salvar e Fechar"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Salvando' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      )}

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
      <div className="canvas-layout" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        {/* Barra Superior Flutuante de Controle da Visualização */}
        <div
          className="no-print"
          style={{
            position: 'sticky',
            top: 14,
            zIndex: 80,
            marginBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(12px)',
            padding: '7px 14px',
            borderRadius: 999,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.22)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'white',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: 'white', border: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              title="Abrir painel de configurações"
            >
              <PanelLeftOpen size={14} /> Painel
            </button>
          )}

          {/* Contador e Navegação de Páginas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, borderRight: '1px solid rgba(255,255,255,0.15)' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', padding: '0 4px' }}>
              📄 {pagesCount} {pagesCount === 1 ? 'pág.' : 'págs.'}
            </span>
            {pagesCount > 1 && Array.from({ length: Math.min(pagesCount, 8) }).map((_, idx) => (
              <button
                key={`jump-${idx}`}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`preview-page-${idx}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#f8fafc', fontSize: 10.5, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title={`Ir para página ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {/* Controle de Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8, borderRight: '1px solid rgba(255,255,255,0.15)' }}>
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(70, z - 10))}
              style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Diminuir Zoom"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', minWidth: 42, textAlign: 'center' }}
              title="Clique para 100%"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(130, z + 10))}
              style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Aumentar Zoom"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Toggles Rápidos de Visualização */}
          <button
            type="button"
            onClick={() => setCleanPreviewMode(!cleanPreviewMode)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999, border: 'none',
              background: cleanPreviewMode ? '#10b981' : 'rgba(255,255,255,0.1)',
              color: 'white', fontSize: 11.5, fontWeight: 700, cursor: 'pointer'
            }}
            title="Modo Limpo: mostra exatamente como a folha ficará impressa"
          >
            {cleanPreviewMode ? <EyeOff size={13} /> : <Eye size={13} />}
            {cleanPreviewMode ? 'Sair Modo Limpo' : 'Modo Limpo'}
          </button>

          <button
            type="button"
            onClick={() => setShowGabarito(!showGabarito)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999, border: 'none',
              background: showGabarito && !cleanPreviewMode ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.08)',
              color: showGabarito && !cleanPreviewMode ? '#6ee7b7' : '#94a3b8',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer'
            }}
            title="Mostrar/ocultar marcação verde do gabarito na tela"
          >
            <CheckCircle2 size={13} /> Gabarito
          </button>

          <button
            type="button"
            onClick={() => setShowMargins(!showMargins)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999, border: 'none',
              background: showMargins && !cleanPreviewMode ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255,255,255,0.08)',
              color: showMargins && !cleanPreviewMode ? '#93c5fd' : '#94a3b8',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer'
            }}
            title="Mostrar/ocultar linhas guia de margem"
          >
            <Maximize2 size={12} /> Margens
          </button>

          <button
            type="button"
            onClick={() => applyLayoutPreset('compacto')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 999, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
            }}
            title="Otimizar margens e espaçamentos automaticamente para caber melhor nas páginas"
          >
            <Sparkles size={12} /> Auto-Enquadrar
          </button>
        </div>

        <div className="print-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PaginationEngine
            questoes={selectedQuestoes}
            columns={columns}
            enunciadoFontSize={enunciadoFontSize}
            alternativasFontSize={alternativasFontSize}
            lineHeight={lineHeight}
            questionSpacing={questionSpacing}
            textAlign={textAlign}
            showGabarito={showGabarito}
            cleanPreviewMode={cleanPreviewMode}
            zoom={zoom}
            onPagesCountChange={setPagesCount}
            config={config}
            simulado={prova}
            alternativasLayout={alternativasLayout}
            isEditHeaderMode={isEditHeaderMode}
            headerLayout={headerLayout}
            onUpdateHeaderField={handleUpdateHeaderField}
            pageA4Ref={pageA4Ref}
            readOnly={isReadOnly}
            showMargins={showMargins}
            topMarginOffset={topMarginOffset}
            onTopMarginOffsetChange={setTopMarginOffset}
            bottomMarginOffset={bottomMarginOffset}
            onBottomMarginOffsetChange={setBottomMarginOffset}
            leftMarginOffset={leftMarginOffset}
            onLeftMarginOffsetChange={setLeftMarginOffset}
            rightMarginOffset={rightMarginOffset}
            onRightMarginOffsetChange={setRightMarginOffset}
            pageMargins={pageMargins}
            onPageMarginChange={handlePageMarginChange}
            adicionarPaginaRedacao={adicionarPaginaRedacao}
            onPaginatingChange={setIsPaginating}
            onEditEnunciado={isReadOnly ? () => {} : (qId, newText) => {
              setLocalQuestoes(prev => prev.map(q => {
                if ((q._internalId || q.id) !== qId) return q
                
                // Remove the wrapper div if it exists so we don't nest it indefinitely
                let cleanedText = newText
                if (cleanedText.startsWith('<div style="white-space: pre-wrap;">') && cleanedText.endsWith('</div>')) {
                  cleanedText = cleanedText.substring(36, cleanedText.length - 6)
                }
                
                return { ...q, enunciado: cleanedText }
              }))
            }}
            onEditAlternativa={isReadOnly ? () => {} : (qId, aId, text) => {
              setLocalQuestoes(prev => prev.map(q => {
                if (!matchQuestion(q, qId)) return q;
                const alts = q.alternativas || [];
                const aIdx = findAlternativeIndex(alts, aId);
                if (aIdx === -1 || !alts[aIdx]) return q;
                const newAlts = [...alts];
                newAlts[aIdx] = { ...newAlts[aIdx], text };
                return { ...q, alternativas: newAlts };
              }));
            }}
            onRemoveAlternativa={isReadOnly ? () => {} : (qId, aId) => {
              setLocalQuestoes(prev => prev.map(q => {
                if (!matchQuestion(q, qId)) return q;
                const alts = q.alternativas || [];
                const aIdx = findAlternativeIndex(alts, aId);
                if (aIdx === -1) return q;
                const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
                const remaining = alts.filter((_: any, ai: number) => ai !== aIdx);
                const relettered = remaining.map((a: any, idx: number) => ({
                  ...a,
                  letter: LETTERS[idx] || String.fromCharCode(65 + idx),
                  letra: LETTERS[idx] || String.fromCharCode(65 + idx)
                }));
                const correctAlt = relettered.find((alt: any) => alt.correct || alt.eh_correta);
                const newGabarito = correctAlt ? (correctAlt.letter || correctAlt.letra) : (relettered.some((alt: any) => alt.letter === q.gabarito) ? q.gabarito : '');
                return { ...q, alternativas: relettered, ...(newGabarito !== undefined ? { gabarito: newGabarito } : {}) };
              }));
            }}
            onMoveAlternativa={isReadOnly ? () => {} : (qId: string, aId: string, directionOrTarget: 'up' | 'down' | number, sourceIdx?: number, sourceLetter?: string) => {
              setLocalQuestoes(prev => prev.map(q => {
                if (!matchQuestion(q, qId)) return q;
                const alts = q.alternativas || [];
                const aIdx = findAlternativeIndex(alts, aId, sourceIdx, sourceLetter);
                if (aIdx === -1) return q;

                const targetIdx = typeof directionOrTarget === 'number'
                  ? directionOrTarget
                  : (directionOrTarget === 'up' ? aIdx - 1 : aIdx + 1);

                if (targetIdx < 0 || targetIdx >= alts.length || targetIdx === aIdx) return q;
                
                const newAlts = [...alts];
                const [moved] = newAlts.splice(aIdx, 1);
                newAlts.splice(targetIdx, 0, moved);
                
                const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
                const relettered = newAlts.map((alt: any, idx: number) => ({
                  ...alt,
                  letter: LETTERS[idx] || String.fromCharCode(65 + idx),
                  letra: LETTERS[idx] || String.fromCharCode(65 + idx)
                }));

                const correctAlt = relettered.find((alt: any) => alt.correct || alt.eh_correta);
                const newGabarito = correctAlt ? (correctAlt.letter || correctAlt.letra) : q.gabarito;

                return { ...q, alternativas: relettered, ...(newGabarito ? { gabarito: newGabarito } : {}) };
              }));
            }}
            onEditAlternativaImage={isReadOnly ? () => {} : (qId, aId, url) => {
              setLocalQuestoes(prev => prev.map(q => {
                if (!matchQuestion(q, qId)) return q;
                const newAlts = [...(q.alternativas || [])];
                const targetIdx = findAlternativeIndex(newAlts, aId);
                if (targetIdx !== -1 && newAlts[targetIdx]) {
                  newAlts[targetIdx] = { ...newAlts[targetIdx], imagem_url: url } as any;
                }
                return { ...q, alternativas: newAlts };
              }));
            }}
            onEditEnunciadoImage={isReadOnly ? () => {} : (qId, imgIndex, newUrl) => {
              setLocalQuestoes(prev => prev.map((q) => {
                if ((q._internalId || q.id) !== qId) return q
                const newImagens = [...(q.imagens || [])]
                if (!newUrl) {
                  newImagens[imgIndex] = { ...newImagens[imgIndex], src: '' } as any 
                } else {
                  newImagens[imgIndex] = { ...newImagens[imgIndex], src: newUrl } as any
                }
                return { ...q, imagens: newImagens }
              }))
            }}
            onToggleQuestion={handleToggleQuestion}
          />
        </div>
        <IgnoredQuestionsList
          questoes={unselectedQuestoes}
          onToggle={handleToggleQuestion}
        />
      </div>
    </motion.div>,
    document.body
  )
}
