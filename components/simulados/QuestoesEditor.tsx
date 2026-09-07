'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, ChevronDown, ChevronUp, Image as ImageIcon,
  Loader2, Sparkles, Plus, X, ZoomIn, ZoomOut, CheckCircle, Upload, Edit, FileText, BookOpen,
  ArrowUp, ArrowDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isQuestionForRequisicao } from '@/lib/utils'
import { HtmlContent } from '@/components/HtmlContent'
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
  requisicoes
}: QuestoesEditorProps) {
  const [generatingAiFor, setGeneratingAiFor] = useState<number | null>(null)
  const [disciplinasList, setDisciplinasList] = useState<any[]>(disciplinas || [])

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
    setQuestoes(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIdx, 1)
      updated.splice(toIdx, 0, moved)
      return recalculateNumeros(updated)
    })
  }

  const updateQuestao = (idx: number, field: string, value: any) => {
    setQuestoes(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  const updateAlternativa = (qIdx: number, aIdx: number, field: string, value: any) => {
    setQuestoes(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const alts = [...(q.alternativas || [])]
      if (alts[aIdx]) {
        alts[aIdx] = { ...alts[aIdx], [field]: value }
      }
      
      if (field === 'correct') {
        if (value === true) {
          return { ...q, alternativas: alts.map((a, ai) => ({ ...a, correct: ai === aIdx })), gabarito: alts[aIdx].letter }
        } else {
          return { ...q, alternativas: alts, gabarito: '' }
        }
      }
      return { ...q, alternativas: alts }
    }))
  }

  const addAlternativa = (qIdx: number) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    setQuestoes(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const alts = q.alternativas || []
      const nextLetter = letters[alts.length] || `${alts.length + 1}`
      return { ...q, alternativas: [...alts, { letter: nextLetter, text: '', correct: false }] }
    }))
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
          // Adiciona #w=350 para a imagem já nascer com um tamanho harmonioso
          const newImgs = [...(q.imagens || []), { src: `${data.url}#w=350`, contentType: 'image/jpeg' }]
          return { ...q, imagens: newImgs }
        }))
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
        return { ...q, imagens: newImgs }
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
    setQuestoes(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      return { ...q, alternativas: (q.alternativas || []).filter((_, ai) => ai !== aIdx) }
    }))
  }

  const removeQuestao = (idx: number) => {
    setQuestoes(prev => recalculateNumeros(prev.filter((_, i) => i !== idx)))
  }

  const updateQuestaoDescritiva = (qIdx: number, updates: { tipo_questao?: 'multipla_escolha'|'descritiva'|'texto_apoio', linhas_resposta?: number, estilo_espaco?: 'em_branco'|'pautado' }) => {
    setQuestoes(prev => prev.map((q, i) => {
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
    }))
  }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleAddQuestao = (novaQuestao: any) => {
    const activeReq = requisicoes?.find((r: any) => r.id === (novaQuestao.id_requisicao || defaultRequisicaoId))
    const discNome = novaQuestao.disciplina_nome || novaQuestao.disciplina || activeReq?.disciplina_nome || activeReq?.simulados_disciplinas?.nome || ''
    const profNome = novaQuestao.professor_nome || activeReq?.professor_nome || ''

    const enriched = {
      ...novaQuestao,
      id_requisicao: novaQuestao.id_requisicao || defaultRequisicaoId || activeReq?.id || undefined,
      id_disciplina: novaQuestao.id_disciplina || defaultDisciplinaId || activeReq?.id_disciplina || undefined,
      disciplina_id: novaQuestao.disciplina_id || defaultDisciplinaId || activeReq?.id_disciplina || undefined,
      disciplina_nome: discNome || undefined,
      disciplina: discNome || undefined,
      id_professor: novaQuestao.id_professor || defaultProfessorId || activeReq?.id_professor || undefined,
      professor_nome: profNome || undefined,
      expandido: true,
    }

    if (editingIndex !== null) {
      setQuestoes(prev => {
        const updated = prev.map((q, i) => i === editingIndex ? { ...enriched, numero: q.numero } : q)
        return recalculateNumeros(updated)
      })
    } else {
      setQuestoes(prev => recalculateNumeros([...prev, enriched]))
    }
    setIsModalOpen(false)
    setEditingIndex(null)
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
    setQuestoes(prev => recalculateNumeros([newApoio, ...prev]))
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
      {/* Stats and Actions Control Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '16px 20px',
        borderRadius: 16,
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
        marginBottom: 24
      }}>
        {/* Stat badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Questões', value: totalQuestoes, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
            { label: 'Com alternativas', value: comAlternativas, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
            { label: 'Com gabarito', value: comGabarito, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
            ...(totalTextosApoio > 0 ? [{ label: 'Textos de apoio', value: totalTextosApoio, color: '#a855f7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)' }] : [])
          ].map((s, i) => (
            <div key={i} style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: s.bg,
              border: `1px solid ${s.border}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {!readOnly && showAddQuestao && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <motion.button
              onClick={handleAddTextoApoio}
              whileHover={{ scale: 1.03, translateY: -1 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: 10,
                background: 'rgba(168,85,247,0.1)',
                color: '#9333ea',
                border: '1px solid rgba(168,85,247,0.3)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <FileText size={16} /> Adicionar Texto de Apoio
            </motion.button>
            <motion.button
              onClick={() => { setEditingIndex(null); setIsModalOpen(true); }}
              whileHover={{ scale: 1.03, translateY: -1 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(139,92,246,0.35)',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={16} /> Adicionar Questão
            </motion.button>
          </div>
        )}
      </div>

      {/* Questions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questoes.map((q, qIdx) => {
          const discName = getQuestaoDisciplina(q)
          const discStyle = discName ? getDisciplinaBadgeStyle(discName) : null

          return (
          <motion.div key={qIdx} className="questao-card" layout
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qIdx * 0.03 }}
            style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 18, overflow: 'hidden', transition: 'border-color 0.2s' }}>

            {/* Question header */}
            <div
              onClick={() => updateQuestao(qIdx, 'expandido', q.expandido === false ? true : false)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}>
              {isTextoApoio(q) ? (
                <div style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', gap: 6, color: '#a855f7', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                  <FileText size={15} /> APOIO
                </div>
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#8b5cf6', fontWeight: 800, fontSize: 14 }}>
                  {q.numero}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {q.enunciado ? q.enunciado.replace(/<[^>]+>/g, '') : <span style={{ color: 'hsl(var(--text-secondary))', fontStyle: 'italic' }}>Sem enunciado</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 5 }}>
                  {discName && discStyle && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: discStyle.bg,
                      color: discStyle.color,
                      border: `1px solid ${discStyle.border}`,
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: '16px',
                      whiteSpace: 'nowrap'
                    }}>
                      <BookOpen size={11} />
                      {discName}
                    </span>
                  )}
                  {isTextoApoio(q) ? (
                    <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Texto de Apoio / Consulta (não contabiliza)</span>
                  ) : (
                    <>
                      {(q.alternativas || []).length > 0 && <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>{q.alternativas.length} alternativas</span>}
                      {q.gabarito && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Gabarito: {q.gabarito}</span>}
                    </>
                  )}
                  {(q.imagens || []).length > 0 && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><ImageIcon size={10} /> {q.imagens.length} imagem{q.imagens.length > 1 ? 'ns' : ''}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!readOnly && (
                  <>
                    <motion.button 
                      type="button"
                      whileHover={qIdx > 0 ? { scale: 1.08 } : {}} 
                      whileTap={qIdx > 0 ? { scale: 0.92 } : {}} 
                      disabled={qIdx === 0}
                      onClick={e => { e.stopPropagation(); moveQuestao(qIdx, qIdx - 1) }}
                      style={{ 
                        width: 32, height: 32, borderRadius: 8, 
                        background: qIdx === 0 ? 'transparent' : 'rgba(139,92,246,0.08)', 
                        color: qIdx === 0 ? 'hsl(var(--text-disabled, #94a3b8))' : '#8b5cf6', 
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: qIdx === 0 ? 'not-allowed' : 'pointer',
                        opacity: qIdx === 0 ? 0.3 : 1
                      }}
                      title="Mover para Cima">
                      <ArrowUp size={14} />
                    </motion.button>
                    <motion.button 
                      type="button"
                      whileHover={qIdx < questoes.length - 1 ? { scale: 1.08 } : {}} 
                      whileTap={qIdx < questoes.length - 1 ? { scale: 0.92 } : {}} 
                      disabled={qIdx === questoes.length - 1}
                      onClick={e => { e.stopPropagation(); moveQuestao(qIdx, qIdx + 1) }}
                      style={{ 
                        width: 32, height: 32, borderRadius: 8, 
                        background: qIdx === questoes.length - 1 ? 'transparent' : 'rgba(139,92,246,0.08)', 
                        color: qIdx === questoes.length - 1 ? 'hsl(var(--text-disabled, #94a3b8))' : '#8b5cf6', 
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: qIdx === questoes.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: qIdx === questoes.length - 1 ? 0.3 : 1
                      }}
                      title="Mover para Baixo">
                      <ArrowDown size={14} />
                    </motion.button>
                  </>
                )}
                <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={e => { e.stopPropagation(); setEditingIndex(qIdx); setIsModalOpen(true); }}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  title="Editar Questão no Modal">
                  <Edit size={14} />
                </motion.button>
                {!readOnly && (
                  <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={e => { e.stopPropagation(); removeQuestao(qIdx) }}
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </motion.button>
                )}
                {q.expandido !== false ? <ChevronUp size={18} color="hsl(var(--text-secondary))" /> : <ChevronDown size={18} color="hsl(var(--text-secondary))" />}
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {isTextoApoio(q) ? 'Texto / Enunciado de Apoio' : 'Enunciado da Questão'}
                        </label>
                        {discName && discStyle && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: discStyle.bg,
                            color: discStyle.color,
                            border: `1px solid ${discStyle.border}`,
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: '16px'
                          }}>
                            <BookOpen size={11} />
                            {discName}
                          </span>
                        )}
                      </div>
                      <HtmlContent
                        editable={!readOnly}
                        html={q.enunciado || ''}
                        onBlurHtml={(newHtml: string) => updateQuestao(qIdx, 'enunciado', newHtml)}
                        style={{ width: '100%', minHeight: 120, padding: '16px 20px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, lineHeight: 1.6, outline: 'none', whiteSpace: 'pre-wrap' }}
                      />
                    </div>

                    {/* Images */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <ImageIcon size={12} style={{ marginRight: 4 }} />Imagens de Apoio ({(q.imagens || []).length})
                        </label>
                        {!readOnly && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleUploadQuestaoImagem(qIdx)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              <Upload size={12} /> Upload
                            </button>
                            <button onClick={() => handleGenerateQuestaoImagemAi(qIdx, q.enunciado || '')} disabled={generatingAiFor === qIdx}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: 'none', fontSize: 11, fontWeight: 600, cursor: generatingAiFor === qIdx ? 'not-allowed' : 'pointer', opacity: generatingAiFor === qIdx ? 0.6 : 1 }}>
                              {generatingAiFor === qIdx ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar IA
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {(q.imagens || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                          {q.imagens.map((img, imgIdx) => (
                            <div key={imgIdx} style={{ position: 'relative', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, overflow: 'hidden', width: 160, height: 120, background: 'hsl(var(--bg-app))' }}>
                              <img src={typeof img === 'string' ? img : img?.src} alt={`Imagem ${imgIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white' }} />
                              <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                                [IMAGEM {imgIdx + 1}]
                              </div>
                              {!readOnly && (
                                <>
                                  <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4 }}>
                                    <button onClick={() => handleResizeQuestaoImagem(qIdx, imgIdx, 50)} title="Aumentar" style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                      <ZoomIn size={12} />
                                    </button>
                                    <button onClick={() => handleResizeQuestaoImagem(qIdx, imgIdx, -50)} title="Diminuir" style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                      <ZoomOut size={12} />
                                    </button>
                                  </div>
                                  <button onClick={() => {
                                    setQuestoes(prev => prev.map((qq, qi) => qi !== qIdx ? qq : { ...qq, imagens: (qq.imagens || []).filter((_, ii) => ii !== imgIdx) }))
                                  }} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <X size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 6 }}>
                        <strong>Dica:</strong> Cole a tag <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: 4 }}>[IMAGEM N]</code> no enunciado acima exatamente onde deseja que ela apareça.
                      </div>
                    </div>

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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alternativas</label>
                          {!readOnly && (
                            <button onClick={() => addAlternativa(qIdx)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.15)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              <Plus size={12} /> Add alternativa
                            </button>
                          )}
                        </div>

                        {!(q.alternativas || []).length ? (
                          <div style={{ padding: '16px', borderRadius: 10, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Questão Descritiva</div>
                                 <button 
                                   onClick={() => !readOnly && updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', estilo_espaco: 'pautado' })}
                                   style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: readOnly ? 'default' : 'pointer', border: '1px solid', 
                                            background: q.tipo_questao === 'descritiva' && q.estilo_espaco === 'pautado' ? 'rgba(59,130,246,0.1)' : 'transparent',
                                            color: q.tipo_questao === 'descritiva' && q.estilo_espaco === 'pautado' ? '#3b82f6' : 'hsl(var(--text-secondary))',
                                            borderColor: q.tipo_questao === 'descritiva' && q.estilo_espaco === 'pautado' ? 'rgba(59,130,246,0.3)' : 'hsl(var(--border-subtle))',
                                            opacity: readOnly && (q.tipo_questao !== 'descritiva' || q.estilo_espaco !== 'pautado') ? 0.5 : 1 }}>
                                   Linhas Pautadas
                                 </button>
                                 <button 
                                   onClick={() => !readOnly && updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', estilo_espaco: 'em_branco' })}
                                   style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: readOnly ? 'default' : 'pointer', border: '1px solid',
                                            background: q.tipo_questao === 'descritiva' && q.estilo_espaco === 'em_branco' ? 'rgba(59,130,246,0.1)' : 'transparent',
                                            color: q.tipo_questao === 'descritiva' && q.estilo_espaco === 'em_branco' ? '#3b82f6' : 'hsl(var(--text-secondary))',
                                            borderColor: q.tipo_questao === 'descritiva' && q.estilo_espaco === 'em_branco' ? 'rgba(59,130,246,0.3)' : 'hsl(var(--border-subtle))',
                                            opacity: readOnly && (q.tipo_questao !== 'descritiva' || q.estilo_espaco !== 'em_branco') ? 0.5 : 1 }}>
                                   Espaço em Branco
                                 </button>
                              </div>
                            
                            {q.tipo_questao === 'descritiva' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                                <label style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Tamanho (em linhas):</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {[0, 1, 3, 5, 10, 15, 20, 25, 30].map(n => {
                                    const isSelected = (q.linhas_resposta !== undefined ? q.linhas_resposta : 5) === n;
                                    return (
                                      <button
                                        key={n}
                                        onClick={() => !readOnly && updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', linhas_resposta: n })}
                                        style={{
                                          width: 32, height: 32, borderRadius: 8, border: '1px solid',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, cursor: readOnly ? 'default' : 'pointer',
                                          background: isSelected ? '#8b5cf6' : 'transparent',
                                          color: isSelected ? 'white' : 'hsl(var(--text-secondary))',
                                          borderColor: isSelected ? '#8b5cf6' : 'hsl(var(--border-subtle))',
                                          transition: 'all 0.2s',
                                          opacity: readOnly && !isSelected ? 0.5 : 1
                                        }}
                                      >
                                        {n}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {q.tipo_questao !== 'descritiva' && (
                               <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 12 }}>
                                 Nenhuma alternativa detectada. Selecione um formato acima para configurar como questão descritiva.
                               </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {q.alternativas.map((alt, aIdx) => (
                              <div key={aIdx} className="alt-row"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: alt.correct ? 'rgba(16,185,129,0.05)' : 'hsl(var(--bg-app))', border: `1px solid ${alt.correct ? 'rgba(16,185,129,0.3)' : 'hsl(var(--border-subtle))'}`, transition: 'all 0.15s' }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: alt.correct ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 13, color: alt.correct ? '#10b981' : 'hsl(var(--text-secondary))' }}>
                                  {alt.letter}
                                </div>
                                <HtmlContent
                                  editable={!readOnly}
                                  html={alt.text || ''}
                                  onBlurHtml={(newHtml: string) => updateAlternativa(qIdx, aIdx, 'text', newHtml)}
                                  style={{ flex: 1, border: 'none', background: 'transparent', color: alt.correct ? '#1e293b' : 'hsl(var(--text-primary))', fontSize: 14, outline: 'none', width: '100%', minHeight: 24 }}
                                />
                                {!readOnly && (
                                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
                            ))}
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
    </div>
  )
}
