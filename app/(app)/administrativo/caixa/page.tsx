'use client'
import { useState, useMemo } from 'react'
import { useData, CaixaAberta, MovCaixaItem } from '@/lib/dataContext'
import { DollarSign, Plus, Lock, Unlock, Check, X, Pencil, Trash2, AlertTriangle, RotateCcw, ChevronRight, TrendingUp, TrendingDown, Wallet, ArrowLeftRight } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useApp } from '@/lib/context'
import { useRouter } from 'next/navigation'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const nowStr = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const todayStr = () => new Date().toISOString().slice(0, 10)

const MOV_TIPOS: { value: MovCaixaItem['tipo']; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'entrada',    label: 'Entrada',    color: '#10b981', icon: <TrendingUp size={14} /> },
  { value: 'suprimento', label: 'Suprimento', color: '#3b82f6', icon: <Plus size={14} /> },
  { value: 'saida',      label: 'Saída',      color: '#ef4444', icon: <TrendingDown size={14} /> },
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

// ──────────────────────────────────────────────────────────────────────────────
export default function AberturaCaixaPage() {
  const router = useRouter()
  const { funcionarios, mantenedores, caixasAbertos, setCaixasAbertos } = useData()
  const { currentUserPerfil } = useApp()

  const [sysUsers] = useLocalStorage<{ id: string; nome: string; email: string; cargo: string; perfil: string; status: string }[]>('edu-sys-users', [])
  const isAdmin = currentUserPerfil === 'Diretor Geral' || currentUserPerfil === 'Coordenador'

  const operadoresDisponiveis = sysUsers.filter(u => u.status === 'ativo').length > 0
    ? sysUsers.filter(u => u.status === 'ativo').map(u => ({ nome: u.nome, cargo: u.cargo || u.perfil }))
    : funcionarios.filter(f => f.status === 'ativo').map(f => ({ nome: f.nome, cargo: f.cargo }))

  const unidades = useMemo(() =>
    mantenedores.flatMap(m => m.unidades.map(u => u.nomeFantasia || u.razaoSocial)), [mantenedores])

  // ── State ────────────────────────────────────────────────────────────────
  const [modalCaixa, setModalCaixa] = useState<'new' | 'edit' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [showMov, setShowMov] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmFechar, setConfirmFechar] = useState<string | null>(null)
  const [selectedCaixaId, setSelectedCaixaId] = useState<string | null>(null)

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

  const selectedCaixa = caixasAbertos.find(c => c.id === selectedCaixaId) ?? null
  const primeiroOp = operadoresDisponiveis[0]?.nome ?? ''

  const calcSaldo = (c: CaixaAberta) => {
    const ent = c.movimentacoes.filter(m => m.tipo === 'entrada' || m.tipo === 'suprimento').reduce((s, m) => s + m.valor, 0)
    const sai = c.movimentacoes.filter(m => m.tipo === 'saida' || m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0)
    return c.saldoInicial + ent - sai
  }

  const saldoSel = selectedCaixa ? calcSaldo(selectedCaixa) : 0

  // KPIs globais
  const totalAbertos  = caixasAbertos.filter(c => !c.fechado).length
  const totalFechados  = caixasAbertos.filter(c => c.fechado).length
  const saldoGlobal   = caixasAbertos.filter(c => !c.fechado).reduce((s, c) => s + calcSaldo(c), 0)
  const entGlobal     = caixasAbertos.filter(c => !c.fechado).flatMap(c => c.movimentacoes.filter(m => m.tipo === 'entrada' || m.tipo === 'suprimento')).reduce((s, m) => s + m.valor, 0)
  const saiGlobal     = caixasAbertos.filter(c => !c.fechado).flatMap(c => c.movimentacoes.filter(m => m.tipo === 'saida' || m.tipo === 'sangria')).reduce((s, m) => s + m.valor, 0)

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
    setForm({ codigo: ca.codigo || '', nomeCaixa: ca.nomeCaixa || '', operador: c.operador || '',
      unidade: ca.unidade || '', saldoInicial: String(c.saldoInicial ?? 0),
      dataAbertura: c.dataAbertura || todayStr(), baixaOutroUsuario: ca.baixaOutroUsuario ?? false })
    setEditId(c.id); setModalCaixa('edit')
  }

  const handleSaveCaixa = () => {
    if (!form.operador) return
    if (modalCaixa === 'new') {
      const novo: CaixaAberta = {
        id: `CX${Date.now()}`, codigo: form.codigo,
        nomeCaixa: form.nomeCaixa || `Caixa ${form.dataAbertura}`,
        dataAbertura: form.dataAbertura, horaAbertura: nowStr(),
        operador: form.operador, unidade: form.unidade,
        baixaOutroUsuario: form.baixaOutroUsuario,
        saldoInicial: +form.saldoInicial, movimentacoes: [], fechado: false,
      }
      setCaixasAbertos(prev => [...prev, novo])
      setSelectedCaixaId(novo.id)
    } else if (modalCaixa === 'edit' && editId) {
      setCaixasAbertos(prev => prev.map(c => c.id === editId ? {
        ...c, ...form, saldoInicial: +form.saldoInicial,
      } as unknown as CaixaAberta : c))
    }
    setModalCaixa(null)
  }

  const fecharCaixa = (id: string) => {
    setCaixasAbertos(prev => prev.map(c => c.id === id
      ? { ...c, fechado: true, horaFechamento: nowStr(), saldoFinal: calcSaldo(c) }
      : c))
    setConfirmFechar(null)
  }

  const reabrirCaixa = (id: string) => {
    setCaixasAbertos(prev => prev.map(c => c.id === id
      ? { ...c, fechado: false, horaFechamento: undefined, saldoFinal: undefined }
      : c))
  }

  const handleDelete = (id: string) => {
    setCaixasAbertos(prev => prev.filter(c => c.id !== id))
    if (selectedCaixaId === id) setSelectedCaixaId(null)
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

  const adicionarMov = () => {
    if (!validarMov()) return
    const caixaAlvo = caixasAbertos.find(c => c.id === movForm.caixaId)
    if (!caixaAlvo || caixaAlvo.fechado) return
    const mov: MovCaixaItem = {
      id: `MV${Date.now()}`, tipo: movForm.tipo, descricao: movForm.descricao || movForm.planoContas,
      valor: +movForm.valor, hora: nowStr(), operador: caixaAlvo.operador,
      planoContas: movForm.planoContas, compensadoBanco: movForm.compensadoBanco, caixaId: movForm.caixaId,
    }
    setCaixasAbertos(prev => prev.map(c => c.id === movForm.caixaId
      ? { ...c, movimentacoes: [...c.movimentacoes, mov] } : c))
    setShowMov(false)
  }

  const setF = (k: keyof CaixaForm, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const setM = (k: keyof MovForm, v: string) => { setMovForm(p => ({ ...p, [k]: v })); setMovErrors(e => ({ ...e, [k]: '' })) }

  const caixasAbertosLista = [...caixasVisiveis].sort((a, b) => {
    if (!a.fechado && b.fechado) return -1
    if (a.fechado && !b.fechado) return 1
    return b.dataAbertura.localeCompare(a.dataAbertura)
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
            const saldo = c.saldoFinal ?? calcSaldo(c)
            const hasMovs = c.movimentacoes.length > 0
            const cor = c.fechado ? '#6b7280' : '#10b981'

            return (
              <div key={c.id}
                style={{ borderRadius:12, border:`1.5px solid hsl(var(--border-subtle))`, background:'hsl(var(--bg-elevated))', cursor:'default', overflow:'hidden', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${cor}40` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>

                {/* Barra de status topo */}
                <div style={{ height:3, background: c.fechado ? '#6b7280' : '#10b981' }} />

                <div style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', minWidth:0 }}>
                      {ca.codigo && <code style={{ fontSize:10, padding:'1px 5px', background:'hsl(var(--bg-overlay))', borderRadius:4, color:'#60a5fa', flexShrink:0 }}>{ca.codigo}</code>}
                      <span style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {ca.nomeCaixa || new Date(c.dataAbertura + 'T12:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {c.fechado
                      ? <span className="badge badge-neutral" style={{ flexShrink:0, fontSize:10 }}>Fechado</span>
                      : <span className="badge badge-success" style={{ flexShrink:0, fontSize:10 }}>Aberto</span>}
                  </div>
                  <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginBottom:6 }}>{c.operador} · {c.horaAbertura} · {hasMovs ? `${c.movimentacoes.length} mov.` : 'sem movimentos'}</div>
                  <div style={{ fontWeight:900, color: c.fechado ? '#6b7280' : (saldo >= 0 ? '#10b981' : '#ef4444'), fontSize:16, fontFamily:'Outfit,sans-serif' }}>{fmt(saldo)}</div>
                </div>

                {/* Ações */}
                <div style={{ padding:'6px 10px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', gap:4, background:'hsl(var(--bg-overlay))' }}
                  onClick={e => e.stopPropagation()}>
                  {/* Lançar */}
                  {!c.fechado && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#10b981', flex:1 }} onClick={() => router.push('/financeiro/movimentacoes')}>
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
                    onClick={() => !hasMovs && setConfirmDelete(c.id)}>
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
                  {sysUsers.filter(u => u.status === 'ativo').length > 0 ? `${sysUsers.filter(u => u.status === 'ativo').length} usuário(s) cadastrados` : 'Cadastre usuários em Configurações → Usuários'}
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
                  {caixasAbertos.filter(c => !c.fechado).map(c => {
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
    </div>
  )
}
