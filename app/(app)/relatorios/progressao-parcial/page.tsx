'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, X, ChevronDown, FileText, Download, GraduationCap,
  BookOpen, LayoutGrid, LayoutList, Loader2, Check, Printer, ChevronUp, ArrowUpDown
} from 'lucide-react'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { exportPDF } from '@/lib/reports/exportPDF'

// ─── Types ────────────────────────────────────────────────

interface ProgRow {
  id: string
  alunoId: string
  codigo: string
  nome: string
  unidade: string
  progAno: string
  progSerie: string
  progDisciplina: string
  progTipo: string
  progTurno: string
  progResultado: string
  progCargaHoraria: string
  progDataResultado: string
  progNumeroChamada: string
}

interface FilterState {
  busca: string
  tipoReport: string
  turno: string
  anoLetivo: string
  nivelEnsino: string
  serie: string
  disciplina: string
  somenteCursando: string
}

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2, ANO_ATUAL - 3]

const TIPOS_PROGRESSAO = [
  'Todos',
  'Progressão Parcial',
  'Dependência',
  'Adaptação',
  'Reclassificação',
  'Aceleração de Estudos'
]

// ─── Modals ───────────────────────────────────────────────

function SerieModal({
  open, onClose, onSelect, selectedSerie
}: {
  open: boolean; onClose: () => void; onSelect: (s: string) => void; selectedSerie: string
}) {
  const { cfgNiveisEnsino } = useData()
  const [busca, setBusca] = useState('')

  const allSeries = useMemo(() => {
    const list: string[] = []
    ;(cfgNiveisEnsino || []).forEach((n: any) => {
      (n.series || []).forEach((s: any) => {
         if (s.nome && !list.includes(s.nome)) list.push(s.nome)
      })
    })
    return list.sort()
  }, [cfgNiveisEnsino])

  const filtered = useMemo(() => {
     if (!busca.trim()) return allSeries
     const b = busca.toLowerCase()
     return allSeries.filter(s => s.toLowerCase().includes(b))
  }, [busca, allSeries])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)'}}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, padding: 0, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Selecionar Série</div>
              <button onClick={onClose} className="btn-ghost btn-sm" style={{ padding: 4 }}><X size={16} /></button>
           </div>
           <input className="form-input" placeholder="Buscar série..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: 8 }}>
           <button
             onClick={() => { onSelect(''); onClose() }}
             style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, background: !selectedSerie ? 'rgba(99,102,241,0.08)' : 'transparent', color: !selectedSerie ? '#6366f1' : 'hsl(var(--text-primary))', border: 'none', cursor: 'pointer', fontWeight: !selectedSerie ? 700 : 500 }}
           > Todas as Séries </button>
           {filtered.map(s => (
             <button
               key={s} onClick={() => { onSelect(s); onClose() }}
               style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, background: selectedSerie === s ? 'rgba(99,102,241,0.08)' : 'transparent', color: selectedSerie === s ? '#6366f1' : 'hsl(var(--text-primary))', border: 'none', cursor: 'pointer', fontWeight: selectedSerie === s ? 700 : 500 }}
             >{s}</button>
           ))}
        </div>
      </div>
    </div>
  )
}

