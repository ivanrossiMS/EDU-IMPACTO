'use client'

import React, { useState, useMemo } from 'react'
import {
  Clock, Sparkles, Copy, Check, Send,
  Layers, Sun,
  Printer, CheckCircle2,
  Info, Zap, Baby, Backpack, GraduationCap, School,
  ArrowRight
} from 'lucide-react'

export interface AmpliacaoPeriodoTabProps {
  anoLetivo?: string
  nomeAluno?: string
  nomeResponsavel?: string
  whatsappCelular?: string
  onSelectSegmento?: (segmento: string) => void
}

export interface SegmentoTurnoData {
  id: string
  segmento: string
  subtitulo: string
  iconType: 'baby' | 'infantil' | 'fund1' | 'fund2'
  meioPeriodoBase: number
  doisDias: {
    intermediario: { adicional: number; totalMensal: number }
    integral: { adicional: number; totalMensal: number }
  }
  tresDias: {
    intermediario: { adicional: number; totalMensal: number }
    integral: { adicional: number; totalMensal: number }
  }
}

// ─── DADOS OFICIAIS CORRIGIDOS CONFORME NOVA TABELA 2027 ───
export const DADOS_AMPLIACAO_PERIODO: SegmentoTurnoData[] = [
  {
    id: 'villa-baby',
    segmento: 'Villa Baby',
    subtitulo: 'Berçário, N1 e N2',
    iconType: 'baby',
    meioPeriodoBase: 1395.00,
    doisDias: {
      intermediario: { adicional: 250.00, totalMensal: 1645.00 },
      integral: { adicional: 400.00, totalMensal: 1795.00 }
    },
    tresDias: {
      intermediario: { adicional: 400.00, totalMensal: 1795.00 },
      integral: { adicional: 600.00, totalMensal: 1995.00 }
    }
  },
  {
    id: 'ed-infantil',
    segmento: 'Educação Infantil',
    subtitulo: 'N3 ao N5',
    iconType: 'infantil',
    meioPeriodoBase: 1230.00,
    doisDias: {
      intermediario: { adicional: 350.00, totalMensal: 1580.00 },
      integral: { adicional: 500.00, totalMensal: 1730.00 }
    },
    tresDias: {
      intermediario: { adicional: 500.00, totalMensal: 1730.00 },
      integral: { adicional: 700.00, totalMensal: 1930.00 }
    }
  },
  {
    id: 'fund-1',
    segmento: 'Fundamental I',
    subtitulo: '1º ao 5º ano',
    iconType: 'fund1',
    meioPeriodoBase: 1230.00,
    doisDias: {
      intermediario: { adicional: 350.00, totalMensal: 1580.00 },
      integral: { adicional: 500.00, totalMensal: 1730.00 }
    },
    tresDias: {
      intermediario: { adicional: 500.00, totalMensal: 1730.00 },
      integral: { adicional: 700.00, totalMensal: 1930.00 }
    }
  },
  {
    id: 'fund-2',
    segmento: 'Fundamental II',
    subtitulo: '6º ao 9º ano',
    iconType: 'fund2',
    meioPeriodoBase: 1330.00,
    doisDias: {
      intermediario: { adicional: 300.00, totalMensal: 1630.00 },
      integral: { adicional: 550.00, totalMensal: 1880.00 }
    },
    tresDias: {
      intermediario: { adicional: 550.00, totalMensal: 1880.00 },
      integral: { adicional: 700.00, totalMensal: 2030.00 }
    }
  }
]

