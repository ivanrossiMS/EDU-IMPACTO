'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, ChevronDown, ChevronUp, Image as ImageIcon,
  Loader2, Sparkles, Plus, X, ZoomIn, ZoomOut, CheckCircle, Upload, Edit, FileText, BookOpen,
  ArrowUp, ArrowDown, ArrowUpDown, Target, RefreshCw, CheckCircle2, ListChecks, AlertCircle,
  Copy, Check, AlignLeft, AlignJustify, Maximize2, PenTool, Lightbulb, Minus
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isQuestionForRequisicao, getQuestionCorrectAnswer, syncQuestionGabarito } from '@/lib/utils'
import { cleanEnunciadoHtml } from '@/components/simulados/PaginationEngine'
import { HtmlContent, unpackMasksAndFormulas } from '@/components/HtmlContent'
import { Questao } from '@/components/simulados/ProvaPreviewModal'
import { QuestaoUploadModal } from '@/components/simulados/QuestaoUploadModal'

interface QuestoesEditorProps {
  questoes: Questao[]
  setQuestoes: React.Dispatch<React.SetStateAction<Questao[]>>
  showAddQuestao?: boolean
  defaultDisciplinaId?: string
  defaultProfessorId?: string
  defaultRequisicaoId?: string
  readOnly?: boolean
  disciplinas?: any[]
  requisicoes?: any[]
  onReenviarArquivo?: () => void
  cotaQuestoes?: number
  sidebarContent?: React.ReactNode
  footerContent?: React.ReactNode
  onSaveQuestoes?: (updatedQuestoes: Questao[]) => Promise<void> | void
  isSaving?: boolean
}

