'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Search, UserPlus, Filter, Clock, Calendar, CheckCircle2, AlertTriangle, Printer, BadgeIcon, Download, Info, HeartPulse } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'

type Funcionario = { id: string; nome: string; cpf: string; email: string; telefone: string; status: string; cargo: string; data_nascimento?: string; foto?: string }
type Ausencia = { id: string; funcionario_id: string; tipo: string; data_inicio: string; data_fim: string; status: string; motivo?: string }

export default function GestaoPessoasColaboradores() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [selectedFunc, setSelectedFunc] = useState<Funcionario | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isCrachaView, setIsCrachaView] = useState(false)
  const [checkins, setCheckins] = useState<any[]>([])
  const [loadingCheckins, setLoadingCheckins] = useState(false)
  const [expandedCheckins, setExpandedCheckins] = useState<string[]>([])

  const [isReportOpen, setIsReportOpen] = useState(false)
  const [reportCheckins, setReportCheckins] = useState<any[]>([])
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportPeriod, setReportPeriod] = useState('30d')
  const [reportRisk, setReportRisk] = useState('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/rh/funcionarios').then(res => res.ok ? res.json() : []),
      fetch('/api/rh/ausencias').then(res => res.ok ? res.json() : [])
    ]).then(([funcs, aus]) => {
      setFuncionarios(Array.isArray(funcs) ? funcs : [])
      setAusencias(Array.isArray(aus) ? aus : [])
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const filtered = funcionarios.filter(f => 
    f.nome?.toLowerCase().includes(busca.toLowerCase()) || 
    f.cpf?.includes(busca) || 
    f.cargo?.toLowerCase().includes(busca.toLowerCase())
  )

  const getAusenciasFuncionario = (id: string) => ausencias.filter(a => a.funcionario_id === id)
  const getStatusAusencia = (id: string) => {
    const aus = getAusenciasFuncionario(id)
    const hoje = new Date().toISOString().split('T')[0]
    const emAusencia = aus.find(a => a.data_inicio <= hoje && a.data_fim >= hoje && a.status !== 'recusado')
    
    if (emAusencia) {
      return (
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:100, background:'#fef3c7', color:'#d97706', fontSize:12, fontWeight:700 }}>
          <Clock size={14}/> {emAusencia.tipo} (até {new Date(emAusencia.data_fim).toLocaleDateString('pt-BR')})
        </span>
      )
    }
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:100, background:'#d1fae5', color:'#059669', fontSize:12, fontWeight:700 }}>
        <CheckCircle2 size={14}/> Ativo
      </span>
    )
  }

  const handleOpenDossie = (f: Funcionario) => {
    setSelectedFunc(f)
    setIsCrachaView(false)
    setIsPanelOpen(true)
    setLoadingCheckins(true)
    fetch(`/api/rh/funcionarios/${f.id}/checkins`)
      .then(r => r.json())
      .then(data => {
        setCheckins(Array.isArray(data) ? data : [])
        setLoadingCheckins(false)
      })
      .catch(() => setLoadingCheckins(false))
  }

  const handleOpenCracha = (f: Funcionario) => {
    setSelectedFunc(f)
    setIsCrachaView(true)
    setIsPanelOpen(true)
  }

  const handlePrintCracha = () => {
    // Abordagem simples para imprimir a div de crachá
    window.print()
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Colaboradores
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Base de dados unificada de funcionários, emissão de crachás e histórico de ausências.
          </p>
        </div>
        <button 
          onClick={async () => {
            setIsReportOpen(true)
            setLoadingReport(true)
            try {
              const res = await fetch('/api/rh/checkins/relatorio')
              const data = await res.json()
              if (data.success) {
                setReportCheckins(data.checkins || [])
              }
            } catch (err) {
              console.error(err)
            } finally {
              setLoadingReport(false)
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', background: '#fff', color: '#10b981',
            border: '2px solid #10b981', borderRadius: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#10b981' }}
        >
          <HeartPulse size={18} />
          Relatório de Bem-Estar
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }} />
        <input 
          type="text" 
          placeholder="Buscar por nome, cargo ou CPF..." 
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ 
            width: '100%', padding: '18px 20px 18px 54px', borderRadius: 16, background: '#ffffff', 
            border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 15, outline: 'none', transition: 'all 0.3s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.1)' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)' }}
        />
      </div>

      {/* Tabela */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 15 }}>Carregando dados unificados do ERP...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 15 }}>Nenhum colaborador encontrado.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Colaborador</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cargo / Setor</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status de Trabalho</th>
                  <th style={{ padding: '20px 24px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={f.id} style={{ borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #f1f5f9', transition: 'all 0.2s', background: '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {f.foto ? (
                          <img src={f.foto} alt={f.nome} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                            {f.nome?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{f.nome}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>CPF: {f.cpf || 'Não informado'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>{f.cargo || 'Não especificado'}</div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      {getStatusAusencia(f.id)}
                    </td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleOpenCracha(f)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0' }}
                        >
                          <BadgeIcon size={16} /> Crachá
                        </button>
                        <button 
                          onClick={() => handleOpenDossie(f)}
                          style={{ padding: '8px 16px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                        >
                          Ver Dossiê
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side Panel para Dossiê ou Crachá */}
      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={isCrachaView ? 'Emissão de Crachá' : 'Dossiê do Colaborador'}
        subtitle={selectedFunc?.nome}
        width={isCrachaView ? 400 : 600}
      >
        {selectedFunc && (
          isCrachaView ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
              <div style={{ width: '100%', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Visual do Crachá (ID Badge) */}
                <div id="cracha-print-area" style={{ 
                  width: 250, height: 400, background: '#fff', borderRadius: 16, overflow: 'hidden',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', position: 'relative'
                }}>
                  {/* Top Color Band */}
                  <div style={{ height: 80, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)' }}>
                      {selectedFunc.foto ? (
                        <img src={selectedFunc.foto} alt="Foto" style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #fff', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #fff', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 32, fontWeight: 900 }}>
                          {selectedFunc.nome.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Info Area */}
                  <div style={{ flex: 1, padding: '40px 20px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 4px', lineHeight: 1.2 }}>
                      {selectedFunc.nome}
                    </h3>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {selectedFunc.cargo || 'COLABORADOR'}
                    </p>
                    
                    <div style={{ marginTop: 'auto', background: '#f1f5f9', padding: '12px', borderRadius: 12 }}>
                      <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>ID DO SISTEMA</p>
                      <p style={{ fontSize: 11, color: '#0f172a', margin: 0, fontFamily: 'monospace', fontWeight: 600 }}>{selectedFunc.id.split('-')[0] || selectedFunc.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handlePrintCracha}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
              >
                <Printer size={18} /> Imprimir Crachá
              </button>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#eff6ff', padding: 16, borderRadius: 12 }}>
                <Info size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
                  Para impressão em cartões PVC, utilize as dimensões padrão CR80 (54mm x 86mm). O layout se ajustará na impressão.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {/* Profile Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {selectedFunc.foto ? (
                  <img src={selectedFunc.foto} alt="Foto" style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#fff' }}>
                    {selectedFunc.nome.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>{selectedFunc.nome}</h3>
                  <div style={{ display: 'inline-flex', padding: '4px 12px', background: '#f1f5f9', color: '#475569', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                    {selectedFunc.cargo || 'Cargo não definido'}
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>E-mail</div>
                  <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{selectedFunc.email || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Telefone</div>
                  <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{selectedFunc.telefone || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>CPF</div>
                  <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{selectedFunc.cpf || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Data Nasc.</div>
                  <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 500 }}>{selectedFunc.data_nascimento ? new Date(selectedFunc.data_nascimento).toLocaleDateString('pt-BR') : '-'}</div>
                </div>
              </div>

              {/* Ausências */}
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={18} /> Histórico de Ausências
                </h4>
                {getAusenciasFuncionario(selectedFunc.id).length === 0 ? (
                  <div style={{ padding: 24, background: '#f8fafc', borderRadius: 16, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    Nenhuma ausência ou férias registrada.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {getAusenciasFuncionario(selectedFunc.id).map(aus => {
                      const formatSafeDate = (dString: string) => {
                        if (!dString) return 'Data não informada'
                        if (dString.includes('/')) return dString // already formatted or brazilian format
                        const d = new Date(dString)
                        if (isNaN(d.getTime())) return dString // fallback to raw string
                        // For ISO strings like 'YYYY-MM-DD', UTC prevents day shifting
                        return dString.length === 10 ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : d.toLocaleDateString('pt-BR')
                      }
                      
                      return (
                      <div key={aus.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{aus.tipo}</strong>
                          <span style={{ fontSize: 12, fontWeight: 600, color: aus.status === 'aprovado' ? '#059669' : '#d97706', textTransform: 'uppercase' }}>{aus.status}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                          De {formatSafeDate(aus.data_inicio)} até {formatSafeDate(aus.data_fim)}
                        </div>
                        {aus.motivo && <div style={{ fontSize: 13, color: '#475569', marginTop: 8, background: '#f8fafc', padding: 8, borderRadius: 8 }}>{aus.motivo}</div>}
                      </div>
                    )})}
                  </div>
                )}
              </div>

              {/* Histórico de Bem-Estar */}
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HeartPulse size={18} color="#ef4444" /> Histórico de Bem-Estar
                </h4>
                {loadingCheckins ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 14 }}>Carregando...</div>
                ) : checkins.length === 0 ? (
                  <div style={{ padding: 24, background: '#f8fafc', borderRadius: 16, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    Nenhum check-in registrado.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {checkins.map(ck => {
                      const isExpanded = expandedCheckins.includes(ck.id)
                      
                      const getLabel = (qIndex: number, score: number) => {
                        const labels = ['Nada', 'Pouco', 'Médio', 'Muito', 'Totalmente']
                        let originalVal = score
                        if (qIndex === 3 || qIndex === 4) { // Ansiedade (3) e Sobrecarga (4)
                          originalVal = 6 - score
                        }
                        return labels[originalVal - 1] || 'Não respondeu'
                      }

                      return (
                      <div key={ck.id} 
                           onClick={() => setExpandedCheckins(prev => prev.includes(ck.id) ? prev.filter(id => id !== ck.id) : [...prev, ck.id])}
                           style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{ck.emocao_geral}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 100, 
                              background: ck.risco_burnout === 'Alto risco' ? '#fef2f2' : ck.risco_burnout === 'Atenção' ? '#fffbeb' : '#f0fdf4',
                              color: ck.risco_burnout === 'Alto risco' ? '#ef4444' : ck.risco_burnout === 'Atenção' ? '#d97706' : '#10b981' 
                            }}>
                              {ck.risco_burnout}
                            </span>
                            <span style={{ fontSize: 16, color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.3s' }}>▼</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          Respondido em: {new Date(ck.data_checkin).toLocaleDateString('pt-BR')} às {new Date(ck.data_checkin).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                        </div>
                        {ck.motivos && ck.motivos.length > 0 && (
                           <div style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>Motivos: {ck.motivos.join(', ')}</div>
                        )}
                        {ck.quer_conversar && (
                           <div style={{ marginTop: 8, padding: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                             🚨 Solicitou conversa ({ck.quer_conversar})
                           </div>
                        )}
                        
                        {/* Detalhes das Perguntas (Expandível) */}
                        {isExpanded && (
                          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed #e2e8f0', paddingBottom: 6 }}>
                              <span style={{ color: '#475569' }}>1. Estou dormindo bem?</span>
                              <strong style={{ color: '#0f172a' }}>{getLabel(1, ck.burnout_q1)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed #e2e8f0', paddingBottom: 6 }}>
                              <span style={{ color: '#475569' }}>2. Tenho energia para trabalhar?</span>
                              <strong style={{ color: '#0f172a' }}>{getLabel(2, ck.burnout_q2)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed #e2e8f0', paddingBottom: 6 }}>
                              <span style={{ color: '#475569' }}>3. Tenho sentido ansiedade?</span>
                              <strong style={{ color: '#0f172a' }}>{getLabel(3, ck.burnout_q3)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed #e2e8f0', paddingBottom: 6 }}>
                              <span style={{ color: '#475569' }}>4. Estou sobrecarregado?</span>
                              <strong style={{ color: '#0f172a' }}>{getLabel(4, ck.burnout_q4)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 6 }}>
                              <span style={{ color: '#475569' }}>5. Consigo descansar?</span>
                              <strong style={{ color: '#0f172a' }}>{getLabel(5, ck.burnout_q5)}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>

            </div>
          )
        )}
      </SidePanel>

      {/* Relatório SidePanel */}
      <SidePanel 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        title="Relatório Geral de Bem-Estar" 
        width={600}
      >
        <div style={{ padding: '24px 32px' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Período</label>
              <select 
                value={reportPeriod} 
                onChange={e => setReportPeriod(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', outline: 'none', background: '#fff' }}
              >
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="all">Todo o histórico</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Risco</label>
              <select 
                value={reportRisk} 
                onChange={e => setReportRisk(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', outline: 'none', background: '#fff' }}
              >
                <option value="all">Todos</option>
                <option value="Alto risco">Alto risco</option>
                <option value="Atenção">Atenção</option>
                <option value="Baixo risco">Baixo risco</option>
              </select>
            </div>
          </div>

          {loadingReport ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando dados...</div>
          ) : (
            <>
              {(() => {
                const now = new Date()
                const filtered = reportCheckins.filter(ck => {
                  if (reportRisk !== 'all' && ck.risco_burnout !== reportRisk) return false
                  if (reportPeriod !== 'all') {
                    const ckDate = new Date(ck.data_checkin)
                    const diffDays = (now.getTime() - ckDate.getTime()) / (1000 * 3600 * 24)
                    if (reportPeriod === '7d' && diffDays > 7) return false
                    if (reportPeriod === '30d' && diffDays > 30) return false
                  }
                  return true
                })

                const altoRiscoCount = filtered.filter(c => c.risco_burnout === 'Alto risco').length
                const atencaoCount = filtered.filter(c => c.risco_burnout === 'Atenção').length
                const coversaCount = filtered.filter(c => !!c.quer_conversar).length

                return (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
                      <div style={{ padding: 16, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{filtered.length}</div>
                      </div>
                      <div style={{ padding: 16, background: '#fef2f2', borderRadius: 16, border: '1px solid #fecaca' }}>
                        <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>Alto Risco</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#b91c1c' }}>{altoRiscoCount}</div>
                      </div>
                      <div style={{ padding: 16, background: '#fffbeb', borderRadius: 16, border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>Atenção / Papo</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#b45309' }}>{atencaoCount + coversaCount}</div>
                      </div>
                    </div>

                    {filtered.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, border: '1px dashed #cbd5e1', borderRadius: 16 }}>Nenhum check-in neste filtro.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {filtered.map(ck => (
                          <div key={ck.id} style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <strong style={{ fontSize: 15, color: '#0f172a' }}>{ck.colaborador_nome}</strong>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 100, 
                                background: ck.risco_burnout === 'Alto risco' ? '#fef2f2' : ck.risco_burnout === 'Atenção' ? '#fffbeb' : '#f0fdf4',
                                color: ck.risco_burnout === 'Alto risco' ? '#ef4444' : ck.risco_burnout === 'Atenção' ? '#d97706' : '#10b981' 
                              }}>
                                {ck.risco_burnout}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{ck.colaborador_cargo}</div>
                            
                            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                              {new Date(ck.data_checkin).toLocaleDateString('pt-BR')} às {new Date(ck.data_checkin).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                            </div>
                            
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 12, background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 8 }}>
                                Emoção: {ck.emocao_geral}
                              </div>
                              {ck.motivos?.length > 0 && (
                                <div style={{ fontSize: 12, background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 8 }}>
                                  Motivos: {ck.motivos.join(', ')}
                                </div>
                              )}
                            </div>
                            
                            {ck.quer_conversar && (
                              <div style={{ marginTop: 12, fontSize: 13, color: '#ef4444', fontWeight: 600, background: '#fef2f2', padding: 10, borderRadius: 8, border: '1px solid #fecaca' }}>
                                🚨 Solicitou conversa ({ck.quer_conversar})
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </SidePanel>

      {/* Global Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #cracha-print-area, #cracha-print-area * { visibility: visible; }
          #cracha-print-area { position: absolute; left: 0; top: 0; box-shadow: none !important; border: 1px solid #000; }
        }
      `}} />
    </div>
  )
}
