import React from 'react';
import { X, BookOpen, ImageIcon, Sparkles, Upload, Trash2, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { HtmlContent } from '../HtmlContent';
import { DraggableHeaderField } from './DraggableHeaderField';
import { parseEnunciadoParts } from './PaginationEngine';

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
  topMarginOffset = 0, onTopMarginOffsetChange,
  bottomMarginOffset = 0, onBottomMarginOffsetChange,
  leftMarginOffset = 0, onLeftMarginOffsetChange,
  rightMarginOffset = 0, onRightMarginOffsetChange,
  readOnly = false
}: any) {
  const [imgMenuOpen, setImgMenuOpen] = useState<string | null>(null);
  const [mainImgMenuOpen, setMainImgMenuOpen] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [linesCount, setLinesCount] = useState<number>(5);
  const [linesType, setLinesType] = useState<'pautado' | 'branco'>('pautado');
  const [linesModalOpen, setLinesModalOpen] = useState<{qId: string, parts: any[], defaultCount: number, q: any} | null>(null);

  const handleMainImageAction = async (qId: string, imgIndex: number, action: 'upload' | 'ai', altText: string) => {
    setMainImgMenuOpen(null);
    if (!onEditEnunciadoImage) return;

    if (action === 'ai') {
      setIsGenerating(true);
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
      setIsGenerating(false);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as any).files[0];
        if (!file) return;
        setIsGenerating(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/upload-midia', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) onEditEnunciadoImage(qId, imgIndex, `${data.url}#w=350`);
        } catch (err) {
          console.error(err);
        }
        setIsGenerating(false);
      };
      input.click();
    }
  };

  const handleImageAction = async (qId: string, altId: string, action: 'upload' | 'ai', altText: string) => {
    setImgMenuOpen(null);
    if (!onEditAlternativaImage) return;

    if (action === 'ai') {
      setIsGenerating(true);
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
      setIsGenerating(false);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as any).files[0];
        if (!file) return;
        setIsGenerating(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/upload-midia', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) onEditAlternativaImage(qId, altId, data.url);
        } catch (err) {
          console.error(err);
        }
        setIsGenerating(false);
      };
      input.click();
    }
  };
  return (
    <>
      <style>{`
        @media screen {
          .correct-bubble-preview {
            background-color: #22c55e !important;
            color: #ffffff !important;
            border-color: #22c55e !important;
          }
          
          .alt-hover-group .alt-img-actions {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
          }
          .alt-hover-group:hover .alt-img-actions {
            opacity: 1;
            pointer-events: auto;
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

        :global(.a4-page-content img) {
          max-width: 100% !important;
          height: auto !important;
          object-fit: contain;
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
          .field-label-tag {
            display: none !important;
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
      {pIndex === 0 && (simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_url : (simulado?.isProva ? config?.provas_modelo_pdf_url : config?.modelo_pdf_url)) && (
        <div className="print-cover-image" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img src={(simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_url : (simulado?.isProva ? config.provas_modelo_pdf_url : config.modelo_pdf_url)) || undefined} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}
      {pIndex > 0 && (simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_outras_paginas_url : (simulado?.isProva ? config?.provas_modelo_pdf_outras_paginas_url : config?.modelo_pdf_outras_paginas_url)) && (
        <div className="print-repeating-bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img src={(simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_outras_paginas_url : (simulado?.isProva ? config.provas_modelo_pdf_outras_paginas_url : config.modelo_pdf_outras_paginas_url)) || undefined} alt="Fundo Interna" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}

      {pIndex === 0 && (simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_url : (simulado?.isProva ? config?.provas_modelo_pdf_url : config?.modelo_pdf_url)) && (
        <>
          {simulado?.isProva || simulado?.isRedacao ? (
            <div className="template-fields" ref={pageA4Ref} style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: isEditHeaderMode ? 'auto' : 'none' }}>
              {headerLayout && Object.keys(headerLayout).map((key) => {
                const field = headerLayout[key];
                // Injetar o valor dinâmico baseado na chave
                let value = '';
                if (key === 'title') value = simulado?.titulo || '';
                else if (key === 'disciplina') value = simulado?.formattedDisciplinas || '';
                else if (key === 'professor') value = simulado?.formattedProfessors || '';
                else if (key === 'data') value = simulado?.formattedDate || '';
                else if (key === 'turma') value = simulado?.formattedSeries || '';
                else if (key === 'valor') value = simulado?.valor || '';
                else if (key === 'nota') value = ''; // Nota fica em branco para o professor preencher à mão
                else if (key === 'orientacoes') value = simulado?.instrucoes || '';

                return (
                  <DraggableHeaderField
                    key={key}
                    fieldKey={key}
                    field={{ ...field, value }}
                    isEditMode={isEditHeaderMode}
                    onChange={onUpdateHeaderField}
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
            </div>
          )}
        </>
      )}

      <div style={{ 
        position: 'relative', 
        paddingTop: pIndex === 0 ? `calc(75mm + ${topMarginOffset}px)` : `calc(18mm + ${topMarginOffset}px)`, 
        paddingLeft: `calc(18mm + ${leftMarginOffset}px)`, 
        paddingRight: `calc(18mm + ${rightMarginOffset}px)`, 
        paddingBottom: `calc(42mm + ${bottomMarginOffset}px)`,
        height: '100%', boxSizing: 'border-box',
        zIndex: 2,
        display: 'flex',
        gap: 0
      }}>
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
              lineHeight: 1.6, 
              color: '#000', 
              textAlign: 'justify',
              paddingLeft: cIndex > 0 ? '6mm' : 0,
              paddingRight: cIndex < page.length - 1 ? '6mm' : 0
            }}>
            {col.map((block: any, bIndex: number) => {
              
              if (block.type === 'part_disciplina') {
                return (
                  <div 
                    key={`b-${bIndex}`}
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
                return (
                  <div key={`b-${bIndex}`} className="questao-container alt-hover-group" style={{ position: 'relative', marginTop: block.renderMarginTop || 0, breakInside: 'avoid' }}>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                        fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                      }}>
                        {block.qIndex + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {q.enunciado?.includes('<meta name="gerado_por_ia" content="true">') && (
                          <div className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(139,92,246,0.1))', border: '1px solid rgba(217,70,239,0.2)', color: '#d946ef', padding: '4px 10px', borderRadius: 100, fontSize: 10, fontWeight: 900, letterSpacing: '0.05em', marginBottom: 8 }}>
                            <Sparkles size={12} /> GERADO POR IA
                          </div>
                        )}
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
                            <div className="alt-hover-group" style={{ position: 'relative' }}>
                              {groupedParts.map((group: any, gIdx: number) => (
                                group.type === 'text' ? (
                              <div key={`txt-${group.originalIndex}`} data-height-id={`${q.id}-enun-txt-${group.originalIndex}`} className="alt-hover-group" style={{ position: 'relative', width: '100%', marginTop: gIdx > 0 ? 8 : 0 }}>
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
                                      if (p.type === 'lines') return `[LINHAS_PAUTADAS:${p.count}]`;
                                      return `[IMAGEM ${p.index + 1}]`;
                                    }).join('');
                                    
                                    onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                    forceRepaginate();
                                  }}
                                  style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                                />
                              </div>
                            ) : group.type === 'lines' ? (
                               <div key={`lines-${group.originalIndex}`} className="alt-hover-group" style={{ position: 'relative', marginTop: gIdx > 0 ? 8 : 0, width: '100%' }}>
                                 {Array.from({ length: group.count }).map((_, i) => (
                                   <div key={i} style={{ width: '100%', borderBottom: group.style === 'branco' ? 'none' : '1px solid #000', height: 28 }} />
                                 ))}
                                 <div className="alt-actions" style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: 4 }}>
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
                                   }} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Remover uma linha">-</button>
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
                                   }} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Adicionar uma linha">+</button>
                                   <button onClick={() => {
                                       const newFullHtml = parts.filter((p: any, i: number) => i !== group.originalIndex).map((p: any) => {
                                         if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                         if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                         return `[IMAGEM ${p.index + 1}]`;
                                       }).join('');
                                       const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                                       onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                                       forceRepaginate();
                                   }} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Remover bloco de linhas"><Trash2 size={14} /></button>
                                 </div>
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
                                  <div key={`img-group-${gIdx}`} data-height-id={`${q.id}-img-group-${gIdx}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: groupJustify, marginTop: 0, width: '100%' }}>
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
                                  };

                                  const setAlign = (a: string) => {
                                    const p = new URLSearchParams(hashStr);
                                    if (imgWidthStr) p.set('w', imgWidthStr);
                                    p.set('a', a);
                                    onEditEnunciadoImage?.(q.id, part.index, `${imgBaseUrl}#${p.toString()}`);
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
                                  };

                                  return (
                                    <div key={`img-${part.index}-${pIdx}`} className="alt-hover-group" style={{ position: 'relative', display: 'flex', justifyContent, width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%' }}>
                                      <img src={imgBaseUrl || undefined} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                      {onEditEnunciadoImage && !readOnly && (
                                        <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 10, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 4, gap: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                            <button onClick={() => movePart('up')} disabled={pIdx === 0} style={{ background: 'transparent', color: pIdx === 0 ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx === 0 ? 'default' : 'pointer' }} title="Mover para cima"><ArrowUp size={14} /></button>
                                            <button onClick={() => movePart('down')} disabled={pIdx === parts.length - 1} style={{ background: 'transparent', color: pIdx === parts.length - 1 ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx === parts.length - 1 ? 'default' : 'pointer' }} title="Mover para baixo"><ArrowDown size={14} /></button>
                                          </div>
                                          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '2px 8px', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>TAMANHO</span>
                                            <input 
                                              type="range" 
                                              min="100" 
                                              max="800" 
                                              step="10"
                                              defaultValue={imgWidth || 600}
                                              onMouseDown={(e) => {
                                                const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                              }}
                                              onChange={(e) => {
                                                const groupEl = e.currentTarget.closest('.alt-hover-group') as HTMLElement;
                                                const imgEl = groupEl?.querySelector('img');
                                                if (groupEl && imgEl) {
                                                  groupEl.style.width = `${e.currentTarget.value}px`;
                                                  imgEl.style.width = '100%';
                                                  groupEl.style.maxWidth = 'none';
                                                }
                                              }}
                                              onMouseUp={(e) => {
                                                setWidth(parseInt(e.currentTarget.value));
                                                const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                                if (menu) {
                                                  menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                  menu.style.left = menu.dataset.oldLeft || '4px';
                                                  menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                  menu.style.top = 'auto';
                                                  menu.style.right = 'auto';
                                                }
                                              }}
                                              onTouchStart={(e) => {
                                                const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                              }}
                                              onTouchEnd={(e) => {
                                                setWidth(parseInt(e.currentTarget.value));
                                                const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                                if (menu) {
                                                  menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                  menu.style.left = menu.dataset.oldLeft || '4px';
                                                  menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                  menu.style.top = 'auto';
                                                  menu.style.right = 'auto';
                                                }
                                              }}
                                              style={{ width: 80, cursor: 'ew-resize' }}
                                            />
                                          </div>
                                          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 2, gap: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            <button onClick={() => setAlign('left')} style={{ background: imgAlign === 'left' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Esquerda"><AlignLeft size={14} /></button>
                                            <button onClick={() => setAlign('center')} style={{ background: imgAlign === 'center' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Centralizar"><AlignCenter size={14} /></button>
                                            <button onClick={() => setAlign('right')} style={{ background: imgAlign === 'right' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Direita"><AlignRight size={14} /></button>
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
                                            }}
                                            style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                            title="Remover Imagem"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                          <div style={{ position: 'relative' }}>
                                            <button onClick={() => setMainImgMenuOpen(mainImgMenuOpen === `${q.id}-${part.index}` ? null : `${q.id}-${part.index}`)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)', height: 28 }}>
                                              <ImageIcon size={12} /> Imagem
                                            </button>
                                            {mainImgMenuOpen === `${q.id}-${part.index}` && (
                                              <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 9999, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                                <button onClick={() => handleMainImageAction(q.id, part.index, 'upload', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}>
                                                  <Upload size={14} /> Fazer Upload
                                                </button>
                                                <button onClick={() => handleMainImageAction(q.id, part.index, 'ai', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}>
                                                  <Sparkles size={14} /> Gerar com IA
                                                </button>
                                              </div>
                                            )}
                                          </div>
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
                              {!readOnly && (
                                <div className="no-print alt-actions" style={{ position: 'absolute', right: -36, top: 0, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                   <div style={{ position: 'relative' }}>
                                     <button title="Inserir Imagem" onClick={() => setMainImgMenuOpen(mainImgMenuOpen === `${q.id}-add` ? null : `${q.id}-add`)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                       <ImageIcon size={14} />
                                     </button>
                                     {mainImgMenuOpen === `${q.id}-add` && (
                                       <div style={{ position: 'absolute', top: '0', right: '100%', zIndex: 9999, marginRight: 8, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                         <button onClick={() => handleMainImageAction(q.id, q.imagens?.length || 0, 'upload', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}>
                                           <Upload size={14} /> Fazer Upload
                                         </button>
                                         <button onClick={() => handleMainImageAction(q.id, q.imagens?.length || 0, 'ai', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}>
                                           <Sparkles size={14} /> Gerar com IA
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                   <button title="Adicionar Espaço / Linhas" onClick={() => {
                                     const parts = parseEnunciadoParts(q.enunciado, q.imagens || []);
                                     const hasLines = parts.some((p: any) => p.type === 'lines');
                                     if (hasLines) {
                                       alert("Esta questão já possui linhas/espaço. Você pode ajustar a quantidade nos botões + e - que aparecem ao passar o mouse.");
                                       return;
                                     }
                                     setLinesCount(5);
                                     setLinesType('pautado');
                                     setLinesModalOpen({ qId: q._internalId || q.id, parts, defaultCount: 5, q });
                                   }} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                     <Plus size={14} />
                                   </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <div style={alternativasLayout === 'horizontal' ? { display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 4 } : { marginTop: 4 }}>
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

                            return q.simulados_alternativas?.map((a: any) => {
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
                              };

                              const setAltAlign = (align: string) => {
                                const p = new URLSearchParams(hashStr);
                                if (imgWidthStr) p.set('w', imgWidthStr);
                                p.set('a', align);
                                onEditAlternativaImage?.(q.id, a.id, `${imgBaseUrl}#${p.toString()}`);
                              };
                              
                              return (
                                <div key={a.id} className="alt-hover-group" style={{ 
                                  display: 'flex', gap: 12, 
                                  marginTop: alternativasLayout === 'vertical' ? 8 : 0, 
                                  alignItems: 'flex-start', position: 'relative',
                                  flex: alternativasLayout === 'horizontal' ? (effectiveWidth ? '0 0 auto' : '1 1 200px') : '1 1 auto',
                                  zIndex: imgMenuOpen === `${q.id}-${a.id}` ? 50 : 1
                                }}>
                                  <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                                    border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                                  }}>
                                    {a.letra}
                                  </div>
                                  <div style={{ flex: 1, position: 'relative', maxWidth: effectiveWidth ? `${effectiveWidth}px` : '100%' }}>
                                    {a.imagem_url && (
                                      <div style={{ display: 'flex', justifyContent, width: '100%', marginBottom: 8 }}>
                                        <div style={{ position: 'relative', width: effectiveWidth ? `${effectiveWidth}px` : '100%', maxWidth: '100%' }}>
                                          <img src={imgBaseUrl || undefined} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                          {onEditAlternativaImage && !readOnly && (
                                            <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 10, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '2px 8px', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>TAMANHO</span>
                                                <input 
                                                  type="range" 
                                                  min="100" 
                                                  max="800" 
                                                  step="10"
                                                  defaultValue={effectiveWidth || 300}
                                                  onMouseDown={(e) => {
                                                    const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                                  }}
                                                  onChange={(e) => {
                                                    const groupEl = e.currentTarget.closest('.alt-hover-group') as HTMLElement;
                                                    if (groupEl) {
                                                      groupEl.style.width = 'auto';
                                                      groupEl.style.flex = '0 0 auto';
                                                    }
                                                    const wrapperEl = e.currentTarget.closest('.alt-hover-group > div:nth-child(2) > div > div') as HTMLElement;
                                                    if (wrapperEl) {
                                                      wrapperEl.style.width = `${e.currentTarget.value}px`;
                                                    }
                                                  }}
                                                  onMouseUp={(e) => {
                                                    setAltWidth(parseInt(e.currentTarget.value));
                                                    onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${e.currentTarget.value}`);
                                                    const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                                    if (menu) {
                                                      menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                      menu.style.left = menu.dataset.oldLeft || '4px';
                                                      menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                      menu.style.top = 'auto';
                                                      menu.style.right = 'auto';
                                                    }
                                                  }}
                                                  onTouchStart={(e) => {
                                                    const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                                  }}
                                                  onTouchEnd={(e) => {
                                                    setAltWidth(parseInt(e.currentTarget.value));
                                                    onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${e.currentTarget.value}`);
                                                    const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                                    if (menu) {
                                                      menu.style.position = menu.dataset.oldPosition || 'absolute';
                                                      menu.style.left = menu.dataset.oldLeft || '4px';
                                                      menu.style.bottom = menu.dataset.oldBottom || '4px';
                                                      menu.style.top = 'auto';
                                                      menu.style.right = 'auto';
                                                    }
                                                  }}
                                                  style={{ width: 80, cursor: 'ew-resize' }}
                                                />
                                              </div>
                                              <button
                                                onClick={() => onEditAlternativaImage(q.id, a.id, '')}
                                                style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                title="Remover Imagem"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  
                                  <HtmlContent 
                                    editable={!readOnly}
                                    html={a.texto}
                                    onBlurHtml={(newHtml) => {
                                      onEditAlternativa(q.id, a.id, newHtml);
                                      forceRepaginate();
                                    }}
                                    style={{ wordBreak: 'break-word', outline: 'none', fontSize: `${alternativasFontSize}px` }}
                                  />

                                {onEditAlternativaImage && !readOnly && (
                                  <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === `${q.id}-${a.id}` ? 1 : undefined, pointerEvents: imgMenuOpen === `${q.id}-${a.id}` ? 'auto' : undefined }}>
                                    <button 
                                      onClick={() => setImgMenuOpen(imgMenuOpen === `${q.id}-${a.id}` ? null : `${q.id}-${a.id}`)}
                                      style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
                                    >
                                      <ImageIcon size={12} /> Imagem
                                    </button>
                                    {imgMenuOpen === `${q.id}-${a.id}` && (
                                      <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 9999, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                        <button onClick={() => handleImageAction(q.id, a.id, 'upload', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}>
                                          <Upload size={14} /> Fazer Upload
                                        </button>
                                        <button onClick={() => handleImageAction(q.id, a.id, 'ai', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}>
                                          <Sparkles size={14} /> Gerar com IA
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {onRemoveAlternativa && !readOnly && (
                                <button
                                  className="no-print alt-delete-btn"
                                  onClick={() => {
                                    onRemoveAlternativa(q.id, a.id);
                                    forceRepaginate();
                                  }}
                                  title="Remover alternativa"
                                  style={{
                                    position: 'absolute',
                                    right: -30,
                                    top: 4,
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    border: 'none',
                                    borderRadius: 20,
                                    width: 24,
                                    height: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          )
                          })})()}
                        </div>
                        
                        {/* Old button removed */}
                        {q.tipo_questao === 'descritiva' && (
                          block.estiloEspaco === 'pautado' ? (
                            <div style={{ marginTop: 16, width: '100%', display: 'flex', flexDirection: 'column' }}>
                              {Array.from({ length: block.linhasResposta || 5 }).map((_, i) => (
                                <div key={i} style={{ height: 28, borderBottom: '1px solid #000' }} />
                              ))}
                            </div>
                          ) : (
                            <div style={{ marginTop: 16, width: '100%', height: ((block.linhasResposta || 5) * 28) }} />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_descritiva_line') {
                return (
                  <div key={`b-${bIndex}`} style={{ marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10 }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
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
                return (
                  <div key={`b-${bIndex}`} style={{ position: 'relative', marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10 }}>

                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', minWidth: '28px', backgroundColor: block.isFirst ? '#1e293b' : 'transparent', color: block.isFirst ? '#ffffff' : 'transparent',
                      fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                    }}>
                      {block.isFirst ? block.qIndex + 1 : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <HtmlContent 
                        editable={!readOnly}
                        html={block.content || ''}
                        onBlurHtml={(newHtml) => {
                          const parts = parseEnunciadoParts(block.q.enunciado, block.q.imagens || []);
                          const metaRegex = /(<meta[^>]+>)/ig;
                          const metaTags = (block.q.enunciado || '').match(metaRegex) || [];
                          
                          const newFullHtml = parts.map((p: any, i: number) => {
                            if (p.type === 'text') {
                               let txt = i === block.originalIndex ? newHtml : p.content;
                               return (txt || '').replace(metaRegex, '');
                            }
                            if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                            return `[IMAGEM ${p.index + 1}]`;
                          }).join('');
                          
                          onEditEnunciado(block.q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                          forceRepaginate();
                        }}
                        style={{ wordBreak: 'break-word', outline: 'none', cursor: 'text' }}
                      />
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_enun_lines_line') {
                const q = block.q;
                const parts = parseEnunciadoParts(q.enunciado, q.imagens || []);
                return (
                  <div key={`b-${bIndex}`} className="alt-hover-group" style={{ position: 'relative', marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', minWidth: '28px', backgroundColor: block.isFirst ? '#1e293b' : 'transparent', color: block.isFirst ? '#ffffff' : 'transparent',
                      fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                    }}>
                      {block.isFirst ? block.qIndex + 1 : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                      <div style={{ width: '100%', borderBottom: block.style === 'branco' ? 'none' : '1px solid #000', height: 28 }} />
                      
                      {block.isFirstInGroup && (
                        <div className="alt-actions" style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: 4, transform: 'translateY(-50%)' }}>
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
                          }} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Remover uma linha">-</button>
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
                          }} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Adicionar uma linha">+</button>
                          <button onClick={() => {
                              const newFullHtml = parts.filter((p: any, i: number) => i !== block.originalIndex).map((p: any) => {
                                if (p.type === 'text') return (p.content || '').replace(/(<meta[^>]+>)/ig, '');
                                if (p.type === 'lines') return p.style === 'branco' ? `[ESPACO_BRANCO:${p.count}]` : `[LINHAS_PAUTADAS:${p.count}]`;
                                return `[IMAGEM ${p.index + 1}]`;
                              }).join('');
                              const metaTags = (q.enunciado || '').match(/(<meta[^>]+>)/ig) || [];
                              onEditEnunciado(q.id, metaTags.join('\n') + (metaTags.length > 0 ? '\n' : '') + newFullHtml);
                              forceRepaginate();
                          }} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Remover bloco de linhas"><Trash2 size={14} /></button>
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
                    <div key={`b-${bIndex}`} style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                      <div style={{ width: '28px', minWidth: '28px' }}></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: groupJustify, width: '100%' }}>
                          {block.images.map((part: any, idxInGroup: number) => {
                          const i = part.index;
                          const pIdx = part.originalIndex;
                          const img = part.url || '';
                          const hashIndex = img.indexOf('#');
                          const imgBaseUrl = hashIndex !== -1 ? img.substring(0, hashIndex) : img;
                          const hashStr = hashIndex !== -1 ? img.substring(hashIndex + 1) : '';
                          const params = new URLSearchParams(hashStr);
                          const imgWidthStr = params.get('w');
                          const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : 350;
                          const imgAlign = params.get('a') || 'center';
                          const justifyContent = imgAlign === 'left' ? 'flex-start' : imgAlign === 'right' ? 'flex-end' : 'center';
                          const menuKey = `${q.id}-img-${i}`;

                          const setWidth = (w: number) => {
                            const p = new URLSearchParams(hashStr);
                            p.set('w', w.toString());
                            if (imgAlign !== 'center') p.set('a', imgAlign);
                            onEditEnunciadoImage?.(q.id, i, `${imgBaseUrl}#${p.toString()}`);
                          };
                          
                          const setAlign = (a: string) => {
                            const p = new URLSearchParams(hashStr);
                            if (imgWidthStr) p.set('w', imgWidthStr);
                            p.set('a', a);
                            onEditEnunciadoImage?.(q.id, i, `${imgBaseUrl}#${p.toString()}`);
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
                          };

                          return (
                            <div key={`img-${i}-${pIdx}`} className="alt-hover-group" style={{ position: 'relative', display: 'flex', justifyContent, width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%' }}>
                              <img src={imgBaseUrl || undefined} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                              
                              {onEditEnunciadoImage && !readOnly && (
                                <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 10, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 4, gap: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                    <button onClick={() => movePart('up')} disabled={pIdx <= 0} style={{ background: 'transparent', color: pIdx <= 0 ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx <= 0 ? 'default' : 'pointer' }} title="Mover para cima"><ArrowUp size={14} /></button>
                                    <button onClick={() => movePart('down')} disabled={pIdx === -1 || pIdx === parts.length - 1} style={{ background: 'transparent', color: pIdx === -1 || pIdx === parts.length - 1 ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: pIdx === -1 || pIdx === parts.length - 1 ? 'default' : 'pointer' }} title="Mover para baixo"><ArrowDown size={14} /></button>
                                  </div>
                                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '2px 8px', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>TAMANHO</span>
                                    <input 
                                      type="range" 
                                      min="100" 
                                      max="800" 
                                      step="10"
                                      defaultValue={imgWidth || 350}
                                      onMouseDown={(e) => {
                                        const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                      }}
                                      onChange={(e) => {
                                        const groupEl = e.currentTarget.closest('.alt-hover-group') as HTMLElement;
                                        const imgEl = groupEl?.querySelector('img');
                                        if (groupEl && imgEl) {
                                          groupEl.style.width = `${e.currentTarget.value}px`;
                                          imgEl.style.width = '100%';
                                          groupEl.style.maxWidth = 'none';
                                        }
                                      }}
                                      onMouseUp={(e) => {
                                        setWidth(parseInt(e.currentTarget.value));
                                        const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                        if (menu) {
                                          menu.style.position = menu.dataset.oldPosition || 'absolute';
                                          menu.style.left = menu.dataset.oldLeft || '4px';
                                          menu.style.bottom = menu.dataset.oldBottom || '4px';
                                          menu.style.top = 'auto';
                                          menu.style.right = 'auto';
                                        }
                                      }}
                                      onTouchStart={(e) => {
                                        const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                      }}
                                      onTouchEnd={(e) => {
                                        setWidth(parseInt(e.currentTarget.value));
                                        const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                        if (menu) {
                                          menu.style.position = menu.dataset.oldPosition || 'absolute';
                                          menu.style.left = menu.dataset.oldLeft || '4px';
                                          menu.style.bottom = menu.dataset.oldBottom || '4px';
                                          menu.style.top = 'auto';
                                          menu.style.right = 'auto';
                                        }
                                      }}
                                      style={{ width: 80, cursor: 'ew-resize' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 2, gap: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <button onClick={() => setAlign('left')} style={{ background: imgAlign === 'left' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Esquerda"><AlignLeft size={14} /></button>
                                    <button onClick={() => setAlign('center')} style={{ background: imgAlign === 'center' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Centralizar"><AlignCenter size={14} /></button>
                                    <button onClick={() => setAlign('right')} style={{ background: imgAlign === 'right' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Direita"><AlignRight size={14} /></button>
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
                                    }}
                                    style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                    title="Remover Imagem"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                  <div style={{ position: 'relative' }}>
                                    <button onClick={() => setMainImgMenuOpen(mainImgMenuOpen === menuKey ? null : menuKey)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)', height: 28 }}>
                                      <ImageIcon size={12} /> Imagem
                                    </button>
                                    {mainImgMenuOpen === menuKey && (
                                      <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 9999, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                        <button onClick={() => handleMainImageAction(q.id, i, 'upload', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                                        <button onClick={() => handleMainImageAction(q.id, i, 'ai', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                                      </div>
                                    )}
                                  </div>
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
              <div key={bIndex} style={{ padding: '0 40px', marginTop: block.renderMarginTop }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
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

                    return block.q.simulados_alternativas?.map((a: any) => {
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
                      };

                      return (
                        <div key={a.id} className="alt-hover-group" style={{ 
                          display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative',
                          flex: effectiveWidth ? '0 0 auto' : '1 1 200px',
                          zIndex: imgMenuOpen === a.id ? 50 : 1
                        }}>
                          <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                            border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                          }}>
                            {a.letra}
                          </div>
                          <div style={{ flex: 1, position: 'relative', width: effectiveWidth ? `${effectiveWidth}px` : 'auto' }}>
                            {a.imagem_url && (
                              <div style={{ position: 'relative', marginBottom: 8, width: '100%', maxWidth: '100%' }}>
                                <img src={imgBaseUrl || undefined} style={{ width: '100%', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                {onEditAlternativaImage && !readOnly && (
                                  <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 10, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '2px 8px', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>TAMANHO</span>
                                      <input 
                                        type="range" 
                                        min="100" 
                                        max="800" 
                                        step="10"
                                        defaultValue={effectiveWidth || 300}
                                        onMouseDown={(e) => {
                                          const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                        }}
                                        onChange={(e) => {
                                          const groupEl = e.currentTarget.closest('.alt-hover-group') as HTMLElement;
                                          if (groupEl) {
                                            groupEl.style.width = 'auto';
                                            groupEl.style.flex = '0 0 auto';
                                          }
                                          const wrapperEl = e.currentTarget.closest('.alt-hover-group > div:nth-child(2)') as HTMLElement;
                                          if (wrapperEl) {
                                            wrapperEl.style.width = `${e.currentTarget.value}px`;
                                          }
                                        }}
                                        onMouseUp={(e) => {
                                          setWidth(parseInt(e.currentTarget.value));
                                          const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                          if (menu) {
                                            menu.style.position = menu.dataset.oldPosition || 'absolute';
                                            menu.style.left = menu.dataset.oldLeft || '4px';
                                            menu.style.bottom = menu.dataset.oldBottom || '4px';
                                            menu.style.top = 'auto';
                                            menu.style.right = 'auto';
                                          }
                                        }}
                                        onTouchStart={(e) => {
                                          const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                        }}
                                        onTouchEnd={(e) => {
                                          setWidth(parseInt(e.currentTarget.value));
                                          const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                          if (menu) {
                                            menu.style.position = menu.dataset.oldPosition || 'absolute';
                                            menu.style.left = menu.dataset.oldLeft || '4px';
                                            menu.style.bottom = menu.dataset.oldBottom || '4px';
                                            menu.style.top = 'auto';
                                            menu.style.right = 'auto';
                                          }
                                        }}
                                        style={{ width: 80, cursor: 'ew-resize' }}
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        onEditAlternativaImage(qId, a.id, '');
                                      }}
                                      style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                      title="Remover Imagem"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <HtmlContent editable={!readOnly} html={a.texto} onBlurHtml={(newHtml) => { onEditAlternativa(qId, a.id, newHtml); forceRepaginate(); }} style={{ wordBreak: 'break-word', outline: 'none' }} />
                            {onEditAlternativaImage && !readOnly && (
                              <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === a.id ? 1 : undefined, pointerEvents: imgMenuOpen === a.id ? 'auto' : undefined }}>
                                <button onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Imagem</button>
                                {imgMenuOpen === a.id && (
                                  <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 9999, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                    <button onClick={() => handleImageAction(qId, a.id, 'upload', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                                    <button onClick={() => handleImageAction(qId, a.id, 'ai', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {onRemoveAlternativa && !readOnly && (
                            <button className="no-print alt-delete-btn" onClick={() => { onRemoveAlternativa(qId, a.id); forceRepaginate(); }} title="Remover alternativa" style={{ position: 'absolute', right: -30, top: 4, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 20, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            );
          }

          if (block.type === 'part_alt') {
                const q = block.q;
                const a = block.alt;
                return (
                  <div key={`b-${bIndex}`} className="alt-hover-group" style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
                    <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
                      <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                        border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                      }}>
                        {a.letra}
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        {(() => {
                          const imgWidths = q.simulados_alternativas
                            ?.filter((altInfo: any) => altInfo.imagem_url)
                            .map((altInfo: any) => {
                              const parts = altInfo.imagem_url.split('#w=');
                              return parts.length > 1 ? parseInt(parts[1]) : 250;
                            }) || [];
                          const maxImgWidth = imgWidths.length > 0 ? Math.max(...imgWidths) : null;
                          
                          const urlParts = a.imagem_url ? a.imagem_url.split('#w=') : [];
                          const imgBaseUrl = urlParts[0];
                          const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                          const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                          const effectiveWidth = imgWidth || maxImgWidth;

                          return (
                            <div style={{ width: effectiveWidth ? `${effectiveWidth}px` : 'auto' }}>
                              {a.imagem_url && (
                                <div style={{ position: 'relative', marginBottom: 8, width: '100%', maxWidth: '100%' }}>
                                  <img src={imgBaseUrl || undefined} style={{ width: effectiveWidth ? `${effectiveWidth}px` : 'auto', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                  {onEditAlternativaImage && !readOnly && (
                                    <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, zIndex: 10, flexWrap: 'wrap', maxWidth: 280, justifyContent: 'flex-start' }}>
                                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '2px 8px', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', alignItems: 'center' }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>TAMANHO</span>
                                        <input 
                                          type="range" 
                                          min="100" 
                                          max="800" 
                                          step="10"
                                          defaultValue={effectiveWidth || 300}
                                          onMouseDown={(e) => {
                                            const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                          }}
                                          onChange={(e) => {
                                            const groupEl = e.currentTarget.closest('.alt-hover-group') as HTMLElement;
                                            if (groupEl) {
                                              groupEl.style.width = 'auto';
                                              groupEl.style.flex = '0 0 auto';
                                            }
                                            const wrapperEl = e.currentTarget.closest('.alt-hover-group > div:nth-child(2) > div > div') as HTMLElement;
                                            if (wrapperEl) {
                                              wrapperEl.style.width = `${e.currentTarget.value}px`;
                                            }
                                          }}
                                          onMouseUp={(e) => {
                                            onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${e.currentTarget.value}`);
                                            const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                            if (menu) {
                                              menu.style.position = menu.dataset.oldPosition || 'absolute';
                                              menu.style.left = menu.dataset.oldLeft || '4px';
                                              menu.style.bottom = menu.dataset.oldBottom || '4px';
                                              menu.style.top = 'auto';
                                              menu.style.right = 'auto';
                                            }
                                          }}
                                          onTouchStart={(e) => {
                                            const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
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
                                          }}
                                          onTouchEnd={(e) => {
                                            onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${e.currentTarget.value}`);
                                            const menu = e.currentTarget.closest('.alt-img-actions') as HTMLElement;
                                            if (menu) {
                                              menu.style.position = menu.dataset.oldPosition || 'absolute';
                                              menu.style.left = menu.dataset.oldLeft || '4px';
                                              menu.style.bottom = menu.dataset.oldBottom || '4px';
                                              menu.style.top = 'auto';
                                              menu.style.right = 'auto';
                                            }
                                          }}
                                          style={{ width: 80, cursor: 'ew-resize' }}
                                        />
                                      </div>
                                      <button
                                        onClick={() => onEditAlternativaImage(q.id, a.id, '')}
                                        style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                        title="Remover Imagem"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <HtmlContent 
                                editable={!readOnly}
                                html={a.texto}
                                onBlurHtml={(newHtml) => { onEditAlternativa(q.id, a.id, newHtml); forceRepaginate(); }}
                                style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                              />
                              {onEditAlternativaImage && !readOnly && (
                                <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === a.id ? 1 : undefined, pointerEvents: imgMenuOpen === a.id ? 'auto' : undefined }}>
                                  <button onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Imagem</button>
                                  {imgMenuOpen === a.id && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 9999, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                      <button onClick={() => handleImageAction(q.id, a.id, 'upload', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                                      <button onClick={() => handleImageAction(q.id, a.id, 'ai', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      {onRemoveAlternativa && !readOnly && (
                        <button
                          className="no-print alt-delete-btn"
                          onClick={() => {
                            onRemoveAlternativa(q.id, a.id);
                            forceRepaginate();
                          }}
                          style={{ position: 'absolute', right: -30, top: 4, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 20, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Remover alternativa"
                        >
                          <X size={14} />
                        </button>
                      )}
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
      
      {showMargins && onTopMarginOffsetChange && (
        <div 
          className="no-print"
          style={{
            position: 'absolute',
            top: (pIndex === 0 ? 75 * 3.7795 : 18 * 3.7795) + topMarginOffset - 5,
            left: 0, right: 0, height: 10, cursor: 'ns-resize', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startOffset = topMarginOffset || 0;
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaY = moveEvent.clientY - startY; 
              onTopMarginOffsetChange(Math.max(-60, startOffset + deltaY));
            };
            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div style={{ width: '100%', height: 2, background: 'rgba(59, 130, 246, 0.5)', borderBottom: '1px dashed #3b82f6' }} />
          <div style={{ position: 'absolute', background: '#3b82f6', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, right: 20, top: 5 }}>
            Margem Superior ({topMarginOffset.toFixed(0)}px)
          </div>
        </div>
      )}

      {showMargins && onBottomMarginOffsetChange && (
        <div 
          className="no-print"
          style={{
            position: 'absolute',
            bottom: (42 * 3.7795) + bottomMarginOffset - 5,
            left: 0, right: 0, height: 10, cursor: 'ns-resize', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startOffset = bottomMarginOffset || 0;
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaY = moveEvent.clientY - startY; 
              onBottomMarginOffsetChange(Math.max(-150, startOffset - deltaY));
            };
            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div style={{ width: '100%', height: 2, background: 'rgba(59, 130, 246, 0.5)', borderBottom: '1px dashed #3b82f6' }} />
          <div style={{ position: 'absolute', background: '#3b82f6', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, right: 20, bottom: 5 }}>
            Margem Inferior ({bottomMarginOffset.toFixed(0)}px)
          </div>
        </div>
      )}

      {showMargins && onLeftMarginOffsetChange && (
        <div 
          className="no-print"
          style={{
            position: 'absolute',
            left: (18 * 3.7795) + leftMarginOffset - 5,
            top: 0, bottom: 0, width: 10, cursor: 'ew-resize', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startOffset = leftMarginOffset || 0;
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = moveEvent.clientX - startX; 
              onLeftMarginOffsetChange(Math.max(-60, startOffset + deltaX));
            };
            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div style={{ width: 2, height: '100%', background: 'rgba(59, 130, 246, 0.5)', borderRight: '1px dashed #3b82f6' }} />
          <div style={{ position: 'absolute', background: '#3b82f6', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, top: 40, left: 10, whiteSpace: 'nowrap' }}>
            Margem Esquerda ({leftMarginOffset.toFixed(0)}px)
          </div>
        </div>
      )}

      {showMargins && onRightMarginOffsetChange && (
        <div 
          className="no-print"
          style={{
            position: 'absolute',
            right: (18 * 3.7795) + rightMarginOffset - 5,
            top: 0, bottom: 0, width: 10, cursor: 'ew-resize', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startOffset = rightMarginOffset || 0;
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = moveEvent.clientX - startX; 
              onRightMarginOffsetChange(Math.max(-60, startOffset - deltaX));
            };
            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div style={{ width: 2, height: '100%', background: 'rgba(59, 130, 246, 0.5)', borderLeft: '1px dashed #3b82f6' }} />
          <div style={{ position: 'absolute', background: '#3b82f6', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, top: 40, right: 10, whiteSpace: 'nowrap' }}>
            Margem Direita ({rightMarginOffset.toFixed(0)}px)
          </div>
        </div>
      )}

      {isGenerating && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px 40px', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Sparkles size={32} color="#8b5cf6" className="animate-pulse" />
            <span style={{ fontWeight: 700, color: '#334155' }}>Gerando imagem ilustrativa...</span>
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
    </>
  );
}
