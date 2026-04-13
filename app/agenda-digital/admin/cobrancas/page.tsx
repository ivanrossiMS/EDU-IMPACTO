'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useState } from 'react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { Plus, Search, Filter, Settings2, BadgeDollarSign, QrCode, FileText, CheckCircle2, AlertCircle, DownloadCloud } from 'lucide-react'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export default function ADAdminCobrancas() {
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');
  const { adAlert } = useAgendaDigital()
  const [activeTab, setActiveTab] = useState<'app' | 'erp'>('app')

  const [appCharges, setAppCharges] = useLocalStorage<any[]>('edu-app-charges-v2', [])

  // Some metrics
  const pendingCount = appCharges.filter(c => c.status !== 'pago').length
  const pendingTotal = appCharges.filter(c => c.status !== 'pago').reduce((acc, c) => acc + c.valor, 0)
  const successTotal = appCharges.filter(c => c.status === 'pago').reduce((acc, c) => acc + c.valor, 0)

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Cobranças Rápidas</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Envie links de pagamento via PIX e gerencie arrecadações extras.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => adAlert('Abrirá painel de relatórios consolidados', 'Exportar')}><DownloadCloud size={16} /> Exportar</button>
          <button className="btn btn-primary" style={{ background: '#ec4899', color: 'white', borderColor: '#ec4899' }} onClick={() => adAlert('Disparar cobrança avulsa para responsáveis configurados no ERP', 'Nova Cobrança')}><Plus size={16} /> Nova Cobrança</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
         <div className="card" style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
           <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <BadgeDollarSign size={20} />
           </div>
           <div>
             <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{pendingCount}</div>
             <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Aguardando Pgto.</div>
           </div>
         </div>
         <div className="card" style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
           <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239, 68, 68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <AlertCircle size={20} />
           </div>
           <div>
             <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>R$ {pendingTotal.toFixed(2)}</div>
             <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Volume Pendente</div>
           </div>
         </div>
         <div className="card" style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
           <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <CheckCircle2 size={20} />
           </div>
           <div>
             <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>R$ {successTotal.toFixed(2)}</div>
             <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Total Recebido In-App</div>
           </div>
         </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', gap: 24 }}>
             <button 
               onClick={() => setActiveTab('app')}
               style={{ background: 'transparent', border: 0, fontWeight: 600, padding: '12px 0', borderBottom: activeTab === 'app' ? '2px solid #4f46e5' : '2px solid transparent', color: activeTab === 'app' ? '#4f46e5' : 'hsl(var(--text-secondary))', cursor: 'pointer' }}
             >Cobranças do App</button>
             <button 
               onClick={() => setActiveTab('erp')}
               style={{ background: 'transparent', border: 0, fontWeight: 600, padding: '12px 0', borderBottom: activeTab === 'erp' ? '2px solid #4f46e5' : '2px solid transparent', color: activeTab === 'erp' ? '#4f46e5' : 'hsl(var(--text-secondary))', cursor: 'pointer' }}
             >Ver Mensalidades (ERP)</button>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
             <button className="btn btn-ghost btn-sm"><Filter size={14} /> Filtros</button>
             <button className="btn btn-ghost btn-sm"><Settings2 size={14} /> Config</button>
          </div>
        </div>

        {activeTab === 'app' ? (
           <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
             <thead>
               <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
                 <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Motivo</th>
                 <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Destinatário</th>
                 <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Valor</th>
                 <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Status</th>
                 <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Ações</th>
               </tr>
             </thead>
             <tbody>
               {appCharges.map(charge => (
                 <tr key={charge.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                   <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600 }}>{charge.motivo}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                         {charge.tipo === 'pix' ? <QrCode size={12} color="#10b981"/> : <FileText size={12} color="#3b82f6"/>} 
                         Cobrado via {charge.tipo.toUpperCase()}
                      </div>
                   </td>
                   <td style={{ padding: '16px' }}>
                      <div style={{ fontSize: 14 }}>{charge.aluno}</div>
                   </td>
                   <td style={{ padding: '16px', fontWeight: 700 }}>R$ {charge.valor.toFixed(2)}</td>
                   <td style={{ padding: '16px' }}>
                     {charge.status === 'pago' ? <span className="badge badge-success">Pago</span> : 
                      charge.status === 'pendente' ? <span className="badge badge-ghost text-muted">Aguardando</span> : 
                      <span className="badge badge-error">Atrasado</span>}
                     <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Venc: {charge.vencimento}</div>
                   </td>
                   <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" style={{borderColor: 'hsl(var(--border-subtle))'}}>Detalhes</button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
             <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
             <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Integração Mensalidades</h3>
             <p>As {titulos?.length || 0} mensalidades ativas do ERP são sincronizadas automaticamente para o app da família.<br/>Você não precisa cobrar manualmente pelo app.</p>
          </div>
        )}
      </div>
    </div>
  )
}
