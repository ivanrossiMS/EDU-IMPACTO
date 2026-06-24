'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Plus, Trash2, Image as ImageIcon, Bold, Italic, Underline, List, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
        style={{ padding: 16, minHeight: 120, color: 'hsl(var(--text-primary))', outline: 'none', fontSize: 15, lineHeight: 1.6 }}
        data-placeholder={placeholder}
      />
    </div>
  )
}

export default function NovaQuestaoPage() {
  const router = useRouter()
  const [enunciado, setEnunciado] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [dificuldade, setDificuldade] = useState('media')
  
  const [alternativas, setAlternativas] = useState([
    { letra: 'A', texto: '', correta: true },
    { letra: 'B', texto: '', correta: false },
    { letra: 'C', texto: '', correta: false },
    { letra: 'D', texto: '', correta: false },
    { letra: 'E', texto: '', correta: false },
  ])

  const [loading, setLoading] = useState(false)
  
  // Mock data for dropdowns (in a real app, fetch from Supabase)
  const disciplinas = [
    { id: '1', nome: 'Matemática' },
    { id: '2', nome: 'Língua Portuguesa' },
    { id: '3', nome: 'Física' },
    { id: '4', nome: 'História' },
  ]

  const handleSetCorreta = (index: number) => {
    setAlternativas(prev => prev.map((alt, i) => ({ ...alt, correta: i === index })))
  }

  const handleAltTextChange = (index: number, text: string) => {
    setAlternativas(prev => prev.map((alt, i) => i === index ? { ...alt, texto: text } : alt))
  }

  const handleSave = async () => {
    if (!enunciado.trim() || !disciplinaId) {
      alert('Preencha o enunciado e selecione uma disciplina.')
      return
    }
    
    // Check if any alternative is empty
    if (alternativas.some(a => !a.texto.trim())) {
      alert('Preencha todas as alternativas.')
      return
    }

    setLoading(true)
    try {
      // Aqui faríamos o insert na tabela simulados_questoes e simulados_alternativas
      console.log('Saving...', { enunciado, disciplinaId, dificuldade, alternativas })
      await new Promise(r => setTimeout(r, 1000))
      
      alert('Questão salva com sucesso!')
      router.push('/simulados/banco')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar questão.')
    } finally {
      setLoading(false)
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
          
          <button 
            onClick={handleSave}
            disabled={loading}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', 
              borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
              color: '#fff', fontWeight: 700, border: 'none', cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            <Save size={18} />
            {loading ? 'Salvando...' : 'Salvar Questão'}
          </button>
        </div>

        {/* Formulário */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
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
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Enunciado da Questão</span>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 12, padding: '4px 10px', borderRadius: 100, cursor: 'pointer' }}>
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
    </div>
  )
}
