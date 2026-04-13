'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useApiQuery } from '@/hooks/useApi';

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
  metodosPagamento: { id: string; nome: string }[]
  tiposDocumento: string[]
}

function FormModal({ open, onClose, onSave, initial, defaultCaixaId, caixas, fornecedores, planosContas, metodosPagamento, tiposDocumento }: FormModalProps) {
  const [form, setForm] = useState<Omit<MovimentacaoManual, 'id' | 'criadoEm' | 'editadoEm'>>(initial ? {
    caixaId: initial.caixaId, tipo: initial.tipo,
    fornecedorId: initial.fornecedorId, fornecedorNome: initial.fornecedorNome,
    descricao: initial.descricao, dataLancamento: initial.dataLancamento,
    dataMovimento: initial.dataMovimento, valor: initial.valor,
    planoContasId: initial.planoContasId, planoContasDesc: initial.planoContasDesc,
    tipoDocumento: initial.tipoDocumento, numeroDocumento: initial.numeroDocumento,
    dataEmissao: initial.dataEmissao, compensadoBanco: initial.compensadoBanco,
    observacoes: initial.observacoes,
  } : { ...BLANK_FORM, caixaId: defaultCaixaId ?? '' })

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  // Modal seleção Fornecedor
  const [showFornMov, setShowFornMov] = useState(false)
  const [fornMovSearch, setFornMovSearch] = useState('')
  const fornFiltered = useMemo(() => {
    const q = fornMovSearch.toLowerCase()
    return fornecedores.filter(f => !q || f.nome.toLowerCase().includes(q))
  }, [fornecedores, fornMovSearch])

  const handlePlano = (id: string) => {
    const pl = planosContas.find(x => x.id === id)
    setForm(p => ({ ...p, planoContasId: id, planoContasDesc: pl ? `${(pl as any).codPlano} - ${pl.descricao}` : '' }))
  }

  // Modal seleção Plano de Contas — filtrado por grupoConta
  const [showPlanoMov, setShowPlanoMov] = useState(false)
  const [planoMovSearch, setPlanoMovSearch] = useState('')
  const planosFiltered = useMemo(() => {
    const q = planoMovSearch.toLowerCase()
    return planosContas.filter(p => {
      // Filtrar pelo tipo (receitas / despesas)
      const isTipoValido = form.tipo === 'receita' ? p.grupoConta === 'receitas' : p.grupoConta === 'despesas';
      if (!isTipoValido) return false;

      // Filtrar por texto
      return !q || p.descricao.toLowerCase().includes(q) || ((p as any).codPlano || '').toLowerCase().includes(q)
    })
  }, [planosContas, planoMovSearch, form.tipo])

  if (!open) return null

  return (
    <>
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
              <button key={t} onClick={() => { if (form.tipo !== t) setForm(p => ({ ...p, tipo: t, planoContasId: '', planoContasDesc: '' })) }}
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
            {/* FORNECEDOR — Modal */}
            <div>
              <label className="form-label">Fornecedor / Pagador</label>
              {form.fornecedorNome ? (
                <div style={{ padding: '8px 12px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{form.fornecedorNome}</span>
                  <button type="button" onClick={() => setForm(p => ({ ...p, fornecedorId: '', fornecedorNome: '' }))} className="btn btn-ghost btn-sm btn-icon"><X size={14} /></button>
                </div>
              ) : (
                <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))' }} onClick={() => setShowFornMov(true)}>
                   Selecionar ou digitar livremente <Search size={14} />
                </button>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* Plano de Contas */}
            <div>
              <label className="form-label">Conta (Plano de Contas)
                {form.planoContasId && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginLeft: 8 }}>✓ Vinculado</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '9px 14px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, fontSize: 13, color: form.planoContasId ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {form.planoContasId ? (() => {
                      const sel = planosContas.find(p => p.id === form.planoContasId);
                      return (
                        <><code style={{ 
                          fontSize: 10, 
                          background: sel?.grupoConta === 'receitas' ? 'rgba(16,185,129,0.12)' : sel?.grupoConta === 'despesas' ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)', 
                          color: sel?.grupoConta === 'receitas' ? '#10b981' : sel?.grupoConta === 'despesas' ? '#ef4444' : '#60a5fa', 
                          padding: '1px 5px', 
                          borderRadius: 3 
                        }}>{sel?.codPlano || ''}</code>
                        <span style={{ fontWeight: 600 }}>{sel?.descricao}</span></>
                      );
                    })() : <span>Nenhuma conta selecionada</span>}
                </div>
                <button type="button" className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '0 12px' }}
                  onClick={() => { setPlanoMovSearch(''); setShowPlanoMov(true) }}>
                  <Search size={12} />Selecionar
                </button>
                {form.planoContasId && <button type="button" className="btn btn-ghost btn-icon" onClick={() => handlePlano('')}><X size={12} /></button>}
              </div>
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
                        <code style={{ 
                          fontSize: 10, 
                          background: p.grupoConta === 'receitas' ? 'rgba(16,185,129,0.12)' : p.grupoConta === 'despesas' ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)', 
                          color: p.grupoConta === 'receitas' ? '#10b981' : p.grupoConta === 'despesas' ? '#ef4444' : '#60a5fa', 
                          padding: '1px 5px', 
                          borderRadius: 3 
                        }}>{p.codPlano || 'S/C'}</code>
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
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14, marginBottom: 14 }}>
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
      
      {/* Modal Sobreposto: Selecionar Fornecedor */}
      {showFornMov && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 16, width: '100%', maxWidth: 440, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Selecionar Fornecedor</div>
              <button onClick={() => setShowFornMov(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>
            <div style={{ padding: 12, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'hsl(var(--text-muted))' }} />
                <input autoFocus className="form-input" style={{ paddingLeft: 34 }} placeholder="Buscar por nome..." value={fornMovSearch} onChange={e => setFornMovSearch(e.target.value)} />
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {fornFiltered.map(f => (
                <button key={f.id} onClick={() => { setForm(p => ({ ...p, fornecedorId: f.id, fornecedorNome: f.nome })); setShowFornMov(false) }}
                  style={{ padding: '12px 14px', borderRadius: 8, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nome}</div>
                </button>
              ))}
              {fornFiltered.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                    {fornMovSearch ? (
                      <>
                        Nenhum fornecedor encontrado.<br/><br/>
                        <button className="btn btn-primary btn-sm" onClick={() => { setForm(p => ({ ...p, fornecedorId: '', fornecedorNome: fornMovSearch })); setShowFornMov(false) }}>Usar "{fornMovSearch}" provisoriamente</button>
                      </>
                    ) : 'Nenhum fornecedor.'}
                  </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Página principal ───────────────────────────────────────────────
export default function MovimentacoesPage() {
  const { movimentacoesManuais = [], setMovimentacoesManuais, fornecedoresCad = [], cfgPlanoContas = [], cfgMetodosPagamento = [], cfgTiposDocumento = [] } = useData();
  
  const { data: respMovs, refetch: refetchMovs } = useApiQuery<any>(['movs-todas'], '/api/financeiro/movimentacoes', { limit: 5000 })
  const allMovs = respMovs?.data || []

  // Buscando caixas em tempo real do novo backend
  const { data: respCaixas, refetch: refetchCaixas } = useApiQuery<any>(['caixas'], '/api/financeiro/caixas', {})
  const caixasAbertos = respCaixas?.data || []

  // Unifica memoria legada com BD nativo de Contas a Pagar/Receber e PDV Automático
  const movsUnificadas = useMemo(() => {
    const dbMap = new Map((allMovs || []).map((m:any) => [m.id, m]));
    const dbRefMap = new Set((allMovs || []).map((m:any) => m.referenciaId || (m.dados && m.dados.referenciaId)).filter(Boolean));
    const list = [...(allMovs || [])];
    
    for (const localM of movimentacoesManuais) {
      if (!dbMap.has(localM.id) && !dbRefMap.has(localM.id)) {
        list.push(localM as any);
      }
    }
    return list.map((m: any) => {
      const pcId = m.planoContasId || m.plano_contas_id || '';
      const pc = (cfgPlanoContas || []).find(p => p.id === pcId);
      const pcDesc = pc ? `${(pc as any).codPlano||''} - ${pc.descricao}` : (m.planoContasDesc || m.planoContas || '');

      return {
        id: m.id,
        caixaId: m.caixaId || m.caixa_id || '',
        tipo: (m.tipo === 'entrada' || m.tipo === 'receita') ? 'receita' : 'despesa',
        fornecedorId: m.fornecedorId || '',
        fornecedorNome: m.fornecedorNome || m.fornecedor || m.operador || '',
        descricao: m.descricao || '',
        dataLancamento: m.dataLancamento || m.data || String(m.criado_em || m.created_at || '').slice(0,10) || new Date().toISOString().slice(0, 10),
        dataMovimento: m.dataMovimento || m.data || String(m.criado_em || m.created_at || '').slice(0,10) || new Date().toISOString().slice(0, 10),
        valor: typeof m.valor === 'string' ? parseFloat(m.valor) : (Number(m.valor) || 0),
        planoContasId: pcId,
        planoContasDesc: pcDesc,
        tipoDocumento: m.tipoDocumento || m.forma_pagamento || m.compensadoBanco || 'OUTRO',
        numeroDocumento: m.numeroDocumento || m.referenciaId || '',
        dataEmissao: m.dataEmissao || m.data || new Date().toISOString().slice(0, 10),
        compensadoBanco: typeof m.compensadoBanco === 'boolean' ? m.compensadoBanco : (m.compensadoBanco ? String(m.compensadoBanco).toLowerCase() !== 'não compensado' : true),
        observacoes: m.observacoes || m.obs || '',
        origem: m.origem || 'manual',
        referenciaId: m.referenciaId || ''
      }
    }) as typeof movimentacoesManuais // Cast for legacy typing
  }, [allMovs, movimentacoesManuais, cfgPlanoContas])

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

  // Sessão de caixa
  const [sessionCaixaId, setSessionCaixaId] = useState<string | null>(null)
  const [showSessionCaixaModal, setShowSessionCaixaModal] = useState(false)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [filtroCompensado, setFiltroCompensado] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [filtroCaixa, setFiltroCaixa] = useState('todos')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Listas derivadas
  const caixasSelect = useMemo(() =>
    caixasAbertos.map(c => ({ id: c.id, label: new Date((c.dataAbertura || c.data_abertura || c.criado_em)?.slice(0,10) + 'T12:00').toLocaleDateString('pt-BR'), operador: c.operador }))
  , [caixasAbertos])

  const caixasAbertosAtivos = useMemo(() =>
    caixasAbertos.filter(c => c.status === 'aberto' || !c.fechado).map(c => ({ id: c.id, label: new Date((c.dataAbertura || c.data_abertura || c.criado_em)?.slice(0,10) + 'T12:00').toLocaleDateString('pt-BR'), operador: c.operador }))
  , [caixasAbertos])

  useEffect(() => {
    if (caixasAbertosAtivos.length > 0 && sessionCaixaId === null) {
      setShowSessionCaixaModal(true)
    }
  }, [caixasAbertosAtivos.length, sessionCaixaId])

  const fornecedoresSelect = useMemo(() =>
    fornecedoresCad.filter(f => f.situacao === 'ativo').map(f => ({ id: f.id, nome: f.nomeFantasia || f.razaoSocial }))
  , [fornecedoresCad])

  const planosSelect = useMemo(() =>
    cfgPlanoContas.filter(p => p.situacao === 'ativo')
  , [cfgPlanoContas])



  // (metodosPagamentoSelect agora vem do DataContext acima)

  // Filtros aplicados
  const filtered = useMemo(() => movsUnificadas.filter(m => {
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
    if (filtroCaixa !== 'todos' && m.caixaId !== filtroCaixa) return false
    if (filtroDataDe && m.dataLancamento < filtroDataDe) return false
    if (filtroDataAte && m.dataLancamento > filtroDataAte) return false
    if (filtroCompensado === 'sim' && !m.compensadoBanco) return false
    if (filtroCompensado === 'nao' && m.compensadoBanco) return false
    if (search && !m.descricao.toLowerCase().includes(search.toLowerCase()) && !m.fornecedorNome.toLowerCase().includes(search.toLowerCase()) && !m.numeroDocumento.includes(search)) return false
    return true
  }).sort((a, b) => b.dataLancamento.localeCompare(a.dataLancamento)), [movsUnificadas, filtroTipo, filtroCaixa, filtroDataDe, filtroDataAte, filtroCompensado, search])

  // Reset pagination when filters change
  useEffect(() => setCurrentPage(1), [search, filtroTipo, filtroCaixa, filtroDataDe, filtroDataAte, filtroCompensado])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  
  const movLista = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  const totalReceitas = filtered.filter(m => (m.tipo === 'receita' || (m as any).tipo === 'entrada') && (m as any).origem !== 'baixa_pagar').reduce((s, m) => s + (Number(m.valor) || 0), 0)
  const totalDespesas = filtered.filter(m => m.tipo === 'despesa' || (m as any).tipo === 'saida' || (m as any).origem === 'baixa_pagar').reduce((s, m) => s + (Number(m.valor) || 0), 0)
  const saldo = totalReceitas - totalDespesas
  const compensados = filtered.filter(m => m.compensadoBanco).length

  const openNew = () => {
    const defaultCaixaId = sessionCaixaId || (caixasAbertosAtivos[caixasAbertosAtivos.length - 1]?.id ?? '')
    setEditId(null); setShowForm(true); setNewDefaultCaixaId(defaultCaixaId)
  }
  const openEdit = (m: MovimentacaoManual) => { setEditId(m.id); setShowForm(true); setNewDefaultCaixaId('') }

  const handleSave = async (data: Omit<MovimentacaoManual, 'id' | 'criadoEm' | 'editadoEm'>) => {
    const now = new Date().toISOString()
    const novId = editId ?? newId('MV')

    // 1. Atualização Otimista UI Local
    if (editId) {
      setMovimentacoesManuais(prev => prev.map(m => m.id === editId ? { ...data, id: editId, criadoEm: m.criadoEm, editadoEm: now } : m))
    } else {
      setMovimentacoesManuais(prev => [...prev, { ...data, id: novId, criadoEm: now, editadoEm: now }])
    }

    // 2. Sincroniza ativamente com o Banco de Dados Native
    try {
      const resp = await fetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId || undefined,
          caixaId: data.caixaId,
          tipo: data.tipo === 'receita' ? 'entrada' : 'saida',
          valor: Number(data.valor),
          descricao: data.descricao || data.planoContasDesc || '',
          data: data.dataMovimento,
          operador: caixasAbertos.find(c => c.id === data.caixaId)?.operador || 'Sistema',
          planoContasId: data.planoContasId || null,
          forma_pagamento: data.tipoDocumento || '',
          compensadoBanco: data.compensadoBanco ? 'Compensado' : 'A Compensar',
          origem: 'manual',
          referenciaId: novId,
          fornecedorId: data.fornecedorId,
          fornecedorNome: data.fornecedorNome || data.fornecedor || ''
        })
      })
      if (!resp.ok) {
        const erro = await resp.json()
        throw new Error(erro.error || 'Erro ao salvar movimentação')
      }
      
      const savedDoc = await resp.json()

      // Atualiza o ID do nosso cache otimista para o ID real e unificado do banco, prevenindo duplicidades em tela
      setMovimentacoesManuais(prev => prev.map(m => m.id === novId ? { ...m, id: savedDoc.id } : m))

      // Atualiza estado do servidor refetching query nativa
      await refetchMovs()
      await refetchCaixas()
      setShowForm(false)
    } catch (e: any) {
      alert(`Falha ao salvar: ${e.message}`)
      console.error('Falha ao sincronizar com banco', e)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setMovimentacoesManuais(prev => prev.filter(m => m.id !== id))
      
      const resp = await fetch(`/api/financeiro/movimentacoes/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Falha ao excluir movimentação (Servidor)')
      
      await refetchMovs()
      await refetchCaixas()
      setConfirmId(null)
    } catch (e) {
      console.error('Erro ao excluir movimentação', e)
      alert('Houve um erro ao tentar excluir.')
    }
  }

  const editingItem = editId ? movsUnificadas.find(m => m.id === editId) ?? null : null

  // Resolução de caixa para exibição
  const nomeCaixa = (caixaId: string) => {
    const c = caixasAbertos.find(x => x.id === caixaId)
    return c ? `${new Date((c.dataAbertura || c.data_abertura || c.criado_em)?.slice(0,10) + 'T12:00').toLocaleDateString('pt-BR')} (${c.operador})` : '—'
  }

  const limparFiltros = () => { setFiltroTipo('todos'); setFiltroCaixa('todos'); setFiltroDataDe(''); setFiltroDataAte(''); setFiltroCompensado('todos'); setSearch(''); setCurrentPage(1); }
  const filtrosAtivos = filtroTipo !== 'todos' || filtroCaixa !== 'todos' || filtroDataDe || filtroDataAte || filtroCompensado !== 'todos' || search

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Movimentações Financeiras</h1>
          <p className="page-subtitle">{filtered.length} lançamentos {sessionCaixaId ? 'neste caixa' : 'totais'} • {sessionCaixaId ? `Caixa selecionado: ${caixasAbertosAtivos.find(c => c.id === sessionCaixaId)?.label || ''}` : 'Geral'}</p>
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
      {movsUnificadas.length === 0 ? (
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
                      {((m.tipo === 'receita' || (m as any).tipo === 'entrada') && (m as any).origem !== 'baixa_pagar')
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
                  <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{m.planoContasDesc || (((m as any).origem === 'baixa_aluno' || (m as any).origem === 'baixa_receber') ? 'Recebimentos / Alunos' : '—')}</td>
                  <td>
                    {m.compensadoBanco
                      ? <span className="badge badge-success" style={{ fontSize: 10 }}>✅ Sim</span>
                      : <span className="badge badge-neutral" style={{ fontSize: 10 }}>❌ Não</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', color: ((m.tipo === 'receita' || (m as any).tipo === 'entrada') && (m as any).origem !== 'baixa_pagar') ? '#10b981' : '#ef4444' }}>
                    {((m.tipo === 'receita' || (m as any).tipo === 'entrada') && (m as any).origem !== 'baixa_pagar') ? '+' : '-'}{fmt(Number(m.valor) || 0)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!og && (
                        <>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(m)} title="Editar"><Pencil size={12} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(m.id)} title="Excluir"><Trash2 size={12} /></button>
                        </>
                      )}
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
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderTop:'1px solid hsl(var(--border-subtle))' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
              <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length} registros
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Itens por pág:</span>
                <select className="form-input" style={{ width: 70, height: 28, fontSize: 11, padding: '0 8px' }} value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={15}>15</option>
                  <option value={22}>22</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            {totalPages > 1 && (
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Anterior</button>
                <div style={{ display:'flex', alignItems:'center', padding:'0 10px', fontSize:13, fontWeight:600 }}>Página {currentPage} de {totalPages}</div>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Próxima</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Formulário */}
      {showForm && (
        <FormModal
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          initial={editingItem}
          defaultCaixaId={newDefaultCaixaId}
          caixas={editId ? caixasSelect : caixasAbertosAtivos}
          fornecedores={fornecedoresSelect}
          planosContas={planosSelect as any}
          metodosPagamento={metodosPagamentoSelect}
          tiposDocumento={TIPOS_DOC}
        />
      )}

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

      {/* Modal Selecionar Caixa na Sessão */}
      {showSessionCaixaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 440, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 32px 100px rgba(0,0,0,0.7)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Check size={24} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Outfit,sans-serif' }}>Selecione o seu Caixa</h3>
              <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 6 }}>Identificamos que você tem caixas abertos. Escolha qual deseja utilizar para os lançamentos de agora.</p>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '50vh', overflowY: 'auto' }}>
              {caixasAbertosAtivos.map(c => (
                <button key={c.id} onClick={() => { setSessionCaixaId(c.id); setFiltroCaixa(c.id); setShowSessionCaixaModal(false); }} 
                  style={{ width: '100%', textAlign: 'left', padding: '16px', borderRadius: 12, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(59,130,246,0.15))', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Caixa {c.label}</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Operador: <strong style={{ color: 'hsl(var(--text-secondary))' }}>{c.operador}</strong></div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', textAlign: 'center' }}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowSessionCaixaModal(false)}>Ignorar e ver todos</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
