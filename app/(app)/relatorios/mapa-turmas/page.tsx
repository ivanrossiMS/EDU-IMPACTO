'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import {
  ArrowLeft, Search, Building2, Map, CreditCard,
  Users, AlertCircle, CheckCircle2, ChevronRight, BarChart3,
  PieChart, LayoutGrid, List, FileText, Download, TrendingDown,
  ChevronDown
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

// Define cores dos segmentos (Fallback caso css falhe)
const SEG_COLORS: Record<string, string> = {
  'EI': '#ec4899', // Educação Infantil
  'EF1': '#3b82f6', // Ensino Fund. Menos
  'EF2': '#10b981', // Ensino Fund. Maior
  'EM': '#f59e0b',  // Ensino Médio
  'DEFAULT': '#8b5cf6'
}

export default function MapaTurmasPremiumPage() {
  const router = useRouter()
  const { turmas, cfgNiveisEnsino, cfgSeries, mantenedores, cfgTurnos } = useData()
  const [titulos] = useSupabaseArray<any>('titulos')
  const [parcelasNovas] = useSupabaseArray<any>('financeiro/parcelas?limit=10000')
  const [alunos] = useSupabaseArray<any>('alunos')

  // ── States ──
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [filterUnidade, setFilterUnidade] = useState('')
  const [filterNivel, setFilterNivel] = useState('')
  const [filterTurno, setFilterTurno] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Animate Entrance
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ── Data Processing ──
  const realTurmas = Array.isArray(turmas) ? turmas : []
  const realAlunos = Array.isArray(alunos) ? alunos : []
  const realTitulos = Array.isArray(titulos) ? titulos : []

  const unidadesUnicas = useMemo(() => {
    if (!mantenedores) return []
    return Array.from(new Set(mantenedores.flatMap(m => m.unidades?.map(u => u.nomeFantasia || u.razaoSocial) || [])))
  }, [mantenedores])

  // Processa as turmas, juntando informações dos alunos vinculados a ela
  const turmasRicas = useMemo(() => {
    return realTurmas.map(t => {
      const tNome = (t.nome || '').trim().toLowerCase();
      const tCodigo = (t.codigo || '').trim().toLowerCase();
      
      // Pega alunos cruzando Nome da Turma ou ID de forma mais flexível
      const alunosDaTurma = realAlunos.filter(a => {
        const stats = (a.status || a.situacao || '').toLowerCase();
        // Apenas contabiliza quem está cursando/ativo
        const ativo = stats === 'matriculado' || stats === 'cursando' || stats === 'ativo';
        if (!ativo) return false;

        const aTurma = (a.turma || '').trim().toLowerCase();
        return aTurma === tNome || aTurma === tCodigo || a.turma_id === t.id || (a as any).turmaId === t.id;
      })
      
      const matriculadosReal = alunosDaTurma.length > 0 ? alunosDaTurma.length : (t.matriculados || 0)
      const capacidade = t.capacidade || 35
      const ocupacao = capacidade > 0 ? Math.min(100, Math.round((matriculadosReal / capacidade) * 100)) : 0
      
      const alunosInad = alunosDaTurma.filter(a => {
        // Tag direta no aluno
        if (a.inadimplente || a.statusFinanceiro === 'vencido') return true;
        
        const hojeStart = new Date();
        hojeStart.setHours(0,0,0,0);

        const checkVencido = (status: string, venc: string) => {
          const st = (status || '').toLowerCase();
          if (st === 'atrasado' || st === 'vencido') return true;
          if (st === 'pendente' && venc) {
            let dt: Date | null = null;
            if (venc.includes('T')) dt = new Date(venc);
            else if (venc.includes('/')) {
              const parts = venc.split('/');
              if (parts.length === 3) dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
            } else {
              dt = new Date(`${venc}T12:00:00`);
            }
            if (dt && !isNaN(dt.getTime())) {
              const testDt = new Date(dt.getTime());
              testDt.setHours(0,0,0,0);
              return testDt.getTime() < hojeStart.getTime();
            }
          }
          return false;
        };

        // Match 1: Embedded json parcelas natively on the student object
        const embedded = Array.isArray(a.parcelas) ? a.parcelas : Array.isArray(a.dados?.parcelas) ? a.dados.parcelas : [];
        if (embedded.some((p: any) => checkVencido(p.status, p.vencimento))) return true;

        // Match 2: Titulos (Carnês/Parcelas Financeiras legados/atuais em flat list)
        const temTituloAtrasado = realTitulos.some(tit => {
          const matchId = tit.alunoId && tit.alunoId === a.id;
          const matchName = tit.aluno && a.nome && tit.aluno.trim().toLowerCase() === a.nome.trim().toLowerCase();
          return (matchId || matchName) && checkVencido(tit.status, tit.vencimento);
        });
        if (temTituloAtrasado) return true;

        // Match 3: Novo Motor de Finanças (fin_parcelas -> fin_eventos -> aluno)
        if (Array.isArray(parcelasNovas)) {
          const temNovoAtrasado = parcelasNovas.some((p: any) => {
            const eventAlunoId = Array.isArray(p.fin_eventos) ? p.fin_eventos[0]?.aluno_id : p.fin_eventos?.aluno_id;
            if (!eventAlunoId || eventAlunoId !== a.id) return false;
            return checkVencido(p.status, p.vencimento);
          });
          if (temNovoAtrasado) return true;
        }

        return false;
      })
      
      // Encontrar nome descritivo do Segmento (Nível) e da Série
      const nivelDesc = cfgNiveisEnsino?.find(n => n.codigo === t.serie)?.nome || t.serie
      
      let serieObj = cfgSeries?.find(s => s.id === t.serieId || s.id === t.serie_id || s.id === (t as any).dados?.serieId) || null
      if (!serieObj && t.nome && cfgSeries) {
        // Fallback de string matching decrescente garantindo o nome da série mais longo primeiro 
        const matched = [...cfgSeries]
          .filter(s => s.nome && t.nome.toLowerCase().includes(s.nome.toLowerCase()))
          .sort((a,b) => b.nome.length - a.nome.length)[0];
        if (matched) serieObj = matched;
      }

      // Tenta cruzar mensalidade ou assume um ticket fictício se não tiver valor no obj aluno
      const somaMensalidades = alunosDaTurma.reduce((acc, a) => acc + (Number(a.valorMensalidade || a.mensalidade) || 850), 0)
      const ticketEstimado = alunosDaTurma.length > 0 ? (somaMensalidades / alunosDaTurma.length) : 850
      const vagasLivre = Math.max(0, capacidade - matriculadosReal)
      const potencialPerdido = vagasLivre * ticketEstimado

      return {
        ...t,
        matriculadosReal,
        capacidade,
        taxaOcupacao: ocupacao,
        vagasOciosas: vagasLivre,
        qtdInadimplentes: alunosInad.length,
        isLotada: ocupacao >= 100,
        nivelDesc,
        serieDesc: serieObj?.nome || '',
        potencialPerdido,
        ticketEstimado
      }
    })
  }, [realTurmas, realAlunos, realTitulos, cfgNiveisEnsino, cfgSeries])

  // Filtros aplicados
  const filteredTurmas = useMemo(() => {
    return turmasRicas.filter(t => {
      if (filterUnidade && t.unidade !== filterUnidade) return false
      if (filterNivel && t.serie !== filterNivel) return false
      if (filterTurno && t.turno !== filterTurno) return false
      if (searchTerm) {
        const s = searchTerm.toLowerCase()
        if (!t.nome.toLowerCase().includes(s) && !t.codigo?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [turmasRicas, filterUnidade, filterNivel, filterTurno, searchTerm])

  // Global KPIs based on filtered data
  const kpis = useMemo(() => {
    const totalCapacidade = filteredTurmas.reduce((acc, t) => acc + t.capacidade, 0)
    const totalMatr = filteredTurmas.reduce((acc, t) => acc + t.matriculadosReal, 0)
    const totalInad = filteredTurmas.reduce((acc, t) => acc + t.qtdInadimplentes, 0)
    const taxaGeral = totalCapacidade > 0 ? (totalMatr / totalCapacidade) * 100 : 0
    const potencialTotal = filteredTurmas.reduce((acc, t) => acc + t.potencialPerdido, 0)

    return { totalCapacidade, totalMatr, totalInad, taxaGeral, vagasOciosas: totalCapacidade - totalMatr, potencialTotal }
  }, [filteredTurmas])

  const chartData = useMemo(() => {
    // Agrupa taxa média de ocupação por Segmento
    const grouped = filteredTurmas.reduce((acc, t) => {
      const seg = t.nivelDesc || t.serie || 'Outros'
      if (!acc[seg]) acc[seg] = { name: seg, capacidade: 0, matr: 0 }
      acc[seg].capacidade += t.capacidade
      acc[seg].matr += t.matriculadosReal
      return acc
    }, {} as Record<string, any>)
    
    return Object.values(grouped).map(g => ({
      name: g.name,
      'Ocupação %': g.capacidade > 0 ? Math.round((g.matr / g.capacidade) * 100) : 0,
      matriculados: g.matr,
      fill: SEG_COLORS[filteredTurmas.find(t => t.nivelDesc === g.name)?.serie as string] || SEG_COLORS['DEFAULT']
    }))
  }, [filteredTurmas])

  if (!mounted) return null

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 0 60px' }}>
      
      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/relatorios')} className="btn btn-secondary btn-icon" style={{ borderRadius: 12 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 24, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <span style={{ fontSize: 28 }}>🗺️</span> Mapa Estratégico de Turmas
            </h1>
            <p className="page-subtitle" style={{ marginTop: 4, fontSize: 13 }}>
              Análise executiva de ocupação, vagas e inadimplência cruzada.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 12, padding: 4, display: 'flex', border: '1px solid hsl(var(--border-subtle))' }}>
            <button 
              onClick={() => setViewMode('grid')}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: viewMode === 'grid' ? 'rgba(59,130,246,0.1)' : 'transparent', color: viewMode === 'grid' ? '#3b82f6' : 'hsl(var(--text-muted))' }}
            >
              <LayoutGrid size={14} /> Cards
            </button>
            <button 
              onClick={() => setViewMode('table')}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: viewMode === 'table' ? 'rgba(59,130,246,0.1)' : 'transparent', color: viewMode === 'table' ? '#3b82f6' : 'hsl(var(--text-muted))' }}
            >
              <List size={14} /> Analítico
            </button>
          </div>
          <button className="btn btn-danger btn-sm" style={{ gap: 6, borderRadius: 12 }} disabled={filteredTurmas.length === 0}>
            <Download size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ─── KPIS ─── */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}
      >
        <div className="card" style={{ padding: 20, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PieChart size={14} color="#3b82f6" /> Taxa Ocupação
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {kpis.taxaGeral.toFixed(1)}% <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>do limite legal</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'hsl(var(--bg-overlay))', borderRadius: 3, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${kpis.taxaGeral}%`, height: '100%', background: kpis.taxaGeral > 95 ? '#f59e0b' : '#3b82f6', borderRadius: 3 }} />
          </div>
        </div>

        <div className="card" style={{ padding: 20, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} color="#10b981" /> Total Matriculados
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {kpis.totalMatr} <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>/ {kpis.totalCapacidade} Vagas</span>
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} color="#10b981" /> {kpis.vagasOciosas} vagas ociosas disponíveis
          </div>
        </div>

        <div className="card" style={{ padding: 20, borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={14} color="#ef4444" /> Custo de Ociosidade Estimado
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#ef4444', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            R$ {(kpis.potencialTotal / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 8 }}>
            Baseado no ticket médio x vagas não ocupadas.
          </div>
        </div>

        <div className="card" style={{ padding: 20, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} color="#f59e0b" /> Alunos Inadimplentes Ativos
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#f59e0b', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {kpis.totalInad} <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>carteiras</span>
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 8 }}>
            Ocupando vagas, mas com pendência financeira.
          </div>
        </div>
      </motion.div>

      {/* ─── FILTROS ─── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', background: 'hsl(var(--bg-elevated))' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label className="form-label" style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Pesquisa Turma</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input 
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Digite 9A, Integral..." 
              className="form-input" style={{ paddingLeft: 34, background: 'hsl(var(--bg-surface))', height: 40 }}
            />
          </div>
        </div>
        
        {unidadesUnicas.length > 0 && (
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label" style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Unidade</label>
            <select className="form-input" value={filterUnidade} onChange={e => setFilterUnidade(e.target.value)} style={{ background: 'hsl(var(--bg-surface))', height: 40 }}>
              <option value="">Todas as Unidades</option>
              {unidadesUnicas.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: '1 1 180px' }}>
          <label className="form-label" style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Nível de Ensino</label>
          <select className="form-input" value={filterNivel} onChange={e => setFilterNivel(e.target.value)} style={{ background: 'hsl(var(--bg-surface))', height: 40 }}>
            <option value="">Todos Níveis</option>
            {cfgNiveisEnsino?.map(n => <option key={n.codigo} value={n.codigo}>{n.nome}</option>)}
          </select>
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <label className="form-label" style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Turno</label>
          <select className="form-input" value={filterTurno} onChange={e => setFilterTurno(e.target.value)} style={{ background: 'hsl(var(--bg-surface))', height: 40 }}>
            <option value="">Todos Turnos</option>
            {(Array.isArray(cfgTurnos) ? cfgTurnos : []).filter(t => t.situacao === 'ativo' || !t.situacao).map((t: any) => (
              <option key={t.id || t.nome || t.codigo || t} value={t.nome || t}>{t.nome || t}</option>
            ))}
          </select>
        </div>
        
        {(filterUnidade || filterNivel || filterTurno || searchTerm) && (
          <button 
            className="btn btn-ghost" 
            style={{ height: 40, color: 'hsl(var(--text-muted))', fontSize: 13 }}
            onClick={() => { setFilterUnidade(''); setFilterNivel(''); setFilterTurno(''); setSearchTerm('') }}
          >
            Limpar
          </button>
        )}
      </div>

      {/* ─── GRAPHIC Opcional ─── */}
      {chartData.length > 0 && viewMode === 'grid' && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-primary))' }}>
            <BarChart3 size={16} color="#8b5cf6" />
            Performance de Ocupação por Nível de Ensino
          </div>
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ background: 'hsl(var(--bg-elevated))', border: 'none', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', color: 'hsl(var(--text-primary))' }}
                  itemStyle={{ fontSize: 12 }}
                  formatter={(value: any, name: string) => [name === 'Ocupação %' ? `${value}%` : value, name]}
                />
                <Bar dataKey="Ocupação %" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {chartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ─── DATA RENDERING ─── */}
      {filteredTurmas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-surface))', borderRadius: 16, border: '1px dashed hsl(var(--border-subtle))' }}>
          <Map size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Nenhuma Turma Encontrada</h3>
          <p style={{ fontSize: 13 }}>Revise os filtros acima ou certifique-se de que existem turmas com esses parâmetros.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          <AnimatePresence>
            {filteredTurmas.map((t, idx) => {
              const ringColor = t.taxaOcupacao >= 95 ? '#f59e0b' : t.taxaOcupacao >= 50 ? '#10b981' : '#3b82f6'
              const segColor = SEG_COLORS[t.serie] || SEG_COLORS['DEFAULT']

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: idx * 0.02 }}
                  key={t.id} 
                  className="card" 
                  style={{ 
                    position: 'relative', overflow: 'hidden', padding: 20, cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                    borderTop: `4px solid ${segColor}`
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
                  onClick={() => router.push(`/academico/turmas`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, color: segColor, background: `${segColor}15`, padding: '2px 8px', borderRadius: 20, marginBottom: 8 }}>
                        {t.nivelDesc} {t.serieDesc ? `• ${t.serieDesc}` : ''}
                      </div>
                      <h4 style={{ fontSize: 18, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.nome}
                        {t.isLotada && <span className="badge badge-warning" style={{ fontSize: 9, padding: '1px 6px' }}>LOTADA</span>}
                      </h4>
                      <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
                        {t.turno} • Prof. {t.professor || 'Ñ Atribuído'} • Sala {t.sala || '—'}
                      </p>
                    </div>

                    {/* Progress Circle Visual */}
                    <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 36 36" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                        <path stroke="hsl(var(--border-subtle))" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path stroke={ringColor} strokeWidth="3" fill="none" strokeDasharray={`${t.taxaOcupacao}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeLinecap="round" />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif' }}>
                        {t.taxaOcupacao}%
                      </span>
                    </div>
                  </div>

                  {/* Financial / Matriculados Footer */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, padding: 10, background: 'hsl(var(--bg-surface))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 2 }}>Alunos</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif' }}>
                        {t.matriculadosReal} <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>/ {t.capacidade}</span>
                      </div>
                    </div>
                    {t.qtdInadimplentes > 0 ? (
                      <div style={{ flex: 1, padding: 10, background: 'rgba(245,158,11,0.06)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
                        <div style={{ fontSize: 10, color: '#d97706', textTransform: 'uppercase', marginBottom: 2 }}>Inadimplentes</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#d97706', fontFamily: 'Outfit,sans-serif' }}>
                          {t.qtdInadimplentes} <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>alertas</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1, padding: 10, background: 'rgba(16,185,129,0.06)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div style={{ fontSize: 10, color: '#059669', textTransform: 'uppercase', marginBottom: 2 }}>Inadimplentes</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#059669', fontFamily: 'Outfit,sans-serif' }}>
                          ZERO!
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card table-container" style={{ padding: 0 }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-surface))', fontSize: 11, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left' }}>Turma</th>
                <th style={{ padding: '14px 20px', textAlign: 'left' }}>Nível / Série</th>
                <th style={{ padding: '14px 20px', textAlign: 'left' }}>Turno</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Vagas</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Ocupação</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Custo Ocioso Ref.</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Inad.</th>
              </tr>
            </thead>
            <tbody>
              {filteredTurmas.map((t, i) => (
                <tr key={t.id} style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--bg-surface))' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.nome} {t.isLotada && <span style={{ background: '#f59e0b', color: '#fff', fontSize: 9, padding: '1px 4px', borderRadius: 4, fontWeight: 800 }}>LOTADA</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{t.unidade || 'Sem unidade'} • Prof. {t.professor || '—'}</div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                    <span style={{ color: SEG_COLORS[t.serie] || SEG_COLORS['DEFAULT'], fontWeight: 700 }}>{t.nivelDesc}</span> <br/>
                    <span style={{ fontSize: 11 }}>{t.serieDesc || '—'}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{t.turno}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Outfit,sans-serif' }}>{t.matriculadosReal} <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>/ {t.capacidade}</span></div>
                    <div style={{ fontSize: 11, color: t.vagasOciosas === 0 ? '#10b981' : '#f59e0b' }}>
                      {t.vagasOciosas === 0 ? 'Sem vagas' : `${t.vagasOciosas} livres`}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div style={{ width: 60, height: 6, background: 'hsl(var(--bg-overlay))', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${t.taxaOcupacao}%`, height: '100%', background: t.taxaOcupacao >= 95 ? '#f59e0b' : t.taxaOcupacao >= 50 ? '#10b981' : '#3b82f6' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Outfit,sans-serif' }}>{t.taxaOcupacao}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, color: t.potencialPerdido > 0 ? '#ef4444' : 'hsl(var(--text-muted))', fontWeight: 600 }}>
                    {t.potencialPerdido > 0 ? `R$ ${t.potencialPerdido.toLocaleString('pt-BR')}` : '—'}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    {t.qtdInadimplentes > 0 ? (
                      <span className="badge badge-warning" style={{ fontSize: 11 }}>{t.qtdInadimplentes} Aluno(s)</span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: 11 }}>Zero zero</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

    </div>
  )
}
