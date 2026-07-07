'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PDFDocument } from 'pdf-lib'
import { useApp } from '@/lib/context'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, FileDown, Loader2, ArrowLeft, Trash2, FolderArchive, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface ScanPage {
  id: string
  file: File
  previewUrl: string
}

export default function ScannerPage() {
  const { currentUserPerfil, currentUser } = useApp()
  const router = useRouter()
  const [pages, setPages] = useState<ScanPage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  
  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [anoLetivo, setAnoLetivo] = useState(new Date().getFullYear().toString())
  const [turma, setTurma] = useState('')
  const [alunoSearch, setAlunoSearch] = useState('')
  const [alunosList, setAlunosList] = useState<any[]>([])
  const [selectedAluno, setSelectedAluno] = useState<any>(null)
  
  // Bimestres
  const [bimestre, setBimestre] = useState('')
  const [bimestresList, setBimestresList] = useState<any[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentUserPerfil === 'professor') {
      router.push('/simulados')
    }
  }, [currentUserPerfil, router])

  // Busca alunos para o select
  useEffect(() => {
    const fetchAlunos = async () => {
      if (alunoSearch.length < 2) {
        setAlunosList([])
        return
      }
      try {
        const res = await fetch('/api/alunos?lightweight=true&search=' + encodeURIComponent(alunoSearch) + '&limit=10')
        if (res.ok) {
          const json = await res.json()
          setAlunosList(json.data || [])
        }
      } catch (err) {
        console.error(err)
      }
    }
    
    const timeout = setTimeout(fetchAlunos, 300)
    return () => clearTimeout(timeout)
  }, [alunoSearch])

  // Busca bimestres
  useEffect(() => {
    const fetchBimestres = async () => {
      try {
        const { data } = await supabase.from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome')
        setBimestresList(data || [])
      } catch (err) {
        console.error(err)
      }
    }
    fetchBimestres()
  }, [])

  const handleSelectAluno = (aluno: any) => {
    setSelectedAluno(aluno)
    setAlunoSearch(aluno.nome)
    
    // Auto-preencher turma
    if (aluno.turma_nome || aluno.turma) {
      setTurma(aluno.turma_nome || aluno.turma)
    }
    
    // Auto-preencher ano letivo buscando dentro de 'dados' ou fallback
    const ano = aluno.turma_anoLetivo || aluno.dados?.anoLetivo || aluno.ano_letivo || aluno.anoLetivo || new Date().getFullYear().toString()
    setAnoLetivo(ano)
    
    setAlunosList([])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const newFiles = Array.from(e.target.files)
    const newPages = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file)
    }))
    setPages(prev => [...prev, ...newPages])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const removePage = (idToRemove: string) => {
    setPages(prev => {
      const page = prev.find(p => p.id === idToRemove)
      if (page) URL.revokeObjectURL(page.previewUrl)
      return prev.filter(p => p.id !== idToRemove)
    })
  }

  const movePage = (index: number, direction: 'up' | 'down') => {
    setPages(prev => {
      const newPages = [...prev]
      if (direction === 'up' && index > 0) {
        ;[newPages[index - 1], newPages[index]] = [newPages[index], newPages[index - 1]]
      } else if (direction === 'down' && index < newPages.length - 1) {
        ;[newPages[index + 1], newPages[index]] = [newPages[index], newPages[index + 1]]
      }
      return newPages
    })
  }

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_DIMENSION = 1600
        let { width, height } = img

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width
            width = MAX_DIMENSION
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height
            height = MAX_DIMENSION
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas context not available'))

        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', 0.65))
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (pages.length === 0) return null
    try {
      const pdfDoc = await PDFDocument.create()
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        try {
          const compressedBase64 = await compressImage(page.file)
          const imageBytes = Uint8Array.from(atob(compressedBase64.split(',')[1]), c => c.charCodeAt(0))
          const image = await pdfDoc.embedJpg(imageBytes)
          const A4_WIDTH = 595.28
          const A4_HEIGHT = 841.89
          const pdfPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
          const MARGIN = 20
          const availableWidth = A4_WIDTH - (MARGIN * 2)
          const availableHeight = A4_HEIGHT - (MARGIN * 2)

          let imgWidth = image.width
          let imgHeight = image.height
          const widthRatio = availableWidth / imgWidth
          const heightRatio = availableHeight / imgHeight
          const ratio = Math.min(widthRatio, heightRatio)
          
          const drawWidth = imgWidth * ratio
          const drawHeight = imgHeight * ratio
          const x = (A4_WIDTH - drawWidth) / 2
          const y = (A4_HEIGHT - drawHeight) / 2
          
          pdfPage.drawImage(image, { x, y, width: drawWidth, height: drawHeight })
        } catch (err) {
          console.error("Erro ao processar imagem da página " + (i+1), err)
        }
      }
      const pdfBytes = await pdfDoc.save()
      return new Blob([pdfBytes], { type: 'application/pdf' })
    } catch (err) {
      console.error(err)
      return null
    }
  }

  const handleDownload = async () => {
    setIsProcessing(true)
    toast.info('Iniciando otimização para download...')
    try {
      const blob = await generatePDFBlob()
      if (!blob) throw new Error('Não foi possível gerar o PDF')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Prova_Digitalizada_${new Date().getTime()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDF gerado e baixado com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAluno || !turma || !anoLetivo || !titulo) {
      toast.error('Preencha todos os campos corretamente.')
      return
    }

    setIsArchiving(true)
    toast.info('Gerando e arquivando PDF...')
    
    try {
      const blob = await generatePDFBlob()
      if (!blob) throw new Error('Falha ao gerar o arquivo PDF.')

      const fileName = `adaptadas_${selectedAluno.id}_${new Date().getTime()}.pdf`
      const file = new File([blob], fileName, { type: 'application/pdf' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'comunicados-midia')

      const uploadRes = await fetch('/api/upload-midia', {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) {
        const errData = await uploadRes.json()
        throw new Error(errData.error || 'Erro ao enviar arquivo para nuvem.')
      }

      const { url, size } = await uploadRes.json()

      const { data: dbData, error: dbError } = await supabase.from('arquivos_adaptadas').insert({
        aluno_id: selectedAluno.id,
        turma,
        ano_letivo: anoLetivo,
        titulo,
        bimestre,
        tamanho_bytes: size || 0,
        file_url: url,
        criado_por: currentUser?.id || null
      })

      if (dbError) {
        console.error('SUPABASE DB ERROR:', JSON.stringify(dbError, null, 2))
        throw new Error(dbError.message || 'Erro no banco de dados')
      }

      toast.success('Arquivo salvo e vinculado ao aluno com sucesso!')
      setShowModal(false)
      router.push('/simulados/arquivo-adaptadas')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao arquivar: ' + err.message)
    } finally {
      setIsArchiving(false)
    }
  }

  if (currentUserPerfil === 'professor') return null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <Link href="/simulados/arquivo-adaptadas">
          <motion.div 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid hsl(var(--border-subtle))' }}
          >
            <ArrowLeft size={20} color="hsl(var(--text-secondary))" />
          </motion.div>
        </Link>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Scanner de Provas</h1>
          <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', margin: '4px 0 0 0' }}>Tire fotos e gere PDFs otimizados para baixar ou arquivar na ficha do aluno.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>
        <input type="file" accept="image/*" capture="environment" multiple ref={cameraInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
        <input type="file" accept="image/*" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => cameraInputRef.current?.click()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, borderRadius: 20, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(37,99,235,0.4)' }}
        >
          <Camera size={40} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Tirar Foto</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, borderRadius: 20, background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', border: '2px dashed hsl(var(--border-subtle))', cursor: 'pointer' }}
        >
          <ImagePlus size={40} color="hsl(var(--text-secondary))" />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Escolher Arquivos</span>
        </motion.button>
      </div>

      {pages.length > 0 ? (
        <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: 24, border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'hsl(var(--text-primary))' }}>
              Páginas ({pages.length})
            </h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDownload} disabled={isProcessing || isArchiving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-primary))', fontWeight: 700, border: '1px solid hsl(var(--border-subtle))', cursor: (isProcessing || isArchiving) ? 'not-allowed' : 'pointer' }}
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />} Baixar PDF
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowModal(true)} disabled={isProcessing || isArchiving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: '#10b981', color: 'white', fontWeight: 700, border: 'none', cursor: (isProcessing || isArchiving) ? 'not-allowed' : 'pointer' }}
              >
                <FolderArchive size={18} /> Arquivar no Aluno
              </motion.button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            <AnimatePresence>
              {pages.map((page, index) => (
                <motion.div
                  key={page.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} layout
                  style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', aspectRatio: '1 / 1.414', background: '#f8fafc' }}
                >
                  <img src={page.previewUrl} alt={`Página ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', padding: '2px 8px', borderRadius: 12, color: 'white', fontSize: 12, fontWeight: 700 }}>{index + 1}</div>
                      <button onClick={() => removePage(page.id)} style={{ background: 'rgba(239,68,68,0.8)', border: 'none', color: 'white', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={12} /></button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                      <button onClick={() => movePage(index, 'up')} disabled={index === 0} style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: 'none', color: 'white', width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.5 : 1 }}><ArrowLeft size={16} /></button>
                      <button onClick={() => movePage(index, 'down')} disabled={index === pages.length - 1} style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: 'none', color: 'white', width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: index === pages.length - 1 ? 'not-allowed' : 'pointer', opacity: index === pages.length - 1 ? 0.5 : 1 }}><ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-secondary))', border: '2px dashed hsl(var(--border-subtle))', borderRadius: 24 }}>
          <ImagePlus size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'hsl(var(--text-primary))' }}>Nenhuma página adicionada</h3>
          <p style={{ margin: 0, fontSize: 14 }}>Tire fotos com seu celular ou faça upload para gerar um PDF.</p>
        </div>
      )}

      {/* Modal de Arquivamento */}
      <AnimatePresence>
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, width: '100%', maxWidth: 500, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
              <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'hsl(var(--bg-elevated))', border: 'none', width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-secondary))' }}>
                <X size={18} />
              </button>
              
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 24px 0', color: 'hsl(var(--text-primary))' }}>Arquivar no Aluno</h2>
              
              <form onSubmit={handleArchive} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Buscar Aluno</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="Digite o nome do aluno..." value={alunoSearch} onChange={e => { setAlunoSearch(e.target.value); setSelectedAluno(null); }} required={!selectedAluno} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-body))', color: 'hsl(var(--text-primary))', outline: 'none' }} />
                    {alunosList.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                        {alunosList.map(al => (
                          <div key={al.id} onClick={() => handleSelectAluno(al)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{al.nome}</div>
                            {(al.turma_nome || al.turma) && <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{al.turma_nome || al.turma}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Ano Letivo</label>
                    <input type="text" value={anoLetivo} onChange={e => setAnoLetivo(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-body))', color: 'hsl(var(--text-primary))', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Turma</label>
                    <input type="text" value={turma} onChange={e => setTurma(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-body))', color: 'hsl(var(--text-primary))', outline: 'none' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Título do Arquivo</label>
                  <input type="text" placeholder="Ex: Prova de Matemática - 1º Bimestre" value={titulo} onChange={e => setTitulo(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-body))', color: 'hsl(var(--text-primary))', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Bimestre / Ciclo</label>
                  <select value={bimestre} onChange={e => setBimestre(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-body))', color: 'hsl(var(--text-primary))', outline: 'none' }}>
                    <option value="" disabled>Selecione um bimestre</option>
                    {bimestresList.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.nome} ({b.ano_letivo})</option>
                    ))}
                  </select>
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isArchiving || !selectedAluno} style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 700, border: 'none', cursor: (isArchiving || !selectedAluno) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, opacity: selectedAluno ? 1 : 0.5 }}>
                  {isArchiving ? <Loader2 size={20} className="animate-spin" /> : <FolderArchive size={20} />}
                  {isArchiving ? 'Salvando...' : 'Salvar e Arquivar'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