export function QuestoesEditor({ 
  questoes, 
  setQuestoes, 
  showAddQuestao = true, 
  defaultDisciplinaId, 
  defaultProfessorId, 
  defaultRequisicaoId,
  readOnly = false,
  disciplinas,
  requisicoes,
  onReenviarArquivo,
  cotaQuestoes,
  sidebarContent,
  footerContent,
  onSaveQuestoes,
  isSaving = false
}: QuestoesEditorProps) {
  const [generatingAiFor, setGeneratingAiFor] = useState<number | null>(null)
  const [disciplinasList, setDisciplinasList] = useState<any[]>(disciplinas || [])
  const [reorderOpen, setReorderOpen] = useState<string | null>(null)
  const [activeAltLines, setActiveAltLines] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerSave = (updatedList: Questao[], immediate: boolean = false) => {
    if (!onSaveQuestoes) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    const execute = async () => {
      try {
        setSaveStatus('saving')
        await onSaveQuestoes(updatedList)
        setSaveStatus('saved')
        saveTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle')
        }, 2500)
      } catch (err) {
        console.error('Erro ao auto-salvar questões:', err)
        setSaveStatus('error')
      }
    }

    if (immediate) {
      setTimeout(execute, 0)
    } else {
      setTimeout(() => setSaveStatus('saving'), 0)
      saveTimeoutRef.current = setTimeout(execute, 500)
    }
  }

  const [copiedTag, setCopiedTag] = useState<string | null>(null)

  const handleCopyTag = (tag: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tag).catch(() => {})
      setCopiedTag(tag)
      setTimeout(() => setCopiedTag(null), 2000)
    }
  }

  const getImgSrc = (img: any): string => {
    if (!img) return ''
    if (typeof img === 'string') return img.split('#')[0]
    return (img.src || '').split('#')[0]
  }

  const appendImageAtFinal = (rawHtml: string, tag: string): string => {
    let unpacked = unpackMasksAndFormulas(rawHtml || '')

    // Separate any meta tags at the end
    const metaRegex = /(?:\s*<meta[^>]+>)+$/gi
    const metaMatch = unpacked.match(metaRegex)
    let content = unpacked.replace(metaRegex, '').trim()

    // Remove ALL existing occurrences of this image mask
    const num = tag.match(/\d+/)?.[0] || '1'
    const tagRegex = new RegExp(`(<(?:p|div)[^>]*>\\s*)?\\[IMAGEM\\s*${num}\\](\\s*<\\/(?:p|div)>)?|(\\[IMAGEM\\s*${num}\\])`, 'gi')
    content = content.replace(tagRegex, '').trim()

    // Check if there are lines of answer like [LINHAS_PAUTADAS:N] or [ESPACO_BRANCO:N] at the end
    const linesRegex = /(?:<p>\s*)?\[(?:LINHAS_PAUTADAS|ESPACO_BRANCO)\s*:\s*\d+\](?:\s*<\/p>)?$/gi
    const linesMatch = content.match(linesRegex)
    let linesStr = ''
    if (linesMatch) {
      linesStr = linesMatch[0]
      content = content.replace(linesRegex, '').trim()
    }

    // Strip trailing empty paragraphs or breaks
    let prev = ''
    while (content !== prev) {
      prev = content
      content = content
        .replace(/(?:<p\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/p>|<div\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/div>|<br\s*\/?>)+$/gi, '')
        .trim()
    }

    const finalTag = `[IMAGEM ${num}]`
    let result = ''
    if (linesStr) {
      result = content ? `${content}<p>${finalTag}</p>${linesStr}` : `<p>${finalTag}</p>${linesStr}`
    } else {
      result = content ? `${content}<p>${finalTag}</p>` : `<p>${finalTag}</p>`
    }
    return metaMatch ? `${result}${metaMatch[0]}` : result
  }

  const prependImageAtInicio = (rawHtml: string, tag: string): string => {
    let unpacked = unpackMasksAndFormulas(rawHtml || '')

    const metaRegex = /(?:\s*<meta[^>]+>)+$/gi
    const metaMatch = unpacked.match(metaRegex)
    let content = unpacked.replace(metaRegex, '').trim()

    // Remove ALL existing occurrences of this image mask
    const num = tag.match(/\d+/)?.[0] || '1'
    const tagRegex = new RegExp(`(<(?:p|div)[^>]*>\\s*)?\\[IMAGEM\\s*${num}\\](\\s*<\\/(?:p|div)>)?|(\\[IMAGEM\\s*${num}\\])`, 'gi')
    content = content.replace(tagRegex, '').trim()

    // Strip leading empty paragraphs or breaks
    let prev = ''
    while (content !== prev) {
      prev = content
      content = content
        .replace(/^(?:<p\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/p>|<div\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/div>|<br\s*\/?>)+/gi, '')
        .trim()
    }

    const finalTag = `[IMAGEM ${num}]`
    const result = content ? `<p>${finalTag}</p>${content}` : `<p>${finalTag}</p>`
    return metaMatch ? `${result}${metaMatch[0]}` : result
  }

  const getImagePlacement = (enunciadoHtml: string, imgIdx: number): 'inicio' | 'final' | 'texto' => {
    if (!enunciadoHtml) return 'inicio'
    const tag = `[IMAGEM ${imgIdx + 1}]`
    const upper = enunciadoHtml.toUpperCase()
    const tagIdx = upper.indexOf(tag)
    
    if (tagIdx === -1) {
      return 'inicio'
    }
    
    const textBefore = cleanEnunciadoHtml(enunciadoHtml.substring(0, tagIdx)).replace(/<[^>]+>/g, '').trim()
    if (!textBefore) {
      return 'inicio'
    }

    const endOfTag = tagIdx + tag.length
    const textAfter = cleanEnunciadoHtml(enunciadoHtml.substring(endOfTag))
      .replace(/<[^>]+>/g, '')
      .replace(/\[(?:LINHAS_PAUTADAS|ESPACO_BRANCO)\s*:\s*\d+\]/gi, '')
      .replace(/\[IMAGEM\s*\d+\]/gi, '')
      .trim()

    if (!textAfter) {
      return 'final'
    }

    return 'texto'
  }

  const lastEnunciadoCaretRef = useRef<{ qIdx: number; range: Range } | null>(null)

  const saveCaret = (targetQIdx: number) => {
    try {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const el = document.getElementById(`enunciado-editor-${targetQIdx}`)
      if (el && (el === range.startContainer || el.contains(range.startContainer))) {
        lastEnunciadoCaretRef.current = {
          qIdx: targetQIdx,
          range: range.cloneRange()
        }
      }
    } catch (err) {}
  }

  const handlePosicionarNoTexto = (qIdx: number, imgIdx: number) => {
    const q = questoes[qIdx]
    if (!q) return

    const tag = `[IMAGEM ${imgIdx + 1}]`
    const editorEl = document.getElementById(`enunciado-editor-${qIdx}`)

    // 1. Identify target range (cursor inside this question's editor)
    let targetRange: Range | null = null
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorEl && (editorEl === sel.anchorNode || editorEl.contains(sel.anchorNode))) {
      targetRange = sel.getRangeAt(0)
    } else if (lastEnunciadoCaretRef.current && lastEnunciadoCaretRef.current.qIdx === qIdx && editorEl) {
      targetRange = lastEnunciadoCaretRef.current.range
    }

    if (editorEl && targetRange) {
      try {
        // Remove existing occurrences of this image's tag before inserting at cursor
        const existingMasks = editorEl.querySelectorAll('.tag-mask')
        existingMasks.forEach(span => {
          const mask = span.getAttribute('data-mask') || span.textContent || ''
          if (mask.includes(tag)) span.remove()
        })
        const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null)
        let n = walker.nextNode()
        while (n) {
          if (n.nodeValue && n.nodeValue.includes(tag)) {
            n.nodeValue = n.nodeValue.replace(tag, '')
          }
          n = walker.nextNode()
        }

        const textNode = document.createTextNode(` ${tag} `)
        targetRange.deleteContents()
        targetRange.insertNode(textNode)

        const nextRange = document.createRange()
        nextRange.setStartAfter(textNode)
        nextRange.collapse(true)
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(nextRange)
        }

        const rawHtml = editorEl.innerHTML
        const unpacked = unpackMasksAndFormulas(rawHtml)
        updateQuestao(qIdx, 'enunciado', cleanEnunciadoHtml(unpacked))
        return
      } catch (err) {
        console.error('Erro ao inserir máscara no cursor:', err)
      }
    }

    // Fallback if no cursor was active inside this question's editor: append at inicio
    const rawHtml = q.enunciado || ''
    const newHtml = prependImageAtInicio(rawHtml, tag)
    updateQuestao(qIdx, 'enunciado', newHtml)
    if (editorEl) editorEl.focus()
  }

  const setImagePlacement = (qIdx: number, imgIdx: number, target: 'inicio' | 'final') => {
    const q = questoes[qIdx]
    if (!q) return

    const tag = `[IMAGEM ${imgIdx + 1}]`
    const editorEl = document.getElementById(`enunciado-editor-${qIdx}`)
    let rawHtml = q.enunciado || ''
    if (editorEl) {
      try {
        const domHtml = unpackMasksAndFormulas(editorEl.innerHTML)
        if (domHtml && domHtml.trim()) rawHtml = domHtml
      } catch (e) {}
    }

    let newHtml = ''
    if (target === 'inicio') {
      newHtml = prependImageAtInicio(rawHtml, tag)
    } else {
      newHtml = appendImageAtFinal(rawHtml, tag)
    }

    const updatedImgs = (q.imagens || []).map((img: any, idx: number) => {
      if (idx !== imgIdx) return img
      if (typeof img === 'object' && img !== null) {
        return { ...img, posicao: target }
      }
      return { src: img, posicao: target }
    })

    const updated = questoes.map((item, idx) => {
      if (idx !== qIdx) return item
      return {
        ...item,
        enunciado: newHtml,
        imagens: updatedImgs
      }
    })

    setQuestoes(updated)
    triggerSave(updated, true)
  }

  const cleanupOrphanedImageMasks = (enunciadoHtml: string, totalImgs: number): string => {
    if (!enunciadoHtml) return ''
    if (totalImgs === 0) {
      return cleanEnunciadoHtml(
        enunciadoHtml
          .replace(/<(?:p|div)\b[^>]*>\s*\[IMAGEM\s*\d+\]\s*<\/(?:p|div)>/gi, '')
          .replace(/\[IMAGEM\s*\d+\]/gi, '')
      )
    }

    const seen = new Set<string>()
    let cleaned = enunciadoHtml.replace(/(?:<p\b[^>]*>)?\s*\[IMAGEM\s*(\d+)\]\s*(?:<\/p>)?|(\[IMAGEM\s*(\d+)\])/gi, (fullMatch: string, p1?: string, p2?: string, p3?: string) => {
      const numStr = p1 || p3 || ''
      const num = parseInt(numStr, 10)
      if (!num || num > totalImgs || seen.has(numStr)) {
        return ''
      }
      seen.add(numStr)
      return fullMatch
    })
    return cleanEnunciadoHtml(cleaned)
  }

  const handleDeleteQuestaoImagem = (qIdx: number, imgIdx: number) => {
    const q = questoes[qIdx]
    if (!q) return

    const oldImgs = q.imagens || []
    const totalBefore = oldImgs.length
    const newImgs = oldImgs.filter((_, i) => i !== imgIdx)

    // 1. Remove all occurrences of the deleted mask (e.g. [IMAGEM 1])
    const tag = `IMAGEM\\s*${imgIdx + 1}`
    const tagRegex = new RegExp(`(<(?:p|div)[^>]*>\\s*)?\\[${tag}\\](\\s*<\\/(?:p|div)>)?|(\\[${tag}\\])`, 'gi')
    let updatedHtml = (q.enunciado || '').replace(tagRegex, '').trim()

    // 2. Renumber subsequent masks ([IMAGEM 2] -> [IMAGEM 1], etc.)
    for (let k = imgIdx + 1; k < totalBefore; k++) {
      const oldTagRegex = new RegExp(`\\[IMAGEM\\s*${k + 1}\\]`, 'gi')
      updatedHtml = updatedHtml.replace(oldTagRegex, `[IMAGEM ${k}]`)
    }

    // 3. Clean any remaining orphans and deduplicate
    updatedHtml = cleanupOrphanedImageMasks(updatedHtml, newImgs.length)

    const updated = questoes.map((qq, qi) => {
      if (qi !== qIdx) return qq
      return {
        ...qq,
        enunciado: updatedHtml,
        imagens: newImgs
      }
    })

    setQuestoes(updated)
    triggerSave(updated, true)
  }

  const [pastingImageFor, setPastingImageFor] = useState<number | null>(null)

  const handlePasteImageIntoQuestion = async (qIdx: number, fileOrBlob: File | Blob | null, srcUrl?: string) => {
    const q = questoes[qIdx]
    if (!q) return

    setPastingImageFor(qIdx)

    try {
      let finalUrl = srcUrl || ''

      if (fileOrBlob) {
        const formData = new FormData()
        const fileObj = fileOrBlob instanceof File 
          ? fileOrBlob 
          : new File([fileOrBlob], `imagem-colada-${Date.now()}.png`, { type: fileOrBlob.type || 'image/png' })
        formData.append('file', fileObj)
        formData.append('bucket', 'comunicados-midia')

        const res = await fetch('/api/upload-midia', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Falha no upload da imagem colada')
        const data = await res.json()
        if (data.url) {
          finalUrl = data.url
        }
      }

      if (!finalUrl) {
        setPastingImageFor(null)
        return
      }

      const currentImgs = [...(q.imagens || [])]
      const newImgIdx = currentImgs.length
      const tag = `[IMAGEM ${newImgIdx + 1}]`
      const newImgs = [...currentImgs, { src: `${finalUrl}#w=350`, contentType: 'image/png' }]

      const editorEl = document.getElementById(`enunciado-editor-${qIdx}`)
      let targetRange: Range | null = null
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editorEl && (editorEl === sel.anchorNode || editorEl.contains(sel.anchorNode))) {
        targetRange = sel.getRangeAt(0)
      } else if (lastEnunciadoCaretRef.current && lastEnunciadoCaretRef.current.qIdx === qIdx && editorEl) {
        targetRange = lastEnunciadoCaretRef.current.range
      }

      let newEnunciado = q.enunciado || ''

      if (editorEl && targetRange) {
        try {
          const textNode = document.createTextNode(` ${tag} `)
          targetRange.deleteContents()
          targetRange.insertNode(textNode)

          const nextRange = document.createRange()
          nextRange.setStartAfter(textNode)
          nextRange.collapse(true)
          if (sel) {
            sel.removeAllRanges()
            sel.addRange(nextRange)
          }

          const rawHtml = editorEl.innerHTML
          const unpacked = unpackMasksAndFormulas(rawHtml)
          newEnunciado = cleanEnunciadoHtml(unpacked)
        } catch (err) {
          newEnunciado = prependImageAtInicio(q.enunciado || '', tag)
        }
      } else {
        newEnunciado = prependImageAtInicio(q.enunciado || '', tag)
      }

      const updated = questoes.map((item, idx) => {
        if (idx !== qIdx) return item
        return {
          ...item,
          enunciado: newEnunciado,
          imagens: newImgs
        }
      })
      setQuestoes(updated)
      triggerSave(updated, true)
    } catch (err) {
      console.error('Erro ao processar imagem colada:', err)
      alert('Não foi possível processar a imagem colada.')
    } finally {
      setPastingImageFor(null)
    }
  }

  const isExtractingImagesRef = useRef(false)

  const extractAndNormalizeEnunciadoImages = async () => {
    if (isExtractingImagesRef.current) return
    const hasRawImg = questoes.some(q => q.enunciado && /<img[^>]+src=/i.test(q.enunciado))
    const hasOrphanedOrDuplicate = questoes.some(q => {
      if (!q.enunciado) return false
      const totalImgs = (q.imagens || []).length
      if (totalImgs === 0) {
        return /\[IMAGEM\s*\d+\]/i.test(q.enunciado)
      }
      const matches = q.enunciado.match(/\[IMAGEM\s*(\d+)\]/gi)
      if (!matches) return false
      const seen = new Set<string>()
      for (const m of matches) {
        const num = parseInt(m.replace(/\D/g, ''), 10)
        if (num > totalImgs || seen.has(m.toUpperCase())) return true
        seen.add(m.toUpperCase())
      }
      return false
    })
    if (!hasRawImg && !hasOrphanedOrDuplicate) return

    isExtractingImagesRef.current = true

    try {
      let hasChanges = false
      const updated = await Promise.all(
        questoes.map(async (q) => {
          let currentEnunciado = q.enunciado || ''
          let currentImgs = [...(q.imagens || [])]
          let qModified = false

          if (currentEnunciado && /<img[^>]+src=/i.test(currentEnunciado)) {
            const parser = new DOMParser()
            const doc = parser.parseFromString(currentEnunciado, 'text/html')
            const imgEls = Array.from(doc.querySelectorAll('img'))
            if (imgEls.length > 0) {
              for (const imgEl of imgEls) {
                const src = imgEl.getAttribute('src') || ''
                if (!src) continue

                const cleanSrc = src.split('#')[0].split('?')[0]
                let existingIdx = currentImgs.findIndex(img => {
                  const s = getImgSrc(img).split('#')[0].split('?')[0]
                  return s === cleanSrc
                })

                if (existingIdx === -1) {
                  let finalSrc = src
                  if (src.startsWith('data:image/')) {
                    try {
                      const byteString = atob(src.split(',')[1])
                      const mimeString = src.split(',')[0].split(':')[1].split(';')[0]
                      const ab = new ArrayBuffer(byteString.length)
                      const ia = new Uint8Array(ab)
                      for (let j = 0; j < byteString.length; j++) {
                        ia[j] = byteString.charCodeAt(j)
                      }
                      const blob = new Blob([ab], { type: mimeString })
                      const formData = new FormData()
                      formData.append('file', blob, `imagem-extraida-${Date.now()}.png`)
                      formData.append('bucket', 'comunicados-midia')
                      const res = await fetch('/api/upload-midia', { method: 'POST', body: formData })
                      if (res.ok) {
                        const resJson = await res.json()
                        if (resJson.url) finalSrc = resJson.url
                      }
                    } catch (e) {
                      console.error('Erro ao subir data:image extraída:', e)
                    }
                  }
                  currentImgs.push({ src: `${finalSrc}#w=350`, contentType: 'image/png' })
                  existingIdx = currentImgs.length - 1
                }

                const tag = `[IMAGEM ${existingIdx + 1}]`
                const textNode = doc.createTextNode(`\n${tag}\n`)
                imgEl.parentNode?.replaceChild(textNode, imgEl)
                qModified = true
              }

              if (qModified) {
                currentEnunciado = cleanEnunciadoHtml(unpackMasksAndFormulas(doc.body.innerHTML))
              }
            }
          }

          const cleanedEnunciado = cleanupOrphanedImageMasks(currentEnunciado, currentImgs.length)
          if (cleanedEnunciado !== currentEnunciado) {
            currentEnunciado = cleanedEnunciado
            qModified = true
          }

          if (qModified) {
            hasChanges = true
            return {
              ...q,
              enunciado: currentEnunciado,
              imagens: currentImgs
            }
          }
          return q
        })
      )

      if (hasChanges) {
        setQuestoes(updated)
        triggerSave(updated, true)
      }
    } finally {
      isExtractingImagesRef.current = false
    }
  }

  React.useEffect(() => {
    extractAndNormalizeEnunciadoImages()
  }, [questoes])

  const getCleanEnunciadoTitle = (enunciadoHtml: string): string => {
    if (!enunciadoHtml) return ''
    return cleanEnunciadoHtml(enunciadoHtml)
      .replace(/<[^>]+>/g, '')
      .replace(/\[IMAGEM\s*\d+\]/gi, '')
      .replace(/\[LINHAS_PAUTADAS\s*:\s*\d+\]/gi, '')
      .replace(/\[ESPACO_BRANCO\s*:\s*\d+\]/gi, '')
      .trim()
  }

  const getQuestaoLinhasInfo = (q: Questao): { hasLinhas: boolean; count: number; style: 'pautado' | 'em_branco' } => {
    const enun = q.enunciado || ''
    const matchPautadas = enun.match(/\[LINHAS_PAUTADAS\s*:\s*(\d+)\]/i)
    if (matchPautadas) {
      return { hasLinhas: true, count: parseInt(matchPautadas[1], 10), style: 'pautado' }
    }
    const matchBranco = enun.match(/\[ESPACO_BRANCO\s*:\s*(\d+)\]/i)
    if (matchBranco) {
      return { hasLinhas: true, count: parseInt(matchBranco[1], 10), style: 'em_branco' }
    }
    if (typeof q.linhas_resposta === 'number' && q.linhas_resposta > 0) {
      return { hasLinhas: true, count: q.linhas_resposta, style: q.estilo_espaco === 'em_branco' ? 'em_branco' : 'pautado' }
    }
    const metaMatch = enun.match(/<meta name="linhas_resposta" content="(\d+)">/i)
    if (metaMatch) {
      const c = parseInt(metaMatch[1], 10)
      const styleMatch = enun.match(/<meta name="estilo_espaco" content="(.*?)">/i)
      return { hasLinhas: c > 0, count: c, style: styleMatch?.[1] === 'em_branco' ? 'em_branco' : 'pautado' }
    }
    return { hasLinhas: false, count: 0, style: 'pautado' }
  }

  const updateQuestaoLinhas = (qIdx: number, count: number, style: 'pautado' | 'em_branco') => {
    const updated = questoes.map((q, i) => {
      if (i !== qIdx) return q
      
      let rawHtml = q.enunciado || ''
      rawHtml = rawHtml.replace(/(<p>\s*)?\[(LINHAS_PAUTADAS|ESPACO_BRANCO)\s*:\s*\d+\](\s*<\/p>)?/gi, '').trim()
      rawHtml = rawHtml.replace(/\[(LINHAS_PAUTADAS|ESPACO_BRANCO)\s*:\s*\d+\]/gi, '').trim()
      rawHtml = rawHtml.replace(/<meta name="linhas_resposta" content=".*?">/gi, '').trim()
      rawHtml = rawHtml.replace(/<meta name="estilo_espaco" content=".*?">/gi, '').trim()

      if (count > 0) {
        const tag = style === 'em_branco' ? `[ESPACO_BRANCO:${count}]` : `[LINHAS_PAUTADAS:${count}]`
        rawHtml = rawHtml ? `${rawHtml}\n<p>${tag}</p>` : `<p>${tag}</p>`
        rawHtml += `\n<meta name="linhas_resposta" content="${count}">`
        rawHtml += `\n<meta name="estilo_espaco" content="${style}">`
      }

      return {
        ...q,
        enunciado: rawHtml,
        linhas_resposta: count,
        estilo_espaco: style
      }
    })
    setQuestoes(updated)
    triggerSave(updated, false)
  }

  const getAltLines = (text: string): { count: number; style: 'pautado' | 'branco' } => {
    const matchP = (text || '').match(/\[LINHAS_PAUTADAS\s*:\s*(\d+)\]/i)
    if (matchP) return { count: parseInt(matchP[1], 10), style: 'pautado' }
    const matchB = (text || '').match(/\[ESPACO_BRANCO\s*:\s*(\d+)\]/i)
    if (matchB) return { count: parseInt(matchB[1], 10), style: 'branco' }
    return { count: 0, style: 'pautado' }
  }

  const updateAlternativaLinhas = (qIdx: number, aIdx: number, count: number, style: 'pautado' | 'branco' = 'pautado') => {
    const updated = questoes.map((q, i) => {
      if (i !== qIdx) return q
      const alts = [...(q.alternativas || [])]
      if (!alts[aIdx]) return q

      let text = alts[aIdx].text || ''
      text = text.replace(/(<p>\s*)?\[(LINHAS_PAUTADAS|ESPACO_BRANCO)\s*:\s*\d+\](\s*<\/p>)?/gi, '').trim()
      text = text.replace(/\[(LINHAS_PAUTADAS|ESPACO_BRANCO)\s*:\s*\d+\]/gi, '').trim()

      if (count > 0) {
        const tag = style === 'branco' ? `[ESPACO_BRANCO:${count}]` : `[LINHAS_PAUTADAS:${count}]`
        text = text ? `${text}\n<p>${tag}</p>` : `<p>${tag}</p>`
      }

      alts[aIdx] = { ...alts[aIdx], text, linhas: count }
      return { ...q, alternativas: alts }
    })
    setQuestoes(updated)
    triggerSave(updated, false)
  }

  React.useEffect(() => {
    if (disciplinas && disciplinas.length > 0) {
      setDisciplinasList(disciplinas)
      return
    }
    async function loadDisc() {
      try {
        const { data } = await supabase.from('simulados_disciplinas').select('id, nome')
        if (data && data.length > 0) {
          setDisciplinasList(data)
        }
      } catch (err) {
        console.error('Erro ao carregar disciplinas:', err)
      }
    }
    loadDisc()
  }, [disciplinas])

  React.useEffect(() => {
    if (!reorderOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReorderOpen(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reorderOpen])

  const getQuestaoDisciplina = (q: any): string | null => {
    if (q.disciplina_nome && typeof q.disciplina_nome === 'string' && q.disciplina_nome.trim()) {
      return q.disciplina_nome.trim()
    }
    if (q.disciplina && typeof q.disciplina === 'string' && q.disciplina.trim()) {
      return q.disciplina.trim()
    }
    if (q.simulados_disciplinas?.nome) {
      return q.simulados_disciplinas.nome
    }
    if (requisicoes && requisicoes.length > 0) {
      if (q.id_requisicao) {
        const req = requisicoes.find((r: any) => r.id === q.id_requisicao)
        if (req?.disciplina_nome) return req.disciplina_nome
        if (req?.simulados_disciplinas?.nome) return req.simulados_disciplinas.nome
      }
      const matchedReq = requisicoes.find((r: any) => isQuestionForRequisicao(q, r, requisicoes, false))
      if (matchedReq?.disciplina_nome) return matchedReq.disciplina_nome
      if (matchedReq?.simulados_disciplinas?.nome) return matchedReq.simulados_disciplinas.nome
    }
    const discId = q.id_disciplina || q.disciplina_id || defaultDisciplinaId
    if (discId && disciplinasList.length > 0) {
      const found = disciplinasList.find((d: any) => d.id === discId)
      if (found?.nome) return found.nome
    }
    if (requisicoes && requisicoes.length === 1 && requisicoes[0].disciplina_nome) {
      return requisicoes[0].disciplina_nome
    }
    return null
  }

  const getDisciplinaBadgeStyle = (nome: string) => {
    if (!nome) {
      return {
        bg: 'rgba(139, 92, 246, 0.08)',
        color: '#8b5cf6',
        border: 'rgba(139, 92, 246, 0.25)'
      }
    }

    const clean = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

    if (clean.includes('portugues') || clean.includes('gramatica') || clean.includes('literatura') || clean.includes('redacao')) {
      return {
        bg: 'rgba(37, 99, 235, 0.08)',
        color: '#2563eb',
        border: 'rgba(37, 99, 235, 0.25)'
      }
    }
    if (clean.includes('matematica') || clean.includes('algebra') || clean.includes('geometria')) {
      return {
        bg: 'rgba(5, 150, 105, 0.08)',
        color: '#059669',
        border: 'rgba(5, 150, 105, 0.25)'
      }
    }
    if (clean.includes('historia')) {
      return {
        bg: 'rgba(217, 119, 6, 0.08)',
        color: '#d97706',
        border: 'rgba(217, 119, 6, 0.25)'
      }
    }
    if (clean.includes('geografia')) {
      return {
        bg: 'rgba(13, 148, 136, 0.08)',
        color: '#0d9488',
        border: 'rgba(13, 148, 136, 0.25)'
      }
    }
    if (clean.includes('fisica')) {
      return {
        bg: 'rgba(124, 58, 237, 0.08)',
        color: '#7c3aed',
        border: 'rgba(124, 58, 237, 0.25)'
      }
    }
    if (clean.includes('quimica')) {
      return {
        bg: 'rgba(219, 39, 119, 0.08)',
        color: '#db2777',
        border: 'rgba(219, 39, 119, 0.25)'
      }
    }
    if (clean.includes('biologia') || clean.includes('ciencias')) {
      return {
        bg: 'rgba(22, 163, 74, 0.08)',
        color: '#16a34a',
        border: 'rgba(22, 163, 74, 0.25)'
      }
    }
    if (clean.includes('ingles') || clean.includes('espanhol') || clean.includes('lingua')) {
      return {
        bg: 'rgba(2, 132, 199, 0.08)',
        color: '#0284c7',
        border: 'rgba(2, 132, 199, 0.25)'
      }
    }
    if (clean.includes('arte')) {
      return {
        bg: 'rgba(147, 51, 234, 0.08)',
        color: '#9333ea',
        border: 'rgba(147, 51, 234, 0.25)'
      }
    }
    if (clean.includes('filosofia') || clean.includes('sociologia')) {
      return {
        bg: 'rgba(71, 85, 105, 0.08)',
        color: '#475569',
        border: 'rgba(71, 85, 105, 0.25)'
      }
    }

    const palette = [
      { bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.25)' },
      { bg: 'rgba(234, 88, 12, 0.08)', color: '#ea580c', border: 'rgba(234, 88, 12, 0.25)' },
      { bg: 'rgba(8, 145, 178, 0.08)', color: '#0891b2', border: 'rgba(8, 145, 178, 0.25)' },
      { bg: 'rgba(202, 138, 4, 0.08)', color: '#ca8a04', border: 'rgba(202, 138, 4, 0.25)' },
      { bg: 'rgba(192, 38, 211, 0.08)', color: '#c026d3', border: 'rgba(192, 38, 211, 0.25)' },
    ]
    let hash = 0
    for (let i = 0; i < clean.length; i++) {
      hash = (hash << 5) - hash + clean.charCodeAt(i)
      hash |= 0
    }
    return palette[Math.abs(hash) % palette.length]
  }

  const isTextoApoio = (q: any) => q?.tipo_questao === 'texto_apoio' || q?.is_texto_apoio || q?.isTextoApoio

  const recalculateNumeros = (list: Questao[]) => {
    let numCounter = 1
    return list.map(q => {
      if (isTextoApoio(q)) {
        return { ...q, numero: 0 }
      }
      const updated = { ...q, numero: numCounter }
      numCounter++
      return updated
    })
  }

  const moveQuestao = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= questoes.length) return
    const updated = [...questoes]
    const [moved] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, moved)
    const recalculated = recalculateNumeros(updated)
    setQuestoes(recalculated)
    triggerSave(recalculated, true)
  }

  const updateQuestao = (idx: number, field: string, value: any) => {
    const updated = questoes.map((q, i) => i === idx ? { ...q, [field]: value } : q)
    setQuestoes(updated)
    triggerSave(updated, false)
  }

  const updateAlternativa = (qIdx: number, aIdx: number, field: string, value: any) => {
    const updated = questoes.map((q, i) => {
      if (i !== qIdx) return q
      const alts = [...(q.alternativas || [])]
      if (alts[aIdx]) {
        alts[aIdx] = { ...alts[aIdx], [field]: value }
      }
      
      if (field === 'correct') {
        if (value === true) {
          const targetLetter = alts[aIdx]?.letter || alts[aIdx]?.letra || String.fromCharCode(65 + aIdx)
          return {
            ...q,
            alternativas: alts.map((a, ai) => {
              const isMatch = ai === aIdx
              return {
                ...a,
                correct: isMatch,
                eh_correta: isMatch,
                correta: isMatch,
                is_correta: isMatch,
                isCorrect: isMatch,
              }
            }),
            gabarito: targetLetter
          }
        } else {
          return {
            ...q,
            alternativas: alts.map((a, ai) => {
              if (ai === aIdx) {
                return {
                  ...a,
                  correct: false,
                  eh_correta: false,
                  correta: false,
                  is_correta: false,
                  isCorrect: false,
                }
              }
              return a
            }),
            gabarito: ''
          }
        }
      }
      return { ...q, alternativas: alts }
    })
    setQuestoes(updated)
    triggerSave(updated, false)
  }

  const addAlternativa = (qIdx: number) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    const updated = questoes.map((q, i) => {
      if (i !== qIdx) return q
      const alts = q.alternativas || []
      const nextLetter = letters[alts.length] || String.fromCharCode(65 + alts.length)
      return {
        ...q,
        alternativas: [
          ...alts,
          {
            letter: nextLetter,
            letra: nextLetter,
            text: '',
            correct: false,
            eh_correta: false,
            correta: false,
            is_correta: false,
            isCorrect: false
          }
        ]
      }
    })
    setQuestoes(updated)
    triggerSave(updated, false)
  }

  const handleUploadQuestaoImagem = async (qIdx: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'comunicados-midia')
        const res = await fetch('/api/upload-midia', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Erro no upload')
        const data = await res.json()
        
        setQuestoes(prev => prev.map((q, i) => {
          if (i !== qIdx) return q
          const newImgs = [...(q.imagens || []), { src: `${data.url}#w=350`, contentType: file.type }]
          const tag = `[IMAGEM ${newImgs.length}]`
          const newEnunciado = prependImageAtInicio(q.enunciado || '', tag)
          return { ...q, imagens: newImgs, enunciado: newEnunciado }
        }))
      } catch (err: any) {
        alert('Erro: ' + err.message)
      }
    }
    input.click()
  }

  const handleUploadAlternativaImagem = async (qIdx: number, aIdx: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'comunicados-midia')
        const res = await fetch('/api/upload-midia', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Erro no upload')
        const data = await res.json()
        updateAlternativa(qIdx, aIdx, 'imagem_url', `${data.url}#w=150`)
      } catch (err: any) {
        alert('Erro: ' + err.message)
      }
    }
    input.click()
  }

  const handleGenerateQuestaoImagemAi = async (qIdx: number, enunciadoTxt: string) => {
    const plainText = (enunciadoTxt || '').replace(/<[^>]+>/g, '').trim()
    if (!plainText) {
      alert('Preencha o enunciado primeiro para a IA saber sobre o que gerar a imagem.')
      return
    }
    setGeneratingAiFor(qIdx)
    try {
      const resPrompt = await fetch('/api/ai/gerar-imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enunciado: plainText, disciplina: 'Geral' })
      })
      const jsonPrompt = await resPrompt.json()
      if (!resPrompt.ok) throw new Error(jsonPrompt.error || 'Erro ao gerar')
      
      const base64DataUrl = jsonPrompt.base64Image
      if (!base64DataUrl) throw new Error('Imagem não retornada')
      
      const base64Data = base64DataUrl.split(',')[1]
      const byteString = atob(base64Data)
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
      const blob = new Blob([ab], { type: 'image/jpeg' })
      const file = new File([blob], `ia-imagem-${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'comunicados-midia')
      const uploadRes = await fetch('/api/upload-midia', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Erro no upload')
      const data = await uploadRes.json()
      
      setQuestoes(prev => prev.map((q, i) => {
        if (i !== qIdx) return q
        // Adiciona #w=350 para a imagem IA já nascer com um tamanho harmonioso
        const newImgs = [...(q.imagens || []), { src: `${data.url}#w=350`, contentType: 'image/jpeg' }]
        const tag = `[IMAGEM ${newImgs.length}]`
        const newEnunciado = prependImageAtInicio(q.enunciado || '', tag)
        return { ...q, imagens: newImgs, enunciado: newEnunciado }
      }))
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setGeneratingAiFor(null)
    }
  }

  const handleResizeQuestaoImagem = (qIdx: number, imgIdx: number, delta: number) => {
    setQuestoes(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      if (!q.imagens || !q.imagens[imgIdx]) return q
      const img = q.imagens[imgIdx]
      let currentWidth = 350
      const hashIndex = img.src.indexOf('#')
      const baseUrl = hashIndex >= 0 ? img.src.substring(0, hashIndex) : img.src
      const hashStr = hashIndex >= 0 ? img.src.substring(hashIndex + 1) : ''
      const params = new URLSearchParams(hashStr)
      
      if (params.has('w')) {
        currentWidth = parseInt(params.get('w') || '350')
      }
      
      let newWidth = currentWidth + delta
      if (newWidth < 100) newWidth = 100
      if (newWidth > 800) newWidth = 800
      
      params.set('w', newWidth.toString())
      const newImgs = [...q.imagens]
      newImgs[imgIdx] = { src: `${baseUrl}#${params.toString()}`, contentType: img.contentType }
      return { ...q, imagens: newImgs }
    }))
  }

  const removeAlternativa = (qIdx: number, aIdx: number) => {
    setReorderOpen(null)
    setQuestoes(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const remaining = (q.alternativas || []).filter((_, ai) => ai !== aIdx)
      const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
      const relettered = remaining.map((a, idx) => ({
        ...a,
        letter: LETTERS[idx] || String.fromCharCode(65 + idx),
        letra: LETTERS[idx] || String.fromCharCode(65 + idx)
      }))
      const correctLetter = getQuestionCorrectAnswer({ ...q, alternativas: relettered })
      const syncedAlts = relettered.map((a) => {
        const isMatch = correctLetter !== '?' && (a.letter === correctLetter || a.letra === correctLetter)
        return {
          ...a,
          correct: isMatch,
          eh_correta: isMatch,
          correta: isMatch,
          is_correta: isMatch,
          isCorrect: isMatch,
        }
      })
      return { 
        ...q, 
        alternativas: syncedAlts, 
        gabarito: correctLetter !== '?' ? correctLetter : '' 
      }
    }))
  }

  const moveAlternativa = (qIdx: number, aIdx: number, targetIdx: number) => {
    setQuestoes(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const alts = [...(q.alternativas || [])]
      if (targetIdx < 0 || targetIdx >= alts.length || targetIdx === aIdx) return q
      const [moved] = alts.splice(aIdx, 1)
      alts.splice(targetIdx, 0, moved)
      const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
      const relettered = alts.map((a, idx) => ({
        ...a,
        letter: LETTERS[idx] || String.fromCharCode(65 + idx),
        letra: LETTERS[idx] || String.fromCharCode(65 + idx)
      }))
      const correctLetter = getQuestionCorrectAnswer({ ...q, alternativas: relettered })
      const syncedAlts = relettered.map((a) => {
        const isMatch = correctLetter !== '?' && (a.letter === correctLetter || a.letra === correctLetter)
        return {
          ...a,
          correct: isMatch,
          eh_correta: isMatch,
          correta: isMatch,
          is_correta: isMatch,
          isCorrect: isMatch,
        }
      })
      return { ...q, alternativas: syncedAlts, gabarito: correctLetter !== '?' ? correctLetter : '' }
    }))
  }

  const removeQuestao = (idx: number) => {
    const updated = recalculateNumeros(questoes.filter((_, i) => i !== idx))
    setQuestoes(updated)
    triggerSave(updated, true)
  }

  const updateQuestaoDescritiva = (qIdx: number, updates: { tipo_questao?: 'multipla_escolha'|'descritiva'|'texto_apoio', linhas_resposta?: number, estilo_espaco?: 'em_branco'|'pautado' }) => {
    const updated = questoes.map((q, i) => {
      if (i !== qIdx) return q
      
      const updatedQ = { ...q, ...updates }
      
      let html = updatedQ.enunciado || ''
      html = html.replace(/<meta name="linhas_resposta" content=".*?">/g, '')
      html = html.replace(/<meta name="estilo_espaco" content=".*?">/g, '')
      
      if (updatedQ.tipo_questao === 'descritiva') {
         html += `<meta name="linhas_resposta" content="${updatedQ.linhas_resposta !== undefined ? updatedQ.linhas_resposta : 5}">`
         html += `<meta name="estilo_espaco" content="${updatedQ.estilo_espaco || 'em_branco'}">`
      }
      
      return { ...updatedQ, enunciado: html }
    })
    setQuestoes(updated)
    triggerSave(updated, false)
  }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleAddQuestao = (novaQuestao: any) => {
    const activeReq = requisicoes?.find((r: any) => r.id === (novaQuestao.id_requisicao || defaultRequisicaoId))
    const discNome = novaQuestao.disciplina_nome || novaQuestao.disciplina || activeReq?.disciplina_nome || activeReq?.simulados_disciplinas?.nome || ''
    const profNome = novaQuestao.professor_nome || activeReq?.professor_nome || ''

    let finalEnunciado = novaQuestao.enunciado || ''
    if (novaQuestao.imagens && Array.isArray(novaQuestao.imagens) && novaQuestao.imagens.length > 0) {
      novaQuestao.imagens.forEach((imgItem: any, idx: number) => {
        const tag = `[IMAGEM ${idx + 1}]`
        if (!new RegExp(`\\[IMAGEM\\s*${idx + 1}\\]`, 'i').test(finalEnunciado)) {
          const pos = (imgItem && typeof imgItem === 'object' && imgItem.posicao) || 'inicio'
          if (pos === 'final') {
            finalEnunciado = appendImageAtFinal(finalEnunciado, tag)
          } else {
            finalEnunciado = prependImageAtInicio(finalEnunciado, tag)
          }
        }
      })
    }

    const seenImgTags = new Set<string>()
    finalEnunciado = finalEnunciado.replace(/(?:<p\b[^>]*>)?\s*\[IMAGEM\s*(\d+)\]\s*(?:<\/p>)?|(\[IMAGEM\s*(\d+)\])/gi, (fullMatch: string, pNum?: string, bareNum?: string) => {
      const num = pNum || bareNum || ''
      if (num && seenImgTags.has(num)) return ''
      if (num) seenImgTags.add(num)
      return fullMatch
    })

    const enriched = {
      ...novaQuestao,
      enunciado: finalEnunciado,
      id_requisicao: novaQuestao.id_requisicao || defaultRequisicaoId || activeReq?.id || undefined,
      id_disciplina: novaQuestao.id_disciplina || defaultDisciplinaId || activeReq?.id_disciplina || undefined,
      disciplina_id: novaQuestao.disciplina_id || defaultDisciplinaId || activeReq?.id_disciplina || undefined,
      disciplina_nome: discNome || undefined,
      disciplina: discNome || undefined,
      id_professor: novaQuestao.id_professor || defaultProfessorId || activeReq?.id_professor || undefined,
      professor_nome: profNome || undefined,
      expandido: true,
    }

    let updatedQuestoes: Questao[]
    if (editingIndex !== null) {
      const updated = questoes.map((q, i) => i === editingIndex ? { ...enriched, numero: q.numero } : q)
      updatedQuestoes = recalculateNumeros(updated)
    } else {
      updatedQuestoes = recalculateNumeros([...questoes, enriched])
    }

    setQuestoes(updatedQuestoes)
    setIsModalOpen(false)
    setEditingIndex(null)
    triggerSave(updatedQuestoes, true)
  }

  const handleAddTextoApoio = () => {
    const activeReq = requisicoes?.find((r: any) => r.id === defaultRequisicaoId)
    const discNome = activeReq?.disciplina_nome || activeReq?.simulados_disciplinas?.nome || ''
    const profNome = activeReq?.professor_nome || ''

    const newApoio: any = {
      numero: 0,
      tipo_questao: 'texto_apoio',
      enunciado: '<div style="text-align: justify;"><p>Digite aqui o texto de apoio ou consulta...</p></div>',
      alternativas: [],
      imagens: [],
      gabarito: '',
      pontuacao: 0,
      expandido: true,
      id_requisicao: defaultRequisicaoId || activeReq?.id || undefined,
      id_disciplina: defaultDisciplinaId || activeReq?.id_disciplina || undefined,
      disciplina_id: defaultDisciplinaId || activeReq?.id_disciplina || undefined,
      disciplina_nome: discNome || undefined,
      disciplina: discNome || undefined,
      id_professor: defaultProfessorId || activeReq?.id_professor || undefined,
      professor_nome: profNome || undefined,
    }
    const updated = recalculateNumeros([newApoio, ...questoes])
    setQuestoes(updated)
    triggerSave(updated, true)
  }

  const totalQuestoes = questoes.filter(q => !isTextoApoio(q)).length
  const comAlternativas = questoes.filter(q => !isTextoApoio(q) && (q.alternativas || []).length > 0).length
  const comGabarito = questoes.filter(q => !isTextoApoio(q) && q.gabarito).length
  const totalTextosApoio = questoes.filter(q => isTextoApoio(q)).length

  return (
    <div style={{ width: '100%' }}>
      {isModalOpen && (
        <QuestaoUploadModal
          questao={editingIndex !== null ? questoes[editingIndex] : undefined}
          defaultDisciplinaId={defaultDisciplinaId}
          defaultProfessorId={defaultProfessorId}
          defaultRequisicaoId={defaultRequisicaoId}
          onClose={() => { setIsModalOpen(false); setEditingIndex(null); }}
          onSaveObj={handleAddQuestao}
        />
      )}
      {/* Stats and Actions Control Toolbar (COVERS THE ENTIRE HORIZONTAL LINE) */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        padding: '12px 20px',
        borderRadius: 16,
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        boxShadow: '0 4px 16px -4px rgba(0,0,0,0.03)',
        marginBottom: 20
      }}>
        {/* Left: Metric Badges / Micro-KPIs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Meta de Questões (se houver cota definida) */}
          {cotaQuestoes !== undefined && cotaQuestoes > 0 && (() => {
            const isCompleted = totalQuestoes >= cotaQuestoes;
            const pct = Math.min(100, Math.round((totalQuestoes / cotaQuestoes) * 100));
            const color = isCompleted ? '#10b981' : '#f59e0b';
            const bg = isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)';
            const border = isCompleted ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)';

            return (
              <div style={{
                padding: '6px 12px',
                borderRadius: 9,
                background: bg,
                border: `1px solid ${border}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 150
              }}>
                <Target size={15} color={color} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                  {totalQuestoes} de {cotaQuestoes} ({pct}%)
                </span>
                <div style={{ flex: '1 1 70px', minWidth: 40, maxWidth: 110, height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: color, transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })()}

          {/* Com Gabarito */}
          <div style={{
            padding: '6px 12px',
            borderRadius: 9,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7
          }}>
            <CheckCircle2 size={15} color="#10b981" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{comGabarito}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Com gabarito</span>
            </div>
          </div>

          {/* Textos de Apoio */}
          {totalTextosApoio > 0 && (
            <div style={{
              padding: '6px 12px',
              borderRadius: 9,
              background: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7
            }}>
              <FileText size={15} color="#a855f7" />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#a855f7', lineHeight: 1 }}>{totalTextosApoio}</span>
                <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  {totalTextosApoio === 1 ? 'Texto de Apoio' : 'Textos de Apoio'}
                </span>
              </div>
            </div>
          )}

          {/* Auto-save status feedback */}
          {(saveStatus !== 'idle' || isSaving) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 700,
              background: (saveStatus === 'saving' || isSaving) ? 'rgba(139,92,246,0.08)' : saveStatus === 'saved' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              color: (saveStatus === 'saving' || isSaving) ? '#8b5cf6' : saveStatus === 'saved' ? '#10b981' : '#ef4444',
              border: `1px solid ${(saveStatus === 'saving' || isSaving) ? 'rgba(139,92,246,0.25)' : saveStatus === 'saved' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              transition: 'all 0.2s ease'
            }}>
              {(saveStatus === 'saving' || isSaving) ? (
                <>
                  <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                  <span>Salvando...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Salvo automaticamente</span>
                </>
              ) : (
                <>
                  <AlertCircle size={13} />
                  <span>Erro ao salvar</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        {!readOnly && showAddQuestao && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <motion.button
              onClick={handleAddTextoApoio}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 9,
                background: 'rgba(168,85,247,0.08)',
                color: '#9333ea',
                border: '1px solid rgba(168,85,247,0.25)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              <FileText size={14} /> + Texto de Apoio
            </motion.button>

            <motion.button
              onClick={() => { setEditingIndex(null); setIsModalOpen(true); }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 9,
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: '#ffffff',
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 3px 12px rgba(139,92,246,0.3)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              <Plus size={15} /> Adicionar Questão
            </motion.button>
          </div>
        )}
      </div>

      {/* Content Area: Grid if sidebarContent is present, or 100% full width otherwise */}
      <div style={sidebarContent ? {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 20,
        alignItems: 'start',
        width: '100%'
      } : { width: '100%' }}>
        <div style={{ minWidth: 0 }}>
          {/* Empty State when no questions */}
          {questoes.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'hsl(var(--bg-surface))',
                border: '2px dashed hsl(var(--border-subtle))',
                borderRadius: 20,
                padding: '52px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.12))',
                border: '1px solid rgba(139,92,246,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
                marginBottom: 16
              }}>
                <Sparkles size={26} />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                Nenhuma questão adicionada ainda
              </h3>

              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, maxWidth: 440, margin: '0 0 20px', lineHeight: 1.5 }}>
                Você pode cadastrar questões manualmente pelo editor (com suporte a IA) ou reenviar um arquivo Word (.docx) com as questões formatadas.
              </p>

              {!readOnly && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <motion.button
                    onClick={() => { setEditingIndex(null); setIsModalOpen(true); }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 18px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                      color: '#fff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 3px 12px rgba(139,92,246,0.28)'
                    }}
                  >
                    <Plus size={15} /> Adicionar Primeira Questão
                  </motion.button>

                  <motion.button
                    onClick={handleAddTextoApoio}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 16px',
                      borderRadius: 10,
                      background: 'hsl(var(--bg-app))',
                      color: '#9333ea',
                      border: '1px solid rgba(168,85,247,0.3)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <FileText size={15} /> + Texto de Apoio
                  </motion.button>

                  {onReenviarArquivo && (
                    <motion.button
                      onClick={onReenviarArquivo}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '9px 16px',
                        borderRadius: 10,
                        background: 'hsl(var(--bg-app))',
                        color: 'hsl(var(--text-secondary))',
                        border: '1px solid hsl(var(--border-subtle))',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={14} /> Reenviar Arquivo DOCX
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Questions list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questoes.map((q, qIdx) => {
          const discName = getQuestaoDisciplina(q)
          const discStyle = discName ? getDisciplinaBadgeStyle(discName) : null
          const isDescritiva = q.tipo_questao === 'descritiva' || (!(q.alternativas || []).length && !isTextoApoio(q))
          const linhasDescritiva = q.linhas_resposta !== undefined ? q.linhas_resposta : 5
          const estiloDescritiva = q.estilo_espaco || 'pautado'

          return (
          <motion.div key={qIdx} className="questao-card" layout
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qIdx * 0.03 }}
            style={{ 
              background: 'hsl(var(--bg-surface))', 
              border: '1px solid hsl(var(--border-subtle))', 
              borderRadius: 18, 
              overflow: 'hidden', 
              boxShadow: '0 2px 12px -2px rgba(0,0,0,0.03)',
              transition: 'border-color 0.2s, box-shadow 0.2s' 
            }}>

            {/* Question header */}
            <div
              onClick={() => updateQuestao(qIdx, 'expandido', q.expandido === false ? true : false)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}>
              {isTextoApoio(q) ? (
                <div style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', gap: 6, color: '#a855f7', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                  <FileText size={15} /> APOIO
                </div>
              ) : (
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 10, 
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(124,58,237,0.14))', 
                  border: '1px solid rgba(139,92,246,0.25)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexShrink: 0, 
                  color: '#7c3aed', 
                  fontWeight: 800, 
                  fontSize: 14,
                  boxShadow: '0 2px 6px rgba(139,92,246,0.12)'
                }}>
                  {q.numero}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'hsl(var(--text-primary))', fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {(() => {
                    const cleanTitle = getCleanEnunciadoTitle(q.enunciado || '')
                    return cleanTitle ? cleanTitle : <span style={{ color: 'hsl(var(--text-secondary))', fontStyle: 'italic' }}>Enunciado sem texto</span>
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 5, marginTop: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {discName && discStyle && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3.5,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: discStyle.bg,
                      color: discStyle.color,
                      border: `1px solid ${discStyle.border}`,
                      fontSize: 10.5,
                      fontWeight: 700,
                      lineHeight: '15px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      <BookOpen size={10} />
                      {discName}
                    </span>
                  )}
                  {isTextoApoio(q) ? (
                    <span style={{ fontSize: 10.5, color: '#a855f7', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Texto de Apoio (não contabiliza)</span>
                  ) : isDescritiva ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3.5,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: 'rgba(139,92,246,0.08)',
                      color: '#8b5cf6',
                      border: '1px solid rgba(139,92,246,0.22)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      lineHeight: '15px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      <AlignLeft size={10} />
                      Descritiva • {linhasDescritiva} {linhasDescritiva === 1 ? 'linha' : 'linhas'} ({estiloDescritiva === 'em_branco' ? 'espaço livre' : 'pautadas'})
                    </span>
                  ) : (
                    <>
                      {(q.alternativas || []).length > 0 && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3.5,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: 'rgba(59,130,246,0.08)',
                          color: '#2563eb',
                          border: '1px solid rgba(59,130,246,0.22)',
                          fontSize: 10.5,
                          fontWeight: 700,
                          lineHeight: '15px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          <ListChecks size={10} />
                          {q.alternativas.length} alternativas
                        </span>
                      )}
                      {q.gabarito && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3.5,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: 'rgba(16,185,129,0.08)',
                          color: '#059669',
                          border: '1px solid rgba(16,185,129,0.25)',
                          fontSize: 10.5,
                          fontWeight: 700,
                          lineHeight: '15px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          <CheckCircle2 size={10} />
                          Gabarito: Letra {q.gabarito}
                        </span>
                      )}
                      {(() => {
                        const lInfo = getQuestaoLinhasInfo(q)
                        if (lInfo.hasLinhas && lInfo.count > 0) {
                          return (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3.5,
                              padding: '2px 7px',
                              borderRadius: 6,
                              background: 'rgba(139,92,246,0.08)',
                              color: '#8b5cf6',
                              border: '1px solid rgba(139,92,246,0.22)',
                              fontSize: 10.5,
                              fontWeight: 700,
                              lineHeight: '15px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              <AlignJustify size={10} />
                              {lInfo.count} {lInfo.count === 1 ? 'linha' : 'linhas'}
                            </span>
                          )
                        }
                        return null
                      })()}
                    </>
                  )}
                  {(q.imagens || []).length > 0 && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3.5,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: 'rgba(245,158,11,0.08)',
                      color: '#d97706',
                      border: '1px solid rgba(245,158,11,0.25)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      lineHeight: '15px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      <ImageIcon size={10} />
                      {q.imagens.length} {q.imagens.length === 1 ? 'imagem' : 'imagens'}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {!readOnly && questoes.length > 1 && (
                  <>
                    <motion.button 
                      type="button"
                      whileHover={qIdx > 0 ? { scale: 1.08 } : {}} 
                      whileTap={qIdx > 0 ? { scale: 0.92 } : {}} 
                      disabled={qIdx === 0}
                      onClick={e => { e.stopPropagation(); moveQuestao(qIdx, qIdx - 1) }}
                      style={{ 
                        width: 28, height: 28, borderRadius: 7, 
                        background: qIdx === 0 ? 'transparent' : 'rgba(139,92,246,0.08)', 
                        color: qIdx === 0 ? 'hsl(var(--text-disabled, #94a3b8))' : '#8b5cf6', 
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: qIdx === 0 ? 'not-allowed' : 'pointer',
                        opacity: qIdx === 0 ? 0.3 : 1
                      }}
                      title="Mover para Cima">
                      <ArrowUp size={13} />
                    </motion.button>
                    <motion.button 
                      type="button"
                      whileHover={qIdx < questoes.length - 1 ? { scale: 1.08 } : {}} 
                      whileTap={qIdx < questoes.length - 1 ? { scale: 0.92 } : {}} 
                      disabled={qIdx === questoes.length - 1}
                      onClick={e => { e.stopPropagation(); moveQuestao(qIdx, qIdx + 1) }}
                      style={{ 
                        width: 28, height: 28, borderRadius: 7, 
                        background: qIdx === questoes.length - 1 ? 'transparent' : 'rgba(139,92,246,0.08)', 
                        color: qIdx === questoes.length - 1 ? 'hsl(var(--text-disabled, #94a3b8))' : '#8b5cf6', 
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: qIdx === questoes.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: qIdx === questoes.length - 1 ? 0.3 : 1
                      }}
                      title="Mover para Baixo">
                      <ArrowDown size={13} />
                    </motion.button>
                  </>
                )}
                <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={e => { e.stopPropagation(); setEditingIndex(qIdx); setIsModalOpen(true); }}
                  style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  title="Editar Questão no Modal">
                  <Edit size={13} />
                </motion.button>
                {!readOnly && (
                  <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={e => { e.stopPropagation(); removeQuestao(qIdx) }}
                    style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </motion.button>
                )}
                {q.expandido !== false ? <ChevronUp size={16} color="hsl(var(--text-secondary))" /> : <ChevronDown size={16} color="hsl(var(--text-secondary))" />}
              </div>
            </div>

            {/* Expanded content */}
            <AnimatePresence>
              {q.expandido !== false && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                  style={{ borderTop: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                    {/* Enunciado */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {isTextoApoio(q) ? 'Texto / Enunciado de Apoio' : 'Enunciado da Questão'}
                        </label>
                        {pastingImageFor === qIdx && (
                          <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Loader2 size={12} className="animate-spin" /> Processando imagem colada...
                          </span>
                        )}
                      </div>
                      <HtmlContent
                        id={`enunciado-editor-${qIdx}`}
                        editable={!readOnly}
                        html={q.enunciado || ''}
                        onBlurHtml={(newHtml: string) => updateQuestao(qIdx, 'enunciado', newHtml)}
                        onKeyUp={() => saveCaret(qIdx)}
                        onMouseUp={() => saveCaret(qIdx)}
                        onFocus={() => saveCaret(qIdx)}
                        onPasteImage={(fileOrBlob, srcUrl) => handlePasteImageIntoQuestion(qIdx, fileOrBlob, srcUrl)}
                        style={{ width: '100%', minHeight: 120, padding: '16px 20px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, lineHeight: 1.6, outline: 'none', whiteSpace: 'pre-wrap' }}
                      />
                    </div>

                    {/* Images */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'nowrap', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                          <ImageIcon size={12} style={{ marginRight: 4 }} />Imagens de Apoio ({(q.imagens || []).length})
                        </label>
                        {!readOnly && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                            {/* Botão de adicionar linhas no enunciado (antes do botão upload) */}
                            {(() => {
                              const lInfo = getQuestaoLinhasInfo(q)
                              const hasLines = lInfo.hasLinhas && lInfo.count > 0
                              return (
                                <button
                                  type="button"
                                  onClick={() => updateQuestaoLinhas(qIdx, hasLines ? 0 : 5, 'pautado')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 9px',
                                    borderRadius: 6,
                                    background: hasLines ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)',
                                    color: '#8b5cf6',
                                    border: `1px solid ${hasLines ? '#8b5cf6' : 'rgba(139,92,246,0.25)'}`,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s'
                                  }}
                                  title={hasLines ? `${lInfo.count} linhas no enunciado (clique para remover ou use o painel abaixo)` : "Adicionar linhas de resposta no enunciado"}
                                >
                                  <AlignJustify size={12} />
                                  {hasLines ? `${lInfo.count} Linhas` : '+ Linhas'}
                                </button>
                              )
                            })()}

                            <button onClick={() => handleUploadQuestaoImagem(qIdx)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <Upload size={12} /> Upload
                            </button>
                            <button onClick={() => handleGenerateQuestaoImagemAi(qIdx, q.enunciado || '')} disabled={generatingAiFor === qIdx}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: 'none', fontSize: 11, fontWeight: 600, cursor: generatingAiFor === qIdx ? 'not-allowed' : 'pointer', opacity: generatingAiFor === qIdx ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                              {generatingAiFor === qIdx ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar IA
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {(q.imagens || []).length > 0 && (
                        <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                          {q.imagens.map((img, imgIdx) => {
                            const placement = getImagePlacement(q.enunciado || '', imgIdx)
                            const tagStr = `[IMAGEM ${imgIdx + 1}]`
                            return (
                              <div key={imgIdx} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                width: 172,
                                borderRadius: 10,
                                border: `1.5px solid ${placement === 'inicio' ? '#93c5fd' : placement === 'texto' ? '#c4b5fd' : '#86efac'}`,
                                background: 'hsl(var(--bg-surface))',
                                overflow: 'hidden',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                                transition: 'all 0.2s ease'
                              }}>
                                {/* Image Preview - Formato compacto e elegante */}
                                <div style={{ position: 'relative', width: '100%', height: 85, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  <img src={getImgSrc(img)} alt={`Imagem ${imgIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white' }} />
                                  
                                  {/* Tag pill */}
                                  <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)', color: 'white', fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <ImageIcon size={9} color="#818cf8" /> Img {imgIdx + 1}
                                  </div>

                                  {/* Current position pill overlay */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 5,
                                    left: 5,
                                    background: placement === 'inicio' ? 'rgba(59,130,246,0.92)' : placement === 'texto' ? 'rgba(139,92,246,0.92)' : 'rgba(16,185,129,0.92)',
                                    color: 'white',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    borderRadius: 4,
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {placement === 'inicio' ? '🔝 Início' : placement === 'texto' ? '📍 No Texto' : '🔚 Final'}
                                  </div>

                                  {/* Delete Button */}
                                  {!readOnly && (
                                    <button 
                                      type="button"
                                      onClick={() => handleDeleteQuestaoImagem(qIdx, imgIdx)}
                                      title="Remover imagem"
                                      style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.92)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                                      <Trash2 size={10} />
                                    </button>
                                  )}

                                  {/* Resize buttons */}
                                  {!readOnly && (
                                    <div style={{ position: 'absolute', bottom: 5, right: 5, display: 'flex', gap: 2 }}>
                                      <button type="button" onClick={() => handleResizeQuestaoImagem(qIdx, imgIdx, 50)} title="Aumentar na diagramação" style={{ width: 19, height: 19, borderRadius: 5, background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <ZoomIn size={10} />
                                      </button>
                                      <button type="button" onClick={() => handleResizeQuestaoImagem(qIdx, imgIdx, -50)} title="Diminuir na diagramação" style={{ width: 19, height: 19, borderRadius: 5, background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <ZoomOut size={10} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Position Controls Bar (Início | Posicionar no Cursor | Final) */}
                                {!readOnly && (
                                  <div style={{ padding: '4px', background: 'hsl(var(--bg-surface))', display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: 3, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                                    <button
                                      type="button"
                                      onClick={() => setImagePlacement(qIdx, imgIdx, 'inicio')}
                                      title="Posicionar imagem no início (topo do enunciado)"
                                      style={{
                                        padding: '4px 2px',
                                        borderRadius: 6,
                                        border: '1px solid',
                                        borderColor: placement === 'inicio' ? '#3b82f6' : 'hsl(var(--border-subtle))',
                                        background: placement === 'inicio' ? 'rgba(59,130,246,0.14)' : 'hsl(var(--bg-app))',
                                        color: placement === 'inicio' ? '#2563eb' : 'hsl(var(--text-secondary))',
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <ArrowUp size={9} /> Início
                                    </button>

                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => handlePosicionarNoTexto(qIdx, imgIdx)}
                                      title="Inserir máscara da imagem exatamente na posição do cursor no enunciado"
                                      style={{
                                        padding: '4px 2px',
                                        borderRadius: 6,
                                        border: '1px solid',
                                        borderColor: placement === 'texto' ? '#8b5cf6' : 'hsl(var(--border-subtle))',
                                        background: placement === 'texto' ? 'rgba(139,92,246,0.14)' : 'hsl(var(--bg-app))',
                                        color: placement === 'texto' ? '#7c3aed' : 'hsl(var(--text-secondary))',
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <Target size={9} /> Posicionar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setImagePlacement(qIdx, imgIdx, 'final')}
                                      title="Posicionar imagem no final do enunciado"
                                      style={{
                                        padding: '4px 2px',
                                        borderRadius: 6,
                                        border: '1px solid',
                                        borderColor: placement === 'final' ? '#10b981' : 'hsl(var(--border-subtle))',
                                        background: placement === 'final' ? 'rgba(16,185,129,0.14)' : 'hsl(var(--bg-app))',
                                        color: placement === 'final' ? '#059669' : 'hsl(var(--text-secondary))',
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <ArrowDown size={9} /> Final
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        </>
                      )}
                    </div>

                    {/* Linhas de Rascunho / Resolução no Card da Questão com Alternativas */}
                    {(() => {
                      const lInfo = getQuestaoLinhasInfo(q)
                      if (!isTextoApoio(q) && (q.alternativas || []).length > 0 && lInfo.hasLinhas && lInfo.count > 0) {
                        return (
                          <div style={{
                            marginBottom: 16,
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: 'hsl(var(--bg-app))',
                            border: '1px solid hsl(var(--border-subtle))',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <AlignJustify size={14} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Linhas de Resolução / Rascunho
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                                      {lInfo.count} {lInfo.count === 1 ? 'linha' : 'linhas'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                                    Espaço para cálculos ou resolução manuscrita na folha impressa.
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ display: 'inline-flex', background: 'hsl(var(--bg-surface))', padding: 2, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', gap: 2 }}>
                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => updateQuestaoLinhas(qIdx, lInfo.count, 'pautado')}
                                    style={{
                                      padding: '4px 9px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      border: 'none',
                                      background: lInfo.style === 'pautado' ? '#8b5cf6' : 'transparent',
                                      color: lInfo.style === 'pautado' ? '#ffffff' : 'hsl(var(--text-secondary))',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Pautadas
                                  </button>
                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => updateQuestaoLinhas(qIdx, lInfo.count, 'em_branco')}
                                    style={{
                                      padding: '4px 9px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      border: 'none',
                                      background: lInfo.style === 'em_branco' ? '#8b5cf6' : 'transparent',
                                      color: lInfo.style === 'em_branco' ? '#ffffff' : 'hsl(var(--text-secondary))',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Em Branco
                                  </button>
                                </div>

                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => updateQuestaoLinhas(qIdx, 0, 'pautado')}
                                    title="Remover linhas desta questão"
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      border: '1px solid rgba(239,68,68,0.25)',
                                      background: 'rgba(239,68,68,0.06)',
                                      color: '#ef4444',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 size={11} /> Remover
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Slider 1 a 30 linhas */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <button
                                type="button"
                                disabled={readOnly || lInfo.count <= 1}
                                onClick={() => updateQuestaoLinhas(qIdx, Math.max(1, lInfo.count - 1), lInfo.style)}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 5,
                                  border: '1px solid hsl(var(--border-subtle))',
                                  background: 'hsl(var(--bg-surface))',
                                  color: 'hsl(var(--text-secondary))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <Minus size={11} />
                              </button>

                              <input
                                type="range"
                                min={1}
                                max={30}
                                step={1}
                                disabled={readOnly}
                                value={lInfo.count}
                                onChange={(e) => updateQuestaoLinhas(qIdx, parseInt(e.target.value, 10), lInfo.style)}
                                style={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 999,
                                  accentColor: '#8b5cf6',
                                  cursor: readOnly ? 'default' : 'pointer'
                                }}
                              />

                              <button
                                type="button"
                                disabled={readOnly || lInfo.count >= 30}
                                onClick={() => updateQuestaoLinhas(qIdx, Math.min(30, lInfo.count + 1), lInfo.style)}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 5,
                                  border: '1px solid hsl(var(--border-subtle))',
                                  background: 'hsl(var(--bg-surface))',
                                  color: 'hsl(var(--text-secondary))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <Plus size={11} />
                              </button>

                              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#8b5cf6', minWidth: 60, textAlign: 'right' }}>
                                {lInfo.count} {lInfo.count === 1 ? 'linha' : 'linhas'}
                              </span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}

                    {/* Alternatives or Texto de Apoio Banner */}
                    {isTextoApoio(q) ? (
                      <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7', flexShrink: 0 }}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Este item é um Texto de Apoio / Consulta</div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                            Ele será exibido na prova para orientação/leitura do aluno sem numeração de questão e sem alternativas, e não será contabilizado na contagem de questões.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'nowrap', gap: 8 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                            {(q.alternativas || []).length > 0 ? `Alternativas de Resposta (${q.alternativas.length})` : 'Formato da Questão'}
                          </label>
                          {!readOnly && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                              {(q.alternativas || []).length > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm('Deseja realmente remover as alternativas e transformar esta questão em descritiva?')) {
                                        const updated: Questao[] = questoes.map((qq, i) => i !== qIdx ? qq : { ...qq, tipo_questao: 'descritiva' as const, alternativas: [], gabarito: '', linhas_resposta: 5, estilo_espaco: 'pautado' as const })
                                        setQuestoes(updated)
                                        triggerSave(updated, false)
                                      }
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '5px 10px',
                                      borderRadius: 7,
                                      background: 'transparent',
                                      border: '1px solid hsl(var(--border-subtle))',
                                      color: 'hsl(var(--text-secondary))',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.15s'
                                    }}
                                    title="Converter em questão descritiva sem alternativas"
                                  >
                                    <AlignLeft size={12} />
                                    Descritiva
                                  </button>
                                  <button onClick={() => addAlternativa(qIdx)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: 'rgba(59,130,246,0.08)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                                    title="Adicionar nova alternativa"
                                  >
                                    <Plus size={12} /> Alternativa
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {!(q.alternativas || []).length ? (
                          /* CARD MODERNO DE QUESTÃO DESCRITIVA COM SLIDER 0 A 30 LINHAS */
                          <div style={{
                            padding: '18px 20px',
                            borderRadius: 14,
                            background: 'hsl(var(--bg-app))',
                            border: '1px solid hsl(var(--border-subtle))',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                          }}>
                            {/* Header da Questão Descritiva */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 10,
                                  background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.15))',
                                  color: '#8b5cf6',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <PenTool size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Espaço para Resposta do Aluno
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', textTransform: 'uppercase' }}>
                                      Descritiva
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                                    Defina o estilo e a quantidade de linhas para resposta manuscrita na folha impressa.
                                  </div>
                                </div>
                              </div>

                              {/* Segmented Control: Linhas Pautadas vs Espaço em Branco */}
                              <div style={{
                                display: 'inline-flex',
                                background: 'hsl(var(--bg-surface))',
                                padding: 3,
                                borderRadius: 10,
                                border: '1px solid hsl(var(--border-subtle))',
                                gap: 3
                              }}>
                                <button
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() => updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', estilo_espaco: 'pautado' })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 13px',
                                    borderRadius: 7,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: readOnly ? 'default' : 'pointer',
                                    border: 'none',
                                    background: estiloDescritiva === 'pautado' ? '#8b5cf6' : 'transparent',
                                    color: estiloDescritiva === 'pautado' ? '#ffffff' : 'hsl(var(--text-secondary))',
                                    boxShadow: estiloDescritiva === 'pautado' ? '0 2px 8px rgba(139,92,246,0.3)' : 'none',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  <AlignJustify size={13} /> Linhas Pautadas
                                </button>
                                <button
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() => updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', estilo_espaco: 'em_branco' })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 13px',
                                    borderRadius: 7,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: readOnly ? 'default' : 'pointer',
                                    border: 'none',
                                    background: estiloDescritiva === 'em_branco' ? '#8b5cf6' : 'transparent',
                                    color: estiloDescritiva === 'em_branco' ? '#ffffff' : 'hsl(var(--text-secondary))',
                                    boxShadow: estiloDescritiva === 'em_branco' ? '0 2px 8px rgba(139,92,246,0.3)' : 'none',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  <Maximize2 size={12} /> Espaço em Branco
                                </button>
                              </div>
                            </div>

                            {/* Barra Rolante Deslizante de 0 a 30 Linhas */}
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              padding: '14px 16px',
                              borderRadius: 12,
                              background: 'hsl(var(--bg-surface))',
                              border: '1px solid hsl(var(--border-subtle))'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                <label style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <AlignLeft size={14} color="#8b5cf6" />
                                  Tamanho da Resposta (0 a 30 linhas):
                                </label>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      disabled={linhasDescritiva <= 0}
                                      onClick={() => updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', linhas_resposta: Math.max(0, linhasDescritiva - 1) })}
                                      style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 6,
                                        border: '1px solid hsl(var(--border-subtle))',
                                        background: 'hsl(var(--bg-app))',
                                        color: 'hsl(var(--text-secondary))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: linhasDescritiva <= 0 ? 'not-allowed' : 'pointer',
                                        opacity: linhasDescritiva <= 0 ? 0.4 : 1
                                      }}
                                      title="Diminuir 1 linha"
                                    >
                                      <Minus size={12} />
                                    </button>
                                  )}

                                  <span style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: '#8b5cf6',
                                    background: 'rgba(139,92,246,0.12)',
                                    padding: '4px 12px',
                                    borderRadius: 20,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6
                                  }}>
                                    <span>{linhasDescritiva} {linhasDescritiva === 1 ? 'linha' : 'linhas'}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                                      ({estiloDescritiva === 'em_branco' ? 'espaço livre' : 'pautadas'} • ~{(linhasDescritiva * 0.8).toFixed(1)} cm)
                                    </span>
                                  </span>

                                  {!readOnly && (
                                    <button
                                      type="button"
                                      disabled={linhasDescritiva >= 30}
                                      onClick={() => updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', linhas_resposta: Math.min(30, linhasDescritiva + 1) })}
                                      style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 6,
                                        border: '1px solid hsl(var(--border-subtle))',
                                        background: 'hsl(var(--bg-app))',
                                        color: 'hsl(var(--text-secondary))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: linhasDescritiva >= 30 ? 'not-allowed' : 'pointer',
                                        opacity: linhasDescritiva >= 30 ? 0.4 : 1
                                      }}
                                      title="Aumentar 1 linha"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Input Range Slider com gradiente dinâmico */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', minWidth: 16 }}>0</span>
                                <input
                                  type="range"
                                  min={0}
                                  max={30}
                                  step={1}
                                  disabled={readOnly}
                                  value={linhasDescritiva}
                                  onChange={(e) => updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', linhas_resposta: parseInt(e.target.value, 10) })}
                                  style={{
                                    flex: 1,
                                    height: 7,
                                    borderRadius: 999,
                                    accentColor: '#8b5cf6',
                                    cursor: readOnly ? 'default' : 'pointer',
                                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(linhasDescritiva / 30) * 100}%, hsl(var(--border-subtle)) ${(linhasDescritiva / 30) * 100}%, hsl(var(--border-subtle)) 100%)`,
                                    outline: 'none'
                                  }}
                                />
                                <span style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', minWidth: 20 }}>30</span>
                              </div>

                              {/* Ticks Rápidos Clicáveis */}
                              {!readOnly && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 2 }}>
                                  {[0, 3, 5, 10, 15, 20, 25, 30].map(val => {
                                    const isSelected = linhasDescritiva === val
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', linhas_resposta: val })}
                                        style={{
                                          border: 'none',
                                          background: isSelected ? 'rgba(139,92,246,0.15)' : 'transparent',
                                          color: isSelected ? '#8b5cf6' : 'hsl(var(--text-secondary))',
                                          fontSize: 10.5,
                                          fontWeight: isSelected ? 800 : 600,
                                          padding: '2px 6px',
                                          borderRadius: 6,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s'
                                        }}
                                        title={`Definir ${val} linhas`}
                                      >
                                        {val}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Mini Simulador Visual da Folha Impressa */}
                            <div style={{
                              padding: '12px 16px',
                              borderRadius: 12,
                              background: 'hsl(var(--bg-surface))',
                              border: '1px dashed hsl(var(--border-subtle))',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Simulação Visual na Folha Impressa:
                              </div>

                              {linhasDescritiva === 0 ? (
                                <div style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', fontStyle: 'italic', padding: '4px 0' }}>
                                  Nenhum espaço reservado. A próxima questão será impressa logo abaixo do enunciado.
                                </div>
                              ) : estiloDescritiva === 'pautado' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 4px' }}>
                                  {Array.from({ length: Math.min(6, linhasDescritiva) }).map((_, li) => (
                                    <div key={li} style={{ width: '100%', height: 1, background: 'hsl(var(--border-subtle))' }} />
                                  ))}
                                  {linhasDescritiva > 6 && (
                                    <div style={{ fontSize: 10.5, color: '#8b5cf6', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>
                                      + {linhasDescritiva - 6} linhas adicionais serão impressas na folha (total de {linhasDescritiva} linhas pautadas)
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{
                                  height: Math.min(90, Math.max(45, linhasDescritiva * 4)),
                                  borderRadius: 8,
                                  border: '1px dashed rgba(139,92,246,0.3)',
                                  background: 'rgba(139,92,246,0.03)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'hsl(var(--text-secondary))',
                                  fontSize: 11.5,
                                  fontWeight: 600
                                }}>
                                  [ Espaço em branco reservado para cálculos ou resposta manuscrita • {linhasDescritiva} linhas ]
                                </div>
                              )}
                            </div>

                            {/* Botão de rodapé para transformar em Múltipla Escolha */}
                            {!readOnly && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const defaultAlts = [
                                      { letter: 'A', letra: 'A', text: '', correct: true, eh_correta: true, correta: true, is_correta: true, isCorrect: true },
                                      { letter: 'B', letra: 'B', text: '', correct: false, eh_correta: false, correta: false, is_correta: false, isCorrect: false },
                                      { letter: 'C', letra: 'C', text: '', correct: false, eh_correta: false, correta: false, is_correta: false, isCorrect: false },
                                      { letter: 'D', letra: 'D', text: '', correct: false, eh_correta: false, correta: false, is_correta: false, isCorrect: false },
                                    ]
                                    const updated: Questao[] = questoes.map((qq, i) => i !== qIdx ? qq : { ...qq, tipo_questao: 'multipla_escolha' as const, alternativas: defaultAlts, gabarito: 'A' })
                                    setQuestoes(updated)
                                    triggerSave(updated, false)
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    background: 'transparent',
                                    border: '1px solid hsl(var(--border-subtle))',
                                    color: 'hsl(var(--text-secondary))',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                  title="Adicionar alternativas A, B, C, D e transformar em múltipla escolha"
                                >
                                  <ListChecks size={13} color="#3b82f6" />
                                  Transformar em Múltipla Escolha (+ Alternativas)
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {q.alternativas.map((alt, aIdx) => {
                              const altUid = (alt as any)._uid || (alt as any).id || ((alt as any)._uid = `alt-ed-${qIdx}-${aIdx}-${Math.random().toString(36).substring(2, 7)}`);
                              return (
                                <div key={altUid} style={{ display: 'flex', flexDirection: 'column', position: 'relative', marginTop: alt.correct ? 4 : 0 }}>
                                  {/* Pasta Suspensa: Badge superior de "CORRETA" */}
                                  {alt.correct && (
                                    <div style={{
                                      alignSelf: 'flex-end',
                                      marginRight: 14,
                                      marginBottom: -1,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '2px 10px',
                                      borderRadius: '6px 6px 0 0',
                                      background: '#10b981',
                                      color: '#ffffff',
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      letterSpacing: '0.05em',
                                      boxShadow: '0 -2px 6px rgba(16,185,129,0.25)',
                                      zIndex: 2
                                    }}>
                                      <Check size={11} strokeWidth={3} />
                                      <span>CORRETA</span>
                                    </div>
                                  )}
                                  <div className="alt-row"
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 10, 
                                      padding: '8px 12px', 
                                      borderRadius: alt.correct ? '10px 0 10px 10px' : 10, 
                                      background: alt.correct ? 'rgba(16,185,129,0.05)' : 'hsl(var(--bg-app))', 
                                      border: `1.5px solid ${alt.correct ? '#10b981' : 'hsl(var(--border-subtle))'}`, 
                                      transition: 'all 0.15s', 
                                      position: 'relative', 
                                      zIndex: reorderOpen === `${qIdx}-${aIdx}` ? 50 : 1 
                                    }}>
                                  <div 
                                    onClick={!readOnly ? () => setReorderOpen(reorderOpen === `${qIdx}-${aIdx}` ? null : `${qIdx}-${aIdx}`) : undefined}
                                    title={!readOnly ? `Alternativa ${alt.letter} (clique para reordenar)` : undefined}
                                    style={{ 
                                      width: 28, height: 28, borderRadius: 8, 
                                      background: reorderOpen === `${qIdx}-${aIdx}` ? '#eff6ff' : (alt.correct ? '#10b981' : 'rgba(100,116,139,0.1)'), 
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 13, 
                                      color: reorderOpen === `${qIdx}-${aIdx}` ? '#2563eb' : (alt.correct ? '#ffffff' : 'hsl(var(--text-secondary))'),
                                      cursor: !readOnly ? 'pointer' : 'default',
                                      border: reorderOpen === `${qIdx}-${aIdx}` ? '2px solid #2563eb' : '1px solid transparent',
                                      boxShadow: reorderOpen === `${qIdx}-${aIdx}` ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {alt.letter}
                                  </div>
                                {reorderOpen === `${qIdx}-${aIdx}` && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'absolute',
                                      left: 12,
                                      bottom: aIdx === 0 ? 'auto' : '100%',
                                      top: aIdx === 0 ? '100%' : 'auto',
                                      marginBottom: aIdx === 0 ? 0 : 6,
                                      marginTop: aIdx === 0 ? 6 : 0,
                                      background: 'hsl(var(--bg-surface, #ffffff))',
                                      borderRadius: 12,
                                      padding: '8px 12px',
                                      boxShadow: '0 10px 25px -4px rgba(0,0,0,0.25), 0 4px 10px -2px rgba(0,0,0,0.15)',
                                      border: '1.5px solid #93c5fd',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                      zIndex: 9999,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                                        Mover alternativa <strong>({alt.letter})</strong> para:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setReorderOpen(null)}
                                        style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      {Array.from({ length: q.alternativas.length }).map((_, targetIdx) => {
                                        const targetLetter = String.fromCharCode(65 + targetIdx);
                                        const isCurrent = targetIdx === aIdx;
                                        return (
                                          <button
                                            key={targetIdx}
                                            type="button"
                                            disabled={isCurrent}
                                            onClick={() => {
                                              moveAlternativa(qIdx, aIdx, targetIdx);
                                              setReorderOpen(null);
                                            }}
                                            title={isCurrent ? `Posição atual (${targetLetter})` : `Mover para letra ${targetLetter}`}
                                            style={{
                                              width: 30,
                                              height: 30,
                                              borderRadius: 8,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: 12,
                                              fontWeight: 800,
                                              cursor: isCurrent ? 'default' : 'pointer',
                                              border: isCurrent ? '1.5px solid #e2e8f0' : '1.5px solid #93c5fd',
                                              background: isCurrent ? '#f1f5f9' : '#eff6ff',
                                              color: isCurrent ? '#94a3b8' : '#2563eb',
                                              transition: 'all 0.15s ease'
                                            }}
                                          >
                                            {targetLetter}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {alt.imagem_url && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', width: 'fit-content' }}>
                                      <img
                                        src={alt.imagem_url.split('#')[0]}
                                        alt={`Alternativa ${alt.letter}`}
                                        style={{ maxHeight: 40, maxWidth: 180, objectFit: 'contain', borderRadius: 4 }}
                                      />
                                      {!readOnly && (
                                        <button
                                          type="button"
                                          onClick={() => updateAlternativa(qIdx, aIdx, 'imagem_url', null)}
                                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                          title="Remover imagem da alternativa"
                                        >
                                          <X size={13} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  <HtmlContent
                                    key={`alt-content-${altUid}`}
                                    editable={!readOnly}
                                    html={alt.text || ''}
                                    onBlurHtml={(newHtml: string) => updateAlternativa(qIdx, aIdx, 'text', newHtml)}
                                    style={{ flex: 1, border: 'none', background: 'transparent', color: alt.correct ? '#1e293b' : 'hsl(var(--text-primary))', fontSize: 14, outline: 'none', width: '100%', minHeight: 24 }}
                                  />
                                </div>
                                {!readOnly && (
                                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      onClick={() => setReorderOpen(reorderOpen === `${qIdx}-${aIdx}` ? null : `${qIdx}-${aIdx}`)}
                                      title="Reordenar / Mover alternativa"
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 7,
                                        background: reorderOpen === `${qIdx}-${aIdx}` ? '#2563eb' : 'transparent',
                                        border: `1px solid ${reorderOpen === `${qIdx}-${aIdx}` ? '#2563eb' : 'hsl(var(--border-subtle))'}`,
                                        color: reorderOpen === `${qIdx}-${aIdx}` ? '#ffffff' : 'hsl(var(--text-secondary))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <ArrowUpDown size={13} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleUploadAlternativaImagem(qIdx, aIdx)} 
                                      title={alt.imagem_url ? "Alterar imagem da alternativa" : "Adicionar imagem à alternativa"}
                                      style={{ width: 28, height: 28, borderRadius: 7, background: alt.imagem_url ? 'rgba(59,130,246,0.1)' : 'transparent', border: `1px solid ${alt.imagem_url ? '#3b82f6' : 'hsl(var(--border-subtle))'}`, color: alt.imagem_url ? '#3b82f6' : 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    >
                                      <ImageIcon size={13} />
                                    </button>
                                    {(() => {
                                      const altLines = getAltLines(alt.text || '')
                                      const hasAltLines = altLines.count > 0
                                      const isSliderOpen = activeAltLines === `${qIdx}-${aIdx}`

                                      return (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            if (isSliderOpen) {
                                              setActiveAltLines(null)
                                            } else {
                                              setActiveAltLines(`${qIdx}-${aIdx}`)
                                              if (!hasAltLines) {
                                                updateAlternativaLinhas(qIdx, aIdx, 3, 'pautado')
                                              }
                                            }
                                          }} 
                                          title={hasAltLines ? `${altLines.count} linhas nesta alternativa (clique para ajustar)` : "Adicionar linhas de resposta a esta alternativa"}
                                          style={{
                                            height: 28,
                                            padding: '0 7px',
                                            borderRadius: 7,
                                            background: hasAltLines ? 'rgba(139,92,246,0.12)' : (isSliderOpen ? 'rgba(139,92,246,0.08)' : 'transparent'),
                                            border: `1px solid ${hasAltLines || isSliderOpen ? '#8b5cf6' : 'hsl(var(--border-subtle))'}`,
                                            color: hasAltLines || isSliderOpen ? '#8b5cf6' : 'hsl(var(--text-secondary))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                          }}
                                        >
                                          <AlignJustify size={12} />
                                          <span>{hasAltLines ? `${altLines.count}L` : '+ Linhas'}</span>
                                        </button>
                                      )
                                    })()}
                                    <button onClick={() => updateAlternativa(qIdx, aIdx, 'correct', !alt.correct)} title={alt.correct ? 'Remover gabarito' : 'Marcar como correta'}
                                      style={{ width: 28, height: 28, borderRadius: 7, background: alt.correct ? 'rgba(16,185,129,0.15)' : 'transparent', border: `1px solid ${alt.correct ? '#10b981' : 'hsl(var(--border-subtle))'}`, color: alt.correct ? '#10b981' : 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                                      <CheckCircle size={14} />
                                    </button>
                                    <button onClick={() => removeAlternativa(qIdx, aIdx)}
                                      style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: '1px solid hsl(var(--border-subtle))', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                      <X size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {activeAltLines === `${qIdx}-${aIdx}` && (() => {
                                const altLines = getAltLines(alt.text || '')
                                return (
                                  <div style={{
                                    marginTop: 6,
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    background: 'hsl(var(--bg-surface))',
                                    border: '1px solid #c4b5fd',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                  }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>
                                      Linhas da alternativa {alt.letter}:
                                    </span>
                                    <input
                                      type="range"
                                      min={0}
                                      max={20}
                                      step={1}
                                      value={altLines.count}
                                      onChange={e => updateAlternativaLinhas(qIdx, aIdx, parseInt(e.target.value, 10), altLines.style)}
                                      style={{ flex: 1, height: 5, accentColor: '#8b5cf6' }}
                                    />
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', minWidth: 40, textAlign: 'right' }}>
                                      {altLines.count} {altLines.count === 1 ? 'linha' : 'linhas'}
                                    </span>
                                    {altLines.count > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => updateAlternativaLinhas(qIdx, aIdx, 0, 'pautado')}
                                        title="Remover linhas desta alternativa"
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}
                                      >
                                        Remover
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setActiveAltLines(null)}
                                      style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                      title="Fechar ajuste"
                                    >
                                      <Check size={13} color="#10b981" />
                                    </button>
                                  </div>
                                )
                              })()}
                            </div>
                            );
                          })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          )
        })}
      </div>

          {footerContent && (
            <div style={{ marginTop: 24, paddingBottom: 40 }}>
              {footerContent}
            </div>
          )}
        </div>

        {sidebarContent && (
          <div style={{ position: 'sticky', top: 24 }}>
            {sidebarContent}
          </div>
        )}
      </div>

      {reorderOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setReorderOpen(null)}
        />
      )}
    </div>
  )
}
