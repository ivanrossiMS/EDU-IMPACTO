'use client'
import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { FileText, Plus, Send, CheckCircle, Clock, XCircle, Download, Settings, Search, AlertCircle, X, Filter, Tag } from 'lucide-react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type StatusNF = 'emitida' | 'pendente' | 'cancelada' | 'erro'

interface NotaFiscal {
  id: string; numero: string; aluno: string; valor: number
  competencia: string; dataEmissao: string; status: StatusNF; chave?: string
}

const STATUS_CONFIG = {
  emitida:  { label: 'Emitida',   color: '#10b981', badge: 'badge-success', icon: CheckCircle },
  pendente: { label: 'Pendente',  color: '#f59e0b', badge: 'badge-warning', icon: Clock },
  cancelada:{ label: 'Cancelada', color: '#6b7280', badge: 'badge-neutral', icon: XCircle },
  erro:     { label: 'Erro',      color: '#ef4444', badge: 'badge-danger',  icon: AlertCircle },
}

export default function NFePage() {
  const { titulos, alunos, cfgEventos } = useData()
  const [tab, setTab] = useState<'emissao' | 'historico' | 'config'>('emissao')

  // ── Filtros da aba Emissão ──────────────────────────────────────────
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [searchAluno, setSearchAluno] = useState('')
  const [filtroEventoId, setFiltroEventoId] = useState('')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  // Histórico
  const [search, setSearch] = useState('')

  const [notas] = useState<NotaFiscal[]>([])
  const [cfgForm, setCfgForm] = useState({
    ambiente: 'homologacao', municipio: '', inscricaoMunicipal: '', cnpj: '',
    serieNF: 'A', cnae: '8513900', tributacao: 'ISS', aliquota: 5,
  })

  // Eventos de receita disponíveis para filtro
  const eventosReceita = useMemo(() =>
    cfgEventos.filter(e => e.situacao === 'ativo' && e.tipo === 'receita')
  , [cfgEventos])

  // Títulos pagos filtrados
  const pagosFiltrados = useMemo(() => {
    return titulos.filter(t => {
      if (t.status !== 'pago') return false
      // Competência (filtra por mês de pagamento)
      if (competencia && !t.pagamento?.startsWith(competencia)) return false
      // Busca aluno
      if (searchAluno && !t.aluno.toLowerCase().includes(searchAluno.toLowerCase()) && !t.responsavel?.toLowerCase().includes(searchAluno.toLowerCase())) return false
      // Filtro por evento/descrição
      if (filtroEventoId) {
        const evento = cfgEventos.find(e => e.id === filtroEventoId)
        if (evento && !t.descricao?.toLowerCase().includes(evento.descricao.toLowerCase())) return false
      }
      // Data específica de pagamento
      if (filtroDataDe && t.pagamento && t.pagamento < filtroDataDe) return false
      if (filtroDataAte && t.pagamento && t.pagamento > filtroDataAte) return false
      return true
    })
  }, [titulos, competencia, searchAluno, filtroEventoId, filtroDataDe, filtroDataAte, cfgEventos])

  const totalFiltrado = pagosFiltrados.reduce((s, t) => s + t.valor, 0)

  const hasFilter = !!(searchAluno || filtroEventoId || filtroDataDe || filtroDataAte)
  const clearFiltros = () => { setSearchAluno(''); setFiltroEventoId(''); setFiltroDataDe(''); setFiltroDataAte('') }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Emissão de Nota Fiscal (NFS-e)</h1>
          <p className="page-subtitle">Emissão eletrônica de notas fiscais de serviço educacional via prefeitura</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Settings size={13} />Configurar</button>
          <button className="btn btn-primary btn-sm"><Send size={13} />Emitir em Lote</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Emitidas no mês', value: notas.filter(n => n.status === 'emitida').length, color: '#10b981', icon: '✅' },
          { label: 'Elegíveis para emissão', value: pagosFiltrados.length, color: '#f59e0b', icon: '⏳' },
          { label: 'Base de cálculo', value: fmt(totalFiltrado), color: '#3b82f6', icon: '💰' },
          { label: 'ISS a recolher (5%)', value: fmt(totalFiltrado * 0.05), color: '#8b5cf6', icon: '📊' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
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
          { id: 'config',   label: 'Configuração Fiscal' },
        ].map(t => (
          <button key={t.id} className={`tab-trigger ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id as typeof tab)}>{t.label}</button>
        ))}
      </div>

      {/* ── Aba Emissão ── */}
      {tab === 'emissao' && (
        <div>
          {/* Painel de filtros */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            {/* Linha 1: Competência + botão filtros + ações */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <label className="form-label">Competência</label>
                <input type="month" className="form-input" value={competencia} onChange={e => setCompetencia(e.target.value)} style={{ width: 160 }} />
              </div>

              {/* Busca aluno */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label">Aluno / Responsável</label>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 30 }}
                    placeholder="Buscar aluno ou responsável..."
                    value={searchAluno}
                    onChange={e => setSearchAluno(e.target.value)}
                  />
                  {searchAluno && (
                    <button type="button" onClick={() => setSearchAluno('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Evento */}
              <div style={{ flex: '0 0 auto', minWidth: 200 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={10} />Evento
                </label>
                <select className="form-input" value={filtroEventoId} onChange={e => setFiltroEventoId(e.target.value)}>
                  <option value="">Todos os eventos</option>
                  {eventosReceita.map(e => (
                    <option key={e.id} value={e.id}>{e.descricao}</option>
                  ))}
                  {eventosReceita.length === 0 && <option disabled>Nenhum evento cadastrado</option>}
                </select>
              </div>

              <button
                className={`btn btn-sm ${showFiltros ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowFiltros(p => !p)}
                style={{ alignSelf: 'flex-end' }}>
                <Filter size={12} />Data Específica
              </button>

              <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm">Selecionar tudo</button>
                <button className="btn btn-primary btn-sm" disabled={pagosFiltrados.length === 0}>
                  <Send size={13} />Emitir selecionados
                </button>
              </div>
            </div>

            {/* Linha 2: Filtro de data específica (colapsável) */}
            {showFiltros && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
                <div>
                  <label className="form-label">Data de Pagamento (de)</label>
                  <input type="date" className="form-input" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Data de Pagamento (até)</label>
                  <input type="date" className="form-input" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)} />
                </div>
                {(filtroDataDe || filtroDataAte) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroDataDe(''); setFiltroDataAte('') }}>
                    <X size={12} />Limpar datas
                  </button>
                )}
              </div>
            )}

            {/* Resumo dos filtros ativos */}
            {(hasFilter || pagosFiltrados.length > 0) && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <span style={{ color: 'hsl(var(--text-muted))' }}>
                  <strong style={{ color: 'hsl(var(--text-primary))' }}>{pagosFiltrados.length}</strong> recebimento(s) elegíveis •{' '}
                  <strong style={{ color: '#10b981' }}>{fmt(totalFiltrado)}</strong>
                </span>
                {hasFilter && (
                  <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={clearFiltros}>
                    <X size={10} />Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tabela */}
          {pagosFiltrados.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <FileText size={40} style={{ opacity: 0.1, marginBottom: 12 }} /><br />
              <div style={{ fontWeight: 700 }}>
                {hasFilter ? 'Nenhum recebimento encontrado com esses filtros' : 'Nenhum recebimento para emitir NF nesta competência'}
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {hasFilter
                  ? <button className="btn btn-ghost btn-sm" onClick={clearFiltros}>Limpar filtros</button>
                  : 'Pagamentos recebidos em Contas a Receber aparecerão aqui para emissão de NFS-e.'}
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr>
                  <th><input type="checkbox" style={{ accentColor: '#3b82f6' }} /></th>
                  <th>Tomador (Responsável)</th><th>Aluno</th><th>Evento / Descrição</th><th>Pagamento</th><th>Competência</th><th>Valor</th><th>ISS (5%)</th><th>Status NF</th>
                </tr></thead>
                <tbody>
                  {pagosFiltrados.map(t => {
                    const aluno = alunos.find(a => a.nome === t.aluno)
                    return (
                      <tr key={t.id}>
                        <td><input type="checkbox" defaultChecked style={{ accentColor: '#3b82f6' }} /></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{aluno?.responsavel || t.responsavel || t.aluno}</td>
                        <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{t.aluno}</td>
                        <td style={{ fontSize: 12, maxWidth: 180 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao || '—'}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{t.pagamento ? new Date(t.pagamento + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td style={{ fontSize: 12 }}>{competencia}</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>{fmt(t.valor)}</td>
                        <td style={{ fontSize: 12, color: '#8b5cf6' }}>{fmt(t.valor * 0.05)}</td>
                        <td><span className="badge badge-warning"><Clock size={10} />Pendente</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Histórico ── */}
      {tab === 'historico' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar NF, aluno..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <FileText size={40} style={{ opacity: 0.1, marginBottom: 12 }} /><br />
            <div style={{ fontWeight: 700 }}>Nenhuma NF emitida ainda</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Emita notas pela aba &quot;Emissão por Competência&quot;.</div>
          </div>
        </div>
      )}

      {/* ── Configuração ── */}
      {tab === 'config' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Configuração do Ambiente Fiscal</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: '#3b82f6' }}>Dados do Prestador</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'CNPJ', key: 'cnpj', placeholder: '00.000.000/0001-00' },
                  { label: 'Inscrição Municipal', key: 'inscricaoMunicipal', placeholder: '12345678' },
                  { label: 'Código CNAE', key: 'cnae', placeholder: '8513900' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="form-label">{f.label}</label>
                    <input className="form-input" placeholder={f.placeholder} value={(cfgForm as any)[f.key]} onChange={e => setCfgForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="form-label">Município</label>
                  <input className="form-input" placeholder="Código IBGE do município" value={cfgForm.municipio} onChange={e => setCfgForm(p => ({ ...p, municipio: e.target.value }))} />
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: '#8b5cf6' }}>Tributação</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="form-label">Ambiente</label>
                  <select className="form-input" value={cfgForm.ambiente} onChange={e => setCfgForm(p => ({ ...p, ambiente: e.target.value }))}>
                    <option value="homologacao">🛠️ Homologação (Testes)</option>
                    <option value="producao">🚀 Produção</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Série da NF</label>
                  <input className="form-input" value={cfgForm.serieNF} onChange={e => setCfgForm(p => ({ ...p, serieNF: e.target.value }))} maxLength={2} />
                </div>
                <div>
                  <label className="form-label">Alíquota ISS (%)</label>
                  <input type="number" className="form-input" step={0.5} min={2} max={5} value={cfgForm.aliquota} onChange={e => setCfgForm(p => ({ ...p, aliquota: +e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Regime Tributário</label>
                  <select className="form-input" value={cfgForm.tributacao} onChange={e => setCfgForm(p => ({ ...p, tributacao: e.target.value }))}>
                    <option value="ISS">ISS — Simples Nacional</option>
                    <option value="Lucro Presumido">ISS — Lucro Presumido</option>
                    <option value="MEI">MEI</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary">Cancelar</button>
            <button className="btn btn-primary">Salvar Configurações</button>
          </div>
        </div>
      )}
    </div>
  )
}
