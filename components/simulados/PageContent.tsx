import React, { useState, useEffect } from 'react';
import { X, BookOpen, ImageIcon, Sparkles, Upload, Trash2, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown, Plus, Minus, FileText, LayoutList, ArrowUpDown } from 'lucide-react';
import { HtmlContent } from '../HtmlContent';
import { DraggableHeaderField } from './DraggableHeaderField';
import { parseEnunciadoParts, splitTextIntoChunks } from './PaginationEngine';
import { formatProfessorHeaderName, DEFAULT_PROVA_INSTRUCOES } from '@/lib/utils';

export function PageContent({ 
  page, 
  pIndex, 
  enunciadoFontSize,
  alternativasFontSize, 
  config, 
  simulado, 
  onEditEnunciado, 
  onEditAlternativa, 
  onRemoveAlternativa, 
  onMoveAlternativa,
  onToggleQuestion, 
  forceRepaginate,
  isEditHeaderMode,
  headerLayout,
  onUpdateHeaderField,
  pageA4Ref,
  alternativasLayout = 'vertical',
  onEditAlternativaImage,
  onEditEnunciadoImage,
  showMargins,
  topMarginOffset = -10, onTopMarginOffsetChange,
  bottomMarginOffset = -90, onBottomMarginOffsetChange,
  leftMarginOffset = -25, onLeftMarginOffsetChange,
  rightMarginOffset = -20, onRightMarginOffsetChange,
  pageMargin,
  onPageMarginChange,
  readOnly = false,
  totalPages = 0,
  adicionarPaginaRedacao = false,
  lineHeight = 1.5,
  textAlign = 'justify',
  showGabarito = true,
  cleanPreviewMode = false
}: any) {
  const effectiveTop = pageMargin?.top ?? topMarginOffset ?? -10;
  const effectiveBottom = pageMargin?.bottom ?? bottomMarginOffset ?? -90;
  const effectiveLeft = pageMargin?.left ?? leftMarginOffset ?? -25;
  const effectiveRight = pageMargin?.right ?? rightMarginOffset ?? -20;

  const isLastRedacaoPage = adicionarPaginaRedacao && pIndex === totalPages - 1 && pIndex > 0;
  const [imgMenuOpen, setImgMenuOpen] = useState<string | null>(null);
  const [altLinesModalOpen, setAltLinesModalOpen] = useState<{ qId: string, altId: string, altParts: any[], q: any, a: any } | null>(null);
  const [altLinesCount, setAltLinesCount] = useState<number>(3);
  const [altLinesType, setAltLinesType] = useState<'pautado' | 'branco'>('pautado');
  const [mainImgMenuOpen, setMainImgMenuOpen] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [linesCount, setLinesCount] = useState<number>(5);
  const [linesType, setLinesType] = useState<'pautado' | 'branco'>('pautado');
  const [linesModalOpen, setLinesModalOpen] = useState<{qId: string, parts: any[], defaultCount: number, q: any} | null>(null);
  const [reorderMenuOpen, setReorderMenuOpen] = useState<string | null>(null);
  const [coverImgFailed, setCoverImgFailed] = useState(false);
  const [internalImgFailed, setInternalImgFailed] = useState(false);

  const coverBgUrl = simulado?.isRedacao
    ? config?.redacao_enem_modelo_pdf_url
    : (simulado?.isProva ? config?.provas_modelo_pdf_url : config?.modelo_pdf_url);

  const internalBgUrl = isLastRedacaoPage
    ? config?.redacao_enem_modelo_pdf_outras_paginas_url
    : (simulado?.isRedacao
        ? config?.redacao_enem_modelo_pdf_outras_paginas_url
        : (simulado?.isProva ? config?.provas_modelo_pdf_outras_paginas_url : config?.modelo_pdf_outras_paginas_url));

  useEffect(() => {
    setCoverImgFailed(false);
  }, [coverBgUrl]);

  useEffect(() => {
    setInternalImgFailed(false);
  }, [internalBgUrl]);

  useEffect(() => {
    if (!mainImgMenuOpen && !imgMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.floating-menu-dropdown') || target?.closest?.('.floating-menu-trigger')) {
        return;
      }
      setMainImgMenuOpen(null);
      setImgMenuOpen(null);
    };
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [mainImgMenuOpen, imgMenuOpen]);

  useEffect(() => {
    if (!reorderMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.reorder-popover') || target?.closest?.('.reorder-trigger')) {
        return;
      }
      setReorderMenuOpen(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReorderMenuOpen(null);
    };
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClickOutside);
    }, 0);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [reorderMenuOpen]);

  const renderReorderPopover = (
    qId: string,
    altId: string,
    currentLetter: string,
    currentIndex: number,
    totalAlts: number,
    isTop: boolean = false
  ) => {
    const menuKey = `${qId}-${altId}`;
    if (reorderMenuOpen !== menuKey || readOnly || !onMoveAlternativa) return null;

    return (
      <div
        className="no-print reorder-popover"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: 0,
          bottom: isTop ? 'auto' : '100%',
          top: isTop ? '100%' : 'auto',
          marginBottom: isTop ? 0 : 8,
          marginTop: isTop ? 8 : 0,
          background: '#ffffff',
          borderRadius: 14,
          padding: '10px 14px',
          boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.25), 0 4px 12px -2px rgba(15, 23, 42, 0.12)',
          border: '1.5px solid #93c5fd',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1000,
          whiteSpace: 'nowrap',
          pointerEvents: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Mover alternativa <span style={{ color: '#2563eb' }}>({currentLetter})</span> para:
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReorderMenuOpen(null);
            }}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4 }}
            title="Fechar"
          >
            <X size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {Array.from({ length: totalAlts }).map((_, targetIdx) => {
            const targetLetter = String.fromCharCode(65 + targetIdx);
            const isCurrent = targetIdx === currentIndex;
            return (
              <button
                key={targetIdx}
                type="button"
                disabled={isCurrent}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    onMoveAlternativa(qId, altId, targetIdx, currentIndex, currentLetter);
                  } catch (err) {
                    console.error('Erro ao mover alternativa:', err);
                  }
                  setReorderMenuOpen(null);
                  forceRepaginate?.();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title={isCurrent ? `Posição atual (${targetLetter})` : `Mover para posição ${targetLetter}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: isCurrent ? 'default' : 'pointer',
                  border: isCurrent ? '1.5px solid #e2e8f0' : '1.5px solid #93c5fd',
                  background: isCurrent ? '#f1f5f9' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  color: isCurrent ? '#94a3b8' : '#1d4ed8',
                  transition: 'all 0.15s ease',
                  boxShadow: isCurrent ? 'none' : '0 2px 4px rgba(37,99,235,0.15)'
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(37,99,235,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
                    e.currentTarget.style.color = '#1d4ed8';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(37,99,235,0.15)';
                  }
                }}
              >
                {targetLetter}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleMainImageAction = async (qId: string, imgIndex: number, action: 'upload' | 'ai', altText: string) => {
    setMainImgMenuOpen(null);
    if (!onEditEnunciadoImage) return;

    if (action === 'ai') {
      setIsGenerating('ai');
      try {
        const res = await fetch('/api/ai/gerar-imagem', {
          method: 'POST', body: JSON.stringify({ enunciado: altText, disciplina: 'Geral' }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.base64Image) {
          onEditEnunciadoImage(qId, imgIndex, `${data.base64Image}#w=350`);
        } else {
          alert('Erro ao gerar imagem por IA.');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao gerar imagem por IA.');
      }
      setIsGenerating(null);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as any).files[0];
        if (!file) return;
        setIsGenerating('upload');
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/upload-midia', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) onEditEnunciadoImage(qId, imgIndex, `${data.url}#w=350`);
        } catch (err) {
          console.error(err);
        }
        setIsGenerating(null);
      };
      input.click();
    }
  };

  const handleImageAction = async (qId: string, altId: string, action: 'upload' | 'ai', altText: string) => {
    setImgMenuOpen(null);
    if (!onEditAlternativaImage) return;

    if (action === 'ai') {
      setIsGenerating('ai');
      try {
        const res = await fetch('/api/ai/gerar-imagem', {
          method: 'POST', body: JSON.stringify({ enunciado: altText, disciplina: 'Geral' }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.base64Image) {
          onEditAlternativaImage(qId, altId, data.base64Image);
        } else {
          alert('Erro ao gerar imagem por IA.');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao gerar imagem por IA.');
      }
      setIsGenerating(null);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as any).files[0];
        if (!file) return;
        setIsGenerating('upload');
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/upload-midia', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) onEditAlternativaImage(qId, altId, data.url);
        } catch (err) {
          console.error(err);
        }
        setIsGenerating(null);
      };
      input.click();
    }
  };

  const renderQuestionHoverToolbar = (q: any, qNumLabel?: number | null) => {
    if (readOnly || cleanPreviewMode) return null;
    const isAddMenuOpen = mainImgMenuOpen === `${q.id}-add`;
    const metaAltCols = (() => {
      const m = (q.enunciado || '').match(/<meta name="alt-cols" content="(\d+)">/i);
      return m ? parseInt(m[1]) : 1;
    })();
    const metaRegex = /(<meta[^>]+>)/ig;
    const setAltCols = (n: number) => {
      if (!onEditEnunciado) return;
      const currentMeta = (q.enunciado || '').match(metaRegex) || [];
      const otherMetas = currentMeta.filter((mt: string) => !mt.includes('alt-cols'));
      const newMetaTag = n > 1 ? `<meta name="alt-cols" content="${n}">` : '';
      const strippedEnun = (q.enunciado || '').replace(metaRegex, '').trim();
      const allMetas = [...otherMetas, ...(newMetaTag ? [newMetaTag] : [])];
      const newEnun = allMetas.length > 0 ? allMetas.join('\n') + '\n' + strippedEnun : strippedEnun;
      onEditEnunciado(q.id, newEnun);
      forceRepaginate?.();
    };

    const showAltColsToggle =
      q.tipo_questao !== 'descritiva' &&
      q.tipo_questao !== 'texto_apoio' &&
      q.simulados_alternativas?.length > 0 &&
      Boolean(onEditEnunciado);

    return (
      <div
        className={`no-print questao-floating-toolbar ${isAddMenuOpen ? 'is-open' : ''}`}
        style={{
          position: 'absolute',
          top: -16,
          right: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(8px)',
          padding: '3px 8px',
          borderRadius: 999,
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.22)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', padding: '0 4px', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
          {q.tipo_questao === 'texto_apoio' ? 'Texto de Apoio' : `Q${qNumLabel ?? ''}`}
        </span>
        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.18)' }} />

        {showAltColsToggle && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} title="Colunas das alternativas nesta questão">
              {[1, 2, 3].map((n) => {
                const isActive = metaAltCols === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAltCols(n);
                    }}
                    style={{
                      padding: '2px 6px',
                      height: 20,
                      borderRadius: 999,
                      border: 'none',
                      background: isActive ? '#3b82f6' : 'transparent',
                      color: isActive ? '#ffffff' : '#cbd5e1',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    title={`Alternativas em ${n} coluna(s)`}
                  >
                    {n}col
                  </button>
                );
              })}
            </div>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.18)' }} />
          </>
        )}

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="floating-menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setMainImgMenuOpen(isAddMenuOpen ? null : `${q.id}-add`);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 7px',
              height: 20,
              borderRadius: 999,
              border: 'none',
              background: isAddMenuOpen ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              color: '#f8fafc',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Inserir imagem no enunciado"
          >
            <ImageIcon size={11} /> + Figura
          </button>
          {isAddMenuOpen && (
            <div
              className="floating-menu-dropdown"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 9999,
                marginTop: 6,
                background: '#ffffff',
                borderRadius: 10,
                boxShadow: '0 10px 25px rgba(15,23,42,0.18)',
                border: '1px solid #e2e8f0',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                width: 150,
              }}
            >
              <button
                type="button"
                onClick={() => handleMainImageAction(q.id, q.imagens?.length || 0, 'upload', q.enunciado)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: 12,
                  color: '#334155',
                  cursor: 'pointer',
                  borderRadius: 6,
                  textAlign: 'left',
                  fontWeight: 600,
                }}
              >
                <Upload size={13} color="#2563eb" /> Fazer Upload
              </button>
              <button
                type="button"
                onClick={() => handleMainImageAction(q.id, q.imagens?.length || 0, 'ai', q.enunciado)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: 12,
                  color: '#7c3aed',
                  cursor: 'pointer',
                  borderRadius: 6,
                  textAlign: 'left',
                  fontWeight: 700,
                }}
              >
                <Sparkles size={13} color="#7c3aed" /> Gerar com IA
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const parts = parseEnunciadoParts(q.enunciado, q.imagens || []);
            const hasLines = parts.some((p: any) => p.type === 'lines');
            if (hasLines) {
              alert('Esta questão já possui linhas/espaço. Ajuste a quantidade nos botões + e − que aparecem ao passar o mouse sobre as linhas.');
              return;
            }
            setLinesCount(5);
            setLinesType('pautado');
            setLinesModalOpen({ qId: q._internalId || q.id, parts, defaultCount: 5, q });
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            height: 20,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.1)',
            color: '#f8fafc',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Adicionar linhas pautadas ou espaço em branco para resposta"
        >
          <Plus size={11} /> Linhas
        </button>

        {onToggleQuestion && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleQuestion(q.id || q._internalId);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              cursor: 'pointer',
            }}
            title="Ocultar esta questão da folha"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    );
  };

  const renderAlternativeRowToolbar = (
    qId: string,
    q: any,
    a: any,
    altParts: any[],
    saveAltParts: (newParts: any[]) => void
  ) => {
    if (readOnly || cleanPreviewMode) return null;
    const menuKey = `${qId}-${a.id}`;
    const isImgOpen = imgMenuOpen === menuKey || imgMenuOpen === a.id;
    const isReorderOpen = reorderMenuOpen === menuKey;
    const isOpen = isImgOpen || isReorderOpen;

    return (
      <div
        className={`no-print alt-row-toolbar ${isOpen ? 'is-open' : ''}`}
        style={{
          position: 'absolute',
          right: 2,
          top: -4,
          zIndex: isOpen ? 90 : 30,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          background: 'rgba(255, 255, 255, 0.97)',
          border: '1px solid #cbd5e1',
          borderRadius: 999,
          padding: '2px 5px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
        }}
      >
        {onMoveAlternativa && (
          <button
            type="button"
            className="reorder-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setReorderMenuOpen(isReorderOpen ? null : menuKey);
            }}
            title={`Mover alternativa ${a.letra} para outra posição`}
            style={{
              background: isReorderOpen ? '#2563eb' : '#eff6ff',
              color: isReorderOpen ? '#ffffff' : '#2563eb',
              border: 'none',
              borderRadius: 999,
              height: 20,
              padding: '0 6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <ArrowUpDown size={10} /> Mover
          </button>
        )}

        {onEditAlternativa && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const hasLines = altParts.some((p: any) => p.type === 'lines');
              if (hasLines) {
                alert('Esta alternativa já possui linhas/espaço. Use os botões + e − sobre as linhas para ajustar.');
                return;
              }
              setAltLinesCount(3);
              setAltLinesType('pautado');
              setAltLinesModalOpen({ qId, altId: a.id, altParts, q, a });
            }}
            title="Adicionar linhas ou espaço nesta alternativa"
            style={{
              background: '#f5f3ff',
              color: '#7c3aed',
              border: 'none',
              borderRadius: 999,
              height: 20,
              padding: '0 6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={10} /> Linhas
          </button>
        )}

        {onEditAlternativaImage && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="floating-menu-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setImgMenuOpen(isImgOpen ? null : menuKey);
              }}
              title="Adicionar ou alterar imagem desta alternativa"
              style={{
                background: isImgOpen ? '#2563eb' : '#f0f9ff',
                color: isImgOpen ? '#ffffff' : '#0284c7',
                border: 'none',
                borderRadius: 999,
                width: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ImageIcon size={11} />
            </button>
            {isImgOpen && (
              <div
                className="floating-menu-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 9999,
                  marginTop: 4,
                  background: '#ffffff',
                  borderRadius: 10,
                  boxShadow: '0 10px 25px rgba(15,23,42,0.18)',
                  border: '1px solid #e2e8f0',
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  width: 145,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleImageAction(qId, a.id, 'upload', a.texto)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    color: '#334155',
                    cursor: 'pointer',
                    borderRadius: 6,
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                >
                  <Upload size={13} color="#2563eb" /> Fazer Upload
                </button>
                <button
                  type="button"
                  onClick={() => handleImageAction(qId, a.id, 'ai', a.texto)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    color: '#7c3aed',
                    cursor: 'pointer',
                    borderRadius: 6,
                    textAlign: 'left',
                    fontWeight: 700,
                  }}
                >
                  <Sparkles size={13} color="#7c3aed" /> Gerar com IA
                </button>
              </div>
            )}
          </div>
        )}

        {onRemoveAlternativa && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReorderMenuOpen(null);
              onRemoveAlternativa(qId, a.id);
              forceRepaginate?.();
            }}
            title="Remover alternativa"
            style={{
              background: '#fee2e2',
              color: '#ef4444',
              border: 'none',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .questao-container p, .html-content p {
          margin-top: 0;
          margin-bottom: 0.25em;
        }
        .questao-container p:first-child, .html-content p:first-child {
          margin-top: 0 !important;
        }
        .questao-container p:last-child, .html-content p:last-child {
          margin-bottom: 0 !important;
        }
        @media screen {
          .correct-bubble-preview {
            background-color: #22c55e !important;
            color: #ffffff !important;
            border-color: #22c55e !important;
          }
          .hide-gabarito-preview .correct-bubble-preview {
            background-color: transparent !important;
            color: #475569 !important;
            border-color: #cbd5e1 !important;
          }

          .questao-hover-block {
            border-radius: 6px;
            transition: background-color 0.15s ease;
          }
          .questao-hover-block:hover {
            background-color: rgba(15, 23, 42, 0.014);
          }
          .questao-floating-toolbar {
            opacity: 0;
            pointer-events: none;
            transform: translateY(2px);
            transition: opacity 0.16s ease, transform 0.16s ease;
          }
          .questao-hover-block:hover > .questao-floating-toolbar,
          .questao-floating-toolbar.is-open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
          }

          .alt-row-item {
            border-radius: 6px;
            transition: background-color 0.14s ease;
          }
          .alt-row-item:hover {
            background-color: rgba(59, 130, 246, 0.045);
          }
          .alt-row-toolbar {
            opacity: 0;
            pointer-events: none;
            transform: translateY(2px);
            transition: opacity 0.15s ease, transform 0.15s ease;
          }
          .alt-row-item:hover > .alt-row-toolbar,
          .alt-row-toolbar.is-open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
          }

          .img-hover-wrapper .img-floating-toolbar {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.18s ease;
          }
          .img-hover-wrapper:hover > .img-floating-toolbar,
          .img-floating-toolbar.is-open {
            opacity: 1;
            pointer-events: auto;
          }

          .lines-hover-wrapper .lines-floating-toolbar {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease;
          }
          .lines-hover-wrapper:hover > .lines-floating-toolbar {
            opacity: 1;
            pointer-events: auto;
          }

          .margin-guide-handle .margin-guide-badge {
            opacity: 0;
            transition: opacity 0.15s ease;
          }
          .margin-guide-handle:hover .margin-guide-badge,
          .margin-guide-handle:active .margin-guide-badge {
            opacity: 1;
          }
          .margin-guide-handle:hover .margin-guide-line-bar {
            border-color: #ea580c !important;
            background: rgba(234, 88, 12, 0.85) !important;
          }
        }

        .header-field.editable {
          outline: 1px dashed rgba(59, 130, 246, 0.8);
          background: rgba(59, 130, 246, 0.08);
          border-radius: 3px;
          padding: 1px 2px;
          transition: background 0.2s;
          user-select: none;
          -webkit-user-select: none;
        }

        .header-field.editable:hover, .header-field.editable:focus {
          outline: 2px solid #2563eb;
          background: rgba(37, 99, 235, 0.12);
        }

        .header-field.dragging {
          opacity: 0.8;
          z-index: 100 !important;
        }

        :global(.a4-page-content img:not(.cover-bg-img)), 
        :global(.preview-area img:not(.cover-bg-img)), 
        :global(.print-page img:not(.cover-bg-img)) {
          max-width: 100% !important;
          max-height: 220mm !important;
          height: auto !important;
          object-fit: contain;
        }

        .cover-bg-img,
        .print-cover-image img,
        .print-repeating-bg img {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: fill !important;
          display: block !important;
        }

        .field-label-tag {
          position: absolute;
          top: -16px;
          left: 0;
          background: #2563eb;
          color: white;
          font-size: 9px;
          padding: 2px 4px;
          border-radius: 2px;
          line-height: 1;
          pointer-events: none;
        }

        @media print {
          .header-field {
            outline: none !important;
            background: transparent !important;
            border: none !important;
            cursor: default !important;
          }
          .simulado-bimestre-badge,
          .simulado-bimestre-badge * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .field-label-tag, .texto-apoio-badge, .texto-apoio-spacer, .no-print, .reorder-popover, .questao-floating-toolbar, .alt-row-toolbar, .img-floating-toolbar, .lines-floating-toolbar {
            display: none !important;
          }
          .reorder-trigger {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border: 2px solid #cbd5e1 !important;
            color: #475569 !important;
            background: transparent !important;
            box-shadow: none !important;
            cursor: default !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        .template-fields {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          font-family: Arial, sans-serif;
          font-weight: 700;
          color: #1f2937;
        }
      `}</style>
      {pIndex === 0 && coverBgUrl && !coverImgFailed && (
        <div className="print-cover-image" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img
            className="cover-bg-img"
            src={coverBgUrl || undefined}
            alt=""
            onError={() => setCoverImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }}
          />
        </div>
      )}
      {pIndex > 0 && internalBgUrl && !internalImgFailed && (
        <div className="print-repeating-bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img
            className="cover-bg-img"
            src={internalBgUrl || undefined}
            alt=""
            onError={() => setInternalImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }}
          />
        </div>
      )}

      {pIndex === 0 && (
        <>
          {simulado?.isProva || simulado?.isRedacao ? (
            <div className="template-fields" ref={pageA4Ref} style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: isEditHeaderMode ? 'auto' : 'none' }}>
              {headerLayout && Object.keys(headerLayout).map((key) => {
                if (key === 'bimestre') return null;
                const field = headerLayout[key];
                // Injetar o valor dinâmico baseado na chave
                let value = '';
                if (key === 'title') value = simulado?.titulo || '';
                else if (key === 'disciplina') value = simulado?.formattedDisciplinas || '';
                else if (key === 'professor') value = formatProfessorHeaderName(simulado?.formattedProfessors || '');
                else if (key === 'data') value = simulado?.formattedDate ? simulado.formattedDate : '____ / ____ / ________';
                else if (key === 'turma') value = simulado?.formattedSeries || '';
                else if (key === 'valor') value = simulado?.valor || '';
                else if (key === 'nota') value = ''; // Nota fica em branco para o professor preencher à mão
                else if (key === 'orientacoes') value = simulado?.instrucoes || DEFAULT_PROVA_INSTRUCOES;

                return (
                  <DraggableHeaderField
                    key={key}
                    fieldKey={key}
                    field={{ ...field, value }}
                    isEditMode={isEditHeaderMode}
                    onChange={onUpdateHeaderField}
                    onTextChange={(newText) => {
                      if (key === 'orientacoes' && simulado) {
                        simulado.instrucoes = newText;
                      }
                    }}
                    pageRef={pageA4Ref}
                  />
                );
              })}
            </div>
          ) : (
            <div className="template-fields" ref={pageA4Ref} style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: isEditHeaderMode ? 'auto' : 'none' }}>
              {headerLayout && headerLayout.title && (
                <DraggableHeaderField
                  key="title"
                  fieldKey="title"
                  field={{ 
                    ...headerLayout.title, 
                    value: simulado?.titulo || 'Simulado sem título'
                  }}
                  isEditMode={isEditHeaderMode}
                  onChange={onUpdateHeaderField}
                  pageRef={pageA4Ref}
                />
              )}
              {(() => {
                const bimestreText =
                  simulado?.bimestre_nome ||
                  simulado?.simulados_bimestres?.nome ||
                  simulado?.bimestre ||
                  (isEditHeaderMode ? '1º Bimestre' : '');
                if (!bimestreText) return null;
                const bimField = headerLayout?.bimestre || {
                  label: 'Bimestre',
                  x: 52.33,
                  y: 14.45,
                  fontSize: 8.5,
                  width: 30,
                  align: 'center'
                };
                return (
                  <DraggableHeaderField
                    key="bimestre"
                    fieldKey="bimestre"
                    field={{
                      ...bimField,
                      value: bimestreText,
                      isBimestreBadge: true
                    }}
                    isEditMode={isEditHeaderMode}
                    onChange={onUpdateHeaderField}
                    pageRef={pageA4Ref}
                  />
                );
              })()}
            </div>
          )}
        </>
      )}

      <div
        className={`${!showGabarito || cleanPreviewMode ? 'hide-gabarito-preview' : ''}`}
        style={{ 
          position: 'relative', 
          paddingTop: pIndex === 0 ? `calc(75mm + ${effectiveTop}px)` : `calc(18mm + ${effectiveTop}px)`, 
          paddingLeft: `calc(18mm + ${effectiveLeft}px)`, 
          paddingRight: `calc(18mm + ${effectiveRight}px)`, 
          paddingBottom: `calc(42mm + ${effectiveBottom}px)`,
          height: '100%', boxSizing: 'border-box',
          zIndex: 2,
          display: 'flex',
          gap: 0,
          overflow: 'hidden',
        }}
      >
        {page.map((col: any[], cIndex: number) => (
          <React.Fragment key={`col-${cIndex}`}>
            {cIndex > 0 && (
              <div style={{
                width: '1px',
                background: 'linear-gradient(to bottom, rgba(59,130,246,0) 0%, rgba(59,130,246,0.3) 15%, rgba(59,130,246,0.3) 85%, rgba(59,130,246,0) 100%)',
                alignSelf: 'stretch',
                margin: '0'
              }} />
            )}
            <div style={{ 
              flex: 1, 
              minWidth: 0,
              fontSize: `${enunciadoFontSize}px`, 
              lineHeight: lineHeight || 1.5, 
              color: '#000', 
              textAlign: textAlign || 'justify',
              paddingLeft: cIndex > 0 ? '6mm' : 0,
              paddingRight: cIndex < page.length - 1 ? '6mm' : 0
            }}>
            {col.map((block: any, bIndex: number) => {
              const blockKey = `b-${bIndex}-${block.type}-${block.q?.id || block.q?._internalId || block.discName || ''}${block.originalIndex !== undefined ? `-orig-${block.originalIndex}` : ''}${block.chunkIndex !== undefined ? `-chunk-${block.chunkIndex}` : ''}${block.startChunkIndex !== undefined ? `-start-${block.startChunkIndex}` : ''}${block.alt?.id ? `-alt-${block.alt.id}` : ''}${block.lineIndex !== undefined ? `-line-${block.lineIndex}` : ''}`;
              
              if (block.type === 'part_disciplina') {
                return (
                  <div 
                    key={blockKey}
                    style={{
                      marginTop: block.renderMarginTop || 0,
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      width: '100%',
                      breakInside: 'avoid'
                    }}
                  >
                    <div style={{ flexShrink: 0, padding: '6px 16px', background: '#1e293b', color: 'white', borderRadius: 24, fontSize: '10pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BookOpen size={14} color="#38bdf8" />
                      {block.discName}
                    </div>
                    <div style={{ flex: 1, height: 2, background: 'linear-gradient(to right, #cbd5e1, transparent)' }} />
                  </div>
                );
              }

              if (block.type === 'full') {
                const q = block.q;
                const qNumberLabel = block.qIndex !== null && block.qIndex !== undefined ? block.qIndex + 1 : null;
                return (
                  <div key={blockKey} className="questao-container questao-hover-block" style={{ position: 'relative', marginTop: block.renderMarginTop || 0, breakInside: 'avoid' }}>
                    {renderQuestionHoverToolbar(q, qNumberLabel)}

                    {q.tipo_questao === 'texto_apoio' && (
                      <div className="no-print texto-apoio-badge" style={{
                        position: 'absolute',
                        left: -20,
                        top: '50%',
                        transform: 'translate(-50%, -50%) rotate(-90deg)',
                        transformOrigin: 'center center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px',
                        background: '#8b5cf6',
                        color: '#ffffff',
                        fontWeight: 800,
                        borderRadius: '12px',
                        fontSize: '7.5pt',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
                        zIndex: 20
                      }}>
                        <FileText size={12} color="#ffffff" />
                        Texto de Apoio
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {q.tipo_questao !== 'texto_apoio' && (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '28px', height: '28px', minWidth: '28px', background: '#1e293b', color: '#ffffff',
                          fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '2px'
                        }}>
                          {qNumberLabel ?? ''}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {(() => {
                          const parts = parseEnunciadoParts(q.enunciado, q.imagens || []);
                          const groupedParts: any[] = [];
                          parts.forEach((part, pIdx) => {
                            const p = { ...part, originalIndex: pIdx };
                            if (p.type === 'text' || p.type === 'lines') {
                              groupedParts.push(p);
                            } else {
                              const last = groupedParts[groupedParts.length - 1];
                              if (last && last.type === 'img_group') {
                                last.images.push(p);
                              } else {
                                groupedParts.push({ type: 'img_group', images: [p] });
                              }
                            }
                          });

                          return (
                            <div style={{ position: 'relative' }}>
                              {groupedParts.map((group: any, gIdx: number) => (
                                group.type === 'text' ? (
                              <div key={`txt-${group.originalIndex}`} data-height-id={`${q.id}-enun-txt-${group.originalIndex}`} style={{ position: 'relative', width: '100%', marginTop: gIdx > 0 ? 8 : 0 }}>
                                <HtmlContent 
                                  editable={!readOnly}
                                  html={group.content || ''}
                                  onBlurHtml={(newHtml) => {
                                    const metaRegex = /(<meta[^>]+>)/ig;
                                    const metaTags = (q.enunciado || '').match(metaRegex) || [];
                                    
                                    const newFullHtml = parts.map((p: any, i: number) => {
                                      if (p.type === 'text') {
                                         let txt = i === group.originalIndex ? newHtml : p.content;
                                         return (txt || '').replace(metaRegex, '');
                                      }
                                      if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                      return `[IMAGEM ${p.index + 1}]`;
                                    }).join('');
                                    
                                    onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                    forceRepaginate();
                                  }}
                                  style={{ outline: 'none', wordBreak: 'break-word', cursor: readOnly ? 'default' : 'text' }}
                                />
                              </div>
                            ) : group.type === 'lines' ? (
                                <div key={`lines-${group.originalIndex}`} className="lines-hover-wrapper" style={{ position: 'relative', marginTop: gIdx > 0 ? 8 : 0, width: '100%' }}>
                                  {Array.from({ length: group.count }).map((_, i) => (
                                    <div key={i} style={{ position: 'relative', width: '100%', borderBottom: group.style === 'branco' ? 'none' : '1px solid #000', height: 28 }}>
                                      {group.style !== 'branco' && (
                                        <div style={{
                                          position: 'absolute',
                                          left: -38,
                                          bottom: 0,
                                          width: 28,
                                          display: 'flex',
                                          alignItems: 'flex-end',
                                          justifyContent: 'flex-end',
                                          paddingRight: 6,
                                          fontSize: '9pt',
                                          color: '#a1a1aa',
                                          fontWeight: 500,
                                          userSelect: 'none',
                                          height: 28
                                        }}>
                                          {i + 1}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                 {!readOnly && (
                                   <div className="no-print lines-floating-toolbar" style={{ position: 'absolute', right: 4, top: 4, display: 'flex', gap: 4, zIndex: 20, background: 'rgba(255,255,255,0.95)', padding: '3px 6px', borderRadius: 20, boxShadow: '0 4px 12px rgba(15,23,42,0.12)', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                                     <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', padding: '0 4px' }}>{group.count} {group.count === 1 ? 'linha' : 'linhas'}</span>
                                     <button onClick={() => {
                                         const newFullHtml = parts.map((p: any, i: number) => {
                                           if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                           if (p.type === 'lines') {
                                             if (i === group.originalIndex) return p.style === 'branco' ? `[ESPACO_BRANCO:${Math.max(1, group.count - 1)}]` : `[LINHAS_PAUTADAS:${Math.max(1, group.count - 1)}]`;
                                             return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                           }
                                           return `[IMAGEM ${p.index + 1}]`;
                                         }).join('');
                                         const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                                         onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                         forceRepaginate();
                                     }} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800 }} title="Remover uma linha">−</button>
                                     <button onClick={() => {
                                         const newFullHtml = parts.map((p: any, i: number) => {
                                           if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                           if (p.type === 'lines') {
                                             if (i === group.originalIndex) return p.style === 'branco' ? `[ESPACO_BRANCO:${group.count + 1}]` : `[LINHAS_PAUTADAS:${group.count + 1}]`;
                                             return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                           }
                                           return `[IMAGEM ${p.index + 1}]`;
                                         }).join('');
                                         const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                                         onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                         forceRepaginate();
                                     }} style={{ background: '#ecfdf5', color: '#059669', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800 }} title="Adicionar uma linha">+</button>
                                     <button onClick={() => {
                                         const newFullHtml = parts.filter((p: any, i: number) => i !== group.originalIndex).map((p: any) => {
                                           if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                           if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                           return `[IMAGEM ${p.index + 1}]`;
                                         }).join('');
                                         const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                                         onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                         forceRepaginate();
                                     }} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover bloco de linhas"><Trash2 size={12} /></button>
                                   </div>
                                 )}
                               </div>
                            ) : (
                              (() => {
                                const firstImg = group.images[0];
                                const firstHashIndex = firstImg.url ? firstImg.url.indexOf('#') : -1;
                                const firstHashStr = firstHashIndex >= 0 ? firstImg.url.substring(firstHashIndex + 1) : '';
                                const firstParams = new URLSearchParams(firstHashStr);
                                const firstAlign = firstParams.get('a') || 'center';
                                const groupJustify = firstAlign === 'left' ? 'flex-start' : firstAlign === 'right' ? 'flex-end' : 'center';

                                return (
                                  <div key={`img-group-${gIdx}`} data-height-id={`${q.id}-img-group-${gIdx}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: groupJustify, marginTop: 4, width: '100%' }}>
                                    {group.images.map((part: any) => {
                                      const pIdx = part.originalIndex;
                                  const hashIndex = part.url ? part.url.indexOf('#') : -1;
                                  const imgBaseUrl = hashIndex >= 0 ? part.url.substring(0, hashIndex) : (part.url || '');
                                  const hashStr = hashIndex >= 0 ? part.url.substring(hashIndex + 1) : '';
                                  const params = new URLSearchParams(hashStr);
                                  const imgWidthStr = params.get('w');
                                  const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : 600;
                                  const imgAlign = params.get('a') || 'center';
                                  const justifyContent = imgAlign === 'left' ? 'flex-start' : imgAlign === 'right' ? 'flex-end' : 'center';

                                  const setWidth = (w: number) => {
                                    const p = new URLSearchParams(hashStr);
                                    p.set('w', w.toString());
                                    if (imgAlign !== 'center') p.set('a', imgAlign);
                                    onEditEnunciadoImage?.(q.id, part.index, `${imgBaseUrl}#${p.toString()}`);
                                    forceRepaginate?.();
                                  };

                                  const setAlign = (a: string) => {
                                    const p = new URLSearchParams(hashStr);
                                    if (imgWidthStr) p.set('w', imgWidthStr);
                                    p.set('a', a);
                                    onEditEnunciadoImage?.(q.id, part.index, `${imgBaseUrl}#${p.toString()}`);
                                    forceRepaginate?.();
                                  };
                                  
                                  const movePart = (direction: 'up' | 'down') => {
                                    const metaRegex = /(<meta[^>]+>)/ig;
                                    const metaTags = (q.enunciado || '').match(metaRegex) || [];
                                    
                                    const newParts = [...parts];
                                    if (direction === 'up' && pIdx > 0) {
                                       const temp = newParts[pIdx - 1];
                                       newParts[pIdx - 1] = newParts[pIdx];
                                       newParts[pIdx] = temp;
                                    } else if (direction === 'down' && pIdx < newParts.length - 1) {
                                       const temp = newParts[pIdx + 1];
                                       newParts[pIdx + 1] = newParts[pIdx];
                                       newParts[pIdx] = temp;
                                    } else {
                                       return;
                                    }
                                    
                                    const newFullHtml = newParts.map((p: any) => {
                                      if (p.type === 'text') return (p.content || '').replace(metaRegex, '');
                                      if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                      return `[IMAGEM ${p.index + 1}]`;
                                    }).join('');
                                    
                                    onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                    forceRepaginate?.();
                                  };

                                  return (
                                    <div key={`img-${part.index}-${pIdx}`} className="img-hover-wrapper" style={{ position: 'relative', display: 'flex', justifyContent, width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%' }}>
                                      <img src={imgBaseUrl || undefined} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                      {onEditEnunciadoImage && !readOnly && (
                                        <div className="no-print img-floating-toolbar" style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 4, zIndex: 25, flexWrap: 'wrap', maxWidth: 340, justifyContent: 'flex-start' }}>
                                          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 6px', gap: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', alignItems: 'center' }}>
                                            <button onClick={() => movePart('up')} disabled={pIdx === 0} style={{ background: 'transparent', color: pIdx === 0 ? '#475569' : '#f8fafc', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx === 0 ? 'default' : 'pointer' }} title="Mover para cima"><ArrowUp size={13} /></button>
                                            <button onClick={() => movePart('down')} disabled={pIdx === parts.length - 1} style={{ background: 'transparent', color: pIdx === parts.length - 1 ? '#475569' : '#f8fafc', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx === parts.length - 1 ? 'default' : 'pointer' }} title="Mover para baixo"><ArrowDown size={13} /></button>
                                          </div>
                                          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 8px', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', alignItems: 'center' }}>
                                            {[
                                              { label: 'P', w: 180 },
                                              { label: 'M', w: 300 },
                                              { label: 'G', w: 450 },
                                              { label: '100%', w: 620 }
                                            ].map(preset => (
                                              <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => setWidth(preset.w)}
                                                style={{
                                                  background: Math.abs((imgWidth || 600) - preset.w) < 25 ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                                  color: '#fff',
                                                  border: 'none',
                                                  borderRadius: 6,
                                                  padding: '2px 5px',
                                                  fontSize: 9.5,
                                                  fontWeight: 800,
                                                  cursor: 'pointer'
                                                }}
                                                title={`Largura ${preset.label} (${preset.w}px)`}
                                              >
                                                {preset.label}
                                              </button>
                                            ))}
                                            <input 
                                              type="range" 
                                              min="80" 
                                              max="700" 
                                              step="10"
                                              defaultValue={imgWidth || 600}
                                              onMouseDown={(e) => {
                                                const inputEl = e.currentTarget;
                                                const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                                if (menu) {
                                                  const rect = menu.getBoundingClientRect();
                                                  menu.dataset.oldLeft = menu.style.left;
                                                  menu.dataset.oldBottom = menu.style.bottom;
                                                  menu.dataset.oldPosition = menu.style.position;
                                                  menu.style.position = 'fixed';
                                                  menu.style.left = `${rect.left}px`;
                                                  menu.style.top = `${rect.top}px`;
                                                  menu.style.bottom = 'auto';
                                                  menu.style.right = 'auto';
                                                }
                                                const handleEnd = () => {
                                                  window.removeEventListener('mouseup', handleEnd);
                                                  if (menu) {
                                                    menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                    menu.style.left = menu.dataset.oldLeft || '6px';
                                                    menu.style.bottom = menu.dataset.oldBottom || '6px';
                                                    menu.style.top = 'auto';
                                                    menu.style.right = 'auto';
                                                  }
                                                  setWidth(parseInt(inputEl.value));
                                                };
                                                window.addEventListener('mouseup', handleEnd);
                                              }}
                                              onTouchStart={(e) => {
                                                const inputEl = e.currentTarget;
                                                const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                                if (menu) {
                                                  const rect = menu.getBoundingClientRect();
                                                  menu.dataset.oldLeft = menu.style.left;
                                                  menu.dataset.oldBottom = menu.style.bottom;
                                                  menu.dataset.oldPosition = menu.style.position;
                                                  menu.style.position = 'fixed';
                                                  menu.style.left = `${rect.left}px`;
                                                  menu.style.top = `${rect.top}px`;
                                                  menu.style.bottom = 'auto';
                                                  menu.style.right = 'auto';
                                                }
                                                const handleEnd = () => {
                                                  window.removeEventListener('touchend', handleEnd);
                                                  if (menu) {
                                                    menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                    menu.style.left = menu.dataset.oldLeft || '6px';
                                                    menu.style.bottom = menu.dataset.oldBottom || '6px';
                                                    menu.style.top = 'auto';
                                                    menu.style.right = 'auto';
                                                  }
                                                  setWidth(parseInt(inputEl.value));
                                                };
                                                window.addEventListener('touchend', handleEnd);
                                              }}
                                              onChange={(e) => {
                                                const groupEl = e.currentTarget.closest('.img-hover-wrapper') as HTMLElement;
                                                const imgEl = groupEl?.querySelector('img');
                                                if (groupEl && imgEl) {
                                                  groupEl.style.width = `${e.currentTarget.value}px`;
                                                  imgEl.style.width = '100%';
                                                  groupEl.style.maxWidth = '100%';
                                                }
                                              }}
                                              onBlur={(e) => {
                                                setWidth(parseInt(e.currentTarget.value));
                                              }}
                                              style={{ width: 64, cursor: 'ew-resize', accentColor: '#3b82f6' }}
                                            />
                                          </div>
                                          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: 2, gap: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                            <button onClick={() => setAlign('left')} style={{ background: imgAlign === 'left' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Esquerda"><AlignLeft size={13} /></button>
                                            <button onClick={() => setAlign('center')} style={{ background: imgAlign === 'center' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Centralizar"><AlignCenter size={13} /></button>
                                            <button onClick={() => setAlign('right')} style={{ background: imgAlign === 'right' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Direita"><AlignRight size={13} /></button>
                                          </div>
                                          <div style={{ position: 'relative' }}>
                                            <button onClick={() => setMainImgMenuOpen(mainImgMenuOpen === `${q.id}-${part.index}` ? null : `${q.id}-${part.index}`)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 14, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)', height: 26 }}>
                                              <ImageIcon size={12} /> Trocar
                                            </button>
                                            {mainImgMenuOpen === `${q.id}-${part.index}` && (
                                              <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 9999, marginBottom: 4, background: 'white', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', border: '1px solid #e2e8f0', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 145 }}>
                                                <button onClick={() => handleMainImageAction(q.id, part.index, 'upload', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 6, textAlign: 'left', fontWeight: 600 }}>
                                                  <Upload size={13} color="#2563eb" /> Fazer Upload
                                                </button>
                                                <button onClick={() => handleMainImageAction(q.id, part.index, 'ai', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 6, textAlign: 'left', fontWeight: 700 }}>
                                                  <Sparkles size={13} /> Gerar com IA
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => {
                                              const metaRegex = /(<meta[^>]+>)/ig;
                                              const metaTags = (q.enunciado || '').match(metaRegex) || [];
                                              const newFullHtml = parts.map((p: any) => {
                                                if (p.type === 'text') return (p.content || '').replace(metaRegex, '');
                                                if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                                if (p.index === part.index) return '';
                                                if (p.index > part.index) return `[IMAGEM ${p.index}]`;
                                                return `[IMAGEM ${p.index + 1}]`;
                                              }).join('');
                                              onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                              onEditEnunciadoImage?.(q.id, part.index, '');
                                              forceRepaginate?.();
                                            }}
                                            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(239,68,68,0.3)' }}
                                            title="Remover Imagem"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                             );
                           })()
                         )
                       ))}
                            </div>
                          );
                        })()}

                        <div style={(() => {
                          const m = (q.enunciado || '').match(/<meta name="alt-cols" content="(\d+)">/i);
                          const cols = m ? parseInt(m[1]) : 1;
                          return cols > 1
                            ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px 16px', marginTop: 4, alignItems: 'start' as const }
                            : (alternativasLayout === 'horizontal' ? { display: 'flex', flexWrap: 'wrap' as const, gap: 24, marginTop: 4 } : { marginTop: 4 });
                        })()}>
                          {(() => {
                            const imgWidths = q.simulados_alternativas
                              ?.filter((a: any) => a.imagem_url)
                              .map((a: any) => {
                                const hashStr = a.imagem_url.indexOf('#') >= 0 ? a.imagem_url.substring(a.imagem_url.indexOf('#') + 1) : '';
                                const params = new URLSearchParams(hashStr);
                                const wStr = params.get('w');
                                return wStr ? parseInt(wStr) : 250;
                              }) || [];
                            const maxImgWidth = imgWidths.length > 0 ? Math.max(...imgWidths) : null;

                            return q.simulados_alternativas?.map((a: any, aIndex: number) => {
                              const totalAlts = q.simulados_alternativas?.length || 0;
                              const hashIndex = a.imagem_url ? a.imagem_url.indexOf('#') : -1;
                              const imgBaseUrl = hashIndex >= 0 ? a.imagem_url.substring(0, hashIndex) : (a.imagem_url || '');
                              const hashStr = hashIndex >= 0 ? a.imagem_url.substring(hashIndex + 1) : '';
                              const params = new URLSearchParams(hashStr);
                              const imgWidthStr = params.get('w');
                              const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                              const imgAlign = params.get('a') || 'left';
                              const justifyContent = imgAlign === 'center' ? 'center' : imgAlign === 'right' ? 'flex-end' : 'flex-start';
                              const effectiveWidth = imgWidth || maxImgWidth;
                              
                              const setAltWidth = (w: number) => {
                                const p = new URLSearchParams(hashStr);
                                p.set('w', w.toString());
                                if (imgAlign !== 'left') p.set('a', imgAlign);
                                onEditAlternativaImage?.(q.id, a.id, `${imgBaseUrl}#${p.toString()}`);
                                forceRepaginate?.();
                              };
                              
                              const altParts = parseEnunciadoParts(a.texto || '', []);
                              const saveAltParts = (newParts: any[]) => {
                                const newTexto = newParts.map((p: any) => {
                                  if (p.type === 'text') return p.content || '';
                                  if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                  return '';
                                }).join('');
                                onEditAlternativa(q.id, a.id, newTexto);
                                forceRepaginate();
                              };

                              return (
                                <div key={a.id || `alt-${aIndex}`} className="alt-row-item" style={{ 
                                  display: 'flex', gap: 12, 
                                  marginTop: 6, 
                                  alignItems: 'flex-start', position: 'relative',
                                  zIndex: reorderMenuOpen === `${q.id}-${a.id}` ? 500 : (imgMenuOpen === `${q.id}-${a.id}` ? 120 : 1)
                                }}>
                                  <div 
                                    className={`reorder-trigger ${a.eh_correta ? 'correct-bubble-preview' : ''}`} 
                                    onClick={!readOnly && onMoveAlternativa ? (e) => {
                                      e.stopPropagation();
                                      setReorderMenuOpen(reorderMenuOpen === `${q.id}-${a.id}` ? null : `${q.id}-${a.id}`);
                                    } : undefined}
                                    title={!readOnly && onMoveAlternativa ? `Alternativa ${a.letra} (clique para reordenar)` : undefined}
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                                      border: reorderMenuOpen === `${q.id}-${a.id}` ? '2px solid #2563eb' : '2px solid #cbd5e1', 
                                      color: reorderMenuOpen === `${q.id}-${a.id}` ? '#2563eb' : '#475569', 
                                      fontWeight: 800, fontSize: '10pt', marginTop: '2px',
                                      cursor: !readOnly && onMoveAlternativa ? 'pointer' : 'default',
                                      background: reorderMenuOpen === `${q.id}-${a.id}` ? '#eff6ff' : undefined,
                                      boxShadow: reorderMenuOpen === `${q.id}-${a.id}` ? '0 0 0 3px rgba(37,99,235,0.2)' : undefined,
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {a.letra}
                                  </div>
                                  {renderReorderPopover(q.id, a.id, a.letra, aIndex, totalAlts, aIndex === 0)}
                                  {renderAlternativeRowToolbar(q.id, q, a, altParts, saveAltParts)}
                                  <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                                     {a.imagem_url && (
                                       <div style={{ display: 'flex', justifyContent, width: '100%', marginBottom: 8 }}>
                                         <div className="alt-img-wrapper img-hover-wrapper" style={{ position: 'relative', width: effectiveWidth ? `${effectiveWidth}px` : 'auto', maxWidth: '100%' }}>
                                           <img src={imgBaseUrl || undefined} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                           {onEditAlternativaImage && !readOnly && (
                                             <div className="no-print img-floating-toolbar" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 20, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                               <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '2px 8px', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', alignItems: 'center' }}>
                                                 {[
                                                   { label: 'P', w: 120 },
                                                   { label: 'M', w: 220 },
                                                   { label: 'G', w: 340 }
                                                 ].map(preset => (
                                                   <button
                                                     key={preset.label}
                                                     type="button"
                                                     onClick={() => setAltWidth(preset.w)}
                                                     style={{
                                                       background: Math.abs((effectiveWidth || 250) - preset.w) < 25 ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                                       color: '#fff',
                                                       border: 'none',
                                                       borderRadius: 5,
                                                       padding: '1px 5px',
                                                       fontSize: 9,
                                                       fontWeight: 800,
                                                       cursor: 'pointer'
                                                     }}
                                                   >
                                                     {preset.label}
                                                   </button>
                                                 ))}
                                                 <input 
                                                   type="range" 
                                                   min="50" 
                                                   max="600" 
                                                   step="5"
                                                   defaultValue={effectiveWidth || 250}
                                                   onMouseDown={(e) => {
                                                     const inputEl = e.currentTarget;
                                                     const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                                     if (menu) {
                                                       const rect = menu.getBoundingClientRect();
                                                       menu.dataset.oldLeft = menu.style.left;
                                                       menu.dataset.oldBottom = menu.style.bottom;
                                                       menu.dataset.oldPosition = menu.style.position;
                                                       menu.style.position = 'fixed';
                                                       menu.style.left = `${rect.left}px`;
                                                       menu.style.top = `${rect.top}px`;
                                                       menu.style.bottom = 'auto';
                                                       menu.style.right = 'auto';
                                                     }
                                                     const handleEnd = () => {
                                                       window.removeEventListener('mouseup', handleEnd);
                                                       if (menu) {
                                                         menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                         menu.style.left = menu.dataset.oldLeft || '4px';
                                                         menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                         menu.style.top = 'auto';
                                                         menu.style.right = 'auto';
                                                       }
                                                       const finalVal = parseInt(inputEl.value);
                                                       setAltWidth(finalVal);
                                                     };
                                                     window.addEventListener('mouseup', handleEnd);
                                                   }}
                                                   onTouchStart={(e) => {
                                                     const inputEl = e.currentTarget;
                                                     const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                                     if (menu) {
                                                       const rect = menu.getBoundingClientRect();
                                                       menu.dataset.oldLeft = menu.style.left;
                                                       menu.dataset.oldBottom = menu.style.bottom;
                                                       menu.dataset.oldPosition = menu.style.position;
                                                       menu.style.position = 'fixed';
                                                       menu.style.left = `${rect.left}px`;
                                                       menu.style.top = `${rect.top}px`;
                                                       menu.style.bottom = 'auto';
                                                       menu.style.right = 'auto';
                                                     }
                                                     const handleEnd = () => {
                                                       window.removeEventListener('touchend', handleEnd);
                                                       if (menu) {
                                                         menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                         menu.style.left = menu.dataset.oldLeft || '4px';
                                                         menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                         menu.style.top = 'auto';
                                                         menu.style.right = 'auto';
                                                       }
                                                       const finalVal = parseInt(inputEl.value);
                                                       setAltWidth(finalVal);
                                                     };
                                                     window.addEventListener('touchend', handleEnd);
                                                   }}
                                                   onChange={(e) => {
                                                     const val = e.currentTarget.value;
                                                     const wrapperEl = e.currentTarget.closest('.alt-img-wrapper') as HTMLElement;
                                                     if (wrapperEl) {
                                                       wrapperEl.style.width = `${val}px`;
                                                       wrapperEl.style.maxWidth = '100%';
                                                       const imgEl = wrapperEl.querySelector('img') as HTMLElement;
                                                       if (imgEl) {
                                                         imgEl.style.width = '100%';
                                                         imgEl.style.maxWidth = '100%';
                                                       }
                                                     }
                                                   }}
                                                   onBlur={(e) => {
                                                     setAltWidth(parseInt(e.currentTarget.value));
                                                   }}
                                                   style={{ width: 65, cursor: 'ew-resize', accentColor: '#3b82f6' }}
                                                 />
                                               </div>
                                              <button
                                                onClick={() => {
                                                  onEditAlternativaImage(q.id, a.id, '');
                                                  forceRepaginate?.();
                                                }}
                                                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
                                                title="Remover Imagem"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  
                                  <div style={{ position: 'relative' }}>
                                      {altParts.map((part: any, pIdx: number) => {
                                        if (part.type === 'text') {
                                          return (
                                            <HtmlContent
                                              key={`alt-text-${a.id}-${pIdx}`}
                                              editable={!readOnly}
                                              html={part.content || ''}
                                              onBlurHtml={(newHtml: string) => {
                                                const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, content: newHtml } : p);
                                                saveAltParts(updated);
                                              }}
                                              style={{ wordBreak: 'break-word', outline: 'none', fontSize: `${alternativasFontSize}px`, cursor: readOnly ? 'default' : 'text' }}
                                            />
                                          );
                                        }
                                        if (part.type === 'lines') {
                                          return (
                                            <div key={`alt-lines-${pIdx}`} className="lines-hover-wrapper" style={{ position: 'relative', width: '100%', marginTop: 4 }}>
                                              {Array.from({ length: part.count }).map((_: any, li: number) => (
                                                <div key={li} style={{ position: 'relative', width: '100%', borderBottom: part.style === 'branco' ? 'none' : '1px solid #000', height: 22 }}>
                                                  {part.style !== 'branco' && (
                                                    <div style={{ position: 'absolute', left: -22, bottom: 0, width: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 4, fontSize: '8pt', color: '#a1a1aa', fontWeight: 500, userSelect: 'none', height: 22 }}>
                                                      {li + 1}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                              {!readOnly && (
                                                <div className="no-print lines-floating-toolbar" style={{ position: 'absolute', right: 4, top: 2, display: 'flex', gap: 4, zIndex: 15, background: 'rgba(255,255,255,0.95)', padding: '2px 5px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                                                  <button onClick={() => { const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, count: Math.max(1, p.count - 1) } : p); saveAltParts(updated); }} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 800 }} title="Remover uma linha">−</button>
                                                  <button onClick={() => { const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, count: p.count + 1 } : p); saveAltParts(updated); }} style={{ background: '#ecfdf5', color: '#059669', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 800 }} title="Adicionar uma linha">+</button>
                                                  <button onClick={() => { const updated = altParts.filter((_: any, i: number) => i !== pIdx); saveAltParts(updated); }} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover bloco de linhas"><Trash2 size={11} /></button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                              </div>
                            </div>
                          )
                          })})()}
                        </div>
                        
                        {q.tipo_questao === 'descritiva' && (block.linhasResposta !== undefined ? block.linhasResposta : 5) > 0 && (
                          block.estiloEspaco === 'pautado' ? (
                            <div style={{ marginTop: 16, width: '100%', display: 'flex', flexDirection: 'column' }}>
                              {Array.from({ length: block.linhasResposta }).map((_, i) => (
                                <div key={i} style={{ position: 'relative', width: '100%', height: 28, borderBottom: '1px solid #000' }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: -38,
                                    bottom: 0,
                                    width: 28,
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'flex-end',
                                    paddingRight: 6,
                                    fontSize: '9pt',
                                    color: '#a1a1aa',
                                    fontWeight: 500,
                                    userSelect: 'none',
                                    height: 28
                                  }}>
                                    {i + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ marginTop: 16, width: '100%', height: (block.linhasResposta * 28) }} />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_descritiva_line') {
                return (
                  <div key={blockKey} style={{ marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10 }}>
                    <div style={{
                      width: '28px',
                      minWidth: '28px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'flex-end',
                      paddingRight: '6px',
                      fontSize: '9pt',
                      color: '#a1a1aa',
                      fontWeight: 500,
                      userSelect: 'none',
                      height: 28
                    }}>
                      {block.estiloEspaco === 'pautado' ? (block.lineIndex + 1) : ''}
                    </div>
                    <div style={{ flex: 1 }}>
                      {block.estiloEspaco === 'pautado' ? (
                        <div style={{ height: 28, borderBottom: '1px solid #000', width: '100%' }} />
                      ) : (
                        <div style={{ height: 28, width: '100%' }} />
                      )}
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_enun_txt') {
                const q = block.q;
                const qNumberLabel = block.qIndex !== null && block.qIndex !== undefined ? block.qIndex + 1 : null;
                return (
                  <div key={blockKey} className={`questao-container ${block.isFirst ? 'questao-hover-block' : ''}`} style={{ position: 'relative', marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {block.isFirst && renderQuestionHoverToolbar(q, qNumberLabel)}

                    {q.tipo_questao === 'texto_apoio' && block.isFirst && (
                      <div className="no-print texto-apoio-badge" style={{
                        position: 'absolute',
                        left: -20,
                        top: '50%',
                        transform: 'translate(-50%, -50%) rotate(-90deg)',
                        transformOrigin: 'center center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px',
                        background: '#8b5cf6',
                        color: '#ffffff',
                        fontWeight: 800,
                        borderRadius: '12px',
                        fontSize: '7.5pt',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
                        zIndex: 20
                      }}>
                        <FileText size={12} color="#ffffff" />
                        Texto de Apoio
                      </div>
                    )}
                    {q.tipo_questao !== 'texto_apoio' && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', minWidth: '28px', background: block.isFirst ? '#1e293b' : 'transparent', color: block.isFirst ? '#ffffff' : 'transparent',
                        fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '2px'
                      }}>
                        {block.isFirst && qNumberLabel !== null ? qNumberLabel : ''}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0, display: 'flow-root' }}>
                      <HtmlContent 
                        editable={!readOnly}
                        html={block.content || ''}
                        onBlurHtml={(newHtml) => {
                          const parts = parseEnunciadoParts(block.q.enunciado, block.q.imagens || []);
                          const metaRegex = /(<meta[^>]+>)/ig;
                          const metaTags = (block.q.enunciado || '').match(metaRegex) || [];
                          
                          const newFullHtml = parts.map((p: any, i: number) => {
                            if (p.type === 'text') {
                               if (i === block.originalIndex) {
                                 if (block.totalChunks && block.totalChunks > 1) {
                                   const existingChunks = splitTextIntoChunks(p.content || '');
                                   const start = block.startChunkIndex ?? block.chunkIndex ?? 0;
                                   const end = block.endChunkIndex ?? block.chunkIndex ?? 0;
                                   const count = Math.max(1, end - start + 1);
                                   existingChunks.splice(start, count, newHtml);
                                   return existingChunks.join('');
                                 }
                                 return newHtml;
                               }
                               return p.content;
                            }
                            if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                            return `[IMAGEM ${p.index + 1}]`;
                          }).join('');
                          
                          onEditEnunciado(block.q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                          forceRepaginate();
                        }}
                        style={{ wordBreak: 'break-word', outline: 'none', cursor: readOnly ? 'default' : 'text' }}
                      />
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_enun_lines_line') {
                const q = block.q;
                const parts = parseEnunciadoParts(q.enunciado, q.imagens || []);
                const qNumberLabel = block.qIndex !== null && block.qIndex !== undefined ? block.qIndex + 1 : null;
                return (
                  <div key={blockKey} className={`lines-hover-wrapper ${block.isFirst ? 'questao-hover-block' : ''}`} style={{ position: 'relative', marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10 }}>
                    {block.isFirst && renderQuestionHoverToolbar(q, qNumberLabel)}
                    <div style={{
                      display: 'flex',
                      alignItems: block.isFirst ? 'center' : 'flex-end',
                      justifyContent: block.isFirst ? 'center' : 'flex-end',
                      width: '28px', height: '28px', minWidth: '28px',
                      background: block.isFirst ? '#1e293b' : 'transparent',
                      color: block.isFirst ? '#ffffff' : '#a1a1aa',
                      fontWeight: block.isFirst ? 900 : 500,
                      borderRadius: block.isFirst ? '8px' : '0px',
                      fontSize: block.isFirst ? '11pt' : '9pt',
                      marginTop: block.isFirst ? '2px' : '0px',
                      paddingRight: block.isFirst ? '0px' : '6px',
                      userSelect: 'none'
                    }}>
                      {block.isFirst ? (qNumberLabel ?? '') : (block.style !== 'branco' ? (block.lineIndex + 1) : '')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                      <div style={{ width: '100%', borderBottom: block.style === 'branco' ? 'none' : '1px solid #000', height: 28 }} />
                      
                      {block.isFirstInGroup && !readOnly && (
                        <div className="no-print lines-floating-toolbar" style={{ position: 'absolute', right: 4, top: 2, display: 'flex', gap: 4, zIndex: 20, background: 'rgba(255,255,255,0.95)', padding: '3px 6px', borderRadius: 20, boxShadow: '0 4px 12px rgba(15,23,42,0.12)', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', padding: '0 4px' }}>{block.count} {block.count === 1 ? 'linha' : 'linhas'}</span>
                          <button onClick={() => {
                              const newFullHtml = parts.map((p: any, i: number) => {
                                if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                if (p.type === 'lines') {
                                  if (i === block.originalIndex) {
                                    return p.style === 'branco' ? `[ESPACO_BRANCO:${Math.max(1, block.count - 1)}]` : `[LINHAS_PAUTADAS:${Math.max(1, block.count - 1)}]`;
                                  }
                                  return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                }
                                return `[IMAGEM ${p.index + 1}]`;
                              }).join('');
                              const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                              onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                              forceRepaginate();
                          }} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800 }} title="Remover uma linha">−</button>
                          <button onClick={() => {
                              const newFullHtml = parts.map((p: any, i: number) => {
                                if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                if (p.type === 'lines') {
                                  if (i === block.originalIndex) {
                                    return p.style === 'branco' ? `[ESPACO_BRANCO:${block.count + 1}]` : `[LINHAS_PAUTADAS:${block.count + 1}]`;
                                  }
                                  return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                }
                                return `[IMAGEM ${p.index + 1}]`;
                              }).join('');
                              const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                              onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                              forceRepaginate();
                          }} style={{ background: '#ecfdf5', color: '#059669', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800 }} title="Adicionar uma linha">+</button>
                          <button onClick={() => {
                              const newFullHtml = parts.filter((p: any, i: number) => i !== block.originalIndex).map((p: any) => {
                                if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                return `[IMAGEM ${p.index + 1}]`;
                              }).join('');
                              const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                              onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                              forceRepaginate();
                          }} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover bloco de linhas"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_img_group') {
                const q = block.q;
                const parts = parseEnunciadoParts(q.enunciado, q.imagens || []);

                return (() => {
                  const firstImg = block.images[0];
                  const firstHashIndex = firstImg.url ? firstImg.url.indexOf('#') : -1;
                  const firstHashStr = firstHashIndex >= 0 ? firstImg.url.substring(firstHashIndex + 1) : '';
                  const firstParams = new URLSearchParams(firstHashStr);
                  const firstAlign = firstParams.get('a') || 'center';
                  const groupJustify = firstAlign === 'left' ? 'flex-start' : firstAlign === 'right' ? 'flex-end' : 'center';

                  return (
                    <div key={blockKey} style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                      <div style={{ width: '28px', minWidth: '28px' }}></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: groupJustify, width: '100%' }}>
                          {block.images.map((part: any) => {
                          const i = part.index;
                          const pIdx = part.originalIndex;
                          const img = part.url || '';
                          const hashIndex = img.indexOf('#');
                          const imgBaseUrl = hashIndex !== -1 ? img.substring(0, hashIndex) : img;
                          const hashStr = hashIndex !== -1 ? img.substring(hashIndex + 1) : '';
                          const params = new URLSearchParams(hashStr);
                          const isSvg = (imgBaseUrl || '').startsWith('data:image/svg') || (imgBaseUrl || '').includes('.svg');
                          const imgWidthStr = params.get('w');
                          const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : (isSvg ? null : 350);
                          const imgAlign = params.get('a') || 'center';
                          const justifyContent = imgAlign === 'left' ? 'flex-start' : imgAlign === 'right' ? 'flex-end' : 'center';
                          const menuKey = `${q.id}-img-${i}`;

                          const setWidth = (w: number) => {
                            const p = new URLSearchParams(hashStr);
                            p.set('w', w.toString());
                            if (imgAlign !== 'center') p.set('a', imgAlign);
                            onEditEnunciadoImage?.(q.id, i, `${imgBaseUrl}#${p.toString()}`);
                            forceRepaginate?.();
                          };
                          
                          const setAlign = (a: string) => {
                            const p = new URLSearchParams(hashStr);
                            if (imgWidthStr) p.set('w', imgWidthStr);
                            p.set('a', a);
                            onEditEnunciadoImage?.(q.id, i, `${imgBaseUrl}#${p.toString()}`);
                            forceRepaginate?.();
                          };
                          
                          const movePart = (direction: 'up' | 'down') => {
                            if (pIdx === -1) return;
                            const metaRegex = /(<meta[^>]+>)/ig;
                            const metaTags = (q.enunciado || '').match(metaRegex) || [];
                            const newParts = [...parts];
                            if (direction === 'up' && pIdx > 0) {
                               const temp = newParts[pIdx - 1];
                               newParts[pIdx - 1] = newParts[pIdx];
                               newParts[pIdx] = temp;
                            } else if (direction === 'down' && pIdx < newParts.length - 1) {
                               const temp = newParts[pIdx + 1];
                               newParts[pIdx + 1] = newParts[pIdx];
                               newParts[pIdx] = temp;
                            } else return;
                            const newFullHtml = newParts.map((p: any) => {
                              if (p.type === 'text') return (p.content || '').replace(metaRegex, '');
                              if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                              return `[IMAGEM ${p.index + 1}]`;
                            }).join('');
                            onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                            forceRepaginate?.();
                          };

                          return (
                            <div key={`img-${i}-${pIdx}`} className="img-hover-wrapper" style={{ position: 'relative', display: 'flex', justifyContent, width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%', margin: isSvg ? '4px auto' : undefined }}>
                              <img src={imgBaseUrl || undefined} style={{ width: imgWidth ? '100%' : 'auto', maxWidth: '100%', maxHeight: isSvg ? '75px' : '220mm', height: 'auto', borderRadius: isSvg ? 0 : 8, display: 'block', objectFit: 'contain' }} />
                              
                              {onEditEnunciadoImage && !readOnly && (
                                <div className="no-print img-floating-toolbar" style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 4, zIndex: 25, flexWrap: 'wrap', maxWidth: 340, justifyContent: 'flex-start' }}>
                                  <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 6px', gap: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', alignItems: 'center' }}>
                                    <button onClick={() => movePart('up')} disabled={pIdx <= 0} style={{ background: 'transparent', color: pIdx <= 0 ? '#475569' : '#f8fafc', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx <= 0 ? 'default' : 'pointer' }} title="Mover para cima"><ArrowUp size={13} /></button>
                                    <button onClick={() => movePart('down')} disabled={pIdx === -1 || pIdx === parts.length - 1} style={{ background: 'transparent', color: pIdx === -1 || pIdx === parts.length - 1 ? '#475569' : '#f8fafc', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx === -1 || pIdx === parts.length - 1 ? 'default' : 'pointer' }} title="Mover para baixo"><ArrowDown size={13} /></button>
                                  </div>
                                  <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 8px', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', alignItems: 'center' }}>
                                    {[
                                      { label: 'P', w: 180 },
                                      { label: 'M', w: 300 },
                                      { label: 'G', w: 450 },
                                      { label: '100%', w: 620 }
                                    ].map(preset => (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => setWidth(preset.w)}
                                        style={{
                                          background: Math.abs((imgWidth || 350) - preset.w) < 25 ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: 6,
                                          padding: '2px 5px',
                                          fontSize: 9.5,
                                          fontWeight: 800,
                                          cursor: 'pointer'
                                        }}
                                        title={`Largura ${preset.label} (${preset.w}px)`}
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                    <input 
                                      type="range" 
                                      min="80" 
                                      max="700" 
                                      step="10"
                                      defaultValue={imgWidth || 350}
                                      onMouseDown={(e) => {
                                        const inputEl = e.currentTarget;
                                        const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                        if (menu) {
                                          const rect = menu.getBoundingClientRect();
                                          menu.dataset.oldLeft = menu.style.left;
                                          menu.dataset.oldBottom = menu.style.bottom;
                                          menu.dataset.oldPosition = menu.style.position;
                                          menu.style.position = 'fixed';
                                          menu.style.left = `${rect.left}px`;
                                          menu.style.top = `${rect.top}px`;
                                          menu.style.bottom = 'auto';
                                          menu.style.right = 'auto';
                                        }
                                        const handleEnd = () => {
                                          window.removeEventListener('mouseup', handleEnd);
                                          if (menu) {
                                            menu.style.position = menu.dataset.oldPosition || 'absolute';
                                            menu.style.left = menu.dataset.oldLeft || '6px';
                                            menu.style.bottom = menu.dataset.oldBottom || '6px';
                                            menu.style.top = 'auto';
                                            menu.style.right = 'auto';
                                          }
                                          setWidth(parseInt(inputEl.value));
                                        };
                                        window.addEventListener('mouseup', handleEnd);
                                      }}
                                      onTouchStart={(e) => {
                                        const inputEl = e.currentTarget;
                                        const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                        if (menu) {
                                          const rect = menu.getBoundingClientRect();
                                          menu.dataset.oldLeft = menu.style.left;
                                          menu.dataset.oldBottom = menu.style.bottom;
                                          menu.dataset.oldPosition = menu.style.position;
                                          menu.style.position = 'fixed';
                                          menu.style.left = `${rect.left}px`;
                                          menu.style.top = `${rect.top}px`;
                                          menu.style.bottom = 'auto';
                                          menu.style.right = 'auto';
                                        }
                                        const handleEnd = () => {
                                          window.removeEventListener('touchend', handleEnd);
                                          if (menu) {
                                            menu.style.position = menu.dataset.oldPosition || 'absolute';
                                            menu.style.left = menu.dataset.oldLeft || '6px';
                                            menu.style.bottom = menu.dataset.oldBottom || '6px';
                                            menu.style.top = 'auto';
                                            menu.style.right = 'auto';
                                          }
                                          setWidth(parseInt(inputEl.value));
                                        };
                                        window.addEventListener('touchend', handleEnd);
                                      }}
                                      onChange={(e) => {
                                        const groupEl = e.currentTarget.closest('.img-hover-wrapper') as HTMLElement;
                                        const imgEl = groupEl?.querySelector('img');
                                        if (groupEl && imgEl) {
                                          groupEl.style.width = `${e.currentTarget.value}px`;
                                          imgEl.style.width = '100%';
                                          groupEl.style.maxWidth = '100%';
                                        }
                                      }}
                                      onBlur={(e) => {
                                        setWidth(parseInt(e.currentTarget.value));
                                      }}
                                      style={{ width: 64, cursor: 'ew-resize', accentColor: '#3b82f6' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: 2, gap: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                                    <button onClick={() => setAlign('left')} style={{ background: imgAlign === 'left' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Esquerda"><AlignLeft size={13} /></button>
                                    <button onClick={() => setAlign('center')} style={{ background: imgAlign === 'center' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Centralizar"><AlignCenter size={13} /></button>
                                    <button onClick={() => setAlign('right')} style={{ background: imgAlign === 'right' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Direita"><AlignRight size={13} /></button>
                                  </div>
                                  <div style={{ position: 'relative' }}>
                                    <button onClick={() => setMainImgMenuOpen(mainImgMenuOpen === menuKey ? null : menuKey)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 14, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)', height: 26 }}>
                                      <ImageIcon size={12} /> Trocar
                                    </button>
                                    {mainImgMenuOpen === menuKey && (
                                      <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 9999, marginBottom: 4, background: 'white', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', border: '1px solid #e2e8f0', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 145 }}>
                                        <button onClick={() => handleMainImageAction(q.id, i, 'upload', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 6, textAlign: 'left', fontWeight: 600 }}><Upload size={13} color="#2563eb" /> Fazer Upload</button>
                                        <button onClick={() => handleMainImageAction(q.id, i, 'ai', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 6, textAlign: 'left', fontWeight: 700 }}><Sparkles size={13} /> Gerar com IA</button>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (pIdx === -1) return;
                                      const metaRegex = /(<meta[^>]+>)/ig;
                                      const metaTags = (q.enunciado || '').match(metaRegex) || [];
                                      const newFullHtml = parts.map((p: any) => {
                                        if (p.type === 'text') return (p.content || '').replace(metaRegex, '');
                                        if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                        if (p.index === i) return '';
                                        if (p.index > i) return `[IMAGEM ${p.index}]`;
                                        return `[IMAGEM ${p.index + 1}]`;
                                      }).join('');
                                      onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                      onEditEnunciadoImage?.(q.id, i, '');
                                      forceRepaginate?.();
                                    }}
                                    style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(239,68,68,0.3)' }}
                                    title="Remover Imagem"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })();
            }

              if (block.type === 'part_alts_container') {
            return (
              <div key={blockKey} style={{ padding: '0 40px', marginTop: block.renderMarginTop, fontSize: `${alternativasFontSize}px` }}>
                {(() => {
                  const mCols = (block.q.enunciado || '').match(/<meta name="alt-cols" content="(\d+)">/i);
                  const qCols = mCols ? parseInt(mCols[1]) : 1;
                  return (
                    <div style={qCols > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${qCols}, 1fr)`, gap: '4px 16px', alignItems: 'start' } : { display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                      {(() => {
                        const imgWidths = block.q.simulados_alternativas
                          ?.filter((a: any) => a.imagem_url)
                          .map((a: any) => {
                            const hashIndex = a.imagem_url.indexOf('#');
                            if (hashIndex >= 0) {
                              const p = new URLSearchParams(a.imagem_url.substring(hashIndex + 1));
                              const w = p.get('w');
                              return w ? parseInt(w) : 250;
                            }
                            return 250;
                          }) || [];
                        const maxImgWidth = imgWidths.length > 0 ? Math.max(...imgWidths) : null;

                        return block.q.simulados_alternativas?.map((a: any, aIndex: number) => {
                          const totalAlts = block.q.simulados_alternativas?.length || 0;
                          const hashIndex = a.imagem_url ? a.imagem_url.indexOf('#') : -1;
                          const imgBaseUrl = hashIndex >= 0 ? a.imagem_url.substring(0, hashIndex) : (a.imagem_url || '');
                          const hashStr = hashIndex >= 0 ? a.imagem_url.substring(hashIndex + 1) : '';
                          const params = new URLSearchParams(hashStr);
                          const imgWidthStr = params.get('w');
                          const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                          const effectiveWidth = imgWidth || maxImgWidth;
                          const qId = block.q.id;

                          const setWidth = (w: number) => {
                            const p = new URLSearchParams(hashStr);
                            p.set('w', w.toString());
                            onEditAlternativaImage?.(qId, a.id, `${imgBaseUrl}#${p.toString()}`);
                            forceRepaginate?.();
                          };

                          const altParts = parseEnunciadoParts(a.texto || '', []);
                          const saveAltParts = (newParts: any[]) => {
                            const newTexto = newParts.map((p: any) => {
                              if (p.type === 'text') return p.content || '';
                              if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                              return '';
                            }).join('');
                            onEditAlternativa(qId, a.id, newTexto);
                            forceRepaginate();
                          };

                          return (
                            <div key={a.id || `alt-${aIndex}`} className="alt-row-item" style={{ 
                              display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative',
                              flex: qCols > 1 ? undefined : (effectiveWidth ? '0 0 auto' : '1 1 200px'),
                              fontSize: `${alternativasFontSize}px`,
                              zIndex: reorderMenuOpen === `${qId}-${a.id}` ? 500 : (imgMenuOpen === `${qId}-${a.id}` ? 120 : 1)
                            }}>
                          <div 
                            className={`reorder-trigger ${a.eh_correta ? 'correct-bubble-preview' : ''}`} 
                            onClick={!readOnly && onMoveAlternativa ? (e) => {
                              e.stopPropagation();
                              setReorderMenuOpen(reorderMenuOpen === `${qId}-${a.id}` ? null : `${qId}-${a.id}`);
                            } : undefined}
                            title={!readOnly && onMoveAlternativa ? `Alternativa ${a.letra} (clique para reordenar)` : undefined}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                              border: reorderMenuOpen === `${qId}-${a.id}` ? '2px solid #2563eb' : '2px solid #cbd5e1', 
                              color: reorderMenuOpen === `${qId}-${a.id}` ? '#2563eb' : '#475569', 
                              fontWeight: 800, fontSize: '10pt', marginTop: '2px',
                              cursor: !readOnly && onMoveAlternativa ? 'pointer' : 'default',
                              background: reorderMenuOpen === `${qId}-${a.id}` ? '#eff6ff' : undefined,
                              boxShadow: reorderMenuOpen === `${qId}-${a.id}` ? '0 0 0 3px rgba(37,99,235,0.2)' : undefined,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {a.letra}
                          </div>
                          {renderReorderPopover(qId, a.id, a.letra, aIndex, totalAlts, aIndex === 0)}
                          {renderAlternativeRowToolbar(qId, block.q, a, altParts, saveAltParts)}
                          <div style={{ flex: 1, position: 'relative', width: effectiveWidth ? `${effectiveWidth}px` : 'auto', minWidth: 0 }}>
                            {a.imagem_url && (
                              <div className="alt-img-wrapper img-hover-wrapper" style={{ position: 'relative', marginBottom: 8, width: '100%', maxWidth: '100%' }}>
                                <img src={imgBaseUrl || undefined} style={{ width: '100%', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                {onEditAlternativaImage && !readOnly && (
                                  <div className="no-print img-floating-toolbar" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 20, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                    <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '2px 8px', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', alignItems: 'center' }}>
                                      {[
                                        { label: 'P', w: 120 },
                                        { label: 'M', w: 220 },
                                        { label: 'G', w: 340 }
                                      ].map(preset => (
                                        <button
                                          key={preset.label}
                                          type="button"
                                          onClick={() => setWidth(preset.w)}
                                          style={{
                                            background: Math.abs((effectiveWidth || 250) - preset.w) < 25 ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 5,
                                            padding: '1px 5px',
                                            fontSize: 9,
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                          }}
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                      <input 
                                        type="range" 
                                        min="50" 
                                        max="600" 
                                        step="5"
                                        defaultValue={effectiveWidth || 250}
                                        onMouseDown={(e) => {
                                          const inputEl = e.currentTarget;
                                          const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                          if (menu) {
                                            const rect = menu.getBoundingClientRect();
                                            menu.dataset.oldLeft = menu.style.left;
                                            menu.dataset.oldBottom = menu.style.bottom;
                                            menu.dataset.oldPosition = menu.style.position;
                                            menu.style.position = 'fixed';
                                            menu.style.left = `${rect.left}px`;
                                            menu.style.top = `${rect.top}px`;
                                            menu.style.bottom = 'auto';
                                            menu.style.right = 'auto';
                                          }
                                          const handleEnd = () => {
                                            window.removeEventListener('mouseup', handleEnd);
                                            if (menu) {
                                              menu.style.position = menu.dataset.oldPosition || 'absolute';
                                              menu.style.left = menu.dataset.oldLeft || '4px';
                                              menu.style.bottom = menu.dataset.oldBottom || '4px';
                                              menu.style.top = 'auto';
                                              menu.style.right = 'auto';
                                            }
                                            const finalVal = parseInt(inputEl.value);
                                            setWidth(finalVal);
                                          };
                                          window.addEventListener('mouseup', handleEnd);
                                        }}
                                        onTouchStart={(e) => {
                                          const inputEl = e.currentTarget;
                                          const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                          if (menu) {
                                            const rect = menu.getBoundingClientRect();
                                            menu.dataset.oldLeft = menu.style.left;
                                            menu.dataset.oldBottom = menu.style.bottom;
                                            menu.dataset.oldPosition = menu.style.position;
                                            menu.style.position = 'fixed';
                                            menu.style.left = `${rect.left}px`;
                                            menu.style.top = `${rect.top}px`;
                                            menu.style.bottom = 'auto';
                                            menu.style.right = 'auto';
                                          }
                                          const handleEnd = () => {
                                            window.removeEventListener('touchend', handleEnd);
                                            if (menu) {
                                              menu.style.position = menu.dataset.oldPosition || 'absolute';
                                              menu.style.left = menu.dataset.oldLeft || '4px';
                                              menu.style.bottom = menu.dataset.oldBottom || '4px';
                                              menu.style.top = 'auto';
                                              menu.style.right = 'auto';
                                            }
                                            const finalVal = parseInt(inputEl.value);
                                            setWidth(finalVal);
                                          };
                                          window.addEventListener('touchend', handleEnd);
                                        }}
                                        onChange={(e) => {
                                          const val = e.currentTarget.value;
                                          const groupEl = e.currentTarget.closest('.alt-row-item') as HTMLElement;
                                          if (groupEl) {
                                            groupEl.style.width = 'auto';
                                            groupEl.style.flex = '0 0 auto';
                                          }
                                          const wrapperEl = e.currentTarget.closest('.alt-img-wrapper') as HTMLElement;
                                          if (wrapperEl) {
                                            wrapperEl.style.width = `${val}px`;
                                            wrapperEl.style.maxWidth = '100%';
                                            const imgEl = wrapperEl.querySelector('img') as HTMLElement;
                                            if (imgEl) {
                                              imgEl.style.width = '100%';
                                              imgEl.style.maxWidth = '100%';
                                            }
                                          }
                                        }}
                                        onBlur={(e) => {
                                          setWidth(parseInt(e.currentTarget.value));
                                        }}
                                        style={{ width: 65, cursor: 'ew-resize', accentColor: '#3b82f6' }}
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        onEditAlternativaImage(qId, a.id, '');
                                        forceRepaginate?.();
                                      }}
                                      style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
                                      title="Remover Imagem"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{ position: 'relative' }}>
                              {altParts.map((part: any, pIdx: number) => {
                                if (part.type === 'text') {
                                  return (
                                    <HtmlContent 
                                      key={`alt-text-${a.id}-${pIdx}`}
                                      editable={!readOnly}
                                      html={part.content || ''}
                                      onBlurHtml={(newHtml) => {
                                        const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, content: newHtml } : p);
                                        saveAltParts(updated);
                                      }}
                                      style={{ wordBreak: 'break-word', outline: 'none', cursor: readOnly ? 'default' : 'text' }}
                                    />
                                  );
                                }
                                if (part.type === 'lines') {
                                  return (
                                    <div key={`alt-lines-${pIdx}`} className="lines-hover-wrapper" style={{ position: 'relative', width: '100%', marginTop: 4 }}>
                                      {Array.from({ length: part.count }).map((_: any, li: number) => (
                                        <div key={li} style={{ position: 'relative', width: '100%', borderBottom: part.style === 'branco' ? 'none' : '1px solid #000', height: 22 }}>
                                          {part.style !== 'branco' && (
                                            <div style={{ position: 'absolute', left: -22, bottom: 0, width: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 4, fontSize: '8pt', color: '#a1a1aa', fontWeight: 500, userSelect: 'none', height: 22 }}>
                                              {li + 1}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {!readOnly && (
                                        <div className="no-print lines-floating-toolbar" style={{ position: 'absolute', right: 4, top: 2, display: 'flex', gap: 4, zIndex: 15, background: 'rgba(255,255,255,0.95)', padding: '2px 5px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                                          <button onClick={() => { const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, count: Math.max(1, p.count - 1) } : p); saveAltParts(updated); }} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 800 }} title="Remover uma linha">−</button>
                                          <button onClick={() => { const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, count: p.count + 1 } : p); saveAltParts(updated); }} style={{ background: '#ecfdf5', color: '#059669', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 800 }} title="Adicionar uma linha">+</button>
                                          <button onClick={() => { const updated = altParts.filter((_: any, i: number) => i !== pIdx); saveAltParts(updated); }} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover bloco de linhas"><Trash2 size={11} /></button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              );
            })()}
          </div>
        );
      }

          if (block.type === 'part_alt') {
                const q = block.q;
                const a = block.alt;
                const alts = q.simulados_alternativas || [];
                let aIndex = alts.findIndex((item: any) => item.id === a.id);
                if (aIndex === -1 && a.letra) {
                  aIndex = alts.findIndex((item: any) => item.letra === a.letra || item.letter === a.letra);
                }
                const totalAlts = alts.length;
                const altParts = parseEnunciadoParts(a.texto || '', []);
                const saveAltParts = (newParts: any[]) => {
                  const newTexto = newParts.map((p: any) => {
                    if (p.type === 'text') return p.content || '';
                    if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                    return '';
                  }).join('');
                  onEditAlternativa(q.id, a.id, newTexto);
                  forceRepaginate();
                };
                return (
                  <div key={blockKey} style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0, fontSize: `${alternativasFontSize}px` }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
                    <div className="alt-row-item" style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative', zIndex: reorderMenuOpen === `${q.id}-${a.id}` ? 500 : (imgMenuOpen === `${q.id}-${a.id}` ? 120 : 1) }}>
                      <div 
                        className={`reorder-trigger ${a.eh_correta ? 'correct-bubble-preview' : ''}`} 
                        onClick={!readOnly && onMoveAlternativa ? (e) => {
                          e.stopPropagation();
                          setReorderMenuOpen(reorderMenuOpen === `${q.id}-${a.id}` ? null : `${q.id}-${a.id}`);
                        } : undefined}
                        title={!readOnly && onMoveAlternativa ? `Alternativa ${a.letra} (clique para reordenar)` : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                          border: reorderMenuOpen === `${q.id}-${a.id}` ? '2px solid #2563eb' : '2px solid #cbd5e1', 
                          color: reorderMenuOpen === `${q.id}-${a.id}` ? '#2563eb' : '#475569', 
                          fontWeight: 800, fontSize: '10pt', marginTop: '2px',
                          cursor: !readOnly && onMoveAlternativa ? 'pointer' : 'default',
                          background: reorderMenuOpen === `${q.id}-${a.id}` ? '#eff6ff' : undefined,
                          boxShadow: reorderMenuOpen === `${q.id}-${a.id}` ? '0 0 0 3px rgba(37,99,235,0.2)' : undefined,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {a.letra}
                      </div>
                      {renderReorderPopover(q.id, a.id, a.letra, aIndex, totalAlts, aIndex === 0)}
                      {renderAlternativeRowToolbar(q.id, q, a, altParts, saveAltParts)}
                      <div style={{ flex: 1, position: 'relative' }}>
                        {(() => {
                          const imgWidths = q.simulados_alternativas
                            ?.filter((altInfo: any) => altInfo.imagem_url)
                            .map((altInfo: any) => {
                              const hashStr = altInfo.imagem_url.indexOf('#') >= 0 ? altInfo.imagem_url.substring(altInfo.imagem_url.indexOf('#') + 1) : '';
                              const params = new URLSearchParams(hashStr);
                              const wStr = params.get('w');
                              return wStr ? parseInt(wStr) : 250;
                            }) || [];
                          const maxImgWidth = imgWidths.length > 0 ? Math.max(...imgWidths) : null;
                          
                          const hashIndex = a.imagem_url ? a.imagem_url.indexOf('#') : -1;
                          const imgBaseUrl = hashIndex >= 0 ? a.imagem_url.substring(0, hashIndex) : (a.imagem_url || '');
                          const hashStr = hashIndex >= 0 ? a.imagem_url.substring(hashIndex + 1) : '';
                          const params = new URLSearchParams(hashStr);
                          const imgWidthStr = params.get('w');
                          const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                          const effectiveWidth = imgWidth || maxImgWidth;

                          const setAltWidth = (w: number) => {
                            const p = new URLSearchParams(hashStr);
                            p.set('w', w.toString());
                            onEditAlternativaImage?.(q.id, a.id, `${imgBaseUrl}#${p.toString()}`);
                            forceRepaginate?.();
                          };

                          return (
                            <div style={{ width: '100%', minWidth: 0 }}>
                              {a.imagem_url && (
                                <div className="alt-img-wrapper img-hover-wrapper" style={{ position: 'relative', marginBottom: 8, width: effectiveWidth ? `${effectiveWidth}px` : 'auto', maxWidth: '100%' }}>
                                  <img src={imgBaseUrl || undefined} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                  {onEditAlternativaImage && !readOnly && (
                                    <div className="no-print img-floating-toolbar" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 20, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                      <div style={{ display: 'flex', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '2px 8px', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', alignItems: 'center' }}>
                                        {[
                                          { label: 'P', w: 120 },
                                          { label: 'M', w: 220 },
                                          { label: 'G', w: 340 }
                                        ].map(preset => (
                                          <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => setAltWidth(preset.w)}
                                            style={{
                                              background: Math.abs((effectiveWidth || 250) - preset.w) < 25 ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: 5,
                                              padding: '1px 5px',
                                              fontSize: 9,
                                              fontWeight: 800,
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {preset.label}
                                          </button>
                                        ))}
                                        <input 
                                          type="range" 
                                          min="50" 
                                          max="600" 
                                          step="5"
                                          defaultValue={effectiveWidth || 250}
                                          onMouseDown={(e) => {
                                            const inputEl = e.currentTarget;
                                            const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                            if (menu) {
                                              const rect = menu.getBoundingClientRect();
                                              menu.dataset.oldLeft = menu.style.left;
                                              menu.dataset.oldBottom = menu.style.bottom;
                                              menu.dataset.oldPosition = menu.style.position;
                                              menu.style.position = 'fixed';
                                              menu.style.left = `${rect.left}px`;
                                              menu.style.top = `${rect.top}px`;
                                              menu.style.bottom = 'auto';
                                              menu.style.right = 'auto';
                                            }
                                            const handleEnd = () => {
                                              window.removeEventListener('mouseup', handleEnd);
                                              if (menu) {
                                                menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                menu.style.left = menu.dataset.oldLeft || '4px';
                                                menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                menu.style.top = 'auto';
                                                menu.style.right = 'auto';
                                              }
                                              const finalVal = parseInt(inputEl.value);
                                              setAltWidth(finalVal);
                                            };
                                            window.addEventListener('mouseup', handleEnd);
                                          }}
                                          onTouchStart={(e) => {
                                            const inputEl = e.currentTarget;
                                            const menu = inputEl.closest('.img-floating-toolbar') as HTMLElement;
                                            if (menu) {
                                              const rect = menu.getBoundingClientRect();
                                              menu.dataset.oldLeft = menu.style.left;
                                              menu.dataset.oldBottom = menu.style.bottom;
                                              menu.dataset.oldPosition = menu.style.position;
                                              menu.style.position = 'fixed';
                                              menu.style.left = `${rect.left}px`;
                                              menu.style.top = `${rect.top}px`;
                                              menu.style.bottom = 'auto';
                                              menu.style.right = 'auto';
                                            }
                                            const handleEnd = () => {
                                              window.removeEventListener('touchend', handleEnd);
                                              if (menu) {
                                                menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                menu.style.left = menu.dataset.oldLeft || '4px';
                                                menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                menu.style.top = 'auto';
                                                menu.style.right = 'auto';
                                              }
                                              const finalVal = parseInt(inputEl.value);
                                              setAltWidth(finalVal);
                                            };
                                            window.addEventListener('touchend', handleEnd);
                                          }}
                                          onChange={(e) => {
                                            const val = e.currentTarget.value;
                                            const wrapperEl = e.currentTarget.closest('.alt-img-wrapper') as HTMLElement;
                                            if (wrapperEl) {
                                              wrapperEl.style.width = `${val}px`;
                                              wrapperEl.style.maxWidth = '100%';
                                              const imgEl = wrapperEl.querySelector('img') as HTMLElement;
                                              if (imgEl) {
                                                imgEl.style.width = '100%';
                                                imgEl.style.maxWidth = '100%';
                                              }
                                            }
                                          }}
                                          onBlur={(e) => {
                                            setAltWidth(parseInt(e.currentTarget.value));
                                          }}
                                          style={{ width: 65, cursor: 'ew-resize', accentColor: '#3b82f6' }}
                                        />
                                      </div>
                                      <button
                                        onClick={() => {
                                          onEditAlternativaImage(q.id, a.id, '');
                                          forceRepaginate?.();
                                        }}
                                        style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
                                        title="Remover Imagem"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div style={{ position: 'relative' }}>
                                {altParts.map((part: any, pIdx: number) => {
                                  if (part.type === 'text') {
                                    return (
                                      <HtmlContent 
                                        key={`alt-text-${a.id}-${pIdx}`}
                                        editable={!readOnly}
                                        html={part.content || ''}
                                        onBlurHtml={(newHtml) => {
                                          const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, content: newHtml } : p);
                                          saveAltParts(updated);
                                        }}
                                        style={{ outline: 'none', wordBreak: 'break-word', cursor: readOnly ? 'default' : 'text', fontSize: `${alternativasFontSize}px` }}
                                      />
                                    );
                                  }
                                  if (part.type === 'lines') {
                                    return (
                                      <div key={`alt-lines-${pIdx}`} className="lines-hover-wrapper" style={{ position: 'relative', width: '100%', marginTop: 4 }}>
                                        {Array.from({ length: part.count }).map((_: any, li: number) => (
                                          <div key={li} style={{ position: 'relative', width: '100%', borderBottom: part.style === 'branco' ? 'none' : '1px solid #000', height: 22 }}>
                                            {part.style !== 'branco' && (
                                              <div style={{ position: 'absolute', left: -22, bottom: 0, width: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 4, fontSize: '8pt', color: '#a1a1aa', fontWeight: 500, userSelect: 'none', height: 22 }}>
                                                {li + 1}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                        {!readOnly && (
                                          <div className="no-print lines-floating-toolbar" style={{ position: 'absolute', right: 4, top: 2, display: 'flex', gap: 4, zIndex: 15, background: 'rgba(255,255,255,0.95)', padding: '2px 5px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                                            <button onClick={() => { const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, count: Math.max(1, p.count - 1) } : p); saveAltParts(updated); }} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 800 }} title="Remover uma linha">−</button>
                                            <button onClick={() => { const updated = altParts.map((p: any, i: number) => i === pIdx ? { ...p, count: p.count + 1 } : p); saveAltParts(updated); }} style={{ background: '#ecfdf5', color: '#059669', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 800 }} title="Adicionar uma linha">+</button>
                                            <button onClick={() => { const updated = altParts.filter((_: any, i: number) => i !== pIdx); saveAltParts(updated); }} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover bloco de linhas"><Trash2 size={11} /></button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Subtle On-Screen Page Badge */}
      <div
        className="no-print"
        style={{
          position: 'absolute',
          bottom: 10,
          right: 16,
          padding: '3px 10px',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.06)',
          color: '#64748b',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 5
        }}
      >
        Página {pIndex + 1} {totalPages ? `de ${totalPages}` : ''}
      </div>
      
      {showMargins && !cleanPreviewMode && (onPageMarginChange || onTopMarginOffsetChange) && (() => {
        const MM = 3.7795275591;
        const baseTopMm = pIndex === 0 ? 75 : 18;
        const guideTop = baseTopMm * MM + effectiveTop;
        return (
          <div
            className="no-print margin-guide-handle"
            style={{
              position: 'absolute',
              top: guideTop - 8,
              left: 0, right: 0, height: 16, cursor: 'ns-resize', zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const handleEl = e.currentTarget;
              handleEl.classList.add('is-dragging');
              const startY = e.clientY;
              const startOffset = effectiveTop;
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const newVal = Math.max(-60, Math.min(80, startOffset + deltaY));
                if (onPageMarginChange) {
                  onPageMarginChange(pIndex, { top: newVal });
                } else if (onTopMarginOffsetChange) {
                  onTopMarginOffsetChange(newVal);
                }
              };
              const handleMouseUp = () => {
                handleEl.classList.remove('is-dragging');
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="margin-guide-line-bar" style={{ width: '100%', height: 0, borderBottom: '1px dashed rgba(59, 130, 246, 0.55)', pointerEvents: 'none' }} />
            <div className="margin-guide-badge" style={{ position: 'absolute', background: '#1e293b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, right: 12, top: -18, pointerEvents: 'none', zIndex: 60, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              Topo Pág. {pIndex + 1} ({effectiveTop >= 0 ? `+${effectiveTop.toFixed(0)}` : effectiveTop.toFixed(0)}px)
            </div>
          </div>
        );
      })()}

      {showMargins && !cleanPreviewMode && (onPageMarginChange || onBottomMarginOffsetChange) && (() => {
        const MM = 3.7795275591;
        const guideBottom = 42 * MM + effectiveBottom;
        return (
          <div
            className="no-print margin-guide-handle"
            style={{
              position: 'absolute',
              bottom: guideBottom - 8,
              left: 0, right: 0, height: 16, cursor: 'ns-resize', zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const handleEl = e.currentTarget;
              handleEl.classList.add('is-dragging');
              const startY = e.clientY;
              const startOffset = effectiveBottom;
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const newVal = Math.max(-150, Math.min(0, startOffset - deltaY));
                if (onPageMarginChange) {
                  onPageMarginChange(pIndex, { bottom: newVal });
                } else if (onBottomMarginOffsetChange) {
                  onBottomMarginOffsetChange(newVal);
                }
              };
              const handleMouseUp = () => {
                handleEl.classList.remove('is-dragging');
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="margin-guide-line-bar" style={{ width: '100%', height: 0, borderBottom: '1px dashed rgba(59, 130, 246, 0.55)', pointerEvents: 'none' }} />
            <div className="margin-guide-badge" style={{ position: 'absolute', background: '#1e293b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, right: 12, bottom: -18, pointerEvents: 'none', zIndex: 60, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              Rodapé Pág. {pIndex + 1} ({effectiveBottom >= 0 ? `+${effectiveBottom.toFixed(0)}` : effectiveBottom.toFixed(0)}px)
            </div>
          </div>
        );
      })()}

      {showMargins && !cleanPreviewMode && (onPageMarginChange || onLeftMarginOffsetChange) && (() => {
        const MM = 3.7795275591;
        const guideLeft = 18 * MM + effectiveLeft;
        return (
          <div
            className="no-print margin-guide-handle"
            style={{
              position: 'absolute',
              left: guideLeft - 8,
              top: 0, bottom: 0, width: 16, cursor: 'ew-resize', zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const handleEl = e.currentTarget;
              handleEl.classList.add('is-dragging');
              const startX = e.clientX;
              const startOffset = effectiveLeft;
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const newVal = Math.max(-60, Math.min(60, startOffset + deltaX));
                if (onPageMarginChange) {
                  onPageMarginChange(pIndex, { left: newVal });
                } else if (onLeftMarginOffsetChange) {
                  onLeftMarginOffsetChange(newVal);
                }
              };
              const handleMouseUp = () => {
                handleEl.classList.remove('is-dragging');
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="margin-guide-line-bar" style={{ width: 0, height: '100%', borderRight: '1px dashed rgba(59, 130, 246, 0.45)', pointerEvents: 'none' }} />
            <div className="margin-guide-badge" style={{ position: 'absolute', background: '#1e293b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, top: 24, left: 12, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 60, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              Esq. Pág. {pIndex + 1} ({effectiveLeft >= 0 ? `+${effectiveLeft.toFixed(0)}` : effectiveLeft.toFixed(0)}px)
            </div>
          </div>
        );
      })()}

      {showMargins && !cleanPreviewMode && (onPageMarginChange || onRightMarginOffsetChange) && (() => {
        const MM = 3.7795275591;
        const guideRight = 18 * MM + effectiveRight;
        return (
          <div
            className="no-print margin-guide-handle"
            style={{
              position: 'absolute',
              right: guideRight - 8,
              top: 0, bottom: 0, width: 16, cursor: 'ew-resize', zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const handleEl = e.currentTarget;
              handleEl.classList.add('is-dragging');
              const startX = e.clientX;
              const startOffset = effectiveRight;
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const newVal = Math.max(-60, Math.min(60, startOffset - deltaX));
                if (onPageMarginChange) {
                  onPageMarginChange(pIndex, { right: newVal });
                } else if (onRightMarginOffsetChange) {
                  onRightMarginOffsetChange(newVal);
                }
              };
              const handleMouseUp = () => {
                handleEl.classList.remove('is-dragging');
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="margin-guide-line-bar" style={{ width: 0, height: '100%', borderLeft: '1px dashed rgba(59, 130, 246, 0.45)', pointerEvents: 'none' }} />
            <div className="margin-guide-badge" style={{ position: 'absolute', background: '#1e293b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, top: 24, right: 12, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 60, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              Dir. Pág. {pIndex + 1} ({effectiveRight >= 0 ? `+${effectiveRight.toFixed(0)}` : effectiveRight.toFixed(0)}px)
            </div>
          </div>
        );
      })()}


      {isGenerating && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px 40px', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {isGenerating === 'ai' ? (
              <>
                <Sparkles size={32} color="#8b5cf6" className="animate-pulse" />
                <span style={{ fontWeight: 700, color: '#334155' }}>Gerando imagem ilustrativa...</span>
              </>
            ) : (
              <>
                <Upload size={32} color="#3b82f6" className="animate-bounce" />
                <span style={{ fontWeight: 700, color: '#334155' }}>Enviando imagem...</span>
              </>
            )}
          </div>
        </div>
      )}

      {linesModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 16, width: 380 }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Adicionar Espaço / Linhas</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Escolha o tipo e a quantidade de linhas que deseja adicionar ao final desta questão.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Tipo:</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.95rem', color: '#475569' }}>
                  <input type="radio" name="linesType" checked={linesType === 'pautado'} onChange={() => setLinesType('pautado')} />
                  Linhas Pautadas
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.95rem', color: '#475569' }}>
                  <input type="radio" name="linesType" checked={linesType === 'branco'} onChange={() => setLinesType('branco')} />
                  Espaço em Branco
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Quantidade:</label>
              <input 
                type="number" 
                min={1} 
                max={50}
                value={linesCount}
                onChange={e => setLinesCount(parseInt(e.target.value) || 1)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }} 
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const q = linesModalOpen.q;
                    if (!q) { setLinesModalOpen(null); return; }
                    const newFullHtml = linesModalOpen.parts.map((p: any) => {
                      if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                      if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                      return `[IMAGEM ${p.index + 1}]`;
                    }).join('') + (linesType === 'branco' ? `[ESPACO_BRANCO:${linesCount}]` : `[LINHAS_PAUTADAS:${linesCount}]`);
                    const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                    onEditEnunciado(linesModalOpen.qId, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                    forceRepaginate();
                    setLinesModalOpen(null);
                  }
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <button 
                onClick={() => setLinesModalOpen(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const q = linesModalOpen.q;
                  if (!q) { setLinesModalOpen(null); return; }
                  const newFullHtml = linesModalOpen.parts.map((p: any) => {
                    if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                    if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                    return `[IMAGEM ${p.index + 1}]`;
                  }).join('') + (linesType === 'branco' ? `[ESPACO_BRANCO:${linesCount}]` : `[LINHAS_PAUTADAS:${linesCount}]`);
                  const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                  onEditEnunciado(linesModalOpen.qId, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                  forceRepaginate();
                  setLinesModalOpen(null);
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alt Lines Modal */}
      {altLinesModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setAltLinesModalOpen(null)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 380, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter') {
              const { qId, altId, altParts } = altLinesModalOpen;
              const newParts = [...altParts, { type: 'lines', count: altLinesCount, style: altLinesType }];
              const newTexto = newParts.map((p: any) => { if (p.type === 'text') return p.content || ''; if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`; return ''; }).join('');
              onEditAlternativa(qId, altId, newTexto);
              forceRepaginate();
              setAltLinesModalOpen(null);
            }}}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={18} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Linhas na Alternativa {altLinesModalOpen.a?.letra}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Escolha o tipo e a quantidade</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {(['pautado', 'branco'] as const).map(type => (
                <button key={type} onClick={() => setAltLinesType(type)} style={{ flex: 1, padding: '12px 8px', borderRadius: 12, border: altLinesType === type ? 'none' : '1.5px solid #e2e8f0', background: altLinesType === type ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f8fafc', color: altLinesType === type ? 'white' : '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {type === 'pautado' ? '📝 Linhas Pautadas' : '⬜ Espaço em Branco'}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Quantidade de linhas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map(n => (
                  <button key={n} onClick={() => setAltLinesCount(n)} style={{ width: 36, height: 36, borderRadius: 8, border: altLinesCount === n ? 'none' : '1px solid #e2e8f0', background: altLinesCount === n ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f8fafc', color: altLinesCount === n ? 'white' : '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
              <input type="number" min={1} max={50} value={altLinesCount} onChange={e => setAltLinesCount(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, fontWeight: 600, outline: 'none', textAlign: 'center' }} />
            </div>
            <div style={{ marginBottom: 20, padding: 12, background: '#f8fafc', borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Pré-visualização</div>
              {Array.from({ length: Math.min(5, altLinesCount) }).map((_, i) => (
                <div key={i} style={{ height: 20, borderBottom: altLinesType === 'branco' ? 'none' : '1px solid #000', marginBottom: 2 }} />
              ))}
              {altLinesCount > 5 && <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>+ {altLinesCount - 5} linhas</div>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAltLinesModalOpen(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => {
                const { qId, altId, altParts } = altLinesModalOpen!;
                const newParts = [...altParts, { type: 'lines', count: altLinesCount, style: altLinesType }];
                const newTexto = newParts.map((p: any) => { if (p.type === 'text') return p.content || ''; if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`; return ''; }).join('');
                onEditAlternativa(qId, altId, newTexto);
                forceRepaginate();
                setAltLinesModalOpen(null);
              }} style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
