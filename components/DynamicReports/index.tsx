'use client';

import React, { useState } from 'react';
import { Paperclip, Send, FileText, X } from 'lucide-react';
import { ReportsSelectionModal } from './ReportsSelectionModal';
import { ReportPayloadView } from './ReportPayloadView';
import { MOCK_STUDENTS, ReportPayload } from './types';

export default function ComunicadosComposerDemo() {
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  
  // Viewer state
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

  // Form State
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  
  // Format: "NomeDeExibição|payload:{"templateId":"...","values":{...}}|report-payload"
  // For standard files, it could be just a URL or another string format.
  const [anexos, setAnexos] = useState<string[]>([]);

  // Simulation of "targetedStudents" derived from the composer's "To:" field
  const targetedStudents = MOCK_STUDENTS;

  const handleAddReport = (attachmentText: string, payload: ReportPayload) => {
    const stringified = JSON.stringify(payload);
    // As per requirement: NomeDeExibição|payload:{"templateId":"...","values":{...}}|report-payload
    const finalAttachmentString = `${attachmentText}|payload:${stringified}|report-payload`;
    
    setAnexos((prev) => [...prev, finalAttachmentString]);
  };

  const handleRemoveAnexo = (index: number) => {
    setAnexos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('--- COMUNICADO ENVIADO ---');
    console.log({
      titulo,
      mensagem,
      anexos,
      destinatarios: targetedStudents.map(s => s.id)
    });
    alert('Comunicado simulado com sucesso! Veja o console para o JSON completo.');
    setTitulo('');
    setMensagem('');
    setAnexos([]);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">Novo Comunicado</h1>
          <p className="text-blue-100 mt-1 opacity-90">Envie mensagens e relatórios dinâmicos para turmas ou alunos.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Destinatários (Simulado) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Para:</label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {targetedStudents.map(s => (
                <span key={s.id} className="bg-white px-3 py-1 rounded-full text-sm font-medium text-slate-600 border border-slate-200 shadow-sm">
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Título</label>
            <input 
              type="text" 
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              placeholder="Digite o título do comunicado..."
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Mensagem</label>
            <textarea 
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none min-h-[150px]"
              placeholder="Escreva sua mensagem aqui..."
              required
            />
          </div>

          {/* Anexos List */}
          {anexos.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">Anexos ({anexos.length})</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {anexos.map((anexo, idx) => {
                  const isReport = anexo.endsWith('|report-payload');
                  const title = anexo.split('|')[0];

                  return (
                    <div 
                      key={idx} 
                      className="group flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                      onClick={() => isReport && setViewingAttachment(anexo)}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className={`p-2 rounded-lg ${isReport ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-slate-700 truncate">{title}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAnexo(idx);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center space-x-2">
              <button 
                type="button"
                onClick={() => setIsReportsModalOpen(true)}
                className="flex items-center px-4 py-2.5 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-medium transition-all shadow-sm"
              >
                <Paperclip className="w-4 h-4 mr-2 text-slate-500" />
                Anexar Relatório
              </button>
            </div>
            
            <button 
              type="submit"
              className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Comunicado
            </button>
          </div>
        </form>
      </div>

      {/* Modals */}
      <ReportsSelectionModal 
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        targetedStudents={targetedStudents}
        onAdd={handleAddReport}
      />

      <ReportPayloadView 
        isOpen={!!viewingAttachment}
        onClose={() => setViewingAttachment(null)}
        attachmentString={viewingAttachment || ''}
      />
    </div>
  );
}
