'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, ChevronDown, ChevronUp, Image as ImageIcon,
  Loader2, Sparkles, Plus, X, ZoomIn, ZoomOut, CheckCircle, Upload, Edit, FileText
} from 'lucide-react'
import { HtmlContent } from '@/components/HtmlContent'
import { Questao } from '@/components/simulados/ProvaPreviewModal'
import { QuestaoUploadModal } from '@/components/simulados/QuestaoUploadModal'

interface QuestoesEditorProps {
  questoes: Questao[]
  setQuestoes: React.Dispatch<React.SetStateAction<Questao[]>>
  showAddQuestao?: boolean
  defaultDisciplinaId?: string
  defaultProfessorId?: string
  readOnly?: boolean
}

export function QuestoesEditor({ questoes, setQuestoes, showAddQuestao = true, defaultDisciplinaId, defaultProfessorId, readOnly = false }: QuestoesEditorProps) {
  const [generatingAiFor, setGeneratingAiFor] = useState<number | null>(null)

  const recalculateNumeros = (list: Questao[]) => {
    let numCounter = 1
    return list.map(q => {
      if (q.tipo_questao === 'texto_apoio') {
        return { ...q, numero: 0 }
      }
      const updated = { ...q, numero: numCounter }
      numCounter++
      return updated
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
         html += `<meta name="linhas_resposta" content="${updatedQ.linhas_resposta || 5}">`
         html += `<meta name="estilo_espaco" content="${updatedQ.estilo_espaco || 'em_branco'}">`
      }
      
      return { ...updatedQ, enunciado: html }
    }))
  }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleAddQuestao = (novaQuestao: any) => {
    if (editingIndex !== null) {
      setQuestoes(prev => prev.map((q, i) => i === editingIndex ? { ...novaQuestao, numero: q.numero } : q))
    } else {
      setQuestoes(prev => recalculateNumeros([...prev, novaQuestao]))
    }
    setIsModalOpen(false)
    setEditingIndex(null)
  }

  const handleAddTextoApoio = () => {
    setQuestoes(prev => recalculateNumeros([
      ...prev,
      {
        numero: 0,
        tipo_questao: 'texto_apoio',
        enunciado: '<p>Digite aqui o texto de apoio ou consulta...</p>',
        alternativas: [],
        imagens: [],
        gabarito: '',
        pontuacao: 0,
        expandido: true
      }
    ]))
  }

  const totalQuestoes = questoes.filter(q => q.tipo_questao !== 'texto_apoio').length
  const comAlternativas = questoes.filter(q => q.tipo_questao !== 'texto_apoio' && (q.alternativas || []).length > 0).length
  const comGabarito = questoes.filter(q => q.tipo_questao !== 'texto_apoio' && q.gabarito).length
  const totalTextosApoio = questoes.filter(q => q.tipo_questao === 'texto_apoio').length

  return (
    <div style={{ width: '100%' }}>
      {isModalOpen && (
        <QuestaoUploadModal
          questao={editingIndex !== null ? questoes[editingIndex] : undefined}
          defaultDisciplinaId={defaultDisciplinaId}
          defaultProfessorId={defaultProfessorId}
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
        {questoes.map((q, qIdx) => (
          <motion.div key={qIdx} className="questao-card" layout
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qIdx * 0.03 }}
            style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 18, overflow: 'hidden', transition: 'border-color 0.2s' }}>

            {/* Question header */}
            <div
              onClick={() => updateQuestao(qIdx, 'expandido', q.expandido === false ? true : false)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}>
              {q.tipo_questao === 'texto_apoio' ? (
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
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  {q.tipo_questao === 'texto_apoio' ? (
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
              <div style={{ display: 'flex', gap: 6 }}>
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
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        {q.tipo_questao === 'texto_apoio' ? 'Texto / Enunciado de Apoio' : 'Enunciado da Questão'}
                      </label>
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
                              <img src={img.src} alt={`Imagem ${imgIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white' }} />
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
                    {q.tipo_questao === 'texto_apoio' ? (
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
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {[3, 5, 10, 15, 20, 25, 30].map(n => (
                                    <button
                                      key={n}
                                      onClick={() => !readOnly && updateQuestaoDescritiva(qIdx, { tipo_questao: 'descritiva', linhas_resposta: n })}
                                      style={{
                                        width: 32, height: 32, borderRadius: 8, border: '1px solid',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, cursor: readOnly ? 'default' : 'pointer',
                                        background: (q.linhas_resposta || 5) === n ? '#8b5cf6' : 'transparent',
                                        color: (q.linhas_resposta || 5) === n ? 'white' : 'hsl(var(--text-secondary))',
                                        borderColor: (q.linhas_resposta || 5) === n ? '#8b5cf6' : 'hsl(var(--border-subtle))',
                                        transition: 'all 0.2s',
                                        opacity: readOnly && (q.linhas_resposta || 5) !== n ? 0.5 : 1
                                      }}
                                    >
                                      {n}
                                    </button>
                                  ))}
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
        ))}
      </div>
    </div>
  )
}
