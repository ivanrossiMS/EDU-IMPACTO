'use client'

/**
 * ModalEmitirAluno
 * Abre o fluxo de emissão de boleto (Etapa2 + Etapa3) diretamente
 * a partir do financeiro do aluno, com aluno e parcelas pré-selecionados.
 * O título emitido é persistido no DataContext (titulos) compartilhado
 * com Financeiro → Boletos/Convênios.
 */

import React from 'react'
import { X } from 'lucide-react'
import { Aluno, ConfigConvenio, Titulo } from '@/lib/dataContext'
import {
  Etapa2,
  Etapa3,
  CfgBoleto,
  parcelaToTitulo,
} from './AbaEmitir'

interface Props {
  aluno: Aluno
  /** Parcelas brutas do aluno (shape: { num, evento, vencimento, valorFinal, ... }) */
  parcelasRaw: any[]
  convenios: ConfigConvenio[]
  titulos: Titulo[]
  onEmitido: (titulosAtualizados: Titulo[], novoSequencial: number, convenioId: string) => void
  onClose: () => void
}

export function ModalEmitirAluno({ aluno, parcelasRaw, convenios, titulos, onEmitido, onClose }: Props) {
  const [etapa, setEtapa] = React.useState<2 | 3>(2)
  const [cfg, setCfg] = React.useState<CfgBoleto | null>(null)

  // Converte parcelas brutas do financeiro do aluno em Titulo[] (mesmo formato do DataContext)
  const titulosSelecionados: Titulo[] = React.useMemo(
    () => parcelasRaw.map(p => parcelaToTitulo(p, aluno)),
    [parcelasRaw, aluno]
  )

  const valorTotal = titulosSelecionados.reduce((s, t) => s + t.valor, 0)

  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 5500, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '94vh', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.8)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(99,102,241,0.04))', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏦</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Emitir Boleto Bancário</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  <strong style={{ color: '#60a5fa' }}>{aluno.nome}</strong>
                  {' · '}
                  {titulosSelecionados.length} parcela{titulosSelecionados.length !== 1 ? 's' : ''}
                  {' · '}
                  <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{fmt(valorTotal)}</strong>
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Mini stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 16 }}>
            {['Configurar Boleto', 'Confirmar e Emitir'].map((label, idx) => {
              const num = idx + 2 // steps 2 and 3
              const ativo = etapa === num
              const done = etapa > num
              return (
                <React.Fragment key={label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: done ? '#10b981' : ativo ? '#3b82f6' : 'hsl(var(--bg-overlay))',
                      border: `2px solid ${done ? '#10b981' : ativo ? '#3b82f6' : 'hsl(var(--border-default))'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800,
                      color: done || ativo ? '#fff' : 'hsl(var(--text-muted))',
                    }}>
                      {done ? '✓' : num}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: ativo ? 700 : 500, color: ativo ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>{label}</span>
                  </div>
                  {idx < 1 && <div style={{ flex: 1, height: 2, background: done ? '#10b981' : 'hsl(var(--border-subtle))', margin: '0 12px' }} />}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {etapa === 2 && (
            <Etapa2
              titulos={titulosSelecionados}
              aluno={aluno}
              convenios={convenios}
              onNext={novoCfg => { setCfg(novoCfg); setEtapa(3) }}
              onBack={onClose}
            />
          )}
          {etapa === 3 && cfg && (
            <Etapa3
              titulos={titulosSelecionados}
              aluno={aluno}
              cfg={cfg}
              convenios={convenios}
              onEmitido={(ts, seq, convId) => {
                onEmitido(ts, seq, convId)
                // fecha após breve delay para o usuário ver a confirmação
                setTimeout(onClose, 3500)
              }}
              onBack={() => setEtapa(2)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
