'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useData, Ocorrencia, newId } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import { useApp } from '@/lib/context'
import { compressImage, compressVideo } from '@/lib/mediaCompressor'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { Skeleton } from '@/components/skeletons/Skeleton'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { CardSkeleton } from '@/components/skeletons/CardSkeleton'
import { FieldSkeleton } from '@/components/skeletons/FieldSkeleton'
import { UpdatingIndicator } from '@/components/skeletons/States'
import {
  Plus, AlertTriangle, CheckCircle, Calendar, User, MessageSquare,
  Trash2, Search, ArrowLeft, Pencil, X, Undo,
  BookOpen, Users, Printer, FileText, Sparkles, School, TrendingUp, AlertCircle, ChevronRight, Filter,
  BarChart, Clock, Paperclip, Loader2, ImageIcon, FileArchive
} from 'lucide-react'

type GravOcorrencia = 'leve' | 'media' | 'grave'

const GRAV_CONFIG: Record<GravOcorrencia, { color: string; bg: string; label: string; border: string; glow: string }> = {
  leve:  { color: '#f59e0b', bg: '#fef3c7', label: 'Leve',   border: '#fde68a', glow: 'rgba(245, 158, 11, 0.1)' },
  media: { color: '#ef4444', bg: '#fee2e2', label: 'Média',  border: '#fecaca', glow: 'rgba(239, 68, 68, 0.1)' },
  grave: { color: '#dc2626', bg: '#fee2e2', label: 'Grave',  border: '#fecaca', glow: 'rgba(220, 38, 38, 0.2)' },
}

const TIPOS_FALLBACK = ['Indisciplina','Atraso recorrente','Bullying','Briga','Uso de celular','Desrespeito ao professor','Dano ao patrimônio','Outro']

const BLANK: Omit<Ocorrencia,'id'|'createdAt'> = {
  alunoId:'', alunoNome:'', turma:'', tipo:'',
  descricao:'', gravidade:'leve', data:'', responsavel:'', ciencia_responsavel: false,
  anexoUrl:'', anexoNome:'', anexoTipo:'', anexoTamanho:0
}

const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }

// ── Search dropdown de aluno ──────────────────────────────────────────────────


