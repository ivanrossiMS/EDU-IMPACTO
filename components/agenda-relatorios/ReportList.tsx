'use client'

import React, { useState } from 'react'
import { useRelatorios, ReportTemplate } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { Search, Plus, Filter, MoreHorizontal, Eye, Copy, Archive, FileText, Activity } from 'lucide-react'

type Props = {
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler', id?: string | null) => void
}

export function ReportList({ onNavigate }: Props) {
  const { templates, setTemplates, records, addLog } = useRelatorios()
  const { adConfirm } = useAgendaDigital()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'ativos' | 'arquivados'>('ativos')

  const filtered = templates.filter(t => {
    if (activeTab === 'ativos' && t.status === 'arquivado') return false
    if (activeTab === 'arquivados' && t.status !== 'arquivado') return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const duplicar = (t: ReportTemplate) => {
    adConfirm('Deseja duplicar este modelo?', 'Duplicar Relatório', () => {
      const novo = { ...t, id: `TPL-${Date.now()}`, name: `${t.name} (Cópia)`, status: 'rascunho' as const, version: 1 }
      setTemplates(prev => [novo, ...prev])
      addLog('Duplicação', `Modelo duplicado a partir de ${t.name}`)
    })
  }

  const arquivar = (t: ReportTemplate) => {
    adConfirm(t.status === 'arquivado' ? 'Deseja desarquivar este modelo?' : 'Deseja arquivar este modelo? Ele não poderá mais ser preenchido pelos colaboradores.', 'Arquivar Relatório', () => {
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, status: t.status === 'arquivado' ? 'ativo' : 'arquivado' } : x))
      addLog(t.status === 'arquivado' ? 'Desarquivamento' : 'Arquivamento', `Modelo: ${t.name}`)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Modelos de Relatórios</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Crie modelos dinâmicos para a avaliações, rotinas e registros da equipe.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar modelos..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 240 }} 
            />
          </div>
          <button className="btn btn-secondary"><Filter size={16} /> Filtros</button>
          <button className="btn btn-primary" onClick={() => onNavigate('builder', null)}>
            <Plus size={16} /> Criar Relatório
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
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Nome do Modelo</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Categoria</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Campos</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Registros</th>
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
            {filtered.map(t => {
               const regsCount = records.filter(r => r.templateId === t.id).length
               const fieldsCount = t.sections.reduce((acc, sec) => acc + sec.fields.length, 0)
               return (
                <tr key={t.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }} onClick={() => onNavigate('records', t.id)}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="avatar" style={{ width: 40, height: 40, background: 'rgba(0,0,0,0.05)', color: t.color }}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'hsl(var(--text-main))' }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>v{t.version} • {t.description.substring(0, 50)}...</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: 'hsl(var(--text-secondary))', fontSize: 13 }}>{t.category}</td>
                  <td style={{ padding: '16px', textAlign: 'center', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{fieldsCount}</td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                     <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                        <Activity size={12}/> {regsCount}
                     </div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span className="badge" style={{ 
                      background: t.status === 'ativo' ? 'rgba(16,185,129,0.1)' : t.status === 'rascunho' ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)',
                      color: t.status === 'ativo' ? '#10b981' : t.status === 'rascunho' ? '#f59e0b' : 'hsl(var(--text-muted))'
                    }}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('records', t.id)} title="Ver Registros"><Eye size={16} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('filler', t.id)} title="Testar Preenchimento"><FileText size={16} /></button>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }} onClick={() => onNavigate('builder', t.id)}>Editar</button>
                        
                        <div style={{ position: 'relative', display: 'inline-block' }} className="group">
                           <button className="btn btn-ghost btn-sm"><MoreHorizontal size={16} /></button>
                           {/* Hover Menu */}
                           <div className="dropdown-content absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:flex flex-col min-w-[150px] z-10" style={{ padding: 4 }}>
                              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => duplicar(t)}><Copy size={14}/> Duplicar</button>
                              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => arquivar(t)}><Archive size={14}/> {t.status === 'arquivado' ? 'Reativar' : 'Arquivar'}</button>
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
