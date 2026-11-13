'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Plus, Trash2, Image as ImageIcon, Upload, Loader2, Eye, EyeOff, 
  Sparkles, Bot, FileText, Check, CheckCircle2, AlertCircle, 
  ArrowUp, ArrowDown, BookOpen, ListChecks, GraduationCap, AlignLeft, 
  ShieldCheck, Folder, FolderOpen, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EditorQuill } from './EditorQuill'
import { HtmlContent } from '../HtmlContent'

export function QuestaoFormModal({ 
  simuladoId, 
  questao, 
  defaultProfessorId, 
  defaultDisciplinaId, 
  tituloContexto, 
  onClose, 
  onSave 
}: { 
  simuladoId: string, 
  questao?: any, 
  defaultProfessorId?: string, 
  defaultDisciplinaId?: string, 
  tituloContexto?: string, 
  onClose: () => void, 
  onSave: () => void 
}) {
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
  const [tipoQuestao, setTipoQuestao] = useState<'multipla_escolha' | 'descritiva' | 'texto_apoio'>(questao?.tipo_questao || 'multipla_escolha')
  const [linhasResposta, setLinhasResposta] = useState<number>(questao?.linhas_resposta || 5)
  const [estiloEspaco, setEstiloEspaco] = useState<'em_branco' | 'pautado'>(questao?.estilo_espaco || 'pautado')
  
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Modal IA
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
  const [uploadingAltIndex, setUploadingAltIndex] = useState<number | null>(null)

  const parseAlt = (a: any) => {
    const rawText = a.text || a.texto || ''
    const linesMatch = rawText.match(/\[LINHAS_PAUTADAS:(\d+)\]/i)
    const linhasFound = linesMatch ? parseInt(linesMatch[1], 10) : (a.linhas || a.lines || a.linhas_resposta || 0)
    const cleanText = rawText.replace(/\[LINHAS_PAUTADAS:\d+\]/gi, '').trim()
    const imgFound = a.imagem_url || a.image || a.imagem || null
    return {
      letra: a.letter || a.letra,
      texto: cleanText,
      correta: a.correct ?? a.eh_correta ?? a.correta ?? false,
      imagem_url: imgFound,
      imagem: imgFound,
      linhas: linhasFound,
      showLinhasSlider: linhasFound > 0
    }
  }

  const [alternativas, setAlternativas] = useState<any[]>(() => {
    if (questao?.simulados_alternativas?.length > 0) {
      return questao.simulados_alternativas.map(parseAlt).sort((a: any, b: any) => a.letra.localeCompare(b.letra))
    }
    if (questao?.alternativas?.length > 0) {
      return questao.alternativas.map(parseAlt).sort((a: any, b: any) => a.letra.localeCompare(b.letra))
    }
    return [
      { letra: 'A', texto: '', correta: true, imagem_url: null, imagem: null, linhas: 0, showLinhasSlider: false },
      { letra: 'B', texto: '', correta: false, imagem_url: null, imagem: null, linhas: 0, showLinhasSlider: false },
      { letra: 'C', texto: '', correta: false, imagem_url: null, imagem: null, linhas: 0, showLinhasSlider: false },
      { letra: 'D', texto: '', correta: false, imagem_url: null, imagem: null, linhas: 0, showLinhasSlider: false },
      { letra: 'E', texto: '', correta: false, imagem_url: null, imagem: null, linhas: 0, showLinhasSlider: false },
    ]
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAiModalOpen) {
          setIsAiModalOpen(false)
        } else {
          onClose()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        const form = document.getElementById('questao-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAiModalOpen, onClose])

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            uploadSingleFile(file)
            break
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  useEffect(() => {
    if (questao) {
      setIdDisciplina(questao.id_disciplina || '')
      
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
          
          if (img.parentElement && img.parentElement.tagName === 'DIV' && img.parentElement.style.textAlign === 'center') {
            img.parentElement.remove()
          } else {
            img.remove()
          }
        })
        
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

        const matchLinhas = finalHtml.match(/<meta name="linhas_resposta" content="(.*?)">/)
        if (matchLinhas) {
          const p = parseInt(matchLinhas[1], 10)
          setLinhasResposta(!isNaN(p) ? p : 5)
          finalHtml = finalHtml.replace(matchLinhas[0], '').trim()
          setTipoQuestao('descritiva')
        } else if (questao?.tipo_questao === 'descritiva') {
          setTipoQuestao('descritiva')
        } else {
          setTipoQuestao('multipla_escolha')
        }
        
        const matchEstilo = finalHtml.match(/<meta name="estilo_espaco" content="(.*?)">/)
        if (matchEstilo) {
          setEstiloEspaco(matchEstilo[1] as 'em_branco' | 'pautado')
          finalHtml = finalHtml.replace(matchEstilo[0], '').trim()
        }
        
        if (finalHtml && !finalHtml.includes('text-align: justify') && !finalHtml.includes('text-align:justify')) {
          finalHtml = `<div style="text-align: justify;">${finalHtml}</div>`
        } else if (!finalHtml) {
          finalHtml = '<div style="text-align: justify;"><br></div>'
        }
        
        setImagensApoio(extraidas)
        setEnunciado(finalHtml)
      }

      if (questao.simulados_alternativas?.length > 0) {
        setAlternativas(questao.simulados_alternativas.map(parseAlt).sort((a: any, b: any) => a.letra.localeCompare(b.letra)))
      } else if (questao.alternativas?.length > 0) {
        setAlternativas(questao.alternativas.map(parseAlt).sort((a: any, b: any) => a.letra.localeCompare(b.letra)))
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

  const uploadSingleFile = async (file: File) => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'comunicados-midia')

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
      alert('Erro ao enviar imagem: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadSingleFile(file)
  }

  const handleUploadAlternativaImagem = (index: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/gif'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploadingAltIndex(index)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'comunicados-midia')
        const res = await fetch('/api/upload-midia', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Erro no upload da imagem da alternativa')
        const data = await res.json()
        updateAlternativa(index, 'imagem_url', data.url)
        updateAlternativa(index, 'imagem', data.url)
      } catch (err: any) {
        alert('Erro: ' + err.message)
      } finally {
        setUploadingAltIndex(null)
      }
    }
    input.click()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      await uploadSingleFile(file)
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
      alert('Por favor, escreva o enunciado da questão primeiro para que a IA compreenda o contexto da imagem.')
      return
    }

    setIsGeneratingImage(true)
    try {
      const discNome = disciplinas.find(d => d.id === (idDisciplina || defaultDisciplinaId))?.nome || ''
      const resPrompt = await fetch('/api/ai/gerar-imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enunciado: plainText,
          disciplina: discNome
        })
      })
      const jsonPrompt = await resPrompt.json()
      if (!resPrompt.ok) throw new Error(jsonPrompt.error || 'Erro ao gerar imagem com IA')

      const base64DataUrl = jsonPrompt.base64Image
      if (!base64DataUrl) throw new Error('Imagem não retornada pela IA')
      
      const base64Data = base64DataUrl.split(',')[1]
      const byteString = atob(base64Data)
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: 'image/jpeg' })
      const file = new File([blob], `ia-imagem-${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'comunicados-midia')

      const uploadRes = await fetch('/api/upload-midia', {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json()
        throw new Error(errorData.error || 'Erro no salvamento da imagem gerada')
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
      const imgTag = `<div data-posicao="${img.posicao}" style="margin: 14px 0; text-align: center;"><img src="${img.url}" style="max-width:100%; max-height:280px; border-radius:10px; object-fit:contain; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" alt="Imagem de apoio da questão"/></div>`
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
      alert('Por favor, selecione uma disciplina no cabeçalho antes de gerar com IA.')
      return
    }
    if (!aiForm.assunto) {
      alert('Por favor, informe o assunto ou conteúdo da questão.')
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
      if (!res.ok) throw new Error(json.error || 'Erro na API de IA')

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
      
      finalEnunciado = finalEnunciado.replace(/<meta name="linhas_resposta" content=".*?">/g, '')
      finalEnunciado = finalEnunciado.replace(/<meta name="estilo_espaco" content=".*?">/g, '')
      finalEnunciado = finalEnunciado.replace(/<meta name="turma" content=".*?">/g, '')
      finalEnunciado = finalEnunciado.replace(/<meta name="gerado_por_ia" content=".*?">/g, '')
      finalEnunciado = finalEnunciado.replace(/<meta name="ia_autor_nome" content=".*?">/g, '')
      finalEnunciado = finalEnunciado.replace(/<meta name="ia_prova_titulo" content=".*?">/g, '')

      if (tipoQuestao === 'descritiva') {
        finalEnunciado += `\n<meta name="linhas_resposta" content="${linhasResposta !== undefined ? linhasResposta : 5}">`
        finalEnunciado += `\n<meta name="estilo_espaco" content="${estiloEspaco || 'pautado'}">`
      }

      if (turma) finalEnunciado += `\n<meta name="turma" content="${turma}">`
      
      if (isAiGenerated && !questao?.id) {
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

      const questaoData: any = {
        id_simulado: simuladoId,
        id_disciplina: idDisciplina || null,
        enunciado: finalEnunciado,
        ordem: questao?.ordem || 0,
        tipo_questao: tipoQuestao
      }

      if (defaultProfessorId && !questao?.id) {
        questaoData.id_professor = defaultProfessorId;
        const { data } = await supabase.from('system_users').select('nome').eq('id', defaultProfessorId).single();
        const profData = data as any;
        const { error: upsertErr } = await (supabase as any).from('simulados_professores').upsert({ 
          id: defaultProfessorId,
          nome: profData?.nome || 'Professor'
        }).select()
        if (upsertErr) {
          console.error('Erro ao registrar professor no espelho:', upsertErr)
        }
      }

      let qId = questao?.id

      if (qId) {
        await (supabase as any).from('simulados_questoes').update(questaoData).eq('id', qId)
      } else {
        const { data: newQ, error: errQ } = await (supabase as any).from('simulados_questoes').insert(questaoData).select().single()
        if (errQ) throw errQ
        qId = (newQ as any).id
      }

      if (questao?.id) {
        const { error: errDel } = await supabase.from('simulados_alternativas').delete().eq('id_questao', qId)
        if (errDel) throw errDel
      }

      if (tipoQuestao === 'multipla_escolha') {
        const altsData = alternativas.filter(a => a.texto.trim() !== '' || a.imagem_url || (a.linhas && a.linhas > 0)).map((a, i) => {
          let finalAltText = a.texto
          finalAltText = finalAltText.replace(/\[LINHAS_PAUTADAS:\d+\]/gi, '').trim()
          if (a.linhas && a.linhas > 0) {
            finalAltText += `\n[LINHAS_PAUTADAS:${a.linhas}]`
          }
          return {
            id_questao: qId,
            letra: ['A','B','C','D','E','F','G','H'][i] || a.letra,
            texto: finalAltText,
            eh_correta: a.correta,
            imagem_url: a.imagem_url || null
          }
        })

        if (altsData.length > 0) {
          const { error: errA } = await (supabase as any).from('simulados_alternativas').insert(altsData)
          if (errA) throw errA
        }
      }

      onSave()
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

  const removeAlternativa = (index: number) => {
    setAlternativas(prev => {
      const remaining = prev.filter((_, i) => i !== index)
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      return remaining.map((alt, i) => ({
        ...alt,
        letra: letters[i] || String.fromCharCode(65 + i)
      }))
    })
  }

  const gabaritoAtual = useMemo(() => {
    if (tipoQuestao !== 'multipla_escolha') return null
    const corr = alternativas.find(a => a.correta)
    return corr ? corr.letra : null
  }, [alternativas, tipoQuestao])

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(15, 23, 42, 0.65)', 
      backdropFilter: 'blur(8px)', 
      WebkitBackdropFilter: 'blur(8px)', 
      zIndex: 9999, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '16px' 
    }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="modal-box" 
        style={{ 
          background: 'hsl(var(--bg-surface))', 
          borderRadius: 20, 
          width: '100%', 
          maxWidth: showPreview ? 1020 : 660, 
          height: '92vh',
          maxHeight: 900, 
          display: 'flex', 
          flexDirection: 'column', 
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px hsl(var(--border-subtle))', 
          transition: 'max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden'
        }}
      >
        
        {/* TOP HEADER */}
        <header style={{ 
          padding: '18px 28px', 
          borderBottom: '1px solid hsl(var(--border-subtle))', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'hsl(var(--bg-surface))',
          gap: 16,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ 
              width: 42, 
              height: 42, 
              borderRadius: 12, 
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)', 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
              flexShrink: 0
            }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}>
                  {questao ? 'Editar Questão' : 'Nova Questão'}
                </h2>
                {isAiGenerated && (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    fontSize: 11, 
                    fontWeight: 700, 
                    padding: '3px 8px', 
                    borderRadius: 20, 
                    background: 'rgba(236,72,153,0.12)', 
                    color: '#ec4899', 
                    border: '1px solid rgba(236,72,153,0.25)' 
                  }}>
                    <Sparkles size={11} /> Criada com IA
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                Edição profissional de questão, gabarito e diagramação para o simulado
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                padding: '8px 16px', 
                borderRadius: 10, 
                background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(139,92,246,0.12))', 
                color: '#d946ef', 
                fontWeight: 700, 
                fontSize: 13,
                border: '1px solid rgba(236,72,153,0.25)', 
                cursor: 'pointer', 
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(236,72,153,0.08)'
              }}
              title="Gerar questão completa com Inteligência Artificial"
            >
              <Sparkles size={16} /> Gerar com IA
            </motion.button>

            <button 
              type="button" 
              onClick={() => setShowPreview(!showPreview)} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 7, 
                padding: '8px 14px', 
                borderRadius: 10, 
                border: '1px solid hsl(var(--border-subtle))', 
                background: showPreview ? 'rgba(59,130,246,0.1)' : 'hsl(var(--bg-app))', 
                color: showPreview ? '#3b82f6' : 'hsl(var(--text-secondary))', 
                fontWeight: 600, 
                fontSize: 13,
                cursor: 'pointer', 
                transition: 'all 0.2s' 
              }}
              title={showPreview ? 'Ocultar painel de preview' : 'Abrir visualização em tempo real'}
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              <span>{showPreview ? 'Ocultar Preview' : 'Ver Preview'}</span>
            </button>

            <button 
              type="button"
              onClick={onClose} 
              style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 10, 
                background: 'transparent', 
                border: '1px solid transparent', 
                color: 'hsl(var(--text-secondary))', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all 0.15s' 
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'hsl(var(--bg-hover))'
                e.currentTarget.style.color = 'hsl(var(--text-primary))'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'hsl(var(--text-secondary))'
              }}
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* MODAL MAIN BODY */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* LEFT: FORM SIDE */}
          <div 
            className="custom-scroll" 
            style={{ 
              padding: '24px 32px', 
              overflowY: 'auto', 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}
          >
            <form id="questao-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {/* TOP CARD WITH HANGING FOLDER TABS (PASTA SUSPENSA) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Superior Tabs: Disciplina (Apenas o nome) e Gabarito Separado */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-end', 
                  justifyContent: 'space-between', 
                  gap: 12, 
                  marginBottom: -1, 
                  paddingLeft: 8, 
                  paddingRight: 8,
                  position: 'relative',
                  zIndex: 2 
                }}>
                  {/* Tab Esquerda: Pasta Suspensa da Disciplina (Apenas o Nome) */}
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    padding: '6px 14px', 
                    borderRadius: '10px 10px 0 0', 
                    background: 'hsl(var(--bg-app))', 
                    border: '1px solid hsl(var(--border-subtle))',
                    borderBottom: '1px solid hsl(var(--bg-app))',
                    boxShadow: '0 -2px 5px rgba(0,0,0,0.03)'
                  }}>
                    <Folder size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
                    <select 
                      value={idDisciplina || defaultDisciplinaId || ''} 
                      onChange={e => setIdDisciplina(e.target.value)} 
                      required 
                      disabled={!!defaultDisciplinaId}
                      style={{ 
                        border: 'none', 
                        background: 'transparent', 
                        color: 'hsl(var(--text-primary))', 
                        fontSize: 13, 
                        fontWeight: 700, 
                        cursor: defaultDisciplinaId ? 'not-allowed' : 'pointer', 
                        outline: 'none',
                        maxWidth: 220
                      }}
                      title={defaultDisciplinaId ? "Disciplina fixada pelo filtro do professor" : "Selecionar disciplina"}
                    >
                      {!defaultDisciplinaId && <option value="">Selecione a disciplina...</option>}
                      {disciplinas
                        .filter(d => defaultDisciplinaId ? d.id === defaultDisciplinaId : true)
                        .map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                    {defaultDisciplinaId && (
                      <span title="Disciplina travada pelo filtro do professor" style={{ display: 'flex', flexShrink: 0 }}>
                        <ShieldCheck size={13} color="#3b82f6" />
                      </span>
                    )}
                  </div>

                  {/* Tab Direita: Gabarito Separado na Pasta Suspensa */}
                  {tipoQuestao === 'multipla_escolha' && (
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      padding: '6px 14px', 
                      borderRadius: '10px 10px 0 0', 
                      background: gabaritoAtual ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)', 
                      border: `1px solid ${gabaritoAtual ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.25)'}`,
                      borderBottom: '1px solid hsl(var(--bg-app))',
                      boxShadow: '0 -2px 5px rgba(0,0,0,0.03)'
                    }}>
                      {gabaritoAtual ? (
                        <>
                          <CheckCircle2 size={14} color="#10b981" />
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>Gabarito:</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>Letra {gabaritoAtual}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} color="#ef4444" />
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#ef4444' }}>Sem Gabarito</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Principal: Tipo da Questão */}
                <div style={{ 
                  background: 'hsl(var(--bg-app))', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: 12, 
                  padding: '12px 18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  position: 'relative',
                  zIndex: 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tipo da Questão:
                    </span>
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
                        onClick={() => setTipoQuestao('multipla_escolha')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          background: tipoQuestao === 'multipla_escolha' ? '#3b82f6' : 'transparent',
                          color: tipoQuestao === 'multipla_escolha' ? '#ffffff' : 'hsl(var(--text-secondary))',
                          boxShadow: tipoQuestao === 'multipla_escolha' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                          transition: 'all 0.18s ease'
                        }}
                      >
                        <ListChecks size={14} /> Múltipla Escolha
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setTipoQuestao('descritiva')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          background: tipoQuestao === 'descritiva' ? '#3b82f6' : 'transparent',
                          color: tipoQuestao === 'descritiva' ? '#ffffff' : 'hsl(var(--text-secondary))',
                          boxShadow: tipoQuestao === 'descritiva' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                          transition: 'all 0.18s ease'
                        }}
                      >
                        <AlignLeft size={14} /> Descritiva
                      </button>

                      <button
                        type="button"
                        onClick={() => setTipoQuestao('texto_apoio')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          background: tipoQuestao === 'texto_apoio' ? '#a855f7' : 'transparent',
                          color: tipoQuestao === 'texto_apoio' ? '#ffffff' : 'hsl(var(--text-secondary))',
                          boxShadow: tipoQuestao === 'texto_apoio' ? '0 2px 8px rgba(168,85,247,0.3)' : 'none',
                          transition: 'all 0.18s ease'
                        }}
                      >
                        <BookOpen size={14} /> Texto de Apoio
                      </button>
                    </div>
                  </div>

                  <span style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', fontStyle: 'italic' }}>
                    {tipoQuestao === 'multipla_escolha' ? 'Questão de múltipla escolha com gabarito' : tipoQuestao === 'descritiva' ? 'Questão discursiva com linhas para resposta' : 'Texto de apoio compartilhado'}
                  </span>
                </div>
              </div>

              {/* ENUNCIADO SECTION */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                    <FileText size={15} color="#3b82f6" /> 
                    {tipoQuestao === 'texto_apoio' ? 'Texto do Conteúdo de Apoio' : 'Enunciado da Questão'}
                  </label>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                    Suporta equações LaTeX/KaTeX, formatação e imagens
                  </span>
                </div>
                <div style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <EditorQuill 
                    value={enunciado} 
                    onChange={setEnunciado} 
                    placeholder={tipoQuestao === 'texto_apoio' ? 'Insira aqui o texto de leitura/apoio para o simulado...' : 'Escreva a pergunta ou o problema aqui...'}
                  />
                </div>
              </div>

              {/* IMAGENS DE APOIO SECTION */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
                style={{ 
                  background: isDraggingOver ? 'rgba(59,130,246,0.06)' : 'hsl(var(--bg-app))', 
                  border: isDraggingOver ? '2px dashed #3b82f6' : '1px solid hsl(var(--border-subtle))', 
                  borderRadius: 14, 
                  padding: '14px 18px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: imagensApoio.length > 0 ? 12 : 6, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={16} color="#6366f1" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                      Imagens de Apoio
                    </span>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 12, 
                      background: imagensApoio.length > 0 ? 'rgba(99,102,241,0.15)' : 'hsl(var(--bg-surface))', 
                      color: imagensApoio.length > 0 ? '#6366f1' : 'hsl(var(--text-secondary))',
                      border: '1px solid hsl(var(--border-subtle))'
                    }}>
                      {imagensApoio.length} {imagensApoio.length === 1 ? 'anexada' : 'anexadas'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      padding: '6px 12px', 
                      borderRadius: 8, 
                      background: '#3b82f6', 
                      color: 'white', 
                      fontWeight: 700, 
                      fontSize: 12,
                      cursor: uploading ? 'wait' : 'pointer', 
                      opacity: uploading ? 0.7 : 1, 
                      transition: 'all 0.15s' 
                    }}>
                      {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {uploading ? 'Enviando...' : 'Adicionar Imagem'}
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
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        padding: '6px 12px', 
                        borderRadius: 8, 
                        background: 'rgba(139,92,246,0.12)', 
                        color: '#8b5cf6', 
                        border: '1px solid rgba(139,92,246,0.3)', 
                        fontWeight: 700, 
                        fontSize: 12,
                        cursor: (uploading || isGeneratingImage) ? 'wait' : 'pointer', 
                        opacity: (uploading || isGeneratingImage) ? 0.7 : 1, 
                        transition: 'all 0.15s' 
                      }}
                      title="Gera uma imagem de apoio contextualizada ao enunciado com Inteligência Artificial"
                    >
                      {isGeneratingImage ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {isGeneratingImage ? 'Gerando...' : 'Gerar com IA'}
                    </button>
                  </div>
                </div>

                {imagensApoio.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 8 }}>
                    {imagensApoio.map((img, index) => (
                      <div 
                        key={index} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          background: 'hsl(var(--bg-surface))', 
                          borderRadius: 10, 
                          border: '1px solid hsl(var(--border-subtle))', 
                          overflow: 'hidden',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)' 
                        }}
                      >
                        <div style={{ position: 'relative', width: '100%', height: 100, background: '#00000008', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={img.url} alt={`Apoio ${index + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          <button 
                            type="button"
                            onClick={() => handleDeleteImagem(index)}
                            style={{ 
                              position: 'absolute', 
                              top: 5, 
                              right: 5, 
                              background: 'rgba(239,68,68,0.92)', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '50%', 
                              width: 22, 
                              height: 22, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              cursor: 'pointer' 
                            }}
                            title="Remover imagem"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        
                        <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Posição:</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => handleChangeImagemPosicao(index, 'inicio')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                padding: '2px 6px',
                                borderRadius: 5,
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: '1px solid',
                                background: img.posicao === 'inicio' ? 'rgba(59,130,246,0.15)' : 'transparent',
                                color: img.posicao === 'inicio' ? '#3b82f6' : 'hsl(var(--text-secondary))',
                                borderColor: img.posicao === 'inicio' ? '#3b82f6' : 'hsl(var(--border-subtle))'
                              }}
                            >
                              <ArrowUp size={10} /> Início
                            </button>
                            <button
                              type="button"
                              onClick={() => handleChangeImagemPosicao(index, 'final')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                padding: '2px 6px',
                                borderRadius: 5,
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: '1px solid',
                                background: img.posicao === 'final' ? 'rgba(59,130,246,0.15)' : 'transparent',
                                color: img.posicao === 'final' ? '#3b82f6' : 'hsl(var(--text-secondary))',
                                borderColor: img.posicao === 'final' ? '#3b82f6' : 'hsl(var(--border-subtle))'
                              }}
                            >
                              <ArrowDown size={10} /> Final
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    border: '1px dashed hsl(var(--border-subtle))', 
                    borderRadius: 8, 
                    padding: '10px 14px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 8, 
                    color: 'hsl(var(--text-secondary))', 
                    fontSize: 12 
                  }}>
                    <span>Arraste imagens aqui ou cole com <kbd style={{ padding: '2px 5px', borderRadius: 4, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 10, fontWeight: 700 }}>⌘+V</kbd></span>
                  </div>
                )}
              </div>

              {/* CONTENT TYPE SPECIFIC EDITORS */}
              {tipoQuestao === 'texto_apoio' ? (
                <div style={{ 
                  padding: '18px', 
                  borderRadius: 14, 
                  background: 'rgba(168,85,247,0.06)', 
                  border: '1px solid rgba(168,85,247,0.25)', 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 14 
                }}>
                  <div style={{ 
                    width: 38, 
                    height: 38, 
                    borderRadius: 10, 
                    background: 'rgba(168,85,247,0.15)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#a855f7', 
                    flexShrink: 0 
                  }}>
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                      Item de Texto de Apoio / Contexto de Leitura
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                      Este bloco será posicionado na prova como material de leitura base para os alunos. Não possui alternativas nem gabarito e não é numerado como questão avaliativa.
                    </p>
                  </div>
                </div>
              ) : tipoQuestao === 'multipla_escolha' ? (
                /* COMPACT, ULTRA-ORGANIZED ALTERNATIVES */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                        Alternativas
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                        Clique na letra para marcar a alternativa <strong style={{ color: '#10b981' }}>correta (gabarito)</strong>
                      </p>
                    </div>

                    {alternativas.length < 8 && (
                      <button
                        type="button"
                        onClick={() => {
                          const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
                          setAlternativas(prev => {
                            const nextLetter = letters[prev.length] || String.fromCharCode(65 + prev.length)
                            return [...prev, { letra: nextLetter, texto: '', correta: false }]
                          })
                        }}
                        style={{
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 5,
                          padding: '5px 11px', 
                          borderRadius: 8,
                          background: 'rgba(59,130,246,0.08)', 
                          color: '#3b82f6',
                          border: '1px solid rgba(59,130,246,0.2)', 
                          fontSize: 12,
                          fontWeight: 700, 
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <Plus size={14} /> Adicionar Alternativa
                      </button>
                    )}
                  </div>

                  {/* COMPACT ALTERNATIVE ROWS WITH PASTA SUSPENSA GABARITO BADGE */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {alternativas.map((alt, i) => (
                      <div key={alt.letra} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {/* PASTA SUSPENSA: BADGE SUPERIOR DE "CORRETA" */}
                        {alt.correta && (
                          <div style={{ 
                            alignSelf: 'flex-end', 
                            marginRight: 14, 
                            marginBottom: -1, 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 5, 
                            padding: '3px 12px', 
                            borderRadius: '8px 8px 0 0', 
                            background: '#10b981', 
                            color: '#ffffff', 
                            fontSize: 10, 
                            fontWeight: 800, 
                            letterSpacing: '0.05em', 
                            boxShadow: '0 -2px 6px rgba(16,185,129,0.25)', 
                            zIndex: 2 
                          }}>
                            <Check size={12} strokeWidth={3} />
                            <span>CORRETA</span>
                          </div>
                        )}

                        {/* Card da Alternativa */}
                        <div 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            padding: '8px 12px',
                            borderRadius: alt.correta ? '10px 0 10px 10px' : 10,
                            background: alt.correta ? 'rgba(16,185,129,0.06)' : 'hsl(var(--bg-app))',
                            border: `1.5px solid ${alt.correta ? '#10b981' : 'hsl(var(--border-subtle))'}`,
                            transition: 'all 0.15s ease',
                            gap: 6,
                            position: 'relative',
                            zIndex: 1
                          }}
                        >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Circular Letter Button (32px x 32px) */}
                          <button
                            type="button" 
                            onClick={() => updateAlternativa(i, 'correta', true)}
                            style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: '50%', 
                              background: alt.correta ? '#10b981' : 'hsl(var(--bg-surface))', 
                              color: alt.correta ? 'white' : 'hsl(var(--text-secondary))', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontWeight: 800, 
                              fontSize: 13, 
                              cursor: 'pointer', 
                              border: `2px solid ${alt.correta ? '#10b981' : 'hsl(var(--border-subtle))'}`,
                              boxShadow: alt.correta ? '0 0 0 2px rgba(16,185,129,0.25)' : 'none',
                              transition: 'all 0.15s ease',
                              flexShrink: 0
                            }}
                            title={alt.correta ? "Gabarito selecionado" : "Clique para marcar como correta"}
                          >
                            {alt.correta ? <Check size={16} strokeWidth={3} /> : alt.letra}
                          </button>

                          {/* Ultra Compact Text Input/Editor */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <EditorQuill 
                              value={alt.texto} 
                              onChange={(val) => updateAlternativa(i, 'texto', val)} 
                              placeholder={`Texto da alternativa ${alt.letra}...`}
                              variant="alternative"
                            />
                          </div>

                          {/* Actions: Imagem + Linhas + Status + Excluir */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                            {/* Botão Adicionar Imagem na Alternativa (Apenas Ícone) */}
                            <button
                              type="button"
                              onClick={() => handleUploadAlternativaImagem(i)}
                              disabled={uploadingAltIndex === i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 28,
                                height: 28,
                                padding: 0,
                                borderRadius: 7,
                                border: '1px solid',
                                background: alt.imagem_url ? 'rgba(59,130,246,0.12)' : 'hsl(var(--bg-surface))',
                                borderColor: alt.imagem_url ? '#3b82f6' : 'hsl(var(--border-subtle))',
                                color: alt.imagem_url ? '#3b82f6' : 'hsl(var(--text-secondary))',
                                cursor: uploadingAltIndex === i ? 'wait' : 'pointer',
                                transition: 'all 0.15s',
                                flexShrink: 0
                              }}
                              title={alt.imagem_url ? "Alterar imagem da alternativa" : "Adicionar imagem à alternativa"}
                            >
                              {uploadingAltIndex === i ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <ImageIcon size={14} />
                              )}
                            </button>

                            {/* Botão Adicionar Linhas na Alternativa */}
                            <button
                              type="button"
                              onClick={() => {
                                const currentShowing = !!alt.showLinhasSlider
                                updateAlternativa(i, 'showLinhasSlider', !currentShowing)
                                if (!currentShowing && (!alt.linhas || alt.linhas === 0)) {
                                  updateAlternativa(i, 'linhas', 3)
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 8px',
                                borderRadius: 7,
                                border: '1px solid',
                                background: (alt.linhas && alt.linhas > 0) ? 'rgba(139,92,246,0.12)' : 'hsl(var(--bg-surface))',
                                borderColor: (alt.linhas && alt.linhas > 0) ? '#8b5cf6' : 'hsl(var(--border-subtle))',
                                color: (alt.linhas && alt.linhas > 0) ? '#8b5cf6' : 'hsl(var(--text-secondary))',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              title="Adicionar ou ajustar linhas de resposta nesta alternativa"
                            >
                              <AlignLeft size={13} />
                              <span>{(alt.linhas && alt.linhas > 0) ? `${alt.linhas}L` : '+ Linhas'}</span>
                            </button>

                            {alternativas.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeAlternativa(i)}
                                style={{
                                  width: 28, 
                                  height: 28, 
                                  borderRadius: 6,
                                  background: 'transparent', 
                                  border: 'none',
                                  color: 'hsl(var(--text-secondary))', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  cursor: 'pointer', 
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.color = '#ef4444'
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.color = 'hsl(var(--text-secondary))'
                                  e.currentTarget.style.background = 'transparent'
                                }}
                                title="Excluir alternativa"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mini preview da Imagem anexada na alternativa */}
                        {alt.imagem_url && (
                          <div style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 8, 
                            padding: '4px 10px', 
                            background: 'hsl(var(--bg-surface))', 
                            borderRadius: 8, 
                            border: '1px solid hsl(var(--border-subtle))',
                            marginLeft: 42,
                            width: 'fit-content'
                          }}>
                            <img 
                              src={alt.imagem_url.split('#')[0]} 
                              alt={`Imagem da Alternativa ${alt.letra}`} 
                              style={{ maxHeight: 36, maxWidth: 120, objectFit: 'contain', borderRadius: 4 }} 
                            />
                            <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                              Imagem anexada
                            </span>
                            <button 
                              type="button" 
                              onClick={() => {
                                updateAlternativa(i, 'imagem_url', null)
                                updateAlternativa(i, 'imagem', null)
                              }}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                              title="Remover imagem"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}

                        {/* Barra Rolante de Linhas da Alternativa (0 a 30 linhas) */}
                        {Boolean(alt.showLinhasSlider || (alt.linhas && alt.linhas > 0)) && (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 6, 
                            padding: '8px 12px', 
                            background: 'hsl(var(--bg-surface))', 
                            borderRadius: 8, 
                            border: '1px solid hsl(var(--border-subtle))',
                            marginLeft: 42
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <AlignLeft size={13} color="#8b5cf6" /> Quantidade de Linhas na Alternativa {alt.letra}:
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', padding: '2px 8px', borderRadius: 10 }}>
                                  {alt.linhas || 0} {(alt.linhas || 0) === 1 ? 'linha' : 'linhas'}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    updateAlternativa(i, 'linhas', 0)
                                    updateAlternativa(i, 'showLinhasSlider', false)
                                  }}
                                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                  title="Remover linhas"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-secondary))', minWidth: 14 }}>0</span>
                              <input 
                                type="range" 
                                min="0" 
                                max="30" 
                                step="1"
                                value={alt.linhas || 0} 
                                onChange={e => updateAlternativa(i, 'linhas', parseInt(e.target.value, 10))}
                                style={{ flex: 1, accentColor: '#8b5cf6', cursor: 'pointer', height: 5 }}
                              />
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-secondary))', minWidth: 18 }}>30</span>
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* DESCRITIVA CONFIGURATION */
                <div style={{ 
                  padding: '16px 20px', 
                  borderRadius: 14, 
                  background: 'hsl(var(--bg-app))', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 14 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                        Espaço para Resposta do Aluno
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                        Escolha se o aluno responderá em linhas pautadas ou em espaço livre em branco
                      </p>
                    </div>

                    <div style={{ display: 'inline-flex', background: 'hsl(var(--bg-surface))', padding: 3, borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', gap: 3 }}>
                      <button 
                        type="button"
                        onClick={() => setEstiloEspaco('pautado')}
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: 7, 
                          fontSize: 12, 
                          fontWeight: 700, 
                          cursor: 'pointer', 
                          border: 'none', 
                          background: estiloEspaco === 'pautado' ? '#3b82f6' : 'transparent',
                          color: estiloEspaco === 'pautado' ? '#ffffff' : 'hsl(var(--text-secondary))',
                          transition: 'all 0.15s'
                        }}
                      >
                        Linhas Pautadas (Caderno)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setEstiloEspaco('em_branco')}
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: 7, 
                          fontSize: 12, 
                          fontWeight: 700, 
                          cursor: 'pointer', 
                          border: 'none', 
                          background: estiloEspaco === 'em_branco' ? '#3b82f6' : 'transparent',
                          color: estiloEspaco === 'em_branco' ? '#ffffff' : 'hsl(var(--text-secondary))',
                          transition: 'all 0.15s'
                        }}
                      >
                        Espaço em Branco (Quadro)
                      </button>
                    </div>
                  </div>
                  
                  {/* BARRA ROLANTE 0 A 30 LINHAS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlignLeft size={14} color="#3b82f6" /> Quantidade de Linhas para Resposta:
                      </label>
                      <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        padding: '3px 10px', 
                        borderRadius: 20, 
                        background: 'rgba(59,130,246,0.1)', 
                        color: '#3b82f6', 
                        fontSize: 12, 
                        fontWeight: 800,
                        border: '1px solid rgba(59,130,246,0.25)'
                      }}>
                        <span>{linhasResposta === 0 ? 'Sem linhas (0)' : `${linhasResposta} ${linhasResposta === 1 ? 'linha' : 'linhas'}`}</span>
                      </div>
                    </div>

                    {/* Slider Range Bar 0 a 30 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', minWidth: 16 }}>0</span>
                      <input 
                        type="range" 
                        min="0" 
                        max="30" 
                        step="1"
                        value={linhasResposta} 
                        onChange={e => setLinhasResposta(parseInt(e.target.value, 10))}
                        style={{
                          flex: 1,
                          accentColor: '#3b82f6',
                          cursor: 'pointer',
                          height: 6,
                          borderRadius: 3
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', minWidth: 20 }}>30</span>
                    </div>

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                      {[0, 3, 5, 8, 10, 15, 20, 25, 30].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setLinhasResposta(n)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: linhasResposta === n ? '#3b82f6' : 'hsl(var(--bg-surface))',
                            color: linhasResposta === n ? 'white' : 'hsl(var(--text-secondary))',
                            borderColor: linhasResposta === n ? '#3b82f6' : 'hsl(var(--border-subtle))',
                            transition: 'all 0.15s'
                          }}
                        >
                          {n === 0 ? '0 (Sem linhas)' : `${n}L`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </form>
          </div>

          {/* RIGHT: CLEAN MODERN PREVIEW (SHOWING ONLY QUESTION STATEMENT & ALTERNATIVES) */}
          {showPreview && (
            <div 
              className="preview-side custom-scroll" 
              style={{ 
                width: 360, 
                borderLeft: '1px solid hsl(var(--border-subtle))', 
                background: 'hsl(var(--bg-app))', 
                padding: '20px 16px', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                minWidth: 0
              }}
            >
              {/* Clean Modern Card */}
              <div style={{ 
                background: 'hsl(var(--bg-surface))', 
                border: '1px solid hsl(var(--border-subtle))', 
                borderRadius: 16, 
                padding: '22px', 
                boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                {/* Modern Minimalist Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ 
                    fontSize: 11, 
                    fontWeight: 800, 
                    color: '#3b82f6', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.06em', 
                    background: 'rgba(59,130,246,0.1)', 
                    padding: '3px 8px', 
                    borderRadius: 6 
                  }}>
                    PREVIEW
                  </span>
                  {tipoQuestao === 'multipla_escolha' && gabaritoAtual && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                      Gabarito: {gabaritoAtual}
                    </span>
                  )}
                </div>

                {/* IMAGENS NO INÍCIO */}
                {imagensApoio.filter(i => i.posicao === 'inicio').map((img, idx) => (
                  <div key={idx} style={{ textAlign: 'center', margin: '4px 0' }}>
                    <img 
                      src={img.url} 
                      alt="Imagem Início" 
                      style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'contain' }} 
                    />
                  </div>
                ))}
                
                {/* ENUNCIADO TEXT (APENAS O ENUNCIADO COM QUEBRA DE LINHA CORRETA) */}
                <div style={{ 
                  fontSize: 13.5, 
                  lineHeight: 1.6, 
                  textAlign: 'justify', 
                  wordBreak: 'break-word', 
                  overflowWrap: 'anywhere',
                  minWidth: 0,
                  width: '100%',
                  overflow: 'hidden',
                  color: 'hsl(var(--text-primary))' 
                }}>
                  <HtmlContent 
                    html={enunciado || '<span style="color:#94a3b8;font-style:italic">Digite o enunciado da questão para visualizar...</span>'}
                    style={{ fontSize: 13.5, lineHeight: 1.6, textAlign: 'justify', fontFamily: 'Inter, sans-serif', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  />
                </div>

                {/* IMAGENS NO FINAL */}
                {imagensApoio.filter(i => i.posicao === 'final').map((img, idx) => (
                  <div key={idx} style={{ textAlign: 'center', margin: '4px 0' }}>
                    <img 
                      src={img.url} 
                      alt="Imagem Final" 
                      style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'contain' }} 
                    />
                  </div>
                ))}

                {/* ALTERNATIVAS MODERNAS COM QUEBRA DE LINHA, IMAGEM E LINHAS */}
                {tipoQuestao === 'multipla_escolha' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, minWidth: 0, width: '100%' }}>
                    {alternativas.filter(a => a.texto.replace(/<[^>]+>/g, '').trim() !== '' || a.imagem_url || (a.linhas && a.linhas > 0)).length > 0 ? (
                      alternativas.filter(a => a.texto.replace(/<[^>]+>/g, '').trim() !== '' || a.imagem_url || (a.linhas && a.linhas > 0)).map((alt) => (
                        <div 
                          key={alt.letra} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: 12, 
                            padding: '10px 14px', 
                            borderRadius: 10, 
                            background: alt.correta ? 'rgba(16,185,129,0.08)' : 'hsl(var(--bg-app))',
                            border: `1.5px solid ${alt.correta ? '#10b981' : 'hsl(var(--border-subtle))'}`,
                            transition: 'all 0.15s ease',
                            minWidth: 0,
                            width: '100%',
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                          }}
                        >
                          <div style={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            background: alt.correta ? '#10b981' : 'rgba(100,116,139,0.15)', 
                            color: alt.correta ? 'white' : 'hsl(var(--text-secondary))', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: 11, 
                            fontWeight: 800,
                            flexShrink: 0,
                            marginTop: 2
                          }}>
                            {alt.letra}
                          </div>
                          <div style={{ 
                            fontSize: 13.5, 
                            lineHeight: 1.5, 
                            color: alt.correta ? '#059669' : 'hsl(var(--text-primary))', 
                            fontWeight: alt.correta ? 600 : 400, 
                            flex: 1,
                            minWidth: 0,
                            width: '100%',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            overflow: 'hidden'
                          }}>
                            <HtmlContent 
                              html={alt.texto || '<span style="color:#94a3b8;font-style:italic">Texto da alternativa...</span>'} 
                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            />
                            {alt.imagem_url && (
                              <div style={{ marginTop: 8, textAlign: 'center' }}>
                                <img 
                                  src={alt.imagem_url.split('#')[0]} 
                                  alt={`Alternativa ${alt.letra}`} 
                                  style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, objectFit: 'contain' }} 
                                />
                              </div>
                            )}
                            {alt.linhas > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, width: '100%' }}>
                                {Array.from({ length: alt.linhas }).map((_, lIdx) => (
                                  <div key={lIdx} style={{ height: 18, borderBottom: '1px solid hsl(var(--border-subtle))', width: '100%' }} />
                                ))}
                              </div>
                            )}
                          </div>
                          {alt.correta && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', flexShrink: 0, marginTop: 2 }}>
                              ✓ Gabarito
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13, padding: '8px 0' }}>
                        Nenhuma alternativa preenchida
                      </span>
                    )}
                  </div>
                )}

                {/* DESCRITIVA PREVIEW */}
                {tipoQuestao === 'descritiva' && (
                  <div style={{ marginTop: 6, minWidth: 0, width: '100%' }}>
                    {linhasResposta > 0 ? (
                      estiloEspaco === 'pautado' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: '8px 12px', background: 'hsl(var(--bg-app))', width: '100%', boxSizing: 'border-box' }}>
                          {Array.from({ length: linhasResposta }).map((_, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', height: 24, width: '100%' }}>
                              <span style={{ width: 18, fontSize: 10, color: 'hsl(var(--text-muted))', textAlign: 'right', paddingRight: 6, userSelect: 'none' }}>{i + 1}</span>
                              <div style={{ flex: 1, height: '100%', borderBottom: '1px solid hsl(var(--border-subtle))' }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ height: linhasResposta * 24, border: '1px dashed hsl(var(--border-subtle))', borderRadius: 8, background: 'hsl(var(--bg-app))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', fontSize: 12, fontStyle: 'italic', width: '100%', boxSizing: 'border-box' }}>
                          Espaço em branco reservado para resposta ({linhasResposta} linhas)
                        </div>
                      )
                    ) : (
                      <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 8, padding: 8, background: 'hsl(var(--bg-app))', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: 11, fontStyle: 'italic' }}>
                        Sem espaço extra delimitado (0 linhas)
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <footer style={{ 
          padding: '16px 28px', 
          borderTop: '1px solid hsl(var(--border-subtle))', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'hsl(var(--bg-surface))',
          gap: 16,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {tipoQuestao === 'multipla_escolha' && (
              gabaritoAtual ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={15} /> Gabarito definido: <strong>Letra {gabaritoAtual}</strong>
                </span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={15} /> Marque uma alternativa como correta
                </span>
              )
            )}
            <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Atalho: <kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', fontSize: 11, fontWeight: 700 }}>⌘ + Enter</kbd> ou <kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', fontSize: 11, fontWeight: 700 }}>Ctrl + Enter</kbd>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ 
                padding: '10px 20px', 
                borderRadius: 10, 
                border: '1px solid hsl(var(--border-subtle))', 
                background: 'transparent', 
                color: 'hsl(var(--text-primary))', 
                fontSize: 13,
                fontWeight: 700, 
                cursor: 'pointer',
                transition: 'all 0.15s' 
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-hover))'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Cancelar
            </button>
            
            <button 
              type="submit" 
              form="questao-form" 
              disabled={loading || uploading} 
              style={{ 
                padding: '10px 24px', 
                borderRadius: 10, 
                border: 'none', 
                background: '#3b82f6', 
                color: 'white', 
                fontSize: 13,
                fontWeight: 800, 
                cursor: (loading || uploading) ? 'not-allowed' : 'pointer', 
                opacity: (loading || uploading) ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                transition: 'all 0.15s'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando Questão...
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  Salvar Questão
                </>
              )}
            </button>
          </div>
        </footer>

      </motion.div>

      {/* MODAL DE IA */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !isGenerating && setIsAiModalOpen(false)} 
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 16 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 16 }} 
              className="ai-modal-box custom-scroll" 
              style={{ 
                position: 'relative', 
                width: '100%', 
                maxWidth: 620, 
                maxHeight: '88vh', 
                overflowY: 'auto', 
                background: 'hsl(var(--bg-surface))', 
                borderRadius: 22, 
                padding: 32, 
                border: '1px solid hsl(var(--border-subtle))', 
                boxShadow: '0 25px 60px -15px rgba(0,0,0,0.45)' 
              }}
            >
              
              <button 
                onClick={() => setIsAiModalOpen(false)} 
                disabled={isGenerating} 
                style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer', padding: 8, borderRadius: 8 }}
              >
                <X size={20} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 18px -4px rgba(236,72,153,0.5)', flexShrink: 0 }}>
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 style={{ color: 'hsl(var(--text-primary))', margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    Criar Questão com IA
                  </h2>
                  <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 13 }}>
                    A IA formulará o enunciado, contextualização pedagógica e as 5 alternativas
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Nível de Dificuldade
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { id: 'facil', label: 'Fácil', color: '#10b981' },
                      { id: 'media', label: 'Média', color: '#f59e0b' },
                      { id: 'dificil', label: 'Difícil', color: '#ef4444' },
                    ].map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setAiDificuldade(d.id)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: `1.5px solid ${aiDificuldade === d.id ? d.color : 'hsl(var(--border-subtle))'}`,
                          background: aiDificuldade === d.id ? `${d.color}15` : 'hsl(var(--bg-app))',
                          color: aiDificuldade === d.id ? d.color : 'hsl(var(--text-secondary))',
                          transition: 'all 0.15s'
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Estilo / Formato do Enunciado
                  </label>
                  <select 
                    value={aiForm.formato} 
                    onChange={e => setAiForm({...aiForm, formato: e.target.value})}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none' }}
                  >
                    <option value="padrao">Padrão / Contextualizado (Equilibrado)</option>
                    <option value="curto">Curto e Direto (Mais Objetivo)</option>
                    <option value="enem">Estilo ENEM (Situação-problema e Textos Base)</option>
                    <option value="caso_clinico">Caso Prático / Situação Real</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Turma / Ano Escolar Alvo *
                  </label>
                  <select 
                    value={aiForm.turma} 
                    onChange={e => setAiForm({...aiForm, turma: e.target.value})}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none' }}
                  >
                    <option value="" disabled>Selecione a Turma...</option>
                    {turmasDisponiveis.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Assunto / Tema da Questão *
                  </label>
                  <input 
                    placeholder="Ex: Teorema de Pitágoras, Revolução Francesa, Fotossíntese..."
                    value={aiForm.assunto} 
                    onChange={e => setAiForm({...aiForm, assunto: e.target.value})} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Instruções Específicas ou Contexto (Opcional)
                  </label>
                  <textarea 
                    placeholder="Ex: Inclua uma situação do cotidiano envolvendo compras no supermercado..."
                    value={aiForm.detalhes} 
                    onChange={e => setAiForm({...aiForm, detalhes: e.target.value})} 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none', minHeight: 74, resize: 'vertical', fontFamily: 'inherit' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button 
                  type="button"
                  onClick={() => setIsAiModalOpen(false)} 
                  disabled={isGenerating} 
                  style={{ flex: 1, padding: 14, borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleGenerateAi} 
                  disabled={isGenerating || !aiForm.assunto || !aiForm.turma} 
                  style={{ 
                    flex: 1.5, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 8, 
                    padding: 14, 
                    borderRadius: 12, 
                    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', 
                    border: 'none', 
                    color: '#fff', 
                    cursor: (isGenerating || !aiForm.assunto || !aiForm.turma) ? 'not-allowed' : 'pointer', 
                    fontWeight: 800, 
                    fontSize: 14,
                    boxShadow: '0 8px 20px -6px rgba(236,72,153,0.5)', 
                    opacity: (isGenerating || !aiForm.assunto || !aiForm.turma) ? 0.7 : 1 
                  }}
                >
                  {isGenerating ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'flex', alignItems: 'center' }}>
                      <Sparkles size={18} />
                    </motion.div>
                  ) : <Bot size={18} />}
                  {isGenerating ? 'Gerando com Inteligência Artificial...' : 'Gerar Questão'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: hsl(var(--border-subtle));
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--border-strong));
        }
        @media (max-width: 900px) {
          .modal-box { 
            height: 96vh !important; 
            max-height: 96vh !important; 
            border-radius: 14px !important; 
          }
          .preview-side { 
            display: none !important; 
          }
        }
      `}</style>
    </div>
  )
}
