'use client'
import { useData, ConfigPlanoContas, newId } from '@/lib/dataContext'
import { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Plus, Edit2, Trash2, Check, ChevronRight, ChevronDown, FileText, Search, Eye, X, Upload, Download, AlertCircle } from 'lucide-react'

const BLANK: Omit<ConfigPlanoContas, 'id' | 'createdAt'> = {
  codPlano: '', descricao: '', tipo: 'analitico', grupoConta: 'receitas', parentId: '', situacao: 'ativo',
}

const TIPO_CFG = {
  analitico: { label: 'Analítico', color: '#3b82f6', desc: 'Recebe lançamentos diretos' },
  sintetico: { label: 'Sintético', color: '#8b5cf6', desc: 'Agrupa sub-contas' },
  detalhe:   { label: 'Detalhe',   color: '#10b981', desc: 'Nível mais granular' },
}

const GRUPO_CFG = {
  receitas: { color: '#10b981', emoji: '📈' },
  despesas: { color: '#ef4444', emoji: '📉' },
}

interface PlanoNode extends ConfigPlanoContas { children: PlanoNode[] }

function buildTree(items: ConfigPlanoContas[], parentId: string = ''): PlanoNode[] {
  return items
    .filter(i => i.parentId === parentId)
    .sort((a, b) => a.codPlano.localeCompare(b.codPlano, undefined, { numeric: true }))
    .map(i => ({ ...i, children: buildTree(items, i.id) }))
}

