'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';
import { ReportPayload, MOCK_TEMPLATES, MOCK_STUDENTS, Student } from './types';

interface ReportPayloadViewProps {
  isOpen: boolean;
  onClose: () => void;
  attachmentString: string; // e.g., "Relatório: Nome|payload:{"templateId":"...","values":{...}}|report-payload"
}

export function ReportPayloadView({ isOpen, onClose, attachmentString }: ReportPayloadViewProps) {
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  // Parse the attachment string
  const { title, payload } = useMemo(() => {
    if (!attachmentString) return { title: '', payload: null };
    try {
      const parts = attachmentString.split('|');
      const title = parts[0];
      const payloadStr = parts[1].replace('payload:', '');
      const payload: ReportPayload = JSON.parse(payloadStr);
      return { title, payload };
    } catch (e) {
      console.error('Failed to parse report payload', e);
      return { title: 'Erro ao carregar relatório', payload: null };
    }
  }, [attachmentString]);

  const template = useMemo(() => {
    if (!payload) return null;
    return MOCK_TEMPLATES.find((t) => t.id === payload.templateId);
  }, [payload]);

  // Extract students that are present in the payload
  const studentsInReport = useMemo(() => {
    if (!payload || !payload.values) return [];
    const studentIds = Object.keys(payload.values);
    return MOCK_STUDENTS.filter((s) => studentIds.includes(s.id));
  }, [payload]);

  useEffect(() => {
    if (isOpen && studentsInReport.length > 0 && !activeStudentId) {
      setActiveStudentId(studentsInReport[0].id);
    }
  }, [isOpen, studentsInReport, activeStudentId]);

  if (!isOpen || !payload || !template) return null;

  const activeStudent = studentsInReport.find((s) => s.id === activeStudentId);
  const studentValues = activeStudent ? payload.values[activeStudent.id] : {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{title}</h2>
              <p className="text-sm text-slate-500 mt-1">Visualização de Respostas</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Split Screen Content */}
          <div className="flex flex-1 overflow-hidden bg-slate-50">
            {/* Left Sidebar: Students */}
            <div className="w-1/3 border-r border-slate-200 bg-white overflow-y-auto">
              <div className="p-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">
                  Alunos ({studentsInReport.length})
                </h4>
                <div className="space-y-2">
                  {studentsInReport.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => setActiveStudentId(student.id)}
                      className={`w-full flex items-center p-3 rounded-xl transition-all ${
                        activeStudentId === student.id
                          ? 'bg-blue-50 border border-blue-200 shadow-sm'
                          : 'bg-white border border-transparent hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      {student.avatarUrl ? (
                        <img
                          src={student.avatarUrl}
                          alt={student.name}
                          className="w-10 h-10 rounded-full object-cover mr-3 border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium mr-3">
                          {student.name.charAt(0)}
                        </div>
                      )}
                      <span
                        className={`font-medium ${
                          activeStudentId === student.id ? 'text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        {student.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Content: Read-only report answers */}
            <div className="w-2/3 overflow-y-auto p-8">
              {activeStudent ? (
                <div className="max-w-2xl mx-auto space-y-8">
                  <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-slate-200">
                    <img
                      src={activeStudent.avatarUrl}
                      alt={activeStudent.name}
                      className="w-16 h-16 rounded-full border-2 border-white shadow-md"
                    />
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">{activeStudent.name}</h3>
                      <p className="text-slate-500">Respostas do relatório</p>
                    </div>
                  </div>

                  {template.sections.map((section) => (
                    <div key={section.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
                      <h4 className="text-lg font-semibold text-slate-700 flex items-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-2" />
                        {section.title}
                      </h4>
                      <div className="space-y-4 pl-7">
                        {section.fields.map((field) => {
                          const answer = studentValues[field.id];
                          return (
                            <div key={field.id} className="flex flex-col space-y-1">
                              <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                                {field.label}
                              </span>
                              <div className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[44px] flex items-center">
                                {answer ? (
                                  <span className="font-medium">{answer}</span>
                                ) : (
                                  <span className="text-slate-400 italic">Não preenchido</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <p>Selecione um aluno para ver as respostas.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
