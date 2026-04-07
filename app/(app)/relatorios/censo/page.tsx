'use client'

import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import {
  LayoutDashboard, Users, GraduationCap, CheckCircle, AlertTriangle,
  FileText, History, ShieldCheck, Settings, ClipboardList, Database,
  ChevronRight, RefreshCw, Download, BarChart3, Clock, Building2
} from 'lucide-react'
import { DashboardTab }          from './components/DashboardTab'
import { MatriculaInicialTab }   from './components/MatriculaInicialTab'
import { SituacaoAlunoTab }      from './components/SituacaoAlunoTab'
import { CadastrosTab }          from './components/CadastrosTab'
import { ValidadorTab }          from './components/ValidadorTab'
import { PendenciasTab }         from './components/PendenciasTab'
import { GeracaoArquivosTab }    from './components/GeracaoArquivosTab'
import { HistoricoEnviosTab }    from './components/HistoricoEnviosTab'
import { AuditoriaTab }          from './components/AuditoriaTab'
import { ConfiguracoesCensoTab } from './components/ConfiguracoesCensoTab'

type TabKey =
  | 'dashboard' | 'matricula' | 'situacao' | 'cadastros'
  | 'validador' | 'pendencias' | 'geracao' | 'historico'
  | 'auditoria' | 'configuracoes'

const TABS: { key: TabKey; label: string; icon: React.ReactNode; badge?: string; badgeColor?: string }[] = [
  { key: 'dashboard',    label: 'Dashboard',          icon: <LayoutDashboard size={15}/> },
  { key: 'matricula',   label: 'Código Inicial',   icon: <GraduationCap size={15}/>,   badge: 'ETAPA 1' },
  { key: 'situacao',    label: 'Situação do Aluno',   icon: <CheckCircle size={15}/>,     badge: 'ETAPA 2' },
  { key: 'cadastros',   label: 'Cadastros Vinculados', icon: <Database size={15}/> },
  { key: 'validador',   label: 'Validador',           icon: <ShieldCheck size={15}/>,     badge: 'MOTOR', badgeColor: 'cyan' },
  { key: 'pendencias',  label: 'Pendências',          icon: <AlertTriangle size={15}/> },
  { key: 'geracao',     label: 'Geração de Arquivos', icon: <FileText size={15}/>,        badge: 'ARQUIVO', badgeColor: 'purple' },
  { key: 'historico',   label: 'Histórico de Envios', icon: <History size={15}/> },
  { key: 'auditoria',   label: 'Auditoria / Logs',    icon: <ClipboardList size={15}/> },
  { key: 'configuracoes',label: 'Configurações',      icon: <Settings size={15}/> },
]

