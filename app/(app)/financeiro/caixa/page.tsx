'use client'

import { useData } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, BarChart2, DollarSign, Search, Filter, Calendar, X } from 'lucide-react'

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
function fmt(d: string) { if (!d) return '—'; const [y,m,dia]=d.split('-'); return `${dia}/${m}/${y}` }

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function FluxoCaixaPage() {
  const { titulos, contasPagar } = useData()

  const [filtroMes, setFiltroMes] = useState<number | 'todos'>('todos')
  const [filtroAno, setFiltroAno] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos'|'entrada'|'saida'>('todos')
  const [search, setSearch] = useState('')
  const [visao, setVisao] = useState<'timeline'|'mensal'>('timeline')
  const [showFilters, setShowFilters] = useState(false)

  const mesAtual = new Date().getMonth() + 1
  const anoAtual = new Date().getFullYear()

  const anos = useMemo(() => {
    const set = new Set<string>()
    titulos.forEach(t => t.vencimento && set.add(t.vencimento.slice(0,4)))
    contasPagar?.forEach(c => c.vencimento && set.add(c.vencimento.slice(0,4)))
    return [...set].sort().reverse()
  }, [titulos, contasPagar])

  // Lançamentos unificados
  const lancamentos = useMemo(() => {
    const entradas = titulos.filter(t=>t.status==='pago').map(t=>({
      id:t.id, tipo:'entrada' as const, descricao:`${t.aluno} — ${t.descricao}`, valor:t.valor,
      data:t.pagamento||t.vencimento, status:'realizado' as const,
    }))
    const aReceber = titulos.filter(t=>t.status!=='pago').map(t=>({
      id:t.id, tipo:'entrada' as const, descricao:`${t.aluno} — ${t.descricao} (previsto)`, valor:t.valor,
      data:t.vencimento, status:'previsto' as const,
    }))
    const saidas = (contasPagar??[]).map(c=>({
      id:c.id, tipo:'saida' as const, descricao:`${c.descricao} — ${c.fornecedor||c.categoria}`, valor:c.valor,
      data:c.vencimento, status:c.status==='pago'?'realizado' as const:'previsto' as const,
    }))
    return [...entradas,...aReceber,...saidas].sort((a,b)=>a.data.localeCompare(b.data))
  }, [titulos, contasPagar])

  const filtered = useMemo(() => lancamentos.filter(l => {
    const mes = parseInt(l.data.slice(5,7))
    const ano = l.data.slice(0,4)
    const matchMes = filtroMes==='todos' || mes===filtroMes
    const matchAno = filtroAno==='todos' || ano===filtroAno
    const matchTipo = filtroTipo==='todos' || l.tipo===filtroTipo
    const q = search.toLowerCase()
  const searchActive = search.trim().length >= 3
    const matchSearch = !searchActive || (search.trim().length < 3 || (!search || l.descricao.toLowerCase().includes(q)))
    return matchMes && matchAno && matchTipo && matchSearch
  }), [lancamentos, filtroMes, filtroAno, filtroTipo, search])

  const totalEntradasReal = titulos.filter(t=>t.status==='pago').reduce((s,t)=>s+t.valor,0)
  const totalAReceber = titulos.filter(t=>t.status!=='pago').reduce((s,t)=>s+t.valor,0)
  const totalSaidasReal = (contasPagar??[]).filter(c=>c.status==='pago').reduce((s,c)=>s+c.valor,0)
  const totalAPagar = (contasPagar??[]).filter(c=>c.status==='pendente').reduce((s,c)=>s+c.valor,0)
  const saldoReal = totalEntradasReal - totalSaidasReal
  const saldoProjetado = totalEntradasReal + totalAReceber - (totalSaidasReal + totalAPagar)

  // Dados mensais para visão mensal
  const mesesData = useMemo(() => MESES_SHORT.map((mes,i)=> {
    const m = i+1
    const entradas = titulos.filter(t=>t.status==='pago'&&parseInt(t.vencimento?.slice(5,7)??'0')===m).reduce((s,t)=>s+t.valor,0)
    const saidas = (contasPagar??[]).filter(c=>c.status==='pago'&&parseInt(c.vencimento?.slice(5,7)??'0')===m).reduce((s,c)=>s+c.valor,0)
    return { mes: m, mesNome: mes, entradas, saidas, saldo:entradas-saidas }
  }), [titulos, contasPagar])

  const maxBar = Math.max(...mesesData.flatMap(m=>[m.entradas,m.saidas]), 1)

  const activeFilters = [filtroMes!=='todos', filtroAno!=='todos', filtroTipo!=='todos'].filter(Boolean).length
  const clearFilters = () => { setFiltroMes('todos'); setFiltroAno('todos'); setFiltroTipo('todos'); setSearch('') }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxo de Caixa</h1>
          <p className="page-subtitle">Projeção e controle de entradas e saídas em tempo real</p>
        </div>
        <div style={{display:'flex', gap:10}}>
          <div className="tab-list" style={{padding:3}}>
            <button className={`tab-trigger ${visao==='timeline'?'active':''}`} onClick={()=>setVisao('timeline')}>Timeline</button>
            <button className={`tab-trigger ${visao==='mensal'?'active':''}`} onClick={()=>setVisao('mensal')}>Mensal</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:20}}>
        {[
          { label:'Entradas Realizadas', value:fmtCur(totalEntradasReal), color:'#10b981', icon:'↑' },
          { label:'A Receber', value:fmtCur(totalAReceber), color:'#06b6d4', icon:'⌛' },
          { label:'Saídas Realizadas', value:fmtCur(totalSaidasReal), color:'#ef4444', icon:'↓' },
          { label:'A Pagar', value:fmtCur(totalAPagar), color:'#f59e0b', icon:'📤' },
          { label:'Saldo Atual', value:fmtCur(saldoReal), color:saldoReal>=0?'#10b981':'#ef4444', icon:'💰' },
          { label:'Saldo Projetado', value:fmtCur(saldoProjetado), color:saldoProjetado>=0?'#3b82f6':'#f87171', icon:'📊' },
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div style={{fontSize:11, color:'hsl(var(--text-muted))', marginBottom:6}}>{k.icon} {k.label}</div>
            <div style={{fontSize:13, fontWeight:800, color:k.color, fontFamily:'Outfit,sans-serif'}}>{k.value}</div>
          </div>
        ))}
      </div>

      {visao==='mensal' ? (
        /* Visão por barras mensais */
        <div className="card" style={{padding:'24px'}}>
          <div style={{fontWeight:700, fontSize:14, marginBottom:20}}>Entradas vs. Saídas — {anoAtual}</div>
          <div style={{display:'flex', gap:6, alignItems:'flex-end', height:180}}>
            {mesesData.map(d=>(
              <div key={d.mes} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                <div style={{display:'flex', gap:2, alignItems:'flex-end', height:150, width:'100%'}}>
                  <div style={{flex:1, background:'rgba(16,185,129,0.7)', borderRadius:'4px 4px 0 0', height:`${(d.entradas/maxBar)*150}px`, minHeight:2, transition:'height 0.3s'}} title={fmtCur(d.entradas)}/>
                  <div style={{flex:1, background:'rgba(239,68,68,0.7)', borderRadius:'4px 4px 0 0', height:`${(d.saidas/maxBar)*150}px`, minHeight:2, transition:'height 0.3s'}} title={fmtCur(d.saidas)}/>
                </div>
                <div style={{fontSize:10, color:d.mes===mesAtual?'#60a5fa':'hsl(var(--text-muted))', fontWeight:d.mes===mesAtual?800:400}}>{MESES_SHORT[d.mes-1]}</div>
                <div style={{fontSize:9, color:d.saldo>=0?'#10b981':'#ef4444', fontWeight:700}}>{d.saldo>=0?'+':''}{fmtCur(d.saldo).replace('R$','')}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex', gap:16, marginTop:12, justifyContent:'center'}}>
            <div style={{display:'flex', alignItems:'center', gap:6}}><div style={{width:12, height:12, borderRadius:2, background:'rgba(16,185,129,0.7)'}}/><span style={{fontSize:11}}>Entradas</span></div>
            <div style={{display:'flex', alignItems:'center', gap:6}}><div style={{width:12, height:12, borderRadius:2, background:'rgba(239,68,68,0.7)'}}/><span style={{fontSize:11}}>Saídas</span></div>
          </div>
        </div>
      ) : (
        <>
          {/* Filtros da timeline */}
          <div style={{display:'flex', gap:10, marginBottom:12, alignItems:'center', flexWrap:'wrap'}}>
            <div className="tab-list">
              {([['todos','Todos'],['entrada','Entradas'],['saida','Saídas']] as const).map(([v,l])=>(
                <button key={v} className={`tab-trigger ${filtroTipo===v?'active':''}`} onClick={()=>setFiltroTipo(v)}>{l}</button>
              ))}
            </div>
            <div style={{position:'relative', flex:1, minWidth:180}}>
              <Search size={13} style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))'}}/>
              <input className="form-input" style={{paddingLeft:36}} placeholder="Buscar lançamento..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <button className={`btn btn-sm ${showFilters?'btn-primary':'btn-secondary'}`} onClick={()=>setShowFilters(p=>!p)}>
              <Filter size={13}/>Período {activeFilters>0&&<span style={{background:'#ef4444',borderRadius:'50%',width:16,height:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800}}>{activeFilters}</span>}
            </button>
            {(activeFilters>0||search)&&<button className="btn btn-ghost btn-sm" style={{color:'#f87171'}} onClick={clearFilters}><X size={12}/>Limpar</button>}
          </div>

          {showFilters && (
            <div style={{display:'flex', gap:10, marginBottom:14, padding:'14px', background:'hsl(var(--bg-elevated))', borderRadius:10, flexWrap:'wrap', border:'1px solid hsl(var(--border-subtle))'}}>
              <div>
                <label className="form-label" style={{fontSize:10}}>Mês</label>
                <select className="form-input" style={{minWidth:140, fontSize:12}} value={String(filtroMes)} onChange={e=>setFiltroMes(e.target.value==='todos'?'todos':parseInt(e.target.value))}>
                  <option value="todos">Todos os meses</option>
                  {MESES_FULL.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{fontSize:10}}>Ano</label>
                <select className="form-input" style={{minWidth:100, fontSize:12}} value={filtroAno} onChange={e=>setFiltroAno(e.target.value)}>
                  <option value="todos">Todos</option>
                  {anos.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Timeline */}
          {titulos.length===0&&(contasPagar??[]).length===0 ? (
            <div className="card" style={{padding:'48px', textAlign:'center', color:'hsl(var(--text-muted))'}}>
              <BarChart2 size={44} style={{margin:'0 auto 14px', opacity:0.15}}/>
              <div style={{fontSize:15, fontWeight:600, marginBottom:8}}>Nenhum dado financeiro</div>
              <div style={{fontSize:13}}>Cadastre títulos e contas a pagar para visualizar o fluxo.</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Status</th><th style={{textAlign:'right'}}>Valor</th></tr>
                </thead>
                <tbody>
                  {filtered.map(l=>(
                    <tr key={l.id}>
                      <td style={{fontSize:12, color:'hsl(var(--text-muted))', whiteSpace:'nowrap'}}>{fmt(l.data)}</td>
                      <td>
                        {l.tipo==='entrada'
                          ? <span style={{display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#10b981', fontWeight:600}}><TrendingUp size={12}/>Entrada</span>
                          : <span style={{display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#ef4444', fontWeight:600}}><TrendingDown size={12}/>Saída</span>
                        }
                      </td>
                      <td style={{fontSize:13, fontWeight:500}}>{l.descricao}</td>
                      <td>
                        <span style={{fontSize:11, padding:'2px 7px', borderRadius:5, background:l.status==='realizado'?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)', color:l.status==='realizado'?'#10b981':'#f59e0b', fontWeight:700}}>
                          {l.status==='realizado'?'✓ Realizado':'⌛ Previsto'}
                        </span>
                      </td>
                      <td style={{textAlign:'right', fontWeight:700, color:l.tipo==='entrada'?'#10b981':'#ef4444', fontSize:14}}>{fmtCur(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length===0&&<div style={{padding:'24px', textAlign:'center', color:'hsl(var(--text-muted))', fontSize:13}}>Nenhum lançamento com esses filtros</div>}
              <div style={{padding:'10px 16px', borderTop:'1px solid hsl(var(--border-subtle))', fontSize:12, color:'hsl(var(--text-muted))', display:'flex', justifyContent:'space-between'}}>
                <span>{filtered.length} lançamentos</span>
                <span>
                  <span style={{color:'#10b981', fontWeight:700, marginRight:16}}>↑ {fmtCur(filtered.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+l.valor,0))}</span>
                  <span style={{color:'#ef4444', fontWeight:700}}>↓ {fmtCur(filtered.filter(l=>l.tipo==='saida').reduce((s,l)=>s+l.valor,0))}</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
