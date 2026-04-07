'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useData, MovimentacaoManual, TipoDocumento, newId } from '@/lib/dataContext'
import {
  Plus, Pencil, Trash2, Printer, Search, Filter, X, Check,
  ArrowUpCircle, ArrowDownCircle, ChevronDown, AlertCircle, FileText, Download
} from 'lucide-react'

// ─── Constantes ────────────────────────────────────────────────────
// fallback caso não haja tipos de documento configurados
const TIPOS_DOC_FALLBACK: TipoDocumento[] = ['NF', 'NFe', 'REC', 'DUP', 'CHQ', 'BOL', 'PIX', 'TED', 'DOC', 'OUTRO']

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => s ? new Date(s + 'T12:00').toLocaleDateString('pt-BR') : '—'

const BLANK_FORM: Omit<MovimentacaoManual, 'id' | 'criadoEm' | 'editadoEm'> = {
  caixaId: '', tipo: 'receita', fornecedorId: '', fornecedorNome: '',
  descricao: '', dataLancamento: new Date().toISOString().slice(0, 10),
  dataMovimento: new Date().toISOString().slice(0, 10),
  valor: 0, planoContasId: '', planoContasDesc: '',
  tipoDocumento: 'NF' as TipoDocumento, numeroDocumento: '', dataEmissao: new Date().toISOString().slice(0, 10),
  compensadoBanco: false, observacoes: '',
  centroCustoId: '', centroCustoDesc: '',
}

// ─── Modal de lançamento ────────────────────────────────────────────
interface FormModalProps {
  open: boolean
  onClose: () => void
  onSave: (m: Omit<MovimentacaoManual, 'id' | 'criadoEm' | 'editadoEm'>) => void
  initial?: MovimentacaoManual | null
  defaultCaixaId?: string
  caixas: { id: string; label: string; operador: string }[]
  fornecedores: { id: string; nome: string }[]
  planosContas: { id: string; codPlano: string; descricao: string; grupoConta?: string }[]
  centrosCusto: { id: string; codigo: string; descricao: string; tipo: string }[]
  metodosPagamento: { id: string; nome: string }[]
  tiposDocumento: string[]
}

