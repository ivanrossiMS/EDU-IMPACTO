'use client'

import React from 'react'
import { Aluno, Titulo } from '@/lib/dataContext'
import { StatusBadge } from './StatusBadge'
import { Printer, X } from 'lucide-react'

interface Props {
  titulos: Titulo[]
  alunos: Aluno[]
  onReprint: (titulo: Titulo) => void
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(s?: string | null) {
  if (!s) return '—'
  const [a, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

interface GrupoBoleto {
  titulo: Titulo        // representante do grupo (tem htmlBoleto, codigoBarras, etc.)
  membros: Titulo[]     // todos os títulos com este nossoNumero
  valorTotal: number
  vencimento: string
  parcelas: string[]
  descricoes: string[]
  qtdParcelas: number
}

export function AbaHistorico({ titulos, alunos, onReprint }: Props) {
  const turmas = [...new Set(alunos.map(a => a.turma).filter(Boolean))].sort()
  const emitidos = titulos.filter(t => t.statusBancario && t.statusBancario !== 'rascunho')

  // ── Agrupa por nossoNumero (boletos multi-parcela compartilham o mesmo NN) ──
  const grupoMap = new Map<string, GrupoBoleto>()
  for (const t of emitidos) {
    const nn = t.nossoNumero ?? t.id
    if (!grupoMap.has(nn)) {
      grupoMap.set(nn, {
        titulo: t,
        membros: [],
        valorTotal: 0,
        vencimento: t.vencimento || '',
        parcelas: [],
        descricoes: [],
        qtdParcelas: 0,
      })
    }
    const g = grupoMap.get(nn)!
    g.membros.push(t)
    g.valorTotal += t.valor ?? 0
    if (t.parcela && !g.parcelas.includes(t.parcela)) g.parcelas.push(t.parcela)
    if (t.descricao && !g.descricoes.includes(t.descricao)) g.descricoes.push(t.descricao)
    if (t.vencimento && t.vencimento > g.vencimento) g.vencimento = t.vencimento
    g.qtdParcelas++
    if (t.htmlBoleto && !g.titulo.htmlBoleto) g.titulo = t
  }
  // valorGrupo registrado (soma real salva durante emissão)
  for (const g of grupoMap.values()) {
    const vg = (g.titulo as any).valorGrupo
    if (typeof vg === 'number' && vg > 0) g.valorTotal = vg
  }

  const grupos = Array.from(grupoMap.values())

  const [busca, setBusca]               = React.useState('')
  const [filtroStatus, setFiltroStatus] = React.useState('todos')
  const [filtroTurma, setFiltroTurma]   = React.useState('')
  const [dataInicio, setDataInicio]     = React.useState('')
  const [dataFim, setDataFim]           = React.useState('')
  const [popupGrupo, setPopupGrupo]     = React.useState<GrupoBoleto | null>(null)

  const filtrados = grupos.filter(g => {
    const t = g.titulo
    const q = busca.toLowerCase()
    const matchBusca = !busca ||
      t.aluno.toLowerCase().includes(q) ||
      t.nossoNumero?.includes(busca) ||
      t.linhaDigitavel?.includes(busca) ||
      g.descricoes.some(d => d.toLowerCase().includes(q))

    const matchStatus = filtroStatus === 'todos' || t.statusBancario === filtroStatus

    const matchTurma = !filtroTurma || (() => {
      const alu = alunos.find(a => a.nome === t.aluno)
      return alu?.turma === filtroTurma
    })()

    const venc = g.vencimento || t.vencimento || ''
    const matchInicio = !dataInicio || venc >= dataInicio
    const matchFim    = !dataFim    || venc <= dataFim

    return matchBusca && matchStatus && matchTurma && matchInicio && matchFim
  })

  function limpar() {
    setBusca(''); setFiltroStatus('todos'); setFiltroTurma('')
    setDataInicio(''); setDataFim('')
  }

  const temFiltro = busca || filtroStatus !== 'todos' || filtroTurma || dataInicio || dataFim

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Histórico de Boletos</h2>
          <p className="page-subtitle">{grupos.length} boleto(s) emitido(s)</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input
            className="form-input"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por aluno, nosso número..."
          />
          <select className="form-input" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="emitido">Emitido</option>
            <option value="enviado_remessa">Em Remessa</option>
            <option value="registrado">Registrado</option>
            <option value="liquidado">Liquidado</option>
            <option value="vencido">Vencido</option>
            <option value="baixado">Baixado</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
          <select className="form-input" value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
            <option value="">Todas as turmas</option>
            {turmas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>Vencimento de:</span>
          <input type="date" className="form-input" style={{ width: 160 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>até</span>
          <input type="date" className="form-input" style={{ width: 160 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
          {temFiltro && (
            <button className="btn btn-ghost btn-sm" onClick={limpar}>✕ Limpar filtros</button>
          )}
          {temFiltro && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              {filtrados.length} de {grupos.length} boleto(s)
            </span>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {grupos.length === 0 ? 'Nenhum boleto emitido ainda' : 'Nenhum resultado encontrado'}
          </div>
          <div style={{ fontSize: 13 }}>
            {grupos.length === 0 ? 'Use a aba "Emitir Boleto" para gerar o primeiro boleto.' : 'Tente ajustar os filtros.'}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {['Aluno / Responsável', 'Turma', 'Parcela', 'Vencimento', 'Valor', 'Nosso Número', 'Linha Digitável', 'Status', 'Ações'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(g => {
                const t = g.titulo
                const alu = alunos.find(a => a.nome === t.aluno)
                const isMulti = g.qtdParcelas > 1 || g.descricoes.length > 1

                return (
                  <tr key={t.id}>
                    {/* Aluno / Responsável */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.aluno}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                        {isMulti ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'rgba(139,92,246,0.12)', color: '#a78bfa',
                            borderRadius: 6, padding: '1px 7px', fontWeight: 700, fontSize: 10,
                            border: '1px solid rgba(139,92,246,0.2)',
                          }}>
                            📦 Vários Eventos
                          </span>
                        ) : t.responsavel}
                      </div>
                    </td>

                    {/* Turma */}
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{alu?.turma ?? '—'}</td>

                    {/* Parcela — clicável quando multi */}
                    <td style={{ fontSize: 12 }}>
                      {isMulti ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button
                            onClick={() => setPopupGrupo(g)}
                            title="Clique para ver os eventos incluídos neste boleto"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                              border: '1px solid rgba(99,102,241,0.3)',
                              borderRadius: 8, padding: '3px 10px', cursor: 'pointer',
                              fontWeight: 700, fontSize: 11,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.22)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)' }}
                          >
                            🔍 Vários ({g.qtdParcelas})
                          </button>
                          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                            {g.qtdParcelas} parcelas
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'hsl(var(--text-muted))' }}>{g.parcelas[0] ?? t.parcela ?? '—'}</span>
                      )}
                    </td>

                    {/* Vencimento */}
                    <td>{fmtData(g.vencimento || t.vencimento)}</td>

                    {/* Valor */}
                    <td style={{ fontWeight: 700 }}>
                      <div>{fmtMoeda(g.valorTotal)}</div>
                      {isMulti && (
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 400 }}>
                          {g.qtdParcelas} parcelas
                        </div>
                      )}
                    </td>

                    {/* Nosso Número */}
                    <td>
                      <code style={{ fontSize: 11, color: '#60a5fa', background: 'hsl(var(--bg-overlay))', padding: '1px 5px', borderRadius: 4 }}>
                        {t.nossoNumeroFormatado ?? t.nossoNumero ?? '—'}
                      </code>
                    </td>

                    {/* Linha Digitável */}
                    <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.linhaDigitavelFormatada ?? t.linhaDigitavel ?? '—'}
                    </td>

                    {/* Status */}
                    <td><StatusBadge status={t.statusBancario} /></td>

                    {/* Ações */}
                    <td>
                      {t.htmlBoleto && (
                        <button className="btn btn-ghost btn-icon btn-sm" title="Reimprimir" onClick={() => onReprint(t)}>
                          <Printer size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Popup detalhe de boleto com múltiplos eventos ── */}
      {popupGrupo && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setPopupGrupo(null)}
        >
          <div
            style={{
              background: 'hsl(var(--bg-base))',
              borderRadius: 20, width: '100%', maxWidth: 560,
              boxShadow: '0 30px 90px rgba(0,0,0,0.65)',
              border: '1px solid hsl(var(--border-subtle))',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              background: 'linear-gradient(135deg,rgba(99,102,241,0.1),transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, fontSize: 20,
                  background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>📦</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Eventos do Boleto</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    {popupGrupo.titulo.aluno} · Nosso Nº{' '}
                    <code style={{ color: '#60a5fa' }}>
                      {popupGrupo.titulo.nossoNumeroFormatado ?? popupGrupo.titulo.nossoNumero}
                    </code>
                    {' · '}
                    <StatusBadge status={popupGrupo.titulo.statusBancario} />
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setPopupGrupo(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Corpo */}
            <div style={{ padding: '16px 24px', maxHeight: 420, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {popupGrupo.membros.map((m, i) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 12,
                      background: i % 2 === 0 ? 'hsl(var(--bg-elevated))' : 'transparent',
                      border: '1px solid hsl(var(--border-subtle))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, fontSize: 12, fontWeight: 800,
                        background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{i + 1}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.descricao ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          Parcela {m.parcela} · Venc {fmtData(m.vencimento)}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontFamily: 'Outfit,sans-serif', fontSize: 14, color: '#818cf8' }}>
                      {fmtMoeda(m.valor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
                {popupGrupo.qtdParcelas} evento(s) incluído(s)
              </div>
              <div style={{ fontWeight: 900, fontSize: 18, fontFamily: 'Outfit,sans-serif', color: '#818cf8' }}>
                Total: {fmtMoeda(popupGrupo.valorTotal)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
