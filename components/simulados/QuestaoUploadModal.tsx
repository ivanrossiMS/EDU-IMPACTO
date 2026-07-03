'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Image as ImageIcon, Upload, Loader2, Eye, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Sparkles, Bot } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EditorQuill } from './EditorQuill'
import { HtmlContent } from '../HtmlContent'

export function QuestaoUploadModal({ questao, defaultProfessorId, defaultDisciplinaId, tituloContexto, onClose, onSaveObj }: { questao?: any, defaultProfessorId?: string, defaultDisciplinaId?: string, tituloContexto?: string, onClose: () => void, onSaveObj: (q: any) => void }) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  
  const [idDisciplina, setIdDisciplina] = useState(questao?.id_disciplina || defaultDisciplinaId || '')
  const [enunciado, setEnunciado] = useState(questao ? '' : '<div style="text-align: justify;"><br></div>')
  const [turma, setTurma] = useState('')
  const [imagensApoio, setImagensApoio] = useState<{url: string, posicao: 'inicio' | 'final'}[]>([])
  const [showPreview, setShowPreview] = useState(true)
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiForm, setAiForm] = useState({ assunto: '', turma: '', detalhes: '', formato: 'padrao' })
  const [aiDificuldade, setAiDificuldade] = useState('media')

  const turmasDisponiveis = [
    '6º Ano Fundamental',
    '7º Ano Fundamental',
    '8º Ano Fundamental',
    '9º Ano Fundamental',
    '1º Ano Ensino Médio',
    '2º Ano Ensino Médio',
    '3º Ano Ensino Médio',
  ]
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [alternativas, setAlternativas] = useState<any[]>(() => {
    if (questao?.alternativas?.length > 0) {
      return questao.alternativas.map((a: any) => ({ letra: a.letter, texto: a.text, correta: a.correct }))
    }
    if (questao?.simulados_alternativas?.length > 0) {
      return questao.simulados_alternativas.map((a: any) => ({ ...a, correta: a.eh_correta || a.correta })).sort((a: any, b: any) => a.letra.localeCompare(b.letra))
    }
    return [
      { letra: 'A', texto: '', correta: true },
      { letra: 'B', texto: '', correta: false },
      { letra: 'C', texto: '', correta: false },
      { letra: 'D', texto: '', correta: false },
      { letra: 'E', texto: '', correta: false },
    ]
  })

  useEffect(() => {
    if (questao) {
      setIdDisciplina(questao.id_disciplina || '')
      
      // Extrair imagens do HTML para mostrar separadas na interface
      if (questao.enunciado) {
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = questao.enunciado
        
        const imgs = Array.from(tempDiv.querySelectorAll('img'))
        const extraidas: {url: string, posicao: 'inicio' | 'final'}[] = []
        
        imgs.forEach(img => {
          let posicao: 'inicio' | 'final' = 'final'
          if (img.parentElement && img.parentElement.tagName === 'DIV' && img.parentElement.dataset.posicao) {
            posicao = img.parentElement.dataset.posicao as 'inicio' | 'final'
          }
          
          extraidas.push({ url: img.src, posicao })
          
          // Tenta remover a div wrapper (margin: 16px 0; text-align: center;)
          if (img.parentElement && img.parentElement.tagName === 'DIV' && img.parentElement.style.textAlign === 'center') {
            img.parentElement.remove()
          } else {
            img.remove()
          }
        })
        
        // Remove quebras de linha (<br/>) sobrando no início e no final
        let finalHtml = tempDiv.innerHTML.trim()
        while (finalHtml.startsWith('<br>')) finalHtml = finalHtml.slice(4).trim()
        while (finalHtml.startsWith('<br/>')) finalHtml = finalHtml.slice(5).trim()
        while (finalHtml.endsWith('<br>')) finalHtml = finalHtml.slice(0, -4).trim()
        while (finalHtml.endsWith('<br/>')) finalHtml = finalHtml.slice(0, -5).trim()
        
        const matchTurma = finalHtml.match(/<meta name="turma" content="(.*?)">/)
        if (matchTurma) {
          setTurma(matchTurma[1])
          finalHtml = finalHtml.replace(matchTurma[0], '').trim()
        }
        
        // Garante que o conteúdo existente fique justificado caso não esteja
        if (finalHtml && !finalHtml.includes('text-align: justify') && !finalHtml.includes('text-align:justify')) {
          finalHtml = `<div style="text-align: justify;">${finalHtml}</div>`
        } else if (!finalHtml) {
          finalHtml = '<div style="text-align: justify;"><br></div>'
        }
        
        setImagensApoio(extraidas)
        setEnunciado(finalHtml)
      }
    }
  }, [questao])

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('simulados_disciplinas').select('*')
      if (data) setDisciplinas(data)
    }
    loadConfig()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'comunicados-midia') // Allowed bucket in the API

      const res = await fetch('/api/upload-midia', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro no upload')
      }

      const data = await res.json()
      setImagensApoio(prev => [...prev, { url: data.url, posicao: 'final' }])
      
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      console.error(err)
      alert('Erro: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteImagem = (index: number) => {
    setImagensApoio(prev => prev.filter((_, i) => i !== index))
  }

  const handleChangeImagemPosicao = (index: number, posicao: 'inicio' | 'final') => {
    setImagensApoio(prev => {
      const novo = [...prev]
      novo[index].posicao = posicao
      return novo
    })
  }

  const handleGenerateImageAi = async () => {
    const plainText = enunciado.replace(/<[^>]+>/g, '').trim()
    if (!plainText) {
      alert('Preencha um pouco do enunciado primeiro para a IA saber sobre o que gerar a imagem.')
      return
    }

    setIsGeneratingImage(true)
    try {
      const discNome = disciplinas.find(d => d.id === idDisciplina)?.nome || ''
      const resPrompt = await fetch('/api/ai/gerar-imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enunciado: plainText,
          disciplina: discNome
        })
      })
      const jsonPrompt = await resPrompt.json()
      if (!resPrompt.ok) throw new Error(jsonPrompt.error || 'Erro ao gerar prompt da imagem')

      const base64DataUrl = jsonPrompt.base64Image
      if (!base64DataUrl) throw new Error('Imagem não retornada pela API')
      
      // Convert Data URL to Blob manually to avoid fetch() limits/errors on Data URLs
      const base64Data = base64DataUrl.split(',')[1]
      const byteString = atob(base64Data)
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: 'image/jpeg' })
      const file = new File([blob], `ia-imagem-${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      // Upload to Supabase to persist via API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'comunicados-midia')

      const uploadRes = await fetch('/api/upload-midia', {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json()
        throw new Error(errorData.error || 'Erro no upload da imagem IA')
      }

      const data = await uploadRes.json()
      setImagensApoio(prev => [...prev, { url: data.url, posicao: 'final' }])
    } catch (err: any) {
      console.error(err)
      alert('Erro ao gerar imagem com IA: ' + err.message)
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const getEnunciadoComImagens = () => {
    let htmlInicio = ''
    let htmlFinal = ''
    
    imagensApoio.forEach(img => {
      const imgTag = `<div data-posicao="${img.posicao}" style="margin: 16px 0; text-align: center;"><img src="${img.url}" style="max-width:100%; max-height:320px; border-radius:8px; object-fit:contain;" alt="Imagem da questão"/></div>`
      if (img.posicao === 'inicio') {
        htmlInicio += imgTag + '<br/>'
      } else {
        htmlFinal += '<br/>' + imgTag
      }
    })
    
    return htmlInicio + enunciado + htmlFinal
  }

  const handleGenerateAi = async () => {
    const selectedId = idDisciplina || defaultDisciplinaId
    if (!selectedId) {
      alert('Por favor, selecione uma disciplina no modal principal ou verifique se ela foi preenchida.')
      return
    }
    if (!aiForm.assunto) {
      alert('Por favor, informe o assunto ou tema da questão.')
      return
    }
    if (!aiForm.turma) {
      alert('Por favor, selecione a turma alvo.')
      return
    }

    setIsGenerating(true)
    try {
      const discNome = disciplinas.find(d => d.id === selectedId)?.nome || ''
      const res = await fetch('/api/ai/gerar-questao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplina: discNome,
          assunto: aiForm.assunto,
          dificuldade: aiDificuldade,
          turma: aiForm.turma,
          detalhes: aiForm.detalhes,
          formato: aiForm.formato
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro na API')

      const { enunciado: newEnunciado, alternativas: newAlts } = json.data
      
      setEnunciado(newEnunciado)
      setTurma(aiForm.turma)
      
      const updatedAlts = alternativas.map((alt, i) => {
        const aiAlt = newAlts[i]
        if (aiAlt) {
          return { ...alt, texto: aiAlt.texto, correta: aiAlt.eh_correta }
        }
        return alt
      })
      
      const corretaCount = updatedAlts.filter(a => a.correta).length
      if (corretaCount === 0) updatedAlts[0].correta = true
      if (corretaCount > 1) {
        let found = false
        updatedAlts.forEach(a => {
          if (a.correta && !found) found = true
          else a.correta = false
        })
      }

      setAlternativas(updatedAlts)
      setIsAiGenerated(true)
      setIsAiModalOpen(false)
    } catch (error: any) {
      alert('Erro ao gerar com IA: ' + error.message)
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let finalEnunciado = getEnunciadoComImagens()
      if (turma) finalEnunciado += `\n<meta name="turma" content="${turma}">`
      
      if (isAiGenerated && !questao?.id) {
        // Fetch current user from session via API or context if needed, but we don't have direct access here 
        // to `currentUserPerfil`, we can just fetch the professor's name since we usually have `defaultProfessorId`
        let autorNome = 'Professor'
        if (defaultProfessorId) {
          const { data } = await supabase.from('system_users').select('nome').eq('id', defaultProfessorId).single()
          const prof = data as any;
          if (prof?.nome) autorNome = prof.nome
        }
        
        finalEnunciado += `\n<meta name="gerado_por_ia" content="true">`
        finalEnunciado += `\n<meta name="ia_autor_nome" content="${autorNome}">`
        finalEnunciado += `\n<meta name="ia_prova_titulo" content="${tituloContexto || 'Simulado'}">`
      }

      const questaoDataObj: any = {
        numero: questao?.numero || Date.now(),
        enunciado: finalEnunciado,
        id_disciplina: idDisciplina || defaultDisciplinaId || null,
        disciplina: disciplinas.find((d: any) => d.id === (idDisciplina || defaultDisciplinaId))?.nome,
        imagens: imagensApoio.map(i => ({ src: i.url, contentType: 'image/jpeg' })),
        tipo_questao: 'multipla_escolha',
        expandido: true,
        alternativas: alternativas.filter(a => a.texto.trim() !== '').map((a, i) => ({
          letter: ['A','B','C','D','E','F'][i] || a.letra,
          text: a.texto,
          correct: a.correta
        }))
      }
      questaoDataObj.gabarito = questaoDataObj.alternativas.find((a: any) => a.correct)?.letter || ''

      onSaveObj(questaoDataObj)
      onClose()
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar questão: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateAlternativa = (index: number, field: string, value: any) => {
    setAlternativas(prev => {
      const newAlts = [...prev]
      if (field === 'correta' && value === true) {
        newAlts.forEach(a => a.correta = false)
      }
      newAlts[index] = { ...newAlts[index], [field]: value }
      return newAlts
    })
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="modal-box" style={{ background: 'hsl(var(--bg-surface))', borderRadius: 20, width: '100%', maxWidth: showPreview ? 1000 : 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', transition: 'max-width 0.3s ease' }}>
        
        <div className="modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
            {questao ? 'Editar Questão' : 'Nova Questão'}
          </h2>
          <div className="header-buttons-wrapper" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button 
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(139,92,246,0.1))', color: '#ec4899', fontWeight: 700, border: '1px solid rgba(236,72,153,0.2)', cursor: 'pointer', boxShadow: '0 4px 15px rgba(236,72,153,0.1)' }}
            >
              <Sparkles size={16} /> Gerar com IA
            </motion.button>
            <button type="button" onClick={() => setShowPreview(!showPreview)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: showPreview ? 'rgba(59,130,246,0.1)' : 'transparent', color: showPreview ? '#3b82f6' : 'hsl(var(--text-primary))', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              <Eye size={16} /> {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div className="form-side" style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
            <form id="questao-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Disciplina</label>
                <select 
                  value={idDisciplina || defaultDisciplinaId || ''} 
                  onChange={e => setIdDisciplina(e.target.value)} 
                  required 
                  disabled={!!defaultDisciplinaId}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: defaultDisciplinaId ? 'hsl(var(--bg-surface))' : 'hsl(var(--bg-app))', color: defaultDisciplinaId ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-primary))', opacity: defaultDisciplinaId ? 0.7 : 1 }}
                >
                  {!defaultDisciplinaId && <option value="">Selecione...</option>}
                  {disciplinas
                    .filter(d => defaultDisciplinaId ? d.id === defaultDisciplinaId : true)
                    .map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
                {defaultDisciplinaId && (
                  <p style={{ fontSize: 11, color: '#3b82f6', marginTop: 6, marginBottom: 0 }}>Disciplina fixada pelo filtro do professor.</p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Enunciado da Questão</label>
                <EditorQuill 
                  value={enunciado} 
                  onChange={setEnunciado} 
                  placeholder="Escreva a pergunta aqui..."
                />
              </div>

              <div style={{ background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: 12 }}>
                  <ImageIcon size={16} /> Imagens de Apoio
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', margin: 0 }}>
                    As imagens enviadas aqui serão exibidas automaticamente no final do texto da questão.
                  </p>
                  
                  {imagensApoio.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                      {imagensApoio.map((img, index) => (
                        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', background: 'hsl(var(--bg-surface))' }}>
                            <img src={img.url} alt={`Imagem ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button 
                              type="button"
                              onClick={() => handleDeleteImagem(index)}
                              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              title="Excluir imagem"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <select 
                            value={img.posicao}
                            onChange={(e) => handleChangeImagemPosicao(index, e.target.value as 'inicio' | 'final')}
                            style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', outline: 'none' }}
                          >
                            <option value="inicio">No Início</option>
                            <option value="final">No Final</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="image-buttons-wrapper" style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.7 : 1, width: 'fit-content' }}>
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {uploading ? 'Enviando Imagem...' : 'Enviar Nova Imagem'}
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                        disabled={uploading || isGeneratingImage}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateImageAi}
                      disabled={uploading || isGeneratingImage}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 600, cursor: (uploading || isGeneratingImage) ? 'wait' : 'pointer', opacity: (uploading || isGeneratingImage) ? 0.7 : 1, width: 'fit-content' }}
                    >
                      {isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isGeneratingImage ? 'Criando Arte...' : 'Gerar Imagem de Apoio com IA'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 16px' }}>Alternativas</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {alternativas.map((alt, i) => (
                    <div key={alt.letra} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div 
                        onClick={() => updateAlternativa(i, 'correta', true)}
                        style={{ 
                          width: 40, height: 40, borderRadius: '50%', 
                          background: alt.correta ? '#10b981' : 'rgba(100,116,139,0.1)', 
                          color: alt.correta ? 'white' : 'hsl(var(--text-secondary))', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        title="Marcar como correta"
                      >
                        {alt.letra}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, borderRadius: 12, border: `1px solid ${alt.correta ? '#10b981' : 'transparent'}` }}>
                        <EditorQuill 
                          value={alt.texto} 
                          onChange={(val) => updateAlternativa(i, 'texto', val)} 
                          placeholder={`Texto da alternativa ${alt.letra}`}
                          compact={true}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 12 }}>
                  * Clique na letra (A, B, C...) para marcar a alternativa correta.
                </p>
              </div>

            </form>
          </div>

          {showPreview && (
            <div className="preview-side" style={{ width: 400, borderLeft: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-app))', padding: '32px', overflowY: 'auto' }}>
              <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(59,130,246,0.1)', padding: '4px 8px', borderRadius: 6 }}>
                    PREVIEW
                  </span>
                </div>
                
                <HtmlContent 
                  html={getEnunciadoComImagens() || '<span style="color:#94a3b8;font-style:italic">Enunciado vazio</span>'}
                  style={{ color: 'hsl(var(--text-primary))', fontSize: 12, lineHeight: 1.6, marginBottom: 20, fontFamily: 'Arial, Helvetica, sans-serif', textAlign: 'justify', wordBreak: 'break-word' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alternativas.filter(a => a.texto.replace(/<[^>]+>/g, '').trim() !== '').length > 0 ? (
                    alternativas.filter(a => a.texto.replace(/<[^>]+>/g, '').trim() !== '').map((alt) => (
                      <div key={alt.letra} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: alt.correta ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-app))', border: `1px solid ${alt.correta ? '#10b981' : 'hsl(var(--border-subtle))'}` }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: alt.correta ? '#10b981' : 'rgba(100,116,139,0.2)', color: alt.correta ? 'white' : 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {alt.letra}
                        </div>
                        <div style={{ color: alt.correta ? '#10b981' : 'hsl(var(--text-primary))', fontSize: 14, fontWeight: alt.correta ? 600 : 400 }}>
                          <HtmlContent html={alt.texto} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 14 }}>Nenhuma alternativa preenchida</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '24px 32px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'transparent', color: 'hsl(var(--text-primary))', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" form="questao-form" disabled={loading || uploading} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: (loading || uploading) ? 'not-allowed' : 'pointer', opacity: (loading || uploading) ? 0.7 : 1 }}>
            {loading ? 'Salvando...' : 'Salvar Questão'}
          </button>
        </div>

      </div>

      {/* MODAL DE IA */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isGenerating && setIsAiModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="ai-modal-box" style={{ position: 'relative', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', background: 'linear-gradient(135deg, hsl(var(--bg-surface)), hsl(var(--bg-elevated)))', borderRadius: 24, padding: 32, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.5)' }}>
              
              <button onClick={() => setIsAiModalOpen(false)} disabled={isGenerating} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer', padding: 8 }}>
                <X size={20} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px -4px rgba(236,72,153,0.5)', flexShrink: 0 }}>
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 style={{ color: 'hsl(var(--text-primary))', margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }}>Gerar Questão</h2>
                  <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Deixe a IA criar o conteúdo para você</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Dificuldade *</label>
                    <select 
                      value={aiDificuldade} 
                      onChange={e => setAiDificuldade(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }}
                    >
                      <option value="facil">Fácil</option>
                      <option value="media">Média</option>
                      <option value="dificil">Difícil</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Formato do Enunciado *</label>
                    <select 
                      value={aiForm.formato} 
                      onChange={e => setAiForm({...aiForm, formato: e.target.value})}
                      style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }}
                    >
                      <option value="padrao">Padrão / Contextualizado (Equilibrado)</option>
                      <option value="curto">Curto e Direto (Mais Objetivo)</option>
                      <option value="enem">Estilo ENEM (Situação-problema e Textos Base)</option>
                      <option value="caso_clinico">Caso Clínico / Situação Real (Prático)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Turma / Público Alvo *</label>
                  <select 
                    value={aiForm.turma} 
                    onChange={e => setAiForm({...aiForm, turma: e.target.value})}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }}
                  >
                    <option value="" disabled>Selecione a Turma...</option>
                    {turmasDisponiveis.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Assunto / Tema *</label>
                  <input 
                    placeholder="Ex: Revolução Francesa, Equações de 2º Grau..."
                    value={aiForm.assunto} onChange={e => setAiForm({...aiForm, assunto: e.target.value})} 
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Detalhes ou Contexto (Opcional)</label>
                  <textarea 
                    placeholder="Ex: Use um exemplo do dia a dia envolvendo supermercado..."
                    value={aiForm.detalhes} onChange={e => setAiForm({...aiForm, detalhes: e.target.value})} 
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
                <button onClick={() => setIsAiModalOpen(false)} disabled={isGenerating} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 700 }}>
                  Cancelar
                </button>
                <button 
                  onClick={handleGenerateAi} 
                  disabled={isGenerating || !aiForm.assunto || !aiForm.turma} 
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, boxShadow: '0 8px 20px -8px rgba(236,72,153,0.6)', opacity: (isGenerating || !aiForm.assunto || !aiForm.turma) ? 0.7 : 1 }}
                >
                  {isGenerating ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={18} />
                    </motion.div>
                  ) : <Bot size={18} />}
                  {isGenerating ? 'Gerando...' : 'Gerar Questão'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .modal-box { max-height: 95vh !important; border-radius: 12px !important; }
          .modal-header { flex-direction: column; align-items: flex-start !important; padding: 16px !important; gap: 16px; }
          .header-buttons-wrapper { flex-direction: column; width: 100%; align-items: stretch !important; gap: 8px !important; }
          .header-buttons-wrapper button { width: 100%; justify-content: center; }
          .modal-body { flex-direction: column !important; overflow-y: auto !important; }
          .form-side { padding: 16px !important; overflow-y: visible !important; flex: none !important; }
          .preview-side { width: 100% !important; border-left: none !important; border-top: 1px solid hsl(var(--border-subtle)) !important; padding: 16px !important; overflow-y: visible !important; flex: none !important; }
          .image-buttons-wrapper { flex-direction: column !important; width: 100%; align-items: stretch !important; gap: 8px !important; }
          .image-buttons-wrapper label, .image-buttons-wrapper button { width: 100% !important; justify-content: center; }
          .modal-footer { flex-direction: column-reverse !important; padding: 16px !important; gap: 8px !important; }
          .modal-footer button { width: 100%; }
          .ai-modal-box { padding: 20px !important; max-height: 85vh !important; border-radius: 16px !important; width: calc(100% - 32px) !important; margin: 16px auto !important; }
        }
      `}</style>
    </div>
  )
}
