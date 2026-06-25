'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Settings, Upload, Image as ImageIcon, Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function SimuladosConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [uploadingCapa, setUploadingCapa] = useState(false)
  const [uploadingOutras, setUploadingOutras] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [modeloCapaUrl, setModeloCapaUrl] = useState('')
  const [modeloOutrasUrl, setModeloOutrasUrl] = useState('')
  
  const fileInputCapaRef = useRef<HTMLInputElement>(null)
  const fileInputOutrasRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadConfig() {
      try {
        const { data, error } = await supabase.from('simulados_configuracoes').select('*').eq('id', 'default').single()
        if (data) {
          if (data.modelo_pdf_url) setModeloCapaUrl(data.modelo_pdf_url)
          if (data.modelo_pdf_outras_paginas_url) setModeloOutrasUrl(data.modelo_pdf_outras_paginas_url)
        }
      } catch (e) {
        // Table might not exist yet
      }
      setLoading(false)
    }
    loadConfig()
  }, [])

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    setUrl: (url: string) => void, 
    setUploadState: (state: boolean) => void,
    inputRef: any
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadState(true)
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
      setUrl(data.url)
      
      if (inputRef.current) inputRef.current.value = ''
    } catch (err: any) {
      console.error(err)
      alert('Erro: ' + err.message)
    } finally {
      setUploadState(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { 
        id: 'default', 
        modelo_pdf_url: modeloCapaUrl, 
        modelo_pdf_outras_paginas_url: modeloOutrasUrl,
        updated_at: new Date().toISOString() 
      }
      
      const { error } = await supabase.from('simulados_configuracoes').upsert(payload)
      
      if (error) {
        throw error
      }
      alert('Configurações salvas com sucesso!')
    } catch (err: any) {
      console.error(err)
      if (err.message?.includes('does not exist') || err.code === '42P01') {
        alert('AVISO: A tabela simulados_configuracoes ainda não existe no Supabase. Por favor, rode o script SQL fornecido no plano para criá-la.')
      } else {
        alert('Erro ao salvar: ' + err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 900, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Configurações do Módulo</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 14 }}>Ajuste os fundos de impressão para as provas e simulados.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader2 className="animate-spin" size={32} color="#3b82f6" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Bloco 1: Capa */}
            <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={20} color="#3b82f6" />
                Imagem de Capa (Primeira Página)
              </h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                Esta imagem será exibida <b>apenas na primeira página</b> do PDF. Idealmente deve conter o cabeçalho completo, logo da escola e os campos para nome do aluno.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {modeloCapaUrl ? (
                  <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                    <img src={modeloCapaUrl} alt="Modelo Capa" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600, cursor: uploadingCapa ? 'wait' : 'pointer', fontSize: 14 }}>
                      {uploadingCapa ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      Trocar Imagem da Capa
                      <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloCapaUrl, setUploadingCapa, fileInputCapaRef)} ref={fileInputCapaRef} disabled={uploadingCapa} />
                    </label>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: 200, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingCapa ? 'wait' : 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'}>
                    {uploadingCapa ? (
                      <>
                        <Loader2 size={32} color="#3b82f6" className="animate-spin" />
                        <span style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando arquivo...</span>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Upload size={24} />
                        </div>
                        <span style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem da Capa (PNG/JPG)</span>
                      </>
                    )}
                    <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloCapaUrl, setUploadingCapa, fileInputCapaRef)} ref={fileInputCapaRef} disabled={uploadingCapa} />
                  </label>
                )}
              </div>
            </div>

            {/* Bloco 2: Outras Páginas */}
            <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={20} color="#64748b" />
                Imagem de Fundo (Demais Páginas)
              </h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                Esta imagem será repetida da <b>segunda página em diante</b>. Deve ser um design mais limpo, sem os campos de nome do aluno, servindo apenas como marca d'água ou borda.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {modeloOutrasUrl ? (
                  <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                    <img src={modeloOutrasUrl} alt="Modelo Outras Páginas" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, cursor: uploadingOutras ? 'wait' : 'pointer', fontSize: 14 }}>
                      {uploadingOutras ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      Trocar Imagem de Fundo
                      <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloOutrasUrl, setUploadingOutras, fileInputOutrasRef)} ref={fileInputOutrasRef} disabled={uploadingOutras} />
                    </label>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: 200, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingOutras ? 'wait' : 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#64748b'} onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'}>
                    {uploadingOutras ? (
                      <>
                        <Loader2 size={32} color="#64748b" className="animate-spin" />
                        <span style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando arquivo...</span>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(100,116,139,0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Upload size={24} />
                        </div>
                        <span style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem de Fundo (Opcional)</span>
                      </>
                    )}
                    <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloOutrasUrl, setUploadingOutras, fileInputOutrasRef)} ref={fileInputOutrasRef} disabled={uploadingOutras} />
                  </label>
                )}
              </div>
            </div>

            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
              <button onClick={handleSave} disabled={saving || (!modeloCapaUrl && !modeloOutrasUrl)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: (saving || (!modeloCapaUrl && !modeloOutrasUrl)) ? 'not-allowed' : 'pointer', opacity: (saving || (!modeloCapaUrl && !modeloOutrasUrl)) ? 0.6 : 1, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar Configurações
              </button>
            </div>
            
          </div>
        )}
      </motion.div>
    </div>
  )
}

