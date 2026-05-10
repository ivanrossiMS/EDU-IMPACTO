'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import {
  ArrowLeft, Search, TrendingUp, Layers, DollarSign,
  Percent, CreditCard, Activity, BarChart3, Presentation, Target, Wallet, GraduationCap, Info
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

const fmtMoeda = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TicketMedioPage() {
  const router = useRouter()
  const { turmas, cfgNiveisEnsino, titulos: globalTitulos = [] } = useData() || {}
  const [parcelasNovas] = useSupabaseArray<any>('financeiro/parcelas?limit=10000')
  const [alunos] = useSupabaseArray<any>('alunos')
  const [titulosLocal] = useSupabaseArray<any>('titulos')

  const realTitulos = globalTitulos?.length > 0 ? globalTitulos : titulosLocal

  const [periodoTipo, setPeriodoTipo] = useState<'mes'|'ano'>('mes')
  const [mesAlvo, setMesAlvo] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [anoAlvo, setAnoAlvo] = useState(new Date().getFullYear().toString())
  const [search, setSearch] = useState('')
  
  // O Estado Herói: qual perspectiva do relatório estamos visualizando
  const [viewMode, setViewMode] = useState<'contratual' | 'comercial' | 'financeiro'>('financeiro')

  // ─── CORE CALCULATION ENGINE (OMNI-FETCH) ───
  const { stats, turmasRows, niveisResumo } = useMemo(() => {
    let rawTotalAlunos = 0
    let mrrTotalCheio = 0
    let mrrTotalDesconto = 0
    let mrrTotalLiquido = 0
    let mrrTotalDescontoComercial = 0
    let mrrTotalComercial = 0
    
    // Agrupamento por Turma
    const turmaMap: Record<string, {
      id: string, nome: string, nivel: string, turno: string, alunosMatriculados: number,
      valorCheio: number, descontosFin: number, valorLiquido: number, descontosComer: number, valorComercial: number
    }> = {}

    // Parser à prova de falhas com decimais BR ou Numéricos
    const parseMoedaBR = (v: any) => {
      if (typeof v === 'number') return v;
      if (!v) return 0;
      let s = String(v).replace(/[^0-9.,-]/g, '').trim(); 
      if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    // 1. Filtrar alunos ativos
    const alunosAtivos = (alunos || []).filter(a => {
      const st = (a.status || a.situacao || '').toLowerCase()
      return st === 'matriculado' || st === 'cursando' || st === 'ativo'
    })

    rawTotalAlunos = alunosAtivos.length

    alunosAtivos.forEach(a => {
      // Identificar turma
      const tId = a.turmaId || a.turma_id
      const turmaObj = (turmas?.find((t: any) => t.id === tId) || turmas?.find((t: any) => t.nome === a.turma)) as any
      const tNome = turmaObj ? turmaObj.nome : (a.turma || 'Sem Turma')
      
      if (!turmaMap[tNome]) {
        let nivel = 'Ensino Geral'
        
        const codigoBusca = turmaObj?.serie || turmaObj?.dados?.serie
        if (codigoBusca) {
          const nv = cfgNiveisEnsino?.find((n: any) => n.codigo === codigoBusca)
          if (nv) nivel = nv.nome
        }
        
        if (nivel === 'Ensino Geral') {
          const idBusca = turmaObj?.nivel_ensino_id || turmaObj?.nivelId || turmaObj?.dados?.nivel_ensino_id || turmaObj?.dados?.nivelId || turmaObj?.nivel_id
          if (idBusca) {
            const nv = cfgNiveisEnsino?.find((n: any) => String(n.id) === String(idBusca))
            if (nv) nivel = nv.nome
          }
        }

        if (nivel === 'Ensino Geral') {
          if (turmaObj?.nivel) {
            nivel = turmaObj.nivel
          } else if (turmaObj?.nome) {
            if (turmaObj.nome.toLowerCase().includes('infantil')) nivel = 'Educação Infantil'
            else if (turmaObj.nome.toLowerCase().includes('fundamental')) nivel = 'Ensino Fundamental'
            else if (turmaObj.nome.toLowerCase().includes('médio')) nivel = 'Ensino Médio'
          }
        }
        
        turmaMap[tNome] = {
          id: turmaObj?.id || tNome,
          nome: tNome,
          nivel: nivel,
          turno: turmaObj?.turno || 'Integral',
          alunosMatriculados: 0,
          valorCheio: 0, descontosFin: 0, valorLiquido: 0, descontosComer: 0, valorComercial: 0
        }
      }

      turmaMap[tNome].alunosMatriculados++

      let alunoCheio = 0
      let alunoDesc = 0
      let alunoDescComercial = 0
      let parcelasEncontradasMatches = 0

      const isAlvo = (p: any) => {
        if (p.status === 'cancelado') return false;
        const dtStr = p.vencimento;
        if (!dtStr) return false;
        
        let y = '', m = '';
        if (dtStr.includes('T')) {
           y = dtStr.slice(0,4); m = dtStr.slice(5,7);
        } else if (dtStr.includes('/')) {
           const parts = dtStr.split('/');
           y = parts[2]; m = parts[1];
        } else if (dtStr.includes('-')) {
           const parts = dtStr.split('-');
           y = parts[0]; m = parts[1];
        }
        
        if (!y) { y = dtStr.slice(0,4); m = dtStr.slice(5,7); }
        
        if (periodoTipo === 'ano') {
           return y === anoAlvo;
        } else {
           const targetY = mesAlvo.slice(0,4);
           const targetM = mesAlvo.slice(5,7);
           return y === targetY && m === targetM;
        }
      }

      const processParcela = (p: any) => {
        const vl = parseMoedaBR(p.valor);
        const originalDc = parseMoedaBR(p.desconto);
        let dc = originalDc;

        // Vencimento real
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const pd = (s:string) => new Date(s.split('/').reverse().join('-')+'T12:00');
        const dv = p.vencimento ? pd(p.vencimento) : hoje; dv.setHours(0,0,0,0);
        const isV = p.status === 'pendente' && dv < hoje;

        // Se passar da data, perde desconto (KPI FINANCEIRO REFLETE ISSO, MAS O COMERCIAL NÃO)
        if (p.manterDesconto === false && isV) dc = 0; 

        alunoCheio += vl;
        alunoDesc += dc; // Financeiro Real (Sofre Perda)
        alunoDescComercial += originalDc; // Comercial (Base Estratégica original)
        parcelasEncontradasMatches++;
      }

      const embedded = Array.isArray(a.parcelas) ? a.parcelas : Array.isArray(a.dados?.parcelas) ? a.dados.parcelas : [];
      embedded.forEach((p: any) => { if (isAlvo(p)) processParcela(p) })

      if (Array.isArray(realTitulos)) {
        realTitulos.forEach(tit => {
          const matchId = tit.alunoId && tit.alunoId === a.id;
          const matchName = tit.aluno && a.nome && tit.aluno.trim().toLowerCase() === a.nome.trim().toLowerCase();
          if ((matchId || matchName) && isAlvo(tit)) processParcela(tit)
        })
      }

      if (Array.isArray(parcelasNovas)) {
        parcelasNovas.forEach(p => {
          const eventAlunoId = Array.isArray(p.fin_eventos) ? p.fin_eventos[0]?.aluno_id : p.fin_eventos?.aluno_id;
          if (eventAlunoId === a.id && isAlvo(p)) processParcela(p)
        })
      }

      if (periodoTipo === 'ano') {
         if (parcelasEncontradasMatches > 0) {
             alunoCheio = (alunoCheio / parcelasEncontradasMatches) * 12;
             alunoDesc = (alunoDesc / parcelasEncontradasMatches) * 12;
             alunoDescComercial = (alunoDescComercial / parcelasEncontradasMatches) * 12;
         } else {
             alunoCheio = parseMoedaBR(a.valorMensalidade || a.dados?.financeiro?.valorMensalidade || 0) * 12;
             alunoDesc = parseMoedaBR(a.descontoMensalidade || a.dados?.financeiro?.descontoMensalidade || 0) * 12;
             alunoDescComercial = alunoDesc;
         }
      } else {
         if (alunoCheio === 0) {
             alunoCheio = parseMoedaBR(a.valorMensalidade || a.dados?.financeiro?.valorMensalidade || 0);
             alunoDesc = parseMoedaBR(a.descontoMensalidade || a.dados?.financeiro?.descontoMensalidade || 0);
             alunoDescComercial = alunoDesc;
         }
      }

      mrrTotalCheio += alunoCheio
      mrrTotalDesconto += alunoDesc
      mrrTotalDescontoComercial += alunoDescComercial
      mrrTotalLiquido += Math.max(0, alunoCheio - alunoDesc)
      mrrTotalComercial += Math.max(0, alunoCheio - alunoDescComercial)

      turmaMap[tNome].valorCheio += alunoCheio
      turmaMap[tNome].descontosFin += alunoDesc
      turmaMap[tNome].descontosComer += alunoDescComercial
      turmaMap[tNome].valorLiquido += Math.max(0, alunoCheio - alunoDesc)
      turmaMap[tNome].valorComercial += Math.max(0, alunoCheio - alunoDescComercial)
    })

    // Processamento Níveis de Ensino Chart
    const nMap: Record<string, { nome: string, alunos: number, receitaCheia: number, receitaComercial: number, receitaLiquida: number }> = {}
    
    const tRows = Object.values(turmaMap).map(t => {
      if (!nMap[t.nivel]) nMap[t.nivel] = { nome: t.nivel, alunos: 0, receitaCheia: 0, receitaComercial: 0, receitaLiquida: 0 }
      nMap[t.nivel].alunos += t.alunosMatriculados
      nMap[t.nivel].receitaCheia += t.valorCheio
      nMap[t.nivel].receitaComercial += t.valorComercial
      nMap[t.nivel].receitaLiquida += t.valorLiquido

      return {
        ...t,
        ticketContratual: t.alunosMatriculados > 0 ? t.valorCheio / t.alunosMatriculados : 0,
        ticketComercial: t.alunosMatriculados > 0 ? t.valorComercial / t.alunosMatriculados : 0,
        ticketFinanceiro: t.alunosMatriculados > 0 ? t.valorLiquido / t.alunosMatriculados : 0
      }
    })

    const nResumo = Object.values(nMap).map(n => ({
      ...n,
      ticketContratual: n.alunos > 0 ? n.receitaCheia / n.alunos : 0,
      ticketComercial: n.alunos > 0 ? n.receitaComercial / n.alunos : 0,
      ticketFinanceiro: n.alunos > 0 ? n.receitaLiquida / n.alunos : 0
    })).sort((a,b) => b.ticketFinanceiro - a.ticketFinanceiro) // Ordena pelo menor ARPU

    return {
      stats: {
        totalAlunos: rawTotalAlunos,
        mrrCheio: mrrTotalCheio,
        mrrDescFin: mrrTotalDesconto,
        mrrDescComer: mrrTotalDescontoComercial,
        mrrLiq: mrrTotalLiquido,
        mrrComer: mrrTotalComercial,
        ticketContratual: rawTotalAlunos > 0 ? mrrTotalCheio / rawTotalAlunos : 0,
        ticketComercial: rawTotalAlunos > 0 ? mrrTotalComercial / rawTotalAlunos : 0,
        ticketFinanceiro: rawTotalAlunos > 0 ? mrrTotalLiquido / rawTotalAlunos : 0
      },
      turmasRows: tRows,
      niveisResumo: nResumo
    }

  }, [alunos, turmas, titulosLocal, globalTitulos, parcelasNovas, cfgNiveisEnsino, mesAlvo, anoAlvo, periodoTipo])

  const dispRows = turmasRows
    .filter(t => t.nome.toLowerCase().includes(search.toLowerCase()) || t.nivel.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // Order By Current Metric Mode
      if (viewMode === 'contratual') return b.valorCheio - a.valorCheio
      if (viewMode === 'comercial') return b.valorComercial - a.valorComercial
      return b.valorLiquido - a.valorLiquido
    })

  // VARIÁVEIS DE PERSPECTIVA (Adaptam a UI baseada na Tab Selecionada)
  const isFinanceiro = viewMode === 'financeiro'
  const isComercial = viewMode === 'comercial'
  const isContratual = viewMode === 'contratual'

  const heroM = isContratual ? stats.ticketContratual : (isComercial ? stats.ticketComercial : stats.ticketFinanceiro)
  const heroR = isContratual ? stats.mrrCheio : (isComercial ? stats.mrrComer : stats.mrrLiq)
  const heroDesc = isContratual ? 0 : (isComercial ? stats.mrrDescComer : stats.mrrDescFin)

  const modeTheme = isContratual ? '#3b82f6' : (isComercial ? '#8b5cf6' : '#10b981')

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--bg-base))' }}>
      
      {/* HEADER C-LEVEL */}
      <div style={{
        padding: '24px 32px 0 32px',
        background: 'linear-gradient(135deg, #0f172a 0%, #171723 50%, #1e1b4b 100%)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
        display: 'flex', flexDirection: 'column', gap: 16,
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -100, right: -50, width: 400, height: 400, background: `radial-gradient(circle, ${modeTheme}20 0%, transparent 60%)`, filter: 'blur(40px)', pointerEvents: 'none', transition: 'background 0.5s' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1, paddingBottom: 16 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 8, color: '#fff', cursor: 'pointer' }} title="Voltar">
             <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: 1 }}>
            <Activity size={14} /> Relatórios Financeiros /
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1, paddingBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 12 }}>
              Ticket Médio Global 
              <span style={{ fontSize: 11, padding: '4px 10px', background: `linear-gradient(135deg, ${modeTheme}, ${modeTheme}99)`, color: '#fff', borderRadius: 20, letterSpacing: 1, boxShadow: `0 4px 12px ${modeTheme}40` }}>MODELO ATIVO</span>
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>Selecione a perspectiva analítica: Contratual (Bruto), Comercial (Estratégico) ou Financeiro (Caixa).</p>
          </div>
          
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
             <div style={{ display: 'flex', gap: 8 }}>
               <select 
                 value={periodoTipo} 
                 onChange={e => setPeriodoTipo(e.target.value as any)}
                 style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none' }}
               >
                 <option value="mes" style={{color:'#000'}}>Mês Vigente</option>
                 <option value="ano" style={{color:'#000'}}>Ano Todo</option>
               </select>

               {periodoTipo === 'mes' ? (
                  <input 
                    type="month" 
                    value={mesAlvo} 
                    onChange={e => setMesAlvo(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none' }}
                  />
               ) : (
                  <input 
                    type="number" 
                    value={anoAlvo} 
                    onChange={e => setAnoAlvo(e.target.value)}
                    min={2000} max={2100}
                    style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', width: 90 }}
                  />
               )}
             </div>
          </div>
        </div>

        {/* TABS SEGMENTED CONTROL */}
        <div style={{ display: 'flex', gap: 4, position: 'relative', zIndex: 1, paddingBottom: 0 }}>
          {[
            { id: 'contratual', label: '1. Modelo Contratual', sub: 'Preço de Tabela Cheio', icon: <Presentation size={16}/> },
            { id: 'comercial', label: '2. Modelo Comercial', sub: 'Valor Vendido (C/ Bolsas)', icon: <Target size={16}/> },
            { id: 'financeiro', label: '3. Modelo Financeiro', sub: 'Valor Real de Caixa (ARPU)', icon: <Wallet size={16}/> },
          ].map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as any)}
              style={{
                flex: 1, padding: '16px', background: viewMode === tab.id ? 'hsl(var(--bg-base))' : 'transparent',
                border: 'none', borderTopLeftRadius: 12, borderTopRightRadius: 12, cursor: 'pointer',
                borderTop: viewMode === tab.id ? `3px solid ${modeTheme}` : '1px solid transparent',
                color: viewMode === tab.id ? modeTheme : '#94a3b8', transition: 'all 0.2s', position: 'relative'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800 }}>
                   {tab.icon} {tab.label}
                 </div>
                 <div style={{ fontSize: 11, color: viewMode === tab.id ? 'hsl(var(--text-base))' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{tab.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1600, margin: '0 auto' }}>

        {/* LEGENDA EXPLICATIVA GERAL */}
        <div style={{ padding: '20px 24px', background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
             <Info size={16} /> Entendendo as Perspectivas (Modelos Analíticos)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, paddingLeft: 4 }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}><Presentation size={14}/> Contratual (Potencial Bruto)</span> 
                <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                  É o preço original de <b>Tabela</b>. Ignora qualquer bolsa ou desconto concedido e mostra o <i>potencial máximo de arrecadação</i> caso a instituição operasse com 100% de sua força de preço.
                </span>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14}/> Comercial (Estratégico Vendido)</span> 
                <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                  É o valor que o time comercial <b>efetivamente negociou</b>. Subtrai as bolsas e descontos oferecidos no ato da matrícula, mostrando a <i>erosão da margem</i> estratégica para captação.
                </span>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}><Wallet size={14}/> Financeiro (Recebível Real)</span> 
                <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                  É a expectativa do valor de <b>Caixa (ARPU Pura)</b>. Difere do comercial porque considera <i>perdas de pontualidade</i> (por exemplo, se o aluno pagar atrasado, ele perde o "desconto pontualidade" e o ticket Volta a subir aqui).
                </span>
             </div>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div 
            key={viewMode}
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 32 }}
          >
            {/* KPI DYNAMIC HEADER */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              
              {/* HERO KPI */}
              <div style={{
                  gridColumn: 'span 2', background: 'hsl(var(--bg-elevated))', border: `1px solid ${modeTheme}33`, borderRadius: 16, padding: 32,
                  boxShadow: '0 8px 16px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: modeTheme, filter: 'blur(50px)', opacity: 0.15 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: modeTheme }}>
                     <div style={{ width: 44, height: 44, borderRadius: 12, background: `${modeTheme}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={24}/></div>
                     <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>Ticket Médio {isContratual ? 'Contratual' : isComercial ? 'Comercial' : 'Financeiro'} {periodoTipo === 'ano' ? '(Ano)' : '(Mês)'}</div>
                  </div>
                  <div style={{ fontSize: 46, fontWeight: 900, color: 'hsl(var(--text-base))', marginTop: 16, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>R$</span> {fmtMoeda(heroM)}
                  </div>
                  <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginTop: 12, fontWeight: 500 }}>
                    {isContratual && 'Força de preço da Instituição (Base 100%).'}
                    {isComercial && 'Valor médio das carteiras com bolsas/descontos comerciais.'}
                    {isFinanceiro && 'Ticket médio real com puridade de mensalidade em Caixa.'}
                  </div>
              </div>

              {/* SECONDARY KPIs */}
              {[
                { tag: `${periodoTipo === 'ano' ? 'Receita Total' : 'MRR'} ${isContratual ? 'Original' : isComercial ? 'Vendido' : 'Líquido'}`, val: `R$ ${fmtMoeda(heroR)}`, sub: isContratual ? 'Se não houvesse bolsas/descontos' : 'Fluxo de operação embutido', col: modeTheme, ic: <TrendingUp size={20}/> },
                { tag: isContratual ? 'Abatimentos Ocultos' : (isComercial ? 'Erosão Comercial (Bolsas)' : 'Erosão no Caixa (Real)'), val: `R$ ${fmtMoeda(heroDesc)}`, sub: isContratual ? 'Sem cálculo nesta visão pura' : `${stats.mrrCheio > 0 ? ((heroDesc/stats.mrrCheio)*100).toFixed(1) : 0}% cedidos da margem original`, col: '#ef4444', ic: <Percent size={20}/> },
                { tag: 'Alunos Válidos', val: stats.totalAlunos.toString(), sub: 'Alunos ativos computados na base', col: '#f59e0b', ic: <Layers size={20}/> },
              ].map((k, i) => (
                <div key={i} style={{
                    background: 'hsl(var(--bg-elevated))', border: `1px solid hsl(var(--border-subtle))`, borderRadius: 16, padding: 24, boxShadow: '0 8px 16px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: k.col }}>
                       <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.col}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.ic}</div>
                       <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{k.tag}</div>
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'hsl(var(--text-base))', marginTop: 12, lineHeight: 1, letterSpacing: '-0.02em', opacity: (isContratual && i === 1) ? 0.3 : 1 }}>
                      {k.val}
                    </div>
                    <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 8, fontWeight: 500 }}>{k.sub}</div>
                </div>
              ))}

            </div>

            {/* CHARTS DYNAMIC SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.5fr) minmax(300px, 1fr)', gap: 24 }}>
              {/* NIVEIS DE ENSINO */}
              <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-base))', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={18} color={modeTheme} /> Performance por Nível Educacional
                </h2>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={niveisResumo} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-subtle))" />
                      <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--text-muted))', fontSize: 12, fontWeight: 600 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: modeTheme, fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(128,128,128,0.05)' }}
                        contentStyle={{ background: 'hsl(var(--bg-overlay))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, boxShadow: '0 12px 24px rgba(0,0,0,0.2)' }}
                        labelStyle={{ color: 'hsl(var(--text-muted))', fontWeight: 800, fontSize: 11, marginBottom: 4 }}
                        itemStyle={{ fontSize: 13, fontWeight: 700 }}
                        formatter={((v: number, n: string) => [ `R$ ${fmtMoeda(v)}`, n === 'receita' ? (isContratual ? 'Receita Bruta' : isComercial ? 'Receita Base' : 'Receita Líquida') : 'Ticket Médio' ]) as any}
                      />
                      <Bar yAxisId="left" dataKey={isContratual ? "receitaCheia" : (isComercial ? "receitaComercial" : "receitaLiquida")} fill={modeTheme} radius={[6,6,0,0]} barSize={40} name="receita" />
                      <Bar yAxisId="right" dataKey={isContratual ? "ticketContratual" : (isComercial ? "ticketComercial" : "ticketFinanceiro")} fill={`${modeTheme}80`} radius={[6,6,0,0]} barSize={20} name="ticketMedio" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* LIST OVERVIEW DYNAMIC */}
              <div style={{ background: `linear-gradient(180deg, hsl(var(--bg-elevated)) 0%, ${modeTheme}05 100%)`, border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-base))', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GraduationCap size={18} color={modeTheme} /> Ticket por Nível
                </h2>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                  {niveisResumo.map((n, i) => {
                    const tv = isContratual ? n.ticketContratual : (isComercial ? n.ticketComercial : n.ticketFinanceiro)
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'hsl(var(--bg-base))', borderRadius: 12, border: `1px solid ${modeTheme}15` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-base))' }}>{n.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{n.alunos} alunos matriculados</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: modeTheme }}>R$ {fmtMoeda(tv)}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))', marginTop: 2, textTransform: 'uppercase' }}>Ticket Médio</div>
                        </div>
                      </div>
                    )
                  })}
                  {niveisResumo.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>Sem dados para o período solicitado.</div>}
                </div>
              </div>
            </div>

            {/* TABLE DYNAMIC DOSSIE */}
            <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${modeTheme}08` }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-base))', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} color={modeTheme} /> Dossiê Completo Turma a Turma ({isContratual ? 'Contratual Original' : isComercial ? 'Vendas / Bolsas' : 'Financeiro Real'})
                </h2>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                    <input 
                      type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Pesquisar turma ou nível..." 
                      style={{ padding: '8px 14px 8px 36px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, width: 220, outline: 'none' }}
                    />
                  </div>
                </div>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'rgba(148,163,184,0.05)', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <tr>
                      <th style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>Série / Turma</th>
                      <th style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>Nível Operacional</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center', whiteSpace: 'nowrap' }}>Adesão (Alunos)</th>
                      
                      <th style={{ padding: '16px 24px', textAlign: 'right', whiteSpace: 'nowrap' }}>Receita {periodoTipo === 'ano' ? 'Anual' : 'Mensal'} {isContratual ? 'Cheia' : isComercial ? 'Comercial' : 'Líquida'}</th>
                      {!isContratual && <th style={{ padding: '16px 24px', textAlign: 'right', whiteSpace: 'nowrap' }}>Erosão (Desconto {isComercial ? 'Venda' : 'Caixa'})</th>}
                      
                      <th style={{ padding: '16px 24px', textAlign: 'right', whiteSpace: 'nowrap', color: modeTheme }}>Ticket Médio {isContratual ? 'Contratual' : isComercial ? 'Comercial' : 'Financeiro'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispRows.map((t, i) => {
                      const desc = isComercial ? t.descontosComer : t.descontosFin;
                      const avgDesc = t.alunosMatriculados > 0 ? (desc / t.alunosMatriculados) : 0;
                      const receita = isContratual ? t.valorCheio : isComercial ? t.valorComercial : t.valorLiquido;
                      const ticketM = isContratual ? t.ticketContratual : isComercial ? t.ticketComercial : t.ticketFinanceiro;
                      
                      return (
                        <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} 
                          style={{ borderBottom: '1px solid hsl(var(--border-subtle))', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = `${modeTheme}08`}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-base))' }}>{t.nome}</div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>{t.nivel}</div>
                            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2, textTransform: 'uppercase' }}>{t.turno}</div>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <span style={{ background: `${modeTheme}1a`, color: modeTheme, padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                              {t.alunosMatriculados}
                            </span>
                          </td>
                          
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-base))' }}>
                            R$ {fmtMoeda(receita)}
                          </td>
                          
                          {!isContratual && (
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: avgDesc > 0 ? '#ef4444' : 'hsl(var(--text-muted))' }}>
                              {avgDesc > 0 ? `- R$ ${fmtMoeda(desc)}` : 'R$ 0,00'}
                              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Média/aluno: - R$ {fmtMoeda(avgDesc)}</div>
                            </td>
                          )}

                          <td style={{ padding: '16px 24px', textAlign: 'right', fontFamily: 'monospace', fontSize: 15, fontWeight: 900, color: modeTheme }}>
                            R$ {fmtMoeda(ticketM)}
                          </td>
                        </motion.tr>
                      )
                    })}
                    {dispRows.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14, fontWeight: 600 }}>Nenhuma turma encontrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        </AnimatePresence>
      </div>
      <style>{`
        ::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
      `}</style>
    </div>
  )
}
