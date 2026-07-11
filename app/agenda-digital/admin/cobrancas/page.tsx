'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '@/lib/dataContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Filter, Settings2, BadgeDollarSign, QrCode, FileText, CheckCircle2, AlertCircle, DownloadCloud, CreditCard, X, Printer } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export default function ADAdminCobrancas() {
  const [titulos] = useSupabaseArray<any>('titulos');
  const { adAlert } = useAgendaDigital()
  const [activeTab, setActiveTab] = useState<'app' | 'erp'>('app')

  const [appCharges, setAppCharges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [filterModalStatus, setFilterModalStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL')
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [alunosMap, setAlunosMap] = useState<Record<string, string>>({})

  // Novos estados para a tabela principal
  const [mainFilterStatus, setMainFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL')
  const [mainSearchTerm, setMainSearchTerm] = useState('')

  useEffect(() => {
    const fetchAlunosMap = async (charges: any[]) => {
      try {
        const { data: gruposData, error } = await supabase.from('agenda_grupos').select('id, dados');
        
        if (gruposData) {
          const map: Record<string, string> = {};
          gruposData.forEach((grupo: any) => {
            if (grupo.dados?.alunosIds && Array.isArray(grupo.dados.alunosIds)) {
              grupo.dados.alunosIds.forEach((alunoId: string) => {
                map[alunoId] = grupo.dados.nome;
              });
            }
          });
          setAlunosMap(map);
        } else {
          console.error('Error fetching grupos for map', error);
        }
      } catch (e) {
        console.error('Failed to fetch alunos map via Supabase', e);
      }
    }

    const fetchCharges = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('agenda_cobrancas_destinatarios')
        .select('*, agenda_cobrancas(*)')
        .order('created_at', { ascending: false });

      if (data) {
        setAppCharges(data);
        fetchAlunosMap(data);
      }
      setLoading(false);
    }

    fetchCharges();
  }, [])

  // Bloquear scroll do body e do container principal quando o modal estiver aberto
  useEffect(() => {
    const mainScroll = document.querySelector('.ad-main-scroll') as HTMLElement;
    if (selectedGroupId) {
      document.body.style.overflow = 'hidden';
      if (mainScroll) mainScroll.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      if (mainScroll) mainScroll.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = 'unset';
      if (mainScroll) mainScroll.style.overflow = '';
    }
  }, [selectedGroupId])

  // Some metrics
  const pendingCount = appCharges.filter(c => c.status !== 'CONFIRMED' && c.status !== 'RECEIVED').length
  const pendingTotal = appCharges.filter(c => c.status !== 'CONFIRMED' && c.status !== 'RECEIVED').reduce((acc, c) => acc + (c.agenda_cobrancas?.valor || 0), 0)
  const successTotal = appCharges.filter(c => c.status === 'CONFIRMED' || c.status === 'RECEIVED').reduce((acc, c) => acc + (c.agenda_cobrancas?.valor || 0), 0)

  // Group charges by cobranca_id
  const groupedCharges = appCharges.reduce((acc, curr) => {
    const cId = curr.cobranca_id;
    if (!cId) return acc;
    if (!acc[cId]) {
      acc[cId] = {
        cobranca: curr.agenda_cobrancas || { titulo: 'Sem Título', valor: 0 },
        destinatarios: []
      }
    }
    acc[cId].destinatarios.push(curr);
    return acc;
  }, {} as Record<string, any>);

  const groupedArray = Object.keys(groupedCharges).map(k => ({ id: k, ...groupedCharges[k] }));

  const filteredGroupedArray = groupedArray.filter(group => {
    const totalEnviados = group.destinatarios.length;
    const totalPagos = group.destinatarios.filter((d: any) => d.status === 'CONFIRMED' || d.status === 'RECEIVED').length;
    
    // Filtro por status
    if (mainFilterStatus === 'PAID' && (totalPagos !== totalEnviados || totalEnviados === 0)) return false;
    if (mainFilterStatus === 'PENDING' && totalPagos === totalEnviados && totalEnviados > 0) return false;

    // Filtro por termo (busca)
    if (mainSearchTerm && !group.cobranca?.titulo?.toLowerCase().includes(mainSearchTerm.toLowerCase())) return false;

    return true;
  });

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Cobranças Rápidas</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Gerencie arrecadações extras e as cobranças anexadas aos comunicados.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => adAlert('Abrirá painel de relatórios consolidados', 'Exportar')}><DownloadCloud size={16} /> Exportar</button>
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
             >Cobranças do App (Asaas)</button>
             <button 
               onClick={() => setActiveTab('erp')}
               style={{ background: 'transparent', border: 0, fontWeight: 600, padding: '12px 0', borderBottom: activeTab === 'erp' ? '2px solid #4f46e5' : '2px solid transparent', color: activeTab === 'erp' ? '#4f46e5' : 'hsl(var(--text-secondary))', cursor: 'pointer' }}
             >Ver Mensalidades (ERP)</button>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
             <div style={{ position: 'relative', width: 240 }}>
               <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
               <input 
                 type="text" 
                 placeholder="Buscar por motivo..." 
                 value={mainSearchTerm}
                 onChange={e => setMainSearchTerm(e.target.value)}
                 style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', outline: 'none', fontSize: 13 }}
               />
             </div>
             <select 
               value={mainFilterStatus}
               onChange={e => setMainFilterStatus(e.target.value as any)}
               style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', outline: 'none', fontSize: 13, background: '#fff', cursor: 'pointer' }}
             >
               <option value="ALL">Todas as cobranças</option>
               <option value="PENDING">Com Pagamentos Pendentes</option>
               <option value="PAID">Totalmente Pagas</option>
             </select>
             <button className="btn btn-ghost btn-sm" style={{ padding: '0 8px' }} title="Configurações"><Settings2 size={16} /></button>
          </div>
        </div>

        {activeTab === 'app' ? (
           <div style={{ flex: 1, overflowY: 'auto' }}>
             <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
               <thead>
                 <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 }}>
                   <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Motivo (Comunicado)</th>
                   <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Destinatários</th>
                   <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Valor Unitário</th>
                   <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Recebimentos</th>
                   <th style={{ padding: '12px 16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Ações</th>
                 </tr>
               </thead>
               <tbody>
                 {loading ? (
                    <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center' }}>Carregando cobranças...</td></tr>
                 ) : filteredGroupedArray.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center' }}>Nenhuma cobrança encontrada com esses filtros.</td></tr>
                 ) : filteredGroupedArray.map(group => {
                   const cobrancaObj = group.cobranca;
                   const totalEnviados = group.destinatarios.length;
                   const totalPagos = group.destinatarios.filter((d: any) => d.status === 'CONFIRMED' || d.status === 'RECEIVED').length;
                   
                   return (
                     <tr key={group.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                       <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 600 }}>{cobrancaObj.titulo || 'Sem Título'}</div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                             <CreditCard size={12} color="#3b82f6"/> 
                             Criado via Comunicado
                          </div>
                       </td>
                       <td style={{ padding: '16px', textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{totalEnviados}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>famílias</div>
                       </td>
                       <td style={{ padding: '16px', fontWeight: 700 }}>R$ {(cobrancaObj.valor || 0).toFixed(2).replace('.', ',')}</td>
                       <td style={{ padding: '16px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                           <span style={{ fontWeight: 600, color: totalPagos === totalEnviados && totalEnviados > 0 ? '#10b981' : 'inherit' }}>
                             {totalPagos} / {totalEnviados}
                           </span>
                           {totalPagos > 0 && <span className="badge badge-success" style={{ transform: 'scale(0.8)' }}>Pagos</span>}
                         </div>
                         <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                            Venc: {cobrancaObj.vencimento ? new Date(cobrancaObj.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--'}
                         </div>
                       </td>
                       <td style={{ padding: '16px', textAlign: 'right' }}>
                          <button className="btn btn-secondary btn-sm" style={{borderColor: 'hsl(var(--border-subtle))'}} onClick={() => setSelectedGroupId(group.id)}>Detalhes</button>
                       </td>
                     </tr>
                   )
                 })}
               </tbody>
             </table>
           </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
             <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
             <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Integração Mensalidades</h3>
             <p>As {titulos?.length || 0} mensalidades ativas do ERP são sincronizadas automaticamente para o app da família.<br/>Você não precisa cobrar manualmente pelo app.</p>
          </div>
        )}
      </div>

      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedGroupId && (
          <motion.div 
            id="print-overlay"
            initial={{opacity: 0}} 
            animate={{opacity: 1}} 
            exit={{opacity: 0}} 
            style={{ 
              position: 'fixed', 
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)', 
              backdropFilter: 'blur(8px)', zIndex: 99999, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16
            }} 
          >
            <style>{`
              @media print {
                body, html { height: auto !important; overflow: visible !important; }
                body * { visibility: hidden !important; }
                #print-overlay, #print-overlay * { visibility: visible !important; }
                #print-overlay {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  display: block !important;
                  align-items: initial !important;
                  justify-content: initial !important;
                  padding: 0 !important;
                  background: none !important;
                  backdrop-filter: none !important;
                }
                #print-modal {
                  position: static !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  height: auto !important;
                  overflow: visible !important;
                  box-shadow: none !important;
                  transform: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  background: white !important;
                  display: block !important;
                }
                #print-modal-scroll {
                  overflow: visible !important;
                  max-height: none !important;
                  height: auto !important;
                  display: block !important;
                }
                .no-print, .no-print * { display: none !important; }
                table { page-break-inside: auto !important; width: 100% !important; }
                tr { page-break-inside: avoid !important; page-break-after: auto !important; }
                td, th { page-break-inside: avoid !important; }
              }
            `}</style>
            <motion.div 
              id="print-modal"
              initial={{ y: 30, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: 1000,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: '#ffffff', // Forçado branco para tirar a transparência no light mode
                borderRadius: 24,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                color: '#0f172a'
              }}
            >
              <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Detalhes da Cobrança</h3>
                    <p style={{ color: '#64748b', fontSize: 15, marginTop: 4 }}>
                      {groupedCharges[selectedGroupId]?.cobranca?.titulo}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} className="no-print">
                    <button 
                      onClick={() => window.print()}
                      style={{ background: 'rgba(59,130,246,0.1)', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3b82f6', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = '#3b82f6'; }}
                      title="Imprimir"
                    >
                      <Printer size={18} />
                    </button>
                    <button 
                      onClick={() => setSelectedGroupId(null)}
                      style={{ background: 'rgba(0,0,0,0.04)', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {(() => {
                  const selectedGroup = groupedCharges[selectedGroupId];
                  const valorUnitario = selectedGroup?.cobranca?.valor || 0;
                  const destinatarios = selectedGroup?.destinatarios || [];
                  const totalDestinatarios = destinatarios.length;
                  const totalPagos = destinatarios.filter((d: any) => d.status === 'CONFIRMED' || d.status === 'RECEIVED').length;
                  const totalAguardando = totalDestinatarios - totalPagos;
                  
                  const valorTotal = totalDestinatarios * valorUnitario;
                  const valorPago = totalPagos * valorUnitario;
                  const valorAberto = totalAguardando * valorUnitario;

                  return (
                    <div style={{ display: 'flex', gap: 20, marginTop: 24 }}>
                      <div style={{ flex: 1, padding: 16, background: 'rgba(59, 130, 246, 0.05)', borderRadius: 16, border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                        <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Valor Total</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>R$ {valorTotal.toFixed(2).replace('.', ',')}</div>
                      </div>
                      <div style={{ flex: 1, padding: 16, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 16, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                        <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Valor Pago</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#064e3b' }}>R$ {valorPago.toFixed(2).replace('.', ',')}</div>
                      </div>
                      <div style={{ flex: 1, padding: 16, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                        <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Em Aberto</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#7f1d1d' }}>R$ {valorAberto.toFixed(2).replace('.', ',')}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              <div className="no-print" style={{ padding: '16px 32px', background: '#f8fafc', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status:</span>
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 24 }}>
                    <button 
                      style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: filterModalStatus === 'ALL' ? '#fff' : 'transparent', color: filterModalStatus === 'ALL' ? '#0f172a' : '#64748b', boxShadow: filterModalStatus === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                      onClick={() => setFilterModalStatus('ALL')}
                    >
                      Todos
                    </button>
                    <button 
                      style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: filterModalStatus === 'PAID' ? '#10b981' : 'transparent', color: filterModalStatus === 'PAID' ? '#fff' : '#64748b', boxShadow: filterModalStatus === 'PAID' ? '0 2px 4px rgba(16,185,129,0.3)' : 'none', transition: 'all 0.2s' }}
                      onClick={() => setFilterModalStatus('PAID')}
                    >
                      Pagos
                    </button>
                    <button 
                      style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: filterModalStatus === 'PENDING' ? '#ef4444' : 'transparent', color: filterModalStatus === 'PENDING' ? '#fff' : '#64748b', boxShadow: filterModalStatus === 'PENDING' ? '0 2px 4px rgba(239,68,68,0.3)' : 'none', transition: 'all 0.2s' }}
                      onClick={() => setFilterModalStatus('PENDING')}
                    >
                      Aguardando
                    </button>
                  </div>
                </div>


                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    placeholder="Buscar aluno ou responsável..." 
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '8px 16px 8px 36px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.1)', outline: 'none', fontSize: 13, color: '#0f172a' }}
                  />
                </div>
              </div>

              <div id="print-modal-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                  <thead style={{ background: 'rgba(241, 245, 249, 0.5)' }}>
                    <tr>
                      <th style={{ padding: '16px 8px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>DESTINATÁRIO</th>
                      <th style={{ padding: '16px 8px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>PAGADOR LOGADO</th>
                      <th style={{ padding: '16px 8px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>ENVIADO EM</th>

                      <th style={{ padding: '16px 8px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>DATA PGTO.</th>
                      <th style={{ padding: '16px 8px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>STATUS ASAAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCharges[selectedGroupId]?.destinatarios
                      .filter((d: any) => {
                        const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED';
                        if (filterModalStatus === 'PAID' && !isPaid) return false;
                        if (filterModalStatus === 'PENDING' && isPaid) return false;
                        
                        if (modalSearchTerm.trim()) {
                          const term = modalSearchTerm.toLowerCase();
                          const nome = (d.destinatario_nome || d.destinatario_id).toLowerCase();
                          const turma = (alunosMap[d.destinatario_id] || (d.destinatario_nome ? alunosMap[d.destinatario_nome.trim()] : ''))?.toLowerCase() || '';
                          if (!nome.includes(term) && !turma.includes(term)) return false;
                        }
                        
                        return true;
                      })
                      .map((d: any) => {
                      const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED';
                      const payDate = isPaid ? new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR') : '--';
                      
                      const turmaNome = alunosMap[d.destinatario_id] || (d.destinatario_nome ? alunosMap[d.destinatario_nome.trim()] : undefined);

                      return (
                        <tr key={d.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.01)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '16px 8px', fontWeight: 600, color: '#0f172a', fontSize: 15 }}>
                            {d.destinatario_nome || d.destinatario_id}
                            {turmaNome && (
                              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
                                {turmaNome}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: 14, color: '#475569', fontWeight: 500 }}>
                            {d.pagador_usuario_nome ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <CheckCircle2 size={14} color="#10b981" />
                                  {d.pagador_usuario_nome}
                                </div>
                            ) : '--'}
                          </td>
                          <td style={{ padding: '16px 8px', fontSize: 14, color: '#64748b' }}>
                            {new Date(d.created_at).toLocaleDateString('pt-BR')}
                          </td>

                          <td style={{ padding: '16px 8px', fontSize: 14, color: isPaid ? '#10b981' : '#cbd5e1', fontWeight: isPaid ? 600 : 400 }}>
                            {payDate}
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                            {isPaid ? <span style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>Pago</span> : 
                             d.status === 'PENDING' ? <span style={{ padding: '6px 12px', background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>Aguardando</span> : 
                             <span style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{d.status}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
