'use client'

import React from 'react'
import { Aluno, ConfigConvenio, Titulo } from '@/lib/dataContext'
import { openBoletoHtml } from '@/lib/banking/openBoletoHtml'
import { Search, X, CheckSquare, Square } from 'lucide-react'

interface Props {
  alunos: Aluno[]
  titulos: Titulo[]
  convenios: ConfigConvenio[]
  onEmitido: (titulosAtualizados: Titulo[], novoSequencial: number, convenioId: string) => void
  onCancel: () => void
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(s?: string | null) {
  if (!s) return '—'
  const [a, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// ─────────────────────────────────────────────────────────────────
// Helper central: extrai dados completos do Responsável Financeiro
// Busca em ordem: campos planos → _responsaveis[] → responsaveis[] → legacy
// ─────────────────────────────────────────────────────────────────
interface RespFinData {
  nome: string
  cpfCnpj: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

export function getResponsavelFinanceiro(aluno: Aluno): RespFinData {
  const a = aluno as any

  // Tentar encontrar o registro do responsável financeiro com dados completos
  let respFin: any = null

  // Prioridade 1: array _responsaveis (CadastroAlunoModal) — shape: RespData (campos planos)
  const arr1: any[] = a._responsaveis || []
  if (arr1.length > 0) {
    respFin = arr1.find((r: any) => r.respFinanceiro) || null
  }

  // Prioridade 2: array responsaveis (TestDataSection / ficha360)
  if (!respFin) {
    const arr2: any[] = a.responsaveis || []
    if (arr2.length > 0) {
      respFin = arr2.find((r: any) => r.respFinanceiro) || null
    }
  }

  // Nome: do respFin encontrado → campo responsavelFinanceiro → legacy responsavel → nome do aluno
  const nome = String(respFin?.nome || a.responsavelFinanceiro || a.responsavel || aluno.nome || 'A INFORMAR')

  // CPF: do respFin → CPF do aluno (fallback)
  const cpfCnpj = String(respFin?.cpf || a.cpf || '00000000191').replace(/\D/g, '') || '00000000191'

  // Endereço: RespData tem campos PLANOS (logradouro, numero, bairro, cidade, ufEnd, cep)
  // Não há sub-objeto 'endereco' — ler os campos diretamente do responsavel encontrado
  const logradouro    = String(respFin?.logradouro    || a.endereco?.logradouro    || 'A INFORMAR')
  const numero        = String(respFin?.numero        || a.endereco?.numero        || 'S/N')
  const complemento   = String(respFin?.complemento   || a.endereco?.complemento   || '')
  const bairro        = String(respFin?.bairro        || a.endereco?.bairro        || 'A INFORMAR')
  const cidade        = String(respFin?.cidade        || a.endereco?.cidade        || 'A INFORMAR')
  const uf            = String(respFin?.ufEnd || respFin?.uf || respFin?.estado || a.endereco?.uf || 'SP').slice(0, 2) || 'SP'
  const cep           = String(respFin?.cep || a.endereco?.cep || '01310100').replace(/\D/g, '').padStart(8, '0')

  return { nome, cpfCnpj, logradouro, numero, complemento, bairro, cidade, uf, cep }
}
// ─────────────────────────────────────────────────────────────────

export function parcelaToTitulo(p: any, aluno: Aluno): Titulo {
  const hoje = new Date().toISOString().slice(0, 10)
  let venc = String(p.vencimento ?? '')
  // Suporta DD/MM/YYYY e YYYY-MM-DD
  if (venc.includes('/')) {
    const [d, m, a] = venc.split('/')
    venc = `${a.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  const status: 'pendente' | 'atrasado' = venc && venc < hoje ? 'atrasado' : 'pendente'
  const respFin = getResponsavelFinanceiro(aluno)

  // ── ID único e estável ────────────────────────────────────────────────────────
  // Inclui evento + num + vencimento para evitar colisões entre eventos diferentes
  // que começam sua numeração em 1 (ex: "Livros" parc1 e "Mensalidade" parc1
  // teriam `num=1` ambos, colidindo com a chave do Map em handleBoletoEmitido).
  const eventoSlug = String(p.evento ?? p.eventoDescricao ?? p.descricao ?? 'P')
    .replace(/\s+/g, '').slice(0, 12)
  const numSlug    = p.numParcela ?? p.num ?? ''
  const vencSlug   = venc.replace(/-/g, '').slice(2) // YYMMDD
  const stableId   = p.codigo ?? p.id
    ?? `${aluno.id}-${eventoSlug}-${numSlug}-${vencSlug}`

  return {
    id: stableId,
    aluno: aluno.nome,
    alunoId: aluno.id,
    responsavel: respFin.nome,
    turma: aluno.turma,
    parcela: `${p.numParcela ?? p.num ?? '?'}/${p.totalParcelas ?? '?'}`,
    descricao: p.evento ?? p.eventoDescricao ?? p.descricao ?? 'Mensalidade',
    vencimento: venc,
    valor: Number(p.valorFinal ?? p.valor ?? 0),
    status,
    statusBancario: undefined,
    htmlBoleto: undefined,
  } as unknown as Titulo
}

// ─────────────────────────────────────────────────────────────────
// ETAPA 1 — Selecionar aluno e parcelas (múltipla seleção)
// ─────────────────────────────────────────────────────────────────

/** Detecta o estado de boleto/remessa de uma parcela cruzando com o array de títulos do DataContext */
function detectBoletoStatus(parcelaId: string, alunoId: string, alunoNome: string, titulos: Titulo[]): 'remessa' | 'emitido' | null {
  const match = titulos.find(t =>
    t.id === parcelaId ||
    ((t as any).alunoId === alunoId && String(t.id).includes(parcelaId)) ||
    (t.aluno === alunoNome && String(t.id).includes(parcelaId))
  )
  if (!match || !match.statusBancario) return null
  if (match.statusBancario === 'enviado_remessa' || match.statusBancario === 'liquidado') return 'remessa'
  if (match.statusBancario === 'emitido') return 'emitido'
  return null
}

function Etapa1({ alunos, titulos, onNext }: {
  alunos: Aluno[]; titulos: Titulo[]
  onNext: (aluno: Aluno, selecionados: Titulo[]) => void
}) {
  const [busca, setBusca] = React.useState('')
  const [alunoSel, setAlunoSel] = React.useState<Aluno | null>(null)
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set())

  const hoje = new Date().toISOString().slice(0, 10)

  const alunosFiltrados = alunos.filter(a =>
    !busca || a.nome.toLowerCase().includes(busca.toLowerCase()) || a.matricula.includes(busca)
  ).slice(0, 15)

  // ── Parcelas diretas do aluno (fonte primária — financeiro do aluno) ──
  // Exclui: pagas, liquidadas, CANCELADAS, já com boleto/remessa
  const parcelasDoAluno: Titulo[] = React.useMemo(() => {
    if (!alunoSel) return []
    const parcs: any[] = (alunoSel as any).parcelas ?? []
    return parcs
      .filter(p => {
        if (p.status === 'pago' || p.status === 'liquidado') return false
        if (p.status === 'cancelado') return false   // ← FIX: exclui excluídos
        if (p.statusBancario) return false
        if (p.boletoGerado) return false
        return Number(p.valorFinal ?? p.valor ?? 0) > 0
      })
      .map(p => parcelaToTitulo(p, alunoSel))
  }, [alunoSel])

  // ── Títulos do DataContext sem boleto (fonte secundária) ────────
  const titulosDoContext: Titulo[] = React.useMemo(() => {
    if (!alunoSel) return []
    const idsJaCobertos = new Set(parcelasDoAluno.map(p => p.id))
    return titulos.filter(t =>
      t.aluno === alunoSel.nome &&
      (t.status === 'pendente' || t.status === 'atrasado') &&
      !t.statusBancario &&
      !idsJaCobertos.has(t.id)
    )
  }, [alunoSel, titulos, parcelasDoAluno])

  const todasOpcoes = [...parcelasDoAluno, ...titulosDoContext]
  const vencidas  = todasOpcoes.filter(t => t.vencimento && t.vencimento < hoje)
  const pendentes = todasOpcoes.filter(t => !t.vencimento || t.vencimento >= hoje)

  const totalSelecionado = Array.from(selecionados)
    .map(id => todasOpcoes.find(t => t.id === id))
    .filter(Boolean)
    .reduce((s, t) => s + (t!.valor ?? 0), 0)

  function toggleItem(t: Titulo) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(t.id)) next.delete(t.id)
      else next.add(t.id)
      return next
    })
  }

  function toggleAll() {
    if (selecionados.size === todasOpcoes.length) setSelecionados(new Set())
    else setSelecionados(new Set(todasOpcoes.map(t => t.id)))
  }

  function handleAlunoSelect(a: Aluno) {
    setAlunoSel(a)
    setBusca(a.nome)
    setSelecionados(new Set())
  }

  const titulosSelecionados = todasOpcoes.filter(t => selecionados.has(t.id))

  const BadgeStatus = ({ t }: { t: Titulo }) => {
    const isAtrasado = t.vencimento && t.vencimento < hoje
    return (
      <span style={{
        display: 'inline-block', fontSize: 10, fontWeight: 700,
        padding: '2px 7px', borderRadius: 10,
        background: isAtrasado ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.10)',
        color: isAtrasado ? '#f87171' : '#34d399',
      }}>
        {isAtrasado ? '⚠ Vencida' : '● Pendente'}
      </span>
    )
  }

  /** Badge azul = boleto emitido aguardando remessa; âmbar = remessa/liquidado enviado */
  const BadgeBoleto = ({ t }: { t: Titulo }) => {
    const boletoStatus = detectBoletoStatus(t.id, alunoSel?.id ?? '', alunoSel?.nome ?? '', titulos)
    if (!boletoStatus) return null
    if (boletoStatus === 'remessa') return (
      <span title="Remessa CNAB já enviada ao banco" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
        background: 'rgba(245,158,11,0.14)', color: '#f59e0b',
        border: '1px solid rgba(245,158,11,0.3)',
      }}>📤 Em Remessa</span>
    )
    return (
      <span title="Boleto registrado — aguardando envio de remessa" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
        background: 'rgba(59,130,246,0.14)', color: '#3b82f6',
        border: '1px solid rgba(59,130,246,0.3)',
      }}>🏦 Boleto Emitido</span>
    )
  }

  /** Badge extra: se a parcela já tem boleto no context mas ainda aparece na lista (parcelas que ainda podem ter novo boleto) */
  const BadgeAvisoRemessa = ({ parcelaId }: { parcelaId: string }) => {
    const match = titulos.find(t =>
      ((t as any).alunoId === alunoSel?.id || t.aluno === alunoSel?.nome) &&
      (t.id === parcelaId || String(t.id).endsWith(parcelaId))
    )
    if (!match) return null
    if (match.statusBancario === 'enviado_remessa' || match.statusBancario === 'liquidado') {
      return <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>📤 Remessa</span>
    }
    if (match.statusBancario === 'emitido') {
      return <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 700 }}>🏦 Boleto</span>
    }
    return null
  }

  const ItemParcela = ({ t }: { t: Titulo }) => {
    const sel = selecionados.has(t.id)
    const boletoStatus = detectBoletoStatus(t.id, alunoSel?.id ?? '', alunoSel?.nome ?? '', titulos)
    const bloqueado = boletoStatus === 'remessa' // remessa enviada = não pode emitir novo
    return (
      <button
        onClick={() => !bloqueado && toggleItem(t)}
        className="card"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '11px 16px',
          cursor: bloqueado ? 'not-allowed' : 'pointer',
          textAlign: 'left', width: '100%',
          border: `1.5px solid ${sel ? 'hsl(var(--border-focus))' : bloqueado ? 'rgba(245,158,11,0.25)' : 'transparent'}`,
          background: sel ? 'rgba(59,130,246,0.05)' : bloqueado ? 'rgba(245,158,11,0.04)' : undefined,
          opacity: bloqueado ? 0.75 : 1,
          transition: 'all 0.15s',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${bloqueado ? 'rgba(245,158,11,0.4)' : sel ? '#3b82f6' : 'hsl(var(--border-default))'}`,
            background: bloqueado ? 'rgba(245,158,11,0.1)' : sel ? '#3b82f6' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: bloqueado ? '#f59e0b' : '#fff', transition: 'all 0.15s',
          }}>
            {bloqueado ? '🔒' : sel ? '✓' : ''}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{t.descricao}</span>
              <BadgeStatus t={t} />
              <BadgeBoleto t={t} />
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              Parcela {t.parcela} · Venc: {fmtData(t.vencimento)}
              {bloqueado && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· Remessa enviada ao banco</span>}
            </div>
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 14, flexShrink: 0, color: t.vencimento && t.vencimento < hoje ? '#f87171' : 'hsl(var(--text-primary))' }}>
          {fmt(t.valor)}
        </div>
      </button>
    )
  }

  // Variável auxiliar para uso nos badges de parcelas não-mapeadas para titulo
  void BadgeAvisoRemessa

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Selecionar Aluno e Parcelas</div>
        <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
          Busque o aluno e selecione uma ou mais parcelas do financeiro para gerar o boleto.
        </div>
      </div>

      {/* Busca */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input
          className="form-input"
          style={{ paddingLeft: 32 }}
          value={busca}
          onChange={e => { setBusca(e.target.value); setAlunoSel(null); setSelecionados(new Set()) }}
          placeholder="Buscar por nome ou matrícula..."
        />
      </div>

      {/* Dropdown alunos */}
      {busca && !alunoSel && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
          {alunosFiltrados.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Nenhum aluno encontrado</div>
          ) : alunosFiltrados.map(a => (
            <button key={a.id} onClick={() => handleAlunoSelect(a)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: 'transparent',
              border: 'none', borderBottom: '1px solid hsl(var(--border-subtle))',
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(99,102,241,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#818cf8',
              }}>
                {a.nome[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nome}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Matrícula: {a.matricula} · {a.turma}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Aluno selecionado */}
      {alunoSel && (
        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid hsl(var(--border-focus))' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#818cf8', flexShrink: 0 }}>
            {alunoSel.nome[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{alunoSel.nome}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Resp. Financeiro: <strong>{getResponsavelFinanceiro(alunoSel).nome}</strong> · Turma: {alunoSel.turma}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setAlunoSel(null); setSelecionados(new Set()); setBusca('') }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Lista de parcelas */}
      {alunoSel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {todasOpcoes.length === 0 ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 600 }}>Nenhuma parcela pendente encontrada</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Todas as parcelas já possuem boleto ou foram quitadas.</div>
            </div>
          ) : (
            <>
              {/* Selecionar todos */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={toggleAll} style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: 'hsl(var(--text-muted))', padding: '4px 0',
                }}>
                  {selecionados.size === todasOpcoes.length
                    ? <CheckSquare size={14} color="#3b82f6" />
                    : <Square size={14} />
                  }
                  {selecionados.size === todasOpcoes.length ? 'Desmarcar todos' : `Selecionar todos (${todasOpcoes.length})`}
                </button>
                {selecionados.size > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                    {selecionados.size} parcela{selecionados.size > 1 ? 's' : ''} · {fmt(totalSelecionado)}
                  </span>
                )}
              </div>

              {/* Parcelas vencidas */}
              {vencidas.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚠ Parcelas Vencidas ({vencidas.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {vencidas.map(t => <ItemParcela key={t.id} t={t} />)}
                  </div>
                </div>
              )}

              {/* Parcelas a vencer */}
              {pendentes.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                    ● Parcelas a Vencer ({pendentes.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {pendentes.map(t => <ItemParcela key={t.id} t={t} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resumo seleção */}
      {selecionados.size > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {selecionados.size} parcela{selecionados.size > 1 ? 's' : ''} selecionada{selecionados.size > 1 ? 's' : ''}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#3b82f6' }}>{fmt(totalSelecionado)}</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          disabled={!alunoSel || selecionados.size === 0}
          onClick={() => alunoSel && titulosSelecionados.length > 0 && onNext(alunoSel, titulosSelecionados)}
          className="btn btn-primary"
        >
          Próximo → {selecionados.size > 0 ? `(${selecionados.size} parcela${selecionados.size > 1 ? 's' : ''})` : ''}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ETAPA 2 — Configurar boleto (soma das parcelas)
// ─────────────────────────────────────────────────────────────────
export interface CfgBoleto {
  convenioId: string; dataVencimento: string; descricao: string
  especie: string; aceite: string; instrucao1: string; instrucao2: string
  percJuros: number; percMulta: number; desconto: number; abatimento: number
  dataLimiteDesconto: string; tipoProtesto: string; diasProtesto: number; competencia: string
}

export function Etapa2({ titulos, aluno, convenios, onNext, onBack }: {
  titulos: Titulo[]; aluno: Aluno; convenios: ConfigConvenio[]
  onNext: (cfg: CfgBoleto) => void; onBack: () => void
}) {
  const convAtivos = convenios.filter(c => c.situacao === 'ativo')
  const valorTotal = titulos.reduce((s, t) => s + t.valor, 0)

  // Agrupado por evento para descrição auto
  const eventoGrupos = titulos.reduce((acc, t) => {
    const ev = t.descricao ?? 'Mensalidade'
    if (!acc[ev]) acc[ev] = 0
    acc[ev] += t.valor
    return acc
  }, {} as Record<string, number>)

  const descAuto = Object.entries(eventoGrupos)
    .map(([ev, v]) => `${ev}: ${fmt(v)}`)
    .join(' | ')

  // Vencimento = maior data entre as parcelas selecionadas
  const maiorVenc = titulos
    .map(t => t.vencimento ?? '')
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date().toISOString().slice(0, 10)

  const [cfg, setCfg] = React.useState<CfgBoleto>({
    convenioId: convAtivos[0]?.id ?? '',
    dataVencimento: maiorVenc,
    descricao: descAuto.length <= 80 ? descAuto : `${titulos.length} parcela${titulos.length > 1 ? 's' : ''} — ${aluno.nome}`,
    especie: 'DS', aceite: 'N',
    instrucao1: '',
    instrucao2: '',
    percJuros: 0.033, percMulta: 2, desconto: 0, abatimento: 0,
    dataLimiteDesconto: '', tipoProtesto: '0', diasProtesto: 0,
    competencia: new Date().toISOString().slice(0, 7),
  })

  const fld = (label: string, key: keyof CfgBoleto, type = 'text', placeholder = '') => (
    <div>
      <label className="form-label">{label}</label>
      <input
        type={type}
        className="form-input"
        value={cfg[key] as string | number}
        onChange={e => setCfg(c => ({ ...c, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  )

  const sel = (label: string, key: keyof CfgBoleto, opts: { v: string; l: string }[]) => (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={cfg[key] as string} onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))}>
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Configurar Boleto</div>
        <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Defina as condições de cobrança. Valor total: <strong style={{ color: '#3b82f6' }}>{fmt(valorTotal)}</strong></div>
      </div>

      {/* Parcelas incluídas */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Parcelas incluídas no boleto ({titulos.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {titulos.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'hsl(var(--text-muted))' }}>{t.descricao} · Parc {t.parcela} · Venc {fmtData(t.vencimento)}</span>
              <span style={{ fontWeight: 700 }}>{fmt(t.valor)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 6, marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#3b82f6' }}>{fmt(valorTotal)}</span>
          </div>
        </div>
      </div>

      {convAtivos.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: 'center', border: '1px solid rgba(248,113,113,0.3)' }}>
          <span style={{ color: '#f87171' }}>⚠️ Nenhum convênio bancário ativo. Configure um convênio na aba "Convênios".</span>
        </div>
      ) : (
        <>
          {/* Convênio */}
          <div>
            <label className="form-label">Convênio Bancário <span style={{ color: '#f87171' }}>*</span></label>
            <select className="form-input" value={cfg.convenioId} onChange={e => setCfg(c => ({ ...c, convenioId: e.target.value }))}>
              {convAtivos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nomeBanco} — Ag: {c.agencia} / Conta: {c.conta}-{c.digitoConta} · Cart. {c.carteira}
                </option>
              ))}
            </select>
          </div>

          {/* Datas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {fld('Data de Vencimento', 'dataVencimento', 'date')}
            {fld('Competência', 'competencia', 'month')}
          </div>
          {fld('Descrição do Título', 'descricao', 'text', 'Ex: Mensalidade Janeiro/2026')}

          {/* Encargos */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Encargos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
              {fld('Juros % ao dia', 'percJuros', 'number', '0.033')}
              {fld('Multa %', 'percMulta', 'number', '2')}
              {fld('Desconto R$', 'desconto', 'number', '0')}
              {fld('Abatimento R$', 'abatimento', 'number', '0')}
            </div>
            {fld('Data Limite Desconto', 'dataLimiteDesconto', 'date')}
          </div>

          {/* Instruções */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Instruções e Protesto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Instrução 1 (máx. 80 chars)</label>
                <input className="form-input" value={cfg.instrucao1} maxLength={80}
                  onChange={e => setCfg(c => ({ ...c, instrucao1: e.target.value.slice(0, 80) }))} />
              </div>
              <div>
                <label className="form-label">Instrução 2 (opcional)</label>
                <input className="form-input" value={cfg.instrucao2} maxLength={80}
                  onChange={e => setCfg(c => ({ ...c, instrucao2: e.target.value.slice(0, 80) }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {sel('Tipo Protesto', 'tipoProtesto', [
                  { v: '0', l: 'Sem protesto' }, { v: '1', l: 'Dias corridos' },
                  { v: '2', l: 'Dias úteis' }, { v: '3', l: 'Devolver' },
                ])}
                {cfg.tipoProtesto !== '0' && fld('Dias p/ Protesto', 'diasProtesto', 'number', '3')}
                {sel('Espécie', 'especie', [
                  { v: 'DS', l: 'DS - Diversos' }, { v: 'REC', l: 'REC - Recibo' },
                  { v: 'DM', l: 'DM - Duplicata' }, { v: 'NF', l: 'NF - Nota Fiscal' },
                ])}
                {sel('Aceite', 'aceite', [{ v: 'N', l: 'N - Não aceito' }, { v: 'A', l: 'A - Aceito' }])}
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Voltar</button>
        <button className="btn btn-primary" disabled={!cfg.convenioId} onClick={() => onNext(cfg)}>Próximo →</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ETAPA 3 — Confirmar e Emitir (soma de parcelas)
// ─────────────────────────────────────────────────────────────────
export function Etapa3({ titulos, aluno, cfg, convenios, onEmitido, onBack }: {
  titulos: Titulo[]; aluno: Aluno; cfg: CfgBoleto
  convenios: ConfigConvenio[]
  onEmitido: (ts: Titulo[], seq: number, convId: string) => void
  onBack: () => void
}) {
  const [loading, setLoading] = React.useState(false)
  const [erro, setErro] = React.useState('')
  const [boletosEmitidos, setBoletosEmitidos] = React.useState<Titulo[] | null>(null)
  const convenio = convenios.find(c => c.id === cfg.convenioId)

  const valorTotal = titulos.reduce((s, t) => s + t.valor, 0)

  // Eventos agrupados por descricao para o boleto
  const eventoGrupos = titulos.reduce((acc, t) => {
    const ev = t.descricao ?? 'Mensalidade'
    if (!acc[ev]) acc[ev] = { valor: 0, parcelas: [] as string[] }
    acc[ev].valor += t.valor
    acc[ev].parcelas.push(t.parcela)
    return acc
  }, {} as Record<string, { valor: number; parcelas: string[] }>)

  const linhasDescricao = Object.entries(eventoGrupos)
    .map(([ev, { valor, parcelas }]) => `${ev} (Parc ${parcelas.join(', ')}): ${fmt(valor)}`)

  async function emitir() {
    if (!convenio) { setErro('Convênio não encontrado.'); return }
    setLoading(true); setErro('')
    try {
      // Monta instrucoes automáticas com os eventos agrupados
      const instEvento1 = linhasDescricao[0]?.slice(0, 80) ?? ''
      const instEvento2 = linhasDescricao[1]?.slice(0, 80) ?? ''

      const pagador = getResponsavelFinanceiro(aluno)

      const payload = {
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
          numeroDocumento: `GRP-${aluno.id}-${Date.now().toString(36).toUpperCase()}`,
          descricao: cfg.descricao,
          especie: cfg.especie, aceite: cfg.aceite,
          dataDocumento: new Date().toISOString().slice(0, 10),
          dataVencimento: cfg.dataVencimento,
          valor: valorTotal,
          desconto: cfg.desconto, abatimento: cfg.abatimento,
          percJuros: cfg.percJuros, percMulta: cfg.percMulta,
          dataLimiteDesconto: cfg.dataLimiteDesconto || undefined,
          // instrução 1 e 2 = usuário; eventoGrupos vão como instrucoes adicionais
          instrucao1: cfg.instrucao1 || instEvento1,
          instrucao2: cfg.instrucao2 || instEvento2,
          tipoProtesto: cfg.tipoProtesto, diasProtesto: cfg.diasProtesto,
          competencia: cfg.competencia,
          alunoId: aluno.id, alunoNome: aluno.nome, responsavelNome: pagador.nome,
          convenioId: convenio.id,
          // metadata extra para o template HTML (campos agrupados por evento)
          parcelasAgrupadas: Object.entries(eventoGrupos).map(([ev, { valor, parcelas }]) => ({
            evento: ev, parcelas: parcelas.join(', '), valor,
          })),
        },
        convenio: {
          ...convenio,
          convenio: convenio.convenio.replace(/\D/g, '').padStart(5, '0'),
        },
        ultimoSequencial: convenio.nossoNumeroSequencial,
      }

      const res = await fetch('/api/boletos/emitir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.sucesso) { setErro((json.erros ?? [json.error ?? 'Erro desconhecido']).join('\n')); return }

      const d = json.dados

      // Gera um Titulo por parcela selecionada, todos compartilhando o nosso número / barcode
      const titulosAtualizados: Titulo[] = titulos.map((t, i) => ({
        ...t,
        // Apenas o primeiro carrega os dados do boleto (os demais são "vinculados")
        nossoNumero: d.nossoNumero,
        nossoNumeroDV: d.nossoNumeroDV,
        nossoNumeroFormatado: d.nossoNumeroFormatado,
        codigoBarras44: d.codigoBarras44,
        linhaDigitavel: d.linhaDigitavel,
        linhaDigitavelFormatada: d.linhaDigitavelFormatada,
        fatorVencimento: d.fatorVencimento,
        numeroDocumento: payload.titulo.numeroDocumento,
        dataDocumento: payload.titulo.dataDocumento,
        dataVencimento: cfg.dataVencimento,
        especie: cfg.especie, aceite: cfg.aceite,
        instrucao1: cfg.instrucao1, instrucao2: cfg.instrucao2,
        tipoProtesto: cfg.tipoProtesto, diasProtesto: cfg.diasProtesto,
        percJuros: cfg.percJuros, percMulta: cfg.percMulta,
        desconto: cfg.desconto, abatimento: cfg.abatimento,
        dataLimiteDesconto: cfg.dataLimiteDesconto || undefined,
        convenioId: convenio.id,
        statusBancario: 'emitido' as Titulo['statusBancario'],
        // Só o primeiro guarda o HTML (para evitar duplicação em memória)
        htmlBoleto: i === 0 ? d.htmlBoleto : undefined,
        // Persiste TODOS os campos do pagador para uso futuro na remessa
        pagadorNome:        payload.titulo.pagador.nome,
        pagadorCpfCnpj:     payload.titulo.pagador.cpfCnpj,
        pagadorLogradouro:  payload.titulo.pagador.logradouro,
        pagadorNumero:      payload.titulo.pagador.numero,
        pagadorComplemento: payload.titulo.pagador.complemento ?? '',
        pagadorBairro:      payload.titulo.pagador.bairro,
        pagadorCidade:      payload.titulo.pagador.cidade,
        pagadorUF:          payload.titulo.pagador.uf,
        pagadorCEP:         payload.titulo.pagador.cep,
        eventos: i === 0 ? [d.evento] : [],
        // flags para indicar que é parte de um grupo
        grupoId: payload.titulo.numeroDocumento,
        valorGrupo: valorTotal,
      }))

      setBoletosEmitidos(titulosAtualizados)
      onEmitido(titulosAtualizados, d.novoSequencial, convenio.id)
    } catch (e: unknown) { setErro(`Erro de rede: ${(e as Error).message}`)
    } finally { setLoading(false) }
  }

  if (boletosEmitidos) {
    const principal = boletosEmitidos[0]!
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Boleto Emitido com Sucesso!</h3>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 24 }}>
          {boletosEmitidos.length} parcela{boletosEmitidos.length > 1 ? 's' : ''} incluída{boletosEmitidos.length > 1 ? 's' : ''} · {fmt(valorTotal)}
        </p>
        <div className="card" style={{ padding: '16px 20px', textAlign: 'left', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 12 }}>
            {[
              ['Aluno', aluno.nome],
              ['Total', fmt(valorTotal)],
              ['Nosso Número', principal.nossoNumeroFormatado ?? '—'],
              ['Vencimento', fmtData(cfg.dataVencimento)],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                <div style={{ fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
          {/* Detalhamento por evento */}
          <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Eventos Incluídos</div>
            {Object.entries(eventoGrupos).map(([ev, { valor, parcelas }]) => (
              <div key={ev} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span>{ev} (Parc {parcelas.join(', ')})</span>
                <strong>{fmt(valor)}</strong>
              </div>
            ))}
          </div>
          {principal.linhaDigitavelFormatada && (
            <div style={{ paddingTop: 12, borderTop: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 4 }}>Linha Digitável</div>
              <code style={{ fontSize: 12, color: '#60a5fa', wordBreak: 'break-all' }}>{principal.linhaDigitavelFormatada}</code>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {principal.htmlBoleto && (
            <button className="btn btn-primary" onClick={() => openBoletoHtml(principal.htmlBoleto!)}>🖨️ Imprimir Boleto</button>
          )}
          <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(principal.linhaDigitavelFormatada ?? ''); alert('Linha digitável copiada!') }}>
            📋 Copiar Linha Digitável
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Confirmar e Emitir</div>
        <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Revise os dados antes de emitir o boleto registrado.</div>
      </div>

      {/* Preview */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '12px 24px', marginBottom: 16 }}>
          {[
            ['Aluno', aluno.nome],
            ['Pagador (Resp. Fin.)', (() => getResponsavelFinanceiro(aluno).nome)()],
            ['Total', fmt(valorTotal)],
            ['Vencimento', fmtData(cfg.dataVencimento)],
            ['Convênio', convenio ? `${convenio.nomeBanco} · Cart. ${convenio.carteira}` : '—'],
            ['Espécie', cfg.especie],
            ['Juros/dia', `${cfg.percJuros}%`],
            ['Multa', `${cfg.percMulta}%`],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Eventos agrupados */}
        <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Parlecas incluídas no boleto</div>
          {titulos.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'hsl(var(--text-muted))' }}>{t.descricao} · Parc {t.parcela} · Venc {fmtData(t.vencimento)}</span>
              <strong>{fmt(t.valor)}</strong>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 6, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <strong style={{ color: '#3b82f6' }}>{fmt(valorTotal)}</strong>
          </div>
        </div>
      </div>

      {convenio && (
        <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
          🏦 <strong>{convenio.nomeBanco}</strong> · Ag {convenio.agencia} · Conta {convenio.conta}-{convenio.digitoConta} · Cart. {convenio.carteira} · Próximo Seq #{convenio.nossoNumeroSequencial + 1}
          {convenio.ambiente === 'homologacao' && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Homologação</span>}
        </div>
      )}

      {erro && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          ⚠️ {erro}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button className="btn btn-secondary" onClick={onBack} disabled={loading}>← Voltar</button>
        <button className="btn btn-success" onClick={emitir} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Emitindo...
            </>
          ) : `🏦 Emitir Boleto — ${fmt(valorTotal)}`}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Componente principal: Stepper
// ─────────────────────────────────────────────────────────────────
export function AbaEmitir({ alunos, titulos, convenios, onEmitido, onCancel }: Props) {
  const [etapa, setEtapa] = React.useState(1)
  const [alunoSel, setAlunoSel] = React.useState<Aluno | null>(null)
  const [titulosSel, setTitulosSel] = React.useState<Titulo[]>([])
  const [cfgBoleto, setCfgBoleto] = React.useState<CfgBoleto | null>(null)

  const steps = ['Selecionar Parcelas', 'Configurar Boleto', 'Confirmar e Emitir']

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Emitir Boleto Registrado</h2>
          <p className="page-subtitle">Geração de boleto bancário padrão FEBRABAN — Itaú Carteira 109</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
      </div>

      {/* Stepper indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        {steps.map((label, idx) => {
          const num = idx + 1
          const ativo = etapa === num
          const done = etapa > num
          return (
            <React.Fragment key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: done ? '#10b981' : ativo ? '#3b82f6' : 'hsl(var(--bg-overlay))',
                  border: done ? '2px solid #10b981' : ativo ? '2px solid #3b82f6' : '2px solid hsl(var(--border-default))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  color: done || ativo ? '#fff' : 'hsl(var(--text-muted))',
                  transition: 'all 0.3s', flexShrink: 0,
                }}>
                  {done ? '✓' : num}
                </div>
                <span style={{ fontSize: 13, fontWeight: ativo ? 700 : 500, color: ativo ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? '#10b981' : 'hsl(var(--border-subtle))', margin: '0 12px', transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Content */}
      <div className="card" style={{ padding: 24 }}>
        {etapa === 1 && (
          <Etapa1 alunos={alunos} titulos={titulos}
            onNext={(a, ts) => { setAlunoSel(a); setTitulosSel(ts); setEtapa(2) }} />
        )}
        {etapa === 2 && alunoSel && titulosSel.length > 0 && (
          <Etapa2 titulos={titulosSel} aluno={alunoSel} convenios={convenios}
            onNext={cfg => { setCfgBoleto(cfg); setEtapa(3) }} onBack={() => setEtapa(1)} />
        )}
        {etapa === 3 && alunoSel && titulosSel.length > 0 && cfgBoleto && (
          <Etapa3 titulos={titulosSel} aluno={alunoSel} cfg={cfgBoleto} convenios={convenios}
            onEmitido={onEmitido} onBack={() => setEtapa(2)} />
        )}
      </div>
    </div>
  )
}
