'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PieChart, TrendingUp, TrendingDown, Filter, Search, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react'

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CAT_COLORS: Record<string, string> = {
  'Mensalidades':    '#10b981',
  'Matrículas':      '#06b6d4',
  'Taxas Diversas':  '#3b82f6',
  'RH / Pessoal':    '#ef4444',
  'Utilidades':      '#f59e0b',
  'Materiais':       '#8b5cf6',
  'Tecnologia':      '#ec4899',
  'Infraestrutura':  '#a78bfa',
  'Marketing':       '#f97316',
  'Outros':          '#6b7280',
}

interface CentroItem { label: string; valor: number; tipo: 'receita'|'despesa'; categoria: string; percentual: number }

export default function CentroCustosPage() {
  const { data: titulos = [], isLoading: loadTi } = useQuery<any[]>({
    queryKey: ['titulos'],
    queryFn: async () => { const r = await fetch('/api/financeiro/titulos'); return r.json() }
  })
  const { data: contasPagar = [], isLoading: loadCP } = useQuery<any[]>({
    queryKey: ['contasPagar'],
    queryFn: async () => { const r = await fetch('/api/financeiro/contas-pagar'); return r.json() }
  })
  const { data: funcionarios = [], isLoading: loadF } = useQuery<any[]>({
    queryKey: ['funcionarios'],
    queryFn: async () => { const r = await fetch('/api/rh/funcionarios'); return r.json() }
  })
  const { data: cfgCentrosCusto = [], isLoading: loadCC } = useQuery<any[]>({
    queryKey: ['cfgCentrosCusto'],
    queryFn: async () => { const r = await fetch('/api/configuracoes/centro-custo'); return r.json() }
  })

  const isLoading = loadTi || loadCP || loadF || loadCC

  const [filtroTipo, setFiltroTipo] = useState<'todos'|'receita'|'despesa'>('todos')
  const [filtroMes, setFiltroMes] = useState<number>(-1) // -1 = acumulado
  const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear())
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const anos = useMemo(() => {
    const set = new Set<number>()
    titulos.forEach(t => t.vencimento && set.add(parseInt(t.vencimento.slice(0,4))))
    return [...set, new Date().getFullYear()].sort().reverse()
  }, [titulos])

  const titulosFiltered = titulos.filter(t => {
    if(!t.vencimento) return false
    if(filtroAno && parseInt(t.vencimento.slice(0,4)) !== filtroAno) return false
    if(filtroMes>=0 && parseInt(t.vencimento.slice(5,7)) !== filtroMes+1) return false
    return true
  })
  const pagarFiltered = (contasPagar??[]).filter(c => {
    if(!c.vencimento) return false
    if(filtroAno && parseInt(c.vencimento.slice(0,4)) !== filtroAno) return false
    if(filtroMes>=0 && parseInt(c.vencimento.slice(5,7)) !== filtroMes+1) return false
    return true
  })

  const receitaMensalidades = titulosFiltered.filter(t=>t.status==='pago').reduce((s,t)=>s+t.valor,0)
  const receitaPrevista = titulosFiltered.filter(t=>t.status!=='pago').reduce((s,t)=>s+t.valor,0)
  const folhaMensal = filtroMes>=0 ? funcionarios.reduce((s,f)=>s+(f.salario||0),0) : funcionarios.reduce((s,f)=>s+(f.salario||0),0)
  const custosPagar = pagarFiltered.reduce((s,c)=>s+c.valor,0)
  const custoTotal = folhaMensal + custosPagar
  const resultado = receitaMensalidades - custoTotal
  const margemOp = (receitaMensalidades+receitaPrevista) > 0 ? ((resultado / (receitaMensalidades+receitaPrevista))*100).toFixed(1):'0.0'

  // Itens do centro de custo
  const centros: CentroItem[] = useMemo(() => {
    const totalReceita = receitaMensalidades + receitaPrevista || 1
    const totalCusto = custoTotal || 1
    const items: CentroItem[] = [
      { label:'Mensalidades Recebidas', valor:receitaMensalidades, tipo:'receita', categoria:'Mensalidades', percentual:(receitaMensalidades/totalReceita)*100 },
      { label:'Mensalidades a Receber', valor:receitaPrevista, tipo:'receita', categoria:'Matrículas', percentual:(receitaPrevista/totalReceita)*100 },
      { label:'Folha de Pagamento / RH', valor:folhaMensal, tipo:'despesa', categoria:'RH / Pessoal', percentual:(folhaMensal/totalCusto)*100 },
    ]
    // Contas a pagar por categoria
    const cats: Record<string,number> = {}
    pagarFiltered.forEach(c=>{ cats[c.categoria]=(cats[c.categoria]||0)+c.valor })
    Object.entries(cats).forEach(([cat,val])=>{
      items.push({ label:`Contas a Pagar — ${cat}`, valor:val, tipo:'despesa', categoria:cat, percentual:(val/totalCusto)*100 })
    })
    // Centros cadastrados
    cfgCentrosCusto?.filter(c=>c.situacao==='ativo').forEach(cc=>{
      if(!items.some(i=>i.label.includes(cc.descricao))) {
        items.push({ label:cc.descricao, valor:0, tipo:'receita', categoria:'Outros', percentual:0 })
      }
    })
    return items
  }, [receitaMensalidades, receitaPrevista, folhaMensal, pagarFiltered, cfgCentrosCusto])

  const filtered = useMemo(() => centros.filter(c=>{
    const matchTipo = filtroTipo==='todos' || c.tipo===filtroTipo
    const matchSearch = search.trim().length < 3 || (!search || c.label.toLowerCase().includes(search.toLowerCase()) || c.categoria.toLowerCase().includes(search.toLowerCase()))
    return matchTipo && matchSearch
  }), [centros, filtroTipo, search])

  const totalReceitas = centros.filter(c=>c.tipo==='receita').reduce((s,c)=>s+c.valor,0)
  const totalDespesas = centros.filter(c=>c.tipo==='despesa').reduce((s,c)=>s+c.valor,0)

  // Agrupamento por categoria
  const porCategoria = useMemo(() => {
    const map: Record<string,{valor:number, tipo:'receita'|'despesa'}> = {}
    centros.forEach(c=>{ if(!map[c.categoria]) map[c.categoria]={valor:0,tipo:c.tipo}; map[c.categoria].valor+=c.valor })
    return Object.entries(map).sort((a,b)=>b[1].valor-a[1].valor)
  }, [centros])
  const maxCat = Math.max(...porCategoria.map(([,v])=>v.valor),1)

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Calculando custos operacionais...</div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Custos Operacional</h1>
          <p className="page-subtitle">Análise gerencial de receitas e despesas por centro de custo</p>
        </div>
      </div>

      {/* Período */}
      <div style={{display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap'}}>
        <label style={{fontSize:12, color:'hsl(var(--text-muted))'}}>📅 Período:</label>
        <select className="form-input" style={{width:180}} value={filtroMes} onChange={e=>setFiltroMes(parseInt(e.target.value))}>
          <option value={-1}>Acumulado (Ano todo)</option>
          {MESES_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="form-input" style={{width:110}} value={filtroAno} onChange={e=>setFiltroAno(parseInt(e.target.value))}>
          {anos.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{marginLeft:'auto', display:'flex', gap:8}}>
          <div style={{padding:'6px 14px', borderRadius:8, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', fontSize:13, fontWeight:800, color:Number(margemOp)>=0?'#10b981':'#ef4444'}}>
            Margem: {margemOp}%
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20}}>
        {[
          { label:'Receitas Realizadas', value:fmtCur(receitaMensalidades), color:'#10b981', icon:'📈', sub:'recebidas no período' },
          { label:'Receitas Previstas', value:fmtCur(receitaPrevista), color:'#06b6d4', icon:'⌛', sub:'a receber' },
          { label:'Folha de Pagamento', value:fmtCur(folhaMensal), color:'#ef4444', icon:'👥', sub:`${funcionarios.length} funcionários` },
          { label:'Outras Despesas', value:fmtCur(custosPagar), color:'#f59e0b', icon:'📤', sub:'contas a pagar' },
          { label:'Resultado Operacional', value:fmtCur(resultado), color:resultado>=0?'#10b981':'#ef4444', icon:'💰', sub:resultado>=0?'superávit':'déficit' },
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
              <span style={{fontSize:16}}>{k.icon}</span>
              <span style={{fontSize:11, color:'hsl(var(--text-muted))'}}>{k.label}</span>
            </div>
            <div style={{fontSize:13, fontWeight:800, color:k.color, fontFamily:'Outfit,sans-serif'}}>{k.value}</div>
            <div style={{fontSize:10, color:'hsl(var(--text-muted))', marginTop:3}}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16}}>
        {/* Tabela */}
        <div>
          <div style={{display:'flex', gap:10, marginBottom:12, alignItems:'center', flexWrap:'wrap'}}>
            <div className="tab-list">
              {([['todos','Todos'],['receita','Receitas'],['despesa','Despesas']] as const).map(([v,l])=>(
                <button key={v} className={`tab-trigger ${filtroTipo===v?'active':''}`} onClick={()=>setFiltroTipo(v)}>{l}</button>
              ))}
            </div>
            <div style={{position:'relative', flex:1, minWidth:180}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'hsl(var(--text-muted))'}}/>
              <input className="form-input" style={{paddingLeft:36}} placeholder="Buscar lançamento ou categoria..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr><th>Centro de Custo</th><th>Categoria</th><th>Tipo</th><th>% Participação</th><th style={{textAlign:'right'}}>Valor</th></tr>
              </thead>
              <tbody>
                {filtered.map((c,i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:500, fontSize:13}}>{c.label}</td>
                    <td>
                      <span style={{fontSize:11, padding:'2px 7px', borderRadius:5, background:`${CAT_COLORS[c.categoria]||'#6b7280'}18`, color:CAT_COLORS[c.categoria]||'#6b7280', fontWeight:600}}>
                        {c.categoria}
                      </span>
                    </td>
                    <td>
                      {c.tipo==='receita'
                        ? <span style={{color:'#10b981',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><TrendingUp size={11}/>Receita</span>
                        : <span style={{color:'#ef4444',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><TrendingDown size={11}/>Despesa</span>
                      }
                    </td>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:6}}>
                        <div style={{flex:1, height:4, borderRadius:2, background:'hsl(var(--bg-overlay))'}}>
                          <div style={{height:'100%', borderRadius:2, background:c.tipo==='receita'?'#10b981':'#ef4444', width:`${Math.min(c.percentual,100)}%`}}/>
                        </div>
                        <span style={{fontSize:11, fontWeight:700, color:c.tipo==='receita'?'#10b981':'#ef4444', minWidth:38}}>{c.percentual.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{textAlign:'right', fontWeight:700, fontSize:14, color:c.tipo==='receita'?'#10b981':'#ef4444'}}>{fmtCur(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{padding:'10px 16px', borderTop:'1px solid hsl(var(--border-subtle))', fontSize:12, color:'hsl(var(--text-muted))', display:'flex', justifyContent:'space-between'}}>
              <span style={{color:'#10b981', fontWeight:700}}>↑ {fmtCur(totalReceitas)}</span>
              <span style={{color:'#ef4444', fontWeight:700}}>↓ {fmtCur(totalDespesas)}</span>
            </div>
          </div>
        </div>

        {/* Chart por categoria */}
        <div className="card" style={{padding:'20px'}}>
          <div style={{fontWeight:700, fontSize:13, marginBottom:16}}>Distribuição por Categoria</div>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {porCategoria.map(([cat,val])=>(
              <div key={cat}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <div style={{width:8, height:8, borderRadius:'50%', background:CAT_COLORS[cat]||'#6b7280', flexShrink:0}}/>
                    <span style={{fontSize:11, fontWeight:600}}>{cat}</span>
                    <span style={{fontSize:10, color:val.tipo==='receita'?'#10b981':'#ef4444', fontWeight:700}}>{val.tipo==='receita'?'▲':'▼'}</span>
                  </div>
                  <span style={{fontSize:11, fontWeight:700, color:CAT_COLORS[cat]||'#6b7280'}}>{fmtCur(val.valor)}</span>
                </div>
                <div style={{height:4, borderRadius:2, background:'hsl(var(--bg-overlay))'}}>
                  <div style={{height:'100%', borderRadius:2, background:CAT_COLORS[cat]||'#6b7280', width:`${(val.valor/maxCat)*100}%`, transition:'width 0.4s'}}/>
                </div>
              </div>
            ))}
          </div>
          {porCategoria.length === 0 && (
            <div style={{padding:'24px', textAlign:'center', color:'hsl(var(--text-muted))', fontSize:13}}>
              Cadastre títulos e contas a pagar para visualizar
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