export default function AmpliacaoPeriodoTab({
  anoLetivo = '2027',
  nomeAluno = '',
  nomeResponsavel = '',
  whatsappCelular = ''
}: AmpliacaoPeriodoTabProps) {
  // Frequência selecionada: 2x (padrão), 3x, ou ambos
  const [frequenciaAtiva, setFrequenciaAtiva] = useState<'2x' | '3x' | 'ambos'>('2x')
  
  // Modo de exibição: Cartões Intuitivos ou Tabela Oficial
  const [displayMode, setDisplayMode] = useState<'cards' | 'tabela' | 'simulador'>('cards')

  // Simulador rápido
  const [simSegId, setSimSegId] = useState<string>('ed-infantil')
  const [simDias, setSimDias] = useState<'2x' | '3x'>('2x')
  const [simModalidade, setSimModalidade] = useState<'intermediario' | 'integral'>('integral')

  // Feedback de cópia
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const fmt = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  // Segmento selecionado no simulador
  const currentSeg = useMemo(() => {
    return DADOS_AMPLIACAO_PERIODO.find(s => s.id === simSegId) || DADOS_AMPLIACAO_PERIODO[1]
  }, [simSegId])

  // Cálculos do simulador
  const simuladorData = useMemo(() => {
    const base = currentSeg.meioPeriodoBase
    const plano = simDias === '2x' ? currentSeg.doisDias : currentSeg.tresDias
    const opt = simModalidade === 'intermediario' ? plano.intermediario : plano.integral

    return {
      segmento: currentSeg.segmento,
      subtitulo: currentSeg.subtitulo,
      meioPeriodo: base,
      dias: simDias,
      diasExtenso: simDias === '2x' ? '2 dias por semana' : '3 dias por semana',
      modalidade: simModalidade === 'intermediario' ? 'Intermediário' : 'Integral',
      adicional: opt.adicional,
      totalMensal: opt.totalMensal
    }
  }, [currentSeg, simDias, simModalidade])

  // Gerador de mensagem para WhatsApp
  const buildWhatsAppText = (data: {
    segmento: string
    subtitulo: string
    diasExtenso: string
    dias: string
    modalidade: string
    meioPeriodo: number
    adicional: number
    totalMensal: number
  }) => {
    const saudacao = nomeResponsavel ? `Olá, *${nomeResponsavel.trim()}*!` : 'Olá!'
    const ref = nomeAluno ? ` para *${nomeAluno.trim()}*` : ''

    return `🏫 *COLÉGIO IMPACTO • AMPLIAÇÃO DE PERÍODO ${anoLetivo}*
⏰ *Proposta de Contraturno (Turno Estendido)*${ref}

${saudacao} Seguem os valores oficiais de ampliação de período:

📚 *Segmento:* ${data.segmento} (${data.subtitulo})
📅 *Frequência:* *${data.diasExtenso}* (${data.dias})
✨ *Modalidade:* *${data.modalidade}*

💰 *VALORES MENSAIS:*
• Meio Período (Base): ${fmt(data.meioPeriodo)} / mês
• Adicional (${data.dias}): + ${fmt(data.adicional)} / mês
━━━━━━━━━━━━━━━━━━━━━━
💎 *TOTAL MENSAL: ${fmt(data.totalMensal)} / mês*
━━━━━━━━━━━━━━━━━━━━━━

ℹ️ *Como funciona:*
• Meio período: mensalidade base do segmento.
• Adicional: valor mensal para ampliar o período nos dias contratados.
• Total mensal: meio período + adicional da modalidade escolhida.

Ficamos à disposição para agendar uma visita e formalizar a contratação!
📍 *Colégio Impacto*`
  }

  const handleCopyText = async (text: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSendWhatsAppDirect = (text: string) => {
    const cleanPhone = (whatsappCelular || '').replace(/\D/g, '')
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Ícone leve para o segmento
  const renderSegmentIcon = (type: SegmentoTurnoData['iconType']) => {
    switch (type) {
      case 'baby':
        return <Baby size={20} color="#0284c7" />
      case 'infantil':
        return <Sun size={20} color="#f59e0b" />
      case 'fund1':
        return <Backpack size={20} color="#10b981" />
      case 'fund2':
        return <GraduationCap size={20} color="#6366f1" />
      default:
        return <School size={20} color="#64748b" />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', color: '#0f172a' }}>
      
      {/* ─── TOPO LEVE, CLARO E INTUITIVO ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        padding: '24px 28px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#2563eb',
                background: '#eff6ff',
                padding: '3px 10px',
                borderRadius: 16,
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Colégio Impacto • {anoLetivo}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#059669',
                background: '#ecfdf5',
                padding: '3px 10px',
                borderRadius: 16
              }}>
                Planos de 2x e 3x por semana
              </span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Ampliação de Período (Contraturno)
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500 }}>
              Valores mensais para ampliação do meio período em 2 ou 3 dias na semana (Intermediário ou Integral).
            </p>
          </div>

          {/* Botões de Ação Simples */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              <Printer size={14} />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* ─── BARRA DE CONTROLE INTUITIVA (FREQUÊNCIA & MODO) ─── */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 16,
          borderTop: '1px solid #f1f5f9'
        }}>
          {/* Seletor de Frequência Principal */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginRight: 4 }}>
              Frequência:
            </span>

            <button
              type="button"
              onClick={() => setFrequenciaAtiva('2x')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                border: frequenciaAtiva === '2x' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: frequenciaAtiva === '2x' ? '#eff6ff' : '#ffffff',
                color: frequenciaAtiva === '2x' ? '#1d4ed8' : '#475569',
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={14} />
              <span>2 Dias por Semana (2x)</span>
            </button>

            <button
              type="button"
              onClick={() => setFrequenciaAtiva('3x')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                border: frequenciaAtiva === '3x' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                background: frequenciaAtiva === '3x' ? '#eef2ff' : '#ffffff',
                color: frequenciaAtiva === '3x' ? '#4338ca' : '#475569',
                transition: 'all 0.15s ease'
              }}
            >
              <Zap size={14} />
              <span>3 Dias por Semana (3x)</span>
            </button>

            <button
              type="button"
              onClick={() => setFrequenciaAtiva('ambos')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: frequenciaAtiva === 'ambos' ? '2px solid #0f172a' : '1px solid #e2e8f0',
                background: frequenciaAtiva === 'ambos' ? '#f8fafc' : '#ffffff',
                color: frequenciaAtiva === 'ambos' ? '#0f172a' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={14} />
              <span>Comparar 2x e 3x</span>
            </button>
          </div>

          {/* Formato de Visualização */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: 3,
            borderRadius: 10,
            gap: 2
          }}>
            {[
              { id: 'cards', label: 'Cartões Visuais' },
              { id: 'tabela', label: 'Tabela Tradicional' },
              { id: 'simulador', label: 'Simulador Rápido' }
            ].map(m => {
              const isSel = displayMode === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDisplayMode(m.id as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: isSel ? 800 : 600,
                    border: 'none',
                    background: isSel ? '#ffffff' : 'transparent',
                    color: isSel ? '#0f172a' : '#64748b',
                    boxShadow: isSel ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── VISUALIZAÇÃO 1: CARTÕES VISUAIS LEVES (FÁCIL E INTUITIVO) ─── */}
      {displayMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {DADOS_AMPLIACAO_PERIODO.map(item => {
            // Se estiver em 'ambos', exibe as duas abas dentro do card, caso contrário exibe a frequência ativa
            const plano2x = item.doisDias
            const plano3x = item.tresDias

            return (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  borderRadius: 18,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Cabeçalho do Card */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {renderSegmentIcon(item.iconType)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                        {item.segmento}
                      </h3>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                        {item.subtitulo}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>
                      Meio Período (Base)
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                      {fmt(item.meioPeriodoBase)}
                    </span>
                  </div>
                </div>

                {/* Opções para 2x (se ativo ou ambos) */}
                {(frequenciaAtiva === '2x' || frequenciaAtiva === 'ambos') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {frequenciaAtiva === 'ambos' && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> 2 Dias por Semana (2x)
                      </span>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {/* Intermediário */}
                      <div style={{
                        padding: 12,
                        borderRadius: 12,
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 6
                      }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', display: 'block' }}>
                            Intermediário
                          </span>
                          <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 700 }}>
                            + {fmt(plano2x.intermediario.adicional)}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 9, color: '#64748b', display: 'block', fontWeight: 700 }}>TOTAL MENSAL</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: '#0369a1' }}>
                            {fmt(plano2x.intermediario.totalMensal)}
                          </span>
                        </div>
                      </div>

                      {/* Integral */}
                      <div style={{
                        padding: 12,
                        borderRadius: 12,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 6
                      }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', display: 'block' }}>
                            Integral
                          </span>
                          <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 700 }}>
                            + {fmt(plano2x.integral.adicional)}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 9, color: '#64748b', display: 'block', fontWeight: 700 }}>TOTAL MENSAL</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: '#1e40af' }}>
                            {fmt(plano2x.integral.totalMensal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Opções para 3x (se ativo ou ambos) */}
                {(frequenciaAtiva === '3x' || frequenciaAtiva === 'ambos') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {frequenciaAtiva === 'ambos' && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} /> 3 Dias por Semana (3x)
                      </span>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {/* Intermediário */}
                      <div style={{
                        padding: 12,
                        borderRadius: 12,
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 6
                      }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#5b21b6', display: 'block' }}>
                            Intermediário
                          </span>
                          <span style={{ fontSize: 10, color: '#6d28d9', fontWeight: 700 }}>
                            + {fmt(plano3x.intermediario.adicional)}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 9, color: '#64748b', display: 'block', fontWeight: 700 }}>TOTAL MENSAL</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: '#5b21b6' }}>
                            {fmt(plano3x.intermediario.totalMensal)}
                          </span>
                        </div>
                      </div>

                      {/* Integral */}
                      <div style={{
                        padding: 12,
                        borderRadius: 12,
                        background: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 6
                      }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#3730a3', display: 'block' }}>
                            Integral
                          </span>
                          <span style={{ fontSize: 10, color: '#4338ca', fontWeight: 700 }}>
                            + {fmt(plano3x.integral.adicional)}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 9, color: '#64748b', display: 'block', fontWeight: 700 }}>TOTAL MENSAL</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: '#3730a3' }}>
                            {fmt(plano3x.integral.totalMensal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ações Rápidas do Card */}
                <div className="no-print" style={{ display: 'flex', gap: 6, paddingTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const diasAtual = frequenciaAtiva === '3x' ? '3x' : '2x'
                      const plano = diasAtual === '2x' ? item.doisDias : item.tresDias
                      const msg = buildWhatsAppText({
                        segmento: item.segmento,
                        subtitulo: item.subtitulo,
                        dias: diasAtual,
                        diasExtenso: diasAtual === '2x' ? '2 dias por semana' : '3 dias por semana',
                        modalidade: 'Integral',
                        meioPeriodo: item.meioPeriodoBase,
                        adicional: plano.integral.adicional,
                        totalMensal: plano.integral.totalMensal
                      })
                      handleCopyText(msg, `card-${item.id}`)
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      border: '1px solid #cbd5e1',
                      background: copiedKey === `card-${item.id}` ? '#ecfdf5' : '#f8fafc',
                      color: copiedKey === `card-${item.id}` ? '#059669' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {copiedKey === `card-${item.id}` ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === `card-${item.id}` ? 'Copiado!' : 'Copiar WhatsApp'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSimSegId(item.id)
                      setSimDias(frequenciaAtiva === '3x' ? '3x' : '2x')
                      setDisplayMode('simulador')
                    }}
                    title="Abrir no simulador rápido"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      cursor: 'pointer'
                    }}
                  >
                    Simular
                  </button>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* ─── VISUALIZAÇÃO 2: TABELA LIMPA E FIEL AO FOLHETO OFICIAL ─── */}
      {displayMode === 'tabela' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tabela 2x */}
          {(frequenciaAtiva === '2x' || frequenciaAtiva === 'ambos') && (
            <div style={{
              background: '#ffffff',
              borderRadius: 18,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
              overflow: 'hidden'
            }}>
              <div style={{
                background: '#f8fafc',
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 12
                  }}>
                    2x
                  </span>
                  <div>
                    <strong style={{ fontSize: 13, color: '#0f172a' }}>DIAS POR SEMANA</strong>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>Ampliação do meio período</span>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>VALORES MENSAIS</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#ffffff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 16px' }}>Segmento</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>Meio Período</th>
                      <th colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', background: '#0284c7', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
                        Intermediário
                      </th>
                      <th colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', background: '#1e40af', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
                        Integral
                      </th>
                    </tr>
                    <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 10, fontWeight: 800, borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '6px 16px' }}></th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', borderLeft: '1px solid #e2e8f0' }}>Mensalidade</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: '#0284c7', background: '#f0f9ff', borderLeft: '1px solid #e2e8f0' }}>Adicional</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', color: '#0284c7', background: '#f0f9ff' }}>Total Mensal</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: '#1e40af', background: '#eff6ff', borderLeft: '1px solid #e2e8f0' }}>Adicional</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', color: '#1e40af', background: '#eff6ff' }}>Total Mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DADOS_AMPLIACAO_PERIODO.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', display: 'block', fontSize: 13 }}>{item.segmento}</span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>{item.subtitulo}</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#334155', borderLeft: '1px solid #f1f5f9' }}>
                          {fmt(item.meioPeriodoBase)}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0284c7', fontWeight: 700, background: 'rgba(240, 249, 255, 0.4)', borderLeft: '1px solid #e2e8f0' }}>
                          + {fmt(item.doisDias.intermediario.adicional)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', background: 'rgba(240, 249, 255, 0.6)' }}>
                          <span style={{ fontWeight: 900, color: '#0369a1', fontSize: 13 }}>
                            {fmt(item.doisDias.intermediario.totalMensal)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#1e40af', fontWeight: 700, background: 'rgba(239, 246, 255, 0.4)', borderLeft: '1px solid #e2e8f0' }}>
                          + {fmt(item.doisDias.integral.adicional)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', background: 'rgba(239, 246, 255, 0.6)' }}>
                          <span style={{ fontWeight: 900, color: '#1e40af', fontSize: 13 }}>
                            {fmt(item.doisDias.integral.totalMensal)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabela 3x */}
          {(frequenciaAtiva === '3x' || frequenciaAtiva === 'ambos') && (
            <div style={{
              background: '#ffffff',
              borderRadius: 18,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
              overflow: 'hidden'
            }}>
              <div style={{
                background: '#f8fafc',
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 12
                  }}>
                    3x
                  </span>
                  <div>
                    <strong style={{ fontSize: 13, color: '#0f172a' }}>DIAS POR SEMANA</strong>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>Ampliação do meio período</span>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>VALORES MENSAIS</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#ffffff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 16px' }}>Segmento</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>Meio Período</th>
                      <th colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', background: '#0284c7', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
                        Intermediário
                      </th>
                      <th colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', background: '#1e40af', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
                        Integral
                      </th>
                    </tr>
                    <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 10, fontWeight: 800, borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '6px 16px' }}></th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', borderLeft: '1px solid #e2e8f0' }}>Mensalidade</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: '#0284c7', background: '#f0f9ff', borderLeft: '1px solid #e2e8f0' }}>Adicional</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', color: '#0284c7', background: '#f0f9ff' }}>Total Mensal</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: '#1e40af', background: '#eff6ff', borderLeft: '1px solid #e2e8f0' }}>Adicional</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', color: '#1e40af', background: '#eff6ff' }}>Total Mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DADOS_AMPLIACAO_PERIODO.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', display: 'block', fontSize: 13 }}>{item.segmento}</span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>{item.subtitulo}</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#334155', borderLeft: '1px solid #f1f5f9' }}>
                          {fmt(item.meioPeriodoBase)}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0284c7', fontWeight: 700, background: 'rgba(240, 249, 255, 0.4)', borderLeft: '1px solid #e2e8f0' }}>
                          + {fmt(item.tresDias.intermediario.adicional)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', background: 'rgba(240, 249, 255, 0.6)' }}>
                          <span style={{ fontWeight: 900, color: '#0369a1', fontSize: 13 }}>
                            {fmt(item.tresDias.intermediario.totalMensal)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#1e40af', fontWeight: 700, background: 'rgba(239, 246, 255, 0.4)', borderLeft: '1px solid #e2e8f0' }}>
                          + {fmt(item.tresDias.integral.adicional)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', background: 'rgba(239, 246, 255, 0.6)' }}>
                          <span style={{ fontWeight: 900, color: '#1e40af', fontSize: 13 }}>
                            {fmt(item.tresDias.integral.totalMensal)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── VISUALIZAÇÃO 3: SIMULADOR RÁPIDO INTERATIVO (SUPER LEVE) ─── */}
      {displayMode === 'simulador' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
          padding: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
          alignItems: 'start'
        }}>
          {/* Controles do Simulador */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Passo 1
              </span>
              <h4 style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', margin: '2px 0 8px 0' }}>
                Escolha o Segmento:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DADOS_AMPLIACAO_PERIODO.map(seg => {
                  const isSel = simSegId === seg.id
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => setSimSegId(seg.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: isSel ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSel ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 800, color: isSel ? '#1d4ed8' : '#0f172a' }}>
                        {seg.segmento}
                      </span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        {seg.subtitulo}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Passo 2
              </span>
              <h4 style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', margin: '2px 0 8px 0' }}>
                Frequência e Modalidade:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setSimDias('2x')}
                  style={{
                    padding: '10px',
                    borderRadius: 10,
                    border: simDias === '2x' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: simDias === '2x' ? '#eff6ff' : '#ffffff',
                    color: simDias === '2x' ? '#1d4ed8' : '#475569',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  2 Dias por Semana (2x)
                </button>

                <button
                  type="button"
                  onClick={() => setSimDias('3x')}
                  style={{
                    padding: '10px',
                    borderRadius: 10,
                    border: simDias === '3x' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    background: simDias === '3x' ? '#eef2ff' : '#ffffff',
                    color: simDias === '3x' ? '#4338ca' : '#475569',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  3 Dias por Semana (3x)
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSimModalidade('intermediario')}
                  style={{
                    padding: '10px',
                    borderRadius: 10,
                    border: simModalidade === 'intermediario' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: simModalidade === 'intermediario' ? '#f0f9ff' : '#ffffff',
                    color: simModalidade === 'intermediario' ? '#0369a1' : '#475569',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Intermediário
                </button>

                <button
                  type="button"
                  onClick={() => setSimModalidade('integral')}
                  style={{
                    padding: '10px',
                    borderRadius: 10,
                    border: simModalidade === 'integral' ? '2px solid #1e40af' : '1px solid #e2e8f0',
                    background: simModalidade === 'integral' ? '#eff6ff' : '#ffffff',
                    color: simModalidade === 'integral' ? '#1e40af' : '#475569',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Integral
                </button>
              </div>
            </div>
          </div>

          {/* Resultado do Simulador */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Resumo da Contratação
              </span>
              <h4 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
                {simuladorData.segmento} ({simuladorData.dias} • {simuladorData.modalidade})
              </h4>
            </div>

            <div style={{ background: '#ffffff', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>Meio Período (Base):</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(simuladorData.meioPeriodo)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#0284c7' }}>+ Adicional ({simuladorData.dias}):</span>
                <span style={{ fontWeight: 700, color: '#0284c7' }}>+ {fmt(simuladorData.adicional)}</span>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>TOTAL MENSAL:</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#1e40af' }}>
                  {fmt(simuladorData.totalMensal)} <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>/mês</span>
                </span>
              </div>
            </div>

            {/* Ações de Envio / Cópia */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const msg = buildWhatsAppText(simuladorData)
                  handleCopyText(msg, 'sim-tab')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  border: 'none',
                  background: copiedKey === 'sim-tab' ? '#059669' : '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                }}
              >
                {copiedKey === 'sim-tab' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedKey === 'sim-tab' ? 'Texto Copiado!' : 'Copiar Mensagem WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const msg = buildWhatsAppText(simuladorData)
                  handleSendWhatsAppDirect(msg)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  border: '1px solid #86efac',
                  background: '#f0fdf4',
                  color: '#15803d',
                  cursor: 'pointer'
                }}
              >
                <Send size={14} />
                <span>Enviar pelo WhatsApp {whatsappCelular ? `(${whatsappCelular})` : ''}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── CARD INFORMATIVO "COMO LER A TABELA" (LEVE E DISCRETO) ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: '#eff6ff',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Info size={18} />
        </div>

        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
          <strong style={{ color: '#0f172a' }}>Como ler a tabela: </strong>
          <span>
            <strong>Meio período:</strong> mensalidade base do segmento • 
            <strong> Adicional:</strong> valor mensal para ampliar o período nos dias contratados • 
            <strong> Total mensal:</strong> meio período + adicional da modalidade escolhida.
          </span>
        </div>
      </div>

    </div>
  )
}
