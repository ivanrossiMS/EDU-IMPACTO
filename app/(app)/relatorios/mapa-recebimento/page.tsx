'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  Map as MapIcon, Filter, RefreshCw, FileSpreadsheet, Printer,
  ArrowLeft, Search, X, Check, Calendar, ChevronRight,
  TrendingUp, Users, Building2, GraduationCap,
  BookOpen, Layers, CheckCircle, SlidersHorizontal, Eye, Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { useData } from '@/lib/dataContext'

interface Parcela {
  alunoId: string
  codigo: string
  nome: string
  turma: string
  unidade: string
  evento: string
  parcela: string
  competencia: string
  vencimento: string
  valor: number
  desconto: number
  juros: number
  multa: number
  saldo: number
  statusFinanceiro: string
  anoLetivo: number
}

interface Filters {
  dataInicio: string
  dataFim: string
  nivelEnsino: string
  unidade: string
  anoLetivo: string
  turmas: string[]
  eventos: string[]
  agrupamento: string
}

const DEFAULT_FILTERS: Filters = {
  dataInicio: `${new Date().getFullYear()}-01-01`,
  dataFim: `${new Date().getFullYear()}-12-31`,
  nivelEnsino: '',
  unidade: '',
  anoLetivo: new Date().getFullYear().toString(),
  turmas: [],
  eventos: [],
  agrupamento: 'turma'
}

const fmtR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCur = (n: number) => `R$ ${fmtR(Math.abs(n))}`
function statusBadge(status: string) {
  switch (status) {
    case 'pago': return { label: 'Pago', bg: '#10b981', color: '#fff' }
    case 'renegociado': return { label: 'Reneg.', bg: '#10b981', color: '#fff' }
    case 'vencido': return { label: 'Venc!', bg: '#ef4444', color: '#fff' }
    default: return { label: 'Aberto', bg: '#f59e0b', color: '#fff' }
  }
}
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const ACCENT = '#0ea5e9'
const ACCENT2 = '#10b981'

