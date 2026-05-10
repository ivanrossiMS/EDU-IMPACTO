'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, ShieldAlert, CheckCircle, Clock,
  Users, AlertTriangle, Info, Presentation, 
  CreditCard, Activity, Target, Shield, GraduationCap, XOctagon,
  Filter, Download, ArrowDownToLine, Printer, LayoutList, Calendar
} from 'lucide-react'
import { PieChart as PieChartIconLucide } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

// Valor padrão caso a base não tenha o valor mensalidade explícito.
const TICKET_MEDIO_BASE = 950 

const fmtMoeda = (nv: number) => nv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MODE_CONFIG = {
  secretaria: {
    color: '#3b82f6',
    icon: <Users size={16} />,
    title: 'Secretaria (Operacional)',
    desc: 'Foco em resolução de incidentes e comunicação escolar.'
  },
  financeiro: {
    color: '#ef4444',
    icon: <Wallet size={16} />,
    title: 'Financeiro (Risco Evasão)',
    desc: 'Impacto do comportamento no MRR e churn de contratos.'
  }
}

export default function OcorrenciasDashboardPage() {
  const [viewMode, setViewMode] = useState<'secretaria' | 'financeiro'>('secretaria')
  
  // Scoped Filters State
  const [filtroNivel, setFiltroNivel] = useState('Todos')
  const [filtroTurma, setFiltroTurma] = useState('Todas')
  const [filtroAluno, setFiltroAluno] = useState('Todos')
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')

  // Data Fetching
  const { ocorrencias: rawOc, turmas: rawTurmas } = useData()
  const [rawAlunos] = useSupabaseArray<any>('alunos')

  const ocorrencias = Array.isArray(rawOc) ? rawOc : []
  const turmas = Array.isArray(rawTurmas) ? rawTurmas : []
  const alunos = Array.isArray(rawAlunos) ? rawAlunos : []

  // Derived Filter Options
  const niveisHabilitados = useMemo(() => Array.from(new Set(turmas.map(t => t.serie).filter(Boolean))).sort(), [turmas])
  const turmasHabilitadas = useMemo(() => {
    return turmas.filter(t => filtroNivel === 'Todos' || t.serie === filtroNivel).sort((a,b) => a.nome.localeCompare(b.nome))
  }, [turmas, filtroNivel])
  const alunosHabilitados = useMemo(() => {
    return alunos.filter(a => {
      const t = turmas.find(tx => tx.nome === a.turma || tx.id === (a as any).turmaId)
      if (filtroNivel !== 'Todos' && t?.serie !== filtroNivel) return false;
      if (filtroTurma !== 'Todas' && a.turma !== filtroTurma) return false;
      return true
    }).sort((a,b) => a.nome.localeCompare(b.nome))
  }, [alunos, turmas, filtroNivel, filtroTurma])

  // Global Engine
  const dataEngine = useMemo(() => {
    // Aplicação dos filtros master no Array Principal antes de qualquer matemática
    const ocorrenciasFiltradas = ocorrencias.filter(o => {
      const al = alunos.find(a => a.id === o.alunoId)
      const t = turmas.find(tx => tx.nome === (al?.turma || o.turma))
      
      if (filtroNivel !== 'Todos' && t?.serie !== filtroNivel) return false
      if (filtroTurma !== 'Todas' && (al?.turma || o.turma) !== filtroTurma) return false
      if (filtroAluno !== 'Todos' && o.alunoId !== filtroAluno) return false
      
      if (dataInicial && o.data && new Date(o.data) < new Date(dataInicial + 'T00:00:00')) return false
      if (dataFinal && o.data && new Date(o.data) > new Date(dataFinal + 'T23:59:59')) return false

      return true
    })

    // 1. Dossiê Aluno-Risco
    const alunosStats = new Map()
    let pendentesSecretaria = 0
    let ocorrenciasGraves = 0

    const distribFrequencia: Record<string, number> = {}

    ocorrenciasFiltradas.forEach(o => {
      const ehGrave = o.gravidade === 'grave'
      const pendeAcao = !o.ciencia_responsavel

      if (pendeAcao) pendentesSecretaria++
      if (ehGrave) ocorrenciasGraves++

      distribFrequencia[o.tipo] = (distribFrequencia[o.tipo] || 0) + 1

      if (!alunosStats.has(o.alunoId)) {
        const al = alunos.find(a => a.id === o.alunoId)
        alunosStats.set(o.alunoId, {
          id: o.alunoId,
          nome: o.alunoNome,
          turma: al?.turma || o.turma || 'Sem Turma',
          total: 0,
          graves: 0,
          pendentes: 0,
          ticket: al?.valorMensalidade || TICKET_MEDIO_BASE,
          ocorrencias: []
        })
      }
      const st = alunosStats.get(o.alunoId)
      st.total++
      if (ehGrave) st.graves++
      if (pendeAcao) st.pendentes++
      st.ocorrencias.push(o)
    })

    const listaAlunos = Array.from(alunosStats.values()).map(a => {
      let risco: 'alto' | 'medio' | 'baixo' = 'baixo'
      // Risco Alto: 3 ou mais ocorrências TOTAIS, ou 1 ou mais GRAVE.
      if (a.graves >= 1 || a.total >= 3) risco = 'alto'
      // Risco Médio: 2 ocorrências, sem gravidade.
      else if (a.total === 2) risco = 'medio'
      return { ...a, risco }
    }).sort((a,b) => b.total - a.total)

    // Agrupamentos Financeiros
    let mrrRiscoAlto = 0
    let mrrRiscoMedio = 0
    let mrrRiscoBaixo = 0
    let alunosRiscoAlto = 0

    listaAlunos.forEach(al => {
      if (al.risco === 'alto') {
        mrrRiscoAlto += al.ticket
        alunosRiscoAlto++
      }
      else if (al.risco === 'medio') mrrRiscoMedio += al.ticket
      else mrrRiscoBaixo += al.ticket
    })

    // Gráfico de Categoria
    const listaTipos = Object.entries(distribFrequencia).map(([t, c]) => ({ tipo: t, count: c })).sort((a,b) => b.count - a.count)

    // Agrupamento de Risco por Turma (Dinâmico conforme filtroNivel)
    const riscoTurmas = turmasHabilitadas.map(t => {
      const ocDaTurma = ocorrenciasFiltradas.filter(o => o.turma === t.nome)
      const alunosTurmaRisco = listaAlunos.filter(la => la.turma === t.nome && la.risco === 'alto')
      const mrrAmeacado = alunosTurmaRisco.reduce((acc, curr) => acc + curr.ticket, 0)
      return {
        nome: t.nome,
        volume: ocDaTurma.length,
        alunosAmeacados: alunosTurmaRisco.length,
        mrrAmeacado
      }
    }).filter(t => t.volume > 0).sort((a,b) => b.mrrAmeacado - a.mrrAmeacado)

    return {
      total: ocorrenciasFiltradas.length,
      pendentesSecretaria,
      ocorrenciasGraves,
      listaAlunos,
      mrrRiscoAlto,
      mrrRiscoMedio,
      alunosRiscoAlto,
      listaTipos,
      riscoTurmas,
      ocorrenciasLista: ocorrenciasFiltradas
    }
  }, [ocorrencias, alunos, turmas, filtroNivel, filtroTurma, filtroAluno, dataInicial, dataFinal, turmasHabilitadas])

  const handleImprimirRelatorio = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Relatório Executivo de Ocorrências</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #111827; background: #fff; }
            h1 { font-size: 24px; color: #111827; margin-bottom: 5px; }
            .header-info { font-size: 13px; color: #6b7280; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; }
            .kpi-row { display: flex; gap: 20px; margin-bottom: 30px; }
            .kpi { flex: 1; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; text-align: center; }
            .kpi-title { font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 10px; }
            .kpi-val { font-size: 28px; font-weight: 900; color: #111827; }
            .kpi-red .kpi-title { color: #ef4444; }
            .kpi-red .kpi-val { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px 16px; text-align: left; }
            th { background: #f3f4f6; font-weight: bold; color: #4b5563; text-transform: uppercase; font-size: 11px; }
            .r-alto { color: #dc2626; font-weight: bold; background: #fef2f2; }
            .r-medio { color: #d97706; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Relatório Consolidado de Ocorrências / Risco</h1>
          <div class="header-info">
            Filtros Aplicados: <br/>
            <strong>Período:</strong> ${dataInicial ? new Date(dataInicial + 'T12:00:00').toLocaleDateString('pt-BR') : 'Início'} até ${dataFinal ? new Date(dataFinal + 'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje'} | 
            <strong>Nível de Ensino:</strong> ${filtroNivel} | 
            <strong>Turma:</strong> ${filtroTurma} | 
            <strong>Aluno:</strong> ${filtroAluno === 'Todos' ? 'Todos' : dataEngine.listaAlunos[0]?.nome}
          </div>
          
          <div class="kpi-row">
            <div class="kpi">
              <div class="kpi-title">Total de Infrações</div>
              <div class="kpi-val">${dataEngine.total}</div>
            </div>
            <div class="kpi kpi-red">
              <div class="kpi-title">MRR Ameaçado (Risco Alto)</div>
              <div class="kpi-val">R$ ${fmtMoeda(dataEngine.mrrRiscoAlto)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Casos Graves Infratores</div>
              <div class="kpi-val">${dataEngine.ocorrenciasGraves}</div>
            </div>
          </div>

          <h2>Detalhamento por Aluno (Dossiê)</h2>
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Turma</th>
                <th>Ocorrências Totais</th>
                <th>Casos Graves</th>
                <th>Classificação de Risco</th>
                <th>MRR Exposto</th>
              </tr>
            </thead>
            <tbody>
              ${dataEngine.listaAlunos.map(a => `
                <tr class="${a.risco === 'alto' ? 'r-alto' : a.risco === 'medio' ? 'r-medio' : ''}">
                  <td>${a.nome}</td>
                  <td>${a.turma}</td>
                  <td>${a.total}</td>
                  <td>${a.graves}</td>
                  <td style="text-transform: capitalize;">${a.risco}</td>
                  <td>R$ ${fmtMoeda(a.ticket)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2 style="margin-top: 40px;">Histórico Detalhado (Lançamentos)</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Turma</th>
                <th>Aluno</th>
                <th>Tipologia</th>
                <th>Descrição</th>
                <th>Gravidade</th>
              </tr>
            </thead>
            <tbody>
              ${dataEngine.ocorrenciasLista.map((oc: any) => `
                <tr>
                  <td>${oc.data ? new Date(oc.data).toLocaleDateString('pt-BR') : 'S/D'}</td>
                  <td>${oc.turma}</td>
                  <td>${oc.alunoNome}</td>
                  <td>${oc.tipo}</td>
                  <td>${oc.descricao || '-'}</td>
                  <td style="text-transform: uppercase;">${oc.gravidade || 'LEVE'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }

  const modeTheme = MODE_CONFIG[viewMode].color
  const isSec = viewMode === 'secretaria'

  // Auxiliares Recharts
  const rAltoColor = '#dc2626'
  const rMedioColor = '#f59e0b'

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 60, fontFamily: 'Outfit, sans-serif' }}>
      
      {/* HEADER COMPACTO DA PÁGINA */}
      <div style={{ padding: '32px 32px 16px', background: 'var(--gradient-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `linear-gradient(135deg, ${modeTheme}, ${modeTheme}80)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 8px 24px ${modeTheme}40`,
            color: '#fff', transition: 'background 0.3s'
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-base))', letterSpacing: '-0.02em', margin: 0 }}>
              Inteligência de Ocorrências
            </h1>
            <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
              Perspectiva bidirecional: Gestão de Atendimento (Secretaria) vs Prevenção de Evasão (Financeiro).
            </p>
          </div>
          
          <button className="btn btn-secondary" onClick={handleImprimirRelatorio} style={{ marginLeft: 'auto', gap: 6, fontWeight: 700, borderRadius: 12 }}>
            <Printer size={16} /> Emitir Relatório Executivo
          </button>
        </div>

        {/* TABS SEGMENTADOS */}
        <div style={{ display: 'flex', gap: 4, position: 'relative', zIndex: 1 }}>
          {(['secretaria', 'financeiro'] as const).map(m => {
            const act = viewMode === m
            const mod = MODE_CONFIG[m]
            return (
              <button key={m} onClick={() => setViewMode(m)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '14px 24px',
                borderRadius: '12px 12px 0 0', cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid', borderBottom: 'none',
                borderColor: act ? `hsl(var(--border-subtle))` : 'transparent',
                background: act ? 'hsl(var(--bg-elevated))' : 'transparent',
                color: act ? mod.color : 'hsl(var(--text-muted))',
                fontWeight: act ? 800 : 600, fontSize: 13, transition: 'all 0.2s',
                boxShadow: act ? '0 -4px 12px rgba(0,0,0,0.02)' : 'none'
              }}>
                {mod.icon} {act ? mod.title : m === 'secretaria' ? 'Secretaria' : 'Financeiro'}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ─── FILTROS GLOBAIS HIERÁRQUICOS ─── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: 'hsl(var(--bg-elevated))', padding: '16px 20px', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--text-muted))', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', marginRight: 8 }}>
            <Filter size={15} /> Escopo Analítico
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
             <label style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Data Inicial</label>
             <div style={{ position: 'relative' }}>
               <Calendar size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
               <input type="date" className="form-input" value={dataInicial} onChange={e => setDataInicial(e.target.value)} style={{ fontWeight: 600, paddingLeft: 30, width: '100%', fontSize: 12 }} />
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
             <label style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Data Final</label>
             <div style={{ position: 'relative' }}>
               <Calendar size={14} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
               <input type="date" className="form-input" value={dataFinal} onChange={e => setDataFinal(e.target.value)} style={{ fontWeight: 600, paddingLeft: 30, width: '100%', fontSize: 12 }} />
             </div>
          </div>

          <div style={{ width: 1, height: 32, background: 'hsl(var(--border-subtle))', margin: '0 4px', display: 'none' }} className="calendar-divider"></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 150px' }}>
             <label style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Nível de Ensino</label>
             <select className="form-input" value={filtroNivel} onChange={e => {setFiltroNivel(e.target.value); setFiltroTurma('Todas'); setFiltroAluno('Todos')}} style={{ fontWeight: 600 }}>
                <option value="Todos">Toda Escola (Global)</option>
                {niveisHabilitados.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
             <label style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Turma</label>
             <select className="form-input" value={filtroTurma} onChange={e => {setFiltroTurma(e.target.value); setFiltroAluno('Todos')}} style={{ fontWeight: 600 }}>
                <option value="Todas">Todas as Turmas do Nível</option>
                {turmasHabilitadas.map(t => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
             </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
             <label style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Aluno Específico</label>
             <select className="form-input" value={filtroAluno} onChange={e => setFiltroAluno(e.target.value)} style={{ fontWeight: 600 }}>
                <option value="Todos">Todos os Alunos Filtrados</option>
                {alunosHabilitados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
             </select>
          </div>
        </div>

        {/* INFO BOX TEMA DO MODELO */}
        <div style={{ padding: '16px 24px', background: `${modeTheme}08`, border: `1px solid ${modeTheme}20`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5, maxWidth: 1000, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} color={modeTheme} />
            {isSec 
             ? <span><b>Gestão de Reputação e Resolução:</b> O foco operacional para o Secretário é localizar gargalos e alertar famílias, varrendo todos os chamados abertos.</span> 
             : <span><b>Inteligência Financeira Contra o Churn:</b> Avalia a propensão contínua de cancelamento e o dano de Retenção de Receita Contratual alocados aos alunos críticos de indisciplina.</span>}
          </span>
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
            
            {/* ─── KPIS HERO ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              
              {/* Card 1: Variavel de acordo com Modelo */}
              {isSec ? (
                <div style={{ background: 'hsl(var(--bg-elevated))', border: `1px solid hsl(var(--border-subtle))`, borderLeft: `8px solid ${modeTheme}`, borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                    <Clock size={16} color={modeTheme} /> Operação Pendente
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: 'hsl(var(--text-base))', margin: '8px 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {dataEngine.pendentesSecretaria} <span style={{fontSize:20, color:'hsl(var(--text-muted))', fontWeight:700}}>chamados</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Que aguardam contato ou ciência da família.</div>
                </div>
              ) : (
                <div style={{ background: 'linear-gradient(135deg, hsl(var(--bg-elevated)) 0%, rgba(220,38,38,0.03) 100%)', border: `1px solid #dc262640`, borderLeft: `8px solid #dc2626`, borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                    <Target size={16} /> Receita iminente ao Churn (Alto Risco)
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: '#dc2626', margin: '8px 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    R$ {fmtMoeda(dataEngine.mrrRiscoAlto)}
                  </div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Recurrent Revenue ligado a {dataEngine.alunosRiscoAlto} matrículas graves/reincidentes.</div>
                </div>
              )}

              {/* Card 2: Fixo / Comparativo */}
              <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                  <Activity size={16} color="#8b5cf6" /> Densidade Recortada
                </div>
                <div style={{ fontSize: 44, fontWeight: 900, color: 'hsl(var(--text-base))', margin: '8px 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {dataEngine.total} <span style={{fontSize:20, color:'hsl(var(--text-muted))', fontWeight:700}}>registros</span>
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Sendo {dataEngine.ocorrenciasGraves} infrações que exigiram sanção máxima.</div>
              </div>

              {/* Card 3: Variavel de acordo com Modelo */}
              {isSec ? (
                <div style={{ background: 'hsl(var(--bg-elevated))', border: `1px solid hsl(var(--border-subtle))`, borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', justifyItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                      <CheckCircle size={16} color="#10b981" /> Cadência Resolutiva
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: 'hsl(var(--text-base))', margin: '8px 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {((dataEngine.total - dataEngine.pendentesSecretaria)/Math.max(dataEngine.total,1)*100).toFixed(0)}<span style={{fontSize:24}}>%</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Índice de ocorrências respondidas e engajadas.</div>
                </div>
              ) : (
                <div style={{ background: 'hsl(var(--bg-elevated))', border: `1px solid hsl(var(--border-subtle))`, borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', justifyItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                      <AlertTriangle size={16} color="#f59e0b" /> Risco Moderado Suplementar
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: 'hsl(var(--text-base))', margin: '8px 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      R$ {fmtMoeda(dataEngine.mrrRiscoMedio)}
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Matrículas com inflamação não-grave ou isolada.</div>
                </div>
              )}

            </div>

            {/* ─── ÁREA DE GRÁFICOS ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(300px, 450px)', gap: 16 }}>
              
              <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-base))', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isSec ? <><Presentation size={16} color={modeTheme} /> Frequência de Tipologias Disciplinares (No Filtro Aplicado)</> : <><Presentation size={16} color={modeTheme} /> Perda de Receita Ameaçada (Por Turma Filtrada)</>}
                </h2>
                
                {isSec ? (
                  // Gráfico Secretaria: Tipologia
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataEngine.listaTipos} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border-subtle))" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }} />
                        <YAxis type="category" dataKey="tipo" axisLine={false} tickLine={false} width={100} tick={{ fill: 'hsl(var(--text-base))', fontSize: 12, fontWeight: 600 }} />
                        <Tooltip cursor={{ fill: 'rgba(128,128,128,0.05)' }} contentStyle={{ background: 'hsl(var(--bg-overlay))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12 }} />
                        <Bar dataKey="count" fill={modeTheme} radius={[0,6,6,0]} barSize={24} name="Ocorrências" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  // Gráfico Financeiro: Churn Turma
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataEngine.riscoTurmas.slice(0, 5)} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-subtle))" />
                        <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#dc2626', fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                        <Tooltip cursor={{ fill: 'rgba(128,128,128,0.05)' }} contentStyle={{ background: 'hsl(var(--bg-overlay))', border: '1px solid #dc262640', borderRadius: 12 }} formatter={((v:number) => [`R$ ${fmtMoeda(v)}`, "Recurrent Revenue (MRR) Ameaçado"]) as any} />
                        <Bar dataKey="mrrAmeacado" fill="#dc2626" radius={[6,6,0,0]} barSize={32} name="Capital em Risco" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Rosca de Severidade / Risco */}
              <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-base))', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChartIconLucide size={16} color={modeTheme} /> {isSec ? 'Grau de Severidade' : 'Participação no Risco (Evasão)'}
                </h2>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        {isSec ? (
                          <Pie 
                            data={[
                              { name: 'Leves/Médias', value: Math.max(dataEngine.total - dataEngine.ocorrenciasGraves, 0), color: '#3b82f6' },
                              { name: 'Graves', value: dataEngine.ocorrenciasGraves, color: '#dc2626' }
                            ].filter(d => d.value > 0)} 
                            dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={85} stroke="none"
                          >
                            <Cell key="1" fill="#3b82f6" />
                            <Cell key="2" fill="#dc2626" />
                          </Pie>
                        ) : (
                          <Pie 
                            data={[
                              { name: 'Risco Alto', value: dataEngine.mrrRiscoAlto, color: '#dc2626' },
                              { name: 'Risco Médio', value: dataEngine.mrrRiscoMedio, color: '#f59e0b' }
                            ].filter(d => d.value > 0)} 
                            dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={85} stroke="none"
                          >
                            <Cell key="1" fill="#dc2626" />
                            <Cell key="2" fill="#f59e0b" />
                          </Pie>
                        )}
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-base))', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} formatter={((v:number) => [isSec ? v : `R$ ${fmtMoeda(v)}`, isSec ? 'Ocorrências' : 'R$']) as any} />
                      </PieChart>
                    </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ─── DOSSIÊ CORPORATIVO ─── */}
            <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${modeTheme}08` }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-base))', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={18} color={modeTheme} /> Dossiê de Inteligência ({isSec ? 'Alunos Infratores e Reincidentes' : 'Mapa de Retenção Crítica'})
                </h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                    <tr>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>Aluno / Setup</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Total Incidentes</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Gravidades</th>
                      {!isSec && <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Risco Evasão (MRR)</th>}
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Status da Interface</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataEngine.listaAlunos.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Nenhuma anomalia disciplinar detectada no agrupamento filtrado.</td></tr>
                    ) : dataEngine.listaAlunos.map((al, idx) => {
                      const riskColor = al.risco === 'alto' ? rAltoColor : al.risco === 'medio' ? rMedioColor : 'hsl(var(--border-subtle))'
                      
                      // Filtragense Exibição Especial
                      if (isSec && al.total === 0) return null 
                      if (!isSec && al.risco === 'baixo') return null

                      return (
                        <motion.tr key={al.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay: idx*0.05}} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-base))' }}>{al.nome}</div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <GraduationCap size={12}/> Turma: {al.turma}
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <span style={{ fontSize: 15, fontWeight: 900, color: 'hsl(var(--text-base))', fontFamily: 'Outfit, sans-serif' }}>
                              {al.total}x
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            {al.graves > 0 ? (
                              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(220,38,38,0.1)', color: '#dc2626', fontWeight: 800 }}>⛔ {al.graves} Graves</span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Sem registros críticos</span>
                            )}
                          </td>
                          
                          {!isSec && (
                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                              <span style={{ fontSize: 14, fontWeight: 900, color: riskColor, fontFamily: 'Outfit, sans-serif' }}>
                                R$ {fmtMoeda(al.ticket)}
                              </span>
                              <div style={{ fontSize: 10, color: riskColor, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{al.risco} RISCO</div>
                            </td>
                          )}

                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            {al.pendentes > 0 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 800 }}>
                                <Clock size={12}/> {al.pendentes} Abertas
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 800 }}>
                                <CheckCircle size={12}/> Finalizadas
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── HISTÓRICO DE LANÇAMENTOS (ITEMIZADO) ─── */}
            <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${modeTheme}08` }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-base))', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LayoutList size={18} color={modeTheme} /> Histórico Detalhado de Ocorrências
                </h2>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 600 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))', position: 'sticky', top: 0, zIndex: 5 }}>
                    <tr>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Data</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Aluno / Turma</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Tipologia / Relato</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', textAlign: 'center' }}>Severidade</th>
                      <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', textAlign: 'right' }}>Registro / Lançamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataEngine.ocorrenciasLista.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Nenhum lançamento corresponde aos filtros atuais.</td></tr>
                    ) : dataEngine.ocorrenciasLista.map((oc: any) => (
                      <tr key={oc.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                        <td style={{ padding: '16px 24px', fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600, verticalAlign: 'top' }}>
                          {oc.data ? new Date(oc.data).toLocaleDateString('pt-BR') : 'S/D'}
                        </td>
                        <td style={{ padding: '16px 24px', verticalAlign: 'top' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-base))' }}>{oc.alunoNome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Turma: {oc.turma}</div>
                        </td>
                        <td style={{ padding: '16px 24px', verticalAlign: 'top' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-base))' }}>{oc.tipo}</div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4, maxWidth: 350, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{oc.descricao || <span style={{opacity:0.5}}>Sem descrição complementar.</span>}</div>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center', verticalAlign: 'top' }}>
                            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: oc.gravidade==='grave' ? 'rgba(220,38,38,0.1)' : oc.gravidade==='media' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', color: oc.gravidade==='grave' ? '#dc2626' : oc.gravidade==='media' ? '#f59e0b' : '#3b82f6', fontWeight: 800, textTransform: 'uppercase' }}>
                              {oc.gravidade || 'LEVE'}
                            </span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', verticalAlign: 'top' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-base))' }}>{oc.responsavel || 'Sistema'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