function FormModal({ open, onClose, onSave, initial, defaultCaixaId, caixas, fornecedores, planosContas, centrosCusto, metodosPagamento, tiposDocumento }: FormModalProps) {
  const [form, setForm] = useState<Omit<MovimentacaoManual, 'id' | 'criadoEm' | 'editadoEm'>>(initial ? {
    caixaId: initial.caixaId, tipo: initial.tipo,
    fornecedorId: initial.fornecedorId, fornecedorNome: initial.fornecedorNome,
    descricao: initial.descricao, dataLancamento: initial.dataLancamento,
    dataMovimento: initial.dataMovimento, valor: initial.valor,
    planoContasId: initial.planoContasId, planoContasDesc: initial.planoContasDesc,
    centroCustoId: initial.centroCustoId, centroCustoDesc: initial.centroCustoDesc,
    tipoDocumento: initial.tipoDocumento, numeroDocumento: initial.numeroDocumento,
    dataEmissao: initial.dataEmissao, compensadoBanco: initial.compensadoBanco,
    observacoes: initial.observacoes,
  } : { ...BLANK_FORM, caixaId: defaultCaixaId ?? '' })

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  // Typeahead fornecedor
  const [fornSearch, setFornSearch] = useState(initial?.fornecedorNome || '')
  const [showFornDrop, setShowFornDrop] = useState(false)
  const fornFiltrados = useMemo(() => {
    const q = fornSearch.toLowerCase()
    return fornecedores.filter(f => f.nome.toLowerCase().includes(q)).slice(0, 8)
  }, [fornecedores, fornSearch])

  const handleFornecedor = (id: string, nome: string) => {
    setForm(p => ({ ...p, fornecedorId: id, fornecedorNome: nome }))
    setFornSearch(nome)
    setShowFornDrop(false)
  }
  const handleFornLivre = (v: string) => {
    setFornSearch(v)
    setForm(p => ({ ...p, fornecedorId: '', fornecedorNome: v }))
  }

  const handlePlano = (id: string) => {
    const pl = planosContas.find(x => x.id === id)
    setForm(p => ({ ...p, planoContasId: id, planoContasDesc: pl ? `${pl.codPlano} - ${pl.descricao}` : '' }))
  }

  // Modal seleção Plano de Contas — sem filtro por grupo, mostra todos ativos
  const [showPlanoMov, setShowPlanoMov] = useState(false)
  const [planoMovSearch, setPlanoMovSearch] = useState('')
  const planosFiltered = useMemo(() => {
    const q = planoMovSearch.toLowerCase()
    return planosContas.filter(p =>
      !q || p.descricao.toLowerCase().includes(q) || (p.codPlano || '').toLowerCase().includes(q))
  }, [planosContas, planoMovSearch])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 780, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 32px 100px rgba(0,0,0,0.7)', marginBottom: 24 }}>

        {/* Header */}
        <div style={{ padding: '18px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: form.tipo === 'receita' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {form.tipo === 'receita' ? <ArrowUpCircle size={20} style={{ color: '#10b981' }} /> : <ArrowDownCircle size={20} style={{ color: '#ef4444' }} />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{initial ? 'Editar Movimentação' : 'Nova Movimentação Manual'}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Lançamento financeiro vinculado ao caixa</div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div style={{ padding: '22px 28px' }}>
          {/* Tipo de movimento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {(['receita', 'despesa'] as const).map(t => (
              <button key={t} onClick={() => set('tipo', t)}
                style={{ padding: '14px', borderRadius: 10, border: `2px solid ${form.tipo === t ? (t === 'receita' ? '#10b981' : '#ef4444') : 'hsl(var(--border-subtle))'}`, background: form.tipo === t ? `${t === 'receita' ? '#10b981' : '#ef4444'}10` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                {t === 'receita' ? <ArrowUpCircle size={18} style={{ color: '#10b981' }} /> : <ArrowDownCircle size={18} style={{ color: '#ef4444' }} />}
                <span style={{ fontWeight: 700, fontSize: 14, color: form.tipo === t ? (t === 'receita' ? '#10b981' : '#ef4444') : 'hsl(var(--text-muted))' }}>
                  {t === 'receita' ? 'Receita (Entrada)' : 'Despesa (Saída)'}
                </span>
              </button>
            ))}
          </div>

          {/* Caixa */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Caixa *</label>
            {caixas.length === 0 ? (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 13, color: '#f59e0b', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={14} />Nenhum caixa aberto. Acesse Administrativo → Abertura de Caixa.
              </div>
            ) : (
              <select className="form-input" value={form.caixaId} onChange={e => set('caixaId', e.target.value)}>
                <option value="">Selecionar caixa</option>
                {caixas.map(c => <option key={c.id} value={c.id}>{c.label} — {c.operador}</option>)}
              </select>
            )}
          </div>

          {/* Linha A: Fornecedor + Descrição */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* FORNECEDOR — typeahead */}
            <div style={{ position: 'relative' }}>
              <label className="form-label">Fornecedor / Pagador</label>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 30 }}
                  value={fornSearch}
                  onChange={e => handleFornLivre(e.target.value)}
                  onFocus={() => setShowFornDrop(true)}
                  onBlur={() => setTimeout(() => setShowFornDrop(false), 150)}
                  placeholder="Buscar fornecedor ou digitar livremente..."
                />
                {fornSearch && (
                  <button type="button"
                    onClick={() => { setFornSearch(''); setForm(p => ({ ...p, fornecedorId: '', fornecedorNome: '' })) }}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
              {showFornDrop && fornFiltrados.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 4 }}>
                  {fornFiltrados.map(f => (
                    <div key={f.id}
                      onMouseDown={() => handleFornecedor(f.id, f.nome)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid hsl(var(--border-subtle))' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-overlay))')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontWeight: 700 }}>{f.nome}</span>
                    </div>
                  ))}
                </div>
              )}
              {showFornDrop && fornFiltrados.length === 0 && fornSearch.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Nenhum cadastrado com esse nome — será registrado como digitado</div>
              )}
              {form.fornecedorId && (
                <div style={{ fontSize: 10, color: '#10b981', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Check size={9} /> Vinculado ao cadastro
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Descrição *</label>
              <input className="form-input" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Descrição do lançamento" />
            </div>
          </div>

          {/* Linha B: Datas + Valor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label className="form-label">Data de Lançamento</label>
              <input type="date" className="form-input" value={form.dataLancamento} onChange={e => set('dataLancamento', e.target.value)} />
            </div>
            <div>
              <label className="form-label">{form.tipo === 'receita' ? 'Data de Recebimento' : 'Data de Pagamento'}</label>
              <input type="date" className="form-input" value={form.dataMovimento} onChange={e => set('dataMovimento', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Valor (R$) *</label>
              <input type="number" className="form-input" value={form.valor || ''} step={0.01} min={0} onChange={e => set('valor', +e.target.value)}
                style={{ fontWeight: 800, color: form.tipo === 'receita' ? '#10b981' : '#ef4444', fontSize: 15 }} />
            </div>
          </div>

          {/* Linha C: Plano de Contas e Centro de Custo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* Plano de Contas */}
            <div>
              <label className="form-label">Conta (Plano de Contas)
                {form.planoContasId && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginLeft: 8 }}>✓ Vinculado</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '9px 14px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, fontSize: 13, color: form.planoContasId ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {form.planoContasId ? (
                    <><code style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', padding: '1px 5px', borderRadius: 3 }}>{planosContas.find(p => p.id === form.planoContasId)?.codPlano || ''}</code>
                    <span style={{ fontWeight: 600 }}>{planosContas.find(p => p.id === form.planoContasId)?.descricao}</span></>
                  ) : <span>Nenhuma conta selecionada</span>}
                </div>
                <button type="button" className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '0 12px' }}
                  onClick={() => { setPlanoMovSearch(''); setShowPlanoMov(true) }}>
                  <Search size={12} />Selecionar
                </button>
                {form.planoContasId && <button type="button" className="btn btn-ghost btn-icon" onClick={() => handlePlano('')}><X size={12} /></button>}
              </div>
            </div>

            {/* Centro de Custo */}
            <div>
              <label className="form-label">Centro de Custo</label>
              <select className="form-input" value={form.centroCustoId || ''} onChange={e => {
                const cId = e.target.value;
                const cc = centrosCusto.find(x => x.id === cId)
                setForm(p => ({ ...p, centroCustoId: cId, centroCustoDesc: cc ? `${cc.codigo} - ${cc.descricao}` : '' }))
              }}>
                <option value="">Nenhum centro de custo</option>
                {centrosCusto
                  .filter(c => c.tipo === 'ambos' || c.tipo === form.tipo)
                  .map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>)}
              </select>
            </div>
          </div>

          {/* Mini-modal seleção plano de contas */}
          {showPlanoMov && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '70vh', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 32px 100px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Plano de Contas — {form.tipo === 'receita' ? 'Receitas' : 'Despesas'}</div>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowPlanoMov(false)}><X size={14} /></button>
                </div>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', flexShrink: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                    <input className="form-input" style={{ paddingLeft: 28 }} placeholder="Filtrar..." value={planoMovSearch} onChange={e => setPlanoMovSearch(e.target.value)} autoFocus />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {planosFiltered.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Nenhuma conta encontrada.</div>
                  ) : (
                    planosFiltered.map(p => (
                      <div key={p.id} onClick={() => { handlePlano(p.id); setShowPlanoMov(false) }}
                        style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 10 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <code style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', padding: '1px 5px', borderRadius: 3 }}>{p.codPlano || 'S/C'}</code>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{p.descricao}</span>
                        <Check size={12} style={{ marginLeft: 'auto', opacity: form.planoContasId === p.id ? 1 : 0, color: '#3b82f6' }} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Linha D: Documento */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label className="form-label">Tipo de Documento</label>
              {/* Select unificado: metodos como tipos de doc, ou fallback */}
              <select className="form-input" value={form.tipoDocumento} onChange={e => set('tipoDocumento', e.target.value as TipoDocumento)}>
                {(metodosPagamento.length > 0
                  ? metodosPagamento.map(m => m.nome)
                  : tiposDocumento
                ).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Nº do Documento</label>
              <input className="form-input" value={form.numeroDocumento} onChange={e => set('numeroDocumento', e.target.value)} placeholder="Ex: NF-0001234" />
            </div>
            <div>
              <label className="form-label">Data de Emissão do Documento</label>
              <input type="date" className="form-input" value={form.dataEmissao} onChange={e => set('dataEmissao', e.target.value)} />
            </div>
          </div>

          {/* Linha E: Compensado + Observações */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14, marginBottom: 8 }}>
            <div>
              <label className="form-label">Compensado em banco?</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => set('compensadoBanco', v)}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${form.compensadoBanco === v ? (v ? '#10b981' : '#ef4444') : 'hsl(var(--border-subtle))'}`, background: form.compensadoBanco === v ? `${v ? '#10b981' : '#ef4444'}15` : 'transparent', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: form.compensadoBanco === v ? (v ? '#10b981' : '#ef4444') : 'hsl(var(--text-muted))' }}>
                    {v ? '✅ Sim' : '❌ Não'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Observações</label>
              <input className="form-input" value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Observações internas..." />
            </div>
          </div>

          {/* Preview */}
          {form.valor > 0 && form.descricao && (
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: form.tipo === 'receita' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${form.tipo === 'receita' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', gap: 20, alignItems: 'center' }}>
              {form.tipo === 'receita' ? <ArrowUpCircle size={20} style={{ color: '#10b981' }} /> : <ArrowDownCircle size={20} style={{ color: '#ef4444' }} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{form.descricao}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{fmtDate(form.dataMovimento)} • {form.tipoDocumento} {form.numeroDocumento && `nº ${form.numeroDocumento}`}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontWeight: 900, fontSize: 22, fontFamily: 'Outfit,sans-serif', color: form.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                {form.tipo === 'receita' ? '+' : '-'}{fmt(form.valor)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.descricao || !form.valor || !form.caixaId}>
            <Check size={14} />{initial ? 'Salvar Alterações' : 'Registrar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ───────────────────────────────────────────────
export default function MovimentacoesPage() {
  const { movimentacoesManuais, setMovimentacoesManuais, caixasAbertos, setCaixasAbertos, fornecedoresCad, cfgPlanoContas, cfgCentrosCusto, cfgMetodosPagamento, cfgTiposDocumento } = useData()
  const printRef = useRef<HTMLDivElement>(null)

  // Métodos e tipos dinâmicos
  const metodosPagamentoSelect = cfgMetodosPagamento.filter(m => m.situacao === 'ativo').map(m => ({ id: m.id, nome: m.nome }))
  const TIPOS_DOC: string[] = cfgTiposDocumento.filter(t => t.situacao === 'ativo').length > 0
    ? cfgTiposDocumento.filter(t => t.situacao === 'ativo').map(t => t.nome)
    : TIPOS_DOC_FALLBACK

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [newDefaultCaixaId, setNewDefaultCaixaId] = useState<string>('')

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [filtroCompensado, setFiltroCompensado] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [filtroCaixa, setFiltroCaixa] = useState('todos')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  // Listas derivadas
  const caixasSelect = useMemo(() =>
    caixasAbertos.map(c => ({ id: c.id, label: new Date(c.dataAbertura + 'T12:00').toLocaleDateString('pt-BR'), operador: c.operador }))
  , [caixasAbertos])

  const caixasAbertosAtivos = useMemo(() =>
    caixasAbertos.filter(c => !c.fechado).map(c => ({ id: c.id, label: new Date(c.dataAbertura + 'T12:00').toLocaleDateString('pt-BR'), operador: c.operador }))
  , [caixasAbertos])

  const fornecedoresSelect = useMemo(() =>
    fornecedoresCad.filter(f => f.situacao === 'ativo').map(f => ({ id: f.id, nome: f.nomeFantasia || f.razaoSocial }))
  , [fornecedoresCad])

  const planosSelect = useMemo(() =>
    cfgPlanoContas.filter(p => p.situacao === 'ativo')
  , [cfgPlanoContas])

  const centrosCustoSelect = useMemo(() =>
    (cfgCentrosCusto || []).filter(c => c.situacao === 'ativo')
  , [cfgCentrosCusto])

  // (metodosPagamentoSelect agora vem do DataContext acima)

  // Filtros aplicados
  const filtered = useMemo(() => movimentacoesManuais.filter(m => {
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
    if (filtroCaixa !== 'todos' && m.caixaId !== filtroCaixa) return false
    if (filtroDataDe && m.dataLancamento < filtroDataDe) return false
    if (filtroDataAte && m.dataLancamento > filtroDataAte) return false
    if (filtroCompensado === 'sim' && !m.compensadoBanco) return false
    if (filtroCompensado === 'nao' && m.compensadoBanco) return false
    if (search && !m.descricao.toLowerCase().includes(search.toLowerCase()) && !m.fornecedorNome.toLowerCase().includes(search.toLowerCase()) && !m.numeroDocumento.includes(search)) return false
    return true
  }).sort((a, b) => b.dataLancamento.localeCompare(a.dataLancamento)), [movimentacoesManuais, filtroTipo, filtroCaixa, filtroDataDe, filtroDataAte, filtroCompensado, search])

  // Reset pagination when filters change
  useEffect(() => setCurrentPage(1), [search, filtroTipo, filtroCaixa, filtroDataDe, filtroDataAte, filtroCompensado])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  
  const movLista = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  const totalReceitas = filtered.filter(m => m.tipo === 'receita').reduce((s, m) => s + m.valor, 0)
  const totalDespesas = filtered.filter(m => m.tipo === 'despesa').reduce((s, m) => s + m.valor, 0)
  const saldo = totalReceitas - totalDespesas
  const compensados = filtered.filter(m => m.compensadoBanco).length

  const openNew = () => {
    const defaultCaixaId = caixasAbertosAtivos[caixasAbertosAtivos.length - 1]?.id ?? ''
    setEditId(null); setShowForm(true); setNewDefaultCaixaId(defaultCaixaId)
  }
  const openEdit = (m: MovimentacaoManual) => { setEditId(m.id); setShowForm(true); setNewDefaultCaixaId('') }

  const handleSave = (data: Omit<MovimentacaoManual, 'id' | 'criadoEm' | 'editadoEm'>) => {
    const now = new Date().toISOString()
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const novId = editId ?? newId('MV')

    // 1. Salva/atualiza na lista de movimentações manuais
    if (editId) {
      setMovimentacoesManuais(prev => prev.map(m => m.id === editId ? { ...data, id: editId, criadoEm: m.criadoEm, editadoEm: now } : m))
    } else {
      setMovimentacoesManuais(prev => [...prev, { ...data, id: novId, criadoEm: now, editadoEm: now }])
    }

    // 2. Espelha como MovCaixaItem no caixa correspondente (sincroniza bidirecional)
    if (data.caixaId) {
      setCaixasAbertos(prev => prev.map(c => {
        if (c.id !== data.caixaId) return c

        const tipoMov: 'entrada' | 'saida' | 'suprimento' | 'sangria' = data.tipo === 'receita' ? 'entrada' : 'saida'
        const planoDesc = data.planoContasDesc || ''
        const banco = typeof data.compensadoBanco === 'string'
          ? data.compensadoBanco
          : data.compensadoBanco ? 'Compensado' : 'Não compensado'

        const novMov = {
          id: novId,
          tipo: tipoMov,
          descricao: data.descricao || planoDesc,
          valor: data.valor,
          hora,
          operador: c.operador,
          planoContas: planoDesc,
          compensadoBanco: banco,
          caixaId: data.caixaId,
          centroCustoId: data.centroCustoId,
          centroCustoDesc: data.centroCustoDesc,
        }

        if (editId) {
          // Atualiza o movimento existente no caixa
          const jaExiste = c.movimentacoes.some(m => m.id === editId)
          if (jaExiste) {
            return { ...c, movimentacoes: c.movimentacoes.map(m => m.id === editId ? novMov : m) }
          } else {
            return { ...c, movimentacoes: [...c.movimentacoes, novMov] }
          }
        } else {
          return { ...c, movimentacoes: [...c.movimentacoes, novMov] }
        }
      }))
    }

    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    // Remove da lista de movimentações manuais
    setMovimentacoesManuais(prev => prev.filter(m => m.id !== id))
    // Remove também do caixa correspondente
    setCaixasAbertos(prev => prev.map(c => ({
      ...c,
      movimentacoes: c.movimentacoes.filter(m => m.id !== id),
    })))
    setConfirmId(null)
  }


  const editingItem = editId ? movimentacoesManuais.find(m => m.id === editId) ?? null : null

  // Resolução de caixa para exibição
  const nomeCaixa = (caixaId: string) => {
    const c = caixasAbertos.find(x => x.id === caixaId)
    return c ? `${new Date(c.dataAbertura + 'T12:00').toLocaleDateString('pt-BR')} (${c.operador})` : '—'
  }

  const limparFiltros = () => { setFiltroTipo('todos'); setFiltroCaixa('todos'); setFiltroDataDe(''); setFiltroDataAte(''); setFiltroCompensado('todos'); setSearch(''); setCurrentPage(1); }
  const filtrosAtivos = filtroTipo !== 'todos' || filtroCaixa !== 'todos' || filtroDataDe || filtroDataAte || filtroCompensado !== 'todos' || search

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Movimentações Financeiras</h1>
          <p className="page-subtitle">{filtered.length} lançamentos manuais • Vinculado ao caixa do operador</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={13} />Imprimir</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Nova Movimentação</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Receitas', value: fmt(totalReceitas), color: '#10b981', icon: '⬆️' },
          { label: 'Total Despesas', value: fmt(totalDespesas), color: '#ef4444', icon: '⬇️' },
          { label: 'Saldo do Período', value: fmt(saldo), color: saldo >= 0 ? '#3b82f6' : '#f59e0b', icon: '📊' },
          { label: 'Compensados', value: `${compensados}/${filtered.length}`, color: '#8b5cf6', icon: '🏦' },
          { label: 'Caixas abertos', value: caixasAbertosAtivos.length, color: '#06b6d4', icon: '💼' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar descrição, fornecedor, nº documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 140 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as typeof filtroTipo)}>
            <option value="todos">Todos os tipos</option>
            <option value="receita">⬆️ Receitas</option>
            <option value="despesa">⬇️ Despesas</option>
          </select>
          <select className="form-input" style={{ width: 170 }} value={filtroCaixa} onChange={e => setFiltroCaixa(e.target.value)}>
            <option value="todos">Todos os caixas</option>
            {caixasAbertos.map(c => <option key={c.id} value={c.id}>{new Date(c.dataAbertura + 'T12:00').toLocaleDateString('pt-BR')} — {c.operador}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>De:</span>
            <input type="date" className="form-input" style={{ width: 145 }} value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>Até:</span>
            <input type="date" className="form-input" style={{ width: 145 }} value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 155 }} value={filtroCompensado} onChange={e => setFiltroCompensado(e.target.value as typeof filtroCompensado)}>
            <option value="todos">Compensação</option>
            <option value="sim">✅ Compensado</option>
            <option value="nao">❌ Não compensado</option>
          </select>
          {filtrosAtivos && (
            <button className="btn btn-ghost btn-sm" style={{ color: '#f87171', fontSize: 11 }} onClick={limparFiltros}>
              <X size={12} />Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      {movimentacoesManuais.length === 0 ? (
        <div style={{ padding: '64px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 14, color: 'hsl(var(--text-muted))' }}>
          <FileText size={52} style={{ opacity: 0.08, marginBottom: 16 }} /><br />
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Nenhuma movimentação lançada</div>
          <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto 20px' }}>
            Registre receitas e despesas manualmente vinculadas ao caixa do operador. Abra um caixa primeiro em Administrativo → Abertura de Caixa.
          </div>
          {caixasAbertosAtivos.length === 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 13, color: '#f59e0b', marginBottom: 16 }}>
              <AlertCircle size={14} />Nenhum caixa aberto. Acesse Administrativo → Abertura de Caixa.
            </div>
          )}
          <br />
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Primeiro Lançamento</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
          Nenhum resultado para os filtros aplicados.
          <br /><button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={limparFiltros}>Limpar filtros</button>
        </div>
      ) : (
        <div className="table-container" ref={printRef}>
          <table>
            <thead>
              <tr>
                <th>Data Lanç.</th>
                <th>Data Mov.</th>
                <th>Tipo</th>
                <th>Descrição / Fornecedor</th>
                <th>Documento</th>
                <th>Plano de Contas</th>
                <th>Banco</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {movLista.map(m => {
                // Color-code by origem
                const origemCfg: Record<string,{label:string;color:string;bg:string}> = {
                  baixa_aluno:   { label:'🎓 Aluno',    color:'#818cf8', bg:'rgba(129,140,248,0.1)' },
                  baixa_pagar:   { label:'🟥 C.Pagar',  color:'#f87171', bg:'rgba(248,113,113,0.08)' },
                  baixa_receber: { label:'🟦 C.Receber',color:'#22d3ee', bg:'rgba(34,211,238,0.08)' },
                }
                const og = (m as any).origem && (m as any).origem !== 'manual' ? origemCfg[(m as any).origem] : null
                return (
                <tr key={m.id} style={{ borderLeft: og ? `3px solid ${og.color}` : '3px solid transparent', background: og ? og.bg : undefined }}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(m.dataLancamento)}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(m.dataMovimento)}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {m.tipo === 'receita'
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#10b981', fontWeight: 700 }}><ArrowUpCircle size={12} />Receita</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ef4444', fontWeight: 700 }}><ArrowDownCircle size={12} />Despesa</span>}
                      {og && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: og.bg, color: og.color, fontWeight: 700, border: `1px solid ${og.color}40`, whiteSpace: 'nowrap' }}>{og.label}</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.descricao}</div>
                    {m.fornecedorNome && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{m.fornecedorNome}</div>}
                    {(m as any).referenciaId && <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>Ref: {(m as any).referenciaId}</div>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'hsl(var(--bg-overlay))', fontWeight: 700, fontFamily: 'monospace' }}>{m.tipoDocumento}</span>
                      {m.numeroDocumento && <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{m.numeroDocumento}</span>}
                    </div>
                    {m.dataEmissao && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Emissão: {fmtDate(m.dataEmissao)}</div>}
                  </td>
                  <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{m.planoContasDesc || '—'}</td>
                  <td>
                    {m.compensadoBanco
                      ? <span className="badge badge-success" style={{ fontSize: 10 }}>✅ Sim</span>
                      : <span className="badge badge-neutral" style={{ fontSize: 10 }}>❌ Não</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', color: m.tipo === 'receita' ? '#10b981' : '#ef4444' }}>
                    {m.tipo === 'receita' ? '+' : '-'}{fmt(m.valor)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!og && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(m)} title="Editar"><Pencil size={12} /></button>}
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(m.id)} title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>

          {/* Totalizador */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-elevated))' }}>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{filtered.length} lançamento(s)</span>
            <div style={{ display: 'flex', gap: 24 }}>
              <span style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>Receitas: {fmt(totalReceitas)}</span>
              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>Despesas: {fmt(totalDespesas)}</span>
              <span style={{ color: saldo >= 0 ? '#3b82f6' : '#f59e0b', fontWeight: 900, fontSize: 14 }}>Saldo: {fmt(saldo)}</span>
            </div>
          </div>
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderTop:'1px solid hsl(var(--border-subtle))' }}>
              <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length} registros
              </span>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Anterior</button>
                <div style={{ display:'flex', alignItems:'center', padding:'0 10px', fontSize:13, fontWeight:600 }}>Página {currentPage} de {totalPages}</div>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Próxima</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Formulário */}
      <FormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        initial={editingItem}
        defaultCaixaId={newDefaultCaixaId}
        caixas={editId ? caixasSelect : caixasAbertosAtivos}
        fornecedores={fornecedoresSelect}
        planosContas={planosSelect as any}
        centrosCusto={centrosCustoSelect}
        metodosPagamento={metodosPagamentoSelect}
        tiposDocumento={TIPOS_DOC}
      />

      {/* Confirmar exclusão */}
      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 14, width: 400, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', fontWeight: 800, fontSize: 15, color: '#ef4444', display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertCircle size={18} />Confirmar Exclusão
            </div>
            <div style={{ padding: '20px 24px', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
              Este lançamento será removido permanentemente do sistema. Esta ação não pode ser desfeita.
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
