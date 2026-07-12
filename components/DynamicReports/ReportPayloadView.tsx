'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Portal from '@/components/Portal';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Sparkles, Star, FileText, User, Utensils, Book, Edit3, Bath, Activity, Droplet } from 'lucide-react';
import { ReportPayload, MOCK_TEMPLATES } from './types';
import { useData } from '@/lib/dataContext';
import StudentProfileBackground from './StudentProfileBackground';

interface ReportPayloadViewProps {
  isOpen: boolean;
  onClose: () => void;
  attachmentString: string;
  targetStudentId?: string;
  targetStudentName?: string;
  targetStudentAvatar?: string;
  alunos?: any[];
}

export function ReportPayloadView({ 
  isOpen, 
  onClose, 
  attachmentString, 
  targetStudentId, 
  targetStudentName, 
  targetStudentAvatar,
  alunos: propAlunos
}: ReportPayloadViewProps) {
  const [mounted, setMounted] = useState(false);
  const { turmas = [], alunos: contextAlunos = [] } = useData();
  const alunos = propAlunos || contextAlunos;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const payload = useMemo(() => {
    if (!attachmentString) return null;
    try {
      const parts = attachmentString.split('|');
      const p = parts.find(p => p.startsWith('payload:'));
      if (!p) return null;
      return JSON.parse(p.substring(8)) as ReportPayload;
    } catch (e) {
      console.error("Failed to parse attachment payload", e);
      return null;
    }
  }, [attachmentString]);

  const { resolvedStudentInfo, resolvedTemplate, observacaoValue, standardFields } = useMemo(() => {
    if (!payload) return { resolvedStudentInfo: null, resolvedTemplate: null, observacaoValue: null, standardFields: [] };
    
    // Parse title
    const parts = (attachmentString || '').split('|');
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

    const firstStudentId = Object.keys(payload.values || {})[0];
    const studentIdToUse = targetStudentId || firstStudentId || payload.studentInfo?.id;
    
    let currentAvatarUrl = targetStudentAvatar || payload.studentInfo?.avatarUrl || null;
    if (!currentAvatarUrl && studentIdToUse && alunos && alunos.length > 0) {
      const foundAluno = alunos.find((a: any) => String(a.id) === String(studentIdToUse) || String(a.id) === String(studentIdToUse).replace(/^a_?/, ''));
      if (foundAluno && foundAluno.foto) {
         currentAvatarUrl = foundAluno.foto;
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

    const studentValues = studentIdToUse ? payload.values[studentIdToUse] : {};

    let obsValue = '';
    const fields: { label: string; value: string; id: string }[] = [];

    if (temp && studentValues) {
      temp.sections?.forEach((sec: any) => {
        sec.fields?.forEach((field: any) => {
           const rawVal = studentValues[field.id];
           const isEmpty = rawVal === undefined || rawVal === null || rawVal === '' || rawVal === 'Não preenchido' || (Array.isArray(rawVal) && rawVal.length === 0);
           
           if (!isEmpty) {
               if (field.label.toLowerCase().includes('obs') || field.label.toLowerCase().includes('observação')) {
                  obsValue = rawVal;
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

    return { resolvedStudentInfo: info, resolvedTemplate: temp, observacaoValue: obsValue, standardFields: fields };
  }, [payload, attachmentString, turmas, targetStudentId, targetStudentName, targetStudentAvatar]);

  const studentInfo = resolvedStudentInfo || { id: 'unknown', name: 'Aluno(a)', avatarUrl: null, turma: '' };
  const template = resolvedTemplate;

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
                  Relatório Diário
                </h2>
              </div>
            </div>

            {/* Content Area (Flows naturally with modal scroll) */}
            <div className="relative z-10 flex flex-col" style={{ paddingBottom: '0' }}>
              
              <StudentProfileBackground />

              {/* Avatar and Names */}
              <div className="relative flex flex-col items-center z-10" style={{ marginTop: '16px', marginBottom: '16px', padding: '0 24px' }}>
                {studentInfo.avatarUrl ? (
                  <img 
                    src={studentInfo.avatarUrl} 
                    alt={studentInfo.name} 
                    className="rounded-full object-cover border-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] bg-slate-100" 
                    style={{ width: '100px', height: '100px', borderWidth: '4px' }}
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
                    const labelLower = field.label.toLowerCase();
                    let Icon = Activity;
                    if (labelLower.includes('presença') || labelLower.includes('presenca')) Icon = User;
                    else if (labelLower.includes('disposição') || labelLower.includes('disposicao')) Icon = Sparkles;
                    else if (labelLower.includes('lanche') || labelLower.includes('alimentação')) Icon = Utensils;
                    else if (labelLower.includes('evacuação') || labelLower.includes('banheiro')) Icon = Bath;
                    else if (labelLower.includes('conteúdo') || labelLower.includes('conteudo')) Icon = Book;
                    else if (labelLower.includes('tarefa') || labelLower.includes('lição')) Icon = Edit3;
                    else if (labelLower.includes('água') || labelLower.includes('agua')) Icon = Droplet;

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

                      {standardFields.length === 0 && (
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
