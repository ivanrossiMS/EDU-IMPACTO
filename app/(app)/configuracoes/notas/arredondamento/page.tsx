'use client'
import { useData, ConfigArredondamento, RegraArredondamento, newId } from '@/lib/dataContext'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Check, Search, Percent, X, Settings2, Save } from 'lucide-react'

// ── Simulador de Arredondamento ──────────────────────────────────────────────
function TestadorArredondamento({ regras }: { regras: RegraArredondamento[] }) {
  const [val, setVal] = useState('7.6')
  const valor = parseFloat(val)

  const calcResult = () => {
    if (isNaN(valor)) return null
    const allFractional = regras.length > 0 && regras.every(r => r.v1 <= 1 && (r.v2 === null || r.v2 <= 1))
    const intPart = Math.floor(valor)
    const fracPart = parseFloat((valor - intPart).toFixed(6))
    const compareVal = allFractional ? fracPart : valor
    for (const r of regras) {
      let pass1 = false, pass2 = true
      if (r.op1 === '>') pass1 = compareVal > r.v1
      else if (r.op1 === '>=') pass1 = compareVal >= r.v1
      else if (r.op1 === '<') pass1 = compareVal < r.v1
      else if (r.op1 === '<=') pass1 = compareVal <= r.v1
      else if (r.op1 === '=') pass1 = compareVal === r.v1
      else pass1 = true
      if (r.op2 && r.v2 !== null) {
        if (r.op2 === '>') pass2 = compareVal > r.v2
        else if (r.op2 === '>=') pass2 = compareVal >= r.v2
        else if (r.op2 === '<') pass2 = compareVal < r.v2
        else if (r.op2 === '<=') pass2 = compareVal <= r.v2
        else if (r.op2 === '=') pass2 = compareVal === r.v2
      }
      if (pass1 && pass2) {
        const res = allFractional ? intPart + r.res : r.res
        return { res, mode: allFractional ? 'Fração' : 'Absoluto', rule: r }
      }
    }
    return null
  }

  const result = calcResult()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Valor de teste</label>
        <input
          type="number" step="0.1" value={val} onChange={e => setVal(e.target.value)}
          style={{ width: 100, height: 40, borderRadius: 9, border: '1.5px solid #e2e8f0', padding: '0 12px', fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', outline: 'none' }}
        />
      </div>
      <div style={{ fontSize: 22, color: '#94a3b8', fontWeight: 300 }}>→</div>
      <div style={{ background: result ? '#f0fdf4' : '#f8fafc', border: `2px solid ${result ? '#22c55e' : '#e2e8f0'}`, borderRadius: 10, padding: '8px 16px', minWidth: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: result ? '#15803d' : '#94a3b8' }}>
          {isNaN(valor) ? '?' : result ? result.res.toFixed(2) : val}
        </div>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
          {!isNaN(valor) && (result ? `Modo ${result.mode}` : 'Sem regra — manter')}
        </div>
      </div>
      {regras.length === 0 && (
        <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>⚠️ Nenhuma regra cadastrada. Clique em "Inserir Regra" para criar.</span>
      )}
    </div>
  )
}

const BLANK: Omit<ConfigArredondamento, 'id' | 'createdAt' | 'regras'> = {
  codigo: '', descricao: ''
}

const BLANK_RULE: Omit<RegraArredondamento, 'id'> = {
  op1: '>=', v1: 0, op2: '<=', v2: 0, res: 0
}

export default function ArredondamentosPage() {
  const { cfgArredondamentos, setCfgArredondamentos } = useData()
  const [busca, setBusca] = useState('')

  // Modal de Cadastro de Arredondamento (Master)
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Selecionar Arredondamento para Detalhes
  const [detalheArredondamentoId, setDetalheArredondamentoId] = useState<string | null>(null)
  
  // Modal de Detalhes > Regra (Child)
  const [ruleForm, setRuleForm] = useState(BLANK_RULE)
  const [ruleEditId, setRuleEditId] = useState<string | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)

  // ===== LÓGICA MASTER =====
  const gerarCodigo = (): string => {
    const existentes = cfgArredondamentos.map(t => t.codigo)
    let i = cfgArredondamentos.length + 1
    let cod = String(i)
    while (existentes.includes(cod)) { i++; cod = String(i) }
    return cod
  }
  const codigoPreview = editId ? form.codigo : gerarCodigo()

  const openNew = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true) }
  const openEdit = (t: ConfigArredondamento) => {
    setEditId(t.id)
    setForm({ codigo: t.codigo, descricao: t.descricao })
    setShowForm(true)
  }
  const handleDelete = (id: string) => {
    if(confirm('Remover permanentemente este agrupamento de regras?')) {
      setCfgArredondamentos(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleSave = () => {
    if (!form.descricao.trim()) return
    const codigo = editId ? form.codigo : gerarCodigo()
    if (editId) {
      setCfgArredondamentos(prev => prev.map(t => t.id === editId ? { ...t, ...form, codigo } : t))
    } else {
      const novo: ConfigArredondamento = { ...form, codigo, regras: [], id: newId('CA'), createdAt: new Date().toISOString() }
      setCfgArredondamentos(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  // ===== LÓGICA RULES (DETALHES) =====
  const currentArredondamento = cfgArredondamentos.find(c => c.id === detalheArredondamentoId)

  const openNewRule = () => { setRuleEditId(null); setRuleForm({ ...BLANK_RULE }); setShowRuleForm(true) }
  const openEditRule = (r: RegraArredondamento) => {
    setRuleEditId(r.id)
    setRuleForm({ op1: r.op1, v1: r.v1, op2: r.op2, v2: r.v2, res: r.res })
    setShowRuleForm(true)
  }
  
  const handleSaveRule = () => {
    if (!detalheArredondamentoId) return
    const ruleIdToSave = ruleEditId || newId('RA')
    setCfgArredondamentos(prev => prev.map(c => {
      if (c.id === detalheArredondamentoId) {
        const regrasAtualizadas = ruleEditId 
          ? c.regras.map(r => r.id === ruleEditId ? { ...ruleForm, id: r.id } : r)
          : [...c.regras, { ...ruleForm, id: ruleIdToSave }]
        regrasAtualizadas.sort((a,b) => a.v1 - b.v1)
        return { ...c, regras: regrasAtualizadas }
      }
      return c
    }))
    setShowRuleForm(false)
  }

  const handleDeleteRule = (ruleId: string) => {
    if(confirm('Apagar esta regra?')) {
      setCfgArredondamentos(prev => prev.map(c => {
        if (c.id === detalheArredondamentoId) {
          return { ...c, regras: c.regras.filter(r => r.id !== ruleId) }
        }
        return c
      }))
    }
  }

  const handleRestaurarPadroes = () => {
    if (!confirm('Deseja substituir as regras atuais pelos padrões (arredondamento 0.00, 0.50 e 1.00)?')) return
    const padroes: RegraArredondamento[] = [
      { id: newId('RA'), op1: '>=', v1: 0, op2: '<=', v2: 0.25, res: 0 },
      { id: newId('RA'), op1: '>', v1: 0.25, op2: '<=', v2: 0.75, res: 0.5 },
      { id: newId('RA'), op1: '>', v1: 0.75, op2: '<=', v2: 1.00, res: 1 },
    ]
    setCfgArredondamentos(prev => prev.map(c => {
      if (c.id === detalheArredondamentoId) return { ...c, regras: padroes }
      return c
    }))
  }

  const list = cfgArredondamentos.filter(g => g.descricao.toLowerCase().includes(busca.toLowerCase()) || g.codigo.includes(busca))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* --- HEADER ROBUSTO COM ESTILOS DE 'grupos-avaliacao' PARA GARANTIR ESTABILIDADE --- */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            <Percent size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a', margin: 0, lineHeight: 1.2 }}>Arredondamentos</h1>
            <p className="page-subtitle" style={{ color: 'hsl(var(--text-muted))', margin: 0, marginTop: '2px', fontSize: '14px' }}>Regras matemáticas paramétricas e ajustes do portal</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
        {/* Toolbar superior dentro do card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          
          <button onClick={openNew} className="btn btn-primary" style={{ height: '42px', padding: '0 20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(59,130,246,0.25)' }}>
            <Plus size={18} strokeWidth={2.5} /> 
            <span>Novo Registro</span>
          </button>

          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} strokeWidth={2.5} />
            <input 
              type="text" 
              className="form-input"
              style={{ height: '42px', paddingLeft: '38px', borderRadius: '10px' }}
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar registro..."
            />
          </div>
        </div>

        {/* --- FORMULÁRIO INLINE NO CARD PRINCIPAL --- */}
        {showForm && (
          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '14px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)' }}>
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '20px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings2 size={18} />
              {editId ? 'Editar Arredondamento' : 'Novo Arredondamento'}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '20px' }}>
              <div>
                <label className="form-label">Código</label>
                <div style={{ display: 'flex', alignItems: 'center', height: '44px', borderRadius: '10px', border: '1px solid hsl(var(--border-subtle))', background: '#f1f5f9' }}>
                  <span style={{ padding: '0 12px', fontSize: '12px', color: '#64748b', borderRight: '1px solid #e2e8f0', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 700 }}>AUT</span>
                  <span style={{ padding: '0 12px', fontWeight: 800, fontSize: '16px', color: '#3b82f6', letterSpacing: '0.05em' }}>
                    {codigoPreview}
                  </span>
                </div>
              </div>
              <div>
                <label className="form-label">Descrição <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  autoFocus
                  className="form-input"
                  style={{ height: '44px', fontWeight: 600, fontSize: '14px', borderRadius: '10px' }}
                  value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: ARREDONDAMENTO PADRÃO MEC"
                  onKeyDown={e => { if(e.key === 'Enter') handleSave() }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ height: '40px', padding: '0 20px', fontWeight: 700 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} style={{ height: '40px', padding: '0 24px', fontWeight: 700, borderRadius: '8px' }}>
                <Check size={16} />
                {editId ? 'Salvar Edição' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* --- TABELA ROBUSTA DO CARD PRINCIPAL --- */}
        <div className="table-container" style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', width: '120px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição das Regras</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#64748b', width: '160px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>
                    Nenhum arredondamento cadastrado no sistema.
                  </td>
                </tr>
              ) : (
                list.map((g) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s ease', cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '20px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {g.codigo}
                      </span>
                    </td>
                    <td style={{ padding: '20px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                      {g.descricao}
                    </td>
                    <td style={{ padding: '20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => setDetalheArredondamentoId(g.id)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }} title="Regras Matemáticas">
                          <Settings2 size={16} />
                        </button>
                        <button onClick={() => openEdit(g)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(g.id)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MÓDULO DE DETALHES (MODAL TIPO OVERLAY ROBUSTO) --- */}
      {currentArredondamento && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setDetalheArredondamentoId(null)}>
          <div style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', background: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', outline: '1px solid rgba(0,0,0,0.05)' }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Lógica de Arredondamento</h2>
                <div style={{ fontSize: '14px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Editando grupo: 
                  <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '13px' }}>
                    {currentArredondamento.descricao}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => setDetalheArredondamentoId(null)} style={{ width: '40px', height: '40px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              
              {/* Toolbar do Modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '8px 16px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
                  {currentArredondamento.regras.length} regras ativas
                </span>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={handleRestaurarPadroes} className="btn btn-secondary" style={{ height: '42px', padding: '0 20px', borderRadius: '10px', fontWeight: 700, background: '#ffffff' }}>
                    <Settings2 size={16} /> Padrões Base MEC
                  </button>
                  <button onClick={openNewRule} className="btn btn-primary" style={{ height: '42px', padding: '0 20px', borderRadius: '10px', fontWeight: 700, background: '#0f172a' }}>
                    <Plus size={16} color="#fff" /> Inserir Regra
                  </button>
                </div>
              </div>

              {/* Simulador de Arredondamento */}
              <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2563eb', marginBottom: 14 }}>
                  🧪 Simulador — Teste Sua Regra
                </div>
                <TestadorArredondamento regras={currentArredondamento.regras} />
              </div>

              {/* Formula de Regra Inline */}
              {showRuleForm && (
                <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '24px', marginBottom: '32px', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.05)' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#2563eb', marginBottom: '20px', letterSpacing: '0.05em' }}>Configurar Regra Condicional</h3>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: '1 1 140px' }}>
                       <label className="form-label" style={{ fontSize: '10px' }}>Operador Inicial</label>
                       <select className="form-input" style={{ height: '42px', borderRadius: '10px', background: '#f8fafc', fontWeight: 700 }} value={ruleForm.op1} onChange={e => setRuleForm(p => ({ ...p, op1: e.target.value as any }))}>
                         <option value=">=">&gt;= Maior/Igual</option>
                         <option value=">">&gt; Maior que</option>
                         <option value="<=">&lt;= Menor/Igual</option>
                         <option value="<">&lt; Menor que</option>
                         <option value="=">= Igual a</option>
                       </select>
                    </div>
                    <div style={{ flex: '1 1 100px' }}>
                       <label className="form-label" style={{ fontSize: '10px' }}>Valor (X)</label>
                       <input type="number" step="0.01" className="form-input" style={{ height: '42px', borderRadius: '10px', background: '#f8fafc', fontWeight: 700 }} value={ruleForm.v1} onChange={e => setRuleForm(p => ({ ...p, v1: parseFloat(e.target.value) || 0 }))} autoFocus/>
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                       <label className="form-label" style={{ fontSize: '10px' }}>Operador Limite</label>
                       <select className="form-input" style={{ height: '42px', borderRadius: '10px', background: '#f8fafc', fontWeight: 700 }} value={ruleForm.op2} onChange={e => setRuleForm(p => ({ ...p, op2: e.target.value as any }))}>
                         <option value="">Não aplica</option>
                         <option value="<=">&lt;= Menor/Igual</option>
                         <option value="<">&lt; Menor que</option>
                         <option value=">=">&gt;= Maior/Igual</option>
                         <option value=">">&gt; Maior que</option>
                         <option value="=">= Igual a</option>
                       </select>
                    </div>
                    <div style={{ flex: '1 1 100px' }}>
                       <label className="form-label" style={{ fontSize: '10px' }}>Valor (Y)</label>
                       <input type="number" step="0.01" className="form-input" style={{ height: '42px', borderRadius: '10px', background: '#f8fafc', fontWeight: 700 }} placeholder="Opcional" value={ruleForm.v2 === null ? '' : ruleForm.v2} onChange={e => setRuleForm(p => ({ ...p, v2: e.target.value ? parseFloat(e.target.value) : null }))} />
                    </div>
                    
                    <div style={{ flex: '1 1 120px' }}>
                       <label className="form-label" style={{ fontSize: '10px', color: '#8b5cf6' }}>Resultado Final</label>
                       <input type="number" step="0.01" className="form-input" style={{ height: '42px', borderRadius: '10px', background: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9', fontWeight: 800, fontSize: '16px' }} value={ruleForm.res} onChange={e => setRuleForm(p => ({ ...p, res: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', borderTop: '1px solid #eff6ff', paddingTop: '20px' }}>
                    <button className="btn btn-ghost" onClick={() => setShowRuleForm(false)} style={{ height: '38px', padding: '0 20px', fontWeight: 700 }}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSaveRule} style={{ height: '38px', padding: '0 24px', fontWeight: 700, borderRadius: '8px' }}><Save size={16} /> Salvar Regra</button>
                  </div>
                </div>
              )}

              {/* Tabela de Regras */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px' }}>Ordem</th>
                      <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Fórmula (Se a nota original for...)</th>
                      <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', background: '#e0e7ff', width: '180px' }}>Nota Arredondada</th>
                      <th style={{ padding: '16px 24px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', width: '140px' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentArredondamento.regras.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#fcfcfc' }}>
                          Nenhuma regra matemática cadastrada em {currentArredondamento.descricao}.
                        </td>
                      </tr>
                    ) : (
                      currentArredondamento.regras.map((r, idx) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s ease cursor' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '20px 24px', fontWeight: 800, color: '#94a3b8', fontSize: '14px' }}>
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#f1f5f9', padding: '8px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                               <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748b' }}>{r.op1}</span>
                               <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{r.v1.toFixed(2)}</span>
                               {r.op2 && (
                                 <>
                                   <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1', margin: '0 4px' }}></div>
                                   <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748b' }}>{r.op2}</span>
                                   <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{r.v2?.toFixed(2)}</span>
                                 </>
                               )}
                            </div>
                          </td>
                          <td style={{ padding: '20px 24px', textAlign: 'center', background: '#f5f3ff' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '70px', height: '36px', background: '#ffffff', border: '2px solid #ddd6fe', borderRadius: '10px', fontWeight: 900, color: '#6d28d9', fontSize: '16px', boxShadow: '0 2px 4px rgba(109, 40, 217, 0.05)' }}>
                               {r.res.toFixed(2)}
                            </div>
                          </td>
                          <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <button onClick={() => openEditRule(r)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                                <Edit2 size={15} strokeWidth={2.5} />
                              </button>
                              <button onClick={() => handleDeleteRule(r.id)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                <Trash2 size={15} strokeWidth={2.5} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  )
}
