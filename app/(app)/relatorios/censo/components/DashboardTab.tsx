'use client'
import { useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import {
  Users, AlertTriangle, CheckCircle2, FileText, RefreshCw,
  TrendingUp, Clock, Database, Zap, ArrowRight, GraduationCap,
  ShieldCheck, Target, Activity, BarChart3, BookOpen
} from 'lucide-react'

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div style={{
      background:'hsl(var(--bg-surface))', border:`1px solid hsl(var(--border-subtle))`,
      borderRadius:16, padding:'20px 24px', borderTop:`3px solid ${color}`,
      display:'flex', flexDirection:'column', gap:8, transition:'box-shadow 0.2s',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'hsl(var(--text-muted))' }}>{label}</div>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      </div>
      <div style={{ fontSize:28, fontWeight:900, color:'hsl(var(--text-primary))', fontFamily:'Outfit, sans-serif', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{sub}</div>}
    </div>
  )
}

function QuickAction({ label, icon, color, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display:'flex', alignItems:'center', gap:10, padding:'12px 18px',
        background: disabled ? 'hsl(var(--bg-overlay))' : `${color}10`,
        border:`1px solid ${disabled ? 'hsl(var(--border-subtle))' : color+'30'}`,
        borderRadius:12, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize:13, fontWeight:600, color: disabled ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))',
        transition:'all 0.15s', width:'100%', textAlign:'left',
      }}
    >
      <span style={{ color: disabled ? 'hsl(var(--text-muted))' : color }}>{icon}</span>
      {label}
      {!disabled && <ArrowRight size={14} style={{ marginLeft:'auto', color }} />}
    </button>
  )
}

