'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import {
  BookOpen, Filter, RefreshCw, FileText, FileSpreadsheet,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus,
  ArrowLeft, Search, X, Calendar, Building2, Layers, Eye, EyeOff,
  Printer, BarChart3, Activity, DollarSign, Hash, CreditCard, RotateCcw,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useData } from '@/lib/dataContext'
import { fmtIsoDate } from '@/lib/utils'
import * as XLSX from 'xlsx'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lancamento {
  id: string; data: string; dataFmt: string; descricao: string
  tipo: string; valor: number; credito: number; debito: number; status: string
  planoContasId: string; codPlano: string; contaDescricao: string
  grupoConta: string; tipoContabil: string; naturezaDRE: string; grupoDRE: string
  centroCustoId: string; centroCusto: string; formaPagamento: string
  numeroDocumento: string; tipoDocumento: string; referenciaId: string
  origem: string; operador: string; nomeAluno: string; observacoes: string
  dataMovimento: string; dataLancamento: string
}

interface ContaRazao {
  conta: { id: string; codPlano: string; descricao: string; grupoConta: string; naturezaDRE: string; grupoDRE: string; tipoContabil: string }
  lancamentos: Lancamento[]
  totalCredito: number
  totalDebito: number
  saldo: number
}

interface Totais { credito: number; debito: number; saldo: number; lancamentos: number; contas: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtR = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtCurrency = (n: number, colored = false) => {
  const str = `R$ ${fmtR(Math.abs(n))}`
  if (!colored) return str
  return { str, positive: n >= 0 }
}

const GRUPO_LABEL: Record<string, string> = {
  receitas: 'Receitas', despesas: 'Despesas', investimentos: 'Investimentos', '': 'Todos',
}

const GRUPO_COLOR: Record<string, string> = {
  receitas: '#10b981', despesas: '#ef4444', investimentos: '#8b5cf6', '': '#3b82f6',
}

const NATUREZA_LABEL: Record<string, string> = {
  credora: 'Credora', devedora: 'Devedora', neutra: 'Neutra', '': '—',
}

const ORIGEM_LABEL: Record<string, string> = {
  baixa_aluno: 'Baixa Aluno', contas_pagar: 'Contas a Pagar',
  caixa: 'Caixa', manual: 'Manual', sistema: 'Sistema',
}

const today = () => new Date().toISOString().slice(0, 10)
const thisMonthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string
}) {
  return (
    <div className="card" style={{
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 160,
      background: `linear-gradient(135deg, hsl(var(--bg-surface)), hsl(var(--bg-elevated)))`,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Filter Bar ──────────────────────────────────────────────────────────────

function FilterPanel({
  filters, onChange, onApply, loading, planoContas, centrosCusto
}: {
  filters: Record<string, string>
  onChange: (k: string, v: string) => void
  onApply: () => void
  loading: boolean
  planoContas: any[]
  centrosCusto: any[]
}) {
  // Ordenado por codPlano; mostra código + nome nos selects
  const contasOrdenadas = useMemo(
    () => [...planoContas].sort((a, b) => (a.codPlano || '').localeCompare(b.codPlano || '')),
    [planoContas]
  )
  const formasPagamento = ['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Transferência', 'Boleto', 'Cheque']
  const origens = Object.entries(ORIGEM_LABEL)

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Filter size={13} style={{ color: '#3b82f6' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filtros Avançados</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>

        {/* Período */}
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Data Início</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input type="date" className="form-input" style={{ paddingLeft: 26, fontSize: 12 }} value={filters.dataInicio || ''} onChange={e => onChange('dataInicio', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Data Fim</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input type="date" className="form-input" style={{ paddingLeft: 26, fontSize: 12 }} value={filters.dataFim || ''} onChange={e => onChange('dataFim', e.target.value)} />
          </div>
        </div>

        {/* Conta Inicial / Final — exibe código + nome */}
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Conta Inicial</label>
          <select className="form-input" style={{ fontSize: 12 }} value={filters.contaInicial || ''} onChange={e => onChange('contaInicial', e.target.value)}>
            <option value="">— Primeira conta</option>
            {contasOrdenadas.map(c => (
              <option key={c.id || c.codPlano} value={c.codPlano}>
                {c.codPlano ? `${c.codPlano} – ${c.descricao}` : c.descricao}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Conta Final</label>
          <select className="form-input" style={{ fontSize: 12 }} value={filters.contaFinal || ''} onChange={e => onChange('contaFinal', e.target.value)}>
            <option value="">— Última conta</option>
            {contasOrdenadas.map(c => (
              <option key={c.id || c.codPlano} value={c.codPlano}>
                {c.codPlano ? `${c.codPlano} – ${c.descricao}` : c.descricao}
              </option>
            ))}
          </select>
        </div>

        {/* Grupo Conta */}
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Grupo</label>
          <select className="form-input" style={{ fontSize: 12 }} value={filters.grupoConta || ''} onChange={e => onChange('grupoConta', e.target.value)}>
            <option value="">Todos os grupos</option>
            <option value="receitas">Receitas</option>
            <option value="despesas">Despesas</option>
            <option value="investimentos">Investimentos</option>
          </select>
        </div>

        {/* Tipo (débito/crédito) */}
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Natureza</label>
          <select className="form-input" style={{ fontSize: 12 }} value={filters.tipo || ''} onChange={e => onChange('tipo', e.target.value)}>
            <option value="">Débito + Crédito</option>
            <option value="receita">Crédito (Receitas)</option>
            <option value="despesa">Débito (Despesas)</option>
          </select>
        </div>

        {/* Centro de Custo */}
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Centro de Custo</label>
          <select className="form-input" style={{ fontSize: 12 }} value={filters.centroCustoId || ''} onChange={e => onChange('centroCustoId', e.target.value)}>
            <option value="">Todos</option>
            {centrosCusto.map(c => <option key={c.id} value={c.id}>{c.codigo} – {c.descricao}</option>)}
          </select>
        </div>

        {/* Forma de Pagamento */}
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Forma Pagamento</label>
          <select className="form-input" style={{ fontSize: 12 }} value={filters.formaPagamento || ''} onChange={e => onChange('formaPagamento', e.target.value)}>
            <option value="">Todas</option>
            {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Origem */}
        <div>
          <label className="form-label" style={{ fontSize: 10 }}>Origem</label>
          <select className="form-input" style={{ fontSize: 12 }} value={filters.origem || ''} onChange={e => onChange('origem', e.target.value)}>
            <option value="">Todas as origens</option>
            {origens.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Busca */}
        <div style={{ gridColumn: 'span 2' }}>
          <label className="form-label" style={{ fontSize: 10 }}>Buscar (descrição, conta, doc, aluno)</label>
          <div style={{ position: 'relative' }}>
            <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
            <input type="text" className="form-input" style={{ paddingLeft: 26, fontSize: 12 }} placeholder="Ex: Mensalidade, 00.01, João..." value={filters.busca || ''} onChange={e => onChange('busca', e.target.value)} onKeyDown={e => e.key === 'Enter' && onApply()} />
          </div>
        </div>
      </div>

      {/* Atalhos de mês */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', alignSelf: 'center' }}>Atalhos:</span>
        {[
          { label: 'Hoje', di: today(), df: today() },
          { label: 'Este mês', di: thisMonthStart(), df: today() },
          { label: 'Mês anterior', di: (() => { const d = new Date(); d.setMonth(d.getMonth()-1); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10) })(), df: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0,10) })() },
          { label: `Jan/${new Date().getFullYear()}`, di: `${new Date().getFullYear()}-01-01`, df: `${new Date().getFullYear()}-12-31` },
        ].map(({ label, di, df }) => (
          <button key={label} onClick={() => { onChange('dataInicio', di); onChange('dataFim', df); }} className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '2px 10px', height: 24 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" style={{ gap: 5, fontSize: 11 }} onClick={() => {
          onChange('dataInicio', ''); onChange('dataFim', ''); onChange('contaInicial', ''); onChange('contaFinal', '')
          onChange('grupoConta', ''); onChange('tipo', ''); onChange('centroCustoId', ''); onChange('formaPagamento', '')
          onChange('origem', ''); onChange('busca', '')
        }}>
          <RotateCcw size={11} /> Limpar
        </button>
        <button className="btn btn-primary btn-sm" style={{ gap: 5, fontSize: 11 }} onClick={onApply} disabled={loading}>
          {loading ? <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Filter size={11} />}
          {loading ? 'Consultando...' : 'Aplicar Filtros'}
        </button>
      </div>
    </div>
  )
}

// ─── Linha de Lançamento ──────────────────────────────────────────────────────

function LancRow({ mov, idx }: { mov: Lancamento; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const hasExtra = !!(mov.nomeAluno || mov.numeroDocumento || mov.formaPagamento || mov.observacoes || mov.operador)

  return (
    <>
      <tr
        onClick={() => hasExtra && setExpanded(!expanded)}
        style={{
          background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
          cursor: hasExtra ? 'pointer' : 'default',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (hasExtra) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.04)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}
      >
        <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', padding: '7px 10px' }}>
          {hasExtra && (
            <span style={{ marginRight: 4, display: 'inline-flex', alignItems: 'center', opacity: 0.4, transition: 'opacity 0.15s' }}>
              {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
            </span>
          )}
          {mov.dataFmt || mov.data}
        </td>
        <td style={{ fontSize: 11, padding: '7px 10px', maxWidth: 240 }}>
          <div style={{ fontWeight: 500, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mov.descricao || '(sem descrição)'}
          </div>
          {mov.tipoDocumento && <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginTop: 1 }}>{mov.tipoDocumento}</div>}
        </td>
        <td style={{ fontSize: 11, padding: '7px 10px', textAlign: 'center' }}>
          {mov.formaPagamento && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
              {mov.formaPagamento}
            </span>
          )}
        </td>
        <td style={{ fontSize: 11, padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: mov.credito > 0 ? '#10b981' : 'hsl(var(--text-disabled))', fontWeight: mov.credito > 0 ? 700 : 400 }}>
          {mov.credito > 0 ? `R$ ${fmtR(mov.credito)}` : '—'}
        </td>
        <td style={{ fontSize: 11, padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: mov.debito > 0 ? '#ef4444' : 'hsl(var(--text-disabled))', fontWeight: mov.debito > 0 ? 700 : 400 }}>
          {mov.debito > 0 ? `R$ ${fmtR(mov.debito)}` : '—'}
        </td>
        <td style={{ fontSize: 10, padding: '7px 10px', color: 'hsl(var(--text-muted))' }}>{mov.origem ? (ORIGEM_LABEL[mov.origem] || mov.origem) : '—'}</td>
      </tr>
      {expanded && (
        <tr style={{ background: 'rgba(59,130,246,0.03)' }}>
          <td colSpan={6} style={{ padding: '8px 24px 10px', borderTop: '1px dashed hsl(var(--border-subtle))' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 11 }}>
              {mov.nomeAluno && <span><span style={{ color: 'hsl(var(--text-muted))' }}>Aluno: </span><strong>{mov.nomeAluno}</strong></span>}
              {mov.numeroDocumento && <span><span style={{ color: 'hsl(var(--text-muted))' }}>Documento: </span><strong>{mov.numeroDocumento}</strong></span>}
              {mov.operador && <span><span style={{ color: 'hsl(var(--text-muted))' }}>Operador: </span><strong>{mov.operador}</strong></span>}
              {mov.centroCusto && <span><span style={{ color: 'hsl(var(--text-muted))' }}>Centro: </span><strong>{mov.centroCusto}</strong></span>}
              {mov.referenciaId && <span><span style={{ color: 'hsl(var(--text-muted))' }}>Ref.: </span><code style={{ fontSize: 10, background: 'hsl(var(--bg-elevated))', padding: '1px 4px', borderRadius: 3 }}>{mov.referenciaId}</code></span>}
              {mov.observacoes && <span style={{ flexBasis: '100%', color: 'hsl(var(--text-muted))' }}>Obs: <em>{mov.observacoes}</em></span>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Conta Razão Block ────────────────────────────────────────────────────────

function ContaBlock({ entry, defaultOpen }: { entry: ContaRazao; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { conta, lancamentos, totalCredito, totalDebito, saldo } = entry
  const grpColor = GRUPO_COLOR[conta.grupoConta] || '#6b7280'
  const saldoPositivo = saldo >= 0

  return (
    <div style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
      {/* Header da conta */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', background: open ? `${grpColor}09` : 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid hsl(var(--border-subtle))' : 'none',
          borderLeft: `4px solid ${grpColor}`,
          cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left',
        }}
      >
        <div style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: 'hsl(var(--text-muted))' }}>
          <ChevronRight size={13} />
        </div>

        {/* Código + nome */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: `${grpColor}18`, color: grpColor, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {conta.codPlano || 'S/C'}
            </code>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{conta.descricao}</span>
            {conta.naturezaDRE && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: conta.naturezaDRE === 'credora' ? 'rgba(16,185,129,0.12)' : conta.naturezaDRE === 'devedora' ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)', color: conta.naturezaDRE === 'credora' ? '#10b981' : conta.naturezaDRE === 'devedora' ? '#ef4444' : '#6b7280', textTransform: 'uppercase' }}>
                {NATUREZA_LABEL[conta.naturezaDRE]}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
            {lancamentos.length} lançamento{lancamentos.length !== 1 ? 's' : ''} · {GRUPO_LABEL[conta.grupoConta] || conta.grupoConta}
          </div>
        </div>

        {/* Totais */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Crédito</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>R$ {fmtR(totalCredito)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Débito</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>R$ {fmtR(totalDebito)}</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 110 }}>
            <div style={{ fontSize: 9, color: saldoPositivo ? '#10b981' : '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: saldoPositivo ? '#10b981' : '#ef4444', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
              {saldoPositivo ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              R$ {fmtR(Math.abs(saldo))}
            </div>
          </div>
        </div>
      </button>

      {/* Tabela de lançamentos */}
      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                {['Data', 'Descrição / Documento', 'Forma Pgto.', 'Crédito (R$)', 'Débito (R$)', 'Origem'].map(h => (
                  <th key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'hsl(var(--text-muted))', padding: '6px 10px', textAlign: h.includes('R$') ? 'right' : 'left', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((m, idx) => <LancRow key={m.id} mov={m} idx={idx} />)}
            </tbody>
            <tfoot>
              <tr style={{ background: 'hsl(var(--bg-elevated))', borderTop: '2px solid hsl(var(--border-default))' }}>
                <td colSpan={3} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>
                  Subtotal — {lancamentos.length} lançamentos
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 12, color: '#10b981', fontFamily: 'monospace' }}>R$ {fmtR(totalCredito)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 12, color: '#ef4444', fontFamily: 'monospace' }}>R$ {fmtR(totalDebito)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: saldoPositivo ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                  Saldo: R$ {fmtR(Math.abs(saldo))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RazaoContasPage() {
  const router = useRouter()
  const { mantenedores } = useData()

  const [filters, setFilters] = useState<Record<string, string>>({
    dataInicio: thisMonthStart(),
    dataFim: today(),
    contaInicial: '',
    contaFinal: '',
    grupoConta: '',
    tipo: '',
    centroCustoId: '',
    formaPagamento: '',
    origem: '',
    busca: '',
  })

  const [razao, setRazao] = useState<ContaRazao[]>([])
  const [totais, setTotais] = useState<Totais | null>(null)
  const [planoContas, setPlanoContas] = useState<any[]>([])
  const [centrosCusto, setCentrosCusto] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [allExpanded, setAllExpanded] = useState(false)
  const [expandVersion, setExpandVersion] = useState(0)
  const [showFilters, setShowFilters] = useState(true)

  const mantenedor = (mantenedores as any)?.[0]
  const unidade = mantenedor?.unidades?.[0]
  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Escola'
  const cnpj = unidade?.cnpj || ''

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetch = useCallback(async (flt = filters) => {
    setLoading(true)
    try {
      const res = await window.fetch('/api/financeiro/razao-contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flt),
      })
      const data = await res.json()
      if (data.ok) {
        setRazao(data.razao || [])
        setTotais(data.totais)
        setPlanoContas(data.planoContas || [])
        setCentrosCusto(data.centrosCusto || [])
        setHasLoaded(true)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filters])

  const handleChange = (k: string, v: string) => setFilters(p => ({ ...p, [k]: v }))
  const handleApply = () => fetch(filters)

  // ─── Export XLSX ─────────────────────────────────────────────────────────────

  const exportXLSX = () => {
    const rows: any[] = [
      ['RAZÃO DE CONTAS', nomeEscola, cnpj],
      ['Período:', filters.dataInicio ? fmtIsoDate(filters.dataInicio) : '—', 'a', filters.dataFim ? fmtIsoDate(filters.dataFim) : '—'],
      [],
      ['Conta', 'Código', 'Data', 'Descrição', 'Doc.', 'Forma Pgto.', 'Crédito', 'Débito', 'Saldo Conta', 'Origem'],
    ]
    razao.forEach(entry => {
      entry.lancamentos.forEach((m, idx) => {
        rows.push([
          idx === 0 ? `${entry.conta.codPlano} – ${entry.conta.descricao}` : '',
          entry.conta.codPlano,
          m.dataFmt || m.data,
          m.descricao,
          m.numeroDocumento,
          m.formaPagamento,
          m.credito || '',
          m.debito || '',
          idx === entry.lancamentos.length - 1 ? entry.saldo : '',
          m.origem ? (ORIGEM_LABEL[m.origem] || m.origem) : '',
        ])
      })
      rows.push(['', '', '─── Subtotal ───', '', '', '', entry.totalCredito, entry.totalDebito, entry.saldo, ''])
      rows.push([])
    })
    rows.push([])
    if (totais) {
      rows.push(['TOTAL GERAL', '', '', '', '', '', totais.credito, totais.debito, totais.saldo, ''])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Razão de Contas')
    XLSX.writeFile(wb, `razao-contas-${filters.dataInicio || 'completo'}.xlsx`)
  }

  // ─── Export PDF (print) ──────────────────────────────────────────────────────

  const handlePrint = () => window.print()

  // ─── Resumo por grupo ─────────────────────────────────────────────────────

  const resumoGrupo = useMemo(() => {
    const grupos: Record<string, { credito: number; debito: number; contas: number }> = {}
    razao.forEach(e => {
      const g = e.conta.grupoConta || 'outros'
      if (!grupos[g]) grupos[g] = { credito: 0, debito: 0, contas: 0 }
      grupos[g].credito += e.totalCredito
      grupos[g].debito += e.totalDebito
      grupos[g].contas += 1
    })
    return grupos
  }, [razao])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-secondary btn-icon" style={{ marginTop: 2 }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} color="#fff" />
            </div>
            <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>Razão de Contas</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contabilidade</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>
            Razão analítico por plano de contas — débitos, créditos e saldo por conta
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
            {showFilters ? <EyeOff size={11} /> : <Eye size={11} />}
            {showFilters ? 'Ocultar' : 'Filtros'}
          </button>
          {hasLoaded && (
            <>
              <button onClick={() => { setAllExpanded(!allExpanded); setExpandVersion(v => v + 1) }} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
                <Layers size={11} /> {allExpanded ? 'Recolher' : 'Expandir'} Tudo
              </button>
              <button onClick={exportXLSX} className="btn btn-sm" style={{ gap: 5, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
                <FileSpreadsheet size={11} /> Excel
              </button>
              <button onClick={handlePrint} className="btn btn-danger btn-sm" style={{ gap: 5 }}>
                <Printer size={11} /> PDF/Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── FILTROS ─────────────────────────────────────────────────────── */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onChange={handleChange}
          onApply={handleApply}
          loading={loading}
          planoContas={planoContas}
          centrosCusto={centrosCusto}
        />
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      {hasLoaded && totais && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <KpiCard label="Total Crédito" value={`R$ ${fmtR(totais.credito)}`} icon={<TrendingUp size={16} />} color="#10b981" sub="Entradas no período" />
          <KpiCard label="Total Débito" value={`R$ ${fmtR(totais.debito)}`} icon={<TrendingDown size={16} />} color="#ef4444" sub="Saídas no período" />
          <KpiCard label="Saldo" value={`R$ ${fmtR(Math.abs(totais.saldo))}`} icon={totais.saldo >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} color={totais.saldo >= 0 ? '#3b82f6' : '#f59e0b'} sub={totais.saldo >= 0 ? 'Saldo positivo' : 'Saldo negativo'} />
          <KpiCard label="Lançamentos" value={totais.lancamentos.toLocaleString('pt-BR')} icon={<Activity size={16} />} color="#8b5cf6" sub={`em ${totais.contas} conta${totais.contas !== 1 ? 's' : ''}`} />
        </div>
      )}

      {/* ── RESUMO POR GRUPO ─────────────────────────────────────────────── */}
      {hasLoaded && Object.keys(resumoGrupo).length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Object.entries(resumoGrupo).map(([g, data]) => {
            const color = GRUPO_COLOR[g] || '#6b7280'
            return (
              <div key={g} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${color}`, flex: '1 0 160px', maxWidth: 220 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={13} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{GRUPO_LABEL[g] || g}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'monospace' }}>
                    {data.credito > 0 ? `C: R$ ${fmtR(data.credito)}` : `D: R$ ${fmtR(data.debito)}`}
                  </div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{data.contas} conta{data.contas !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── STATE: sem resultados / não consultado ────────────────────────── */}
      {!hasLoaded && !loading && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <BookOpen size={48} style={{ opacity: 0.15, marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>Razão de Contas</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Configure os filtros e clique em <strong>Aplicar Filtros</strong> para gerar o razão contábil.</div>
          <button onClick={handleApply} className="btn btn-primary" style={{ gap: 8 }}>
            <BookOpen size={14} /> Gerar Razão Agora
          </button>
        </div>
      )}

      {loading && (
        <div className="card" style={{ padding: 50, textAlign: 'center' }}>
          <RefreshCw size={28} style={{ animation: 'spin 0.8s linear infinite', color: '#3b82f6', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Processando o razão contábil...</div>
        </div>
      )}

      {hasLoaded && !loading && razao.length === 0 && (
        <div className="card" style={{ padding: 50, textAlign: 'center' }}>
          <Search size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Nenhum lançamento encontrado</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 6 }}>Ajuste os filtros e tente novamente.</div>
        </div>
      )}

      {/* ── RAZÃO POR CONTA ──────────────────────────────────────────────── */}
      {hasLoaded && !loading && razao.length > 0 && (
        <>
          {/* Cabeçalho da listagem */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={12} /> {razao.length} conta{razao.length !== 1 ? 's' : ''} · {totais?.lancamentos ?? 0} lançamentos
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>Ordenado por código da conta</span>
            </div>
          </div>

          {/* Blocos por conta */}
          {razao.map(entry => (
            <ContaBlock
              key={`${entry.conta.id}-${expandVersion}`}
              entry={entry}
              defaultOpen={allExpanded || razao.length <= 3}
            />
          ))}

          {/* Totalizador final */}
          <div style={{
            marginTop: 16, borderRadius: 12, padding: '16px 20px',
            background: 'linear-gradient(135deg, hsl(var(--bg-elevated)), hsl(var(--bg-surface)))',
            border: '2px solid hsl(var(--border-default))',
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                ▼ TOTAIS GERAIS DO PERÍODO
              </div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                {filters.dataInicio ? fmtIsoDate(filters.dataInicio) : '—'} a {filters.dataFim ? fmtIsoDate(filters.dataFim) : '—'}
                {' · '}{nomeEscola}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Crédito</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>R$ {fmtR(totais?.credito ?? 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Débito</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>R$ {fmtR(totais?.debito ?? 0)}</div>
              </div>
              <div style={{ borderLeft: '1px solid hsl(var(--border-subtle))', paddingLeft: 24 }}>
                <div style={{ fontSize: 9, color: (totais?.saldo ?? 0) >= 0 ? '#3b82f6' : '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {(totais?.saldo ?? 0) >= 0 ? '▲ Saldo Credor' : '▼ Saldo Devedor'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: (totais?.saldo ?? 0) >= 0 ? '#3b82f6' : '#f59e0b', fontFamily: 'monospace' }}>
                  R$ {fmtR(Math.abs(totais?.saldo ?? 0))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PRINT STYLES ────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media print {
          body * { visibility: hidden; }
          .card, .card *, button { visibility: visible; }
          header, nav, aside { display: none !important; }
        }
      `}</style>
    </div>
  )
}
