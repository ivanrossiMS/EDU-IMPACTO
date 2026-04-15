'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import { useState, useMemo, useEffect, useRef } from 'react'
import { useData, CaixaAberta, MovCaixaItem } from '@/lib/dataContext'
import { DollarSign, Plus, Lock, Unlock, Check, X, Pencil, Trash2, AlertTriangle, RotateCcw, ChevronRight, TrendingUp, TrendingDown, Wallet, ArrowLeftRight } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useApp } from '@/lib/context'
import { useRouter } from 'next/navigation'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const nowStr = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const todayStr = () => new Date().toISOString().slice(0, 10)

const MOV_TIPOS: any[] = [
  { value: 'entrada',    label: 'Entrada',    color: '#10b981', icon: <TrendingUp size={14} /> },
  { value: 'receita',    label: 'Receita',    color: '#10b981', icon: <TrendingUp size={14} /> },
  { value: 'suprimento', label: 'Suprimento', color: '#3b82f6', icon: <Plus size={14} /> },
  { value: 'saida',      label: 'Saída',      color: '#ef4444', icon: <TrendingDown size={14} /> },
  { value: 'despesa',    label: 'Despesa',    color: '#ef4444', icon: <TrendingDown size={14} /> },
  { value: 'sangria',    label: 'Sangria',    color: '#f59e0b', icon: <ArrowLeftRight size={14} /> },
]

// Planos de contas padrão para caixa
const PLANOS_CONTAS = [
  { grupo: 'Receitas Educacionais', itens: ['Mensalidades', 'Matrículas', 'Material Didático', 'Atividades Extracurriculares', 'Cantina – Receita', 'Transporte – Receita'] },
  { grupo: 'Receitas Diversas',     itens: ['Aluguel de Espaço', 'Patrocínios', 'Doações', 'Outras Receitas'] },
  { grupo: 'Despesas Administrativas', itens: ['Salários e Encargos', 'Aluguel do Imóvel', 'Energia Elétrica', 'Água e Saneamento', 'Internet e Telefone', 'Material de Escritório', 'Limpeza e Higiene'] },
  { grupo: 'Despesas Pedagógicas',  itens: ['Material Didático – Custo', 'Eventos e Formaturas', 'Capacitação Docente', 'Licenças de Software'] },
  { grupo: 'Despesas Financeiras',  itens: ['Tarifas Bancárias', 'Juros e Multas', 'Desconto de Títulos'] },
  { grupo: 'Suprimento / Sangria',  itens: ['Suprimento de Caixa', 'Sangria para Banco', 'Troco Inicial'] },
]
const TODOS_PLANOS = PLANOS_CONTAS.flatMap(g => g.itens)

const BANCOS = ['Banco do Brasil', 'Bradesco', 'Caixa Econômica', 'Itaú', 'Santander', 'Nubank', 'Inter', 'Sicoob', 'Sicredi', 'Outros']

function gerarCodCaixa(existentes: CaixaAberta[]) {
  let i = existentes.length + 1
  let cod = `CX${String(i).padStart(3, '0')}`
  const codigos = existentes.map((c: any) => c.codigo).filter(Boolean)
  while (codigos.includes(cod)) { i++; cod = `CX${String(i).padStart(3, '0')}` }
  return cod
}

type CaixaForm = {
  codigo: string; nomeCaixa: string; operador: string
  unidade: string; saldoInicial: string; dataAbertura: string; baixaOutroUsuario: boolean
}
type MovForm = {
  caixaId: string; tipo: MovCaixaItem['tipo']; descricao: string
  valor: string; planoContas: string; compensadoBanco: string
}

import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import { useBaixaIntegrada } from '@/lib/useBaixaIntegrada'

