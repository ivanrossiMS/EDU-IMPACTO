'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Loader2,
  Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Image as ImageIcon,
  Save, RefreshCw, Sparkles, Plus, X, Printer, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Calendar, Clock, Users
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { PaginationEngine } from '@/components/simulados/PaginationEngine'
import { HtmlContent } from '@/components/HtmlContent'

import { SimuladoPreviewModal, Questao, Alternative } from '@/components/simulados/SimuladoPreviewModal'
import { formatProfessorHeaderName } from '@/lib/utils'
import { QuestoesEditor } from '@/components/simulados/QuestoesEditor'
export default function UploadSimuladoPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const simuladoId = params.id as string
  const { currentUser } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const isProfessorViewAll = false;

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
  const [showPreview, setShowPreview] = useState(false)
  const [showPreviewIsolated, setShowPreviewIsolated] = useState(false)
  const [simConfig, setSimConfig] = useState<any>(null)

  useEffect(() => {
    loadSimulado()
    loadConfig()
  }, [simuladoId])

  const loadConfig = async () => {
    const { data } = await (supabase as any).from('simulados_configuracoes').select('*').eq('id', 'default').single()
    if (data) setSimConfig(data)
  }

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
      const formattedDate = data?.data_aplicacao ? data.data_aplicacao.split('-').reverse().join('/') : ''
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

      // If questions already exist, load them for review
      if (simuladoData?.questoes_json && simuladoData.questoes_json.length > 0) {
        let qs = simuladoData.questoes_json
        
        const showAll = true;
        
        if (qs.length > 0) {
          setQuestoes(qs.map((q: any, i: number) => ({ ...q, expandido: true, numero: i + 1 })))
          setUploadStep('review')
        }
      }
      
      if (searchParams.get('print') === 'true') {
        setShowPreviewIsolated(true)
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
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/simulados-upload/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) {
        setParseError(data.error || 'Erro ao processar arquivo.')
        setUploadStep('idle')
        return
      }
      const parsed: Questao[] = (data.questoes || []).map((q: any, i: number) => ({ ...q, expandido: true, numero: i + 1 }))
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

    const myAssignment = simulado?.simulados_upload_requisicoes?.find((r: any) => r.id_professor === currentUser?.id);
    if (currentUser?.perfil === 'Professor' && myAssignment) {
      if (currentQs.length > myAssignment.qtd_questoes) {
        setAlertModal({ open: true, message: `Você não pode salvar. Estão liberadas apenas ${myAssignment.qtd_questoes} questões para você neste simulado. Edite ou exclua algumas questões para prosseguir.` });
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
      const { data: dbData } = await (supabase as any).from('simulados_upload').select('questoes_json').eq('id', simuladoId).single()
      const dbQuestions = dbData?.questoes_json || []

      // 2. Since we are adapting, we edit ALL questions and don't preserve any hidden ones.
      // 3. Prepare our questions (keep their original id_professor if they have one)
      const finalQToSave = currentQs.map(({ expandido, ...q }) => ({ 
        ...q, 
        id_professor: q.id_professor || currentUser?.id 
      }))

      let updatePayload: any = {
        questoes_json: finalQToSave,
        questoes_count: finalQToSave.length,
        updated_at: new Date().toISOString(),
      }

      if (config_estudio) {
        updatePayload.config_estudio = config_estudio
      }

      if (actionType === 'aprovar') {
        updatePayload.status = 'aprovado'
      } else if (actionType === 'enviar_revisao') {
        updatePayload.status = 'em_revisao'
      }

      const { error } = await (supabase as any).from('simulados_upload').update(updatePayload).eq('id', simuladoId)

      if (actionType === 'enviar_revisao' && myAssignment) {
         await (supabase as any).from('simulados_upload_requisicoes').update({
           status: 'enviado',
           enviado_em: new Date().toISOString()
         }).eq('id', myAssignment.id)
      } else if (actionType === 'aprovar') {
         await (supabase as any).from('simulados_upload_requisicoes').update({
           status: 'aprovado'
         }).eq('id_simulado_upload', simuladoId)
      }

      if (error) throw error

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
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto', overflowX: 'hidden', wordBreak: 'break-word' }}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .alt-row:hover { background: rgba(139,92,246,0.04) !important; }
        .questao-card:hover { border-color: rgba(139,92,246,0.3) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/simulados/simulados-upload"
            style={{ width: 44, height: 44, borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', textDecoration: 'none', flexShrink: 0, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
                {simulado?.titulo || 'Envio de Simulado'}
              </h1>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {simulado?.data_aplicacao ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  <Calendar size={14} color="#8b5cf6" /> Aplicação: {simulado.data_aplicacao.split('-').reverse().join('/')}
                </div>
              ) : (
                <p style={{ color: 'hsl(var(--text-secondary))', margin: 0, fontSize: 13 }}>Faça upload do arquivo DOC ou DOCX com as questões elaboradas</p>
              )}
              {simulado?.data_limite_upload && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  <Clock size={14} color="#f59e0b" /> Prazo: {simulado.data_limite_upload.split('-').reverse().join('/')}
                </div>
              )}
            </div>
          </div>
        </div>

        {uploadStep === 'review' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>


              <motion.button onClick={() => setShowPreview(true)}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                <Printer size={16} color="white" /> Pré-visualizar A4
              </motion.button>
            {!isProfessorViewAll && (
              <>
                <motion.button onClick={() => handleSave()} disabled={saving}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Salvando...</> : <><Save size={16} /> Salvar</>}
                </motion.button>
                
                {currentUser?.perfil === 'Professor' ? (
                  <motion.button onClick={() => handleSave(undefined, 'enviar_revisao')} disabled={saving}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                    {saving ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Processando...</> : <><Save size={16} /> Salvar e Enviar para Revisão</>}
                  </motion.button>
                ) : (
                  <motion.button onClick={() => handleSave(undefined, 'aprovar')} disabled={saving}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                    {saving ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Processando...</> : <><CheckCircle size={16} /> Salvar e Aprovar</>}
                  </motion.button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
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
              borderRadius: 24, padding: '80px 40px', textAlign: 'center',
              background: dragOver ? 'rgba(139,92,246,0.05)' : 'hsl(var(--bg-surface))',
              cursor: 'pointer', transition: 'all 0.25s', marginBottom: 24,
            }}>
            <input ref={fileInputRef} type="file" accept=".docx" style={{ display: 'none' }}
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
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
                { emoji: '🅰️', title: 'Alternativas Flexíveis', desc: 'Formatos aceitos: "a.", "a-", "a)", listas manuais ou automáticas em múltiplos níveis.' },
                { emoji: '🎯', title: 'Gabarito Automático', desc: 'Pinte o texto da alternativa correta de vermelho (qualquer tom) no Word.' },
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

      {/* ─── STEP: Review ─── */}
      {uploadStep === 'review' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <QuestoesEditor 
            questoes={questoes} 
            setQuestoes={setQuestoes} 
            defaultDisciplinaId={simulado?.simulados_upload_requisicoes?.find((r: any) => r.id_professor === currentUser?.id)?.id_disciplina}
            defaultProfessorId={currentUser?.id}
            readOnly={isProfessorViewAll}
          />

          {!isProfessorViewAll && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', paddingBottom: 40 }}>
              <motion.button onClick={() => handleSave()} disabled={saving}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', fontSize: 16, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}>
                {saving ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Salvando...</> : <><Save size={18} /> Salvar Simulado</>}
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
      </div>

      {/* Sidebar: Requisitions */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 24 }}>
          
          {simulado?.descricao && (
            <motion.div 
              animate={{ 
                boxShadow: ['0 0 0px rgba(236, 72, 153, 0)', '0 0 30px rgba(236, 72, 153, 0.7)', '0 0 0px rgba(236, 72, 153, 0)'],
                borderColor: ['rgba(236, 72, 153, 0.2)', 'rgba(236, 72, 153, 0.8)', 'rgba(236, 72, 153, 0.2)']
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: 20, padding: 24 }}
            >
              <h4 style={{ color: '#ec4899', fontSize: 15, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} /> Instruções para os Professores
              </h4>
              <p style={{ color: 'hsl(var(--text-primary))', fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {simulado.descricao}
              </p>
            </motion.div>
          )}

          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24 }}>
            <h4 style={{ color: 'hsl(var(--text-primary))', fontSize: 15, fontWeight: 700, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#8b5cf6" /> Atribuições
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
                return (
                  <div key={i} style={{ padding: '12px 14px', background: 'hsl(var(--bg-app))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{req.disciplina_nome || 'Disciplina'}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: `${rs.color}15`, color: rs.color }}>{rs.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{req.professor_nome}</div>
                    {(() => {
                      const targetProf = searchParams.get('prof')
                      const showAll = searchParams.get('all') === 'true'
                      
                      let otherQuestions = []
                      if (currentUser?.perfil === 'Professor') {
                        otherQuestions = (simulado.questoes_json || []).filter((q: any) => q.id_professor !== currentUser.id)
                      } else if (targetProf && !showAll) {
                        otherQuestions = (simulado.questoes_json || []).filter((q: any) => q.id_professor !== targetProf)
                      } else if (!showAll) {
                        otherQuestions = (simulado.questoes_json || [])
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
          questoes={questoes}
          setQuestoes={setQuestoes}
          simulado={simulado}
          config={simConfig}
          onClose={() => {
            setShowPreviewIsolated(false)
            router.push(`/simulados/simulados-upload/${simuladoId}/upload?all=true`)
          }}
          isolatedMode={true}
          isReadOnly={isProfessorViewAll}
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
              formattedDate: simulado?.data_aplicacao ? simulado.data_aplicacao.split('-').reverse().join('/') : '',
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



