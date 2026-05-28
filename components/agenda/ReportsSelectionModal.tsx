'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, FileBarChart, Plus, FileText, ClipboardList, BookOpen, GraduationCap, Calendar, Users, MessageSquare, Layout, FileCheck, ArrowRight, ArrowLeft } from 'lucide-react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useRelatorios, ReportTemplate, ReportField } from '@/lib/relatoriosContext'

interface ReportsSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  selectedDest: { id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo' }[]
  onAdd: (attachmentText: string, payload: any) => void
}


export function ReportsSelectionModal({ isOpen, onClose, selectedDest, onAdd }: ReportsSelectionModalProps) {
  const { templates: contextTemplates = [] } = useRelatorios()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [gruposManuais = []] = useSupabaseArray<any>('agenda/grupos')

  const [step, setStep] = useState<1 | 2>(1)
  const [reportType, setReportType] = useState<'todos' | 'especifico'>('todos')
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  
  // Grid/List of resolved targeted students
  const [targetedStudents, setTargetedStudents] = useState<any[]>([])
  const [searchStudent, setSearchStudent] = useState('')

  // Report Filler States
  const [selectedField, setSelectedField] = useState<ReportField | null>(null)
  const [reportValues, setReportValues] = useState<Record<string, Record<string, any>>>({}) // studentId -> fieldId -> value

  // Load only dynamic context templates
  const allTemplates = contextTemplates.filter(t => t.status === 'ativo')

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setReportType('todos')
      setSelectedTemplate(allTemplates[0] || null)
      setReportValues({})
      setSearchStudent('')
      
      // Resolve targeted students
      if (!selectedDest || selectedDest.length === 0) {
        setTargetedStudents(alunos || [])
      } else {
        const directStudentIds = new Set<string>()
        const targetedClasses = new Set<string>()
        
        selectedDest.forEach(d => {
          if (d.type === 'aluno' || d.id.startsWith('a_')) {
            directStudentIds.add(d.id.replace(/^a_?/, ''))
          } else if (d.type === 'turma') {
            targetedClasses.add(d.name.toLowerCase())
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
        
        const resolved = (alunos || []).filter(a => {
          return directStudentIds.has(String(a.id)) || targetedClasses.has(String(a.turma || '').toLowerCase())
        })
        setTargetedStudents(resolved)
      }
    }
  }, [isOpen, selectedDest, alunos, gruposManuais])

  // Set the first field active when transition to Step 2 occurs
  useEffect(() => {
    if (step === 2 && selectedTemplate) {
      const allFields = selectedTemplate.sections.flatMap(s => s.fields)
      if (allFields.length > 0) {
        setSelectedField(allFields[0])
      }
    }
  }, [step, selectedTemplate])

  if (!isOpen) return null

  const allFields = selectedTemplate ? selectedTemplate.sections.flatMap(s => s.fields) : []

  // Count completions for fields
  const getFieldCompletionCount = (fieldId: string) => {
    let count = 0
    targetedStudents.forEach(st => {
      const val = reportValues[st.id]?.[fieldId]
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        count++
      }
    })
    return count
  }

  const handleNext = () => {
    if (!selectedTemplate) return
    setStep(2)
  }

  const handleFinish = () => {
    if (!selectedTemplate) return
    
    let finalValues: Record<string, Record<string, any>> = {}
    
    if (reportType === 'todos') {
      const todosValues = reportValues['todos'] || {}
      // Copy answers to all students so parent delivery pipeline is 100% transparent and reliable
      targetedStudents.forEach(st => {
        finalValues[st.id] = { ...todosValues }
      })
    } else {
      finalValues = reportValues
    }

    const attachmentText = reportType === 'todos'
      ? `Relatório Coletivo: ${selectedTemplate.name}`
      : `Relatório Personalizado: ${selectedTemplate.name} (${targetedStudents.length} alunos)`
    
    onAdd(attachmentText, {
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      type: reportType,
      values: finalValues,
      studentCount: targetedStudents.length
    })
    onClose()
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
      <div className="ad-reports-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        
        {step === 1 ? (
          /* ========================================================================= */
          /* ── STEP 1: Tipo de Relatório e Seleção de Template ────────────────────── */
          /* ========================================================================= */
          <motion.div 
            className="ad-reports-modal-card"
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
                <h3 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 6 }}>📊 Adicionar Relatório</h3>
                <p style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Envie rotinas pedagógicas ou relatórios de progresso.</p>
              </div>
              <button 
                onClick={onClose}
                style={{ 
                  background: '#f1f5f9', width: 44, height: 44, borderRadius: '50%', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Type selector tabs */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Tipo de Relatório</div>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 20, padding: 6, gap: 6 }}>
                <button 
                  onClick={() => setReportType('todos')}
                  style={{
                    flex: 1, padding: '16px 20px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    background: reportType === 'todos' ? '#fff' : 'transparent',
                    boxShadow: reportType === 'todos' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    color: reportType === 'todos' ? '#0f172a' : '#64748b',
                    fontSize: 15, fontWeight: 800, transition: 'all 0.2s'
                  }}
                >
                  Igual para Todos
                </button>
                <button 
                  onClick={() => setReportType('especifico')}
                  style={{
                    flex: 1, padding: '16px 20px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    background: reportType === 'especifico' ? '#fff' : 'transparent',
                    boxShadow: reportType === 'especifico' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    color: reportType === 'especifico' ? '#0f172a' : '#64748b',
                    fontSize: 15, fontWeight: 800, transition: 'all 0.2s'
                  }}
                >
                  Específico por Pessoa
                </button>
              </div>
              
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginTop: 14, paddingLeft: 8 }}>
                {reportType === 'todos' 
                  ? 'Preencha um relatório genérico para todos os destinatários. Todos receberão o mesmo relatório.' 
                  : `Preencha dados específicos para cada aluno. Cada um receberá apenas o seu relatório preenchido (${targetedStudents.length} alunos).`
                }
              </div>
            </div>

            {/* Template choice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escolha o relatório</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
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
                onClick={handleNext}
                disabled={!selectedTemplate}
                style={{ 
                  padding: '16px 36px', borderRadius: 18, border: 'none', background: selectedTemplate ? '#3b82f6' : '#cbd5e1', 
                  color: '#fff', fontSize: 15, fontWeight: 900, cursor: selectedTemplate ? 'pointer' : 'not-allowed',
                  boxShadow: selectedTemplate ? '0 10px 20px rgba(59, 130, 246, 0.2)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                Próximo
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        ) : (
          /* ========================================================================= */
          /* ── STEP 2: Preenchimento de Campos Específicos por Aluno ──────────────── */
          /* ========================================================================= */
          <motion.div 
            className="ad-reports-modal-card"
            initial={{ scale: 0.96, opacity: 0, y: 30 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.96, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            style={{ 
              background: '#fff', borderRadius: 40, width: '95vw', maxWidth: 1100, height: '90vh',
              boxShadow: '0 50px 100px rgba(15, 23, 42, 0.25)', border: '1px solid rgba(255,255,255,0.4)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '28px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: (selectedTemplate?.color || '#3b82f6') + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedTemplate?.color || '#3b82f6' }}>
                  {selectedTemplate && renderIcon(selectedTemplate)}
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{selectedTemplate?.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 12, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                      {reportType === 'todos' ? 'Igual para Todos' : 'Específico por Aluno'}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>• {targetedStudents.length} alunos selecionados</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                style={{ 
                  background: '#f1f5f9', width: 44, height: 44, borderRadius: '50%', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Split Screen Container OR Unified Form Container */}
            {reportType === 'todos' ? (
              /* Unified Form Container for "Igual para Todos" */
              <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div style={{ maxWidth: 700, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ background: '#fff', borderRadius: 24, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>📝 Responder Relatório Coletivo</div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Todos os {targetedStudents.length} alunos do grupo receberão exatamente as mesmas respostas preenchidas abaixo.</div>
                  </div>

                  {allFields.map(field => {
                    const val = reportValues['todos']?.[field.id]
                    return (
                      <div key={field.id} style={{ background: '#fff', borderRadius: 24, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{field.label}</span>
                          {field.required && <span style={{ color: '#ef4444', fontSize: 14 }}>*</span>}
                        </div>

                        {field.type === 'unica-escolha' && field.options ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {field.options.map(opt => {
                              const isSel = val === opt
                              return (
                                <button
                                  key={opt}
                                  onClick={() => {
                                    setReportValues(prev => ({
                                      ...prev,
                                      todos: {
                                        ...(prev.todos || {}),
                                        [field.id]: opt
                                      }
                                    }))
                                  }}
                                  style={{
                                    padding: '12px 20px', borderRadius: 16, border: isSel ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                                    background: isSel ? '#3b82f612' : '#fff', color: isSel ? '#3b82f6' : '#64748b',
                                    fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', gap: 8
                                  }}
                                >
                                  <div style={{
                                    width: 16, height: 16, borderRadius: '50%', border: isSel ? '2px solid #3b82f6' : '2px solid #cbd5e1',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff'
                                  }}>
                                    {isSel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />}
                                  </div>
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder={field.placeholder || "Digite a resposta..."}
                            value={val || ''}
                            onChange={e => {
                              const txtVal = e.target.value
                              setReportValues(prev => ({
                                ...prev,
                                todos: {
                                  ...(prev.todos || {}),
                                  [field.id]: txtVal
                                }
                              }))
                            }}
                            style={{
                              width: '100%', height: 48, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px',
                              fontSize: 14, fontWeight: 600, outline: 'none', background: '#fff', transition: 'all 0.2s'
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* Split Screen Container */
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                
                {/* Left sidebar: Fields List */}
                <div style={{ width: 300, borderRight: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <div style={{ padding: '24px 28px 12px 28px', fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lista de Campos</div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {allFields.map(f => {
                      const count = getFieldCompletionCount(f.id)
                      const isActive = selectedField?.id === f.id
                      return (
                        <button
                          key={f.id}
                          onClick={() => setSelectedField(f)}
                          style={{
                            width: '100%', padding: '16px 20px', borderRadius: 16, border: 'none', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
                            background: isActive ? '#fff' : 'transparent',
                            boxShadow: isActive ? '0 4px 12px rgba(15,23,42,0.04)' : 'none',
                            borderLeft: isActive ? '4px solid #3b82f6' : '4px solid transparent',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span style={{ fontSize: 15, fontWeight: isActive ? 900 : 700, color: isActive ? '#0f172a' : '#64748b' }}>
                            {f.label}
                          </span>
                           <span style={{ fontSize: 12, color: isActive ? '#3b82f6' : '#94a3b8', fontWeight: 800, background: isActive ? '#3b82f612' : '#e2e8f0', padding: '2px 8px', borderRadius: 6 }}>
                             {count}/{targetedStudents.length}
                           </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Right side: Student fill panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                  
                  {/* Panel Header */}
                  <div style={{ padding: '24px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                      {selectedField?.label}:
                    </div>
                    
                    {/* Search Student */}
                    <div style={{ position: 'relative', width: 240 }}>
                      <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input 
                        type="text" 
                        placeholder="Buscar aluno..." 
                        value={searchStudent}
                        onChange={e => setSearchStudent(e.target.value)}
                        style={{ 
                          width: '100%', height: 38, borderRadius: 12, border: '1px solid #e2e8f0', paddingLeft: 38, paddingRight: 16,
                          fontSize: 13, fontWeight: 600, outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Grid Header Columns for Choices */}
                  {selectedField?.type === 'unica-escolha' && selectedField.options && (
                    <div style={{ padding: '12px 40px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 280, fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Aluno</div>
                      <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                        {selectedField.options.map(opt => (
                          <div key={opt} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scrollable Students list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                    {filteredStudents.map(st => {
                      const val = reportValues[st.id]?.[selectedField?.id || '']
                      
                      return (
                        <div 
                          key={st.id}
                          style={{ 
                            padding: '16px 40px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {/* Student profile */}
                          <div style={{ width: 280, display: 'flex', alignItems: 'center', gap: 14, paddingRight: 12 }}>
                            <div style={{ 
                              width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg, ${selectedTemplate?.color || '#3b82f6'}, #4f46e5)`,
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
                              flexShrink: 0
                            }}>
                              {st.nome?.charAt(0) || 'A'}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.nome}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{st.turma || 'Sem turma'}</div>
                            </div>
                          </div>

                          {/* Input controls based on field type */}
                           <div style={{ flex: 1 }}>
                             {selectedField?.type === 'unica-escolha' && selectedField.options ? (
                               <div style={{ display: 'flex', gap: 12 }}>
                                 {selectedField.options.map(opt => {
                                   const isSel = val === opt
                                   return (
                                     <div key={opt} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                       <button
                                         onClick={() => {
                                           setReportValues(prev => ({
                                             ...prev,
                                             [st.id]: {
                                               ...(prev[st.id] || {}),
                                               [selectedField.id]: opt
                                             }
                                           }))
                                         }}
                                         style={{
                                           width: 28, height: 28, borderRadius: '50%', border: isSel ? '2px solid #3b82f6' : '2px solid #cbd5e1',
                                           background: isSel ? '#3b82f6' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                           transition: 'all 0.2s', boxShadow: isSel ? '0 4px 8px rgba(59,130,246,0.3)' : 'none'
                                         }}
                                       >
                                         {isSel && <Check size={14} color="#fff" />}
                                       </button>
                                     </div>
                                   )
                                 })}
                               </div>
                             ) : (
                               /* Text Long / Default input */
                               <input 
                                 type="text"
                                 placeholder="Adicione observações..."
                                 value={val || ''}
                                 onChange={e => {
                                   const txtVal = e.target.value
                                   setReportValues(prev => ({
                                     ...prev,
                                     [st.id]: {
                                       ...(prev[st.id] || {}),
                                       [selectedField?.id || '']: txtVal
                                     }
                                   }))
                                 }}
                                 style={{ 
                                   width: '100%', height: 44, borderRadius: 14, border: '1px solid #e2e8f0', padding: '0 16px',
                                   fontSize: 13, fontWeight: 600, outline: 'none', background: '#fff', transition: 'all 0.2s'
                                 }}
                                 onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                                 onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                               />
                             )}
                           </div>
                        </div>
                      )
                    })}
                    {filteredStudents.length === 0 && (
                      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                        <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700 }}>Nenhum aluno encontrado</div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* Modal Footer */}
            <div style={{ padding: '24px 40px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <button 
                onClick={() => setStep(1)}
                style={{ 
                  padding: '14px 24px', borderRadius: 16, border: '1px solid #cbd5e1', background: '#fff', 
                  color: '#475569', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 
                }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              
              <button 
                onClick={handleFinish}
                style={{ 
                  padding: '14px 36px', borderRadius: 16, border: 'none', background: '#10b981', 
                  color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                Adicionar ao Comunicado <Check size={18} />
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </AnimatePresence>
  )
}
