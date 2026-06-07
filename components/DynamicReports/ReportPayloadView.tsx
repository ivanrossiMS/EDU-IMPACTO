'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Sparkles, Star } from 'lucide-react';
import { ReportPayload, MOCK_TEMPLATES } from './types';
import { useData } from '@/lib/dataContext';

interface ReportPayloadViewProps {
  isOpen: boolean;
  onClose: () => void;
  attachmentString: string;
}

export function ReportPayloadView({ isOpen, onClose, attachmentString }: ReportPayloadViewProps) {
  const [mounted, setMounted] = useState(false);
  const { turmas = [] } = useData();

  useEffect(() => {
    setMounted(true);
  }, []);

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

    const info = { 
        ...(payload.studentInfo || { id: 'unknown', name: 'Aluno(a)', avatarUrl: null }), 
        turma: displayTurma 
    };

    const temp = MOCK_TEMPLATES.find((t) => t.id === payload.templateId) || {
       id: payload.templateId,
       name: title.replace('Relatório: ', '').replace('Relatório Personalizado: ', ''),
       sections: payload.template?.sections || []
    };

    const firstStudentId = Object.keys(payload.values || {})[0];
    const studentValues = firstStudentId ? payload.values[firstStudentId] : {};

    let obsValue = '';
    const fields: { label: string; value: string; id: string }[] = [];

    if (temp) {
      temp.sections?.forEach((sec: any) => {
        sec.fields?.forEach((field: any) => {
           const val = studentValues[field.id] || 'Não preenchido';
           if (field.label.toLowerCase().includes('obs') || field.label.toLowerCase().includes('observação')) {
              obsValue = val;
           } else {
              fields.push({ label: field.label, value: val, id: field.id });
           }
        });
      });
    }

    return { resolvedStudentInfo: info, resolvedTemplate: temp, observacaoValue: obsValue, standardFields: fields };
  }, [payload, attachmentString, turmas]);

  const studentInfo = resolvedStudentInfo || { id: 'unknown', name: 'Aluno(a)', avatarUrl: null, turma: '' };
  const template = resolvedTemplate;

  const content = (
    <AnimatePresence>
      {isOpen && payload && template && (
        <div className="fixed inset-0 flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm" style={{ zIndex: 999999 }}>
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full h-full md:w-[420px] md:h-auto md:max-h-[85vh] bg-white md:rounded-[24px] shadow-2xl flex flex-col hide-scrollbar overflow-hidden"
          >
            {/* Header */}
            <motion.div 
              className="relative flex-shrink-0 flex flex-col items-center justify-center text-center overflow-hidden"
              style={{ height: '86px' }}
              animate={{
                background: [
                  'linear-gradient(135deg, #6D5BFF, #8C7DFF)',
                  'linear-gradient(135deg, #8C7DFF, #A020F0)',
                  'linear-gradient(135deg, #A020F0, #4F46E5)',
                  'linear-gradient(135deg, #4F46E5, #6D5BFF)',
                ]
              }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            >
              {/* Floating orbs for ultra-modern look */}
              <motion.div 
                animate={{ x: [-20, 30, -20], y: [-10, 15, -10] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"
              />
              <motion.div 
                animate={{ x: [20, -30, 20], y: [10, -15, 10] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-0 right-0 w-40 h-40 bg-purple-300/30 rounded-full blur-2xl translate-x-1/3 translate-y-1/3"
              />
              
              {/* Suggestive animated icons */}
              <motion.div animate={{ rotate: [0, 10, 0, -10, 0], scale: [1, 1.1, 1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-4 left-6 opacity-60">
                 <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute bottom-3 right-12 opacity-50">
                 <Star className="w-4 h-4 text-white" fill="white" />
              </motion.div>

              <button 
                onClick={onClose} 
                className="absolute top-3 right-3 text-white transition-all bg-black/30 hover:bg-black/40 p-4 rounded-full backdrop-blur-md shadow-lg z-20 hover:scale-105 active:scale-95"
              > 
                <X className="w-8 h-8" strokeWidth={2.5} /> 
              </button>
              <h2 className="text-[17px] font-[800] text-white m-0 leading-tight relative z-10 tracking-wide">
                Relatório Diário
              </h2>
              <p className="text-[12px] mt-0.5 relative z-10 font-[500]" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {payload.dataReferencia || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </motion.div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#f8f9ff] via-[#f5f3ff] to-[#f0f4ff] flex flex-col relative z-10 hide-scrollbar">
              
              {/* Profile Background Layer */}
              <div className="relative w-full flex flex-col items-center pb-6 overflow-hidden">
                 {/* Decorative floating shapes */}
                 <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                   <motion.div 
                     animate={{ y: [0, -12, 0], rotate: [0, 10, 0] }} 
                     transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                     className="absolute top-6 left-6 w-12 h-12 rounded-full border-[3px] border-indigo-200/40"
                   />
                   <motion.div 
                     animate={{ y: [0, 15, 0], rotate: [15, -5, 15] }} 
                     transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                     className="absolute top-4 right-8 w-16 h-16 bg-purple-200/30 rounded-[20px]"
                   />
                   <motion.div 
                     animate={{ x: [0, 10, 0], y: [0, 5, 0], rotate: [0, 180, 360] }} 
                     transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                     className="absolute top-20 left-12 w-6 h-6 border-[3px] border-purple-200/40"
                     style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                   />
                 </div>

                 {/* Avatar overlapping */}
                 <div className="relative -mt-12 mb-3 z-10">
                   {studentInfo.avatarUrl ? (
                     <img 
                       src={studentInfo.avatarUrl} 
                       alt={studentInfo.name} 
                       className="w-[100px] h-[100px] rounded-full object-cover border-[4px] border-white/80 backdrop-blur-sm shadow-[0_8px_32px_rgba(99,102,241,0.15)] bg-slate-100" 
                     />
                   ) : (
                     <div className="w-[100px] h-[100px] rounded-full bg-indigo-100/80 backdrop-blur-sm text-indigo-500 flex items-center justify-center text-3xl font-bold border-[4px] border-white/80 shadow-[0_8px_32px_rgba(99,102,241,0.15)]">
                       {(studentInfo.name || 'Aluno(a)').charAt(0)}
                     </div>
                   )}
                 </div>
                 
                 <h3 className="text-[19px] font-[800] text-[#111827] text-center m-0 leading-tight relative z-10">{studentInfo.name || 'Aluno(a)'}</h3>
                 {studentInfo.turma && (
                   <p className="text-[14px] font-[500] text-[#6B7280] mt-1 text-center relative z-10">{studentInfo.turma}</p>
                 )}
              </div>

              {/* Main Info Area */}
              <div className="w-full px-4 pb-8 flex flex-col items-center relative z-20">
                {/* Fields List */}
                <div className="w-full bg-white/40 backdrop-blur-xl border border-white/80 shadow-[0_8px_32px_rgba(99,102,241,0.06)] rounded-[20px] overflow-hidden">
                {standardFields.length > 0 ? (
                  standardFields.map((field, index) => (
                    <div 
                      key={field.id} 
                      className={`flex justify-between items-center p-4 ${index !== standardFields.length - 1 ? 'border-b border-white/60' : ''}`}
                    >
                      <span className="text-[15px] font-[600] text-[#374151]">{field.label}</span>
                      <span className={`text-[15px] font-[600] ${field.value === 'Não preenchido' ? 'text-[#9CA3AF]' : 'text-[#22C55E]'}`}>
                        {field.value}
                      </span>
                    </div>
                  ))
                ) : (
                   <p className="text-[#6B7280] text-[14px] text-center py-6">Nenhum item respondido.</p>
                )}
              </div>

              {/* Observação Block */}
              {observacaoValue && observacaoValue !== 'Não preenchido' && (
                <div className="w-full mt-4 bg-[#F7F5FF] rounded-[16px] p-4 relative">
                  <h4 className="text-[#6D5BFF] font-[700] mb-2 text-[15px]">Observação</h4>
                  <p className="text-[#4B5563] text-[14px] leading-relaxed pr-6">
                    {observacaoValue}
                  </p>
                  <Heart className="w-5 h-5 text-[#6D5BFF] fill-[#6D5BFF] absolute bottom-4 right-4 opacity-60" />
                </div>
              )}

              {/* Footer */}
              <div className="w-full mt-4 flex items-center justify-center text-center bg-[#F7F5FF] rounded-[16px] p-4">
                <span className="text-[13px] text-[#6D5BFF] font-[500]">
                  💜 Obrigado por acompanhar o desenvolvimento de {(studentInfo.name || 'Aluno').split(' ')[0]}!
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
  return createPortal(content, document.body);
}
