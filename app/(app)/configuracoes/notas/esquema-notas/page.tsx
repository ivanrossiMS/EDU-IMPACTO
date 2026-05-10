'use client'
import {
  useData,
  EsquemaNota,
  DetalheEsquemaNota,
  EscopoLancamento,
  TipoDadoNota,
  newId,
} from '@/lib/dataContext'
import { TIPOS_META, isTipoLancavelManualmente, getEscopoPadrao, TIPOS_RESULTADO_FINAL } from '@/lib/notasEngine'
import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Edit2, Trash2, Check, X, Search, Copy, Lock, Unlock,
  Link2, BookOpen, Settings, ChevronRight, LayoutList, Info,
  ClipboardList, Eye, EyeOff, AlertTriangle, Layers, Shield, Zap, RefreshCw, BarChart2
} from 'lucide-react'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2]

const TIPOS_DADO: TipoDadoNota[] = [
  'Nota',
  'Conceito',
  'Falta',
  'Média Parcial 1',
  'Média Parcial 2',
  'Média Parcial 3',
  'Média Parcial 4',
  'Média Parcial 5',
  'Recuperação 1',
  'Recuperação 2',
  'Recuperação 3',
  'Recuperação 4',
  'Recuperação 5',
  'Nota de Estágio',
  'Conselho de Classe',
  'Média Final',
  'Média Geral',
  'Avaliação Online',
  'Avaliação Dissertativa',
  'Recuperação Online',
  'Ponto Extra',
  'Ponto Bônus',
]

const BLANK_ESQUEMA: Omit<EsquemaNota, 'id' | 'sequencial' | 'createdAt' | 'updatedAt' | 'detalhes' | 'formulaConfigurada'> = {
  descricao: '',
  situacao: 'Ativo',
  ano: ANO_ATUAL,
  protocolo: '',
  homologado: false,
  turmaIds: [],
  disciplinaIds: [],
  alteradoPor: '',
}

const BLANK_DETALHE: Omit<DetalheEsquemaNota, 'id' | 'ultimaAlteracao' | 'alteradoPor'> = {
  sequencial: 1,
  nomeAvaliacao: '',
  tipoDado: 'Nota',
  escopoLancamento: 'bimestral',
  grupoAvaliacaoId: '',
  grupoAvaliacaoDesc: '',
  peso: 1,
  valorMin: -1,
  valorMax: 10,
  exibeBoletimAdm: true,
  exibeBoletimAluno: true,
}

