import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HtmlContent } from '../HtmlContent';
import { Loader2, X, BookOpen } from 'lucide-react';
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
  readOnly?: boolean;
  onEditAlternativaImage?: (qId: string, altId: string, url: string) => void;
  forceExtraPage?: boolean;
  showMargins?: boolean;
  topMarginOffset?: number;
  onTopMarginOffsetChange?: (offset: number) => void;
  bottomMarginOffset?: number;
  onBottomMarginOffsetChange?: (offset: number) => void;
  leftMarginOffset?: number;
  onLeftMarginOffsetChange?: (offset: number) => void;
  rightMarginOffset?: number;
  onRightMarginOffsetChange?: (offset: number) => void;
  adicionarPaginaRedacao?: boolean;
}

export function parseEnunciadoParts(enunciado: string, imagens: any[]) {
  const parts: { type: 'text'|'img'|'lines', content?: string, url?: string, index?: number, count?: number, style?: 'pautado'|'branco' }[] = [];
  if (!enunciado) {
    if (imagens && imagens.length > 0) {
      imagens.forEach((url, i) => parts.push({ type: 'img', url, index: i }));
    }
    return parts;
  }

  let remaining = enunciado;
  
  if (imagens && imagens.length > 0) {
    // Remove HTML comments that might contain old img tags
    remaining = remaining.replace(/<!--[\s\S]*?-->/g, '');
    
    // Replace raw <img ...> with [IMAGEM N] if it matches a known image
    remaining = remaining.replace(/<img[^>]+src=(?:["']([^"']+)["']|([^ >]+))[^>]*>/gi, (match, src1, src2) => {
      let src = src1 || src2;
      if (!src) return match;
      
      let cleanSrc = src.split('#')[0].split('?')[0].replace(/&amp;/g, '&');
      try { cleanSrc = decodeURIComponent(cleanSrc); } catch(e) {}
      
      const idx = imagens.findIndex((imgUrl: string) => {
         if (!imgUrl) return false;
         let cleanImg = imgUrl.split('#')[0].split('?')[0].replace(/&amp;/g, '&');
         try { cleanImg = decodeURIComponent(cleanImg); } catch(e) {}
         
         const filename1 = cleanSrc.split('/').pop();
         const filename2 = cleanImg.split('/').pop();
         if (filename1 && filename2 && filename1 === filename2 && filename1.length > 5) return true;
         
         return cleanImg.includes(cleanSrc) || cleanSrc.includes(cleanImg);
      });
      
      if (idx !== -1) {
        return `[IMAGEM ${idx + 1}]`;
      }
      return match;
    });
  }

  const regex = /(\[IMAGEM\s+\d+\]|\[LINHAS_PAUTADAS\s*:\s*\d+\]|\[ESPACO_BRANCO\s*:\s*\d+\])/i;
  
  while (true) {
    const match = remaining.match(regex);
    if (!match) {
      if (remaining.trim()) parts.push({ type: 'text', content: remaining });
      break;
    }
    
    const index = match.index!;
    let textBefore = remaining.substring(0, index);
    textBefore = textBefore.replace(/(<br\s*\/?>\s*)+$/i, '').replace(/(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/i, '');
    if (textBefore.trim()) {
      parts.push({ type: 'text', content: textBefore });
    }
    
    const tag = match[0].toUpperCase();
    if (tag.startsWith('[IMAGEM')) {
      const imgMatch = tag.match(/\d+/);
      if (imgMatch) {
        const imgIndex = parseInt(imgMatch[0], 10) - 1; 
        if (imagens && imgIndex >= 0 && imgIndex < imagens.length) {
          parts.push({ type: 'img', url: imagens[imgIndex], index: imgIndex });
        }
      }
    } else if (tag.startsWith('[LINHAS')) {
      const countMatch = tag.match(/\d+/);
      if (countMatch) {
        parts.push({ type: 'lines', count: parseInt(countMatch[0], 10), style: 'pautado' });
      }
    } else if (tag.startsWith('[ESPACO')) {
      const countMatch = tag.match(/\d+/);
      if (countMatch) {
        parts.push({ type: 'lines', count: parseInt(countMatch[0], 10), style: 'branco' });
      }
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

export function splitTextIntoChunks(htmlText: string): string[] {
  if (!htmlText || !htmlText.trim()) return [htmlText || ''];

  const metaRegex = /(<meta[^>]+>)/gi;
  const metaMatch = htmlText.match(metaRegex);
  let metaPrefix = '';
  let cleanText = htmlText;
  if (metaMatch) {
    metaPrefix = metaMatch.join('\n') + '\n';
    cleanText = cleanText.replace(metaRegex, '');
  }

  // 1. Split by HTML block tags: <p>, <div>, <blockquote>, <h1-6>, <ul>, <ol>, <table>, <section>, <article>
  const blockRegex = /(?=(?:<p[ >]|<div[ >]|<blockquote[ >]|<h[1-6][ >]|<ul[ >]|<ol[ >]|<table[ >]|<section[ >]|<article[ >]|<hr[ >]))/gi;
  let rawChunks = cleanText.split(blockRegex).filter(c => c.trim().length > 0);

  if (rawChunks.length === 0) {
    rawChunks = [cleanText];
  }

  const finalChunks: string[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];

    // If chunk has <br> tags
    const brMatches = chunk.match(/<br\s*\/?>/gi);
    if (brMatches && brMatches.length >= 2) {
      const brParts = chunk.split(/(?<=<br\s*\/?>)/gi).filter(s => s.trim().length > 0);
      let curr = '';
      for (const part of brParts) {
        curr += part;
        if (curr.length > 200 || part.match(/<br\s*\/?>/i)) {
          finalChunks.push(curr);
          curr = '';
        }
      }
      if (curr.trim()) finalChunks.push(curr);
      continue;
    }

    // If chunk plain text > 250 chars, split by sentences
    const plain = chunk.replace(/<[^>]+>/g, '').trim();
    if (plain.length > 250) {
      const sentenceRegex = /(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"<]|<)/g;
      const sentences = chunk.split(sentenceRegex).filter(s => s.trim().length > 0);

      if (sentences.length > 1) {
        let curr = '';
        for (const sent of sentences) {
          const combinedPlain = (curr + ' ' + sent).replace(/<[^>]+>/g, '').trim();
          if (curr && combinedPlain.length > 200) {
            finalChunks.push(curr + ' ');
            curr = sent;
          } else {
            curr = curr ? curr + ' ' + sent : sent;
          }
        }
        if (curr.trim()) finalChunks.push(curr);
        continue;
      }

      // If no sentence breaks but plain text > 300 chars, split by word chunks (~35 words)
      const words = chunk.split(/\s+/);
      if (words.length > 35) {
        let currWords: string[] = [];
        for (const w of words) {
          currWords.push(w);
          if (currWords.length >= 35) {
            finalChunks.push(currWords.join(' ') + ' ');
            currWords = [];
          }
        }
        if (currWords.length > 0) finalChunks.push(currWords.join(' '));
        continue;
      }
    }

    finalChunks.push(chunk);
  }

  if (finalChunks.length === 0) return [htmlText];
  if (metaPrefix) {
    finalChunks[0] = metaPrefix + finalChunks[0];
  }
  return finalChunks;
}

const MM_TO_PX = 3.7795;
const PAGE_H = 297 * MM_TO_PX;
const HEADER_1 = 80 * MM_TO_PX; // Height of cover image header + margins
const HEADER_OTHER = 25 * MM_TO_PX;
const BOTTOM = 25 * MM_TO_PX;
const BLOCK_SPACING = 12; 
const ALT_SPACING = 8;
const CHUNK_SPACING = 6;

export function PaginationEngine({
  questoes, columns, enunciadoFontSize, alternativasFontSize, config, simulado,
  onEditEnunciado, onEditEnunciadoImage, onEditAlternativa, onEditAlternativaImage, onRemoveAlternativa, onToggleQuestion,
  isEditHeaderMode, headerLayout, alternativasLayout, onUpdateHeaderField, pageA4Ref, forceExtraPage,
  showMargins, topMarginOffset, onTopMarginOffsetChange, bottomMarginOffset, onBottomMarginOffsetChange,
  leftMarginOffset, onLeftMarginOffsetChange, rightMarginOffset, onRightMarginOffsetChange,
  readOnly = false, adicionarPaginaRedacao
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
      const avail1Px = (avail1El ? avail1El.getBoundingClientRect().height : (297 - 75 - 42) * 3.7795) - (bottomMarginOffset || 0) - (topMarginOffset || 0);
      const availNPx = (availNEl ? availNEl.getBoundingClientRect().height : (297 - 18 - 42) * 3.7795) - (bottomMarginOffset || 0) - (topMarginOffset || 0);

      const newPages: any[] = [];
      let currentCols: any[][] = Array.from({length: columns}, () => []);
      let colIndex = 0;
      let currentY = 0;
      let pageIndex = 0;

      function getAvailableHeight() {
        const baseAvail = pageIndex === 0 ? avail1Px : availNPx;
        return Math.max(100, baseAvail - 40);
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
        const groupedParts: any[] = [];
        parsedParts.forEach((part, pIdx) => {
          const p = { ...part, originalIndex: pIdx };
          if (p.type === 'text') {
            groupedParts.push(p);
          } else if (p.type === 'lines') {
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

        let totalH = 0;
        groupedParts.forEach((group, gIdx) => {
          let h = 0;
          if (group.type === 'text') {
            const fullH = heights[`${q.id}-enun-txt-${group.originalIndex}`];
            if (fullH && fullH > 0) {
              h = fullH;
            } else {
              const chunks = splitTextIntoChunks(group.content || '');
              chunks.forEach((chunk, cIdx) => {
                const rawH = heights[`${q.id}-enun-txt-${group.originalIndex}-c-${cIdx}`] || 0;
                h += rawH;
              });
            }
          } else if (group.type === 'lines') {
            h = group.count * 28; // Each line is 28px tall
          } else {
            h = heights[`${q.id}-img-group-${gIdx}`] || 0;
          }
          const margin = gIdx > 0 ? (group.type === 'lines' ? 8 : ALT_SPACING) : 0;
          totalH += h + margin;
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
          
          groupedParts.forEach((group, gIdx) => {
            if (group.type === 'text') {
              const chunks = splitTextIntoChunks(group.content || '');
              chunks.forEach((chunk, cIdx) => {
                const rawH = heights[`${q.id}-enun-txt-${group.originalIndex}-c-${cIdx}`] || 0;
                const h = rawH > 0 ? rawH : 20;
                const isFirstChunk = group.originalIndex === 0 && cIdx === 0;
                renderBlocks.push({ 
                  item: { 
                    type: 'part_enun_txt', 
                    q, 
                    content: chunk, 
                    originalIndex: group.originalIndex, 
                    chunkIndex: cIdx,
                    totalChunks: chunks.length,
                    isFirst: isFirstChunk, 
                    qIndex: idx 
                  }, 
                  h, 
                  margin: isFirstChunk ? questionMargin : 0, 
                  category: 'enunciado_text' 
                });
              });
            } else if (group.type === 'lines') {
              for (let j = 0; j < group.count; j++) {
                renderBlocks.push({ item: { type: 'part_enun_lines_line', q, originalIndex: group.originalIndex, isFirstInGroup: j === 0, count: group.count, isFirst: group.originalIndex === 0 && j === 0, qIndex: idx, style: group.style, lineIndex: j }, h: 28, margin: j === 0 ? (group.originalIndex === 0 ? questionMargin : 8) : 0, category: 'enunciado_lines' });
              }
            } else {
              const h = heights[`${q.id}-img-group-${gIdx}`] || 0;
              renderBlocks.push({ item: { type: 'part_img_group', q, images: group.images, isFirst: group.images[0].originalIndex === 0, qIndex: idx }, h, margin: group.images[0].originalIndex === 0 ? questionMargin : ALT_SPACING, category: 'enunciado_img' });
            }
          });

          if (q.tipo_questao === 'descritiva') {
             for (let j = 0; j < linhasResposta; j++) {
                renderBlocks.push({ item: { type: 'part_descritiva_line', q, estiloEspaco, lineIndex: j }, h: 28, margin: j === 0 ? 8 : 0, category: 'descritiva_line' });
             }
          } else {
            if (alternativasLayout === 'horizontal') {
              renderBlocks.push({ item: { type: 'part_alts_container', q }, h: altsH[0], margin: 8, category: 'alternativas_container' });
            } else {
              (q.simulados_alternativas || []).forEach((a: any, j: number) => {
                 renderBlocks.push({ item: { type: 'part_alt', q, alt: a }, h: altsH[j], margin: 8, category: 'alternativa' });
              });
            }
          }

          // Iterate and push with Heuristics
          let i = 0;
          while (i < renderBlocks.length) {
            const block = renderBlocks[i];
            const nextBlock = i + 1 < renderBlocks.length ? renderBlocks[i + 1] : null;

            // Heuristic 0: Orphan Question Header Protection
            // If this block starts a question (isFirst is true) and remaining space is < 130px, move question start to next column/page
            if (block.item?.isFirst && currentY > 0) {
              const remainingSpace = getAvailableHeight() - currentY;
              if (remainingSpace < 130) {
                advanceCol();
                block.margin = 0;
              }
            }

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

      if (forceExtraPage || adicionarPaginaRedacao) {
        newPages.push(Array.from({ length: columns }, () => []));
      }

      const mergedPages = newPages.map((page: any[]) => {
        return page.map((col: any[]) => {
          const newCol: any[] = [];
          col.forEach((block: any) => {
            const prevBlock = newCol.length > 0 ? newCol[newCol.length - 1] : null;
            const blockQId = block.q?.id || block.q?._internalId;
            const prevQId = prevBlock?.q?.id || prevBlock?.q?._internalId;

            if (
              prevBlock &&
              prevBlock.type === 'part_enun_txt' &&
              block.type === 'part_enun_txt' &&
              blockQId &&
              blockQId === prevQId &&
              prevBlock.originalIndex === block.originalIndex
            ) {
              prevBlock.content = (prevBlock.content || '') + (block.content || '');
              const start = prevBlock.startChunkIndex ?? prevBlock.chunkIndex ?? 0;
              const end = block.endChunkIndex ?? block.chunkIndex ?? 0;
              prevBlock.startChunkIndex = start;
              prevBlock.endChunkIndex = end;
              if (block.totalChunks) prevBlock.totalChunks = block.totalChunks;
            } else {
              newCol.push({
                ...block,
                startChunkIndex: block.startChunkIndex ?? block.chunkIndex ?? 0,
                endChunkIndex: block.endChunkIndex ?? block.chunkIndex ?? 0,
              });
            }
          });
          return newCol;
        });
      });

      setPages(mergedPages);
      setIsPaginating(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [questoes, columns, enunciadoFontSize, alternativasFontSize, trigger, forceExtraPage, headerLayout, alternativasLayout, simulado?.isRedacao, adicionarPaginaRedacao, topMarginOffset, bottomMarginOffset, leftMarginOffset, rightMarginOffset]);

  const forceRepaginate = () => setTrigger(t => t + 1);
  const leftOffsetPx = leftMarginOffset || 0;
  const rightOffsetPx = rightMarginOffset || 0;
  const colWidthMm = columns === 1 
    ? (174 - (leftOffsetPx + rightOffsetPx) / 3.7795) 
    : ((174 - 10) / columns - (leftOffsetPx + rightOffsetPx) / (3.7795 * columns));
  const shadowColWidth = `${Math.max(40, colWidthMm)}mm`;

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
          color: '#000',
          textAlign: 'justify',
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
                    {q.simulados_disciplinas.nome}
                  </div>
                  <div style={{ flex: 1, height: 2, background: 'linear-gradient(to right, #cbd5e1, transparent)' }} />
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

                  return groupedParts.map((group, gIdx) => (
                    group.type === 'text' ? (
                      (() => {
                        const chunks = splitTextIntoChunks(group.content || '');
                        const isFirstGroup = group.originalIndex === 0;
                        return (
                          <React.Fragment key={`txt-grp-${group.originalIndex}`}>
                            <div data-measure data-id={`${q.id}-enun-txt-${group.originalIndex}`} style={{ display: 'flex', gap: 10, width: '100%' }}>
                              <div style={{ width: '28px', height: '28px', minWidth: '28px' }} />
                              <div style={{ flex: 1, minWidth: 0, display: 'flow-root' }}>
                                <HtmlContent html={group.content || ''} style={{ wordBreak: 'break-word' }} />
                              </div>
                            </div>
                            {chunks.map((chunk, cIdx) => (
                              <div key={`txt-${group.originalIndex}-${cIdx}`} data-measure data-id={`${q.id}-enun-txt-${group.originalIndex}-c-${cIdx}`} style={{ width: '100%', display: 'flow-root' }}>
                                <HtmlContent html={chunk} style={{ wordBreak: 'break-word' }} />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })()
                    ) : group.type === 'lines' ? (
                      null
                    ) : (
                      (() => {
                        const firstImg = group.images[0];
                        const firstHashIndex = firstImg.url ? firstImg.url.indexOf('#') : -1;
                        const firstHashStr = firstHashIndex >= 0 ? firstImg.url.substring(firstHashIndex + 1) : '';
                        const firstParams = new URLSearchParams(firstHashStr);
                        const firstAlign = firstParams.get('a') || 'center';
                        const groupJustify = firstAlign === 'left' ? 'flex-start' : firstAlign === 'right' ? 'flex-end' : 'center';

                        return (
                          <div 
                            key={`img-group-${gIdx}`} 
                            data-measure 
                            data-id={`${q.id}-img-group-${gIdx}`} 
                            style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: groupJustify, marginTop: gIdx > 0 ? 12 : 0 }}
                          >
                            {group.images.map((imgPart: any) => {
                          const hashIndex = imgPart.url ? imgPart.url.indexOf('#') : -1;
                          const imgBaseUrl = hashIndex >= 0 ? imgPart.url?.substring(0, hashIndex) : (imgPart.url || '');
                          const hashStr = hashIndex >= 0 ? imgPart.url?.substring(hashIndex + 1) : '';
                          const params = new URLSearchParams(hashStr || '');
                          const imgWidthStr = params.get('w');
                          const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : 600;

                          return (
                            <img 
                              key={`img-${imgPart.index}-${imgPart.originalIndex}`}
                              src={imgBaseUrl} 
                              style={{ width: imgWidth ? `${imgWidth}px` : 'auto', maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} 
                            />
                          );
                        })}
                          </div>
                        );
                      })()
                    )
                  ));
                })()}
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

      {isPaginating && pages.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 20, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 12, marginBottom: 20 }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ fontWeight: 600 }}>Paginando documento...</span>
        </div>
      )}

      {/* Screen Preview */}
      <div className="no-print" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        {isPaginating && pages.length > 0 && (
          <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 50, background: 'rgba(59,130,246,0.9)', color: 'white', padding: '8px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Loader2 className="animate-spin" size={16} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Atualizando...</span>
          </div>
        )}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isPaginating ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          {pages.map((page, pIndex) => (
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
              page={page} 
              pIndex={pIndex} 
              enunciadoFontSize={enunciadoFontSize} 
              alternativasFontSize={alternativasFontSize} 
              config={config} 
              simulado={simulado} 
              onEditEnunciado={onEditEnunciado} 
              onEditEnunciadoImage={onEditEnunciadoImage}
              onEditAlternativa={onEditAlternativa} 
              onRemoveAlternativa={onRemoveAlternativa} 
              onToggleQuestion={onToggleQuestion} 
              forceRepaginate={forceRepaginate} 
              isEditHeaderMode={isEditHeaderMode} 
              headerLayout={headerLayout} 
              onUpdateHeaderField={onUpdateHeaderField} 
              pageA4Ref={pIndex === 0 ? pageA4Ref : undefined}
              alternativasLayout={alternativasLayout} 
              onEditAlternativaImage={onEditAlternativaImage}
              showMargins={showMargins}
              topMarginOffset={topMarginOffset} 
              onTopMarginOffsetChange={onTopMarginOffsetChange}
              bottomMarginOffset={bottomMarginOffset} 
              onBottomMarginOffsetChange={onBottomMarginOffsetChange}
              leftMarginOffset={leftMarginOffset} 
              onLeftMarginOffsetChange={onLeftMarginOffsetChange}
              rightMarginOffset={rightMarginOffset} 
              onRightMarginOffsetChange={onRightMarginOffsetChange}
              readOnly={readOnly}
              totalPages={pages.length}
              adicionarPaginaRedacao={adicionarPaginaRedacao}
            />
          </div>
        ))}
        </div>
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
                page={page} 
                pIndex={pIndex}
                enunciadoFontSize={enunciadoFontSize} 
                alternativasFontSize={alternativasFontSize} 
                config={config} 
                simulado={simulado} 
                onEditEnunciado={onEditEnunciado} 
                onEditEnunciadoImage={onEditEnunciadoImage}
                onEditAlternativa={onEditAlternativa} 
                onRemoveAlternativa={onRemoveAlternativa} 
                onToggleQuestion={onToggleQuestion} 
                forceRepaginate={forceRepaginate} 
                isEditHeaderMode={isEditHeaderMode} 
                headerLayout={headerLayout} 
                onUpdateHeaderField={onUpdateHeaderField}
                alternativasLayout={alternativasLayout} 
                onEditAlternativaImage={onEditAlternativaImage}
                showMargins={showMargins}
                topMarginOffset={topMarginOffset} 
                onTopMarginOffsetChange={onTopMarginOffsetChange}
                bottomMarginOffset={bottomMarginOffset} 
                onBottomMarginOffsetChange={onBottomMarginOffsetChange}
                leftMarginOffset={leftMarginOffset} 
                onLeftMarginOffsetChange={onLeftMarginOffsetChange}
                rightMarginOffset={rightMarginOffset} 
                onRightMarginOffsetChange={onRightMarginOffsetChange}
                readOnly={readOnly}
                totalPages={pages.length}
                adicionarPaginaRedacao={adicionarPaginaRedacao}
              />
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
