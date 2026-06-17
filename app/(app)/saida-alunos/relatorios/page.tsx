'use client'
import { useState, useMemo } from 'react'
import { SaidaProvider, useSaida } from '@/lib/saidaContext'
import { DataProvider } from '@/lib/dataContext'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApiQuery } from '@/hooks/useApi'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import {
  Download, FileText, Filter, Calendar, Clock, GraduationCap,
  Users, WifiOff, UserCheck, ShieldOff, AlertTriangle, XCircle,
  Search, ChevronDown, Wifi
} from 'lucide-react'

// ── Helper functions ──
function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function normalizeDay(day: string): string {
  if (!day) return '';
  return day
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando', called: 'Chamado', confirmed: 'Confirmado',
  cancelled: 'Cancelado', recalled: 'Rechamado',
}

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// ── Types for Student Authorizations ──
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
  temRFID: boolean
  algumBloqueado: boolean
  algumDiaRestrito: boolean
  semResponsavel: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: HISTÓRICO DE CHAMADAS
// ─────────────────────────────────────────────────────────────────────────────
function TabHistoricoChamadas() {
  const { logs } = useSaida()
  const isMobile = useIsMobile()
  const [turmas] = useSupabaseArray<any>('turmas');
  
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [searchStudent, setSearchStudent] = useState('')
  const [searchGuardian, setSearchGuardian] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [hasSearched, setHasSearched] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: '',
    dateTo: '',
    searchStudent: '',
    searchGuardian: '',
    statusFilter: ''
  })
  
  const [historicoCalls, setHistoricoCalls] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const getTurmaNome = (id: string) => {
    return (turmas || []).find((t: any) => String(t.id) === String(id))?.nome || id
  }

  const filtered = useMemo(() => {
    if (!hasSearched) return []
    return (historicoCalls || []).filter(c => {
      if (appliedFilters.searchStudent && !c.studentName.toLowerCase().includes(appliedFilters.searchStudent.toLowerCase())) return false
      if (appliedFilters.searchGuardian && !c.guardianName.toLowerCase().includes(appliedFilters.searchGuardian.toLowerCase())) return false
      if (appliedFilters.statusFilter && c.status !== appliedFilters.statusFilter) return false
      return true
    }).sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime())
  }, [historicoCalls, appliedFilters, hasSearched])

  const handleBuscar = async () => {
    setIsLoading(true)
    setHasSearched(true)
    setAppliedFilters({ dateFrom, dateTo, searchStudent, searchGuardian, statusFilter })
    
    try {
      const urlParams = new URLSearchParams()
      if (dateFrom) urlParams.append('from', dateFrom)
      if (dateTo) urlParams.append('to', dateTo)
      
      const req = await fetch(`/api/saida/calls?${urlParams.toString()}`)
      if (!req.ok) throw new Error('Falha ao buscar chamadas')
      
      const data = await req.json()
      
      // A API já retorna os dados mapeados, basta settar
      setHistoricoCalls(data || [])
    } catch(err) {
      console.error(err)
      alert('Erro ao buscar histórico de chamadas')
    } finally {
      setIsLoading(false)
    }
  }

  const exportExcel = () => {
    const rows = filtered.map(c => ({
      'Aluno':        c.studentName,
      'Turma':        getTurmaNome(c.studentClass),
      'Responsável':  c.guardianName,
      'Origem':       c.source === 'rfid' ? 'RFID' : 'Manual',
      'RFID':         c.rfidCode ?? '—',
      'Chamado em':   fmtDate(c.calledAt),
      'Confirmado em':fmtDate(c.confirmedAt),
      'Status':       STATUS_LABEL[c.status] ?? c.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Saída de Alunos')
    XLSX.writeFile(wb, `relatorio-saida-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const exportCSV = () => {
    const header = 'Aluno,Turma,Responsável,Chamado em,Confirmado em,Status\n'
    const rows = filtered.map(c =>
      `"${c.studentName}","${getTurmaNome(c.studentClass)}","${c.guardianName}","${fmtDate(c.calledAt)}","${fmtDate(c.confirmedAt)}","${STATUS_LABEL[c.status] ?? c.status}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'relatorio-saida.csv'; a.click()
  }

  return (
    <div>

      {/* Filters */}
      <div style={{
        background: 'hsl(var(--bg-elevated))', borderRadius: 16,
        border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Filter size={15} color="#818cf8"/>
          <span style={{ fontWeight: 800, fontSize: 13 }}>Filtros</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {/* Date from */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>DE</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Date to */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>ATÉ</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Student */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>ALUNO</label>
            <input value={searchStudent} onChange={e => setSearchStudent(e.target.value)} placeholder="Nome..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Guardian */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>RESPONSÁVEL</label>
            <input value={searchGuardian} onChange={e => setSearchGuardian(e.target.value)} placeholder="Nome..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}/>
          </div>
          {/* Status */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 4 }}>STATUS</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-base))', fontSize: 12, boxSizing: 'border-box' }}>
              <option value="">Todos</option>
              <option value="waiting">Aguardando</option>
              <option value="confirmed">Confirmado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={handleBuscar} disabled={isLoading}
            style={{ 
              padding: '10px 24px', borderRadius: 10, border: 'none', 
              background: isLoading ? 'hsl(var(--bg-overlay))' : '#06b6d4', color: isLoading ? 'hsl(var(--text-muted))' : '#fff', cursor: isLoading ? 'not-allowed' : 'pointer', 
              fontWeight: 700, fontSize: 12, display: 'flex', 
              alignItems: 'center', justifyContent: 'center', gap: 6 
            }}>
            <Filter size={13}/> {isLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Export buttons */}
      {hasSearched && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center' }}>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))', fontWeight: 800 }}>
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </div>
          {filtered.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
              <button onClick={exportCSV}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.08)', color: '#06b6d4', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FileText size={13}/> Exportar CSV
              </button>
              <button onClick={exportExcel}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10b981', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Download size={13}/> Exportar Excel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table — desktop | Cards — mobile */}
      {!hasSearched ? (
        <div style={{
          padding: '48px', textAlign: 'center', borderRadius: 16,
          border: '1px dashed hsl(var(--border-subtle))',
          color: 'hsl(var(--text-muted))', fontSize: 13,
          background: 'hsl(var(--bg-elevated))'
        }}>
          💡 Utilize os filtros acima e clique em "Buscar" para carregar o histórico de chamadas.
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum registro encontrado
            </div>
          ) : filtered.map(c => {
            const statusColor = ({ confirmed: '#10b981', cancelled: '#ef4444', waiting: '#f59e0b', called: '#f59e0b', recalled: '#f59e0b' } as Record<string,string>)[c.status] ?? '#64748b'
            return (
              <div key={c.id} style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 14, padding: '14px 16px', borderLeft: `4px solid ${statusColor}` }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{c.studentName}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>{getTurmaNome(c.studentClass)} · {c.guardianName}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: `${statusColor}10`, color: statusColor, border: `1px solid ${statusColor}25`, fontWeight: 700 }}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: c.source === 'rfid' ? 'rgba(6,182,212,0.1)' : 'rgba(167,139,250,0.1)', color: c.source === 'rfid' ? '#06b6d4' : '#a78bfa', fontWeight: 700 }}>
                    {c.source === 'rfid' ? '📡 RFID' : '🖱 Manual'}
                  </span>
                  <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', padding: '2px 0' }}>{fmtTime(c.calledAt)}</span>
                  {c.confirmedAt && <span style={{ fontSize: 10, color: '#10b981', padding: '2px 0' }}>→ {fmtTime(c.confirmedAt)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                {['Aluno','Turma','Responsável','Origem','Chamado em','Confirmado em','Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: 'hsl(var(--text-muted))', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  Nenhum registro encontrado
                </td></tr>
              ) : filtered.map((c, i) => {
                const statusColor = ({ confirmed: '#10b981', cancelled: '#ef4444', waiting: '#f59e0b', called: '#f59e0b', recalled: '#f59e0b' } as Record<string,string>)[c.status] ?? '#64748b'
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--bg-overlay))' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.studentName}</td>
                    <td style={{ padding: '10px 14px', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{getTurmaNome(c.studentClass)}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{c.guardianName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: c.source === 'rfid' ? 'rgba(6,182,212,0.1)' : 'rgba(167,139,250,0.1)', color: c.source === 'rfid' ? '#06b6d4' : '#a78bfa', fontWeight: 700 }}>
                        {c.source === 'rfid' ? '📡 RFID' : '🖱 Manual'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'hsl(var(--text-muted))', fontFamily: 'monospace', fontSize: 11 }}>{fmtTime(c.calledAt)}</td>
                    <td style={{ padding: '10px 14px', color: '#10b981', fontFamily: 'monospace', fontSize: 11 }}>{fmtTime(c.confirmedAt)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 700, background: `${statusColor}10`, color: statusColor, border: `1px solid ${statusColor}25` }}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* System Logs */}
      <div style={{ marginTop: 36 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>🗒️ Log do Sistema (últimos 20)</div>
        <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(logs || []).slice(0, 20).map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 14, fontSize: 11, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'monospace', color: 'hsl(var(--text-muted))', flexShrink: 0, fontSize: 10 }}>
                {new Date(l.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{
                padding: '1px 7px', borderRadius: 5, fontSize: 9, fontWeight: 800, flexShrink: 0,
                background: l.type.includes('CONFIRM') ? 'rgba(16,185,129,0.1)' : l.type.includes('CANCEL') ? 'rgba(239,68,68,0.08)' : 'rgba(129,140,248,0.1)',
                color: l.type.includes('CONFIRM') ? '#10b981' : l.type.includes('CANCEL') ? '#ef4444' : '#818cf8',
              }}>{l.type}</span>
              <span style={{ color: 'hsl(var(--text-muted))' }}>{l.description}</span>
            </div>
          ))}
          {(logs || []).length === 0 && <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '16px 0' }}>Sem logs ainda</div>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: AUTORIZAÇÕES DE ALUNOS (merged & fixed from configuracoes)
// ─────────────────────────────────────────────────────────────────────────────
function TabAutorizacoesAlunos() {
  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const isMobile = useIsMobile()

  const { data: apiResponse } = useApiQuery<any>(
    ['alunos-report'],
    '/api/alunos?limit=1000'
  )
  const alunos = apiResponse?.data || []

  const getTurmaNome = (id: string) => {
    return (todasTurmas || []).find((t: any) => String(t.id) === String(id))?.nome || id
  }

  const [filter, setFilter] = useState<FilterKey>('todos')
  const [search, setSearch] = useState('')
  const [turmaFilter, setTurmaFilter] = useState('todas')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const todayIdx = new Date().getDay() // 0=Dom ... 6=Sáb
  const todayKey = DIAS_SEMANA[todayIdx]

  // ── Build rows with full multi-field day restriction checks & normalization ──
  const rows = useMemo<AlunoRow[]>(() => {
    return (alunos || []).map((a: any) => {
      const autorizados: any[] = a.responsaveis || []
      const autorizaSaida: boolean = !!a.autorizadoSairSozinho

      const temRFID = autorizados.some(r => r.rfid && r.rfid.trim().length > 0)
      const algumBloqueado = autorizados.some(r => r.proibido === true)
      const algumDiaRestrito = autorizados.some(r => {
        const dias: string[] = r.diasSemana || r.diasAcesso || r.dias_acesso || []
        if (dias.length === 0) return false
        const normalizedDias = dias.map(d => normalizeDay(d))
        return !normalizedDias.includes(normalizeDay(todayKey))
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

  // ── Unique classes for filters ──
  const turmas = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => { if (r.turma) set.add(r.turma) })
    return [...set].sort()
  }, [rows])

  // ── Apply filters ──
  const filtered = useMemo(() => {
    let list = rows

    if (turmaFilter !== 'todas') list = list.filter(r => r.turma === turmaFilter)

    if (search.trim().length >= 2) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.nome.toLowerCase().includes(q) || r.turma.toLowerCase().includes(q)
      )
    }

    switch (filter) {
      case 'sem_rfid':         return list.filter(r => !r.temRFID && !r.autorizaSaida)
      case 'pode_sair_sozinho':return list.filter(r => r.autorizaSaida)
      case 'bloqueado':        return list.filter(r => r.algumBloqueado)
      case 'dia_restrito':     return list.filter(r => r.algumDiaRestrito)
      case 'sem_responsavel':  return list.filter(r => r.semResponsavel)
      default:                 return list
    }
  }, [rows, filter, turmaFilter, search])

  // ── Counters ──
  const counts = useMemo(() => ({
    todos:            rows.length,
    sem_rfid:         rows.filter(r => !r.temRFID && !r.autorizaSaida).length,
    pode_sair_sozinho:rows.filter(r => r.autorizaSaida).length,
    bloqueado:        rows.filter(r => r.algumBloqueado).length,
    dia_restrito:     rows.filter(r => r.algumDiaRestrito).length,
    sem_responsavel:  rows.filter(r => r.semResponsavel).length,
  }), [rows])

  // ── Export Excel ──
  const exportExcel = () => {
    const rows = filtered.map(r => {
      const row: any = {
        'ID Aluno':          r.id,
        'Nome':              r.nome,
        'Turma':             getTurmaNome(r.turma),
        'Turno':             r.turno,
        'Pode Sair Sozinho': r.autorizaSaida ? 'Sim' : 'Não',
        'Tem RFID':          r.temRFID ? 'Sim' : 'Não',
        'Qtd Responsáveis':  r.autorizados.length,
      }
      
      r.autorizados.forEach((resp: any, idx: number) => {
        const num = idx + 1
        row[`Nome Responsável ${num}`] = resp.nome || '—'
        row[`ID Responsável ${num}`] = resp.id || '—'
        row[`RFID Responsável ${num}`] = resp.rfid || '—'
      })
      
      row['Bloqueados'] = r.autorizados.filter((x: any) => x.proibido).length
      row['Restrição Dia'] = r.algumDiaRestrito ? 'Sim' : 'Não'
      
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Portaria')
    XLSX.writeFile(wb, `relatorio-portaria-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

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
        <button onClick={exportExcel} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 10,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#10b981', cursor: 'pointer', fontWeight: 700, fontSize: 12,
          whiteSpace: 'nowrap',
        }}>
          <Download size={13}/> Exportar Excel
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
                      {getTurmaNome(row.turma)}{row.turno ? ` · ${row.turno}` : ''}
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

                {/* Expanded details */}
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
                          : '⚠ Nenhum responsável cadastrado. Configure na Ficha de Saúde do aluno.'}
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
                              const diasSemana: string[] = resp.diasSemana || resp.diasAcesso || resp.dias_acesso || []
                              const normalizedDias = diasSemana.map(d => normalizeDay(d))
                              const diaRestrito = diasSemana.length > 0 && !normalizedDias.includes(normalizeDay(todayKey))
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
                                          {DIAS_SEMANA.map(d => {
                                            const hasDay = normalizedDias.includes(normalizeDay(d))
                                            return (
                                              <span key={d} style={{
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                                background: hasDay ? 'rgba(6,182,212,0.15)' : 'hsl(var(--bg-overlay))',
                                                color: hasDay ? '#06b6d4' : 'hsl(var(--text-muted))',
                                                border: d === todayKey ? '1px solid #06b6d420' : 'none',
                                                fontStyle: !hasDay ? 'italic' : 'normal',
                                                opacity: hasDay ? 1 : 0.5,
                                              }}>
                                                {d}
                                              </span>
                                            )
                                          })}
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
// DASHBOARD NAVIGATION CONTAINER
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'historico' | 'autorizacoes'

function RelatoriosDashboard() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('historico')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'historico',    label: 'Histórico de Chamadas', icon: <Clock size={14}/> },
    { key: 'autorizacoes', label: 'Autorizações de Alunos', icon: <GraduationCap size={14}/> },
  ]

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 20 : 26, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          📊 Painel de Relatórios
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
          Visualize o histórico de chamadas de saída e a ficha de autorizações dos alunos
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
      {tab === 'historico'    && <TabHistoricoChamadas />}
      {tab === 'autorizacoes' && <TabAutorizacoesAlunos />}
    </div>
  )
}

export default function RelatoriosPage() {
  return (
    <DataProvider>
      <SaidaProvider>
        <RelatoriosDashboard />
      </SaidaProvider>
    </DataProvider>
  )
}
