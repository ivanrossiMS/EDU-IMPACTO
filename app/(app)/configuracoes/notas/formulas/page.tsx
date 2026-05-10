'use client'
import { useData, FormulaNotas, newId } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import {
  Plus, Edit2, Trash2, Copy, Search, FlaskConical, X, Check,
  ChevronDown, Shield, AlertTriangle, Info, BarChart2, BookOpen,
  Calculator, RotateCcw, Eye, Layers
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: '#0ea5e9',
  accent:  '#0284c7',
  success: '#10b981',
  danger:  '#ef4444',
  warning: '#f59e0b',
  purple:  '#8b5cf6',
  ink:     '#0f172a',
  muted:   '#64748b',
  border:  '#e2e8f0',
  surface: '#f8fafc',
}

// ─── Static options ───────────────────────────────────────────────────────────
const NIVEIS   = ['Curso Regular','EF Anos Iniciais','EF Anos Finais','Ensino Médio','EJA','Educação Infantil','Técnico','Supletivo']
const SIM_NAO  = ['Sim','Não']
const FASES_NM = ['Bimestre','Trimestre','Semestre','Período','Módulo','Quinzena']
const N_FASES  = [1,2,3,4,5,6]
const CORES    = ['Preto','Vermelho','Azul','Verde','Laranja','Cinza']
const CASAS    = ['1 Casa','2 Casas','3 Casas','4 Casas']
const USO_ARR  = ['Médias','Notas e Médias','Notas','Não Arredondar']
const CALC_MED = [
  'Soma os 4 bimestres e divide por 4',
  'Soma os 3 trimestres e divide por 3',
  'Soma os 2 semestres e divide por 2',
  'Média ponderada com pesos configurados',
  'Maior nota entre os períodos',
]
const RELACAO_CONSELHO = [
  'Média Final = (Conselho + Média Final)',
  'Conselho substitui Média Final se maior',
  'Não utiliza Conselho de Classe',
  'Média Final = Conselho',
]
const CALC_REC_BIM = [
  '1 - Substitui a média se a rec. for maior',
  '2 - Soma a média com a rec. e divide por 2',
  '3 - Se a nota da Rec. for maior que a bimestral, soma e divide por 2',
  '4 - Usa somente a nota da recuperação',
  '5 - Mantém a média bimestral original',
]
const CALC_REC_SEM = [
  '1 - Substitui a média semestral se maior',
  '2 - Soma média semestral com a rec. e divide por 2',
  '3 - Média ponderada da semestral + recuperação',
  '4 - Usa somente a nota da recuperação semestral',
]
const CALC_FRENTES = [
  'Lança nas frentes e não mostra na principal. Média final da disciplina principal é a média das frentes',
  'Calcula na Vertical',
  'Calcula na Horizontal',
  'Lança nas Frentes e soma à principal',
]
const CALC_MED_FRENTES = ['Calcula na Vertical','Calcula na Horizontal','Não usa frentes']
const CALC_EXM_FRENTES = ['Lança nas Frentes','Lança na Principal','Não usa frentes']
const CALC_PESO_MODO = [
  'Lança sem multiplicar os pesos',
  'Multiplica os pesos e divide pela soma dos pesos',
  'Média ponderada simples',
]
const REC_FINAL_OPTS = [
  '1 - Não é obrigatório fazer (Usa a média final como Média Final)',
  '2 - É Obrigatório Fazer (Se não fizer considera Zero e coloca na fórmula para apurar a media final).',
  '3 - Lança diretamente na Média Final',
  '4 - Não utiliza recuperação final / exame',
]
const RESULTADO_PP = ['Aprovado Com P.P.','Aprovado','Em Exame Final','Em Recuperação']
const APOS_RESULTADO = ['Reprovado(a)','Aprovado(a)','Em Exame Final','Manter situação']
const EXTENSO_OPTS = ['Extenso','Número','Oculto']
const LANCAMENTO_REC = ['Lança nas Frentes','Lança na Principal','Não usa frentes']

