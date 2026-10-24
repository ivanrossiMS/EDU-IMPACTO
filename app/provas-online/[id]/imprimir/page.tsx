'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Printer, ArrowLeft, CheckCircle2, FileText,
  Eye, Check, BookOpen, AlertCircle, RefreshCw, Award,
  Columns, SlidersHorizontal, Image as ImageIcon, Type, Maximize2
} from 'lucide-react'
import { HtmlContent } from '@/components/HtmlContent'
import { cleanAlternativeText, cleanQuestionStatementHtml } from '@/lib/provas-online/textSanitizer'

export default function ImprimirProvaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [prova, setProva] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Modes: 'aluno' (sem gabarito) | 'professor' (com gabarito e critérios) | 'cartao_resposta' (folha óptica)
  const [modoImpressao, setModoImpressao] = useState<'aluno' | 'professor' | 'cartao_resposta'>('aluno')

  // Interactive Print Framing & Layout Controls
  const [margemPreset, setMargemPreset] = useState<'estreita' | 'padrao' | 'ampla'>('padrao')
  const [colunas, setColunas] = useState<1 | 2>(1)
  const [tamanhoFonte, setTamanhoFonte] = useState<11 | 13 | 15>(13)
  const [limiteAlturaImagem, setLimiteAlturaImagem] = useState<150 | 250 | 380 | 900>(250)
  const [linhasDissertativa, setLinhasDissertativa] = useState<4 | 6 | 10 | 14>(6)
  const [mostrarGuiasMargem, setMostrarGuiasMargem] = useState<boolean>(false)

  const marginConfig = {
    estreita: { screenPad: '22px', pageMargin: '8mm', label: 'Estreita (8mm)' },
    padrao: { screenPad: '38px', pageMargin: '14mm', label: 'Padrão (14mm)' },
    ampla: { screenPad: '54px', pageMargin: '20mm', label: 'Ampla (20mm)' },
  }[margemPreset]

  useEffect(() => {
    if (!id) return
    async function loadExam() {
      try {
        setLoading(true)
        const res = await fetch(`/api/provas-online/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar a prova')
        setProva(data.prova)
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar prova para impressão')
      } finally {
        setLoading(false)
      }
    }
    loadExam()
  }, [id])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: '#475569'
      }}>
        <RefreshCw style={{ width: '32px', height: '32px', color: '#0284c7' }} className="animate-spin" />
        <p style={{ fontSize: '14px', fontWeight: 600 }}>Preparando caderno para impressão escolar...</p>
      </div>
    )
  }

  if (error || !prova) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <AlertCircle size={28} />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
          Não foi possível carregar a prova
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '420px', margin: '0 0 20px 0' }}>
          {error || 'Prova não encontrada.'}
        </p>
        <Link
          href="/provas-online"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#334155',
            fontSize: '13px',
            fontWeight: 700,
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={16} />
          Voltar para Provas Online
        </Link>
      </div>
    )
  }

  const questoes = prova.questoes || []

  return (
    <div style={{ minHeight: '100vh', background: '#e2e8f0', color: '#0f172a', paddingBottom: '48px' }}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: ${marginConfig.pageMargin};
        }
        @media print {
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-a4-sheet {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
        .printable-a4-sheet .html-content img {
          max-height: ${limiteAlturaImagem}px !important;
          width: auto;
          max-width: 100% !important;
          object-fit: contain !important;
        }
      `}</style>
      
      {/* ── TOP CONTROL BAR (HIDDEN IN PRINT) ── */}
      <header
        className="print:hidden no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#ffffff',
          borderBottom: '1px solid #cbd5e1',
          boxShadow: '0 2px 10px rgba(15,23,42,0.06)',
          padding: '10px 20px'
        }}
      >
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Row 1: Title, Mode Tabs & Print Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link
                href="/provas-online"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
                title="Voltar para Provas Online"
              >
                <ArrowLeft size={16} />
              </Link>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 800,
                    background: '#f0f9ff',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    textTransform: 'uppercase'
                  }}>
                    {prova.disciplinaNome || prova.disciplina}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {questoes.length} questões • {(prova.valorTotal || 10).toFixed(1)} pts
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                  {prova.titulo}
                </h1>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Mode Pills Segmented Control */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '3px',
                gap: '3px'
              }}>
                <button
                  type="button"
                  onClick={() => setModoImpressao('aluno')}
                  style={{
                    padding: '6px 13px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: 'none',
                    background: modoImpressao === 'aluno' ? '#ffffff' : 'transparent',
                    color: modoImpressao === 'aluno' ? '#0284c7' : '#64748b',
                    boxShadow: modoImpressao === 'aluno' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Caderno do Aluno
                </button>
                <button
                  type="button"
                  onClick={() => setModoImpressao('professor')}
                  style={{
                    padding: '6px 13px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: 'none',
                    background: modoImpressao === 'professor' ? '#ffffff' : 'transparent',
                    color: modoImpressao === 'professor' ? '#059669' : '#64748b',
                    boxShadow: modoImpressao === 'professor' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Gabarito Oficial
                </button>
                <button
                  type="button"
                  onClick={() => setModoImpressao('cartao_resposta')}
                  style={{
                    padding: '6px 13px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: 'none',
                    background: modoImpressao === 'cartao_resposta' ? '#ffffff' : 'transparent',
                    color: modoImpressao === 'cartao_resposta' ? '#7e22ce' : '#64748b',
                    boxShadow: modoImpressao === 'cartao_resposta' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Cartão-Resposta
                </button>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '36px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  background: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                }}
              >
                <Printer size={15} />
                Imprimir / PDF
              </button>
            </div>
          </div>

          {/* Row 2: A4 Framing, Margins, Columns, Font & Image Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '8px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '11px'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
              <SlidersHorizontal size={13} color="#0284c7" />
              Enquadramento A4:
            </span>

            {/* Margens */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '3px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontWeight: 700 }}>Margens:</span>
              {(['estreita', 'padrao', 'ampla'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMargemPreset(m)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: margemPreset === m ? '#0284c7' : 'transparent',
                    color: margemPreset === m ? '#ffffff' : '#475569'
                  }}
                >
                  {m === 'estreita' ? 'Estreita' : m === 'padrao' ? 'Padrão' : 'Ampla'}
                </button>
              ))}
            </div>

            {/* Colunas */}
            {modoImpressao !== 'cartao_resposta' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '3px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Columns size={12} color="#64748b" />
                <span style={{ color: '#64748b', fontWeight: 700 }}>Colunas:</span>
                {([1, 2] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColunas(c)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '5px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: colunas === c ? '#0284c7' : 'transparent',
                      color: colunas === c ? '#ffffff' : '#475569'
                    }}
                  >
                    {c === 1 ? '1 Coluna' : '2 Colunas'}
                  </button>
                ))}
              </div>
            )}

            {/* Tamanho da Fonte */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '3px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Type size={12} color="#64748b" />
              <span style={{ color: '#64748b', fontWeight: 700 }}>Fonte:</span>
              {([
                { val: 11 as const, label: 'Compacta' },
                { val: 13 as const, label: 'Normal' },
                { val: 15 as const, label: 'Ampliada' },
              ]).map(f => (
                <button
                  key={f.val}
                  type="button"
                  onClick={() => setTamanhoFonte(f.val)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: tamanhoFonte === f.val ? '#0284c7' : 'transparent',
                    color: tamanhoFonte === f.val ? '#ffffff' : '#475569'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Limite de Imagem */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '3px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <ImageIcon size={12} color="#64748b" />
              <span style={{ color: '#64748b', fontWeight: 700 }}>Figuras:</span>
              {([
                { val: 150 as const, label: 'P' },
                { val: 250 as const, label: 'M' },
                { val: 380 as const, label: 'G' },
                { val: 900 as const, label: '100%' },
              ]).map(im => (
                <button
                  key={im.val}
                  type="button"
                  onClick={() => setLimiteAlturaImagem(im.val)}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '5px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: limiteAlturaImagem === im.val ? '#0284c7' : 'transparent',
                    color: limiteAlturaImagem === im.val ? '#ffffff' : '#475569'
                  }}
                >
                  {im.label}
                </button>
              ))}
            </div>

            {/* Linhas Dissertativas */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '3px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontWeight: 700 }}>Linhas Dissert.:</span>
              {([4, 6, 10, 14] as const).map(ln => (
                <button
                  key={ln}
                  type="button"
                  onClick={() => setLinhasDissertativa(ln)}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '5px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: linhasDissertativa === ln ? '#0284c7' : 'transparent',
                    color: linhasDissertativa === ln ? '#ffffff' : '#475569'
                  }}
                >
                  {ln}
                </button>
              ))}
            </div>

            {/* Guias de Margem A4 */}
            <button
              type="button"
              onClick={() => setMostrarGuiasMargem(prev => !prev)}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: '8px',
                border: mostrarGuiasMargem ? '1px solid #fb923c' : '1px solid #e2e8f0',
                background: mostrarGuiasMargem ? '#fff7ed' : '#f8fafc',
                color: mostrarGuiasMargem ? '#c2410c' : '#475569',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Maximize2 size={11} />
              {mostrarGuiasMargem ? 'Ocultar Guias A4' : 'Ver Guias de Margem'}
            </button>
          </div>
        </div>
      </header>

      {/* ── PRINTABLE SHEET CONTAINER (A4 STYLED) ── */}
      <main
        style={{
          maxWidth: '860px',
          margin: '24px auto',
          padding: marginConfig.screenPad,
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
          position: 'relative'
        }}
        className="printable-a4-sheet print:border-none print:shadow-none print:m-0 print:p-0"
      >
        {mostrarGuiasMargem && (
          <div
            className="no-print"
            style={{
              position: 'absolute',
              inset: marginConfig.screenPad,
              border: '1.5px dashed rgba(234, 88, 12, 0.55)',
              pointerEvents: 'none',
              zIndex: 20,
              borderRadius: '4px'
            }}
          >
            <span style={{
              position: 'absolute',
              top: '-18px',
              right: '8px',
              fontSize: '10px',
              fontWeight: 800,
              color: '#ea580c',
              background: '#fff7ed',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid #fed7aa'
            }}>
              Área Útil de Impressão A4 • Margem {marginConfig.label}
            </span>
          </div>
        )}
        {/* ── CABEÇALHO ESCOLAR OFICIAL ── */}
        <div style={{
          border: '2px solid #0f172a',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '14px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '18px'
              }}>
                IE
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 900, letterSpacing: '0.04em', color: '#0f172a', textTransform: 'uppercase' }}>
                  IMPACTO-EDU • COLÉGIO E CURSO
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                  SECRETARIA ACADÊMICA • AVALIAÇÃO OFICIAL
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 900,
                textTransform: 'uppercase',
                border: modoImpressao === 'professor'
                  ? '1px solid #86efac'
                  : modoImpressao === 'cartao_resposta'
                  ? '1px solid #c4b5fd'
                  : '1px solid #cbd5e1',
                background: modoImpressao === 'professor'
                  ? '#ecfdf5'
                  : modoImpressao === 'cartao_resposta'
                  ? '#f5f3ff'
                  : '#f8fafc',
                color: modoImpressao === 'professor'
                  ? '#065f46'
                  : modoImpressao === 'cartao_resposta'
                  ? '#5b21b6'
                  : '#1e293b'
              }}>
                {modoImpressao === 'professor'
                  ? 'Gabarito Oficial do Professor'
                  : modoImpressao === 'cartao_resposta'
                  ? 'Folha de Respostas / Cartão Óptico'
                  : 'Caderno de Prova do Aluno'}
              </span>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                Ano Letivo: {prova.anoLetivo || 2026} • {prova.bimestre ? `${prova.bimestre}º Bimestre` : '1º Bimestre'}
              </p>
            </div>
          </div>

          {/* Dados da Prova e do Estudante */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            fontSize: '12px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px',
            marginBottom: '14px'
          }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Avaliação:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{prova.titulo}</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Disciplina:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{prova.disciplinaNome || prova.disciplina}</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Professor(a):</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{prova.professorNome || 'Corpo Docente'}</span>
            </div>
          </div>

          {/* Campos de Preenchimento Manual para o Estudante */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '3fr 1.2fr 1fr 1.2fr',
            gap: '16px',
            fontSize: '12px',
            alignItems: 'end'
          }}>
            <div style={{ borderBottom: '1px solid #94a3b8', paddingBottom: '4px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block' }}>Nome do Aluno(a):</span>
              <span style={{ fontSize: '13px', color: '#0f172a' }}>&nbsp;</span>
            </div>
            <div style={{ borderBottom: '1px solid #94a3b8', paddingBottom: '4px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block' }}>Matrícula:</span>
              <span style={{ fontSize: '13px', color: '#0f172a' }}>&nbsp;</span>
            </div>
            <div style={{ borderBottom: '1px solid #94a3b8', paddingBottom: '4px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block' }}>Turma:</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{(prova.turmas || []).join(', ') || 'Turma'}</span>
            </div>
            <div style={{
              border: '2px solid #0f172a',
              borderRadius: '12px',
              padding: '6px',
              textAlign: 'center',
              background: '#f8fafc'
            }}>
              <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 900, color: '#475569', display: 'block' }}>Nota Final</span>
              <span style={{ fontSize: '16px', fontWeight: 900, fontFamily: 'monospace', color: '#0f172a' }}>
                [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
              </span>
              <span style={{ fontSize: '9px', color: '#64748b', display: 'block' }}>de {(prova.valorTotal || 10).toFixed(1)} pts</span>
            </div>
          </div>

          {/* Instruções */}
          {prova.instrucoes && modoImpressao !== 'cartao_resposta' && (
            <div style={{
              marginTop: '14px',
              paddingTop: '10px',
              borderTop: '1px solid #e2e8f0',
              fontSize: '11px',
              color: '#475569',
              lineHeight: 1.5
            }}>
              <strong>Orientações: </strong>
              {prova.instrucoes}
            </div>
          )}
        </div>

        {/* ── MODO 1 & 2: CADERNO DE QUESTÕES (ALUNO OU GABARITO PROFESSOR) ── */}
        {modoImpressao !== 'cartao_resposta' && (
          <div
            style={
              colunas === 2
                ? {
                    columnCount: 2,
                    columnGap: '20px',
                    columnRule: '1px solid #e2e8f0'
                  }
                : {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                  }
            }
          >
            {questoes.map((q: any, idx: number) => {
              const valor = q.valorPontos || q.pontuacao || 1.0
              const isObjSingle = q.tipo === 'multipla_escolha' || q.tipo === 'unica_escolha'
              const isObjMulti = q.tipo === 'multipla_selecao'
              const isVF = q.tipo === 'verdadeiro_falso'
              const isDissertativa = q.tipo === 'dissertativa'
              const vfItems = q.itensVF || q.itensVouF || []
              const explicacaoTexto = q.explicacaoResposta || q.explicacao

              return (
                <div
                  key={q.id || idx}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: colunas === 2 ? '14px' : '18px',
                    background: '#ffffff',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    marginBottom: colunas === 2 ? '16px' : '0'
                  }}
                >
                  {/* Questão Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '10px',
                    marginBottom: '12px',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '7px',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'monospace'
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {isObjSingle && 'Múltipla Escolha'}
                        {isObjMulti && 'Múltipla Seleção'}
                        {isVF && 'Verdadeiro ou Falso'}
                        {isDissertativa && 'Questão Dissertativa'}
                      </span>
                    </div>

                    <div style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#f1f5f9',
                      padding: '2px 9px',
                      borderRadius: '7px',
                      border: '1px solid #e2e8f0'
                    }}>
                      {valor.toFixed(1)} {valor === 1 ? 'pt' : 'pts'}
                    </div>
                  </div>

                  {/* Enunciado */}
                  <div style={{
                    fontSize: `${tamanhoFonte}px`,
                    color: '#0f172a',
                    lineHeight: 1.55,
                    marginBottom: '14px',
                    fontWeight: 500
                  }}>
                    <HtmlContent html={cleanQuestionStatementHtml(q.enunciado)} />
                  </div>

                  {/* Alternativas (Objetivas) */}
                  {(isObjSingle || isObjMulti) && q.alternativas && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '10px' }}>
                      {q.alternativas.map((alt: any, altIdx: number) => {
                        const letter = alt.letra || String.fromCharCode(65 + altIdx)
                        const isCorrect = alt.correta || q.gabaritoOficial === alt.id

                        return (
                          <div
                            key={alt.id || altIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: modoImpressao === 'professor' && isCorrect
                                ? '1.5px solid #86efac'
                                : '1px solid #e2e8f0',
                              background: modoImpressao === 'professor' && isCorrect
                                ? '#f0fdf4'
                                : '#f8fafc',
                              fontSize: `${tamanhoFonte}px`,
                              color: '#0f172a'
                            }}
                          >
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              border: modoImpressao === 'professor' && isCorrect
                                ? '1.5px solid #059669'
                                : '1.5px solid #94a3b8',
                              background: modoImpressao === 'professor' && isCorrect
                                ? '#059669'
                                : '#ffffff',
                              color: modoImpressao === 'professor' && isCorrect
                                ? '#ffffff'
                                : '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '11px',
                              flexShrink: 0
                            }}>
                              {letter}
                            </span>
                            <div style={{ paddingTop: '2px', flex: 1, minWidth: 0, wordBreak: 'break-word', lineHeight: 1.5 }}>
                              <HtmlContent html={cleanAlternativeText(alt.texto)} />
                              {modoImpressao === 'professor' && isCorrect && (
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  color: '#059669',
                                  textTransform: 'uppercase'
                                }}>
                                  [Resposta Correta]
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Verdadeiro ou Falso */}
                  {isVF && vfItems.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '10px' }}>
                      {vfItems.map((item: any, itIdx: number) => {
                        const correctVal = item.respostaCorreta ?? item.correta
                        const statementHtml = item.afirmacao || item.texto || ''
                        return (
                          <div
                            key={item.id || itIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: '1px solid #e2e8f0',
                              background: '#f8fafc',
                              fontSize: `${tamanhoFonte}px`,
                              gap: '10px'
                            }}
                          >
                            <div style={{ color: '#0f172a', flex: 1, minWidth: 0 }}>
                              <HtmlContent html={statementHtml} />
                            </div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '11px', flexShrink: 0 }}>
                              {modoImpressao === 'professor' ? (
                                <span style={{
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  background: '#ecfdf5',
                                  color: '#065f46',
                                  border: '1px solid #a7f3d0'
                                }}>
                                  Gabarito: {correctVal ? 'VERDADEIRO' : 'FALSO'}
                                </span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                                    <span style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1.5px solid #64748b', display: 'inline-block' }} /> (V)
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                                    <span style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1.5px solid #64748b', display: 'inline-block' }} /> (F)
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Dissertativa: Pauta para resposta ou espelho de correção */}
                  {isDissertativa && (
                    <div style={{ marginTop: '10px' }}>
                      {modoImpressao === 'aluno' ? (
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Espaço para Resposta do Estudante:
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '6px 0' }}>
                            {Array.from({ length: linhasDissertativa }).map((_, lineIdx) => (
                              <div key={lineIdx} style={{ borderBottom: '1px dashed #94a3b8', height: '14px' }} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          padding: '12px',
                          borderRadius: '10px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#065f46' }}>
                            <CheckCircle2 size={15} color="#059669" />
                            <span>Espelho de Correção / Resposta Esperada da Banca:</span>
                          </div>
                          <p style={{ margin: 0, color: '#334155', lineHeight: 1.55 }}>
                            {q.respostaEsperada || q.gabaritoOficial || 'Critério de pontuação atribuído pelo professor conforme argumentação, coerência e domínio do conteúdo.'}
                          </p>
                          {q.criteriosAvaliacao && q.criteriosAvaliacao.length > 0 && (
                            <div style={{ paddingTop: '8px', borderTop: '1px solid #bbf7d0' }}>
                              <span style={{ fontWeight: 800, color: '#065f46', display: 'block', marginBottom: '4px' }}>Critérios de Avaliação:</span>
                              <ul style={{ margin: 0, paddingLeft: '18px', color: '#475569' }}>
                                {q.criteriosAvaliacao.map((c: any, cIdx: number) => (
                                  <li key={cIdx}>
                                    {c.descricao} (até {c.pontosMaximos || c.pontos || 0} pts)
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Justificativa Pedagógica no modo Professor */}
                  {modoImpressao === 'professor' && explicacaoTexto && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      fontSize: '11px',
                      color: '#0369a1'
                    }}>
                      <strong>Comentário Pedagógico / Resolução: </strong>
                      {explicacaoTexto}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── MODO 3: FOLHA DE RESPOSTAS / CARTÃO ÓPTICO RÁPIDO ── */}
        {modoImpressao === 'cartao_resposta' && (
          <div style={{
            border: '2px solid #0f172a',
            borderRadius: '16px',
            padding: '24px',
            background: '#ffffff'
          }}>
            <div style={{
              textAlign: 'center',
              paddingBottom: '16px',
              borderBottom: '2px solid #0f172a',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0f172a' }}>
                Grade de Respostas para Preenchimento Óptico / Manual
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Preencha totalmente a bolha correspondente à alternativa escolhida utilizando caneta esferográfica azul ou preta.
              </p>
            </div>

            {/* Structured Optical Bubble Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '12px',
              marginBottom: '32px'
            }}>
              {questoes.map((q: any, idx: number) => {
                const isObj = q.tipo === 'multipla_escolha' || q.tipo === 'unica_escolha' || q.tipo === 'multipla_selecao'
                const isVF = q.tipo === 'verdadeiro_falso'
                const countOptions = q.alternativas ? q.alternativas.length : 5

                return (
                  <div
                    key={q.id || idx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 900,
                      fontSize: '13px',
                      color: '#0f172a',
                      minWidth: '28px'
                    }}>
                      {String(idx + 1).padStart(2, '0')}.
                    </span>

                    {isObj ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {Array.from({ length: countOptions }).map((_, altI) => (
                          <div
                            key={altI}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: '1.5px solid #64748b',
                              background: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              fontWeight: 800,
                              color: '#334155'
                            }}
                          >
                            {String.fromCharCode(65 + altI)}
                          </div>
                        ))}
                      </div>
                    ) : isVF ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>(V / F)</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8' }}>
                        Dissertativa
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Signature & Seal row */}
            <div style={{
              paddingTop: '20px',
              borderTop: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#475569',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <span>Assinatura do Aluno: _____________________________________________</span>
              </div>
              <div>
                <span>Visto do Fiscal: __________________</span>
              </div>
            </div>
          </div>
        )}

        {/* ── RODAPÉ ESCOLAR DE AUTENTICIDADE ── */}
        <div style={{
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#94a3b8',
          fontFamily: 'monospace',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <span>IMPACTO-EDU • Sistema de Gestão Escolar Integrada</span>
          <span>Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
          <span>Hash ID: {prova.id?.slice(0, 12)}</span>
        </div>
      </main>
    </div>
  )
}
