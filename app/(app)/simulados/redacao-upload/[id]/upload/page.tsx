'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Loader2,
  Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Image as ImageIcon,
  Save, RefreshCw, Sparkles, Plus, X, Printer, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Calendar, Clock, Users, Download, BookOpen, Layers, Target, User
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { PaginationEngine } from '@/components/simulados/PaginationEngine'
import { HtmlContent } from '@/components/HtmlContent'

import { RedacaoPreviewModal, Questao, Alternative } from '@/components/simulados/RedacaoPreviewModal'
import { formatProfessorHeaderName, downloadOriginalFile, OriginalFileRecord, resolveOriginalFileForRequisicao, upsertOriginalFileInConfig, mergeConfigEstudioPreservingOriginalFiles } from '@/lib/utils'
import { QuestoesEditor } from '@/components/simulados/QuestoesEditor'
export default function UploadRedaçãoPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const redacaoId = params.id as string
  const { currentUser } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [redacao, setRedação] = useState<any>(null)
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
  const [arquivoOriginal, setArquivoOriginal] = useState<OriginalFileRecord | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [simConfig, setSimConfig] = useState<any>(null)

  useEffect(() => {
    loadRedação()
    loadConfig()
  }, [redacaoId])

  const loadConfig = async () => {
    const { data } = await (supabase as any).from('simulados_configuracoes').select('*').eq('id', 'default').single()
    if (data) setSimConfig(data)
  }

  const loadRedação = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any).from('redacao_upload').select('*').eq('id', redacaoId).single()
      if (error) throw error

      const { data: reqs } = await (supabase as any).from('redacao_upload_requisicoes').select('*').eq('id_redacao_upload', redacaoId)
      
      const formattedDisciplinas = Array.from(new Set(reqs?.map((r: any) => r.simulados_disciplinas?.nome || r.disciplina_nome || ''))).filter(Boolean).join(', ')
      const formattedProfessors = Array.from(new Set(reqs?.map((r: any) => {
        const nome = r.professores?.nome || r.professor_nome || '';
        return nome ? formatProfessorHeaderName(nome) : '';
      }))).filter(Boolean).join(', ')
      const formattedDate = data?.data_aplicacao ? data.data_aplicacao.split('-').reverse().join('/') : '____ / ____ / ________'
      const formattedSeries = Array.isArray(data?.series) ? data.series.join(', ') : (data?.series || '')

      const redacaoData = { 
        ...data, 
        redacao_upload_requisicoes: reqs || [],
        formattedDisciplinas,
        formattedProfessors,
        formattedDate,
        formattedSeries,
        isRedação: true
      }
      setRedação(redacaoData)

      // Look for original file in config_estudio
      const targetProf = searchParams.get('prof')
      const showAll = searchParams.get('all') === 'true'

      const currentActiveReq = showAll ? null : (
        (targetProf && reqs?.find((r: any) => r.id_professor === targetProf)) ||
        reqs?.[0] ||
        (targetProf ? { id_professor: targetProf } : null)
      )
      const matchedArquivo = resolveOriginalFileForRequisicao(
        data?.config_estudio,
        currentActiveReq,
        showAll ? [] : (reqs || [])
      )
      setArquivoOriginal(matchedArquivo)

      // If questions already exist, load them for review
      if (redacaoData?.questoes_json && redacaoData.questoes_json.length > 0) {
        let qs = redacaoData.questoes_json
        
        if (!showAll) {
          if (targetProf) {
            qs = qs.filter((q: any) => q.id_professor === targetProf)
          } else if (currentUser?.perfil === 'Professor') {
            qs = qs.filter((q: any) => q.id_professor === currentUser.id)
          }
        }
        
        if (qs.length > 0) {
          setQuestoes(qs.map((q: any, i: number) => ({ ...q, expandido: true })))
          setUploadStep('review')
        }
      }
      
      if (searchParams.get('print') === 'true') {
        setShowPreview(true)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
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
      const targetProf = searchParams.get('prof') || ''

      const fd = new FormData()
      fd.append('file', file)
      fd.append('itemId', redacaoId)
      fd.append('itemTipo', 'redacao')
      if (targetProf) fd.append('profId', targetProf)

      const res = await fetch('/api/simulados-upload/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) {
        setParseError(data.error || 'Erro ao processar arquivo.')
        setUploadStep('idle')
        return
      }

      if (data.arquivoUrl) {
        const uploadedEntry = {
          url: data.arquivoUrl,
          nome: data.arquivoNome || file.name,
          tamanho: data.arquivoTamanho || file.size,
          path: data.arquivoPath,
          id_professor: targetProf || null,
          uploaded_at: new Date().toISOString()
        }
        setArquivoOriginal(uploadedEntry)
        setRedação((prev: any) => prev ? {
          ...prev,
          config_estudio: upsertOriginalFileInConfig(prev.config_estudio, uploadedEntry)
        } : prev)
      } else if (data.storageWarning) {
        console.warn('[Upload DOCX Original] Falha ao salvar cópia original:', data.storageWarning)
      }

      const parsed: Questao[] = (data.questoes || []).map((q: any, i: number) => ({ ...q, expandido: true }))
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


  const handleSave = async (updatedQuestoes?: any[], actionType?: 'enviar_revisao' | 'aprovar' | 'aredacaor', config_estudio?: any) => {
    const currentQs = Array.isArray(updatedQuestoes) ? updatedQuestoes : questoes;

    const myAssignment = redacao?.redacao_upload_requisicoes?.find((r: any) => r.id_professor === currentUser?.id);
    if (currentUser?.perfil === 'Professor' && myAssignment) {
      if (currentQs.length > myAssignment.qtd_questoes) {
        setAlertModal({ open: true, message: `Você não pode salvar. Estão liberadas apenas ${myAssignment.qtd_questoes} questões para você nesta redação. Edite ou exclua algumas questões para prosseguir.` });
        return;
      }
      if (actionType === 'enviar_revisao' && currentQs.length < myAssignment.qtd_questoes) {
        setAlertModal({ open: true, message: `Você só pode enviar para revisão quando completar toda a quantidade de questões vinculadas a você (${myAssignment.qtd_questoes} questões). Faltam ${myAssignment.qtd_questoes - currentQs.length} questões.` });
        return;
      }
    }

    setSaving(true)
    try {
      // 1. Fetch current DB state to avoid overwriting other professors
      const { data: dbData } = await (supabase as any).from('redacao_upload').select('questoes_json, config_estudio').eq('id', redacaoId).single()
      const dbQuestions = dbData?.questoes_json || []

      const targetProf = searchParams.get('prof')
      const showAll = searchParams.get('all') === 'true'

      // 2. Filter out questions we are NOT editing
      let otherQuestions = []
      if (currentUser?.perfil === 'Professor') {
        otherQuestions = dbQuestions.filter((q: any) => q.id_professor !== currentUser.id)
      } else if (targetProf && !showAll) {
        otherQuestions = dbQuestions.filter((q: any) => q.id_professor !== targetProf)
      }

      // 3. Prepare our questions
      const myQuestionsToSave = currentQs.map(({ expandido, ...q }) => ({ 
        ...q, 
        id_professor: currentUser?.perfil === 'Professor' ? currentUser.id : q.id_professor 
      }))

      // 4. Merge
      const finalQToSave = [...otherQuestions, ...myQuestionsToSave]

      // 5. Merge config_estudio preserving original file list
      let mergedConfig = mergeConfigEstudioPreservingOriginalFiles(
        dbData?.config_estudio || redacao?.config_estudio,
        config_estudio
      )
      if (arquivoOriginal?.url) {
        const existingEntry = (Array.isArray(mergedConfig.arquivos_originais) ? mergedConfig.arquivos_originais : []).find(
          (a: any) => a.url === arquivoOriginal.url && (!targetProf || a.id_professor === targetProf)
        )
        if (!existingEntry) {
          mergedConfig = upsertOriginalFileInConfig(mergedConfig, {
            ...arquivoOriginal,
            id_professor: targetProf || null,
          })
        }
      }

      let updatePayload: any = {
        questoes_json: finalQToSave,
        questoes_count: finalQToSave.filter((q: any) => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio).length,
        config_estudio: mergedConfig,
        updated_at: new Date().toISOString(),
      }

      if (actionType === 'aprovar' || actionType === 'aredacaor') {
        updatePayload.status = 'aprovado'
      } else if (actionType === 'enviar_revisao') {
        updatePayload.status = 'em_revisao'
      }

      const { error } = await (supabase as any).from('redacao_upload').update(updatePayload).eq('id', redacaoId)

      if (actionType === 'enviar_revisao' && myAssignment) {
         await (supabase as any).from('redacao_upload_requisicoes').update({
           status: 'enviado',
           enviado_em: new Date().toISOString()
         }).eq('id', myAssignment.id)
      } else if (actionType === 'aprovar' || actionType === 'aredacaor') {
         await (supabase as any).from('redacao_upload_requisicoes').update({
           status: 'aprovado'
         }).eq('id_redacao_upload', redacaoId)
      }

      if (error) throw error

      await loadRedação()
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
        .neon-active-card {
          border-color: #8b5cf6 !important;
          box-shadow: 0 4px 20px -2px rgba(139, 92, 246, 0.22) !important;
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

      {/* Studio Header Card (Compact 2-Row Design - No awkward line breaks) */}
      {(() => {
        const myAssignment = redacao?.redacao_upload_requisicoes?.find((r: any) =>
          r.id === searchParams.get('req') ||
          r.id_professor === currentUser?.id ||
          r.id_professor === searchParams.get('prof')
        )
        const reqStatuses: Record<string, { color: string; label: string; bg: string }> = {
          pendente: { color: '#f59e0b', label: 'Em Elaboração', bg: 'rgba(245,158,11,0.08)' },
          enviado: { color: '#3b82f6', label: 'Enviado para Revisão', bg: 'rgba(59,130,246,0.08)' },
          aprovado: { color: '#10b981', label: 'Aprovado', bg: 'rgba(16,185,129,0.08)' },
          reprovado: { color: '#ef4444', label: 'Revisão Solicitada', bg: 'rgba(239,68,68,0.08)' },
        }
        const activeStatus = myAssignment ? (reqStatuses[myAssignment.status] || reqStatuses['pendente']) : null

        return (
          <div style={{
            background: 'hsl(var(--bg-surface))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 18,
            padding: '16px 20px',
            boxShadow: '0 4px 20px -4px rgba(0,0,0,0.03)',
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Row 1: Back Link (Left) | Action Buttons (Right) - STRICTLY 1 SINGLE LINE */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'nowrap' }}>
              
              {/* Left: Back Link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Link 
                  href="/simulados/redacao-upload"
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 9, 
                    background: 'hsl(var(--bg-app))', 
                    border: '1px solid hsl(var(--border-subtle))', 
                    color: 'hsl(var(--text-secondary))', 
                    textDecoration: 'none', 
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s' 
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}
                  title="Voltar para Minhas Redações"
                >
                  <ArrowLeft size={14} /> Minhas Redações
                </Link>
              </div>

              {/* Right: Actions Group (Never wraps) */}
              {uploadStep === 'review' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'nowrap', flexShrink: 0 }}>
                  <motion.button 
                    onClick={() => { setUploadStep('idle'); setQuestoes([]) }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    title="Importar novo arquivo Word"
                  >
                    <RefreshCw size={13} /> Reenviar
                  </motion.button>
                  <motion.button 
                    onClick={() => {
                      if (currentUser?.perfil === 'Professor' && myAssignment && questoes.length > myAssignment.qtd_questoes) {
                        setAlertModal({ open: true, message: `Você não pode pré-visualizar. Estão liberadas apenas ${myAssignment.qtd_questoes} questões para você nesta redação. Edite ou exclua algumas questões para acessar.` });
                        return;
                      }
                      setShowPreview(true);
                    }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, background: 'hsl(var(--bg-app))', color: '#2563eb', border: '1px solid rgba(37,99,235,0.25)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <Printer size={13} /> Pré-visualizar A4
                  </motion.button>

                  <motion.button 
                    onClick={() => handleSave()} 
                    disabled={saving}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 9, background: 'hsl(var(--bg-app))', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar Rascunho
                  </motion.button>

                  {currentUser?.perfil === 'Professor' ? (
                    <motion.button 
                      onClick={() => handleSave(undefined, 'enviar_revisao')} 
                      disabled={saving}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 9, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 2px 10px rgba(16,185,129,0.25)', whiteSpace: 'nowrap' }}
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={14} />} Salvar e Enviar para Revisão
                    </motion.button>
                  ) : (
                    <motion.button 
                      onClick={() => handleSave(undefined, 'aprovar')} 
                      disabled={saving}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 9, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 2px 10px rgba(16,185,129,0.25)', whiteSpace: 'nowrap' }}
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={14} />} Salvar e Aprovar
                    </motion.button>
                  )}
                </div>
              )}
            </div>

            {/* Row 2: Title (Full Width - Never truncated with ellipsis) */}
            <div>
              <h1 style={{ 
                fontSize: 22, 
                fontWeight: 800, 
                color: 'hsl(var(--text-primary))', 
                margin: 0, 
                letterSpacing: '-0.02em', 
                lineHeight: 1.35,
                wordBreak: 'break-word',
                whiteSpace: 'normal'
              }}>
                {redacao?.titulo || 'Envio de Redação'}
              </h1>
            </div>

            {/* Row 3: Metadata Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              {myAssignment?.disciplina_nome && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 11, color: '#8b5cf6', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <BookOpen size={12} /> {myAssignment.disciplina_nome}
                </div>
              )}
              {redacao?.data_aplicacao && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Calendar size={12} color="#8b5cf6" /> Aplicação: {redacao.data_aplicacao.split('-').reverse().join('/')}
                </div>
              )}
              {redacao?.data_limite_upload && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Clock size={12} color="#f59e0b" /> Prazo: {redacao.data_limite_upload.split('-').reverse().join('/')}
                </div>
              )}
              {redacao?.series && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Layers size={12} color="#3b82f6" /> {Array.isArray(redacao.series) ? redacao.series.join(', ') : redacao.series}
                </div>
              )}
              {myAssignment?.qtd_questoes && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Target size={12} color="#8b5cf6" /> <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{myAssignment.qtd_questoes}</span> propostas/questões atribuídas
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ─── SIDEBAR DEFINITION ─── */}
      {(() => {
        const renderSidebar = () => (
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 22, boxShadow: '0 4px 20px -4px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
              <h4 style={{ color: 'hsl(var(--text-primary))', fontSize: 14.5, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <Users size={16} color="#8b5cf6" style={{ flexShrink: 0 }} />
                <span>Atribuições</span>
              </h4>
              {redacao?.redacao_upload_requisicoes?.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-app))', padding: '3px 8px', borderRadius: 6, border: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
                  {redacao.redacao_upload_requisicoes.length} {redacao.redacao_upload_requisicoes.length === 1 ? 'matéria' : 'matérias'}
                </span>
              )}
            </div>

            {!redacao?.redacao_upload_requisicoes || redacao.redacao_upload_requisicoes.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, textAlign: 'center' }}>Sem atribuições cadastradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {redacao.redacao_upload_requisicoes.map((req: any, i: number) => {
                  const reqStatuses: Record<string, { color: string; label: string; bg: string }> = {
                    pendente: { color: '#d97706', label: 'Pendente', bg: 'rgba(245,158,11,0.08)' },
                    enviado: { color: '#2563eb', label: 'Enviado', bg: 'rgba(37,99,235,0.08)' },
                    aprovado: { color: '#059669', label: 'Aprovado', bg: 'rgba(16,185,129,0.08)' },
                    aredacaodo: { color: '#059669', label: 'Aprovado', bg: 'rgba(16,185,129,0.08)' },
                    reprovado: { color: '#dc2626', label: 'Reprovado', bg: 'rgba(239,68,68,0.08)' },
                    reredacaodo: { color: '#dc2626', label: 'Reprovado', bg: 'rgba(239,68,68,0.08)' },
                  }
                  const rs = reqStatuses[req.status] || reqStatuses['pendente']
                  const activeReqParam = searchParams.get('req')
                  const activeProfParam = searchParams.get('prof')
                  const isShowAll = searchParams.get('all') === 'true'

                  const isCurrentActive = !isShowAll && (
                    (activeReqParam && req.id === activeReqParam) ||
                    (!activeReqParam && activeProfParam && req.id_professor === activeProfParam) ||
                    (!activeReqParam && !activeProfParam && currentUser?.perfil === 'Professor' && req.id_professor === currentUser.id) ||
                    (!activeReqParam && !activeProfParam && currentUser?.perfil !== 'Professor' && i === 0)
                  )

                  return (
                    <div 
                      key={i} 
                      className={isCurrentActive ? 'neon-active-card' : ''}
                      style={{ 
                        padding: '14px 16px', 
                        background: isCurrentActive ? 'linear-gradient(180deg, rgba(139,92,246,0.07) 0%, rgba(139,92,246,0.01) 100%)' : 'hsl(var(--bg-app))', 
                        borderRadius: 14, 
                        border: isCurrentActive ? '1.5px solid #8b5cf6' : '1px solid hsl(var(--border-subtle))',
                        boxShadow: isCurrentActive ? '0 4px 18px -4px rgba(139,92,246,0.18)' : 'none',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      {/* Row 1: Discipline & Status Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: isCurrentActive ? 6 : 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <BookOpen size={14} color="#8b5cf6" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.disciplina_nome || 'Disciplina'}
                          </span>
                        </div>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, 
                          background: rs.bg, color: rs.color, border: `1px solid ${rs.color}33`, 
                          whiteSpace: 'nowrap', flexShrink: 0 
                        }}>
                          {rs.label}
                        </span>
                      </div>

                      {/* Active Status Pill */}
                      {isCurrentActive && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: 5, 
                            padding: '2px 8px', borderRadius: 6, 
                            background: 'rgba(139, 92, 246, 0.12)', 
                            border: '1px solid rgba(139, 92, 246, 0.25)',
                            color: '#7c3aed', fontSize: 10, fontWeight: 800, 
                            letterSpacing: '0.03em', textTransform: 'uppercase',
                            whiteSpace: 'nowrap'
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6' }} />
                            Editando Agora
                          </span>
                        </div>
                      )}

                      {/* Professor info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--text-secondary))', marginBottom: 10 }}>
                        <User size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {req.professor_nome || 'Professor'}
                        </span>
                      </div>

                      {/* Progress and Question Counter */}
                      {(() => {
                        const targetProf = searchParams.get('prof')
                        const showAll = searchParams.get('all') === 'true'
                        
                        let otherQuestions = []
                        if (currentUser?.perfil === 'Professor') {
                          otherQuestions = (redacao.questoes_json || []).filter((q: any) => q.id_professor !== currentUser.id)
                        } else if (targetProf && !showAll) {
                          otherQuestions = (redacao.questoes_json || []).filter((q: any) => q.id_professor !== targetProf)
                        } else if (!showAll) {
                          otherQuestions = (redacao.questoes_json || [])
                        }
                        
                        const myLiveQs = questoes.map((q) => ({
                          ...q,
                          id_professor: currentUser?.perfil === 'Professor' ? currentUser.id : (q.id_professor || targetProf)
                        }))
                        
                        const liveQuestions = showAll ? questoes : [...otherQuestions, ...myLiveQs]
                        
                        const qCount = liveQuestions.filter((q: any) => q.id_professor === req.id_professor).length
                        const totalReq = req.qtd_questoes || 1
                        const progress = Math.min(100, Math.round((qCount / totalReq) * 100))
                        const progressColor = qCount >= totalReq ? '#10b981' : '#f59e0b'
                        return (
                          <div style={{ paddingTop: 8, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 5 }}>
                              <span style={{ color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontWeight: 800, color: progressColor, fontSize: 12 }}>{qCount}</span>
                                <span style={{ color: 'hsl(var(--text-muted))' }}>/ {req.qtd_questoes} questões</span>
                              </span>
                              <span style={{ 
                                fontWeight: 800, fontSize: 10, color: progressColor, 
                                background: `${progressColor}15`, padding: '1px 6px', borderRadius: 4 
                              }}>
                                {progress}%
                              </span>
                            </div>
                            <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${progress}%`, height: '100%', 
                                background: qCount >= totalReq ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #8b5cf6, #7c3aed)', 
                                borderRadius: 999, transition: 'width 0.4s ease' 
                              }} />
                            </div>
                          </div>
                        )
                      })()}

                      {req.enviado_em && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#2563eb', marginTop: 8, fontWeight: 600 }}>
                          <CheckCircle size={12} /> Enviado em {new Date(req.enviado_em).toLocaleDateString('pt-BR')}
                        </div>
                      )}

                      {(() => {
                        const reqMatchedFile = resolveOriginalFileForRequisicao(
                          redacao?.config_estudio,
                          req,
                          redacao?.redacao_upload_requisicoes || []
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
                              padding: '7px 12px',
                              borderRadius: 8,
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: '#2563eb',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)' }}
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
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo</div>
                <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Total questões:</span>
                    <span style={{ fontWeight: 700 }}>{redacao.questoes_count || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Atribuições:</span>
                    <span style={{ fontWeight: 700 }}>{redacao.redacao_upload_requisicoes.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Enviadas:</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>{redacao.redacao_upload_requisicoes.filter((r: any) => r.status === 'enviado' || r.status === 'aprovado' || r.status === 'aredacaodo').length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

        return (
          <>
            {/* ─── STEP: Upload Zone ─── */}
            {uploadStep === 'idle' && (
              <div className="upload-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
                <div style={{ minWidth: 0 }}>
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${dragOver ? '#8b5cf6' : 'rgba(139,92,246,0.3)'}`,
                        borderRadius: 24, padding: '80px 40px', textAlign: 'center',
                        background: dragOver ? 'rgba(139,92,246,0.05)' : 'hsl(var(--bg-surface))',
                        cursor: 'pointer', transition: 'all 0.25s', marginBottom: 24,
                      }}>
                      <input ref={fileInputRef} type="file" accept=".doc,.docx" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

                      <motion.div animate={{ y: dragOver ? -8 : 0 }} transition={{ type: 'spring', stiffness: 300 }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                          <Upload size={32} color="#8b5cf6" />
                        </div>
                        <h3 style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 10px' }}>
                          {dragOver ? 'Solte o arquivo aqui!' : 'Arraste ou clique para enviar'}
                        </h3>
                        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: '0 0 20px' }}>
                          Suportamos arquivos <strong>.DOCX</strong> (Word) com questões e alternativas
                        </p>
                        
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          {[{ icon: FileText, label: '.DOCX — Word', color: '#3b82f6' }].map((t, i) => (
                            <div key={i} style={{ padding: '8px 16px', borderRadius: 10, background: `${t.color}11`, border: `1px solid ${t.color}33`, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <t.icon size={14} color={t.color} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</span>
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
                        <Plus size={18} /> Inserir questões manualmente
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
                    <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 28, marginTop: 24 }}>
                      <h4 style={{ color: 'hsl(var(--text-primary))', fontSize: 15, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={16} color="#f59e0b" /> Dicas de Formatação para Melhor Reconhecimento
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                          { emoji: '🧠', title: 'Listas Inteligentes', desc: 'Use numeração manual ("1.", "1-", "1)") ou listas automáticas do Word. O sistema entende tudo!' },
                          { emoji: '📄', title: 'Texto Claro', desc: 'Evite cabeçalhos muito grandes antes do tema.' },
                          { emoji: '🖼️', title: 'Imagens Nativas', desc: 'Cole imagens diretamente no arquivo DOCX e elas serão importadas automaticamente.' },
                        ].map((tip, i) => (
                          <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'hsl(var(--bg-app))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                            <span style={{ fontSize: 24 }}>{tip.emoji}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>{tip.title}</div>
                              <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{tip.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
                <div style={{ position: 'sticky', top: 24 }}>
                  {renderSidebar()}
                </div>
              </div>
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
                  Extraindo questões, alternativas e imagens de <strong>{fileName}</strong>
                </p>
              </motion.div>
            )}

            {/* ─── STEP: Review (Toolbar covers the entire horizontal line, Grid below) ─── */}
            {uploadStep === 'review' && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%' }}>
                <QuestoesEditor 
                  questoes={questoes} 
                  setQuestoes={setQuestoes} 
                  defaultDisciplinaId={redacao?.redacao_upload_requisicoes?.find((r: any) => r.id_professor === currentUser?.id)?.id_disciplina}
                  defaultProfessorId={currentUser?.id}
                  requisicoes={redacao?.redacao_upload_requisicoes || []}
                  onReenviarArquivo={() => { setUploadStep('idle'); setQuestoes([]) }}
                  cotaQuestoes={redacao?.redacao_upload_requisicoes?.find((r: any) => 
                    (currentUser?.perfil === 'Professor' && r.id_professor === currentUser?.id) ||
                    r.id === searchParams.get('req') ||
                    r.id_professor === searchParams.get('prof')
                  )?.qtd_questoes}
                  sidebarContent={renderSidebar()}
                  footerContent={
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <motion.button onClick={() => handleSave()} disabled={saving}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', fontSize: 16, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}>
                        {saving ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Salvando...</> : <><Save size={18} /> Salvar Redação</>}
                      </motion.button>
                    </div>
                  }
                />
              </motion.div>
            )}
          </>
        )
      })()}

      {/* ─── A4 PREVIEW MODAL ─── */}
      <AnimatePresence>
        {showPreview && (
          <RedacaoPreviewModal
            questoes={questoes}
            setQuestoes={setQuestoes}
            prova={{ 
              ...redacao, 
              isRedacao: true,
              formattedDate: redacao?.data_aplicacao ? redacao.data_aplicacao.split('-').reverse().join('/') : '____ / ____ / ________',
              formattedSeries: Array.isArray(redacao?.series) ? redacao.series.join(', ') : (redacao?.series || ''),
              formattedDisciplinas: Array.from(new Set(redacao?.redacao_upload_requisicoes?.map((r: any) => r.simulados_disciplinas?.nome || r.disciplina_nome || ''))).filter(Boolean).join(', '),
              formattedProfessors: Array.from(new Set(redacao?.redacao_upload_requisicoes?.map((r: any) => {
                const nome = r.professores?.nome || r.professor_nome || '';
                return nome ? formatProfessorHeaderName(nome) : '';
              }))).filter(Boolean).join(', ')
            }}
            config={simConfig}
            onClose={() => router.push('/simulados/redacao-upload')}
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
              
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Redação Salva!</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, lineHeight: 1.5, margin: '0 0 32px' }}>
                {redacao?.titulo?.endsWith('- Adaptado')
                  ? 'Sua nova redacao foi criada e salva na lista com o sufixo "- Adaptado". Você pode continuar editando se precisar, ou voltar para a lista.'
                  : 'Suas questões foram salvas com sucesso. Você pode continuar editando se precisar, ou voltar para a lista.'}
              </p>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <motion.button onClick={() => router.push('/simulados/redacao-upload')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
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



