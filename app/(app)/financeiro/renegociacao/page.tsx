'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
﻿

import { useState, useMemo } from 'react'
import { useData, newId } from '@/lib/dataContext'
import { RefreshCw, Plus, X, Trash2, DollarSign, FileText, CheckCircle, Search, Filter, TrendingDown } from 'lucide-react'

interface AcordoRenegociacao {
  id: string; alunoNome: string; responsavel: string
  valorOriginal: number; valorNegociado: number; desconto: number
  parcelas: number; data: string
  status: 'ativo'|'quitado'|'inadimplente'; obs: string
  motivoInadimpl?: string
}

function getToday() { return new Date().toISOString().slice(0,10) }
function fmt(d: string) { if(!d) return '—'; const [y,m,dia]=d.split('-'); return `${dia}/${m}/${y}` }
const fmtCur = (v: number) => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

const MOTIVOS = ['Desemprego','Doença','Esquecimento','Dificuldade financeira','Mudança de cidade','Outros']
const STATUS_BADGE = {
  ativo:        { bg:'rgba(6,182,212,0.15)', cor:'#06b6d4',  label:'● Ativo' },
  quitado:      { bg:'rgba(16,185,129,0.15)', cor:'#10b981', label:'✓ Quitado' },
  inadimplente: { bg:'rgba(239,68,68,0.15)', cor:'#ef4444',  label:'⚠ Inadimplente' },
}

