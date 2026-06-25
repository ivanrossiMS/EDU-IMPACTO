import React, { useEffect, useState, useRef } from 'react';
import { Loader2, X } from 'lucide-react';

interface PaginationEngineProps {
  questoes: any[];
  columns: number;
  fontSize: number;
  config: any;
  simulado: any;
  onEditEnunciado: (qId: string, newText: string) => void;
  onEditAlternativa: (qId: string, altId: string, newText: string) => void;
  onRemoveAlternativa: (qId: string, altId: string) => void;
}

const MM_TO_PX = 3.7795;
const PAGE_H = 297 * MM_TO_PX;
const HEADER_1 = 80 * MM_TO_PX; // Height of cover image header + margins
const HEADER_OTHER = 25 * MM_TO_PX;
const BOTTOM = 25 * MM_TO_PX;
const BLOCK_SPACING = 24; 
const ALT_SPACING = 12;

export function PaginationEngine({
  questoes, columns, fontSize, config, simulado,
  onEditEnunciado, onEditAlternativa, onRemoveAlternativa
}: PaginationEngineProps) {
  
  const [pages, setPages] = useState<any[]>([]);
  const [isPaginating, setIsPaginating] = useState(true);
  const [trigger, setTrigger] = useState(0); // For forcing re-pagination on edits
  const shadowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPaginating(true);
    
    const timer = setTimeout(() => {
      if (!shadowRef.current) return;
      
      const shadow = shadowRef.current;
      const heights: Record<string, number> = {};
      
      const els = shadow.querySelectorAll('[data-measure]');
      els.forEach(el => {
        const id = el.getAttribute('data-id');
        if (id) {
          heights[id] = el.getBoundingClientRect().height;
        }
      });

      const newPages: any[] = [];
      let currentCols: any[][] = Array.from({length: columns}, () => []);
      let colIndex = 0;
      let currentY = 0;
      let pageIndex = 0;

      function getAvailableHeight() {
        const header = pageIndex === 0 ? HEADER_1 : HEADER_OTHER;
        return PAGE_H - header - BOTTOM;
      }

      function advanceCol() {
        colIndex++;
        if (colIndex >= columns) {
          newPages.push(currentCols);
          pageIndex++;
          currentCols = Array.from({length: columns}, () => []);
          colIndex = 0;
        }
        currentY = 0;
      }

      function pushBlock(block: any, h: number) {
        if (currentY + h > getAvailableHeight() && currentY > 0) {
          advanceCol();
        }
        currentCols[colIndex].push(block);
        currentY += h;
      }

      questoes.forEach((q, idx) => {
        if (currentY > 0) currentY += BLOCK_SPACING;

        const enunH = heights[`${q.id}-enunciado`] || 0;
        let totalH = enunH;
        
        const imgsH = (q.imagens || []).map((img: string, i: number) => {
          const h = heights[`${q.id}-img-${i}`] || 0;
          totalH += h + ALT_SPACING;
          return h;
        });

        const altsH = (q.simulados_alternativas || []).map((a: any) => {
          const h = heights[`${q.id}-alt-${a.id}`] || 0;
          totalH += h + ALT_SPACING;
          return h;
        });

        if (currentY + totalH <= getAvailableHeight()) {
          pushBlock({ type: 'full', q, qIndex: idx }, totalH);
        } else {
          pushBlock({ type: 'part_enunciado', q, qIndex: idx }, enunH);
          (q.imagens || []).forEach((img: string, i: number) => {
             pushBlock({ type: 'part_img', q, imgUrl: img, imgIndex: i }, imgsH[i] + ALT_SPACING);
          });
          (q.simulados_alternativas || []).forEach((a: any, i: number) => {
             pushBlock({ type: 'part_alt', q, alt: a }, altsH[i] + ALT_SPACING);
          });
        }
      });

      if (currentY > 0 || colIndex > 0) {
        if (currentCols.some(col => col.length > 0)) {
          newPages.push(currentCols);
        }
      }

      setPages(newPages);
      setIsPaginating(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [questoes, columns, fontSize, trigger]);

  const forceRepaginate = () => setTrigger(t => t + 1);
  const shadowColWidth = columns === 1 ? '180mm' : '84mm';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      
      <div 
        ref={shadowRef}
        style={{ 
          position: 'absolute', top: -9999, left: -9999, visibility: 'hidden', 
          width: shadowColWidth, fontSize: `${fontSize}px`, lineHeight: 1.6, textAlign: 'justify' 
        }}
      >
        {questoes.map((q, idx) => (
          <div key={`shadow-${q.id}`}>
            <div data-measure data-id={`${q.id}-enunciado`} style={{ display: 'flex', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
              }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div dangerouslySetInnerHTML={{ __html: q.enunciado }} style={{ wordBreak: 'break-word', marginBottom: 12 }} />
              </div>
            </div>

            {q.imagens?.map((img: string, i: number) => (
              <img 
                key={`shadow-img-${i}`}
                data-measure 
                data-id={`${q.id}-img-${i}`} 
                src={img} 
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginTop: 12, display: 'block' }} 
              />
            ))}

            {q.simulados_alternativas?.map((a: any) => (
              <div key={`shadow-alt-${a.id}`} data-measure data-id={`${q.id}-alt-${a.id}`} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                  border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                }}>
                  {a.letra}
                </div>
                <div style={{ flex: 1 }}>
                  <div dangerouslySetInnerHTML={{ __html: a.texto }} style={{ wordBreak: 'break-word' }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {isPaginating && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 20, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 12, marginBottom: 20 }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ fontWeight: 600 }}>Paginando documento...</span>
        </div>
      )}

      {!isPaginating && pages.map((page, pIndex) => (
        <div 
          key={`page-${pIndex}`} 
          className="print-area print-page-break" 
          style={{ 
            width: '210mm', height: '297mm', background: 'white', 
            position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', boxSizing: 'border-box',
            marginBottom: '40px', overflow: 'hidden', pageBreakAfter: 'always'
          }}
        >
          {pIndex === 0 && config?.modelo_pdf_url && (
            <div className="print-cover-image" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
              <img src={config.modelo_pdf_url} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
            </div>
          )}
          {pIndex > 0 && config?.modelo_pdf_outras_paginas_url && (
            <div className="print-repeating-bg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
              <img src={config.modelo_pdf_outras_paginas_url} alt="Fundo Interna" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
            </div>
          )}

          {pIndex === 0 && config?.modelo_pdf_url && (
            <div className="simulado-title" style={{
              position: 'absolute', top: '20mm', right: '25mm', width: '75mm', height: '24mm',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              fontWeight: 900, fontSize: '13pt', color: '#1e293b', zIndex: 3
            }}>
              {simulado.titulo}
            </div>
          )}

          <div style={{ 
            position: 'absolute', 
            top: pIndex === 0 ? '68mm' : '20mm', 
            left: '15mm', right: '15mm', bottom: '25mm', 
            zIndex: 2,
            display: 'flex',
            gap: '12mm'
          }}>
            {page.map((col: any[], cIndex: number) => (
              <div key={`col-${cIndex}`} style={{ flex: 1, fontSize: `${fontSize}px`, lineHeight: 1.6, color: '#000', textAlign: 'justify' }}>
                {col.map((block: any, bIndex: number) => {
                  
                  if (block.type === 'full') {
                    const q = block.q;
                    return (
                      <div key={`b-${bIndex}`} className="questao-container" style={{ marginBottom: 24, breakInside: 'avoid' }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                            fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                          }}>
                            {block.qIndex + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div 
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                onEditEnunciado(q.id, e.currentTarget.innerHTML);
                                forceRepaginate();
                              }}
                              dangerouslySetInnerHTML={{ __html: q.enunciado }}
                              style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', marginBottom: 12, wordBreak: 'break-word', cursor: 'text' }}
                            />
                            {q.imagens?.map((img: string, i: number) => (
                              <img key={i} src={img} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginTop: 12, display: 'block' }} />
                            ))}
                            {q.simulados_alternativas?.map((a: any) => (
                              <div key={a.id} className="alt-hover-group" style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start', position: 'relative' }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                                  border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                                }}>
                                  {a.letra}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div 
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      onEditAlternativa(q.id, a.id, e.currentTarget.innerHTML);
                                      forceRepaginate();
                                    }}
                                    dangerouslySetInnerHTML={{ __html: a.texto }}
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
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (block.type === 'part_enunciado') {
                    const q = block.q;
                    return (
                      <div key={`b-${bIndex}`} style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                          fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                        }}>
                          {block.qIndex + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div 
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              onEditEnunciado(q.id, e.currentTarget.innerHTML);
                              forceRepaginate();
                            }}
                            dangerouslySetInnerHTML={{ __html: q.enunciado }}
                            style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                          />
                        </div>
                      </div>
                    );
                  }

                  if (block.type === 'part_img') {
                    return (
                      <div key={`b-${bIndex}`} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <div style={{ width: '28px', minWidth: '28px' }}></div>
                        <div style={{ flex: 1 }}>
                           <img src={block.imgUrl} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                        </div>
                      </div>
                    );
                  }

                  if (block.type === 'part_alt') {
                    const q = block.q;
                    const a = block.alt;
                    return (
                      <div key={`b-${bIndex}`} className="alt-hover-group" style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <div style={{ width: '28px', minWidth: '28px' }}></div>
                        <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                            border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                          }}>
                            {a.letra}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div 
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                onEditAlternativa(q.id, a.id, e.currentTarget.innerHTML);
                                forceRepaginate();
                              }}
                              dangerouslySetInnerHTML={{ __html: a.texto }}
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
            ))}
          </div>

        </div>
      ))}
    </div>
  );
}
