'use client'

import React, { useState } from 'react'
import { useFormularios, FormDisparo } from '@/lib/formulariosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { ArrowLeft, Send, Users, UserCheck } from 'lucide-react'

type Props = {
  formId: string
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler' | 'sender', id?: string | null) => void
}

export function FormSender({ formId, onNavigate }: Props) {
  const { forms, setDisparos } = useFormularios()
  const { adAlert } = useAgendaDigital()
  
  const form = forms.find(f => f.id === formId)
  
  const [selectedAudience, setSelectedAudience] = useState<string>('todos')

  if (!form) return null

  const handleSend = () => {
    // Generate mock mock targets based on audience
    const newDisparos: FormDisparo[] = []
    
    const qty = selectedAudience === 'todos' ? 150 : (selectedAudience === 'turma' ? 30 : 5)
    
    for(let i = 0; i < qty; i++) {
       newDisparos.push({
          id: `D-${Date.now()}-${i}`,
          formId: form.id,
          targetId: `R-${Math.floor(Math.random() * 10000)}`,
          targetName: `Responsável Fictício ${i+1}`,
          status: 'pendente',
          sentAt: new Date().toISOString()
       })
    }

    setDisparos(prev => [...prev, ...newDisparos])
    adAlert(`Formulário disparado com sucesso para ${qty} responsáveis via notificação push no app.`, 'Disparo Realizado')
    onNavigate('records', form.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-24px -24px 0 -24px', background: 'hsl(var(--bg-main))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => onNavigate('list')}><ArrowLeft size={20} /></button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Disparar Formulário</h2>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{form.name}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 40, flex: 1, display: 'flex', justifyContent: 'center' }}>
         <div className="card" style={{ width: '100%', maxWidth: 600, padding: 32, height: 'fit-content' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Selecione o Público-Alvo</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: 32 }}>Para quem você deseja enviar este formulário? Um alerta push será enviado para o aplicativo Educacional da família.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
              <label style={{ display: 'flex', gap: 16, padding: 20, border: selectedAudience === 'todos' ? '2px solid #4f46e5' : '1px solid hsl(var(--border-subtle))', borderRadius: 12, cursor: 'pointer', background: selectedAudience === 'todos' ? 'rgba(79,70,229,0.05)' : 'transparent', alignItems: 'center' }}>
                 <input type="radio" name="audience" checked={selectedAudience === 'todos'} onChange={() => setSelectedAudience('todos')}/>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ color: selectedAudience === 'todos' ? '#4f46e5' : 'hsl(var(--text-muted))' }}><Users size={24}/></div>
                    <div>
                       <strong style={{ display: 'block', fontSize: 15 }}>Toda a Escola (Todos os alunos ativos)</strong>
                       <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>O formulário será enviado para ~150 responsáveis.</span>
                    </div>
                 </div>
              </label>

              <label style={{ display: 'flex', gap: 16, padding: 20, border: selectedAudience === 'turma' ? '2px solid #4f46e5' : '1px solid hsl(var(--border-subtle))', borderRadius: 12, cursor: 'pointer', background: selectedAudience === 'turma' ? 'rgba(79,70,229,0.05)' : 'transparent', alignItems: 'center' }}>
                 <input type="radio" name="audience" checked={selectedAudience === 'turma'} onChange={() => setSelectedAudience('turma')}/>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ color: selectedAudience === 'turma' ? '#4f46e5' : 'hsl(var(--text-muted))' }}><Users size={24}/></div>
                    <div>
                       <strong style={{ display: 'block', fontSize: 15 }}>Turmas Específicas</strong>
                       <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>O formulário será enviado para ~30 responsáveis (Simulação 1º Ano).</span>
                    </div>
                 </div>
              </label>

              <label style={{ display: 'flex', gap: 16, padding: 20, border: selectedAudience === 'alunos' ? '2px solid #4f46e5' : '1px solid hsl(var(--border-subtle))', borderRadius: 12, cursor: 'pointer', background: selectedAudience === 'alunos' ? 'rgba(79,70,229,0.05)' : 'transparent', alignItems: 'center' }}>
                 <input type="radio" name="audience" checked={selectedAudience === 'alunos'} onChange={() => setSelectedAudience('alunos')}/>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ color: selectedAudience === 'alunos' ? '#4f46e5' : 'hsl(var(--text-muted))' }}><UserCheck size={24}/></div>
                    <div>
                       <strong style={{ display: 'block', fontSize: 15 }}>Alunos e Pais Específicos</strong>
                       <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>O formulário será enviado para ~5 responsáveis selecionados manualmente.</span>
                    </div>
                 </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-secondary" onClick={() => onNavigate('list')}>Cancelar</button>
               <button className="btn btn-primary" style={{ background: '#4f46e5', color: '#fff', border: 'none' }} onClick={handleSend}><Send size={16} /> Disparar Agora</button>
            </div>
         </div>
      </div>
    </div>
  )
}