export default function RenegociacaoPage() {
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');
  const [acordos, setAcordos] = useState<AcordoRenegociacao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<'todos'|'ativo'|'quitado'|'inadimplente'>('todos')
  const [search, setSearch] = useState('')
  const [filtroMotivo, setFiltroMotivo] = useState('Todos')
  const [showFilters, setShowFilters] = useState(false)
  // Busca de aluno no modal
  const [buscaAluno, setBuscaAluno] = useState('')
  const [showAlunoDropdown, setShowAlunoDropdown] = useState(false)
  const [form, setForm] = useState({
    alunoNome:'', responsavel:'', valorOriginal:'', valorNegociado:'',
    desconto:'0', parcelas:'3', data:getToday(), status:'ativo' as AcordoRenegociacao['status'],
    obs:'', motivoInadimpl:'Dificuldade financeira',
  })

  const inadimplentes = alunos.filter(a=>a.inadimplente)
  const titulosAtrasados = titulos.filter(t=>t.status==='atrasado')

  // Quando seleciona aluno, preenche valor original e responsável automaticamente
  const handleSelectAluno = (nome: string) => {
    const aluno = alunos.find(a => a.nome === nome)
    const titulo = titulosAtrasados.find(t => t.aluno === nome)
    const valorOrig = titulo?.valor || 0
    setForm(f => ({
      ...f, alunoNome: nome,
      responsavel: aluno?.responsavel || titulo?.responsavel || '',
      valorOriginal: String(valorOrig),
      valorNegociado: String((valorOrig * 0.9).toFixed(2)),
      desconto: '10'
    }))
    setBuscaAluno(nome)
    setShowAlunoDropdown(false)
  }

  const handleDescontoChange = (desc: string) => {
    const orig = parseFloat(form.valorOriginal)||0
    const descNum = parseFloat(desc)||0
    setForm(f=>({...f, desconto:desc, valorNegociado:((orig*(1-descNum/100)).toFixed(2))}))
  }

  const handleValorNegChange = (val: string) => {
    const orig = parseFloat(form.valorOriginal)||0
    const negNum = parseFloat(val)||0
    const desc = orig>0?((1-negNum/orig)*100).toFixed(1):'0'
    setForm(f=>({...f, valorNegociado:val, desconto:desc}))
  }

  function handleSave() {
    if(!form.alunoNome) return
    const novo: AcordoRenegociacao = {
      id:newId('RNG'), ...form,
      valorOriginal: parseFloat(form.valorOriginal)||0,
      valorNegociado: parseFloat(form.valorNegociado)||0,
      desconto: parseFloat(form.desconto)||0,
      parcelas: parseInt(form.parcelas)||1,
      motivoInadimpl: form.motivoInadimpl,
    }
    setAcordos(prev=>[novo,...prev])
    setBuscaAluno('')
    // Atualiza título para pendente se existia
    const titulo = titulosAtrasados.find(t=>t.aluno===form.alunoNome)
    if(titulo){
      setTitulos(prev=>prev.map(t=>t.id===titulo.id?{...t, valor:novo.valorNegociado, status:'pendente', descricao:`${t.descricao} [Reneg. ${form.parcelas}x]`}:t))
    }
    setShowModal(false)
    setForm({alunoNome:'',responsavel:'',valorOriginal:'',valorNegociado:'',desconto:'0',parcelas:'3',data:getToday(),status:'ativo',obs:'',motivoInadimpl:'Dificuldade financeira'})
  }

  const filtered = useMemo(() => acordos.filter(a=>{
    const matchStatus = filtroStatus==='todos' || a.status===filtroStatus
    const matchSearch = search.trim().length < 3 || (!search || a.alunoNome.toLowerCase().includes(search.toLowerCase()) || a.responsavel.toLowerCase().includes(search.toLowerCase()))
    const matchMotivo = filtroMotivo==='Todos' || a.motivoInadimpl===filtroMotivo
    return matchStatus && matchSearch && matchMotivo
  }), [acordos, filtroStatus, search, filtroMotivo])

  const totalNegociado = acordos.reduce((s,a)=>s+a.valorNegociado,0)
  const totalOriginal = acordos.reduce((s,a)=>s+a.valorOriginal,0)
  const totalDesconto = totalOriginal - totalNegociado
  const taxaQuitacao = acordos.length>0?((acordos.filter(a=>a.status==='quitado').length/acordos.length)*100).toFixed(0):'0'

  const activeFilters = [filtroStatus!=='todos', filtroMotivo!=='Todos'].filter(Boolean).length
  const clearFilters = () => { setFiltroStatus('todos'); setFiltroMotivo('Todos'); setSearch('') }

  const valorOrig = parseFloat(form.valorOriginal)||0
  const valorNeg = parseFloat(form.valorNegociado)||validarParc(form)
  const parcV = valorNeg/(parseInt(form.parcelas)||1)

  function validarParc(_: typeof form) { return 0 }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Renegociação de Dívidas</h1>
          <p className="page-subtitle">Acordos e parcelamentos com responsáveis inadimplentes</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setShowFilters(p=>!p)}><Filter size={13}/>Filtros {activeFilters>0&&`(${activeFilters})`}</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowModal(true)}><Plus size={13}/>Novo Acordo</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20}}>
        {[
          { label:'Acordos Ativos', value:acordos.filter(a=>a.status==='ativo').length, color:'#06b6d4', icon:'📋' },
          { label:'Quitados', value:acordos.filter(a=>a.status==='quitado').length, color:'#10b981', icon:'✅' },
          { label:'Inadimpl. Base', value:inadimplentes.length, color:'#ef4444', icon:'⚠️', sub:'alunos' },
          { label:'Total Negociado', value:fmtCur(totalNegociado), color:'#f59e0b', icon:'💰' },
          { label:'Desconto Concedido', value:fmtCur(totalDesconto), color:'#8b5cf6', icon:'🎯', sub:`Taxa quitação ${taxaQuitacao}%` },
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><span style={{fontSize:16}}>{k.icon}</span><span style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{k.label}</span></div>
            <div style={{fontSize:typeof k.value==='string'?13:22, fontWeight:800, color:k.color, fontFamily:'Outfit,sans-serif'}}>{k.value}</div>
            {'sub' in k && k.sub && <div style={{fontSize:10, color:'hsl(var(--text-muted))', marginTop:3}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Alerta inadimplentes */}
      {inadimplentes.length>0&&acordos.length===0&&(
        <div style={{padding:'12px 16px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:10,marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
          <TrendingDown size={16} color="#f59e0b"/>
          <span style={{fontSize:13,color:'hsl(var(--text-secondary))'}}>
            Há <strong style={{color:'#fbbf24'}}>{inadimplentes.length} aluno(s) inadimplente(s)</strong> com títulos vencidos. Crie acordos para regularizar a situação.
          </span>
        </div>
      )}

      {/* Filtros */}
      <div style={{display:'flex', gap:10, marginBottom:12, alignItems:'center', flexWrap:'wrap'}}>
        <div className="tab-list">
          {([['todos','Todos'],['ativo','Ativos'],['quitado','Quitados'],['inadimplente','Inadimp.']] as const).map(([v,l])=>(
            <button key={v} className={`tab-trigger ${filtroStatus===v?'active':''}`} onClick={()=>setFiltroStatus(v)}>{l}</button>
          ))}
        </div>
        <div style={{position:'relative',flex:1,minWidth:180}}>
          <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'hsl(var(--text-muted))'}}/>
          <input className="form-input" style={{paddingLeft:36}} placeholder="Buscar aluno ou responsável..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {(activeFilters>0||search)&&<button className="btn btn-ghost btn-sm" style={{color:'#f87171'}} onClick={clearFilters}><X size={12}/>Limpar</button>}
      </div>

      {showFilters && (
        <div style={{display:'flex',gap:10,marginBottom:14,padding:'14px',background:'hsl(var(--bg-elevated))',borderRadius:10,flexWrap:'wrap',border:'1px solid hsl(var(--border-subtle))'}}>
          <div>
            <label className="form-label" style={{fontSize:10}}>Motivo</label>
            <select className="form-input" style={{minWidth:180, fontSize:12}} value={filtroMotivo} onChange={e=>setFiltroMotivo(e.target.value)}>
              <option value="Todos">Todos os motivos</option>
              {MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Lista */}
      {acordos.length===0 ? (
        <div className="card" style={{padding:'60px 40px',textAlign:'center',color:'hsl(var(--text-muted))'}}>
          <RefreshCw size={44} style={{opacity:0.15,marginBottom:16}}/>
          <div style={{fontSize:15,fontWeight:600,marginBottom:8}}>Nenhum acordo cadastrado</div>
          <div style={{fontSize:13,marginBottom:20}}>Registre acordos de renegociação com responsáveis inadimplentes.</div>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Plus size={14}/>Novo Acordo</button>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtered.map(a=>{
            const badge = STATUS_BADGE[a.status]
            const parcV = a.valorNegociado/a.parcelas
            return (
              <div key={a.id} className="card" style={{padding:'16px 20px',display:'flex',alignItems:'center',gap:16}}>
                <div style={{width:44,height:44,borderRadius:12,background:'rgba(245,158,11,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <FileText size={20} color="#f59e0b"/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <span style={{fontWeight:700,fontSize:14}}>{a.alunoNome}</span>
                    <span style={{padding:'2px 7px',borderRadius:5,fontSize:11,fontWeight:700,background:badge.bg,color:badge.cor}}>{badge.label}</span>
                    {a.motivoInadimpl&&<span style={{fontSize:11,color:'hsl(var(--text-muted))'}}>— {a.motivoInadimpl}</span>}
                  </div>
                  <div style={{fontSize:12,color:'hsl(var(--text-muted))',marginTop:4,display:'flex',gap:12,flexWrap:'wrap'}}>
                    <span>👤 {a.responsavel||'—'}</span>
                    <span>📅 {fmt(a.data)}</span>
                    <span>📋 {a.parcelas}x de {fmtCur(parcV)}</span>
                    {a.desconto>0&&<span style={{color:'#10b981',fontWeight:700}}>🎯 {a.desconto}% desconto</span>}
                  </div>
                  {a.obs&&<div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:3,fontStyle:'italic'}}>{a.obs}</div>}
                </div>
                <div style={{textAlign:'right',marginRight:8,flexShrink:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:'#10b981'}}>{fmtCur(a.valorNegociado)}</div>
                  {a.desconto>0&&<div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>era {fmtCur(a.valorOriginal)}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  {a.status==='ativo'&&(
                    <button className="btn btn-success btn-sm" style={{fontSize:11}} onClick={()=>setAcordos(prev=>prev.map(x=>x.id===a.id?{...x,status:'quitado'}:x))}>
                      <CheckCircle size={11}/>Quitar
                    </button>
                  )}
                  <button onClick={()=>setAcordos(prev=>prev.filter(x=>x.id!==a.id))} className="btn btn-ghost btn-icon btn-sm" style={{color:'#f87171'}}><Trash2 size={14}/></button>
                </div>
              </div>
            )
          })}
          {filtered.length===0&&acordos.length>0&&<div className="card" style={{padding:'28px',textAlign:'center',color:'hsl(var(--text-muted))',fontSize:13}}>Nenhum acordo com esses filtros</div>}
        </div>
      )}

      {/* Modal */}
      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(6px)',padding:24}}>
          <div style={{background:'hsl(var(--bg-elevated))',border:'1px solid rgba(245,158,11,0.3)',borderRadius:20,padding:28,width:'100%',maxWidth:520,boxShadow:'0 24px 80px rgba(0,0,0,0.5)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
              <div>
                <div style={{fontWeight:800,fontSize:17}}>Novo Acordo de Renegociação</div>
                <div style={{fontSize:12,color:'hsl(var(--text-muted))',marginTop:2}}>Defina os termos do acordo com o responsável</div>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'hsl(var(--text-muted))' }}><X size={20}/></button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{ position: 'relative' }}>
                <label className="form-label">Aluno *</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 34 }}
                    placeholder="Buscar aluno pelo nome..."
                    value={buscaAluno}
                    onChange={e => { setBuscaAluno(e.target.value); setShowAlunoDropdown(true); if(!e.target.value) setForm(f=>({...f,alunoNome:'',responsavel:''})) }}
                    onFocus={() => setShowAlunoDropdown(true)}
                    autoComplete="off"
                  />
                  {form.alunoNome && (
                    <button onClick={() => { setBuscaAluno(''); setForm(f=>({...f,alunoNome:'',responsavel:''})); setShowAlunoDropdown(false) }}
                      style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'hsl(var(--text-muted))', padding:2 }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                {showAlunoDropdown && buscaAluno.length >= 1 && (() => {
                  const matches = alunos.filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())).slice(0, 8)
                  if (matches.length === 0) return (
                    <div style={{ position:'absolute', zIndex:50, width:'100%', background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))', borderRadius:8, padding:'10px 14px', fontSize:12, color:'hsl(var(--text-muted))', marginTop:3, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                      Nenhum aluno encontrado
                    </div>
                  )
                  return (
                    <div style={{ position:'absolute', zIndex:50, width:'100%', background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))', borderRadius:10, overflow:'hidden', marginTop:3, boxShadow:'0 12px 32px rgba(0,0,0,0.4)' }}>
                      {matches.map(a => (
                        <button key={a.id} type="button"
                          onMouseDown={() => handleSelectAluno(a.nome)}
                          style={{ width:'100%', padding:'9px 14px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10, transition:'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ width:30, height:30, borderRadius:'50%', background: a.inadimplente ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color: a.inadimplente ? '#f87171' : '#818cf8', flexShrink:0 }}>
                            {a.nome.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                              {a.nome}
                              {a.inadimplente && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'#f87171', fontWeight:800 }}>INAD.</span>}
                            </div>
                            <div style={{ fontSize:10, color:'hsl(var(--text-muted))' }}>{a.turma} • {a.responsavel}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <div>
                <label className="form-label">Responsável Financeiro</label>
                <input value={form.responsavel} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))} placeholder="Preenchido automaticamente ao selecionar aluno" className="form-input" style={{ color: form.responsavel ? 'hsl(var(--text-primary))' : undefined }} />
              </div>
              <div>
                <label className="form-label">Motivo da Inadimplência</label>
                <select className="form-input" value={form.motivoInadimpl} onChange={e=>setForm(f=>({...f,motivoInadimpl:e.target.value}))}>
                  {MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div>
                  <label className="form-label">Valor Original (R$)</label>
                  <input type="number" value={form.valorOriginal} onChange={e=>{const vn=(parseFloat(e.target.value)*(1-parseFloat(form.desconto)/100)).toFixed(2);setForm(f=>({...f,valorOriginal:e.target.value,valorNegociado:vn}))}} placeholder="0" className="form-input" style={{color:'#f87171',fontWeight:700}}/>
                </div>
                <div>
                  <label className="form-label">Desconto (%)</label>
                  <input type="number" min={0} max={100} value={form.desconto} onChange={e=>handleDescontoChange(e.target.value)} placeholder="0" className="form-input"/>
                </div>
                <div>
                  <label className="form-label">Valor Negociado (R$)</label>
                  <input type="number" value={form.valorNegociado} onChange={e=>handleValorNegChange(e.target.value)} placeholder="0" className="form-input" style={{color:'#10b981',fontWeight:700}}/>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label className="form-label">Nº de Parcelas</label>
                  <select className="form-input" value={form.parcelas} onChange={e=>setForm(f=>({...f,parcelas:e.target.value}))}>
                    <option value="1">À vista</option>
                    <option value="2">2x</option>
                    <option value="3">3x</option>
                    <option value="6">6x</option>
                    <option value="12">12x</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Data do Acordo</label>
                  <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} className="form-input"/>
                </div>
              </div>

              {/* Preview do acordo */}
              {valorOrig>0&&(
                <div style={{padding:'12px 16px',background:'rgba(16,185,129,0.08)',borderRadius:10,border:'1px solid rgba(16,185,129,0.2)'}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:8,color:'#10b981'}}>Preview do Acordo</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    <div><div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Economia</div><div style={{fontWeight:800,color:'#10b981'}}>{fmtCur(valorOrig-(parseFloat(form.valorNegociado)||0))}</div></div>
                    <div><div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Parcela</div><div style={{fontWeight:800,color:'#60a5fa'}}>{fmtCur((parseFloat(form.valorNegociado)||0)/Math.max(parseInt(form.parcelas)||1,1))}</div></div>
                    <div><div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Total acordo</div><div style={{fontWeight:800}}>{fmtCur(parseFloat(form.valorNegociado)||0)}</div></div>
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Condições e Observações</label>
                <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Descreva as condições especiais do acordo, promessas, prazos..." className="form-input" rows={2}/>
              </div>
            </div>

            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={()=>setShowModal(false)} className="btn btn-secondary" style={{flex:1}}>Cancelar</button>
              <button onClick={handleSave} disabled={!form.alunoNome} className="btn btn-primary" style={{flex:2}}>
                ✓ Criar Acordo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