function DisciplinaModal({
  open, onClose, onSelect, selectedDisciplina
}: {
  open: boolean; onClose: () => void; onSelect: (d: string) => void; selectedDisciplina: string
}) {
  const { cfgDisciplinas } = useData()
  const [busca, setBusca] = useState('')

  const allDisciplinas = useMemo(() => {
    return (cfgDisciplinas || []).filter((d:any) => d.status !== 'inativa').map((d:any) => d.nome).sort()
  }, [cfgDisciplinas])

  const filtered = useMemo(() => {
     if (!busca.trim()) return allDisciplinas
     const b = busca.toLowerCase()
     return allDisciplinas.filter((d:any) => d.toLowerCase().includes(b))
  }, [busca, allDisciplinas])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)'}}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, padding: 0, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(52,211,153,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Selecionar Disciplina</div>
              <button onClick={onClose} className="btn-ghost btn-sm" style={{ padding: 4 }}><X size={16} /></button>
           </div>
           <input className="form-input" placeholder="Buscar disciplina..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: 8 }}>
           <button
             onClick={() => { onSelect(''); onClose() }}
             style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, background: !selectedDisciplina ? 'rgba(16,185,129,0.08)' : 'transparent', color: !selectedDisciplina ? '#10b981' : 'hsl(var(--text-primary))', border: 'none', cursor: 'pointer', fontWeight: !selectedDisciplina ? 700 : 500 }}
           > Todas as Disciplinas </button>
           {filtered.map((d:any) => (
             <button
               key={d} onClick={() => { onSelect(d); onClose() }}
               style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, background: selectedDisciplina === d ? 'rgba(16,185,129,0.08)' : 'transparent', color: selectedDisciplina === d ? '#10b981' : 'hsl(var(--text-primary))', border: 'none', cursor: 'pointer', fontWeight: selectedDisciplina === d ? 700 : 500 }}
             >{d}</button>
           ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

export default function RelatorioProgressaoParcialPage() {
  const router = useRouter()
  const { mantenedores, cfgNiveisEnsino, cfgTurnos } = useData()
  const { currentUser } = useApp()

  const [data, setData] = useState<ProgRow[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  
  const [serieModalOpen, setSerieModalOpen] = useState(false)
  const [discModalOpen, setDiscModalOpen] = useState(false)
  
  const [modeloRelatorio, setModeloRelatorio] = useState('listagem')

  const [filters, setFilters] = useState<FilterState>({
    busca: '',
    tipoReport: 'Progressão Parcial',
    turno: '',
    anoLetivo: String(ANO_ATUAL),
    nivelEnsino: 'Todos',
    serie: '',
    disciplina: '',
    somenteCursando: 'true'
  })

  // Sort State
  const [sortKey, setSortKey] = useState<keyof ProgRow>('nome')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const renderedData = useMemo(() => {
    let f = data.filter(r => {
      if (!filters.busca) return true
      const sb = filters.busca.toLowerCase()
      return r.nome.toLowerCase().includes(sb) || r.codigo.toLowerCase().includes(sb)
    })
    f.sort((a, b) => {
      const valA = String(a[sortKey] || '').toLowerCase()
      const valB = String(b[sortKey] || '').toLowerCase()
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return f
  }, [data, filters.busca, sortKey, sortOrder])

  const toggleSort = (key: keyof ProgRow) => {
    if (sortKey === key) {
      setSortOrder(p => p === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ column }: { column: keyof ProgRow }) => {
    if (sortKey !== column) return <ArrowUpDown size={12} style={{ color: 'hsl(var(--text-disabled))', marginLeft: 4 }} />
    return sortOrder === 'asc' 
      ? <ChevronUp size={12} style={{ color: '#6366f1', marginLeft: 4 }} /> 
      : <ChevronDown size={12} style={{ color: '#6366f1', marginLeft: 4 }} />
  }

  // School info
  const mantenedor = (mantenedores as any)?.[0]
  const unidade = mantenedor?.unidades?.[0]
  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Escola'
  const cnpj = unidade?.cnpj || mantenedor?.cnpj || ''
  const logo = unidade?.cabecalhoLogo || mantenedor?.logo || null
  const userName = currentUser?.nome || 'Usuário'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           source: 'alunos_progressao', 
           filters, 
           page: 1, 
           pageSize: 5000 
        }),
      }).then(r => r.json())
      setData(res.data || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [filters, fetchData])

  const exportColumns = useMemo(() => {
    return [
      { key: 'codigo',          label: 'Matrícula',  type: 'text' as const },
      { key: 'nome',            label: 'Nome',       type: 'text' as const },
      { key: 'progAno',         label: 'Ano',        type: 'text' as const },
      { key: 'progSerie',       label: 'Série',      type: 'text' as const },
      { key: 'progDisciplina',  label: 'Disciplina', type: 'text' as const },
      { key: 'progTipo',        label: 'Tipo',       type: 'text' as const },
      { key: 'progTurno',       label: 'Turno',      type: 'text' as const },
      { key: 'progCargaHoraria',label: 'Carga Hor.', type: 'text' as const },
      { key: 'progDataResultado',label: 'Data',      type: 'text' as const },
      { key: 'progResultado',   label: 'Status',     type: 'text' as const },
      { key: 'progNumeroChamada', label: 'Nº Chamada', type: 'text' as const }
    ]
  }, [])

  const filterDesc = useMemo(() => {
    const d: Record<string, string> = {}
    if (filters.tipoReport !== 'todos') d['Tipo'] = filters.tipoReport
    if (filters.anoLetivo) d['Ano'] = filters.anoLetivo
    if (filters.turno) d['Turno'] = filters.turno
    if (filters.nivelEnsino !== 'Todos') d['Nível'] = filters.nivelEnsino
    if (filters.serie) d['Série'] = filters.serie
    if (filters.disciplina) d['Disciplina'] = filters.disciplina
    d['Apenas Cursando'] = filters.somenteCursando === 'true' ? 'Sim' : 'Não'
    return d
  }, [filters])

  const handleExportPDF = () => {
    exportPDF({
      title: 'Relatório de Progressão Parcial',
      subtitle: `${nomeEscola} · Ano ${filters.anoLetivo}`,
      data: renderedData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      filters: filterDesc,
      nomeEscola,
      cnpj,
      logo,
      userName,
      totals: { count: renderedData.length },
      orientation: 'landscape'
    })
  }

  const setF = (k: keyof FilterState, v: string) => setFilters(p => ({ ...p, [k]: v }))

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 0 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
         <button onClick={() => router.push('/relatorios')} className="btn btn-secondary btn-icon">
            <ArrowLeft size={16} />
         </button>
         <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8 }}>
               <BookOpen size={20} color="#6366f1" />
               Relatório de Progressão Parcial
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
               Gerencie as disciplinas pendentes e histórico de avaliações dos alunos.
            </p>
         </div>
      </div>

      {/* Filters (Baseado na UI Enviada) */}
      <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: '24px 28px', marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
         <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
               {/* Linha 1 */}
               <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                     <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 6 }}>Tipo</label>
                     <select className="form-input" style={{ width: '100%', height: 38 }} value={filters.tipoReport} onChange={e => setF('tipoReport', e.target.value)}>
                        {TIPOS_PROGRESSAO.map(t => <option key={t} value={t === 'Todos' ? 'todos' : t}>{t}</option>)}
                     </select>
                  </div>
                  <div style={{ flex: 1 }}>
                     <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 6 }}>Turno</label>
                     <select className="form-input" style={{ width: '100%', height: 38 }} value={filters.turno} onChange={e => setF('turno', e.target.value)}>
                        <option value="">Todos os Turnos</option>
                        {(cfgTurnos || []).filter((t:any) => t.situacao === 'ativo').map((t:any) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                     </select>
                  </div>
                  <div style={{ flex: 1 }}>
                     <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 6 }}>Ano</label>
                     <select className="form-input" style={{ width: '100%', height: 38 }} value={filters.anoLetivo} onChange={e => setF('anoLetivo', e.target.value)}>
                        <option value="">Todos</option>
                        {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                     </select>
                  </div>
               </div>

               {/* Linha 2 - Juntos */}
               <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                     <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 6 }}>Níveis De Ensino</label>
                     <select className="form-input" style={{ width: '100%', height: 38 }} value={filters.nivelEnsino} onChange={e => setF('nivelEnsino', e.target.value)}>
                        <option value="Todos">Todos</option>
                        {(cfgNiveisEnsino || []).map((n:any) => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                     </select>
                  </div>

                  <div style={{ flex: 1 }}>
                     <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 6 }}>Série</label>
                     <div style={{ display: 'flex' }}>
                        <div 
                           onClick={() => setSerieModalOpen(true)}
                           style={{ flex: 1, padding: '10px 14px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRight: 'none', borderRadius: '8px 0 0 8px', cursor: 'pointer', fontSize: 13, color: filters.serie ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', fontWeight: filters.serie ? 600 : 400 }}
                        >
                           {filters.serie || 'Selecione uma Série'}
                        </div>
                        <button onClick={() => setF('serie', '')} style={{ padding: '0 14px', border: '1px solid hsl(var(--border-subtle))', borderRadius: '0 8px 8px 0', background: 'hsl(var(--bg-base))', cursor: 'pointer' }}><X size={14}/></button>
                     </div>
                  </div>

                  <div style={{ flex: 1 }}>
                     <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 6 }}>Disciplina</label>
                     <div style={{ display: 'flex' }}>
                        <div 
                           onClick={() => setDiscModalOpen(true)}
                           style={{ flex: 1, padding: '10px 14px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRight: 'none', borderRadius: '8px 0 0 8px', cursor: 'pointer', fontSize: 13, color: filters.disciplina ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', fontWeight: filters.disciplina ? 600 : 400 }}
                        >
                           {filters.disciplina || 'Pesquisar Disciplinas'}
                        </div>
                        <button onClick={() => setF('disciplina', '')} style={{ padding: '0 14px', border: '1px solid hsl(var(--border-subtle))', borderRadius: '0 8px 8px 0', background: 'hsl(var(--bg-base))', cursor: 'pointer' }}><X size={14}/></button>
                     </div>
                  </div>
               </div>

               {/* Linha 5 Toggle */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Somente Alunos Cursando</span>
                  <button 
                     onClick={() => setF('somenteCursando', filters.somenteCursando === 'true' ? 'false' : 'true')}
                     style={{ width: 44, height: 24, borderRadius: 12, background: filters.somenteCursando === 'true' ? '#10b981' : 'hsl(var(--bg-elevated))', border: `1px solid ${filters.somenteCursando === 'true' ? '#059669' : 'hsl(var(--border-subtle))'}`, position: 'relative', cursor: 'pointer', transition: 'all .2s' }}
                  >
                     <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: filters.somenteCursando === 'true' ? 22 : 2, transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
               </div>
            </div>

            {/* Ações Impressão (Coluna Direita) */}
            <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
               <button onClick={handleExportPDF} className="btn" style={{ background: '#10b981', color: '#fff', border: '1px solid #059669', padding: '10px 16px', borderRadius: 8, fontWeight: 700, gap: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
                 <Printer size={16} /> Imprimir Relatório
               </button>
               <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 6 }}>Modelo Impressão</label>
                  <select className="form-input" style={{ width: '100%', height: 38 }} value={modeloRelatorio} onChange={e => setModeloRelatorio(e.target.value)}>
                     <option value="listagem">Listagem</option>
                  </select>
               </div>
            </div>
         </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: '60px 20px', textAlign: 'center' }}>
          <BookOpen size={48} style={{ color: 'hsl(var(--text-disabled))', marginBottom: 16 }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-secondary))' }}>Nenhuma progressão encontrada</h3>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'hsl(var(--text-muted))' }}>Ajuste os filtros selecionados para realizar uma nova busca.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, hsl(var(--bg-elevated)), hsl(var(--bg-base)))' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Listando <strong>{renderedData.length}</strong> progressões.</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 9, color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" placeholder="Buscar aluno..." style={{ paddingLeft: 34, fontSize: 12, height: 32 }} value={filters.busca} onChange={e => setF('busca', e.target.value)} />
            </div>
          </div>
          
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 80, cursor: 'pointer' }} onClick={() => toggleSort('progAno')}>ANO <SortIcon column="progAno" /></th>
                  <th style={{ width: 110, cursor: 'pointer' }} onClick={() => toggleSort('progNumeroChamada')}>Nº CHAMADA <SortIcon column="progNumeroChamada" /></th>
                  <th style={{ width: 130, cursor: 'pointer' }} onClick={() => toggleSort('codigo')}>MATRÍCULA <SortIcon column="codigo" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('nome')}>ALUNO <SortIcon column="nome" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('progDisciplina')}>DISCIPLINA <SortIcon column="progDisciplina" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('progSerie')}>SÉRIE <SortIcon column="progSerie" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('progTipo')}>TIPO <SortIcon column="progTipo" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('progTurno')}>TURNO <SortIcon column="progTurno" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('progCargaHoraria')}>CARGA HOR. <SortIcon column="progCargaHoraria" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('progDataResultado')}>DATA <SortIcon column="progDataResultado" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('progResultado')}>STATUS <SortIcon column="progResultado" /></th>
                </tr>
              </thead>
              <tbody>
                {renderedData.map((r, i) => {
                  return (
                  <tr key={r.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: r.progResultado === 'Cursando' ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
                    <td style={{ fontWeight: 800 }}>{r.progAno}</td>
                    <td style={{ fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{r.progNumeroChamada || '-'}</td>
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>{r.codigo}</td>
                    <td style={{ fontWeight: 600 }}>{r.nome}</td>
                    <td style={{ fontWeight: 700, color: '#6366f1' }}>{r.progDisciplina}</td>
                    <td>{r.progSerie || '-'}</td>
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{r.progTipo}</td>
                    <td style={{ fontSize: 12 }}>{r.progTurno || '-'}</td>
                    <td style={{ fontSize: 12 }}>{r.progCargaHoraria ? r.progCargaHoraria + 'h' : '-'}</td>
                    <td style={{ fontSize: 12 }}>{r.progDataResultado || '-'}</td>
                    <td><span className={`badge ${r.progResultado==='Cursando'?'badge-warning':r.progResultado==='Aprovado(a)'?'badge-success':'badge-danger'}`}>{r.progResultado}</span></td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SerieModal open={serieModalOpen} onClose={() => setSerieModalOpen(false)} onSelect={s => setF('serie', s)} selectedSerie={filters.serie} />
      <DisciplinaModal open={discModalOpen} onClose={() => setDiscModalOpen(false)} onSelect={d => setF('disciplina', d)} selectedDisciplina={filters.disciplina} />

      <style>{'@keyframes spin { 100% { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
