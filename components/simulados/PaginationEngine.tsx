import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HtmlContent } from '../HtmlContent';
import { Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { PageContent } from './PageContent';

interface PaginationEngineProps {
  questoes: any[];
  columns: number;
  fontSize: number;
  config: any;
  simulado: any;
  onEditEnunciado: (qId: string, newText: string) => void;
  onEditAlternativa: (qId: string, altId: string, newText: string) => void;
  onRemoveAlternativa: (qId: string, altId: string) => void;
  onToggleQuestion: (qId: string) => void;
  isEditHeaderMode?: boolean;
  headerLayout?: any;
  onUpdateHeaderField?: (key: string, newField: any) => void;
  pageA4Ref?: React.RefObject<HTMLDivElement>;
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
  onEditEnunciado, onEditAlternativa, onEditAlternativaImage, onRemoveAlternativa, onToggleQuestion,
  isEditHeaderMode, headerLayout, alternativasLayout, onUpdateHeaderField, pageA4Ref
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
      const avail1Px = avail1El ? avail1El.getBoundingClientRect().height : (297 - 75 - 18) * 3.7795;
      const availNPx = availNEl ? availNEl.getBoundingClientRect().height : (297 - 18 - 18) * 3.7795;

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

        const enunH = heights[`${q.id}-enunciado`] || 0;
        let totalH = enunH;
        
        const imgsH = (q.imagens || []).map((img: string, i: number) => {
          const h = heights[`${q.id}-img-${i}`] || 0;
          totalH += h + ALT_SPACING;
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
        } else {
          pushBlock({ type: 'part_enunciado', q, qIndex: idx }, enunH, questionMargin);
          (q.imagens || []).forEach((img: string, i: number) => {
             pushBlock({ type: 'part_img', q, imgUrl: img, imgIndex: i }, imgsH[i], ALT_SPACING);
          });
          
          if (q.tipo_questao === 'descritiva') {
             for (let i = 0; i < linhasResposta; i++) {
                const lineH = 28;
                const margin = i === 0 ? ALT_SPACING : 0;
                pushBlock({ type: 'part_descritiva_line', q, estiloEspaco }, lineH, margin);
             }
          } else {
            if (alternativasLayout === 'horizontal') {
              pushBlock({ type: 'part_alts_container', q }, altsH[0], ALT_SPACING);
            } else {
              (q.simulados_alternativas || []).forEach((a: any, i: number) => {
                 pushBlock({ type: 'part_alt', q, alt: a }, altsH[i], ALT_SPACING);
              });
            }
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
          position: 'absolute', 
          visibility: 'hidden', 
          top: 0, left: 0, 
          width: shadowColWidth,
          fontSize: `${fontSize}px`, 
          lineHeight: 1.6, 
          zIndex: -1000 
        }}
      >
        <div data-measure-avail-1 style={{ height: 'calc(297mm - 75mm - 18mm)' }} />
        <div data-measure-avail-n style={{ height: 'calc(297mm - 18mm - 18mm)' }} />

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
                <HtmlContent html={q.enunciado} style={{ wordBreak: 'break-word', marginBottom: 12 }} />
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

            {alternativasLayout === 'horizontal' ? (
              <div data-measure data-id={`${q.id}-alts-container`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                {q.simulados_alternativas?.map((a: any) => (
                  <div key={`shadow-alt-${a.id}`} style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                      border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                    }}>
                      {a.letra}
                    </div>
                    <div style={{ flex: 1 }}>
                      {a.imagem_url && <img src={a.imagem_url} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginBottom: 8, display: 'block' }} />}
                      <HtmlContent html={a.texto} style={{ wordBreak: 'break-word' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              q.simulados_alternativas?.map((a: any) => (
                <div key={`shadow-alt-${a.id}`} data-measure data-id={`${q.id}-alt-${a.id}`} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                    border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                  }}>
                    {a.letra}
                  </div>
                  <div style={{ flex: 1 }}>
                    {a.imagem_url && <img src={a.imagem_url} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginBottom: 8, display: 'block' }} />}
                    <HtmlContent html={a.texto} style={{ wordBreak: 'break-word' }} />
                  </div>
                </div>
              ))
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
              page={page} pIndex={pIndex} fontSize={fontSize} config={config} simulado={simulado} 
              onEditEnunciado={onEditEnunciado} onEditAlternativa={onEditAlternativa} 
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
                page={page} pIndex={pIndex} fontSize={fontSize} config={config} simulado={simulado} 
                onEditEnunciado={onEditEnunciado} onEditAlternativa={onEditAlternativa} 
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
