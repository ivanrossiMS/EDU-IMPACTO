'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useData, Ocorrencia, newId } from '@/lib/dataContext'
import { getInitials } from '@/lib/utils'
import { isAlunoCursandoTurma, getAlunoTurmaCursando } from '@/lib/studentTurmaUtils'
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

const cleanAlunoId = (id: any) => String(id || '').replace(/^a_?/, '').trim()

const doesOcMatchTurma = (o: any, turmaObj: any) => {
  if (!o || !turmaObj) return false
  const tId = String(turmaObj.id || '').trim().toLowerCase()
  const tNome = String(turmaObj.nome || '').trim().toLowerCase()
  const tCodigo = String(turmaObj.codigo || '').trim().toLowerCase()

  const oTurma = String(o.turma || '').trim().toLowerCase()
  const oTurmaId = String(o.turma_id || '').trim().toLowerCase().replace(/^sync-/, '')
  const oTurmaNome = String(o.turmaNome || '').trim().toLowerCase()

  if (tId && (oTurma === tId || oTurmaId === tId || oTurma === `sync-${tId}`)) return true
  if (tNome && (oTurma === tNome || oTurmaNome === tNome)) return true
  if (tCodigo && (oTurma === tCodigo || oTurmaId === tCodigo)) return true

  return false
}