function AlunoSearch({ value, onChange, alunosDaTurma, todosAlunos, hasError, onClearError }: {
  value: string; onChange: (id: string, nome: string, turma: string) => void
  alunosDaTurma: { id: string; nome: string; turma: string }[]
  todosAlunos: { id: string; nome: string; turma: string }[]
  hasError?: boolean
  onClearError?: () => void
}) {
  const [q, setQ] = useState(value)
  const [modalOpen, setModalOpen] = useState(false)
  
  useEffect(() => {
    setQ(value)
  }, [value])

  const handleSearch = () => {
    if (!q.trim()) return
    setModalOpen(true)
  }

  const filteredTurma = q.trim().length > 0
    ? alunosDaTurma.filter(a => a.nome.toLowerCase().includes(q.toLowerCase()))
    : []
    
  const filteredGlobal = q.trim().length > 0
    ? todosAlunos.filter(a => !alunosDaTurma.some(at => at.id === a.id) && a.nome.toLowerCase().includes(q.toLowerCase()))
    : []

  return (
    <div style={{ position:'relative' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
          <input 
            id="alunoId"
            name="alunoId"
            className="form-input" 
            style={{ 
              paddingLeft:40, 
              height: '48px', 
              borderRadius: '12px', 
              background: '#f8fafc', 
              border: hasError ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
              fontSize: '14px',
              boxShadow: hasError ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
              transition: 'all 0.2s',
              outline: 'none'
            }} 
            placeholder="Digite o nome do aluno..."
            value={q}
            onChange={e => {
              setQ(e.target.value)
              if (onClearError) onClearError()
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          />
        </div>
        <button 
          type="button"
          onClick={handleSearch}
          style={{ height: '48px', padding: '0 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Search size={16} />
          Buscar
        </button>
      </div>

      {/* Modal de Resultados */}
      {modalOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background: '#fff', width:'100%', maxWidth:500, borderRadius: '20px', boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            
            <div style={{ background: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Resultados da Busca</div>
              <button style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer' }} onClick={() => setModalOpen(false)}><X size={20} /></button>
            </div>

            <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
              {filteredTurma.length === 0 && filteredGlobal.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                  Nenhum aluno encontrado para "{q}".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  
                  {filteredTurma.length > 0 && (
                    <div>
                      <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, color: '#10b981', background: '#f0fdf4', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>DA TURMA</div>
                      {filteredTurma.map(a => (
                        <button key={a.id} type="button" 
                          onClick={() => { onChange(a.id, a.nome, a.turma); setQ(a.nome); setModalOpen(false) }}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, cursor:'pointer', textAlign:'left', transition: 'all 0.2s', marginBottom: '6px' }}
                          onMouseEnter={e => (e.currentTarget.style.background='#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background='#fff')}>
                          <div style={{ width:32, height:32, borderRadius:8, background:'rgba(16, 185, 129, 0.1)', color:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{getInitials(a.nome)}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color: '#0f172a' }}>{a.nome}</div>
                            {a.turma && <div style={{ fontSize:11, color:'#64748b' }}>{a.turma}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredGlobal.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>OUTRAS TURMAS</div>
                      {filteredGlobal.map(a => (
                        <button key={a.id} type="button" 
                          onClick={() => { onChange(a.id, a.nome, a.turma); setQ(a.nome); setModalOpen(false) }}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, cursor:'pointer', textAlign:'left', transition: 'all 0.2s', marginBottom: '6px' }}
                          onMouseEnter={e => (e.currentTarget.style.background='#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background='#fff')}>
                          <div style={{ width:32, height:32, borderRadius:8, background:'rgba(239, 68, 68, 0.1)', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{getInitials(a.nome)}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color: '#0f172a' }}>{a.nome}</div>
                            {a.turma && <div style={{ fontSize:11, color:'#64748b' }}>{a.turma}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OcorrenciaModal({ form, setForm, onSave, onClose, alunosDaTurma, todosAlunos, tiposOcorrencia, turmas, validationErrors, setValidationErrors }: {
  form: Omit<Ocorrencia,'id'|'createdAt'>
  setForm: React.Dispatch<React.SetStateAction<Omit<Ocorrencia,'id'|'createdAt'>>>
  onSave: () => void; onClose: () => void
  alunosDaTurma: { id: string; nome: string; turma: string }[]
  todosAlunos: { id: string; nome: string; turma: string }[]
  tiposOcorrencia: { label: string; gravidade: 'leve' | 'media' | 'grave' }[]
  turmas: any[]
  validationErrors: { field: string; label: string }[]
  setValidationErrors: React.Dispatch<React.SetStateAction<{ field: string; label: string }[]>>
}) {
  const [isUploading, setIsUploading] = useState(false)
  const s = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))
  const hasError = (fieldId: string) => validationErrors.some(e => e.field === fieldId)
  const clearError = (fieldId: string) => setValidationErrors(prev => prev.filter(err => err.field !== fieldId))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(10px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background: '#fff', width:'100%', maxWidth:520, maxHeight:'90vh', display:'flex', flexDirection:'column', borderRadius: '24px', boxShadow:'0 30px 60px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        
        {/* Cabeçalho Gradiente */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', padding: '24px 32px', color: '#fff', position: 'relative', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>
                {form.alunoId ? 'Editar Ocorrência' : 'Nova Ocorrência'}
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', margin: '4px 0 0 0' }}>Preencha os dados da ocorrência disciplinar.</p>
            </div>
            <button style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onClick={onClose}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Conteúdo do Formulário */}
        <div style={{ padding: '20px 24px 24px 24px', background: '#fff', overflowY: 'auto', flex: 1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Aluno <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <AlunoSearch
                value={form.alunoNome}
                onChange={(id, nome, turma) => {
                  setForm(p => ({ ...p, alunoId:id, alunoNome:nome, turma: turma||p.turma }))
                  clearError('alunoId')
                }}
                alunosDaTurma={alunosDaTurma}
                todosAlunos={todosAlunos}
                hasError={hasError('alunoId')}
                onClearError={() => clearError('alunoId')}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ano Letivo</label>
              <input className="form-input" style={{ height: '36px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }} value={turmas.find((t: any) => t.nome === form.turma || t.id === form.turma)?.ano || 'N/A'} readOnly />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turma</label>
              <input className="form-input" style={{ height: '36px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }} value={turmas.find((t: any) => t.nome === form.turma || t.id === form.turma)?.nome || form.turma || 'N/A'} readOnly />
            </div>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tipo <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select 
                id="tipo"
                name="tipo"
                className="form-input" 
                style={{ 
                  height: '36px', 
                  borderRadius: '10px', 
                  background: '#f8fafc', 
                  border: hasError('tipo') ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
                  fontSize: '13px',
                  boxShadow: hasError('tipo') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  outline: 'none',
                  transition: 'all 0.2s'
                }} 
                value={form.tipo} 
                onChange={e => {
                  s('tipo', e.target.value)
                  clearError('tipo')
                }}
              >
                {tiposOcorrencia.length > 0 ? (
                  tiposOcorrencia.map(t => <option key={t.label} value={t.label}>{t.label}</option>)
                ) : (
                  TIPOS_FALLBACK.map(t => <option key={t}>{t}</option>)
                )}
              </select>
            </div>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Gravidade <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div 
                id="gravidade"
                style={{ 
                  display:'flex', 
                  gap:6,
                  border: hasError('gravidade') ? '1.5px solid #ef4444' : 'none',
                  borderRadius: '10px',
                  padding: hasError('gravidade') ? '2px' : '0',
                  boxShadow: hasError('gravidade') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {(['leve','media','grave'] as GravOcorrencia[]).map(g => (
                  <button key={g} type="button" onClick={() => { s('gravidade', g); clearError('gravidade') }}
                    style={{ flex:1, height: '36px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:`1px solid ${form.gravidade===g ? GRAV_CONFIG[g].color : '#e2e8f0'}`, background: form.gravidade===g ? GRAV_CONFIG[g].bg : '#f8fafc', color: form.gravidade===g ? GRAV_CONFIG[g].color : '#64748b', transition: 'all 0.2s' }}>
                    {GRAV_CONFIG[g].label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Data <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                id="data"
                name="data"
                className="form-input" 
                style={{ 
                  height: '36px', 
                  borderRadius: '10px', 
                  background: '#f8fafc', 
                  border: hasError('data') ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
                  fontSize: '13px',
                  boxShadow: hasError('data') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  outline: 'none',
                  transition: 'all 0.2s'
                }} 
                type="date" 
                value={form.data} 
                onChange={e => {
                  s('data', e.target.value)
                  clearError('data')
                }} 
              />
            </div>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Responsável <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                id="responsavel"
                name="responsavel"
                className="form-input" 
                style={{ 
                  height: '36px', 
                  borderRadius: '10px', 
                  background: '#f8fafc', 
                  border: hasError('responsavel') ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
                  fontSize: '13px',
                  boxShadow: hasError('responsavel') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  outline: 'none',
                  transition: 'all 0.2s'
                }} 
                value={form.responsavel} 
                onChange={e => {
                  s('responsavel', e.target.value)
                  clearError('responsavel')
                }} 
                placeholder="Prof. ou Coord." 
              />
            </div>
            
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Descrição <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea 
                id="descricao"
                name="descricao"
                className="form-input" 
                style={{ 
                  borderRadius: '10px', 
                  background: '#f8fafc', 
                  border: hasError('descricao') ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
                  padding: '10px 12px', 
                  fontSize: '13px',
                  boxShadow: hasError('descricao') ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
                  outline: 'none',
                  transition: 'all 0.2s'
                }} 
                rows={3} 
                value={form.descricao} 
                onChange={e => {
                  s('descricao', e.target.value)
                  clearError('descricao')
                }} 
                placeholder="Descreva detalhadamente o ocorrido..." 
              />
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Anexo (Opcional)</label>
              {form.anexoUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '6px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {form.anexoTipo?.includes('image') ? <ImageIcon size={16} /> : <FileText size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.anexoNome}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{form.anexoTamanho ? (form.anexoTamanho / 1024).toFixed(1) : 0} KB</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => { s('anexoUrl', ''); s('anexoNome', ''); s('anexoTipo', ''); s('anexoTamanho', 0) }} style={{ border: 'none', background: '#fee2e2', color: '#ef4444', width: 28, height: 28, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 14px', border: '1.5px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isUploading ? 0.7 : 1 }}>
                  {isUploading ? (
                    <>
                      <Loader2 size={16} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Enviando arquivo...</div>
                    </>
                  ) : (
                    <>
                      <Paperclip size={14} style={{ color: '#64748b' }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Clique para anexar documento ou foto (Máx: 10MB)</span>
                    </>
                  )}
                  <input type="file" style={{ display: 'none' }} disabled={isUploading} onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 50 * 1024 * 1024) { alert('Arquivo muito grande! Máximo 50MB.'); return; }
                    setIsUploading(true)
                    try {
                        let fileToUpload: File = file;

                        if (file.type.startsWith('image/')) {
                          fileToUpload = await compressImage(file, { quality: 0.80, format: 'image/webp' });
                        } else if (file.type.startsWith('video/')) {
                          fileToUpload = await compressVideo(file, (percent) => {}) as File;
                        }

                        // Upload centralizado (Cache-Control: 30 dias)
                        const uploadRes = await uploadFileToSupabase({
                          bucket: 'comunicados-midia',
                          folder: 'ocorrencias',
                          file: fileToUpload,
                          usageType: 'common' // Ocorrências podem ter anexos comuns
                        });

                        if (!uploadRes.ok || !uploadRes.url) {
                          alert(uploadRes.error || 'Falha no envio do anexo.');
                          return;
                        }

                        s('anexoUrl', uploadRes.url)
                        s('anexoNome', fileToUpload.name)
                        s('anexoTipo', fileToUpload.type)
                        s('anexoTamanho', fileToUpload.size)
                    } catch(err) { alert('Erro na conexão ao enviar anexo.') }
                    finally { setIsUploading(false); e.target.value = '' }
                  }} />
                </label>
              )}
            </div>
          </div>
          
          <div style={{ display:'flex', gap:12, marginTop:20, justifyContent:'flex-end' }}>
            <button style={{ height: '40px', padding: '0 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onClick={onClose}>
              Cancelar
            </button>
            <button style={{ height: '40px', padding: '0 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)', transition: 'all 0.2s' }} onClick={onSave}>
              <CheckCircle size={16} />
              <span>Salvar Ocorrência</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OcorrenciasPage() {
  const { data: rawOcorrencias, refetch: refetchOcorrencias, isLoading: isLoadingOcorrencias, isFetching: isFetchingOcorrencias } = useApiQuery<any[]>(
    ['ocorrencias'],
    `/api/ocorrencias`,
    {},
    { noCache: true }
  );
  const { cfgCalendarioLetivo = [], cfgNiveisEnsino = [] } = useData();
  const { currentUser: authUser } = useApp();
  const currentUser: any = authUser || {};
  
  const { data: rawTurmas, isLoading: isLoadingTurmas } = useApiQuery<any[]>(['turmas'], `/api/turmas`);
  const { data: rawAlunos, isLoading: isLoadingAlunos } = useApiQuery<any[]>(['alunos'], `/api/alunos?all=true&lightweight=true`);
  // Removido endpoint 404 edu-cfg-tipos-ocorrencia
  const rawCfgTipos: any[] = []; const isLoadingTipos = false;

  const ocorrencias = rawOcorrencias || [];
  const turmas = (rawTurmas as any)?.data || [];
  const cfgTiposOcorrencia = rawCfgTipos || [];
  const alunos = (rawAlunos as any)?.data || rawAlunos || [];

  const tiposAtivos = cfgTiposOcorrencia
    .filter(t => t.situacao === 'ativo')
    .map(t => ({ label: t.descricao, gravidade: t.gravidade }))

  const [turmaSel, setTurmaSel] = useState<string | null>(null)
  const [modoHome, setModoHome] = useState<'turma'|'aluno'>('turma')
  const [buscaAlunoHome, setBuscaAlunoHome] = useState('')
  const [alunoSel, setAlunoSel] = useState<{id:string;nome:string;turma:string}|null>(null)

  const [filtroAno, setFiltroAno] = useState('todos')
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [filtroBuscaHome, setFiltroBuscaHome] = useState('')

  useEffect(() => {
    const vigente = cfgCalendarioLetivo.find((c: any) => c.status === 'Aberto' || c.isVigente)
    if (vigente) {
      setFiltroAno(String(vigente.ano))
    }
  }, [cfgCalendarioLetivo])
  const anosDisponiveis = useMemo(() => [...new Set(turmas.map((t: any) => t.ano))].sort().reverse(), [turmas])
  
  const seriesDisponiveis = useMemo(() => {
    let levels = cfgNiveisEnsino
    if (filtroSeg !== 'todos') {
      levels = cfgNiveisEnsino.filter((n: any) => n.nome === filtroSeg)
    }
    const allSeries = levels.flatMap((n: any) => n.series || [])
    return [...new Set(allSeries.map((s: any) => s.nome))].sort()
  }, [cfgNiveisEnsino, filtroSeg])

  const [filtroGrav, setFiltroGrav] = useState<GravOcorrencia | 'todas'>('todas')
  const [busca, setBusca] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Ocorrencia,'id'|'createdAt'>>(BLANK)
  const [metaCriacao, setMetaCriacao] = useState('')
  const [metaConfirmacao, setMetaConfirmacao] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [validationErrors, setValidationErrors] = useState<{ field: string; label: string }[]>([])
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [turmaSel, filtroGrav, busca])

  const alunosDaTurmaAtual = useMemo(() => {
    if (!turmaSel) return alunos.map((a: any) => ({ id: a.id, nome: a.nome, turma: a.turma || '' }))
    return alunos
      .filter((a: any) =>
        a.turma === turmaSel ||
        (a as any).turmaId === turmas.find((t: any) => t.nome === turmaSel)?.id
      )
      .map((a: any) => ({ id: a.id, nome: a.nome, turma: a.turma || '' }))
  }, [alunos, turmaSel, turmas])
  
  const todosAlunosMapped = useMemo(() => alunos.map((a: any) => ({ id: a.id, nome: a.nome, turma: a.turma || '' })), [alunos])
  const selectedTurmaObj = turmas.find((t: any) => t.nome === turmaSel)
  const ocDaTurma = turmaSel ? ocorrencias.filter(o => o.turma === turmaSel || o.turma === selectedTurmaObj?.id) : []
  const filtered = ocDaTurma.filter(o => {
    const mg = filtroGrav === 'todas' || o.gravidade === filtroGrav
    const mb = !busca || o.alunoNome?.toLowerCase().includes(busca.toLowerCase()) || o.tipo?.toLowerCase().includes(busca.toLowerCase())
    return mg && mb
  })

  const paginatedOcorrencias = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  const openNew = () => {
    setEditingId(null)
    setMetaCriacao('')
    setMetaConfirmacao('')
    const primeiroTipo = tiposAtivos[0]?.label || TIPOS_FALLBACK[0]
    setForm({ ...BLANK, turma: turmaSel ?? '', tipo: primeiroTipo })
    setValidationErrors([])
    setIsValidationModalOpen(false)
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return
    setEditingId(id)
    
    const lines = oc.descricao.split('\n')
    let lancadoLine = ''
    let editadoLine = ''
    let confirmadoLine = ''
    let resto = []
    
    for (const line of lines) {
      if (line.startsWith('[Lançado por:')) lancadoLine = line
      else if (line.startsWith('[Editado por:')) editadoLine = line
      else if (line.startsWith('[Confirmado por:')) confirmadoLine = line
      else resto.push(line)
    }
    
    setMetaCriacao(lancadoLine)
    setMetaConfirmacao(confirmadoLine)
    
    setForm({ 
      alunoId: oc.alunoId || oc.aluno_id || '', 
      alunoNome: oc.alunoNome, 
      turma: oc.turma, 
      tipo: oc.tipo, 
      descricao: resto.join('\n').trim(), 
      gravidade: oc.gravidade as GravOcorrencia, 
      data: oc.data, 
      responsavel: oc.responsavel, 
      ciencia_responsavel: oc.ciencia_responsavel,
      anexoUrl: oc.anexoUrl || '',
      anexoNome: oc.anexoNome || '',
      anexoTipo: oc.anexoTipo || '',
      anexoTamanho: oc.anexoTamanho || 0
    })
    setValidationErrors([])
    setIsValidationModalOpen(false)
    setModalOpen(true)
  }

  const validateForm = () => {
    const errors: { field: string; label: string }[] = []

    if (!form.alunoId || !form.alunoNome.trim()) {
      errors.push({ field: 'alunoId', label: 'Aluno' })
    }
    if (!form.tipo || !form.tipo.trim()) {
      errors.push({ field: 'tipo', label: 'Tipo' })
    }
    if (!form.gravidade || !form.gravidade.trim()) {
      errors.push({ field: 'gravidade', label: 'Gravidade' })
    }
    if (!form.data || !form.data.trim()) {
      errors.push({ field: 'data', label: 'Data' })
    }
    if (!form.responsavel || !form.responsavel.trim()) {
      errors.push({ field: 'responsavel', label: 'Responsável' })
    }
    if (!form.descricao || !form.descricao.trim()) {
      errors.push({ field: 'descricao', label: 'Descrição' })
    }

    return errors
  }

  const handleSave = async () => {
    const errors = validateForm()
    if (errors.length > 0) {
      setValidationErrors(errors)
      setIsValidationModalOpen(true)
      return
    }
    
    const now = new Date()
    const dataHora = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    
    let userInfo = ''
    if (editingId) {
      const editInfo = `[Editado por: ${currentUser?.nome || 'Usuário'} em ${dataHora}]`
      userInfo = metaCriacao ? `${metaCriacao}\n${editInfo}` : editInfo
      if (metaConfirmacao) userInfo += `\n${metaConfirmacao}`
    } else {
      userInfo = `[Lançado por: ${currentUser?.nome || 'Usuário'} em ${dataHora}]`
    }

    const payload = {
      ...form,
      id: editingId,
      turma: turmaSel ?? form.turma,
      descricao: form.descricao ? `${userInfo}\n${form.descricao}` : userInfo
    }
    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        refetchOcorrencias()
        setModalOpen(false)
      } else {
        const err = await response.json()
        alert('Erro ao salvar: ' + (err.error || response.statusText))
      }
    } catch (error: any) {
      alert('Erro na requisição: ' + error.message)
    }
  }

  const marcarCiencia = async (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return
    
    const now = new Date()
    const dataHora = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const confirmInfo = `[Confirmado por: ${currentUser?.nome || 'Usuário'} em ${dataHora}]`
    
    const payload = { 
      ...oc, 
      ciencia_responsavel: true,
      descricao: oc.descricao ? `${oc.descricao}\n${confirmInfo}` : confirmInfo
    }
    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        refetchOcorrencias()
      }
    } catch (error) {
      console.error('Erro ao marcar ciência:', error)
    }
  }

  const desfazerCiencia = async (id: string) => {
    const oc = ocorrencias.find(o => o.id === id)
    if (!oc) return
    
    const lines = oc.descricao.split('\n')
    const filteredLines = lines.filter((l: string) => !l.startsWith('[Confirmado por:'))
    
    const payload = { 
      ...oc, 
      ciencia_responsavel: false,
      descricao: filteredLines.join('\n').trim()
    }
    try {
      const response = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        refetchOcorrencias()
      }
    } catch (error) {
      console.error('Erro ao desfazer ciência:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta ocorrência?')) return
    try {
      const response = await fetch(`/api/ocorrencias?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        refetchOcorrencias()
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
    }
  }

  // ── HOME: dashboard pedagógico ────────────────────────────────────────────
  if (!turmaSel) {
    const totalOC = ocorrencias.length
    const pendentes = ocorrencias.filter(o => !o.ciencia_responsavel).length
    const graves = ocorrencias.filter(o => o.gravidade === 'grave').length
    const gravesPendentes = ocorrencias.filter(o => o.gravidade === 'grave' && !o.ciencia_responsavel).length
    
    const turmasFiltradas = turmas.filter((t: any) => {
      const levelOfTurma = cfgNiveisEnsino.find((n: any) => n.series?.some((s: any) => s.nome === t.serie))
      const levelName = levelOfTurma?.nome || ''
      
      return (filtroAno === 'todos' || String(t.ano) === filtroAno) &&
             (filtroSeg === 'todos' || levelName === filtroSeg) &&
             (!filtroBuscaHome || t.serie === filtroBuscaHome)
    })

    const reincidentes = (() => {
      const map: Record<string, { id: string; nome: string; turma: string; count: number; graves: number }> = {}
      ocorrencias.forEach(o => {
        const aId = o.alunoId || o.aluno_id;
        if (!aId) return;
        if (!map[aId]) map[aId] = { id: aId, nome: o.alunoNome || 'Sem Nome', turma: o.turma, count: 0, graves: 0 }
        map[aId].count++
        if (o.gravidade === 'grave') map[aId].graves++
      })
      return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
    })()

    const tiposCount = (() => {
      const map: Record<string, number> = {}
      ocorrencias.forEach(o => { map[o.tipo] = (map[o.tipo] ?? 0) + 1 })
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
    })()
    const maxTipo = tiposCount[0]?.[1] ?? 1
    const ultimasOC = [...ocorrencias].sort((a, b) => {
      const dateA = a.createdAt || a.created_at || ''
      const dateB = b.createdAt || b.created_at || ''
      return dateB.localeCompare(dateA)
    }).slice(0, 5)

    const leves = ocorrencias.filter(o => o.gravidade === 'leve').length
    const medias = ocorrencias.filter(o => o.gravidade === 'media').length

    // ── MODO ALUNO ────────────────────────────────────────────────────────
    if (modoHome === 'aluno') {
      const todosMapped = alunos.map((a: any) => ({ id:a.id, nome:a.nome, turma:a.turma||'' }))
      const filteredAlunos = buscaAlunoHome.trim().length > 0
        ? todosMapped.filter((a: any) => a.nome.toLowerCase().includes(buscaAlunoHome.toLowerCase())).slice(0,12)
        : []
      const ocDoAluno = alunoSel ? ocorrencias.filter(o => o.alunoId === alunoSel.id || o.aluno_id === alunoSel.id).sort((a,b) => {
        const dateA = a.createdAt || a.created_at || ''
        const dateB = b.createdAt || b.created_at || ''
        return dateB.localeCompare(dateA)
      }) : []

      const printRelatorio = () => {
        if (!alunoSel) return
        const win = window.open('', '_blank')
        if (!win) return
        win.document.write(`<html><head><title>Relatório de Ocorrências — ${alunoSel.nome}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#1a1a2e}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0;font-weight:bold}.grave{color:#dc2626}.media{color:#ef4444}.leve{color:#f59e0b}</style></head><body>`)
        win.document.write(`<h1>Relatório de Ocorrências Disciplinares</h1>`)
        win.document.write(`<p><strong>Aluno:</strong> ${alunoSel.nome} | <strong>Turma:</strong> ${alunoSel.turma} | <strong>Total:</strong> ${ocDoAluno.length}</p>`)
        win.document.write(`<table><thead><tr><th>Data</th><th>Tipo</th><th>Gravidade</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`)
        ocDoAluno.forEach(o => {
          win.document.write(`<tr><td>${o.data}</td><td>${o.tipo}</td><td class="${o.gravidade}">${o.gravidade.toUpperCase()}</td><td>${o.descricao}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel?'Sim':'Não'}</td></tr>`)
        })
        win.document.write(`</tbody></table></body></html>`)
        win.document.close()
        win.print()
      }

      return (
        <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <button style={{ border: '1px solid #e2e8f0', background: '#fff', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }} onClick={() => { setModoHome('turma'); setAlunoSel(null); setBuscaAlunoHome('') }}><ArrowLeft size={18} /></button>
              <div>
                <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, color: '#0f172a', margin: 0 }}>Ocorrências por Aluno</h1>
                <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Histórico individual de ocorrências disciplinares.</p>
              </div>
            </div>
            {alunoSel && (
              <button style={{ height: '42px', padding: '0 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={printRelatorio}><Printer size={16} />Imprimir Relatório</button>
            )}
          </div>

          {/* Busca aluno */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <div style={{ fontWeight:700, fontSize:14, color: '#0f172a', marginBottom:12 }}>🔍 Buscar Aluno</div>
            <div style={{ position:'relative' }}>
              <Search size={18} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
              <input className="form-input" style={{ paddingLeft:42, height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} placeholder="Digite o nome do aluno..."
                value={buscaAlunoHome} onChange={e => { setBuscaAlunoHome(e.target.value); setAlunoSel(null) }} autoFocus />
            </div>
            {isLoadingAlunos ? (
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:'transparent', border:'1px solid #e2e8f0', borderRadius:12 }}>
                    <Skeleton w="40px" h="40px" borderRadius="10px" />
                    <div style={{ flex: 1 }}>
                      <Skeleton w="40%" h="14px" style={{ marginBottom: '4px' }} />
                      <Skeleton w="20%" h="12px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredAlunos.length > 0 && !alunoSel && (
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                {filteredAlunos.map((a: any) => (
                  <button key={a.id} type="button"
                    onClick={() => setAlunoSel(a)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:'transparent', border:'1px solid #e2e8f0', borderRadius:12, cursor:'pointer', textAlign:'left', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:40,height:40,borderRadius:10,background:'rgba(37, 99, 235, 0.1)',color:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700 }}>{getInitials(a.nome)}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color: '#0f172a' }}>{a.nome}</div>
                      <div style={{ fontSize:12, color:'#64748b' }}>{a.turma || 'Sem turma'} • {ocorrencias.filter(o=>o.alunoId===a.id).length} ocorrência(s)</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Histórico do aluno */}
          {alunoSel && (
            <div>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', borderLeft: '4px solid #2563eb' }}>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ width:48,height:48,borderRadius:12,background:'rgba(37, 99, 235, 0.1)',color:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700 }}>{getInitials(alunoSel.nome)}</div>
                  <div>
                    <div style={{ fontWeight:900, fontSize:18, color: '#0f172a', fontFamily: 'Outfit,sans-serif' }}>{alunoSel.nome}</div>
                    <div style={{ fontSize:13, color:'#64748b' }}>{alunoSel.turma} • {ocDoAluno.length} ocorrência(s) no histórico</div>
                  </div>
                  <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                    {(['leve','media','grave'] as const).map(g => (
                      <div key={g} style={{ padding:'6px 12px', borderRadius:20, background:GRAV_CONFIG[g].bg, border:`1px solid ${GRAV_CONFIG[g].border}`, fontSize:11, fontWeight:700, color:GRAV_CONFIG[g].color }}>
                        {GRAV_CONFIG[g].label}: {ocDoAluno.filter(o=>o.gravidade===g).length}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {isLoadingOcorrencias ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ padding: '16px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                      <Skeleton w="40%" h="16px" style={{ marginBottom: '8px' }} />
                      <Skeleton w="80%" h="12px" />
                    </div>
                  ))}
                </div>
              ) : ocDoAluno.length === 0 ? (
                <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>
                  ✓ Nenhuma ocorrência registrada para este aluno.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {ocDoAluno.map(oc => {
                    const cfg = GRAV_CONFIG[oc.gravidade as GravOcorrencia] ?? GRAV_CONFIG.leve
                    return (
                      <div key={oc.id} style={{ display:'flex', gap:16, padding:'16px 20px', background:'#fff', borderTop: `1px solid #e2e8f0`, borderRight: `1px solid #e2e8f0`, borderBottom: `1px solid #e2e8f0`, borderLeft: `4px solid ${cfg.color}`, borderRadius:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                            <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>{oc.tipo}</span>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:cfg.bg, color:cfg.color, fontWeight:700 }}>{cfg.label}</span>
                            {oc.turma && <span style={{ fontSize:12, color:'#64748b' }}>Turma: {oc.turma}</span>}
                            {oc.anexoUrl && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'2px 8px', borderRadius:4, background:'#f0f9ff', color:'#0284c7', fontWeight:700 }}><Paperclip size={12} />Anexo</span>}
                          </div>
                          
                          {(() => {
                            const lines = oc.descricao.split('\n')
                            let lancado = ''
                            let editado = ''
                            let confirmado = ''
                            let resto = []
                            
                            for (const line of lines) {
                              if (line.startsWith('[Lançado por:')) lancado = line.replace('[Lançado por: ', '').replace(']', '')
                              else if (line.startsWith('[Editado por:')) editado = line.replace('[Editado por: ', '').replace(']', '')
                              else if (line.startsWith('[Confirmado por:')) confirmado = line.replace('[Confirmado por: ', '').replace(']', '')
                              else resto.push(line)
                            }
                            
                            const infoReal = resto.join('\n').trim()
                            
                            return (
                              <>
                                <p style={{ fontSize:14, color:'#334155', lineHeight:1.5, marginBottom:6, marginTop: 8 }}>{infoReal || oc.descricao}</p>
                                
                                <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop: 8, background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                  {lancado && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                                      <Clock size={12} style={{ color: '#2563eb' }} />
                                      <span>Registrado por <strong>{lancado}</strong></span>
                                    </div>
                                  )}
                                  {editado && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                                      <Pencil size={12} style={{ color: '#10b981' }} />
                                      <span>Editado por <strong>{editado}</strong></span>
                                    </div>
                                  )}
                                  {confirmado && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                                      <CheckCircle size={12} style={{ color: '#10b981' }} />
                                      <span>Confirmado por <strong>{confirmado}</strong></span>
                                    </div>
                                  )}
                                </div>
                              </>
                            )
                          })()}

                          <div style={{ display:'flex', gap:16, fontSize:12, color:'#64748b', marginTop: 8 }}>
                            {oc.data && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} />{oc.data}</span>}
                            {oc.responsavel && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} />{oc.responsavel}</span>}
                          </div>
                        </div>
                        <div style={{ alignSelf: 'center' }}>
                          {oc.ciencia_responsavel
                            ? <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} />Ciência confirmada</span>
                            : <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14} />Aguardando</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        {/* Header Ultra Moderno */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={20} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Gestão Disciplinar</span>
            </div>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Ocorrências Escolares</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Monitore o comportamento e aplique medidas pedagógicas.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', background: '#fff', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <button 
                onClick={() => setModoHome('turma')}
                style={{ height: '36px', padding: '0 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              >
                <Users size={16} />
                <span>Por Turma</span>
              </button>
              <button 
                onClick={() => setModoHome('aluno')}
                style={{ height: '36px', padding: '0 16px', background: 'transparent', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              >
                <Search size={16} />
                <span>Por Aluno</span>
              </button>
            </div>
          </div>
        </div>

        {/* Alerta urgente: graves pendentes */}
        {gravesPendentes > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 24px', background:'rgba(239, 68, 68, 0.05)', borderTop: '1px solid #fecaca', borderRight: '1px solid #fecaca', borderBottom: '1px solid #fecaca', borderRadius: 16, marginBottom: 24, borderLeft: '4px solid #ef4444' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px', borderRadius: '12px' }}>
              <AlertTriangle size={24} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:15, color:'#b91c1c' }}>{gravesPendentes} ocorrência{gravesPendentes > 1 ? 's' : ''} grave{gravesPendentes > 1 ? 's' : ''} aguardando ciência</div>
              <div style={{ fontSize:13, color:'#7f1d1d', marginTop:2 }}>Ação imediata necessária para garantir o alinhamento com os responsáveis.</div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', background:'#fee2e2', padding:'4px 12px', borderRadius:20, border:'1px solid #fecaca' }}>ALERTA</div>
          </div>
        )}


        {/* Segundo nível: tipos + reincidentes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginBottom:32 }}>
          {/* Tipos mais frequentes */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight:800, fontSize:14, color: '#0f172a', marginBottom:16, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart size={16} style={{ color: '#2563eb' }} />
              <span>Tipos Mais Frequentes</span>
            </div>
            {isLoadingOcorrencias ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <Skeleton w="60%" h="12px" />
                      <Skeleton w="20px" h="12px" />
                    </div>
                    <Skeleton w="100%" h="6px" />
                  </div>
                ))}
              </div>
            ) : tiposCount.length === 0 ? (
              <div style={{ fontSize:13, color:'#94a3b8', textAlign:'center', padding:'20px 0' }}>Sem dados</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {tiposCount.map(([tipo, count]) => {
                  const pct = (count / maxTipo) * 100
                  return (
                    <div key={tipo}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'#475569' }}>{tipo}</span>
                        <span style={{ fontSize:12, fontWeight:800, color:'#0f172a' }}>{count}</span>
                      </div>
                      <div style={{ height:6, borderRadius:3, background:'#f1f5f9' }}>
                        <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg, #2563eb, #3b82f6)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

            {/* Alunos reincidentes */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontWeight:800, fontSize:14, color: '#0f172a', marginBottom:16, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                <span>Alunos Reincidentes</span>
              </div>
              {isLoadingOcorrencias ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Skeleton w="24px" h="24px" borderRadius="6px" />
                      <div style={{ flex: 1 }}>
                        <Skeleton w="60%" h="12px" style={{ marginBottom: '4px' }} />
                        <Skeleton w="40%" h="10px" />
                      </div>
                      <Skeleton w="20px" h="20px" />
                    </div>
                  ))}
                </div>
              ) : reincidentes.length === 0 ? (
              <div style={{ fontSize:13, color:'#10b981', textAlign:'center', padding:'20px 0', fontWeight:600 }}>✓ Nenhum reincidente</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {reincidentes.map((r, i) => (
                  <div key={`${r.id || 'aluno'}-${i}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 10px', background: i === 0 ? 'rgba(239,68,68,0.05)' : 'transparent', borderRadius:10, border: i === 0 ? '1px solid rgba(239,68,68,0.1)' : '1px solid transparent' }}>
                    <div style={{ width:24, height:24, borderRadius:6, background: i === 0 ? '#ef4444' : '#f1f5f9', color: i === 0 ? '#fff' : '#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                      {i + 1}º
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color: '#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.nome}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{r.turma}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:16, fontWeight:900, color: r.count >= 3 ? '#ef4444' : '#f59e0b', fontFamily:'Outfit,sans-serif' }}>{r.count}</div>
                      {r.graves > 0 && <div style={{ fontSize:10, color:'#dc2626', fontWeight:700 }}>{r.graves} grave{r.graves > 1 ? 's' : ''}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Últimas ocorrências */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight:800, fontSize:14, color: '#0f172a', marginBottom:16, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: '#10b981' }} />
              <span>Registro Recente</span>
            </div>
            {isLoadingOcorrencias ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                    <Skeleton w="40px" h="16px" borderRadius="4px" />
                  </div>
                ))}
              </div>
            ) : ultimasOC.length === 0 ? (
              <div style={{ fontSize:13, color:'#94a3b8', textAlign:'center', padding:'20px 0' }}>Sem registros</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {ultimasOC.map((oc, idx) => {
                  const cfg = GRAV_CONFIG[oc.gravidade as GravOcorrencia] ?? GRAV_CONFIG.leve
                  return (
                    <div key={oc.id || idx} style={{ display:'flex', gap:10, alignItems:'center', paddingBottom:10, borderBottom:'1px solid #f1f5f9' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color: '#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{oc.alunoNome}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{oc.tipo} • {oc.turma}</div>
                      </div>
                      <div style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:cfg.bg, color:cfg.color, fontWeight:700, flexShrink:0 }}>
                        {cfg.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
            <div style={{ position:'relative', flex: 1, maxWidth: '400px' }}>
              {isLoadingTurmas ? (
                <Skeleton w="100%" h="44px" />
              ) : (
                <>
                  <Users size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
                  <select 
                    className="form-input" 
                    style={{ width: '100%', paddingLeft:40, height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '14px' }} 
                    value={filtroBuscaHome} 
                    onChange={e => setFiltroBuscaHome(e.target.value)}
                  >
                    <option value="">Todas as Séries</option>
                    {seriesDisponiveis.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            
            <div style={{ width: '140px' }}>
              {cfgCalendarioLetivo.length === 0 ? (
                <Skeleton w="100%" h="44px" />
              ) : (
                <select className="form-input" style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                  <option value="todos">Anos Letivos</option>
                  {cfgCalendarioLetivo.map((c: any) => <option key={c.id} value={c.ano}>{c.ano}</option>)}
                </select>
              )}
            </div>

            <div style={{ width: '160px' }}>
              {cfgNiveisEnsino.length === 0 ? (
                <Skeleton w="100%" h="44px" />
              ) : (
                <select 
                  className="form-input" 
                  style={{ width: '100%', height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '14px' }} 
                  value={filtroSeg} 
                  onChange={e => setFiltroSeg(e.target.value)}
                >
                  <option value="todos">Segmentos</option>
                  {cfgNiveisEnsino.map((n: any) => (
                    <option key={n.id} value={n.nome}>{n.nome}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Filtrando: </span>
            <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{turmasFiltradas.length} turmas</span>
            {isFetchingOcorrencias && <UpdatingIndicator />}
          </div>
        </div>

        {/* Tabela de Turmas (Substituindo os Cards) */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turma</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Segmento</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alunos</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ocorrências</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Graves</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pendentes</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingTurmas ? (
                  <TableSkeleton rows={5} cols={7} />
                ) : turmasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={32} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>Nenhuma turma encontrada</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  turmasFiltradas.map((turma: any) => {
                    const color = SEG_COLORS[turma.serie] ?? '#3b82f6'
                    const ocTurma = ocorrencias.filter(o => o.turma === turma.nome || o.turma === turma.id)
                    const pendTurma = ocTurma.filter(o => !o.ciencia_responsavel).length
                    const gravesTurma = ocTurma.filter(o => o.gravidade === 'grave').length
                    const gravesPend = ocTurma.filter(o => o.gravidade === 'grave' && !o.ciencia_responsavel).length
                    const alunosTurma = alunos.filter((a: any) => a.turma === turma.nome || a.turma === turma.id || a.turmaId === turma.id).length
                    
                    const isUrgent = gravesPend > 0

                    return (
                      <tr key={turma.id} style={{ background: '#fff', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <td style={{ padding: '16px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #f1f5f9', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{turma.nome}</p>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{turma.serie} • {turma.turno}</p>
                          </div>
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{turma.serie}</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{alunosTurma}</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{ocTurma.length}</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: gravesTurma > 0 ? '#ef4444' : '#64748b',
                            background: gravesTurma > 0 ? '#fee2e2' : 'transparent',
                            padding: gravesTurma > 0 ? '2px 6px' : '0',
                            borderRadius: '4px'
                          }}>
                            {gravesTurma}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: pendTurma > 0 ? '#f59e0b' : '#10b981',
                            background: pendTurma > 0 ? '#fef3c7' : 'transparent',
                            padding: pendTurma > 0 ? '2px 6px' : '0',
                            borderRadius: '4px'
                          }}>
                            {pendTurma}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
                            <button 
                              onClick={() => { setTurmaSel(turma.nome); setFiltroGrav('todas'); setBusca('') }}
                              style={{ background: 'transparent', border: 'none', color: isUrgent ? '#ef4444' : '#2563eb', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              Gerenciar <ChevronRight size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingId(null);
                                const primeiroTipo = tiposAtivos[0]?.label || TIPOS_FALLBACK[0];
                                setForm({ ...BLANK, turma: turma.nome, tipo: primeiroTipo });
                                setValidationErrors([]);
                                setIsValidationModalOpen(false);
                                setModalOpen(true);
                              }}
                              style={{ height: '32px', padding: '0 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                              onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                            >
                              <Plus size={14} /> Nova
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        {modalOpen && (
          <OcorrenciaModal 
            form={form} 
            setForm={setForm} 
            onSave={handleSave} 
            onClose={() => setModalOpen(false)} 
            alunosDaTurma={alunosDaTurmaAtual} 
            todosAlunos={todosAlunosMapped} 
            tiposOcorrencia={tiposAtivos} 
            turmas={turmas} 
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
          />
        )}

        {/* Modal Erros de Validação da Ocorrência */}
        {isValidationModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div 
              className="glass-card ultra-modal modal-enter-active shake-element" 
              style={{ 
                width: '100%', 
                maxWidth: 500, 
                padding: 32, 
                textAlign: 'center', 
                position: 'relative', 
                boxShadow: '0 30px 60px rgba(0,0,0,0.25)', 
                border: '1px solid rgba(255,255,255,0.08)',
                background: '#ffffff',
                borderRadius: '24px'
              }}
            >
              <button 
                onClick={() => setIsValidationModalOpen(false)} 
                style={{ position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#0f172a' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#64748b' }}
              >
                <X size={16} />
              </button>

              <div className="pulse-warning" style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1.5px dashed rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertTriangle size={28} color="#ef4444" />
              </div>

              <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>Campos Obrigatórios Pendentes</h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: '1.6', margin: '0 0 24px' }}>
                Por favor, preencha todos os dados da ocorrência para prosseguir com o salvamento.
              </p>

              <div style={{ textAlign: 'left', maxHeight: 240, overflowY: 'auto', background: 'rgba(248, 250, 252, 0.8)', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {validationErrors.map((err, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setIsValidationModalOpen(false)
                      const el = document.getElementsByName(err.field)[0] || document.getElementById(err.field)
                      if (el) {
                        (el as HTMLElement).focus()
                      }
                    }}
                    style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
                    <span>{err.label}</span>
                    <span style={{ fontSize: 10, color: '#3b82f6', marginLeft: 'auto', fontWeight: 600 }}>Focar Campo →</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsValidationModalOpen(false)}
                className="neo-btn neo-btn-primary"
                style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff' }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vista interna: ocorrências da turma ──────────────────────────────────
  const turmaObj = turmas.find((t: any) => t.nome === turmaSel)
  const color = SEG_COLORS[turmaObj?.serie ?? ''] ?? '#3b82f6'

  const printRelatorioTurma = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Ocorrências — ${turmaSel}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0}.grave{color:#dc2626}.media{color:#ef4444}.leve{color:#f59e0b}</style></head><body>`)
    win.document.write(`<h1>Ocorrências — ${turmaSel}</h1><p>Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>`)
    win.document.write(`<table><thead><tr><th>Aluno</th><th>Data</th><th>Tipo</th><th>Gravidade</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`)
    filtered.forEach(o => {
      win.document.write(`<tr><td>${o.alunoNome}</td><td>${o.data}</td><td>${o.tipo}</td><td class="${o.gravidade}">${o.gravidade.toUpperCase()}</td><td>${o.descricao}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel?'Sim':'Não'}</td></tr>`)
    })
    win.document.write(`</tbody></table></body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'32px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button style={{ border: '1px solid #e2e8f0', background: '#fff', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }} onClick={() => setTurmaSel(null)}><ArrowLeft size={18} /></button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, color: '#0f172a', margin: 0 }}>Ocorrências — {turmaSel}</h1>
              <span style={{ padding:'2px 8px', borderRadius:4, background:`${color}15`, color, fontSize:11, fontWeight:700 }}>{turmaObj?.serie}</span>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0 0' }}>{ocDaTurma.length} ocorrência(s) • {alunosDaTurmaAtual.length} alunos</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button style={{ height: '42px', padding: '0 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={printRelatorioTurma}><Printer size={16} />Relatório da Turma</button>
          <button style={{ height: '42px', padding: '0 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }} onClick={openNew}><Plus size={16} />Nova Ocorrência</button>
        </div>
      </div>

      {/* KPIs da turma */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Total', value: ocDaTurma.length, color:'#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
          { label:'Graves', value: ocDaTurma.filter(o=>o.gravidade==='grave').length, color:'#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
          { label:'Aguardando Ciência', value: ocDaTurma.filter(o=>!o.ciencia_responsavel).length, color:'#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
          { label:'Resolvidas', value: ocDaTurma.filter(o=>o.ciencia_responsavel).length, color:'#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize:12, color:'#64748b', fontWeight: 600, marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:28, fontWeight:900, color:c.color, fontFamily:'Outfit,sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros internos */}
      <div style={{ display:'flex', gap:16, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
          <input className="form-input" style={{ paddingLeft:36, height: '40px', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0' }} placeholder="Buscar aluno ou tipo..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        
        <div style={{ display: 'flex', background: '#fff', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          {(['todas','leve','media','grave'] as const).map(f => (
            <button key={f} 
              onClick={() => setFiltroGrav(f)}
              style={{ height: '32px', padding: '0 12px', background: filtroGrav === f ? GRAV_CONFIG[f==='todas'?'leve':f].color : 'transparent', color: filtroGrav === f ? '#fff' : '#64748b', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {f==='todas' ? 'Todas' : GRAV_CONFIG[f].label}
            </button>
          ))}
        </div>
        
        <span style={{ fontSize:12, color:'#64748b', fontWeight: 500 }}>{filtered.length} resultados</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
          {ocDaTurma.length === 0
            ? <><CheckCircle size={36} style={{ margin:'0 auto 12px', color: '#94a3b8' }} /><div style={{ fontSize:14, fontWeight:600 }}>Nenhuma ocorrência nesta turma</div><button style={{ marginTop:16, height: '40px', padding: '0 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} onClick={openNew}><Plus size={14} /> Nova Ocorrência</button></>
            : <div>Nenhuma ocorrência com os filtros aplicados.</div>
          }
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {paginatedOcorrencias.map(oc => {
            const cfg = GRAV_CONFIG[oc.gravidade as GravOcorrencia] ?? GRAV_CONFIG.leve
            return (
              <div key={oc.id} style={{ display:'flex', gap:16, padding:'16px 20px', background:'#fff', borderTop: `1px solid #e2e8f0`, borderRight: `1px solid #e2e8f0`, borderBottom: `1px solid #e2e8f0`, borderLeft: `4px solid ${cfg.color}`, borderRadius: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow=`0 4px 6px -1px rgba(0,0,0,0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                <div style={{ width:40, height:40, borderRadius: 10, background:`${cfg.color}15`, color:cfg.color, flexShrink:0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                  {getInitials(oc.alunoNome)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontSize:15, fontWeight:700, color: '#0f172a' }}>{oc.alunoNome}</span>
                    <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>{oc.tipo}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:cfg.bg, color:cfg.color, fontWeight:700 }}>{cfg.label}</span>
                    {oc.anexoUrl && <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'2px 8px', borderRadius:4, background:'#f0f9ff', color:'#0284c7', fontWeight:700 }}><Paperclip size={12} />Anexo</span>}
                  </div>
                  
                  {(() => {
                    const lines = oc.descricao.split('\n')
                    let lancado = ''
                    let editado = ''
                    let confirmado = ''
                    let resto = []
                    
                    for (const line of lines) {
                      if (line.startsWith('[Lançado por:')) lancado = line.replace('[Lançado por: ', '').replace(']', '')
                      else if (line.startsWith('[Editado por:')) editado = line.replace('[Editado por: ', '').replace(']', '')
                      else if (line.startsWith('[Confirmado por:')) confirmado = line.replace('[Confirmado por: ', '').replace(']', '')
                      else resto.push(line)
                    }
                    
                    const infoReal = resto.join('\n').trim()
                    
                    return (
                      <>
                        <p style={{ fontSize:14, color:'#334155', lineHeight:1.5, marginBottom:6, marginTop: 4 }}>{infoReal || oc.descricao}</p>
                        
                        <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop: 8, background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          {lancado && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                              <Clock size={12} style={{ color: '#2563eb' }} />
                              <span>Registrado por <strong>{lancado}</strong></span>
                            </div>
                          )}
                          {editado && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                              <Pencil size={12} style={{ color: '#10b981' }} />
                              <span>Editado por <strong>{editado}</strong></span>
                            </div>
                          )}
                          {confirmado && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                              <CheckCircle size={12} style={{ color: '#10b981' }} />
                              <span>Confirmado por <strong>{confirmado}</strong></span>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}

                  <div style={{ display:'flex', gap:16, fontSize:12, color:'#64748b', marginTop: 8 }}>
                    {oc.data && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} />{oc.data}</span>}
                    {oc.responsavel && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} />{oc.responsavel}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', flexShrink:0 }}>
                  {oc.ciencia_responsavel
                    ? <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} />Ciência confirmada</span>
                    : <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', borderRadius: '20px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} />Aguardando</span>}
                  <div style={{ display:'flex', gap:4 }}>
                    <button style={{ border: '1px solid #e2e8f0', background: '#fff', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }} title="Editar" onClick={() => openEdit(oc.id)}><Pencil size={14} /></button>
                    {oc.ciencia_responsavel ? (
                      <button style={{ height: '32px', padding: '0 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => desfazerCiencia(oc.id)}>
                        <Undo size={14} />Desfazer
                      </button>
                    ) : (
                      <button style={{ height: '32px', padding: '0 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => marcarCiencia(oc.id)}>
                        <MessageSquare size={14} />Confirmar
                      </button>
                    )}
                    <button style={{ border: '1px solid #fee2e2', background: '#fff', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }} onClick={() => handleDelete(oc.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
          
          {/* Paginação */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', background: '#fff', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Mostrar:</span>
              <select 
                value={itemsPerPage} 
                onChange={e => setItemsPerPage(Number(e.target.value))}
                style={{ height: '32px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc', padding: '0 8px' }}
              >
                {[5, 10, 20, 50].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <span style={{ fontSize: '13px', color: '#64748b' }}>por página</span>
            </div>
            
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#cbd5e1' : '#475569' }}
              >
                ‹
              </button>
              
              {(() => {
                const totalPages = Math.ceil(filtered.length / itemsPerPage)
                return (
                  <span style={{ fontSize: '13px', color: '#475569', margin: '0 8px' }}>
                    Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong>
                  </span>
                )
              })()}
              
              <button 
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filtered.length / itemsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(filtered.length / itemsPerPage) || filtered.length === 0}
                style={{ height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: (currentPage === Math.ceil(filtered.length / itemsPerPage) || filtered.length === 0) ? 'not-allowed' : 'pointer', color: (currentPage === Math.ceil(filtered.length / itemsPerPage) || filtered.length === 0) ? '#cbd5e1' : '#475569' }}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <OcorrenciaModal 
          form={form} 
          setForm={setForm} 
          onSave={handleSave} 
          onClose={() => setModalOpen(false)} 
          alunosDaTurma={alunosDaTurmaAtual} 
          todosAlunos={todosAlunosMapped} 
          tiposOcorrencia={tiposAtivos} 
          turmas={turmas} 
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
        />
      )}

      {/* Modal Erros de Validação da Ocorrência */}
      {isValidationModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div 
            className="glass-card ultra-modal modal-enter-active shake-element" 
            style={{ 
              width: '100%', 
              maxWidth: 500, 
              padding: 32, 
              textAlign: 'center', 
              position: 'relative', 
              boxShadow: '0 30px 60px rgba(0,0,0,0.25)', 
              border: '1px solid rgba(255,255,255,0.08)',
              background: '#ffffff',
              borderRadius: '24px'
            }}
          >
            <button 
              onClick={() => setIsValidationModalOpen(false)} 
              style={{ position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#0f172a' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#64748b' }}
            >
              <X size={16} />
            </button>

            <div className="pulse-warning" style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1.5px dashed rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <AlertTriangle size={28} color="#ef4444" />
            </div>

            <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>Campos Obrigatórios Pendentes</h3>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: '1.6', margin: '0 0 24px' }}>
              Por favor, preencha todos os dados da ocorrência para prosseguir com o salvamento.
            </p>

            <div style={{ textAlign: 'left', maxHeight: 240, overflowY: 'auto', background: 'rgba(248, 250, 252, 0.8)', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {validationErrors.map((err, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    setIsValidationModalOpen(false)
                    const el = document.getElementsByName(err.field)[0] || document.getElementById(err.field)
                    if (el) {
                      (el as HTMLElement).focus()
                    }
                  }}
                  style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
                  <span>{err.label}</span>
                  <span style={{ fontSize: 10, color: '#3b82f6', marginLeft: 'auto', fontWeight: 600 }}>Focar Campo →</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsValidationModalOpen(false)}
              className="neo-btn neo-btn-primary"
              style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
