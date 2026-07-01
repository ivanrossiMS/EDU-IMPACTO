import React from 'react';
import { X, BookOpen, ImageIcon, Sparkles, Upload, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { HtmlContent } from '../HtmlContent';
import { DraggableHeaderField } from './DraggableHeaderField';

export function PageContent({ 
  page, 
  pIndex, 
  fontSize, 
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
  onEditAlternativaImage
}: any) {
  const [imgMenuOpen, setImgMenuOpen] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      {pIndex === 0 && config?.modelo_pdf_url && (
        <div className="print-cover-image" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img src={config.modelo_pdf_url} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}
      {pIndex > 0 && config?.modelo_pdf_outras_paginas_url && (
        <div className="print-repeating-bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img src={config.modelo_pdf_outras_paginas_url} alt="Fundo Interna" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}

      {pIndex === 0 && config?.modelo_pdf_url && (
        <>
          {simulado?.isProva ? (
            <div className="template-fields" ref={pageA4Ref} style={{ pointerEvents: isEditHeaderMode ? 'auto' : 'none' }}>
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
            <div className="simulado-title" style={{
              position: 'absolute', top: '20mm', right: '25mm', width: '75mm', height: '24mm',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              fontWeight: 900, fontSize: '13pt', color: '#1e293b', zIndex: 3
            }}>
              {simulado?.titulo || 'Simulado sem título'}
            </div>
          )}
        </>
      )}

      <div style={{ 
        position: 'absolute', 
        top: pIndex === 0 ? '75mm' : '18mm', 
        left: '16mm', right: '16mm', bottom: '18mm', 
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
              fontSize: `${fontSize}px`, 
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
                        <HtmlContent 
                          editable={true}
                          html={q.enunciado}
                          onBlurHtml={(newHtml) => {
                            onEditEnunciado(q.id, newHtml);
                            forceRepaginate();
                          }}
                          style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', marginBottom: 12, wordBreak: 'break-word', cursor: 'text' }}
                        />
                        {q.imagens?.map((img: string, i: number) => (
                          <img key={i} src={img} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginTop: 12, display: 'block' }} />
                        ))}
                        <div style={alternativasLayout === 'horizontal' ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 } : {}}>
                          {q.simulados_alternativas?.map((a: any) => (
                            <div key={a.id} className="alt-hover-group" style={{ display: 'flex', gap: 12, marginTop: alternativasLayout === 'vertical' ? 12 : 0, alignItems: 'flex-start', position: 'relative' }}>
                              <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                                border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                              }}>
                                {a.letra}
                              </div>
                              <div style={{ flex: 1, position: 'relative' }}>
                                {a.imagem_url && (() => {
                                  const urlParts = a.imagem_url.split('#w=');
                                  const imgBaseUrl = urlParts[0];
                                  const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                                  const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                                  
                                  return (
                                    <div style={{ position: 'relative', marginBottom: 8, width: imgWidth ? `${imgWidth}px` : '250px', maxWidth: '100%' }}>
                                      <img src={imgBaseUrl} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                      {onEditAlternativaImage && (
                                        <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                                          <button
                                            onClick={() => onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.min(800, imgWidth + 50) : 350}`)}
                                            style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            title="Aumentar"
                                          >
                                            <ZoomIn size={12} />
                                          </button>
                                          <button
                                            onClick={() => onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.max(100, imgWidth - 50) : 250}`)}
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
                                  );
                                })()}
                                
                                <HtmlContent 
                                  editable={true}
                                  html={a.texto}
                                  onBlurHtml={(newHtml) => {
                                    onEditAlternativa(q.id, a.id, newHtml);
                                    forceRepaginate();
                                  }}
                                  style={{ wordBreak: 'break-word', outline: 'none' }}
                                />

                                {onEditAlternativaImage && (
                                  <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === a.id ? 1 : undefined, pointerEvents: imgMenuOpen === a.id ? 'auto' : undefined }}>
                                    <button 
                                      onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)}
                                      style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
                                    >
                                      <ImageIcon size={12} /> Imagem
                                    </button>
                                    {imgMenuOpen === a.id && (
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
                          ))}
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

              if (block.type === 'part_enunciado') {
                const q = block.q;
                return (
                  <div key={`b-${bIndex}`} style={{ position: 'relative', marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10 }}>
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
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                      fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                    }}>
                      {block.qIndex + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <HtmlContent 
                        editable={true}
                        html={q.enunciado}
                        onBlurHtml={(newHtml) => {
                          onEditEnunciado(q.id, newHtml);
                          forceRepaginate();
                        }}
                        style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                      />
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_img') {
                return (
                  <div key={`b-${bIndex}`} style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
                    <div style={{ flex: 1 }}>
                       <img src={block.imgUrl} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_alts_container') {
            return (
              <div key={idx} style={{ padding: '0 40px', marginTop: block.renderMarginTop }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {block.q.simulados_alternativas?.map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                        border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                      }}>
                        {a.letra}
                      </div>
                      <div style={{ flex: 1 }}>
                        {a.imagem_url && (() => {
                          const urlParts = a.imagem_url.split('#w=');
                          const imgBaseUrl = urlParts[0];
                          const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                          const imgWidth = imgWidthStr ? `${imgWidthStr}px` : '250px';
                          return (
                            <img src={imgBaseUrl} style={{ width: imgWidth, maxWidth: '100%', height: 'auto', borderRadius: 8, marginBottom: 8, display: 'block' }} />
                          );
                        })()}
                        <HtmlContent html={a.texto} style={{ wordBreak: 'break-word' }} />
                      </div>
                    </div>
                  ))}
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
                      <div style={{ flex: 1 }}>
                        {a.imagem_url && (() => {
                          const urlParts = a.imagem_url.split('#w=');
                          const imgBaseUrl = urlParts[0];
                          const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                          const imgWidth = imgWidthStr ? `${imgWidthStr}px` : '250px';
                          return (
                            <img src={imgBaseUrl} style={{ width: imgWidth, maxWidth: '100%', height: 'auto', borderRadius: 8, marginBottom: 8, display: 'block' }} />
                          );
                        })()}
                        <HtmlContent 
                          editable={true}
                          html={a.texto}
                          onBlurHtml={(newHtml) => {
                            onEditAlternativa(q.id, a.id, newHtml);
                            forceRepaginate();
                          }}
                          style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                        />
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
