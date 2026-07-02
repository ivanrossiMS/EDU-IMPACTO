'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Save, Plus, Trash2, Image as ImageIcon, Bold, Italic, Underline, List, CheckCircle2, Sparkles, X, Bot } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'

// A simple zero-dependency Rich Text Editor component
function SimpleRichTextEditor({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const execCmd = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg)
    editorRef.current?.focus()
    handleInput()
  }

  return (
    <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden', background: 'hsl(var(--bg-app))' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <button type="button" onClick={() => execCmd('bold')} style={{ padding: 6, background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer', borderRadius: 4 }}><Bold size={16} /></button>
        <button type="button" onClick={() => execCmd('italic')} style={{ padding: 6, background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer', borderRadius: 4 }}><Italic size={16} /></button>
        <button type="button" onClick={() => execCmd('underline')} style={{ padding: 6, background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer', borderRadius: 4 }}><Underline size={16} /></button>
        <div style={{ width: 1, background: 'hsl(var(--border-subtle))', margin: '0 4px' }} />
        <button type="button" onClick={() => execCmd('insertUnorderedList')} style={{ padding: 6, background: 'transparent', border: 'none', color: 'hsl(var(--text-primary))', cursor: 'pointer', borderRadius: 4 }}><List size={16} /></button>
      </div>
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{ padding: 16, minHeight: 120, color: 'hsl(var(--text-primary))', outline: 'none', fontSize: 15, lineHeight: 1.6, textAlign: 'justify' }}
        data-placeholder={placeholder}
      />
    </div>
  )
}

export default function NovaQuestaoBancoPage() {
  const router = useRouter()
  const { currentUser } = useApp()
  const [enunciado, setEnunciado] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [dificuldade, setDificuldade] = useState('media')
  const [turma, setTurma] = useState('')
  
  const [alternativas, setAlternativas] = useState([
    { letra: 'A', texto: '', correta: true },
    { letra: 'B', texto: '', correta: false },
    { letra: 'C', texto: '', correta: false },
    { letra: 'D', texto: '', correta: false },
    { letra: 'E', texto: '', correta: false },
  ])

  const [loading, setLoading] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Image Upload State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePosition, setImagePosition] = useState<'inicio'|'final'>('final')
  const [isUploadingImages, setIsUploadingImages] = useState(false)

  const handleImageButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedImages(Array.from(e.target.files))
      setIsImageModalOpen(true)
    }
    e.target.value = '' // Reset para permitir re-seleção
  }

  const handleUploadImages = async () => {
    setIsUploadingImages(true)
    try {
      const uploadedUrls: string[] = []
      
      for (const file of selectedImages) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'comunicados-midia')
        
        const res = await fetch('/api/upload-midia', {
          method: 'POST',
          body: formData
        })
        
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro no upload da imagem')
        }
        
        const json = await res.json()
        uploadedUrls.push(json.url)
      }
      
      let imgHtml = ''
      uploadedUrls.forEach(url => {
        imgHtml += `<div style="text-align: center; margin: 16px 0;"><img src="${url}" style="max-width: 100%; border-radius: 8px;" /></div>`
      })
      
      if (imagePosition === 'inicio') {
        setEnunciado(imgHtml + enunciado)
      } else {
        setEnunciado(enunciado + imgHtml)
      }
      
      setIsImageModalOpen(false)
      setSelectedImages([])
    } catch (err: any) {
      alert('Erro: ' + err.message)
      console.error(err)
    } finally {
      setIsUploadingImages(false)
    }
  }

  // Form para IA
  const [aiForm, setAiForm] = useState({ assunto: '', turma: '', detalhes: '' })
  
  const [disciplinas, setDisciplinas] = useState<any[]>([])

  useEffect(() => {
    const fetchDisciplinas = async () => {
      try {
        const { data, error } = await supabase.from('simulados_disciplinas').select('*').order('nome')
        if (error) throw error
        setDisciplinas(data || [])
      } catch (err) {
        console.error('Erro ao buscar disciplinas:', err)
      }
    }
    fetchDisciplinas()
  }, [])

  const turmasDisponiveis = [
    '6º Ano Fundamental',
    '7º Ano Fundamental',
    '8º Ano Fundamental',
    '9º Ano Fundamental',
    '1º Ano Ensino Médio',
    '2º Ano Ensino Médio',
    '3º Ano Ensino Médio',
  ]

  const handleSetCorreta = (index: number) => {
    setAlternativas(prev => prev.map((alt, i) => ({ ...alt, correta: i === index })))
  }

  const handleAltTextChange = (index: number, text: string) => {
    setAlternativas(prev => prev.map((alt, i) => i === index ? { ...alt, texto: text } : alt))
  }

  const handleSave = async () => {
    if (!enunciado.trim() || !disciplinaId || !turma || !dificuldade) {
      alert('Preencha o enunciado, disciplina, dificuldade e turma.')
      return
    }
    
    if (alternativas.some(a => !a.texto.trim())) {
      alert('Preencha todas as alternativas.')
      return
    }

    setLoading(true)
    try {
      if (currentUser?.id) {
        const { error: upsertErr } = await (supabase as any).from('simulados_professores').upsert({ 
          id: currentUser.id,
          nome: currentUser.nome || 'Professor'
        }).select()
        if (upsertErr) {
          console.error('Erro ao registrar professor no espelho:', upsertErr)
        }
      }

      // Adiciona a turma silenciosamente ao HTML do enunciado para poder ser pesquisada depois
      const finalEnunciado = turma 
        ? `${enunciado}\n<meta name="turma" content="${turma}">`
        : enunciado

      const { data: qData, error: qErr } = await (supabase as any).from('simulados_questoes').insert({
        id_disciplina: disciplinaId,
        enunciado: finalEnunciado,
        nivel_dificuldade: dificuldade,
        tipo_questao: 'multipla_escolha',
        banco_questao: true,
        id_professor: currentUser?.id || null
      }).select().single()

      if (qErr) throw qErr

      const altsToInsert = alternativas.map((a, i) => ({
        id_questao: (qData as any).id,
        texto: a.texto,
        letra: a.letra,
        eh_correta: a.correta
      }))

      const { error: aErr } = await (supabase as any).from('simulados_alternativas').insert(altsToInsert)
      if (aErr) throw aErr
      
      alert('Questão salva com sucesso no Banco de Questões!')
      router.push('/simulados/banco')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert('Erro ao salvar questão: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAi = async () => {
    if (!disciplinaId) {
      alert('Por favor, selecione uma disciplina no modal.')
      return
    }
    if (!aiForm.assunto) {
      alert('Por favor, informe o assunto ou tema da questão.')
      return
    }

    setIsGenerating(true)
    try {
      const discNome = disciplinas.find(d => d.id === disciplinaId)?.nome || ''
      const res = await fetch('/api/ai/gerar-questao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplina: discNome,
          assunto: aiForm.assunto,
          dificuldade: dificuldade,
          turma: aiForm.turma,
          detalhes: aiForm.detalhes
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
      
      // Force exactly one correct answer if AI messes up
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
      setIsAiModalOpen(false)
    } catch (error: any) {
      alert('Erro ao gerar com IA: ' + error.message)
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/simulados/banco" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(100, 116, 139, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))', textDecoration: 'none' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>Nova Questão</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: 0, fontSize: 14 }}>Cadastre uma nova questão no banco</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <motion.button 
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setIsAiModalOpen(true)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', 
                borderRadius: 12, background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(139,92,246,0.1))', 
                color: '#ec4899', fontWeight: 700, border: '1px solid rgba(236,72,153,0.2)', cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(236,72,153,0.1)'
              }}
            >
              <Sparkles size={18} />
              Gerar com IA
            </motion.button>
            <button 
              onClick={handleSave}
              disabled={loading}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', 
                borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                color: '#fff', fontWeight: 700, border: 'none', cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1, boxShadow: '0 8px 20px -8px rgba(59,130,246,0.6)'
              }}
            >
              <Save size={18} />
              {loading ? 'Salvando...' : 'Salvar Questão'}
            </button>
          </div>
        </div>

        {/* Formulário */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Disciplina</label>
              <select 
                value={disciplinaId} 
                onChange={e => setDisciplinaId(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
              >
                <option value="" disabled>Selecione a disciplina</option>
                {disciplinas.map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dificuldade</label>
              <select 
                value={dificuldade} 
                onChange={e => setDificuldade(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
              >
                <option value="facil">Fácil</option>
                <option value="media">Média</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Turma</label>
              <select 
                value={turma} 
                onChange={e => setTurma(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
              >
                <option value="" disabled>Selecione a turma (opcional)</option>
                {turmasDisponiveis.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Enunciado da Questão</span>
              <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
              <button type="button" onClick={handleImageButtonClick} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 12, padding: '4px 10px', borderRadius: 100, cursor: 'pointer' }}>
                <ImageIcon size={14} /> Inserir Imagem
              </button>
            </label>
            <SimpleRichTextEditor value={enunciado} onChange={setEnunciado} placeholder="Digite o enunciado da questão..." />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border-subtle))', margin: '32px 0' }} />

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Alternativas</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: '0 0 24px' }}>Preencha as opções e marque a correta.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {alternativas.map((alt, index) => (
                <div key={alt.letra} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <button 
                    type="button"
                    onClick={() => handleSetCorreta(index)}
                    style={{ 
                      width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: alt.correta ? 'rgba(16,185,129,0.15)' : 'rgba(100, 116, 139, 0.1)',
                      border: `2px solid ${alt.correta ? '#10b981' : 'transparent'}`,
                      color: alt.correta ? '#10b981' : 'hsl(var(--text-secondary))',
                      fontWeight: 800, fontSize: 16, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {alt.letra}
                  </button>
                  <div style={{ flex: 1 }}>
                    <SimpleRichTextEditor value={alt.texto} onChange={(v) => handleAltTextChange(index, v)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </motion.div>

      {/* MODAL DE IA */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isGenerating && setIsAiModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} style={{ position: 'relative', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', background: 'linear-gradient(135deg, hsl(var(--bg-surface)), hsl(var(--bg-elevated)))', borderRadius: 24, padding: 32, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.5)' }}>
              
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
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Disciplina *</label>
                    <select 
                      value={disciplinaId} 
                      onChange={e => setDisciplinaId(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#ec4899'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
                    >
                      <option value="" disabled>Selecione...</option>
                      {disciplinas.map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Dificuldade *</label>
                    <select 
                      value={dificuldade} 
                      onChange={e => setDificuldade(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#ec4899'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
                    >
                      <option value="facil">Fácil</option>
                      <option value="media">Média</option>
                      <option value="dificil">Difícil</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Turma / Público Alvo *</label>
                  <select 
                    value={aiForm.turma} 
                    onChange={e => setAiForm({...aiForm, turma: e.target.value})}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#ec4899'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
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
                    onFocus={e => e.target.style.borderColor = '#ec4899'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Detalhes ou Contexto (Opcional)</label>
                  <textarea 
                    placeholder="Ex: Use um exemplo do dia a dia envolvendo supermercado..."
                    value={aiForm.detalhes} onChange={e => setAiForm({...aiForm, detalhes: e.target.value})} 
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} 
                    onFocus={e => e.target.style.borderColor = '#ec4899'} onBlur={e => e.target.style.borderColor = 'hsl(var(--border-subtle))'} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
                <button onClick={() => setIsAiModalOpen(false)} disabled={isGenerating} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 700 }}>
                  Cancelar
                </button>
                <button 
                  onClick={handleGenerateAi} 
                  disabled={isGenerating || !disciplinaId || !aiForm.assunto || !aiForm.turma} 
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, boxShadow: '0 8px 20px -8px rgba(236,72,153,0.6)', opacity: (isGenerating || !disciplinaId || !aiForm.assunto || !aiForm.turma) ? 0.7 : 1 }}
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
      {/* MODAL DE IMAGEM */}
      <AnimatePresence>
        {isImageModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isUploadingImages && setIsImageModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} style={{ position: 'relative', width: '100%', maxWidth: 500, background: 'hsl(var(--bg-elevated))', borderRadius: 24, padding: 32, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.5)' }}>
              
              <button onClick={() => setIsImageModalOpen(false)} disabled={isUploadingImages} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer', padding: 8 }}>
                <X size={20} />
              </button>

              <h2 style={{ color: 'hsl(var(--text-primary))', margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Inserir Imagens</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '0 0 24px', fontSize: 14 }}>{selectedImages.length} imagem(ns) selecionada(s).</p>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Posição na questão:</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={() => setImagePosition('inicio')}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${imagePosition === 'inicio' ? '#8b5cf6' : 'hsl(var(--border-subtle))'}`, background: imagePosition === 'inicio' ? 'rgba(139,92,246,0.1)' : 'hsl(var(--bg-surface))', color: imagePosition === 'inicio' ? '#8b5cf6' : 'hsl(var(--text-primary))', fontWeight: 600, cursor: 'pointer' }}
                  >
                    No Início
                  </button>
                  <button 
                    onClick={() => setImagePosition('final')}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${imagePosition === 'final' ? '#8b5cf6' : 'hsl(var(--border-subtle))'}`, background: imagePosition === 'final' ? 'rgba(139,92,246,0.1)' : 'hsl(var(--bg-surface))', color: imagePosition === 'final' ? '#8b5cf6' : 'hsl(var(--text-primary))', fontWeight: 600, cursor: 'pointer' }}
                  >
                    No Final
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setIsImageModalOpen(false)} disabled={isUploadingImages} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 700 }}>
                  Cancelar
                </button>
                <button 
                  onClick={handleUploadImages} 
                  disabled={isUploadingImages} 
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, background: '#8b5cf6', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: isUploadingImages ? 0.7 : 1 }}
                >
                  {isUploadingImages ? 'Enviando...' : 'Confirmar e Inserir'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
