'use client'

import React, { useState } from 'react'
import { useFormularios, FormTemplate } from '@/lib/formulariosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { Search, Plus, Filter, MoreHorizontal, Eye, Copy, Archive, FormInput, Activity, Send } from 'lucide-react'

type Props = {
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler' | 'sender', id?: string | null) => void
}

export function FormList({ onNavigate }: Props) {
  const { forms, setForms, disparos, submissions } = useFormularios()
  const { adConfirm } = useAgendaDigital()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'ativos' | 'arquivados'>('ativos')

  const filtered = forms.filter(f => {
    if (activeTab === 'ativos' && f.status === 'arquivado') return false
    if (activeTab === 'arquivados' && f.status !== 'arquivado') return false
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const duplicar = (f: FormTemplate) => {
    adConfirm('Deseja duplicar este formulário?', 'Duplicar Formulário', () => {
      const novo: FormTemplate = { ...f, id: `FRM-${Date.now()}`, name: `${f.name} (Cópia)`, status: 'rascunho', version: 1 }
      setForms(prev => [novo, ...prev])
    })
  }

  const arquivar = (f: FormTemplate) => {
    adConfirm(f.status === 'arquivado' ? 'Deseja desarquivar este formulário?' : 'Deseja arquivar este formulário? Ele não poderá mais ser preenchido/enviado.', 'Arquivar Formulário', () => {
      setForms(prev => prev.map(x => x.id === f.id ? { ...x, status: f.status === 'arquivado' ? 'ativo' : 'arquivado' } : x))
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Formulários e Autorizações</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Crie questionários e solicite assinaturas digitais direto no app dos pais.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar formulários..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 240 }} 
            />
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('builder', null)}>
            <Plus size={16} /> Criar Novo Formulário
          </button>
        </div>
      </div>

      <div className="tab-list" style={{ marginBottom: 24, width: 'fit-content' }}>
        <button className={`tab-trigger ${activeTab === 'ativos' ? 'active' : ''}`} onClick={() => setActiveTab('ativos')}>Ativos & Rascunhos</button>
        <button className={`tab-trigger ${activeTab === 'arquivados' ? 'active' : ''}`} onClick={() => setActiveTab('arquivados')}>Arquivados</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nome do Formulário</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Categoria</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Assinatura</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Adesão (% Respostas)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>Nenhum modelo encontrado.</td>
              </tr>
            )}
            {filtered.map(f => {
               const disp = disparos.filter(d => d.formId === f.id)
               const reps = submissions.filter(s => s.formId === f.id)
               const pct = disp.length > 0 ? Math.round((reps.length / disp.length) * 100) : 0

               return (
                <tr key={f.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }} onClick={() => onNavigate('records', f.id)}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="avatar" style={{ width: 40, height: 40, background: 'rgba(0,0,0,0.05)', color: '#4f46e5' }}>
                        <FormInput size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'hsl(var(--text-main))' }}>{f.name}</div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{f.description.substring(0, 50)}...</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: 'hsl(var(--text-secondary))', fontSize: 13 }}>{f.category}</td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                     {f.requireSignature ? <span style={{ color: '#10b981', fontWeight: 600, fontSize: 12 }}>✓ Exigida</span> : <span style={{ color: 'hsl(var(--text-muted))', fontSize: 12 }}>Não</span>}
                  </td>
                  <td style={{ padding: '16px' }}>
                     {disp.length > 0 ? (
                        <div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
                              <span>{reps.length}/{disp.length} pais</span>
                              <span>{pct}%</span>
                           </div>
                           <div style={{ width: '100%', height: 6, background: 'hsl(var(--bg-main))', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : '#4f46e5', borderRadius: 3 }}/>
                           </div>
                        </div>
                     ) : (
                        <div style={{ textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-muted))' }}>Não disparado</div>
                     )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span className="badge" style={{ 
                      background: f.status === 'ativo' ? 'rgba(79,70,229,0.1)' : f.status === 'rascunho' ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)',
                      color: f.status === 'ativo' ? '#4f46e5' : f.status === 'rascunho' ? '#f59e0b' : 'hsl(var(--text-muted))'
                    }}>
                      {f.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {f.status === 'ativo' && (
                          <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px', borderColor: '#4f46e5', color: '#4f46e5' }} onClick={() => onNavigate('sender', f.id)} title="Disparar para os Pais">
                              <Send size={14} style={{ marginRight: 6 }}/> Enviar
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('records', f.id)} title="Ver Registros"><Eye size={16} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('builder', f.id)}>Editar</button>
                        
                        <div style={{ position: 'relative', display: 'inline-block' }} className="group">
                           <button className="btn btn-ghost btn-sm"><MoreHorizontal size={16} /></button>
                           {/* Hover Menu */}
                           <div className="dropdown-content absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:flex flex-col min-w-[150px] z-10" style={{ padding: 4 }}>
                              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => duplicar(f)}><Copy size={14}/> Duplicar</button>
                              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => arquivar(f)}><Archive size={14}/> {f.status === 'arquivado' ? 'Reativar' : 'Arquivar'}</button>
                           </div>
                        </div>
                    </div>
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
