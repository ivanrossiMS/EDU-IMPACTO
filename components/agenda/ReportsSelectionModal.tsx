'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, FileBarChart, Plus, FileText, ClipboardList, BookOpen, GraduationCap, Calendar, Users, MessageSquare, Layout, FileCheck, ArrowRight, ArrowLeft } from 'lucide-react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useRelatorios, ReportTemplate, ReportField } from '@/lib/relatoriosContext'

interface ReportsSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (attachmentText: string, payload: any) => void
  onFillDirectly?: (payload: any) => void
  selectedDest?: any[]
}

export function ReportsSelectionModal({ isOpen, onClose, selectedDest, onAdd, onFillDirectly }: ReportsSelectionModalProps) {
  const { templates: contextTemplates = [] } = useRelatorios()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [gruposManuais = []] = useSupabaseArray<any>('agenda/grupos')
  const [turmas = []] = useSupabaseArray<any>('turmas')

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

  // Derive available years from students directly to guarantee exact matches
  const availableYears = React.useMemo(() => {
    const years = new Set<string>()
    alunos.forEach((a: any) => {
      const year = String(a.ano_letivo || a.anoLetivo || a.ano || '')
      if (year && year !== 'undefined' && year !== 'null' && year !== '') years.add(year)
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [alunos])

  // Derive available classes from students for the selected year
  const availableTurmas = React.useMemo(() => {
    if (!filterYear) return []
    const classMap = new Map<string, string>()
    alunos.forEach((a: any) => {
      const year = String(a.ano_letivo || a.anoLetivo || a.ano || '')
      if (year === filterYear && a.turma) {
        const tId = String(a.turma).trim()
        const tObj = turmas.find((t: any) => String(t.id) === tId)
        const tName = tObj?.nome || tId
        classMap.set(tId, tName)
      }
    })
    return Array.from(classMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [alunos, turmas, filterYear])

  // Initialization when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setSelectedTemplate(allTemplates[0] || null)
      setSearchStudent('')
      setFilterYear('')
      setFilterTurmaId('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Resolve targeted students when dependencies or filters change
  useEffect(() => {
    if (isOpen) {
      let resolved: any[] = []
      if (!selectedDest || selectedDest.length === 0) {
        resolved = alunos || []
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
        
        resolved = (alunos || []).filter(a => {
          return directStudentIds.has(String(a.id)) || targetedClasses.has(String(a.turma || '').toLowerCase())
        })
      }

      // Se os destinos principais (selectedDest) estão vazios,
      // devemos obrigatoriamente usar a turma selecionada no modal para encontrar os alunos.
      // Se já tinha destinatários e a turma também foi escolhida, a gente filtra os selecionados para só aquela turma.
      if (filterTurmaId && filterTurmaId !== 'all') {
        resolved = resolved.filter(a => String(a.turma || '').trim().toLowerCase() === filterTurmaId.trim().toLowerCase())
      } else {
        // Se ainda não selecionou a turma, exibimos 0 alunos
        resolved = []
      }

      setTargetedStudents(resolved)
    }
  }, [isOpen, selectedDest, alunos, gruposManuais, filterYear, filterTurmaId, availableTurmas])

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
          @media (max-width: 768px) {
            .ad-reports-step1 {
              padding: 24px 20px !important;
              gap: 24px !important;
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
              background: '#fff', borderRadius: 40, width: '100%', maxWidth: 640, padding: 40, 
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
            </div>

            {/* Template choice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escolha o relatório</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                {allTemplates.map(t => (
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
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 28, display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
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
