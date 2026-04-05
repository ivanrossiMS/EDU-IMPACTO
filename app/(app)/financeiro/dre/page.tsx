'use client'

import { useData } from '@/lib/dataContext'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { BarChart2, TrendingUp, TrendingDown, Filter, Calendar, ChevronDown, ChevronRight } from 'lucide-react'

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function DrePage() {
  const { funcionarios } = useData()
  
  const { data: titulos = [], isLoading: loadTi } = useQuery<any[]>({
    queryKey: ['titulos'],
    queryFn: async () => { const r = await fetch('/api/financeiro/titulos'); return r.json() }
  })
  
  const { data: contasPagar = [], isLoading: loadCP } = useQuery<any[]>({
    queryKey: ['contas-pagar'],
    queryFn: async () => { const r = await fetch('/api/financeiro/contas-pagar'); return r.json() }
  })

  const [filtroMes, setFiltroMes] = useState<number>(-1) // -1 = acumulado
  const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear())
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(['receitas','deducoes','despesas']))

  const isLoading = loadTi || loadCP

  const anos = useMemo(() => {
    const set = new Set<number>()
    titulos.forEach(t => t.vencimento && set.add(parseInt(t.vencimento.slice(0,4))))
    return [...set].sort().reverse()
  }, [titulos])

  const toggleExpand = (key: string) => setExpandidos(prev => {
    const next = new Set(prev); next.has(key)?next.delete(key):next.add(key); return next
  })

  // Filtragem por período
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

  const receitaBruta = titulosFiltered.filter(t=>t.status==='pago').reduce((s,t)=>s+t.valor,0)
  const inadimplencia = titulosFiltered.filter(t=>t.status==='atrasado').reduce((s,t)=>s+t.valor,0)
  const aReceber = titulosFiltered.filter(t=>t.status==='pendente').reduce((s,t)=>s+t.valor,0)

  const totalFolha = filtroMes>=0
    ? funcionarios.reduce((s,f)=>s+(f.salario||0),0) // mensal = same
    : funcionarios.reduce((s,f)=>s+(f.salario||0),0)

  const custosPagar = pagarFiltered.reduce((s,c)=>s+c.valor,0)
  const custosProvisionados = pagarFiltered.filter(c=>c.status==='pendente').reduce((s,c)=>s+c.valor,0)

  const receitaLiquida = receitaBruta - inadimplencia
  const lucroBruto = receitaLiquida - totalFolha
  const ebitda = lucroBruto - custosPagar
  const margem = receitaBruta>0?((ebitda/receitaBruta)*100).toFixed(1):'0.0'
  const roi = receitaBruta>0?((ebitda/(totalFolha+custosPagar||1))*100).toFixed(1):'0.0'

  // DRE estruturado
  const estrutura = [
    {
      key:'receitas', label:'RECEITAS', color:'#10b981', icon:'📈',
      total: receitaBruta + aReceber,
      linhas:[
        { label:'Receitas de Mensalidades (Recebidas)', valor:receitaBruta, positive:true, color:'#10b981' },
        { label:'Receitas a Receber (Previsto)', valor:aReceber, positive:true, color:'#06b6d4' },
        { label:'Total da Receita Operacional', valor:receitaBruta+aReceber, positive:true, color:'#10b981', bold:true },
      ]
    },
    {
      key:'deducoes', label:'DEDUÇÕES E AJUSTES', color:'#f87171', icon:'📉',
      total: -inadimplencia,
      linhas:[
        { label:'(−) Inadimplência / Títulos em Atraso', valor:-inadimplencia, positive:false, color:'#ef4444' },
        { label:'Receita Líquida Ajustada', valor:receitaLiquida, positive:receitaLiquida>=0, color:receitaLiquida>=0?'#10b981':'#ef4444', bold:true },
      ]
    },
    {
      key:'despesas', label:'CUSTOS E DESPESAS', color:'#f59e0b', icon:'💸',
      total: -(totalFolha+custosPagar),
      linhas:[
        { label:'(−) Folha de Pagamento / RH', valor:-totalFolha, positive:false, color:'#ef4444' },
        { label:'(−) Contas a Pagar (realizadas)', valor:-(custosPagar-custosProvisionados), positive:false, color:'#f87171' },
        { label:'(−) Contas a Pagar (provisionadas)', valor:-custosProvisionados, positive:false, color:'#fbbf24' },
        { label:'Total Custos Operacionais', valor:-(totalFolha+custosPagar), positive:false, color:'#ef4444', bold:true },
      ]
    },
    {
      key:'resultado', label:'RESULTADO', color: ebitda>=0?'#10b981':'#ef4444', icon:'💰',
      total: ebitda,
      linhas:[
        { label:'Lucro Bruto (Rec. Líq. − Folha)', valor:lucroBruto, positive:lucroBruto>=0, color:lucroBruto>=0?'#10b981':'#ef4444' },
        { label:'EBITDA Estimado', valor:ebitda, positive:ebitda>=0, color:ebitda>=0?'#10b981':'#ef4444', bold:true },
        { label:`Margem EBITDA: ${margem}%`, valor:ebitda, positive:ebitda>=0, color:ebitda>=0?'#10b981':'#ef4444' },
        { label:`ROI Operacional: ${roi}%`, valor: parseFloat(roi), positive:parseFloat(roi)>=0, color:parseFloat(roi)>=0?'#3b82f6':'#ef4444' },
      ]
    }
  ]

  // Gráfico mensal (sparkline simples)
  const mesesData = MESES_SHORT.map((_,i)=>{
    const m = i+1
    const rec = titulos.filter(t=>t.status==='pago'&&parseInt(t.vencimento?.slice(5,7)??"0")===m&&parseInt(t.vencimento?.slice(0,4)??"0")===filtroAno).reduce((s,t)=>s+t.valor,0)
    const desp = (contasPagar??[]).filter(c=>parseInt(c.vencimento?.slice(5,7)??"0")===m&&parseInt(c.vencimento?.slice(0,4)??"0")===filtroAno).reduce((s,c)=>s+c.valor,0)+
      (m===filtroMes+1||filtroMes===-1?totalFolha/12:0)
    return { rec, desp, lucro: rec-desp }
  })
  const maxVal = Math.max(...mesesData.flatMap(d=>[d.rec,d.desp]),1)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">DRE — Demonstrativo de Resultado</h1>
          <p className="page-subtitle">Resultado financeiro gerencial do período selecionado</p>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign:'center', padding:'24px', color:'hsl(var(--text-muted))' }}>
          <div style={{ width: 24, height: 24, border: '3px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 12 }}>Carregando dados financeiros consolidados...</div>
        </div>
      )}

      {/* Seletor de período */}
      <div style={{display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))'}}>
          <Calendar size={14} color="#60a5fa"/>
          <span style={{fontSize:12, fontWeight:600, color:'hsl(var(--text-muted))'}}>Período:</span>
        </div>
        <select className="form-input" style={{width:180}} value={filtroMes} onChange={e=>setFiltroMes(parseInt(e.target.value))}>
          <option value={-1}>Acumulado (Ano todo)</option>
          {MESES_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select className="form-input" style={{width:110}} value={filtroAno} onChange={e=>setFiltroAno(parseInt(e.target.value))}>
          {(anos.length>0?anos:[new Date().getFullYear()]).map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
          <div style={{padding:'8px 16px', borderRadius:10, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)'}}>
            <span style={{fontSize:11, color:'hsl(var(--text-muted))'}}>Margem </span>
            <span style={{fontSize:16, fontWeight:800, color:Number(margem)>=0?'#10b981':'#ef4444'}}>{margem}%</span>
          </div>
          <div style={{padding:'8px 16px', borderRadius:10, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)'}}>
            <span style={{fontSize:11, color:'hsl(var(--text-muted))'}}>ROI </span>
            <span style={{fontSize:16, fontWeight:800, color:Number(roi)>=0?'#3b82f6':'#ef4444'}}>{roi}%</span>
          </div>
        </div>
      </div>

      {/* KPIs top */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20}}>
        {[
          { label:'Receita Bruta', value:fmtCur(receitaBruta+aReceber), sub:'recebida + a receber', color:'#10b981' },
          { label:'Custo Total', value:fmtCur(totalFolha+custosPagar), sub:'folha + fornecedores', color:'#ef4444' },
          { label:'EBITDA', value:fmtCur(ebitda), sub:`margem ${margem}%`, color:ebitda>=0?'#10b981':'#ef4444' },
          { label:'Inadimplência', value:fmtCur(inadimplencia), sub:'títulos em atraso', color:'#f59e0b' },
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div style={{fontSize:11, color:'hsl(var(--text-muted))', marginBottom:6}}>{k.label}</div>
            <div style={{fontSize:18, fontWeight:800, color:k.color, fontFamily:'Outfit,sans-serif'}}>{k.value}</div>
            <div style={{fontSize:10, color:'hsl(var(--text-muted))', marginTop:3}}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:16}}>
        {/* DRE estruturado */}
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {estrutura.map(secao=>(
            <div key={secao.key} className="card" style={{overflow:'hidden'}}>
              <div style={{padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', background:`${secao.color}08`, borderBottom: expandidos.has(secao.key)?'1px solid hsl(var(--border-subtle))':'none'}}
                onClick={()=>toggleExpand(secao.key)}>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{fontSize:16}}>{secao.icon}</span>
                  <span style={{fontWeight:800, fontSize:13, color:secao.color, letterSpacing:'0.05em'}}>{secao.label}</span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{fontWeight:800, fontSize:15, color:secao.total>=0?'#10b981':'#ef4444'}}>{secao.total>=0?'':'-'}{fmtCur(Math.abs(secao.total))}</span>
                  {expandidos.has(secao.key)?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                </div>
              </div>
              {expandidos.has(secao.key) && (
                <div>
                  {secao.linhas.map((l,i)=>(
                    <div key={i} style={{
                      padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center',
                      borderBottom:`1px solid hsl(var(--border-subtle))`,
                      background: l.bold?'rgba(255,255,255,0.02)':'transparent'
                    }}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        {l.positive?<TrendingUp size={12} color={l.color}/>:<TrendingDown size={12} color={l.color}/>}
                        <span style={{fontSize:13, fontWeight:l.bold?700:400, color:l.bold?'hsl(var(--text-primary))':'hsl(var(--text-secondary))'}}>{l.label}</span>
                      </div>
                      <span style={{fontSize:l.bold?15:13, fontWeight:l.bold?800:600, color:l.color}}>{fmtCur(Math.abs(typeof l.valor==='number'?l.valor:0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Gráfico mensal */}
        <div className="card" style={{padding:'20px'}}>
          <div style={{fontWeight:700, fontSize:13, marginBottom:16}}>Resultado Mensal — {filtroAno}</div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {mesesData.map((d,i)=>(
              <div key={i} style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{width:26, fontSize:10, color:i===filtroMes?'#60a5fa':'hsl(var(--text-muted))', fontWeight:i===filtroMes?800:400, textAlign:'right', flexShrink:0}}>{MESES_SHORT[i]}</div>
                <div style={{flex:1, display:'flex', flexDirection:'column', gap:2}}>
                  <div style={{height:5, borderRadius:3, background:`rgba(16,185,129,0.8)`, width:`${(d.rec/maxVal)*100}%`, minWidth:2}}/>
                  <div style={{height:5, borderRadius:3, background:`rgba(239,68,68,0.7)`, width:`${(d.desp/maxVal)*100}%`, minWidth:2}}/>
                </div>
                <div style={{width:56, textAlign:'right', fontSize:9, fontWeight:700, color:d.lucro>=0?'#10b981':'#ef4444', flexShrink:0}}>{d.lucro>=0?'+':''}{fmtCur(d.lucro).replace('R$','').trim()}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex', gap:12, marginTop:14, justifyContent:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:5,borderRadius:2,background:'rgba(16,185,129,0.8)'}}/><span style={{fontSize:10}}>Receita</span></div>
            <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:5,borderRadius:2,background:'rgba(239,68,68,0.7)'}}/><span style={{fontSize:10}}>Custo</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
