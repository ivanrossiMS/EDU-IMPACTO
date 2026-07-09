import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, CheckCircle2, XCircle, FileText, FileBarChart, Paperclip, ChevronDown, ChevronUp, Users, Loader2 } from 'lucide-react'
import { ADComunicado } from '@/lib/agendaDigitalContext'
import { supabase } from '@/lib/supabase'

interface TargetStudent {
  id: string
  nome: string
  turma: string
  avatarUrl?: string
  leu: boolean
  leuEm?: string
  responsaveis: TargetParent[]
}

interface TargetParent {
  id: string
  nome: string
  parentesco: string
  avatarUrl?: string
  leu: boolean
  leuEm?: string
  isFinanceiro: boolean
  isPedagogico: boolean
}

interface ComunicadoReportModalProps {
  selectedCom: ADComunicado
  alunosAtivos: any[]
  turmas: any[]
  onClose: () => void
  setViewingReportPayload: (payload: any) => void
  renderConteudo: (text: string) => React.ReactNode
}


const parseAnexo = (anexoData: any) => {
  if (!anexoData) return null;
  if (typeof anexoData === 'object') {
    return {
      name: anexoData.nome || anexoData.name || '',
      url: anexoData.url || '',
      mime: anexoData.mime || (anexoData.type === 'image' ? 'image/jpeg' : '')
    };
  }
  try {
    const str = typeof anexoData === 'string' ? anexoData : String(anexoData);
    const parts = (str && typeof str.split === 'function') ? str.split('|') : [str];
    const name = parts[0] || '';
    const url = parts[1] || '';
    const mime = parts[2] || '';
    return { name, url, mime };
  } catch (e) {
    return null;
  }
};