// ─── Factory ──────────────────────────────────────────────────────────────────
function makeBlank(proximoCodigo: number): Omit<FormulaNotas, 'id'> {
  const now = new Date().toISOString()
  const hoje = now.slice(0, 10)
  const user = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('edu-current-user') || '{}').nome || 'Admin' } catch { return 'Admin' } })()
    : 'Admin'
  return {
    codigo: proximoCodigo,
    descricao: '',
    situacao: 'Ativo',
    nivel: 'Curso Regular',
    ano: new Date().getFullYear(),
    // Dados da Fórmula
    nomeAvaliacaoFinal: 'Exame Final',
    media: 7.0,
    nomeFases: 'Bimestre',
    nFases: 4,
    recuperacaoFinal: REC_FINAL_OPTS[1],
    // Média Final Cálculo
    mediaAnualVezes: 2,
    mediaRecuperacaoVezes: 1,
    divididoPor: 3,
    igualA: 5.0,
    calculoMediaAnual: CALC_MED[0],
    relacaoConselho: RELACAO_CONSELHO[0],
    // Média Final Recuperação
    mediaAposRecuperacao: 5.0,
    recFinalIgualMediaFinal: 'Sim',
    maxComponentesRecuperacao: 0,
    reprovaSeAcimaFaltasPct: 25,
    ateDisciplinasAbaixoMedia: 3,
    resultadoAprovadoPP: RESULTADO_PP[0],
    aposResultado: APOS_RESULTADO[0],
    // Frentes
    calculoMediaAnualFrentes: CALC_MED_FRENTES[0],
    recuperacaoExameFrentes: CALC_EXM_FRENTES[0],
    // Notas por peso
    notasPorPeso: 'Não',
    calculoMediaPeso: CALC_PESO_MODO[0],
    pesoNota1: 1, pesoNota2: 1, pesoNota3: 1, pesoNota4: 1,
    // Visualização / Arredondamento
    usarArredondamento: 'Médias',
    qualArredondamento: '',
    casasVirgula: '2 Casas',
    desconsiderarDemaisCasas: 'Não',
    dividirNumAvaliacoes: 'Não',
    dividirArredondamentoPor: 1,
    arredondaAntesCalculo: 'Não',
    // Apresentação
    mostrarAsteriscoAbaixoMedia: 'Sim',
    trocarCorFonte: 'Sim',
    corAcimaDaMedia: 'Preto',
    corAbaixoDaMedia: 'Vermelho',
    valorNotaDispensa: 999,
    nota00Extenso: 'Extenso',
    nota05Extenso: 'Extenso',
    nota10Extenso: 'Extenso',
    nota100Extenso: 'Extenso',
    // Rec. Bimestral
    mostrarRecBimBoletim: 'Não',
    notaAbaixoObrigRec: 'Não',
    calculoMediaBimTrimestre: CALC_REC_BIM[0],
    // Rec. Semestral
    possuiRecSemestral: 'Não',
    notaAbaixoObrigRecSem: 'Não',
    lancamentoRecSem: LANCAMENTO_REC[0],
    calculoRecuperacaoSem: CALC_REC_SEM[1],
    calculoNasFrentes: CALC_FRENTES[0],
    // Log
    dataInclusao: hoje,
    usuarioIncluiu: user,
    dataAlteracao: hoje,
    usuarioAlterou: user,
    createdAt: now,
    updatedAt: now,
  }
}

// ─── Component helpers ────────────────────────────────────────────────────────
const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
    {children}{required && <span style={{ color: C.danger, marginLeft: 2 }}>*</span>}
  </label>
)

const Inp = ({ value, onChange, type = 'text', step, min, max, disabled, placeholder, style }: any) => (
  <input
    type={type}
    step={step}
    min={min}
    max={max}
    disabled={disabled}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    style={{
      width: '100%', height: 40, borderRadius: 9, border: `1.5px solid ${C.border}`,
      padding: '0 12px', fontSize: 13, background: disabled ? C.surface : '#fff',
      color: disabled ? C.muted : C.ink, fontWeight: 600, outline: 'none',
      transition: 'border 0.15s', boxSizing: 'border-box', ...style,
    }}
  />
)

const Sel = ({ value, onChange, options, disabled, style }: { value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean; style?: any }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    style={{
      width: '100%', height: 40, borderRadius: 9, border: `1.5px solid ${C.border}`,
      padding: '0 12px', fontSize: 13, background: disabled ? C.surface : '#fff',
      color: disabled ? C.muted : C.ink, fontWeight: 600, outline: 'none',
      cursor: 'pointer', boxSizing: 'border-box', ...style,
    }}
  >
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 13, fontWeight: 800, color: C.accent, marginBottom: 16, marginTop: 8,
    paddingBottom: 8, borderBottom: `2px solid ${C.primary}25`,
    display: 'flex', alignItems: 'center', gap: 8,
  }}>
    {children}
  </div>
)

const Grid = ({ cols, children, gap = 14 }: { cols: string; children: React.ReactNode; gap?: number }) => (
  <div style={{ display: 'grid', gridTemplateColumns: cols, gap, marginBottom: 18 }}>
    {children}
  </div>
)

const Fld = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div><Label required={required}>{label}</Label>{children}</div>
)

