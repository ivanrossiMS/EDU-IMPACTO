'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import { useState, useMemo } from 'react'
import { SaidaProvider, useSaida } from '@/lib/saidaContext'
import { DataProvider, useData } from '@/lib/dataContext'
import { useVoice } from '@/lib/hooks/useVoice'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import {
  Settings, TestTube2, BarChart3, ShieldOff, UserCheck,
  Wifi, WifiOff, Filter, Download, Search, ChevronDown,
  CheckCircle2, XCircle, AlertTriangle, Users, GraduationCap,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// ABA: Configurações (conteúdo original)
// ─────────────────────────────────────────────────────────────────────────────
function TabConfiguracoes() {
  const isMobile = useIsMobile()
  const { config, updateConfig, clearLog } = useSaida()
  const voice = useVoice()

  const testVoice = () => {
    let t = '3º Ano A - 2026'
    if (config.voiceTruncateTurma && config.voiceTruncateChar) t = t.split(config.voiceTruncateChar)[0].trim()
    voice.speak(`João Silva, turma ${t}`, {
      rate: config.voiceRate, volume: config.voiceVolume, voiceURI: config.voiceURI,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 620 }}>

      {/* Info card */}
      <div style={{
        padding: '14px 18px', borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(6,182,212,0.07), rgba(99,102,241,0.04))',
        border: '1px solid rgba(6,182,212,0.25)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: '#06b6d4' }}>
            Responsáveis, RFID e vínculos gerenciados na Ficha do Aluno
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
            As pessoas autorizadas a retirar o aluno, os cartões RFID, os dias da semana e os
            bloqueios são configurados diretamente em{' '}
            <strong style={{ color: 'hsl(var(--text-base))' }}>
              Acadêmico → Alunos → Nova Código → Saúde → Autorizados a Retirar
            </strong>.
          </div>
        </div>
      </div>

      {/* ── VOZ ── */}
      <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔊 Chamada por Voz
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Anúncio por auto-falante</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Falar o nome do aluno ao ser chamado</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', background: config.voiceEnabled ? '#06b6d4' : 'hsl(var(--bg-overlay))', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 3, left: config.voiceEnabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
            </div>
            <input type="checkbox" checked={config.voiceEnabled} onChange={e => updateConfig({ voiceEnabled: e.target.checked })} style={{ display: 'none' }}/>
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Ocultar sufixo da turma</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Anuncia o nome da turma apenas até o caractere ao lado</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {config.voiceTruncateTurma && (
              <input
                type="text"
                maxLength={3}
                value={config.voiceTruncateChar ?? '-'}
                onChange={e => updateConfig({ voiceTruncateChar: e.target.value })}
                style={{
                  width: 36, padding: '4px', textAlign: 'center', borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))',
                  color: 'hsl(var(--text-base))', fontSize: 12, outline: 'none'
                }}
                title="Caractere de corte (ex: -)"
              />
            )}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', background: config.voiceTruncateTurma ? '#06b6d4' : 'hsl(var(--bg-overlay))', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 3, left: config.voiceTruncateTurma ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
              </div>
              <input type="checkbox" checked={config.voiceTruncateTurma} onChange={e => updateConfig({ voiceTruncateTurma: e.target.checked })} style={{ display: 'none' }}/>
            </label>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>VOLUME</span><span style={{ color: '#06b6d4' }}>{Math.round(config.voiceVolume * 100)}%</span>
          </label>
          <input type="range" min={0} max={1} step={0.05} value={config.voiceVolume}
            onChange={e => updateConfig({ voiceVolume: +e.target.value })}
            style={{ width: '100%', accentColor: '#06b6d4' }}/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>VELOCIDADE</span><span style={{ color: '#06b6d4' }}>{config.voiceRate}×</span>
          </label>
          <input type="range" min={0.5} max={2} step={0.1} value={config.voiceRate}
            onChange={e => updateConfig({ voiceRate: +e.target.value })}
            style={{ width: '100%', accentColor: '#06b6d4' }}/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>VOZ / LOCUTOR</span>
          </label>
          <select
            value={config.voiceURI || ''}
            onChange={e => updateConfig({ voiceURI: e.target.value })}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))',
              color: 'hsl(var(--text-base))', fontSize: 13, outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="">Automático pelo Navegador (Recomendado)</option>
            {voice.voices.filter(v => v.lang.startsWith('pt')).map(v => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </select>
        </div>
        <button onClick={testVoice} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px',
          borderRadius: 10, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)',
          color: '#06b6d4', cursor: 'pointer', fontWeight: 700, fontSize: 12,
        }}>
          <TestTube2 size={13}/> Testar Voz
        </button>
      </div>

      {/* ── RFID ── */}
      <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📡 Leitura RFID</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Ativar leitor RFID no Painel Tablet</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Captura automática de cartões</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', background: config.rfidEnabled ? '#06b6d4' : 'hsl(var(--bg-overlay))', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 3, left: config.rfidEnabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
            </div>
            <input type="checkbox" checked={config.rfidEnabled} onChange={e => updateConfig({ rfidEnabled: e.target.checked })} style={{ display: 'none' }}/>
          </label>
        </div>
      </div>

      {/* ── MONITOR TV ── */}
      <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📺 Monitor TV</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Quantidade de Repetições Seguidas</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Ao chamar, o auto-falante vai repetir após a primeira chamada</div>
            </div>
            <select
              value={config.voiceRepeatCount || 0}
              onChange={e => updateConfig({ voiceRepeatCount: +e.target.value })}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))',
                color: 'hsl(var(--text-base))', fontSize: 12, outline: 'none', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <option value={0}>Não repetir</option>
              <option value={1}>Repetir 1 vez seguidamente</option>
              <option value={2}>Repetir 2 vezes seguidamente</option>
              <option value={3}>Repetir 3 vezes seguidamente</option>
            </select>
          </div>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>TEMPO NO MONITOR TV APÓS CONFIRMAR</span>
            <span style={{ color: '#06b6d4' }}>{config.tvDisplayTime}s</span>
          </label>
          <input type="range" min={5} max={600} step={5} value={config.tvDisplayTime}
            onChange={e => updateConfig({ tvDisplayTime: +e.target.value })}
            style={{ width: '100%', accentColor: '#06b6d4' }}/>
        </div>
      </div>

      {/* ── DANGER ── */}
      <div style={{ background: 'rgba(239,68,68,0.04)', borderRadius: 16, border: '1px solid rgba(239,68,68,0.15)', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#ef4444', marginBottom: 12 }}>⚠️ Zona de Risco</div>
        <button onClick={() => { if (confirm('Limpar todo o log do sistema?')) clearLog() }}
          style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
          🗑 Limpar Log do Sistema
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ─────────────────────────────────────────────────────────────────────────────
type FilterKey =
  | 'todos'
  | 'sem_rfid'
  | 'pode_sair_sozinho'
  | 'bloqueado'
  | 'dia_restrito'
  | 'sem_responsavel'

interface AlunoRow {
  id: string
  nome: string
  turma: string
  turno: string
  foto: string | null
  autorizaSaida: boolean
  autorizados: any[]
  // flags calculadas
  temRFID: boolean
  algumBloqueado: boolean
  algumDiaRestrito: boolean
  semResponsavel: boolean
}

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// ─────────────────────────────────────────────────────────────────────────────
// ABA: Relatórios
// ─────────────────────────────────────────────────────────────────────────────
function TabRelatorios() {
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const isMobile = useIsMobile()

  const [filter, setFilter] = useState<FilterKey>('todos')
  const [search, setSearch] = useState('')
  const [turmaFilter, setTurmaFilter] = useState('todas')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const todayIdx = new Date().getDay() // 0=Dom ... 6=Sáb
  const todayKey = DIAS_SEMANA[todayIdx]

  // ── Build rows ──────────────────────────────────────────────────────────────
  const rows = useMemo<AlunoRow[]>(() => {
    return (alunos || []).map((a: any) => {
      const saude: any = a.saude || {}
      const autorizados: any[] = saude.autorizados || []
      const autorizaSaida: boolean = !!saude.autorizaSaida

      const temRFID = autorizados.some(r => r.rfid && r.rfid.trim().length > 0)
      const algumBloqueado = autorizados.some(r => r.proibido === true)
      const algumDiaRestrito = autorizados.some(r => {
        const dias: string[] = r.diasSemana || []
        return dias.length > 0 && !dias.includes(todayKey)
      })
      const semResponsavel = autorizados.length === 0 && !autorizaSaida

      return {
        id: a.id, nome: a.nome || '(sem nome)', turma: a.turma || '',
        turno: a.turno || '', foto: a.foto || null,
        autorizaSaida, autorizados,
        temRFID, algumBloqueado, algumDiaRestrito, semResponsavel,
      }
    })
  }, [alunos, todayKey])

  // ── Turmas únicas para o select ─────────────────────────────────────────────
  const turmas = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => { if (r.turma) set.add(r.turma) })
    return [...set].sort()
  }, [rows])

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = rows

    // Turma
    if (turmaFilter !== 'todas') list = list.filter(r => r.turma === turmaFilter)

    // Busca
    if (search.trim().length >= 2) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.nome.toLowerCase().includes(q) || r.turma.toLowerCase().includes(q)
      )
    }

    // Filtro de situação
    switch (filter) {
      case 'sem_rfid':       return list.filter(r => !r.temRFID && !r.autorizaSaida)
      case 'pode_sair_sozinho': return list.filter(r => r.autorizaSaida)
      case 'bloqueado':      return list.filter(r => r.algumBloqueado)
      case 'dia_restrito':   return list.filter(r => r.algumDiaRestrito)
      case 'sem_responsavel':return list.filter(r => r.semResponsavel)
      default:               return list
    }
  }, [rows, filter, turmaFilter, search])

  // ── Contadores para os filtros ──────────────────────────────────────────────
  const counts = useMemo(() => ({
    todos:            rows.length,
    sem_rfid:         rows.filter(r => !r.temRFID && !r.autorizaSaida).length,
    pode_sair_sozinho:rows.filter(r => r.autorizaSaida).length,
    bloqueado:        rows.filter(r => r.algumBloqueado).length,
    dia_restrito:     rows.filter(r => r.algumDiaRestrito).length,
    sem_responsavel:  rows.filter(r => r.semResponsavel).length,
  }), [rows])

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = ['Nome','Turma','Turno','Pode Sair Sozinho','Tem RFID','Responsáveis','Bloqueados','Restrição Dia']
    const lines = filtered.map(r => [
      r.nome, r.turma, r.turno,
      r.autorizaSaida ? 'Sim' : 'Não',
      r.temRFID ? 'Sim' : 'Não',
      r.autorizados.length,
      r.autorizados.filter(x => x.proibido).length,
      r.algumDiaRestrito ? 'Sim' : 'Não',
    ])
    const csv = [header, ...lines].map(l => l.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `relatorio-portaria-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Filter chips ────────────────────────────────────────────────────────────
  const chips: { key: FilterKey; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'todos',            label: 'Todos',                 icon: <Users size={12}/>,        color: '#06b6d4' },
    { key: 'sem_rfid',         label: 'Sem RFID',              icon: <WifiOff size={12}/>,      color: '#f59e0b' },
    { key: 'pode_sair_sozinho',label: 'Saída Solo',            icon: <UserCheck size={12}/>,    color: '#10b981' },
    { key: 'bloqueado',        label: 'Proibido Retirar',      icon: <ShieldOff size={12}/>,    color: '#ef4444' },
    { key: 'dia_restrito',     label: 'Restrição Dia Hoje',    icon: <AlertTriangle size={12}/>,color: '#f97316' },
    { key: 'sem_responsavel',  label: 'Sem Responsável',       icon: <XCircle size={12}/>,      color: '#8b5cf6' },
  ]

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10,
        alignItems: 'center', marginBottom: 20,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar aluno ou turma..."
            style={{
              width: '100%', padding: '9px 12px 9px 34px',
              borderRadius: 10, border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-base))',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Turma select */}
        <div style={{ position: 'relative' }}>
          <GraduationCap size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}/>
          <select
            value={turmaFilter}
            onChange={e => setTurmaFilter(e.target.value)}
            style={{
              padding: '9px 32px 9px 30px', borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-base))',
              fontSize: 13, cursor: 'pointer', appearance: 'none', outline: 'none',
            }}
          >
            <option value="todas">Todas as turmas</option>
            {turmas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }}/>
        </div>

        {/* Export */}
        <button onClick={exportCSV} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 10,
          background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)',
          color: '#06b6d4', cursor: 'pointer', fontWeight: 700, fontSize: 12,
          whiteSpace: 'nowrap',
        }}>
          <Download size={13}/> Exportar CSV
        </button>
      </div>

      {/* ── Filter chips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {chips.map(chip => {
          const active = filter === chip.key
          return (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 100, cursor: 'pointer',
                border: `1px solid ${active ? chip.color : 'hsl(var(--border-subtle))'}`,
                background: active ? `${chip.color}18` : 'hsl(var(--bg-elevated))',
                color: active ? chip.color : 'hsl(var(--text-muted))',
                fontWeight: active ? 800 : 600, fontSize: 12,
                transition: 'all 0.15s',
              }}
            >
              {chip.icon}
              {chip.label}
              <span style={{
                padding: '1px 7px', borderRadius: 100, fontSize: 11, fontWeight: 900,
                background: active ? chip.color : 'hsl(var(--bg-overlay))',
                color: active ? '#fff' : 'hsl(var(--text-muted))',
              }}>
                {counts[chip.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Result count ── */}
      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 12, fontWeight: 600 }}>
        {filtered.length} aluno{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        {filter !== 'todos' && ` · filtro: ${chips.find(c => c.key === filter)?.label}`}
        {turmaFilter !== 'todas' && ` · turma: ${turmaFilter}`}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '48px', textAlign: 'center', borderRadius: 16,
          border: '1px dashed hsl(var(--border-subtle))',
          color: 'hsl(var(--text-muted))', fontSize: 14,
        }}>
          Nenhum aluno corresponde aos filtros selecionados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(row => {
            const expanded = expandedId === row.id
            return (
              <div
                key={row.id}
                style={{
                  borderRadius: 14, overflow: 'hidden',
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-elevated))',
                  transition: 'box-shadow 0.15s',
                }}
              >
                {/* Row header */}
                <div
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #06b6d420, #6366f120)',
                    border: '1px solid hsl(var(--border-subtle))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 900, color: '#06b6d4',
                  }}>
                    {row.foto
                      ? <img src={row.foto} alt={row.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : row.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()
                    }
                  </div>

                  {/* Name + turma */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-base))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                      {row.turma}{row.turno ? ` · ${row.turno}` : ''}
                    </div>
                  </div>

                  {/* Status badges */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {row.autorizaSaida && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                        ✅ Solo
                      </span>
                    )}
                    {row.temRFID ? (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}>
                        📡 RFID
                      </span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                        ⚠ Sem RFID
                      </span>
                    )}
                    {row.algumBloqueado && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        🚫 Bloqueado
                      </span>
                    )}
                    {row.algumDiaRestrito && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                        📅 Restrição hoje
                      </span>
                    )}
                    {row.semResponsavel && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
                        👤 Sem responsável
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
                      <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
                    </div>
                  </div>
                </div>

                {/* Expanded: responsáveis table */}
                {expanded && (
                  <div style={{
                    borderTop: '1px solid hsl(var(--border-subtle))',
                    padding: '16px',
                    background: 'hsl(var(--bg-base))',
                  }}>
                    {row.autorizados.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                        {row.autorizaSaida
                          ? '✅ Este aluno está autorizado a sair sozinho — não precisa de responsável.'
                          : '⚠ Nenhum responsável cadastrado. Configure em Saúde & Obs do aluno.'}
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ color: 'hsl(var(--text-muted))', fontWeight: 700, textAlign: 'left' }}>
                              {['Nome','Parentesco','Telefone','RFID','Dias Permitidos','Status'].map(h => (
                                <th key={h} style={{ padding: '4px 10px 8px', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {row.autorizados.map((resp: any, idx: number) => {
                              const diasSemana: string[] = resp.diasSemana || []
                              const diaRestrito = diasSemana.length > 0 && !diasSemana.includes(todayKey)
                              const proibido = resp.proibido === true
                              const statusColor = proibido ? '#ef4444' : diaRestrito ? '#f97316' : '#10b981'
                              const statusLabel = proibido ? '🚫 Proibido' : diaRestrito ? `⚠ Não hoje (${todayKey})` : '✅ Liberado'
                              return (
                                <tr key={idx} style={{
                                  borderTop: '1px solid hsl(var(--border-subtle))',
                                  background: proibido ? 'rgba(239,68,68,0.03)' : 'transparent',
                                }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 700, color: 'hsl(var(--text-base))' }}>{resp.nome || '—'}</td>
                                  <td style={{ padding: '8px 10px', color: 'hsl(var(--text-muted))' }}>{resp.parentesco || '—'}</td>
                                  <td style={{ padding: '8px 10px', color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>{resp.telefone || '—'}</td>
                                  <td style={{ padding: '8px 10px' }}>
                                    {resp.rfid && resp.rfid.trim()
                                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontFamily: 'monospace', fontSize: 10, fontWeight: 700 }}>
                                          <Wifi size={9}/> {resp.rfid}
                                        </span>
                                      : <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>
                                          <WifiOff size={9} style={{ display: 'inline', marginRight: 3 }}/>Sem RFID
                                        </span>
                                    }
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    {diasSemana.length === 0
                                      ? <span style={{ color: '#10b981', fontSize: 11 }}>Todos os dias</span>
                                      : <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                          {DIAS_SEMANA.map(d => (
                                            <span key={d} style={{
                                              padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                              background: diasSemana.includes(d) ? 'rgba(6,182,212,0.15)' : 'hsl(var(--bg-overlay))',
                                              color: diasSemana.includes(d) ? '#06b6d4' : 'hsl(var(--text-muted))',
                                              border: d === todayKey ? '1px solid #06b6d420' : 'none',
                                              fontStyle: !diasSemana.includes(d) ? 'italic' : 'normal',
                                              opacity: diasSemana.includes(d) ? 1 : 0.5,
                                            }}>
                                              {d}
                                            </span>
                                          ))}
                                        </div>
                                    }
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <span style={{ fontWeight: 800, fontSize: 11, color: statusColor }}>{statusLabel}</span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL com abas
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'config' | 'relatorios'

function ConfigContent() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('config')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'config',     label: 'Configurações',  icon: <Settings size={14}/>   },
    { key: 'relatorios', label: 'Relatórios',      icon: <BarChart3 size={14}/>  },
  ]

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 20 : 26, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={isMobile ? 20 : 26}/> Portaria · Controle de Saída
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
          Configurações do sistema e relatórios de autorização
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        borderBottom: '1px solid hsl(var(--border-subtle))',
        paddingBottom: 0,
      }}>
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', cursor: 'pointer',
                fontWeight: active ? 800 : 600, fontSize: 13,
                color: active ? '#06b6d4' : 'hsl(var(--text-muted))',
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid #06b6d4' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'config'     && <TabConfiguracoes />}
      {tab === 'relatorios' && <TabRelatorios />}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <DataProvider>
      <SaidaProvider>
        <ConfigContent />
      </SaidaProvider>
    </DataProvider>
  )
}