const BLANK: Omit<Ocorrencia,'id'|'createdAt'> = {
  alunoId:'', alunoNome:'', turma:'',
  descricao:'', data:'', responsavel:'', ciencia_responsavel: false,
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

function OcorrenciaModal({ form, setForm, onSave, onClose, alunosDaTurma, todosAlunos, turmas, validationErrors, setValidationErrors, isEditing }: {
  form: Omit<Ocorrencia,'id'|'createdAt'>
  setForm: React.Dispatch<React.SetStateAction<Omit<Ocorrencia,'id'|'createdAt'>>>
  onSave: () => void; onClose: () => void
  alunosDaTurma: { id: string; nome: string; turma: string }[]
  todosAlunos: { id: string; nome: string; turma: string }[]
  turmas: any[]
  validationErrors: { field: string; label: string }[]
  setValidationErrors: React.Dispatch<React.SetStateAction<{ field: string; label: string }[]>>
  isEditing?: boolean
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
                {isEditing ? 'Editar Ocorrência' : 'Nova Ocorrência'}
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
                    if (file.size > 100 * 1024 * 1024) { alert('Arquivo muito grande! Máximo 100MB.'); return; }
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
  const { cfgCalendarioLetivo = [], cfgNiveisEnsino = [], cfgTiposOcorrencia = [] } = useData();
  const { currentUser: authUser } = useApp();
  const currentUser: any = authUser || {};
  
  const { data: rawTurmas, isLoading: isLoadingTurmas } = useApiQuery<any[]>(['turmas'], `/api/turmas`);
  const { data: rawAlunos, isLoading: isLoadingAlunos } = useApiQuery<any[]>(['alunos'], `/api/alunos?all=true&lightweight=true`);

  const ocorrencias = rawOcorrencias || [];
  const turmas = (rawTurmas as any)?.data || [];
  const alunos = (rawAlunos as any)?.data || rawAlunos || [];

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

  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'confirmadas'>('todas')
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
  }, [turmaSel, filtroStatus, busca])

  const selectedTurmaObj = useMemo(() => {
    if (!turmaSel) return null
    return (
      turmas.find((t: any) => t.nome === turmaSel && (filtroAno === 'todos' || String(t.ano) === filtroAno)) ||
      turmas.find((t: any) => t.nome === turmaSel || String(t.id) === String(turmaSel)) ||
      null
    )
  }, [turmas, turmaSel, filtroAno])

  const alunosDaTurmaAtual = useMemo(() => {
    if (!turmaSel) return alunos.map((a: any) => ({ id: a.id, nome: a.nome, turma: getAlunoTurmaCursando(a) || a.turma || '' }))
    return alunos
      .filter((a: any) =>
        a.turma === turmaSel ||
        (selectedTurmaObj && (
          a.turma === selectedTurmaObj.id ||
          (a as any).turmaId === selectedTurmaObj.id ||
          isAlunoCursandoTurma(a, selectedTurmaObj, selectedTurmaObj.ano, turmas)
        ))
      )
      .map((a: any) => ({ id: a.id, nome: a.nome, turma: selectedTurmaObj?.nome || getAlunoTurmaCursando(a) || a.turma || '' }))
  }, [alunos, turmaSel, turmas, selectedTurmaObj])
  
  const todosAlunosMapped = useMemo(() => alunos.map((a: any) => ({ id: a.id, nome: a.nome, turma: getAlunoTurmaCursando(a) || a.turma || '' })), [alunos])
  const ocDaTurma = turmaSel
    ? ocorrencias.filter(o =>
        selectedTurmaObj
          ? doesOcMatchTurma(o, selectedTurmaObj)
          : String(o.turma || '').trim().toLowerCase() === String(turmaSel).trim().toLowerCase()
      )
    : []
  const filtered = ocDaTurma.filter(o => {
    const ms = filtroStatus === 'todas'
      ? true
      : filtroStatus === 'pendentes'
        ? !o.ciencia_responsavel
        : o.ciencia_responsavel
    const mb = !busca || o.alunoNome?.toLowerCase().includes(busca.toLowerCase()) || o.descricao?.toLowerCase().includes(busca.toLowerCase())
    return ms && mb
  })

  const paginatedOcorrencias = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  const openNew = () => {
    setEditingId(null)
    setMetaCriacao('')
    setMetaConfirmacao('')
    setForm({ ...BLANK, turma: turmaSel ?? '' })
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
      descricao: resto.join('\n').trim(), 
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
    const confirmadas = ocorrencias.filter(o => o.ciencia_responsavel).length
    
    const turmasFiltradas = turmas.filter((t: any) => {
      const levelOfTurma = cfgNiveisEnsino.find((n: any) => n.series?.some((s: any) => s.nome === t.serie))
      const levelName = levelOfTurma?.nome || ''
      
      return (filtroAno === 'todos' || String(t.ano) === filtroAno) &&
             (filtroSeg === 'todos' || levelName === filtroSeg) &&
             (!filtroBuscaHome || t.serie === filtroBuscaHome)
    })

    const reincidentes = (() => {
      const map: Record<string, { id: string; nome: string; turma: string; count: number }> = {}
      ocorrencias.forEach(o => {
        const aId = o.alunoId || o.aluno_id;
        if (!aId) return;
        if (!map[aId]) map[aId] = { id: aId, nome: o.alunoNome || 'Sem Nome', turma: o.turma, count: 0 }
        map[aId].count++
      })
      return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
    })()

    const ultimasOC = [...ocorrencias].sort((a, b) => {
      const dateA = a.createdAt || a.created_at || ''
      const dateB = b.createdAt || b.created_at || ''
      return dateB.localeCompare(dateA)
    }).slice(0, 5)

    // ── MODO ALUNO ────────────────────────────────────────────────────────
    if (modoHome === 'aluno') {
      const todosMapped = alunos.map((a: any) => ({ id:a.id, nome:a.nome, turma: getAlunoTurmaCursando(a) || a.turma || '' }))
      const filteredAlunos = buscaAlunoHome.trim().length > 0
        ? todosMapped.filter((a: any) => a.nome.toLowerCase().includes(buscaAlunoHome.toLowerCase())).slice(0,12)
        : []
      const ocDoAluno = alunoSel ? ocorrencias.filter(o => cleanAlunoId(o.alunoId || o.aluno_id) === cleanAlunoId(alunoSel.id)).sort((a,b) => {
        const dateA = a.createdAt || a.created_at || ''
        const dateB = b.createdAt || b.created_at || ''
        return dateB.localeCompare(dateA)
      }) : []

      const printRelatorio = () => {
        if (!alunoSel) return
        const win = window.open('', '_blank')
        if (!win) return
        win.document.write(`<html><head><title>Relatório de Ocorrências — ${alunoSel.nome}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#1a1a2e}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0;font-weight:bold}</style></head><body>`)
        win.document.write(`<h1>Relatório de Ocorrências Disciplinares</h1>`)
        win.document.write(`<p><strong>Aluno:</strong> ${alunoSel.nome} | <strong>Turma:</strong> ${alunoSel.turma} | <strong>Total:</strong> ${ocDoAluno.length}</p>`)
        win.document.write(`<table><thead><tr><th>Data</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`)
        ocDoAluno.forEach(o => {
          win.document.write(`<tr><td>${o.data}</td><td>${o.descricao}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel?'Sim':'Não'}</td></tr>`)
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
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:'transparent', border:'1px solid #e2e8f0', borderRadius: 12 }}>
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
                      <div style={{ fontSize:12, color:'#64748b' }}>{a.turma || 'Sem turma'} • {ocorrencias.filter(o => cleanAlunoId(o.alunoId || o.aluno_id) === cleanAlunoId(a.id)).length} ocorrência(s)</div>
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
                    <div style={{ padding:'6px 12px', borderRadius:20, background:'rgba(37, 99, 235, 0.1)', border:'1px solid #bfdbfe', fontSize:11, fontWeight:700, color:'#2563eb' }}>
                      Total: {ocDoAluno.length}
                    </div>
                    <div style={{ padding:'6px 12px', borderRadius:20, background:'#fef3c7', border:'1px solid #fde68a', fontSize:11, fontWeight:700, color:'#b45309' }}>
                      Aguardando: {ocDoAluno.filter(o=>!o.ciencia_responsavel).length}
                    </div>
                    <div style={{ padding:'6px 12px', borderRadius:20, background:'#dcfce7', border:'1px solid #bbf7d0', fontSize:11, fontWeight:700, color:'#15803d' }}>
                      Confirmadas: {ocDoAluno.filter(o=>o.ciencia_responsavel).length}
                    </div>
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
                    const isConfirmed = oc.ciencia_responsavel
                    const cardBorderColor = isConfirmed ? '#10b981' : '#f59e0b'
                    return (
                      <div key={oc.id} style={{ display:'flex', gap:16, padding:'16px 20px', background:'#fff', borderTop: `1px solid #e2e8f0`, borderRight: `1px solid #e2e8f0`, borderBottom: `1px solid #e2e8f0`, borderLeft: `4px solid ${cardBorderColor}`, borderRadius:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
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
      <div className="ocorrencias-page-container" style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        {/* Header Ultra Moderno */}
        <div className="ocorrencias-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={20} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Gestão Disciplinar</span>
            </div>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Ocorrências Escolares</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Monitore o comportamento e aplique medidas pedagógicas.</p>
          </div>
          
          <div className="ocorrencias-header-toggle" style={{ display: 'flex', gap: '12px' }}>
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

        {/* Alerta de ocorrências aguardando ciência */}
        {pendentes > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 24px', background:'rgba(245, 158, 11, 0.05)', borderTop: '1px solid #fde68a', borderRight: '1px solid #fde68a', borderBottom: '1px solid #fde68a', borderRadius: 16, marginBottom: 24, borderLeft: '4px solid #f59e0b' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '10px', borderRadius: '12px' }}>
              <AlertTriangle size={24} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:15, color:'#b45309' }}>{pendentes} ocorrência{pendentes > 1 ? 's' : ''} aguardando ciência dos responsáveis</div>
              <div style={{ fontSize:13, color:'#92400e', marginTop:2 }}>Acompanhe os registros pendentes para garantir o alinhamento com as famílias.</div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#d97706', background:'#fef3c7', padding:'4px 12px', borderRadius:20, border:'1px solid #fde68a' }}>PENDÊNCIAS</div>
          </div>
        )}

        {/* Segundo nível: status de ciência + reincidentes + recentes */}
        <div className="ocorrencias-cards-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginBottom:32 }}>
          {/* Status de Ciência */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight:800, fontSize:14, color: '#0f172a', marginBottom:16, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart size={16} style={{ color: '#2563eb' }} />
              <span>Status de Ciência</span>
            </div>
            {isLoadingOcorrencias ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...Array(2)].map((_, i) => (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <Skeleton w="60%" h="12px" />
                      <Skeleton w="20px" h="12px" />
                    </div>
                    <Skeleton w="100%" h="6px" />
                  </div>
                ))}
              </div>
            ) : totalOC === 0 ? (
              <div style={{ fontSize:13, color:'#94a3b8', textAlign:'center', padding:'20px 0' }}>Sem ocorrências registradas</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'#15803d' }}>Ciência Confirmada</span>
                    <span style={{ fontSize:12, fontWeight:800, color:'#0f172a' }}>{confirmadas} ({totalOC ? Math.round((confirmadas/totalOC)*100) : 0}%)</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:'#f1f5f9' }}>
                    <div style={{ width:`${totalOC ? (confirmadas/totalOC)*100 : 0}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg, #10b981, #059669)' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'#b45309' }}>Aguardando Ciência</span>
                    <span style={{ fontSize:12, fontWeight:800, color:'#0f172a' }}>{pendentes} ({totalOC ? Math.round((pendentes/totalOC)*100) : 0}%)</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:'#f1f5f9' }}>
                    <div style={{ width:`${totalOC ? (pendentes/totalOC)*100 : 0}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                  </div>
                </div>
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
                  const isConfirmed = oc.ciencia_responsavel
                  return (
                    <div key={oc.id || idx} style={{ display:'flex', gap:10, alignItems:'center', paddingBottom:10, borderBottom:'1px solid #f1f5f9' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: isConfirmed ? '#10b981' : '#f59e0b', flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color: '#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{oc.alunoNome}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{oc.turma || 'Turma'} • {oc.data}</div>
                      </div>
                      <div style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background: isConfirmed ? '#dcfce7' : '#fef3c7', color: isConfirmed ? '#15803d' : '#b45309', fontWeight:700, flexShrink:0 }}>
                        {isConfirmed ? 'Confirmada' : 'Aguardando'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="ocorrencias-filter-bar" style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pendentes</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirmadas</th>
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
                    const ocTurma = ocorrencias.filter(o => doesOcMatchTurma(o, turma))
                    const pendTurma = ocTurma.filter(o => !o.ciencia_responsavel).length
                    const confTurma = ocTurma.filter(o => o.ciencia_responsavel).length
                    const alunosTurma = alunos.filter((a: any) => a.turma === turma.nome || a.turma === turma.id || a.turmaId === turma.id || isAlunoCursandoTurma(a, turma, turma.ano, turmas)).length
                    
                    const isUrgent = pendTurma > 0

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
                            color: pendTurma > 0 ? '#b45309' : '#64748b',
                            background: pendTurma > 0 ? '#fef3c7' : 'transparent',
                            padding: pendTurma > 0 ? '2px 6px' : '0',
                            borderRadius: '4px'
                          }}>
                            {pendTurma}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: confTurma > 0 ? '#15803d' : '#64748b',
                            background: confTurma > 0 ? '#dcfce7' : 'transparent',
                            padding: confTurma > 0 ? '2px 6px' : '0',
                            borderRadius: '4px'
                          }}>
                            {confTurma}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
                            <button 
                              onClick={() => { setTurmaSel(turma.nome); setFiltroStatus('todas'); setBusca('') }}
                              style={{ background: 'transparent', border: 'none', color: isUrgent ? '#d97706' : '#2563eb', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              Gerenciar <ChevronRight size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingId(null);
                                setForm({ ...BLANK, turma: turma.nome });
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
    win.document.write(`<html><head><title>Ocorrências — ${turmaSel}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{font-size:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0}</style></head><body>`)
    win.document.write(`<h1>Ocorrências — ${turmaSel}</h1><p>Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>`)
    win.document.write(`<table><thead><tr><th>Aluno</th><th>Data</th><th>Descrição</th><th>Responsável</th><th>Ciência</th></tr></thead><tbody>`)
    filtered.forEach(o => {
      win.document.write(`<tr><td>${o.alunoNome}</td><td>${o.data}</td><td>${o.descricao}</td><td>${o.responsavel}</td><td>${o.ciencia_responsavel?'Sim':'Não'}</td></tr>`)
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
          { label:'Aguardando Ciência', value: ocDaTurma.filter(o=>!o.ciencia_responsavel).length, color:'#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
          { label:'Ciência Confirmada', value: ocDaTurma.filter(o=>o.ciencia_responsavel).length, color:'#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
          { label:'Com Anexo', value: ocDaTurma.filter(o=>!!o.anexoUrl).length, color:'#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
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
          <input className="form-input" style={{ paddingLeft:36, height: '40px', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0' }} placeholder="Buscar aluno ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        
        <div style={{ display: 'flex', background: '#fff', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          {(['todas','pendentes','confirmadas'] as const).map(f => (
            <button key={f} 
              onClick={() => setFiltroStatus(f)}
              style={{
                height: '32px',
                padding: '0 12px',
                background: filtroStatus === f ? (f === 'confirmadas' ? '#10b981' : f === 'pendentes' ? '#f59e0b' : '#2563eb') : 'transparent',
                color: filtroStatus === f ? '#fff' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {f==='todas' ? 'Todas' : f==='pendentes' ? 'Aguardando Ciência' : 'Confirmadas'}
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
            const isConfirmed = oc.ciencia_responsavel
            const cardBorderColor = isConfirmed ? '#10b981' : '#f59e0b'
            return (
              <div key={oc.id} style={{ display:'flex', gap:16, padding:'16px 20px', background:'#fff', borderTop: `1px solid #e2e8f0`, borderRight: `1px solid #e2e8f0`, borderBottom: `1px solid #e2e8f0`, borderLeft: `4px solid ${cardBorderColor}`, borderRadius: 12, transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow=`0 4px 6px -1px rgba(0,0,0,0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                <div style={{ width:40, height:40, borderRadius: 10, background: isConfirmed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isConfirmed ? '#10b981' : '#f59e0b', flexShrink:0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                  {getInitials(oc.alunoNome)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontSize:15, fontWeight:700, color: '#0f172a' }}>{oc.alunoNome}</span>
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
          turmas={turmas} 
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
          isEditing={!!editingId}
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
