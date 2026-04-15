'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useData } from '@/lib/dataContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useApiQuery } from '@/hooks/useApi'

import { useState, useMemo } from 'react'
import { AlertTriangle, Phone, Mail, MessageSquare, Brain, Send, CheckCircle, Search, Filter, X, TrendingUp, RefreshCw } from 'lucide-react'

export default function InadimplenciaPage() {
  const { data: kpiData, isLoading: loadKpis } = useApiQuery<any>(
    ['dashboard-kpis', 'real'],
    `/api/financeiro/dashboard?mes=real&mesPrev=real`,
    { keepPreviousData: true }
  )
  const taxaInadimpl = kpiData?.inadimplenciaRate ? kpiData.inadimplenciaRate.toFixed(1) : '0.0'

  const { data: listData, isLoading: loadTitulos } = useApiQuery<any>(
    ['inadimplentes'],
    `/api/titulos?status=atrasado&limit=5000`
  )
  const inadimplentes = listData?.data || []
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos') // for local optimistic updates

  const isLoading = loadKpis || loadTitulos
  const [search, setSearch] = useState('')
  const [filtroRisco, setFiltroRisco] = useState<'todos'|'alto'|'medio'|'baixo'>('todos')
  const [filtroMin, setFiltroMin] = useState('')
  const [filtroMax, setFiltroMax] = useState('')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<string|null>(null)
  const [showNeg, setShowNeg] = useState<string|null>(null)
  const [negDesc, setNegDesc] = useState('')
  const [negDesconto, setNegDesconto] = useState('0')
  const [negParcelas, setNegParcelas] = useState('3')

  const getRisco = (dias: number) => dias > 60 ? 'alto' : dias > 30 ? 'medio' : 'baixo'

  const filtered = useMemo(() => inadimplentes.filter((t: any) => {
    const diasAtraso = Math.ceil((Date.now()-new Date(t.vencimento).getTime())/86400000)
    const risco = getRisco(diasAtraso)
    const q = search.toLowerCase()
  const searchActive = search.trim().length >= 3
    const matchSearch = !searchActive || (t.aluno.toLowerCase().includes(q) || t.responsavel.toLowerCase().includes(q) || t.descricao.toLowerCase().includes(q))
    const matchRisco = filtroRisco === 'todos' || risco === filtroRisco
    const matchMin = !filtroMin || t.valor >= parseFloat(filtroMin)
    const matchMax = !filtroMax || t.valor <= parseFloat(filtroMax)
    const matchDe = !filtroDataDe || t.vencimento >= filtroDataDe
    const matchAte = !filtroDataAte || t.vencimento <= filtroDataAte
    return matchSearch && matchRisco && matchMin && matchMax && matchDe && matchAte
  }), [inadimplentes, search, filtroRisco, filtroMin, filtroMax, filtroDataDe, filtroDataAte])

  const totalAtrasado = inadimplentes.reduce((s: number,t: any)=>s+t.valor,0)
  const totalFiltrado = filtered.reduce((s: number,t: any)=>s+t.valor,0)
  const altoRisco = inadimplentes.filter((t: any)=>{const d=Math.ceil((Date.now()-new Date(t.vencimento).getTime())/86400000);return d>60}).length
  const medioRisco = inadimplentes.filter((t: any)=>{const d=Math.ceil((Date.now()-new Date(t.vencimento).getTime())/86400000);return d>30&&d<=60}).length

  const activeFilters = [filtroRisco!=='todos', !!filtroMin, !!filtroMax, !!filtroDataDe, !!filtroDataAte].filter(Boolean).length
  const clearFilters = () => { setFiltroRisco('todos'); setFiltroMin(''); setFiltroMax(''); setFiltroDataDe(''); setFiltroDataAte(''); setSearch('') }

  const RISCO_CFG = {
    alto:  { badge:'badge-danger',  label:'⚠ Alto risco', color:'#ef4444' },
    medio: { badge:'badge-warning', label:'⚡ Risco médio', color:'#f59e0b' },
    baixo: { badge:'badge-success', label:'✓ Baixo risco', color:'#10b981' },
  }

  const marcarPago = (id: string) => {
    setTitulos((prev: any[]) => prev.map(t => t.id === id ? { ...t, status:'pago', pagamento:new Date().toISOString().slice(0,10), metodo:'PIX' } : t))
  }

  const salvarRenegociacao = (tituloId: string) => {
    const titulo = titulos.find((t: any)=>t.id===tituloId)
    if (!titulo) return
    const novoValor = titulo.valor * (1 - parseFloat(negDesconto)/100)
    setTitulos((prev: any[]) => prev.map(t => t.id === tituloId ? { ...t, valor:novoValor, descricao:`${titulo.descricao} [Reneg. ${negParcelas}x]`, status:'pendente' } : t))
    setShowNeg(null)
    setNegDesconto('0'); setNegParcelas('3')
  }

  const RGUA = [
    { dia:1,  acao:'Email automático de lembrete', canal:'Email',     status:'executado' },
    { dia:3,  acao:'WhatsApp automático', canal:'WhatsApp',           status:'executado' },
    { dia:7,  acao:'Ligação equipe financeira', canal:'Telefone',     status:'pendente' },
    { dia:15, acao:'Carta de notificação formal', canal:'Carta',      status:'pendente' },
    { dia:30, acao:'Proposta de renegociação', canal:'Meeting',       status:'pendente' },
    { dia:60, acao:'Protocolo jurídico', canal:'Jurídico',            status:'pendente' },
  ]

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(239,68,68,0.2)', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Carregando dados de inadimplência...</div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestão de Inadimplência</h1>
          <p className="page-subtitle">{inadimplentes.length} títulos em atraso • Taxa: <strong style={{color:'#ef4444'}}>{taxaInadimpl}%</strong></p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-secondary btn-sm"><Brain size={13}/>Régua IA</button>
          <button className="btn btn-primary btn-sm"><Send size={13}/>Acionar Todos</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20}}>
        {[
          { label:'Total em Atraso', value:formatCurrency(totalAtrasado), color:'#ef4444', icon:'⚠️', sub:`${inadimplentes.length} títulos` },
          { label:'Alto Risco (>60d)', value:altoRisco, color:'#f87171', icon:'🔴', sub:'protocolo jurídico' },
          { label:'Médio Risco (30-60d)', value:medioRisco, color:'#f59e0b', icon:'🟡', sub:'negociação ativa' },
          { label:'Taxa Inadimpl.', value:`${taxaInadimpl}%`, color:'#ef4444', icon:'📉', sub:'sobre carteira' },
          { label:'Filtrados', value:formatCurrency(totalFiltrado), color:'#8b5cf6', icon:'🔍', sub:`${filtered.length} títulos` },
        ].map(c=>(
          <div key={c.label} className="kpi-card">
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
              <span style={{fontSize:16}}>{c.icon}</span>
              <span style={{fontSize:11, color:'hsl(var(--text-muted))'}}>{c.label}</span>
            </div>
            <div style={{fontSize:typeof c.value==='string'&&c.value.includes('R$')?14:22, fontWeight:800, color:c.color, fontFamily:'Outfit,sans-serif'}}>{c.value}</div>
            <div style={{fontSize:10, color:'hsl(var(--text-muted))', marginTop:3}}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex', gap:10, marginBottom:12, alignItems:'center', flexWrap:'wrap'}}>
        <div className="tab-list">
          {([['todos','Todos'],['alto','Alto (>60d)'],['medio','Médio (30-60d)'],['baixo','Baixo (<30d)']] as const).map(([v,l])=>(
            <button key={v} className={`tab-trigger ${filtroRisco===v?'active':''}`} onClick={()=>setFiltroRisco(v)}>{l}</button>
          ))}
        </div>
        <div style={{position:'relative', flex:1, minWidth:180}}>
          <Search size={13} style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))'}}/>
          <input className="form-input" style={{paddingLeft:36}} placeholder="Buscar aluno ou responsável..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <button className={`btn btn-sm ${showFilters?'btn-primary':'btn-secondary'}`} onClick={()=>setShowFilters(p=>!p)}>
          <Filter size={13}/>Filtros {activeFilters>0&&<span style={{background:'#ef4444',borderRadius:'50%',width:16,height:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800}}>{activeFilters}</span>}
        </button>
        {(activeFilters>0||search)&&<button className="btn btn-ghost btn-sm" style={{color:'#f87171'}} onClick={clearFilters}><X size={12}/>Limpar</button>}
      </div>

      {showFilters && (
        <div style={{display:'flex', gap:12, marginBottom:14, padding:'14px', background:'hsl(var(--bg-elevated))', borderRadius:10, flexWrap:'wrap', border:'1px solid hsl(var(--border-subtle))'}}>
          <div>
            <label className="form-label" style={{fontSize:10}}>Valor mínimo (R$)</label>
            <input type="number" className="form-input" style={{width:130, fontSize:12}} placeholder="0" value={filtroMin} onChange={e=>setFiltroMin(e.target.value)}/>
          </div>
          <div>
            <label className="form-label" style={{fontSize:10}}>Valor máximo (R$)</label>
            <input type="number" className="form-input" style={{width:130, fontSize:12}} placeholder="∞" value={filtroMax} onChange={e=>setFiltroMax(e.target.value)}/>
          </div>
          <div>
            <label className="form-label" style={{fontSize:10}}>Vencimento de</label>
            <input type="date" className="form-input" style={{width:145, fontSize:12}} value={filtroDataDe} onChange={e=>setFiltroDataDe(e.target.value)}/>
          </div>
          <div>
            <label className="form-label" style={{fontSize:10}}>Vencimento até</label>
            <input type="date" className="form-input" style={{width:145, fontSize:12}} value={filtroDataAte} onChange={e=>setFiltroDataAte(e.target.value)}/>
          </div>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:16}}>
        {/* Tabela principal */}
        <div>
          {inadimplentes.length === 0 ? (
            <div className="card" style={{padding:'48px', textAlign:'center', color:'hsl(var(--text-muted))'}}>
              <TrendingUp size={40} style={{margin:'0 auto 14px', opacity:0.2}}/>
              <div style={{fontSize:15, fontWeight:600, marginBottom:8}}>Sem inadimplências! 🎉</div>
              <div style={{fontSize:13}}>Todos os títulos estão em dia.</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Aluno / Responsável</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Atraso</th><th>Risco</th><th>Ações Cobrança</th></tr>
                </thead>
                <tbody>
                  {filtered.map((t: any) => {
                    const diasAtraso = Math.ceil((Date.now()-new Date(t.vencimento).getTime())/86400000)
                    const risco = getRisco(diasAtraso)
                    const rc = RISCO_CFG[risco]
                    return (
                      <tr key={t.id} onClick={()=>setSelected(t.id)} style={{cursor:'pointer', background:selected===t.id?'rgba(59,130,246,0.06)':undefined}}>
                        <td>
                          <div style={{fontWeight:600, fontSize:13}}>{t.aluno}</div>
                          <div style={{fontSize:11, color:'hsl(var(--text-muted))'}}>{t.responsavel}</div>
                        </td>
                        <td style={{fontSize:12}}>{t.descricao}</td>
                        <td style={{fontWeight:700, color:'#f87171', fontSize:14}}>{formatCurrency(t.valor)}</td>
                        <td style={{fontSize:12}}>{formatDate(t.vencimento)}</td>
                        <td><span style={{fontSize:13, fontWeight:700, color:diasAtraso>30?'#f87171':'#fbbf24'}}>{diasAtraso}d</span></td>
                        <td><span className={`badge ${rc.badge}`}>{rc.label}</span></td>
                        <td>
                          <div style={{display:'flex', gap:4}}>
                            <button className="btn btn-ghost btn-icon btn-sm" title="Ligar"><Phone size={11}/></button>
                            <button className="btn btn-ghost btn-icon btn-sm" title="WhatsApp"><MessageSquare size={11}/></button>
                            <button className="btn btn-success btn-sm" style={{fontSize:10, padding:'3px 8px'}} onClick={e=>{e.stopPropagation();marcarPago(t.id)}} title="Confirmar pagamento">
                              <CheckCircle size={10}/>Pago
                            </button>
                            <button className="btn btn-danger btn-sm" style={{fontSize:10, padding:'3px 8px'}} onClick={e=>{e.stopPropagation();setShowNeg(t.id)}} title="Renegociar">
                              <RefreshCw size={10}/>Reneg.
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length===0&&<div style={{padding:'24px', textAlign:'center', fontSize:13, color:'hsl(var(--text-muted))'}}>Nenhum resultado para os filtros</div>}
              <div style={{padding:'10px 16px', borderTop:'1px solid hsl(var(--border-subtle))', fontSize:12, color:'hsl(var(--text-muted))', display:'flex', justifyContent:'space-between'}}>
                <span>{filtered.length} de {inadimplentes.length} inadimplentes</span>
                <span style={{fontWeight:700, color:'#f87171'}}>{formatCurrency(totalFiltrado)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Régua + IA */}
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="card" style={{padding:'20px'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:16}}>
              <Brain size={16} color="#a78bfa"/>
              <div style={{fontWeight:700, fontSize:14}}>Régua de Cobrança Automática</div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {RGUA.map((step,i)=>(
                <div key={i} style={{display:'flex', gap:10, alignItems:'flex-start'}}>
                  <div style={{width:28, height:28, borderRadius:'50%', background:step.status==='executado'?'rgba(16,185,129,0.2)':'hsl(var(--bg-elevated))', border:`2px solid ${step.status==='executado'?'#10b981':'hsl(var(--border-default))'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:700, color:step.status==='executado'?'#10b981':'hsl(var(--text-muted))'}}>
                    {step.status==='executado'?<CheckCircle size={14}/>:step.dia}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12, fontWeight:600, color:'hsl(var(--text-primary))'}}>D+{step.dia}: {step.acao}</div>
                    <div style={{fontSize:11, color:'hsl(var(--text-muted))'}}>{step.canal} {step.status==='executado'?'✓ Executado':'• Aguardando'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ia-card" style={{padding:'14px 16px'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <Brain size={14} color="#a78bfa"/>
              <span style={{fontSize:13, fontWeight:700}}>Insight IA — Inadimplência</span>
            </div>
            <div style={{fontSize:12, color:'hsl(var(--text-secondary))', lineHeight:1.5}}>
              {altoRisco > 0 ? `${altoRisco} aluno(s) com mais de 60 dias de atraso apresentam alto risco de evasão combinado. Priorize contato presencial e proposta de acordo com desconto para este grupo.` : 'Nenhum caso de alto risco no momento. Mantenha a régua de cobrança ativa para os títulos de médio risco.'}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Renegociação */}
      {showNeg && (()=>{
        const titulo = titulos.find(t=>t.id===showNeg)
        if (!titulo) return null
        const valorComDesconto = titulo.valor*(1-parseFloat(negDesconto||'0')/100)
        const parcela = valorComDesconto/parseInt(negParcelas||'1')
        return (
          <div className="modal-overlay" onClick={()=>setShowNeg(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()} style={{padding:'24px', maxWidth:460}}>
              <h2 style={{fontSize:18, fontWeight:700, marginBottom:4}}>Proposta de Renegociação</h2>
              <p style={{fontSize:13, color:'hsl(var(--text-muted))', marginBottom:20}}>{titulo.aluno} — {titulo.descricao}</p>
              <div style={{display:'flex', flexDirection:'column', gap:14}}>
                <div><label className="form-label">Valor Original</label><input className="form-input" value={formatCurrency(titulo.valor)} readOnly style={{color:'#f87171', fontWeight:700}}/></div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div>
                    <label className="form-label">Desconto (%)</label>
                    <input className="form-input" type="number" min={0} max={100} value={negDesconto} onChange={e=>setNegDesconto(e.target.value)} placeholder="Ex: 10"/>
                  </div>
                  <div>
                    <label className="form-label">Nº de Parcelas</label>
                    <select className="form-input" value={negParcelas} onChange={e=>setNegParcelas(e.target.value)}>
                      <option value="1">À vista</option>
                      <option value="2">2x</option>
                      <option value="3">3x</option>
                      <option value="6">6x</option>
                      <option value="12">12x</option>
                    </select>
                  </div>
                </div>
                <div style={{padding:'12px 16px', background:'rgba(16,185,129,0.08)', borderRadius:10, border:'1px solid rgba(16,185,129,0.2)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                    <span style={{fontSize:12, color:'hsl(var(--text-muted))'}}>Valor negociado:</span>
                    <span style={{fontWeight:800, color:'#10b981'}}>{formatCurrency(valorComDesconto)}</span>
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span style={{fontSize:12, color:'hsl(var(--text-muted))'}}>Parcela de:</span>
                    <span style={{fontWeight:800, color:'#60a5fa'}}>{formatCurrency(parcela)} x{negParcelas}</span>
                  </div>
                </div>
                <div><label className="form-label">Observação</label><textarea className="form-input" rows={2} value={negDesc} onChange={e=>setNegDesc(e.target.value)} placeholder="Motivo ou condições especiais da renegociação..."/></div>
                <div style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
                  <button className="btn btn-secondary" onClick={()=>setShowNeg(null)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={()=>salvarRenegociacao(showNeg!)}>Salvar Renegociação</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
