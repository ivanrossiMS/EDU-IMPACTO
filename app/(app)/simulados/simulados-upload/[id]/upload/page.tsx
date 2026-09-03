'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Loader2,
  Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Image as ImageIcon,
  Save, RefreshCw, Sparkles, Plus, X, Printer, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Calendar, Clock, Users, Download, BookOpen
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { PaginationEngine } from '@/components/simulados/PaginationEngine'
import { HtmlContent } from '@/components/HtmlContent'

import { SimuladoPreviewModal, Questao, Alternative } from '@/components/simulados/SimuladoPreviewModal'
import { formatProfessorHeaderName, downloadOriginalFile } from '@/lib/utils'
import { QuestoesEditor } from '@/components/simulados/QuestoesEditor'

export default function UploadSimuladoPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const simuladoId = params.id as string
  const { currentUser } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const isProfessorViewAll = currentUser?.perfil === 'Professor' && searchParams.get('all') === 'true'

  const [simulado, setSimulado] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [alertModal, setAlertModal] = useState({ open: false, message: '' })
  const [questoes, setQuestoes] = useState<Questao[]>([])
  const [uploadStep, setUploadStep] = useState<'idle' | 'parsing' | 'review' | 'saved'>('idle')
  const [parseError, setParseError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [arquivoOriginal, setArquivoOriginal] = useState<{ url: string; nome: string; tamanho?: number; id_requisicao?: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showPreviewIsolated, setShowPreviewIsolated] = useState(false)
  const [simConfig, setSimConfig] = useState<any>(null)

  const targetReqId = searchParams.get('req')
  const targetDiscId = searchParams.get('disc')
  const targetProfId = searchParams.get('prof')
  const showAll = searchParams.get('all') === 'true'

  useEffect(() => {
    loadSimulado()
    loadConfig()
  }, [simuladoId, targetReqId, targetDiscId, targetProfId, showAll])

  const loadConfig = async () => {
    const { data } = await (supabase as any).from('simulados_configuracoes').select('*').eq('id', 'default').single()
    if (data) setSimConfig(data)
  }

  // Active requisition computation
  const activeRequisicao = useMemo(() => {
    if (!simulado?.simulados_upload_requisicoes || simulado.simulados_upload_requisicoes.length === 0) return null
    if (showAll) return null

    const reqs = simulado.simulados_upload_requisicoes

    if (targetReqId) {
      const found = reqs.find((r: any) => r.id === targetReqId)
      if (found) return found
    }
    if (targetDiscId) {
      const found = reqs.find((r: any) => (r.id_disciplina === targetDiscId || r.disciplina_nome === targetDiscId) && (!targetProfId || r.id_professor === targetProfId))
      if (found) return found
    }
    if (currentUser?.perfil === 'Professor') {
      const myReqs = reqs.filter((r: any) => r.id_professor === currentUser.id)
      if (myReqs.length > 0) {
        return myReqs.find((r: any) => r.status === 'pendente') || myReqs[0]
      }
    }
    if (targetProfId) {
      const found = reqs.find((r: any) => r.id_professor === targetProfId)
      if (found) return found
    }

    return reqs[0] || null
  }, [simulado, targetReqId, targetDiscId, targetProfId, showAll, currentUser])

  // Requisitions relevant to current user
  const userRelevantRequisicoes = useMemo(() => {
    if (!simulado?.simulados_upload_requisicoes) return []
    if (currentUser?.perfil === 'Professor') {
      return simulado.simulados_upload_requisicoes.filter((r: any) => r.id_professor === currentUser.id)
    }
    return simulado.simulados_upload_requisicoes
  }, [simulado, currentUser])

  const loadSimulado = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any).from('simulados_upload').select('*').eq('id', simuladoId).single()
      if (error) throw error

      const { data: reqs } = await (supabase as any).from('simulados_upload_requisicoes').select('*').eq('id_simulado_upload', simuladoId)
      
      const formattedDisciplinas = Array.from(new Set(reqs?.map((r: any) => r.simulados_disciplinas?.nome || r.disciplina_nome || ''))).filter(Boolean).join(', ')
      const formattedProfessors = Array.from(new Set(reqs?.map((r: any) => {
        const nome = r.professores?.nome || r.professor_nome || '';
        return nome ? formatProfessorHeaderName(nome) : '';
      }))).filter(Boolean).join(', ')
      const formattedDate = data?.data_aplicacao ? data.data_aplicacao.split('-').reverse().join('/') : '____ / ____ / ________'
      const formattedSeries = Array.isArray(data?.series) ? data.series.join(', ') : (data?.series || '')

      const simuladoData = { 
        ...data, 
        simulados_upload_requisicoes: reqs || [],
        formattedDisciplinas,
        formattedProfessors,
        formattedDate,
        formattedSeries,
        isSimulado: true
      }
      setSimulado(simuladoData)

      // Determine active requisition for initial selection
      let currentActiveReq: any = null
      if (!showAll && reqs && reqs.length > 0) {
        if (targetReqId) {
          currentActiveReq = reqs.find((r: any) => r.id === targetReqId)
        } else if (targetDiscId) {
          currentActiveReq = reqs.find((r: any) => (r.id_disciplina === targetDiscId || r.disciplina_nome === targetDiscId) && (!targetProfId || r.id_professor === targetProfId))
        } else if (currentUser?.perfil === 'Professor') {
          const myReqs = reqs.filter((r: any) => r.id_professor === currentUser.id)
          currentActiveReq = myReqs.find((r: any) => r.status === 'pendente') || myReqs[0]
        } else if (targetProfId) {
          currentActiveReq = reqs.find((r: any) => r.id_professor === targetProfId)
        } else {
          currentActiveReq = reqs[0]
        }
      }

      // Look for original file in config_estudio specifically for this active requisition
      const arquivosList: any[] = Array.isArray(data?.config_estudio?.arquivos_originais) ? data.config_estudio.arquivos_originais : []
      let matchedArquivo: any = null

      if (currentActiveReq) {
        matchedArquivo = arquivosList.find((a: any) => 
          (a.id_requisicao && a.id_requisicao === currentActiveReq.id) ||
          (!a.id_requisicao && a.id_disciplina && a.id_disciplina === currentActiveReq.id_disciplina && (!a.id_professor || a.id_professor === currentActiveReq.id_professor))
        )
      } else if (showAll) {
        matchedArquivo = arquivosList[0] || null
      }

      if (matchedArquivo) {
        setArquivoOriginal(matchedArquivo)
      } else {
        setArquivoOriginal(null)
      }

      // Load questions strictly matching active requisition (or all if showAll)
      const allQuestions = Array.isArray(simuladoData?.questoes_json) ? simuladoData.questoes_json : []
      if (allQuestions.length > 0) {
        let filteredQs: any[] = []

        if (showAll) {
          filteredQs = allQuestions
        } else if (currentActiveReq) {
          filteredQs = allQuestions.filter((q: any) => {
            if (q.id_requisicao) {
              return q.id_requisicao === currentActiveReq.id
            }
            // Legacy match by discipline and professor
            const discMatch = (q.id_disciplina && (q.id_disciplina === currentActiveReq.id_disciplina || q.disciplina_id === currentActiveReq.id_disciplina)) ||
                              (q.disciplina_nome && currentActiveReq.disciplina_nome && q.disciplina_nome.trim().toLowerCase() === currentActiveReq.disciplina_nome.trim().toLowerCase()) ||
                              (q.disciplina && currentActiveReq.disciplina_nome && q.disciplina.trim().toLowerCase() === currentActiveReq.disciplina_nome.trim().toLowerCase())
            const profMatch = !q.id_professor || q.id_professor === currentActiveReq.id_professor
            return Boolean(discMatch && profMatch)
          })
        }

        if (filteredQs.length > 0) {
          setQuestoes(filteredQs.map((q: any, i: number) => ({ ...q, expandido: true, numero: i + 1 })))
          setUploadStep('review')
        } else {
          setQuestoes([])
          setUploadStep('idle')
        }
      } else {
        setQuestoes([])
        setUploadStep('idle')
      }
      
      if (searchParams.get('print') === 'true') {
        setShowPreviewIsolated(true)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const switchDiscipline = (req: any) => {
    if (!req) return
    router.push(`/simulados/simulados-upload/${simuladoId}/upload?req=${req.id}&prof=${req.id_professor || ''}&disc=${req.id_disciplina || ''}`)
  }

  const handleFile = async (file: File) => {
    const allowed = ['.doc', '.docx']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(ext)) {
      setParseError('Formato não suportado. Use apenas .docx')
      return
    }
    setFileName(file.name)
    setParseError('')
    setUploading(true)
    setUploadStep('parsing')

    try {
      const targetReq = activeRequisicao?.id || targetReqId || ''
      const targetProf = activeRequisicao?.id_professor || targetProfId || currentUser?.id || ''
      const targetDisc = activeRequisicao?.id_disciplina || targetDiscId || ''

      const fd = new FormData()
      fd.append('file', file)
      fd.append('itemId', simuladoId)
      fd.append('itemTipo', 'simulado')
      if (targetReq) fd.append('reqId', targetReq)
      if (targetDisc) fd.append('discId', targetDisc)
      if (targetProf) fd.append('profId', targetProf)

      const res = await fetch('/api/simulados-upload/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) {
        setParseError(data.error || 'Erro ao processar arquivo.')
        setUploadStep('idle')
        return
      }

      if (data.arquivoUrl) {
        setArquivoOriginal({
          url: data.arquivoUrl,
          nome: data.arquivoNome || file.name,
          tamanho: data.arquivoTamanho || file.size,
          id_requisicao: targetReq || undefined
        })
      }

      const parsed: Questao[] = (data.questoes || []).map((q: any, i: number) => ({
        ...q,
        expandido: true,
        numero: i + 1,
        id_requisicao: targetReq || undefined,
        id_disciplina: targetDisc || undefined,
        disciplina_id: targetDisc || undefined,
        disciplina_nome: activeRequisicao?.disciplina_nome || q.disciplina_nome || undefined,
        disciplina: activeRequisicao?.disciplina_nome || q.disciplina || undefined,
        id_professor: targetProf || undefined,
        professor_nome: activeRequisicao?.professor_nome || q.professor_nome || undefined
      }))

      setQuestoes(parsed)
      setUploadStep('review')
    } catch (e: any) {
      setParseError('Falha ao comunicar com o servidor: ' + e.message)
      setUploadStep('idle')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleSave = async (updatedQuestoes?: any[], actionType?: 'enviar_revisao' | 'aprovar', config_estudio?: any) => {
    const currentQs = Array.isArray(updatedQuestoes) ? updatedQuestoes : questoes;

    // Validate limit for active requisition
    if (currentUser?.perfil === 'Professor' && activeRequisicao) {
      if (currentQs.length > activeRequisicao.qtd_questoes) {
        setAlertModal({ 
          open: true, 
          message: `Você não pode salvar. Estão liberadas apenas ${activeRequisicao.qtd_questoes} questões para ${activeRequisicao.disciplina_nome || 'esta disciplina'}. Edite ou exclua algumas questões para prosseguir.` 
        });
        return;
      }
      if (actionType === 'enviar_revisao' && currentQs.length < activeRequisicao.qtd_questoes) {
        setAlertModal({ 
          open: true, 
          message: `Você só pode enviar para revisão quando completar todas as ${activeRequisicao.qtd_questoes} questões de ${activeRequisicao.disciplina_nome || 'esta disciplina'}. Faltam ${activeRequisicao.qtd_questoes - currentQs.length} questões.` 
        });
        return;
      }
    }

    setSaving(true)
    try {
      // 1. Fetch latest questions and config from DB to preserve all other disciplines
      const { data: dbData } = await (supabase as any).from('simulados_upload').select('questoes_json, config_estudio').eq('id', simuladoId).single()
      const dbQuestions: any[] = Array.isArray(dbData?.questoes_json) ? dbData.questoes_json : []

      // 2. Filter out ONLY questions belonging to the active requisition
      let otherQuestions: any[] = []
      if (!showAll && activeRequisicao) {
        otherQuestions = dbQuestions.filter((q: any) => {
          if (q.id_requisicao) {
            return q.id_requisicao !== activeRequisicao.id
          }
          // Legacy check
          const discMatch = (q.id_disciplina && (q.id_disciplina === activeRequisicao.id_disciplina || q.disciplina_id === activeRequisicao.id_disciplina)) ||
                            (q.disciplina_nome && activeRequisicao.disciplina_nome && q.disciplina_nome.trim().toLowerCase() === activeRequisicao.disciplina_nome.trim().toLowerCase()) ||
                            (q.disciplina && activeRequisicao.disciplina_nome && q.disciplina.trim().toLowerCase() === activeRequisicao.disciplina_nome.trim().toLowerCase())
          const profMatch = !q.id_professor || q.id_professor === activeRequisicao.id_professor
          if (discMatch && profMatch) return false
          return true
        })
      }

      // 3. Tag and prepare our active questions
      const myQuestionsToSave = currentQs.map(({ expandido, ...q }) => {
        const profId = activeRequisicao?.id_professor || targetProfId || (currentUser?.perfil === 'Professor' ? currentUser.id : q.id_professor)
        const profNome = activeRequisicao?.professor_nome || q.professor_nome || (currentUser?.perfil === 'Professor' ? currentUser.nome : '')
        const discId = activeRequisicao?.id_disciplina || targetDiscId || q.id_disciplina
        const discNome = activeRequisicao?.disciplina_nome || q.disciplina_nome || q.disciplina || ''

        return {
          ...q,
          id_professor: profId,
          professor_nome: profNome,
          id_requisicao: activeRequisicao?.id || targetReqId || q.id_requisicao,
          id_disciplina: discId,
          disciplina_id: discId,
          disciplina_nome: discNome,
          disciplina: discNome
        }
      })

      // 4. Merge preserved other questions with our updated active questions
      const finalQToSave = showAll ? myQuestionsToSave : [...otherQuestions, ...myQuestionsToSave]

      // 5. Merge config_estudio with original file list
      let currentConfig = dbData?.config_estudio || simulado?.config_estudio || {}
      let currentArquivos: any[] = Array.isArray(currentConfig.arquivos_originais) ? [...currentConfig.arquivos_originais] : []

      if (arquivoOriginal?.url && activeRequisicao) {
        currentArquivos = currentArquivos.filter((a: any) => a.id_requisicao !== activeRequisicao.id)
        currentArquivos.push({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          url: arquivoOriginal.url,
          nome: arquivoOriginal.nome,
          tamanho: arquivoOriginal.tamanho,
          id_requisicao: activeRequisicao.id,
          id_disciplina: activeRequisicao.id_disciplina || null,
          id_professor: activeRequisicao.id_professor || null,
          uploaded_at: new Date().toISOString()
        })
      }

      let updatePayload: any = {
        questoes_json: finalQToSave,
        questoes_count: finalQToSave.filter((q: any) => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio).length,
        config_estudio: {
          ...currentConfig,
          ...(config_estudio || {}),
          arquivos_originais: currentArquivos,
          ...(arquivoOriginal?.url ? {
            arquivo_original_url: arquivoOriginal.url,
            arquivo_original_nome: arquivoOriginal.nome,
            arquivo_original_tamanho: arquivoOriginal.tamanho
          } : {})
        },
        updated_at: new Date().toISOString(),
      }

      if (actionType === 'aprovar') {
        updatePayload.status = 'aprovado'
      } else if (actionType === 'enviar_revisao') {
        updatePayload.status = 'em_revisao'
      }

      const { error } = await (supabase as any).from('simulados_upload').update(updatePayload).eq('id', simuladoId)

      // 6. Update requisition status
      if (actionType === 'enviar_revisao' && activeRequisicao) {
        await (supabase as any).from('simulados_upload_requisicoes').update({
          status: 'enviado',
          enviado_em: new Date().toISOString()
        }).eq('id', activeRequisicao.id)
      } else if (actionType === 'aprovar') {
        if (showAll) {
          await (supabase as any).from('simulados_upload_requisicoes').update({
            status: 'aprovado'
          }).eq('id_simulado_upload', simuladoId)
        } else if (activeRequisicao) {
          await (supabase as any).from('simulados_upload_requisicoes').update({
            status: 'aprovado'
          }).eq('id', activeRequisicao.id)
        }
      }

      if (error) throw error

      await loadSimulado()
      setSuccessModal(true)
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 12 }}>
        <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite' }} color="#8b5cf6" />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="upload-page-container" style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes neonPulse {
          0% {
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.6), 0 0 25px rgba(139, 92, 246, 0.35), inset 0 0 10px rgba(139, 92, 246, 0.15);
            border-color: #8b5cf6;
          }
          50% {
            box-shadow: 0 0 22px rgba(217, 70, 239, 0.95), 0 0 45px rgba(217, 70, 239, 0.55), inset 0 0 16px rgba(217, 70, 239, 0.25);
            border-color: #d946ef;
          }
          100% {
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.6), 0 0 25px rgba(139, 92, 246, 0.35), inset 0 0 10px rgba(139, 92, 246, 0.15);
            border-color: #8b5cf6;
          }
        }
        .neon-active-card {
          animation: neonPulse 1.8s infinite ease-in-out !important;
          position: relative;
          z-index: 2;
        }
        .alt-row:hover { background: rgba(139,92,246,0.04) !important; }
        .questao-card:hover { border-color: rgba(139,92,246,0.3) !important; }
        
        @media (max-width: 900px) {
          .upload-page-container {
            padding: 16px 12px !important;
          }
          .upload-header-flex {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .upload-header-actions {
            width: 100% !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            justify-content: stretch !important;
          }
          .upload-header-actions button, .upload-header-actions a {
            flex: 1 1 calc(50% - 8px) !important;
            min-width: 130px !important;
            justify-content: center !important;
            text-align: center !important;
            white-space: nowrap !important;
            padding: 10px 12px !important;
            font-size: 12px !important;
          }
          .upload-main-grid {
            grid-template-columns: 1fr !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 20px !important;
          }
          .upload-tips-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="upload-header-flex" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/simulados/simulados-upload"
            style={{ width: 44, height: 44, borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', textDecoration: 'none', flexShrink: 0, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
                {simulado?.titulo || 'Envio de Simulado'}
              </h1>
              {activeRequisicao && (
                <span style={{
                  padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                  background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)',
                  display: 'inline-flex', alignItems: 'center', gap: 6
                }}>
                  <BookOpen size={13} /> {activeRequisicao.disciplina_nome} ({activeRequisicao.qtd_questoes} questões)
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {simulado?.data_aplicacao && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  <Calendar size={14} color="#8b5cf6" /> Aplicação: {simulado.data_aplicacao.split('-').reverse().join('/')}
                </div>
              )}
              {simulado?.data_limite_upload && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  <Clock size={14} color="#f59e0b" /> Prazo: {simulado.data_limite_upload.split('-').reverse().join('/')}
                </div>
              )}
            </div>
          </div>
        </div>

        {uploadStep === 'review' && (
          <div className="upload-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

            {arquivoOriginal?.url && (
              <motion.button 
                onClick={() => downloadOriginalFile(arquivoOriginal.url, arquivoOriginal.nome)}
                whileHover={{ scale: 1.04 }} 
                whileTap={{ scale: 0.96 }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '10px 18px', 
                  borderRadius: 12, 
                  background: 'rgba(59, 130, 246, 0.08)', 
                  color: '#2563eb', 
                  border: '1px solid rgba(59, 130, 246, 0.3)', 
                  fontSize: 13, 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  whiteSpace: 'nowrap'
                }}
                title={`Baixar arquivo original (${arquivoOriginal.nome})`}
              >
                <Download size={16} color="#2563eb" /> Baixar DOCX ({activeRequisicao?.disciplina_nome || 'Original'})
              </motion.button>
            )}

            {!isProfessorViewAll && (
              <motion.button onClick={() => { setUploadStep('idle'); setQuestoes([]) }}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-subtle))', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', whiteSpace: 'nowrap' }}>
                <RefreshCw size={16} color="#64748b" /> Reenviar Arquivo
              </motion.button>
            )}
            <motion.button onClick={() => {
              if (!isProfessorViewAll && currentUser?.perfil === 'Professor' && activeRequisicao && questoes.length > activeRequisicao.qtd_questoes) {
                setAlertModal({ open: true, message: `Você não pode pré-visualizar. Estão liberadas apenas ${activeRequisicao.qtd_questoes} questões para ${activeRequisicao.disciplina_nome || 'esta disciplina'}. Edite ou exclua algumas questões para acessar.` });
                return;
              }
              setShowPreview(true);
            }}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', whiteSpace: 'nowrap' }}>
              <Printer size={16} color="white" /> Pré-visualizar A4
            </motion.button>
            {!isProfessorViewAll && (
              <>
                <motion.button onClick={() => handleSave()} disabled={saving}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                  {saving ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Salvando...</> : <><Save size={16} /> Salvar</>}
                </motion.button>
                
                {currentUser?.perfil === 'Professor' ? (
                  <motion.button onClick={() => handleSave(undefined, 'enviar_revisao')} disabled={saving}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}>
                    {saving ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Processando...</> : <><Save size={16} /> Enviar {activeRequisicao?.disciplina_nome ? `de ${activeRequisicao.disciplina_nome}` : ''} para Revisão</>}
                  </motion.button>
                ) : (
                  <motion.button onClick={() => handleSave(undefined, 'aprovar')} disabled={saving}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}>
                    {saving ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Processando...</> : <><CheckCircle size={16} /> Salvar e Aprovar</>}
                  </motion.button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── MULTI-DISCIPLINE SELECTOR TABS ─── */}
      {userRelevantRequisicoes.length > 1 && !showAll && (
        <div style={{
          marginBottom: 24, padding: '12px 16px', background: 'hsl(var(--bg-surface))',
          borderRadius: 16, border: '1px solid hsl(var(--border-subtle))',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Selecione a Matéria:
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {userRelevantRequisicoes.map((r: any) => {
              const isActive = activeRequisicao?.id === r.id
              const isEnviada = r.status === 'enviado' || r.status === 'aprovado' || !!r.enviado_em

              return (
                <button
                  key={r.id}
                  onClick={() => switchDiscipline(r)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 10,
                    background: isActive ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'hsl(var(--bg-app))',
                    color: isActive ? '#ffffff' : 'hsl(var(--text-primary))',
                    border: isActive ? '1px solid #7c3aed' : '1px solid hsl(var(--border-subtle))',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    boxShadow: isActive ? '0 4px 12px rgba(139,92,246,0.35)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <BookOpen size={14} color={isActive ? '#ffffff' : '#8b5cf6'} />
                  <span>{r.disciplina_nome || 'Disciplina'}</span>
                  <span style={{
                    padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(100,116,139,0.1)',
                    color: isActive ? '#ffffff' : 'hsl(var(--text-secondary))'
                  }}>
                    {r.qtd_questoes}q
                  </span>
                  {isEnviada && (
                    <CheckCircle size={13} color={isActive ? '#ffffff' : '#10b981'} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="upload-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>

      {/* ─── STEP: Upload Zone ─── */}
      {uploadStep === 'idle' && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#8b5cf6' : 'rgba(139,92,246,0.3)'}`,
              borderRadius: 24, padding: '70px 40px', textAlign: 'center',
              background: dragOver ? 'rgba(139,92,246,0.05)' : 'hsl(var(--bg-surface))',
              cursor: 'pointer', transition: 'all 0.25s', marginBottom: 24,
            }}>
            <input ref={fileInputRef} type="file" accept=".doc,.docx" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

            <motion.div animate={{ y: dragOver ? -8 : 0 }} transition={{ type: 'spring', stiffness: 300 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Upload size={30} color="#8b5cf6" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>
                {dragOver ? 'Solte o arquivo aqui!' : activeRequisicao ? `Enviar arquivo de ${activeRequisicao.disciplina_nome}` : 'Arraste ou clique para enviar'}
              </h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, margin: '0 0 16px' }}>
                Envie o arquivo <strong>.DOCX</strong> (Word) contendo apenas as questões de <strong>{activeRequisicao?.disciplina_nome || 'sua disciplina'}</strong> ({activeRequisicao?.qtd_questoes || 10} questões)
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {[{ icon: FileText, label: '.DOCX — Word', color: '#3b82f6' }].map((t, i) => (
                  <div key={i} style={{ padding: '6px 14px', borderRadius: 8, background: `${t.color}11`, border: `1px solid ${t.color}33`, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <t.icon size={13} color={t.color} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.color }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <motion.button 
              onClick={() => setUploadStep('review')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, background: 'transparent', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Plus size={18} /> Inserir questões de {activeRequisicao?.disciplina_nome || 'disciplina'} manualmente
            </motion.button>
          </div>

          {parseError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', gap: 10, padding: '14px 18px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: '#ef4444', fontSize: 14 }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              {parseError}
            </motion.div>
          )}

          {/* Format Tips */}
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, marginTop: 24 }}>
            <h4 style={{ color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color="#f59e0b" /> Dicas de Formatação para Melhor Reconhecimento
            </h4>
            <div className="upload-tips-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { emoji: '🧠', title: 'Listas Inteligentes', desc: 'Use numeração manual ("1.", "1-", "1)") ou listas automáticas do Word. O sistema entende tudo!' },
                { emoji: '🅰️', title: 'Alternativas Flexíveis', desc: 'Formatos aceitos: "a.", "a-", "a)", listas manuais ou automáticas em múltiplos níveis.' },
                { emoji: '🎯', title: 'Gabarito Automático', desc: 'Pinte o texto da alternativa correta de vermelho (qualquer tom) no Word.' },
                { emoji: '🖼️', title: 'Imagens Nativas', desc: 'Cole imagens diretamente no arquivo DOCX e elas serão importadas automaticamente.' },
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'hsl(var(--bg-app))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                  <span style={{ fontSize: 20 }}>{tip.emoji}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>{tip.title}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))' }}>{tip.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── STEP: Parsing animation ─── */}
      {uploadStep === 'parsing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '100px 40px', background: 'hsl(var(--bg-surface))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', position: 'relative' }}>
            <Loader2 size={36} color="#8b5cf6" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 10px' }}>Analisando o arquivo...</h3>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: 0 }}>
            Extraindo questões e gabarito de <strong>{fileName}</strong> para <strong>{activeRequisicao?.disciplina_nome || 'o simulado'}</strong>
          </p>
        </motion.div>
      )}

      {/* ─── STEP: Review ─── */}
      {uploadStep === 'review' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <QuestoesEditor 
            questoes={questoes} 
            setQuestoes={setQuestoes} 
            defaultDisciplinaId={activeRequisicao?.id_disciplina || targetDiscId}
            defaultProfessorId={activeRequisicao?.id_professor || targetProfId || currentUser?.id}
            readOnly={isProfessorViewAll}
          />

          {!isProfessorViewAll && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', paddingBottom: 40 }}>
              <motion.button onClick={() => handleSave()} disabled={saving}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', fontSize: 16, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}>
                {saving ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Salvando...</> : <><Save size={18} /> Salvar Questões de {activeRequisicao?.disciplina_nome || 'Simulado'}</>}
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
      </div>

      {/* Sidebar: Requisitions */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 24 }}>
          
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24 }}>
            <h4 style={{ color: 'hsl(var(--text-primary))', fontSize: 15, fontWeight: 700, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#8b5cf6" /> Matérias do Simulado
            </h4>

          {!simulado?.simulados_upload_requisicoes || simulado.simulados_upload_requisicoes.length === 0 ? (
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, textAlign: 'center' }}>Sem atribuições cadastradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {simulado.simulados_upload_requisicoes.map((req: any, i: number) => {
                const reqStatuses: Record<string, { color: string; label: string }> = {
                  pendente: { color: '#f59e0b', label: 'Pendente' },
                  enviado: { color: '#3b82f6', label: 'Enviado' },
                  aprovado: { color: '#10b981', label: 'Aprovado' },
                  resimuladodo: { color: '#ef4444', label: 'Resimuladodo' },
                }
                const rs = reqStatuses[req.status] || reqStatuses['pendente']
                const isCurrentActive = activeRequisicao?.id === req.id

                return (
                  <div 
                    key={req.id || i} 
                    className={isCurrentActive ? 'neon-active-card' : ''}
                    onClick={() => {
                      if (!isCurrentActive) switchDiscipline(req)
                    }}
                    style={{ 
                      padding: '12px 14px', 
                      background: isCurrentActive ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(217,70,239,0.06))' : 'hsl(var(--bg-app))', 
                      borderRadius: 12, 
                      border: isCurrentActive ? '2px solid #8b5cf6' : '1px solid hsl(var(--border-subtle))',
                      cursor: isCurrentActive ? 'default' : 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{req.disciplina_nome || 'Disciplina'}</span>
                        {isCurrentActive && (
                          <span style={{ 
                            padding: '2px 7px', borderRadius: 100, fontSize: 9, fontWeight: 800, 
                            background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', color: '#ffffff', 
                            boxShadow: '0 0 10px rgba(217,70,239,0.6)', display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px #fff' }} />
                            SELECIONADA
                          </span>
                        )}
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: `${rs.color}15`, color: rs.color }}>{rs.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{req.professor_nome}</div>
                    {(() => {
                      // Accurate calculation of questions belonging strictly to this requisition
                      const allDbQs = Array.isArray(simulado.questoes_json) ? simulado.questoes_json : []
                      
                      const isQuestionForReq = (q: any) => {
                        if (q.tipo_questao === 'texto_apoio' || q.is_texto_apoio || q.isTextoApoio) return false
                        if (q.id_requisicao) return q.id_requisicao === req.id
                        const discMatch = (q.id_disciplina && (q.id_disciplina === req.id_disciplina || q.disciplina_id === req.id_disciplina)) ||
                                          (q.disciplina_nome && req.disciplina_nome && q.disciplina_nome.trim().toLowerCase() === req.disciplina_nome.trim().toLowerCase()) ||
                                          (q.disciplina && req.disciplina_nome && q.disciplina.trim().toLowerCase() === req.disciplina_nome.trim().toLowerCase())
                        const profMatch = !q.id_professor || q.id_professor === req.id_professor
                        return Boolean(discMatch && profMatch)
                      }

                      let qCount = 0
                      if (isCurrentActive && uploadStep === 'review') {
                        qCount = questoes.filter((q: any) => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio).length
                      } else {
                        qCount = allDbQs.filter(isQuestionForReq).length
                      }

                      const totalReq = req.qtd_questoes || 1
                      const progress = Math.min(100, Math.round((qCount / totalReq) * 100))
                      const progressColor = qCount >= totalReq ? '#10b981' : '#f59e0b'
                      return (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'hsl(var(--text-secondary))' }}>
                            <span><span style={{ fontWeight: 600, color: progressColor }}>{qCount}</span> / {req.qtd_questoes} questões</span>
                            <span style={{ fontWeight: 700, color: progressColor }}>{progress}%</span>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'hsl(var(--border-subtle))', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: progressColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      )
                    })()}
                    {req.enviado_em && (
                      <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                        Enviado em {new Date(req.enviado_em).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    {(() => {
                      const reqMatchedFile = simulado?.config_estudio?.arquivos_originais?.find((a: any) => 
                        (a.id_requisicao && a.id_requisicao === req.id) ||
                        (a.id_disciplina && req.id_disciplina && a.id_disciplina === req.id_disciplina && (!a.id_professor || a.id_professor === req.id_professor))
                      ) || (isCurrentActive && arquivoOriginal?.url ? arquivoOriginal : null)

                      if (!reqMatchedFile?.url) return null
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadOriginalFile(reqMatchedFile.url, reqMatchedFile.nome)
                          }}
                          style={{
                            marginTop: 10,
                            width: '100%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            color: '#2563eb',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          title={`Baixar arquivo original (${reqMatchedFile.nome})`}
                        >
                          <Download size={13} /> Baixar DOCX Original
                        </button>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}

          {/* Coord action summary */}
          {currentUser?.perfil !== 'Professor' && (
            <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo Geral</div>
              <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'hsl(var(--text-secondary))' }}>Total questões:</span>
                  <span style={{ fontWeight: 700 }}>{simulado.questoes_count || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'hsl(var(--text-secondary))' }}>Atribuições:</span>
                  <span style={{ fontWeight: 700 }}>{simulado.simulados_upload_requisicoes.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'hsl(var(--text-secondary))' }}>Enviadas:</span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>{simulado.simulados_upload_requisicoes.filter((r: any) => r.status === 'enviado' || r.status === 'aprovado').length}</span>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>

      {/* ─── ISOLATED PREVIEW MODAL ─── */}
      {showPreviewIsolated && (
        <SimuladoPreviewModal
          questoes={simulado?.questoes_json?.map((q: any, i: number) => ({ ...q, expandido: true, numero: i + 1 })) || []}
          setQuestoes={setQuestoes}
          simulado={{ 
            ...simulado, 
            isSimulado: true,
            formattedDate: simulado?.data_aplicacao ? simulado.data_aplicacao.split('-').reverse().join('/') : '____ / ____ / ________',
            formattedSeries: simulado?.series?.join(', ') || '',
            formattedDisciplinas: Array.from(new Set(simulado?.simulados_upload_requisicoes?.map((r: any) => r.simulados_disciplinas?.nome || r.disciplina_nome || ''))).filter(Boolean).join(', '),
            formattedProfessors: Array.from(new Set(simulado?.simulados_upload_requisicoes?.map((r: any) => {
              const nome = r.professores?.nome || r.professor_nome || '';
              return nome ? formatProfessorHeaderName(nome) : '';
            }))).filter(Boolean).join(', ')
          }}
          config={simConfig}
          onClose={() => {
            setShowPreviewIsolated(false)
            router.push(`/simulados/simulados-upload`)
          }}
          isolatedMode={true}
          isReadOnly={true}
        />
      )}
      
      {/* ─── A4 PREVIEW MODAL ─── */}
      <AnimatePresence>
        {showPreview && (
          <SimuladoPreviewModal
            questoes={questoes}
            setQuestoes={setQuestoes}
            simulado={{ 
              ...simulado, 
              isSimulado: true,
              formattedDate: simulado?.data_aplicacao ? simulado.data_aplicacao.split('-').reverse().join('/') : '____ / ____ / ________',
              formattedSeries: simulado?.series?.join(', ') || '',
              formattedDisciplinas: Array.from(new Set(simulado?.simulados_upload_requisicoes?.map((r: any) => r.simulados_disciplinas?.nome || r.disciplina_nome || ''))).filter(Boolean).join(', '),
              formattedProfessors: Array.from(new Set(simulado?.simulados_upload_requisicoes?.map((r: any) => {
                const nome = r.professores?.nome || r.professor_nome || '';
                return nome ? formatProfessorHeaderName(nome) : '';
              }))).filter(Boolean).join(', ')
            }}
            config={simConfig}
            onClose={() => setShowPreview(false)}
            onSave={(qs, config) => handleSave(qs, undefined, config)}
            saving={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
            
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 420, position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', textAlign: 'center' }}>
              
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Simulado Salva!</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, lineHeight: 1.5, margin: '0 0 32px' }}>
                {simulado?.titulo?.endsWith('- Adaptado')
                  ? 'Sua novo simulado foi criada e salva na lista com o sufixo "- Adaptado". Você pode continuar editando se precisar, ou voltar para a lista.'
                  : 'Suas questões foram salvas com sucesso. Você pode continuar editando se precisar, ou voltar para a lista.'}
              </p>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <motion.button onClick={() => router.push('/simulados/simulados-upload')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(245,158,11,0.3)' }}>
                  Ir para Lista
                </motion.button>
                <motion.button onClick={() => setSuccessModal(false)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(16,185,129,0.3)' }}>
                  Continuar Editando
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alertModal.open && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAlertModal({ open: false, message: '' })}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
            
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ background: 'white', borderRadius: 24, padding: '32px', width: '100%', maxWidth: 400, position: 'relative', zIndex: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <AlertCircle size={32} color="#ef4444" />
              </div>
              
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Ação Bloqueada</h2>
              <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
                {alertModal.message}
              </p>
              
              <motion.button onClick={() => setAlertModal({ open: false, message: '' })} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(239,68,68,0.3)' }}>
                Entendi
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}