function getBadgeSituacao(s: 'Ativo' | 'Inativo') {
  return s === 'Ativo'
    ? { bg: 'rgba(16,185,129,0.12)', color: '#059669', label: 'Ativo' }
    : { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Inativo' }
}

function getHomologadoBadge(h: boolean) {
  return h
    ? { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', label: 'Homologado', icon: <Shield size={11} /> }
    : { bg: 'rgba(245,158,11,0.12)', color: '#b45309', label: 'Não Homologado', icon: <AlertTriangle size={11} /> }
}

function getUserName(): string {
  if (typeof window === 'undefined') return 'Admin'
  try {
    const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null')
    if (u?.nome) return u.nome
  } catch {}
  return 'Admin'
}

export default function EsquemaNotasPage() {
  const { esquemaNota, setEsquemaNota, cfgGruposAvaliacao, turmas, cfgDisciplinas, logSystemAction } = useData()

  // ── View State ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'lista' | 'detalhes'>('lista')
  const [esquemaSelecionado, setEsquemaSelecionado] = useState<EsquemaNota | null>(null)

  // ── Filtros lista ──────────────────────────────────────────────
  const [filtroAno, setFiltroAno] = useState<number>(ANO_ATUAL)
  const [busca, setBusca] = useState('')

  // ── Modal Esquema ──────────────────────────────────────────────
  const [showModalEsquema, setShowModalEsquema] = useState(false)
  const [formEsquema, setFormEsquema] = useState<typeof BLANK_ESQUEMA>({ ...BLANK_ESQUEMA })
  const [editEsquemaId, setEditEsquemaId] = useState<string | null>(null)
  const [tabEsquema, setTabEsquema] = useState<'dados' | 'turmas' | 'disciplinas'>('dados')

  // ── Modal Detalhe ──────────────────────────────────────────────
  const [showModalDetalhe, setShowModalDetalhe] = useState(false)
  const [formDetalhe, setFormDetalhe] = useState<typeof BLANK_DETALHE>({ ...BLANK_DETALHE })
  const [editDetalheId, setEditDetalheId] = useState<string | null>(null)

  // ── Busca detalhe ──────────────────────────────────────────────
  const [buscaDetalhe, setBuscaDetalhe] = useState('')

  // ── Computed lists ─────────────────────────────────────────────
  const listaFiltrada = useMemo(() => {
    return esquemaNota
      .filter(e => e.ano === filtroAno)
      .filter(e => !busca || e.descricao.toLowerCase().includes(busca.toLowerCase()) || String(e.sequencial).includes(busca))
      .sort((a, b) => a.sequencial - b.sequencial)
  }, [esquemaNota, filtroAno, busca])

  const buscaEsquema = useMemo(() => {
    if (!esquemaSelecionado) return []
    return esquemaSelecionado.detalhes
      .filter(d => !buscaDetalhe || d.nomeAvaliacao.toLowerCase().includes(buscaDetalhe.toLowerCase()) || d.tipoDado.toLowerCase().includes(buscaDetalhe.toLowerCase()))
      .sort((a, b) => a.sequencial - b.sequencial)
  }, [esquemaSelecionado, buscaDetalhe])

  const nextSequencial = useMemo(() => {
    if (!esquemaNota.length) return 1
    return Math.max(...esquemaNota.map(e => e.sequencial)) + 1
  }, [esquemaNota])

  const nextDetalheSeq = useMemo(() => {
    if (!esquemaSelecionado || !esquemaSelecionado.detalhes.length) return 1
    return Math.max(...esquemaSelecionado.detalhes.map(d => d.sequencial)) + 1
  }, [esquemaSelecionado])

  // ── Handlers Esquema ───────────────────────────────────────────
  const abrirNovoEsquema = () => {
    setEditEsquemaId(null)
    setFormEsquema({ ...BLANK_ESQUEMA, ano: filtroAno })
    setTabEsquema('dados')
    setShowModalEsquema(true)
  }

  const abrirEditarEsquema = (e: EsquemaNota) => {
    setEditEsquemaId(e.id)
    setFormEsquema({
      descricao: e.descricao,
      situacao: e.situacao,
      ano: e.ano,
      protocolo: e.protocolo,
      homologado: e.homologado,
      turmaIds: [...e.turmaIds],
      disciplinaIds: [...e.disciplinaIds],
      alteradoPor: e.alteradoPor,
    })
    setTabEsquema('dados')
    setShowModalEsquema(true)
  }

  const salvarEsquema = () => {
    if (!formEsquema.descricao.trim()) return
    const agora = new Date().toISOString()
    const user = getUserName()
    if (editEsquemaId) {
      setEsquemaNota(prev => prev.map(e => e.id === editEsquemaId
        ? { ...e, ...formEsquema, alteradoPor: user, updatedAt: agora }
        : e
      ))
      // Sync esquemaSelecionado se for o mesmo
      if (esquemaSelecionado?.id === editEsquemaId) {
        setEsquemaSelecionado(prev => prev ? { ...prev, ...formEsquema, alteradoPor: user, updatedAt: agora } : prev)
      }
      logSystemAction('Configurações', 'Edição', `Esquema de Notas editado: ${formEsquema.descricao} (${formEsquema.ano})`)
    } else {
      const novo: EsquemaNota = {
        ...formEsquema,
        id: newId('ESQ'),
        sequencial: nextSequencial,
        detalhes: [],
        formulaConfigurada: false,
        alteradoPor: user,
        createdAt: agora,
        updatedAt: agora,
      }
      setEsquemaNota(prev => [...prev, novo])
      logSystemAction('Configurações', 'Cadastro', `Novo Esquema de Notas: ${novo.descricao} (${novo.ano})`)
    }
    setShowModalEsquema(false)
  }

  const excluirEsquema = (id: string) => {
    const e = esquemaNota.find(x => x.id === id)
    if (!e) return
    if (e.homologado) {
      alert('Este esquema está homologado e não pode ser excluído.')
      return
    }
    if (!confirm(`Excluir o esquema "${e.descricao}"? Esta ação não poderá ser desfeita.`)) return
    setEsquemaNota(prev => prev.filter(x => x.id !== id))
    if (esquemaSelecionado?.id === id) { setEsquemaSelecionado(null); setActiveTab('lista') }
    logSystemAction('Configurações', 'Exclusão', `Esquema de Notas excluído: ${e.descricao}`)
  }

  const copiarEsquema = (e: EsquemaNota) => {
    const agora = new Date().toISOString()
    const user = getUserName()
    const novo: EsquemaNota = {
      ...e,
      id: newId('ESQ'),
      sequencial: nextSequencial,
      homologado: false,
      protocolo: `Copiado do esquema ${e.sequencial} – ${e.descricao}`,
      detalhes: e.detalhes.map(d => ({ ...d, id: newId('DET'), ultimaAlteracao: agora, alteradoPor: user })),
      formulaConfigurada: e.detalhes.length > 0,
      createdAt: agora,
      updatedAt: agora,
      alteradoPor: user,
    }
    setEsquemaNota(prev => [...prev, novo])
    logSystemAction('Configurações', 'Cópia', `Esquema copiado de #${e.sequencial}: ${e.descricao}`)
  }

  const toggleHomologar = (e: EsquemaNota) => {
    if (!e.homologado) {
      if (e.detalhes.length === 0) {
        alert('Configure ao menos um detalhe antes de homologar este esquema.')
        return
      }
      const temBimestral = e.detalhes.some(d => (d.escopoLancamento ?? getEscopoPadrao(d.tipoDado)) === 'bimestral')
      if (!temBimestral) {
        alert('Para homologar, o esquema precisa ter ao menos um detalhe de escopo "Bimestral".\n\nDetalhes de "Resultado Final" sozinhos não permitem o lançamento de notas nos bimestres.')
        return
      }
    }
    const agora = new Date().toISOString()
    const user = getUserName()
    setEsquemaNota(prev => prev.map(x => x.id === e.id
      ? { ...x, homologado: !x.homologado, updatedAt: agora, alteradoPor: user }
      : x
    ))
    if (esquemaSelecionado?.id === e.id) {
      setEsquemaSelecionado(prev => prev ? { ...prev, homologado: !prev.homologado, updatedAt: agora } : prev)
    }
  }

  const selecionarEsquema = (e: EsquemaNota) => {
    setEsquemaSelecionado(e)
    setActiveTab('detalhes')
    setBuscaDetalhe('')
  }

  // ── Handlers Detalhe ───────────────────────────────────────────
  const abrirNovoDetalhe = () => {
    if (!esquemaSelecionado) return
    if (esquemaSelecionado.homologado) { alert('Esquema homologado. Cancele a homologação para editar.'); return }
    setEditDetalheId(null)
    setFormDetalhe({ ...BLANK_DETALHE, sequencial: nextDetalheSeq })
    setShowModalDetalhe(true)
  }

  const abrirEditarDetalhe = (d: DetalheEsquemaNota) => {
    if (!esquemaSelecionado) return
    if (esquemaSelecionado.homologado) { alert('Esquema homologado. Cancele a homologação para editar.'); return }
    setEditDetalheId(d.id)
    setFormDetalhe({
      sequencial: d.sequencial,
      nomeAvaliacao: d.nomeAvaliacao,
      tipoDado: d.tipoDado,
      escopoLancamento: d.escopoLancamento ?? getEscopoPadrao(d.tipoDado),
      grupoAvaliacaoId: d.grupoAvaliacaoId,
      grupoAvaliacaoDesc: d.grupoAvaliacaoDesc,
      peso: d.peso,
      valorMin: d.valorMin,
      valorMax: d.valorMax,
      exibeBoletimAdm: d.exibeBoletimAdm,
      exibeBoletimAluno: d.exibeBoletimAluno,
    })
    setShowModalDetalhe(true)
  }

  const salvarDetalhe = () => {
    if (!esquemaSelecionado) return
    if (!formDetalhe.nomeAvaliacao.trim()) return
    const agora = new Date().toISOString()
    const user = getUserName()
    const grupoSel = cfgGruposAvaliacao.find(g => g.id === formDetalhe.grupoAvaliacaoId)
    const detalhaFull: DetalheEsquemaNota = {
      ...formDetalhe,
      id: editDetalheId || newId('DET'),
      escopoLancamento: formDetalhe.escopoLancamento ?? getEscopoPadrao(formDetalhe.tipoDado),
      grupoAvaliacaoDesc: grupoSel?.descricao || formDetalhe.grupoAvaliacaoDesc,
      ultimaAlteracao: agora,
      alteradoPor: user,
    }

    const novosDetalhes = editDetalheId
      ? esquemaSelecionado.detalhes.map(d => d.id === editDetalheId ? detalhaFull : d)
      : [...esquemaSelecionado.detalhes, detalhaFull]

    const esquemaAtualizado = {
      ...esquemaSelecionado,
      detalhes: novosDetalhes,
      formulaConfigurada: novosDetalhes.length > 0,
      updatedAt: agora,
      alteradoPor: user,
    }
    setEsquemaSelecionado(esquemaAtualizado)
    setEsquemaNota(prev => prev.map(e => e.id === esquemaSelecionado.id ? esquemaAtualizado : e))
    setShowModalDetalhe(false)
  }

  const excluirDetalhe = (detId: string) => {
    if (!esquemaSelecionado) return
    if (esquemaSelecionado.homologado) { alert('Esquema homologado. Cancele a homologação para editar.'); return }
    if (!confirm('Excluir este detalhe do esquema?')) return
    const agora = new Date().toISOString()
    const novosDetalhes = esquemaSelecionado.detalhes.filter(d => d.id !== detId)
    const esquemaAtualizado = {
      ...esquemaSelecionado,
      detalhes: novosDetalhes,
      formulaConfigurada: novosDetalhes.length > 0,
      updatedAt: agora,
    }
    setEsquemaSelecionado(esquemaAtualizado)
    setEsquemaNota(prev => prev.map(e => e.id === esquemaSelecionado.id ? esquemaAtualizado : e))
  }


  const toggleTurma = useCallback((turmaId: string) => {
    setFormEsquema(prev => {
      const isRemoving = prev.turmaIds.includes(turmaId)
      const newTurmaIds = isRemoving
        ? prev.turmaIds.filter(id => id !== turmaId)
        : [...prev.turmaIds, turmaId]

      if (!isRemoving) {
        // Adding a turma — no cleanup needed
        return { ...prev, turmaIds: newTurmaIds }
      }

      // Removing a turma — clean up disciplinaIds that are no longer available
      // Collect discipline names still available from remaining turmas
      const remainingTurmas = turmas.filter(t => newTurmaIds.includes(t.id))
      const nomesRestantes = new Set<string>()
      remainingTurmas.forEach(t => {
        (t.disciplinas ?? []).forEach(d => { if (d.nome) nomesRestantes.add(d.nome) })
      })
      // Keep only disciplinaIds whose cfgDisciplinas.nome is still in remaining turmas
      const validDiscIds = new Set(
        cfgDisciplinas.filter(d => nomesRestantes.has(d.nome)).map(d => d.id)
      )
      const cleanedDisciplinaIds = prev.disciplinaIds.filter(id => validDiscIds.has(id))

      return { ...prev, turmaIds: newTurmaIds, disciplinaIds: cleanedDisciplinaIds }
    })
  }, [turmas, cfgDisciplinas])

  const toggleDisciplina = useCallback((discId: string) => {
    setFormEsquema(prev => ({
      ...prev,
      disciplinaIds: prev.disciplinaIds.includes(discId)
        ? prev.disciplinaIds.filter(id => id !== discId)
        : [...prev.disciplinaIds, discId]
    }))
  }, [])

  // ── Colors ─────────────────────────────────────────────────────
  const COR = { primary: '#0ea5e9', accent: '#0284c7', danger: '#ef4444', warning: '#f59e0b', success: '#10b981' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100vh' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${COR.primary}, ${COR.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${COR.primary}40`
          }}>
            <Layers size={24} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
              Esquema de Notas
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginTop: 2 }}>
              Configure fórmulas, tipos de avaliação e vincule turmas e disciplinas
            </p>
          </div>
        </div>
        {/* Breadcrumb-style info when viewing detalhes */}
        {activeTab === 'detalhes' && esquemaSelecionado && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 10,
            background: `${COR.primary}10`, border: `1px solid ${COR.primary}30`,
            fontSize: 13, color: COR.primary, fontWeight: 700
          }}>
            <BookOpen size={14} />
            Esquema #{esquemaSelecionado.sequencial} – {esquemaSelecionado.descricao}
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f1f5f9', borderRadius: 12, width: 'fit-content', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.07)' }}>
        {([
          { key: 'lista' as const, label: 'Esquema de Notas', icon: <LayoutList size={15} />, disabled: false },
          { key: 'detalhes' as const, label: 'Detalhes do Esquema', icon: <ClipboardList size={15} />, disabled: !esquemaSelecionado },
        ]).map(t => (
          <button key={t.key}
            disabled={t.disabled}
            onClick={() => setActiveTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
              borderRadius: 9, border: 'none', cursor: t.disabled ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
              background: activeTab === t.key ? '#fff' : 'transparent',
              color: activeTab === t.key ? COR.primary : t.disabled ? '#cbd5e1' : '#64748b',
              boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ TAB: LISTA ══════════════════════ */}
      {activeTab === 'lista' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toolbar */}
          <div className="card" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Actions */}
              <button onClick={abrirNovoEsquema} className="btn btn-primary" style={{ gap: 7, fontWeight: 800, borderRadius: 10, padding: '0 20px', height: 42 }}>
                <Plus size={16} /> Novo Esquema
              </button>

              <div style={{ width: 1, height: 28, background: '#e2e8f0' }} />

              {/* Filtro Ano */}
              <div style={{ display: 'flex', gap: 5 }}>
                {ANOS.map(a => (
                  <button key={a} onClick={() => setFiltroAno(a)} style={{
                    padding: '6px 14px', borderRadius: 8, border: `1px solid ${filtroAno === a ? COR.primary : '#e2e8f0'}`,
                    background: filtroAno === a ? `${COR.primary}15` : '#fff',
                    color: filtroAno === a ? COR.primary : '#64748b',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>{a}</button>
                ))}
              </div>

              {/* Busca */}
              <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
                <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input className="form-input" style={{ paddingLeft: 34, height: 40, fontSize: 13, borderRadius: 10 }}
                  placeholder="Pesquisar esquema..." value={busca} onChange={e => setBusca(e.target.value)} />
              </div>

              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                {listaFiltrada.length} esquema(s) em {filtroAno}
              </span>
            </div>
          </div>

          {/* Tabela */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {[
                      { label: 'Id', w: 60 },
                      { label: 'Descrição', w: 'auto' },
                      { label: 'Situação', w: 100 },
                      { label: 'Ano', w: 70 },
                      { label: 'Fórmula Configurada', w: 140 },
                      { label: 'Homologação', w: 140 },
                      { label: 'Detalhes', w: 80 },
                      { label: 'Alterado Por', w: 140 },
                      { label: 'Ações', w: 200 },
                    ].map(col => (
                      <th key={col.label} style={{
                        padding: '13px 16px', fontSize: 11, fontWeight: 800,
                        color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em',
                        width: col.w, whiteSpace: 'nowrap'
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <Layers size={40} style={{ color: '#cbd5e1' }} />
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                            Nenhum esquema cadastrado para {filtroAno}
                          </div>
                          <button onClick={abrirNovoEsquema} className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
                            <Plus size={14} /> Criar primeiro esquema
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : listaFiltrada.map((e, idx) => {
                    const sit = getBadgeSituacao(e.situacao)
                    const hom = getHomologadoBadge(e.homologado)
                    const isEven = idx % 2 === 0
                    return (
                      <tr key={e.id}
                        style={{ borderBottom: '1px solid #f1f5f9', background: isEven ? '#fff' : '#fafafa', transition: 'background 0.15s' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = `${COR.primary}06`)}
                        onMouseLeave={ev => (ev.currentTarget.style.background = isEven ? '#fff' : '#fafafa')}
                      >
                        {/* Id */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontWeight: 900, fontSize: 15, color: COR.primary, fontFamily: 'Outfit, monospace' }}>
                            {e.sequencial}
                          </span>
                        </td>
                        {/* Descrição */}
                        <td style={{ padding: '14px 16px', maxWidth: 300 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 3 }}>{e.descricao}</div>
                          {e.protocolo && (
                            <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', lineClamp: 2, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {e.protocolo}
                            </div>
                          )}
                          {e.turmaIds.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                              {e.turmaIds.slice(0, 3).map(tid => {
                                const t = turmas.find(x => x.id === tid)
                                return t ? (
                                  <span key={tid} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: `${COR.primary}10`, color: COR.primary, fontWeight: 700 }}>
                                    {t.nome}
                                  </span>
                                ) : null
                              })}
                              {e.turmaIds.length > 3 && (
                                <span style={{ fontSize: 10, color: '#9ca3af', padding: '2px 6px' }}>+{e.turmaIds.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>
                        {/* Situação */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: sit.bg, color: sit.color }}>
                            {sit.label}
                          </span>
                        </td>
                        {/* Ano */}
                        <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 14, color: '#374151' }}>{e.ano}</td>
                        {/* Fórmula */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: e.formulaConfigurada ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                            color: e.formulaConfigurada ? '#059669' : '#dc2626',
                          }}>
                            {e.formulaConfigurada ? `Sim (${e.detalhes.length})` : 'Não'}
                          </span>
                        </td>
                        {/* Homologação */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: hom.bg, color: hom.color }}>
                            {hom.icon}{hom.label}
                          </span>
                        </td>
                        {/* Detalhes count */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button onClick={() => selecionarEsquema(e)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: `1px solid ${COR.primary}30`, background: `${COR.primary}08`, color: COR.primary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                            <Settings size={13} />{e.detalhes.length}
                          </button>
                        </td>
                        {/* Alterado por */}
                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b' }}>
                          <div>{e.alteradoPor || '—'}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.updatedAt ? new Date(e.updatedAt).toLocaleDateString('pt-BR') : ''}</div>
                        </td>
                        {/* Ações */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <button onClick={() => selecionarEsquema(e)} title="Ver Detalhes"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #dbeafe', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                              <ChevronRight size={14} />
                            </button>
                            <button onClick={() => abrirEditarEsquema(e)} title="Editar" disabled={e.homologado}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb', color: '#d97706', cursor: e.homologado ? 'not-allowed' : 'pointer', opacity: e.homologado ? 0.5 : 1, fontWeight: 700, fontSize: 12 }}>
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => copiarEsquema(e)} title="Copiar Esquema"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e7ff', background: '#eef2ff', color: '#6366f1', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                              <Copy size={14} />
                            </button>
                            <button onClick={() => toggleHomologar(e)} title={e.homologado ? 'Cancelar Homologação' : 'Homologar'}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8,
                                border: `1px solid ${e.homologado ? '#fde68a' : '#bbf7d0'}`,
                                background: e.homologado ? '#fffbeb' : '#f0fdf4',
                                color: e.homologado ? '#b45309' : '#059669',
                                cursor: 'pointer', fontWeight: 700, fontSize: 12
                              }}>
                              {e.homologado ? <Unlock size={14} /> : <Lock size={14} />}
                            </button>
                            <button onClick={() => excluirEsquema(e.id)} title="Excluir" disabled={e.homologado}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: e.homologado ? 'not-allowed' : 'pointer', opacity: e.homologado ? 0.5 : 1, fontWeight: 700, fontSize: 12 }}>
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

            {/* Legend */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Mostrando {listaFiltrada.length} de {esquemaNota.filter(e => e.ano === filtroAno).length} registro(s)</span>
              <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700 }}>
                  <Shield size={11} /> Homologado
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: '#fffbeb', color: '#b45309', fontSize: 12, fontWeight: 700 }}>
                  <AlertTriangle size={11} /> Não Homologado
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB: DETALHES ══════════════════════ */}
      {activeTab === 'detalhes' && esquemaSelecionado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info card do esquema selecionado */}
          <div className="card" style={{ padding: '18px 22px', borderLeft: `4px solid ${COR.primary}`, background: `linear-gradient(135deg, ${COR.primary}05, #fff)` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: 20, color: COR.primary, fontFamily: 'Outfit, sans-serif' }}>
                    #{esquemaSelecionado.sequencial}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>{esquemaSelecionado.descricao}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, ...getBadgeSituacao(esquemaSelecionado.situacao) }}>
                    {esquemaSelecionado.situacao}
                  </span>
                  {(() => { const h = getHomologadoBadge(esquemaSelecionado.homologado); return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: h.bg, color: h.color }}>
                      {h.icon}{h.label}
                    </span>
                  )})()}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>Ano Letivo: <strong style={{ color: '#374151' }}>{esquemaSelecionado.ano}</strong></span>
                  <span>Detalhes: <strong style={{ color: COR.primary }}>{esquemaSelecionado.detalhes.length}</strong></span>
                  {esquemaSelecionado.turmaIds.length > 0 && (
                    <span>Turmas vinculadas: <strong style={{ color: COR.primary }}>{esquemaSelecionado.turmaIds.length}</strong></span>
                  )}
                  {esquemaSelecionado.protocolo && (
                    <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>{esquemaSelecionado.protocolo}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setActiveTab('lista'); setEsquemaSelecionado(null) }}
                  className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
                  ← Voltar
                </button>
                <button onClick={() => abrirEditarEsquema(esquemaSelecionado)}
                  disabled={esquemaSelecionado.homologado}
                  className="btn btn-secondary btn-sm" style={{ gap: 6, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', opacity: esquemaSelecionado.homologado ? 0.5 : 1 }}>
                  <Edit2 size={14} /> Editar Esquema
                </button>
                <button onClick={() => toggleHomologar(esquemaSelecionado)}
                  className="btn btn-sm" style={{
                    gap: 6, background: esquemaSelecionado.homologado ? '#fffbeb' : '#f0fdf4',
                    color: esquemaSelecionado.homologado ? '#b45309' : '#059669',
                    border: `1px solid ${esquemaSelecionado.homologado ? '#fde68a' : '#bbf7d0'}`,
                  }}>
                  {esquemaSelecionado.homologado ? <><Unlock size={14} /> Cancelar Homolog.</> : <><Lock size={14} /> Homologar</>}
                </button>
              </div>
            </div>
          </div>

          {/* Toolbar detalhes */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={abrirNovoDetalhe} className="btn btn-primary btn-sm"
                disabled={esquemaSelecionado.homologado}
                style={{ gap: 7, opacity: esquemaSelecionado.homologado ? 0.5 : 1 }}>
                <Plus size={14} /> Novo Detalhe
              </button>
              {esquemaSelecionado.homologado && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#b45309', background: 'rgba(245,158,11,0.1)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                  <Lock size={13} /> Esquema homologado — cancele para editar detalhes
                </div>
              )}
              <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280, marginLeft: 'auto' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input className="form-input" style={{ paddingLeft: 30, height: 38, fontSize: 13, borderRadius: 9 }}
                  placeholder="Pesquisar detalhe..." value={buscaDetalhe} onChange={e => setBuscaDetalhe(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Tabela detalhes */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {[
                      { label: 'Seq.', w: 65 },
                      { label: 'Nome Avaliação', w: 150 },
                      { label: 'Tipo de Dado', w: 170 },
                      { label: 'Grupo de Avaliação', w: 180 },
                      { label: 'Peso', w: 70 },
                      { label: 'Valor Mín.', w: 90 },
                      { label: 'Valor Máx.', w: 90 },
                      { label: 'Exibe Boletim ADM', w: 130 },
                      { label: 'Exibe Boletim Aluno', w: 130 },
                      { label: 'Última Alteração', w: 130 },
                      { label: 'Alterado Por', w: 120 },
                      { label: 'Ações', w: 100 },
                    ].map(col => (
                      <th key={col.label} style={{
                        padding: '12px 14px', fontSize: 11, fontWeight: 800,
                        color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em',
                        width: col.w, whiteSpace: 'nowrap'
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buscaEsquema.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ padding: '50px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <ClipboardList size={36} style={{ color: '#cbd5e1' }} />
                          <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>
                            {buscaDetalhe ? 'Nenhum detalhe encontrado' : 'Nenhum detalhe cadastrado neste esquema'}
                          </div>
                          {!buscaDetalhe && !esquemaSelecionado.homologado && (
                            <button onClick={abrirNovoDetalhe} className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
                              <Plus size={14} /> Adicionar primeiro detalhe
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (() => {
                    const bimestrais = buscaEsquema.filter(d => (d.escopoLancamento ?? getEscopoPadrao(d.tipoDado)) === 'bimestral')
                    const resultadoFinal = buscaEsquema.filter(d => (d.escopoLancamento ?? getEscopoPadrao(d.tipoDado)) === 'resultado_final')

                    const renderRow = (d: DetalheEsquemaNota, idx: number) => {
                      const isEven = idx % 2 === 0
                      const escopo = d.escopoLancamento ?? getEscopoPadrao(d.tipoDado)
                      const escopoColor = escopo === 'bimestral' ? '#3b82f6' : '#10b981'
                      return (
                        <tr key={d.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isEven ? '#fff' : '#fafafa',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={ev => (ev.currentTarget.style.background = `${COR.primary}06`)}
                          onMouseLeave={ev => (ev.currentTarget.style.background = isEven ? '#fff' : '#fafafa')}
                        >
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ fontWeight: 900, fontSize: 15, color: COR.primary, fontFamily: 'Outfit, monospace' }}>{d.sequencial}</span>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{d.nomeAvaliacao}</div>
                            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${escopoColor}15`, color: escopoColor }}>
                              {escopo === 'bimestral' ? '📅 Bimestral' : '🏁 Resultado Final'}
                            </span>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                              background: TIPOS_META[d.tipoDado]?.corFundo || 'rgba(107,114,128,0.08)',
                              color: TIPOS_META[d.tipoDado]?.cor || '#6b7280',
                            }}>
                              {TIPOS_META[d.tipoDado]?.icone} {d.tipoDado}
                            </span>
                          </td>
                          <td style={{ padding: '13px 14px', fontSize: 13, color: '#374151', fontWeight: 600 }}>
                            {d.grupoAvaliacaoDesc || '—'}
                          </td>
                          <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#374151' }}>{d.peso}</td>
                          <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: d.valorMin < 0 ? '#9ca3af' : '#374151' }}>{d.valorMin}</td>
                          <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#059669' }}>{d.valorMax.toFixed(3)}</td>
                          <td style={{ padding: '13px 14px', textAlign: 'center' }}>
                            {d.exibeBoletimAdm
                              ? <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 6, background: '#f0fdf4', color: '#059669', fontWeight: 800 }}><Eye size={14} /></span>
                              : <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#94a3b8' }}><EyeOff size={14} /></span>
                            }
                          </td>
                          <td style={{ padding: '13px 14px', textAlign: 'center' }}>
                            {d.exibeBoletimAluno
                              ? <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 6, background: '#f0fdf4', color: '#059669', fontWeight: 800 }}><Eye size={14} /></span>
                              : <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#94a3b8' }}><EyeOff size={14} /></span>
                            }
                          </td>
                          <td style={{ padding: '13px 14px', fontSize: 12, color: '#64748b' }}>
                            {d.ultimaAlteracao ? new Date(d.ultimaAlteracao).toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td style={{ padding: '13px 14px', fontSize: 12, color: '#64748b' }}>{d.alteradoPor || '—'}</td>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={() => abrirEditarDetalhe(d)} title="Editar"
                                disabled={esquemaSelecionado.homologado}
                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb', color: '#d97706', cursor: esquemaSelecionado.homologado ? 'not-allowed' : 'pointer', opacity: esquemaSelecionado.homologado ? 0.5 : 1 }}>
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => excluirDetalhe(d.id)} title="Excluir"
                                disabled={esquemaSelecionado.homologado}
                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: esquemaSelecionado.homologado ? 'not-allowed' : 'pointer', opacity: esquemaSelecionado.homologado ? 0.5 : 1 }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    const sectionHeader = (label: string, count: number, color: string) => (
                      <tr key={`header-${label}`}>
                        <td colSpan={12} style={{ padding: '8px 14px', background: `${color}08`, borderBottom: `2px solid ${color}30`, borderTop: '2px solid #e2e8f0' }}>
                          <span style={{ fontWeight: 800, fontSize: 11, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {label} <span style={{ opacity: 0.7 }}>({count})</span>
                          </span>
                        </td>
                      </tr>
                    )

                    return (
                      <>
                        {bimestrais.length > 0 && sectionHeader('📅 Lançamentos Bimestrais', bimestrais.length, '#3b82f6')}
                        {bimestrais.map((d, i) => renderRow(d, i))}
                        {resultadoFinal.length > 0 && sectionHeader('🏁 Resultado Final / Fechamento Anual', resultadoFinal.length, '#10b981')}
                        {resultadoFinal.map((d, i) => renderRow(d, i))}
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
              Mostrando {buscaEsquema.length} de {esquemaSelecionado.detalhes.length} detalhe(s)
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL ESQUEMA ══════════════════════ */}
      {showModalEsquema && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={e => { if (e.target === e.currentTarget) setShowModalEsquema(false) }}>
          <div style={{
            background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Header modal */}
            <div style={{ padding: '22px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, background: `linear-gradient(135deg, ${COR.primary}10, #fff)` }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${COR.primary}, ${COR.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 17, color: '#0f172a' }}>
                  {editEsquemaId ? 'Editar Esquema de Notas' : 'Cadastrar Esquema de Notas'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Sequencial: <strong style={{ color: COR.primary }}>{editEsquemaId ? esquemaNota.find(e => e.id === editEsquemaId)?.sequencial : nextSequencial}</strong>
                </div>
              </div>
              <button onClick={() => setShowModalEsquema(false)} style={{ padding: 8, borderRadius: 9, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            {/* Sub-tabs modal */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              {([
                { key: 'dados' as const, label: 'Dados Gerais', icon: <Info size={14} />, count: undefined as number | undefined },
                { key: 'turmas' as const, label: 'Vincular Turmas', icon: <Link2 size={14} />, count: formEsquema.turmaIds.length as number | undefined },
                { key: 'disciplinas' as const, label: 'Vincular Disciplinas', icon: <BookOpen size={14} />, count: formEsquema.disciplinaIds.length as number | undefined },
              ]).map(t => (
                <button key={t.key} onClick={() => setTabEsquema(t.key)}
                  style={{
                    padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
                    color: tabEsquema === t.key ? COR.primary : '#64748b',
                    borderBottom: tabEsquema === t.key ? `2px solid ${COR.primary}` : '2px solid transparent',
                    transition: 'color 0.2s',
                  }}>
                  {t.icon}{t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span style={{ padding: '1px 7px', borderRadius: 20, background: `${COR.primary}15`, color: COR.primary, fontSize: 11, fontWeight: 800 }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

              {tabEsquema === 'dados' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Row 1: Descrição + Situação + Ano */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px', gap: 16 }}>
                    <div>
                      <label className="form-label">Descrição <span style={{ color: '#ef4444' }}>*</span></label>
                      <input className="form-input" autoFocus style={{ height: 44, fontWeight: 700 }}
                        value={formEsquema.descricao}
                        onChange={e => setFormEsquema(p => ({ ...p, descricao: e.target.value }))}
                        placeholder="Ex: Esquema 2º ao 5ºANO - 2026" />
                    </div>
                    <div>
                      <label className="form-label">Situação</label>
                      <select className="form-input" style={{ height: 44 }}
                        value={formEsquema.situacao}
                        onChange={e => setFormEsquema(p => ({ ...p, situacao: e.target.value as any }))}>
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Ano</label>
                      <select className="form-input" style={{ height: 44 }}
                        value={formEsquema.ano}
                        onChange={e => setFormEsquema(p => ({ ...p, ano: Number(e.target.value) }))}>
                        {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Protocolo */}
                  <div>
                    <label className="form-label">Protocolos</label>
                    <textarea className="form-input" rows={3}
                      style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit', fontSize: 13 }}
                      value={formEsquema.protocolo}
                      onChange={e => setFormEsquema(p => ({ ...p, protocolo: e.target.value }))}
                      placeholder="Protocolos do esquema (ex: copiado de outro esquema, aprovado em reunião pedagógica...)" />
                  </div>

                  {/* Homologar */}
                  {editEsquemaId && (
                    <div style={{ padding: '14px 18px', borderRadius: 12, background: formEsquema.homologado ? 'rgba(59,130,246,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${formEsquema.homologado ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {formEsquema.homologado ? <Shield size={15} style={{ color: '#2563eb' }} /> : <AlertTriangle size={15} style={{ color: '#b45309' }} />}
                          {formEsquema.homologado ? 'Esquema Homologado' : 'Esquema Não Homologado'}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                          {formEsquema.homologado
                            ? 'Protegido contra edições. Cancele a homologação para modificar detalhes.'
                            : 'Homologue para proteger o esquema e liberar lançamentos de notas.'}
                        </div>
                      </div>
                      <button
                        onClick={() => setFormEsquema(p => ({ ...p, homologado: !p.homologado }))}
                        style={{ padding: '8px 16px', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: formEsquema.homologado ? '#fffbeb' : '#f0fdf4', color: formEsquema.homologado ? '#b45309' : '#059669', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {formEsquema.homologado ? <><Unlock size={14} /> Cancelar</> : <><Lock size={14} /> Homologar</>}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tabEsquema === 'turmas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link2 size={14} />
                    Selecione as turmas que utilizarão este esquema de notas.
                  </div>
                  {turmas.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                      Nenhuma turma cadastrada.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                      {turmas.map(t => {
                        const sel = formEsquema.turmaIds.includes(t.id)
                        return (
                          <button key={t.id} onClick={() => toggleTurma(t.id)}
                            style={{
                              padding: '12px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                              border: `2px solid ${sel ? COR.primary : '#e2e8f0'}`,
                              background: sel ? `${COR.primary}10` : '#fafafa',
                              transition: 'all 0.15s',
                              display: 'flex', alignItems: 'center', gap: 10
                            }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                              background: sel ? COR.primary : '#e2e8f0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {sel && <Check size={13} color="#fff" strokeWidth={3} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: sel ? COR.primary : '#374151' }}>{t.nome}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.serie} · {t.turno} · {t.ano}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {formEsquema.turmaIds.length > 0 && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: `${COR.primary}08`, border: `1px solid ${COR.primary}20`, fontSize: 13, color: COR.primary, fontWeight: 700 }}>
                      {formEsquema.turmaIds.length} turma(s) selecionada(s)
                    </div>
                  )}
                </div>
              )}

              {tabEsquema === 'disciplinas' && (() => {
                // ── Compute disciplines from selected turmas ────────────────
                const turmasSelecionadas = turmas.filter(t => formEsquema.turmaIds.includes(t.id))

                // Collect unique discipline names from all selected turmas
                const nomesNasTurmas = new Set<string>()
                turmasSelecionadas.forEach(t => {
                  (t.disciplinas ?? []).forEach(d => {
                    if (d.nome) nomesNasTurmas.add(d.nome)
                  })
                })

                // Match against cfgDisciplinas to get canonical ids/data
                const disciplinasDasTurmas = cfgDisciplinas.filter(d =>
                  d.situacao === 'ativa' && nomesNasTurmas.has(d.nome)
                )

                // ── UI states ───────────────────────────────────────────────
                const semTurmas = formEsquema.turmaIds.length === 0
                const semDisciplinas = !semTurmas && disciplinasDasTurmas.length === 0

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BookOpen size={14} />
                      Restrinja o esquema a disciplinas específicas das turmas vinculadas (deixe vazio para aplicar a todas).
                    </div>

                    {/* No turmas selected */}
                    {semTurmas && (
                      <div style={{
                        padding: '28px 20px', textAlign: 'center', borderRadius: 12,
                        border: '1px dashed #e2e8f0', background: '#fafafa',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
                      }}>
                        <Link2 size={28} color="#cbd5e1" />
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>Nenhuma turma vinculada</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', maxWidth: 280 }}>
                          Vá para a aba <strong>Vincular Turmas</strong> e selecione ao menos uma turma para ver as disciplinas disponíveis.
                        </div>
                        <button
                          onClick={() => setTabEsquema('turmas')}
                          style={{ marginTop: 4, padding: '7px 18px', borderRadius: 8, border: 'none', background: COR.primary, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
                        >
                          <Link2 size={13} /> Vincular Turmas
                        </button>
                      </div>
                    )}

                    {/* Turmas selected but none has disciplines linked */}
                    {semDisciplinas && (
                      <div style={{
                        padding: '28px 20px', textAlign: 'center', borderRadius: 12,
                        border: '1px dashed #fde68a', background: '#fffbeb',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
                      }}>
                        <BookOpen size={28} color="#fbbf24" />
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                          Turma(s) sem disciplinas vinculadas
                        </div>
                        <div style={{ fontSize: 12, color: '#b45309', maxWidth: 320 }}>
                          {turmasSelecionadas.length === 1
                            ? `A turma "${turmasSelecionadas[0].nome}" não possui disciplinas vinculadas.`
                            : `${turmasSelecionadas.length} turmas selecionadas, mas nenhuma tem disciplinas vinculadas.`
                          }
                          {' '}Acesse <strong>Acadêmico → Turmas</strong> e vincule disciplinas na aba <strong>Disciplinas</strong> do card de cada turma.
                        </div>
                      </div>
                    )}

                    {/* Disciplines from turmas */}
                    {disciplinasDasTurmas.length > 0 && (
                      <>
                        {/* Turma origin legend */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {turmasSelecionadas.map(t => (
                            <span key={t.id} style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: `${COR.primary}12`, color: COR.primary, border: `1px solid ${COR.primary}25`
                            }}>
                              {t.nome} ({(t.disciplinas ?? []).length} disc.)
                            </span>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                          {disciplinasDasTurmas.map(d => {
                            const sel = formEsquema.disciplinaIds.includes(d.id)
                            // Find which turmas include this discipline
                            const turmasComEsta = turmasSelecionadas.filter(t =>
                              (t.disciplinas ?? []).some(td => td.nome === d.nome)
                            )
                            return (
                              <button key={d.id} onClick={() => toggleDisciplina(d.id)}
                                style={{
                                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                                  border: `2px solid ${sel ? '#6366f1' : '#e2e8f0'}`,
                                  background: sel ? 'rgba(99,102,241,0.08)' : '#fafafa',
                                  transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: 10
                                }}>
                                <div style={{
                                  width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                                  background: sel ? '#6366f1' : '#e2e8f0',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  {sel && <Check size={12} color="#fff" strokeWidth={3} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: sel ? '#6366f1' : '#374151' }}>{d.nome}</div>
                                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.codigo}</div>
                                  {turmasSelecionadas.length > 1 && (
                                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                                      {turmasComEsta.map(t => t.nome).join(', ')}
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {formEsquema.disciplinaIds.length > 0 && (
                          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', fontSize: 13, color: '#6366f1', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{formEsquema.disciplinaIds.length} disciplina(s) selecionada(s)</span>
                            <button
                              onClick={() => setFormEsquema(p => ({ ...p, disciplinaIds: [] }))}
                              style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                            >
                              Limpar seleção
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Footer modal */}
            <div style={{ padding: '18px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fafafa' }}>
              <button onClick={() => setShowModalEsquema(false)} className="btn btn-ghost" style={{ height: 42, fontWeight: 700 }}>
                <X size={15} /> Fechar
              </button>
              <button onClick={salvarEsquema} className="btn btn-primary" style={{ height: 42, fontWeight: 800, gap: 8 }}
                disabled={!formEsquema.descricao.trim()}>
                <Check size={15} /> Gravar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL DETALHE ══════════════════════ */}
      {showModalDetalhe && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={e => { if (e.target === e.currentTarget) setShowModalDetalhe(false) }}>
          <div style={{
            background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 26px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, rgba(14,165,233,0.08), #fff)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${COR.primary}, ${COR.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>
                  {editDetalheId ? 'Editar Detalhe' : 'Cadastrar Detalhe'} — Esquema de Notas
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{esquemaSelecionado?.descricao}</div>
              </div>
              <button onClick={() => setShowModalDetalhe(false)} style={{ padding: 7, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}>
                <X size={17} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Row 1: Código + Sequencial + Nome Avaliação */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Código</label>
                  <div style={{ height: 44, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, fontWeight: 800, color: '#0ea5e9' }}>
                    {editDetalheId ? formDetalhe.sequencial : nextDetalheSeq}
                  </div>
                </div>
                <div>
                  <label className="form-label">Sequencial</label>
                  <select className="form-input" style={{ height: 44 }}
                    value={formDetalhe.sequencial}
                    onChange={e => setFormDetalhe(p => ({ ...p, sequencial: Number(e.target.value) }))}>
                    {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Nome Avaliação <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-input" autoFocus style={{ height: 44, fontWeight: 700, textTransform: 'uppercase' }}
                    value={formDetalhe.nomeAvaliacao}
                    onChange={e => setFormDetalhe(p => ({ ...p, nomeAvaliacao: e.target.value.toUpperCase() }))}
                    placeholder="Ex: AVM, AVB, MediaF, RecBim" />
                </div>
              </div>

              {/* Row 2: Tipo Dado + Grupo Avaliação */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Tipo de Dado</label>
                  <select className="form-input" style={{ height: 44 }}
                    value={formDetalhe.tipoDado}
                    onChange={e => {
                      const t = e.target.value as TipoDadoNota
                      const meta = TIPOS_META[t]
                      setFormDetalhe(p => ({
                        ...p,
                        tipoDado: t,
                        // Auto-preenche escopo baseado no tipo de dado
                        escopoLancamento: getEscopoPadrao(t),
                        // Auto-preenche valores padrão do motor
                        valorMax: meta.maxValor <= 10 ? meta.maxValor : p.valorMax,
                        // Tipos que não são lancáveis não exibem no boletim do aluno por padrão
                        exibeBoletimAluno: meta.entraNoCalculo || meta.categoria === 'media',
                      }))
                    }}>
                    {TIPOS_DADO.map(t => {
                      const meta = TIPOS_META[t]
                      return (
                        <option key={t} value={t}>
                          {meta.icone} {t}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label className="form-label">Grupo de Avaliação</label>
                  <select className="form-input" style={{ height: 44 }}
                    value={formDetalhe.grupoAvaliacaoId}
                    onChange={e => setFormDetalhe(p => ({ ...p, grupoAvaliacaoId: e.target.value }))}>
                    <option value="">— Selecione —</option>
                    {cfgGruposAvaliacao.map(g => (
                      <option key={g.id} value={g.id}>{g.descricao} (cod: {g.codigo})</option>
                    ))}
                  </select>
                  {cfgGruposAvaliacao.length === 0 && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={11} /> Configure grupos em Config. → Notas → Grupos de Avaliação
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Escopo de Lançamento */}
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Zap size={13} style={{ color: '#0ea5e9' }} />
                  Escopo de Lançamento
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
                    — Define em qual aba o professor pode preencher este campo
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {([
                    { value: 'bimestral', label: '📅 Bimestral', desc: 'Aparece em todos os bimestres (1º ao 4º)', color: '#3b82f6' },
                    { value: 'resultado_final', label: '🏁 Resultado Final', desc: 'Aparece apenas no fechamento anual', color: '#10b981' },
                  ] as { value: EscopoLancamento, label: string, desc: string, color: string }[]).map(opt => {
                    const isSelected = (formDetalhe.escopoLancamento ?? getEscopoPadrao(formDetalhe.tipoDado)) === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormDetalhe(p => ({ ...p, escopoLancamento: opt.value }))}
                        style={{
                          flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                          border: `2px solid ${isSelected ? opt.color : '#e2e8f0'}`,
                          background: isSelected ? `${opt.color}12` : '#fff',
                          textAlign: 'left', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 13, color: isSelected ? opt.color : '#374151', marginBottom: 3 }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{opt.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Painel informativo do Tipo de Dado selecionado */}
              {(() => {
                const meta = TIPOS_META[formDetalhe.tipoDado]
                if (!meta) return null
                const CATEGORIA_CORES: Record<string, { bg: string; color: string; label: string }> = {
                  avaliacao:    { bg: 'rgba(59,130,246,0.10)',   color: '#3b82f6',  label: 'Avaliação' },
                  media:        { bg: 'rgba(14,165,233,0.10)',   color: '#0ea5e9',  label: 'Média Calculada' },
                  recuperacao:  { bg: 'rgba(245,158,11,0.10)',   color: '#d97706',  label: 'Recuperação' },
                  frequencia:   { bg: 'rgba(239,68,68,0.10)',    color: '#ef4444',  label: 'Frequência' },
                  conceitual:   { bg: 'rgba(139,92,246,0.10)',   color: '#7c3aed',  label: 'Conceitual' },
                  especial:     { bg: 'rgba(99,102,241,0.10)',   color: '#6366f1',  label: 'Especial' },
                  online:       { bg: 'rgba(2,132,199,0.10)',    color: '#0284c7',  label: 'Online' },
                }
                const catCor = CATEGORIA_CORES[meta.categoria] ?? { bg: '#f1f5f9', color: '#64748b', label: meta.categoria }
                return (
                  <div style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: meta.corFundo,
                    border: `1px solid ${meta.cor}30`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{meta.icone}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: meta.cor }}>{meta.tipo}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Boletim: <strong>{meta.boletimLabel}</strong> · Máx: <strong>{meta.maxValor}</strong> · Mín. aprovação: <strong>{meta.minAprovacao}</strong></div>
                      </div>
                      <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: catCor.bg, color: catCor.color }}>
                        {catCor.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55, marginBottom: 8 }}>
                      {meta.funcao}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {meta.entraNoCalculo && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#059669', fontSize: 11, fontWeight: 700 }}>
                          <Zap size={10} /> Entra no cálculo
                        </span>
                      )}
                      {meta.substituiNota && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontSize: 11, fontWeight: 700 }}>
                          <RefreshCw size={10} /> Substitui nota anterior
                        </span>
                      )}
                      {!isTipoLancavelManualmente(formDetalhe.tipoDado) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 11, fontWeight: 700 }}>
                          <BarChart2 size={10} /> Calculado automaticamente
                        </span>
                      )}
                      {meta.somaFaltas && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                          <AlertTriangle size={10} /> Soma frequência
                        </span>
                      )}
                      {meta.exigeNota && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#b91c1c', fontSize: 11, fontWeight: 700 }}>
                          <Info size={10} /> Exige notas anteriores
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Row 3: Peso + Valor Min + Valor Max */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Peso</label>
                  <input type="number" className="form-input" style={{ height: 44, fontWeight: 800, textAlign: 'center' }}
                    value={formDetalhe.peso} min={1} max={10} step={1}
                    onChange={e => setFormDetalhe(p => ({ ...p, peso: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="form-label">Valor Mín.</label>
                  <input type="number" className="form-input" style={{ height: 44, fontWeight: 800, textAlign: 'center' }}
                    value={formDetalhe.valorMin} step={0.5}
                    onChange={e => setFormDetalhe(p => ({ ...p, valorMin: Number(e.target.value) }))} />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>-1 = sem mínimo definido</div>
                </div>
                <div>
                  <label className="form-label">Valor Máx.</label>
                  <input type="number" className="form-input" style={{ height: 44, fontWeight: 800, textAlign: 'center' }}
                    value={formDetalhe.valorMax} step={0.5} min={0}
                    onChange={e => setFormDetalhe(p => ({ ...p, valorMax: Number(e.target.value) }))} />
                </div>
              </div>

              {/* Row 4: Checkboxes Boletim */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {([
                  { key: 'exibeBoletimAdm', label: 'Exibe Boletim ADM', desc: 'Visível para administradores e secretaria' },
                  { key: 'exibeBoletimAluno', label: 'Exibe Boletim Aluno', desc: 'Visível para alunos e responsáveis' },
                ] as const).map(cb => (
                  <div key={cb.key} style={{
                    padding: '16px', borderRadius: 12, border: `2px solid ${formDetalhe[cb.key] ? COR.primary : '#e2e8f0'}`,
                    background: formDetalhe[cb.key] ? `${COR.primary}06` : '#fafafa',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }} onClick={() => setFormDetalhe(p => ({ ...p, [cb.key]: !p[cb.key] }))}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                        background: formDetalhe[cb.key] ? COR.primary : '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s'
                      }}>
                        {formDetalhe[cb.key] && <Check size={14} color="#fff" strokeWidth={3} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: formDetalhe[cb.key] ? COR.primary : '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {formDetalhe[cb.key] ? <Eye size={13} /> : <EyeOff size={13} />}
                          {cb.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{cb.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 26px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fafafa' }}>
              <button onClick={() => setShowModalDetalhe(false)} className="btn btn-ghost" style={{ height: 42, fontWeight: 700 }}>
                <X size={15} /> Fechar
              </button>
              <button onClick={salvarDetalhe} className="btn btn-primary" style={{ height: 42, fontWeight: 800, gap: 8 }}
                disabled={!formDetalhe.nomeAvaliacao.trim()}>
                <Check size={15} /> Gravar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