/* ─── Skeleton preview modal ──────────────────────────────────── */
function SkeletonNode({ node, depth }: { node: PlanoNode; depth: number }) {
  const gc = GRUPO_CFG[node.grupoConta]
  const tc = TIPO_CFG[node.tipo]
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingLeft: 20 + depth * 24, paddingTop: 5, paddingBottom: 5,
        borderLeft: depth > 0 ? `2px solid ${gc.color}40` : 'none',
        marginLeft: depth > 0 ? 20 + (depth - 1) * 24 : 0,
      }}>
        {node.children.length > 0 ? (
          <ChevronRight size={12} color={gc.color} />
        ) : (
          <div style={{ width: 12 }} />
        )}
        <code style={{ fontSize: 12, fontWeight: 800, color: gc.color, minWidth: 50 }}>{node.codPlano}</code>
        <span style={{ fontSize: 13, fontWeight: node.tipo === 'sintetico' ? 700 : 400, color: 'hsl(var(--text-primary))' }}>{node.descricao}</span>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${tc.color}20`, color: tc.color, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{tc.label}</span>
        {node.situacao === 'inativo' && <span style={{ fontSize: 9, color: '#f87171' }}>inativo</span>}
      </div>
      {node.children.map(child => <SkeletonNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  )
}

/* ─── Table row (recursive) ───────────────────────────────────── */
function PlanoRow({ node, depth, onEdit, onDelete, expanded, onToggle }: {
  node: PlanoNode; depth: number; onEdit: (n: ConfigPlanoContas) => void
  onDelete: (id: string) => void; expanded: Set<string>; onToggle: (id: string) => void
}) {
  const tc = TIPO_CFG[node.tipo]
  const gc = GRUPO_CFG[node.grupoConta]
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)

  return (
    <>
      <tr style={{ borderTop: '1px solid hsl(var(--border-subtle))', opacity: node.situacao === 'inativo' ? 0.5 : 1 }}>
        <td style={{ paddingLeft: 16 + depth * 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {hasChildren ? (
              <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: 2 }} onClick={() => onToggle(node.id)}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : <span style={{ width: 20, display: 'inline-block' }} />}
            <code style={{ fontSize: 13, fontFamily: 'monospace', color: gc.color, fontWeight: 800 }}>{node.codPlano}</code>
          </div>
        </td>
        <td style={{ fontWeight: depth === 0 ? 700 : 500, fontSize: 13 }}>{node.descricao}</td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${tc.color}20`, color: tc.color, fontWeight: 700 }}>{tc.label}</span>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${gc.color}20`, color: gc.color, fontWeight: 700 }}>{gc.emoji} {node.grupoConta === 'receitas' ? 'Receitas' : 'Despesas'}</span>
        </td>
        <td style={{ textAlign: 'center' }}>
          <span className={`badge ${node.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{node.situacao === 'ativo' ? '✓' : '✗'}</span>
        </td>
        <td>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(node)} title="Editar"><Edit2 size={12} /></button>
            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => onDelete(node.id)} title="Excluir"><Trash2 size={12} /></button>
          </div>
        </td>
      </tr>
      {isExpanded && node.children.map(child => (
        <PlanoRow key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  )
}

/* ─── Main page ───────────────────────────────────────────────── */
export default function PlanoContasPage() {
  const { cfgPlanoContas, setCfgPlanoContas } = useData()
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState<'todos' | 'receitas' | 'despesas'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'analitico' | 'sintetico' | 'detalhe'>('todos')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showSkeleton, setShowSkeleton] = useState(false)
  // Import XLSX
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importSuccess, setImportSuccess] = useState(0)
  const [showImportResult, setShowImportResult] = useState(false)

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const expandAll = () => setExpanded(new Set(cfgPlanoContas.map(p => p.id)))
  const collapseAll = () => setExpanded(new Set())

  const filtered = useMemo(() => {
    let list = cfgPlanoContas
    if (filtroGrupo !== 'todos') list = list.filter(p => p.grupoConta === filtroGrupo)
    if (filtroTipo !== 'todos') list = list.filter(p => p.tipo === filtroTipo)
    if (search) list = list.filter(p =>
      p.descricao.toLowerCase().includes(search.toLowerCase()) || p.codPlano.includes(search)
    )
    return list
  }, [cfgPlanoContas, filtroGrupo, filtroTipo, search])

  const tree = useMemo(() => search ? [] : buildTree(filtered), [filtered, search])
  const skeletonTree = useMemo(() => buildTree(cfgPlanoContas.filter(p => p.situacao === 'ativo')), [cfgPlanoContas])

  const openNew = (parentId = '') => {
    setEditId(null)
    const parent = parentId ? cfgPlanoContas.find(p => p.id === parentId) : null
    const childCount = cfgPlanoContas.filter(p => p.parentId === parentId).length
    const sugCod = parent ? `${parent.codPlano}.${childCount + 1}` : `${cfgPlanoContas.filter(p => !p.parentId).length + 1}`
    setForm({ ...BLANK, parentId, codPlano: sugCod, grupoConta: parent?.grupoConta ?? 'receitas' })
    setShowForm(true)
  }
  const openEdit = (p: ConfigPlanoContas) => {
    setEditId(p.id)
    setForm({ codPlano: p.codPlano, descricao: p.descricao, tipo: p.tipo, grupoConta: p.grupoConta, parentId: p.parentId, situacao: p.situacao })
    setShowForm(true)
  }
  const handleDelete = (id: string) => {
    if (cfgPlanoContas.some(p => p.parentId === id)) { alert('Não é possível excluir: este item possui sub-contas.'); return }
    if (!confirm('Excluir esta conta?')) return
    setCfgPlanoContas(prev => prev.filter(p => p.id !== id))
  }
  const handleSave = () => {
    if (!form.codPlano.trim() || !form.descricao.trim()) return
    if (editId) {
      setCfgPlanoContas(prev => prev.map(p => p.id === editId ? { ...p, ...form } : p))
    } else {
      const novo: ConfigPlanoContas = { ...form, id: newId('PC'), createdAt: new Date().toISOString() }
      setCfgPlanoContas(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  const sinteticos = cfgPlanoContas.filter(p => p.tipo === 'sintetico' || p.tipo === 'analitico')
  const totalReceitas = cfgPlanoContas.filter(p => p.grupoConta === 'receitas').length
  const totalDespesas = cfgPlanoContas.filter(p => p.grupoConta === 'despesas').length

  // ── Gera próximo código disponível ──────────────────────────────
  const gerarProximoCod = (existentes: ConfigPlanoContas[]): string => {
    const tops = existentes.filter(p => !p.parentId).map(p => parseInt(p.codPlano) || 0)
    const max = tops.length > 0 ? Math.max(...tops) : 0
    return String(max + 1)
  }

  // ── Download do template XLSX ────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const header = [['Codigo (auto)', 'Descricao', 'Tipo', 'Grupo']]
    const examples = [
      ['', 'Receitas Operacionais', 'sintetico', 'receitas'],
      ['', 'Mensalidades', 'analitico', 'receitas'],
      ['', 'Taxas e Servicos', 'analitico', 'receitas'],
      ['', 'Despesas Operacionais', 'sintetico', 'despesas'],
      ['', 'Folha de Pagamento', 'analitico', 'despesas'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([...header, ...examples])
    // Larguras das colunas
    ws['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 16 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Plano de Contas')
    XLSX.writeFile(wb, 'template_plano_contas.xlsx')
  }

  // ── Importar XLSX ────────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportErrors([])
    setImportSuccess(0)
    setShowImportResult(false)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        const erros: string[] = []
        const novas: ConfigPlanoContas[] = []
        const TIPOS_VALIDOS = ['analitico', 'sintetico', 'detalhe']
        const GRUPOS_VALIDOS = ['receitas', 'despesas']

        // Pula linha de cabeçalho (linha 0)
        rows.slice(1).forEach((row, i) => {
          const lnum = i + 2 // linha no xlsx (1-indexed + header)
          const descricao = String(row[1] || '').trim()
          const tipoRaw = String(row[2] || '').trim().toLowerCase()
          const grupoRaw = String(row[3] || '').trim().toLowerCase()

          if (!descricao) { erros.push(`Linha ${lnum}: descrição vazia — ignorada`); return }
          if (!TIPOS_VALIDOS.includes(tipoRaw)) { erros.push(`Linha ${lnum}: tipo "${tipoRaw}" inválido. Use: analitico, sintetico ou detalhe`); return }
          if (!GRUPOS_VALIDOS.includes(grupoRaw)) { erros.push(`Linha ${lnum}: grupo "${grupoRaw}" inválido. Use: receitas ou despesas`); return }

          novas.push({
            id: newId('PC'),
            codPlano: '',    // será calculado abaixo
            descricao,
            tipo: tipoRaw as ConfigPlanoContas['tipo'],
            grupoConta: grupoRaw as 'receitas' | 'despesas',
            parentId: '',    // sempre raiz
            situacao: 'ativo',
            createdAt: new Date().toISOString(),
          })
        })

        // Gera códigos sequenciais evitando conflitos
        setCfgPlanoContas(prev => {
          const todas = [...prev]
          novas.forEach(nova => {
            const cod = gerarProximoCod(todas)
            nova.codPlano = cod
            todas.push(nova)
          })
          return todas
        })

        setImportErrors(erros)
        setImportSuccess(novas.length)
        setShowImportResult(true)
      } catch (err) {
        setImportErrors(['Erro ao ler o arquivo. Certifique-se de enviar um arquivo .xlsx válido.'])
        setShowImportResult(true)
      }
      // Reset input para permitir re-upload do mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div>
      {/* MODAL ESQUELETO */}
      {showSkeleton && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowSkeleton(false)}>
          <div className="card" style={{ width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Esqueleto do Plano de Contas</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Estrutura hierárquica das contas ativas</div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowSkeleton(false)}><X size={16} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px 0' }}>
              {skeletonTree.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhuma conta ativa cadastrada</div>
              ) : (
                <>
                  {/* Receitas */}
                  {skeletonTree.filter(n => n.grupoConta === 'receitas').length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ padding: '6px 24px', fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>📈 Receitas</div>
                      {skeletonTree.filter(n => n.grupoConta === 'receitas').map(n => <SkeletonNode key={n.id} node={n} depth={0} />)}
                    </div>
                  )}
                  {/* Despesas */}
                  {skeletonTree.filter(n => n.grupoConta === 'despesas').length > 0 && (
                    <div>
                      <div style={{ padding: '6px 24px', fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>📉 Despesas</div>
                      {skeletonTree.filter(n => n.grupoConta === 'despesas').map(n => <SkeletonNode key={n.id} node={n} depth={0} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Plano de Contas</h1>
          <p className="page-subtitle">Hierarquia contábil de receitas e despesas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
            <Download size={13} />Template XLSX
          </button>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Upload size={13} />Importar XLSX
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSkeleton(true)}><Eye size={13} />Ver Esqueleto</button>
          <button className="btn btn-secondary btn-sm" onClick={expandAll}>Expandir tudo</button>
          <button className="btn btn-secondary btn-sm" onClick={collapseAll}>Recolher</button>
          <button className="btn btn-primary btn-sm" onClick={() => openNew()}><Plus size={13} />Nova Conta</button>
        </div>
      </div>

      {/* Banner resultado de importação */}
      {showImportResult && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12, border: `1px solid ${importErrors.length === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, background: importErrors.length === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={18} color={importErrors.length === 0 ? '#10b981' : '#f59e0b'} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            {importSuccess > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: importErrors.length > 0 ? 6 : 0 }}>
                ✅ {importSuccess} conta{importSuccess !== 1 ? 's' : ''} importada{importSuccess !== 1 ? 's' : ''} com sucesso
              </div>
            )}
            {importErrors.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚠ {importErrors.length} linha{importErrors.length !== 1 ? 's' : ''} ignorada{importErrors.length !== 1 ? 's' : ''}:</div>
                {importErrors.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'hsl(var(--text-muted))', paddingLeft: 8 }}>• {e}</div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowImportResult(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: cfgPlanoContas.length, color: '#3b82f6' },
          { label: 'Receitas', value: totalReceitas, color: '#10b981' },
          { label: 'Despesas', value: totalDespesas, color: '#ef4444' },
          { label: 'Ativos', value: cfgPlanoContas.filter(p => p.situacao === 'ativo').length, color: '#8b5cf6' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Buscar conta ou código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-list">
          {(['todos', 'receitas', 'despesas'] as const).map(g => (
            <button key={g} className={`tab-trigger ${filtroGrupo === g ? 'active' : ''}`} onClick={() => setFiltroGrupo(g)}>
              {g === 'todos' ? 'Todos' : g === 'receitas' ? '📈 Receitas' : '📉 Despesas'}
            </button>
          ))}
        </div>
        <div className="tab-list">
          {(['todos', 'sintetico', 'analitico', 'detalhe'] as const).map(t => (
            <button key={t} className={`tab-trigger ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)}>
              {t === 'todos' ? 'Todos tipos' : TIPO_CFG[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card" style={{ padding: '22px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa' }}>{editId ? '✏️ Editar Conta' : '➕ Nova Conta'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 2fr 1fr 1fr 2fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Cód. Plano *</label>
              <input className="form-input" value={form.codPlano} onChange={e => setForm(p => ({ ...p, codPlano: e.target.value }))} placeholder="1.1.1"
                style={{ fontFamily: 'monospace', fontWeight: 800 }} />
            </div>
            <div>
              <label className="form-label">Descrição *</label>
              <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Mensalidades recebidas" />
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as ConfigPlanoContas['tipo'] }))}>
                <option value="sintetico">Sintético</option>
                <option value="analitico">Analítico</option>
                <option value="detalhe">Detalhe</option>
              </select>
            </div>
            <div>
              <label className="form-label">Grupo</label>
              <select className="form-input" value={form.grupoConta} onChange={e => setForm(p => ({ ...p, grupoConta: e.target.value as 'receitas' | 'despesas' }))}>
                <option value="receitas">📈 Receitas</option>
                <option value="despesas">📉 Despesas</option>
              </select>
            </div>
            <div>
              <label className="form-label">Conta pai (hierarquia)</label>
              <select className="form-input" value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
                <option value="">— Raiz (sem pai)</option>
                {sinteticos.filter(s => s.id !== editId).map(s => <option key={s.id} value={s.id}>{s.codPlano} — {s.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Situação</label>
              <select className="form-input" value={form.situacao} onChange={e => setForm(p => ({ ...p, situacao: e.target.value as 'ativo' | 'inativo' }))}>
                <option value="ativo">✓ Ativo</option>
                <option value="inativo">✗ Inativo</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
            {Object.entries(TIPO_CFG).map(([k, tc]) => (
              <span key={k} style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                <span style={{ color: tc.color, fontWeight: 700 }}>{tc.label}:</span> {tc.desc}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />{editId ? 'Salvar' : 'Criar Conta'}</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {cfgPlanoContas.length === 0 ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.15 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Plano de contas vazio</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Comece criando os grupos principais de Receitas e Despesas.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-success" onClick={() => { openNew(); }}><Plus size={14} />Criar grupo Receitas</button>
            <button className="btn btn-danger" onClick={() => { openNew(); }}><Plus size={14} />Criar grupo Despesas</button>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 130 }}>Cód.</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'center', width: 110 }}>Tipo</th>
                <th style={{ textAlign: 'center', width: 130 }}>Grupo</th>
                <th style={{ textAlign: 'center', width: 90 }}>Situação</th>
                <th style={{ width: 80 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {search ? (
                filtered.sort((a, b) => a.codPlano.localeCompare(b.codPlano, undefined, { numeric: true })).map(p => (
                  <PlanoRow key={p.id} node={{ ...p, children: [] }} depth={0} onEdit={openEdit} onDelete={handleDelete} expanded={expanded} onToggle={toggleExpand} />
                ))
              ) : (
                tree.map(node => (
                  <PlanoRow key={node.id} node={node} depth={0} onEdit={openEdit} onDelete={handleDelete} expanded={expanded} onToggle={toggleExpand} />
                ))
              )}
            </tbody>
          </table>
          {search && filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-muted))' }}>Nenhuma conta encontrada</div>
          )}
        </div>
      )}
    </div>
  )
}
