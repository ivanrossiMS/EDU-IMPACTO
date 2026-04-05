'use client'

import { useState, useMemo } from 'react'
import { useData, ContaPagar, newId } from '@/lib/dataContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ConfirmModal, EmptyState } from '@/components/ui/CrudModal'
import {
  Plus, Download, Search, Pencil, Trash2, CheckCircle, Clock,
  Filter, X, AlertTriangle, Building2, FileText, Calendar, DollarSign,
  ChevronRight, Check, Hash, Layers, ArrowDownCircle, Wallet, CreditCard,
  TrendingDown, Receipt, BadgeCheck, Paperclip, BarChart2, Printer, RotateCcw
} from 'lucide-react'

const TIPOS_DOC_FALLBACK = ['NF', 'NFe', 'REC', 'DUP', 'CHQ', 'BOL', 'PIX', 'TED', 'DOC', 'OUTRO']
const CAT_COLORS: Record<string, string> = {
  RH: '#8b5cf6', Utilidades: '#06b6d4', Materiais: '#f59e0b',
  Tecnologia: '#3b82f6', Infraestrutura: '#10b981', Marketing: '#ec4899', Outros: '#6b7280',
}
const CATEGORIAS = Object.keys(CAT_COLORS)
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function gerarCodCP(total: number) {
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `CP-${rand}`
}

function gerarParcelas(valorTotal: number, numP: number, dataBase: string, modo: 'corridos' | 'mesmo_dia') {
  const parcelas = []
  const base = new Date(dataBase + 'T12:00')
  for (let i = 0; i < numP; i++) {
    let d = new Date(base)
    if (modo === 'corridos') {
      d.setDate(d.getDate() + 30 * (i + 1))
    } else {
      d.setMonth(d.getMonth() + i + 1)
    }
    parcelas.push({
      num: i + 1,
      vencimento: d.toISOString().slice(0, 10),
      valor: +(valorTotal / numP).toFixed(2),
    })
  }
  // Ajuste de arredondamento na última
  const soma = parcelas.reduce((s, p) => s + p.valor, 0)
  const diff = +(valorTotal - soma).toFixed(2)
  if (parcelas.length > 0) parcelas[parcelas.length - 1].valor = +(parcelas[parcelas.length - 1].valor + diff).toFixed(2)
  return parcelas
}

const BLANK_CP = {
  codigo: '', descricao: '', categoria: 'RH', valor: 0, vencimento: '',
  status: 'pendente' as ContaPagar['status'], fornecedor: '',
}

