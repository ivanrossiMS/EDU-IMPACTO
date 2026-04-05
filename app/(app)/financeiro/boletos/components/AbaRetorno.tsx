'use client'

import React from 'react'
import { Titulo } from '@/lib/dataContext'
import { Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react'

interface Atualizacao {
  nossoNumero: string
  idEmpresa: string
  ocorrencia: string
  descricaoOcorrencia: string
  novoStatus: string | null
  valorPago: number
  valorTitulo: number
  valorJuros: number
  valorDesconto: number
  dataOcorrencia: string
  dataCredito: string
  dataVencimento?: string
  evento: { id: string; data: string; tipo: string; descricao: string; payload: string }
}

interface Resumo {
  qtdRegistros: number
  valorTotal: number
  qtdLiquidados: number
  qtdRejeitados: number
}

interface Props {
  titulos: Titulo[]
  onBaixas: (atualizacoes: Atualizacao[], titulos: Titulo[]) => void
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

const OCC_COLOR: Record<string, string> = {
  '02': 'badge-info',
  '06': 'badge-success', '07': 'badge-success', '08': 'badge-success',
  '10': 'badge-success', '15': 'badge-success', '16': 'badge-success', '17': 'badge-success',
  '03': 'badge-danger', '26': 'badge-danger', '30': 'badge-danger',
  '09': 'badge-warning', '14': 'badge-warning',
}

export function AbaRetorno({ titulos, onBaixas }: Props) {
  const [arrastando, setArrastando] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [erro, setErro] = React.useState('')
  const [atualizacoes, setAtualizacoes] = React.useState<Atualizacao[]>([])
  const [resumo, setResumo] = React.useState<Resumo | null>(null)
  const [header, setHeader] = React.useState<Record<string, string> | null>(null)
  const [aplicado, setAplicado] = React.useState(false)
  const [naoEncontrados, setNaoEncontrados] = React.useState<string[]>([])
  const fileRef = React.useRef<HTMLInputElement>(null)

  async function processarArquivo(text: string) {
    setLoading(true); setErro(''); setAtualizacoes([]); setResumo(null); setAplicado(false)
    try {
      const res = await fetch('/api/boletos/retorno400', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo: text }),
      })
      const json = await res.json()

      if (!json.sucesso) { setErro(json.erro ?? 'Erro ao processar retorno'); return }

      setAtualizacoes(json.atualizacoes)
      setResumo(json.resumo)
      setHeader(json.header)

      // Títulos não encontrados
      const naoAchados = json.atualizacoes
        .filter((a: Atualizacao) => !titulos.find(t => t.nossoNumero === a.nossoNumero || t.nossoNumeroFormatado === a.nossoNumero))
        .map((a: Atualizacao) => a.nossoNumero)
      setNaoEncontrados(naoAchados)
    } catch (e: unknown) { setErro((e as Error).message)
    } finally { setLoading(false) }
  }

  function handleFile(file: File) {
    if (!file.name.match(/\.(ret|txt|cnab|400)$/i)) {
      setErro('Arquivo inválido. Envie um arquivo de retorno CNAB 400 (.txt, .ret, .cnab)')
      return
    }
    const reader = new FileReader()
    reader.onload = e => processarArquivo(e.target?.result as string)
    reader.readAsText(file, 'latin1')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setArrastando(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }

  function aplicarBaixas() {
    if (!atualizacoes.length) return
    onBaixas(atualizacoes, titulos)
    setAplicado(true)
  }

  const podeLiquidar = atualizacoes.filter(a => a.novoStatus === 'liquidado').length
  const podeBaixar = atualizacoes.filter(a => a.novoStatus === 'baixado').length
  const podeFalhar = atualizacoes.filter(a => a.novoStatus === 'rejeitado').length
  const encontrados = atualizacoes.length - naoEncontrados.length

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 18 }}>Retorno CNAB 400</h2>
          <p className="page-subtitle">Processe o arquivo de retorno do banco e aplique baixas automáticas</p>
        </div>
      </div>

      {/* Drop zone */}
      {!atualizacoes.length && (
        <div
          onDragEnter={() => setArrastando(true)}
          onDragLeave={() => setArrastando(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${arrastando ? '#3b82f6' : 'hsl(var(--border-default))'}`,
            borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer',
            background: arrastando ? 'rgba(59,130,246,0.04)' : 'transparent', transition: 'all 0.2s',
            marginBottom: 20
          }}
        >
          <Upload size={40} style={{ margin: '0 auto 16px', opacity: 0.4, color: '#3b82f6' }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
            {loading ? 'Processando arquivo...' : 'Arraste o arquivo de retorno aqui'}
          </div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
            Ou clique para selecionar · Formatos aceitos: .txt, .ret, .cnab, .400
          </div>
          {!loading && (
            <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
              <Upload size={13} /> Selecionar Arquivo
            </button>
          )}
          <input ref={fileRef} type="file" accept=".txt,.ret,.cnab,.400" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {erro && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 16, border: '1px solid rgba(248,113,113,0.3)' }}>
          <div style={{ color: '#f87171', fontSize: 13 }}>⚠️ {erro}</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setErro(''); setAtualizacoes([]) }}>Tentar outro arquivo</button>
        </div>
      )}

      {atualizacoes.length > 0 && (
        <>
          {/* Header do arquivo */}
          {header && (
            <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              <span>📁 <strong>Banco:</strong> {header.bancoNome || header.banco}</span>
              <span>📅 <strong>Data:</strong> {header.dataArquivo}</span>
              <span>🏢 <strong>Cedente:</strong> {header.cedente}</span>
              <span>📄 <strong>Sequencial:</strong> {header.sequencial}</span>
            </div>
          )}

          {/* KPIs resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Registros', value: atualizacoes.length, icon: <Clock size={16} />, color: '#60a5fa' },
              { label: 'Encontrados', value: encontrados, icon: <CheckCircle size={16} />, color: '#10b981' },
              { label: 'Não encontrados', value: naoEncontrados.length, icon: <AlertCircle size={16} />, color: '#f59e0b' },
              { label: 'Liquidações', value: podeLiquidar, icon: <CheckCircle size={16} />, color: '#34d399' },
              { label: 'Rejeições', value: podeFalhar, icon: <AlertCircle size={16} />, color: '#f87171' },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: k.color }}>{k.icon}<span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span></div>
                <div style={{ fontSize: 22, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Ações */}
          {!aplicado ? (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={aplicarBaixas} disabled={encontrados === 0}>
                ✅ Aplicar Baixas ({podeLiquidar + podeBaixar} liquidação/baixa · {podeFalhar} rejeição)
              </button>
              <button className="btn btn-secondary" onClick={() => { setAtualizacoes([]); setResumo(null); setHeader(null) }}>
                📁 Carregar Outro Arquivo
              </button>
              <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                {naoEncontrados.length > 0 && `⚠️ ${naoEncontrados.length} nosso(s) número(s) não localizado(s) no sistema.`}
              </span>
            </div>
          ) : (
            <div className="card" style={{ padding: '12px 16px', marginBottom: 20, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.04)' }}>
              <div style={{ fontWeight: 700, color: '#10b981' }}>✅ Baixas aplicadas com sucesso!</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Os títulos foram atualizados no DataContext. Verifique no Dashboard.</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setAtualizacoes([]); setResumo(null); setAplicado(false) }}>
                Carregar Novo Retorno
              </button>
            </div>
          )}

          {/* Tabela de ocorrências */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nosso Número</th>
                  <th>Ocorrência</th>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Vencimento</th>
                  <th style={{ textAlign: 'right' }}>Valor Pago</th>
                  <th style={{ textAlign: 'right' }}>Juros</th>
                  <th>No Sistema</th>
                  <th>Novo Status</th>
                </tr>
              </thead>
              <tbody>
                {atualizacoes.map((a, i) => {
                  const found = titulos.find(t => t.nossoNumero === a.nossoNumero || t.nossoNumeroFormatado === a.nossoNumero)
                  const badgeCls = OCC_COLOR[a.ocorrencia] ?? 'badge-secondary'
                  return (
                    <tr key={i} style={{ opacity: !found ? 0.6 : 1 }}>
                      <td><code style={{ fontSize: 11, color: '#60a5fa', background: 'hsl(var(--bg-overlay))', padding: '1px 5px', borderRadius: 4 }}>{a.nossoNumero}</code></td>
                      <td><span className={`badge ${badgeCls}`}>{a.ocorrencia}</span></td>
                      <td style={{ fontSize: 12 }}>{a.descricaoOcorrencia || '—'}</td>
                      <td style={{ fontSize: 12 }}>{a.dataOcorrencia || '—'}</td>
                      <td style={{ fontSize: 12 }}>{a.dataVencimento || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: a.valorPago > 0 ? '#10b981' : undefined, fontFamily: 'Outfit,sans-serif' }}>
                        {a.valorPago > 0 ? fmt(a.valorPago) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: a.valorJuros > 0 ? '#f59e0b' : 'hsl(var(--text-muted))' }}>
                        {a.valorJuros > 0 ? fmt(a.valorJuros) : '—'}
                      </td>
                      <td>
                        {found ? (
                          <span className="badge badge-success">✓ {found.aluno.split(' ')[0]}</span>
                        ) : (
                          <span className="badge badge-danger">Não encontrado</span>
                        )}
                      </td>
                      <td>
                        {a.novoStatus
                          ? <span className={`badge ${a.novoStatus === 'liquidado' ? 'badge-success' : a.novoStatus === 'rejeitado' ? 'badge-danger' : 'badge-warning'}`}>
                              {a.novoStatus}
                            </span>
                          : <span className="badge badge-secondary">Sem alteração</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
