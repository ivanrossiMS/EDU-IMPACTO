'use client'

/**
 * ModalHistoricoBoletos
 * Lista todos os boletos do DataContext filtrados pelo aluno.
 * Agrupa por nossoNumero (multi-evento), mostra status bancário,
 * e expõe ações: reimprimir e acionar 2ª via.
 */

import React from 'react'
import { X, Printer, RefreshCw } from 'lucide-react'
import { Aluno, Titulo } from '@/lib/dataContext'
import { openBoletoHtml } from '@/lib/banking/openBoletoHtml'

interface GrupoBoleto {
  titulo: Titulo       // representante do grupo (o que tem htmlBoleto)
  membros: Titulo[]    // todos os títulos com o mesmo nossoNumero
  valorTotal: number
  qtdParcelas: number
  descricoes: string[]
  parcelas: string[]
  vencimento: string
}

interface Props {
  aluno: Aluno
  titulos: Titulo[]
  onSolicitarVia: (titulo: Titulo) => void  // abre Modal2aVia
  onClose: () => void
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(s?: string | null) {
  if (!s) return '—'
  const [a, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    emitido:        { label: '🏦 Emitido',      color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
    enviado_remessa:{ label: '📤 Em Remessa',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    registrado:     { label: '✔ Registrado',    color: '#a78bfa', bg: 'rgba(139,92,246,0.1)' },
    liquidado:      { label: '✅ Liquidado',     color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    baixado:        { label: '⬇ Baixado',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    vencido:        { label: '⚠ Vencido',       color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
    rejeitado:      { label: '✗ Rejeitado',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    rascunho:       { label: '📝 Rascunho',     color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
  }
  const s = status ? map[status] : null
  if (!s) return <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>—</span>
  return (
    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

export function ModalHistoricoBoletos({ aluno, titulos, onSolicitarVia, onClose }: Props) {
  const [popupGrupo, setPopupGrupo] = React.useState<GrupoBoleto | null>(null)

  // Filtra titulos do aluno com statusBancario (excluir rascunhos sem nossoNumero)
  const doAluno = titulos.filter(t =>
    (t.aluno === aluno.nome || (t as any).alunoId === aluno.id) &&
    t.statusBancario && t.statusBancario !== 'rascunho'
  )

  // Agrupa por nossoNumero
  const grupoMap = new Map<string, GrupoBoleto>()
  for (const t of doAluno) {
    const nn = t.nossoNumero ?? t.id
    if (!grupoMap.has(nn)) {
      grupoMap.set(nn, {
        titulo: t, membros: [], valorTotal: 0,
        qtdParcelas: 0, descricoes: [], parcelas: [], vencimento: t.vencimento ?? '',
      })
    }
    const g = grupoMap.get(nn)!
    g.membros.push(t)
    g.valorTotal += t.valor ?? 0
    g.qtdParcelas++
    if (t.descricao && !g.descricoes.includes(t.descricao)) g.descricoes.push(t.descricao)
    if (t.parcela && !g.parcelas.includes(t.parcela)) g.parcelas.push(t.parcela)
    if (t.vencimento && t.vencimento > g.vencimento) g.vencimento = t.vencimento
    if (t.htmlBoleto && !g.titulo.htmlBoleto) g.titulo = t
  }
  // Corrige valorTotal (valorGrupo prevalece quando existe)
  for (const g of grupoMap.values()) {
    const vg = (g.titulo as any).valorGrupo
    if (typeof vg === 'number' && vg > 0) g.valorTotal = vg
  }
  const grupos = Array.from(grupoMap.values()).reverse() // mais recentes primeiro

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 5500, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.8)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg,rgba(99,102,241,0.12),transparent)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📋</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Histórico de Boletos</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                <strong style={{ color: '#818cf8' }}>{aluno.nome}</strong>
                {' · '}
                {grupos.length} boleto{grupos.length !== 1 ? 's' : ''} emitido{grupos.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {grupos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Nenhum boleto emitido</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Use o botão "Emitir Boleto" para gerar o primeiro boleto deste aluno.</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {['Descrição / Evento', 'Parcela', 'Vencimento', 'Valor', 'Nosso Nº', 'Status', 'Ações'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(g => {
                    const t = g.titulo
                    const isMulti = g.qtdParcelas > 1 || g.descricoes.length > 1
                    const canReprint = !!t.htmlBoleto
                    const canVia = ['emitido', 'enviado_remessa', 'registrado'].includes(t.statusBancario ?? '')

                    return (
                      <tr key={t.nossoNumero ?? t.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {isMulti ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 11, border: '1px solid rgba(139,92,246,0.2)' }}>
                                📦 Vários Eventos
                              </span>
                            ) : (g.descricoes[0] ?? t.descricao ?? '—')}
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {isMulti ? (
                            <button
                              onClick={() => setPopupGrupo(g)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}
                            >🔍 Vários ({g.qtdParcelas})</button>
                          ) : (
                            <span style={{ color: 'hsl(var(--text-muted))' }}>{g.parcelas[0] ?? t.parcela ?? '—'}</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtData(g.vencimento || t.vencimento)}</td>
                        <td style={{ fontWeight: 700 }}>
                          <div>{fmtMoeda(g.valorTotal)}</div>
                          {isMulti && <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 400 }}>{g.qtdParcelas} parcelas</div>}
                        </td>
                        <td>
                          <code style={{ fontSize: 11, color: '#60a5fa', background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4 }}>
                            {t.nossoNumeroFormatado ?? t.nossoNumero ?? '—'}
                          </code>
                        </td>
                        <td><StatusBadge status={t.statusBancario} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {canReprint && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Reimprimir boleto"
                                onClick={() => openBoletoHtml(t.htmlBoleto!)}
                              >
                                <Printer size={13} />
                              </button>
                            )}
                            {canVia && (
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Emitir 2ª via"
                                style={{ fontSize: 11, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                                onClick={() => onSolicitarVia(t)}
                              >
                                <RefreshCw size={11} />
                                2ª Via
                              </button>
                            )}
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

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            Total emitido: <strong style={{ color: '#818cf8', fontFamily: 'monospace' }}>
              {fmtMoeda(grupos.reduce((s, g) => s + g.valorTotal, 0))}
            </strong>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
        </div>
      </div>

      {/* Popup detalhes multi-evento */}
      {popupGrupo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPopupGrupo(null)}
        >
          <div
            style={{ background: 'hsl(var(--bg-base))', borderRadius: 18, width: '100%', maxWidth: 500, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 22px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg,rgba(99,102,241,0.1),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Eventos do Boleto</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    Nosso Nº <code style={{ color: '#60a5fa' }}>{popupGrupo.titulo.nossoNumeroFormatado ?? popupGrupo.titulo.nossoNumero}</code>
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setPopupGrupo(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '14px 22px', maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {popupGrupo.membros.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 10, background: i % 2 === 0 ? 'hsl(var(--bg-elevated))' : 'transparent', border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#818cf8', flexShrink: 0 }}>{i + 1}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{m.descricao ?? '—'}</div>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Parcela {m.parcela} · Venc {fmtData(m.vencimento)}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#818cf8', fontFamily: 'Outfit,sans-serif' }}>{fmtMoeda(m.valor)}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 22px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{popupGrupo.qtdParcelas} evento(s)</div>
              <div style={{ fontWeight: 900, fontSize: 16, fontFamily: 'Outfit,sans-serif', color: '#818cf8' }}>
                Total: {fmtMoeda(popupGrupo.valorTotal)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