// ──────────────────────────────────────────────────────────────────────────────
export default function AberturaCaixaPage() {
  const router = useRouter()
  // Recupera caixasAbertos para resgatar os legados salvos no LocalStorage antes da migração pro Banco
  const { mantenedores = [], movimentacoesManuais = [], logSystemAction, setCaixasAbertos } = useData();
  const [funcionarios, setFuncionarios] = useSupabaseArray<any>('rh/funcionarios');
  const [caixasLegados, setCaixasLegados] = useSupabaseArray<any>('financeiro/caixas');
  const { currentUserPerfil } = useApp()
  const queryClient = useQueryClient()

  // ⚡ SSR Query Principal de Caixas
  const { data: respCaixas, isLoading: loadCaixas } = useApiQuery<{data: any[], meta: any}>(
    ['caixas-pdv'], '/api/financeiro/caixas', 
    { limit: 200 }
  )
  const caixasDb = respCaixas?.data || []

  // 🔄 Merge: Prioriza o Banco, mas injeta visualmente Caixas Legados que ainda não foram pro Banco
  const caixasAbertos = useMemo(() => {
    const mapDbIds = new Set(caixasDb.map(c => c.id))
    const caixasFaltantes = (caixasLegados || []).filter(c => !mapDbIds.has(c.id))
    return [...caixasDb, ...caixasFaltantes]
  }, [caixasDb, caixasLegados])

  // ⚡ Mutations Enterprise
  const mutCaixas = useApiMutation('/api/financeiro/caixas', 'POST', [['caixas-pdv']])
  const delCaixas = useApiMutation('/api/financeiro/caixas', 'DELETE', [['caixas-pdv']])
  const mutMovs = useApiMutation('/api/financeiro/movimentacoes', 'POST', [['caixas-pdv']])

  // 🔄 Sync Automático para o Banco de Dados dos Caixas Legados (Executa apenas uma vez)
  const syncAttempted = useRef(false)
  useEffect(() => {
    if (loadCaixas || syncAttempted.current) return
    const mapDbIds = new Set(caixasDb.map(c => c.id))
    const caixasFaltantes = (caixasLegados || []).filter((c: any) => !mapDbIds.has(c.id))
    
    // So try to sync if there are missing items, AND we have some valid list of DB items (meaning GET succeeded or is definitively empty)
    if (caixasFaltantes.length > 0 && Array.isArray(respCaixas?.data)) {
      syncAttempted.current = true
      // Envia os legados em lote; a API suporta Array
      mutCaixas.mutateAsync(caixasFaltantes as any).then(() => {
        setCaixasAbertos([]) // Sucesso absoluto syncronizado, limpa
      }).catch(e => {
        console.error('Erro no AutoSync:', e)
        // Se der erro irreversível de schema (_zod / validation), destrói o fantasma para não travar o ERP do usuário
        setCaixasAbertos((prev: any) => (prev || []).filter((c: any) => !caixasFaltantes.find((f: any) => f.id === c.id)))
      })
    }
  }, [caixasDb, caixasLegados, loadCaixas, mutCaixas, respCaixas?.data])

  // IDs de baixas válidas (ainda não estornadas) — usados para filtrar extrato do caixa
  const idsValidos = useMemo(() => new Set((movimentacoesManuais || []).map((m: any) => m.id)), [movimentacoesManuais])

  /**
   * Filtra as movimentacoes. Historicamente ignorava baixas estornadas via cache.
   * Hoje o DB é soberano. Se vem do banco, exibe.
   */
  const movsVisiveis = (movimentacoes: MovCaixaItem[]): MovCaixaItem[] => {
    return movimentacoes || []
  }

  const [sysUsers] = useLocalStorage<{ id: string; nome: string; email: string; cargo: string; perfil: string; status: string }[]>('edu-sys-users', [])
  const isAdmin = currentUserPerfil === 'Diretor Geral' || currentUserPerfil === 'Coordenador'

  const operadoresDisponiveis = (sysUsers || []).filter(u => u.status === 'ativo').length > 0
    ? (sysUsers || []).filter(u => u.status === 'ativo').map(u => ({ nome: u.nome, cargo: u.cargo || u.perfil }))
    : (funcionarios || []).filter(f => f.status === 'ativo').map(f => ({ nome: f.nome, cargo: f.cargo }))

  const unidades = useMemo(() =>
    (mantenedores || []).flatMap(m => (m.unidades || []).map(u => u.nomeFantasia || u.razaoSocial)), [mantenedores])

  // ── State ────────────────────────────────────────────────────────────────
  const [modalCaixa, setModalCaixa] = useState<'new' | 'edit' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [showMov, setShowMov] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmFechar, setConfirmFechar] = useState<string | null>(null)
  const [selectedCaixaId, setSelectedCaixaId] = useState<string | null>(null)
  const [caixaDetalheId, setCaixaDetalheId] = useState<string | null>(null)

  const [form, setForm] = useState<CaixaForm>({
    codigo: '', nomeCaixa: '', operador: '', unidade: '',
    saldoInicial: '0', dataAbertura: todayStr(), baixaOutroUsuario: false,
  })
  const [movForm, setMovForm] = useState<MovForm>({
    caixaId: '', tipo: 'entrada', descricao: '', valor: '', planoContas: '', compensadoBanco: '',
  })
  const [movErrors, setMovErrors] = useState<Record<string, string>>({})

  // ── Computed ─────────────────────────────────────────────────────────────
  const caixasVisiveis = isAdmin
    ? caixasAbertos
    : caixasAbertos // por ora mostra todos; poderá filtrar por operador logado no futuro

  const selectedCaixa = caixasAbertos.find((c:any) => c.id === selectedCaixaId) ?? null
  const primeiroOp = operadoresDisponiveis[0]?.nome ?? ''

  // ⚡ Query Secundária: Movimentações do Caixa Selecionado/Detalhe
  const focusCaixaId = caixaDetalheId || selectedCaixaId
  const { data: respMovs } = useApiQuery<{data: any[]}>([`movs-${focusCaixaId}`], `/api/financeiro/movimentacoes`, { limit: 1400, caixaId: focusCaixaId }, { enabled: !!focusCaixaId })
  const movsAtuais = respMovs?.data || []

  // ⚡ SSR Query Geral de Movimentações para somar Totalizadores (Opção temporária pra KPIs, idealmente backend soma isso)
  const { data: respAllMovs } = useApiQuery<{data: any[]}>([`movs-todas`], `/api/financeiro/movimentacoes`, { limit: 5000 })
  const allMovs = respAllMovs?.data || []

  const calcSaldo = (c: CaixaAberta) => {
    // Busca exclusivamente do cache global que já tem tracking real-time unificado
    const movsDoCaixa = (allMovs || []).filter(m => (m.caixa_id || m.caixaId) === c.id)
    const movsFiltradas = movsVisiveis(movsDoCaixa)
    const ent = movsFiltradas.filter(m => ['entrada', 'suprimento', 'receita'].includes(m.tipo)).reduce((s, m) => s + (Number(m.valor) || 0), 0)
    const sai = movsFiltradas.filter(m => ['saida', 'sangria', 'despesa'].includes(m.tipo)).reduce((s, m) => s + (Number(m.valor) || 0), 0)
    const rawSaldoInicial = (c as any).saldo_inicial ?? c.saldoInicial;
    const initialRaw = typeof rawSaldoInicial === 'string' ? rawSaldoInicial.replace(/[R$\s]/g, '').replace(',', '.') : rawSaldoInicial;
    const safeInitial = isNaN(Number(initialRaw)) ? 0 : Number(initialRaw);
    return safeInitial + ent - sai
  }

  const saldoSel = selectedCaixa ? calcSaldo(selectedCaixa) : 0

  // KPIs globais
  const totalAbertos  = (caixasAbertos || []).filter((c:any) => !c.fechado).length
  const totalFechados  = (caixasAbertos || []).filter((c:any) => c.fechado).length
  const saldoGlobal   = (caixasAbertos || []).filter((c:any) => !c.fechado).reduce((s:number, c:any) => s + calcSaldo(c), 0)
  
  const movsGlobaisAbertos = (allMovs || []).filter(m => {
    const cx = caixasAbertos.find((c:any) => c.id === (m.caixa_id || m.caixaId))
    return cx && !cx.fechado
  })
  const movGlobaisFiltrados = movsVisiveis(movsGlobaisAbertos)

  const entGlobal     = movGlobaisFiltrados.filter(m => ['entrada', 'suprimento', 'receita'].includes(m.tipo)).reduce((s, m) => s + (Number(m.valor) || 0), 0)
  const saiGlobal     = movGlobaisFiltrados.filter(m => ['saida', 'sangria', 'despesa'].includes(m.tipo)).reduce((s, m) => s + (Number(m.valor) || 0), 0)

  // ── Caixa CRUD ───────────────────────────────────────────────────────────
  const openNew = () => {
    const nome = operadoresDisponiveis[0]?.nome ?? ''
    const data = todayStr()
    setForm({
      codigo: gerarCodCaixa(caixasAbertos),
      nomeCaixa: nome ? `Caixa de ${nome.split(' ')[0]} — ${new Date().toLocaleDateString('pt-BR')}` : `Caixa ${data}`,
      operador: nome, unidade: unidades[0] ?? '',
      saldoInicial: '0', dataAbertura: data, baixaOutroUsuario: false,
    })
    setEditId(null); setModalCaixa('new')
  }

  const openEdit = (c: CaixaAberta) => {
    const ca = c as any
    setForm({ codigo: ca.codigo || '', nomeCaixa: ca.nomeCaixa || ca.nome_caixa || '', operador: c.operador || '',
      unidade: ca.unidade || '', saldoInicial: String(c.saldoInicial ?? ca.saldo_inicial ?? 0),
      dataAbertura: ca.dataAbertura || ca.data_abertura || todayStr(), baixaOutroUsuario: ca.baixaOutroUsuario ?? ca.baixa_outro_usuario ?? false })
    setEditId(c.id); setModalCaixa('edit')
  }

  const handleSaveCaixa = async () => {
    if (!form.operador) return
    const payload = {
        codigo: form.codigo,
        nome_caixa: form.nomeCaixa || `Caixa ${form.dataAbertura}`,
        operador: form.operador, unidade: form.unidade,
        baixa_outro_usuario: form.baixaOutroUsuario,
        saldo_inicial: +form.saldoInicial
    }

    try {
        if (modalCaixa === 'new') {
            await mutCaixas.mutateAsync({ ...payload, data_abertura: form.dataAbertura, hora_abertura: nowStr(), fechado: false } as any)
            logSystemAction('Financeiro (Caixa)', 'Abertura de Caixa', `Caixa ${form.codigo} aberto por ${form.operador}`)
            // Ao rodar queryClient, selectedCaixaId pode ser ajustado
        } else if (modalCaixa === 'edit' && editId) {
            await mutCaixas.mutateAsync({ id: editId, ...payload } as any)
        }
    } catch(e) { console.error(e) }
    
    setModalCaixa(null)
  }

  const fecharCaixa = async (id: string) => {
    const bx = caixasAbertos.find((c:any) => c.id === id)
    if (!bx) return
    try {
        await mutCaixas.mutateAsync({ id, fechado: true, hora_fechamento: nowStr(), saldo_final: calcSaldo(bx) } as any)
        logSystemAction('Financeiro (Caixa)', 'Fechamento de Caixa', `Caixa ${(bx as any).codigo} fechado. Saldo Final: ${calcSaldo(bx)}`)
    } catch(e) { console.error(e) }
    setConfirmFechar(null)
  }

  const reabrirCaixa = async (id: string) => {
    const bx = caixasAbertos.find((c:any) => c.id === id)
    try {
        await mutCaixas.mutateAsync({ id, fechado: false, hora_fechamento: null, saldo_final: null } as any)
        logSystemAction('Financeiro (Caixa)', 'Reabertura de Caixa', `Caixa ${(bx as any)?.codigo} reaberto pelo superior.`)
    } catch(e) { console.error(e) }
  }

  const handleDelete = async (id: string) => {
    try {
        await delCaixas.mutateAsync({ id })
        if (selectedCaixaId === id) setSelectedCaixaId(null)
        // Destrói o zumbi legado em memória/localstorage se existir
        setCaixasAbertos((prev: any) => (prev || []).filter((c: any) => c.id !== id))
    } catch(e) { console.error(e) }
    setConfirmDelete(null)
  }

  // ── Lançamento ───────────────────────────────────────────────────────────
  const openMov = (caixaId?: string) => {
    setMovForm({ caixaId: caixaId ?? selectedCaixaId ?? '', tipo: 'entrada', descricao: '', valor: '', planoContas: '', compensadoBanco: '' })
    setMovErrors({})
    setShowMov(true)
  }

  const validarMov = (): boolean => {
    const errs: Record<string, string> = {}
    if (!movForm.caixaId)       errs.caixaId       = 'Selecione o caixa'
    if (!movForm.valor || +movForm.valor <= 0) errs.valor = 'Informe um valor válido'
    if (!movForm.planoContas)   errs.planoContas   = 'Selecione o plano de contas'
    if (!movForm.compensadoBanco) errs.compensadoBanco = 'Informe compensação bancária'
    setMovErrors(errs)
    return Object.keys(errs).length === 0
  }

  const adicionarMov = async () => {
    if (!validarMov()) return
    const caixaAlvo = caixasAbertos.find((c:any) => c.id === movForm.caixaId)
    if (!caixaAlvo || caixaAlvo.fechado) return
    const mov = {
      tipo: movForm.tipo, descricao: movForm.descricao || movForm.planoContas,
      valor: +movForm.valor, hora: nowStr(), operador: caixaAlvo.operador,
      plano_contas_id: movForm.planoContas, compensado_banco: movForm.compensadoBanco, caixa_id: movForm.caixaId,
      origem: 'avulso_caixa'
    }
    
    try {
        await mutMovs.mutateAsync(mov as any)
        logSystemAction('Financeiro (Caixa)', 'Lançamento', `Movimentação Manual de ${movForm.tipo}: R$ ${movForm.valor}`)
    } catch(e) { console.error(e) }

    setShowMov(false)
  }

  const setF = (k: keyof CaixaForm, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const setM = (k: keyof MovForm, v: string) => { setMovForm(p => ({ ...p, [k]: v })); setMovErrors(e => ({ ...e, [k]: '' })) }

  const caixasAbertosLista = [...caixasVisiveis].sort((a, b) => {
    if (!a.fechado && b.fechado) return -1
    if (a.fechado && !b.fechado) return 1
    const tA = a.dataAbertura || a.data_abertura || ''
    const tB = b.dataAbertura || b.data_abertura || ''
    return tB.localeCompare(tA)
  })

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Abertura de Caixa</h1>
          <p className="page-subtitle">Múltiplos caixas · Lançamentos · Conferência de saldo</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Unlock size={13} />Novo Caixa</button>
      </div>

      {/* KPIs globais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Caixas Abertos',   value: totalAbertos,           color: '#10b981', icon: '🟢', fmt: false },
          { label: 'Caixas Fechados',  value: totalFechados,           color: '#6b7280', icon: '🔒', fmt: false },
          { label: 'Saldo Total (Abertos)', value: saldoGlobal,         color: saldoGlobal >= 0 ? '#10b981' : '#ef4444', icon: '💰', fmt: true },
          { label: 'Entradas Hoje',    value: entGlobal,               color: '#3b82f6', icon: '⬆️', fmt: true },
          { label: 'Saídas Hoje',      value: saiGlobal,               color: '#ef4444', icon: '⬇️', fmt: true },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:16 }}>{k.icon}</span>
              <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: k.fmt ? 16 : 28, fontWeight:800, color:k.color, fontFamily:'Outfit,sans-serif' }}>
              {k.fmt ? fmt(k.value as number) : k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Layout: lista de caixas */}
      <div style={{ fontWeight:700, fontSize:11, color:'hsl(var(--text-muted))', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>
        {caixasAbertosLista.length} caixa(s)
      </div>

      {caixasAbertosLista.length === 0 ? (
        <div style={{ padding:'40px 16px', textAlign:'center', border:'1px dashed hsl(var(--border-subtle))', borderRadius:12, color:'hsl(var(--text-muted))' }}>
          <Wallet size={42} style={{ margin:'0 auto 10px', opacity:0.2 }} />
          <div style={{ fontSize:14, fontWeight:600 }}>Nenhum caixa criado</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={openNew}><Unlock size={12} />Criar Caixa</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
          {caixasAbertosLista.map(c => {
            const ca = c as any
            const movsDoCard = movsVisiveis(c.movimentacoes || [])
            const saldo = c.saldoFinal ?? calcSaldo(c)
            const hasMovs = movsDoCard.length > 0
            const cor = c.fechado ? '#6b7280' : '#10b981'

            return (
              <div key={c.id}
                onClick={() => setCaixaDetalheId(c.id)}
                style={{ borderRadius:12, border:`1.5px solid hsl(var(--border-subtle))`, background:'hsl(var(--bg-elevated))', cursor:'pointer', overflow:'hidden', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${cor}40`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.transform = 'none' }}>

                {/* Barra de status topo */}
                <div style={{ height:3, background: c.fechado ? '#6b7280' : '#10b981' }} />

                <div style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', minWidth:0 }}>
                      {ca.codigo && <code style={{ fontSize:10, padding:'1px 5px', background:'hsl(var(--bg-overlay))', borderRadius:4, color:'#60a5fa', flexShrink:0 }}>{ca.codigo}</code>}
                      <span style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {ca.nomeCaixa || ca.nome_caixa || ( (c.dataAbertura || ca.data_abertura) ? new Date((c.dataAbertura || ca.data_abertura) + 'T12:00').toLocaleDateString('pt-BR') : 'Caixa (Sem Data)' )}
                      </span>
                    </div>
                    {c.fechado
                      ? <span className="badge badge-neutral" style={{ flexShrink:0, fontSize:10 }}>Fechado</span>
                      : <span className="badge badge-success" style={{ flexShrink:0, fontSize:10 }}>Aberto</span>}
                  </div>
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginBottom:6 }}>{c.operador} · {c.horaAbertura} · {hasMovs ? `${movsDoCard.length} mov.` : 'sem movimentos'}</div>
                  <div style={{ fontWeight:900, color: c.fechado ? '#6b7280' : (saldo >= 0 ? '#10b981' : '#ef4444'), fontSize:16, fontFamily:'Outfit,sans-serif' }}>{fmt(saldo)}</div>
                </div>

                {/* Ações */}
                <div style={{ padding:'6px 10px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', gap:4, background:'hsl(var(--bg-overlay))' }}
                  onClick={e => e.stopPropagation()}>
                  {/* Lançar */}
                  {!c.fechado && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#10b981', flex:1 }} onClick={(e) => { e.stopPropagation(); router.push('/financeiro/movimentacoes'); }}>
                      <Plus size={11} />Lançar
                    </button>
                  )}
                  {/* Fechar */}
                  {!c.fechado && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#f59e0b' }} title="Fechar caixa" onClick={() => setConfirmFechar(c.id)}>
                      <Lock size={11} />
                    </button>
                  )}
                  {/* Reabrir */}
                  {c.fechado && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#3b82f6', flex:1 }} title="Reabrir caixa" onClick={() => reabrirCaixa(c.id)}>
                      <RotateCcw size={11} />Reabrir
                    </button>
                  )}
                  {/* Editar */}
                  <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(c)}>
                    <Pencil size={11} />
                  </button>
                  {/* Excluir — bloqueado se tiver lançamentos */}
                  <button className="btn btn-ghost btn-icon btn-sm"
                    title={hasMovs ? 'Não é possível excluir caixa com lançamentos' : 'Excluir'}
                    style={{ color: hasMovs ? 'hsl(var(--text-muted))' : '#f87171', cursor: hasMovs ? 'not-allowed' : 'pointer', opacity: hasMovs ? 0.4 : 1 }}
                    disabled={hasMovs}
                    onClick={(e) => { e.stopPropagation(); if(!hasMovs) setConfirmDelete(c.id); }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Modal: Novo / Editar Caixa ─────────────────────────────── */}
      {modalCaixa && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'hsl(var(--bg-base))', borderRadius:20, width:'100%', maxWidth:520, border:'1px solid hsl(var(--border-subtle))', overflow:'hidden', boxShadow:'0 40px 100px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', maxHeight:'90vh' }}>
            <div style={{ padding:'20px 24px', background:'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(59,130,246,0.04))', borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background: modalCaixa === 'edit' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {modalCaixa === 'edit' ? <Pencil size={20} color="#3b82f6" /> : <Unlock size={20} color="#10b981" />}
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:16 }}>{modalCaixa === 'edit' ? 'Editar Caixa' : 'Abrir Novo Caixa'}</div>
                  <code style={{ fontSize:12, fontWeight:900, color:'#10b981', background:'rgba(16,185,129,0.1)', padding:'1px 7px', borderRadius:4 }}>{form.codigo}</code>
                </div>
              </div>
              <button onClick={() => setModalCaixa(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            <div style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto', flex:1 }}>
              <div>
                <label className="form-label">Nome do Caixa *</label>
                <input className="form-input" value={form.nomeCaixa} onChange={e => setF('nomeCaixa', e.target.value)} placeholder="Ex: Caixa Principal, Caixa Secretaria..." style={{ fontWeight:600 }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label className="form-label">Data de Abertura</label>
                  <input type="date" className="form-input" value={form.dataAbertura} onChange={e => setF('dataAbertura', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Fundo de Caixa (R$)</label>
                  <input type="number" className="form-input" value={form.saldoInicial} onChange={e => setF('saldoInicial', e.target.value)} min={0} step={50} style={{ fontWeight:700, color:'#10b981' }} />
                </div>
              </div>
              <div>
                <label className="form-label">Operador *</label>
                {operadoresDisponiveis.length > 0 ? (
                  <select className="form-input" value={form.operador}
                    onChange={e => { const n = e.target.value; setForm(p => ({ ...p, operador: n, nomeCaixa: p.nomeCaixa.startsWith('Caixa de') ? `Caixa de ${n.split(' ')[0]} — ${new Date().toLocaleDateString('pt-BR')}` : p.nomeCaixa })) }}>
                    <option value="">Selecionar operador...</option>
                    {operadoresDisponiveis.map(op => <option key={op.nome} value={op.nome}>{op.nome} — {op.cargo}</option>)}
                  </select>
                ) : (
                  <input className="form-input" placeholder="Nome do operador" value={form.operador} onChange={e => setF('operador', e.target.value)} />
                )}
                <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:3 }}>
                  {(sysUsers || []).filter(u => u.status === 'ativo').length > 0 ? `${(sysUsers || []).filter(u => u.status === 'ativo').length} usuário(s) cadastrados` : 'Cadastre usuários em Configurações → Usuários'}
                </div>
              </div>
              {unidades.length > 0 && (
                <div>
                  <label className="form-label">Unidade</label>
                  <select className="form-input" value={form.unidade} onChange={e => setF('unidade', e.target.value)}>
                    <option value="">Selecionar unidade</option>
                    {unidades.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              )}
              <div style={{ padding:'12px 16px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>Aceita baixa de outro operador</div>
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Outro operador pode registrar movimentos neste caixa</div>
                </div>
                <button onClick={() => setF('baixaOutroUsuario', !form.baixaOutroUsuario)}
                  style={{ width:46, height:24, borderRadius:12, border:'none', cursor:'pointer', background: form.baixaOutroUsuario ? '#3b82f6' : 'hsl(var(--border-default))', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'white', position:'absolute', top:3, left: form.baixaOutroUsuario ? 25 : 3, transition:'left 0.2s' }} />
                </button>
              </div>
            </div>

            <div style={{ padding:'14px 24px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'flex-end', gap:10, background:'hsl(var(--bg-elevated))', flexShrink:0 }}>
              <button className="btn btn-secondary" onClick={() => setModalCaixa(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveCaixa} disabled={!form.operador}>
                {modalCaixa === 'edit' ? <><Check size={14} />Salvar</> : <><Unlock size={14} />Abrir Caixa</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Lançamento (campo obrigatório) ───────────────────── */}
      {showMov && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'hsl(var(--bg-base))', borderRadius:18, width:'100%', maxWidth:540, border:'1px solid hsl(var(--border-subtle))', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-elevated))', fontWeight:800, fontSize:16, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              Lançamento no Caixa
              <button onClick={() => setShowMov(false)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto', flex:1 }}>

              {/* Caixa destino */}
              <div>
                <label className="form-label">Caixa * {movErrors.caixaId && <span style={{ color:'#f87171', fontSize:11 }}>— {movErrors.caixaId}</span>}</label>
                <select className="form-input" style={{ borderColor: movErrors.caixaId ? '#f87171' : undefined }} value={movForm.caixaId} onChange={e => setM('caixaId', e.target.value)}>
                  <option value="">Selecionar caixa...</option>
                  {(caixasAbertos || []).filter(c => !c.fechado).map(c => {
                    const ca = c as any
                    return <option key={c.id} value={c.id}>{ca.nomeCaixa || ca.codigo || c.id} — {c.operador} — Saldo: {fmt(calcSaldo(c))}</option>
                  })}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="form-label">Tipo *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                  {MOV_TIPOS.map(t => (
                    <button key={t.value} onClick={() => setM('tipo', t.value)}
                      style={{ padding:'10px 4px', borderRadius:8, border:`2px solid ${movForm.tipo === t.value ? t.color : 'hsl(var(--border-subtle))'}`, background: movForm.tipo === t.value ? `${t.color}15` : 'transparent', color: t.color, fontWeight:700, fontSize:11, cursor:'pointer', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      {t.icon}{t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plano de Contas */}
              <div>
                <label className="form-label">Plano de Contas * {movErrors.planoContas && <span style={{ color:'#f87171', fontSize:11 }}>— {movErrors.planoContas}</span>}</label>
                <select className="form-input" style={{ borderColor: movErrors.planoContas ? '#f87171' : undefined }} value={movForm.planoContas} onChange={e => setM('planoContas', e.target.value)}>
                  <option value="">Selecionar conta...</option>
                  {PLANOS_CONTAS.map(g => (
                    <optgroup key={g.grupo} label={g.grupo}>
                      {g.itens.map(i => <option key={i} value={i}>{i}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Descrição */}
              <div>
                <label className="form-label">Descrição</label>
                <input className="form-input" value={movForm.descricao} onChange={e => setM('descricao', e.target.value)} placeholder="Detalhe do lançamento..." />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {/* Valor */}
                <div>
                  <label className="form-label">Valor (R$) * {movErrors.valor && <span style={{ color:'#f87171', fontSize:11 }}>— {movErrors.valor}</span>}</label>
                  <input type="number" className="form-input" style={{ borderColor: movErrors.valor ? '#f87171' : undefined, fontWeight:700, color:'#10b981' }}
                    value={movForm.valor} onChange={e => setM('valor', e.target.value)} min={0.01} step={0.01} placeholder="0,00" />
                </div>

                {/* Compensado Banco */}
                <div>
                  <label className="form-label">Compensação Banco * {movErrors.compensadoBanco && <span style={{ color:'#f87171', fontSize:11 }}>— {movErrors.compensadoBanco}</span>}</label>
                  <select className="form-input" style={{ borderColor: movErrors.compensadoBanco ? '#f87171' : undefined }} value={movForm.compensadoBanco} onChange={e => setM('compensadoBanco', e.target.value)}>
                    <option value="">Selecionar...</option>
                    <option value="Dinheiro">Dinheiro (sem compensação)</option>
                    <option value="PIX">PIX</option>
                    <option value="Cartão Débito">Cartão Débito</option>
                    <option value="Cartão Crédito">Cartão Crédito</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Transferência">Transferência Bancária</option>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding:'14px 24px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'flex-end', gap:10, background:'hsl(var(--bg-elevated))', flexShrink:0 }}>
              <button className="btn btn-secondary" onClick={() => setShowMov(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={adicionarMov}><Check size={14} />Confirmar Lançamento</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Fechar ──────────────────────────────────────────── */}
      {confirmFechar && (() => {
        const c = caixasAbertos.find(x => x.id === confirmFechar)!
        const ca = c as any
        const sf = calcSaldo(c)
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'hsl(var(--bg-base))', borderRadius:14, width:420, border:'1px solid hsl(var(--border-subtle))', overflow:'hidden' }}>
              <div style={{ padding:'14px 24px', background:'rgba(245,158,11,0.06)', borderBottom:'1px solid hsl(var(--border-subtle))', fontWeight:700, color:'#f59e0b', display:'flex', gap:8, alignItems:'center', fontSize:14 }}>
                <Lock size={15} />Fechar Caixa
              </div>
              <div style={{ padding:'18px 24px', fontSize:13 }}>
                <div style={{ marginBottom:12 }}>Fechar o caixa <strong>{ca.nomeCaixa || ca.codigo}</strong>?</div>
                <div style={{ padding:'12px 14px', background:'hsl(var(--bg-elevated))', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>Saldo final calculado</span>
                  <span style={{ fontWeight:900, fontSize:18, color: sf >= 0 ? '#10b981' : '#ef4444', fontFamily:'Outfit,sans-serif' }}>{fmt(sf)}</span>
                </div>
                <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:8 }}>Registrará horário de fechamento. Você pode reabrir o caixa depois se necessário.</div>
              </div>
              <div style={{ padding:'12px 24px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'flex-end', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmFechar(null)}>Cancelar</button>
                <button className="btn" style={{ background:'#f59e0b', color:'white' }} onClick={() => fecharCaixa(confirmFechar)}>
                  <Lock size={13} />Confirmar Fechamento
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Confirm Excluir ─────────────────────────────────────────── */}
      {confirmDelete && (() => {
        const c = caixasAbertos.find(x => x.id === confirmDelete)!
        const ca = c as any
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'hsl(var(--bg-base))', borderRadius:14, width:400, border:'1px solid hsl(var(--border-subtle))', overflow:'hidden' }}>
              <div style={{ padding:'14px 24px', background:'rgba(239,68,68,0.06)', borderBottom:'1px solid hsl(var(--border-subtle))', fontWeight:700, color:'#f87171', display:'flex', gap:8, alignItems:'center', fontSize:14 }}>
                <AlertTriangle size={15} />Excluir Caixa
              </div>
              <div style={{ padding:'18px 24px', fontSize:13, color:'hsl(var(--text-muted))' }}>
                Excluir o caixa <strong style={{ color:'hsl(var(--text-primary))' }}>{ca.nomeCaixa || ca.codigo}</strong> permanentemente?
                <div style={{ marginTop:8, padding:'10px 12px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, fontSize:12, color:'#f87171' }}>
                  ⚠ Esta ação não pode ser desfeita.
                </div>
              </div>
              <div style={{ padding:'12px 24px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'flex-end', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}><Trash2 size={13} />Excluir</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Modal Detalhes do Caixa ──────────────────────────────────────── */}
      {caixaDetalheId && (() => {
        const c = caixasAbertos.find((x:any) => x.id === caixaDetalheId)!
        if (!c) { setTimeout(() => setCaixaDetalheId(null), 0); return null; }
        const ca = c as any
        const saldo = ca.saldo_final ?? calcSaldo(c)
        // ⚡ Busca da view global segura instanciada pelo react-query
        const movsSafe = movsVisiveis((allMovs || []).filter(m => (m.caixa_id || m.caixaId) === c.id))
        const ent = movsSafe.filter(m => ['entrada', 'suprimento', 'receita'].includes(m.tipo)).reduce((s, m) => s + m.valor, 0)
        const sai = movsSafe.filter(m => ['saida', 'sangria', 'despesa'].includes(m.tipo)).reduce((s, m) => s + m.valor, 0)

        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:24, backdropFilter:'blur(4px)' }}>
            <div style={{ background:'hsl(var(--bg-base))', borderRadius:20, width:'100%', maxWidth:1100, height:'90vh', border:'1px solid hsl(var(--border-subtle))', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 32px 100px rgba(0,0,0,0.7)' }}>
              
              {/* Header */}
              <div style={{ padding:'24px 30px', background:'hsl(var(--bg-elevated))', borderBottom:'1px solid hsl(var(--border-subtle))', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ width:48, height:48, borderRadius:12, background: c.fechado ? '#6b728020' : 'rgba(16,185,129,0.15)', color: c.fechado ? '#6b7280' : '#10b981', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:20, display:'flex', alignItems:'center', gap:10 }}>
                      {ca.nomeCaixa || ca.codigo}
                      {c.fechado ? <span className="badge badge-neutral" style={{fontSize:11}}>Fechado</span> : <span className="badge badge-success" style={{fontSize:11}}>Aberto</span>}
                    </div>
                    <div style={{ fontSize:13, color:'hsl(var(--text-muted))', marginTop:2 }}>
                      Operador: <strong style={{color:'hsl(var(--text-secondary))'}}>{c.operador}</strong> • Aberto em: {(c.dataAbertura || ca.data_abertura) ? new Date((c.dataAbertura || ca.data_abertura) + 'T12:00').toLocaleDateString('pt-BR') : 'Data não registrada'} às {c.horaAbertura || ca.hora_abertura || '--:--'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setCaixaDetalheId(null)} className="btn btn-ghost btn-icon"><X size={20} /></button>
              </div>

              {/* KPIs internos */}
              <div style={{ padding:'24px 30px', borderBottom:'1px solid hsl(var(--border-subtle))', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, flexShrink:0, background:'linear-gradient(135deg,rgba(16,185,129,0.03),rgba(59,130,246,0.03))' }}>
                <div className="card" style={{ padding:16 }}>
                  <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginBottom:6 }}>Saldo Inicial</div>
                  <div style={{ fontSize:22, fontWeight:900, fontFamily:'Outfit,sans-serif' }}>{fmt(isNaN(Number(String(c.saldo_inicial ?? c.saldoInicial ?? 0).replace(/[R$\s]/g, '').replace(',', '.'))) ? 0 : Number(String(c.saldo_inicial ?? c.saldoInicial ?? 0).replace(/[R$\s]/g, '').replace(',', '.')))}</div>
                </div>
                <div className="card" style={{ padding:16, border:'1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize:12, color:'#10b981', fontWeight:700, marginBottom:6, display:'flex', gap:6, alignItems:'center' }}><TrendingUp size={14}/> Entradas / Crédito</div>
                  <div style={{ fontSize:22, fontWeight:900, fontFamily:'Outfit,sans-serif', color:'#10b981' }}>{fmt(ent)}</div>
                </div>
                <div className="card" style={{ padding:16, border:'1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize:12, color:'#ef4444', fontWeight:700, marginBottom:6, display:'flex', gap:6, alignItems:'center' }}><TrendingDown size={14}/> Saídas / Débito</div>
                  <div style={{ fontSize:22, fontWeight:900, fontFamily:'Outfit,sans-serif', color:'#ef4444' }}>{fmt(sai)}</div>
                </div>
                <div className="card" style={{ padding:16, border:`1px solid ${saldo >= 0 ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`, background: saldo >= 0 ? 'rgba(59,130,246,0.04)' : 'rgba(239,68,68,0.04)' }}>
                  <div style={{ fontSize:12, color:saldo >= 0 ? '#3b82f6' : '#ef4444', fontWeight:700, marginBottom:6, display:'flex', gap:6, alignItems:'center' }}><DollarSign size={14}/> Total em Caixa</div>
                  <div style={{ fontSize:22, fontWeight:900, fontFamily:'Outfit,sans-serif', color:saldo >= 0 ? '#3b82f6' : '#ef4444' }}>{fmt(saldo)}</div>
                </div>
              </div>

              {/* Tabela de Lançamentos */}
              <div style={{ flex:1, overflowY:'auto', padding:'24px 30px' }}>
                <div style={{ fontWeight:800, fontSize:15, marginBottom:16 }}>Movimentações do Caixa ({movsSafe.length})</div>
                {movsSafe.length === 0 ? (
                  <div style={{ padding:'40px', textAlign:'center', color:'hsl(var(--text-muted))', border:'1px dashed hsl(var(--border-subtle))', borderRadius:12 }}>
                    Nenhum lançamento registrado neste caixa.
                  </div>
                ) : (
                  <table className="table" style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid hsl(var(--border-subtle))', textAlign:'left', color:'hsl(var(--text-muted))', fontSize:11, textTransform:'uppercase' }}>
                        <th style={{ padding:'10px 14px' }}>Hora</th>
                        <th style={{ padding:'10px 14px' }}>Tipo</th>
                        <th style={{ padding:'10px 14px' }}>Descrição</th>
                        <th style={{ padding:'10px 14px' }}>Conta</th>
                        <th style={{ padding:'10px 14px' }}>Operador</th>
                        <th style={{ padding:'10px 14px', textAlign:'right' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movsSafe.map((m:any) => {
                        const isEntrada = ['entrada', 'suprimento', 'receita'].includes(m.tipo)
                        return (
                          <tr key={m.id} style={{ borderBottom:'1px solid hsl(var(--border-subtle))' }}>
                            <td style={{ padding:'12px 14px', fontSize:12 }}>{m.hora}</td>
                            <td style={{ padding:'12px 14px' }}>
                              <span style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background: isEntrada ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isEntrada ? '#10b981' : '#ef4444', fontWeight:700, textTransform:'capitalize' }}>
                                {m.tipo}
                              </span>
                            </td>
                            <td style={{ padding:'12px 14px', fontWeight:600, fontSize:13 }}>
                              {m.descricao} {(m.compensadoBanco || m.compensado_banco) && <span style={{fontSize:10,color:'hsl(var(--text-muted))',marginLeft:6,fontWeight:400}}>({m.compensadoBanco || m.compensado_banco})</span>}
                            </td>
                            <td style={{ padding:'12px 14px', fontSize:12, color:'hsl(var(--text-muted))' }}>{m.planoContas || m.plano_contas_id || '—'}</td>
                            <td style={{ padding:'12px 14px', fontSize:12 }}>{m.operador}</td>
                            <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:800, fontSize:14, color: isEntrada ? '#10b981' : '#ef4444', fontFamily:'monospace' }}>
                              {isEntrada ? '+' : '-'}{fmt(m.valor)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
