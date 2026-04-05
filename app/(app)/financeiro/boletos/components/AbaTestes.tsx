'use client'

import React from 'react'
import { Titulo, ConfigConvenio } from '@/lib/dataContext'
import { openBoletoHtml } from '@/lib/banking/openBoletoHtml'
import { FlaskConical, Download, RefreshCw } from 'lucide-react'

interface Props {
  titulos: Titulo[]
  convenios: ConfigConvenio[]
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function downloadTxt(filename: string, conteudo: string) {
  // CNAB requer exatamente 1 byte por char (ASCII/latin1) sem BOM
  // Blob com 'text/plain' pode alterar line-endings no Windows (CRLF→CRCRLF)
  // Uint8Array garante encoding byte-a-byte sem transformação
  const bytes = new Uint8Array(conteudo.length)
  for (let i = 0; i < conteudo.length; i++) {
    bytes[i] = conteudo.charCodeAt(i) & 0xff
  }
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const OCORRENCIAS = [
  { v: '02', l: '02 — Confirmação de registro' },
  { v: '06', l: '06 — Liquidado' },
  { v: '03', l: '03 — Rejeitado' },
  { v: '09', l: '09 — Baixado' },
  { v: '14', l: '14 — Vencido' },
  { v: '25', l: '25 — Em cartório' },
]

type TestStage = 'idle' | 'boleto' | 'remessa' | 'retorno_sim' | 'retorno_proc'

interface LogEntry { tipo: 'info' | 'ok' | 'erro'; msg: string }

export function AbaTestes({ titulos, convenios }: Props) {
  const [convenioId, setConvenioId] = React.useState(convenios.find(c => c.situacao === 'ativo')?.id ?? '')
  const [ocorrencia, setOcorrencia] = React.useState('06')
  const [stage, setStage] = React.useState<TestStage>('idle')
  const [loading, setLoading] = React.useState(false)
  const [log, setLog] = React.useState<LogEntry[]>([])
  const [results, setResults] = React.useState<{
    boletoGerado?: boolean; htmlBoleto?: string
    remessaFilename?: string; remessaStats?: Record<string, unknown>
    retornoSimFilename?: string; retornoConteudo?: string
    retornoProcAtualizacoes?: number
  }>({})

  const convAtivos = convenios.filter(c => c.situacao === 'ativo')
  const convenio = convAtivos.find(c => c.id === convenioId)

  // Títulos elegiveis para teste
  const titulosEmitidos = titulos.filter(t => t.nossoNumero && t.convenioId === convenioId)
  const titulosPendentes = titulos.filter(t =>
    (t.status === 'pendente' || t.status === 'atrasado') && !t.statusBancario
  ).slice(0, 2)

  function addLog(tipo: LogEntry['tipo'], msg: string) {
    setLog(prev => [...prev, { tipo, msg }])
  }

  function reset() {
    setStage('idle'); setLog([]); setResults({})
  }

  // ── TEST 1: Emitir boleto de teste ─────────────────────────────
  async function testarEmissao() {
    if (!convenio || titulosPendentes.length === 0) {
      addLog('erro', 'Nenhum título pendente ou convênio disponível para teste.')
      return
    }
    setLoading(true); setStage('boleto')
    const titulo = titulosPendentes[0]
    addLog('info', `Iniciando emissão de teste para: ${titulo.aluno} — ${fmt(titulo.valor)}`)

    try {
      const payload = {
        titulo: {
          pagador: { nome: titulo.responsavel || titulo.aluno, cpfCnpj: '00000000191', logradouro: 'Rua Teste', numero: '100', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01310100' },
          numeroDocumento: `TEST-${Date.now().toString(36).toUpperCase()}`,
          descricao: `[TESTE] ${titulo.descricao ?? titulo.parcela}`,
          especie: 'DS', aceite: 'N',
          dataDocumento: new Date().toISOString().slice(0, 10),
          dataVencimento: titulo.vencimento,
          valor: titulo.valor, desconto: 0, abatimento: 0,
          percJuros: 0.033, percMulta: 2,
          instrucao1: '[TESTE] Não efetuar pagamento — boleto de homologação',
          tipoProtesto: '0', diasProtesto: 0,
          competencia: titulo.vencimento?.slice(0, 7),
          alunoId: '', alunoNome: titulo.aluno, responsavelNome: titulo.responsavel,
          convenioId: convenio.id,
        },
        convenio: { ...convenio, convenio: convenio.convenio.replace(/\D/g, '').padStart(5, '0') },
        ultimoSequencial: convenio.nossoNumeroSequencial,
      }

      const res = await fetch('/api/boletos/emitir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()

      if (!json.sucesso) {
        addLog('erro', `Falha na emissão: ${json.erros?.[0] ?? json.error}`)
        return
      }

      addLog('ok', `✅ Boleto emitido! Nosso Nº: ${json.dados.nossoNumeroFormatado}`)
      addLog('ok', `Linha digitável: ${json.dados.linhaDigitavelFormatada}`)
      addLog('ok', `Código de barras: ${json.dados.codigoBarras44}`)
      setResults(r => ({ ...r, boletoGerado: true, htmlBoleto: json.dados.htmlBoleto }))
    } catch (e: unknown) {
      addLog('erro', (e as Error).message)
    } finally { setLoading(false) }
  }

  // ── TEST 2: Gerar remessa de teste ──────────────────────────────
  async function testarRemessa() {
    if (!convenio || titulosEmitidos.length === 0) {
      addLog('erro', 'Nenhum boleto emitido disponível para gerar remessa de teste.')
      return
    }
    setLoading(true); setStage('remessa')
    const testTitulos = titulosEmitidos.slice(0, 3)
    addLog('info', `Gerando remessa de teste com ${testTitulos.length} título(s)...`)

    try {
      const payload = {
        titulos: testTitulos.map(t => ({
          id: t.id, nossoNumero: t.nossoNumero!, nossoNumeroDV: t.nossoNumeroDV,
          nossoNumeroFormatado: t.nossoNumeroFormatado, codigoBarras44: t.codigoBarras44,
          linhaDigitavel: t.linhaDigitavel, fatorVencimento: t.fatorVencimento,
          numeroDocumento: t.numeroDocumento ?? t.id, descricao: t.descricao,
          especie: t.especie ?? 'DS', aceite: t.aceite ?? 'N',
          dataDocumento: t.dataDocumento ?? new Date().toISOString().slice(0, 10),
          dataVencimento: t.vencimento, valor: t.valor,
          desconto: 0, abatimento: 0, percJuros: 0.033, percMulta: 2,
          instrucao1: t.instrucao1 ?? '', instrucao2: '', tipoProtesto: '0', diasProtesto: 0,
          pagador: { nome: t.pagadorNome ?? t.responsavel, cpfCnpj: t.pagadorCpfCnpj ?? '00000000191', logradouro: 'A INFORMAR', numero: 'S/N', complemento: '', bairro: 'A INFORMAR', cidade: 'A INFORMAR', uf: 'SP', cep: '01310100' },
          alunoNome: t.aluno, responsavelNome: t.responsavel,
        })),
        convenio: { ...convenio, convenio: convenio.convenio.replace(/\D/g, '').padStart(5, '0') },
        sequencialArquivo: 999,
      }
      const res = await fetch('/api/boletos/remessa400', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()

      if (!json.sucesso) { addLog('erro', json.erro ?? 'Erro ao gerar remessa'); return }

      addLog('ok', `✅ Remessa gerada: ${json.filename}`)
      addLog('ok', `${json.stats.qtdTitulos} títulos · ${fmt(json.stats.valorTotal)} · ${json.stats.qtdLinhas} linhas`)
      downloadTxt(json.filename, json.conteudo)
      setResults(r => ({ ...r, remessaFilename: json.filename, remessaStats: json.stats }))
    } catch (e: unknown) { addLog('erro', (e as Error).message)
    } finally { setLoading(false) }
  }

  // ── TEST 3: Simular retorno ──────────────────────────────────────
  async function testarSimularRetorno() {
    if (!convenio || titulosEmitidos.length === 0) {
      addLog('erro', 'Nenhum boleto emitido disponível para simular retorno.')
      return
    }
    setLoading(true); setStage('retorno_sim')
    const testTitulos = titulosEmitidos.slice(0, 3)
    addLog('info', `Simulando retorno (ocorrência ${ocorrencia}) para ${testTitulos.length} título(s)...`)

    try {
      const payload = {
        titulos: testTitulos.map(t => ({
          id: t.id, nossoNumero: t.nossoNumero!, nossoNumeroDV: t.nossoNumeroDV ?? 0,
          codigoBarras44: t.codigoBarras44 ?? '',
          numeroDocumento: t.numeroDocumento ?? t.id, descricao: t.descricao ?? '',
          especie: 'DS', aceite: 'N',
          dataDocumento: t.dataDocumento ?? new Date().toISOString().slice(0, 10),
          dataVencimento: t.vencimento, valor: t.valor,
          desconto: 0, abatimento: 0, percJuros: 0.033, percMulta: 2,
          instrucao1: '', instrucao2: '', tipoProtesto: '0', diasProtesto: 0,
          pagador: { nome: t.pagadorNome ?? t.responsavel ?? 'TESTE', cpfCnpj: t.pagadorCpfCnpj ?? '00000000191', logradouro: 'A INFORMAR', numero: 'S/N', complemento: '', bairro: 'A INFORMAR', cidade: 'A INFORMAR', uf: 'SP', cep: '01310100' },
          alunoNome: t.aluno, responsavelNome: t.responsavel ?? '',
        })),
        convenio: { ...convenio, convenio: convenio.convenio.replace(/\D/g, '').padStart(5, '0') },
        ocorrencia,
      }
      const res = await fetch('/api/boletos/simular-retorno', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()

      if (!json.sucesso) { addLog('erro', json.erro ?? 'Erro ao simular'); return }

      addLog('ok', `✅ Retorno simulado gerado: ${json.filename}`)
      addLog('info', json.aviso)
      downloadTxt(json.filename, json.conteudo)
      setResults(r => ({ ...r, retornoSimFilename: json.filename, retornoConteudo: json.conteudo }))
    } catch (e: unknown) { addLog('erro', (e as Error).message)
    } finally { setLoading(false) }
  }

  // ── TEST 4: Processar retorno simulado ─────────────────────────
  async function testarProcessarRetorno() {
    if (!results.retornoConteudo) { addLog('erro', 'Gere um retorno simulado primeiro.'); return }
    setLoading(true); setStage('retorno_proc')
    addLog('info', 'Processando retorno simulado via API...')

    try {
      const res = await fetch('/api/boletos/retorno400', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo: results.retornoConteudo }),
      })
      const json = await res.json()

      if (!json.sucesso) { addLog('erro', json.erro ?? 'Erro ao processar'); return }

      addLog('ok', `✅ Retorno processado! ${json.totalRegistros} registros.`)
      json.atualizacoes.forEach((a: { nossoNumero: string; descricaoOcorrencia: string; novoStatus: string | null }) =>
        addLog('ok', `  Nosso Nº ${a.nossoNumero}: ${a.descricaoOcorrencia} → ${a.novoStatus ?? 'sem mudança'}`)
      )
      setResults(r => ({ ...r, retornoProcAtualizacoes: json.totalRegistros }))
    } catch (e: unknown) { addLog('erro', (e as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Sandbox de Testes</h2>
          <p className="page-subtitle">Teste o fluxo completo: emissão → remessa CNAB 400 → retorno simulado → processamento de baixas</p>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ gap: 6 }} onClick={reset}>
          <RefreshCw size={13} /> Limpar Log
        </button>
      </div>

      {convAtivos.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#f87171' }}>⚠️ Nenhum convênio ativo. Configure em "Convênios".</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          {/* Config + ações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Configuração do Teste</div>
              <label className="form-label">Convênio</label>
              <select className="form-input" style={{ marginBottom: 12, fontSize: 12 }} value={convenioId} onChange={e => setConvenioId(e.target.value)}>
                {convAtivos.map(c => <option key={c.id} value={c.id}>{c.nomeBanco} · Cart. {c.carteira}</option>)}
              </select>
              <label className="form-label">Ocorrência para Simular</label>
              <select className="form-input" style={{ fontSize: 12 }} value={ocorrencia} onChange={e => setOcorrencia(e.target.value)}>
                {OCORRENCIAS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                <div>Títulos disponíveis:</div>
                <div>• Pendentes (emissão): <strong>{titulosPendentes.length}</strong></div>
                <div>• Emitidos (remessa/retorno): <strong>{titulosEmitidos.length}</strong></div>
              </div>
            </div>

            {/* Fluxo de teste */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Executar Testes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={loading || titulosPendentes.length === 0} onClick={testarEmissao} style={{ justifyContent: 'flex-start', gap: 8 }}>
                  <FlaskConical size={13} /> 1. Emitir Boleto de Teste
                </button>
                <button className="btn btn-primary btn-sm" disabled={loading || titulosEmitidos.length === 0} onClick={testarRemessa} style={{ justifyContent: 'flex-start', gap: 8 }}>
                  <FlaskConical size={13} /> 2. Gerar Remessa CNAB 400
                </button>
                <button className="btn btn-primary btn-sm" disabled={loading || titulosEmitidos.length === 0} onClick={testarSimularRetorno} style={{ justifyContent: 'flex-start', gap: 8 }}>
                  <FlaskConical size={13} /> 3. Simular Retorno ({ocorrencia})
                </button>
                <button className="btn btn-secondary btn-sm" disabled={loading || !results.retornoConteudo} onClick={testarProcessarRetorno} style={{ justifyContent: 'flex-start', gap: 8 }}>
                  <FlaskConical size={13} /> 4. Processar Retorno Gerado
                </button>
              </div>
            </div>

            {/* Status dos testes */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Status do Fluxo</div>
              {([
                { label: 'Boleto Emitido', ok: !!results.boletoGerado },
                { label: 'Remessa Gerada', ok: !!results.remessaFilename },
                { label: 'Retorno Simulado', ok: !!results.retornoSimFilename },
                { label: 'Retorno Processado', ok: results.retornoProcAtualizacoes !== undefined },
              ] as const).map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <span style={{ fontSize: 12 }}>{s.label}</span>
                  <span className={`badge ${s.ok ? 'badge-success' : 'badge-secondary'}`}>{s.ok ? '✓ OK' : '—'}</span>
                </div>
              ))}
            </div>

            {/* Links rápidos resultados */}
            {results.htmlBoleto && (
              <button className="btn btn-secondary btn-sm" style={{ gap: 6 }}
                onClick={() => openBoletoHtml(results.htmlBoleto!)}>
                <Download size={13} /> Ver Boleto de Teste
              </button>
            )}
          </div>

          {/* Log */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FlaskConical size={16} color="#3b82f6" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Console de Testes</span>
              {loading && <span style={{ fontSize: 11, color: '#3b82f6', marginLeft: 'auto' }}>● Executando...</span>}
            </div>
            <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, lineHeight: '1.8', minHeight: 400, maxHeight: 600, overflowY: 'auto', background: 'hsl(var(--bg-elevated))' }}>
              {log.length === 0 ? (
                <span style={{ color: 'hsl(var(--text-muted))' }}>
                  {'>'} Sandbox pronto. Execute os testes na ordem 1 → 2 → 3 → 4 para validar o fluxo completo CNAB 400.{'\n'}
                  {'>'} Você pode executar cada teste individualmente para depurar etapas específicas.
                </span>
              ) : log.map((l, i) => (
                <div key={i} style={{ color: l.tipo === 'ok' ? '#10b981' : l.tipo === 'erro' ? '#f87171' : 'hsl(var(--text-secondary))' }}>
                  {l.tipo === 'ok' ? '✓' : l.tipo === 'erro' ? '✗' : '>'} {l.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
