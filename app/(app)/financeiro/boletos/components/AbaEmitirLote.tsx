'use client'

import React from 'react'
import { Aluno, ConfigConvenio, ConfigEvento, Titulo } from '@/lib/dataContext'
import { openBoletoHtml } from '@/lib/banking/openBoletoHtml'
import { Search, X, Users, User, Building2, CheckSquare, Settings2 } from 'lucide-react'

interface Props {
  alunos: Aluno[]
  titulos: Titulo[]
  convenios: ConfigConvenio[]
  eventos?: ConfigEvento[]
  onEmitidos: (atualizados: Titulo[], novoSeq: number, convId: string) => void
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─────────────────────────────────────────────────────────────────
// Helper central: resolve dados completos do Resp. Financeiro
// Ordem: _responsaveis[] → responsaveis[] → responsavelFinanceiro → responsavel → nome
// ─────────────────────────────────────────────────────────────────
function getResponsavelFinanceiro(aluno: Aluno) {
  const a = aluno as any
  let respFin: any = null
  // 1. _responsaveis (CadastroAlunoModal) — shape: RespData (campos planos)
  const arr1: any[] = a._responsaveis || []
  if (arr1.length > 0) respFin = arr1.find((r: any) => r.respFinanceiro) || null
  // 2. responsaveis (TestDataSection)
  if (!respFin) {
    const arr2: any[] = a.responsaveis || []
    if (arr2.length > 0) respFin = arr2.find((r: any) => r.respFinanceiro) || null
  }
  const nome        = String(respFin?.nome || a.responsavelFinanceiro || a.responsavel || aluno.nome || 'A INFORMAR')
  const cpfCnpj     = String(respFin?.cpf || a.cpf || '00000000191').replace(/\D/g, '') || '00000000191'
  // RespData: endereço como campos planos (logradouro, numero, bairro, cidade, ufEnd, cep)
  const logradouro  = String(respFin?.logradouro  || a.endereco?.logradouro  || 'A INFORMAR')
  const numero      = String(respFin?.numero      || a.endereco?.numero      || 'S/N')
  const complemento = String(respFin?.complemento || a.endereco?.complemento || '')
  const bairro      = String(respFin?.bairro      || a.endereco?.bairro      || 'A INFORMAR')
  const cidade      = String(respFin?.cidade      || a.endereco?.cidade      || 'A INFORMAR')
  const uf          = String(respFin?.ufEnd || respFin?.uf || respFin?.estado || a.endereco?.uf || 'SP').slice(0, 2) || 'SP'
  const cep         = String(respFin?.cep || a.endereco?.cep || '01310100').replace(/\D/g, '').padStart(8, '0')
  return { nome, cpfCnpj, logradouro, numero, complemento, bairro, cidade, uf, cep }
}

type Escopo = 'individual' | 'turma' | 'escola'

interface CfgLote {
  convenioId: string
  instrucao1: string
  percJuros: number
  percMulta: number
  especie: string
  aceite: string
  tipoProtesto: string
  diasProtesto: number
  dataLimiteDesconto: string
  desconto: number
}

// Filtros avançados de geração
interface FiltrosGeracao {
  apenasCursando: boolean       // só alunos com status "cursando"
  apenasSeEmBoleto: boolean     // só parcelas sem boleto gerado
  ignorarDesconto100: boolean   // não gerar para valor = 0
  filterDataInicio: string
  filterDataFim: string
  eventosIds: Set<string>       // quais eventos incluir (vazio = todos)
}

function buildPayloadTitulo(
  titulo: Titulo,
  aluno: Aluno,
  cfg: CfgLote,
  convenio: ConfigConvenio
) {
  const pagador = getResponsavelFinanceiro(aluno)
  return {
    titulo: {
      pagador: {
        nome: pagador.nome,
        cpfCnpj: pagador.cpfCnpj,
        logradouro: pagador.logradouro,
        numero: pagador.numero,
        complemento: pagador.complemento,
        bairro: pagador.bairro,
        cidade: pagador.cidade,
        uf: pagador.uf,
        cep: pagador.cep,
      },
      numeroDocumento: `${titulo.id}-${Date.now().toString(36).toUpperCase()}`,
      descricao: titulo.descricao ?? titulo.parcela,
      especie: cfg.especie, aceite: cfg.aceite,
      dataDocumento: new Date().toISOString().slice(0, 10),
      dataVencimento: titulo.vencimento,
      valor: titulo.valor,
      desconto: cfg.desconto, abatimento: 0,
      percJuros: cfg.percJuros, percMulta: cfg.percMulta,
      dataLimiteDesconto: cfg.dataLimiteDesconto || undefined,
      instrucao1: cfg.instrucao1, instrucao2: undefined,
      tipoProtesto: cfg.tipoProtesto, diasProtesto: cfg.diasProtesto,
      competencia: titulo.vencimento?.slice(0, 7),
      alunoId: aluno.id, alunoNome: aluno.nome, responsavelNome: pagador.nome,
      convenioId: convenio.id,
    },
    convenio: { ...convenio, convenio: convenio.convenio.replace(/\D/g, '').padStart(5, '0') },
    ultimoSequencial: convenio.nossoNumeroSequencial,
  }
}

export function AbaEmitirLote({ alunos, titulos, convenios, eventos = [], onEmitidos }: Props) {
  const [escopo, setEscopo]               = React.useState<Escopo>('individual')
  const [buscaAluno, setBuscaAluno]       = React.useState('')
  const [alunoSelecionado, setAlunoSel]   = React.useState<Aluno | null>(null)
  const [turmaSel, setTurmaSel]           = React.useState('')
  const [titulosSel, setTitulosSel]       = React.useState<Set<string>>(new Set())
  const [showFiltros, setShowFiltros]     = React.useState(false)
  const [cfg, setCfg]                     = React.useState<CfgLote>({
    convenioId: convenios.find(c => c.situacao === 'ativo')?.id ?? '',
    instrucao1: '',
    percJuros: 0.033, percMulta: 2, especie: 'DS', aceite: 'N',
    tipoProtesto: '0', diasProtesto: 0, dataLimiteDesconto: '', desconto: 0,
  })
  const [filtros, setFiltros]             = React.useState<FiltrosGeracao>({
    apenasCursando: true,
    apenasSeEmBoleto: true,
    ignorarDesconto100: true,
    filterDataInicio: '',
    filterDataFim: '',
    eventosIds: new Set(),
  })
  const [loading, setLoading]             = React.useState(false)
  const [resultado, setResultado]         = React.useState<{ ok: number; erro: number; erros: string[] } | null>(null)

  const turmas    = [...new Set(alunos.map(a => a.turma).filter(Boolean))].sort()
  const convAtivos = convenios.filter(c => c.situacao === 'ativo')
  const convenio  = convAtivos.find(c => c.id === cfg.convenioId)

  // Eventos financeiros disponíveis para filtro
  const eventosDisponiveis = eventos.filter(e => e.situacao === 'ativo' && e.tipo === 'receita')

  // Alunos elegíveis com base no escopo e filtros avançados
  const alunosElegiveis = React.useMemo(() => {
    let base = alunos
    if (filtros.apenasCursando) {
      base = base.filter(a =>
        a.status?.toLowerCase().includes('curs') ||
        a.status?.toLowerCase() === 'cursando'
      )
    }
    if (escopo === 'individual' && alunoSelecionado) {
      return base.filter(a => a.id === alunoSelecionado.id)
    }
    if (escopo === 'turma' && turmaSel) {
      return base.filter(a => a.turma === turmaSel)
    }
    return escopo === 'escola' ? base : []
  }, [alunos, escopo, alunoSelecionado, turmaSel, filtros.apenasCursando])

  // Títulos elegíveis para emissão em lote com base em todos os filtros
  const titulosElegiveis = React.useMemo(() => {
    const nomesCursando = new Set(alunosElegiveis.map(a => a.nome))

    return titulos.filter(t => {
      // Escopo — aluno deve estar no conjunto elegível
      if (!nomesCursando.has(t.aluno)) return false

      // Apenas sem boleto
      if (filtros.apenasSeEmBoleto && t.statusBancario) return false

      // Precisa estar pendente ou atrasado
      if (t.status !== 'pendente' && t.status !== 'atrasado') return false

      // Ignorar com desconto 100% (valor = 0)
      if (filtros.ignorarDesconto100 && t.valor <= 0) return false

      // Filtro de data de vencimento
      const venc = t.vencimento || ''
      if (filtros.filterDataInicio && venc < filtros.filterDataInicio) return false
      if (filtros.filterDataFim   && venc > filtros.filterDataFim)     return false

      // Filtro de eventos
      if (filtros.eventosIds.size > 0 && t.eventoId) {
        if (!filtros.eventosIds.has(t.eventoId)) return false
      }

      return true
    })
  }, [titulos, alunosElegiveis, filtros])

  React.useEffect(() => {
    setTitulosSel(new Set(titulosElegiveis.map(t => t.id)))
  }, [escopo, alunoSelecionado, turmaSel, titulosElegiveis.length])

  function toggleTitulo(id: string) {
    setTitulosSel(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleAll() {
    if (titulosSel.size === titulosElegiveis.length) setTitulosSel(new Set())
    else setTitulosSel(new Set(titulosElegiveis.map(t => t.id)))
  }

  function toggleEvento(id: string) {
    setFiltros(prev => {
      const n = new Set(prev.eventosIds)
      n.has(id) ? n.delete(id) : n.add(id)
      return { ...prev, eventosIds: n }
    })
  }

  const selecionados = titulosElegiveis.filter(t => titulosSel.has(t.id))
  const paraEmitir   = selecionados.filter(t => !t.statusBancario)
  const valorTotal   = selecionados.reduce((s, t) => s + t.valor, 0)

  async function emitirLote() {
    if (!convenio || paraEmitir.length === 0) return
    setLoading(true)
    setResultado(null)

    let seq = convenio.nossoNumeroSequencial
    let ok = 0, erro = 0
    const erros: string[] = []
    const atualizados: Titulo[] = []

    for (const titulo of paraEmitir) {
      const alu = alunos.find(a => a.nome === titulo.aluno) as Aluno
      if (!alu) { erro++; erros.push(`Aluno não encontrado: ${titulo.aluno}`); continue }

      try {
        const payload = buildPayloadTitulo(titulo, alu, cfg, { ...convenio, nossoNumeroSequencial: seq })
        const res = await fetch('/api/boletos/emitir', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        })
        const json = await res.json()
        if (!json.sucesso) { erro++; erros.push(`${titulo.aluno} — ${json.erros?.[0] ?? json.error}`); continue }

        const d = json.dados
        seq = d.novoSequencial
        atualizados.push({
          ...titulo,
          nossoNumero: d.nossoNumero, nossoNumeroDV: d.nossoNumeroDV,
          nossoNumeroFormatado: d.nossoNumeroFormatado, codigoBarras44: d.codigoBarras44,
          linhaDigitavel: d.linhaDigitavel, linhaDigitavelFormatada: d.linhaDigitavelFormatada,
          fatorVencimento: d.fatorVencimento,
          numeroDocumento: payload.titulo.numeroDocumento,
          dataDocumento: payload.titulo.dataDocumento,
          especie: cfg.especie, aceite: cfg.aceite,
          instrucao1: cfg.instrucao1, percJuros: cfg.percJuros, percMulta: cfg.percMulta,
          desconto: cfg.desconto, tipoProtesto: cfg.tipoProtesto, diasProtesto: cfg.diasProtesto,
          convenioId: convenio.id, statusBancario: 'emitido', htmlBoleto: d.htmlBoleto,
          // Persiste TODOS os campos do pagador para uso futuro na remessa CNAB
          pagadorNome:        payload.titulo.pagador.nome,
          pagadorCpfCnpj:     payload.titulo.pagador.cpfCnpj,
          pagadorLogradouro:  payload.titulo.pagador.logradouro,
          pagadorNumero:      payload.titulo.pagador.numero,
          pagadorComplemento: payload.titulo.pagador.complemento ?? '',
          pagadorBairro:      payload.titulo.pagador.bairro,
          pagadorCidade:      payload.titulo.pagador.cidade,
          pagadorUF:          payload.titulo.pagador.uf,
          pagadorCEP:         payload.titulo.pagador.cep,
          eventos: [d.evento],
        })
        ok++
      } catch (e: unknown) {
        erro++; erros.push(`${titulo.aluno} — ${(e as Error).message}`)
      }
    }

    if (atualizados.length > 0) onEmitidos(atualizados, seq, convenio.id)
    setResultado({ ok, erro, erros })
    setLoading(false)
  }

  function imprimirTodos() {
    const titulosComBoleto = selecionados.filter(t => t.htmlBoleto)
    if (!titulosComBoleto.length) return
    const html = titulosComBoleto.map(t => t.htmlBoleto).join('<div style="page-break-after:always"></div>')
    openBoletoHtml(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body>${html}</body></html>`)
  }

  const filtrosAtivos = filtros.apenasCursando || filtros.apenasSeEmBoleto ||
    filtros.ignorarDesconto100 || filtros.filterDataInicio || filtros.filterDataFim ||
    filtros.eventosIds.size > 0

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Emissão em Lote</h2>
          <p className="page-subtitle">Gere boletos para alunos individuais, turmas ou a escola toda</p>
        </div>
      </div>

      {convAtivos.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#f87171' }}>
          ⚠️ Nenhum convênio bancário ativo. Configure um convênio na aba &quot;Convênios&quot;.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
          {/* Painel de Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Escopo */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Escopo de Emissão</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  { id: 'individual' as Escopo, icon: <User size={14} />, label: 'Aluno Individual' },
                  { id: 'turma'      as Escopo, icon: <Users size={14} />, label: 'Por Turma' },
                  { id: 'escola'     as Escopo, icon: <Building2 size={14} />, label: 'Escola Toda' },
                ] as const).map(e => (
                  <button key={e.id} onClick={() => { setEscopo(e.id); setAlunoSel(null); setTurmaSel('') }}
                    className={`btn btn-sm ${escopo === e.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', gap: 8 }}>
                    {e.icon}{e.label}
                  </button>
                ))}
              </div>

              {/* Individual: busca aluno */}
              {escopo === 'individual' && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                    <input className="form-input" style={{ paddingLeft: 30, fontSize: 12 }} value={buscaAluno}
                      onChange={e => { setBuscaAluno(e.target.value); setAlunoSel(null) }}
                      placeholder="Buscar aluno..." />
                  </div>
                  {buscaAluno && !alunoSelecionado && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: 180, overflowY: 'auto' }}>
                      {alunos.filter(a =>
                        a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) &&
                        (!filtros.apenasCursando || a.status?.toLowerCase().includes('curs'))
                      ).slice(0, 8).map(a => (
                        <button key={a.id} onClick={() => { setAlunoSel(a); setBuscaAluno(a.nome) }}
                          style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ fontWeight: 600 }}>{a.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.turma} · {a.status}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {alunoSelecionado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, fontSize: 12 }}>
                      <span style={{ flex: 1, fontWeight: 600 }}>{alunoSelecionado.nome}</span>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setAlunoSel(null); setBuscaAluno('') }}><X size={12} /></button>
                    </div>
                  )}
                </div>
              )}

              {/* Turma: select */}
              {escopo === 'turma' && (
                <div style={{ marginTop: 12 }}>
                  <select className="form-input" style={{ fontSize: 12 }} value={turmaSel} onChange={e => setTurmaSel(e.target.value)}>
                    <option value="">Selecionar turma...</option>
                    {turmas.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Opções avançadas de geração */}
            <div className="card" style={{ padding: 16 }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'space-between', marginBottom: showFiltros ? 12 : 0 }}
                onClick={() => setShowFiltros(!showFiltros)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Settings2 size={14} />
                  <span style={{ fontWeight: 700, fontSize: 12 }}>Opções de Geração</span>
                  {filtrosAtivos && <span style={{ fontSize: 10, background: '#3b82f6', color: '#fff', borderRadius: 8, padding: '1px 6px' }}>ATIVOS</span>}
                </span>
                <span style={{ fontSize: 12 }}>{showFiltros ? '▲' : '▼'}</span>
              </button>

              {showFiltros && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Checkboxes */}
                  {[
                    { key: 'apenasCursando'     as keyof FiltrosGeracao, label: 'Apenas alunos cursando', desc: 'Ignora alunos transferidos, desistentes etc.' },
                    { key: 'apenasSeEmBoleto'   as keyof FiltrosGeracao, label: 'Apenas parcelas sem boleto', desc: 'Não re-emite boletos já gerados' },
                    { key: 'ignorarDesconto100' as keyof FiltrosGeracao, label: 'Não imprimir alunos com 100% desconto', desc: 'Ignora parcelas com valor = R$ 0,00' },
                  ].map(opt => (
                    <label key={opt.key} style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={filtros[opt.key] as boolean}
                        onChange={e => setFiltros(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}

                  {/* Filtro de vencimento */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>VENCIMENTO DE / ATÉ</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="date" className="form-input" style={{ fontSize: 11 }}
                        value={filtros.filterDataInicio}
                        onChange={e => setFiltros(prev => ({ ...prev, filterDataInicio: e.target.value }))}
                      />
                      <input
                        type="date" className="form-input" style={{ fontSize: 11 }}
                        value={filtros.filterDataFim}
                        onChange={e => setFiltros(prev => ({ ...prev, filterDataFim: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Filtro de eventos */}
                  {eventosDisponiveis.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>
                        EVENTOS ({filtros.eventosIds.size === 0 ? 'todos' : `${filtros.eventosIds.size} selecionado(s)`})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                        {eventosDisponiveis.map(ev => (
                          <label key={ev.id} style={{ display: 'flex', gap: 8, cursor: 'pointer', alignItems: 'center', fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={filtros.eventosIds.size === 0 || filtros.eventosIds.has(ev.id)}
                              onChange={() => toggleEvento(ev.id)}
                            />
                            <span>{ev.descricao}</span>
                          </label>
                        ))}
                      </div>
                      {filtros.eventosIds.size > 0 && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 4, fontSize: 10 }}
                          onClick={() => setFiltros(prev => ({ ...prev, eventosIds: new Set() }))}
                        >
                          Selecionar todos os eventos
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Convênio */}
            <div className="card" style={{ padding: 16 }}>
              <label className="form-label">Convênio Bancário</label>
              <select className="form-input" style={{ fontSize: 12 }} value={cfg.convenioId} onChange={e => setCfg(c => ({ ...c, convenioId: e.target.value }))}>
                {convAtivos.map(c => <option key={c.id} value={c.id}>{c.nomeBanco} · Cart. {c.carteira}</option>)}
              </select>
            </div>

            {/* Encargos */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Encargos Padrão</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  ['Juros % dia', 'percJuros'],
                  ['Multa %', 'percMulta'],
                  ['Desconto R$', 'desconto'],
                  ['Dias Prot.', 'diasProtesto'],
                ] as [string, keyof CfgLote][]).map(([l, k]) => (
                  <div key={k}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>{l}</label>
                    <input type="number" className="form-input" style={{ fontSize: 12 }}
                      value={cfg[k] as number}
                      onChange={e => setCfg(c => ({ ...c, [k]: parseFloat(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Instrução</label>
                <input className="form-input" style={{ fontSize: 12 }} value={cfg.instrucao1}
                  onChange={e => setCfg(c => ({ ...c, instrucao1: e.target.value.slice(0, 80) }))} maxLength={80} />
              </div>
            </div>
          </div>

          {/* Lista de títulos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Resultado */}
            {resultado && (
              <div className="card" style={{ padding: '12px 16px', border: resultado.erro > 0 ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(52,211,153,0.3)' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✅ {resultado.ok} emitidos</span>
                  {resultado.erro > 0 && <span style={{ color: '#f87171', fontWeight: 700 }}>❌ {resultado.erro} erros</span>}
                  {resultado.erros.map((e, i) => <div key={i} style={{ fontSize: 11, color: '#f87171', width: '100%' }}>{e}</div>)}
                </div>
              </div>
            )}

            {/* Aviso filtros ativos */}
            {filtrosAtivos && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.15)', fontSize: 12 }}>
                <Settings2 size={13} color="#3b82f6" />
                <span style={{ color: '#3b82f6' }}>
                  Filtros de geração ativos:{' '}
                  {filtros.apenasCursando && 'só cursando · '}
                  {filtros.apenasSeEmBoleto && 'sem boleto · '}
                  {filtros.ignorarDesconto100 && 'ignorar R$0 · '}
                  {(filtros.filterDataInicio || filtros.filterDataFim) && 'por data · '}
                  {filtros.eventosIds.size > 0 && `${filtros.eventosIds.size} evento(s)`}
                </span>
              </div>
            )}

            {/* Header da lista */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={toggleAll} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
                  <CheckSquare size={14} />
                  {titulosSel.size === titulosElegiveis.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  {selecionados.length} selecionado(s) · {fmt(valorTotal)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selecionados.some(t => t.htmlBoleto) && (
                  <button className="btn btn-secondary btn-sm" onClick={imprimirTodos}>🖨️ Imprimir Selecionados</button>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  disabled={loading || paraEmitir.length === 0 || !cfg.convenioId}
                  onClick={emitirLote}
                >
                  {loading ? 'Emitindo...' : `🏦 Emitir ${paraEmitir.length} Boleto(s)`}
                </button>
              </div>
            </div>

            {/* Tabela */}
            {titulosElegiveis.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {escopo === 'individual' && !alunoSelecionado ? 'Selecione um aluno para ver os títulos pendentes.' :
                    escopo === 'turma' && !turmaSel ? 'Selecione uma turma para ver os títulos pendentes.' :
                      filtrosAtivos ? 'Nenhum título pendente encontrado com os filtros ativos.' :
                        'Nenhum título pendente sem boleto encontrado.'}
                </div>
                {filtrosAtivos && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setFiltros(prev => ({
                    ...prev, filterDataInicio: '', filterDataFim: '',
                    apenasCursando: false, apenasSeEmBoleto: false, ignorarDesconto100: false, eventosIds: new Set()
                  }))}>
                    Limpar filtros de geração
                  </button>
                )}
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Aluno</th>
                      {escopo !== 'individual' && <th>Turma</th>}
                      <th>Evento</th>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulosElegiveis.map(t => {
                      const sel = titulosSel.has(t.id)
                      const jaEmitido = !!t.statusBancario
                      const alu = alunos.find(a => a.nome === t.aluno)
                      return (
                        <tr key={t.id} style={{ opacity: jaEmitido ? 0.5 : 1 }}>
                          <td>
                            <button onClick={() => !jaEmitido && toggleTitulo(t.id)}
                              style={{
                                width: 20, height: 20, borderRadius: 4,
                                border: `2px solid ${sel ? '#3b82f6' : 'hsl(var(--border-default))'}`,
                                background: sel ? '#3b82f6' : 'transparent', cursor: jaEmitido ? 'default' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11
                              }}>
                              {sel ? '✓' : ''}
                            </button>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{t.aluno}</div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{t.responsavel || (alu?.responsavel ?? '')}</div>
                          </td>
                          {escopo !== 'individual' && <td style={{ fontSize: 12 }}>{alu?.turma ?? '—'}</td>}
                          <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{t.eventoDescricao ?? '—'}</td>
                          <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{t.parcela}</td>
                          <td style={{ fontSize: 12 }}>{t.vencimento ? t.vencimento.split('-').reverse().join('/') : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit,sans-serif' }}>
                            {t.valor <= 0
                              ? <span style={{ color: '#10b981', fontSize: 12 }}>ISENTO</span>
                              : fmt(t.valor)
                            }
                          </td>
                          <td>
                            {jaEmitido
                              ? <span className="badge badge-success">Emitido</span>
                              : <span className="badge badge-warning">Pendente</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                      <td colSpan={escopo !== 'individual' ? 6 : 5} style={{ padding: '10px 16px', fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                        Total selecionado ({selecionados.length}) · {paraEmitir.length} a emitir
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#3b82f6', fontFamily: 'Outfit,sans-serif' }}>{fmt(valorTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