export default function ContasPagarPage() {
  const { contasPagar, setContasPagar, fornecedoresCad, cfgPlanoContas, cfgCentrosCusto, caixasAbertos, setCaixasAbertos, setMovimentacoesManuais, cfgEventos, cfgMetodosPagamento, cfgTiposDocumento, cfgCartoes, logSystemAction } = useData()

  // Métodos de pagamento dinâmicos (com fallback)
  const METODOS_FALLBACK = ['PIX', 'Dinheiro', 'Boleto Bancário', 'Cartão de Crédito', 'Transferência', 'Débito Automático', 'Cheque']
  const metodosPagamento = cfgMetodosPagamento.filter(m => m.situacao === 'ativo').length > 0
    ? cfgMetodosPagamento.filter(m => m.situacao === 'ativo')
    : METODOS_FALLBACK.map((nome, i) => ({ id: `fb${i}`, nome, tipo: nome.toLowerCase(), situacao: 'ativo' as const }))
  // Tipos de documento dinâmicos (com fallback)
  const TIPOS_DOC = cfgTiposDocumento.filter(t => t.situacao === 'ativo').length > 0
    ? cfgTiposDocumento.filter(t => t.situacao === 'ativo').map(t => t.nome)
    : TIPOS_DOC_FALLBACK
  // Cartões ativos
  const cartoesAtivos = cfgCartoes.filter(c => c.situacao === 'ativo')

  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos'|'pendente'|'pago'|'vencendo'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [filtroMes, setFiltroMes] = useState('Todos')
  const [filtroAno, setFiltroAno] = useState('Todos')
  const [modal, setModal] = useState<'add'|'edit'|null>(null)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [confirmId, setConfirmId] = useState<string|null>(null)
  // Filtro de data específica
  const [filtroDe, setFiltroDe] = useState('')
  const [filtroAte, setFiltroAte] = useState('')
  // Gráfico
  const [showGrafico, setShowGrafico] = useState(false)
  // Anexos: { [contaId]: { nome: string; url: string }[] }
  const [anexos, setAnexos] = useState<Record<string, { nome: string; url: string }[]>>({})

  // ── Modal de Baixa ─────────────────────────────────────────────────
  const [baixaId, setBaixaId] = useState<string | null>(null)
  const [showPlanoModal, setShowPlanoModal] = useState<'form' | 'baixa' | null>(null)
  const [planoModalSearch, setPlanoModalSearch] = useState('')
  const planoModalItens = useMemo(() => {
    const q = planoModalSearch.toLowerCase()
    const grupo = showPlanoModal === 'baixa' ? undefined : 'despesas'
    return cfgPlanoContas.filter(p => p.situacao === 'ativo' &&
      (!grupo || p.grupoConta === grupo) &&
      (p.descricao.toLowerCase().includes(q) || ((p as any).codPlano || '').toLowerCase().includes(q)))
  }, [cfgPlanoContas, planoModalSearch, showPlanoModal])
  const [baixaForm, setBaixaForm] = useState({
    caixaId: '',
    tipoDoc: 'PIX',
    dataPagamento: new Date().toISOString().slice(0,10),
    planoContasId: '',
    valorOriginal: 0,
    desconto: 0,
    juros: 0,
    multa: 0,
    obs: '',
    composicao: 'pix' as string,
  })
  const setBF = (k: string, v: unknown) => setBaixaForm(p => ({ ...p, [k]: v }))
  const valorLiquido = baixaForm.valorOriginal - baixaForm.desconto + baixaForm.juros + baixaForm.multa

  const openBaixa = (c: ContaPagar) => {
    // Tenta encontrar conta de despesa com mesma descrição no plano
    const planoAuto = cfgPlanoContas.find(p =>
      p.grupoConta === 'despesas' && p.situacao === 'ativo' &&
      (p.descricao.toLowerCase().includes(c.categoria.toLowerCase()) || c.descricao.toLowerCase().includes(p.descricao.toLowerCase()))
    )
    const caixaAberto = caixasAbertos.find(cx => !cx.fechado)
    setBaixaForm({
      caixaId: caixaAberto?.id || '',
      tipoDoc: 'PIX',
      dataPagamento: new Date().toISOString().slice(0,10),
      planoContasId: c.planoContasId || planoAuto?.id || '',
      valorOriginal: c.valor,
      desconto: 0,
      juros: 0,
      multa: 0,
      obs: '',
      composicao: metodosPagamento.find(m => m.situacao === 'ativo')?.id || '',
    })
    setBaixaId(c.id)
  }

  const confirmarBaixa = () => {
    if (!baixaId) return
    const conta = contasPagar.find(c => c.id === baixaId)
    setContasPagar(prev => prev.map(c => c.id === baixaId
      ? {
          ...c,
          status: 'pago' as ContaPagar['status'],
          dataPagamento: baixaForm.dataPagamento,
          valorPago: valorLiquido,
          desconto: baixaForm.desconto,
          juros: baixaForm.juros,
          multa: baixaForm.multa,
          obs: baixaForm.obs,
          caixaId: baixaForm.caixaId,
          tipoDocBaixa: baixaForm.tipoDoc,
          planoContasBaixa: baixaForm.planoContasId,
          composicaoBaixa: baixaForm.composicao,
        } as any
      : c
    ))
    // Espelhar pagamento como Movimentação Manual
    if (baixaForm.caixaId && conta) {
      const now = new Date().toISOString()
      const refId = 'CP-' + conta.id.slice(-8)
      setMovimentacoesManuais((prev: any) => [...prev, {
        id: refId, caixaId: baixaForm.caixaId, tipo: 'despesa',
        fornecedorId: (conta as any).fornecedorId || '',
        fornecedorNome: conta.fornecedor || '',
        descricao: `Contas a Pagar — ${conta.descricao}${conta.fornecedor ? ` · ${conta.fornecedor}` : ''}`,
        dataLancamento: baixaForm.dataPagamento, dataMovimento: baixaForm.dataPagamento,
        valor: valorLiquido, planoContasId: baixaForm.planoContasId || '',
        planoContasDesc: cfgPlanoContas.find(p => p.id === baixaForm.planoContasId)?.descricao || '',
        tipoDocumento: baixaForm.tipoDoc || 'PIX', numeroDocumento: (conta as any).numeroDocumento || '',
        dataEmissao: (conta as any).dataEmissao || baixaForm.dataPagamento,
        compensadoBanco: false, observacoes: baixaForm.obs || '',
        criadoEm: now, editadoEm: now,
        origem: 'baixa_pagar', referenciaId: conta.id
      }])
    }
    logSystemAction('Financeiro (Pagar)', 'Baixa de Pagamento', `Pagamento de R$ ${valorLiquido} efetuado para ${conta?.fornecedor}`, { registroId: (conta as any)?.codigo, nomeRelacionado: conta?.fornecedor })
    setBaixaId(null)
  }

  // Formulário rico
  const [form, setForm] = useState({ ...BLANK_CP })
  const [fornecedorId, setFornecedorId] = useState('')
  const [fornecedorSearch, setFornecedorSearch] = useState('')
  const [showFornecedorDrop, setShowFornecedorDrop] = useState(false)
  const [planoContasId, setPlanoContasId] = useState('')
  const [planoSearch, setPlanoSearch] = useState('')
  const [showPlanoDrop, setShowPlanoDrop] = useState(false)
  const [centroCustoId, setCentroCustoId] = useState('')
  const [tipoDoc, setTipoDoc] = useState('NF')
  const [numDoc, setNumDoc] = useState('')
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [unidade, setUnidade] = useState('')
  const [parcelar, setParcelar] = useState(false)
  const [numParcelas, setNumParcelas] = useState(3)
  const [modoParcelas, setModoParcelas] = useState<'corridos'|'mesmo_dia'>('corridos')
  const [previewParcelas, setPreviewParcelas] = useState<{ num:number; vencimento:string; valor:number }[]>([])
  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))
  const fmtC = formatCurrency

  // Typeahead helpers
  const fornecedoresFiltrados = useMemo(() => {
    const q = fornecedorSearch.toLowerCase()
    return fornecedoresCad.filter(f => (f.nomeFantasia || f.razaoSocial).toLowerCase().includes(q)).slice(0, 8)
  }, [fornecedoresCad, fornecedorSearch])

  const planosFiltrados = useMemo(() => {
    const q = planoSearch.toLowerCase()
    return cfgPlanoContas.filter(p => p.grupoConta === 'despesas' && p.situacao === 'ativo' &&
      (p.descricao.toLowerCase().includes(q) || ((p as any).codPlano || '').toLowerCase().includes(q))).slice(0, 8)
  }, [cfgPlanoContas, planoSearch])

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const em3dias = new Date(hoje); em3dias.setDate(hoje.getDate()+3)
  const anos = useMemo(() => [...new Set(contasPagar.map(c=>c.vencimento?.slice(0,4)).filter(Boolean))].sort().reverse(), [contasPagar])

  const isVencendo = (c: ContaPagar) => {
    if (c.status !== 'pendente') return false
    const d = new Date(c.vencimento); d.setHours(0,0,0,0)
    return d <= em3dias && d >= hoje
  }
  const isVencido = (c: ContaPagar) => c.status !== 'pago' && new Date(c.vencimento) < hoje

  const filtered = useMemo(() => contasPagar.filter(c => {
    const q = search.toLowerCase()
  const searchActive = search.trim().length >= 3
    const matchSearch = !searchActive || (c.descricao.toLowerCase().includes(q) || c.categoria.toLowerCase().includes(q) || c.fornecedor.toLowerCase().includes(q))
    const matchStatus = filtroStatus === 'todos' || (filtroStatus === 'pendente' && c.status === 'pendente') || (filtroStatus === 'pago' && c.status === 'pago') || (filtroStatus === 'vencendo' && isVencendo(c))
    const matchCat = filtroCategoria === 'Todas' || c.categoria === filtroCategoria
    const matchMes = filtroMes === 'Todos' || c.vencimento?.slice(5,7) === String(MESES.indexOf(filtroMes)+1).padStart(2,'0')
    const matchAno = filtroAno === 'Todos' || c.vencimento?.startsWith(filtroAno)
    const matchDe = !filtroDe || (c.vencimento && c.vencimento >= filtroDe)
    const matchAte = !filtroAte || (c.vencimento && c.vencimento <= filtroAte)
    return matchSearch && matchStatus && matchCat && matchMes && matchAno && matchDe && matchAte
  }), [contasPagar, search, filtroStatus, filtroCategoria, filtroMes, filtroAno, filtroDe, filtroAte])

  const totalPendente = contasPagar.filter(c=>c.status==='pendente').reduce((s,c)=>s+c.valor,0)
  const totalPago = contasPagar.filter(c=>c.status==='pago').reduce((s,c)=>s+c.valor,0)
  const totalVencendo = contasPagar.filter(c=>isVencendo(c)).reduce((s,c)=>s+c.valor,0)
  const totalVencidos = contasPagar.filter(c=>isVencido(c)).reduce((s,c)=>s+c.valor,0)

  const clearFilters = () => { setFiltroCategoria('Todas'); setFiltroMes('Todos'); setFiltroAno('Todos'); setFiltroStatus('todos'); setSearch(''); setFiltroDe(''); setFiltroAte('') }
  const activeFilters = [filtroCategoria!=='Todas', filtroMes!=='Todos', filtroAno!=='Todos', filtroStatus!=='todos', !!filtroDe, !!filtroAte].filter(Boolean).length

  const resetForm = () => {
    setForm({ ...BLANK_CP, codigo: gerarCodCP(contasPagar.length) })
    setFornecedorId(''); setFornecedorSearch(''); setShowFornecedorDrop(false)
    setPlanoContasId(''); setPlanoSearch(''); setShowPlanoDrop(false)
    setCentroCustoId(''); setTipoDoc('NF'); setNumDoc(''); setDataEmissao(new Date().toISOString().slice(0,10))
    setUnidade(''); setParcelar(false); setNumParcelas(3); setModoParcelas('corridos')
    setPreviewParcelas([])
  }

  const openAdd = () => { resetForm(); setEditingId(null); setModal('add') }
  const openEdit = (c: ContaPagar) => {
    setForm({ codigo: (c as any).codigo || gerarCodCP(contasPagar.length), descricao: c.descricao, categoria: c.categoria, valor: c.valor, vencimento: c.vencimento, status: c.status, fornecedor: c.fornecedor })
    setNumDoc(c.numeroDocumento || '')
    setPlanoContasId(c.planoContasId || '')
    const pc = cfgPlanoContas.find(p => p.id === c.planoContasId)
    setPlanoSearch(pc ? `${(pc as any).codPlano || ''} — ${pc.descricao}` : '')
    setEditingId(c.id); setParcelar(false); setPreviewParcelas([]); setModal('edit')
  }

  const gerarPreview = () => {
    if (!form.valor || !form.vencimento) return
    setPreviewParcelas(gerarParcelas(form.valor, numParcelas, form.vencimento, modoParcelas))
  }

  const handleSave = () => {
    if (!form.descricao.trim() || !form.valor || !form.vencimento) return
    const fn = fornecedoresCad.find(f => f.id === fornecedorId)
    const payload: Omit<ContaPagar, 'id'> = {
      ...form,
      fornecedor: fn ? (fn.nomeFantasia || fn.razaoSocial) : form.fornecedor,
      numeroDocumento: numDoc,
      planoContasId: planoContasId,
    }
    if (parcelar && previewParcelas.length > 0) {
      const novas = previewParcelas.map((p, i) => ({
        ...payload,
        id: newId('CP'),
        codigo: `${form.codigo}-P${String(i+1).padStart(2,'0')}`,
        descricao: `${form.descricao} (${i+1}/${previewParcelas.length})`,
        valor: p.valor,
        vencimento: p.vencimento,
        numeroDocumento: numDoc,
        planoContasId: planoContasId,
      }))
      setContasPagar(prev => [...prev, ...novas])
      logSystemAction('Financeiro (Pagar)', 'Cadastro em Lote', `Lançamento de ${previewParcelas.length} parcelas a pagar para ${payload.fornecedor}`, { registroId: form.codigo, nomeRelacionado: payload.fornecedor })
    } else {
      if (modal === 'add') {
        const id = newId('CP')
        setContasPagar(prev => [...prev, { ...payload, id }])
        logSystemAction('Financeiro (Pagar)', 'Cadastro', `Criada conta a pagar de R$ ${payload.valor} para ${payload.fornecedor}`, { registroId: form.codigo, nomeRelacionado: payload.fornecedor, detalhesDepois: payload })
      } else if (editingId) {
        const anterior = contasPagar.find(c => c.id === editingId)
        setContasPagar(prev => prev.map(c => c.id === editingId ? { ...payload, id: editingId } : c))
        // Sincronizar movimentação automática vinculada (se houver baixa registrada)
        setMovimentacoesManuais((prev: any) => prev.map((m: any) =>
          m.referenciaId === editingId
            ? { ...m, descricao: `Contas a Pagar — ${payload.descricao}${payload.fornecedor ? ` · ${payload.fornecedor}` : ''}`, valor: payload.valor, editadoEm: new Date().toISOString() }
            : m
        ))
        logSystemAction('Financeiro (Pagar)', 'Edição', `Atualização da conta a pagar ${form.codigo}`, { registroId: form.codigo, nomeRelacionado: payload.fornecedor, detalhesAntes: anterior, detalhesDepois: payload })
      }
    }
    setModal(null)
  }

  const handleDelete = () => {
    if (confirmId) {
      const deletedT = contasPagar.find(c => c.id === confirmId)
      setContasPagar(prev => prev.filter(c => c.id !== confirmId))
      // Remover movimentação automática vinculada (se houver baixa)
      setMovimentacoesManuais((prev: any) => prev.filter((m: any) => m.referenciaId !== confirmId))
      logSystemAction('Financeiro (Pagar)', 'Exclusão', `Exclusão definitiva de conta a pagar.`, { registroId: (deletedT as any)?.codigo, detalhesAntes: deletedT })
    }
    setConfirmId(null)
  }

  const STATUS_CFG = {
    pendente: { color: '#f59e0b', badge: 'badge-warning', label: 'Pendente' },
    pago:     { color: '#10b981', badge: 'badge-success', label: 'Pago' },
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contas a Pagar</h1>
          <p className="page-subtitle">{contasPagar.filter(c=>c.status==='pendente').length} pendente(s) • {fmtC(totalPendente)} em aberto</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowGrafico(true)}><BarChart2 size={13} />Gráfico</button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={13} />Imprimir</button>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} />Nova Conta a Pagar</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Em Aberto', value: fmtC(totalPendente), color: '#f59e0b', icon: '⏳', count: contasPagar.filter(c=>c.status==='pendente').length },
          { label: 'Pagas no Período', value: fmtC(totalPago), color: '#10b981', icon: '✅' },
          { label: 'Vencendo (3d)', value: fmtC(totalVencendo), color: '#f97316', icon: '⚠️', count: contasPagar.filter(c=>isVencendo(c)).length },
          { label: 'Vencidas', value: fmtC(totalVencidos), color: '#ef4444', icon: '🔴', count: contasPagar.filter(c=>isVencido(c)).length },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
            {(k as any).count > 0 && <div style={{ fontSize: 11, color: k.color, marginTop: 2 }}>{(k as any).count} título(s)</div>}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar descrição, fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {(['todos','pendente','pago','vencendo'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`btn ${filtroStatus === s ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ fontSize: 12 }}>
              {s === 'todos' ? 'Todos' : s === 'pendente' ? '⏳ Pendente' : s === 'pago' ? '✅ Pago' : '⚠️ Vencendo'}
            </button>
          ))}
          {/* Data específica — substitui filtro de categoria */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>Venc. de</span>
            <input type="date" className="form-input" style={{ width: 140 }} value={filtroDe} onChange={e => setFiltroDe(e.target.value)} />
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>até</span>
            <input type="date" className="form-input" style={{ width: 140 }} value={filtroAte} onChange={e => setFiltroAte(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 100 }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            <option value="Todos">Mês</option>
            {MESES.map(m => <option key={m}>{m}</option>)}
          </select>
          <select className="form-input" style={{ width: 90 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="Todos">Ano</option>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={clearFilters}>
              <X size={12} />Limpar ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      {contasPagar.length === 0 ? (
        <EmptyState icon="📃" title="Nenhuma conta a pagar" description="Registre contas, faturas e pagamentos recorrentes."
          action={<button className="btn btn-primary" onClick={openAdd}><Plus size={14} />Registrar Conta</button>} />
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
          Nenhum resultado para os filtros. <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={clearFilters}>Limpar</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nº Doc</th>
                <th>Descrição</th>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Emissão</th>
                <th>Vencimento</th>
                <th>Data Pagto.</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const vencido = isVencido(c)
                const vencendo = isVencendo(c)
                return (
                  <tr key={c.id} style={{ opacity: c.status === 'pago' ? 0.7 : 1 }}>
                    <td><code style={{ fontSize: 10, background: 'hsl(var(--bg-overlay))', padding: '1px 5px', borderRadius: 4, color: '#60a5fa' }}>{(c as any).codigo || '—'}</code></td>
                    <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{c.numeroDocumento || '—'}</td>
                    <td style={{ fontWeight: 600, fontSize: 13, maxWidth: 200 }}>
                      <div>{c.descricao}</div>
                      {anexos[c.id]?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                          {anexos[c.id].map((f, i) => (
                            <a key={i} href={f.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none', cursor: 'pointer' }}
                              title={`Abrir ${f.nome}`}>
                              <Paperclip size={8} />{f.nome}
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{c.fornecedor || '—'}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: `${CAT_COLORS[c.categoria] || '#6b7280'}20`, color: CAT_COLORS[c.categoria] || '#6b7280', fontWeight: 700 }}>{c.categoria}</span>
                    </td>
                    {/* Emissão */}
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                      {(c as any).dataEmissao ? new Date((c as any).dataEmissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    {/* Vencimento */}
                    <td style={{ fontSize: 13, color: vencido ? '#f87171' : vencendo ? '#f59e0b' : 'inherit', fontWeight: (vencido || vencendo) ? 700 : 400 }}>
                      {c.vencimento ? new Date(c.vencimento + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                      {vencido && <span style={{ fontSize: 10, marginLeft: 6, color: '#f87171' }}>VENCIDA</span>}
                      {vencendo && !vencido && <span style={{ fontSize: 10, marginLeft: 6, color: '#f59e0b' }}>VENCENDO</span>}
                    </td>
                    {/* Data de Pagamento */}
                    <td style={{ fontSize: 12, color: (c as any).dataPagamento ? '#10b981' : 'hsl(var(--text-muted))' }}>
                      {(c as any).dataPagamento ? new Date((c as any).dataPagamento + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, fontFamily: 'Outfit,sans-serif', color: c.status === 'pago' ? '#10b981' : '#f87171' }}>{fmtC(c.valor)}</td>
                    <td>
                      <span className={`badge ${c.status === 'pago' ? 'badge-success' : vencido ? 'badge-danger' : 'badge-warning'}`}>
                        {c.status === 'pago' ? '✅ Pago' : vencido ? '🔴 Vencida' : '⏳ Pendente'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {c.status !== 'pago' && (
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: 11, background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}
                            onClick={() => openBaixa(c)}>
                            <ArrowDownCircle size={11} />Baixar
                          </button>
                        )}
                        {c.status === 'pago' && (
                          <button
                            title="Reverter Baixa"
                            className="btn btn-sm"
                            style={{ fontSize: 11, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                            onClick={() => {
                              setContasPagar(prev => prev.map(x => x.id === c.id ? { ...x, status: 'pendente', dataPagamento: undefined } : x))
                              // Remover movimentação automática ao reverter baixa
                              setMovimentacoesManuais((prev: any) => prev.filter((m: any) => m.referenciaId !== c.id))
                            }}>
                            <RotateCcw size={11} />Reverter
                          </button>
                        )}
                        {/* Anexar arquivo */}
                        <label
                          title="Anexar arquivo"
                          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: '1px solid hsl(var(--border-subtle))', background: 'transparent', color: '#60a5fa', flexShrink: 0 }}>
                          <Paperclip size={12} />
                          <input type="file" style={{ display: 'none' }} multiple onChange={e => {
                            const files = Array.from(e.target.files || [])
                            if (files.length) setAnexos(prev => ({ ...prev, [c.id]: [...(prev[c.id] || []), ...files.map(f => ({ nome: f.name, url: URL.createObjectURL(f) }))] }))
                            e.target.value = ''
                          }} />
                        </label>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><Pencil size={12} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(c.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                <td colSpan={8} style={{ fontWeight: 700, fontSize: 12, padding: '10px 16px', color: 'hsl(var(--text-muted))' }}>Total filtrado ({filtered.length})</td>
                <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#60a5fa' }}>{fmtC(filtered.reduce((s,c)=>s+c.valor,0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {/* Modal Gráfico Premium */}
      {showGrafico && (() => {
        const porCategoria = CATEGORIAS.map(cat => ({
          cat,
          aberto: contasPagar.filter(c => c.categoria === cat && c.status === 'pendente').reduce((s,c) => s+c.valor, 0),
          pago: contasPagar.filter(c => c.categoria === cat && c.status === 'pago').reduce((s,c) => s+c.valor, 0),
          color: CAT_COLORS[cat] || '#6b7280',
        })).filter(x => x.aberto > 0 || x.pago > 0)
        const porMes = MESES.map((mes, i) => ({
          mes,
          valor: contasPagar.filter(c => parseInt(c.vencimento?.slice(5,7) || '0') === i+1).reduce((s,c) => s+c.valor, 0),
          pago: contasPagar.filter(c => c.status === 'pago' && parseInt(c.vencimento?.slice(5,7) || '0') === i+1).reduce((s,c) => s+c.valor, 0),
        })).filter(x => x.valor > 0)
        const maxCat = Math.max(...porCategoria.map(x => x.aberto + x.pago), 1)
        const maxMes = Math.max(...porMes.map(x => x.valor), 1)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 860, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.7)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,rgba(239,68,68,0.07),rgba(59,130,246,0.03))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart2 size={20} color="#f87171" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Análise Gráfica — Contas a Pagar</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{contasPagar.length} títulos • {fmtC(contasPagar.reduce((s,c)=>s+c.valor,0))} total</div>
                  </div>
                </div>
                <button onClick={() => setShowGrafico(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
              </div>

              {/* Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Por Categoria */}
                {porCategoria.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 3, height: 16, background: '#f87171', borderRadius: 2, display: 'inline-block' }} />
                      Distribuição por Categoria
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {porCategoria.sort((a,b) => (b.aberto+b.pago)-(a.aberto+a.pago)).map(x => (
                        <div key={x.cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: x.color, display: 'inline-block' }} />
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{x.cat}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                              {x.aberto > 0 && <span style={{ color: '#f59e0b' }}>⏳ {fmtC(x.aberto)}</span>}
                              {x.pago > 0 && <span style={{ color: '#10b981' }}>✅ {fmtC(x.pago)}</span>}
                            </div>
                          </div>
                          <div style={{ height: 18, borderRadius: 9, background: 'hsl(var(--bg-elevated))', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${(x.pago / maxCat) * 100}%`, background: 'linear-gradient(90deg,#10b981,#059669)', transition: 'width 0.4s', minWidth: x.pago > 0 ? 2 : 0 }} />
                            <div style={{ width: `${(x.aberto / maxCat) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#f97316)', transition: 'width 0.4s', minWidth: x.aberto > 0 ? 2 : 0 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }}/> Pago</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }}/> Em aberto</div>
                    </div>
                  </div>
                )}

                {/* Por Mês */}
                {porMes.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 3, height: 16, background: '#60a5fa', borderRadius: 2, display: 'inline-block' }} />
                      Evolução Mensal de Vencimentos
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 140 }}>
                      {porMes.map(x => (
                        <div key={x.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700 }}>{fmtC(x.valor).replace('R$','').trim()}</div>
                          <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg,#60a5fa,#3b82f6)', height: `${Math.max((x.valor / maxMes) * 110, 4)}px`, position: 'relative', overflow: 'hidden' }}>
                            {x.pago > 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(x.pago / x.valor) * 100}%`, background: 'rgba(16,185,129,0.4)' }} />}
                          </div>
                          <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>{x.mes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {porCategoria.length === 0 && porMes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
                    <BarChart2 size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                    <div>Nenhum dado para exibir</div>
                  </div>
                )}
              </div>

              {/* Footer resumo */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
                {[
                  { l: 'Total', v: fmtC(contasPagar.reduce((s,c)=>s+c.valor,0)), color: '#60a5fa' },
                  { l: 'Em Aberto', v: fmtC(totalPendente), color: '#f59e0b' },
                  { l: 'Pago', v: fmtC(totalPago), color: '#10b981' },
                  { l: 'Vencidas', v: fmtC(totalVencidos), color: '#ef4444' },
                ].map(k => (
                  <div key={k.l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>{k.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Modal Seleção Plano de Contas ─── */}
      {showPlanoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg,rgba(239,68,68,0.06),rgba(59,130,246,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={16} color="#60a5fa" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Selecionar Plano de Contas</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{cfgPlanoContas.filter(p => p.situacao === 'ativo').length} contas ativas</div>
                </div>
              </div>
              <button onClick={() => setShowPlanoModal(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Filtrar por código ou descrição..." value={planoModalSearch} onChange={e => setPlanoModalSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {planoModalItens.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                  {cfgPlanoContas.length === 0 ? 'Nenhum plano de contas cadastrado. Acesse Configurações Financeiro.' : 'Nenhuma conta encontrada.'}
                </div>
              ) : (
                planoModalItens.map(p => (
                  <div key={p.id}
                    onClick={() => {
                      if (showPlanoModal === 'form') { setPlanoContasId(p.id); setPlanoSearch(`${(p as any).codPlano || ''} — ${p.descricao}`) }
                      else { setBaixaForm(bf => ({ ...bf, planoContasId: p.id })) }
                      setShowPlanoModal(null)
                    }}
                    style={{ padding: '13px 20px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 14 }}
                    onMouseEnter={el => (el.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                    onMouseLeave={el => (el.currentTarget.style.background = 'transparent')}>
                    <code style={{ fontSize: 11, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', padding: '2px 7px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>{(p as any).codPlano || 'S/C'}</code>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.descricao}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{p.grupoConta} · {p.situacao}</div>
                    </div>
                    <Check size={14} style={{ opacity: (showPlanoModal === 'form' ? planoContasId : baixaForm.planoContasId) === p.id ? 1 : 0, color: '#3b82f6' }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Premium Nova/Editar Conta */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 800, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.7)', marginBottom: 24 }}>
            {/* Header */}
            <div style={{ padding: '20px 28px', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={22} color="#f87171" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{modal === 'add' ? 'Nova Conta a Pagar' : 'Editar Conta'}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Código:</span>
                    <code style={{ fontSize: 12, fontWeight: 900, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: 4 }}>{form.codigo}</code>
                  </div>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Linha 1: Descrição */}
              <div>
                <label className="form-label">Descrição *</label>
                <input className="form-input" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Folha de Pagamento — Abril/2026" style={{ fontWeight: 600 }} />
              </div>

              {/* Linha 2: Fornecedor (busca) + Centro de Custo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* FORNECEDOR — typeahead */}
                <div style={{ position: 'relative' }}>
                  <label className="form-label">Fornecedor / Beneficiário</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: 30 }}
                      value={fornecedorSearch}
                      onChange={e => { setFornecedorSearch(e.target.value); setShowFornecedorDrop(true); if (!e.target.value) { setFornecedorId(''); set('fornecedor', '') } }}
                      onFocus={() => setShowFornecedorDrop(true)}
                      onBlur={() => setTimeout(() => setShowFornecedorDrop(false), 150)}
                      placeholder="Buscar fornecedor ou beneficiário..."
                    />
                    {fornecedorSearch && <button type="button" onClick={() => { setFornecedorSearch(''); setFornecedorId(''); set('fornecedor', '') }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><X size={12} /></button>}
                  </div>
                  {showFornecedorDrop && fornecedoresFiltrados.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', marginTop: 4 }}>
                      {fornecedoresFiltrados.map(f => (
                        <div key={f.id}
                          onMouseDown={() => { setFornecedorId(f.id); const nome = f.nomeFantasia || f.razaoSocial; setFornecedorSearch(nome); set('fornecedor', nome); setShowFornecedorDrop(false) }}
                          style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid hsl(var(--border-subtle))', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ fontWeight: 700 }}>{f.nomeFantasia || f.razaoSocial}</span>
                          {f.nomeFantasia && f.razaoSocial && <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginLeft: 6 }}>{f.razaoSocial}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {showFornecedorDrop && fornecedoresFiltrados.length === 0 && fornecedorSearch.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Nenhum fornecedor encontrado — digite para cadastrar manualmente</div>
                  )}
                  {fornecedorId && <div style={{ fontSize: 10, color: '#10b981', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}><Check size={9} /> Fornecedor vinculado</div>}
                </div>

                {/* Centro de custo */}
                <div>
                  <label className="form-label">Centro de Custo</label>
                  {cfgCentrosCusto.length > 0 ? (
                    <select className="form-input" value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)}>
                      <option value="">Selecionar</option>
                      {cfgCentrosCusto.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} — {cc.descricao}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" placeholder="Configure em Config. Financeiro" disabled style={{ opacity: 0.5 }} />
                  )}
                </div>
              </div>

              {/* Plano de Contas — botão abre modal */}
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Layers size={11} />Plano de Contas
                  {planoContasId && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>✓ Vinculado</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, padding: '9px 14px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, fontSize: 13, color: planoContasId ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {planoContasId ? (
                      <><code style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', padding: '1px 5px', borderRadius: 3 }}>{(cfgPlanoContas.find(p => p.id === planoContasId) as any)?.codPlano || ''}</code>
                      <span style={{ fontWeight: 600 }}>{cfgPlanoContas.find(p => p.id === planoContasId)?.descricao}</span></>
                    ) : <span>Nenhuma conta selecionada</span>}
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                    onClick={() => { setPlanoModalSearch(''); setShowPlanoModal('form') }}>
                    <Search size={12} />Selecionar Conta
                  </button>
                  {planoContasId && <button type="button" className="btn btn-ghost btn-icon" onClick={() => { setPlanoContasId(''); setPlanoSearch('') }}><X size={12} /></button>}
                </div>
                {cfgPlanoContas.filter(p => p.grupoConta === 'despesas').length === 0 && (
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Configure o Plano de Contas em Configurações Financeiro.</div>
                )}
              </div>

              {/* Linha 3: Valor + Datas + Documento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px 1fr', gap: 16 }}>
                <div>
                  <label className="form-label">Valor Total (R$) *</label>
                  <input type="number" className="form-input" value={form.valor || ''} onChange={e => { set('valor', +e.target.value); setPreviewParcelas([]) }}
                    min={0} step={0.01} style={{ fontWeight: 800, color: '#f87171', fontSize: 15 }} />
                </div>
                <div>
                  <label className="form-label">Data de Vencimento *</label>
                  <input type="date" className="form-input" value={form.vencimento} onChange={e => { set('vencimento', e.target.value); setPreviewParcelas([]) }} />
                </div>
                <div>
                  <label className="form-label">Tipo Documento</label>
                  <select className="form-input" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                    {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Nº do Documento</label>
                  <input className="form-input" value={numDoc} onChange={e => setNumDoc(e.target.value)} placeholder="Ex: NF-000123" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label">Data de Emissão</label>
                  <input type="date" className="form-input" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="pendente">⏳ Pendente</option>
                    <option value="pago">✅ Pago</option>
                  </select>
                </div>
              </div>

              {/* Parcelamento */}
              <div style={{ borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => { setParcelar(p => !p); setPreviewParcelas([]) }}
                    style={{ width: 42, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: parcelar ? '#3b82f6' : 'hsl(var(--border-default))', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: parcelar ? 23 : 3, transition: 'left 0.2s' }} />
                  </button>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Parcelar esta conta</span>
                </div>
                {parcelar && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
                      <div>
                        <label className="form-label">Nº de Parcelas</label>
                        <input type="number" className="form-input" min={2} max={60} value={numParcelas} onChange={e => { setNumParcelas(+e.target.value); setPreviewParcelas([]) }} />
                      </div>
                      <div>
                        <label className="form-label">Modo de Vencimento</label>
                        <select className="form-input" value={modoParcelas} onChange={e => { setModoParcelas(e.target.value as any); setPreviewParcelas([]) }}>
                          <option value="corridos">30 dias corridos</option>
                          <option value="mesmo_dia">Mesmo dia do mês</option>
                        </select>
                      </div>
                      <button className="btn btn-secondary" onClick={gerarPreview} disabled={!form.valor || !form.vencimento}>
                        <Layers size={13} />Gerar Preview
                      </button>
                    </div>
                    {previewParcelas.length > 0 && (
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8 }}>
                        <table style={{ width: '100%', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Parcela</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Vencimento</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewParcelas.map(p => (
                              <tr key={p.num}>
                                <td style={{ padding: '6px 12px' }}>{p.num}/{previewParcelas.length}</td>
                                <td style={{ padding: '6px 12px' }}>{new Date(p.vencimento + 'T12:00').toLocaleDateString('pt-BR')}</td>
                                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#f87171' }}>{fmtC(p.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))' }}>
                              <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 800 }}>Total</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#f87171' }}>{fmtC(previewParcelas.reduce((s,p)=>s+p.valor,0))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.descricao.trim() || !form.valor || !form.vencimento}>
                <Check size={14} />
                {parcelar && previewParcelas.length > 0 ? `Registrar ${previewParcelas.length} parcelas` : modal === 'add' ? 'Registrar Conta' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          MODAL PREMIUM DE BAIXA DE PAGAMENTO
        ───────────────────────────────────────────────────────────────────── */}
      {baixaId && (() => {
        const conta = contasPagar.find(c => c.id === baixaId)!
        const ca = conta as any
        const caixaAberto = caixasAbertos.find(cx => !cx.fechado)
        const planoSelecionado = cfgPlanoContas.find(p => p.id === baixaForm.planoContasId)
        const metodoSelecionado = metodosPagamento.find(m => m.id === baixaForm.composicao)
        const diasAtraso = conta.vencimento
          ? Math.max(0, Math.floor((new Date().getTime() - new Date(conta.vencimento + 'T12:00').getTime()) / 86400000))
          : 0
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 5000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 24, width: '100%', maxWidth: 680, border: '1px solid rgba(16,185,129,0.2)', overflow: 'hidden', boxShadow: '0 48px 140px rgba(0,0,0,0.8)', marginBottom: 24 }}>
              
              {/* ── Cabeçalho ─────────────────────────────────────────────── */}
              <div style={{ padding: '22px 28px', background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(6,182,212,0.04))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(16,185,129,0.3)' }}>
                      <ArrowDownCircle size={24} color="white" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 2 }}>Baixa de Pagamento</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 11, background: 'rgba(16,185,129,0.12)', padding: '1px 6px', borderRadius: 4, color: '#10b981', fontWeight: 700 }}>{ca.codigo || '—'}</code>
                        <span>{conta.descricao}</span>
                        {diasAtraso > 0 && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4 }}>⚠ {diasAtraso}d em atraso</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setBaixaId(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
                </div>

                {/* Info rápida do compromisso */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 16 }}>
                  {[
                    { label: 'Valor Original', value: fmtC(conta.valor), color: '#f87171' },
                    { label: 'Vencimento', value: conta.vencimento ? new Date(conta.vencimento + 'T12:00').toLocaleDateString('pt-BR') : '—', color: diasAtraso > 0 ? '#f87171' : 'hsl(var(--text-primary))' },
                    { label: 'Fornecedor', value: conta.fornecedor || '—', color: 'hsl(var(--text-primary))' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: 'Outfit,sans-serif' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Corpo ─────────────────────────────────────────────────── */}
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Aviso sem caixa aberto */}
                {!caixaAberto && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={14} />Nenhum caixa aberto. A baixa será registrada sem vínculo de caixa.
                  </div>
                )}

                {/* Linha: Caixa + Tipo Doc + Data Pagamento */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 140px 160px', gap: 14, alignItems: 'flex-end' }}>
                  <div>
                    <label className="form-label">Caixa</label>
                    <select className="form-input" value={baixaForm.caixaId} onChange={e => setBF('caixaId', e.target.value)} style={{ height: 38, fontSize: 13 }}>
                      <option value="">Sem vínculo de caixa</option>
                      {caixasAbertos.filter(cx => !cx.fechado).map(cx => (
                        <option key={cx.id} value={cx.id}>{(cx as any).nomeCaixa || (cx as any).codigo || cx.operador} — {cx.operador}</option>
                      ))}
                      {caixasAbertos.filter(cx => cx.fechado).length > 0 && (
                        <optgroup label="Fechados">
                          {caixasAbertos.filter(cx => cx.fechado).map(cx => (
                            <option key={cx.id} value={cx.id}>{(cx as any).nomeCaixa || cx.operador} (fechado)</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tipo de Documento</label>
                    <select className="form-input" value={baixaForm.tipoDoc} onChange={e => setBF('tipoDoc', e.target.value)} style={{ height: 38, fontSize: 13 }}>
                      {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Data do Pagamento</label>
                    <input type="date" className="form-input" value={baixaForm.dataPagamento} onChange={e => setBF('dataPagamento', e.target.value)} style={{ height: 38, fontSize: 13 }} />
                  </div>
                </div>

                {/* Plano de Contas */}
                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Layers size={11} />Plano de Contas / Conta de Crédito
                    {planoSelecionado && <span style={{ fontSize: 10, color: '#10b981', marginLeft: 4, fontWeight: 600 }}>✓ Auto-selecionado</span>}
                  </label>
                  {cfgPlanoContas.filter(p => p.grupoConta === 'despesas' && p.situacao === 'ativo').length > 0 ? (
                    <select className="form-input" value={baixaForm.planoContasId} onChange={e => setBF('planoContasId', e.target.value)} style={{ height: 38, fontSize: 13 }}>
                      <option value="">Selecionar conta do plano</option>
                      {cfgPlanoContas.filter(p => p.grupoConta === 'despesas' && p.situacao === 'ativo').map(p => (
                        <option key={p.id} value={p.id}>{(p as any).codPlano} — {p.descricao}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="form-input" placeholder="Configure em Plano de Contas → Config. Financeiro" disabled style={{ opacity: 0.5 }} />
                  )}
                </div>

                {/* Painel Financeiro ─ destaque */}
                <div style={{ borderRadius: 14, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg,rgba(239,68,68,0.06),rgba(245,158,11,0.03))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Receipt size={14} color="#f87171" />
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Composição Financeira</span>
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'flex-end' }}>
                      <div>
                        <label className="form-label">Valor Original (R$)</label>
                        <input type="number" className="form-input" value={baixaForm.valorOriginal}
                          onChange={e => setBF('valorOriginal', +e.target.value)} min={0} step={0.01}
                          style={{ fontWeight: 800, color: '#f87171', fontSize: 13, height: 38 }} />
                      </div>
                      <div>
                        <label className="form-label" style={{ color: '#10b981' }}>Desconto (R$)</label>
                        <input type="number" className="form-input" value={baixaForm.desconto}
                          onChange={e => setBF('desconto', +e.target.value)} min={0} step={0.01}
                          style={{ color: '#10b981', fontWeight: 700, fontSize: 13, height: 38 }} />
                      </div>
                      <div>
                        <label className="form-label" style={{ color: '#f59e0b' }}>Juros (R$)</label>
                        <input type="number" className="form-input" value={baixaForm.juros}
                          onChange={e => setBF('juros', +e.target.value)} min={0} step={0.01}
                          style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, height: 38 }} />
                      </div>
                      <div>
                        <label className="form-label" style={{ color: '#ef4444' }}>Multa (R$)</label>
                        <input type="number" className="form-input" value={baixaForm.multa}
                          onChange={e => setBF('multa', +e.target.value)} min={0} step={0.01}
                          style={{ color: '#ef4444', fontWeight: 700, fontSize: 13, height: 38 }} />
                      </div>
                    </div>

                    {/* Valor Líquido em destaque */}
                    <div style={{ padding: '14px 18px', borderRadius: 12, background: `linear-gradient(135deg, ${valorLiquido >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}, transparent)`, border: `1px solid ${valorLiquido >= conta.valor ? 'rgba(245,158,11,0.3)' : valorLiquido < conta.valor ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 2 }}>VALOR LÍQUIDO A PAGAR</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#10b981', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em' }}>
                          {fmtC(valorLiquido)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        {baixaForm.desconto > 0 && <div style={{ color: '#10b981' }}>- {fmtC(baixaForm.desconto)} desconto</div>}
                        {baixaForm.juros > 0 && <div style={{ color: '#f59e0b' }}>+ {fmtC(baixaForm.juros)} juros</div>}
                        {baixaForm.multa > 0 && <div style={{ color: '#ef4444' }}>+ {fmtC(baixaForm.multa)} multa</div>}
                        {(baixaForm.desconto > 0 || baixaForm.juros > 0 || baixaForm.multa > 0) && (
                          <div style={{ marginTop: 4, fontWeight: 700, color: valorLiquido < conta.valor ? '#10b981' : '#f59e0b' }}>
                            {valorLiquido < conta.valor ? `↓ ${fmtC(conta.valor - valorLiquido)} economizado` : `↑ ${fmtC(valorLiquido - conta.valor)} acréscimo`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Composição da Baixa (método de pagamento) */}
                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CreditCard size={11} />Composição da Baixa — Método de Pagamento
                  </label>
                  {metodosPagamento.filter(m => m.situacao === 'ativo').length > 0 ? (
                    <>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {metodosPagamento.filter(m => m.situacao === 'ativo').slice(0, 8).map(m => (
                          <button key={m.id} type="button"
                            onClick={() => setBF('composicao', m.id)}
                            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: `2px solid ${baixaForm.composicao === m.id ? '#10b981' : 'hsl(var(--border-subtle))'}`, background: baixaForm.composicao === m.id ? 'rgba(16,185,129,0.1)' : 'transparent', color: baixaForm.composicao === m.id ? '#10b981' : 'hsl(var(--text-muted))', cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}>
                            {m.nome}
                          </button>
                        ))}
                      </div>
                      {metodoSelecionado && (
                        <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <BadgeCheck size={12} />Pagamento via <strong>{metodoSelecionado.nome}</strong>
                        </div>
                      )}
                    </>
                  ) : (
                    <select className="form-input" value={baixaForm.composicao} onChange={e => setBF('composicao', e.target.value)}>
                      {['PIX','Dinheiro','Boleto','Cartão de Crédito','Cartão de Débito','Transferência'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="form-label">Observações</label>
                  <textarea className="form-input" rows={2} value={baixaForm.obs} onChange={e => setBF('obs', e.target.value)}
                    placeholder="Ex: Pagamento via PIX, número de comprovante, negociação especial..." style={{ resize: 'none', fontSize: 13 }} />
                </div>
              </div>

              {/* ── Footer ─────────────────────────────────────────────────── */}
              <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))' }}>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  Valor líquido: <strong style={{ color: '#10b981', fontSize: 14 }}>{fmtC(valorLiquido)}</strong>
                  {metodoSelecionado && <span> • via <strong>{metodoSelecionado.nome}</strong></span>}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setBaixaId(null)}>Cancelar</button>
                  <button
                    className="btn"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: 800, boxShadow: '0 4px 16px rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={confirmarBaixa}>
                    <ArrowDownCircle size={15} />Confirmar Baixa — {fmtC(valorLiquido)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <ConfirmModal open={confirmId !== null} onClose={() => setConfirmId(null)} onConfirm={handleDelete}
        message="A conta a pagar será removida permanentemente." />
    </div>
  )
}