export function ComunicadoReportModal({ selectedCom, alunosAtivos, turmas, onClose, setViewingReportPayload, renderConteudo }: ComunicadoReportModalProps) {
  const [loading, setLoading] = useState(true)
  const [targets, setTargets] = useState<TargetStudent[]>([])
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadFamilies() {
      setLoading(true)
      
      const isGlobal = !selectedCom.turmas?.length && !selectedCom.alunosIds?.length
      const baseTargets = alunosAtivos.filter(a => {
        if (isGlobal) return true;
        if (selectedCom.turmas?.includes(a.turma)) return true;
        const aIdPlain = a.id.replace(/^_*(ALU)?/, '')
        return selectedCom.alunosIds?.some(idRaw => idRaw.replace(/^_*(ALU)?/, '') === aIdPlain)
      })

      if (baseTargets.length === 0) {
        setTargets([])
        setLoading(false)
        return
      }

      const studentIds = baseTargets.map(a => a.id.replace(/^_*(ALU)?_?/, ''))
      
      const getTurmaName = (tid: string) => {
        if (!turmas || !Array.isArray(turmas)) return tid
        const cleanTid = String(tid).replace(/^t_?/, '')
        const found = turmas.find(t => String(t.id) === String(tid) || String(t.id).replace(/^t_?/, '') === cleanTid || String(t.nome) === String(tid) || String(t.name) === String(tid))
        return found ? (found.nome || found.name || tid) : tid
      }
      
      // Fetch parents via API to handle all ref formats (matricula, codigo, id) and bypass RLS
      let responsaveisMap: Record<string, any[]> = {}
      if (studentIds.length > 0) {
        try {
          const res = await fetch(`/api/aluno-responsavel?aluno_ids=${studentIds.join(',')}`)
          if (res.ok) {
            const data = await res.json()
            if (data.responsaveisMap) responsaveisMap = data.responsaveisMap
          }
        } catch (e) {
          console.error('Error fetching parents:', e)
        }
      }

      const families: TargetStudent[] = baseTargets.map(a => {
        const plainId = a.id.replace(/^_*(ALU)?_?/, '')
        const studentLeuAt = selectedCom.leituras?.[a.id] || selectedCom.leituras?.[plainId]
        
        const parentList = responsaveisMap[plainId] || responsaveisMap[a.id] || []
        
        const responsaveis: TargetParent[] = parentList.map((resp: any) => {
          const respLeuAt = selectedCom.leituras?.[resp.id]
          
          return {
            id: resp.id,
            nome: resp.nome || 'Responsável',
            parentesco: resp.parentesco || 'Responsável',
            avatarUrl: resp.foto_url || resp.foto || null,
            leu: !!respLeuAt,
            leuEm: respLeuAt ? new Date(respLeuAt).toLocaleString('pt-BR') : undefined,
            isFinanceiro: !!resp.isFinanceiro,
            isPedagogico: !!resp.isPedagogico
          }
        }).filter(Boolean) as TargetParent[]

        return {
          id: a.id,
          nome: a.nome,
          turma: getTurmaName(a.turma),
          avatarUrl: a.foto_url || a.foto || a.dados?.avatarUrl || null,
          leu: !!studentLeuAt,
          leuEm: studentLeuAt ? new Date(studentLeuAt).toLocaleString('pt-BR') : undefined,
          responsaveis
        }
      })
      
      // Sort: those with unread responsibles first
      families.sort((a, b) => {
        const aHasUnread = a.responsaveis.some(r => !r.leu) || !a.leu
        const bHasUnread = b.responsaveis.some(r => !r.leu) || !b.leu
        if (aHasUnread && !bHasUnread) return -1
        if (!aHasUnread && bHasUnread) return 1
        return a.nome.localeCompare(b.nome)
      })

      setTargets(families)
      
      // Expand all by default if there are few, otherwise collapse
      const expandAll = families.length <= 10;
      const initialExpanded: Record<string, boolean> = {}
      if (expandAll) {
        families.forEach(f => initialExpanded[f.id] = true)
      }
      setExpandedStudents(initialExpanded)
      
      setLoading(false)
    }

    loadFamilies()
  }, [selectedCom, alunosAtivos])

  const toggleExpand = (id: string) => {
    setExpandedStudents(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleExpandAll = () => {
    const allExpanded = Object.values(expandedStudents).filter(Boolean).length === targets.length;
    const newExpanded: Record<string, boolean> = {};
    if (!allExpanded) {
      targets.forEach(t => newExpanded[t.id] = true);
    }
    setExpandedStudents(newExpanded);
  }

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
      backgroundColor: '#f8fafc', boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
      borderLeft: '1px solid #e2e8f0', zIndex: 9999,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Relatório do Comunicado</h3>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', padding: 8, borderRadius: '50%', color: '#64748b' }}>
          <X size={18} />
        </button>
      </motion.div>
      
      <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
        {/* Info Box */}
        <div style={{ marginBottom: 24, background: '#fff', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Assunto</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{selectedCom.titulo}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
           <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
             <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Famílias que Leram</div>
             <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>{targets.filter(t => t.leu || t.responsaveis.some(r => r.leu)).length} <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>/ {targets.length}</span></div>
           </div>
           {selectedCom.exigeCiencia && (
             <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
               <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Ciências Confirmadas</div>
               <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{Object.keys(selectedCom.ciencias || {}).length}</div>
             </div>
           )}
        </div>

        {/* Conteúdo Original */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>
            Conteúdo Original da Mensagem
          </div>
          <div style={{ padding: 20, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 14, lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {renderConteudo(selectedCom.conteudo || (selectedCom as any).texto || '')}
          </div>
          
          {selectedCom.anexos && selectedCom.anexos.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedCom.anexos.map((anexo: any, idx: number) => {
                const parsed = parseAnexo(anexo);
                if (!parsed) return null;
                const { name, url, mime } = parsed;
                const isForm = name.startsWith('Formulário:');
                const isRel = name.startsWith('Relatório:');
                const isImg = url.startsWith('data:image/') || mime.startsWith('image/') || name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') || name.toLowerCase().endsWith('.webp') || name.toLowerCase().endsWith('.gif');
                const isVid = mime.startsWith('video/') || url.includes('.mov') || url.includes('.mp4') || name.toLowerCase().endsWith('.mov') || name.toLowerCase().endsWith('.mp4');
                
                if (isImg || isVid) {
                    return (
                      <div key={idx} style={{ width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9', display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 12 }}>
                        {isImg ? (
                          <img src={url} alt={name} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 400, objectFit: 'contain' }} />
                        ) : (
                          <video src={url} controls style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 400 }} />
                        )}
                      </div>
                    )
                }

                if (url && !isForm && !isRel && !url.includes('payload:')) {
                   return (
                     <a 
                       key={idx} 
                       href={url}
                       target="_blank"
                       rel="noreferrer"
                       style={{ 
                         background: '#f1f5f9', 
                         color: '#475569', 
                         fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', 
                         borderRadius: 8, border: '1px solid #e2e8f0',
                         fontWeight: 600,
                         textDecoration: 'none'
                       }}
                     >
                       <Paperclip size={14} color="#64748b" />
                       {name}
                     </a>
                   )
                }

                return (
                  <div 
                    key={idx} 
                    style={{ 
                      background: isRel ? 'rgba(139, 92, 246, 0.1)' : '#f1f5f9', 
                      color: isRel ? '#7c3aed' : '#475569', 
                      fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', 
                      borderRadius: 8, border: `1px solid ${isRel ? 'rgba(139, 92, 246, 0.2)' : '#e2e8f0'}`,
                      fontWeight: 600
                    }}
                  >
                    {isForm ? <FileText size={14} color="#3b82f6" /> : isRel ? <FileBarChart size={14} color="#7c3aed" /> : <Paperclip size={14} color="#64748b" />}
                    {name}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Status de Leitura */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Status de Leitura (Famílias)</div>
          <button onClick={toggleExpandAll} style={{ fontSize: 12, color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {Object.values(expandedStudents).filter(Boolean).length === targets.length ? 'Recolher todos' : 'Expandir todos'}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Loader2 size={32} color="#3b82f6" className="animate-spin" />
          </div>
        ) : targets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, background: '#fff', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
            <Users size={32} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Nenhum alvo encontrado para este comunicado.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {targets.map(fam => {
              const isExpanded = !!expandedStudents[fam.id]
              const hasReportAnexo = selectedCom.anexos?.find((anx: string) => typeof anx === 'string' && anx.startsWith('Relatório:'))
              
              return (
                <div key={fam.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  {/* Student Header */}
                  <div 
                    onClick={() => toggleExpand(fam.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {fam.avatarUrl ? <img src={fam.avatarUrl} alt={fam.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={16} color="#64748b" />}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{fam.nome}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Aluno • {fam.turma}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Badge Student Status */}
                      {fam.leu ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 12, fontWeight: 600 }} title={fam.leuEm}><CheckCircle2 size={16}/> Lido</div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 12, fontWeight: 600 }}><XCircle size={16}/> Não lido</div>
                      )}
                      {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                    </div>
                  </div>
                  
                  {/* Parents Body */}
                  {isExpanded && (
                    <div style={{ padding: '8px 16px 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                      {hasReportAnexo && (
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setViewingReportPayload({
                                  string: typeof hasReportAnexo === 'string' ? hasReportAnexo : String(hasReportAnexo),
                                  studentId: fam.id,
                                  studentName: fam.nome,
                                  studentAvatar: fam.avatarUrl
                                });
                            }}
                            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <FileBarChart size={14} /> Ver Relatório Individual
                          </button>
                        </div>
                      )}

                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, marginLeft: 8 }}>Responsáveis</div>
                      
                      {fam.responsaveis.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px', fontStyle: 'italic' }}>Nenhum responsável vinculado.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {fam.responsaveis.map(resp => (
                            <div key={resp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {resp.avatarUrl ? <img src={resp.avatarUrl} alt={resp.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{resp.nome.charAt(0)}</span>}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{resp.nome}</div>
                                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {resp.parentesco}
                                    {(resp.isFinanceiro || resp.isPedagogico) && (
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        {resp.isFinanceiro && <span style={{ padding: '2px 6px', background: '#dcfce7', color: '#166534', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>FIN</span>}
                                        {resp.isPedagogico && <span style={{ padding: '2px 6px', background: '#e0e7ff', color: '#3730a3', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>PED</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div>
                                {resp.leu ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 11, fontWeight: 700 }} title={resp.leuEm}><CheckCircle2 size={14}/> Lido</div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 11, fontWeight: 700 }}><XCircle size={14}/> Não lido</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </motion.div>
  )
}
