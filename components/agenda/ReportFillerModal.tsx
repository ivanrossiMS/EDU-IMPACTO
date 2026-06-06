import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ArrowRight, ArrowLeft, User, ClipboardList, Users, UserCheck, Loader2 } from 'lucide-react'
import { useRelatorios, ReportTemplate, ReportField } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

import { useData } from '@/lib/dataContext';

interface ReportFillerModalProps {
  isOpen: boolean
  onClose: () => void
  anexoStr: string | null
  currentUser: any
  alunos: any[]
  turmas?: any[]
}

export function ReportFillerModal({ isOpen, anexoStr, onClose, currentUser, alunos, turmas: propTurmas }: ReportFillerModalProps) {
  const { templates = [] } = useRelatorios()
  const { adAlert } = useAgendaDigital()
  const { turmas: contextTurmas = [] } = useData()

  const turmas = propTurmas || contextTurmas;

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [fillMode, setFillMode] = useState<'igual' | 'especifico' | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [isSelectingStudents, setIsSelectingStudents] = useState(false)
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Record<string, any>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Parse payload
  const payload = useMemo(() => {
    if (!anexoStr) return null;
    try {
      const parts = anexoStr.split('|');
      if (parts.length >= 2) {
        const jsonStr = parts[1].replace('payload:', '');
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      console.error("Failed to parse report assignment payload", e);
    }
    return null;
  }, [anexoStr]);

  const template = useMemo(() => {
    if (!payload || !payload.templateId) return null;
    return templates.find(t => t.id === payload.templateId) || null;
  }, [payload, templates]);

  const allFields = useMemo(() => {
    if (!template) return [];
    return template.sections.flatMap(s => s.fields);
  }, [template]);

  const currentField = allFields[currentFieldIndex] || null;

  const targetedStudents = useMemo(() => {
    if (!payload || !alunos) return [];
    if (payload.studentIds && payload.studentIds.length > 0) {
      return alunos.filter(a => payload.studentIds.includes(a.id));
    }
    if (payload.turmaId) {
      return alunos.filter(a => String(a.turma || '').trim().toLowerCase() === String(payload.turmaId).trim().toLowerCase());
    }
    return [];
  }, [payload, alunos]);

  const activeStudents = useMemo(() => {
    if (fillMode === 'especifico') {
      return targetedStudents.filter(s => selectedStudentIds.includes(s.id));
    }
    return targetedStudents;
  }, [fillMode, targetedStudents, selectedStudentIds]);

  // Initialize selected students
  useEffect(() => {
    if (isOpen && targetedStudents && targetedStudents.length > 0) {
      setSelectedStudentIds(prev => prev.length === 0 ? targetedStudents.map(s => s.id) : prev);
    }
  }, [isOpen, targetedStudents]);

  // Reset state when opening a new report task
  useEffect(() => {
    if (isOpen) {
      setFillMode(null)
      setCurrentFieldIndex(0)
      setAnswers({})
      setIsSubmitting(false)
      setIsSelectingStudents(false)
      setSelectedStudentIds([])
    }
  }, [isOpen, anexoStr])

  if (!isOpen || !payload || !template || targetedStudents.length === 0) return null;

  // Helper to abbreviate surnames (e.g. "Arthur Souza Hindo" -> "Arthur Souza H.")
  const abbreviateName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    
    const first = parts[0];
    const rawSurnames = parts.slice(1);
    
    const prepositions = ['de', 'da', 'do', 'das', 'dos'];
    const validSurnames = rawSurnames.filter(s => !prepositions.includes(s.toLowerCase()));
    
    // Deixar metade abreviados (arredondando para cima: se tem 3, 2 abreviados. Se tem 4, 2 abreviados).
    const numToAbbreviate = Math.ceil(validSurnames.length / 2);
    const numToKeepFull = validSurnames.length - numToAbbreviate;
    
    let validCount = 0;
    const processedSurnames = rawSurnames.map(s => {
      if (prepositions.includes(s.toLowerCase())) return s.toLowerCase();
      
      const keepFull = validCount < numToKeepFull;
      validCount++;
      
      if (keepFull) {
        return s;
      } else {
        return s[0].toUpperCase() + '.';
      }
    });
    
    return `${first} ${processedSurnames.join(' ')}`.trim();
  }

  const handleNext = () => {
    if (currentFieldIndex < allFields.length - 1) {
      setCurrentFieldIndex(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(prev => prev - 1)
    } else {
      setFillMode(null) // Go back to mode selection
    }
  }

  const handleAnswerChange = (studentId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [currentField.id]: value
      }
    }))
  }

  const handleFinish = async () => {
    setIsSubmitting(true)

    const newSubmissions: any[] = []
    const newDisparos: any[] = []
    const newComunicados: any[] = []
    const fullPayloadValues: Record<string, any> = {}

    // Gerar o anexo do relatório para o aluno (Família)
    const getTurmaName = (aluno: any) => {
      if (aluno.turma_nome && String(aluno.turma_nome).trim() !== '') return aluno.turma_nome;
      if (turmas && turmas.length > 0) {
        const t = turmas.find(t => String(t.id) === String(aluno.turma) || String(t.nome) === String(aluno.turma) || String(t.codigo) === String(aluno.turma));
        if (t) return t.nome;
      }
      return aluno.turma || '';
    };

    activeStudents.forEach(aluno => {
      // If 'igual', use the 'GLOBAL' answers. Otherwise use the student's specific answers.
      const studentAnswers = fillMode === 'igual' ? (answers['GLOBAL'] || {}) : (answers[aluno.id] || {})
      fullPayloadValues[aluno.id] = studentAnswers
      
      const submission = {
        id: `SUB-REL-${Date.now()}-${aluno.id}-${Math.random().toString(36).substr(2, 5)}`,
        formId: template.id,
        version: template.version || 1,
        authorName: currentUser?.nome || 'Colaborador',
        studentName: aluno.id, // We store the ID here to link properly
        data: studentAnswers,
        signedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        dataReferencia: payload.dataReferencia
      }
      
      newSubmissions.push(submission)

      newDisparos.push({
        id: `D-REL-${Date.now()}-${aluno.id}-${Math.random().toString(36).substr(2, 5)}`,
        formId: template.id,
        targetId: aluno.id,
        targetName: 'Família',
        status: 'respondido',
        sentAt: new Date().toISOString()
      })


      const studentPayload = {
         ...payload,
         template: template,
         values: { [aluno.id]: studentAnswers },
         studentCount: 1,
         studentInfo: {
            id: aluno.id,
            name: aluno.nome,
            avatarUrl: aluno.foto || aluno.avatarUrl || null,
            turma: `${getTurmaName(aluno)} - ${aluno.dados?.anoLetivo || aluno.ano_letivo || aluno.ano || new Date().getFullYear().toString()}`
         }
      }

      newComunicados.push({
        id: `AD-COM-REL-STU-${Date.now()}-${aluno.id}-${Math.random().toString(36).substr(2, 5)}`,
        titulo: `Relatório de Rotina: ${aluno.nome.split(' ')[0]}`,
        conteudo: `Olá! O relatório de rotina diária do(a) aluno(a) ${aluno.nome.split(' ')[0]} já está disponível. Clique no anexo abaixo para visualizar.`,
        tipo: 'texto',
        autor: currentUser?.nome || 'Equipe Pedagógica',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        turmas: [],
        alunosIds: [aluno.id.replace(/^a_?/, '')],
        destino: 'selecionados',
        prioridade: 'normal',
        fixado: false,
        exigeCiencia: true,
        permiteResposta: true,
        dataEnvio: new Date().toISOString(),
        dataAgendamento: null,
        anexos: [`Relatório Personalizado: ${template.name}|payload:${JSON.stringify(studentPayload)}|report-payload`],
        leituras: {},
        ciencias: {},
        status: 'enviado'
      })
    })

    const colabAnexos = activeStudents.map(aluno => {
       const studentPayload = {
          ...payload,
          template: template,
          values: { [aluno.id]: fullPayloadValues[aluno.id] },
          studentCount: 1,
          studentInfo: {
            id: aluno.id,
            name: aluno.nome,
            avatarUrl: aluno.foto || aluno.avatarUrl || null,
            turma: `${getTurmaName(aluno)} - ${aluno.dados?.anoLetivo || aluno.ano_letivo || aluno.ano || new Date().getFullYear().toString()}`
          }
       }
       // Para o colaborador, o nome do arquivo será o nome do aluno, assim ele clica no aluno que quiser ver.
       return `Relatório Personalizado: ${aluno.nome.split(' ')[0]} ${aluno.nome.split(' ')[1] || ''}|payload:${JSON.stringify(studentPayload)}|report-payload`
    })
    
    newComunicados.push({
        id: `AD-COM-REL-COLAB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        titulo: `Cópia do Relatório: ${template.name}`,
        conteudo: `Relatório dinâmico enviado para a turma.\n\nVocê pode visualizar o relatório individual de cada aluno clicando nos anexos abaixo.`,
        tipo: 'texto',
        autor: currentUser?.nome || 'Equipe Pedagógica',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        turmas: [],
        alunosIds: [],
        destino: 'selecionados',
        prioridade: 'normal',
        fixado: false,
        exigeCiencia: false,
        permiteResposta: false,
        dataEnvio: new Date().toISOString(),
        dataAgendamento: null,
        anexos: colabAnexos,
        leituras: {},
        ciencias: {},
        status: 'enviado'
    })



    try {
      await fetch('/api/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComunicados)
      })
      window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
    } catch (e) {
      console.error('Falha ao criar comunicados:', e)
    }

    adAlert('Relatórios enviados com sucesso para todos os alunos!', 'Sucesso')
    setIsSubmitting(false)
    onClose()
  }

  // Render input based on field type
  const renderFieldInput = (studentId: string) => {
    if (!currentField) return null;
    const value = (answers[studentId] || {})[currentField.id] || '';

    switch (currentField.type) {
      case 'texto-curto':
      case 'numero':
      case 'data':
      case 'hora':
        return (
          <input 
            type={currentField.type === 'texto-curto' ? 'text' : currentField.type === 'numero' ? 'number' : currentField.type} 
            className="form-input" 
            value={value} 
            onChange={e => handleAnswerChange(studentId, e.target.value)} 
            style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15 }}
            placeholder="Digite aqui..."
          />
        )
      case 'texto-longo':
        return (
          <textarea 
            className="form-input" 
            style={{ height: 80, width: '100%', resize: 'vertical', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15 }} 
            value={value} 
            onChange={e => handleAnswerChange(studentId, e.target.value)} 
            placeholder="Digite aqui..."
          />
        )
      case 'sim-nao':
        return (
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', border: value === 'Sim' ? '2px solid #10b981' : '1px solid #cbd5e1', background: value === 'Sim' ? '#ecfdf5' : '#fff', borderRadius: 12, cursor: 'pointer', color: value === 'Sim' ? '#047857' : '#475569', fontWeight: 700 }}>
              <input type="radio" checked={value === 'Sim'} onChange={() => handleAnswerChange(studentId, 'Sim')} style={{ display: 'none' }} /> Sim
            </label>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', border: value === 'Não' ? '2px solid #ef4444' : '1px solid #cbd5e1', background: value === 'Não' ? '#fef2f2' : '#fff', borderRadius: 12, cursor: 'pointer', color: value === 'Não' ? '#b91c1c' : '#475569', fontWeight: 700 }}>
              <input type="radio" checked={value === 'Não'} onChange={() => handleAnswerChange(studentId, 'Não')} style={{ display: 'none' }} /> Não
            </label>
          </div>
        )
      case 'unica-escolha':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentField.options?.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: value === opt ? '2px solid #3b82f6' : '1px solid #cbd5e1', background: value === opt ? '#eff6ff' : '#fff', borderRadius: 12, cursor: 'pointer', color: value === opt ? '#1d4ed8' : '#475569', fontWeight: value === opt ? 700 : 500 }}>
                <input type="radio" checked={value === opt} onChange={() => handleAnswerChange(studentId, opt)} style={{ width: 18, height: 18 }} /> {opt}
              </label>
            ))}
          </div>
        )
      case 'multipla-escolha':
        const selectedOpts = Array.isArray(value) ? value : [];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentField.options?.map(opt => {
              const isSelected = selectedOpts.includes(opt);
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: isSelected ? '2px solid #3b82f6' : '1px solid #cbd5e1', background: isSelected ? '#eff6ff' : '#fff', borderRadius: 12, cursor: 'pointer', color: isSelected ? '#1d4ed8' : '#475569', fontWeight: isSelected ? 700 : 500 }}>
                  <input type="checkbox" checked={isSelected} onChange={(e) => {
                    if (e.target.checked) handleAnswerChange(studentId, [...selectedOpts, opt]);
                    else handleAnswerChange(studentId, selectedOpts.filter(o => o !== opt));
                  }} style={{ width: 18, height: 18 }} /> {opt}
                </label>
              )
            })}
          </div>
        )
      case 'imagem':
        return (
          <div style={{ padding: '24px 16px', border: '2px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc', textAlign: 'center' }}>
            <input type="file" onChange={e => handleAnswerChange(studentId, e.target.files?.[0]?.name)} style={{ width: '100%' }} />
          </div>
        )
      default:
        return null;
    }
  }

  const progressPercentage = fillMode ? ((currentFieldIndex + 1) / allFields.length) * 100 : 0;

  const modalContent = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999999, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <motion.div 
        initial={{ opacity: 0, y: 30 }} 
        animate={{ opacity: 1, y: 0 }} 
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ 
          background: '#fff', width: '100%', height: '100%', flex: 1,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          paddingTop: 'env(safe-area-inset-top)', // Ensure iOS notch is covered
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {/* Header (Appears in both Step 0 and Step 1) */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>Preenchimento de Relatório</h3>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                {template.name} • {fillMode ? activeStudents.length : targetedStudents.length} alunos
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: '#f8fafc', width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* STEP 0: SELECTION OF MODE */}
        {!fillMode && !isSelectingStudents ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 20, background: '#f8fafc' }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Como deseja preencher?</h2>
              <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500, margin: 0 }}>Escolha o modo de preenchimento para esta turma.</p>
            </div>

            <div 
              onClick={() => setFillMode('igual')}
              style={{ background: '#fff', padding: 20, borderRadius: 16, border: '2px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Igual para todos</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>Responda uma única vez e aplique a todos os {targetedStudents.length} alunos.</p>
              </div>
            </div>

            <div 
              onClick={() => setIsSelectingStudents(true)}
              style={{ background: '#fff', padding: 20, borderRadius: 16, border: '2px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserCheck size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Específico por aluno</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>Responda individualmente a pergunta para cada aluno na lista.</p>
              </div>
            </div>
          </div>
        ) : !fillMode && isSelectingStudents ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <button 
                   onClick={() => setIsSelectingStudents(false)}
                   style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
                 >
                   <ArrowLeft size={16} />
                 </button>
                 <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Selecione os Alunos</h2>
               </div>
               <button 
                 onClick={() => {
                   if (selectedStudentIds.length === targetedStudents.length) {
                     setSelectedStudentIds([])
                   } else {
                     setSelectedStudentIds(targetedStudents.map(s => s.id))
                   }
                 }}
                 style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
               >
                 {selectedStudentIds.length === targetedStudents.length ? 'Desmarcar todos' : 'Marcar todos'}
               </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
               {targetedStudents.map(aluno => (
                  <label key={aluno.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <input 
                      type="checkbox" 
                      style={{ width: 18, height: 18 }} 
                      checked={selectedStudentIds.includes(aluno.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds(prev => [...prev, aluno.id])
                        } else {
                          setSelectedStudentIds(prev => prev.filter(id => id !== aluno.id))
                        }
                      }}
                    />
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                      {aluno.foto_url || aluno.foto ? <img src={aluno.foto_url || aluno.foto} alt={aluno.nome} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={16} />}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>{abbreviateName(aluno.nome)}</span>
                  </label>
               ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button 
                onClick={() => {
                   if (selectedStudentIds.length === 0) {
                      adAlert('Selecione pelo menos um aluno para continuar.', 'Atenção')
                      return;
                   }
                   setFillMode('especifico')
                }}
                disabled={selectedStudentIds.length === 0}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: selectedStudentIds.length === 0 ? '#94a3b8' : '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 800, cursor: selectedStudentIds.length === 0 ? 'not-allowed' : 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div style={{ height: 4, background: '#f1f5f9', width: '100%', flexShrink: 0 }}>
              <div style={{ height: '100%', background: '#10b981', width: `${progressPercentage}%`, transition: 'width 0.3s ease' }} />
            </div>

            {/* Form Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, background: '#f8fafc' }}>
              
              {/* Question Header */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, background: '#f1f5f9', padding: '4px 10px', borderRadius: 8 }}>
                    Pergunta {currentFieldIndex + 1} de {allFields.length}
                  </div>
                  {fillMode === 'igual' && (
                    <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 800, background: '#eff6ff', padding: '4px 8px', borderRadius: 8 }}>
                      Para Todos
                    </div>
                  )}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>{currentField?.label}</h2>
                {currentField?.required && <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, display: 'block', marginTop: 8 }}>* Obrigatório</span>}
              </div>

              {/* Answers List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
                {fillMode === 'igual' ? (
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 12 }}>Resposta única para os {targetedStudents.length} alunos:</div>
                    {renderFieldInput('GLOBAL')}
                  </div>
                ) : (
                  activeStudents.map(aluno => (
                    <div key={aluno.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                          {aluno.foto_url || aluno.foto ? <img src={aluno.foto_url || aluno.foto} alt={aluno.nome} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={16} />}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                          {abbreviateName(aluno.nome)}
                        </div>
                      </div>
                      
                      <div style={{ width: '100%' }}>
                        {renderFieldInput(aluno.id)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <button 
                onClick={handlePrev}
                style={{ 
                  padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', 
                  color: '#475569', fontSize: 14, fontWeight: 700, 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 
                }}
              >
                <ArrowLeft size={16} /> Anterior
              </button>
              
              {currentFieldIndex < allFields.length - 1 ? (
                <button 
                  onClick={handleNext}
                  style={{ 
                    padding: '12px 20px', borderRadius: 12, border: 'none', background: '#3b82f6', 
                    color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                  }}
                >
                  Próxima <ArrowRight size={16} />
                </button>
              ) : (
                <button 
                  onClick={handleFinish}
                  disabled={isSubmitting}
                  style={{ 
                    padding: '12px 20px', borderRadius: 12, border: 'none', background: '#10b981', 
                    color: '#fff', fontSize: 14, fontWeight: 800, cursor: isSubmitting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: 'flex' }}>
                        <Loader2 size={16} />
                      </motion.div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Enviar
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : modalContent;
}
