'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Image as ImageIcon, Upload, Loader2, Eye, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function RichTextEditor({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || '<div style="text-align: justify;"><br></div>'
      }
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const format = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    if (editorRef.current) {
      editorRef.current.focus()
      onChange(editorRef.current.innerHTML)
    }
  }

  return (
    <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden', background: 'hsl(var(--bg-app))' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
        <button type="button" onClick={() => format('bold')} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))', borderRadius: 4 }} title="Negrito"><Bold size={16} /></button>
        <button type="button" onClick={() => format('italic')} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))', borderRadius: 4 }} title="Itálico"><Italic size={16} /></button>
        <button type="button" onClick={() => format('underline')} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))', borderRadius: 4 }} title="Sublinhado"><Underline size={16} /></button>
        <div style={{ width: 1, background: 'hsl(var(--border-subtle))', margin: '4px 8px' }} />
        <button type="button" onClick={() => format('justifyLeft')} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))', borderRadius: 4 }} title="Alinhar à Esquerda"><AlignLeft size={16} /></button>
        <button type="button" onClick={() => format('justifyCenter')} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))', borderRadius: 4 }} title="Centralizar"><AlignCenter size={16} /></button>
        <button type="button" onClick={() => format('justifyRight')} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))', borderRadius: 4 }} title="Alinhar à Direita"><AlignRight size={16} /></button>
        <button type="button" onClick={() => format('justifyFull')} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))', borderRadius: 4 }} title="Justificar"><AlignJustify size={16} /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={handlePaste}
        style={{ padding: '16px', minHeight: '120px', outline: 'none', color: 'hsl(var(--text-primary))', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, textAlign: 'justify' }}
        data-placeholder={placeholder}
      />
    </div>
  )
}

export function QuestaoFormModal({ simuladoId, questao, defaultProfessorId, defaultDisciplinaId, onClose, onSave }: { simuladoId: string, questao?: any, defaultProfessorId?: string, defaultDisciplinaId?: string, onClose: () => void, onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  
  const [idDisciplina, setIdDisciplina] = useState(questao?.id_disciplina || defaultDisciplinaId || '')
  const [enunciado, setEnunciado] = useState(questao ? '' : '<div style="text-align: justify;"><br></div>')
  const [imagensApoio, setImagensApoio] = useState<{url: string, posicao: 'inicio' | 'final'}[]>([])
  const [showPreview, setShowPreview] = useState(true)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [alternativas, setAlternativas] = useState<any[]>(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const questaoData: any = {
        id_simulado: simuladoId,
        id_disciplina: idDisciplina || null,
        enunciado: getEnunciadoComImagens(),
        ordem: questao?.ordem || 0
      }

      // Salva o professor se estiver filtrado na URL e for uma nova questão
      if (defaultProfessorId && !questao?.id) {
        questaoData.id_professor = defaultProfessorId;
        // Garantir que o ID exista na tabela espelho (ignorar se já existir)
        await supabase.from('simulados_professores').upsert({ id: defaultProfessorId }).select()
      }

      let qId = questao?.id

      if (qId) {
        await supabase.from('simulados_questoes').update(questaoData).eq('id', qId)
      } else {
        const { data: newQ, error: errQ } = await supabase.from('simulados_questoes').insert(questaoData).select().single()
        if (errQ) throw errQ
        qId = newQ.id
      }

      if (questao?.id) {
        const { error: errDel } = await supabase.from('simulados_alternativas').delete().eq('id_questao', qId)
        if (errDel) throw errDel
      }

      const altsData = alternativas.filter(a => a.texto.trim() !== '').map(a => ({
        id_questao: qId,
        letra: a.letra,
        texto: a.texto,
        eh_correta: a.correta
      }))

      if (altsData.length > 0) {
        const { error: errA } = await supabase.from('simulados_alternativas').insert(altsData)
        if (errA) throw errA
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
    const newAlts = [...alternativas]
    if (field === 'correta' && value === true) {
      newAlts.forEach(a => a.correta = false)
    }
    newAlts[index] = { ...newAlts[index], [field]: value }
    setAlternativas(newAlts)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 20, width: '100%', maxWidth: showPreview ? 1000 : 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', transition: 'max-width 0.3s ease' }}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
            {questao ? 'Editar Questão' : 'Nova Questão'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => setShowPreview(!showPreview)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: showPreview ? 'rgba(59,130,246,0.1)' : 'transparent', color: showPreview ? '#3b82f6' : 'hsl(var(--text-primary))', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              <Eye size={16} /> {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
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
                <RichTextEditor 
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

                  <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.7 : 1, width: 'fit-content' }}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? 'Enviando Imagem...' : 'Enviar Nova Imagem'}
                    <input 
                      type="file" 
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      disabled={uploading}
                    />
                  </label>
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
                      <input 
                        type="text" 
                        value={alt.texto} 
                        onChange={e => updateAlternativa(i, 'texto', e.target.value)} 
                        placeholder={`Texto da alternativa ${alt.letra}`}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: `1px solid ${alt.correta ? '#10b981' : 'hsl(var(--border-subtle))'}`, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))' }}
                      />
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
            <div style={{ width: 400, borderLeft: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-app))', padding: '32px', overflowY: 'auto' }}>
              <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(59,130,246,0.1)', padding: '4px 8px', borderRadius: 6 }}>
                    PREVIEW
                  </span>
                </div>
                
                <div 
                  style={{ color: 'hsl(var(--text-primary))', fontSize: 12, lineHeight: 1.6, marginBottom: 20, fontFamily: 'Arial, Helvetica, sans-serif', textAlign: 'justify', wordBreak: 'break-word' }}
                  dangerouslySetInnerHTML={{ __html: getEnunciadoComImagens() || '<span style="color:#94a3b8;font-style:italic">Enunciado vazio</span>' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alternativas.filter(a => a.texto.trim() !== '').length > 0 ? (
                    alternativas.filter(a => a.texto.trim() !== '').map((alt) => (
                      <div key={alt.letra} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: alt.correta ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-app))', border: `1px solid ${alt.correta ? '#10b981' : 'hsl(var(--border-subtle))'}` }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: alt.correta ? '#10b981' : 'rgba(100,116,139,0.2)', color: alt.correta ? 'white' : 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {alt.letra}
                        </div>
                        <div style={{ color: alt.correta ? '#10b981' : 'hsl(var(--text-primary))', fontSize: 14, fontWeight: alt.correta ? 600 : 400 }}>
                          {alt.texto}
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

        <div style={{ padding: '24px 32px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'transparent', color: 'hsl(var(--text-primary))', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" form="questao-form" disabled={loading || uploading} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: (loading || uploading) ? 'not-allowed' : 'pointer', opacity: (loading || uploading) ? 0.7 : 1 }}>
            {loading ? 'Salvando...' : 'Salvar Questão'}
          </button>
        </div>

      </div>
    </div>
  )
}
