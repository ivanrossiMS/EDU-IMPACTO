'use client'

import React from 'react'
import {
  ShieldCheck,
  Building2,
  User,
  GraduationCap,
  CalendarCheck,
  CheckCircle2,
  FileCheck2,
  QrCode,
  Sparkles,
  Award
} from 'lucide-react'

import { DeclaracaoIrpfData } from './declaracaoPdfGenerator'
export type { DeclaracaoIrpfData }

interface DeclaracaoIrpfDocumentProps {
  data: DeclaracaoIrpfData
  isPrintMode?: boolean
}

export function DeclaracaoIrpfDocument({ data }: DeclaracaoIrpfDocumentProps) {
  const {
    escola,
    responsavel,
    aluno,
    anoCalendario,
    exercicio,
    mensalidades,
    quantidadeMensalidades,
    totalPagoFormatado,
    totalPagoPorExtenso,
    codigoAutenticidade,
    cidadeDataEmissao,
  } = data

  return (
    <div className="declaracao-irpf-wrapper">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm 6mm 4mm 6mm !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Oculta tudo que não for o documento do IRPF */
          body > *:not([role="dialog"]),
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          div[role="dialog"] {
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            width: 100% !important;
            display: block !important;
          }

          div[role="dialog"] > div:first-child {
            display: none !important;
          }

          div[role="dialog"] > div:last-child {
            position: static !important;
            max-width: 100% !important;
            width: 100% !important;
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }

          .declaracao-irpf-wrapper {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }

          .declaracao-irpf-page {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            min-height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
          }

          .doc-content {
            width: 100% !important;
            box-sizing: border-box !important;
          }
        }

        .declaracao-irpf-page {
          width: 100%;
          max-width: 740px;
          margin: 0 auto;
          background: #ffffff;
          box-sizing: border-box;
          padding: 16px 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
        }

        .doc-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          flex: 1;
          justifyContent: space-between;
          width: 100%;
          box-sizing: border-box;
        }

        .irpf-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          margin-top: 4px;
          margin-bottom: 4px;
          font-size: 9px;
          box-sizing: border-box;
        }

        .irpf-table th {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 800;
          text-align: left;
          padding: 4px 6px;
          border: 1px solid #0f172a;
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          box-sizing: border-box;
        }

        .irpf-table td {
          padding: 3.5px 6px;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 9px;
          box-sizing: border-box;
          word-break: break-word;
        }

        .irpf-table tr:nth-child(even) td {
          background-color: #f8fafc;
        }
      `}</style>

      <div className="declaracao-irpf-page">
        <div className="doc-content">
          {/* ── 1. CABEÇALHO INSTITUCIONAL MODERNO (LOGO NO CANTO ESQUERDO) ────── */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                paddingBottom: 6,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              {/* Lado Esquerdo: Logo do Colégio Impacto + Slogan */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <img
                    src="/logo-impacto.png"
                    alt="Colégio Impacto"
                    style={{
                      height: '42px',
                      width: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>

                {/* Linha Divisória Vertical */}
                <div
                  style={{
                    width: '1.5px',
                    height: '34px',
                    background: '#e2e8f0',
                    flexShrink: 0,
                  }}
                />

                {/* Slogan Institucional e Segmentos */}
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                    Formando valores.
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: '#4f46e5', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                    Inspirando futuros.
                  </div>
                  <div style={{ fontSize: 7.5, color: '#64748b', fontWeight: 600, marginTop: 1, letterSpacing: 0.2 }}>
                    Educação Infantil • Ensino Fundamental • Ensino Médio
                  </div>
                </div>
              </div>

              {/* Lado Direito: Dados Fiscais da Escola */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: 7.5,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    color: '#4f46e5',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    padding: '1px 5px',
                    borderRadius: 4,
                    letterSpacing: 0.3,
                    marginBottom: 2,
                  }}
                >
                  Documento Fiscal Oficial
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                  {escola.razaoSocial}
                </div>
                <div style={{ fontSize: 8.5, color: '#334155', fontWeight: 700, marginTop: 1 }}>
                  CNPJ: <span style={{ fontFamily: 'monospace' }}>{escola.cnpj}</span>
                </div>
                <div style={{ fontSize: 7.5, color: '#64748b', marginTop: 1 }}>
                  {escola.endereco} • {escola.cidadeUf}
                </div>
              </div>
            </div>

            {/* Linha Divisória de Alta Precisão */}
            <div
              style={{
                width: '100%',
                height: '2px',
                background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 40%, #06b6d4 75%, #e2e8f0 100%)',
                marginBottom: 6,
                borderRadius: 2,
              }}
            />

            {/* ── 2. TÍTULO DO DOCUMENTO & EXERCÍCIO ──────────────────────────── */}
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <h1
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  margin: '0 0 4px 0',
                  lineHeight: 1.2,
                }}
              >
                Declaração de Pagamentos Efetuados para IRPF
              </h1>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '2px 8px',
                  borderRadius: 14,
                  fontSize: 8.5,
                  fontWeight: 700,
                  color: '#475569',
                }}
              >
                <span>Ano-Calendário: <strong style={{ color: '#0f172a' }}>{anoCalendario}</strong></span>
                <span>•</span>
                <span>Exercício Fiscal: <strong style={{ color: '#0f172a' }}>{exercicio}</strong></span>
              </div>

              <div style={{ fontSize: 7.5, color: '#94a3b8', marginTop: 1, fontStyle: 'italic' }}>
                (Em cumprimento à Lei Federal nº 12.007/2009 e normativas da Receita Federal do Brasil)
              </div>
            </div>

            {/* ── 3. DECK DE IDENTIFICAÇÃO FORMAL ─────────────────────────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 4,
                marginBottom: 5,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              {/* Box 1: Instituição de Ensino */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '5px 7px',
                  background: '#f8fafc',
                  fontSize: 8.5,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    fontSize: 7.5,
                    fontWeight: 900,
                    color: '#4f46e5',
                    textTransform: 'uppercase',
                    marginBottom: 1,
                    letterSpacing: 0.3,
                  }}
                >
                  1. Instituição de Ensino / Credora
                </div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 9 }}>
                  {escola.razaoSocial}
                </div>
                <div style={{ color: '#334155', marginTop: 1 }}>
                  <strong>CNPJ:</strong> <span style={{ fontFamily: 'monospace' }}>{escola.cnpj}</span>
                </div>
                <div style={{ color: '#64748b', fontSize: 7.5, marginTop: 1 }}>
                  {escola.endereco} • {escola.cidadeUf}
                </div>
              </div>

              {/* Box 2: Responsável Financeiro */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '5px 7px',
                  background: '#f8fafc',
                  fontSize: 8.5,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    fontSize: 7.5,
                    fontWeight: 900,
                    color: '#4f46e5',
                    textTransform: 'uppercase',
                    marginBottom: 1,
                    letterSpacing: 0.3,
                  }}
                >
                  2. Contribuinte / Responsável Financeiro
                </div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 9 }}>
                  {responsavel.nome}
                </div>
                <div style={{ color: '#334155', marginTop: 1 }}>
                  <strong>CPF:</strong> <span style={{ fontFamily: 'monospace' }}>{responsavel.cpf}</span>
                </div>
                <div style={{ color: '#64748b', fontSize: 7.5, marginTop: 1 }}>
                  Beneficiário(a): {aluno.nome}
                </div>
              </div>
            </div>

            {/* Box 3: Dados do Aluno */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '4px 7px',
                background: '#ffffff',
                fontSize: 8.5,
                marginBottom: 5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 4,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <div>
                <strong style={{ color: '#4f46e5' }}>ALUNO(A):</strong>{' '}
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{aluno.nome}</span>
              </div>
              <div>
                <strong style={{ color: '#475569' }}>MATRÍCULA:</strong>{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{aluno.matricula}</span>
              </div>
              <div>
                <strong style={{ color: '#475569' }}>TURMA / SÉRIE:</strong>{' '}
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{aluno.turma}</span>
              </div>
              <div>
                <strong style={{ color: '#475569' }}>SEGMENTO:</strong>{' '}
                <span style={{ fontWeight: 700 }}>{escola.segmento}</span>
              </div>
            </div>

            {/* ── 4. TEXTO DECLARATÓRIO FORMAL ───────────────────────────────── */}
            <p
              style={{
                fontSize: 10,
                lineHeight: 1.45,
                color: '#1e293b',
                textAlign: 'justify',
                margin: '0 0 4px 0',
              }}
            >
              Declaramos, para os devidos fins de comprovação de despesas com instrução junto à{' '}
              <strong>Secretaria Especial da Receita Federal do Brasil (Declaração de Ajuste Anual de IRPF)</strong> e
              em cumprimento aos termos da <strong>Lei Federal nº 12.007, de 29 de julho de 2009</strong>, que o(a)
              responsável financeiro acima qualificado(a) efetuou a quitação das mensalidades escolares
              relacionadas abaixo dos serviços educacionais prestados ao(à) aluno(a) durante o ano-calendário de{' '}
              <strong>{anoCalendario}</strong>, conforme discriminado a seguir:
            </p>

            {/* ── 5. TABELA DE MENSALIDADES PAGAS ────────────────────────────── */}
            {quantidadeMensalidades > 0 ? (
              <table className="irpf-table">
                <thead>
                  <tr>
                    <th style={{ width: '4%', textAlign: 'center' }}>#</th>
                    <th style={{ width: '17%' }}>Competência</th>
                    <th style={{ width: '38%' }}>Descrição do Serviço</th>
                    <th style={{ width: '13%', textAlign: 'center' }}>Vencimento</th>
                    <th style={{ width: '13%', textAlign: 'center' }}>Data Pagto</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Valor Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {mensalidades.map((m) => (
                    <tr key={m.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{m.index}</td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{m.competencia}</td>
                      <td style={{ color: '#475569' }}>{m.descricao}</td>
                      <td style={{ textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>{m.vencimento}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                        {m.dataPagamento}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                        {m.valorPago}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9' }}>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: 'right',
                        padding: '4px 6px',
                        fontWeight: 900,
                        color: '#0f172a',
                        fontSize: 9,
                        borderTop: '2px solid #0f172a',
                      }}
                    >
                      Total de mensalidades pagas em {anoCalendario}:
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '4px 6px',
                        fontWeight: 900,
                        color: '#4f46e5',
                        fontSize: 10.5,
                        borderTop: '2px solid #0f172a',
                        fontFamily: 'monospace',
                      }}
                    >
                      {totalPagoFormatado}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div
                style={{
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: 6,
                  padding: '8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: 9,
                  margin: '5px 0',
                  background: '#f8fafc',
                }}
              >
                Não constam registros de mensalidades escolares pagas para este aluno no ano-calendário de {anoCalendario}.
              </div>
            )}

            {/* ── 6. VALOR POR EXTENSO & INDICAÇÃO LEGAL ─────────────────────── */}
            {quantidadeMensalidades > 0 && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  padding: '3px 6px',
                  fontSize: 8.5,
                  marginBottom: 4,
                  color: '#334155',
                  boxSizing: 'border-box',
                }}
              >
                <strong>Valor Total por Extenso:</strong> {totalPagoPorExtenso}.
              </div>
            )}

            {/* Indicação obrigatória */}
            <div
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: '#64748b',
                fontStyle: 'italic',
                marginBottom: 5,
                textAlign: 'left',
              }}
            >
              * Este documento não representa quitação integral do contrato.
            </div>

            {/* ── 7. FECHAMENTO E DATA ───────────────────────────────────────── */}
            <p
              style={{
                fontSize: 8.5,
                lineHeight: 1.25,
                color: '#1e293b',
                margin: '0 0 4px 0',
                textAlign: 'justify',
              }}
            >
              Por ser a expressão da verdade e para que produza seus regulares efeitos legais e fiscais, firmamos a presente declaração.
            </p>

            <div style={{ textAlign: 'right', fontSize: 9, color: '#334155', marginBottom: 6, fontWeight: 700 }}>
              {cidadeDataEmissao}
            </div>

            {/* ── 8. ASSINATURA & CARIMBO DIGITAL ────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 10,
                marginBottom: 6,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              {/* Selo de Autenticidade Digital */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '4px 6px',
                  background: '#fafbfc',
                  fontSize: 7.5,
                  color: '#64748b',
                  maxWidth: '240px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, color: '#4f46e5', marginBottom: 1 }}>
                  <ShieldCheck size={11} color="#4f46e5" />
                  <span>Autenticidade e Controle Fiscal</span>
                </div>
                <div>
                  Código: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{codigoAutenticidade}</strong>
                </div>
                <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>
                  Emitido eletronicamente via Sistema Impacto EDU.
                </div>
              </div>

              {/* Assinatura Direção / Tesouraria */}
              <div style={{ textAlign: 'center', minWidth: '200px', position: 'relative' }}>
                {/* Assinatura Feita à Mão de Ivan Rossi */}
                <div style={{ marginBottom: '-6px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg
                    viewBox="0 0 260 70"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      height: '36px',
                      width: 'auto',
                      transform: 'rotate(-2deg)',
                    }}
                  >
                    {/* I Maiúsculo com laço e floreio */}
                    <path
                      d="M20 45 C28 20, 38 8, 42 28 C45 42, 38 52, 32 40 C28 28, 38 18, 54 34 L62 44"
                      stroke="#1d4ed8"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="30" cy="14" r="1.6" fill="#1d4ed8" />
                    {/* van */}
                    <path
                      d="M62 40 L68 30 L74 42 L80 32 C84 30, 88 30, 92 36 L92 44 C95 34, 102 30, 108 42 L114 42"
                      stroke="#1d4ed8"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* R Maiúsculo cursivo com laço */}
                    <path
                      d="M126 48 C124 30, 128 12, 136 10 C146 8, 160 12, 154 26 C150 36, 138 36, 130 36 C138 36, 150 40, 158 48"
                      stroke="#1d4ed8"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* ossi com ligaduras */}
                    <path
                      d="M160 38 C164 32, 172 32, 170 40 C168 46, 160 46, 164 38 C168 32, 178 34, 182 42 C186 34, 192 34, 194 42 C196 32, 202 34, 206 42"
                      stroke="#1d4ed8"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="206" cy="24" r="1.5" fill="#1d4ed8" />
                    {/* Floreio final da caneta tinteiro */}
                    <path
                      d="M115 52 C145 46, 195 45, 235 48"
                      stroke="#1d4ed8"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Linha de Assinatura */}
                <div
                  style={{
                    borderTop: '1.5px solid #0f172a',
                    paddingTop: 2,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  Ivan Rossi
                </div>
                <div style={{ fontSize: 8, color: '#475569', fontWeight: 700 }}>
                  Direção Geral e Controladoria
                </div>
                <div style={{ fontSize: 7.5, color: '#64748b' }}>{escola.razaoSocial}</div>
                <div style={{ fontSize: 7, color: '#94a3b8' }}>CNPJ: {escola.cnpj}</div>
              </div>
            </div>
          </div>

          {/* ── 9. RODAPÉ INSTITUCIONAL OFICIAL ────────────────────────────── */}
          <div
            style={{
              borderTop: '1.5px solid #e2e8f0',
              paddingTop: 4,
              textAlign: 'center',
              fontSize: 7.5,
              color: '#64748b',
              lineHeight: 1.3,
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            <div style={{ fontWeight: 700, color: '#334155' }}>
              {escola.nomeFantasia} — {escola.segmento}
            </div>
            <div>
              Rua Alagoas, 1081 - Jardim dos Estados, Campo Grande/MS • Tel: (67) 3025-5585 • impacto@colegioimpacto.net • www.colegioimpacto.net
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
