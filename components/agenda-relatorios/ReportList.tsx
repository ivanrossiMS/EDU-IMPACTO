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
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-reports-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 14px !important;
            margin-bottom: 20px !important;
          }
          .ad-reports-header h2 {
            font-size: 22px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }
          .ad-reports-header p {
            font-size: 13px !important;
            margin-top: 4px !important;
          }
          .ad-reports-actions {
            width: 100% !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
          .ad-reports-search-wrap {
            width: 100% !important;
          }
          .ad-reports-search-wrap input {
            width: 100% !important;
          }
          .ad-reports-btn-row {
            display: flex !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .ad-reports-btn-row button {
            flex: 1 !important;
            justify-content: center !important;
            font-size: 13px !important;
            padding: 8px 12px !important;
          }
          .ad-reports-tabs {
            width: 100% !important;
            display: flex !important;
            margin-bottom: 16px !important;
          }
          .ad-reports-tabs .tab-trigger {
            flex: 1 !important;
            justify-content: center !important;
            font-size: 12px !important;
            padding: 8px 12px !important;
          }
          .ad-reports-desktop-table {
            display: none !important;
          }
          .ad-reports-mobile-cards {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            padding: 8px !important;
          }
        }
        @media (min-width: 769px) {
          .ad-reports-mobile-cards {
            display: none !important;
          }
        }
      `}} />

      <div className="ad-reports-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Modelos de Relatórios</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Crie modelos dinâmicos para avaliações, rotinas e registros da equipe.</p>
        </div>
        
        <div className="ad-reports-actions" style={{ display: 'flex', gap: 12 }}>
          <div className="ad-reports-search-wrap" style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Buscar modelos..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 240 }} 
            />
          </div>
          <div className="ad-reports-btn-row" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary"><Filter size={16} /> Filtros</button>
            <button className="btn btn-primary" onClick={() => onNavigate('builder', null)}>
              <Plus size={16} /> Criar Relatório
            </button>
          </div>
        </div>
      </div>

      <div className="tab-list ad-reports-tabs" style={{ marginBottom: 24, width: 'fit-content' }}>
        <button className={`tab-trigger ${activeTab === 'ativos' ? 'active' : ''}`} onClick={() => setActiveTab('ativos')}>Ativos & Rascunhos</button>
        <button className={`tab-trigger ${activeTab === 'arquivados' ? 'active' : ''}`} onClick={() => setActiveTab('arquivados')}>Arquivados</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Desktop Table */}
        <table className="table ad-reports-desktop-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
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

        {/* Mobile Cards */}
        <div className="ad-reports-mobile-cards">
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'hsl(var(--text-muted))' }}>
              Nenhum modelo encontrado.
            </div>
          )}
          {filtered.map(t => {
            const regsCount = records.filter(r => r.templateId === t.id).length
            const fieldsCount = t.sections.reduce((acc, sec) => acc + sec.fields.length, 0)
            return (
              <div
                key={t.id}
                onClick={() => onNavigate('records', t.id)}
                style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  border: '1px solid hsl(var(--border-subtle))',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="avatar" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(0,0,0,0.05)', color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-main))' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>v{t.version} • {t.category}</div>
                    </div>
                  </div>
                  <span className="badge" style={{ 
                    background: t.status === 'ativo' ? 'rgba(16,185,129,0.1)' : t.status === 'rascunho' ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)',
                    color: t.status === 'ativo' ? '#10b981' : t.status === 'rascunho' ? '#f59e0b' : 'hsl(var(--text-muted))',
                    fontSize: 10,
                    padding: '2px 7px'
                  }}>
                    {t.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                      {fieldsCount} campos
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                      <Activity size={11}/> {regsCount} registros
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700 }} onClick={() => onNavigate('records', t.id)}>
                      Ver
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700 }} onClick={() => onNavigate('builder', t.id)}>
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
