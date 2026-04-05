'use client'

import React from 'react'
import { Aluno, Titulo, ConfigConvenio } from '@/lib/dataContext'
import { Download, FileText, CheckSquare, Trash2, Printer } from 'lucide-react'
import { StatusBadge } from './StatusBadge'

interface Props {
  titulos: Titulo[]
  alunos: Aluno[]
  convenios: ConfigConvenio[]
  onStatusUpdated: (ids: string[], novoStatus: 'enviado_remessa', arquivo: string) => void
  onDelete: (id: string) => void
  onReprint: (titulo: Titulo) => void
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(s?: string | null) {
  if (!s) return '—'
  const parts = s.slice(0, 10).split('-')
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function downloadTxt(filename: string, conteudo: string) {
  const bytes = new Uint8Array(conteudo.length)
  for (let i = 0; i < conteudo.length; i++) {
    bytes[i] = conteudo.charCodeAt(i) & 0xff
  }
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Linha individual para remessa ────────────────────────────────────────────
// Cada parcela de um boleto multi-evento vira uma linha própria.
// O boleto CNAB continua sendo 1 registro bancário (mesmo nossoNumero),
// mas a UI mostra individualmente cada evento/valor para clareza administrativa.
interface LinhaRemessa {
  /** ID único para controle de seleção (pode ser t.id ou t.id + '-' + parcela) */
  itemId: string
  /** Título raiz que carrega nossoNumero, codigoBarras, pagador, etc. */
  titulo: Titulo
  /** Título desta linha específica (pode ser o mesmo que titulo para single, ou membro do grupo) */
  membro: Titulo
  /** Valor desta parcela individual */
  valorParcela: number
  /** Parcela desta linha ("2/12", "1/1", ...) */
  parcela: string
  /** Descrição do evento desta linha */
  descricao: string
  /** Vencimento desta parcela */
  vencimento: string
  /** Marcador: faz parte de boleto com múltiplos eventos? */
  isMulti: boolean
  /** Identificador do grupo (nossoNumero) — linhas do mesmo grupo entram numa única transação CNAB */
  grupoId: string
  /** Total do grupo bancário (enviado na remessa para o banco) */
  valorGrupo: number
  /** Número da linha dentro do grupo (1-based) */
  posicaoNoGrupo: number
  /** Total de membros do grupo */
  totalNoGrupo: number
  aluno: Aluno | undefined
}

export function AbaRemessa({ titulos, alunos, convenios, onStatusUpdated, onDelete, onReprint }: Props) {
  const [convenioId, setConvenioId]   = React.useState(convenios.find(c => c.situacao === 'ativo')?.id ?? '')
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set())
  const [sequencial, setSequencial]   = React.useState(1)
  const [loading, setLoading]         = React.useState(false)
  const [resultado, setResultado]     = React.useState<{
    filename: string; stats: { qtdTitulos: number; valorTotal: number; qtdLinhas: number; sequencialArquivo: number }
  } | null>(null)
  const [erro, setErro]               = React.useState('')
  const [historico, setHistorico]     = React.useState<{ filename: string; data: string; qtd: number; valor: number }[]>([])

  // Filtros
  const [filtroTurma, setFiltroTurma] = React.useState('')
  const [filtroAluno, setFiltroAluno] = React.useState('')
  const [dataInicio, setDataInicio]   = React.useState('')
  const [dataFim, setDataFim]         = React.useState('')

  const turmas = [...new Set(alunos.map(a => a.turma).filter(Boolean))].sort()

  const convAtivos = convenios.filter(c => c.situacao === 'ativo')
  const convenio   = convAtivos.find(c => c.id === convenioId)

  // ── 1. Títulos elegíveis brutos ──────────────────────────────────────────────
  const elegiveisRaw = titulos.filter(t =>
    t.nossoNumero && t.convenioId === convenioId &&
    (t.statusBancario === 'emitido' || t.statusBancario === 'registrado')
  ).filter(t => {
    const alu = alunos.find(a => a.nome === t.aluno)
    const matchTurma = !filtroTurma || alu?.turma === filtroTurma
    const matchAluno = !filtroAluno || t.aluno.toLowerCase().includes(filtroAluno.toLowerCase())
    const venc = t.vencimento || ''
    const matchInicio = !dataInicio || venc >= dataInicio
    const matchFim    = !dataFim    || venc <= dataFim
    return matchTurma && matchAluno && matchInicio && matchFim
  })

  // ── 2. Agrupa por nossoNumero para ter os metadados bancários do grupo ────────
  interface GrupoInterno {
    titulo: Titulo         // título principal (htmlBoleto, codigoBarras, etc.)
    membros: Titulo[]      // todos os títulos com este nossoNumero
    valorTotal: number     // soma real de todas as parcelas
    vencimento: string     // maior vencimento do grupo
  }

  const grupoMap = new Map<string, GrupoInterno>()
  for (const t of elegiveisRaw) {
    const nn = t.nossoNumero!
    if (!grupoMap.has(nn)) {
      grupoMap.set(nn, { titulo: t, membros: [], valorTotal: 0, vencimento: t.vencimento || '' })
    }
    const g = grupoMap.get(nn)!
    g.membros.push(t)
    g.valorTotal += t.valor ?? 0
    if (t.vencimento && t.vencimento > g.vencimento) g.vencimento = t.vencimento
    if (t.htmlBoleto && !g.titulo.htmlBoleto) g.titulo = t
  }
  // Usa valorGrupo registrado se disponível
  for (const g of grupoMap.values()) {
    const vg = (g.titulo as any).valorGrupo
    if (typeof vg === 'number' && vg > 0) g.valorTotal = vg
  }

  // ── 3. Expande cada grupo em linhas individuais (1 por parcela/evento) ────────
  const linhasRemessa: LinhaRemessa[] = []
  for (const [nn, g] of grupoMap.entries()) {
    const isMulti = g.membros.length > 1
    g.membros.forEach((membro, idx) => {
      const alu = alunos.find(a => a.nome === membro.aluno)
      linhasRemessa.push({
        itemId: `${membro.id}`,
        titulo: g.titulo,
        membro,
        valorParcela: membro.valor ?? 0,
        parcela: membro.parcela ?? '—',
        descricao: membro.descricao ?? g.titulo.descricao ?? '—',
        vencimento: membro.vencimento || g.vencimento || '',
        isMulti,
        grupoId: nn,
        valorGrupo: g.valorTotal,
        posicaoNoGrupo: idx + 1,
        totalNoGrupo: g.membros.length,
        aluno: alu,
      })
    })
  }

  // ── 4. Seleção ── seleciona/desseleciona por itemId (= t.id do membro) ───────
  React.useEffect(() => {
    setSelecionados(new Set(linhasRemessa.map(l => l.itemId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convenioId, linhasRemessa.length, filtroTurma, filtroAluno, dataInicio, dataFim])

  function toggleAll() {
    if (selecionados.size === linhasRemessa.length) setSelecionados(new Set())
    else setSelecionados(new Set(linhasRemessa.map(l => l.itemId)))
  }

  function toggleItem(itemId: string) {
    setSelecionados(prev => {
      const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n
    })
  }

  /**
   * Para gerar a remessa CNAB, o banco precisa de 1 registro por nossoNumero.
   * Então selecionamos os grupos cujos TODOS os membros estão selecionados —
   * ou se o grupo tem múltiplos membros e ao menos 1 está selecionado, incluímos
   * o grupo inteiro (pois o boleto é indivisível no banco).
   *
   * Aqui adotamos a abordagem: se qualquer membro de um grupo está selecionado,
   * o grupo inteiro vai para remessa (indivisível bancariamente).
   */
  const gruposNaSel = new Set<string>()
  for (const l of linhasRemessa) {
    if (selecionados.has(l.itemId)) gruposNaSel.add(l.grupoId)
  }
  const linhasSelecionadas = linhasRemessa.filter(l => selecionados.has(l.itemId))
  const valorSel = linhasSelecionadas.reduce((s, l) => {
    // Evita somar duplicatas do mesmo grupo (valorGrupo já é o total do grupo)
    return s + l.valorParcela
  }, 0)

  // Grupos únicos selecionados → para CNAB
  const gruposUnicos = Array.from(gruposNaSel).map(nn => grupoMap.get(nn)!).filter(Boolean)

  async function gerarRemessa() {
    if (!convenio || gruposUnicos.length === 0) return
    setLoading(true); setErro(''); setResultado(null)

    try {
      const payload = {
        titulos: gruposUnicos.map(g => {
          const t = g.titulo
          // Descrição: mescla todos os eventos do grupo
          const descricoes = [...new Set(g.membros.map(m => m.descricao).filter(Boolean))]
          return {
            id: t.id,
            nossoNumero: t.nossoNumero!,
            nossoNumeroDV: t.nossoNumeroDV,
            nossoNumeroFormatado: t.nossoNumeroFormatado,
            codigoBarras44: t.codigoBarras44,
            linhaDigitavel: t.linhaDigitavel,
            fatorVencimento: t.fatorVencimento,
            numeroDocumento: t.numeroDocumento ?? t.parcela ?? t.id,
            descricao: descricoes.join(' | ') || t.descricao,
            especie: t.especie ?? 'DS',
            aceite: t.aceite ?? 'N',
            dataDocumento: t.dataDocumento ?? new Date().toISOString().slice(0, 10),
            dataVencimento: g.vencimento || t.dataVencimento || t.vencimento,
            valor: g.valorTotal,
            desconto: t.desconto ?? 0,
            abatimento: t.abatimento ?? 0,
            percJuros: t.percJuros ?? 0.033,
            percMulta: t.percMulta ?? 2,
            instrucao1: t.instrucao1 ?? '',
            instrucao2: t.instrucao2 ?? '',
            tipoProtesto: t.tipoProtesto ?? '0',
            diasProtesto: t.diasProtesto ?? 0,
            aluno: t.aluno,
            responsavel: t.responsavel,
            vencimento: g.vencimento || t.vencimento,
            pagadorNome:        t.pagadorNome       ?? t.responsavel ?? t.aluno ?? 'A INFORMAR',
            pagadorCpfCnpj:     (t.pagadorCpfCnpj   ?? '').replace(/\D/g, '') || '00000000191',
            pagadorLogradouro:  t.pagadorLogradouro  ?? 'A INFORMAR',
            pagadorNumero:      t.pagadorNumero      ?? 'S/N',
            pagadorComplemento: t.pagadorComplemento ?? '',
            pagadorBairro:      t.pagadorBairro      ?? 'A INFORMAR',
            pagadorCidade:      t.pagadorCidade      ?? 'A INFORMAR',
            pagadorUF:          t.pagadorUF          ?? 'SP',
            pagadorCEP:         (t.pagadorCEP        ?? '').replace(/\D/g, '').padStart(8, '0') || '01310100',
          }
        }),
        convenio: {
          ...convenio,
          convenio: convenio.convenio.replace(/\D/g, '').padStart(5, '0'),
        },
        sequencialArquivo: sequencial,
      }

      const res = await fetch('/api/boletos/remessa400', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const json = await res.json()

      if (!json.sucesso) {
        setErro(json.erros?.join('\n') ?? json.erro ?? 'Erro desconhecido')
        return
      }

      downloadTxt(json.filename, json.conteudo)
      setResultado({ filename: json.filename, stats: json.stats })
      setSequencial(s => s + 1)
      setHistorico(prev => [{ filename: json.filename, data: new Date().toISOString(), qtd: json.stats.qtdTitulos, valor: json.stats.valorTotal }, ...prev])
      // Atualiza status de todos os títulos dos grupos selecionados
      const todosIds = gruposUnicos.flatMap(g => g.membros.map(m => m.id))
      onStatusUpdated(todosIds, 'enviado_remessa', json.filename)
    } catch (e: unknown) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const temFiltro = filtroTurma || filtroAluno || dataInicio || dataFim

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Remessa CNAB 400</h2>
          <p className="page-subtitle">Gere o arquivo de remessa para registro dos boletos no banco</p>
        </div>
      </div>

      {convAtivos.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#f87171' }}>⚠️ Nenhum convênio ativo.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          {/* Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Convênio</div>
              <select className="form-input" value={convenioId} onChange={e => setConvenioId(e.target.value)}>
                {convAtivos.map(c => <option key={c.id} value={c.id}>{c.nomeBanco} · Cart. {c.carteira}</option>)}
              </select>
              <div style={{ marginTop: 12 }}>
                <label className="form-label">Sequencial do Arquivo</label>
                <input type="number" className="form-input" value={sequencial} min={1}
                  onChange={e => setSequencial(parseInt(e.target.value) || 1)} />
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Incrementado automaticamente após cada remessa gerada.</div>
              </div>
            </div>

            {/* Nota informativa sobre multi-eventos */}
            <div className="card" style={{ padding: 14, borderLeft: '3px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.04)', fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: 4 }}>📦 Boletos com múltiplos eventos</div>
              <div style={{ color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                Cada parcela/evento é exibida individualmente. A remessa CNAB envia 1 registro por boleto (mesmo Nosso Número), com o valor total consolidado.
              </div>
            </div>

            {/* Filtros */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Filtros</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select className="form-input" style={{ fontSize: 12 }} value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                  <option value="">Todas as turmas</option>
                  {turmas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="form-input"
                  style={{ fontSize: 12 }}
                  placeholder="Filtrar por aluno..."
                  value={filtroAluno}
                  onChange={e => setFiltroAluno(e.target.value)}
                />
                <div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>Vencimento de / até</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" className="form-input" style={{ fontSize: 11 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                    <input type="date" className="form-input" style={{ fontSize: 11 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                  </div>
                </div>
                {temFiltro && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroTurma(''); setFiltroAluno(''); setDataInicio(''); setDataFim('') }}>
                    ✕ Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Convênio info */}
            {convenio && (
              <div className="card" style={{ padding: 16, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>🏦 {convenio.nomeBanco}</div>
                <div style={{ color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div>Agência: <strong>{convenio.agencia}</strong></div>
                  <div>Conta: <strong>{convenio.conta}-{convenio.digitoConta}</strong></div>
                  <div>Cedente: <strong>{convenio.cedente}</strong></div>
                  <div>CNPJ: <strong>{convenio.cnpj}</strong></div>
                  <div>Carteira: <strong>{convenio.carteira}</strong></div>
                  {convenio.ambiente === 'homologacao' && <span className="badge badge-warning" style={{ marginTop: 4 }}>Homologação</span>}
                </div>
              </div>
            )}

            {/* Histórico de remessas */}
            {historico.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Histórico de Remessas</div>
                {historico.map((h, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < historico.length - 1 ? '1px solid hsl(var(--border-subtle))' : 'none' }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{h.filename}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {new Date(h.data).toLocaleString('pt-BR')} · {h.qtd} títulos · {fmt(h.valor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista + ação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Resultado */}
            {resultado && (
              <div className="card" style={{ padding: '14px 16px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Download size={18} color="#10b981" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#10b981' }}>Remessa gerada e baixada com sucesso!</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                      {resultado.filename} · {resultado.stats.qtdTitulos} títulos · {fmt(resultado.stats.valorTotal)} · {resultado.stats.qtdLinhas} linhas
                    </div>
                  </div>
                </div>
              </div>
            )}

            {erro && (
              <div className="card" style={{ padding: '12px 16px', border: '1px solid rgba(248,113,113,0.3)' }}>
                <div style={{ color: '#f87171', fontSize: 13, whiteSpace: 'pre-wrap' }}>⚠️ {erro}</div>
              </div>
            )}

            {/* Header da tabela */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn-ghost btn-sm" style={{ gap: 6 }} onClick={toggleAll}>
                  <CheckSquare size={14} />
                  {selecionados.size === linhasRemessa.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  {linhasSelecionadas.length} linha(s) · {gruposNaSel.size} boleto(s) · {fmt(valorSel)}
                </span>
                {temFiltro && <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠️ Filtros ativos — {linhasRemessa.length} exibido(s)</span>}
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={loading || gruposNaSel.size === 0 || !convenioId}
                onClick={gerarRemessa}
                style={{ gap: 6 }}
              >
                <FileText size={14} />
                {loading ? 'Gerando...' : `Gerar Remessa CNAB 400 (${gruposNaSel.size} boleto${gruposNaSel.size !== 1 ? 's' : ''})`}
              </button>
            </div>

            {linhasRemessa.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Nenhum boleto disponível para remessa</div>
                <div>{temFiltro ? 'Nenhum boleto corresponde aos filtros.' : 'Emita boletos primeiro (aba "Emitir Boleto" ou "Emissão em Lote").'}</div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Aluno</th>
                      <th>Turma</th>
                      <th>Evento / Parcela</th>
                      <th>Vencimento</th>
                      <th>Nosso Número</th>
                      <th style={{ textAlign: 'right' }}>Valor Parcela</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasRemessa.map((linha, idx) => {
                      const sel = selecionados.has(linha.itemId)
                      // Destaque visual para linhas do mesmo grupo
                      const isFirstOfGroup = idx === 0 || linhasRemessa[idx - 1].grupoId !== linha.grupoId
                      const isLastOfGroup  = idx === linhasRemessa.length - 1 || linhasRemessa[idx + 1].grupoId !== linha.grupoId

                      return (
                        <tr
                          key={linha.itemId}
                          style={{
                            background: sel
                              ? linha.isMulti
                                ? 'rgba(99,102,241,0.04)'
                                : undefined
                              : 'rgba(0,0,0,0.02)',
                            borderTop: linha.isMulti && isFirstOfGroup
                              ? '2px solid rgba(99,102,241,0.2)'
                              : undefined,
                            borderBottom: linha.isMulti && isLastOfGroup
                              ? '2px solid rgba(99,102,241,0.2)'
                              : undefined,
                          }}
                        >
                          {/* Checkbox */}
                          <td>
                            <button onClick={() => toggleItem(linha.itemId)} style={{
                              width: 20, height: 20, borderRadius: 4,
                              border: `2px solid ${sel ? '#3b82f6' : 'hsl(var(--border-default))'}`,
                              background: sel ? '#3b82f6' : 'transparent', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11
                            }}>
                              {sel ? '✓' : ''}
                            </button>
                          </td>

                          {/* Aluno — só mostra na primeira linha do grupo */}
                          <td>
                            {isFirstOfGroup ? (
                              <>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{linha.titulo.aluno}</div>
                                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{linha.titulo.responsavel}</div>
                                {linha.isMulti && (
                                  <div style={{ marginTop: 3 }}>
                                    <span style={{
                                      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                                      background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                                      border: '1px solid rgba(99,102,241,0.2)',
                                    }}>
                                      📦 {linha.totalNoGrupo} eventos
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              // Linhas subsequentes do mesmo grupo: recuo visual
                              <div style={{ paddingLeft: 14, borderLeft: '2px solid rgba(99,102,241,0.2)' }}>
                                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                                  └ mesmo boleto
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Turma — só na primeira linha do grupo */}
                          <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                            {isFirstOfGroup ? (linha.aluno?.turma ?? '—') : ''}
                          </td>

                          {/* Evento / Parcela */}
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{linha.descricao}</div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                              Parcela {linha.parcela}
                              {linha.isMulti && (
                                <span style={{
                                  marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4,
                                  background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 700,
                                }}>
                                  {linha.posicaoNoGrupo}/{linha.totalNoGrupo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Vencimento */}
                          <td style={{ fontSize: 12 }}>{fmtData(linha.vencimento)}</td>

                          {/* Nosso Número — só na primeira linha do grupo */}
                          <td>
                            {isFirstOfGroup ? (
                              <code style={{ fontSize: 11, color: '#60a5fa', background: 'hsl(var(--bg-overlay))', padding: '1px 5px', borderRadius: 4 }}>
                                {linha.titulo.nossoNumeroFormatado ?? linha.titulo.nossoNumero}
                              </code>
                            ) : (
                              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>↑ mesmo</span>
                            )}
                          </td>

                          {/* Valor Parcela */}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontFamily: 'Outfit,sans-serif', fontSize: 13 }}>
                              {fmt(linha.valorParcela)}
                            </div>
                            {/* Na última linha do grupo, mostra o total do boleto */}
                            {linha.isMulti && isLastOfGroup && (
                              <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 600, marginTop: 2 }}>
                                Total: {fmt(linha.valorGrupo)}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td><StatusBadge status={linha.titulo.statusBancario} /></td>

                          {/* Ações — só na primeira linha do grupo */}
                          <td>
                            {isFirstOfGroup && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                {linha.titulo.htmlBoleto && (
                                  <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    title="Ver boleto"
                                    onClick={() => onReprint(linha.titulo)}
                                  >
                                    <Printer size={13} />
                                  </button>
                                )}
                                <button
                                  className="btn btn-ghost btn-icon btn-sm"
                                  title="Deletar"
                                  style={{ color: '#f87171' }}
                                  onClick={() => onDelete(linha.titulo.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
