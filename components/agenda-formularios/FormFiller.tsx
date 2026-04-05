'use client'

import React, { useState } from 'react'
import { useFormularios, FormSubmission } from '@/lib/formulariosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react'

type Props = {
  formId: string
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler' | 'sender', id?: string | null) => void
}

export function FormFiller({ formId, onNavigate }: Props) {
  const { forms, setSubmissions } = useFormularios()
  const { adAlert } = useAgendaDigital()
  
  const form = forms.find(t => t.id === formId)
  
  const [data, setData] = useState<Record<string, any>>({})
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [password, setPassword] = useState('')

  if (!form) return null

  const handleFieldChange = (fieldId: string, value: any) => {
    setData(prev => ({ ...prev, [fieldId]: value }))
  }

  const checkValidation = () => {
    let isValid = true
    for (const sec of form.sections) {
      for (const field of sec.fields) {
        if (field.conditionalRule) {
           const dependsVal = data[field.conditionalRule.fieldId!]
           if (field.conditionalRule.operator === 'equals' && dependsVal !== field.conditionalRule.value) {
             continue // skipped evaluating logic
           }
        }
        if (field.required && (data[field.id] === undefined || data[field.id] === '' || (Array.isArray(data[field.id]) && data[field.id].length === 0))) {
          isValid = false
        }
      }
    }
    return isValid
  }

  const handleSubmit = () => {
    if (!checkValidation()) {
       return adAlert('Por favor, preencha todos os campos obrigatórios antes de enviar.', 'Aviso')
    }
    if (form.requireSignature) {
       setIsSignModalOpen(true)
    } else {
       finishSubmission()
    }
  }

  const finishSubmission = () => {
     const sub: FormSubmission = {
       id: `SUB-${Date.now()}`,
       formId: form.id,
       version: form.version,
       authorName: 'Admin de Teste (Mock Responsável)',
       studentName: 'Aluno de Teste',
       data: { ...data },
       createdAt: new Date().toISOString()
     }

     if (form.requireSignature) {
        sub.signatureBase64 = `token_digital_${Date.now()}_` + Math.random().toString(36).substring(7)
        sub.signedAt = new Date().toISOString()
     }

     setSubmissions(prev => [sub, ...prev])
     adAlert('Formulário enviado com sucesso e salvo em nossos registros.', 'Sucesso!')
     onNavigate('records', form.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--bg-main))', margin: '-24px -24px 0 -24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <button className="btn btn-ghost" style={{ padding: '8px', marginRight: 16 }} onClick={() => onNavigate('records', form.id)}><ArrowLeft size={20} /></button>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>App do Responsável (Simulação)</h2>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Preenchendo como: Admin</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: 'hsl(var(--bg-main))' }}>
        <div className="card" style={{ width: '100%', maxWidth: 640, overflow: 'hidden', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 16, background: '#4f46e5' }} />
          <div style={{ padding: 32, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
             <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit', margin: '0 0 12px 0' }}>{form.name}</h1>
             <p style={{ fontSize: 15, color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.5 }}>{form.description}</p>
          </div>

          <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 40 }}>
            {form.sections.map(sec => (
              <div key={sec.id}>
                 <h2 style={{ fontSize: 20, fontWeight: 800, borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: 12, marginBottom: 24, color: 'hsl(var(--text-main))' }}>{sec.title}</h2>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                   {sec.fields.map(f => {
                      // Logic conditional
                      if (f.conditionalRule) {
                        const dependsVal = data[f.conditionalRule.fieldId!]
                        if (f.conditionalRule.operator === 'equals' && dependsVal !== f.conditionalRule.value) return null
                        if (f.conditionalRule.operator === 'not_equals' && dependsVal === f.conditionalRule.value) return null
                      }

                      return (
                        <div key={f.id} style={{ display: 'flex', flexDirection: 'column' }}>
                           <label style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'hsl(var(--text-main))' }}>
                             {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                           </label>
                           {f.description && <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 12 }}>{f.description}</div>}
                           
                           {/* Renderização condicional por tipo */}
                           {['texto-curto', 'texto-longo', 'numero', 'data', 'hora'].includes(f.type) && (
                             <input 
                               className="form-input" 
                               type={f.type === 'numero' ? 'number' : f.type === 'data' ? 'date' : f.type === 'hora' ? 'time' : 'text'}
                               value={data[f.id] || ''} 
                               onChange={e => handleFieldChange(f.id, e.target.value)}
                             />
                           )}
                           
                           {f.type === 'unica-escolha' && f.options?.map(op => (
                             <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, marginBottom: 8, cursor: 'pointer', background: data[f.id] === op ? 'rgba(79,70,229,0.05)' : 'white' }}>
                                <input type="radio" checked={data[f.id] === op} onChange={() => handleFieldChange(f.id, op)} style={{ width: 18, height: 18 }} />
                                <span>{op}</span>
                             </label>
                           ))}

                           {f.type === 'sim-nao' && (
                             <div style={{ display: 'flex', gap: 12 }}>
                                <button className={`btn ${data[f.id] === 'Sim' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => handleFieldChange(f.id, 'Sim')}>Sim</button>
                                <button className={`btn ${data[f.id] === 'Não' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, background: data[f.id] === 'Não' ? '#ef4444' : '', borderColor: data[f.id] === 'Não' ? '#ef4444' : '' }} onClick={() => handleFieldChange(f.id, 'Não')}>Não</button>
                             </div>
                           )}

                           {f.type === 'multipla-escolha' && f.options?.map(op => {
                             const curr = data[f.id] || []
                             const checked = curr.includes(op)
                             const toggle = () => {
                               if (checked) handleFieldChange(f.id, curr.filter((x: string) => x !== op))
                               else handleFieldChange(f.id, [...curr, op])
                             }
                             return (
                               <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, marginBottom: 8, cursor: 'pointer', background: checked ? 'rgba(79,70,229,0.05)' : 'white' }}>
                                 <input type="checkbox" checked={checked} onChange={toggle} style={{ width: 18, height: 18 }} />
                                 <span>{op}</span>
                               </label>
                             )
                           })}
                        </div>
                      )
                   })}
                 </div>
              </div>
            ))}
          </div>

          <div style={{ padding: 32, background: 'hsl(var(--bg-surface))', borderTop: '1px solid hsl(var(--border-subtle))' }}>
             <button className="btn btn-primary lg" style={{ width: '100%', background: '#4f46e5', border: 'none', padding: '16px 0', fontSize: 16, fontWeight: 700 }} onClick={handleSubmit}>
               {form.requireSignature ? 'Assinar e Enviar Formulário' : 'Enviar Respostas'}
             </button>
          </div>
        </div>
      </div>

      {isSignModalOpen && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="card" style={{ width: 400, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
               <div style={{ width: 64, height: 64, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <Lock size={32} />
               </div>
               <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Assinatura Digital</h3>
               <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: 24 }}>Para validar juridicamente as respostas, informe sua senha do aplicativo:</p>
               
               <input 
                 type="password" 
                 className="form-input" 
                 placeholder="Sua senha..." 
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 style={{ width: '100%', marginBottom: 24, textAlign: 'center', letterSpacing: 2 }} 
               />

               <div style={{ display: 'flex', width: '100%', gap: 12 }}>
                 <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsSignModalOpen(false)}>Cancelar</button>
                 <button className="btn btn-primary" style={{ flex: 1, background: '#10b981', border: 'none' }} onClick={() => {
                   if (!password) return adAlert('Digite uma senha qualquer para simular.', 'Erro')
                   finishSubmission()
                 }}><CheckCircle2 size={16}/> Comfirmar</button>
               </div>
            </div>
         </div>
      )}
    </div>
  )
}
