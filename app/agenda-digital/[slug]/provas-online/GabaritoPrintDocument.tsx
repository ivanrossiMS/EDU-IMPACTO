'use client'

import React from 'react'
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Check,
  X,
  FileText,
  UserCheck,
  GraduationCap,
  BookOpen,
  Calendar,
  Clock,
  ShieldCheck
} from 'lucide-react'
import { HtmlContent } from '@/components/HtmlContent'
import { cleanAlternativeText } from '@/lib/provas-online/textSanitizer'

interface GabaritoPrintDocumentProps {
  prova: any
  aluno: any
  nomeEstudante: string
  resolvedAlunoId: string
  adConfig?: any
  isResponsavel?: boolean
}

export function GabaritoPrintDocument({
  prova,
  aluno,
  nomeEstudante,
  resolvedAlunoId,
  adConfig,
  isResponsavel
}: GabaritoPrintDocumentProps) {
  if (!prova) return null

  const activeProva = prova
  const tentativa = activeProva?.studentInfo?.ultimaTentativa
  const respostasObj = tentativa?.respostas || {}
  const notaFinal = Number(tentativa?.notaFinal ?? 0)
  const valorTotal = Number(activeProva?.valorTotal || 10)
  const aproveitamentoPct = Math.min(100, Math.max(0, Math.round((notaFinal / (valorTotal || 1)) * 100)))
  const questoesList: any[] = activeProva?.questoes || []

  // Performance classification
  const performanceStatus = aproveitamentoPct >= 90
    ? { label: 'Desempenho Excelente', color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' }
    : aproveitamentoPct >= 70
    ? { label: 'Bom Aproveitamento', color: '#065f46', bg: '#f0fdf4', border: '#86efac' }
    : aproveitamentoPct >= 50
    ? { label: 'Rendimento Regular', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc' }
    : { label: 'Abaixo da Média', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' }

  // Metrics counters
  let totalAcertos = 0
  let totalErros = 0
  let totalParciais = 0

  // Build quick answer matrix summary
  const questoesSummary = questoesList.map((q: any, idx: number) => {
    const resp = Array.isArray(respostasObj)
      ? respostasObj.find((r: any) => r?.questaoId === q.id)
      : (respostasObj[q.id] || null)

    const pontosQuestao = Number(q.pontuacao || q.valorPontos || 1)
    const pontosGanhos = Number(resp?.pontuacaoObtida ?? resp?.pontosAtribuidos ?? resp?.nota ?? 0)

    let situacao: 'correta' | 'incorreta' | 'parcial' | 'em_branco' = 'incorreta'
    let respostaAlunoStr = '-'
    let gabaritoOficialStr = '-'

    if (q.tipo === 'multipla_escolha') {
      const selectedAlt = (q.alternativas || []).find((alt: any) =>
        resp?.respostaOpcaoId === alt.id ||
        resp?.alternativaIdSelecionada === alt.id ||
        alt.id === resp?.respostaTexto ||
        alt.letra === resp?.respostaTexto
      )
      const correctAlt = (q.alternativas || []).find((alt: any) => alt.correta === true)
      respostaAlunoStr = selectedAlt?.letra || '-'
      gabaritoOficialStr = correctAlt?.letra || '-'

      if (selectedAlt && selectedAlt.id === correctAlt?.id) {
        situacao = 'correta'
        totalAcertos++
      } else if (selectedAlt) {
        situacao = 'incorreta'
        totalErros++
      } else {
        situacao = 'em_branco'
        totalErros++
      }
    } else if (q.tipo === 'verdadeiro_falso') {
      const itens = q.itensVF || q.itensVouF || []
      let vfAcertos = 0
      const respostasAlunoArr: string[] = []
      const gabaritoArr: string[] = []

      itens.forEach((item: any) => {
        const alunoChoice = resp?.respostaVF?.[item.id] !== undefined
          ? resp.respostaVF[item.id]
          : resp?.itensVouF?.find((i: any) => i.id === item.id)?.respostaAluno
        const correctChoice = item.correta !== undefined ? item.correta : item.afirmacao

        respostasAlunoArr.push(alunoChoice === true ? 'V' : alunoChoice === false ? 'F' : '-')
        gabaritoArr.push(correctChoice === true ? 'V' : 'F')

        if (alunoChoice !== undefined && alunoChoice === correctChoice) {
          vfAcertos++
        }
      })

      respostaAlunoStr = respostasAlunoArr.join(', ')
      gabaritoOficialStr = gabaritoArr.join(', ')

      if (itens.length > 0 && vfAcertos === itens.length) {
        situacao = 'correta'
        totalAcertos++
      } else if (vfAcertos > 0) {
        situacao = 'parcial'
        totalParciais++
      } else {
        situacao = 'incorreta'
        totalErros++
      }
    } else {
      // Dissertativa
      const hasText = Boolean(resp?.respostaDissertativa || resp?.textoDissertativo || resp?.respostaTexto)
      respostaAlunoStr = hasText ? 'Texto Enviado' : '(Sem Resposta)'
      gabaritoOficialStr = 'Critérios da Banca'

      if (pontosGanhos >= pontosQuestao && pontosQuestao > 0) {
        situacao = 'correta'
        totalAcertos++
      } else if (pontosGanhos > 0) {
        situacao = 'parcial'
        totalParciais++
      } else {
        situacao = 'incorreta'
        totalErros++
      }
    }

    return {
      q,
      idx,
      numero: q.numero || (idx + 1),
      tipo: q.tipo,
      pontosQuestao,
      pontosGanhos,
      situacao,
      respostaAlunoStr,
      gabaritoOficialStr,
      resp
    }
  })

  const studentName = aluno?.nome || nomeEstudante || 'Estudante'
  const studentMatricula = aluno?.matricula || resolvedAlunoId || '-'
  const studentTurma = aluno?.turma || aluno?.turma_nome || aluno?.serie || tentativa?.turma || (activeProva?.turmas && activeProva.turmas.length > 0 ? activeProva.turmas.join(', ') : 'Turma Regular')
  const examTitle = activeProva.titulo || 'Avaliação Online'
  const examDisciplina = activeProva.disciplina || 'Geral'
  const examProfessor = activeProva.professorNome ? `Prof. ${activeProva.professorNome}` : 'Corpo Docente'
  const entregaFormatada = tentativa?.entregueEm
    ? `${new Date(tentativa.entregueEm).toLocaleDateString('pt-BR')} às ${new Date(tentativa.entregueEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Submissão Eletrônica Homologada'
  const emissaoFormatada = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  const codigoAutenticidade = tentativa?.comprovanteCodigo || `GAB-${activeProva.id?.substring(0, 8).toUpperCase()}-${resolvedAlunoId}`

  return (
    <>
      {/* ── CSS EXCLUSIVO PARA IMPRESSÃO ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .ad-gabarito-print-sheet {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 10mm 10mm;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 10.5pt !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Oculta toda a interface interativa da Agenda Digital e do Modal da tela */
          .agenda-digital-wrapper,
          .ad-sidebar-container,
          .ad-main-scroll,
          .ad-content-inner,
          .ad-gabarito-modal-overlay,
          .ad-gabarito-modal-interactive,
          .no-print,
          button,
          nav, aside, header, footer,
          [data-sonner-toaster],
          ::-webkit-scrollbar {
            display: none !important;
            visibility: hidden !important;
          }

          /* Exibe exclusivamente o documento oficial de gabarito */
          .ad-gabarito-print-sheet {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }

          .ad-gabarito-print-sheet * {
            visibility: visible !important;
          }

          /* Proteção de quebra de página */
          .ad-gabarito-page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .ad-gabarito-page-break-before {
            break-before: page !important;
            page-break-before: always !important;
          }
        }
      `}} />

      {/* ── CORPO DO DOCUMENTO IMPRESSO (A4 ULTRA MODERNO) ── */}
      <div className="ad-gabarito-print-sheet">
        
        {/* Barra superior de acento visual (Navy & Esmeralda) */}
        <div style={{
          height: 5,
          background: 'linear-gradient(90deg, #0284c7 0%, #059669 100%)',
          borderRadius: 3,
          marginBottom: 12
        }} />

        {/* 1. CABEÇALHO ESCOLAR OFICIAL */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 12,
          borderBottom: '1.5px solid #0f172a',
          marginBottom: 14,
          gap: 16
        }}>
          {/* Logo e Nome da Instituição */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 16,
              flexShrink: 0
            }}>
              <GraduationCap size={24} color="#38bdf8" />
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: '0.04em',
                color: '#0f172a',
                textTransform: 'uppercase'
              }}>
                {adConfig?.instituicaoNome || 'IMPACTO-EDU • COLÉGIO E CURSO'}
              </h1>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#64748b',
                marginTop: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.02em'
              }}>
                SISTEMA INTEGRADO DE GESTÃO EDUCACIONAL • DEVOLUTIVA PEDAGÓGICA OFICIAL
              </div>
            </div>
          </div>

          {/* Badge do Documento */}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              background: '#ecfdf5',
              border: '1.2px solid #6ee7b7',
              color: '#047857',
              fontSize: 10.5,
              fontWeight: 900,
              textTransform: 'uppercase'
            }}>
              <ShieldCheck size={13} />
              Gabarito Oficial & Devolutiva
            </div>
            <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>
              Emissão: {emissaoFormatada}
            </div>
          </div>
        </div>

        {/* 2. CARTÃO DE IDENTIFICAÇÃO DO ESTUDANTE & DADOS DA AVALIAÇÃO */}
        <div className="ad-gabarito-page-break-avoid" style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 12,
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1.2px solid #cbd5e1',
          borderRadius: 12,
          marginBottom: 14
        }}>
          {/* Lado Esquerdo: Estudante */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Identificação do Estudante
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a' }}>
              {studentName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#334155' }}>
              <span><strong>Matrícula:</strong> {studentMatricula}</span>
              <span><strong>Turma / Série:</strong> {studentTurma}</span>
            </div>
          </div>

          {/* Lado Direito: Avaliação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '1px solid #e2e8f0', paddingLeft: 14 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Dados da Avaliação
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
              {examTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#334155' }}>
              <div><strong>Disciplina:</strong> {examDisciplina} • <strong>Docente:</strong> {examProfessor}</div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>
                <strong>Data de Entrega:</strong> {entregaFormatada}
              </div>
            </div>
          </div>
        </div>

        {/* 3. PAINEL EXECUTIVO DE DESEMPENHO (4 CARDS MODERNOS) */}
        <div className="ad-gabarito-page-break-avoid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 14
        }}>
          {/* Card 1: Nota Final */}
          <div style={{
            padding: '10px 12px',
            background: '#f8fafc',
            border: '1.2px solid #cbd5e1',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Pontuação Obtida
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#047857' }}>
                {notaFinal.toFixed(1)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                / {valorTotal.toFixed(1)} pts
              </span>
            </div>
            <div style={{
              marginTop: 4,
              fontSize: 9.5,
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 5,
              background: performanceStatus.bg,
              color: performanceStatus.color,
              border: `1px solid ${performanceStatus.border}`,
              display: 'inline-block',
              width: 'fit-content'
            }}>
              {performanceStatus.label}
            </div>
          </div>

          {/* Card 2: Aproveitamento % */}
          <div style={{
            padding: '10px 12px',
            background: '#f8fafc',
            border: '1.2px solid #cbd5e1',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Aproveitamento
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
              {aproveitamentoPct}%
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 4, background: '#e2e8f0', marginTop: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${aproveitamentoPct}%`,
                height: '100%',
                background: aproveitamentoPct >= 70 ? '#10b981' : aproveitamentoPct >= 50 ? '#0284c7' : '#ef4444',
                borderRadius: 4
              }} />
            </div>
          </div>

          {/* Card 3: Total de Questões */}
          <div style={{
            padding: '10px 12px',
            background: '#f8fafc',
            border: '1.2px solid #cbd5e1',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Total de Questões
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
              {questoesList.length}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
              {questoesSummary.filter(q => q.situacao !== 'em_branco').length} respondidas
            </div>
          </div>

          {/* Card 4: Distribuição de Desempenho */}
          <div style={{
            padding: '10px 12px',
            background: '#f8fafc',
            border: '1.2px solid #cbd5e1',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Acertos & Erros
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 6px',
                borderRadius: 5,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                fontSize: 10,
                fontWeight: 800
              }}>
                ✓ {totalAcertos} Acerto(s)
              </span>
              <span style={{
                padding: '2px 6px',
                borderRadius: 5,
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                fontSize: 10,
                fontWeight: 800
              }}>
                ✗ {totalErros} Erro(s)
              </span>
              {totalParciais > 0 && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: '#f0f9ff',
                  color: '#0369a1',
                  border: '1px solid #bae6fd',
                  fontSize: 10,
                  fontWeight: 800
                }}>
                  ~ {totalParciais} Parcial
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. MATRIZ SINTÉTICA DE GABARITO (ESPELHO RÁPIDO DE RESPOSTAS) */}
        {questoesSummary.length > 0 && (
          <div className="ad-gabarito-page-break-avoid" style={{
            border: '1.2px solid #cbd5e1',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 16
          }}>
            <div style={{
              padding: '8px 14px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Matriz Sintética de Respostas • Espelho Rápido
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                Conferência Instantânea
              </span>
            </div>

            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 10.5,
              textAlign: 'left'
            }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 800 }}>
                  <th style={{ padding: '6px 10px', width: '45px', textAlign: 'center' }}>Item</th>
                  <th style={{ padding: '6px 10px', width: '130px' }}>Tipo da Questão</th>
                  <th style={{ padding: '6px 10px', width: '110px', textAlign: 'center' }}>Sua Resposta</th>
                  <th style={{ padding: '6px 10px', width: '110px', textAlign: 'center' }}>Gabarito Oficial</th>
                  <th style={{ padding: '6px 10px', width: '85px', textAlign: 'center' }}>Pontos</th>
                  <th style={{ padding: '6px 10px', width: '100px', textAlign: 'center' }}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {questoesSummary.map((item, index) => {
                  const isEven = index % 2 === 0
                  const isCorrect = item.situacao === 'correta'
                  const isPartial = item.situacao === 'parcial'

                  return (
                    <tr
                      key={item.idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: isEven ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                        {item.numero < 10 ? `0${item.numero}` : item.numero}
                      </td>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>
                        {item.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : item.tipo === 'verdadeiro_falso' ? 'V ou F' : 'Dissertativa'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800 }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isCorrect ? '#ecfdf5' : isPartial ? '#eff6ff' : '#fef2f2',
                          color: isCorrect ? '#047857' : isPartial ? '#1d4ed8' : '#b91c1c',
                          border: `1px solid ${isCorrect ? '#a7f3d0' : isPartial ? '#bfdbfe' : '#fecaca'}`,
                          display: 'inline-block'
                        }}>
                          {item.respostaAlunoStr}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: '#f0fdf4',
                          border: '1px solid #86efac',
                          display: 'inline-block'
                        }}>
                          {item.gabaritoOficialStr}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>
                        {item.pontosGanhos} / {item.pontosQuestao}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isCorrect ? '#ecfdf5' : isPartial ? '#eff6ff' : '#fef2f2',
                          color: isCorrect ? '#047857' : isPartial ? '#1d4ed8' : '#b91c1c',
                          border: `1px solid ${isCorrect ? '#a7f3d0' : isPartial ? '#bfdbfe' : '#fecaca'}`
                        }}>
                          {isCorrect ? '✓ Correta' : isPartial ? '~ Parcial' : '✗ Incorreta'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. CADERNO DE QUESTÕES COM DEVOLUTIVA PEDAGÓGICA COMPLETA */}
        <div style={{ marginTop: 18 }}>
          {/* Título de Seção */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            background: '#f1f5f9',
            border: '1.2px solid #cbd5e1',
            borderRadius: 10,
            marginBottom: 14
          }}>
            <Award size={16} color="#0284c7" />
            <span style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Devolutiva Pedagógica Detalhada • Questão por Questão ({questoesList.length} itens)
            </span>
          </div>

          {questoesList.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 10 }}>
              Os critérios detalhados das questões desta avaliação não foram disponibilizados pela coordenação escolar.
            </div>
          ) : (
            questoesList.map((q: any, idx: number) => {
              const resp = Array.isArray(respostasObj)
                ? respostasObj.find((r: any) => r?.questaoId === q.id)
                : (respostasObj[q.id] || null)

              const pontosQuestao = Number(q.pontuacao || q.valorPontos || 1)
              const pontosGanhos = resp?.pontuacaoObtida ?? resp?.pontosAtribuidos ?? resp?.nota ?? 0
              const isCorrectTotal = pontosGanhos >= pontosQuestao && pontosQuestao > 0
              const isPartial = pontosGanhos > 0 && pontosGanhos < pontosQuestao

              return (
                <div
                  key={q.id || idx}
                  className="ad-gabarito-page-break-avoid"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1.2px solid #cbd5e1',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    marginBottom: 14
                  }}
                >
                  {/* Cabeçalho da Questão */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: 8,
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                        {q.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : q.tipo === 'verdadeiro_falso' ? 'Verdadeiro ou Falso' : 'Dissertativa'}
                      </span>
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        • Valor: {pontosQuestao} {pontosQuestao === 1 ? 'pt' : 'pts'}
                      </span>
                    </div>

                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: 8,
                      background: isCorrectTotal ? '#ecfdf5' : isPartial ? '#eff6ff' : '#fef2f2',
                      color: isCorrectTotal ? '#047857' : isPartial ? '#1d4ed8' : '#b91c1c',
                      border: `1px solid ${isCorrectTotal ? '#a7f3d0' : isPartial ? '#bfdbfe' : '#fecaca'}`
                    }}>
                      {isCorrectTotal ? `✓ Pontos: ${pontosGanhos} / ${pontosQuestao}` : isPartial ? `~ Pontos: ${pontosGanhos} / ${pontosQuestao}` : `✗ Pontos: ${pontosGanhos} / ${pontosQuestao}`}
                    </span>
                  </div>

                  {/* Enunciado da Questão */}
                  <div style={{ fontSize: 11, color: '#1e293b', lineHeight: 1.5 }}>
                    <HtmlContent html={q.enunciado} />
                  </div>

                  {/* Alternativas (Múltipla Escolha) */}
                  {q.tipo === 'multipla_escolha' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {(q.alternativas || []).map((alt: any) => {
                        const isSelected = resp?.respostaOpcaoId === alt.id ||
                          resp?.alternativaIdSelecionada === alt.id ||
                          alt.id === resp?.respostaTexto ||
                          alt.letra === resp?.respostaTexto

                        const isCorrect = alt.correta === true

                        let itemBg = '#f8fafc'
                        let itemBorder = '#e2e8f0'
                        let itemTextColor = '#334155'
                        let badgeText = ''
                        let badgeBg = ''
                        let badgeColor = ''
                        let badgeBorder = ''

                        if (isCorrect && isSelected) {
                          itemBg = '#ecfdf5'
                          itemBorder = '#6ee7b7'
                          itemTextColor = '#065f46'
                          badgeText = '✓ Resposta do Aluno • Correta'
                          badgeBg = '#d1fae5'
                          badgeColor = '#047857'
                          badgeBorder = '#a7f3d0'
                        } else if (isCorrect && !isSelected) {
                          itemBg = '#f0fdf4'
                          itemBorder = '#86efac'
                          itemTextColor = '#15803d'
                          badgeText = '★ Gabarito Oficial'
                          badgeBg = '#dcfce7'
                          badgeColor = '#15803d'
                          badgeBorder = '#bbf7d0'
                        } else if (!isCorrect && isSelected) {
                          itemBg = '#fef2f2'
                          itemBorder = '#fca5a5'
                          itemTextColor = '#991b1b'
                          badgeText = '✗ Resposta do Aluno (Incorreta)'
                          badgeBg = '#fee2e2'
                          badgeColor = '#b91c1c'
                          badgeBorder = '#fecaca'
                        }

                        return (
                          <div
                            key={alt.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: itemBg,
                              border: `1.2px solid ${itemBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                              <span style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: isSelected ? (isCorrect ? '#10b981' : '#ef4444') : (isCorrect ? '#22c55e' : '#e2e8f0'),
                                color: isSelected || isCorrect ? '#ffffff' : '#64748b',
                                fontSize: 10.5,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {alt.letra}
                              </span>
                              <div style={{ fontSize: 11, color: itemTextColor, fontWeight: isSelected || isCorrect ? 700 : 500 }}>
                                <HtmlContent html={cleanAlternativeText(alt.texto)} />
                              </div>
                            </div>

                            {badgeText && (
                              <span style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeBorder}`,
                                whiteSpace: 'nowrap'
                              }}>
                                {badgeText}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Itens Verdadeiro ou Falso */}
                  {q.tipo === 'verdadeiro_falso' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {(q.itensVF || q.itensVouF || []).map((item: any, itemIdx: number) => {
                        const alunoChoice = resp?.respostaVF?.[item.id] !== undefined
                          ? resp.respostaVF[item.id]
                          : resp?.itensVouF?.find((i: any) => i.id === item.id)?.respostaAluno

                        const correctChoice = item.correta !== undefined ? item.correta : item.afirmacao
                        const isMatch = alunoChoice !== undefined && alunoChoice === correctChoice

                        return (
                          <div
                            key={item.id || itemIdx}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: alunoChoice !== undefined ? (isMatch ? '#ecfdf5' : '#fef2f2') : '#f8fafc',
                              border: `1px solid ${alunoChoice !== undefined ? (isMatch ? '#86efac' : '#fca5a5') : '#e2e8f0'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10
                            }}
                          >
                            <div style={{ fontSize: 11, color: '#334155', flex: 1 }}>
                              <HtmlContent html={item.texto || item.afirmacao || `Item ${itemIdx + 1}`} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, fontSize: 10.5 }}>
                              <span style={{ color: '#475569' }}>
                                Aluno: <strong>{alunoChoice === true ? 'V' : alunoChoice === false ? 'F' : 'Em branco'}</strong>
                              </span>
                              <span style={{ color: '#059669', fontWeight: 800 }}>
                                Gabarito: <strong>{correctChoice === true ? 'V' : 'F'}</strong>
                              </span>
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: isMatch ? '#d1fae5' : '#fee2e2',
                                color: isMatch ? '#047857' : '#b91c1c',
                                fontWeight: 800,
                                fontSize: 9.5
                              }}>
                                {isMatch ? '✓ Acertou' : '✗ Errou'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Resposta Dissertativa */}
                  {q.tipo === 'dissertativa' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1'
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                          Resposta Escrita pelo Estudante:
                        </div>
                        <div style={{ fontSize: 11, color: '#0f172a', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {resp?.respostaDissertativa || resp?.textoDissertativo || resp?.respostaTexto || '(Nenhuma resposta escrita foi registrada)'}
                        </div>
                      </div>

                      {/* Comentário do Professor */}
                      {(resp?.comentarioProfessor || resp?.comentarioCorrecao) && (
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: '#fefce8',
                          border: '1px solid #fef08a'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>
                            <UserCheck size={13} color="#a16207" />
                            Comentário Pedagógico do Professor Corretor:
                          </div>
                          <div style={{ fontSize: 11, color: '#713f12', marginTop: 4, lineHeight: 1.45 }}>
                            {resp.comentarioProfessor || resp.comentarioCorrecao}
                          </div>
                        </div>
                      )}

                      {/* Critérios Esperados */}
                      {q.respostaEsperada && (
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe'
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                            Resposta Esperada / Critérios do Gabarito:
                          </div>
                          <div style={{ fontSize: 11, color: '#1e3a8a', marginTop: 4, lineHeight: 1.45 }}>
                            <HtmlContent html={q.respostaEsperada} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resolução Comentada */}
                  {q.explicacaoResposta && (
                    <div style={{
                      marginTop: 4,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                        <Sparkles size={13} color="#6366f1" />
                        <span>Resolução Comentada pelo Professor:</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.45 }}>
                        <HtmlContent html={q.explicacaoResposta} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* 6. RODAPÉ OFICIAL DE AUTENTICIDADE E VALIDAÇÃO */}
        <div className="ad-gabarito-page-break-avoid" style={{
          marginTop: 20,
          paddingTop: 12,
          borderTop: '1.2px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {/* Linhas de Assinatura e Carimbo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
            fontSize: 10,
            color: '#475569',
            gap: 20
          }}>
            <div style={{ flex: 1 }}>
              <div>Assinatura do Responsável / Estudante:</div>
              <div style={{ borderBottom: '1px solid #94a3b8', marginTop: 24, width: '90%' }} />
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div>Visto da Coordenação Pedagógica / Docente:</div>
              <div style={{ borderBottom: '1px solid #94a3b8', marginTop: 24, width: '90%', marginLeft: 'auto' }} />
            </div>
          </div>

          {/* Metadados Técnicos de Autenticidade */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9.5,
            color: '#64748b',
            background: '#f8fafc',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #e2e8f0'
          }}>
            <span>IMPACTO-EDU • Sistema Escolar Integrado</span>
            <span>Hash de Verificação: <strong style={{ fontFamily: 'monospace' }}>{codigoAutenticidade}</strong></span>
            <span>Documento emitido em {emissaoFormatada}</span>
          </div>
        </div>

      </div>
    </>
  )
}
