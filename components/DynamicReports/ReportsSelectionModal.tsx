'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronRight, FileText, Users } from 'lucide-react';
import {
  ReportType,
  ReportTemplate,
  Student,
  ReportPayload,
  ReportField,
  MOCK_TEMPLATES,
} from './types';

interface ReportsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetedStudents: Student[];
  onAdd: (attachmentText: string, payload: ReportPayload) => void;
}

export function ReportsSelectionModal({
  isOpen,
  onClose,
  targetedStudents,
  onAdd,
}: ReportsSelectionModalProps) {
  // Step State
  const [step, setStep] = useState<1 | 2>(1);

  // Selections
  const [reportType, setReportType] = useState<ReportType>('todos');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Values State: { studentId: { fieldId: value } }
  // For 'todos', studentId is 'todos'
  const [reportValues, setReportValues] = useState<Record<string, Record<string, any>>>({});

  // For 'especifico' Split Screen
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => {
    return MOCK_TEMPLATES.find((t) => t.id === selectedTemplateId);
  }, [selectedTemplateId]);

  // All fields flattened for easy access in the UI
  const allFields = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.sections.flatMap((sec) => sec.fields);
  }, [selectedTemplate]);

  // Set initial active field when going to step 2 in 'especifico' mode
  React.useEffect(() => {
    if (step === 2 && reportType === 'especifico' && allFields.length > 0 && !activeFieldId) {
      setActiveFieldId(allFields[0].id);
    }
  }, [step, reportType, allFields, activeFieldId]);

  const handleNext = () => {
    if (step === 1 && selectedTemplateId) {
      setStep(2);
    }
  };

  const handleValueChange = (studentId: string, fieldId: string, value: any) => {
    setReportValues((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [fieldId]: value,
      },
    }));
  };

  const handleFinish = () => {
    if (!selectedTemplate) return;

    const payload: ReportPayload = {
      templateId: selectedTemplate.id,
      values: {},
    };

    if (reportType === 'todos') {
      // Copy 'todos' values to all targeted students
      const todosValues = reportValues['todos'] || {};
      targetedStudents.forEach((student) => {
        payload.values[student.id] = { ...todosValues };
      });
    } else {
      // Use the mapped values
      targetedStudents.forEach((student) => {
        payload.values[student.id] = reportValues[student.id] || {};
      });
    }

    const attachmentText = `Relatório: ${selectedTemplate.name}`;
    onAdd(attachmentText, payload);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setStep(1);
    setReportType('todos');
    setSelectedTemplateId('');
    setReportValues({});
    setActiveFieldId(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
            <h2 className="text-xl font-semibold text-slate-800">
              {step === 1 ? 'Anexar Relatório' : `Preenchendo: ${selectedTemplate?.name}`}
            </h2>
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {step === 1 ? (
              <div className="p-6 space-y-8">
                {/* Type Selection */}
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">
                    Como deseja preencher?
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setReportType('todos')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        reportType === 'todos'
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <Users className={reportType === 'todos' ? 'text-blue-500' : 'text-slate-400'} />
                        <span className="font-semibold text-slate-800">Para Todos (Coletivo)</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Preencha um único relatório que será copiado para todos os alunos selecionados.
                      </p>
                    </button>

                    <button
                      onClick={() => setReportType('especifico')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        reportType === 'especifico'
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <FileText className={reportType === 'especifico' ? 'text-blue-500' : 'text-slate-400'} />
                        <span className="font-semibold text-slate-800">Individual (Específico)</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Preencha valores diferentes para cada aluno selecionado em uma tela dividida.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-4 uppercase tracking-wider">
                    Escolha um Template
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MOCK_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedTemplateId === template.id
                            ? 'border-blue-500 ring-1 ring-blue-500 shadow-sm bg-white'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <h4 className="font-medium text-slate-800">{template.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          {template.sections.reduce((acc, sec) => acc + sec.fields.length, 0)} campos
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Step 2
              <div className="h-full bg-slate-50">
                {reportType === 'todos' ? (
                  // Coletivo Mode
                  <div className="max-w-2xl mx-auto p-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-8">
                      {selectedTemplate?.sections.map((section) => (
                        <div key={section.id} className="space-y-4">
                          <h3 className="font-semibold text-slate-700 border-b pb-2">{section.title}</h3>
                          {section.fields.map((field) => (
                            <div key={field.id} className="space-y-2">
                              <label className="block text-sm font-medium text-slate-600">
                                {field.label}
                              </label>
                              <FieldRenderer
                                field={field}
                                value={reportValues['todos']?.[field.id] || ''}
                                onChange={(val) => handleValueChange('todos', field.id, val)}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Específico Mode (Split Screen)
                  <div className="flex h-full min-h-[500px]">
                    {/* Left Sidebar: Fields */}
                    <div className="w-1/3 border-r border-slate-200 bg-white overflow-y-auto">
                      <div className="p-4 space-y-6">
                        {selectedTemplate?.sections.map((section) => (
                          <div key={section.id}>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                              {section.title}
                            </h4>
                            <div className="space-y-1">
                              {section.fields.map((field) => (
                                <button
                                  key={field.id}
                                  onClick={() => setActiveFieldId(field.id)}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                    activeFieldId === field.id
                                      ? 'bg-blue-50 text-blue-700 font-medium'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {field.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Side: Students list for active field */}
                    <div className="w-2/3 overflow-y-auto p-6">
                      {activeFieldId && (
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                            <h3 className="font-medium text-slate-800">
                              {allFields.find((f) => f.id === activeFieldId)?.label}
                            </h3>
                            <p className="text-sm text-slate-500">
                              Preencha o valor para cada aluno abaixo.
                            </p>
                          </div>

                          <div className="space-y-3">
                            {targetedStudents.map((student) => {
                              const field = allFields.find((f) => f.id === activeFieldId);
                              if (!field) return null;

                              return (
                                <div
                                  key={student.id}
                                  className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                                >
                                  <div className="flex items-center space-x-3 w-1/3">
                                    {student.avatarUrl ? (
                                      <img
                                        src={student.avatarUrl}
                                        alt={student.name}
                                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-medium">
                                        {student.name.charAt(0)}
                                      </div>
                                    )}
                                    <span className="font-medium text-slate-700">
                                      {student.name}
                                    </span>
                                  </div>
                                  <div className="w-2/3 flex justify-end">
                                    <FieldRenderer
                                      field={field}
                                      value={reportValues[student.id]?.[field.id] || ''}
                                      onChange={(val) => handleValueChange(student.id, field.id, val)}
                                      compact
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-white flex justify-end space-x-3">
            <button
              onClick={() => {
                if (step === 2) setStep(1);
                else {
                  handleReset();
                  onClose();
                }
              }}
              className="px-5 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
            >
              {step === 2 ? 'Voltar' : 'Cancelar'}
            </button>
            {step === 1 ? (
              <button
                onClick={handleNext}
                disabled={!selectedTemplateId}
                className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-5 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center"
              >
                <Check className="w-4 h-4 mr-2" />
                Finalizar e Anexar
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Helper to render the actual input depending on field type
function FieldRenderer({
  field,
  value,
  onChange,
  compact = false,
}: {
  field: ReportField;
  value: any;
  onChange: (val: any) => void;
  compact?: boolean;
}) {
  if (field.type === 'texto-curto') {
    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
          compact ? 'px-3 py-2 text-sm' : 'px-4 py-2'
        }`}
        placeholder="Digite o valor..."
      />
    );
  }

  if (field.type === 'unica-escolha' && field.options) {
    return (
      <div className="flex flex-wrap gap-2 justify-end">
        {field.options.map((opt) => {
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`flex items-center px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {isSelected && <Check className="w-4 h-4 mr-1.5" />}
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}
