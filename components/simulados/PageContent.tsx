import React from 'react';
import { X, BookOpen, ImageIcon, Sparkles, Upload, Trash2, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
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
  onEditEnunciadoImage
}: any) {
  const [imgMenuOpen, setImgMenuOpen] = useState<string | null>(null);
  const [mainImgMenuOpen, setMainImgMenuOpen] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
          <img src={simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_url : (simulado?.isProva ? config.provas_modelo_pdf_url : config.modelo_pdf_url)} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}
      {pIndex > 0 && (simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_outras_paginas_url : (simulado?.isProva ? config?.provas_modelo_pdf_outras_paginas_url : config?.modelo_pdf_outras_paginas_url)) && (
        <div className="print-repeating-bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img src={simulado?.isRedacao ? config?.redacao_enem_modelo_pdf_outras_paginas_url : (simulado?.isProva ? config.provas_modelo_pdf_outras_paginas_url : config.modelo_pdf_outras_paginas_url)} alt="Fundo Interna" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
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
        position: 'absolute', 
        width: '100%',
        paddingTop: pIndex === 0 ? '75mm' : '18mm', 
        paddingLeft: '18mm', paddingRight: '18mm', 
        paddingBottom: '42mm',
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
                      padding: '8px 16px',
                      borderLeft: '4px solid #3b82f6',
                      background: 'linear-gradient(90deg, #e0f2fe 0%, #f8fafc 100%)',
                      borderRadius: '0 8px 8px 0',
                      fontWeight: 800,
                      fontSize: '11pt',
                      color: '#1e293b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      breakInside: 'avoid'
                    }}
                  >
                    <BookOpen size={16} color="#3b82f6" style={{ marginTop: '-1px' }} />
                    {block.discName}
                  </div>
                );
              }

              if (block.type === 'full') {
                const q = block.q;
                return (
                  <div key={`b-${bIndex}`} className="questao-container" style={{ position: 'relative', marginTop: block.renderMarginTop || 0, breakInside: 'avoid' }}>
                    {/* Controles Overlay (No Print) */}
                    <div className="no-print" style={{ position: 'absolute', right: -10, top: -10, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'white', padding: '6px 10px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: 12 }}>
                        <input 
                          type="checkbox" 
                          checked={true}
                          onChange={() => onToggleQuestion(q.id)}
                          style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                        />
                        Incluir
                      </label>
                    </div>
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
                        {parseEnunciadoParts(q.enunciado, q.imagens || []).map((part: any, pIdx: number) => (
                          part.type === 'text' ? (
                            <div key={`txt-${pIdx}`}>
                              <HtmlContent 
                                editable={true}
                                html={part.content || ''}
                                onBlurHtml={(newHtml) => {
                                  onEditEnunciado(q.id, newHtml);
                                  forceRepaginate();
                                }}
                                style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', marginBottom: 12, wordBreak: 'break-word', cursor: 'text' }}
                              />
                            </div>
                          ) : (
                            <div key={`img-${part.index}`} className="alt-hover-group" style={{ position: 'relative', marginTop: 12, marginBottom: 12, width: '100%' }}>
                              {(() => {
                                const hashIndex = part.url ? part.url.indexOf('#') : -1;
                                const imgBaseUrl = hashIndex >= 0 ? part.url.substring(0, hashIndex) : (part.url || '');
                                const hashStr = hashIndex >= 0 ? part.url.substring(hashIndex + 1) : '';
                                const params = new URLSearchParams(hashStr);
                                const imgWidthStr = params.get('w');
                                const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                                const imgAlign = params.get('a') || 'center';
                                const justifyContent = imgAlign === 'left' ? 'flex-start' : imgAlign === 'right' ? 'flex-end' : 'center';

                                const setWidth = (w: number) => {
                                  const p = new URLSearchParams(hashStr);
                                  p.set('w', w.toString());
                                  if (imgAlign !== 'center') p.set('a', imgAlign);
                                  onEditEnunciadoImage(q.id, part.index, `${imgBaseUrl}#${p.toString()}`);
                                };

                                const setAlign = (a: string) => {
                                  const p = new URLSearchParams(hashStr);
                                  if (imgWidthStr) p.set('w', imgWidthStr);
                                  p.set('a', a);
                                  onEditEnunciadoImage(q.id, part.index, `${imgBaseUrl}#${p.toString()}`);
                                };

                                  return (
                                    <>
                                      <div style={{ display: 'flex', justifyContent, width: '100%' }}>
                                        <img src={imgBaseUrl} style={{ width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                      </div>
                                    {onEditEnunciadoImage && (
                                      <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4, zIndex: 10 }}>
                                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 2, gap: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                          <button onClick={() => setAlign('left')} style={{ background: imgAlign === 'left' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Esquerda"><AlignLeft size={14} /></button>
                                          <button onClick={() => setAlign('center')} style={{ background: imgAlign === 'center' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Centralizar"><AlignCenter size={14} /></button>
                                          <button onClick={() => setAlign('right')} style={{ background: imgAlign === 'right' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Direita"><AlignRight size={14} /></button>
                                        </div>
                                        <button
                                          onClick={() => setWidth(Math.min(800, (imgWidth || 600) + 50))}
                                          style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                          title="Aumentar"
                                        >
                                          <ZoomIn size={14} />
                                        </button>
                                        <button
                                          onClick={() => setWidth(Math.max(100, (imgWidth || 600) - 50))}
                                          style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                          title="Diminuir"
                                        >
                                          <ZoomOut size={14} />
                                        </button>
                                        <button
                                          onClick={() => onEditEnunciadoImage(q.id, part.index, '')}
                                          style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                          title="Remover"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                        <div style={{ position: 'relative' }}>
                                          <button onClick={() => setMainImgMenuOpen(mainImgMenuOpen === `${q.id}-${part.index}` ? null : `${q.id}-${part.index}`)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)', height: 28 }}>
                                            <ImageIcon size={12} /> Imagem
                                          </button>
                                          {mainImgMenuOpen === `${q.id}-${part.index}` && (
                                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
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
                                  </>
                                )
                              })()}
                            </div>
                          )
                        ))}
                        <div style={alternativasLayout === 'horizontal' ? { display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 12 } : {}}>
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
                                  marginTop: alternativasLayout === 'vertical' ? 12 : 0, 
                                  alignItems: 'flex-start', position: 'relative',
                                  flex: alternativasLayout === 'horizontal' ? (effectiveWidth ? '0 0 auto' : '1 1 200px') : '1 1 auto'
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
                                          <img src={imgBaseUrl} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                          {onEditAlternativaImage && (
                                            <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                                              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 2, gap: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                                <button onClick={() => setAltAlign('left')} style={{ background: imgAlign === 'left' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Esquerda"><AlignLeft size={12} /></button>
                                                <button onClick={() => setAltAlign('center')} style={{ background: imgAlign === 'center' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Centralizar"><AlignCenter size={12} /></button>
                                                <button onClick={() => setAltAlign('right')} style={{ background: imgAlign === 'right' ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alinhar à Direita"><AlignRight size={12} /></button>
                                              </div>
                                              <button
                                                onClick={() => setAltWidth(Math.min(800, (imgWidth || 250) + 50))}
                                                style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                title="Aumentar"
                                              >
                                                <ZoomIn size={12} />
                                              </button>
                                              <button
                                                onClick={() => setAltWidth(Math.max(100, (imgWidth || 250) - 50))}
                                                style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                title="Diminuir"
                                              >
                                                <ZoomOut size={12} />
                                              </button>
                                              <button
                                                onClick={() => onEditAlternativaImage(q.id, a.id, '')}
                                                style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                title="Remover"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  
                                  <HtmlContent 
                                    editable={true}
                                    html={a.texto}
                                    onBlurHtml={(newHtml) => {
                                      onEditAlternativa(q.id, a.id, newHtml);
                                      forceRepaginate();
                                    }}
                                    style={{ wordBreak: 'break-word', outline: 'none', fontSize: `${alternativasFontSize}px` }}
                                  />

                                {onEditAlternativaImage && (
                                  <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === `${q.id}-${a.id}` ? 1 : undefined, pointerEvents: imgMenuOpen === `${q.id}-${a.id}` ? 'auto' : undefined }}>
                                    <button 
                                      onClick={() => setImgMenuOpen(imgMenuOpen === `${q.id}-${a.id}` ? null : `${q.id}-${a.id}`)}
                                      style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
                                    >
                                      <ImageIcon size={12} /> Imagem
                                    </button>
                                    {imgMenuOpen === `${q.id}-${a.id}` && (
                                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
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

                              {onRemoveAlternativa && (
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
                    {block.isFirst && (
                      <div className="no-print" style={{ position: 'absolute', right: -10, top: -10, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'white', padding: '6px 10px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: 12 }}>
                          <input 
                            type="checkbox" 
                            checked={true}
                            onChange={() => onToggleQuestion(q.id)}
                            style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                          />
                          Incluir
                        </label>
                      </div>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', minWidth: '28px', backgroundColor: block.isFirst ? '#1e293b' : 'transparent', color: block.isFirst ? '#ffffff' : 'transparent',
                      fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                    }}>
                      {block.isFirst ? block.qIndex + 1 : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <HtmlContent 
                        editable={false}
                        html={block.content || ''}
                        style={{ wordBreak: 'break-word' }}
                      />
                    </div>
                  </div>
                );
              }

                            if (block.type === 'part_img') {
                const q = block.q;
                const i = block.imgIndex;
                const img = block.imgUrl;
                const urlParts = img.split('#w=');
                const imgBaseUrl = urlParts[0];
                const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                const menuKey = `${q.id}-img-${i}`;

                return (
                  <div key={`b-${bIndex}`} style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
                    <div className="alt-hover-group" style={{ flex: 1, position: 'relative', width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%' }}>
                      <img src={imgBaseUrl} style={{ width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                      
                      {onEditEnunciadoImage && (
                        <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                          <button onClick={() => onEditEnunciadoImage(q.id, i, `${imgBaseUrl}#w=${imgWidth ? Math.min(800, imgWidth + 50) : 400}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Aumentar"><ZoomIn size={12} /></button>
                          <button onClick={() => onEditEnunciadoImage(q.id, i, `${imgBaseUrl}#w=${imgWidth ? Math.max(100, imgWidth - 50) : 300}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Diminuir"><ZoomOut size={12} /></button>
                          <button onClick={() => onEditEnunciadoImage(q.id, i, '')} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover"><Trash2 size={12} /></button>
                        </div>
                      )}
                      
                      {onEditEnunciadoImage && (
                        <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: mainImgMenuOpen === menuKey ? 1 : undefined, pointerEvents: mainImgMenuOpen === menuKey ? 'auto' : undefined }}>
                          <button onClick={() => setMainImgMenuOpen(mainImgMenuOpen === menuKey ? null : menuKey)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Alterar Imagem</button>
                          {mainImgMenuOpen === menuKey && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                              <button onClick={() => handleMainImageAction(q.id, i, 'upload', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                              <button onClick={() => handleMainImageAction(q.id, i, 'ai', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_alts_container') {
            return (
              <div key={bIndex} style={{ padding: '0 40px', marginTop: block.renderMarginTop }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                  {(() => {
                    const imgWidths = block.q.simulados_alternativas
                      ?.filter((a: any) => a.imagem_url)
                      .map((a: any) => {
                        const parts = a.imagem_url.split('#w=');
                        return parts.length > 1 ? parseInt(parts[1]) : 250;
                      }) || [];
                    const maxImgWidth = imgWidths.length > 0 ? Math.max(...imgWidths) : null;

                    return block.q.simulados_alternativas?.map((a: any) => {
                      const urlParts = a.imagem_url ? a.imagem_url.split('#w=') : [];
                      const imgBaseUrl = urlParts[0];
                      const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                      const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                      const effectiveWidth = imgWidth || maxImgWidth;
                      const qId = block.q.id;

                      return (
                        <div key={a.id} className="alt-hover-group" style={{ 
                          display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative',
                          flex: effectiveWidth ? '0 0 auto' : '1 1 200px'
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
                                <img src={imgBaseUrl} style={{ width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                {onEditAlternativaImage && (
                                  <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                                    <button onClick={() => onEditAlternativaImage(qId, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.min(800, imgWidth + 50) : 350}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Aumentar"><ZoomIn size={12} /></button>
                                    <button onClick={() => onEditAlternativaImage(qId, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.max(100, imgWidth - 50) : 250}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Diminuir"><ZoomOut size={12} /></button>
                                    <button onClick={() => onEditAlternativaImage(qId, a.id, '')} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </div>
                            )}
                            <HtmlContent editable={true} html={a.texto} onBlurHtml={(newHtml) => { onEditAlternativa(qId, a.id, newHtml); forceRepaginate(); }} style={{ wordBreak: 'break-word', outline: 'none' }} />
                            {onEditAlternativaImage && (
                              <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === a.id ? 1 : undefined, pointerEvents: imgMenuOpen === a.id ? 'auto' : undefined }}>
                                <button onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Imagem</button>
                                {imgMenuOpen === a.id && (
                                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                    <button onClick={() => handleImageAction(qId, a.id, 'upload', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                                    <button onClick={() => handleImageAction(qId, a.id, 'ai', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {onRemoveAlternativa && (
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
                                  <img src={imgBaseUrl} style={{ width: effectiveWidth ? `${effectiveWidth}px` : 'auto', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                  {onEditAlternativaImage && (
                                    <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                                      <button onClick={() => onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.min(800, imgWidth + 50) : 350}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Aumentar"><ZoomIn size={12} /></button>
                                      <button onClick={() => onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.max(100, imgWidth - 50) : 250}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Diminuir"><ZoomOut size={12} /></button>
                                      <button onClick={() => onEditAlternativaImage(q.id, a.id, '')} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover"><Trash2 size={12} /></button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <HtmlContent 
                                editable={true}
                                html={a.texto}
                                onBlurHtml={(newHtml) => { onEditAlternativa(q.id, a.id, newHtml); forceRepaginate(); }}
                                style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                              />
                              {onEditAlternativaImage && (
                                <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === a.id ? 1 : undefined, pointerEvents: imgMenuOpen === a.id ? 'auto' : undefined }}>
                                  <button onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Imagem</button>
                                  {imgMenuOpen === a.id && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
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
      {isGenerating && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px 40px', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Sparkles size={32} color="#8b5cf6" className="animate-pulse" />
            <span style={{ fontWeight: 700, color: '#334155' }}>Gerando imagem ilustrativa...</span>
          </div>
        </div>
      )}
    </>
  );
}
