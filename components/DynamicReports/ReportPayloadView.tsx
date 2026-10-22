'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Portal from '@/components/Portal';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Sparkles, Star, FileText, User, Utensils, Book, Edit3, Bath, Activity, Droplet, Check, Loader2, RotateCcw } from 'lucide-react';
import { ReportPayload, MOCK_TEMPLATES } from './types';
import { useData } from '@/lib/dataContext';
import StudentProfileBackground from './StudentProfileBackground';
import { getCachedStudentPhoto, setCachedStudentPhoto, fetchStudentPhotos } from '@/lib/studentPhotoCache';

interface ReportPayloadViewProps {
  isOpen: boolean;
  onClose: () => void;
  attachmentString: string;
  targetStudentId?: string;
  targetStudentName?: string;
  targetStudentAvatar?: string;
  alunos?: any[];
  canEdit?: boolean;
  initialEditMode?: boolean;
  onSaveReport?: (updatedAttachmentString: string, updatedPayload: any, studentId: string) => Promise<void> | void;
}

export function ReportPayloadView({ 
  isOpen, 
  onClose, 
  attachmentString, 
  targetStudentId, 
  targetStudentName, 
  targetStudentAvatar,
  alunos: propAlunos,
  canEdit = false,
  initialEditMode = false,
  onSaveReport
}: ReportPayloadViewProps) {
  const [mounted, setMounted] = useState(false);
  const [dynamicAvatar, setDynamicAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [localAttachmentString, setLocalAttachmentString] = useState(attachmentString);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { turmas = [], alunos: contextAlunos = [] } = useData();
  const alunos = propAlunos || contextAlunos;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocalAttachmentString(attachmentString);
  }, [attachmentString]);

  useEffect(() => {
    if (isOpen) {
      setAvatarError(false);
      setIsEditing(Boolean(initialEditMode && canEdit));
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      setIsEditing(false);
      setIsSaving(false);
    }
  }, [isOpen, initialEditMode, canEdit]);

  const payload = useMemo(() => {
    if (!localAttachmentString) return null;
    try {
      const parts = localAttachmentString.split('|');
      const p = parts.find(p => p.startsWith('payload:'));
      if (!p) return null;
      return JSON.parse(p.substring(8)) as ReportPayload;
    } catch (e) {
      console.error("Failed to parse attachment payload", e);
      return null;
    }
  }, [localAttachmentString]);

  // Efeito para garantir a obtenção da foto do aluno sob demanda se não estiver presente
  useEffect(() => {
    if (!isOpen || !payload) {
      setDynamicAvatar(null);
      return;
    }

    const firstStudentId = Object.keys(payload.values || {})[0];
    const studentIdToUse = targetStudentId || firstStudentId || payload.studentInfo?.id;
    if (!studentIdToUse) return;

    // Se já veio avatar válido direto nas props ou payload, armazena no cache e usa
    const staticAvatar = targetStudentAvatar || payload.studentInfo?.avatarUrl;
    if (staticAvatar && typeof staticAvatar === 'string' && staticAvatar.length > 20) {
      setCachedStudentPhoto(studentIdToUse, staticAvatar);
      return;
    }

    // 1. Verifica no cache em memória
    const cached = getCachedStudentPhoto(studentIdToUse);
    if (cached) {
      setDynamicAvatar(cached);
      return;
    }

    // 2. Tenta encontrar na lista de alunos passada
    if (alunos && alunos.length > 0) {
      const cleanId = String(studentIdToUse).replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
      const foundAluno = alunos.find((a: any) => {
        const aId = String(a.id || '').replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
        return aId === cleanId || String(a.nome || '').trim().toLowerCase() === String(payload.studentInfo?.name || '').trim().toLowerCase();
      });

      const alunoFoto = foundAluno?.foto || foundAluno?.foto_url || foundAluno?.avatarUrl || foundAluno?.dados?.foto || foundAluno?.dados?.avatarUrl;
      if (alunoFoto && typeof alunoFoto === 'string' && alunoFoto.length > 20) {
        setCachedStudentPhoto(studentIdToUse, alunoFoto);
        setDynamicAvatar(alunoFoto);
        return;
      }
    }

    // 3. Busca da API sob demanda
    let isCancelled = false;
    fetchStudentPhotos([studentIdToUse]).then(photos => {
      if (isCancelled) return;
      const cleanId = String(studentIdToUse).replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
      const photo = photos[cleanId] || photos[studentIdToUse] || null;
      if (photo) {
        setDynamicAvatar(photo);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, payload, targetStudentId, targetStudentAvatar, alunos]);

  const { resolvedStudentInfo, resolvedTemplate, resolvedStudentKey, currentStudentValues, observacaoValue, ocorrenciaValue, standardFields } = useMemo(() => {
    if (!payload) return { resolvedStudentInfo: null, resolvedTemplate: null, resolvedStudentKey: 'unknown', currentStudentValues: {}, observacaoValue: null, ocorrenciaValue: null, standardFields: [] };
    
    // Parse title
    const parts = (localAttachmentString || '').split('|');
    const title = parts[0] || '';

    // Resolve Turma
    let displayTurma = payload.studentInfo?.turma || '';
    if (displayTurma) {
      const match = displayTurma.match(/^(\d+)(.*)$/);
      if (match && turmas && turmas.length > 0) {
        const t = turmas.find((t: any) => String(t.id) === match[1] || String(t.codigo) === match[1]);
        if (t) {
           displayTurma = `${t.nome}${match[2]}`.trim();
        }
      }
    }

    const valueKeys = Object.keys(payload.values || {});
    const firstStudentId = valueKeys[0];
    const matchedValueKey = targetStudentId
      ? (valueKeys.find(k => k === targetStudentId || k.replace(/^a_?/, '').replace(/^_*(ALU)?/, '') === String(targetStudentId).replace(/^a_?/, '').replace(/^_*(ALU)?/, '')) || firstStudentId)
      : firstStudentId;
    const studentIdToUse = matchedValueKey || targetStudentId || payload.studentInfo?.id;
    
    let currentAvatarUrl = targetStudentAvatar || dynamicAvatar || payload.studentInfo?.avatarUrl || getCachedStudentPhoto(studentIdToUse) || null;
    if (!currentAvatarUrl && studentIdToUse && alunos && alunos.length > 0) {
      const cleanId = String(studentIdToUse).replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
      const foundAluno = alunos.find((a: any) => {
        const aId = String(a.id || '').replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
        return aId === cleanId || String(a.nome || '').trim().toLowerCase() === String(payload.studentInfo?.name || '').trim().toLowerCase();
      });
      const alunoFoto = foundAluno?.foto || foundAluno?.foto_url || foundAluno?.avatarUrl || foundAluno?.dados?.foto || foundAluno?.dados?.avatarUrl;
      if (alunoFoto) {
         currentAvatarUrl = alunoFoto;
      }
    }
    
    const info = { 
        ...(payload.studentInfo || { id: studentIdToUse || 'unknown', name: targetStudentName || 'Aluno(a)' }), 
        turma: displayTurma,
        avatarUrl: currentAvatarUrl
    };

    const temp = MOCK_TEMPLATES.find((t) => t.id === payload.templateId) || {
       id: payload.templateId,
       name: title.replace('Relatório: ', '').replace('Relatório Personalizado: ', ''),
       sections: payload.template?.sections || []
    };

    const studentValues = (studentIdToUse && payload.values ? payload.values[studentIdToUse] : null) || (firstStudentId && payload.values ? payload.values[firstStudentId] : {}) || {};

    let obsValue = '';
    let ocValue = '';
    const fields: { label: string; value: string; id: string }[] = [];

    if (temp && studentValues) {
      temp.sections?.forEach((sec: any) => {
        sec.fields?.forEach((field: any) => {
           const rawVal = studentValues[field.id];
           const isEmpty = rawVal === undefined || rawVal === null || rawVal === '' || rawVal === 'Não preenchido' || (Array.isArray(rawVal) && rawVal.length === 0);
           
           if (!isEmpty) {
               const normalizedLabel = String(field.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
               if (normalizedLabel.includes('obs') || normalizedLabel.includes('observacao')) {
                  obsValue = rawVal;
               } else if (normalizedLabel.includes('ocorrencia')) {
                  ocValue = Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal);
               } else {
                  let displayVal = rawVal;
                  if (Array.isArray(rawVal)) {
                      displayVal = rawVal.join(', ');
                  }
                  fields.push({ label: field.label, value: displayVal, id: field.id });
               }
           }
        });
      });
    }

    return {
      resolvedStudentInfo: info,
      resolvedTemplate: temp,
      resolvedStudentKey: studentIdToUse || 'unknown',
      currentStudentValues: studentValues,
      observacaoValue: obsValue,
      ocorrenciaValue: ocValue,
      standardFields: fields
    };
  }, [payload, localAttachmentString, turmas, targetStudentId, targetStudentName, targetStudentAvatar, dynamicAvatar, alunos]);

  // Sincroniza os valores do formulário de edição sempre que o payload mudar
  useEffect(() => {
    setEditValues({ ...(currentStudentValues || {}) });
  }, [currentStudentValues]);

  const studentInfo = resolvedStudentInfo || { id: 'unknown', name: 'Aluno(a)', avatarUrl: null, turma: '' };
  const template = resolvedTemplate;

  const editableFields = useMemo(() => {
    if (!template) return [];
    const list: any[] = [];
    (template.sections || []).forEach((sec: any) => {
      (sec.fields || []).forEach((f: any) => {
        list.push({ ...f, sectionTitle: sec.title });
      });
    });
    if (list.length === 0 && currentStudentValues) {
      Object.keys(currentStudentValues).forEach(k => {
        list.push({
          id: k,
          label: k,
          type: 'texto-curto'
        });
      });
    }
    return list;
  }, [template, currentStudentValues]);

  const handleFieldValueChange = (fieldId: string, val: any) => {
    setEditValues(prev => {
      const next = { ...prev };
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
        delete next[fieldId];
      } else {
        next[fieldId] = val;
      }
      return next;
    });
  };

  const handleStartEdit = () => {
    setEditValues({ ...(currentStudentValues || {}) });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditValues({ ...(currentStudentValues || {}) });
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!payload || !onSaveReport || isSaving) return;
    setIsSaving(true);
    try {
      const cleanedValues: Record<string, any> = {};
      Object.entries(editValues).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0)) {
          cleanedValues[k] = typeof v === 'string' ? v.trim() : v;
        }
      });

      const studentKey = resolvedStudentKey !== 'unknown'
        ? resolvedStudentKey
        : (Object.keys(payload.values || {})[0] || studentInfo.id || 'unknown');

      const updatedPayload: ReportPayload = {
        ...payload,
        values: {
          ...(payload.values || {}),
          [studentKey]: cleanedValues
        }
      };

      const parts = (localAttachmentString || '').split('|');
      const prefix = parts[0] || `Relatório Personalizado: ${studentInfo.name}`;
      const updatedAttachmentStr = `${prefix}|payload:${JSON.stringify(updatedPayload)}|report-payload`;

      await onSaveReport(updatedAttachmentStr, updatedPayload, studentKey);
      setLocalAttachmentString(updatedAttachmentStr);
      setIsEditing(false);
    } catch (e) {
      console.error('Erro ao salvar alterações do relatório individual:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const getFieldIcon = (label: string) => {
    const labelLower = String(label || '').toLowerCase();
    if (labelLower.includes('presença') || labelLower.includes('presenca')) return User;
    if (labelLower.includes('disposição') || labelLower.includes('disposicao')) return Sparkles;
    if (labelLower.includes('lanche') || labelLower.includes('alimentação') || labelLower.includes('alimentacao') || labelLower.includes('almoço') || labelLower.includes('almoco')) return Utensils;
    if (labelLower.includes('evacuação') || labelLower.includes('evacuacao') || labelLower.includes('banheiro')) return Bath;
    if (labelLower.includes('conteúdo') || labelLower.includes('conteudo')) return Book;
    if (labelLower.includes('tarefa') || labelLower.includes('lição') || labelLower.includes('licao')) return Edit3;
    if (labelLower.includes('água') || labelLower.includes('agua')) return Droplet;
    if (labelLower.includes('obs') || labelLower.includes('ocorr')) return FileText;
    return Activity;
  };

  const renderEditFieldControl = (field: any) => {
    const rawVal = editValues[field.id];
    const value = rawVal !== undefined && rawVal !== null ? rawVal : '';
    const labelNorm = String(field.label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isLongTextByLabel = labelNorm.includes('observacao') || labelNorm.includes('obs') || labelNorm.includes('ocorrencia') || labelNorm.includes('conteudo') || labelNorm.includes('tarefa');

    if (field.type === 'sim-nao') {
      return (
        <div style={{ display: 'flex', gap: 10 }}>
          {(['Sim', 'Não'] as const).map(opt => {
            const isSelected = value === opt;
            const isSim = opt === 'Sim';
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleFieldValueChange(field.id, isSelected ? '' : opt)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: isSelected ? (isSim ? '2px solid #10b981' : '2px solid #ef4444') : '1px solid #e2e8f0',
                  background: isSelected ? (isSim ? '#ecfdf5' : '#fef2f2') : '#f8fafc',
                  color: isSelected ? (isSim ? '#047857' : '#b91c1c') : '#475569',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    if (field.type === 'unica-escolha' && Array.isArray(field.options) && field.options.length > 0) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {field.options.map((opt: string) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleFieldValueChange(field.id, isSelected ? '' : opt)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 12,
                  border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                  background: isSelected ? '#eef2ff' : '#f8fafc',
                  color: isSelected ? '#4338ca' : '#475569',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
              >
                {isSelected && <Check size={14} strokeWidth={2.8} />}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if ((field.type === 'multipla-escolha' || field.type === 'checklist') && Array.isArray(field.options) && field.options.length > 0) {
      const selectedArr: string[] = Array.isArray(value)
        ? value
        : (typeof value === 'string' && value.trim() ? value.split(',').map(s => s.trim()).filter(Boolean) : []);
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {field.options.map((opt: string) => {
            const isSelected = selectedArr.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? selectedArr.filter(item => item !== opt)
                    : [...selectedArr, opt];
                  handleFieldValueChange(field.id, next);
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: 12,
                  border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                  background: isSelected ? '#eef2ff' : '#f8fafc',
                  color: isSelected ? '#4338ca' : '#475569',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
              >
                {isSelected && <Check size={14} strokeWidth={2.8} />}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (field.type === 'nota') {
      const numVal = Number(value) || 0;
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const active = numVal >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleFieldValueChange(field.id, numVal === n ? '' : String(n))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: active ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  background: active ? '#fffbeb' : '#f8fafc',
                  color: active ? '#d97706' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 14
                }}
              >
                {n}★
              </button>
            );
          })}
        </div>
      );
    }

    if (field.type === 'texto-longo' || isLongTextByLabel) {
      return (
        <textarea
          value={typeof value === 'string' ? value : (Array.isArray(value) ? value.join(', ') : String(value))}
          onChange={e => handleFieldValueChange(field.id, e.target.value)}
          placeholder="Não preenchido (digite para informar)..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: 14,
            fontWeight: 500,
            color: '#1e293b',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            lineHeight: 1.45
          }}
        />
      );
    }

    const inputType = field.type === 'numero' || field.type === 'moeda' || field.type === 'percentual'
      ? 'number'
      : field.type === 'data'
        ? 'date'
        : field.type === 'hora'
          ? 'time'
          : 'text';

    return (
      <input
        type={inputType}
        value={typeof value === 'string' ? value : String(value)}
        onChange={e => handleFieldValueChange(field.id, e.target.value)}
        placeholder="Não preenchido (digite para informar)..."
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          fontSize: 14,
          fontWeight: 500,
          color: '#1e293b',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
    );
  };

  const content = (
    <AnimatePresence>
      {isOpen && payload && template && (
        <div 
          className="fixed inset-0 flex items-center justify-center" 
          style={{ 
            zIndex: 2147483647, 
            transform: 'translateZ(9999px)',
            background: 'rgba(8, 8, 28, 0.68)',
            backdropFilter: 'blur(7px)',
            WebkitBackdropFilter: 'blur(7px)'
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative flex flex-col bg-[#FDFDFF] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-y-auto overflow-x-hidden hide-scrollbar"
            style={{
              width: 'min(500px, calc(100vw - 32px))',
              height: 'auto',
              maxHeight: 'calc(100vh - 32px)',
              borderRadius: '30px',
              boxSizing: 'border-box'
            }}
          >
            {/* Header */}
              <div 
              className="relative flex-shrink-0 flex items-center justify-center overflow-hidden"
              style={{
                height: '80px',
                background: 'linear-gradient(120deg, #4F46E5 0%, #7165F5 48%, #60A5FA 100%)',
              }}
            >
              {/* Abstract decorative shapes */}
              <motion.div 
                animate={{ x: [-20, 30, -20], y: [-10, 15, -10] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"
              />
              <motion.div 
                animate={{ x: [20, -30, 20], y: [10, -15, 10] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"
              />
              
              <motion.div animate={{ rotate: [0, 10, 0, -10, 0], scale: [1, 1.1, 1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-6 left-10 opacity-50">
                 <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute bottom-4 right-20 opacity-40">
                 <Star className="w-5 h-5 text-white" fill="white" />
              </motion.div>

              {/* Edit Button (only when authorized and not currently editing) */}
              {canEdit && onSaveReport && !isEditing && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="absolute flex items-center justify-center gap-1.5 text-white bg-white/15 hover:bg-white/25 transition-all rounded-full backdrop-blur-md z-20 border border-white/25"
                  style={{
                    top: '12px',
                    left: '12px',
                    height: '36px',
                    padding: '0 13px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Editar relatório individual deste aluno"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={2.5} />
                  <span>Editar</span>
                </button>
              )}

              {/* Close Button */}
              <button 
                onClick={onClose} 
                className="absolute flex items-center justify-center text-white/90 bg-white/10 hover:bg-white/20 transition-all rounded-full backdrop-blur-md z-20"
                style={{ 
                  top: '12px', right: '12px',
                  width: '36px', height: '36px',
                  cursor: 'pointer'
                }}
                aria-label="Fechar modal"
              > 
                <X className="w-5 h-5" strokeWidth={2.5} /> 
              </button>

              {/* Title Area */}
              <div className="flex items-center gap-3 relative z-10">
                <div 
                  className="rounded-[12px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30"
                  style={{ width: '32px', height: '32px' }}
                >
                  <FileText className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="m-0 tracking-wide text-white" style={{ fontSize: '20px', fontWeight: 800 }}>
                  {isEditing ? 'Editar Relatório' : 'Relatório Diário'}
                </h2>
              </div>
            </div>

            {/* Content Area (Flows naturally with modal scroll) */}
            <div className="relative z-10 flex flex-col" style={{ paddingBottom: '0' }}>
              
              <StudentProfileBackground />

              {/* Avatar and Names */}
              <div className="relative flex flex-col items-center z-10" style={{ marginTop: '16px', marginBottom: '16px', padding: '0 24px' }}>
                {studentInfo.avatarUrl && !avatarError ? (
                  <img 
                    src={studentInfo.avatarUrl} 
                    alt={studentInfo.name} 
                    className="rounded-full object-cover border-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] bg-slate-100" 
                    style={{ width: '100px', height: '100px', borderWidth: '4px' }}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div 
                    className="rounded-full bg-indigo-100/80 backdrop-blur-sm text-[#7165F5] flex items-center justify-center font-bold border-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
                    style={{ width: '100px', height: '100px', borderWidth: '4px', fontSize: '32px' }}
                  >
                    {(studentInfo.name || 'Aluno(a)').charAt(0)}
                  </div>
                )}
                
                <h3 
                  className="text-center m-0 leading-tight"
                  style={{ color: '#0F172A', fontSize: '18px', fontWeight: 800, marginTop: '12px' }}
                >
                  {studentInfo.name || 'Aluno(a)'}
                </h3>
                {studentInfo.turma && (
                  <p 
                    className="text-center m-0 uppercase tracking-wide"
                    style={{ color: '#7165F5', fontSize: '14px', fontWeight: 700, marginTop: '6px' }}
                  >
                    {studentInfo.turma}
                  </p>
                )}
              </div>

              {/* Main Info Area */}
              <div className="w-full flex flex-col relative z-20" style={{ padding: '0 clamp(12px, 4vw, 24px)' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    {editableFields.map((field: any) => {
                      if (field.conditionalRule) {
                        const depVal = editValues[field.conditionalRule.fieldId];
                        if (depVal !== field.conditionalRule.value) return null;
                      }
                      const Icon = getFieldIcon(field.label);
                      const rawVal = editValues[field.id];
                      const hasVal = rawVal !== undefined && rawVal !== null && rawVal !== '' && (!Array.isArray(rawVal) || rawVal.length > 0);

                      return (
                        <div
                          key={field.id}
                          style={{
                            background: '#ffffff',
                            borderRadius: 20,
                            border: '1px solid #EBE7FF',
                            boxShadow: '0 6px 20px rgba(113, 101, 245, 0.05)',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 11,
                                  background: '#F9F7FF',
                                  border: '1px solid #F3F0FF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                <Icon className="w-4 h-4" style={{ color: '#8B5CF6' }} strokeWidth={2.5} />
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>
                                {field.label}
                              </span>
                            </div>

                            {hasVal && (
                              <button
                                type="button"
                                onClick={() => handleFieldValueChange(field.id, '')}
                                style={{
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#ef4444',
                                  borderRadius: 8,
                                  padding: '3px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                title="Limpar resposta deste item"
                              >
                                <RotateCcw size={11} />
                                <span>Limpar</span>
                              </button>
                            )}
                          </div>

                          {renderEditFieldControl(field)}
                        </div>
                      );
                    })}

                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 14,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        style={{
                          flex: 1.4,
                          height: 46,
                          borderRadius: 14,
                          border: 'none',
                          background: 'linear-gradient(120deg, #4F46E5 0%, #7165F5 100%)',
                          color: '#ffffff',
                          fontSize: 14,
                          fontWeight: 800,
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          boxShadow: '0 8px 20px rgba(79, 70, 229, 0.28)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          opacity: isSaving ? 0.75 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={17} className="animate-spin" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <Check size={17} strokeWidth={2.8} />
                            <span>Salvar Alterações</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const primaryFields = standardFields.filter(f => {
                        const l = f.label.toLowerCase();
                        return !(l.includes('conteúdo') || l.includes('conteudo') || l.includes('tarefa') || l.includes('lição'));
                      });
                      const secondaryFields = standardFields.filter(f => {
                        const l = f.label.toLowerCase();
                        return l.includes('conteúdo') || l.includes('conteudo') || l.includes('tarefa') || l.includes('lição');
                      });

                      const renderField = (field: any, index: number, arr: any[]) => {
                        const Icon = getFieldIcon(field.label);

                        return (
                          <div 
                            key={field.id} 
                            className="flex justify-between items-center"
                            style={{
                              minHeight: '56px',
                              padding: '10px 16px',
                              borderBottom: index !== arr.length - 1 ? '1px solid #F5F3FF' : 'none'
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="flex items-center justify-center flex-shrink-0"
                                style={{
                                  width: '36px', height: '36px',
                                  borderRadius: '12px',
                                  background: '#F9F7FF',
                                  border: '1px solid #F3F0FF'
                                }}
                              >
                                <Icon className="w-4 h-4" style={{ color: '#8B5CF6' }} strokeWidth={2.5} />
                              </div>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>{field.label}</span>
                            </div>
                            <span 
                              style={{ 
                                fontSize: '14px', fontWeight: 700, 
                                color: field.value === 'Não preenchido' ? '#94A3B8' : '#16A34A',
                                textAlign: 'right', maxWidth: '50%', wordBreak: 'break-word', overflowWrap: 'anywhere'
                              }}
                            >
                              {field.value}
                            </span>
                          </div>
                        );
                      };

                      return (
                        <>
                          {primaryFields.length > 0 && (
                            <div 
                              className="w-full bg-white backdrop-blur-3xl overflow-hidden"
                              style={{
                                borderRadius: '24px',
                                border: '1px solid #EBE7FF',
                                boxShadow: '0 8px 30px rgba(113, 101, 245, 0.04)',
                                marginBottom: secondaryFields.length > 0 ? '12px' : '0'
                              }}
                            >
                              {primaryFields.map((field, index) => renderField(field, index, primaryFields))}
                            </div>
                          )}

                          {secondaryFields.length > 0 && (
                            <div 
                              className="w-full bg-white backdrop-blur-3xl overflow-hidden"
                              style={{
                                borderRadius: '24px',
                                border: '1px solid #EBE7FF',
                                boxShadow: '0 8px 30px rgba(113, 101, 245, 0.04)'
                              }}
                            >
                              {secondaryFields.map((field, index) => renderField(field, index, secondaryFields))}
                            </div>
                          )}

                          {standardFields.length === 0 && !observacaoValue && !ocorrenciaValue && (
                            <div 
                              className="w-full bg-white backdrop-blur-3xl overflow-hidden"
                              style={{ borderRadius: '24px', border: '1px solid #EBE7FF' }}
                            >
                              <p className="text-[#94A3B8] text-[15px] font-[600] text-center py-6 m-0">Nenhum item respondido.</p>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Ocorrências Block */}
                    {ocorrenciaValue && ocorrenciaValue !== 'Não preenchido' && (
                      <div 
                        className="w-full bg-white relative flex gap-3"
                        style={{
                          borderRadius: '20px',
                          border: '1px solid #EBE7FF',
                          boxShadow: '0 8px 30px rgba(113, 101, 245, 0.04)',
                          marginTop: '12px',
                          padding: '16px'
                        }}
                      >
                        <div 
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: '36px', height: '36px',
                            borderRadius: '12px',
                            background: '#F9F7FF',
                            border: '1px solid #F3F0FF'
                          }}
                        >
                          <FileText className="w-4 h-4" style={{ color: '#8B5CF6' }} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 pt-0">
                          <h4 style={{ color: '#7165F5', fontWeight: 700, fontSize: '14px', margin: '0 0 4px 0' }}>Ocorrências 📋</h4>
                          <p style={{ color: '#475569', fontSize: '14px', fontWeight: 500, lineHeight: 1.4, margin: 0, paddingRight: '20px', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                            {ocorrenciaValue}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Observação Block */}
                    {observacaoValue && observacaoValue !== 'Não preenchido' && (
                      <div 
                        className="w-full bg-white relative flex gap-3"
                        style={{
                          borderRadius: '20px',
                          border: '1px solid #EBE7FF',
                          boxShadow: '0 8px 30px rgba(113, 101, 245, 0.04)',
                          marginTop: '12px',
                          padding: '16px'
                        }}
                      >
                        <div 
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: '36px', height: '36px',
                            borderRadius: '12px',
                            background: '#F9F7FF',
                            border: '1px solid #F3F0FF'
                          }}
                        >
                          <FileText className="w-4 h-4" style={{ color: '#8B5CF6' }} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 pt-0">
                          <h4 style={{ color: '#7165F5', fontWeight: 700, fontSize: '14px', margin: '0 0 4px 0' }}>Observação</h4>
                          <p style={{ color: '#475569', fontSize: '14px', fontWeight: 500, lineHeight: 1.4, margin: 0, paddingRight: '20px', overflowWrap: 'anywhere' }}>
                            {observacaoValue}
                          </p>
                        </div>
                        <Heart style={{ width: '20px', height: '20px', color: '#818CF8', position: 'absolute', top: '16px', right: '16px', opacity: 0.5 }} strokeWidth={2.5} />
                      </div>
                    )}

                    {/* Botão de Editar Relatório Individual (quando autorizado) */}
                    {canEdit && onSaveReport && (
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        style={{
                          width: '100%',
                          marginTop: '14px',
                          height: '44px',
                          borderRadius: '16px',
                          border: '1px solid #DDD6FE',
                          background: '#FFFFFF',
                          color: '#5B21B6',
                          fontSize: '13.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(113, 101, 245, 0.08)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Edit3 className="w-4 h-4" strokeWidth={2.5} />
                        <span>Editar Relatório Individual</span>
                      </button>
                    )}

                    {/* Footer Message */}
                    <div 
                      className="w-full flex items-center justify-center text-center relative overflow-hidden"
                      style={{
                        background: 'linear-gradient(120deg, #F9F7FF 0%, #F5F3FF 100%)',
                        border: '1px solid #EBE7FF',
                        borderRadius: '20px',
                        marginTop: '12px',
                        marginBottom: '20px',
                        minHeight: '56px',
                        padding: '12px 16px',
                        boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.5)'
                      }}
                    >
                      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" style={{ width: '16px', height: '16px', color: '#818CF8' }} />
                      <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30" style={{ width: '16px', height: '16px', color: '#818CF8' }} />
                      
                      <span style={{ fontSize: '13px', color: '#7165F5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', lineHeight: 1.4 }}>
                        <Heart style={{ width: '16px', height: '16px', color: '#8B5CF6', fill: '#8B5CF6', flexShrink: 0 }} />
                        Obrigado por acompanhar o desenvolvimento de {(studentInfo.name || 'Aluno').split(' ')[0]}!
                      </span>
                    </div>
                  </>
                )}

              </div> {/* Close Main Info Area */}
            </div> {/* Close Content Area */}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return <Portal>{content}</Portal>;
}
