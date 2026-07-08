'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, FileBarChart, Plus, FileText, ClipboardList, BookOpen, GraduationCap, Calendar, Users, MessageSquare, Layout, FileCheck, ArrowRight, ArrowLeft } from 'lucide-react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useRelatorios, ReportTemplate, ReportField } from '@/lib/relatoriosContext'

import { useApp } from '@/lib/context'

interface ReportsSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (attachmentText: string, payload: any) => void
  onFillDirectly?: (payload: any) => void
  selectedDest?: any[]
}

export function ReportsSelectionModal({ isOpen, onClose, selectedDest, onAdd, onFillDirectly }: ReportsSelectionModalProps) {
  const { currentUser } = useApp()
  const { templates: contextTemplates = [] } = useRelatorios()
  const [alunos, _sa, { loading: loadingAlunos }] = useSupabaseArray<any>('alunos/lightweight')
  const [gruposManuais, _sg, { loading: loadingGrupos }] = useSupabaseArray<any>('agenda/grupos')
  const [turmas, _st, { loading: loadingTurmas }] = useSupabaseArray<any>('turmas')
  
  const isLoadingData = loadingAlunos || loadingGrupos || loadingTurmas

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  
  // Grid/List of resolved targeted students
  const [targetedStudents, setTargetedStudents] = useState<any[]>([])
  const [searchStudent, setSearchStudent] = useState('')

  // Report Assignment States
  const [dataReferencia, setDataReferencia] = useState<string>(new Date().toISOString().split('T')[0])

  const [filterYear, setFilterYear] = useState<string>('')
  const [filterTurmaId, setFilterTurmaId] = useState<string>('')

  // Load only dynamic context templates
  const allTemplates = contextTemplates.filter(t => t.status === 'ativo')

  const userGroups = React.useMemo(() => {
    if (!currentUser?.id) return [];
    return (gruposManuais || []).filter((g: any) => {
      let colabs = g.colaboradoresIds;
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
      }
      if (!Array.isArray(colabs)) colabs = [];
      return colabs.some((id: any) => String(id) === String(currentUser.id));
    });
  }, [gruposManuais, currentUser]);

  const accessibleTurmas = React.useMemo(() => {
    if (!currentUser?.id) return [];
    const isMaster = String(currentUser?.cargo || '').toLowerCase().includes('administrador') || String(currentUser?.cargo || '').toLowerCase().includes('diretor') || String(currentUser?.cargo || '').toLowerCase().includes('admin');
    if (currentUser.perfil === 'administrador' || isMaster || currentUser.perfil === 'admin') return turmas;
    
    const globalGroups = userGroups.filter((g: any) => 
      g.isGlobalAccess === true || g.isGlobalAccess === 'true' || g.isGlobalAccess === 1 ||
      g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1
    );
    
    const hasGlobalWithoutYear = globalGroups.some((g: any) => {
      const a = g.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '');
      return a === '';
    });
    
    if (hasGlobalWithoutYear) return turmas;
    
    const globalYears = new Set(globalGroups.map((g: any) => {
      return g.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '');
    }).filter((a: string) => a !== ''));

    const filtered = turmas.filter((t: any) => {
       const tAno = t.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '');
       if (globalYears.has(tAno)) return true;
       return userGroups.some((g: any) => String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase())
    });
    return filtered
  }, [turmas, userGroups, currentUser])

  // Derive available years from students and accessible turmas
  const availableYears = React.useMemo(() => {
    const years = new Set<string>()
    alunos.forEach((a: any) => {
      const year = String(a.ano_letivo || a.anoLetivo || a.ano || '')
      if (year && year !== 'undefined' && year !== 'null' && year !== '') years.add(year)
    })
    accessibleTurmas.forEach((t: any) => {
      const year = String(t.ano || t.dados?.anoLetivo || '')
      if (year && year !== 'undefined' && year !== 'null' && year !== '') years.add(year)
    })
    // Include current year as fallback
    years.add(new Date().getFullYear().toString())
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [alunos, accessibleTurmas])

  // Derive available classes from accessible turmas and students for the selected year
  const availableTurmas = React.useMemo(() => {
    if (!filterYear) return []
    const classMap = new Map<string, string>()

    accessibleTurmas.forEach((t: any) => {
      const tYear = String(t.ano || t.dados?.anoLetivo || new Date().getFullYear().toString())
      if (tYear === filterYear || filterYear === 'Todos') {
        classMap.set(String(t.id), t.nome || String(t.id))
      }
    })
    
    const turmasLower = accessibleTurmas.map((t: any) => ({
      id: String(t.id).toLowerCase(),
      codigo: String(t.codigo || '').toLowerCase(),
      nome: String(t.nome || '').trim().toLowerCase(),
      original: t
    }))

    alunos.forEach((a: any) => {
      const year = String(a.ano_letivo || a.anoLetivo || a.ano || '')
      if ((year === filterYear || filterYear === 'Todos' || year === '') && (a.turma || (a as any).turmaId)) {
        const tRef = String(a.turma || (a as any).turmaId).trim()
        const tRefLower = tRef.toLowerCase()
        const tMatched = turmasLower.find(t => t.id === tRefLower || t.codigo === tRefLower || t.nome === tRefLower)
        if (tMatched) {
          const tObj = tMatched.original
          const canonicalId = String(tObj.id)
          const tName = tObj.nome
          classMap.set(canonicalId, tName)
        }
      }
    })
    return Array.from(classMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [alunos, accessibleTurmas, filterYear])

  // Initialization when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setSelectedTemplate(allTemplates[0] || null)
      setSearchStudent('')
      setFilterYear('')
      setFilterTurmaId('')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Resolve targeted students when dependencies or filters change
  useEffect(() => {
    if (isOpen) {
      let resolved: any[] = []
      if (!selectedDest || selectedDest.length === 0) {
        resolved = (alunos || []).filter(a => {
           const aYear = String(a.ano_letivo || a.anoLetivo || a.ano || '')
           if (filterYear !== '' && filterYear !== 'Todos' && aYear !== filterYear && aYear !== '') return false;
           return true;
        })
      } else {
        const directStudentIds = new Set<string>()
        const targetedClasses = new Set<string>()
        
        selectedDest.forEach(d => {
          if (d.type === 'aluno' || d.id.startsWith('a_')) {
            directStudentIds.add(d.id.replace(/^a_?/, ''))
          } else if (d.type === 'turma') {
            targetedClasses.add(d.id.replace(/^t_?/, '').toLowerCase())
          } else if (d.type === 'grupo' || d.id.startsWith('g_')) {
            const gId = d.id.replace(/^g_?/, '')
            const groupObj = (gruposManuais || []).find(g => String(g.id) === String(gId))
            if (groupObj && groupObj.alunosIds) {
              groupObj.alunosIds.forEach((sId: any) => {
                directStudentIds.add(String(sId))
              })
            }
          }
        })
        const validTurmaRefs = new Set<string>();
        targetedClasses.forEach(tc => {
           validTurmaRefs.add(tc);
           const tObj = turmas.find((t: any) => String(t.id).toLowerCase() === tc || String(t.codigo).toLowerCase() === tc || String(t.nome).trim().toLowerCase() === tc);
           if (tObj) {
              if (tObj.id) validTurmaRefs.add(String(tObj.id).toLowerCase());
              if (tObj.codigo) validTurmaRefs.add(String(tObj.codigo).toLowerCase());
              if (tObj.nome) validTurmaRefs.add(String(tObj.nome).trim().toLowerCase());
           }
        });

        resolved = (alunos || []).filter(a => {
           if (directStudentIds.has(String(a.id))) return true;
           const tRefLower = String(a.turma || '').trim().toLowerCase();
           const tIdLower = String((a as any).turmaId || '').trim().toLowerCase();
           return validTurmaRefs.has(tRefLower) || validTurmaRefs.has(tIdLower);
        })
      }

      if (filterTurmaId && filterTurmaId !== 'all') {
        const filterLower = filterTurmaId.trim().toLowerCase();
        
        // Vamos usar a mesmíssima lógica blindada do DestinatariosModal
        const byTurmaRef = new Map<string, any[]>()
        ;(alunos || []).forEach((a: any) => {
          const refs = [String(a.turma || ''), String((a as any).turmaId || '')].filter(Boolean)
          refs.forEach(r => {
            const ref = r.trim().toLowerCase()
            if (ref) {
              let list = byTurmaRef.get(ref)
              if (!list) {
                list = []
                byTurmaRef.set(ref, list)
              }
              if (!list.find(x => x.id === a.id)) list.push(a)
            }
          })
        })

        const selectedTurma = turmas.find((t: any) => 
          String(t.id).toLowerCase() === filterLower || 
          String(t.codigo).toLowerCase() === filterLower || 
          String(t.nome).trim().toLowerCase() === filterLower
        );
        
        let foundStudents: any[] = []
        if (selectedTurma) {
          const uniqueStudents = new Map<string, any>()
          
          const tRefs = new Set<string>()
          if (selectedTurma.id) tRefs.add(String(selectedTurma.id).toLowerCase())
          if (selectedTurma.codigo) tRefs.add(String(selectedTurma.codigo).toLowerCase())
          if (selectedTurma.nome) tRefs.add(String(selectedTurma.nome).trim().toLowerCase())
          
          tRefs.forEach(ref => {
             const list = byTurmaRef.get(ref) || []
             list.forEach(a => uniqueStudents.set(a.id, a))
          })
          
          foundStudents = Array.from(uniqueStudents.values())
        } else {
          foundStudents = byTurmaRef.get(filterLower) || []
        }
        
        resolved = foundStudents
      } else if (selectedDest && selectedDest.length > 0) {
        // Se nenhuma turma foi selecionada no modal, mas temos destinatários, 
        // a lista já está filtrada em `resolved`. Não fazemos nada.
      } else {
        // Se ainda não selecionou a turma e não há destinatários prévios, exibimos 0 alunos
        resolved = []
      }

      setTargetedStudents(resolved)
    }
  }, [isOpen, selectedDest, alunos, turmas, gruposManuais, filterYear, filterTurmaId, availableTurmas])

  // Set default date when going to step 2
  useEffect(() => {
    if (step === 2) {
      if (!dataReferencia) setDataReferencia(new Date().toISOString().split('T')[0])
    }
  }, [step, dataReferencia])

  // if (!isOpen) return null

  const allFields = selectedTemplate ? selectedTemplate.sections.flatMap(s => s.fields) : []

  // We don't need getFieldCompletionCount anymore

  const handleFillDirectly = () => {
    if (!selectedTemplate) return
    
    const payload = {
      type: 'report-assignment',
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      turmaId: filterTurmaId,
      turmaName: availableTurmas.find((t: any) => t.id === filterTurmaId)?.name || 'Turma selecionada',
      dataReferencia: new Date().toISOString().split('T')[0],
      studentCount: targetedStudents.length,
      studentIds: targetedStudents.map(st => st.id)
    }

    if (onFillDirectly) {
      onFillDirectly(payload)
    } else {
      // Fallback para manter retrocompatibilidade com onAdd (anexar tarefa)
      onAdd(`Tarefa de Relatório: ${selectedTemplate.name}`, payload)
      onClose()
    }
  }
    


  const filteredStudents = targetedStudents.filter(st => 
    st.nome?.toLowerCase().includes(searchStudent.toLowerCase())
  )

  const renderIcon = (t: ReportTemplate) => {
    const isEmoji = t.icon && /\p{Emoji}/u.test(t.icon) && t.icon.length <= 4
    if (isEmoji) return <span style={{ fontSize: 24 }}>{t.icon}</span>

    const ICON_MAP: any = { FileText, FileBarChart, FileCheck, ClipboardList, BookOpen, GraduationCap, Calendar, Users, MessageSquare, Layout }
    const IconComp = ICON_MAP[t.icon] || FileBarChart
    return <IconComp size={24} />
  }

  return (
    <AnimatePresence>
      {isOpen && (
      <div className="ad-reports-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <style>{`
          @media (min-width: 769px) {
            .ad-reports-step1 {
              border-radius: 40px;
              padding: 40px;
              max-width: 640px;
              height: auto;
              width: 100%;
            }
            .ad-reports-modal-overlay {
              padding: 20px;
            }
          }
          @media (max-width: 768px) {
            .ad-reports-modal-overlay {
              padding: 0 !important;
            }
            .ad-reports-step1 {
              height: 100dvh !important;
              max-height: 100dvh !important;
              width: 100vw !important;
              max-width: 100vw !important;
              border-radius: 0 !important;
              padding: 24px 20px 100px 20px !important;
              gap: 24px !important;
              overflow-y: auto !important;
              margin: 0 !important;
            }
            .ad-reports-footer {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              background: #fff !important;
              padding: 16px 20px 24px 20px !important;
              border-top: 1px solid #e2e8f0 !important;
              z-index: 100 !important;
              border-radius: 0 !important;
              box-shadow: 0 -10px 25px rgba(0,0,0,0.05) !important;
              justify-content: space-between !important;
              border: none !important;
            }
            .ad-reports-footer button {
              flex: 1 !important;
              padding: 14px 16px !important;
              font-size: 14px !important;
              justify-content: center !important;
            }
            .ad-reports-list {
              max-height: none !important;
            }
          }
        `}</style>
        
          <motion.div 
            className="ad-reports-modal-card ad-reports-step1"
            initial={{ scale: 0.95, opacity: 0, y: 30 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            style={{ 
              background: '#fff', width: '100%', 
              boxShadow: '0 50px 100px rgba(15, 23, 42, 0.25)', border: '1px solid rgba(255,255,255,0.4)',
              display: 'flex', flexDirection: 'column', gap: 32
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 6 }}>📊 Preencher Relatório</h3>
                <p style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Selecione o template e a turma para iniciar.</p>
              </div>
              <button 
                onClick={onClose}
                style={{ 
                  background: '#f1f5f9', width: 44, height: 44, borderRadius: '50%', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Turma filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtro de Turma</div>
              {isLoadingData ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, height: 48, borderRadius: 16, background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ flex: 2, height: 48, borderRadius: 16, background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <select 
                      value={filterYear}
                      onChange={e => { setFilterYear(e.target.value); setFilterTurmaId(''); }}
                      style={{ width: '100%', height: 48, borderRadius: 16, border: '2px solid #e2e8f0', padding: '0 16px', fontSize: 14, fontWeight: 700, outline: 'none', background: '#f8fafc', color: '#1e293b' }}
                    >
                      <option value="" disabled>Selecione o Ano</option>
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <select 
                      value={filterTurmaId}
                      onChange={e => setFilterTurmaId(e.target.value)}
                      style={{ width: '100%', height: 48, borderRadius: 16, border: '2px solid #e2e8f0', padding: '0 16px', fontSize: 14, fontWeight: 700, outline: 'none', background: '#f8fafc', color: '#1e293b' }}
                    >
                      <option value="" disabled>Selecione a Turma</option>
                      {availableTurmas.map((t: {id: string, name: string}) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Template choice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escolha o relatório</div>
              <div className="ad-reports-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                {isLoadingData ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: 20, background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ height: 14, width: '60%', background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                        <div style={{ height: 10, width: '30%', background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                      </div>
                    </div>
                  ))
                ) : (
                  allTemplates.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderRadius: 24,
                        background: selectedTemplate?.id === t.id ? '#f8fafc' : '#fff',
                        border: selectedTemplate?.id === t.id ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                        cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: (t.color || '#6366f1') + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color || '#6366f1', flexShrink: 0 }}>
                        {renderIcon(t)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', marginBottom: 2 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{t.description || t.category}</div>
                      </div>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', flexShrink: 0 }}>
                        {selectedTemplate?.id === t.id && (
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6' }} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="ad-reports-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 28, display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
              <button 
                onClick={onClose} 
                style={{ padding: '16px 28px', borderRadius: 18, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleFillDirectly}
                disabled={!selectedTemplate || filterYear === '' || filterTurmaId === '' || targetedStudents.length === 0}
                style={{ 
                  padding: '16px 36px', borderRadius: 18, border: 'none', background: (selectedTemplate && filterYear !== '' && filterTurmaId !== '' && targetedStudents.length > 0) ? '#3b82f6' : '#cbd5e1', 
                  color: '#fff', fontSize: 15, fontWeight: 900, cursor: (selectedTemplate && filterYear !== '' && filterTurmaId !== '' && targetedStudents.length > 0) ? 'pointer' : 'not-allowed',
                  boxShadow: (selectedTemplate && filterYear !== '' && filterTurmaId !== '' && targetedStudents.length > 0) ? '0 10px 20px rgba(59, 130, 246, 0.2)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                Preencher Relatório
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>


      </div>
      )}
    </AnimatePresence>
  )
}
