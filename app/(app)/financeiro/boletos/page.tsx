'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import React from 'react'
import { useData, ConfigConvenio, Titulo } from '@/lib/dataContext'
import { AbaDashboard }   from './components/AbaDashboard'
import { AbaEmitir }      from './components/AbaEmitir'
import { AbaEmitirAvulso } from './components/AbaEmitirAvulso'
import { AbaEmitirLote }  from './components/AbaEmitirLote'
import { AbaRemessa }     from './components/AbaRemessa'
import { AbaRetorno }     from './components/AbaRetorno'
import { AbaConvenios }   from './components/AbaConvenios'
import { AbaHistorico }   from './components/AbaHistorico'
import { AbaTestes }      from './components/AbaTestes'
import { openBoletoHtml } from '@/lib/banking/openBoletoHtml'

type Aba = 'dashboard' | 'emitir' | 'avulso' | 'lote' | 'remessa' | 'retorno' | 'convenios' | 'historico' | 'testes'

const ABAS: { id: Aba; icon: string; label: string; badge?: string }[] = [
  { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
  { id: 'emitir',     icon: '➕', label: 'Emitir (Aluno)',   badge: 'NOVO' },
  { id: 'avulso',     icon: '📝', label: 'Boleto Avulso' },
  { id: 'lote',       icon: '📦', label: 'Emissão em Lote' },
  { id: 'remessa',    icon: '📤', label: 'Remessa CNAB' },
  { id: 'retorno',    icon: '📥', label: 'Retorno CNAB' },
  { id: 'convenios',  icon: '🏦', label: 'Convênios' },
  { id: 'historico',  icon: '📋', label: 'Histórico' },
  { id: 'testes',     icon: '🧪', label: 'Sandbox' },
]

export default function BoletosPage() {
  const { cfgConvenios, setCfgConvenios, cfgEventos } = useData();
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [aba, setAba] = React.useState<Aba>('dashboard')

  // ── Convênios CRUD ──────────────────────────────────────────────
  function salvarConvenio(conv: ConfigConvenio) {
    setCfgConvenios(prev => {
      const idx = prev.findIndex(c => c.id === conv.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = conv; return n }
      return [...prev, { ...conv, createdAt: conv.createdAt ?? new Date().toISOString() }]
    })
  }
  function excluirConvenio(id: string) { setCfgConvenios(prev => prev.filter(c => c.id !== id)) }
  function toggleConvenio(id: string) {
    setCfgConvenios(prev => prev.map(c =>
      c.id === id ? { ...c, situacao: c.situacao === 'ativo' ? 'inativo' : 'ativo' } : c
    ))
  }

  // ── Após emissão individual (Emitir Aluno — pode ser multiplas parcelas) ─────
  function handleBoletoEmitido(titulosAtualizados: Titulo[], novoSeq: number, convenioId: string) {
    setTitulos(prev => {
      const mapa = new Map(prev.map(t => [t.id, t]))
      // Upsert: atualiza se já existe, adiciona se não existe
      for (const t of titulosAtualizados) {
        mapa.set(t.id, t)
      }
      return Array.from(mapa.values())
    })
    setCfgConvenios(prev => prev.map(c => c.id === convenioId ? { ...c, nossoNumeroSequencial: novoSeq } : c))
    setTimeout(() => setAba('dashboard'), 3200)
  }

  // ── Após emissão de boleto avulso ────────────────────────────────────────────
  function handleAvulsoEmitido(novoTitulo: Titulo, novoSeq: number, convenioId: string) {
    // ADD ao array (não é update de existente)
    setTitulos(prev => [...prev, novoTitulo])
    // Atualiza sequencial para não reutilizar o Nosso Número
    setCfgConvenios(prev => prev.map(c => c.id === convenioId ? { ...c, nossoNumeroSequencial: novoSeq } : c))
  }

  // ── Após emissão em lote ────────────────────────────────────────
  function handleLoteEmitido(atualizados: Titulo[], novoSeq: number, convenioId: string) {
    setTitulos(prev => prev.map(t => {
      const novo = atualizados.find(a => a.id === t.id)
      return novo ?? t
    }))
    setCfgConvenios(prev => prev.map(c => c.id === convenioId ? { ...c, nossoNumeroSequencial: novoSeq } : c))
  }

  // ── Após geração de remessa ─────────────────────────────────────
  function handleRemessaGerada(ids: string[], novoStatus: 'enviado_remessa', arquivo: string) {
    setTitulos(prev => prev.map(t =>
      ids.includes(t.id) ? { ...t, statusBancario: novoStatus, remessaArquivo: arquivo } : t
    ))
  }

  // ── Após aplicar baixas do retorno ──────────────────────────────
  type Atualizacao = {
    nossoNumero: string
    novoStatus: string | null
    valorPago?: number
    dataOcorrencia?: string
    ocorrencia?: string
    descricaoOcorrencia?: string
    evento?: { id: string; data: string; tipo: string; descricao: string; payload: string }
  }
  function handleBaixas(atualizacoes: Atualizacao[]) {
    setTitulos(prev => prev.map(t => {
      const atu = atualizacoes.find(a => a.nossoNumero === t.nossoNumero || a.nossoNumero === t.nossoNumeroFormatado)
      if (!atu || !atu.novoStatus) return t
      return {
        ...t,
        statusBancario: atu.novoStatus as Titulo['statusBancario'],
        status: atu.novoStatus === 'liquidado' ? 'pago' : t.status,
        pagamento: atu.novoStatus === 'liquidado' ? (atu.dataOcorrencia ?? new Date().toISOString().slice(0, 10)) : t.pagamento,
        retornoOcorrencia: atu.ocorrencia,
        retornoDescricao: atu.descricaoOcorrencia,
        eventos: [...(t.eventos ?? []), ...(atu.evento ? [atu.evento] : [])],
      }
    }))
  }

  // ── Reimprimir boleto ────────────────────────────────────────────
  function reimprimirBoleto(titulo: Titulo) {
    if (!titulo.htmlBoleto) return
    openBoletoHtml(titulo.htmlBoleto)
  }

  // ── Deletar boleto ───────────────────────────────────────────────
  function handleDeleteBoleto(id: string) {
    if (!window.confirm('Deletar este boleto? Esta ação não pode ser desfeita.')) return
    setTitulos(prev => prev.filter(t => t.id !== id))
  }

  const convAtivos = cfgConvenios.filter(c => c.situacao === 'ativo').length
  const boletosEmitidos = titulos.filter(t => t.statusBancario && t.statusBancario !== 'rascunho').length
  const pendentesRemessa = titulos.filter(t => t.statusBancario === 'emitido').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Page Header (clean, segue o padrão do app) ── */}
      <div className="page-header" style={{ marginBottom: 0, padding: '16px 32px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏦</div>
          <div>
            <h1 className="page-title">Boletos Registrados</h1>
            <p className="page-subtitle">Emissão · Remessa · Retorno CNAB 400 · Padrão FEBRABAN · Itaú Carteira 109</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12 }}>
          {[
            { label: 'Convênios Ativos', val: convAtivos, color: '#10b981' },
            { label: 'Boletos Emitidos', val: boletosEmitidos, color: '#3b82f6' },
            { label: 'Ag. Remessa', val: pendentesRemessa, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: s.color, fontFamily: 'Outfit,sans-serif' }}>{s.val}</div>
              <div style={{ color: 'hsl(var(--text-muted))', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Layout: Sidebar + Content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 220, flexShrink: 0, padding: '16px 8px',
          borderRight: '1px solid hsl(var(--border-subtle))',
          display: 'flex', flexDirection: 'column', gap: 2,
          overflowY: 'auto',
        }}>
          {ABAS.map(a => {
            const active = aba === a.id
            return (
              <button key={a.id} onClick={() => setAba(a.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, border: 'none',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: active ? '#3b82f6' : 'hsl(var(--text-muted))',
                fontWeight: active ? 700 : 500, fontSize: 13,
                transition: 'all 0.15s',
                boxShadow: active ? 'inset 0 0 0 1px rgba(59,130,246,0.2)' : 'none',
              }}>
                <span style={{ fontSize: 15 }}>{a.icon}</span>
                <span style={{ flex: 1 }}>{a.label}</span>
                {a.badge && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: 6, letterSpacing: '0.4px' }}>
                    {a.badge}
                  </span>
                )}
                {a.id === 'remessa' && pendentesRemessa > 0 && (
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pendentesRemessa > 9 ? '9+' : pendentesRemessa}
                  </span>
                )}
              </button>
            )
          })}

          {/* Stats */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid hsl(var(--border-subtle))' }}>
            {[
              { label: 'Títulos c/ boleto', val: boletosEmitidos },
              { label: 'Convênios ativos', val: convAtivos },
              { label: 'Ag. remessa', val: pendentesRemessa },
              { label: 'Liquidados', val: titulos.filter(t => t.statusBancario === 'liquidado').length },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', minWidth: 0 }}>
          {aba === 'dashboard' && (
            <AbaDashboard titulos={titulos} onEmitir={() => setAba('emitir')} onReprint={reimprimirBoleto} onDelete={handleDeleteBoleto} alunos={alunos} />
          )}
          {aba === 'emitir' && (
            <AbaEmitir
              alunos={alunos} titulos={titulos} convenios={cfgConvenios}
              onEmitido={handleBoletoEmitido}
              onCancel={() => setAba('dashboard')}
            />
          )}
          {aba === 'avulso' && (
            <AbaEmitirAvulso
              convenios={cfgConvenios}
              onEmitido={handleAvulsoEmitido}
              onNavigate={(novaAba) => setAba(novaAba as typeof aba)}
            />
          )}
          {aba === 'lote' && (
            <AbaEmitirLote
              alunos={alunos} titulos={titulos} convenios={cfgConvenios}
              eventos={cfgEventos}
              onEmitidos={handleLoteEmitido}
            />
          )}
          {aba === 'remessa' && (
            <AbaRemessa
              titulos={titulos} convenios={cfgConvenios}
              onStatusUpdated={handleRemessaGerada}
              onDelete={handleDeleteBoleto}
              onReprint={reimprimirBoleto}
              alunos={alunos}
            />
          )}
          {aba === 'retorno' && (
            <AbaRetorno
              titulos={titulos}
              onBaixas={(atualizacoes) => handleBaixas(atualizacoes)}
            />
          )}
          {aba === 'convenios' && (
            <AbaConvenios
              convenios={cfgConvenios}
              onSave={salvarConvenio}
              onDelete={excluirConvenio}
              onToggle={toggleConvenio}
            />
          )}
          {aba === 'historico' && (
            <AbaHistorico titulos={titulos} onReprint={reimprimirBoleto} alunos={alunos} />
          )}
          {aba === 'testes' && (
            <AbaTestes titulos={titulos} convenios={cfgConvenios} />
          )}
        </div>
      </div>
    </div>
  )
}