export function DashboardTab({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const { alunos, turmas, funcionarios, censoPendencias, censoExports, censoConfig, mantenedores } = useData()

  const todasUnidades = mantenedores.flatMap(m => m.unidades)
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)

  const isUnidade = (regUnid: string) => {
    if (!unidadeAtivaId) return true
    if (regUnid === unidadeAtivaId) return true
    if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
    return false
  }

  const alunosCenso = alunos.filter(a => isUnidade(a.unidade))
  const turmasCenso = turmas.filter(t => isUnidade(t.unidade))
  const funcsCenso = funcionarios.filter(f => isUnidade(f.unidade))

  const alunosValidos   = alunosCenso.filter(a => a.nome?.trim())
  const alunosSemTurma  = alunosValidos.filter(a => !a.turma)
  const alunosSemNasc   = alunosValidos.filter(a => !a.dataNascimento)
  const turmasValidas   = turmasCenso.filter(t => t.nome?.trim())

  const pendAberta      = censoPendencias.filter(p => p.status === 'aberta' || p.status === 'em_tratamento')
  const pendCritica     = pendAberta.filter(p => p.tipo === 'critica')
  const pendAlta        = pendAberta.filter(p => p.tipo === 'alta')
  const pendMedia       = pendAberta.filter(p => p.tipo === 'media')
  const ultimaExport    = censoExports[0]
  const totalGeradas    = censoPendencias.length
  const resolvidas      = censoPendencias.filter(p => p.status === 'corrigida' || p.status === 'ignorada').length
  const progresso       = totalGeradas > 0 ? Math.round((resolvidas / totalGeradas) * 100) : 0

  const profesores = funcsCenso.filter(f =>
    f.cargo?.toLowerCase().includes('professor') || f.cargo?.toLowerCase().includes('docente')
  )

  // Completude básica da base
  const camposFaltando = alunosSemTurma.length + alunosSemNasc.length
  const escolaOk = !!(escola?.nomeFantasia || escola?.razaoSocial || escola?.nome)

  const stats = [
    { label: 'Alunos na Base', value: alunosValidos.length, sub: `${alunosSemTurma.length} sem turma`,      color: '#6366f1', icon: <Users size={18} color="#6366f1"/> },
    { label: 'Turmas',          value: turmasValidas.length, sub: `${turmasValidas.filter(t=>t.turno).length} com turno ok`, color: '#10b981', icon: <BookOpen size={18} color="#10b981"/> },
    { label: 'Pendências',      value: pendAberta.length,    sub: `${pendCritica.length} críticas`,          color: pendCritica.length > 0 ? '#ef4444':'#f59e0b', icon: <AlertTriangle size={18} color={pendCritica.length>0?'#ef4444':'#f59e0b'}/> },
    { label: 'Profissionais',   value: profesores.length,    sub: 'docentes mapeados',                       color: '#8b5cf6', icon: <GraduationCap size={18} color="#8b5cf6"/> },
    { label: 'Exportações',     value: censoExports.length,  sub: ultimaExport ? `Última: ${new Date(ultimaExport.dataGeracao).toLocaleDateString('pt-BR')}` : 'Nenhuma ainda', color: '#0ea5e9', icon: <FileText size={18} color="#0ea5e9"/> },
    { label: 'Progresso Censo', value: `${progresso}%`,      sub: `${resolvidas} de ${totalGeradas} pendências`, color: '#14b8a6', icon: <Target size={18} color="#14b8a6"/> },
  ]

  const checklistItems = [
    { label: 'Dados da escola preenchidos',      ok: escolaOk,                   critical: true },
    { label: 'Alunos com turma atribuída',        ok: alunosSemTurma.length === 0, critical: true },
    { label: 'Datas de nascimento preenchidas',  ok: alunosSemNasc.length === 0,  critical: true },
    { label: 'Turmas com turno definido',         ok: turmasValidas.every(t => t.turno), critical: true },
    { label: 'Profissionais cadastrados',         ok: profesores.length > 0,       critical: false },
    { label: 'Validação executada',               ok: censoPendencias.length > 0,  critical: false },
    { label: 'Pendências críticas zeradas',       ok: pendCritica.length === 0,   critical: true },
    { label: 'Arquivo gerado',                    ok: censoExports.length > 0,     critical: false },
  ]

  const checkOk  = checklistItems.filter(i => i.ok).length
  const checkTot = checklistItems.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:28 }}>

      {/* ALERTA CRÍTICO */}
      {pendCritica.length > 0 && (
        <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, background:'rgba(239,68,68,0.15)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <AlertTriangle size={20} color="#ef4444"/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>⚠ {pendCritica.length} pendência(s) crítica(s) bloqueiam a geração do arquivo</div>
            <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Resolva as pendências críticas antes de gerar o arquivo oficial do Censo.</div>
          </div>
          <button onClick={() => onNavigate('pendencias')} style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
            Ver Pendências
          </button>
        </div>
      )}

      {/* STATS GRID */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16 }}>
        {stats.map(s => <StatCard key={s.label} {...s}/>)}
      </div>

      {/* MIDDLE ROW */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20 }}>

        {/* CHECKLIST */}
        <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:16, padding:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <div style={{ fontWeight:800, fontSize:14 }}>Checklist Operacional</div>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: checkOk===checkTot ? 'rgba(16,185,129,0.1)':'rgba(245,158,11,0.1)', color: checkOk===checkTot ? '#10b981':'#f59e0b', border:`1px solid ${checkOk===checkTot ? 'rgba(16,185,129,0.2)':'rgba(245,158,11,0.2)'}` }}>
              {checkOk}/{checkTot}
            </span>
          </div>
          {/* progresso bar */}
          <div style={{ height:4, background:'hsl(var(--bg-overlay))', borderRadius:2, marginBottom:18, overflow:'hidden' }}>
            <div style={{ width:`${(checkOk/checkTot)*100}%`, height:'100%', background:'linear-gradient(90deg,#6366f1,#10b981)', transition:'width 0.4s', borderRadius:2 }}/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {checklistItems.map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, background: item.ok ? 'rgba(16,185,129,0.04)' : item.critical ? 'rgba(239,68,68,0.04)':'hsl(var(--bg-elevated))' }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background: item.ok ? 'rgba(16,185,129,0.15)':'rgba(239,68,68,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {item.ok
                    ? <CheckCircle2 size={14} color="#10b981"/>
                    : <AlertTriangle size={12} color={item.critical ? '#ef4444':'#f59e0b'}/>
                  }
                </div>
                <span style={{ fontSize:12, color: item.ok ? 'hsl(var(--text-primary))':'hsl(var(--text-secondary))' }}>{item.label}</span>
                {item.critical && !item.ok && (
                  <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, color:'#fca5a5', background:'rgba(239,68,68,0.1)', padding:'1px 5px', borderRadius:4 }}>CRÍTICO</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* PENDÊNCIAS POR TIPO */}
        <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:16, padding:24 }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:18 }}>Pendências por Severidade</div>
          {pendAberta.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:'hsl(var(--text-muted))' }}>
              <CheckCircle2 size={36} style={{ opacity:0.3, marginBottom:8 }}/>
              <div style={{ fontSize:13, fontWeight:600 }}>Nenhuma pendência aberta!</div>
              <div style={{ fontSize:12, marginTop:4 }}>Execute o Validador para analisar a base.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { label:'Crítica',    count:pendCritica.length, color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
                { label:'Alta',       count:pendAlta.length, color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
                { label:'Média',      count:pendMedia.length, color:'#0ea5e9', bg:'rgba(14,165,233,0.1)' },
                { label:'Baixa/Info', count: pendAberta.filter(p=>p.tipo==='baixa'||p.tipo==='informativa').length, color:'#94a3b8', bg:'rgba(148,163,184,0.1)' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ fontWeight:600, color:item.color }}>{item.label}</span>
                    <span style={{ fontWeight:800 }}>{item.count}</span>
                  </div>
                  <div style={{ height:8, background:'hsl(var(--bg-overlay))', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ width:`${pendAberta.length > 0 ? (item.count/pendAberta.length)*100 : 0}%`, height:'100%', background:item.color, borderRadius:4, transition:'width 0.4s' }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => onNavigate('validador')} style={{ marginTop:20, width:'100%', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:8, padding:'9px', cursor:'pointer', fontSize:12, fontWeight:700, color:'#818cf8', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Zap size={13}/> Executar Validador
          </button>
        </div>

        {/* AÇÕES RÁPIDAS */}
        <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:16, padding:24 }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:18 }}>Ações Rápidas</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <QuickAction label="Validar toda a base" icon={<ShieldCheck size={15}/>} color="#6366f1" onClick={() => onNavigate('validador')}/>
            <QuickAction label="Ver pendências críticas" icon={<AlertTriangle size={15}/>} color="#ef4444" onClick={() => onNavigate('pendencias')} disabled={pendCritica.length === 0}/>
            <QuickAction label="Gerar arquivo do Censo" icon={<FileText size={15}/>} color="#10b981" onClick={() => onNavigate('geracao')} disabled={pendCritica.length > 0}/>
            <QuickAction label="Código Inicial (Etapa 1)" icon={<GraduationCap size={15}/>} color="#8b5cf6" onClick={() => onNavigate('matricula')}/>
            <QuickAction label="Situação do Aluno (Etapa 2)" icon={<CheckCircle2 size={15}/>} color="#0ea5e9" onClick={() => onNavigate('situacao')}/>
            <QuickAction label="Histórico de envios" icon={<Clock size={15}/>} color="#f59e0b" onClick={() => onNavigate('historico')}/>
            <QuickAction label="Configurações do Censo" icon={<Activity size={15}/>} color="#14b8a6" onClick={() => onNavigate('configuracoes')}/>
          </div>
        </div>
      </div>

      {/* INFORMAÇÕES DO PROCESSO */}
      <div style={{ background:'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(16,185,129,0.03))', border:'1px solid rgba(99,102,241,0.12)', borderRadius:16, padding:24 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <BarChart3 size={16} color="#6366f1"/> Fluxo Operacional do Censo
        </div>
        <div style={{ display:'flex', gap:0, overflowX:'auto' }}>
          {[
            { step:1, label:'Preparar Base',       icon:'🗂️', desc:'Dados do ERP importados' },
            { step:2, label:'Validar',              icon:'🔍', desc:'Motor analisa inconsistências' },
            { step:3, label:'Corrigir Pendências',  icon:'✏️', desc:'Resolva erros e alertas' },
            { step:4, label:'Gerar Arquivo',        icon:'📄', desc:'Formato oficial INEP' },
            { step:5, label:'Download + Upload',    icon:'⬆️', desc:'Acesse o Educacenso' },
            { step:6, label:'Registrar Resultado',  icon:'✅', desc:'Protocolo e comprovante' },
          ].map((s, i) => (
            <div key={s.step} style={{ display:'flex', alignItems:'center' }}>
              <div style={{ textAlign:'center', minWidth:100 }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:11, fontWeight:800, color:'hsl(var(--text-primary))' }}>{s.step}. {s.label}</div>
                <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:2 }}>{s.desc}</div>
              </div>
              {i < 5 && <ArrowRight size={16} color="hsl(var(--text-muted))" style={{ flexShrink:0, margin:'0 8px' }}/>}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
