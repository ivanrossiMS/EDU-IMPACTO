'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'

import {
  FileText, Download, Printer, Filter, ChevronLeft, ChevronRight, Search, CheckCircle,
  Users, UserPlus, Users2, Building2, UserCheck, Layers, ChevronDown, ListOrdered, Calendar, History, EyeOff, LayoutList, TargetIcon
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlunoMatriculado {
  id: string
  codigo: string
  nome: string
  turma: string
  serie: string
  turno: string
  unidade: string
  statusMatricula: string
  tipoMatricula: 'nova' | 'rematricula' | string
  dataMatricula: string
  nivelEnsino: string
  anoLetivo: number
}

interface Kpis {
  totalNovos: number
  totalRematriculados: number
  totalGeral: number
  taxaRetencao: number // rematriculados / totalGeral * 100
}

interface TurmaAgrupada {
  turmaNome: string
  turno: string
  serie: string
  vagasPrevistas: number
  novos: number
  rematriculados: number
  total: number
  alunos: AlunoMatriculado[]
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function thisMonthStart() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function fmtDate(dStr: string) {
  if (!dStr) return '-'
  if (dStr.includes('/')) return dStr
  const [y, m, d] = dStr.split('-')
  return `${d}/${m}/${y}`
}

function normalize(s: string) {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, danger }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string; danger?: boolean
}) {
  return (
    <div className="card" style={{
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 200,
      borderLeft: `3px solid ${color}`,
      background: danger ? `linear-gradient(135deg, hsl(var(--bg-surface)), ${color}08)` : undefined,
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: danger ? color : 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RematriculasPage() {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [rawData, setRawData] = useState<AlunoMatriculado[]>([])

  const [filters, setFilters] = useState({
    anoLetivo: String(new Date().getFullYear()),
    dataInicio: '',
    dataFim: '',
    situacao: '',
    tipo: 'todos', // 'todos', 'novos', 'rematriculados'
    nivelEnsino: '',
    ocultarInativos: true,
  })

  const [showFilters, setShowFilters] = useState(true)
  const [viewMode, setViewMode] = useState<'resumo' | 'detalhado'>('resumo')

  const { turmas, cfgNiveisEnsino } = useData()

  const getNomeSerie = useCallback((serieId: string | undefined | null) => {
    if (!serieId || serieId === '-') return '-'
    if (!cfgNiveisEnsino || !Array.isArray(cfgNiveisEnsino)) return String(serieId)
    
    for (const nivel of cfgNiveisEnsino) {
      if (Array.isArray(nivel.series)) {
        const s = nivel.series.find((x: any) => x.id === serieId || x.value === serieId || x.codigo === serieId)
        if (s) return `${nivel.nome} - ${s.nome || s.label || serieId}`
      }
    }
    return String(serieId)
  }, [cfgNiveisEnsino])

  // Mapeamento de Vagas
  const vagasTurma = useMemo(() => {
    const map = new Map<string, number>()
    ;(turmas || []).forEach(t => {
      // Se não tiver vagas cadastradas na turma, não mostramos ou deixamos 0
      map.set((t.nome || '').toLowerCase().trim(), Number(t.capacidade) || 0)
    })
    return map
  }, [turmas])

  const handleChange = (k: string, v: any) => setFilters(p => ({ ...p, [k]: v }))

  // ── FETCH ──
  const handleApply = useCallback(async (flt = filters) => {
    setLoading(true)
    try {
      // Usamos a source genérica de alunos, o backend cuidará da entrega basica
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'alunos', filters: { anoLetivo: flt.anoLetivo }, page: 1, pageSize: 99999 }),
      })
      const data = await res.json()
      setRawData(data.data || [])
      setHasLoaded(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Initial load
  useEffect(() => {
    if (!hasLoaded) handleApply()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── FILTERING (Frontend) ──
  const filtered = useMemo(() => {
    return rawData.filter(a => {
      // Ocultar Inativos
      const statusLower = (a.statusMatricula || '').toLowerCase()
      if (filters.ocultarInativos) {
        if (statusLower.includes('transferido') || statusLower.includes('cancelado') || statusLower.includes('desistente')) {
          return false
        }
      } else if (filters.situacao) {
        if (statusLower !== filters.situacao.toLowerCase()) return false
      }

      // Tipo 
      if (filters.tipo === 'novos' && a.tipoMatricula !== 'nova') return false
      if (filters.tipo === 'rematriculados' && a.tipoMatricula !== 'rematricula') return false

      // Nivel
      if (filters.nivelEnsino && a.nivelEnsino !== filters.nivelEnsino) return false

      // Datas
      if (filters.dataInicio && a.dataMatricula && a.dataMatricula < filters.dataInicio) return false
      if (filters.dataFim && a.dataMatricula && a.dataMatricula > filters.dataFim) return false

      // Fallback pra turma vazia se quiser descartar nao enturmados
      // if (!a.turma) return false 

      return true
    })
  }, [rawData, filters])

  // ── GROUPING ──
  const groupedTurmas = useMemo(() => {
    const map = new Map<string, TurmaAgrupada>()

    filtered.forEach(a => {
      const tKey = (a.turma || 'Sem Turma').trim()
      
      if (!map.has(tKey)) {
        map.set(tKey, {
          turmaNome: tKey,
          turno: a.turno || '-',
          serie: a.serie || '-',
          vagasPrevistas: vagasTurma.get(tKey.toLowerCase()) || 0,
          novos: 0,
          rematriculados: 0,
          total: 0,
          alunos: []
        })
      }

      const grp = map.get(tKey)!
      if (a.tipoMatricula === 'nova') grp.novos++
      else grp.rematriculados++
      
      grp.total++
      grp.alunos.push(a)
    })

    return Array.from(map.values()).sort((a, b) => a.turmaNome.localeCompare(b.turmaNome))
  }, [filtered, vagasTurma])

  // ── KPIs ──
  const kpis = useMemo<Kpis>(() => {
    let n = 0, r = 0, t = 0
    groupedTurmas.forEach(g => {
      n += g.novos
      r += g.rematriculados
      t += g.total
    })
    return {
      totalNovos: n,
      totalRematriculados: r,
      totalGeral: t,
      taxaRetencao: t > 0 ? (r / t) * 100 : 0
    }
  }, [groupedTurmas])

  // ── EXPORT Excel ──
  const exportXLSX = () => {
    const rows: any[][] = [
      ['RELATÓRIO DE NOVOS E REMATRICULADOS'],
      [`Ano Letivo base: ${filters.anoLetivo}`],
      [],
    ]

    if (viewMode === 'resumo') {
      rows.push(['Turma', 'Segmento / Série', 'Turno', 'Vagas Previstas', 'Total Novos', 'Total Rematriculados', 'Total Geral'])
      groupedTurmas.forEach(g => rows.push([
        g.turmaNome, getNomeSerie(g.serie), g.turno, g.vagasPrevistas || '-', g.novos, g.rematriculados, g.total
      ]))
      rows.push([])
      rows.push(['TOTAIS GERAIS', '', '', '', kpis.totalNovos, kpis.totalRematriculados, kpis.totalGeral])
    } else {
      rows.push(['Turma', 'RA/Código', 'Nome do Aluno', 'Situação', 'Data Ingresso', 'Tipo de Matrícula'])
      groupedTurmas.forEach(g => {
        g.alunos.forEach(a => {
          rows.push([g.turmaNome, a.codigo, a.nome, a.statusMatricula || 'Cursando', fmtDate(a.dataMatricula), a.tipoMatricula === 'nova' ? 'Novo' : 'Rematriculado'])
        })
      })
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Captação')
    XLSX.writeFile(wb, `captacao-rematriculas-${filters.anoLetivo}.xlsx`)
  }

  // ── EXPORT PDF ──
  const handlePrint = () => {
    const el = printRef.current
    if (!el) return
    const html = el.innerHTML
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Pedagógico — Novos e Rematriculados</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 11px; background: #fff; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th { background: #f1f5f9; color: #475569; font-weight: bold; text-transform: uppercase; font-size: 10px; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .turma-header { background: #e2e8f0; font-weight: bold; font-size: 12px; padding: 10px 8px; text-transform: uppercase; }
    h1 { font-size: 18px; margin-bottom: 4px; color: #0f172a; }
    p { color: #64748b; margin-bottom: 20px; }
    .kpi-row { display: flex; gap: 20px; margin-bottom: 20px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
    .kpi { flex: 1; }
    .kpi span { display: block; font-size: 10px; color: #64748b; text-transform: uppercase; }
    .kpi strong { display: block; font-size: 18px; color: #0f172a; margin-top: 4px; }
  </style>
</head>
<body>${html}</body>
</html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 600)
  }

  // Common UI Styles
  const S = {
    groupLabel: { fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' as const, marginBottom: 8, display: 'block' },
  }
  const P = {
    th: { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as React.CSSProperties,
    td: { padding: '12px 16px', fontSize: 13, color: 'hsl(var(--text-primary))', fontWeight: 600, borderBottom: '1px solid hsl(var(--border-subtle))' } as React.CSSProperties,
  }

  return (
    <div className="page-container">
      {/* ── HEADER ── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.back()} className="btn btn-ghost btn-icon">
            <ChevronLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserPlus size={18} /></div>
              <h1 className="page-title">Novos e Rematriculados</h1>
            </div>
            <p className="page-subtitle" style={{ marginTop: 4 }}>Demografia de captação e retenção de matrículas da instituição.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-elevated))', padding: 4, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
            <button
              onClick={() => setViewMode('resumo')}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: viewMode === 'resumo' ? 'hsl(var(--bg-overlay))' : 'transparent', color: viewMode === 'resumo' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', boxShadow: viewMode === 'resumo' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
              <LayoutList size={16} /> Painel Sumarizado
            </button>
            <button
              onClick={() => setViewMode('detalhado')}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: viewMode === 'detalhado' ? 'hsl(var(--bg-overlay))' : 'transparent', color: viewMode === 'detalhado' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', boxShadow: viewMode === 'detalhado' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
              <Users size={16} /> Listar por Aluno
            </button>
          </div>

          <button onClick={() => setShowFilters(f => !f)} className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'}`}>
            <Filter size={16} /> Filtros {showFilters ? 'Ativos' : ''}
          </button>
          <button onClick={exportXLSX} className="btn btn-outline" style={{ display: 'flex', gap: 8 }}><Download size={16} /> Excel</button>
          <button onClick={handlePrint} className="btn btn-outline" style={{ display: 'flex', gap: 8 }}><Printer size={16} /> PDF</button>
        </div>
      </div>

      {/* ── FILTROS ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: 24 }}>
            <div className="card" style={{ padding: 24, borderTop: '3px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, color: '#3b82f6', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Filter size={16} /> Cortar & Refinar
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>

                <div>
                  <label style={S.groupLabel}>Ano Letivo Base</label>
                  <select className="form-input" value={filters.anoLetivo} onChange={e => { handleChange('anoLetivo', e.target.value); handleApply({ ...filters, anoLetivo: e.target.value }) }} style={{ width: '100%' }}>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const y = new Date().getFullYear() + 2 - i
                      return <option key={y} value={y}>{y}</option>
                    })}
                  </select>
                </div>

                <div>
                  <label style={S.groupLabel}>Período Ingresso (Início/Fim)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" className="form-input" value={filters.dataInicio} onChange={e => handleChange('dataInicio', e.target.value)} style={{ flex: 1 }} />
                    <input type="date" className="form-input" value={filters.dataFim} onChange={e => handleChange('dataFim', e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>

                <div>
                  <label style={S.groupLabel}>Segmentar Tipo</label>
                  <select className="form-input" value={filters.tipo} onChange={e => handleChange('tipo', e.target.value)} style={{ width: '100%' }}>
                    <option value="todos">Todos (Novos + Rematriculados)</option>
                    <option value="novos">Apenas Novos Entrantes</option>
                    <option value="rematriculados">Apenas Rematriculados</option>
                  </select>
                </div>

                <div>
                  <label style={S.groupLabel}>Foco Nível de Ensino</label>
                  <select className="form-input" value={filters.nivelEnsino} onChange={e => handleChange('nivelEnsino', e.target.value)} style={{ width: '100%' }}>
                    <option value="">Todas as Etapas</option>
                    <option value="Infantil">Educação Infantil</option>
                    <option value="Ensino Fundamental">Ensino Fundamental</option>
                    <option value="Ensino Médio">Ensino Médio</option>
                  </select>
                </div>

              </div>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.ocultarInativos} onChange={e => handleChange('ocultarInativos', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#ef4444' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 6 }}><EyeOff size={16} color="#ef4444" /> Ocultar Alunos Inativos</span>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Remove automaticamente Desistentes, Transferidos e Cancelados.</span>
                  </div>
                </label>

                {!filters.ocultarInativos && (
                  <select className="form-input" value={filters.situacao} onChange={e => handleChange('situacao', e.target.value)} style={{ width: 220 }}>
                    <option value="">(Todos os status visíveis)</option>
                    <option value="cursando">Apenas Cursando</option>
                    <option value="aprovado">Apenas Aprovados</option>
                    <option value="transferido">Somente Transferidos</option>
                    <option value="desistente">Somente Desistentes</option>
                  </select>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPIs ── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard label="Censo Total do Período" value={String(kpis.totalGeral)} sub="alunos englobados" icon={<Users2 size={20} />} color="#3b82f6" />
        <KpiCard label="Captação (Novos)" value={String(kpis.totalNovos)} sub="primeiro ingresso" icon={<UserPlus size={20} />} color="#10b981" />
        <KpiCard label="Retenção (Rematriculas)" value={String(kpis.totalRematriculados)} sub="veteranos continuantes" icon={<UserCheck size={20} />} color="#f59e0b" />
        <KpiCard label="Conversão Retentiva" value={`${kpis.taxaRetencao.toFixed(1)}%`} sub="base garantida" icon={<TargetIcon size={20} />} color="#8b5cf6" />
      </div>

      {/* ── LOADER ── */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderTopColor: '#3b82f6' }} />
          <p>Compilando inteligência demográfica...</p>
        </div>
      )}

      {/* ── RESULTS ── */}
      {!loading && hasLoaded && groupedTurmas.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/7486/7486747.png" alt="Empty" style={{ opacity: 0.2, filter: 'grayscale(100%)', width: 64, marginBottom: 20 }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Demografia zerada</h3>
          <p style={{ color: 'hsl(var(--text-muted))', marginTop: 8, maxWidth: 400 }}>Seus filtros limitaram excessivamente a busca ou não há alunos associados ao ano letivo em questão.</p>
        </div>
      )}

      {!loading && groupedTurmas.length > 0 && viewMode === 'resumo' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'hsl(var(--bg-overlay))', borderBottom: '2px solid hsl(var(--border-subtle))' }}>
                  <th style={P.th}>Turma</th>
                  <th style={P.th}>Segmento / Série</th>
                  <th style={P.th}>Turno</th>
                  <th style={P.th}>Vagas</th>
                  <th style={{ ...P.th, color: '#10b981' }}>Alunos Novos</th>
                  <th style={{ ...P.th, color: '#f59e0b' }}>Renovações</th>
                  <th style={{ ...P.th, color: '#3b82f6' }}>Total Turma</th>
                  <th style={P.th}>Ocupação</th>
                </tr>
              </thead>
              <tbody>
                {groupedTurmas.map((g, idx) => {
                  const prop = g.vagasPrevistas > 0 ? (g.total / g.vagasPrevistas * 100) : 0
                  return (
                    <motion.tr key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} style={{ transition: 'background 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-overlay))'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={P.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ display: 'flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 8, fontSize: 10, fontWeight: 800 }}>T{idx + 1}</span>
                          <span style={{ fontWeight: 800, fontSize: 14 }}>{g.turmaNome}</span>
                        </div>
                      </td>
                      <td style={P.td}>{getNomeSerie(g.serie)}</td>
                      <td style={P.td}>{g.turno}</td>
                      <td style={P.td}>{g.vagasPrevistas > 0 ? g.vagasPrevistas : '-'}</td>
                      <td style={{ ...P.td, fontWeight: 800, color: '#10b981' }}>{g.novos}</td>
                      <td style={{ ...P.td, fontWeight: 800, color: '#f59e0b' }}>{g.rematriculados}</td>
                      <td style={{ ...P.td, fontWeight: 900, color: '#3b82f6', fontSize: 16 }}>{g.total}</td>
                      <td style={P.td}>
                        {g.vagasPrevistas > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'rgba(100,116,139,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: prop >= 100 ? '#ef4444' : prop >= 80 ? '#f59e0b' : '#10b981', width: `${Math.min(prop, 100)}%` }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, width: 36, textAlign: 'right' }}>{prop.toFixed(0)}%</span>
                          </div>
                        ) : <span style={{ color: 'hsl(var(--text-muted))', fontSize: 11 }}>S/ Meta</span>}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(59,130,246,0.05)', borderTop: '2px solid hsl(var(--border-subtle))' }}>
                  <td colSpan={4} style={{ padding: '16px', fontSize: 13, fontWeight: 900, color: 'hsl(var(--text-primary))', textAlign: 'right', textTransform: 'uppercase' }}>Consolidado Geral:</td>
                  <td style={{ padding: '16px', fontSize: 16, fontWeight: 900, color: '#10b981' }}>{kpis.totalNovos}</td>
                  <td style={{ padding: '16px', fontSize: 16, fontWeight: 900, color: '#f59e0b' }}>{kpis.totalRematriculados}</td>
                  <td style={{ padding: '16px', fontSize: 18, fontWeight: 900, color: '#3b82f6' }} colSpan={2}>{kpis.totalGeral} alunos</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── RESULTS (Detalhado) ── */}
      {!loading && groupedTurmas.length > 0 && viewMode === 'detalhado' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groupedTurmas.map((g, tIdx) => (
            <motion.div key={tIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: tIdx * 0.05 }} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'hsl(var(--bg-overlay))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{g.turmaNome}</h3>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', gap: 12 }}>
                      <span>{getNomeSerie(g.serie)}</span>
                      <span>•</span>
                      <span>{g.turno}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase' }}>Novos</span><span style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>{g.novos}</span></div>
                  <div style={{ width: 1, background: 'hsl(var(--border-subtle))' }} />
                  <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 800, textTransform: 'uppercase' }}>Renováveis</span><span style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b' }}>{g.rematriculados}</span></div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...P.th, background: 'transparent' }}>Nome do Aluno</th>
                      <th style={{ ...P.th, background: 'transparent' }}>Matrícula / RA</th>
                      <th style={{ ...P.th, background: 'transparent' }}>Captação</th>
                      <th style={{ ...P.th, background: 'transparent' }}>Data Ingresso</th>
                      <th style={{ ...P.th, background: 'transparent' }}>Situação Atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.alunos.map((a, aIdx) => (
                      <tr key={aIdx} style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...P.td, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                          <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{a.nome}</div>
                        </td>
                        <td style={{ ...P.td, borderBottom: '1px solid rgba(148,163,184,0.1)', fontFamily: 'monospace', fontSize: 12, color: 'hsl(var(--text-muted))' }}>{a.codigo}</td>
                        <td style={{ ...P.td, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                          <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: a.tipoMatricula === 'nova' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: a.tipoMatricula === 'nova' ? '#10b981' : '#f59e0b' }}>
                            {a.tipoMatricula === 'nova' ? 'NOVO' : 'REMATRÍCULA'}
                          </span>
                        </td>
                        <td style={{ ...P.td, borderBottom: '1px solid rgba(148,163,184,0.1)', color: 'hsl(var(--text-secondary))' }}>{fmtDate(a.dataMatricula)}</td>
                        <td style={{ ...P.td, borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'capitalize' }}>
                              {!filters.ocultarInativos && (a.statusMatricula.toLowerCase().includes('cancelado') || a.statusMatricula.toLowerCase().includes('desistente')) && <div style={{width:6,height:6,borderRadius:3,background:'#ef4444'}}/>}
                              {filters.ocultarInativos && <div style={{width:6,height:6,borderRadius:3,background:'#10b981'}}/>}
                              {a.statusMatricula || 'Cursando'}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── HIDDEN PRINT WRAPPER ── */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <h1>Relatório: Novos e Rematriculados — Ano Base {filters.anoLetivo}</h1>
          <p>Extração executada em: {new Date().toLocaleString('pt-BR')}</p>

          <div className="kpi-row">
            <div className="kpi"><span>Censo Total</span><strong>{kpis.totalGeral}</strong></div>
            <div className="kpi"><span>Total Novos</span><strong>{kpis.totalNovos}</strong></div>
            <div className="kpi"><span>Total Rematriculas</span><strong>{kpis.totalRematriculados}</strong></div>
            <div className="kpi"><span>Retenção/Conversão</span><strong>{kpis.taxaRetencao.toFixed(1)}%</strong></div>
          </div>

          {groupedTurmas.map((g, idx) => (
            <div key={idx} style={{ pageBreakInside: 'avoid' }}>
              <div className="turma-header">{g.turmaNome} - {getNomeSerie(g.serie)} ({g.turno}) | Novos: {g.novos} | Renovações: {g.rematriculados} | Total: {g.total}</div>
              <table>
                <thead>
                  <tr>
                    <th>Nome do Aluno</th>
                    <th>Matrícula</th>
                    <th>Tipo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {g.alunos.map((a, aIdx) => (
                    <tr key={aIdx}>
                      <td>{a.nome}</td>
                      <td>{a.codigo}</td>
                      <td>{a.tipoMatricula === 'nova' ? 'NOVO' : 'REMATRICULA'}</td>
                      <td>{a.statusMatricula || 'Cursando'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
