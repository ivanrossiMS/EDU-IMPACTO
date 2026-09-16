import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ArrowRight, ArrowLeft, User, ClipboardList, Users, UserCheck, Loader2, Copy } from 'lucide-react'
import { useRelatorios, ReportTemplate, ReportField } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

import { useData } from '@/lib/dataContext';
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils';
import { getCachedStudentPhoto, fetchStudentPhotos } from '@/lib/studentPhotoCache';

interface ReportFillerModalProps {
  isOpen: boolean
  onClose: () => void
  onBack?: () => void
  anexoStr: string | null
  currentUser: any
  alunos: any[]
  turmas?: any[]
}

export function ReportFillerModal({ isOpen, anexoStr, onClose, onBack, currentUser, alunos, turmas: propTurmas }: ReportFillerModalProps) {
  const { templates = [] } = useRelatorios()
  const { adAlert, setComunicadosLocally } = useAgendaDigital()
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
  const [reportTitle, setReportTitle] = useState('')
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null)

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

  // 1. Extrai todas as turmas alvo envolvidas neste relatório
  const targetTurmaIds = useMemo(() => {
    if (!payload) return [];
    if (Array.isArray(payload.turmaIds) && payload.turmaIds.length > 0) {
      return payload.turmaIds.map((id: any) => String(id));
    }
    if (payload.turmaId) {
      return [String(payload.turmaId)];
    }
    return [];
  }, [payload]);

  // 2. Resolve os objetos das turmas no ERP
  const targetTurmaObjs = useMemo(() => {
    if (!targetTurmaIds.length || !turmas) return [];
    const setIds = new Set(targetTurmaIds.map((id: string) => id.trim().toLowerCase()));
    const setClean = new Set(targetTurmaIds.map((id: string) => id.trim().replace(/^sync-/, '').toLowerCase()));
    return (turmas || []).filter((t: any) => {
      const tid = String(t.id).toLowerCase();
      const tcode = String(t.codigo || '').toLowerCase();
      const tnome = String(t.nome || '').trim().toLowerCase();
      return setIds.has(tid) || setClean.has(tid) || setIds.has(tcode) || setClean.has(tcode) || setIds.has(tnome);
    });
  }, [targetTurmaIds, turmas]);

  // 3. Helper para obter o objeto de turma de cada aluno (dando prioridade às turmas deste relatório)
  const getAlunoTurmaObj = React.useCallback((aluno: any) => {
    if (!aluno) return null;
    if (targetTurmaObjs.length > 0) {
      for (const tObj of targetTurmaObjs) {
        if (isAlunoCursandoTurma(aluno, tObj, tObj.ano, turmas)) {
          return tObj;
        }
      }
    }
    if (turmas && turmas.length > 0) {
      const aTurmaRef = String(aluno.turma || aluno.turma_nome || (aluno as any).turmaId || '').trim().toLowerCase();
      return turmas.find(t => 
        String(t.id).toLowerCase() === aTurmaRef ||
        String(t.nome).trim().toLowerCase() === aTurmaRef ||
        String(t.codigo || '').toLowerCase() === aTurmaRef
      ) || null;
    }
    return null;
  }, [targetTurmaObjs, turmas]);

  // 4. Helper para obter o nome formatado da turma do aluno
  const getTurmaName = React.useCallback((aluno: any) => {
    const tObj = getAlunoTurmaObj(aluno);
    if (tObj?.nome) return tObj.nome;
    if (aluno.turma_nome && String(aluno.turma_nome).trim() !== '') return aluno.turma_nome;
    return aluno.turma || '';
  }, [getAlunoTurmaObj]);

  // 5. Resolução da lista consolidada de alunos participantes
  const targetedStudents = useMemo(() => {
    if (!payload || !alunos) return [];

    if (payload.studentIds && payload.studentIds.length > 0) {
      const idSet = new Set(payload.studentIds.map((id: any) => String(id)));
      return alunos.filter(a => {
        if (!idSet.has(String(a.id))) return false;
        // Se há turmas conhecidas, valida se o aluno realmente cursa alguma delas
        if (targetTurmaObjs.length > 0) {
          return targetTurmaObjs.some(tObj => isAlunoCursandoTurma(a, tObj, tObj.ano, turmas));
        }
        return true;
      });
    }

    if (targetTurmaObjs.length > 0) {
      return alunos.filter(a => targetTurmaObjs.some(tObj => isAlunoCursandoTurma(a, tObj, tObj.ano, turmas)));
    }

    if (targetTurmaIds.length > 0) {
      const targetIdSet = new Set(targetTurmaIds.map((t: string) => t.toLowerCase()));
      const cleanSet = new Set(targetTurmaIds.map((t: string) => t.replace(/^sync-/, '').toLowerCase()));
      return alunos.filter(a => {
        const refs = [String(a.turma || '').trim(), String((a as any).turmaId || '').trim()].filter(Boolean);
        return refs.some(tRef => {
          const tRefLower = tRef.toLowerCase();
          return targetIdSet.has(tRefLower) || cleanSet.has(tRefLower);
        });
      });
    }

    return [];
  }, [payload, alunos, turmas, targetTurmaObjs, targetTurmaIds]);

  // 6. Agrupamento dos alunos por turma para visualização organizada
  const targetedStudentsByTurma = useMemo(() => {
    const map = new Map<string, { turmaName: string; turmaId: string; students: any[] }>();

    targetedStudents.forEach(aluno => {
      const tName = getTurmaName(aluno) || 'Outros / Sem Turma';
      if (!map.has(tName)) {
        map.set(tName, {
          turmaName: tName,
          turmaId: aluno.turma || tName,
          students: []
        });
      }
      map.get(tName)!.students.push(aluno);
    });

    return Array.from(map.values()).sort((a, b) => a.turmaName.localeCompare(b.turmaName, 'pt-BR'));
  }, [targetedStudents, getTurmaName]);

  const activeStudents = useMemo(() => {
    const list = fillMode === 'especifico'
      ? targetedStudents.filter(s => selectedStudentIds.includes(s.id))
      : targetedStudents;

    return [...list].sort((a, b) => {
      const tA = getTurmaName(a) || '';
      const tB = getTurmaName(b) || '';
      const cmp = tA.localeCompare(tB, 'pt-BR');
      if (cmp !== 0) return cmp;
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
  }, [fillMode, targetedStudents, selectedStudentIds, getTurmaName]);

  const hasAnyAnswer = useMemo(() => {
    if (!currentField) return false;
    return activeStudents.some(aluno => {
      const val = (answers[aluno.id] || {})[currentField.id];
      return val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
    });
  }, [answers, activeStudents, currentField]);

  const [loadedPhotos, setLoadedPhotos] = useState<Record<string, string | null>>({});

  // Pré-carrega fotos dos alunos da turma/selecionados que não têm foto carregada
  useEffect(() => {
    if (!isOpen || !targetedStudents || targetedStudents.length === 0) return;
    const idsToFetch = targetedStudents
      .filter(a => !(a.foto || a.foto_url || a.avatarUrl || getCachedStudentPhoto(a.id)))
      .map(a => a.id);

    if (idsToFetch.length > 0) {
      fetchStudentPhotos(idsToFetch).then(photos => {
        setLoadedPhotos(prev => ({ ...prev, ...photos }));
      });
    }
  }, [isOpen, targetedStudents]);

  const getAlunoPhoto = (aluno: any) => {
    if (!aluno) return null;
    const cleanId = String(aluno.id || '').replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
    return aluno.foto || aluno.foto_url || aluno.avatarUrl || aluno.dados?.foto || aluno.dados?.avatarUrl || loadedPhotos[cleanId] || loadedPhotos[aluno.id] || getCachedStudentPhoto(cleanId) || null;
  };

  // Initialize selected students or reset when payload changes
  useEffect(() => {
    if (isOpen && targetedStudents && targetedStudents.length > 0) {
      setSelectedStudentIds(targetedStudents.map(s => s.id));
    }
  }, [isOpen, payload]);

  // Reset state when opening a new report task
  useEffect(() => {
    if (isOpen) {
      setFillMode(null)
      setCurrentFieldIndex(0)
      setAnswers({})
      setIsSubmitting(false)
      setIsSelectingStudents(false)
      setReportTitle('')
      setCopiedStudentId(null)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, payload?.templateId])

  useEffect(() => {
    setCopiedStudentId(null)
  }, [currentFieldIndex])

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
    setAnswers(prev => {
      const studentAns = { ...(prev[studentId] || {}) }
      if (value === '' || value === undefined || value === null) {
        delete studentAns[currentField.id]
      } else {
        studentAns[currentField.id] = value
      }
      return {
        ...prev,
        [studentId]: studentAns
      }
    })
  }

  const isTextField = currentField?.type === 'texto-curto' || currentField?.type === 'texto-longo' || currentField?.type === 'numero';

  const handleCopyToAll = (sourceStudentId: string) => {
    if (!currentField) return;
    const sourceValue = (answers[sourceStudentId] || {})[currentField.id];
    if (sourceValue === undefined || sourceValue === null || String(sourceValue).trim() === '') return;

    // Verificar se algum outro aluno ativo já possui anotação divergente
    const hasConflictingAnswers = activeStudents.some(s => {
      if (s.id === sourceStudentId) return false;
      const existingVal = (answers[s.id] || {})[currentField.id];
      return existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== '' && String(existingVal).trim() !== String(sourceValue).trim();
    });

    if (hasConflictingAnswers) {
      const confirmOverwrite = window.confirm(
        'Outros alunos já possuem anotações neste campo. Deseja substituir a resposta de todos pelo conteúdo deste aluno?'
      );
      if (!confirmOverwrite) return;
    }

    setAnswers(prev => {
      const updated = { ...prev };
      activeStudents.forEach(s => {
        updated[s.id] = {
          ...(updated[s.id] || {}),
          [currentField.id]: sourceValue
        };
      });
      return updated;
    });

    setCopiedStudentId(sourceStudentId);
    setTimeout(() => {
      setCopiedStudentId(prev => (prev === sourceStudentId ? null : prev));
    }, 2500);
  }

  const handleUnmarkAll = () => {
    if (!currentField) return;
    if (!hasAnyAnswer) return;

    const ok = window.confirm('Deseja realmente desmarcar a resposta de todos os alunos para esta pergunta?');
    if (!ok) return;

    setAnswers(prev => {
      const updated = { ...prev };
      activeStudents.forEach(aluno => {
        if (updated[aluno.id]) {
          const studentAns = { ...updated[aluno.id] };
          delete studentAns[currentField.id];
          updated[aluno.id] = studentAns;
        }
      });
      return updated;
    });

    setCopiedStudentId(null);
  }

  const handleFinish = async () => {
    if (!template || !payload) return;
    setIsSubmitting(true)

    const newSubmissions: any[] = []
    const newDisparos: any[] = []
    const newComunicados: any[] = []
    const fullPayloadValues: Record<string, any> = {}

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
            avatarUrl: getAlunoPhoto(aluno),
            turma: `${getTurmaName(aluno)} - ${aluno.dados?.anoLetivo || aluno.ano_letivo || aluno.ano || new Date().getFullYear().toString()}`
         }
      }

      const baseTitle = reportTitle ? reportTitle : `Relatório de Rotina`;
      const cleanTitle = baseTitle.replace(/Cópia - /g, '');

      newComunicados.push({
        id: `AD-COM-REL-STU-${Date.now()}-${aluno.id}-${Math.random().toString(36).substr(2, 5)}`,
        titulo: `${cleanTitle}: ${aluno.nome.split(' ')[0]}`,
        conteudo: `Olá! O relatório de rotina diária do(a) aluno(a) ${aluno.nome.split(' ')[0]} já está disponível. Clique no anexo abaixo para visualizar.`,
        tipo: 'texto',
        autor: currentUser?.nome || 'Equipe Pedagógica',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        turmas: [],
        turmasIds: [],
        turma_nome: getTurmaName(aluno),
        alunosIds: [aluno.id.replace(/^a_?/, '')],
        tipoRelatorio: 'individual',
        destino: 'selecionados',
        prioridade: 'normal',
        fixado: false,
        exigeCiencia: false,
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
            avatarUrl: getAlunoPhoto(aluno),
            turma: `${getTurmaName(aluno)} - ${aluno.dados?.anoLetivo || aluno.ano_letivo || aluno.ano || new Date().getFullYear().toString()}`
          }
       }
       // Para o colaborador, o nome do arquivo será o nome do aluno, assim ele clica no aluno que quiser ver.
       return `Relatório Personalizado: ${aluno.nome.split(' ')[0]} ${aluno.nome.split(' ')[1] || ''}|payload:${JSON.stringify(studentPayload)}|report-payload`
    })
    
    const uniqueTurmas = Array.from(new Set(activeStudents.map(a => getTurmaName(a)))).filter(Boolean) as string[];

    const baseColabTitle = reportTitle ? reportTitle : `Relatório: ${template.name}`;
    const cleanColabTitle = baseColabTitle.replace(/Cópia - /g, '');

    newComunicados.push({
        id: `AD-COM-REL-COLAB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        titulo: cleanColabTitle,
        conteudo: `Relatório dinâmico enviado para a turma.\n\nVocê pode visualizar o relatório individual de cada aluno clicando nos anexos abaixo.`,
        tipo: 'texto',
        autor: currentUser?.nome || 'Equipe Pedagógica',
        autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
        autorId: currentUser?.id || '',
        autorFoto: currentUser?.foto || null,
        turmas: uniqueTurmas.length > 0 ? uniqueTurmas : (payload.turmaId ? [payload.turmaId] : []),
        alunosIds: fillMode === 'especifico' ? activeStudents.map(a => a.id.replace(/^a_?/, '')) : [],
        destino: 'interno',
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

    // Integração Automática com Conteúdos e Tarefas (Diário Digital)
    try {
      const conteudoField = allFields.find(f => f.label?.toLowerCase().includes('conteúdo') || f.label?.toLowerCase().includes('conteudo'));
      const tarefaField = allFields.find(f => f.label?.toLowerCase().includes('tarefa'));

      if (conteudoField || tarefaField) {
        // Pega as respostas (seja GLOBAL ou do primeiro aluno selecionado)
        const sampleStudentId = fillMode === 'igual' ? 'GLOBAL' : (activeStudents[0]?.id || 'GLOBAL');
        const sampleAnswer = answers[sampleStudentId] || {};
        
        const valConteudo = sampleAnswer[conteudoField?.id || ''] || '';
        const valTarefa = sampleAnswer[tarefaField?.id || ''] || '';

        if (valConteudo || valTarefa) {
          const textFinal = [];
          if (valConteudo) textFinal.push(`**Conteúdo:**\n${valConteudo}`);
          if (valTarefa) textFinal.push(`**Tarefa:**\n${valTarefa}`);

          // Enviar um registro para cada turma única envolvida neste relatório
          const turmasParaLancar = uniqueTurmas.length > 0 ? uniqueTurmas : (payload.turmaId ? [payload.turmaId] : []);
          
          for (const turmaName of turmasParaLancar) {
            const turmaObj = turmas?.find((t: any) => String(t.nome) === String(turmaName) || String(t.id) === String(turmaName));
            const turmaAno = turmaObj?.ano || turmaObj?.dados?.anoLetivo || new Date().getFullYear().toString();

            const payloadDiario = {
              turma_id: turmaName,
              ano: turmaAno,
              data: new Date().toISOString().split('T')[0],
              disciplina: 'Rotina / Relatório Diário',
              conteudo: textFinal.join('\n\n'),
              observacoes: `[Lançado por: ${currentUser?.nome || 'Usuário'} via Relatório em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}]`,
              aulas: 1,
              tipo: 'conteudo'
            };

            fetch('/api/conteudos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payloadDiario)
            }).catch(err => console.error('Erro ao integrar com Diario Digital', err));
          }
        }
      }
    } catch (e) {
      console.error('Erro na integração do diário digital:', e);
    }



    try {
      setComunicadosLocally?.((prev: any) => [...newComunicados, ...prev]);

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
            <div 
              role="button"
              tabIndex={0}
              onClick={() => handleAnswerChange(studentId, value === 'Sim' ? '' : 'Sim')}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleAnswerChange(studentId, value === 'Sim' ? '' : 'Sim'); } }}
              style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 8, 
                padding: '12px', 
                border: value === 'Sim' ? '2px solid #10b981' : '1px solid #cbd5e1', 
                background: value === 'Sim' ? '#ecfdf5' : '#fff', 
                borderRadius: 12, 
                cursor: 'pointer', 
                color: value === 'Sim' ? '#047857' : '#475569', 
                fontWeight: 700,
                userSelect: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <input type="radio" checked={value === 'Sim'} readOnly style={{ display: 'none' }} /> Sim
            </div>
            <div 
              role="button"
              tabIndex={0}
              onClick={() => handleAnswerChange(studentId, value === 'Não' ? '' : 'Não')}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleAnswerChange(studentId, value === 'Não' ? '' : 'Não'); } }}
              style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 8, 
                padding: '12px', 
                border: value === 'Não' ? '2px solid #ef4444' : '1px solid #cbd5e1', 
                background: value === 'Não' ? '#fef2f2' : '#fff', 
                borderRadius: 12, 
                cursor: 'pointer', 
                color: value === 'Não' ? '#b91c1c' : '#475569', 
                fontWeight: 700,
                userSelect: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <input type="radio" checked={value === 'Não'} readOnly style={{ display: 'none' }} /> Não
            </div>
          </div>
        )
      case 'unica-escolha':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentField.options?.map(opt => {
              const isSelected = value === opt;
              return (
                <div 
                  key={opt}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleAnswerChange(studentId, isSelected ? '' : opt)}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleAnswerChange(studentId, isSelected ? '' : opt); } }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: '12px 16px', 
                    border: isSelected ? '2px solid #3b82f6' : '1px solid #cbd5e1', 
                    background: isSelected ? '#eff6ff' : '#fff', 
                    borderRadius: 12, 
                    cursor: 'pointer', 
                    color: isSelected ? '#1d4ed8' : '#475569', 
                    fontWeight: isSelected ? 700 : 500,
                    userSelect: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input 
                    type="radio" 
                    checked={isSelected} 
                    readOnly 
                    style={{ width: 18, height: 18, pointerEvents: 'none', accentColor: '#3b82f6' }} 
                  /> 
                  <span style={{ flex: 1 }}>{opt}</span>
                </div>
              );
            })}
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

  const progressPercentage = fillMode && allFields.length > 0 ? ((currentFieldIndex + 1) / allFields.length) * 100 : 0;

  const modalContent = (
    <AnimatePresence>
      {isOpen && payload && template && targetedStudents.length > 0 && (
        <div className="ad-report-filler-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999999, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @media (min-width: 769px) {
              .ad-report-filler-modal {
                border-radius: 24px !important;
                max-width: 640px !important;
                height: 85vh !important;
                flex: none !important;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
              }
              .ad-report-filler-overlay {
                padding: 40px;
              }
            }
            @media (max-width: 768px) {
              .ad-report-filler-modal {
                width: 100vw !important;
                height: 100dvh !important;
                border-radius: 0 !important;
              }
              .ad-report-filler-overlay {
                padding: 0 !important;
              }
            }
          `}</style>
          <motion.div 
            className="ad-report-filler-modal"
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ 
          background: '#fff', width: '100%', flex: 1,
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
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>{template.name}</span>
                {payload?.turmaName && (
                  <span style={{ color: '#2563eb', fontWeight: 700 }}>
                    {payload.turmaName} • {fillMode ? activeStudents.length : targetedStudents.length} alunos
                  </span>
                )}
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
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 20, background: '#f8fafc' }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>Como deseja preencher?</h2>
                <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500, margin: 0 }}>
                  Escolha o modo de preenchimento para {targetTurmaIds.length > 1 ? 'estas turmas' : 'esta turma'}.
                </p>
              </div>

              <div style={{ background: '#fff', padding: 16, borderRadius: 16, border: '2px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>TÍTULO DO COMUNICADO</label>
                <input 
                  type="text" 
                  value={reportTitle} 
                  onChange={e => setReportTitle(e.target.value)} 
                  placeholder="Ex: Rotina Diária" 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontWeight: 600, color: '#0f172a', outline: 'none' }}
                />
              </div>

              <div 
                onClick={() => {
                  if (!reportTitle.trim()) return;
                  setFillMode('igual')
                }}
                style={{ background: '#fff', padding: 20, borderRadius: 16, border: '2px solid #e2e8f0', cursor: reportTitle.trim() ? 'pointer' : 'not-allowed', opacity: reportTitle.trim() ? 1 : 0.6, display: 'flex', gap: 16, alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Igual para todos</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                    Responda uma única vez e aplique a todos os {targetedStudents.length} alunos{targetTurmaIds.length > 1 ? ` (${targetTurmaIds.length} turmas)` : ''}.
                  </p>
                </div>
              </div>

              <div 
                onClick={() => {
                  if (!reportTitle.trim()) return;
                  setIsSelectingStudents(true)
                }}
                style={{ background: '#fff', padding: 20, borderRadius: 16, border: '2px solid #e2e8f0', cursor: reportTitle.trim() ? 'pointer' : 'not-allowed', opacity: reportTitle.trim() ? 1 : 0.6, display: 'flex', gap: 16, alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserCheck size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Específico por aluno</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                    Selecione e responda individualmente para cada aluno por turma.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <button 
                onClick={onBack || onClose}
                style={{ 
                  flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', 
                  color: '#475569', fontSize: 14, fontWeight: 700, 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 
                }}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button 
                onClick={onClose}
                style={{ 
                  flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', background: '#f8fafc', 
                  color: '#64748b', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        ) : !fillMode && isSelectingStudents ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <button 
                   onClick={() => setIsSelectingStudents(false)}
                   style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
                 >
                   <ArrowLeft size={16} />
                 </button>
                 <div>
                   <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Selecione os Alunos</h2>
                   <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                     {selectedStudentIds.length} de {targetedStudents.length} selecionados
                   </p>
                 </div>
               </div>
               <button 
                 onClick={() => {
                   if (selectedStudentIds.length === targetedStudents.length) {
                     setSelectedStudentIds([])
                   } else {
                     setSelectedStudentIds(targetedStudents.map(s => s.id))
                   }
                 }}
                 style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
               >
                 {selectedStudentIds.length === targetedStudents.length ? 'Desmarcar todos' : 'Marcar todos'}
               </button>
            </div>
            
            {/* Lista de Alunos Agrupada por Turma */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {targetedStudentsByTurma.map(group => {
                const groupSelectedCount = group.students.filter(s => selectedStudentIds.includes(s.id)).length;
                const isAllGroupSelected = groupSelectedCount === group.students.length && group.students.length > 0;

                const toggleAllInGroup = () => {
                  if (isAllGroupSelected) {
                    const groupIds = new Set(group.students.map(s => s.id));
                    setSelectedStudentIds(prev => prev.filter(id => !groupIds.has(id)));
                  } else {
                    const groupIds = group.students.map(s => s.id);
                    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...groupIds])));
                  }
                };

                return (
                  <div 
                    key={group.turmaName}
                    style={{
                      background: '#ffffff',
                      borderRadius: 16,
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Cabeçalho da Turma */}
                    <div style={{
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Users size={14} />
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b' }}>
                          {group.turmaName}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#2563eb',
                          background: '#dbeafe',
                          padding: '1px 7px',
                          borderRadius: 10
                        }}>
                          {groupSelectedCount}/{group.students.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={toggleAllInGroup}
                        style={{
                          background: isAllGroupSelected ? '#fef2f2' : '#eff6ff',
                          border: isAllGroupSelected ? '1px solid #fecaca' : '1px solid #bfdbfe',
                          color: isAllGroupSelected ? '#ef4444' : '#2563eb',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '3px 8px',
                          borderRadius: 7,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isAllGroupSelected ? 'Desmarcar turma' : 'Marcar turma'}
                      </button>
                    </div>

                    {/* Alunos da Turma */}
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {group.students.map(aluno => {
                        const isChecked = selectedStudentIds.includes(aluno.id);
                        return (
                          <label 
                            key={aluno.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 10, 
                              padding: '8px 12px', 
                              background: isChecked ? '#f8fafc' : '#ffffff', 
                              borderRadius: 10, 
                              border: isChecked ? '1px solid #cbd5e1' : '1px solid #f1f5f9', 
                              cursor: 'pointer', 
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              style={{ width: 17, height: 17, cursor: 'pointer' }} 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds(prev => [...prev, aluno.id]);
                                } else {
                                  setSelectedStudentIds(prev => prev.filter(id => id !== aluno.id));
                                }
                              }}
                            />
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0, overflow: 'hidden' }}>
                              {getAlunoPhoto(aluno) ? (
                                <img src={getAlunoPhoto(aluno)!} alt={aluno.nome} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <User size={15} />
                              )}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                              {abbreviateName(aluno.nome)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, background: '#f1f5f9', padding: '4px 10px', borderRadius: 8 }}>
                    Pergunta {currentFieldIndex + 1} de {allFields.length}
                  </div>
                  {fillMode === 'igual' ? (
                    <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 800, background: '#eff6ff', padding: '4px 8px', borderRadius: 8 }}>
                      Para Todos
                    </div>
                  ) : hasAnyAnswer ? (
                    <button
                      type="button"
                      onClick={handleUnmarkAll}
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#ef4444',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 10px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease'
                      }}
                      title="Desmarcar resposta de todos os alunos nesta pergunta"
                    >
                      <X size={13} />
                      <span>Desmarcar todos</span>
                    </button>
                  ) : null}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>{currentField?.label}</h2>
                {currentField?.required && <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, display: 'block', marginTop: 8 }}>* Obrigatório</span>}
              </div>

              {/* Answers List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
                {fillMode === 'igual' ? (
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>
                        Resposta única para os {targetedStudents.length} alunos{targetTurmaIds.length > 1 ? ` (${targetTurmaIds.length} turmas)` : ''}:
                      </div>
                      {(() => {
                        const globalAns = (answers['GLOBAL'] || {})[currentField?.id || ''];
                        const hasGlobalAnswer = globalAns !== undefined && globalAns !== null && globalAns !== '' && (!Array.isArray(globalAns) || globalAns.length > 0);
                        if (!hasGlobalAnswer) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => handleAnswerChange('GLOBAL', '')}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#ef4444',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '4px 10px',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'all 0.15s ease'
                            }}
                            title="Desmarcar resposta para todos"
                          >
                            <X size={13} />
                            <span>Desmarcar</span>
                          </button>
                        );
                      })()}
                    </div>
                    {renderFieldInput('GLOBAL')}
                  </div>
                ) : (
                  activeStudents.map((aluno, index) => {
                    const studentAns = (answers[aluno.id] || {})[currentField?.id || ''];
                    const hasAnswer = studentAns !== undefined && studentAns !== null && studentAns !== '' && (!Array.isArray(studentAns) || studentAns.length > 0);
                    const hasText = typeof studentAns === 'string' ? studentAns.trim().length > 0 : hasAnswer;

                    const alunoTurma = getTurmaName(aluno);
                    const prevTurma = index > 0 ? getTurmaName(activeStudents[index - 1]) : null;
                    const isFirstInTurma = alunoTurma !== prevTurma;

                    return (
                      <React.Fragment key={aluno.id}>
                        {targetTurmaIds.length > 1 && isFirstInTurma && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: index > 0 ? 8 : 0, marginBottom: 2 }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '3px 10px',
                              borderRadius: 9,
                              fontSize: 12,
                              fontWeight: 800
                            }}>
                              <Users size={13} />
                              <span>{alunoTurma}</span>
                            </div>
                            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0, overflow: 'hidden' }}>
                                {getAlunoPhoto(aluno) ? <img src={getAlunoPhoto(aluno)!} alt={aluno.nome} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={16} />}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {abbreviateName(aluno.nome)}
                                </div>
                                {targetTurmaIds.length > 1 && (
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                    {alunoTurma}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {isTextField && hasText && activeStudents.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyToAll(aluno.id)}
                                  style={{
                                    background: copiedStudentId === aluno.id ? '#ecfdf5' : '#eff6ff',
                                    border: copiedStudentId === aluno.id ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                                    color: copiedStudentId === aluno.id ? '#059669' : '#2563eb',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="Copiar este texto para todos os outros alunos"
                                >
                                  {copiedStudentId === aluno.id ? (
                                    <>
                                      <Check size={13} />
                                      <span>Copiado para todos!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={13} />
                                      <span>Copiar para todos</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {hasAnswer && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAnswerChange(aluno.id, '');
                                    if (copiedStudentId === aluno.id) setCopiedStudentId(null);
                                  }}
                                  style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#ef4444',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: '4px 10px',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="Desmarcar resposta para este aluno"
                                >
                                  <X size={13} />
                                  <span>Desmarcar</span>
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div style={{ width: '100%' }}>
                            {renderFieldInput(aluno.id)}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
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
      )}
    </AnimatePresence>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
