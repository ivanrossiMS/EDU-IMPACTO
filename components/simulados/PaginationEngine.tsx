import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HtmlContent } from '../HtmlContent';
import { Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { PageContent } from './PageContent';

interface PaginationEngineProps {
  questoes: any[];
  columns: number;
  enunciadoFontSize: number;
  alternativasFontSize: number;
  config: any;
  simulado: any;
  onEditEnunciado: (qId: string, newText: string) => void;
  onEditEnunciadoImage?: (qId: string, imgIndex: number, url: string) => void;
  onEditAlternativa: (qId: string, altId: string, newText: string) => void;
  onRemoveAlternativa: (qId: string, altId: string) => void;
  onToggleQuestion: (qId: string) => void;
  isEditHeaderMode?: boolean;
  headerLayout?: any;
  onUpdateHeaderField?: (key: string, newField: any) => void;
  pageA4Ref?: React.RefObject<HTMLDivElement | null>;
  alternativasLayout?: 'horizontal' | 'vertical';
  onEditAlternativaImage?: (qId: string, altId: string, url: string) => void;
  forceExtraPage?: boolean;
}

export function parseEnunciadoParts(enunciado: string, imagens: any[]) {
  const parts: { type: 'text'|'img', content?: string, url?: string, index?: number }[] = [];
  if (!enunciado) {
    if (imagens && imagens.length > 0) {
      imagens.forEach((url, i) => parts.push({ type: 'img', url, index: i }));
    }
    return parts;
  }

  let remaining = enunciado;
  const regex = /\[IMAGEM\s+(\d+)\]/i;
  
  while (true) {
    const match = remaining.match(regex);
    if (!match) {
      if (remaining.trim()) parts.push({ type: 'text', content: remaining });
      break;
    }
    
    const index = match.index!;
    const textBefore = remaining.substring(0, index);
    if (textBefore.trim()) {
      parts.push({ type: 'text', content: textBefore });
    }
    
    const imgIndex = parseInt(match[1], 10) - 1; 
    if (imagens && imgIndex >= 0 && imgIndex < imagens.length) {
      parts.push({ type: 'img', url: imagens[imgIndex], index: imgIndex });
    }
    
    remaining = remaining.substring(index + match[0].length);
  }
  
  if (imagens) {
    const referencedIndices = parts.filter(p => p.type === 'img').map(p => p.index);
    imagens.forEach((url, i) => {
      if (!referencedIndices.includes(i)) {
        parts.push({ type: 'img', url, index: i });
      }
    });
  }
  return parts;
}

const MM_TO_PX = 3.7795;
const PAGE_H = 297 * MM_TO_PX;
const HEADER_1 = 80 * MM_TO_PX; // Height of cover image header + margins
const HEADER_OTHER = 25 * MM_TO_PX;
const BOTTOM = 25 * MM_TO_PX;
const BLOCK_SPACING = 24; 
const ALT_SPACING = 12;

export function PaginationEngine({
  questoes, columns, enunciadoFontSize, alternativasFontSize, config, simulado,
  onEditEnunciado, onEditEnunciadoImage, onEditAlternativa, onEditAlternativaImage, onRemoveAlternativa, onToggleQuestion,
  isEditHeaderMode, headerLayout, alternativasLayout, onUpdateHeaderField, pageA4Ref, forceExtraPage
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

      const avail1El = shadow.querySelector('[data-measure-avail-1]');
      const availNEl = shadow.querySelector('[data-measure-avail-n]');
      const avail1Px = avail1El ? avail1El.getBoundingClientRect().height : (297 - 75 - 42) * 3.7795;
      const availNPx = availNEl ? availNEl.getBoundingClientRect().height : (297 - 18 - 42) * 3.7795;

      const newPages: any[] = [];
      let currentCols: any[][] = Array.from({length: columns}, () => []);
      let colIndex = 0;
      let currentY = 0;
      let pageIndex = 0;

      function getAvailableHeight() {
        return pageIndex === 0 ? avail1Px : availNPx;
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

      function pushBlock(block: any, h: number, marginToApply: number = 0) {
        if (currentY + marginToApply + h > getAvailableHeight() && currentY > 0) {
          advanceCol();
          marginToApply = 0; // First in col has no top margin
        }
        currentCols[colIndex].push({ ...block, renderMarginTop: marginToApply });
        currentY += marginToApply + h;
      }

      questoes.forEach((q, idx) => {
        let questionMargin = currentY > 0 ? BLOCK_SPACING : 0;

        const isNewDisciplina = idx === 0 || q.id_disciplina !== questoes[idx - 1].id_disciplina;
        if (isNewDisciplina && q.simulados_disciplinas?.nome) {
          const discId = `disc-${q.id_disciplina || 'unknown'}-${idx}`;
          const discH = heights[discId] || 0;
          pushBlock({ type: 'part_disciplina', q, discName: q.simulados_disciplinas.nome }, discH, questionMargin);
          questionMargin = BLOCK_SPACING; // Ensure margin between disc header and question
        }

        const parsedParts = parseEnunciadoParts(q.enunciado, q.imagens || []);
        let totalH = 0;
        const partHeights = parsedParts.map((part, pIdx) => {
          const h = heights[part.type === 'text' ? `${q.id}-enun-txt-${pIdx}` : `${q.id}-img-${part.index}`] || 0;
          totalH += h + (pIdx > 0 ? ALT_SPACING : 0);
          return h;
        });

        let altsH: number[] = [];
        if (alternativasLayout === 'horizontal') {
          const h = heights[`${q.id}-alts-container`] || 0;
          totalH += h + ALT_SPACING;
          altsH = [h];
        } else {
          altsH = (q.simulados_alternativas || []).map((a: any) => {
            const h = heights[`${q.id}-alt-${a.id}`] || 0;
            totalH += h + ALT_SPACING;
            return h;
          });
        }

        let descritivaH = 0;
        let linhasResposta = 5;
        let estiloEspaco = 'em_branco';
        if (q.tipo_questao === 'descritiva') {
          const match = q.enunciado?.match(/<meta name="linhas_resposta" content="(.*?)">/);
          if (match) {
            linhasResposta = parseInt(match[1], 10) || 5;
          }
          const matchEstilo = q.enunciado?.match(/<meta name="estilo_espaco" content="(.*?)">/);
          if (matchEstilo) {
            estiloEspaco = matchEstilo[1];
          }
          descritivaH = linhasResposta * 28 + 20; // 28px height per line + padding
          totalH += descritivaH + ALT_SPACING;
        }

        if (currentY + questionMargin + totalH <= getAvailableHeight()) {
          pushBlock({ type: 'full', q, qIndex: idx, linhasResposta, estiloEspaco }, totalH, questionMargin);
        } else if (alternativasLayout === 'horizontal' && totalH < 200) {
          // Orphan protection: Only for horizontal layout.
          // If it doesn't fit, don't split the question text from its horizontal alternatives.
          advanceCol();
          pushBlock({ type: 'full', q, qIndex: idx, linhasResposta, estiloEspaco }, totalH, 0);
        } else {
          // Orphan Protection: Abandon small remaining space if the whole question fits in a new column.
          const remainingSpace = getAvailableHeight() - currentY - questionMargin;
          const fifteenPercent = getAvailableHeight() * 0.15;
          
          if (remainingSpace < fifteenPercent && totalH <= getAvailableHeight()) {
             advanceCol();
             pushBlock({ type: 'full', q, qIndex: idx, linhasResposta, estiloEspaco }, totalH, 0);
             return; // go to next question
          }

          // Build generic render blocks for this question
          let renderBlocks: any[] = [];
          
          parsedParts.forEach((part, pIdx) => {
            if (part.type === 'text') {
              renderBlocks.push({ item: { type: 'part_enun_txt', q, content: part.content, isFirst: pIdx === 0, qIndex: idx }, h: partHeights[pIdx], margin: pIdx === 0 ? questionMargin : ALT_SPACING, category: 'enunciado_text' });
            } else {
              renderBlocks.push({ item: { type: 'part_img', q, imgUrl: part.url, imgIndex: part.index }, h: partHeights[pIdx], margin: pIdx === 0 ? questionMargin : ALT_SPACING, category: 'enunciado_img' });
            }
          });

          if (q.tipo_questao === 'descritiva') {
             for (let j = 0; j < linhasResposta; j++) {
                renderBlocks.push({ item: { type: 'part_descritiva_line', q, estiloEspaco }, h: 28, margin: j === 0 ? ALT_SPACING : 0, category: 'descritiva_line' });
             }
          } else {
            if (alternativasLayout === 'horizontal') {
              renderBlocks.push({ item: { type: 'part_alts_container', q }, h: altsH[0], margin: ALT_SPACING, category: 'alternativas_container' });
            } else {
              (q.simulados_alternativas || []).forEach((a: any, j: number) => {
                 renderBlocks.push({ item: { type: 'part_alt', q, alt: a }, h: altsH[j], margin: ALT_SPACING, category: 'alternativa' });
              });
            }
          }

          // Iterate and push with Heuristics
          let i = 0;
          while (i < renderBlocks.length) {
            const block = renderBlocks[i];
            const nextBlock = i + 1 < renderBlocks.length ? renderBlocks[i + 1] : null;

            // Heuristic A: Enunciado Text + Img indivisible if they fit together on a new page
            if (block.category === 'enunciado_text' && nextBlock?.category === 'enunciado_img') {
               const combinedH = block.h + block.margin + nextBlock.h + nextBlock.margin;
               if (currentY + combinedH > getAvailableHeight()) {
                  if (combinedH <= getAvailableHeight()) {
                     advanceCol();
                  }
               }
            }

            // Heuristic B: Alternativas "Rule of Minimum 2"
            if (block.category === 'alternativa') {
               const altsRemaining = renderBlocks.slice(i).filter(b => b.category === 'alternativa');
               const N = altsRemaining.length;
               
               if (N > 2) { 
                 let fitCount = 0;
                 let tempY = currentY;
                 for (let j = 0; j < N; j++) {
                    const margin = j === 0 ? block.margin : ALT_SPACING;
                    if (tempY + margin + altsRemaining[j].h <= getAvailableHeight() || tempY === 0) {
                       fitCount++;
                       tempY += margin + altsRemaining[j].h;
                    } else {
                       break;
                    }
                 }
                 
                 let K = fitCount;
                 if (K > 0 && K < N) {
                    if (K === 1) {
                       K = 0;
                    } else if (K === N - 1 && N >= 3) {
                       K = N - 2;
                    }
                 }
                 
                 if (K === 0 && currentY > 0) {
                    advanceCol();
                    continue; 
                 }
                 
                 if (K > 0 && K < N) {
                   for (let j = 0; j < K; j++) {
                      pushBlock(renderBlocks[i + j].item, renderBlocks[i + j].h, renderBlocks[i + j].margin);
                   }
                   i += K;
                   advanceCol();
                   continue;
                 }
               }
            }

            // Heuristic C: Descritiva lines "Rule of Minimum 3"
            if (block.category === 'descritiva_line') {
               const linesRemaining = renderBlocks.slice(i).filter(b => b.category === 'descritiva_line');
               const N = linesRemaining.length;
               
               if (N > 3) {
                 let fitCount = 0;
                 let tempY = currentY;
                 for (let j = 0; j < N; j++) {
                    const margin = j === 0 ? block.margin : 0;
                    if (tempY + margin + linesRemaining[j].h <= getAvailableHeight() || tempY === 0) {
                       fitCount++;
                       tempY += margin + linesRemaining[j].h;
                    } else {
                       break;
                    }
                 }
                 
                 let K = fitCount;
                 if (K > 0 && K < N) {
                    if (K < 3) {
                       K = 0;
                    } else if (K > N - 3) {
                       K = N - 3;
                    }
                 }
                 
                 if (K === 0 && currentY > 0) {
                    advanceCol();
                    continue; 
                 }
                 
                 if (K > 0 && K < N) {
                   for (let j = 0; j < K; j++) {
                      pushBlock(renderBlocks[i + j].item, renderBlocks[i + j].h, renderBlocks[i + j].margin);
                   }
                   i += K;
                   advanceCol();
                   continue;
                 }
               }
            }

            // Default push
            pushBlock(block.item, block.h, block.margin);
            i++;
          }
        }
      });

      if (currentY > 0 || colIndex > 0) {
        if (currentCols.some(col => col.length > 0)) {
          newPages.push(currentCols);
        }
      }

      if (newPages.length === 0) {
        newPages.push(Array.from({ length: columns }, () => []));
      }

      // Se for uma redação, sempre adiciona uma página 2 (para o fundo "demais páginas")
      if (simulado?.isRedacao && newPages.length === 1) {
        newPages.push(Array.from({ length: columns }, () => []));
      }

      if (forceExtraPage) {
        newPages.push(Array.from({ length: columns }, () => []));
      }

      setPages(newPages);
      setIsPaginating(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [questoes, columns, enunciadoFontSize, alternativasFontSize, trigger, forceExtraPage, headerLayout, alternativasLayout, simulado?.isRedacao]);

  const forceRepaginate = () => setTrigger(t => t + 1);
  const shadowColWidth = columns === 1 ? '174mm' : '81mm';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      
      <div 
        ref={shadowRef} 
        style={{ 
          position: 'absolute', 
          visibility: 'hidden', 
          top: 0, left: 0, 
          width: shadowColWidth,
          fontSize: `${enunciadoFontSize}px`, 
          lineHeight: 1.6, 
          zIndex: -1000 
        }}
      >
        <div data-measure-avail-1 style={{ height: 'calc(297mm - 75mm - 42mm)' }} />
        <div data-measure-avail-n style={{ height: 'calc(297mm - 18mm - 42mm)' }} />

        {questoes.map((q, idx) => {
          const isNewDisciplina = idx === 0 || q.id_disciplina !== questoes[idx - 1].id_disciplina;
          return (
            <div key={`shadow-${q.id}`}>
              {isNewDisciplina && q.simulados_disciplinas?.nome && (
                <div 
                  data-measure 
                  data-id={`disc-${q.id_disciplina || 'unknown'}-${idx}`}
                  style={{
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
                    gap: 8
                  }}
                >
                  {q.simulados_disciplinas.nome}
                </div>
              )}
              <div data-measure data-id={`${q.id}-enunciado`} style={{ display: 'flex', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
              }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {parseEnunciadoParts(q.enunciado, q.imagens || []).map((part, pIdx) => (
                  part.type === 'text' ? (
                    <div key={`txt-${pIdx}`} data-measure data-id={`${q.id}-enun-txt-${pIdx}`}>
                      <HtmlContent html={part.content || ''} style={{ wordBreak: 'break-word' }} />
                    </div>
                  ) : (
                    <img 
                      key={`img-${part.index}`}
                      data-measure 
                      data-id={`${q.id}-img-${part.index}`} 
                      src={part.url} 
                      style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginTop: pIdx > 0 ? 12 : 0, display: 'block' }} 
                    />
                  )
                ))}
              </div>
            </div>

            {alternativasLayout === 'horizontal' ? (
              <div data-measure data-id={`${q.id}-alts-container`} style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 12 }}>
                {(() => {
                  const imgWidths = q.simulados_alternativas
                    ?.filter((a: any) => a.imagem_url)
                    .map((a: any) => {
                      const parts = a.imagem_url.split('#w=');
                      return parts.length > 1 ? parseInt(parts[1]) : 250;
                    }) || [];
                  const maxImgWidth = imgWidths.length > 0 ? Math.max(...imgWidths) : null;

                  return q.simulados_alternativas?.map((a: any) => {
                    const urlParts = a.imagem_url ? a.imagem_url.split('#w=') : [];
                    const imgBaseUrl = urlParts[0];
                    const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                    const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                    const effectiveWidth = imgWidth || maxImgWidth;

                    return (
                      <div key={`shadow-alt-${a.id}`} style={{ 
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        flex: effectiveWidth ? '0 0 auto' : '1 1 200px'
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                          border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                        }}>
                          {a.letra}
                        </div>
                        <div style={{ flex: 1, position: 'relative', maxWidth: effectiveWidth ? `${effectiveWidth}px` : '100%' }}>
                          {a.imagem_url && <img src={imgBaseUrl} style={{ width: '100%', height: 'auto', borderRadius: 8, marginBottom: 8, display: 'block' }} />}
                          <HtmlContent html={a.texto} style={{ wordBreak: 'break-word' }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              (() => {
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
                  
                  return (
                    <div key={`shadow-alt-${a.id}`} data-measure data-id={`${q.id}-alt-${a.id}`} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                      <div style={{
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
                            </div>
                          </div>
                        )}
                        <HtmlContent html={a.texto} style={{ wordBreak: 'break-word' }} />
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        )})}
      </div>

      {isPaginating && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 20, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 12, marginBottom: 20 }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ fontWeight: 600 }}>Paginando documento...</span>
        </div>
      )}

      {/* Screen Preview */}
      <div className="no-print" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {!isPaginating && pages.map((page, pIndex) => (
          <div 
            key={`preview-page-${pIndex}`} 
            className="preview-area" 
            style={{ 
              width: '210mm', height: '297mm', background: 'white', 
              position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', boxSizing: 'border-box',
              marginBottom: '40px', overflow: 'hidden'
            }}
          >
            <PageContent 
              page={page} pIndex={pIndex} enunciadoFontSize={enunciadoFontSize} alternativasFontSize={alternativasFontSize} config={config} simulado={simulado} 
              onEditEnunciado={onEditEnunciado} onEditEnunciadoImage={onEditEnunciadoImage}
              onEditAlternativa={onEditAlternativa} 
              onRemoveAlternativa={onRemoveAlternativa} onToggleQuestion={onToggleQuestion} forceRepaginate={forceRepaginate} 
              isEditHeaderMode={isEditHeaderMode} headerLayout={headerLayout} onUpdateHeaderField={onUpdateHeaderField} pageA4Ref={pageA4Ref}
              alternativasLayout={alternativasLayout} onEditAlternativaImage={onEditAlternativaImage}
            />
          </div>
        ))}
      </div>

      {/* Print Root Portal */}
      {!isPaginating && typeof document !== 'undefined' && createPortal(
        <div id="print-root">
          {pages.map((page, pIndex) => (
            <div 
              key={`print-page-${pIndex}`} 
              className="print-page" 
              style={{ 
                width: '210mm', height: '297mm', background: 'white', 
                position: 'relative', boxSizing: 'border-box',
                overflow: 'hidden', pageBreakAfter: 'always', breakAfter: 'page'
              }}
            >
              <PageContent 
                page={page} pIndex={pIndex} enunciadoFontSize={enunciadoFontSize} alternativasFontSize={alternativasFontSize} config={config} simulado={simulado} 
                onEditEnunciado={onEditEnunciado} onEditEnunciadoImage={onEditEnunciadoImage}
                onEditAlternativa={onEditAlternativa} 
                onRemoveAlternativa={onRemoveAlternativa} onToggleQuestion={onToggleQuestion} forceRepaginate={forceRepaginate} 
                isEditHeaderMode={isEditHeaderMode} headerLayout={headerLayout} onUpdateHeaderField={onUpdateHeaderField}
                alternativasLayout={alternativasLayout} onEditAlternativaImage={onEditAlternativaImage}
              />
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
