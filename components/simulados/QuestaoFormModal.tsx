'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function QuestaoFormModal({ simuladoId, questao, onClose, onSave }: { simuladoId: string, questao?: any, onClose: () => void, onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  
  const [idDisciplina, setIdDisciplina] = useState(questao?.id_disciplina || '')
  const [dificuldade, setDificuldade] = useState(questao?.dificuldade || 'media')
  const [enunciado, setEnunciado] = useState(questao?.enunciado || '')
  const [imagemUrl, setImagemUrl] = useState('')
  
  // Opções: A, B, C, D, E
  const [alternativas, setAlternativas] = useState<any[]>(() => {
    if (questao?.simulados_alternativas?.length > 0) {
      return questao.simulados_alternativas.sort((a: any, b: any) => a.letra.localeCompare(b.letra))
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
    async function loadConfig() {
      const { data } = await supabase.from('simulados_disciplinas').select('*')
      if (data) setDisciplinas(data)
    }
    loadConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let finalEnunciado = enunciado
      if (imagemUrl) {
        finalEnunciado += `<br/><br/><img src="${imagemUrl}" style="max-width:100%; border-radius:8px;" alt="Imagem da questão"/>`
      }

      const questaoData = {
        id_simulado: simuladoId,
        id_disciplina: idDisciplina || null,
        enunciado: finalEnunciado,
        dificuldade,
        tipo_questao: 'multipla_escolha',
        ordem: questao?.ordem || 0,
        peso: questao?.peso || 1.00
      }

      let qId = questao?.id

      if (qId) {
        // Update
        await supabase.from('simulados_questoes').update(questaoData).eq('id', qId)
      } else {
        // Insert
        const { data: newQ, error: errQ } = await supabase.from('simulados_questoes').insert(questaoData).select().single()
        if (errQ) throw errQ
        qId = newQ.id
      }

      // Save alternativas
      // Delete old ones first
      if (questao?.id) {
        await supabase.from('simulados_alternativas').delete().eq('id_questao', qId)
      }

      const altsData = alternativas.filter(a => a.texto.trim() !== '').map(a => ({
        id_questao: qId,
        letra: a.letra,
        texto: a.texto,
        correta: a.correta
      }))

      if (altsData.length > 0) {
        await supabase.from('simulados_alternativas').insert(altsData)
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
      // make others false
      newAlts.forEach(a => a.correta = false)
    }
    newAlts[index] = { ...newAlts[index], [field]: value }
    setAlternativas(newAlts)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 20, width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
            {questao ? 'Editar Questão' : 'Nova Questão'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          <form id="questao-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Disciplina</label>
                <select value={idDisciplina} onChange={e => setIdDisciplina(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))' }}>
                  <option value="">Selecione...</option>
                  {disciplinas.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Dificuldade</label>
                <select value={dificuldade} onChange={e => setDificuldade(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))' }}>
                  <option value="facil">Fácil</option>
                  <option value="media">Média</option>
                  <option value="dificil">Difícil</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Enunciado da Questão</label>
              <textarea 
                value={enunciado} 
                onChange={e => setEnunciado(e.target.value)} 
                required 
                rows={4}
                placeholder="Escreva a pergunta aqui..."
                style={{ width: '100%', padding: '16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>
                <ImageIcon size={16} /> URL da Imagem de Apoio (Opcional)
              </label>
              <input 
                type="url" 
                value={imagemUrl} 
                onChange={e => setImagemUrl(e.target.value)} 
                placeholder="https://exemplo.com/imagem.png"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))' }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
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

        <div style={{ padding: '24px 32px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'transparent', color: 'hsl(var(--text-primary))', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" form="questao-form" disabled={loading} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Salvando...' : 'Salvar Questão'}
          </button>
        </div>

      </div>
    </div>
  )
}