export default function CensoEscolarPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const { censoConfig, setCensoConfig, censoPendencias, censoExports, alunos, turmas, mantenedores } = useData()
  const todasUnidades = mantenedores.flatMap(m => m.unidades)
  
  // Utiliza a unidade do config, ou se vazio cai para a primeira disponível
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')

  const alunosFiltrados = alunos.filter(a => !unidadeAtivaId || a.unidade === unidadeAtivaId || a.unidade === todasUnidades.find(u => u.id === unidadeAtivaId)?.nomeFantasia)
  
  const handleUnidadeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCensoConfig({ ...censoConfig, unidadeId: e.target.value })
  }

  // Métricas rápidas para o header
  const totalPendencias = censoPendencias.filter(p => p.status === 'aberta' || p.status === 'em_tratamento').length
  const criticas        = censoPendencias.filter(p => p.tipo === 'critica' && (p.status === 'aberta' || p.status === 'em_tratamento')).length
  const alunosValidos   = alunosFiltrados.filter(a => a.nome && a.nome.trim() !== '').length
  const ultimaExportacao = censoExports[0]

  // Progresso geral do Censo (heurística simples: % de pendências resolvidas)
  const totalGeradas    = censoPendencias.length
  const resolvidas      = censoPendencias.filter(p => p.status === 'corrigida' || p.status === 'ignorada').length
  const progresso       = totalGeradas > 0 ? Math.round((resolvidas / totalGeradas) * 100) : 0

  const etapaLabel = censoConfig.etapaAtiva === '1-matricula' ? 'Código Inicial' : 'Situação do Aluno'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflowX: 'hidden', minWidth: 0 }}>

      {/* ── HEADER PREMIUM ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        borderBottom: '1px solid rgba(99,102,241,0.25)',
        padding: '20px 28px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decoração de fundo */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 75% 50%, rgba(99,102,241,0.08) 0%, transparent 60%)', pointerEvents:'none' }}/>

        <div style={{ position:'relative', zIndex:1 }}>
          {/* Breadcrumb */}
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'rgba(148,163,184,0.7)', marginBottom:12 }}>
            <BarChart3 size={12}/><span>Governo</span>
            <ChevronRight size={10}/><span style={{ color:'#a5b4fc', fontWeight:700 }}>Censo Escolar</span>
          </div>

          {/* Título + badges */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16, marginBottom:20 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                <div style={{ width:40, height:40, background:'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 20px rgba(99,102,241,0.4)' }}>
                  <Database size={20} color="#fff"/>
                </div>
                <div>
                  <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', margin:0, fontFamily:'Outfit, sans-serif' }}>
                    Censo Escolar / Educacenso
                  </h1>
                  <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                    Módulo de preparação e controle operacional do Censo
                  </div>
                </div>
              </div>
            </div>

            {/* Status Bar + Seletor de Unidade */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'4px 10px', display:'flex', alignItems:'center', gap:8 }}>
                <Building2 size={13} color="#a5b4fc" />
                <select
                  value={unidadeAtivaId}
                  onChange={handleUnidadeChange}
                  style={{
                    background: 'transparent', color: '#e0e7ff', border: 'none', outline: 'none',
                    fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif', width: 140, cursor: 'pointer'
                  }}
                >
                  {todasUnidades.map(u => (
                    <option key={u.id} value={u.id} style={{ color: '#000' }}>{u.nomeFantasia || u.razaoSocial}</option>
                  ))}
                  {todasUnidades.length === 0 && <option value="">Nenhuma Unidade</option>}
                </select>
              </div>

              <div style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:8, padding:'4px 10px', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, color:'#a5b4fc', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Ano</span>
                <select
                  value={censoConfig.anoCensitario || '2024'}
                  onChange={e => setCensoConfig({ ...censoConfig, anoCensitario: e.target.value as any })}
                  style={{ background: 'transparent', color: '#e0e7ff', border: 'none', outline: 'none', fontSize: 13, fontWeight: 800, fontFamily: 'Outfit, sans-serif', width: 60, cursor: 'pointer' }}
                >
                  <option value="2024" style={{ color: '#000' }}>2024</option>
                  <option value="2025" style={{ color: '#000' }}>2025</option>
                  <option value="2026" style={{ color: '#000' }}>2026</option>
                </select>
              </div>

              <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:8, padding:'4px 10px', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, color:'#6ee7b7', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Etapa</span>
                <select
                  value={censoConfig.etapaAtiva || '1-matricula'}
                  onChange={e => setCensoConfig({ ...censoConfig, etapaAtiva: e.target.value as any })}
                  style={{ background: 'transparent', color: '#d1fae5', border: 'none', outline: 'none', fontSize: 11, fontWeight: 800, fontFamily: 'Outfit, sans-serif', cursor: 'pointer' }}
                >
                  <option value="1-matricula" style={{ color: '#000' }}>Código Inicial</option>
                  <option value="2-situacao" style={{ color: '#000' }}>Situação do Aluno</option>
                </select>
              </div>
              {criticas > 0 && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, color:'#fca5a5', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Críticas</span>
                  <span style={{ fontSize:16, fontWeight:900, color:'#ef4444', fontFamily:'Outfit, sans-serif' }}>{criticas}</span>
                </div>
              )}
              <div style={{ background:'rgba(30,27,75,0.5)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:8, minWidth:100 }}>
                <span style={{ fontSize:10, color:'#a5b4fc', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Progresso</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:60, height:4, background:'rgba(99,102,241,0.15)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ width:`${progresso}%`, height:'100%', background:'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius:2 }}/>
                  </div>
                  <span style={{ fontSize:11, fontWeight:800, color:'#a5b4fc' }}>{progresso}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:0, overflowX:'hidden' }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'9px 11px',
                    background:'transparent',
                    border:'none',
                    borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                    color: isActive ? '#a5b4fc' : 'rgba(148,163,184,0.65)',
                    cursor:'pointer',
                    fontSize:11, fontWeight: isActive ? 700 : 500,
                    whiteSpace:'nowrap',
                    transition:'all 0.15s',
                    borderRadius:'4px 4px 0 0',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7, flexShrink:0 }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span style={{
                      fontSize:8, fontWeight:800, letterSpacing:0.3,
                      padding:'1px 4px', borderRadius:3,
                      background: tab.badgeColor === 'cyan' ? 'rgba(6,182,212,0.15)' :
                                  tab.badgeColor === 'purple' ? 'rgba(139,92,246,0.15)' :
                                  'rgba(99,102,241,0.15)',
                      color: tab.badgeColor === 'cyan' ? '#22d3ee' :
                             tab.badgeColor === 'purple' ? '#c4b5fd' :
                             '#818cf8',
                      border:`1px solid ${tab.badgeColor === 'cyan' ? 'rgba(6,182,212,0.2)' : tab.badgeColor === 'purple' ? 'rgba(139,92,246,0.2)' : 'rgba(99,102,241,0.2)'}`,
                    }}>
                      {tab.key === 'pendencias' && totalPendencias > 0 ? totalPendencias : tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div style={{ flex:1, overflow:'auto', padding:24, minWidth:0 }}>
        {activeTab === 'dashboard'     && <DashboardTab          onNavigate={setActiveTab} />}
        {activeTab === 'matricula'     && <MatriculaInicialTab   />}
        {activeTab === 'situacao'      && <SituacaoAlunoTab      />}
        {activeTab === 'cadastros'     && <CadastrosTab          />}
        {activeTab === 'validador'     && <ValidadorTab          />}
        {activeTab === 'pendencias'    && <PendenciasTab         />}
        {activeTab === 'geracao'       && <GeracaoArquivosTab    />}
        {activeTab === 'historico'     && <HistoricoEnviosTab    />}
        {activeTab === 'auditoria'     && <AuditoriaTab          />}
        {activeTab === 'configuracoes' && <ConfiguracoesCensoTab />}
      </div>
    </div>
  )
}
