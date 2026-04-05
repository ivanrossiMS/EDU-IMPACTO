'use client'

import React, { useState } from 'react'
import { useFormularios } from '@/lib/formulariosContext'
import { ArrowLeft, Search, Filter, Printer, Download, CheckCircle2, LayoutDashboard, List as ListIcon, XCircle, PenTool } from 'lucide-react'
import { ReportDashboard as FormulariosDashboard } from '@/components/agenda-relatorios/ReportDashboard'

type Props = {
  formId: string | null
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler' | 'sender', id?: string | null) => void
}

export function FormRecords({ formId, onNavigate }: Props) {
  const { forms, disparos, submissions } = useFormularios()
  
  const form = forms.find(t => t.id === formId)
  const fDisparos = disparos.filter(d => d.formId === formId).sort((a,b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
  
  const [activeTab, setActiveTab] = useState<'respondidos' | 'pendentes' | 'dashboard'>('respondidos')
  // We can select a 'disparo' instead of a submission directly to show its status.
  const [selectedDisparoId, setSelectedDisparoId] = useState<string | null>(null)

  if (!form) return <div style={{ padding: 40, textAlign: 'center' }}>Formulário não especificado.</div>

  const respondidos = fDisparos.filter(d => d.status === 'respondido')
  const pendentes = fDisparos.filter(d => d.status !== 'respondido')
  
  const selectedDisparo = fDisparos.find(d => d.id === selectedDisparoId)
  const selectedSubmission = selectedDisparo ? submissions.find(s => s.disparoId === selectedDisparo.id) : null

  // Mapeamos os submissions para usar no mesmo componente de dashboard dos relatorios.
  const tplRecords = submissions.filter(s => s.formId === formId).map(s => ({
     id: s.id,
     templateId: s.formId,
     author: s.authorName,
     data: s.data,
     status: 'aprovado', // Fake status
     createdAt: s.createdAt,
     version: s.version
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-24px -24px 0 -24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => onNavigate('list')}><ArrowLeft size={20} /></button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Registros: {form.name}</h2>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{fDisparos.length} famílias notificadas</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-main))', padding: 4, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
            <button className={`btn btn-sm ${activeTab === 'respondidos' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setActiveTab('respondidos')}><CheckCircle2 size={16}/> Com Resposta ({respondidos.length})</button>
            <button className={`btn btn-sm ${activeTab === 'pendentes' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setActiveTab('pendentes')}><XCircle size={16}/> Pendentes ({pendentes.length})</button>
            <button className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={16}/> Dashboard</button>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('filler', form.id)} title="Testar Tela Pelo App">Testar Preenchimento</button>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <FormulariosDashboard template={form as any} records={tplRecords as any} />
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Lista de Disparos */}
          <div style={{ width: 400, background: 'hsl(var(--bg-surface))', borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
               <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
                  <input className="form-input" placeholder="Buscar responsável ou aluno..." style={{ paddingLeft: 36, width: '100%' }} />
               </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(activeTab === 'respondidos' ? respondidos : pendentes).map(d => (
                 <div 
                   key={d.id} 
                   onClick={() => setSelectedDisparoId(d.id)}
                   style={{ 
                     padding: '16px', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', 
                     background: selectedDisparoId === d.id ? 'rgba(99,102,241,0.05)' : 'transparent',
                     borderLeft: selectedDisparoId === d.id ? '3px solid #4f46e5' : '3px solid transparent'
                   }}
                 >
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                     <div style={{ fontWeight: 700, fontSize: 14 }}>{d.targetName}</div>
                   </div>
                   <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Enviado: {new Date(d.sentAt).toLocaleDateString()}</div>
                   <div style={{ marginTop: 8 }}>
                     <span className="badge" style={{ background: d.status === 'respondido' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: d.status === 'respondido' ? '#10b981' : '#f59e0b' }}>
                       {d.status.toUpperCase()}
                     </span>
                   </div>
                 </div>
              ))}
              {(activeTab === 'respondidos' ? respondidos : pendentes).length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhum usuário nesta lista.</div>}
            </div>
          </div>

          {/* Right: Visualização do Registro/Disparo */}
          <div style={{ flex: 1, background: 'hsl(var(--bg-main))', display: 'flex', flexDirection: 'column' }}>
             {!selectedDisparoId ? (
               <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
                 Selecione um responsável na lista lateral para visualizar.
               </div>
             ) : selectedDisparo?.status !== 'respondido' || !selectedSubmission ? (
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
                  <XCircle size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0', color: 'hsl(var(--text-main))' }}>Resposta Pendente</h3>
                  <p>Este familiar ainda não assinou ou preencheu o formulário.</p>
                  <button className="btn btn-secondary" style={{ marginTop: 16 }}>Reenviar Push Notification</button>
               </div>
             ) : (
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '24px 32px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Preenchido em {new Date(selectedSubmission.createdAt).toLocaleString()}</div>
                       <h2 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0 0' }}>{selectedSubmission.authorName}</h2>
                       <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 4 }}>ID Validação Legal: {selectedSubmission.id}</div>
                     </div>
                     <div style={{ display: 'flex', gap: 12 }}>
                       <button className="btn btn-secondary"><Printer size={16}/> Imprimir PDF</button>
                     </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
                     <div className="card" style={{ width: '100%', maxWidth: 700, padding: 32, margin: '0 auto' }}>
                        
                        {/* Seções e Respostas */}
                        {form.sections.map(sec => (
                          <div key={'s'+sec.id} style={{ marginBottom: 32 }}>
                             <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--primary))', marginBottom: 16, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 8 }}>{sec.title}</h3>
                             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px 24px' }}>
                               {sec.fields.filter(f => selectedSubmission.data[f.id] !== undefined && selectedSubmission.data[f.id] !== '').map(f => {
                                  let val = selectedSubmission.data[f.id]
                                  return (
                                    <div key={'f'+f.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>{f.label}</span>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-main))', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {Array.isArray(val) ? val.join(', ') : String(val)}
                                      </span>
                                    </div>
                                  )
                               })}
                             </div>
                             {sec.fields.filter(f => selectedSubmission.data[f.id] !== undefined && selectedSubmission.data[f.id] !== '').length === 0 && (
                               <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Nenhum dado preenchido nesta seção.</div>
                             )}
                          </div>
                        ))}

                        {/* Assinatura do Responsavel */}
                        {form.requireSignature && selectedSubmission.signatureBase64 && (
                           <div style={{ borderTop: '2px solid hsl(var(--border-subtle))', marginTop: 32, paddingTop: 32 }}>
                              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><PenTool size={18}/> Assinatura Digital do Responsável</h3>
                              <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 24 }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                       <CheckCircle2 size={20}/> Assinatura Válida e Autenticada
                                    </div>
                                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{new Date(selectedSubmission.signedAt || selectedSubmission.createdAt).toLocaleString()}</div>
                                 </div>
                                 <div style={{ background: '#fff', borderRadius: 8, padding: 16, display: 'inline-block' }}>
                                    <div style={{ fontFamily: 'Dancing Script, cursive', fontSize: 32, color: '#000', opacity: 0.8, lineHeight: 1 }}>{selectedSubmission.authorName}</div>
                                 </div>
                                 <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 12 }}>Token de verificação legal (Hash): {selectedSubmission.signatureBase64}</div>
                              </div>
                           </div>
                        )}

                     </div>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  )
}
