'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CheckCircle, XCircle, Eye, Edit2, Loader2,
  Users, Calendar, BookOpen, FileText, Image as ImageIcon,
  ChevronDown, ChevronUp, Sparkles, Save, Send, AlertCircle, Clock, Upload, Printer
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { getDerivedStatus } from '@/lib/utils'
import { ProvaPreviewModal, Questao } from '@/components/simulados/ProvaPreviewModal'
import { QuestoesEditor } from '@/components/simulados/QuestoesEditor'

export default function VerProvaUploadPage() {
  const router = useRouter()
  const params = useParams()
  const provaId = params.id as string
  const { currentUser, currentUserPerfil } = useApp()

  const [prova, setProva] = useState<any>(null)
  const [requisicoes, setRequisicoes] = useState<any[]>([])
  const [questoes, setQuestoes] = useState<Questao[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [simConfig, setSimConfig] = useState<any>(null)

  const isCoord = currentUserPerfil !== 'Professor'

  const [successModal, setSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    loadProva()
  }, [provaId])

  const loadProva = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any).from('simulados_upload').select('*').eq('id', provaId).single()
      if (error) throw error
      setProva(data)

      const { data: reqs } = await (supabase as any)
        .from('simulados_upload_requisicoes')
        .select('*')
        .eq('id_simulado_upload', provaId)
      setRequisicoes(reqs || [])

      const { data: cfg } = await (supabase as any).from('simulados_configuracoes').select('*').eq('id', 'default').single()
      if (cfg) setSimConfig(cfg)

      if (data?.questoes_json) {
        setQuestoes(data.questoes_json)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const updateStatus = async (status: string) => {
    setSaving(true)
    try {
      await (supabase as any).from('simulados_upload').update({ status }).eq('id', provaId)
      setProva((prev: any) => ({ ...prev, status }))
      setSuccessMessage(`Prova ${status === 'aprovado' ? 'aprovada' : status === 'reprovado' ? 'reprovada' : 'publicada'} com sucesso!`)
      setSuccessModal(true)
    } catch (e: any) { alert('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  const handleSaveQuestoes = async (updatedQuestoes?: any[], config_estudio?: any) => {
    setSaving(true)
    try {
      let updatePayload: any = {
        questoes_json: updatedQuestoes || questoes,
        updated_at: new Date().toISOString()
      }
      if (config_estudio) {
        updatePayload.config_estudio = config_estudio
      }
      const { error } = await (supabase as any).from('simulados_upload').update(updatePayload).eq('id', provaId)
      if (error) throw error
      if (config_estudio) {
        setProva((prev: any) => ({ ...prev, config_estudio }))
      }
      setSuccessMessage('Alterações salvas com sucesso!')
      setSuccessModal(true)
      setShowPreview(false)
    } catch (e: any) { alert('Erro ao salvar: ' + e.message) }
    finally { setSaving(false) }
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    aguardando: { label: 'Aguardando', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    em_revisao: { label: 'Em Revisão', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    aprovado: { label: 'Aprovado', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    reprovado: { label: 'Reprovado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    publicado: { label: 'Publicado', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  }
  const derivedStatus = getDerivedStatus({ ...prova, simulados_upload_requisicoes: requisicoes }, 'simulado')
  const sc = statusConfig[derivedStatus] || statusConfig['aguardando']

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite' }} color="#8b5cf6" />
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  }

  if (!prova) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>Prova não encontrada.</div>
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto', overflowX: 'hidden', wordBreak: 'break-word' }}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/simulados/provas-upload"
            style={{ width: 44, height: 44, borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', textDecoration: 'none', flexShrink: 0, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>{prova.titulo}</h1>
              <span style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}33`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {sc.label}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {prova.data_aplicacao && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  <Calendar size={14} color="#8b5cf6" /> Aplicação: {new Date(prova.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                </div>
              )}
              {prova.data_limite_upload && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  <Clock size={14} color="#f59e0b" /> Prazo: {new Date(prova.data_limite_upload + 'T00:00:00').toLocaleDateString('pt-BR')}
                </div>
              )}
              {prova.series && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  <Users size={14} color="#3b82f6" /> {Array.isArray(prova.series) ? prova.series.join(', ') : prova.series}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                <FileText size={14} color="#10b981" /> {prova.questoes_count || 0} questões
              </div>
            </div>
          </div>
        </div>

        {/* Coordinator Actions */}
        {isCoord && prova.status === 'em_revisao' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button onClick={() => setShowPreview(true)}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-subtle))', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Printer size={16} color="#3b82f6" /> Pré-visualizar A4
            </motion.button>
            <motion.button onClick={() => updateStatus('reprovado')} disabled={saving}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <XCircle size={16} /> Reprovar
            </motion.button>
            <motion.button onClick={() => updateStatus('publicado')} disabled={saving}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(139,92,246,0.3)' }}>
              <Send size={16} /> Aprovar e Publicar
            </motion.button>
          </div>
        )}

        {/* Professor Actions */}
        {!isCoord && requisicoes.some(r => r.id_professor === currentUser?.id && r.status === 'pendente') && (
          <Link href={`/simulados/provas-upload/${prova.id}/upload`} style={{ textDecoration: 'none' }}>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(139,92,246,0.3)' }}>
              <Upload size={16} /> Fazer Upload da Prova
            </motion.button>
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* Questions Panel */}
        <div style={{ minWidth: 0 }}>
          {questoes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 40px', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
              <Clock size={40} color="hsl(var(--text-secondary))" style={{ marginBottom: 16, opacity: 0.5 }} />
              <h3 style={{ color: 'hsl(var(--text-primary))', fontWeight: 700, margin: '0 0 8px' }}>Aguardando upload dos professores</h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, margin: 0 }}>As questões aparecerão aqui após os professores enviarem os arquivos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <QuestoesEditor 
                questoes={questoes} 
                setQuestoes={setQuestoes} 
                defaultDisciplinaId={!isCoord ? requisicoes.find((r: any) => r.id_professor === currentUser?.id)?.id_disciplina : undefined}
                defaultProfessorId={!isCoord ? currentUser?.id : undefined}
              />
              
              {isCoord && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <motion.button onClick={() => handleSaveQuestoes()} disabled={saving}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-subtle))', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                    {saving ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={16} />}
                    Salvar Alterações
                  </motion.button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Requisitions */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 24 }}>
            
            {prova?.descricao && (
              <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: 20, padding: 24 }}>
                <h4 style={{ color: '#ec4899', fontSize: 15, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} /> Instruções para os Professores
                </h4>
                <p style={{ color: 'hsl(var(--text-primary))', fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {prova.descricao}
                </p>
              </div>
            )}

            <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24 }}>
              <h4 style={{ color: 'hsl(var(--text-primary))', fontSize: 15, fontWeight: 700, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#8b5cf6" /> Atribuições
              </h4>

            {requisicoes.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, textAlign: 'center' }}>Sem atribuições cadastradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {requisicoes.map((req: any, i: number) => {
                  const reqStatuses: Record<string, { color: string; label: string }> = {
                    pendente: { color: '#f59e0b', label: 'Pendente' },
                    enviado: { color: '#3b82f6', label: 'Enviado' },
                    aprovado: { color: '#10b981', label: 'Aprovado' },
                    reprovado: { color: '#ef4444', label: 'Reprovado' },
                  }
                  const rs = reqStatuses[req.status] || reqStatuses['pendente']
                  return (
                    <div key={i} style={{ padding: '12px 14px', background: 'hsl(var(--bg-app))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{req.disciplina_nome || 'Disciplina'}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: `${rs.color}15`, color: rs.color }}>{rs.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{req.professor_nome}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 4 }}>
                        <span style={{ fontWeight: 600, color: questoes.filter((q: any) => q.id_professor === req.id_professor).length >= req.qtd_questoes ? '#10b981' : '#f59e0b' }}>
                          {questoes.filter((q: any) => q.id_professor === req.id_professor).length}
                        </span> / {req.qtd_questoes} questões
                      </div>
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
            {isCoord && (
              <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo</div>
                <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Total questões:</span>
                    <span style={{ fontWeight: 700 }}>{prova.questoes_count || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Atribuições:</span>
                    <span style={{ fontWeight: 700 }}>{requisicoes.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--text-secondary))' }}>Enviadas:</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>{requisicoes.filter(r => r.status === 'enviado' || r.status === 'aprovado').length}</span>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPreview && (
          <ProvaPreviewModal
            questoes={questoes}
            setQuestoes={setQuestoes}
            prova={{ 
              ...prova, 
              isProva: true,
              formattedDate: prova?.data_aplicacao ? prova.data_aplicacao.split('-').reverse().join('/') : '',
              formattedSeries: prova?.series?.join(', ') || '',
              formattedDisciplinas: Array.from(new Set(requisicoes?.map((r: any) => r.simulados_disciplinas?.nome || r.disciplina_nome || ''))).filter(Boolean).join(', '),
              formattedProfessors: Array.from(new Set(requisicoes?.map((r: any) => {
                const nome = r.professores?.nome || r.professor_nome || '';
                return nome ? nome.split(' ').slice(0, 2).join(' ') : '';
              }))).filter(Boolean).join(', ')
            }}
            config={simConfig}
            onClose={() => setShowPreview(false)}
            onSave={handleSaveQuestoes}
            saving={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSuccessModal(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ position: 'relative', background: 'hsl(var(--bg-app))', padding: 32, borderRadius: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.2)', maxWidth: 400, width: '100%', textAlign: 'center', border: '1px solid hsl(var(--border-subtle))' }}>
              
              <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 12, letterSpacing: '-0.02em' }}>
                Sucesso!
              </h2>
              <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', marginBottom: 32, lineHeight: 1.5 }}>
                {successMessage}
              </p>
              
              <motion.button onClick={() => setSuccessModal(false)}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                OK
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
