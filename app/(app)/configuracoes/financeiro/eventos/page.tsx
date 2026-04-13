'use client'
import { ConfigEvento, ConfigPlanoContas, newId } from '@/lib/dataContext'
import { useConfigDb } from '@/lib/useConfigDb'
import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Check, Tag, Search, Upload, X, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

const BLANK: Omit<ConfigEvento, 'id' | 'createdAt'> = {
  codigo: '',
  descricao: '',
  tipo: 'receita',
  planoContasId: '',
  situacao: 'ativo'
}

export default function EventosPage() {
  const { data: cfgEventos, setData: setCfgEventos, loading } = useConfigDb<ConfigEvento>('cfgEventos')
  const { data: cfgPlanoContas } = useConfigDb<ConfigPlanoContas>('cfgPlanoContas')
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [filtroSit, setFiltroSit] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [busca, setBusca] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  const gerarCodEV = (): string => {
    const existentes = cfgEventos.map(e => parseInt(e.codigo, 10)).filter(n => !isNaN(n))
    let i = cfgEventos.length + 1
    while (existentes.includes(i)) { i++ }
    return String(i)
  }
  const corEvento = form.tipo === 'receita' ? '#34d399' : '#f87171'
  const filtered = useMemo(() => {
    let list = filtroTipo === 'todos' ? cfgEventos : cfgEventos.filter(e => e.tipo === filtroTipo)
    if (filtroSit !== 'todos') list = list.filter(e => e.situacao === filtroSit)
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(e => e.descricao.toLowerCase().includes(q) || e.codigo.toLowerCase().includes(q))
    }
    return list
  }, [cfgEventos, filtroTipo, filtroSit, busca])

  const downloadModelo = () => {
    const wb = XLSX.utils.book_new()
    const header = [['Codigo', 'Descricao', 'Tipo', 'PlanoDeContas', 'CentroDeCusto', 'Situacao']]
    const examples = [
      ['1', 'Mensalidade Escolar', 'receita', '1.1.01', 'CC001', 'ativo'],
      ['2', 'Pagamento de Salários', 'despesa', '2.1.01', 'CC002', 'ativo']
    ]
    const ws = XLSX.utils.aoa_to_sheet([...header, ...examples])
    ws['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo')

    // ── Aba legenda ──────────────────────────────────────────────────
    const legenda = [
      ['Campo', 'Valores aceitos', 'Obrigatório'],
      ['Codigo', 'Número único. Ex: 1, 2, 10', 'Não (Gerado automático se vazio)'],
      ['Descricao', 'Texto livre', 'Sim'],
      ['Tipo', 'receita | despesa', 'Sim'],
      ['PlanoDeContas', 'Código exato do Plano de Contas (ex: 1.1.01)', 'Não'],
      ['Situacao', 'ativo | inativo', 'Não (Padrão: ativo)'],
    ]
    const wsLeg = XLSX.utils.aoa_to_sheet(legenda)
    wsLeg['!cols'] = [{ wch: 18 }, { wch: 52 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsLeg, 'Legenda')

    XLSX.writeFile(wb, 'modelo_eventos_financeiros.xlsx')
  }

  const handleImportXlsx = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        let count = 0
        let ignorados = 0
        const novos: ConfigEvento[] = []
        rows.slice(1).forEach(row => {
          const codigoRaw     = String(row[0] || '').trim()
          const descricao     = String(row[1] || '').trim()
          const tipoRaw       = String(row[2] || '').trim().toLowerCase()
          const pContasRaw    = String(row[3] || '').trim()
          const cCustoRaw     = String(row[4] || '').trim()
          const situacaoRaw   = String(row[5] || 'ativo').trim().toLowerCase()

          if (!descricao || !tipoRaw) return
          if (cfgEventos.some(ev => ev.descricao.toLowerCase() === descricao.toLowerCase())) { ignorados++; return }

          const tipoNorm = tipoRaw.includes('rec') ? 'receita' : 'despesa'
          const situacaoNorm = situacaoRaw === 'inativo' ? 'inativo' : 'ativo'

          // Código automático caso vazio
          let codigoFinal = codigoRaw
          if (!codigoFinal) {
            const existentesNum = cfgEventos.map(e => parseInt(e.codigo, 10)).filter(n => !isNaN(n))
            const novosNum = novos.map(n => parseInt(n.codigo, 10)).filter(n => !isNaN(n))
            let i = cfgEventos.length + count + 1;
            while (existentesNum.includes(i) || novosNum.includes(i)) { i++ }
            codigoFinal = String(i)
          } else {
            // Remove zeros à esquerda (ex: 01 -> 1)
            const num = parseInt(codigoFinal, 10)
            if (!isNaN(num)) codigoFinal = String(num)
          }

          // Se ainda colidir com um código existente (mesmo preenchido manual), aborta
          if (cfgEventos.some(ev => ev.codigo === codigoFinal) || novos.some(n => n.codigo === codigoFinal)) { ignorados++; return }

          // Associa os relacionamentos pelo código numérico / alphanumérico fornecido
          const pcMatch = pContasRaw ? cfgPlanoContas.find(p => p.codPlano === pContasRaw) : null

          novos.push({ 
            id: newId('EV'), 
            codigo: codigoFinal, 
            descricao, 
            tipo: tipoNorm as 'receita' | 'despesa', 
            planoContasId: pcMatch?.id || '', 
            situacao: situacaoNorm, 
            createdAt: new Date().toISOString() 
          })
          count++
        })
        if (novos.length > 0) setCfgEventos(prev => [...prev, ...novos])
        setImportMsg(`✓ ${count} evento(s) importado(s) com sucesso! ${ignorados > 0 ? `(${ignorados} ignorados por duplicação)` : ''}`)
        setTimeout(() => setImportMsg(''), 6000)
      } catch (err) {
        setImportMsg('Erro ao processar arquivo. Verifique o formato do XLSX.')
        console.error(err)
      }
    }
    reader.readAsBinaryString(file)
    setShowImport(false)
    e.target.value = ''
  }

  const openNew = () => { setEditId(null); setForm({ ...BLANK, codigo: gerarCodEV() }); setShowForm(true) }
  const openEdit = (e: ConfigEvento) => {
    setEditId(e.id)
    setForm(e)
    setShowForm(true)
  }
  const handleDelete = (id: string) => setCfgEventos(prev => prev.filter(e => e.id !== id))
  const handleSave = () => {
    if (!form.descricao.trim()) { alert("A descrição é obrigatória"); return; }
    if (!form.codigo.trim()) { alert("O código é obrigatório"); return; }
    
    // Converte para inteiros para evitar que '01' seja diferente de '1'
    const codigoNum = parseInt(form.codigo, 10);
    const exists = cfgEventos.some(e => parseInt(e.codigo, 10) === codigoNum && e.id !== editId)
    
    if (exists) {
      alert("O código numérico informado já existe. Insira um número único.")
      return
    }
    
    // Removemos zeros da esquerda ao salvar para padronização ('01' -> '1')
    const cleanedCode = String(codigoNum);

    if (editId) {
      setCfgEventos(prev => prev.map(e => e.id === editId ? { ...e, ...form, codigo: cleanedCode } : e))
    } else {
      const novo: ConfigEvento = { ...form, codigo: cleanedCode, id: newId('EV'), createdAt: new Date().toISOString() }
      setCfgEventos(prev => [...prev, novo])
    }
    setShowForm(false)
  }

  const SUGESTOES = [
    { descricao: 'Mensalidade', tipo: 'receita' as const },
    { descricao: 'Material Didático', tipo: 'receita' as const },
    { descricao: 'Taxa de Matrícula', tipo: 'receita' as const },
    { descricao: 'Uniforme', tipo: 'receita' as const },
    { descricao: 'Salários e Encargos', tipo: 'despesa' as const },
    { descricao: 'Aluguel', tipo: 'despesa' as const },
    { descricao: 'Energia Elétrica', tipo: 'despesa' as const },
    { descricao: 'Limpeza e Conservação', tipo: 'despesa' as const },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Eventos Financeiros</h1>
          <p className="page-subtitle">Códigos de eventos para classificação de lançamentos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(p => !p)}><Upload size={13} />Importar XLSX</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} />Novo Evento</button>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="card" style={{ padding:'18px', marginBottom:16, border:'1px solid rgba(59,130,246,0.3)', background:'rgba(59,130,246,0.04)' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
            <Upload size={16} color="#60a5fa" />Importar Eventos via XLSX
          </div>
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginBottom:12, lineHeight:1.6 }}>
            <strong>Formato esperado (XLSX com colunas separadas):</strong><br />
            • Coluna A: Código <em>(Opcional)</em> · Coluna B: Descrição · Coluna C: Tipo (receita/despesa)<br />
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={downloadModelo}><Download size={12} />Baixar Modelo XLSX</button>
            <label className="btn btn-primary btn-sm" style={{ cursor:'pointer' }}>
              <Upload size={12} />Selecionar arquivo
              <input type="file" accept=".xlsx" style={{ display:'none' }} onChange={handleImportXlsx} />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(false)}><X size={12} />Fechar</button>
          </div>
          {importMsg && <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'rgba(16,185,129,0.1)', color:'#10b981', fontSize:12, fontWeight:600 }}>{importMsg}</div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: cfgEventos.length, color: '#3b82f6' },
          { label: 'Receita', value: cfgEventos.filter(e => e.tipo === 'receita').length, color: '#10b981' },
          { label: 'Despesa', value: cfgEventos.filter(e => e.tipo === 'despesa').length, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center', padding:'10px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))' }}>
        <div style={{ position:'relative', flex:1, minWidth:180 }}>
          <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft:28, fontSize:12 }} placeholder="Buscar por descrição ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {(['todos', 'receita', 'despesa'] as const).map(t => (
            <button key={t} className={`btn btn-sm ${filtroTipo === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltroTipo(t)}>
              {t === 'todos' ? '📋 Todos' : t === 'receita' ? '📈 Receitas' : '📉 Despesas'}
            </button>
          ))}
        </div>
        <select className="form-input" style={{ width:'auto', fontSize:12 }} value={filtroSit} onChange={e => setFiltroSit(e.target.value as typeof filtroSit)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">✓ Ativos</option>
          <option value="inativo">✗ Inativos</option>
        </select>
        {(busca || filtroTipo !== 'todos' || filtroSit !== 'todos') && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'#f87171' }} onClick={() => { setBusca(''); setFiltroTipo('todos'); setFiltroSit('todos') }}>✕ Limpar</button>
        )}
        <span style={{ marginLeft:'auto', fontSize:11, color:'hsl(var(--text-muted))' }}>{filtered.length}/{cfgEventos.length} evento(s)</span>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '20px', marginBottom: 16, border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{editId ? 'Editar Evento' : 'Novo Evento Financeiro'}</div>
          {!editId && (
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Sugestões rápidas</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SUGESTOES.map(s => (
                  <button key={s.descricao} type="button" className={`btn btn-sm ${s.tipo === 'receita' ? 'btn-success' : 'btn-secondary'}`} style={{ fontSize: 11 }}
                    onClick={() => setForm(p => ({ ...p, descricao: s.descricao, tipo: s.tipo }))}>
                    {s.tipo === 'receita' ? '📈' : '📉'} {s.descricao}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 1fr 2fr 2fr 1fr', gap: 12 }}>
            {/* Código auto-gerado — agora editável numérico */}
            <div>
              <label className="form-label">Código numérico</label>
              <input type="number" min="1" className="form-input" style={{fontFamily:'monospace', fontWeight:800}} value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Descrição *</label>
              <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Mensalidade" />
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'receita' | 'despesa' }))}>
                <option value="receita">📈 Receita</option>
                <option value="despesa">📉 Despesa</option>
              </select>
            </div>
            <div>
              <label className="form-label">Plano de Contas</label>
              <select className="form-input" value={form.planoContasId} onChange={e => setForm(p => ({ ...p, planoContasId: e.target.value }))}>
                <option value="">Nenhum</option>
                {cfgPlanoContas.filter(p => p.grupoConta === form.tipo + 's' || p.grupoConta === (form.tipo === 'receita' ? 'receitas' : 'despesas')).map(p => (
                  <option key={p.id} value={p.id}>{p.codPlano} — {p.descricao}</option>
                ))}
                {cfgPlanoContas.filter(p => p.grupoConta !== (form.tipo === 'receita' ? 'receitas' : 'despesas')).length === cfgPlanoContas.length && cfgPlanoContas.map(p => (
                  <option key={p.id} value={p.id}>{p.codPlano} — {p.descricao}</option>
                ))}
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
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}><Check size={13} />{editId ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Carregando eventos do banco de dados...</div>
      ) : cfgEventos.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Tag size={44} style={{ margin: '0 auto 14px', opacity: 0.2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum evento cadastrado</div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} />Criar primeiro evento</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
            </thead>
            <tbody>
              {filtered.map(e => {
                const pc = cfgPlanoContas.find(p => p.id === e.planoContasId)
                return (
                  <tr key={e.id}>
                    <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: e.tipo === 'receita' ? '#34d399' : '#f87171' }}>{e.codigo}</code></td>
                    <td style={{ fontWeight: 600 }}>{e.descricao}</td>
                    <td><span className={`badge ${e.tipo === 'receita' ? 'badge-success' : 'badge-danger'}`}>{e.tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}</span></td>
                    <td style={{ fontSize: 12 }}>{pc ? `${pc.codPlano} — ${pc.descricao}` : '—'}</td>

                    <td><span className={`badge ${e.situacao === 'ativo' ? 'badge-success' : 'badge-neutral'}`}>{e.situacao === 'ativo' ? '✓' : '✗'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(e)}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => handleDelete(e.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
