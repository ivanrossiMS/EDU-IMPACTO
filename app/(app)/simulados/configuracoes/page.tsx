'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Settings, Upload, Image as ImageIcon, Loader2, Save, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function SimuladosConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [uploadingCapa, setUploadingCapa] = useState(false)
  const [uploadingOutras, setUploadingOutras] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [modeloCapaUrl, setModeloCapaUrl] = useState('')
  const [modeloOutrasUrl, setModeloOutrasUrl] = useState('')
  
  const [provasModeloCapaUrl, setProvasModeloCapaUrl] = useState('')
  const [provasModeloOutrasUrl, setProvasModeloOutrasUrl] = useState('')
  
  const [uploadingProvasCapa, setUploadingProvasCapa] = useState(false)
  const [uploadingProvasOutras, setUploadingProvasOutras] = useState(false)
  
  const fileInputCapaRef = useRef<HTMLInputElement>(null)
  const fileInputOutrasRef = useRef<HTMLInputElement>(null)
  const provasFileInputCapaRef = useRef<HTMLInputElement>(null)
  const provasFileInputOutrasRef = useRef<HTMLInputElement>(null)

  const [redacaoCapaUrl, setRedacaoCapaUrl] = useState('')
  const [redacaoOutrasUrl, setRedacaoOutrasUrl] = useState('')
  
  const [uploadingRedacaoCapa, setUploadingRedacaoCapa] = useState(false)
  const [uploadingRedacaoOutras, setUploadingRedacaoOutras] = useState(false)
  
  const redacaoFileInputCapaRef = useRef<HTMLInputElement>(null)
  const redacaoFileInputOutrasRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    async function loadConfig() {
      try {
        const { data, error } = await supabase.from('simulados_configuracoes').select('*').eq('id', 'default').single()
        if (data) {
          if (data.modelo_pdf_url) setModeloCapaUrl(data.modelo_pdf_url)
          if (data.modelo_pdf_outras_paginas_url) setModeloOutrasUrl(data.modelo_pdf_outras_paginas_url)
          if (data.provas_modelo_pdf_url) setProvasModeloCapaUrl(data.provas_modelo_pdf_url)
          if (data.provas_modelo_pdf_outras_paginas_url) setProvasModeloOutrasUrl(data.provas_modelo_pdf_outras_paginas_url)
          if (data.redacao_enem_modelo_pdf_url) setRedacaoCapaUrl(data.redacao_enem_modelo_pdf_url)
          if (data.redacao_enem_modelo_pdf_outras_paginas_url) setRedacaoOutrasUrl(data.redacao_enem_modelo_pdf_outras_paginas_url)

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
        provas_modelo_pdf_url: provasModeloCapaUrl,
        provas_modelo_pdf_outras_paginas_url: provasModeloOutrasUrl,

        redacao_enem_modelo_pdf_url: redacaoCapaUrl,
        redacao_enem_modelo_pdf_outras_paginas_url: redacaoOutrasUrl,

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
      } else if (err.code === 'PGRST204' || err.message?.includes('schema cache')) {
        alert('AVISO: O banco de dados ainda não reconheceu as novas colunas. Por favor, vá no painel do Supabase, entre em Project Settings > API e clique em "Reload schema cache" (ou aguarde alguns minutos e tente novamente).')
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
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {/* Card 1: SIMULADOS */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: '24px 32px 32px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 12, marginBottom: 24 }}>Configurações de Simulado</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
                
                {/* Bloco 1: Capa Simulado */}
                <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={18} color="#3b82f6" />
                    Imagem de Capa
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                    Esta imagem será exibida <b>apenas na primeira página</b> do Simulado.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {modeloCapaUrl ? (
                      <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                        <img src={modeloCapaUrl} alt="Modelo Capa" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600, cursor: uploadingCapa ? 'wait' : 'pointer', fontSize: 13 }}>
                            {uploadingCapa ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            Trocar
                            <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloCapaUrl, setUploadingCapa, fileInputCapaRef)} ref={fileInputCapaRef} disabled={uploadingCapa} />
                          </label>
                          <a href={modeloCapaUrl} target="_blank" download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                            <Download size={16} />
                            Baixar
                          </a>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 150, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingCapa ? 'wait' : 'pointer', transition: 'all 0.2s' }}>
                        {uploadingCapa ? (
                          <>
                            <Loader2 size={24} color="#3b82f6" className="animate-spin" />
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Upload size={20} />
                            </div>
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem</span>
                          </>
                        )}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloCapaUrl, setUploadingCapa, fileInputCapaRef)} ref={fileInputCapaRef} disabled={uploadingCapa} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Bloco 2: Outras Páginas Simulado */}
                <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={18} color="#64748b" />
                    Fundo (Demais Páginas)
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                    Esta imagem será repetida da <b>segunda página em diante</b> no Simulado.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {modeloOutrasUrl ? (
                      <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                        <img src={modeloOutrasUrl} alt="Modelo Outras Páginas" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, cursor: uploadingOutras ? 'wait' : 'pointer', fontSize: 13 }}>
                            {uploadingOutras ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            Trocar
                            <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloOutrasUrl, setUploadingOutras, fileInputOutrasRef)} ref={fileInputOutrasRef} disabled={uploadingOutras} />
                          </label>
                          <a href={modeloOutrasUrl} target="_blank" download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                            <Download size={16} />
                            Baixar
                          </a>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 150, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingOutras ? 'wait' : 'pointer', transition: 'all 0.2s' }}>
                        {uploadingOutras ? (
                          <>
                            <Loader2 size={24} color="#64748b" className="animate-spin" />
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(100,116,139,0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Upload size={20} />
                            </div>
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem (Opcional)</span>
                          </>
                        )}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setModeloOutrasUrl, setUploadingOutras, fileInputOutrasRef)} ref={fileInputOutrasRef} disabled={uploadingOutras} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              </div>

              {/* Card 2: PROVAS */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: '24px 32px 32px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 12, marginBottom: 24 }}>Configurações de Prova</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
                
                {/* Bloco 1: Capa Prova */}
                <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={18} color="#10b981" />
                    Imagem de Capa
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                    Esta imagem será exibida <b>apenas na primeira página</b> da Prova.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {provasModeloCapaUrl ? (
                      <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                        <img src={provasModeloCapaUrl} alt="Modelo Capa Prova" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600, cursor: uploadingProvasCapa ? 'wait' : 'pointer', fontSize: 13 }}>
                            {uploadingProvasCapa ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            Trocar
                            <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setProvasModeloCapaUrl, setUploadingProvasCapa, provasFileInputCapaRef)} ref={provasFileInputCapaRef} disabled={uploadingProvasCapa} />
                          </label>
                          <a href={provasModeloCapaUrl} target="_blank" download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                            <Download size={16} />
                            Baixar
                          </a>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 150, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingProvasCapa ? 'wait' : 'pointer', transition: 'all 0.2s' }}>
                        {uploadingProvasCapa ? (
                          <>
                            <Loader2 size={24} color="#10b981" className="animate-spin" />
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Upload size={20} />
                            </div>
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem</span>
                          </>
                        )}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setProvasModeloCapaUrl, setUploadingProvasCapa, provasFileInputCapaRef)} ref={provasFileInputCapaRef} disabled={uploadingProvasCapa} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Bloco 2: Outras Páginas Prova */}
                <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={18} color="#64748b" />
                    Fundo (Demais Páginas)
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                    Esta imagem será repetida da <b>segunda página em diante</b> na Prova.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {provasModeloOutrasUrl ? (
                      <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                        <img src={provasModeloOutrasUrl} alt="Modelo Outras Páginas Prova" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, cursor: uploadingProvasOutras ? 'wait' : 'pointer', fontSize: 13 }}>
                            {uploadingProvasOutras ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            Trocar
                            <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setProvasModeloOutrasUrl, setUploadingProvasOutras, provasFileInputOutrasRef)} ref={provasFileInputOutrasRef} disabled={uploadingProvasOutras} />
                          </label>
                          <a href={provasModeloOutrasUrl} target="_blank" download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                            <Download size={16} />
                            Baixar
                          </a>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 150, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingProvasOutras ? 'wait' : 'pointer', transition: 'all 0.2s' }}>
                        {uploadingProvasOutras ? (
                          <>
                            <Loader2 size={24} color="#64748b" className="animate-spin" />
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(100,116,139,0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Upload size={20} />
                            </div>
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem (Opcional)</span>
                          </>
                        )}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setProvasModeloOutrasUrl, setUploadingProvasOutras, provasFileInputOutrasRef)} ref={provasFileInputOutrasRef} disabled={uploadingProvasOutras} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              </div>

              {/* Card 3: REDAÇÃO ENEM */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: '24px 32px 32px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 12, marginBottom: 24 }}>Configurações de Redação Enem</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
                
                {/* Bloco 1: Capa Prova */}
                <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={18} color="#10b981" />
                    Imagem de Capa
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                    Esta imagem será exibida <b>apenas na primeira página</b> da Redação Enem.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {redacaoCapaUrl ? (
                      <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                        <img src={redacaoCapaUrl} alt="Modelo Capa Prova" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600, cursor: uploadingRedacaoCapa ? 'wait' : 'pointer', fontSize: 13 }}>
                            {uploadingRedacaoCapa ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            Trocar
                            <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setRedacaoCapaUrl, setUploadingProvasCapa, redacaoFileInputCapaRef)} ref={redacaoFileInputCapaRef} disabled={uploadingRedacaoCapa} />
                          </label>
                          <a href={redacaoCapaUrl} target="_blank" download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                            <Download size={16} />
                            Baixar
                          </a>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 150, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingRedacaoCapa ? 'wait' : 'pointer', transition: 'all 0.2s' }}>
                        {uploadingRedacaoCapa ? (
                          <>
                            <Loader2 size={24} color="#10b981" className="animate-spin" />
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Upload size={20} />
                            </div>
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem</span>
                          </>
                        )}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setRedacaoCapaUrl, setUploadingProvasCapa, redacaoFileInputCapaRef)} ref={redacaoFileInputCapaRef} disabled={uploadingRedacaoCapa} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Bloco 2: Outras Páginas Prova */}
                <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={18} color="#64748b" />
                    Fundo (Demais Páginas)
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                    Esta imagem será repetida da <b>segunda página em diante</b> na Redação Enem.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {redacaoOutrasUrl ? (
                      <div style={{ border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'hsl(var(--bg-app))' }}>
                        <img src={redacaoOutrasUrl} alt="Modelo Outras Páginas Prova" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }} />
                        <div style={{ display: 'flex', gap: 12 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, cursor: uploadingRedacaoOutras ? 'wait' : 'pointer', fontSize: 13 }}>
                            {uploadingRedacaoOutras ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            Trocar
                            <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setRedacaoOutrasUrl, setUploadingProvasOutras, redacaoFileInputOutrasRef)} ref={redacaoFileInputOutrasRef} disabled={uploadingRedacaoOutras} />
                          </label>
                          <a href={redacaoOutrasUrl} target="_blank" download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: '#475569', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                            <Download size={16} />
                            Baixar
                          </a>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 150, border: '2px dashed hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-app))', cursor: uploadingRedacaoOutras ? 'wait' : 'pointer', transition: 'all 0.2s' }}>
                        {uploadingRedacaoOutras ? (
                          <>
                            <Loader2 size={24} color="#64748b" className="animate-spin" />
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(100,116,139,0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Upload size={20} />
                            </div>
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Selecionar Imagem (Opcional)</span>
                          </>
                        )}
                        <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setRedacaoOutrasUrl, setUploadingProvasOutras, redacaoFileInputOutrasRef)} ref={redacaoFileInputOutrasRef} disabled={uploadingRedacaoOutras} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
              <button onClick={handleSave} disabled={saving || (!modeloCapaUrl && !modeloOutrasUrl)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: (saving || (!modeloCapaUrl && !modeloOutrasUrl)) ? 'not-allowed' : 'pointer', opacity: (saving || (!modeloCapaUrl && !modeloOutrasUrl)) ? 0.6 : 1, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar Configurações
              </button>
            </div>
            </div>
            
          </div>
        )}
      </motion.div>
    </div>
  )
}
