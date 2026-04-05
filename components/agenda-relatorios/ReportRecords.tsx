'use client'

import React, { useState } from 'react'
import { useRelatorios } from '@/lib/relatoriosContext'
import { ArrowLeft, Search, Filter, Eye, Printer, Download, CheckCircle2, LayoutDashboard, List as ListIcon } from 'lucide-react'
import { ReportDashboard } from '@/components/agenda-relatorios/ReportDashboard'

type Props = {
  templateId: string | null
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler', id?: string | null) => void
}

export function ReportRecords({ templateId, onNavigate }: Props) {
  const { templates, records, setRecords } = useRelatorios()
  
  const tpl = templates.find(t => t.id === templateId)
  const tplRecords = records.filter(r => r.templateId === templateId).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const [selectedRecord, setSelectedRecord] = useState<any>(null)

  if (!tpl) return <div style={{ padding: 40, textAlign: 'center' }}>Modelo não especificado.</div>

  const aprovarRegistro = (rId: string) => {
    setRecords(prev => prev.map(r => r.id === rId ? { ...r, status: 'aprovado' } : r))
    if (selectedRecord && selectedRecord.id === rId) {
      setSelectedRecord((prev: any) => ({...prev, status: 'aprovado'}))
    }
  }

  const [activeTab, setActiveTab] = useState<'individuais' | 'dashboard'>('individuais')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-24px -24px 0 -24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => onNavigate('list')}><ArrowLeft size={20} /></button>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Registros: {tpl.name}</h2>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{tplRecords.length} submissão(ões) encontradas</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-main))', padding: 4, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
            <button className={`btn btn-sm ${activeTab === 'individuais' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setActiveTab('individuais')}><ListIcon size={16}/> Respostas</button>
            <button className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={16}/> Dashboard</button>
          </div>
          <button className="btn btn-secondary"><Download size={16} /> Exportar Excel</button>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <ReportDashboard template={tpl} records={tplRecords} />
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Lista de Envios */}
        <div style={{ width: 400, background: 'hsl(var(--bg-surface))', borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
             <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
                <input className="form-input" placeholder="Buscar por autor ou ID..." style={{ paddingLeft: 36, width: '100%' }} />
             </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tplRecords.map(r => (
               <div 
                 key={r.id} 
                 onClick={() => setSelectedRecord(r)}
                 style={{ 
                   padding: '16px', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', 
                   background: selectedRecord?.id === r.id ? 'rgba(99,102,241,0.05)' : 'transparent',
                   borderLeft: selectedRecord?.id === r.id ? '3px solid #4f46e5' : '3px solid transparent'
                 }}
               >
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                   <div style={{ fontWeight: 700, fontSize: 14 }}>{r.author}</div>
                   <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                 </div>
                 <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>ID: {r.id} • v{r.version}</div>
                 <div style={{ marginTop: 8 }}>
                   <span className="badge" style={{ background: r.status === 'aprovado' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: r.status === 'aprovado' ? '#10b981' : '#f59e0b' }}>
                     {r.status.toUpperCase()}
                   </span>
                 </div>
               </div>
            ))}
            {tplRecords.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhum preenchimento recebido.</div>}
          </div>
        </div>

        {/* Right: Visualização do Registro */}
        <div style={{ flex: 1, background: 'hsl(var(--bg-main))', display: 'flex', flexDirection: 'column' }}>
           {!selectedRecord ? (
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
               Selecione um registro na lista lateral para visualizar os detalhes.
             </div>
           ) : (
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px 32px', background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                     <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Enviado por {selectedRecord.author} em {new Date(selectedRecord.createdAt).toLocaleString()}</div>
                     <h2 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0 0' }}>Registro {selectedRecord.id}</h2>
                   </div>
                   <div style={{ display: 'flex', gap: 12 }}>
                     <button className="btn btn-secondary"><Printer size={16}/> Imprimir PDF</button>
                     {selectedRecord.status !== 'aprovado' && (
                        <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => aprovarRegistro(selectedRecord.id)}><CheckCircle2 size={16}/> Aprovar Relatório</button>
                     )}
                   </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
                   <div className="card" style={{ width: '100%', maxWidth: 700, padding: 32, margin: '0 auto' }}>
                      {tpl.sections.map(sec => (
                        <div key={'s'+sec.id} style={{ marginBottom: 32 }}>
                           <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--primary))', marginBottom: 16, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 8 }}>{sec.title}</h3>
                           <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px 24px' }}>
                             {sec.fields.filter(f => selectedRecord.data[f.id] !== undefined && selectedRecord.data[f.id] !== '').map(f => {
                                const val = selectedRecord.data[f.id]
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
                           {sec.fields.filter(f => selectedRecord.data[f.id] !== undefined && selectedRecord.data[f.id] !== '').length === 0 && (
                             <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Nenhum dado preenchido nesta seção.</div>
                           )}
                        </div>
                      ))}
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