// ─── Badge count ──────────────────────────────────────────────────────────────
const Badge = ({ n, color }: { n: number; color: string }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 20, height: 20, borderRadius: 10, background: `${color}18`,
    color, fontSize: 11, fontWeight: 800, padding: '0 6px',
  }}>{n}</span>
)

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'dados' | 'media' | 'peso' | 'visual' | 'rec-bim' | 'rec-sem'
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dados',   label: 'Dados da Fórmula',             icon: <FlaskConical size={13} /> },
  { id: 'media',   label: 'Média Final',                   icon: <Calculator size={13} /> },
  { id: 'peso',    label: 'Notas Por Peso',                icon: <BarChart2 size={13} /> },
  { id: 'visual',  label: 'Visualização de Notas',         icon: <Eye size={13} /> },
  { id: 'rec-bim', label: 'Recuperação Bimestral / Trimestral', icon: <RotateCcw size={13} /> },
  { id: 'rec-sem', label: 'Recuperação Semestral',         icon: <RotateCcw size={13} /> },
]

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function FormulasPage() {
  const { cfgFormulasNotas, setCfgFormulasNotas, cfgArredondamentos, logSystemAction } = useData()
  const formulas = Array.isArray(cfgFormulasNotas) ? cfgFormulasNotas : []

  // list state
  const [busca, setBusca] = useState('')
  const [filtroAno, setFiltroAno] = useState<number | 'todos'>('todos')
  const [filtroSit, setFiltroSit] = useState<'todos' | 'Ativo' | 'Inativo'>('todos')

  // modal state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dados')
  const [form, setForm] = useState<Omit<FormulaNotas, 'id'> | null>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const proximoCodigo = useMemo(() =>
    formulas.length > 0 ? Math.max(...formulas.map(f => f.codigo)) + 1 : 1,
    [formulas]
  )

  const anosDisponiveis = useMemo(() => {
    const set = new Set(formulas.map(f => f.ano))
    return [...set].sort((a, b) => b - a)
  }, [formulas])

  const lista = useMemo(() => formulas
    .filter(f => filtroAno === 'todos' || f.ano === filtroAno)
    .filter(f => filtroSit === 'todos' || f.situacao === filtroSit)
    .filter(f => !busca || f.descricao.toLowerCase().includes(busca.toLowerCase()) || String(f.codigo).includes(busca))
    .sort((a, b) => b.codigo - a.codigo),
    [formulas, filtroAno, filtroSit, busca]
  )

  const upd = (patch: Partial<Omit<FormulaNotas, 'id'>>) => setForm((p: any) => ({ ...p, ...patch }))

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function openNew() {
    setForm(makeBlank(proximoCodigo))
    setEditId(null)
    setTab('dados')
    setShowModal(true)
  }

  function openEdit(f: FormulaNotas) {
    const { id, ...rest } = f
    setForm({ ...rest })
    setEditId(id)
    setTab('dados')
    setShowModal(true)
  }

  function openReplica(f: FormulaNotas) {
    const { id, ...rest } = f
    const now = new Date().toISOString()
    const hoje = now.slice(0, 10)
    const user = typeof window !== 'undefined'
      ? (() => { try { return JSON.parse(localStorage.getItem('edu-current-user') || '{}').nome || 'Admin' } catch { return 'Admin' } })()
      : 'Admin'
    setForm({
      ...rest,
      codigo: proximoCodigo,
      descricao: `Cópia de ${rest.descricao}`,
      situacao: 'Inativo',
      dataInclusao: hoje,
      usuarioIncluiu: user,
      dataAlteracao: hoje,
      usuarioAlterou: user,
      createdAt: now,
      updatedAt: now,
    })
    setEditId(null)
    setTab('dados')
    setShowModal(true)
  }

  function handleDelete(id: string) {
    const f = formulas.find(x => x.id === id)
    if (!confirm(`Excluir fórmula "${f?.descricao}"? Esta ação não pode ser desfeita.`)) return
    setCfgFormulasNotas(prev => prev.filter(x => x.id !== id))
    logSystemAction('Config. Notas', 'Exclusão', `Fórmula ${f?.codigo} – ${f?.descricao} excluída`)
  }

  function handleSave() {
    if (!form || !form.descricao.trim()) return
    const now = new Date().toISOString()
    const user = typeof window !== 'undefined'
      ? (() => { try { return JSON.parse(localStorage.getItem('edu-current-user') || '{}').nome || 'Admin' } catch { return 'Admin' } })()
      : 'Admin'

    if (editId) {
      setCfgFormulasNotas(prev => prev.map(f => f.id === editId
        ? { ...f, ...form, updatedAt: now, dataAlteracao: now.slice(0, 10), usuarioAlterou: user } as FormulaNotas
        : f
      ))
      logSystemAction('Config. Notas', 'Edição', `Fórmula ${form.codigo} – ${form.descricao} atualizada`)
    } else {
      const nova: FormulaNotas = { id: newId('FN'), ...form, createdAt: now, updatedAt: now }
      setCfgFormulasNotas(prev => [...prev, nova])
      logSystemAction('Config. Notas', 'Cadastro', `Nova fórmula ${form.codigo} – ${form.descricao}`)
    }
    setShowModal(false)
  }

  // ── Fórmula preview dinâmica ──────────────────────────────────────────────────
  const formulaExpr = form
    ? `(Σ ${form.nFases} ${form.nomeFases}s × ${form.mediaAnualVezes} + Rec × ${form.mediaRecuperacaoVezes}) ÷ ${form.divididoPor} = ${form.igualA}`
    : ''

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minHeight: '100vh' }}>

      {/* ══ PAGE HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 15,
            background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 20px ${C.primary}45`,
          }}>
            <FlaskConical size={24} color="#fff" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: C.ink, margin: 0, letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>
              Fórmulas de Notas
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, marginTop: 2 }}>
              Configure as regras de cálculo, aprovação, recuperação e exibição de notas
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge n={formulas.filter(f => f.situacao === 'Ativo').length} color={C.success} />
          <span style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>ativas</span>
        </div>
      </div>

      {/* ══ TOOLBAR ══════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* Novo */}
          <button onClick={openNew} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px',
            borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
            background: `linear-gradient(135deg, ${C.success}, #059669)`,
            color: '#fff', boxShadow: `0 4px 14px ${C.success}40`, transition: 'all 0.2s',
          }}>
            <Plus size={15} /> Novo
          </button>

          {/* Filtro situação */}
          <select
            value={filtroSit}
            onChange={e => setFiltroSit(e.target.value as any)}
            style={{ height: 40, borderRadius: 10, border: `1.5px solid ${C.border}`, padding: '0 12px', fontSize: 13, fontWeight: 600, color: C.ink, background: '#fff', cursor: 'pointer', outline: 'none' }}
          >
            <option value="todos">Todas situações</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>

          {/* Filtro ano */}
          <select
            value={filtroAno === 'todos' ? 'todos' : String(filtroAno)}
            onChange={e => setFiltroAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            style={{ height: 40, borderRadius: 10, border: `1.5px solid ${C.border}`, padding: '0 12px', fontSize: 13, fontWeight: 600, color: C.ink, background: '#fff', cursor: 'pointer', outline: 'none' }}
          >
            <option value="todos">Todos os anos</option>
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Busca */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 32, height: 40, borderRadius: 10, fontSize: 13 }}
              placeholder="Pesquisar fórmula..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, fontWeight: 600 }}>
            {lista.length} registro(s)
          </span>
        </div>
      </div>

      {/* ══ TABLE ════════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: C.surface, borderBottom: `2px solid ${C.border}` }}>
                {[
                  { l: 'Código', w: 90 }, { l: 'Descrição', w: 'auto' },
                  { l: 'Ano', w: 80 }, { l: 'Nível', w: 160 },
                  { l: 'Fases', w: 110 }, { l: 'Média mín.', w: 100 },
                  { l: 'Situação', w: 110 }, { l: 'Ações', w: 140 },
                ].map(col => (
                  <th key={col.l} style={{
                    padding: '13px 16px', fontSize: 11, fontWeight: 800,
                    color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
                    width: col.w, whiteSpace: 'nowrap',
                  }}>{col.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <FlaskConical size={40} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>Nenhuma fórmula cadastrada</div>
                      <div style={{ fontSize: 13, color: '#cbd5e1' }}>Clique em "+ Novo" para criar a primeira fórmula.</div>
                    </div>
                  </td>
                </tr>
              ) : lista.map((f, idx) => {
                const isEven = idx % 2 === 0
                const ativa = f.situacao === 'Ativo'
                return (
                  <tr key={f.id}
                    style={{ borderBottom: `1px solid ${C.surface}`, background: isEven ? '#fff' : C.surface, transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isEven ? '#fff' : C.surface }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <code style={{ fontSize: 13, fontWeight: 900, color: C.primary, fontFamily: 'Outfit, monospace' }}>{f.codigo}</code>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{f.descricao}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {f.nomeFases} · {f.nFases} fase(s) · Rec: {f.nomeFases === 'Bimestre' ? f.mostrarRecBimBoletim === 'Sim' ? 'Bim.' : 'Sem Rec. Bim.' : '—'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: 13, color: C.ink }}>{f.ano}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${C.primary}12`, color: C.primary }}>{f.nivel}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: C.ink, fontWeight: 600 }}>
                      {f.nFases}x {f.nomeFases}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: ativa ? C.success : C.muted, fontFamily: 'Outfit, monospace' }}>
                        {f.media.toFixed(1)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: ativa ? 'rgba(16,185,129,0.10)' : 'rgba(100,116,139,0.10)',
                        color: ativa ? C.success : C.muted,
                      }}>
                        {ativa ? <Check size={11} /> : <X size={11} />} {f.situacao}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => openEdit(f)} title="Editar"
                          style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: 'rgba(245,158,11,0.10)', color: C.warning, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => openReplica(f)} title="Replicar"
                          style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: 'rgba(14,165,233,0.10)', color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Copy size={14} />
                        </button>
                        <button onClick={() => handleDelete(f.id)} title="Excluir"
                          style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.10)', color: C.danger, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer stats */}
        {lista.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: C.muted }}>
              Mostrando {lista.length} de {formulas.length} registros
            </span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.10)', color: C.success }}>
                Ativo
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(100,116,139,0.10)', color: C.muted }}>
                Inativo
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ══ INFO CARD ════════════════════════════════════════════════════════════ */}
      <div style={{
        padding: '16px 20px', borderRadius: 14, background: `${C.primary}08`,
        border: `1px solid ${C.primary}20`, display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <Info size={18} style={{ color: C.primary, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.6 }}>
          <strong>Como funciona:</strong> As Fórmulas de Notas definem as regras completas de cálculo — médias, recuperações, arredondamentos e exibição no boletim.
          Após criar a fórmula, vincule-a aos esquemas de notas em <strong>Config. de Notas → Esquema de Notas</strong> e às turmas em <strong>Config. de Notas → Componentes Curriculares</strong>.
        </div>
      </div>

      {/* ══ MODAL ════════════════════════════════════════════════════════════════ */}
      {showModal && form && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.22)',
            width: '100%', maxWidth: 860, maxHeight: '95vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>

            {/* Modal Header */}
            <div style={{
              padding: '20px 26px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 14,
              background: `linear-gradient(135deg, ${C.primary}10, #fff)`,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FlaskConical size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: C.ink }}>
                  {editId ? 'Editar Fórmula' : 'Nova Fórmula'}
                </div>
                {form.descricao && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
                    #{form.codigo} — {form.descricao}
                  </div>
                )}
              </div>
              {/* Formula preview pill */}
              {formulaExpr && (
                <div style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: `${C.purple}12`, color: C.purple, border: `1px solid ${C.purple}25`,
                  maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {formulaExpr}
                </div>
              )}
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: 8, borderRadius: 8, border: 'none', background: C.surface, cursor: 'pointer', display: 'flex' }}
              >
                <X size={16} color={C.muted} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, overflowX: 'auto', flexShrink: 0 }}>
              {TABS.map(t => {
                const active = tab === t.id
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 16px',
                    border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                    fontSize: 12, fontWeight: active ? 800 : 600,
                    color: active ? C.primary : C.muted,
                    borderBottom: active ? `3px solid ${C.primary}` : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}>
                    {t.icon} {t.label}
                  </button>
                )
              })}
            </div>

            {/* Body (scrollable) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

              {/* ─── TAB: Dados da Fórmula ─────────────────────────────────────── */}
              {tab === 'dados' && (
                <>
                  <SectionTitle><BookOpen size={15} /> Dados Principais</SectionTitle>
                  <Grid cols="90px 1fr 140px 160px 100px">
                    <Fld label="Código">
                      <Inp value={form.codigo} disabled />
                    </Fld>
                    <Fld label="Descrição" required>
                      <Inp value={form.descricao} onChange={(e: any) => upd({ descricao: e.target.value })} placeholder="Ex: Fórmula 2026" />
                    </Fld>
                    <Fld label="Situação">
                      <Sel value={form.situacao} onChange={v => upd({ situacao: v as 'Ativo' | 'Inativo' })} options={['Ativo', 'Inativo']} />
                    </Fld>
                    <Fld label="Nível">
                      <Sel value={form.nivel} onChange={v => upd({ nivel: v })} options={NIVEIS} />
                    </Fld>
                    <Fld label="Ano">
                      <Inp type="number" value={form.ano} onChange={(e: any) => upd({ ano: parseInt(e.target.value) || new Date().getFullYear() })} min={2020} max={2099} />
                    </Fld>
                  </Grid>

                  <Grid cols="200px 120px 180px 100px">
                    <Fld label="Nome da Avaliação Final">
                      <Inp value={form.nomeAvaliacaoFinal} onChange={(e: any) => upd({ nomeAvaliacaoFinal: e.target.value })} placeholder="Ex: Exame Final" />
                    </Fld>
                    <Fld label="Média mínima">
                      <Inp type="number" step="0.1" min="0" max="10" value={form.media} onChange={(e: any) => upd({ media: parseFloat(e.target.value) || 0 })} />
                    </Fld>
                    <Fld label="Nome das fases">
                      <Sel value={form.nomeFases} onChange={v => upd({ nomeFases: v })} options={FASES_NM} />
                    </Fld>
                    <Fld label="Nº fases">
                      <Sel value={String(form.nFases)} onChange={v => upd({ nFases: parseInt(v) })} options={N_FASES.map(String)} />
                    </Fld>
                  </Grid>

                  <Fld label="Recuperação Final">
                    <Sel value={form.recuperacaoFinal} onChange={v => upd({ recuperacaoFinal: v })} options={REC_FINAL_OPTS} />
                  </Fld>

                  <div style={{ marginTop: 28 }}>
                    <SectionTitle><Layers size={15} /> Log</SectionTitle>
                    <Grid cols="repeat(4, 1fr)">
                      <Fld label="Data inclusão">
                        <Inp value={form.dataInclusao?.slice(0, 10) || ''} disabled />
                      </Fld>
                      <Fld label="Usuário incluiu">
                        <Inp value={form.usuarioIncluiu || ''} disabled />
                      </Fld>
                      <Fld label="Data alteração">
                        <Inp value={form.dataAlteracao?.slice(0, 10) || ''} disabled />
                      </Fld>
                      <Fld label="Usuário alterou">
                        <Inp value={form.usuarioAlterou || ''} disabled />
                      </Fld>
                    </Grid>
                  </div>
                </>
              )}

              {/* ─── TAB: Média Final ──────────────────────────────────────────── */}
              {tab === 'media' && (
                <>
                  <SectionTitle><Calculator size={15} /> Cálculo da Média Final</SectionTitle>

                  {/* Preview ao vivo */}
                  <div style={{ padding: '14px 18px', background: `${C.purple}08`, borderRadius: 12, border: `1px solid ${C.purple}20`, marginBottom: 20, fontSize: 13 }}>
                    <span style={{ color: C.purple, fontWeight: 800 }}>Fórmula ao vivo: </span>
                    <code style={{ color: C.ink, fontWeight: 700 }}>
                      {`(Média Anual × ${form.mediaAnualVezes} + Recuperação × ${form.mediaRecuperacaoVezes}) ÷ ${form.divididoPor}`}
                    </code>
                    <span style={{ color: C.success, fontWeight: 800 }}>{` = ${form.igualA}`}</span>
                  </div>

                  <Grid cols="repeat(4, 1fr)">
                    <Fld label="Média Anual × (*)">
                      <Inp type="number" step="1" min="1" value={form.mediaAnualVezes} onChange={(e: any) => upd({ mediaAnualVezes: parseInt(e.target.value) || 1 })} />
                    </Fld>
                    <Fld label="+ Recuperação × (*)">
                      <Inp type="number" step="1" min="0" value={form.mediaRecuperacaoVezes} onChange={(e: any) => upd({ mediaRecuperacaoVezes: parseInt(e.target.value) || 0 })} />
                    </Fld>
                    <Fld label="Dividido por (+)">
                      <Inp type="number" step="1" min="1" value={form.divididoPor} onChange={(e: any) => upd({ divididoPor: parseInt(e.target.value) || 1 })} />
                    </Fld>
                    <Fld label="Igual a (=)">
                      <Inp type="number" step="0.1" value={form.igualA} onChange={(e: any) => upd({ igualA: parseFloat(e.target.value) || 0 })} />
                    </Fld>
                  </Grid>

                  <Grid cols="1fr 1fr">
                    <Fld label="Cálculo Média Anual">
                      <Sel value={form.calculoMediaAnual} onChange={v => upd({ calculoMediaAnual: v })} options={CALC_MED} />
                    </Fld>
                    <Fld label="Em relação ao Conselho de Classe">
                      <Sel value={form.relacaoConselho} onChange={v => upd({ relacaoConselho: v })} options={RELACAO_CONSELHO} />
                    </Fld>
                  </Grid>

                  <div style={{ height: 1, background: C.border, margin: '20px 0' }} />
                  <SectionTitle><RotateCcw size={15} /> Recuperação</SectionTitle>

                  <Grid cols="120px 1fr 1fr 1fr">
                    <Fld label="Média após rec.">
                      <Inp type="number" step="0.1" value={form.mediaAposRecuperacao} onChange={(e: any) => upd({ mediaAposRecuperacao: parseFloat(e.target.value) || 0 })} />
                    </Fld>
                    <Fld label="Rec. Final = Média Final">
                      <Sel value={form.recFinalIgualMediaFinal} onChange={v => upd({ recFinalIgualMediaFinal: v })} options={SIM_NAO} />
                    </Fld>
                    <Fld label="Máx. comp. para recuperar">
                      <Inp type="number" step="1" min="0" value={form.maxComponentesRecuperacao} onChange={(e: any) => upd({ maxComponentesRecuperacao: parseInt(e.target.value) || 0 })} />
                    </Fld>
                    <Fld label="Reprova se > X% de falta">
                      <Inp type="number" step="1" min="0" max="100" value={form.reprovaSeAcimaFaltasPct} onChange={(e: any) => upd({ reprovaSeAcimaFaltasPct: parseInt(e.target.value) || 0 })} />
                    </Fld>
                  </Grid>

                  <Grid cols="120px 1fr 1fr">
                    <Fld label="Até X discp. abaixo da média">
                      <Inp type="number" step="1" min="0" value={form.ateDisciplinasAbaixoMedia} onChange={(e: any) => upd({ ateDisciplinasAbaixoMedia: parseInt(e.target.value) || 0 })} />
                    </Fld>
                    <Fld label="O resultado será">
                      <Sel value={form.resultadoAprovadoPP} onChange={v => upd({ resultadoAprovadoPP: v })} options={RESULTADO_PP} />
                    </Fld>
                    <Fld label="Após (caso exceda)">
                      <Sel value={form.aposResultado} onChange={v => upd({ aposResultado: v })} options={APOS_RESULTADO} />
                    </Fld>
                  </Grid>

                  <div style={{ height: 1, background: C.border, margin: '20px 0' }} />
                  <SectionTitle><Layers size={15} /> Frentes</SectionTitle>
                  <Grid cols="1fr 1fr">
                    <Fld label="Cálculo Média Anual">
                      <Sel value={form.calculoMediaAnualFrentes} onChange={v => upd({ calculoMediaAnualFrentes: v })} options={CALC_MED_FRENTES} />
                    </Fld>
                    <Fld label="Recuperação / Exame Final">
                      <Sel value={form.recuperacaoExameFrentes} onChange={v => upd({ recuperacaoExameFrentes: v })} options={CALC_EXM_FRENTES} />
                    </Fld>
                  </Grid>
                </>
              )}

              {/* ─── TAB: Notas Por Peso ───────────────────────────────────────── */}
              {tab === 'peso' && (
                <>
                  <SectionTitle><BarChart2 size={15} /> Configurações</SectionTitle>
                  <Grid cols="180px 1fr">
                    <Fld label="Notas por peso?">
                      <Sel value={form.notasPorPeso} onChange={v => upd({ notasPorPeso: v })} options={SIM_NAO} />
                    </Fld>
                    <Fld label="Como calcular Média Anual e Média Final">
                      <Sel value={form.calculoMediaPeso} onChange={v => upd({ calculoMediaPeso: v })} options={CALC_PESO_MODO} />
                    </Fld>
                  </Grid>

                  <div style={{ height: 1, background: C.border, margin: '20px 0' }} />
                  <SectionTitle><BarChart2 size={15} /> Peso das notas</SectionTitle>

                  {/* Dynamic: render nFases peso fields */}
                  <Grid cols="repeat(4, 1fr)">
                    {[1, 2, 3, 4].map(n => (
                      <Fld key={n} label={`Peso Nota ${n}`}>
                        <Inp
                          type="number" step="0.5" min="0"
                          value={(form as any)[`pesoNota${n}`]}
                          onChange={(e: any) => upd({ [`pesoNota${n}`]: parseFloat(e.target.value) || 0 } as any)}
                          disabled={form.notasPorPeso === 'Não'}
                        />
                      </Fld>
                    ))}
                  </Grid>

                  {form.notasPorPeso === 'Não' && (
                    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#92400e' }}>
                      <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
                      Os campos de peso estão desabilitados. Ative "Notas por peso = Sim" para configurar pesos diferenciados por avaliação.
                    </div>
                  )}
                </>
              )}

              {/* ─── TAB: Visualização de Notas ───────────────────────────────── */}
              {tab === 'visual' && (
                <>
                  <SectionTitle><Eye size={15} /> Arredondamento</SectionTitle>
                  <Grid cols="1fr 1fr 120px 180px 180px">
                    <Fld label="Usar arredondamento?">
                      <Sel value={form.usarArredondamento} onChange={v => upd({ usarArredondamento: v })} options={USO_ARR} />
                    </Fld>
                    <Fld label="Qual arredondamento?">
                      {cfgArredondamentos.length === 0 ? (
                        <div style={{
                          height: 40, borderRadius: 9, border: `1.5px solid ${C.warning}40`,
                          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8,
                          background: 'rgba(245,158,11,0.05)', fontSize: 12, color: '#92400e',
                        }}>
                          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                          Nenhum arredondamento cadastrado.
                          <a href="/configuracoes/notas/arredondamento" target="_blank"
                            style={{ color: C.primary, fontWeight: 700, textDecoration: 'underline', marginLeft: 4 }}>
                            Cadastrar agora →
                          </a>
                        </div>
                      ) : (
                        <select
                          value={form.qualArredondamento}
                          onChange={e => upd({ qualArredondamento: e.target.value })}
                          style={{
                            width: '100%', height: 40, borderRadius: 9, border: `1.5px solid ${C.border}`,
                            padding: '0 12px', fontSize: 13, background: '#fff',
                            color: C.ink, fontWeight: 600, outline: 'none',
                            cursor: 'pointer', boxSizing: 'border-box',
                          }}
                        >
                          {!form.qualArredondamento && (
                            <option value="" disabled>Selecione…</option>
                          )}
                          {cfgArredondamentos.map(a => (
                            <option key={a.id} value={a.descricao}>{a.descricao}</option>
                          ))}
                        </select>
                      )}
                    </Fld>
                    <Fld label="Casas após vírgula">
                      <Sel value={form.casasVirgula} onChange={v => upd({ casasVirgula: v })} options={CASAS} />
                    </Fld>
                    <Fld label="Desconsiderar demais casas?">
                      <Sel value={form.desconsiderarDemaisCasas} onChange={v => upd({ desconsiderarDemaisCasas: v })} options={SIM_NAO} />
                    </Fld>
                    <Fld label="Dividir pelo nº de avaliações?">
                      <Sel value={form.dividirNumAvaliacoes} onChange={v => upd({ dividirNumAvaliacoes: v })} options={SIM_NAO} />
                    </Fld>
                  </Grid>
                  <Grid cols="200px 1fr">
                    <Fld label="Na hora de arredondar, dividir por">
                      <Inp type="number" step="1" min="1" value={form.dividirArredondamentoPor} onChange={(e: any) => upd({ dividirArredondamentoPor: parseInt(e.target.value) || 1 })} />
                    </Fld>
                    <Fld label="Arredonda notas antes de calcular as médias?">
                      <Sel value={form.arredondaAntesCalculo} onChange={v => upd({ arredondaAntesCalculo: v })} options={SIM_NAO} />
                    </Fld>
                  </Grid>

                  <div style={{ height: 1, background: C.border, margin: '20px 0' }} />
                  <SectionTitle><Eye size={15} /> Apresentação de Notas no Boletim</SectionTitle>
                  <Grid cols="1fr 1fr 1fr 1fr">
                    <Fld label="Mostrar * abaixo da média?">
                      <Sel value={form.mostrarAsteriscoAbaixoMedia} onChange={v => upd({ mostrarAsteriscoAbaixoMedia: v })} options={SIM_NAO} />
                    </Fld>
                    <Fld label="Trocar cor da fonte?">
                      <Sel value={form.trocarCorFonte} onChange={v => upd({ trocarCorFonte: v })} options={SIM_NAO} />
                    </Fld>
                    <Fld label="Cor acima da média">
                      <Sel value={form.corAcimaDaMedia} onChange={v => upd({ corAcimaDaMedia: v })} options={CORES} />
                    </Fld>
                    <Fld label="Cor abaixo da média">
                      <Sel value={form.corAbaixoDaMedia} onChange={v => upd({ corAbaixoDaMedia: v })} options={CORES} />
                    </Fld>
                  </Grid>
                  <Grid cols="180px repeat(4, 1fr)">
                    <Fld label="Valor nota dispensa">
                      <Inp type="number" step="1" value={form.valorNotaDispensa} onChange={(e: any) => upd({ valorNotaDispensa: parseFloat(e.target.value) || 0 })} />
                    </Fld>
                    <Fld label="Nota 0,0 (Zero)">
                      <Sel value={form.nota00Extenso} onChange={v => upd({ nota00Extenso: v })} options={EXTENSO_OPTS} />
                    </Fld>
                    <Fld label="Nota 0,5 (Meio)">
                      <Sel value={form.nota05Extenso} onChange={v => upd({ nota05Extenso: v })} options={EXTENSO_OPTS} />
                    </Fld>
                    <Fld label="Nota 1,0 (Hum)">
                      <Sel value={form.nota10Extenso} onChange={v => upd({ nota10Extenso: v })} options={EXTENSO_OPTS} />
                    </Fld>
                    <Fld label="Nota 10,0 (Dez)">
                      <Sel value={form.nota100Extenso} onChange={v => upd({ nota100Extenso: v })} options={EXTENSO_OPTS} />
                    </Fld>
                  </Grid>
                </>
              )}

              {/* ─── TAB: Recuperação Bimestral / Trimestral ──────────────────── */}
              {tab === 'rec-bim' && (
                <>
                  <SectionTitle>
                    <RotateCcw size={15} /> Recuperação Bimestral (somente Boletim Fechado com Recuperação Bimestral)
                  </SectionTitle>

                  <div style={{ padding: '12px 16px', borderRadius: 10, background: `${C.primary}08`, border: `1px solid ${C.primary}20`, marginBottom: 20, fontSize: 12, color: '#0c4a6e' }}>
                    <Info size={13} style={{ display: 'inline', marginRight: 6 }} />
                    Esta configuração é aplicada somente quando o <strong>boletim estiver fechado com recuperação bimestral/trimestral ativa</strong>.
                    Altere o campo "Nome das fases" na aba <strong>Dados da Fórmula</strong> para Trimestre se necessário.
                  </div>

                  <Grid cols="1fr 1fr">
                    <Fld label="Mostrar Recuperação Bimestral/Trimestral no boletim fechado?">
                      <Sel value={form.mostrarRecBimBoletim} onChange={v => upd({ mostrarRecBimBoletim: v })} options={SIM_NAO} />
                    </Fld>
                    <Fld label="Nota abaixo da média — obrigatório fazer recuperação?">
                      <Sel value={form.notaAbaixoObrigRec} onChange={v => upd({ notaAbaixoObrigRec: v })} options={SIM_NAO} />
                    </Fld>
                  </Grid>

                  <Fld label="Cálculo Média do Bimestre/Trimestre">
                    <Sel value={form.calculoMediaBimTrimestre} onChange={v => upd({ calculoMediaBimTrimestre: v })} options={CALC_REC_BIM} />
                  </Fld>

                  {form.mostrarRecBimBoletim === 'Sim' && (
                    <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(16,185,129,0.07)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.20)', fontSize: 13, color: '#065f46' }}>
                      <Check size={14} style={{ display: 'inline', marginRight: 6 }} />
                      A recuperação bimestral <strong>será exibida</strong> no boletim fechado. Regra de cálculo ativa:{' '}
                      <strong>{form.calculoMediaBimTrimestre}</strong>
                    </div>
                  )}
                </>
              )}

              {/* ─── TAB: Recuperação Semestral ────────────────────────────────── */}
              {tab === 'rec-sem' && (
                <>
                  <SectionTitle>
                    <RotateCcw size={15} /> Recuperação Semestral (Somente Boletim Fechado com Rec. Semestral)
                  </SectionTitle>

                  <div style={{ padding: '12px 16px', borderRadius: 10, background: `${C.primary}08`, border: `1px solid ${C.primary}20`, marginBottom: 20, fontSize: 12, color: '#0c4a6e' }}>
                    <Info size={13} style={{ display: 'inline', marginRight: 6 }} />
                    Configuração aplicada quando o sistema utiliza <strong>recuperação semestral</strong> em paralelo com as fases bimestrais/trimestrais.
                  </div>

                  <Grid cols="1fr 1fr 1fr">
                    <Fld label="Possui Recuperação semestral?">
                      <Sel value={form.possuiRecSemestral} onChange={v => upd({ possuiRecSemestral: v })} options={SIM_NAO} />
                    </Fld>
                    <Fld label="Nota abaixo da média — obrigatório fazer recuperação?">
                      <Sel value={form.notaAbaixoObrigRecSem} onChange={v => upd({ notaAbaixoObrigRecSem: v })} options={SIM_NAO} disabled={form.possuiRecSemestral === 'Não'} />
                    </Fld>
                    <Fld label="Lançamento">
                      <Sel value={form.lancamentoRecSem} onChange={v => upd({ lancamentoRecSem: v })} options={LANCAMENTO_REC} disabled={form.possuiRecSemestral === 'Não'} />
                    </Fld>
                  </Grid>

                  <Fld label="Cálculo Recuperação Semestral">
                    <Sel value={form.calculoRecuperacaoSem} onChange={v => upd({ calculoRecuperacaoSem: v })} options={CALC_REC_SEM} disabled={form.possuiRecSemestral === 'Não'} />
                  </Fld>

                  <div style={{ marginTop: 16 }} />
                  <Fld label="Cálculo nas Frentes">
                    <Sel value={form.calculoNasFrentes} onChange={v => upd({ calculoNasFrentes: v })} options={CALC_FRENTES} disabled={form.possuiRecSemestral === 'Não'} />
                  </Fld>

                  {form.possuiRecSemestral === 'Sim' && (
                    <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(16,185,129,0.07)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.20)', fontSize: 13, color: '#065f46' }}>
                      <Check size={14} style={{ display: 'inline', marginRight: 6 }} />
                      Recuperação semestral <strong>ativa</strong>. Cálculo: <strong>{form.calculoRecuperacaoSem}</strong>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 28px', borderTop: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: C.surface,
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {TABS.map((t, i) => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: tab === t.id ? C.primary : C.border,
                    transition: 'all 0.15s',
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowModal(false)} style={{
                  height: 42, padding: '0 22px', borderRadius: 10, border: `1px solid ${C.border}`,
                  background: '#fff', color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                  <X size={14} /> Fechar
                </button>
                <button onClick={handleSave} disabled={!form.descricao.trim()} style={{
                  height: 42, padding: '0 26px', borderRadius: 10, border: 'none',
                  background: form.descricao.trim()
                    ? `linear-gradient(135deg, ${C.success}, #059669)`
                    : C.border,
                  color: form.descricao.trim() ? '#fff' : C.muted,
                  fontWeight: 800, fontSize: 13, cursor: form.descricao.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 7,
                  boxShadow: form.descricao.trim() ? `0 4px 14px ${C.success}40` : 'none',
                  transition: 'all 0.2s',
                }}>
                  <Check size={15} /> Gravar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
