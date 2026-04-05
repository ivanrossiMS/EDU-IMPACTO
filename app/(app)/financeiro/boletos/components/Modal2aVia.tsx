'use client'

/**
 * Modal2aVia
 * Exibe dados completos de um boleto já emitido e oferece:
 *   1. Reimprimir — abre o htmlBoleto salvo (sem custo de API)
 *   2. Reemitir    — chama /api/boletos/emitir com novos parâmetros
 *                    (novo nossoNumero, nova data, novas configs)
 *                    e persiste no DataContext via onReemitido
 */

import React from 'react'
import { X, Printer, RefreshCw } from 'lucide-react'
import { ConfigConvenio, Titulo } from '@/lib/dataContext'
import { openBoletoHtml } from '@/lib/banking/openBoletoHtml'
import { getResponsavelFinanceiro } from './AbaEmitir'

interface Props {
  titulo: Titulo
  convenios: ConfigConvenio[]
  onReemitido: (titulosAtualizados: Titulo[], novoSequencial: number, convenioId: string) => void
  onClose: () => void
  /** Objeto aluno completo para extrair responsável financeiro e endereço */
  alunos: import('@/lib/dataContext').Aluno[]
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtData(s?: string | null) {
  if (!s) return '—'
  const [a, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function Modal2aVia({ titulo, convenios, onReemitido, onClose, alunos }: Props) {
  const convAtivos = convenios.filter(c => c.situacao === 'ativo')

  const [loading, setLoading] = React.useState(false)
  const [erro, setErro] = React.useState('')
  const [sucesso, setSucesso] = React.useState(false)
  const [novoTitulo, setNovoTitulo] = React.useState<Titulo | null>(null)

  // Campos editáveis para reemissão
  const [dataVencimento, setDataVencimento] = React.useState(titulo.dataVencimento ?? titulo.vencimento ?? '')
  const [instrucao1, setInstrucao1] = React.useState(titulo.instrucao1 ?? '')
  const [instrucao2, setInstrucao2] = React.useState(titulo.instrucao2 ?? '')
  const [percJuros, setPercJuros] = React.useState(titulo.percJuros ?? 0.033)
  const [percMulta, setPercMulta] = React.useState(titulo.percMulta ?? 2)
  const [desconto, setDesconto] = React.useState(titulo.desconto ?? 0)
  const [convenioId, setConvenioId] = React.useState(titulo.convenioId ?? convAtivos[0]?.id ?? '')

  const convenio = convenios.find(c => c.id === convenioId)
  const aluno = alunos.find(a => a.nome === titulo.aluno || a.id === (titulo as any).alunoId)

  async function reemitir() {
    if (!convenio) { setErro('Convênio não encontrado.'); return }
    if (!aluno) { setErro('Aluno não encontrado no cadastro.'); return }
    setLoading(true); setErro('')

    try {
      const pagador = getResponsavelFinanceiro(aluno)

      const payload = {
        titulo: {
          pagador: {
            nome: titulo.pagadorNome || pagador.nome,
            cpfCnpj: titulo.pagadorCpfCnpj || pagador.cpfCnpj,
            logradouro: titulo.pagadorLogradouro || pagador.logradouro,
            numero: titulo.pagadorNumero || pagador.numero,
            complemento: titulo.pagadorComplemento || pagador.complemento,
            bairro: titulo.pagadorBairro || pagador.bairro,
            cidade: titulo.pagadorCidade || pagador.cidade,
            uf: titulo.pagadorUF || pagador.uf,
            cep: titulo.pagadorCEP || pagador.cep,
          },
          numeroDocumento: `2VIA-${titulo.id}-${Date.now().toString(36).toUpperCase()}`,
          descricao: titulo.descricao,
          especie: titulo.especie ?? 'DS',
          aceite: titulo.aceite ?? 'N',
          dataDocumento: new Date().toISOString().slice(0, 10),
          dataVencimento,
          valor: titulo.valor,
          desconto,
          abatimento: titulo.abatimento ?? 0,
          percJuros,
          percMulta,
          dataLimiteDesconto: titulo.dataLimiteDesconto || undefined,
          instrucao1: instrucao1 || undefined,
          instrucao2: instrucao2 || undefined,
          tipoProtesto: titulo.tipoProtesto ?? '0',
          diasProtesto: titulo.diasProtesto ?? 0,
          competencia: new Date().toISOString().slice(0, 7),
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          responsavelNome: titulo.pagadorNome || pagador.nome,
          convenioId: convenio.id,
        },
        convenio: {
          ...convenio,
          convenio: convenio.convenio.replace(/\D/g, '').padStart(5, '0'),
        },
        ultimoSequencial: convenio.nossoNumeroSequencial,
      }

      const res = await fetch('/api/boletos/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.sucesso) { setErro((json.erros ?? [json.error ?? 'Erro desconhecido']).join('\n')); return }

      const d = json.dados

      const tituloAtualizado: Titulo = {
        ...titulo,
        id: `${titulo.id}-2via-${Date.now().toString(36)}`,
        nossoNumero: d.nossoNumero,
        nossoNumeroDV: d.nossoNumeroDV,
        nossoNumeroFormatado: d.nossoNumeroFormatado,
        codigoBarras44: d.codigoBarras44,
        linhaDigitavel: d.linhaDigitavel,
        linhaDigitavelFormatada: d.linhaDigitavelFormatada,
        fatorVencimento: d.fatorVencimento,
        numeroDocumento: payload.titulo.numeroDocumento,
        dataDocumento: payload.titulo.dataDocumento,
        dataVencimento,
        vencimento: dataVencimento,
        instrucao1: instrucao1 || undefined,
        instrucao2: instrucao2 || undefined,
        percJuros,
        percMulta,
        desconto,
        convenioId: convenio.id,
        statusBancario: 'emitido',
        htmlBoleto: d.htmlBoleto,
        eventos: [d.evento],
      }

      setNovoTitulo(tituloAtualizado)
      setSucesso(true)
      onReemitido([tituloAtualizado], d.novoSequencial, convenio.id)
    } catch (e: unknown) {
      setErro(`Erro de rede: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.8)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(139,92,246,0.04))', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(168,85,247,0.15)', border: '1.5px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📄</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>2ª Via de Boleto</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                <strong style={{ color: '#c084fc' }}>{titulo.aluno}</strong>
                {' · '}
                Nosso Nº <code style={{ color: '#60a5fa' }}>{titulo.nossoNumeroFormatado ?? titulo.nossoNumero ?? '—'}</code>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {sucesso && novoTitulo ? (
            /* ── Sucesso ── */
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>2ª Via Emitida!</div>
              <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
                Novo boleto gerado com Nosso Nº <code style={{ color: '#60a5fa' }}>{novoTitulo.nossoNumeroFormatado}</code>
              </div>
              {novoTitulo.linhaDigitavelFormatada && (
                <div style={{ padding: '12px 16px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, marginBottom: 16, textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 4, textTransform: 'uppercase' }}>Linha Digitável</div>
                  <code style={{ fontSize: 12, color: '#60a5fa', wordBreak: 'break-all' }}>{novoTitulo.linhaDigitavelFormatada}</code>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {novoTitulo.htmlBoleto && (
                  <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => openBoletoHtml(novoTitulo.htmlBoleto!)}>
                    <Printer size={14} /> Imprimir 2ª Via
                  </button>
                )}
                <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
              </div>
            </div>
          ) : (
            /* ── Formulário ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Dados do boleto original */}
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Boleto Original</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: '8px 20px' }}>
                  {[
                    ['Aluno', titulo.aluno],
                    ['Valor', fmt(titulo.valor)],
                    ['Vencimento orig.', fmtData(titulo.vencimento)],
                    ['Nosso Nº', titulo.nossoNumeroFormatado ?? titulo.nossoNumero ?? '—'],
                    ['Descrição', titulo.descricao ?? '—'],
                    ['Parcela', titulo.parcela ?? '—'],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {titulo.linhaDigitavelFormatada && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 3, textTransform: 'uppercase' }}>Linha Digitável Original</div>
                    <code style={{ fontSize: 11, color: '#60a5fa', wordBreak: 'break-all' }}>{titulo.linhaDigitavelFormatada}</code>
                  </div>
                )}
              </div>

              {/* Opção rápida: reimprimir sem chamar API */}
              {titulo.htmlBoleto && (
                <button
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '12px 20px' }}
                  onClick={() => openBoletoHtml(titulo.htmlBoleto!)}
                >
                  <Printer size={15} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700 }}>Reimprimir boleto original</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Abre o arquivo HTML salvo, sem gerar novo nossoNumero</div>
                  </div>
                </button>
              )}

              {/* Separador */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'hsl(var(--border-subtle))' }} />
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>ou reemitir com novos dados</span>
                <div style={{ flex: 1, height: 1, background: 'hsl(var(--border-subtle))' }} />
              </div>

              {/* Campos editáveis */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Convênio Bancário</label>
                  <select className="form-input" value={convenioId} onChange={e => setConvenioId(e.target.value)}>
                    {convAtivos.map(c => (
                      <option key={c.id} value={c.id}>{c.nomeBanco} — Cart. {c.carteira}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Nova Data de Vencimento</label>
                  <input type="date" className="form-input" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Juros % ao dia</label>
                  <input type="number" className="form-input" step="0.001" value={percJuros} onChange={e => setPercJuros(parseFloat(e.target.value) || 0)} style={{ fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label className="form-label">Multa %</label>
                  <input type="number" className="form-input" step="0.1" value={percMulta} onChange={e => setPercMulta(parseFloat(e.target.value) || 0)} style={{ fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label className="form-label">Desconto R$</label>
                  <input type="number" className="form-input" step="0.01" value={desconto} onChange={e => setDesconto(parseFloat(e.target.value) || 0)} style={{ fontFamily: 'monospace' }} />
                </div>
              </div>
              <div>
                <label className="form-label">Instrução 1</label>
                <input className="form-input" maxLength={80} value={instrucao1} onChange={e => setInstrucao1(e.target.value.slice(0, 80))} />
              </div>
              <div>
                <label className="form-label">Instrução 2 (opcional)</label>
                <input className="form-input" maxLength={80} value={instrucao2} onChange={e => setInstrucao2(e.target.value.slice(0, 80))} />
              </div>

              {convenio && (
                <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  🏦 <strong>{convenio.nomeBanco}</strong> · Ag {convenio.agencia} · Conta {convenio.conta}-{convenio.digitoConta} · Próximo Seq #{convenio.nossoNumeroSequencial + 1}
                </div>
              )}

              {erro && (
                <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  ⚠️ {erro}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!sucesso && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
              Reemissão gera <strong>novo nossoNumero</strong> bancário
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
              <button
                className="btn btn-primary"
                disabled={loading || !convenioId || !dataVencimento}
                onClick={reemitir}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Reemitindo...
                  </>
                ) : (
                  <><RefreshCw size={14} /> Reemitir 2ª Via — {fmt(titulo.valor)}</>
                )}
              </button>
            </div>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