// --- MODAL SUBCOMPONENT ---
function SelectionModal({ title, icon, items, selected, onClose, onApply, searchPlaceholder, extraContent }: any) {
  const [local, setLocal] = useState<string[]>(selected)
  const [search, setSearch] = useState('')
  const filtered = items.filter((i: string) => norm(i).includes(norm(search)))

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>{icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{title}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{local.length === 0 ? 'Todos' : `${local.length} selecionado(s)`}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ padding: '12px 22px 8px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          {extraContent && <div style={{ marginBottom: 12 }}>{extraContent}</div>}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder} className="form-input" style={{ paddingLeft: 32, fontSize: 12 }} />
          </div>
        </div>

        <div style={{ padding: '8px 22px', display: 'flex', gap: 8, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <button onClick={() => setLocal(items)} style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Todos</button>
          <button onClick={() => setLocal([])} style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Nenhum</button>
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '8px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'hsl(var(--text-muted))', fontSize: 12 }}>Nenhum item</div>
          ) : filtered.map((item: string) => {
            const checked = local.includes(item)
            return (
              <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer', borderRadius: 4, margin: '2px 0', background: checked ? `${ACCENT}12` : 'transparent', transition: 'background 0.15s' }}>
                <div style={{ width: 18, height: 18, borderRadius: 3, flexShrink: 0, border: checked ? `2px solid ${ACCENT}` : '2px solid hsl(var(--border-default))', background: checked ? ACCENT : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked && <Check size={11} color="#fff" />}
                </div>
                <input type="checkbox" checked={checked} onChange={e => { if (e.target.checked) setLocal(p => [...p, item]); else setLocal(p => p.filter(x => x !== item)) }} style={{ display: 'none' }} />
                <span style={{ fontSize: 12, color: 'hsl(var(--text-primary))' }}>{item}</span>
              </label>
            )
          })}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid hsl(var(--border-default))', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'hsl(var(--bg-elevated))' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancelar</button>
          <button onClick={() => { onApply(local); onClose() }} style={{ fontSize: 12, fontWeight: 700, padding: '7px 18px', borderRadius: 4, cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none' }}>Aplicar</button>
        </div>
      </div>
    </div>
  )
}

export default function MapaRecebimentoPage() {
  const router = useRouter()
  const printRef = React.useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(true)
  
  const [showTurmasModal, setShowTurmasModal] = useState(false)
  const [showEventosModal, setShowEventosModal] = useState(false)
  
  const [yrOptions] = useState(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1, y + 2].map(String)
  })

  const { cfgNiveisEnsino, mantenedores, turmas: turmasCtx, cfgEventos } = useData()
  
  const nivelOptions = useMemo(() => (cfgNiveisEnsino || []).filter((n: any) => n.situacao !== 'inativo'), [cfgNiveisEnsino])
  
  const unidadeOptions = useMemo(() => {
    const m = (mantenedores as any)?.[0]
    if (!m?.unidades) return []
    return Object.entries(m.unidades).map(([k, v]: any) => ({ id: k, label: v.nomeFantasia || v.razaoSocial, cidade: v.cidade }))
  }, [mantenedores])

  const turmaOptions = useMemo(() => {
    const items = turmasCtx || []
    return items.filter((t: any) => {
      if (filters.anoLetivo && String(t.ano) !== filters.anoLetivo) return false
      if (filters.unidade && !norm(t.unidade || '').includes(norm(filters.unidade))) return false
      return true
    }).map((t: any) => t.nome).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b))
  }, [turmasCtx, filters.anoLetivo, filters.unidade])

  const eventosDisponiveis = useMemo(() => {
    const fromConfig = (cfgEventos || []).map((e: any) => e.descricao).filter(Boolean)
    const fromRows = [...new Set(parcelas.map(r => r.evento).filter(Boolean))]
    return [...new Set([...fromConfig, ...fromRows])].sort((a: string, b: string) => a.localeCompare(b)) as string[]
  }, [cfgEventos, parcelas])

  // Dynamic grouping open/close
  const [openGrupos, setOpenGrupos] = useState<Set<string>>(new Set())

  const handleApply = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'financeiro_recebimentos',
          filters: {
            dataInicio: filters.dataInicio,
            dataFim: filters.dataFim
          },
          page: 1,
          pageSize: 99999
        })
      })
      if (!res.ok) throw new Error('Erro na busca das parcelas. Verifique sua conexão e tente novamente.')
      const data = await res.json()
      
      let rows: Parcela[] = data.data || []
      
      // Client-side filtering
      if (filters.turmas.length > 0) rows = rows.filter(p => filters.turmas.includes(p.turma))
      if (filters.eventos.length > 0) rows = rows.filter(p => filters.eventos.includes(p.evento))
      
      if (filters.anoLetivo) {
        rows = rows.filter(p => String(p.anoLetivo || '') === String(filters.anoLetivo))
      }
      
      if (filters.unidade) {
        rows = rows.filter(p => norm(p.unidade) === norm(filters.unidade))
      }
      
      if (filters.nivelEnsino) {
        const nivel = nivelOptions.find((n: any) => n.id === filters.nivelEnsino)
        if (nivel) {
          const serieNomes = (nivel.series || []).map((s: any) => norm(s.nome))
          rows = rows.filter(p => serieNomes.includes(norm((p as any).serie || '')))
        }
      }
      
      setParcelas(rows)
      setHasLoaded(true)
    } catch(err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Funcao robusta para extrair YYYY-MM tolerando falhas ou N/A
  const extractYM = useCallback((val1: any, val2: any) => {
    for (const raw of [val1, val2]) {
        const v = String(raw || '').trim()
        if (!v) continue;
        let m1 = v.match(/((?:19|20)\d{2})-([1-9]|0[1-9]|1[0-2])(?:\b|-|T)/);
        if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}`;
        let m2 = v.match(/(?:^|\/|-)([1-9]|0[1-9]|1[0-2])(?:\/|-)((?:19|20)\d{2})(?:\b|-|T|$)/);
        if (m2) return `${m2[2]}-${m2[1].padStart(2, '0')}`;
    }
    return null;
  }, [])

  // Process Pivot Data: Grouping -> Alunos -> Competências
  const pivotData = useMemo(() => {
    if (!parcelas.length) return null

    // 1. Get unique Meses (YYYY-MM) as Columns
    const meses = new Set<string>()
    const anoBase = filters.anoLetivo || String(new Date().getFullYear())
    for (let i = 1; i <= 12; i++) meses.add(`${anoBase}-${String(i).padStart(2, '0')}`)
    
    parcelas.forEach(p => {
      const ym = extractYM(p.competencia, p.vencimento);
      if (ym) meses.add(ym);
    })
    const cols = Array.from(meses).sort()

    // 2. Group by Selection -> Aluno -> Parcelas
    const map = new Map<string, Map<string, { nome: string, turmas: Set<string>, parcelas: Parcela[] }>>()
    parcelas.forEach(p => {
      const gkey = filters.agrupamento === 'turma' ? (p.turma || 'Sem Turma') : 'Todos os Alunos'
      if (!map.has(gkey)) map.set(gkey, new Map())
      
      const al = p.codigo || p.alunoId
      if (!map.get(gkey)!.has(al)) {
        map.get(gkey)!.set(al, { nome: p.nome, turmas: new Set(), parcelas: [] })
      }
      map.get(gkey)!.get(al)!.turmas.add(p.turma)
      map.get(gkey)!.get(al)!.parcelas.push(p)
    })

    // 3. Mount Array format
    const gruposArray = Array.from(map.entries()).map(([grupoName, alunosMap]) => {
      const alunosArray = Array.from(alunosMap.values()).map(al => ({
        ...al, 
        turmasList: Array.from(al.turmas).filter(Boolean).join(', ')
      })).sort((a,b) => a.nome.localeCompare(b.nome))

      // Auto-open first few
      if (filters.agrupamento !== 'nenhum') {
        setOpenGrupos(prev => {
          const p = new Set(prev)
          p.add(grupoName)
          return p
        })
      }

      return { grupoName, alunos: alunosArray }
    }).sort((a,b) => a.grupoName.localeCompare(b.grupoName))

    const MESES_NOMES: Record<string, string> = {
      '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR', '05': 'MAI', '06': 'JUN',
      '07': 'JUL', '08': 'AGO', '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ'
    }

    const formatMes = (iso: string) => {
      if (!iso) return 'N/A'
      const [y, m] = iso.split('-')
      if (!y || !m || y.length < 4) return 'N/A'
      return `${MESES_NOMES[m] || m}/${y.slice(2)}`
    }

    return { cols, colsStr: cols.map(formatMes), grupos: gruposArray, totalParcelas: parcelas.length }
  }, [parcelas, filters.agrupamento])

  const toggleGrupo = (gn: string) => {
    setOpenGrupos(prev => {
      const n = new Set(prev)
      n.has(gn) ? n.delete(gn) : n.add(gn)
      return n
    })
  }

  const actFilterCount = (filters.turmas.length ? 1 : 0) + (filters.eventos.length ? 1 : 0)

  const handleExportExcel = () => {
    if (!pivotData || !pivotData.grupos) return;
    const defaultHeaders = ['Grupo', 'Aluno', 'Turma', ...pivotData.colsStr, 'Total Previsto', 'Total Encargos', 'Total Realizado']
    const rows: any[][] = [['MAPA DE RECEBIMENTO MATRICIAL'], [], defaultHeaders]
    
    pivotData.grupos.forEach(g => {
       rows.push([`GRUPO: ${g.grupoName}`])
       g.alunos.forEach(al => {
           let rowTotalPrevisto = 0;
           let rowTotalEncargos = 0;
           let rowTotalRealizado = 0;
           
           const r: any[] = ['', al.nome, al.turmasList || ''];
           
           pivotData.cols.forEach(m => {
               const parcs = al.parcelas.filter(p => Object.is(extractYM(p.competencia, p.vencimento), m));
               const valBase = parcs.reduce((s,p) => s + (Number(p.valor)||0), 0)
               const valDesconto = parcs.reduce((s,p) => s + (Number(p.desconto)||0), 0)
               const valJuros = parcs.reduce((s,p) => s + (Number(p.juros)||0), 0)
               const valMulta = parcs.reduce((s,p) => s + (Number(p.multa)||0), 0)
               
               const valPrevisto = valBase - valDesconto
               const valEncargos = valJuros + valMulta
               const valRealizadoItem = parcs
                 .filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
                 .reduce((s,p) => s + (Number(p.valor)||0) - (Number(p.desconto)||0) + (Number(p.juros)||0) + (Number(p.multa)||0), 0)
                 
               rowTotalPrevisto += valPrevisto
               rowTotalEncargos += valEncargos
               rowTotalRealizado += valRealizadoItem
               
               r.push(valPrevisto + valEncargos)
           })
           
           r.push(rowTotalPrevisto, rowTotalEncargos, rowTotalRealizado);
           rows.push(r)
       })
       rows.push([]) 
    })
    
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mapa')
    XLSX.writeFile(wb, `mapa-recebimento-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const handlePrint = () => {
    const el = printRef.current
    if (!el) return
    const html = el.innerHTML
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html><head><title>Impressão Mapa</title>
<style>
body { font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 15px; font-size: 10px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
.card { border: none !important; box-shadow: none !important; }
div, table, tbody, thead, tr { overflow: visible !important; }
@media print { 
  @page { size: landscape A3; margin: 8mm; } 
  * { overflow: visible !important; }
  body { zoom: 0.75; }
}
</style>
</head><body>
<h2>Mapa de Recebimento Matricial</h2>
${html}
</body></html>`)
    w.document.close()
    setTimeout(() => { w.print(); w.close(); }, 500)
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 0 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-secondary btn-icon" style={{ marginTop: 2 }}><ArrowLeft size={15} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #0369a1)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapIcon size={18} color="#fff" />
            </div>
            <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>Mapa de Recebimento</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${ACCENT}18`, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Financeiro</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>Visão matricial ampla de status cruzados entre alunos e competências.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setShowFilters(!showFilters)} className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} style={{ gap: 5 }}>
            <SlidersHorizontal size={11} /> Filtros {actFilterCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>{actFilterCount}</span>}
          </button>
          
          {hasLoaded && pivotData && pivotData.cols.length > 0 && (
            <>
              <button onClick={handleExportExcel} className="btn btn-sm" style={{ gap: 5, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700 }}>
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button onClick={handlePrint} className="btn btn-sm" style={{ gap: 5, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}40`, fontWeight: 700 }}>
                <Printer size={13} /> Imprimir PDF
              </button>
            </>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Filter size={13} color={ACCENT} />
            <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Matriz de Filtros</span>
          </div>

          {/* Line 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div><label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} /> Início do Evento</label>
            <input type="date" className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.dataInicio} onChange={e => setFilters(f => ({ ...f, dataInicio: e.target.value }))} /></div>
            <div><label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} /> Fim do Evento</label>
            <input type="date" className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.dataFim} onChange={e => setFilters(f => ({ ...f, dataFim: e.target.value }))} /></div>
            
            <div><label className="form-label" style={{ fontSize: 10 }}><GraduationCap size={10} style={{ display: 'inline', marginRight: 3 }} /> Nível de Ensino</label>
            <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.nivelEnsino} onChange={e => setFilters(f => ({ ...f, nivelEnsino: e.target.value }))}>
              <option value="">Todos os níveis</option>
              {nivelOptions.map((n: any) => <option key={n.id} value={n.id}>{n.nome}</option>)}
            </select></div>
            
            <div><label className="form-label" style={{ fontSize: 10 }}><Building2 size={10} style={{ display: 'inline', marginRight: 3 }} /> Unidade Base</label>
            <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.unidade} onChange={e => setFilters(f => ({ ...f, unidade: e.target.value }))}>
              <option value="">Todas as unidades</option>
              {unidadeOptions.map((u: any) => <option key={u.id} value={u.label}>{u.label}</option>)}
            </select></div>

            <div><label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} /> Ano Letivo Base</label>
            <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.anoLetivo} onChange={e => setFilters(f => ({ ...f, anoLetivo: e.target.value }))}>
              {yrOptions.map((y: string) => <option key={y} value={y}>{y}</option>)}
            </select></div>
            <div><label className="form-label" style={{ fontSize: 10 }}><MapIcon size={10} style={{ display: 'inline', marginRight: 3 }} /> Agrupamento</label>
            <select className="form-input" style={{ fontSize: 11, padding: '6px 10px' }} value={filters.agrupamento} onChange={e => setFilters(f => ({ ...f, agrupamento: e.target.value }))}>
              <option value="turma">Por Turma</option>
              <option value="nenhum">Sem Agrupamento</option>
            </select></div>
          </div>

          {/* Line 2 Modal triggers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}><BookOpen size={10} style={{ display: 'inline', marginRight: 3 }} /> Filtro de Turma</label>
              <button onClick={() => setShowTurmasModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', fontSize: 11, width: '100%', background: filters.turmas.length > 0 ? `${ACCENT}12` : 'hsl(var(--bg-input))', border: `1px solid ${filters.turmas.length > 0 ? ACCENT + '40' : 'hsl(var(--border-default))'}`, borderRadius: 4, cursor: 'pointer', color: 'hsl(var(--text-primary))' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: filters.turmas.length > 0 ? ACCENT : undefined, fontWeight: filters.turmas.length > 0 ? 600 : 400 }}>
                  {filters.turmas.length === 0 ? 'Todas as turmas permitidas' : `${filters.turmas.length} selecionada(s)`}
                </span>
                <ChevronRight size={12} style={{ color: filters.turmas.length > 0 ? ACCENT : 'hsl(var(--text-muted))' }} />
              </button>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}><Layers size={10} style={{ display: 'inline', marginRight: 3 }} /> Filtro de Evento (Curso)</label>
              <button onClick={() => setShowEventosModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', fontSize: 11, width: '100%', background: filters.eventos.length > 0 ? `${ACCENT}12` : 'hsl(var(--bg-input))', border: `1px solid ${filters.eventos.length > 0 ? ACCENT + '40' : 'hsl(var(--border-default))'}`, borderRadius: 4, cursor: 'pointer', color: 'hsl(var(--text-primary))' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: filters.eventos.length > 0 ? ACCENT : undefined, fontWeight: filters.eventos.length > 0 ? 600 : 400 }}>
                  {filters.eventos.length === 0 ? 'Todos os cursos' : `${filters.eventos.length} selecionado(s)`}
                </span>
                <ChevronRight size={12} style={{ color: filters.eventos.length > 0 ? ACCENT : 'hsl(var(--text-muted))' }} />
              </button>
            </div>
          </div>
          
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <button onClick={() => setFilters(DEFAULT_FILTERS)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Restaurar filtros</button>
             <button onClick={handleApply} className="btn btn-primary" style={{ background: ACCENT, borderColor: ACCENT }} disabled={loading}>
               {loading ? <Loader2 size={13} className="spin" /> : <TrendingUp size={13} />} Extrair Matriz
             </button>
          </div>
        </div>
      )}

      {/* MATRIX RESULTS */}
      {!hasLoaded && !loading && (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))' }}>
          <MapIcon size={40} style={{ color: ACCENT, margin: '0 auto 14px', display: 'block', opacity: 0.5 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>Tabela Dinâmica do Mapa de Recebimento</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Configure os filtros e clique em <strong>Extrair Matriz</strong> para enxergar o panorama.</div>
        </div>
      )}

      {loading && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Loader2 size={32} style={{ color: ACCENT, margin: '0 auto 12px', animation: 'spin 1s linear infinite', display: 'block' }} />
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Cruzeirando matriz... aguarde.</div>
        </div>
      )}

      {hasLoaded && !loading && pivotData && pivotData.cols.length > 0 && (
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }} ref={printRef}>
           <div style={{ padding: '16px 20px', background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
             <h3 style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mapa Gerencial de Receitas</h3>
             <p style={{ margin: 0, fontSize: 11, color: 'hsl(var(--text-muted))' }}>{filters.agrupamento === 'turma' ? `${pivotData.grupos.length} Turmas listadas` : 'Visualização livre'} atravessando {pivotData.cols.length} meses de competência.</p>
           </div>
           
           <div style={{ overflowX: 'auto', width: '100%', paddingBottom: 10 }}>
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
               <thead>
                 <tr>
                   <th style={{ position: 'sticky', left: 0, zIndex: 10, background: 'hsl(var(--bg-elevated))', width: 200, padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: 'hsl(var(--text-primary))', borderBottom: '2px solid hsl(var(--border-subtle))', borderRight: '1px solid hsl(var(--border-subtle))' }}>
                     {filters.agrupamento === 'turma' ? 'Alunos por Turma' : 'Lista Completa de Alunos'}
                   </th>
                   {pivotData.colsStr.map(c => (
                     <th key={c} style={{ padding: '8px 4px', textAlign: 'center', background: 'hsl(var(--bg-elevated))', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', borderBottom: '2px solid hsl(var(--border-subtle))' }}>
                       {c}
                     </th>
                   ))}
                   <th style={{ padding: '8px 10px', textAlign: 'right', background: 'hsl(var(--bg-elevated))', fontWeight: 800, color: ACCENT, borderBottom: '2px solid hsl(var(--border-subtle))' }}>
                     <div style={{ fontSize: 9, opacity: 0.8, marginBottom: 2 }}>TOTAL PREVISTO</div>
                     <div>TOTAL REALIZADO</div>
                   </th>
                 </tr>
               </thead>
               <tbody>
                 {pivotData.grupos.map(g => {
                   const isOpen = openGrupos.has(g.grupoName)
                   return (
                     <React.Fragment key={g.grupoName}>
                       {/* GROUP HEADER ROW */}
                       {filters.agrupamento === 'turma' && (
                         <tr style={{ background: `${ACCENT}08`, borderTop: '2px solid hsl(var(--border-default))', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }} onClick={() => toggleGrupo(g.grupoName)}>
                           <td colSpan={pivotData.cols.length + 2} style={{ padding: '6px 10px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                               <ChevronRight size={13} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', color: ACCENT }} />
                               <BookOpen size={13} style={{ color: ACCENT }} />
                               <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', fontSize: 11 }}>{g.grupoName}</span>
                               <span style={{ fontSize: 8, fontWeight: 700, background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 10 }}>{g.alunos.length} alunos</span>
                             </div>
                           </td>
                         </tr>
                       )}
                       
                       {(isOpen || filters.agrupamento === 'nenhum') && g.alunos.map((al, idx) => {
                         let rowTotalPrevisto = 0;
                         let rowTotalEncargos = 0;
                         let rowTotalRealizado = 0;
                         return (
                           <tr key={al.nome} style={{ background: idx % 2 === 0 ? 'transparent' : 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                             <td style={{ position: 'sticky', left: 0, zIndex: 1, background: idx % 2 === 0 ? 'hsl(var(--bg-surface))' : 'hsl(var(--bg-elevated))', padding: '8px 10px', borderRight: '1px solid hsl(var(--border-subtle))' }}>
                               <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{al.nome}</div>
                               <div style={{ fontSize: 8, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>Turma: {al.turmasList || '—'}</div>
                             </td>
                             {pivotData.cols.map(m => {
                               const parcs = al.parcelas.filter(p => extractYM(p.competencia, p.vencimento) === m);
                               
                               if (parcs.length === 0) return <td key={m} style={{ padding: '4px', textAlign: 'center', color: 'hsl(var(--border-default))' }}>-</td>
                               
                               const valBase = parcs.reduce((s,p) => s + (Number(p.valor)||0), 0)
                               const valDesconto = parcs.reduce((s,p) => s + (Number(p.desconto)||0), 0)
                               const valJuros = parcs.reduce((s,p) => s + (Number(p.juros)||0), 0)
                               const valMulta = parcs.reduce((s,p) => s + (Number(p.multa)||0), 0)
                               
                               const valPrevisto = valBase - valDesconto
                               const valEncargos = valJuros + valMulta
                               const cellTotal = valPrevisto + valEncargos
                               
                               const valRealizadoItem = parcs
                                 .filter(p => ['pago', 'renegociado'].includes(p.statusFinanceiro))
                                 .reduce((s,p) => s + (Number(p.valor)||0) - (Number(p.desconto)||0) + (Number(p.juros)||0) + (Number(p.multa)||0), 0)
                               
                               rowTotalPrevisto += valPrevisto
                               rowTotalEncargos += valEncargos
                               rowTotalRealizado += valRealizadoItem
                               
                               // Check worst scenario for color
                               const hasVencido = parcs.some(p => p.statusFinanceiro === 'vencido')
                               const isPago = parcs.every(p => p.statusFinanceiro === 'pago' || p.statusFinanceiro === 'renegociado')
                               
                               const bd = statusBadge(hasVencido ? 'vencido' : isPago ? 'pago' : 'aberto')
                               const titleText = `DETALHAMENTO:\n─────────────\nValor Base: ${fmtCur(valBase)}\nDesconto: -${fmtCur(valDesconto)}\nJuros: +${fmtCur(valJuros)}\nMulta: +${fmtCur(valMulta)}\n─────────────\nTotal Líquido: ${fmtCur(cellTotal)}`

                               return (
                                 <td key={m} style={{ padding: '4px', textAlign: 'center' }}>
                                   <div title={titleText} style={{ cursor: 'help', background: bd.bg, color: bd.color, borderRadius: 4, padding: '3px 5px', fontSize: 9, fontWeight: 800, display: 'inline-flex', flexDirection: 'column', minWidth: 55, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', position: 'relative' }}>
                                     <span style={{ letterSpacing: '-0.02em' }}>{fmtCur(cellTotal)}</span>
                                     <span style={{ fontSize: 6, textTransform: 'uppercase', opacity: 0.9, marginTop: 1, letterSpacing: '0.04em' }}>{bd.label}</span>
                                     
                                     {valEncargos > 0 && (
                                       <div style={{ position: 'absolute', top: -11, right: -8, background: '#1e293b', color: '#fff', fontSize: 6, padding: '2px 4px', borderRadius: 4, border: '1px solid hsl(var(--bg-elevated))', zIndex: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.25)', fontWeight: 900 }}>
                                          +{fmtCur(valEncargos)}
                                       </div>
                                     )}
                                   </div>
                                 </td>
                               )
                             })}
                             <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>
                               <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 10, paddingBottom: 2 }}><span>Previsto:</span> <span style={{color: 'hsl(var(--text-secondary))'}}>{fmtCur(rowTotalPrevisto)}</span></div>
                               <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 10, paddingBottom: 2 }}><span>Encargos:</span> <span>{fmtCur(rowTotalEncargos)}</span></div>
                               <div style={{ fontSize: 11, color: ACCENT, fontWeight: 800, borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 2, display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Realizado:</span> <span>{fmtCur(rowTotalRealizado)}</span></div>
                             </td>
                           </tr>
                         )
                       })}
                     </React.Fragment>
                   )
                 })}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {hasLoaded && !loading && (!pivotData || pivotData.cols.length === 0) && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <CheckCircle size={32} style={{ color: ACCENT2, margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Nenhuma informação encontrada</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>O cruzamento matriz não encontrou parcelas e alunos válidos nos filtros selecionados.</div>
        </div>
      )}

      {/* Modals injection */}
      {showTurmasModal && <SelectionModal title="Selecionar Turmas" icon={<BookOpen size={15} />} items={turmaOptions} selected={filters.turmas} onClose={() => setShowTurmasModal(false)} onApply={(s: any) => setFilters((f: any) => ({...f, turmas: s}))} searchPlaceholder="Buscar turma..." extraContent={<div><label className="form-label" style={{ fontSize: 10 }}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }}/> Localizar turmas do Ano Base (ignorar padrão acima):</label><select className="form-input" style={{ fontSize: 11, padding: '6px 10px', background: 'hsl(var(--bg-input))' }} value={filters.anoLetivo} onChange={(e: any) => setFilters((f: any) => ({ ...f, anoLetivo: e.target.value }))}><option value="">Todos os anos vigentes</option>{yrOptions.map((y: string) => <option key={y} value={y}>Ano Letivo {y}</option>)}</select></div>} />}
      {showEventosModal && <SelectionModal title="Selecionar Cursos (Eventos)" icon={<Layers size={15} />} items={eventosDisponiveis} selected={filters.eventos} onClose={() => setShowEventosModal(false)} onApply={(s: any) => setFilters((f: any) => ({...f, eventos: s}))} searchPlaceholder="Buscar curso/evento associado..." />}

    </div>
  )
}
