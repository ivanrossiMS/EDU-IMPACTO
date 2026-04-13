'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import { useState, useMemo } from 'react'
import { useData, NotaFiscal, UnidadeFiscal } from '@/lib/dataContext'
import { FileText, Plus, Send, CheckCircle, Clock, XCircle, Download, Settings, Search, AlertCircle, X, Filter, Tag, Check, Pencil, Trash2, ShieldCheck } from 'lucide-react'

// Random ID generator local fallback if newId not exported
const generateId = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_CONFIG: Record<string, { label: string, color: string, badge: string, icon: any }> = {
  emitida:     { label: 'Emitida',      color: '#10b981', badge: 'badge-success', icon: CheckCircle },
  pendente:    { label: 'Pendente',     color: '#f59e0b', badge: 'badge-warning', icon: Clock },
  processando: { label: 'Processando',  color: '#3b82f6', badge: 'badge-info',    icon: Clock },
  cancelada:   { label: 'Cancelada',    color: '#6b7280', badge: 'badge-neutral', icon: XCircle },
  erro:        { label: 'Erro',         color: '#ef4444', badge: 'badge-danger',  icon: AlertCircle },
}

export default function NFePage() {
  const { cfgEventos, unidadesFiscais = [], setUnidadesFiscais, notasFiscais = [], setNotasFiscais } = useData();
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [tab, setTab] = useState<'emissao' | 'historico' | 'config'>('emissao')

  // ── Filtros da aba Emissão ──────────────────────────────────────────
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [searchAluno, setSearchAluno] = useState('')
  const [filtroEventoId, setFiltroEventoId] = useState('')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  // ── Seleção e Emissão ───────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showModalUnidade, setShowModalUnidade] = useState(false)
  const [unidadeSelecionadaEmissao, setUnidadeSelecionadaEmissao] = useState<string>('')
  
  // ── Aba Histórico ───────────────────────────────────────────────────
  const [searchHist, setSearchHist] = useState('')

  // ── Aba Configuração (Unidades) ─────────────────────────────────────
  const [cfgEditItem, setCfgEditItem] = useState<UnidadeFiscal | null>(null)
  const [showCfgForm, setShowCfgForm] = useState(false)
  const [testeSucesso, setTesteSucesso] = useState<string | null>(null)
  const [testeModal, setTesteModal] = useState<{ id: string, logs: string[], status: 'testing'|'success'|'error' } | null>(null)

  // Eventos de receita disponíveis para filtro
  const eventosReceita = useMemo(() =>
    (cfgEventos || []).filter(e => e.situacao === 'ativo' && e.tipo === 'receita')
  , [cfgEventos])

  // Helper: normaliza qualquer formato de data para "YYYY-MM" para comparação de competência
  // Suporta: "2026-05-05" (ISO) e "05/05/2026" (BR) e "2026-05" (month input)
  const toYearMonth = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      // Formato BR: DD/MM/YYYY → YYYY-MM
      const [, mm, yyyy] = dateStr.split('/')
      return `${yyyy}-${mm}`
    }
    // Formato ISO ou parcial: retorna os 7 primeiros chars (YYYY-MM)
    return dateStr.slice(0, 7)
  }

  // ── FONTE UNIFICADA ─────────────────────────────────────────────────────────
  // O ERP tem duas fontes de pagamentos:
  //   1. titulos (array global, de financeiro/receber)
  //   2. aluno.parcelas (embutido no objeto aluno, de nova-matricula / ficha financeira)
  // A NF-e precisa agregar as duas fontes.
  const fonteUnificada = useMemo(() => {
    const registrosTitulos = (titulos || []).map(t => ({
      id: t.id,
      aluno: t.aluno || '',
      responsavel: t.responsavel || '',
      descricao: t.descricao || '',
      valor: t.valor,
      vencimento: t.vencimento || '',
      pagamento: t.pagamento || '',
      status: t.status,
      metodo: t.metodo || '',
      nfEmitida: t.nfEmitida || false,
      nfId: t.nfId,
      _origem: 'titulo' as const,
    }))

    // Extrair parcelas pagas de todos os alunos
    const registrosParcelas: Array<{
      id: string; aluno: string; responsavel: string; descricao: string
      valor: number; vencimento: string; pagamento: string; status: 'pago' | 'pendente' | 'atrasado'
      metodo: string; nfEmitida: boolean; nfId: string | undefined; _origem: string
    }> = []
    for (const a of (alunos || [])) {
      const parcelas: any[] = (a as any).parcelas || []
      for (const p of parcelas) {
        if (p.status !== 'pago') continue
        // ID único para esta parcela
        const pid = `PARC-${a.id}-${p.num || p.competencia}`
        registrosParcelas.push({
          id: pid,
          aluno: a.nome,
          responsavel: (() => {
            // Tenta responsável financeiro primeiro (estrutura nova-matricula)
            const resps: any[] = (a as any).responsaveis || []
            const respFin = resps.find((r: any) => r.respFinanceiro)
            return respFin?.nome || a.responsavel || (a as any).responsavelFinanceiro || ''
          })(),
          descricao: p.evento || p.obs || 'Mensalidade',
          valor: p.valorFinal ?? p.valor ?? 0,
          vencimento: p.vencimento || '',
          pagamento: p.dtPagto || '',
          status: 'pago' as const,
          metodo: p.formaPagto || '',
          nfEmitida: p.nfEmitida || false,
          nfId: p.nfId,
          _origem: 'parcela',
        })
      }
    }

    // Remove duplicatas: se o mesmo título já existe em titulos, não duplicar da parcela
    const titulosIds = new Set(registrosTitulos.map(t => t.id))
    const parcUnicas = registrosParcelas.filter(p => !titulosIds.has(p.id))

    return [...registrosTitulos, ...parcUnicas]
  }, [titulos, alunos])

  // Títulos elegíveis para emissão (pagos e sem NF emitida)
  const elegiveisFiltrados = useMemo(() => {
    return fonteUnificada.filter(t => {
      if (t.status !== 'pago') return false
      if (t.nfEmitida) return false // Oculta já emitidos

      // Filtra por competência (mês de vencimento), suportando formatos ISO e BR
      if (competencia) {
        const tMesRef = toYearMonth(t.vencimento) || toYearMonth(t.pagamento)
        if (tMesRef !== competencia) return false
      }

      if (searchAluno) {
        const normalize = (s: string) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : ''
        const query = normalize(searchAluno)
        const objAluno = (alunos || []).find(a => a.id === t.aluno || a.nome === t.aluno)
        const nomeRealAluno = normalize(objAluno ? objAluno.nome : t.aluno)
        const nomeRealResp = normalize(t.responsavel || (objAluno?.responsavel || ''))

        const matchAluno = nomeRealAluno.includes(query)
        const matchResp = nomeRealResp.includes(query)
        if (!matchAluno && !matchResp) return false
      }
      if (filtroEventoId) {
        const evento = (cfgEventos || []).find(e => e.id === filtroEventoId)
        if (evento && !t.descricao?.toLowerCase().includes(evento.descricao.toLowerCase())) return false
      }
      if (filtroDataDe && t.pagamento && t.pagamento < filtroDataDe) return false
      if (filtroDataAte && t.pagamento && t.pagamento > filtroDataAte) return false
      return true
    })
  }, [fonteUnificada, competencia, searchAluno, filtroEventoId, filtroDataDe, filtroDataAte, cfgEventos, alunos])

  const totalFiltrado = elegiveisFiltrados.reduce((s, t) => s + t.valor, 0)
  const hasFilter = !!(searchAluno || filtroEventoId || filtroDataDe || filtroDataAte)
  const clearFiltros = () => { setSearchAluno(''); setFiltroEventoId(''); setFiltroDataDe(''); setFiltroDataAte('') }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === elegiveisFiltrados.length && elegiveisFiltrados.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(elegiveisFiltrados.map(t => t.id)))
    }
  }

  const handleAbrirModalEmissao = () => {
    const uFiscais = unidadesFiscais || []
    if (uFiscais.length === 0) {
      alert('Por favor, cadastre uma Unidade Fiscal na aba "Configuração Fiscal" primeiro.')
      return
    }
    if (uFiscais.length === 1) {
      setUnidadeSelecionadaEmissao(uFiscais[0].id)
    } else {
      setUnidadeSelecionadaEmissao('')
    }
    setShowModalUnidade(true)
  }

  const [emitindo, setEmitindo] = useState(false)
  const [emissaoLogs, setEmissaoLogs] = useState<string[]>([])

  const handleEmitir = async () => {
    if (!unidadeSelecionadaEmissao) return
    const hoje = new Date().toISOString().slice(0, 10)
    const unidade = (unidadesFiscais || []).find(u => u.id === unidadeSelecionadaEmissao)
    if (!unidade) return

    setEmitindo(true)
    setEmissaoLogs([])

    const titSelecionados = Array.from(selectedIds)
      .map(id => fonteUnificada.find(x => x.id === id))
      .filter(Boolean) as typeof fonteUnificada

    if (titSelecionados.length === 0) {
      alert('Nenhum lançamento válido encontrado.')
      setEmitindo(false)
      return
    }

    let sucessos = 0
    let erros = 0
    const notasParaSalvar: NotaFiscal[] = []

    for (const t of titSelecionados) {
      const alunoObj = (alunos || []).find(a => a.nome === t.aluno)
      const resps: any[] = (alunoObj as any)?.responsaveis || []
      const rf = resps.find((r: any) => r.respFinanceiro)
      const responsavel = rf?.nome || alunoObj?.responsavel || t.responsavel || t.aluno
      const tomadorCpfCnpj = rf?.cpf || (alunoObj as any)?.cpfResponsavel || undefined
      const competRef = competencia || toYearMonth(t.vencimento) || toYearMonth(t.pagamento) || hoje.slice(0, 7)

      const nfId = generateId('NF')
      // Salva imediatamente como "processando"
      const nfPendente: NotaFiscal = {
        id: nfId,
        unidadeId: unidade.id,
        numero: '---',
        aluno: t.aluno,
        responsavel,
        tomadorCpfCnpj,
        valor: t.valor,
        competencia: competRef,
        dataEmissao: hoje,
        status: 'processando',
        tituloId: t.id,
        rpsNumero: String(unidade.proximoRps || 1),
        rpsSerie: unidade.serieRps || 'A',
      }

      try {
        setEmissaoLogs(p => [...p, `[${t.aluno}] Enviando para provedor ${unidade.provedor || 'mock'}...`])

        const res = await fetch('/api/financeiro/nfe/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unidade,
            nota: {
              aluno: t.aluno,
              responsavel,
              tomadorCpfCnpj,
              valor: t.valor,
              competencia: competRef,
              descricao: `Servicos educacionais - ${t.aluno} - ${t.descricao || competRef}`,
              rpsNumero: unidade.proximoRps || 1,
              rpsSerie: unidade.serieRps || 'A',
            },
          }),
        })

        const data = await res.json()
        data.logs?.forEach((l: string) => setEmissaoLogs(p => [...p, l]))

        if (data.success) {
          sucessos++
          notasParaSalvar.push({
            ...nfPendente,
            numero: data.numero || nfPendente.numero,
            status: data.status || 'emitida',
            chaveNFSe: data.chaveNFSe,
            protocolo: data.protocolo,
            provedorId: data.provedorId,
            linkVisualizacao: data.linkVisualizacao,
            linkDownloadPdf: data.linkDownloadPdf,
            xmlRps: data.xmlRps,
            xmlRetorno: data.xmlRetorno,
          })
          // Incrementar próximo RPS na unidade
          setUnidadesFiscais(prev => prev.map(u =>
            u.id === unidade.id ? { ...u, proximoRps: (u.proximoRps || 1) + 1 } : u
          ))
        } else {
          erros++
          notasParaSalvar.push({
            ...nfPendente,
            status: 'erro',
            erroDescricao: data.erroDescricao,
            erroCorrecao: data.erroCorrecao,
          })
          setEmissaoLogs(p => [...p, `[ERRO ${t.aluno}] ${data.erroDescricao}`])
        }
      } catch (err: any) {
        erros++
        notasParaSalvar.push({ ...nfPendente, status: 'erro', erroDescricao: `Falha de rede: ${err.message}` })
        setEmissaoLogs(p => [...p, `[ERRO REDE] ${err.message}`])
      }
    }

    // Salva todas as notas no histórico
    setNotasFiscais(prev => [...notasParaSalvar, ...prev])

    // Marca títulos como emitidos
    const idsEmitidos = new Set(notasParaSalvar.filter(n => n.status === 'emitida' || n.status === 'processando').map(n => n.tituloId))
    setTitulos(prev => prev.map(t => {
      if (idsEmitidos.has(t.id)) {
        const nfId = notasParaSalvar.find(n => n.tituloId === t.id)?.id
        return { ...t, nfEmitida: true, nfId }
      }
      return t
    }))

    // Marca parcelas de alunos
    const parcelaIds = notasParaSalvar
      .filter(n => n.status !== 'erro')
      .map(n => n.tituloId)
      .filter((id): id is string => typeof id === 'string' && id.startsWith('PARC-'))
    if (parcelaIds.length > 0) {
      setAlunos((prev: any[]) => prev.map((a: any) => {
        const updated = (a.parcelas || []).map((p: any) => {
          const pid = `PARC-${a.id}-${p.num || p.competencia}`
          if (parcelaIds.includes(pid)) {
            const nfId = notasParaSalvar.find(n => n.tituloId === pid)?.id || ''
            return { ...p, nfEmitida: true, nfId }
          }
          return p
        })
        return { ...a, parcelas: updated }
      }))
    }

    setEmitindo(false)
    setSelectedIds(new Set())
    setShowModalUnidade(false)
    setTab('historico')

    if (erros === 0) {
      alert(`✅ ${sucessos} nota(s) emitida(s) com sucesso!`)
    } else {
      alert(`⚠️ ${sucessos} emitida(s) com sucesso | ${erros} com erro. Verifique o Histórico de NFs.`)
    }
  }

  const handleConsultarStatus = async (nf: NotaFiscal) => {
    const unidade = (unidadesFiscais || []).find(u => u.id === nf.unidadeId)
    if (!unidade) return

    try {
      const res = await fetch('/api/financeiro/nfe/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidade, provedorId: nf.provedorId, numero: nf.numero }),
      })
      const data = await res.json()
      if (data.success) {
        setNotasFiscais(prev => prev.map(n => n.id === nf.id ? {
          ...n,
          status: data.status,
          numero: data.numero || n.numero,
          chaveNFSe: data.chaveNFSe || n.chaveNFSe,
          linkVisualizacao: data.linkVisualizacao || n.linkVisualizacao,
          linkDownloadPdf: data.linkDownloadPdf || n.linkDownloadPdf,
          erroDescricao: data.erroDescricao || n.erroDescricao,
        } : n))
        alert(`Status atualizado: ${data.status?.toUpperCase()}`)
      } else {
        alert(`Erro ao consultar: ${data.error}`)
      }
    } catch (err: any) {
      alert(`Falha de rede: ${err.message}`)
    }
  }

  const handleCancelarNF = async (nf: NotaFiscal) => {
    if (!confirm(`Confirma o CANCELAMENTO da NFS-e Nº ${nf.numero} de ${nf.aluno}?`)) return
    const unidade = (unidadesFiscais || []).find(u => u.id === nf.unidadeId)
    if (!unidade) return

    try {
      const res = await fetch('/api/financeiro/nfe/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidade, provedorId: nf.provedorId, numero: nf.numero, chaveNFSe: nf.chaveNFSe }),
      })
      const data = await res.json()
      if (data.success) {
        setNotasFiscais(prev => prev.map(n => n.id === nf.id ? { ...n, status: 'cancelada' } : n))
        alert('NFS-e cancelada com sucesso.')
      } else {
        alert(`Erro ao cancelar: ${data.error}`)
      }
    } catch (err: any) {
      alert(`Falha de rede: ${err.message}`)
    }
  }


  const historicoFiltrado = useMemo(() => {
    return (notasFiscais || []).filter(n => {
      if (searchHist) {
        const normalize = (s: string) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : ''
        const q = normalize(searchHist)
        const objAluno = (alunos || []).find(a => a.id === n.aluno || a.nome === n.aluno)
        const nomeReal = normalize(objAluno ? objAluno.nome : n.aluno)
        const respReal = normalize(n.responsavel || (objAluno?.responsavel || ''))
        return nomeReal.includes(q) || respReal.includes(q) || n.numero.includes(q)
      }
      return true
    }).sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao))
  }, [notasFiscais, searchHist, alunos])

  const saveCfg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cfgEditItem) return
    if (cfgEditItem.id) {
      setUnidadesFiscais(prev => prev.map(u => u.id === cfgEditItem.id ? cfgEditItem : u))
    } else {
      setUnidadesFiscais(prev => [...prev, { ...cfgEditItem, id: generateId('UF'), createdAt: new Date().toISOString() }])
    }
    setShowCfgForm(false)
  }

  const testarIntegracao = async (unidade: UnidadeFiscal) => {
    setTesteSucesso(null)
    setTesteModal({ id: unidade.id, logs: ['[Iniciando] Preparando transmissão de teste...'], status: 'testing' })
    
    try {
      const res = await fetch('/api/financeiro/nfe/teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unidade)
      })
      const data = await res.json()

      // Adiciona um pequeno delay intencional na UI para o usuário conseguir ler "Preparando transmissão"
      setTimeout(() => {
        setTesteModal(p => p && ({
          ...p,
          logs: [...p.logs, ...data.logs, ...(data.errors ? data.errors.map((e:string) => `[FALHA] ${e}`) : [])],
          status: data.success ? 'success' : 'error'
        }))
        
        if (data.success) {
          setTesteSucesso(unidade.id)
          setTimeout(() => setTesteSucesso(null), 3000)
        }
      }, 500)

    } catch (err: any) {
      setTesteModal(p => p && ({
        ...p,
        logs: [...p.logs, `[Erro Fatal] Falha de comunicação de rede: ${err.message}`],
        status: 'error'
      }))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Emissão de Nota Fiscal (NFS-e)</h1>
          <p className="page-subtitle">Emissão eletrônica de notas fiscais de serviço educacional via prefeitura</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setTab('config')}><Settings size={13} />Configurar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setTab('emissao')}><Send size={13} />Emitir NFS-e</button>
        </div>
      </div>

      {/* KPIs Gerais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Notas Emitidas ou Pendentes', value: (notasFiscais || []).length, color: '#10b981', icon: '📝' },
          { label: 'Lançamentos Elegíveis', value: elegiveisFiltrados.length, color: '#f59e0b', icon: '⏳' },
          { label: 'Unidades Fiscais (CNPJs)', value: (unidadesFiscais || []).length, color: '#3b82f6', icon: '🏢' },
          { label: 'Faturamento NF', value: fmt((notasFiscais || []).reduce((s,n) => s + (n.status!=='cancelada' ? n.valor : 0), 0)), color: '#8b5cf6', icon: '💎' },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-list" style={{ marginBottom: 20 }}>
        {[
          { id: 'emissao',  label: 'Emissão por Competência' },
          { id: 'historico', label: 'Histórico de NFs' },
          { id: 'config',   label: 'Configuração Fiscal / Matrizes' },
        ].map(t => (
          <button key={t.id} className={`tab-trigger ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id as typeof tab)}>{t.label}</button>
        ))}
      </div>

      {/* ── Aba Emissão ── */}
      {tab === 'emissao' && (
        <div>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <label className="form-label">Competência</label>
                <input type="month" className="form-input" value={competencia} onChange={e => setCompetencia(e.target.value)} style={{ width: 160 }} />
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label">Aluno / Responsável</label>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Buscar..." value={searchAluno} onChange={e => setSearchAluno(e.target.value)} />
                  {searchAluno && <button type="button" onClick={() => setSearchAluno('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><X size={12} /></button>}
                </div>
              </div>

              <div style={{ flex: '0 0 auto', minWidth: 200 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={10} />Evento (Origem)</label>
                <select className="form-input" value={filtroEventoId} onChange={e => setFiltroEventoId(e.target.value)}>
                  <option value="">Todos</option>
                  {eventosReceita.map(e => <option key={e.id} value={e.id}>{e.descricao}</option>)}
                </select>
              </div>

              <button className={`btn btn-sm ${showFiltros ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFiltros(p => !p)} style={{ alignSelf: 'flex-end' }}>
                <Filter size={12} />Datas Pagamento
              </button>

              <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={selectedIds.size === 0 || emitindo}
                  onClick={handleAbrirModalEmissao}
                  style={{ minWidth: 120 }}
                >
                  {emitindo
                    ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6 }} />Emitindo...</>
                    : <><Send size={13} />Emitir ({selectedIds.size})</>}
                </button>
              </div>
            </div>

            {showFiltros && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
                <div><label className="form-label">Data de Pagamento (de)</label><input type="date" className="form-input" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)} /></div>
                <div><label className="form-label">Data de Pagamento (até)</label><input type="date" className="form-input" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)} /></div>
                {(filtroDataDe || filtroDataAte) && <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroDataDe(''); setFiltroDataAte('') }}><X size={12} />Limpar datas</button>}
              </div>
            )}

            {(hasFilter || elegiveisFiltrados.length > 0) && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <span style={{ color: 'hsl(var(--text-muted))' }}>
                  <strong style={{ color: 'hsl(var(--text-primary))' }}>{elegiveisFiltrados.length}</strong> aptos para nota •{' '}
                  <strong style={{ color: '#10b981' }}>{fmt(totalFiltrado)}</strong>
                </span>
                {hasFilter && <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={clearFiltros}><X size={10} />Limpar filtros</button>}
              </div>
            )}
          </div>

          {elegiveisFiltrados.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <FileText size={40} style={{ opacity: 0.1, marginBottom: 12 }} /><br />
              <div style={{ fontWeight: 700 }}>{hasFilter ? 'Nenhum recebimento pago satisfaz estes filtros' : 'Nenhuma parcela pendente de NF nesta competência'}</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr>
                  <th><input type="checkbox" style={{ accentColor: '#3b82f6' }} checked={elegiveisFiltrados.length > 0 && selectedIds.size === elegiveisFiltrados.length} onChange={toggleSelectAll} /></th>
                  <th>Tomador (Responsável)</th><th>Aluno</th><th>Evento / Descrição</th><th>Data Pago</th><th>Competência</th><th>Valor Base</th><th>ISS (Simul.)</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {elegiveisFiltrados.map(t => {
                    const aluno = (alunos || []).find(a => a.nome === t.aluno)
                    return (
                      <tr key={t.id} onClick={(e) => {
                        if (e.target instanceof HTMLInputElement) return
                        toggleSelect(t.id)
                      }} style={{ cursor: 'pointer', background: selectedIds.has(t.id) ? 'rgba(59,130,246,0.05)' : undefined }}>
                        <td onClick={e => e.stopPropagation()}><input type="checkbox" style={{ accentColor: '#3b82f6' }} checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{aluno?.responsavel || t.responsavel || t.aluno}</td>
                        <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{t.aluno}</td>
                        <td style={{ fontSize: 12, maxWidth: 180 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao || '—'}</div></td>
                        <td style={{ fontSize: 12 }}>{t.pagamento ? new Date(t.pagamento + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td style={{ fontSize: 12 }}>{competencia || (t.pagamento ? t.pagamento.slice(0,7) : '—')}</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>{fmt(t.valor)}</td>
                        <td style={{ fontSize: 12, color: '#8b5cf6' }}>{fmt(t.valor * 0.05)}</td>
                        <td><span className="badge badge-neutral" style={{ fontSize: 9 }}>NF Ausente</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Histórico ── */}
      {tab === 'historico' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar Nº, Responsável ou Aluno..." value={searchHist} onChange={e => setSearchHist(e.target.value)} />
            </div>
          </div>
          
          {historicoFiltrado.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <FileText size={40} style={{ opacity: 0.1, marginBottom: 12 }} /><br />
              <div style={{ fontWeight: 700 }}>Nenhuma NF encontrada</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>NF</th><th>Data</th><th>Unidade Emissora</th><th>Tomador</th><th>Aluno</th><th>Valor</th><th>Status</th><th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoFiltrado.map(n => {
                    const unidade = (unidadesFiscais || []).find(u => u.id === n.unidadeId)
                    const sc = STATUS_CONFIG[n.status] || STATUS_CONFIG.erro
                    const SIcon = sc.icon
                    return (
                      <tr key={n.id}>
                        <td><div style={{ fontWeight: 800, fontFamily: 'monospace' }}>#{n.numero}</div><div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>ID: {n.id}</div></td>
                        <td style={{ fontSize: 12 }}>{new Date(n.dataEmissao + 'T12:00').toLocaleDateString('pt-BR')}</td>
                        <td>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{unidade?.nome || 'Unidade Deletada'}</div>
                          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>CNPJ: {unidade?.cnpj || 'N/D'}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{n.responsavel}</td>
                        <td style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{n.aluno}</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>{fmt(n.valor)}</td>
                        <td>
                          <span className={`badge ${sc.badge}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 10 }}>
                            <SIcon size={10} />{sc.label}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Visualizar / Imprimir NF"
                            onClick={() => {
                              const aliquota = (unidade as any)?.aliquota || 5
                              const valorISS = +(n.valor * aliquota / 100).toFixed(2)
                              const valorLiq = +(n.valor - valorISS).toFixed(2)
                              const codVerif = n.chaveNFSe || `${n.numero}${n.id.slice(-6)}`.toUpperCase()
                              const dataComp = n.competencia
                                ? (() => { const [y,m] = n.competencia.split('-'); return `${m}/${y}` })()
                                : '—'
                              const dataPrint = new Date(n.dataEmissao + 'T12:00').toLocaleDateString('pt-BR')
                              const fmtVal = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

                              const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NFS-e Nº ${n.numero}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; margin: 0; padding: 0; }
  .page { max-width: 820px; margin: 0 auto; padding: 20px; }
  /* ── Print Bar ── */
  .print-bar { display: flex; gap: 10px; justify-content: center; padding: 10px; background: #1e3a8a; margin-bottom: 16px; border-radius: 4px; }
  .print-bar button { padding: 8px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 700; }
  .btn-print  { background: #fff; color: #1e3a8a; }
  .btn-close  { background: #dc2626; color: #fff; }
  @media print { .print-bar { display: none !important; } .page { padding: 4px; } }
  /* ── Header Prefeitura ── */
  .gov-header { background: #1e3a8a; color: #fff; padding: 10px 16px; display: flex; align-items: center; gap: 14px; border-radius: 4px 4px 0 0; }
  .gov-brasao { width: 52px; height: 52px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; flex-shrink: 0; }
  .gov-title  { flex: 1; }
  .gov-title h1 { font-size: 14px; font-weight: 700; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .gov-title p  { font-size: 11px; margin: 0; opacity: 0.85; }
  .nfse-badge { background: #f59e0b; color: #000; font-weight: 900; font-size: 13px; padding: 4px 14px; border-radius: 4px; white-space: nowrap; }
  /* ── NFS-e Title bar ── */
  .nfse-titlebar { background: #dbeafe; border: 1px solid #93c5fd; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; }
  .nfse-num { font-size: 18px; font-weight: 900; color: #1e3a8a; }
  .nfse-meta { font-size: 11px; color: #374151; text-align: right; }
  .status-pill { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
    background: ${n.status === 'emitida' ? '#d1fae5' : n.status === 'cancelada' ? '#fee2e2' : '#fef3c7'};
    color: ${n.status === 'emitida' ? '#065f46' : n.status === 'cancelada' ? '#991b1b' : '#92400e'};
    border: 1px solid ${n.status === 'emitida' ? '#6ee7b7' : n.status === 'cancelada' ? '#fca5a5' : '#fcd34d'};
  }
  /* ── Sections ── */
  .section { border: 1px solid #d1d5db; margin-top: -1px; }
  .section-header { background: #1e3a8a; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 5px 10px; }
  .section-body { padding: 8px 10px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; }
  .field { padding: 5px 8px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
  .field:last-child, .field.no-right { border-right: none; }
  .field-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 3px; }
  .field-value { font-size: 11px; font-weight: 600; color: #111; }
  .field-value.big { font-size: 14px; font-weight: 800; color: #1e3a8a; }
  /* ── Discriminação ── */
  .disc-box { padding: 10px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 11px; min-height: 60px; line-height: 1.6; }
  /* ── Valores ── */
  .valores-table { width: 100%; border-collapse: collapse; }
  .valores-table td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  .valores-table td:last-child { text-align: right; font-weight: 700; }
  .valores-table tr.total td { background: #1e3a8a; color: #fff; font-size: 13px; font-weight: 800; }
  .valores-table tr.total td:last-child { color: #fbbf24; }
  /* ── Autenticação ── */
  .auth-box { background: #f0fdf4; border: 1px solid #86efac; padding: 10px 14px; display: flex; align-items: center; gap: 14px; }
  .auth-code { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 900; color: #166534; letter-spacing: 2px; }
  .qr-placeholder { width: 72px; height: 72px; border: 2px solid #86efac; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #6b7280; text-align: center; flex-shrink: 0; background: #fff; }
  /* ── Footer ── */
  .doc-footer { margin-top: 14px; text-align: center; font-size: 9px; color: #9ca3af; line-height: 1.8; border-top: 2px solid #1e3a8a; padding-top: 8px; }
</style>
</head>
<body>
<div class="page">
  <!-- Print bar -->
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>
    <button class="btn-close" onclick="window.close()">✕ Fechar</button>
  </div>

  <!-- Header Gov -->
  <div class="gov-header">
    <div class="gov-brasao">🏛️</div>
    <div class="gov-title">
      <h1>NOTA FISCAL DE SERVIÇOS ELETRÔNICA – NFS-e</h1>
      <p>Sistema Municipal de Nota Fiscal Eletrônica &nbsp;|&nbsp; Padrão ABRASF v2.01</p>
    </div>
    <div class="nfse-badge">NFS-e</div>
  </div>

  <!-- NFS-e Number Bar -->
  <div class="nfse-titlebar">
    <div>
      <div class="nfse-num">Nº ${n.numero}</div>
      <span class="status-pill">${n.status === 'emitida' ? '✓ Emitida' : n.status === 'pendente' ? '⏳ Aguardando Emissão' : n.status === 'cancelada' ? '✕ Cancelada' : n.status}</span>
    </div>
    <div class="nfse-meta">
      <div><strong>Data de Emissão:</strong> ${dataPrint}</div>
      <div><strong>Competência:</strong> ${dataComp}</div>
      <div><strong>Tipo:</strong> Normal</div>
    </div>
  </div>

  <!-- PRESTADOR DE SERVIÇOS -->
  <div class="section">
    <div class="section-header">📋 Prestador de Serviços</div>
    <div class="grid2">
      <div class="field"><div class="field-label">Razão Social / Nome</div><div class="field-value big">${unidade?.nome || '—'}</div></div>
      <div class="field no-right"><div class="field-label">CNPJ</div><div class="field-value big">${unidade?.cnpj || '—'}</div></div>
    </div>
    <div class="grid3">
      <div class="field"><div class="field-label">Inscrição Municipal</div><div class="field-value">${(unidade as any)?.inscricaoMunicipal || '—'}</div></div>
      <div class="field"><div class="field-label">CNAE Principal</div><div class="field-value">${(unidade as any)?.cnae || '8520-1/00'}</div></div>
      <div class="field no-right"><div class="field-label">Regime Tributário</div><div class="field-value">${(unidade as any)?.tributacao || 'Simples Nacional'}</div></div>
    </div>
    <div class="field" style="border-right:none"><div class="field-label">Endereço</div><div class="field-value">${(unidade as any)?.endereco || '—'}</div></div>
  </div>

  <!-- TOMADOR DE SERVIÇOS -->
  <div class="section">
    <div class="section-header">👤 Tomador de Serviços</div>
    <div class="grid2">
      <div class="field"><div class="field-label">Nome / Razão Social</div><div class="field-value big">${n.responsavel}</div></div>
      <div class="field no-right"><div class="field-label">Aluno / Beneficiário</div><div class="field-value">${n.aluno}</div></div>
    </div>
    <div class="grid2">
      <div class="field"><div class="field-label">CPF / CNPJ</div><div class="field-value">NÃO INFORMADO</div></div>
      <div class="field no-right"><div class="field-label">Inscrição Municipal</div><div class="field-value">ISENTO</div></div>
    </div>
  </div>

  <!-- DISCRIMINAÇÃO DOS SERVIÇOS -->
  <div class="section">
    <div class="section-header">📝 Discriminação dos Serviços</div>
    <div class="section-body">
      <div class="disc-box">
        PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS — ${n.aluno}<br>
        COMPETÊNCIA: ${dataComp}<br>
        REF.: MENSALIDADE / ANUIDADE ESCOLAR<br>
        COD. TRIBUTAÇÃO: 8.02 — INSTRUÇÃO<br>
        CONFORME CONTRATO DE PRESTAÇÃO DE SERVIÇOS
      </div>
    </div>
  </div>

  <!-- VALORES -->
  <div class="section">
    <div class="section-header">💰 Valores e Tributos</div>
    <div class="section-body" style="padding:0">
      <table class="valores-table">
        <tr><td>Valor dos Serviços</td><td>${fmtVal(n.valor)}</td></tr>
        <tr><td>Deduções / Descontos</td><td>R$ 0,00</td></tr>
        <tr><td>Base de Cálculo do ISS</td><td>${fmtVal(n.valor)}</td></tr>
        <tr><td>Alíquota ISS</td><td>${aliquota.toFixed(2)}%</td></tr>
        <tr><td>Valor do ISS</td><td>${fmtVal(valorISS)}</td></tr>
        <tr><td>ISS Retido na Fonte</td><td>NÃO</td></tr>
        <tr><td>Outras Retenções</td><td>R$ 0,00</td></tr>
        <tr class="total"><td>VALOR LÍQUIDO DA NOTA</td><td>${fmtVal(valorLiq)}</td></tr>
      </table>
    </div>
  </div>

  <!-- AUTENTICAÇÃO -->
  <div class="section">
    <div class="section-header">🔐 Código de Autenticação e Verificação</div>
    <div class="auth-box">
      <div class="qr-placeholder">QR<br>CODE<br><span style="font-size:7px">(Verificação)</span></div>
      <div>
        <div style="font-size:9px;color:#6b7280;margin-bottom:4px;">CÓDIGO DE VERIFICAÇÃO</div>
        <div class="auth-code">${codVerif}</div>
        ${n.protocolo ? `<div style="font-size:9px;color:#6b7280;margin-top:4px;"><strong>Protocolo:</strong> ${n.protocolo}</div>` : ''}
        ${n.rpsNumero ? `<div style="font-size:9px;color:#6b7280;margin-top:2px;"><strong>RPS:</strong> ${n.rpsSerie || 'A'}/${n.rpsNumero}</div>` : ''}
        <div style="font-size:9px;color:#6b7280;margin-top:6px;">Consulte a autenticidade desta NFS-e no portal da prefeitura através do código acima.</div>
        <div style="font-size:9px;color:#6b7280;margin-top:3px;"><strong>ID Registro Interno:</strong> ${n.id}</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="doc-footer">
    <strong>ATENÇÃO:</strong> Este documento é uma simulação gerada pelo sistema ERP Impacto Edu para fins de conferência interna.<br>
    A NFS-e oficial com validade fiscal deve ser obtida diretamente no portal da Prefeitura Municipal.<br>
    Emitido por: ${unidade?.nome || '—'} &nbsp;|&nbsp; CNPJ: ${unidade?.cnpj || '—'} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleString('pt-BR')}
  </div>
</div>
</body>
</html>`
                              const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
                              const localUrl = URL.createObjectURL(blob)
                              window.open(n.linkVisualizacao || localUrl, '_blank')
                            }}
                          >
                            <Download size={14} />
                          </button>
                          {/* Consultar status no provedor */}
                          {(n.status === 'processando' || n.status === 'pendente') && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title="Consultar status no provedor"
                              onClick={() => handleConsultarStatus(n)}
                              style={{ color: '#3b82f6' }}
                            >
                              <ShieldCheck size={14} />
                            </button>
                          )}
                          {/* Cancelar NF */}
                          {(n.status === 'emitida' || n.status === 'processando') && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title="Cancelar NFS-e"
                              onClick={() => handleCancelarNF(n)}
                              style={{ color: '#ef4444' }}
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                          {/* Erro */}
                          {n.status === 'erro' && n.erroDescricao && (
                            <span title={`${n.erroDescricao}${n.erroCorrecao ? ' | Correção: ' + n.erroCorrecao : ''}`} style={{ color: '#ef4444', cursor: 'help', fontSize: 13 }}>⚠️</span>
                          )}
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

      {/* ── Aba Configuração Fiscal (Multi-Unidade) ── */}
      {tab === 'config' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Unidades Fiscais Cadastradas</h2>
              <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Gerencie as diferentes matrizes/filiais que emitem notas no ERP.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setCfgEditItem({
                id: '', nome: '', cnpj: '', cnae: '', ambiente: 'homologacao', aliquota: 0,
                inscricaoMunicipal: '', municipio: '', serieNF: '', tributacao: '', situacao: 'ativo', createdAt: ''
              })
              setShowCfgForm(true)
            }}><Plus size={13} />Nova Unidade</button>
          </div>

          {!showCfgForm ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {(unidadesFiscais || []).map(u => (
                <div key={u.id} className="card" style={{ padding: '20px', borderTop: u.situacao==='ativo' ? '3px solid #3b82f6' : '3px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{u.nome}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>CNPJ: {u.cnpj}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {u.situacao === 'ativo' ? <span className="badge badge-success" style={{ fontSize: 9 }}>Ativo</span> : <span className="badge badge-neutral" style={{ fontSize: 9 }}>Inativo</span>}
                      {u.ambiente === 'producao'
                        ? <span className="badge badge-success" style={{ fontSize: 9, background: '#10b981' }}>🚀 Produção</span>
                        : <span className="badge badge-warning" style={{ fontSize: 9 }}>🛠️ Homologação</span>}
                    </div>
                  </div>

                  {/* Info do provedor */}
                  {(() => {
                    const prov = (u as any).provedor || 'mock'
                    const provedorLabel: Record<string, string> = {
                      mock: '🧪 Mock (sem fiscal)',
                      nfeio: 'NFE.io',
                      enotas: 'eNotas',
                      tecnospeed: 'Tecnospeed / PlugNotas',
                      abrasf: 'ABRASF Direto (SOAP)',
                    }
                    const temApiKey = !!(u as any).apiKey
                    const temSoap   = !!(u as any).urlWebservice
                    const temRps    = !!(u as any).proximoRps && !!(u as any).serieRps
                    const needsKey  = prov !== 'mock' && prov !== 'abrasf' && !temApiKey
                    const needsSoap = prov === 'abrasf' && !temSoap
                    return (
                      <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>Provedor:</span>
                          <strong style={{ color: prov === 'mock' ? '#f59e0b' : '#3b82f6' }}>{provedorLabel[prov] || prov}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>CNAE / Alíquota:</span>
                          <strong>{u.cnae || '—'} / {u.aliquota || 0}% ISS</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>Numeração RPS:</span>
                          <strong style={{ color: temRps ? '#10b981' : '#f59e0b' }}>
                            {temRps ? `${(u as any).serieRps}/${(u as any).proximoRps}` : '⚠️ Não configurado'}
                          </strong>
                        </div>
                        {needsKey && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', background: 'rgba(239,68,68,0.07)', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                            <AlertCircle size={10} /> API Key não configurada — emissão bloqueada
                          </div>
                        )}
                        {needsSoap && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', background: 'rgba(239,68,68,0.07)', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                            <AlertCircle size={10} /> URL Webservice SOAP não preenchida
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 14 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { if(window.confirm('Tem certeza que deseja excluir esta Unidade Fiscal? Essa ação não pode ser desfeita.')) setUnidadesFiscais(prev => prev.filter(x => x.id !== u.id)) }} title="Excluir Unidade">
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setCfgEditItem(u); setShowCfgForm(true) }}>
                      <Pencil size={12} />Editar
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1, borderColor: testeSucesso===u.id ? '#10b981' : undefined, color: testeSucesso===u.id ? '#10b981' : undefined }} onClick={() => testarIntegracao(u)}>
                      {testeSucesso === u.id ? <><Check size={12}/>Sucesso!</> : <><ShieldCheck size={12} />Testar Integração</>}
                    </button>
                  </div>
                </div>
              ))}
              {(unidadesFiscais || []).length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px dashed hsl(var(--border-subtle))' }}>
                  <AlertCircle size={32} style={{ opacity: 0.3, marginBottom: 10, display: 'inline-block' }} /><br />
                  <strong>Nenhuma unidade fiscal cadastrada</strong><br/>
                  <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Você precisa cadastrar pelo menos uma filial/matriz para emitir NF.</span>
                </div>
              )}
            </div>
          ) : (
              <div className="card" style={{ padding: '24px', maxWidth: 860 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{cfgEditItem?.id ? 'Editar Unidade Fiscal' : 'Nova Unidade Fiscal'}</div>
                  <button className="btn btn-ghost btn-icon" onClick={() => setShowCfgForm(false)}><X size={16} /></button>
                </div>

                <form onSubmit={saveCfg}>
                  {/* ── Dados do Emissor ─────────────────────────────────────────────── */}
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📋 Dados do Emissor</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Nome de Identificação Interna *</label>
                      <input className="form-input" required placeholder="Ex: Matriz São Paulo" value={cfgEditItem?.nome || ''} onChange={e => setCfgEditItem(p => p && { ...p, nome: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Situação Cadastral</label>
                      <select className="form-input" value={cfgEditItem?.situacao || 'ativo'} onChange={e => setCfgEditItem(p => p && { ...p, situacao: e.target.value as any })}>
                        <option value="ativo">✅ Ativa</option>
                        <option value="inativo">⏸️ Inativa</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">CNPJ *</label>
                      <input className="form-input" required placeholder="00.000.000/0000-00" value={cfgEditItem?.cnpj || ''} onChange={e => setCfgEditItem(p => p && { ...p, cnpj: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Inscrição Municipal</label>
                      <input className="form-input" placeholder="000000000" value={cfgEditItem?.inscricaoMunicipal || ''} onChange={e => setCfgEditItem(p => p && { ...p, inscricaoMunicipal: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">CNAE Primário</label>
                      <input className="form-input" placeholder="8513-9/00" value={cfgEditItem?.cnae || ''} onChange={e => setCfgEditItem(p => p && { ...p, cnae: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Cód. IBGE Município</label>
                      <input className="form-input" placeholder="Ex: 3550308" value={(cfgEditItem as any)?.codigoMunicipio || ''} onChange={e => setCfgEditItem(p => p && { ...p, codigoMunicipio: e.target.value } as any)} />
                    </div>
                    <div>
                      <label className="form-label">UF</label>
                      <input className="form-input" placeholder="SP" maxLength={2} value={(cfgEditItem as any)?.uf || ''} onChange={e => setCfgEditItem(p => p && { ...p, uf: e.target.value.toUpperCase() } as any)} />
                    </div>
                    <div>
                      <label className="form-label">Alíquota ISS (%)</label>
                      <input type="number" step="0.01" min="0" max="10" className="form-input" placeholder="5.00" value={cfgEditItem?.aliquota || ''} onChange={e => setCfgEditItem(p => p && { ...p, aliquota: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="form-label">Regime Tributário</label>
                      <select className="form-input" value={cfgEditItem?.tributacao || ''} onChange={e => setCfgEditItem(p => p && { ...p, tributacao: e.target.value })}>
                        <option value="">Selecione...</option>
                        <option value="Simples Nacional">Simples Nacional</option>
                        <option value="Lucro Presumido">Lucro Presumido</option>
                        <option value="Lucro Real">Lucro Real</option>
                        <option value="MEI">MEI</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Provedor NFS-e ────────────────────────────────────────────────── */}
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🔌 Integração / Provedor NFS-e</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                    <div>
                      <label className="form-label">Ambiente</label>
                      <select className="form-input" value={cfgEditItem?.ambiente || 'homologacao'} onChange={e => setCfgEditItem(p => p && { ...p, ambiente: e.target.value as any })}>
                        <option value="homologacao">🛠️ Homologação (Testes)</option>
                        <option value="producao">🚀 Produção (Fiscal Real)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Provedor de Emissão</label>
                      <select className="form-input" value={(cfgEditItem as any)?.provedor || 'mock'} onChange={e => setCfgEditItem(p => p && { ...p, provedor: e.target.value } as any)}>
                        <option value="mock">🧪 Mock / Simulação (sem integração real)</option>
                        <option value="nfeio">NFE.io (REST API - Recomendado)</option>
                        <option value="enotas">eNotas (REST API)</option>
                        <option value="tecnospeed">Tecnospeed / PlugNotas</option>
                        <option value="abrasf">ABRASF Direto (SOAP Municipal)</option>
                      </select>
                    </div>
                    {(cfgEditItem as any)?.provedor && (cfgEditItem as any).provedor !== 'mock' && (cfgEditItem as any).provedor !== 'abrasf' && (
                      <>
                        <div>
                          <label className="form-label">API Key {(cfgEditItem as any)?.provedor === 'nfeio' ? '(NFE.io)' : (cfgEditItem as any)?.provedor === 'enotas' ? '(eNotas)' : '(Tecnospeed)'} *</label>
                          <input className="form-input" type="password" placeholder="Sua API Key do provedor" value={(cfgEditItem as any)?.apiKey || ''} onChange={e => setCfgEditItem(p => p && { ...p, apiKey: e.target.value } as any)} />
                        </div>
                        {(cfgEditItem as any)?.provedor === 'tecnospeed' && (
                          <div>
                            <label className="form-label">API Secret (Tecnospeed)</label>
                            <input className="form-input" type="password" placeholder="Seu API Secret" value={(cfgEditItem as any)?.apiSecret || ''} onChange={e => setCfgEditItem(p => p && { ...p, apiSecret: e.target.value } as any)} />
                          </div>
                        )}
                        {(cfgEditItem as any)?.provedor === 'nfeio' && (
                          <div>
                            <label className="form-label">Company ID NFE.io (opcional)</label>
                            <input className="form-input" placeholder="Deixe em branco para usar o CNPJ" value={(cfgEditItem as any)?.companyId || ''} onChange={e => setCfgEditItem(p => p && { ...p, companyId: e.target.value } as any)} />
                          </div>
                        )}
                      </>
                    )}
                    {(cfgEditItem as any)?.provedor === 'abrasf' && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">URL Webservice SOAP Municipal *</label>
                        <input className="form-input" placeholder="https://nfse.prefeitura.gov.br/webservice/nfse.asmx" value={(cfgEditItem as any)?.urlWebservice || ''} onChange={e => setCfgEditItem(p => p && { ...p, urlWebservice: e.target.value } as any)} />
                        <p style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Obtenha a URL no portal da Prefeitura Municipal (seção NFS-e / Webservice).</p>
                      </div>
                    )}
                  </div>

                  {/* ── Numeração RPS ─────────────────────────────────────────────────── */}
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🔢 Numeração RPS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                    <div>
                      <label className="form-label">Próximo Nº RPS</label>
                      <input type="number" min="1" className="form-input" placeholder="1" value={(cfgEditItem as any)?.proximoRps || ''} onChange={e => setCfgEditItem(p => p && { ...p, proximoRps: parseInt(e.target.value) || 1 } as any)} />
                    </div>
                    <div>
                      <label className="form-label">Série RPS</label>
                      <input className="form-input" placeholder="A" maxLength={5} value={(cfgEditItem as any)?.serieRps || ''} onChange={e => setCfgEditItem(p => p && { ...p, serieRps: e.target.value.toUpperCase() } as any)} />
                    </div>
                  </div>

                  <div style={{ paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCfgForm(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary"><Check size={14} />Salvar Unidade Fiscal</button>
                  </div>
                </form>
              </div>
          )}
        </div>
      )}

      {/* Modal Seleção Emissor */}
      {showModalUnidade && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><Send size={16} color="#3b82f6" />Confirmar Emissão</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModalUnidade(false)}><X size={14} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 13, marginBottom: 16 }}>Você está prestes a emitir <strong>{selectedIds.size} NFS-e(s)</strong>. Selecione a Unidade Fiscal Emissora:</p>
              <select className="form-input" value={unidadeSelecionadaEmissao} onChange={e => setUnidadeSelecionadaEmissao(e.target.value)} style={{ marginBottom: 20 }}>
                <option value="" disabled>-- SELECIONE --</option>
                {(unidadesFiscais || []).filter(u=>u.situacao==='ativo').map(u => (
                  <option key={u.id} value={u.id}>{u.nome} [{(u as any).provedor?.toUpperCase() || 'MOCK'}] (CNPJ: {u.cnpj})</option>
                ))}
              </select>
              {unidadeSelecionadaEmissao && (() => {
                const u = (unidadesFiscais || []).find(x => x.id === unidadeSelecionadaEmissao)
                const prov = (u as any)?.provedor || 'mock'
                const needsKey = prov !== 'mock' && prov !== 'abrasf' && !(u as any)?.apiKey
                const needsSoap = prov === 'abrasf' && !(u as any)?.urlWebservice
                const needsRps = !(u as any)?.proximoRps || !(u as any)?.serieRps
                return (needsKey || needsSoap || needsRps) ? (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>
                    <strong>⚠️ Atenção:</strong>
                    {needsKey && <div>• API Key não configurada — edite a Unidade Fiscal</div>}
                    {needsSoap && <div>• URL Webservice SOAP não preenchida</div>}
                    {needsRps && <div>• Numeração RPS (série/número) não configurada</div>}
                  </div>
                ) : null
              })()}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setShowModalUnidade(false)}>Cancelar</button>
                <button className="btn btn-primary" disabled={!unidadeSelecionadaEmissao || emitindo} onClick={handleEmitir}>
                  {emitindo
                    ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6 }} />Emitindo...</>
                    : <><Check size={14} />Finalizar Emissão</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Teste de Webservice */}
      {testeModal && (() => {
        const unidade = (unidadesFiscais || []).find(u => u.id === testeModal.id)
        const provedorLabel: Record<string, string> = {
          mock: 'Mock', nfeio: 'NFE.io', enotas: 'eNotas',
          tecnospeed: 'Tecnospeed', abrasf: 'ABRASF Direto'
        }
        const provName = provedorLabel[(unidade as any)?.provedor || 'mock'] || 'Provedor'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ width: 540, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} color="#8b5cf6" />
                  Teste de Integração — {provName}
                </div>
                {testeModal.status !== 'testing' && <button className="btn btn-ghost btn-icon" onClick={() => setTesteModal(null)}><X size={14} /></button>}
              </div>

              {/* Terminal de logs */}
              <div style={{ padding: 20, background: '#0f172a', fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: 12, height: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {testeModal.logs.map((log, i) => (
                  <div key={i} style={{
                    animation: 'fade-in 0.2s ease-out',
                    color: log.includes('✅') ? '#34d399'
                         : log.includes('❌') || log.includes('[Erro') || log.includes('[FALHA') ? '#f87171'
                         : log.includes('⚠️') ? '#fbbf24'
                         : '#94a3b8'
                  }}>{log}</div>
                ))}
                {testeModal.status === 'testing' && <div style={{ color: '#60a5fa', animation: 'pulse 1s infinite' }}>_</div>}
              </div>

              {/* Erros destacados */}
              {testeModal.status === 'error' && testeModal.logs.filter(l => l.includes('[FALHA]')).length === 0 && (
                <div style={{ padding: '10px 20px', background: 'rgba(239,68,68,0.1)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                  {testeModal.logs.filter(l => l.includes('❌') || l.startsWith('[Erro') || l.startsWith('[FALHA')).map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={11} />{e.replace(/\[.*?\]\s*/, '')}
                    </div>
                  ))}
                </div>
              )}

              {testeModal.status !== 'testing' && (
                <div style={{ padding: '16px 24px', background: 'hsl(var(--bg-elevated))', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: testeModal.status === 'success' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    {testeModal.status === 'success'
                      ? <><CheckCircle size={14} /> Integração validada com sucesso 🎉</>
                      : <><AlertCircle size={14} /> Falha — veja os erros acima</>}
                  </div>
                  <button
                    className={`btn ${testeModal.status === 'success' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setTesteModal(null)}
                  >
                    {testeModal.status === 'success' ? 'Concluir Teste' : 'Fechar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
      
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
