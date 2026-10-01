'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Printer, ArrowLeft, CheckCircle2, FileText,
  Eye, Check, BookOpen, AlertCircle, RefreshCw, Award
} from 'lucide-react'

export default function ImprimirProvaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [prova, setProva] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Modes: 'aluno' (sem gabarito) | 'professor' (com gabarito e critérios) | 'cartao_resposta' (folha óptica)
  const [modoImpressao, setModoImpressao] = useState<'aluno' | 'professor' | 'cartao_resposta'>('aluno')

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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-600">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm font-semibold">Preparando caderno para impressão escolar...</p>
      </div>
    )
  }

  if (error || !prova) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Não foi possível carregar a prova</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">{error || 'Prova não encontrada.'}</p>
        <Link
          href="/provas-online"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Provas Online
        </Link>
      </div>
    )
  }

  const questoes = prova.questoes || []

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900">
      {/* ── TOP CONTROL BAR (HIDDEN IN PRINT) ── */}
      <header className="print:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/provas-online"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                {prova.titulo}
              </h1>
              <p className="text-xs text-slate-500">
                {prova.disciplinaNome || prova.disciplina} • {questoes.length} questões • {(prova.valorTotal || 10).toFixed(1)} pts
              </p>
            </div>
          </div>

          {/* Mode Selector and Print Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setModoImpressao('aluno')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  modoImpressao === 'aluno'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Caderno do Aluno
              </button>
              <button
                type="button"
                onClick={() => setModoImpressao('professor')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  modoImpressao === 'professor'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gabarito Oficial
              </button>
              <button
                type="button"
                onClick={() => setModoImpressao('cartao_resposta')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  modoImpressao === 'cartao_resposta'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cartão-Resposta
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      </header>

      {/* ── PRINTABLE SHEET CONTAINER (A4 STYLED) ── */}
      <main className="max-w-4xl mx-auto my-6 print:my-0 p-8 sm:p-12 bg-white border border-slate-200 print:border-none shadow-sm print:shadow-none print:p-0">
        
        {/* ── CABEÇALHO ESCOLAR OFICIAL ── */}
        <div className="border-2 border-slate-900 rounded-2xl p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                IE
              </div>
              <div>
                <h2 className="text-base font-black tracking-wide text-slate-900 uppercase">
                  IMPACTO-EDU • COLÉGIO E CURSO
                </h2>
                <p className="text-[11px] text-slate-600 font-medium">
                  SECRETARIA ACADÊMICA • AVALIAÇÃO OFICIAL
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${
                modoImpressao === 'professor'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                  : modoImpressao === 'cartao_resposta'
                  ? 'bg-indigo-100 text-indigo-900 border-indigo-400'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}>
                {modoImpressao === 'professor'
                  ? 'Gabarito Oficial do Professor'
                  : modoImpressao === 'cartao_resposta'
                  ? 'Folha de Respostas / Cartão Óptico'
                  : 'Caderno de Prova do Aluno'}
              </span>
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                Ano Letivo: {prova.anoLetivo || 2026} • {prova.bimestre ? `${prova.bimestre}º Bimestre` : '1º Bimestre'}
              </p>
            </div>
          </div>

          {/* Dados da Prova e do Estudante */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-b border-slate-200 pb-3 mb-3">
            <div>
              <span className="text-slate-500 font-semibold block text-[10px] uppercase">Avaliação:</span>
              <span className="font-bold text-slate-900">{prova.titulo}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block text-[10px] uppercase">Disciplina:</span>
              <span className="font-bold text-slate-900">{prova.disciplinaNome || prova.disciplina}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block text-[10px] uppercase">Professor(a):</span>
              <span className="font-bold text-slate-900">{prova.professorNome || 'Corpo Docente'}</span>
            </div>
          </div>

          {/* Campos de Preenchimento Manual para o Estudante */}
          <div className="grid grid-cols-12 gap-3 text-xs items-end">
            <div className="col-span-12 sm:col-span-6 border-b border-slate-400 pb-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Nome do Aluno(a):</span>
              <span className="text-sm font-medium text-slate-800">____________________________________________________</span>
            </div>
            <div className="col-span-6 sm:col-span-2 border-b border-slate-400 pb-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Matrícula:</span>
              <span className="text-sm font-medium text-slate-800">_____________</span>
            </div>
            <div className="col-span-6 sm:col-span-2 border-b border-slate-400 pb-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Turma:</span>
              <span className="text-sm font-bold text-slate-900">{(prova.turmas || []).join(', ') || 'Turma'}</span>
            </div>
            <div className="col-span-12 sm:col-span-2 border-2 border-slate-900 rounded-xl p-2 text-center bg-slate-50">
              <span className="text-[9px] uppercase font-black text-slate-600 block">Nota Final</span>
              <span className="text-base font-black font-mono text-slate-900">
                [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
              </span>
              <span className="text-[9px] text-slate-500 block">de {(prova.valorTotal || 10).toFixed(1)} pts</span>
            </div>
          </div>

          {/* Instruções */}
          {prova.instrucoes && modoImpressao !== 'cartao_resposta' && (
            <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              <strong>Orientações: </strong>
              {prova.instrucoes}
              {prova.materiaisPermitidos && (
                <span className="block mt-0.5"><strong>Materiais autorizados: </strong>{prova.materiaisPermitidos}</span>
              )}
            </div>
          )}
        </div>

        {/* ── MODO 1 & 2: CADERNO DE QUESTÕES (ALUNO OU GABARITO PROFESSOR) ── */}
        {modoImpressao !== 'cartao_resposta' && (
          <div className="space-y-6">
            {questoes.map((q: any, idx: number) => {
              const valor = q.valorPontos || q.pontuacao || 1.0
              const isObjSingle = q.tipo === 'multipla_escolha' || q.tipo === 'unica_escolha'
              const isObjMulti = q.tipo === 'multipla_selecao'
              const isVF = q.tipo === 'verdadeiro_falso'
              const isDissertativa = q.tipo === 'dissertativa'

              return (
                <div
                  key={q.id || idx}
                  className="page-break-inside-avoid border border-slate-200 rounded-2xl p-4 sm:p-5 text-sm bg-white"
                  style={{ pageBreakInside: 'avoid' }}
                >
                  {/* Questão Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {isObjSingle && 'Múltipla Escolha'}
                        {isObjMulti && 'Múltipla Seleção'}
                        {isVF && 'Verdadeiro ou Falso'}
                        {isDissertativa && 'Questão Dissertativa'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                        {valor.toFixed(1)} {valor === 1 ? 'ponto' : 'pontos'}
                      </span>
                    </div>
                  </div>

                  {/* Enunciado */}
                  <div className="text-slate-800 leading-relaxed mb-4 font-normal text-xs sm:text-sm">
                    {q.enunciado}
                  </div>

                  {/* Alternativas (Objetivas) */}
                  {(isObjSingle || isObjMulti) && q.alternativas && (
                    <div className="space-y-2 mb-3">
                      {q.alternativas.map((alt: any, altIdx: number) => {
                        const letter = String.fromCharCode(65 + altIdx)
                        const isCorrect = alt.correta || q.gabaritoOficial === alt.id

                        return (
                          <div
                            key={alt.id || altIdx}
                            className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs sm:text-sm ${
                              modoImpressao === 'professor' && isCorrect
                                ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-950'
                                : 'bg-slate-50/50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full border flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                              modoImpressao === 'professor' && isCorrect
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white border-slate-300 text-slate-700'
                            }`}>
                              {letter}
                            </span>
                            <div className="pt-0.5 flex-1">
                              <span>{alt.texto}</span>
                              {modoImpressao === 'professor' && isCorrect && (
                                <span className="ml-2 text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
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
                  {isVF && q.itensVouF && (
                    <div className="space-y-2 mb-3">
                      {q.itensVouF.map((item: any, itIdx: number) => {
                        const correctVal = item.respostaCorreta ?? item.correta
                        return (
                          <div
                            key={item.id || itIdx}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs sm:text-sm ${
                              modoImpressao === 'professor'
                                ? 'bg-slate-50 border-slate-200'
                                : 'bg-slate-50/50 border-slate-200'
                            }`}
                          >
                            <span className="text-slate-800 pr-3">{item.texto}</span>
                            <div className="flex items-center gap-2 shrink-0 font-mono font-bold text-xs">
                              {modoImpressao === 'professor' ? (
                                <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  Gabarito: {correctVal ? 'VERDADEIRO' : 'FALSO'}
                                </span>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1 text-slate-600">
                                    <span className="w-4 h-4 rounded-full border-2 border-slate-400 inline-block" /> (V)
                                  </span>
                                  <span className="flex items-center gap-1 text-slate-600">
                                    <span className="w-4 h-4 rounded-full border-2 border-slate-400 inline-block" /> (F)
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
                    <div className="mt-3">
                      {modoImpressao === 'aluno' ? (
                        <div className="space-y-3 pt-2">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            Espaço para Resposta do Estudante:
                          </span>
                          <div className="space-y-4 py-2">
                            {[1, 2, 3, 4, 5, 6].map(line => (
                              <div key={line} className="border-b border-dashed border-slate-300 h-4" />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Espelho de Correção / Resposta Esperada da Banca:</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">
                            {q.respostaEsperada || q.gabaritoOficial || 'Critério de pontuação atribuído pelo professor conforme argumentação, coerência e domínio do conteúdo.'}
                          </p>
                          {q.criteriosAvaliacao && q.criteriosAvaliacao.length > 0 && (
                            <div className="pt-2 border-t border-emerald-200">
                              <span className="font-semibold text-emerald-950 block mb-1">Critérios de Avaliação:</span>
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
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
                  {modoImpressao === 'professor' && q.explicacao && (
                    <div className="mt-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950">
                      <strong>Comentário Pedagógico / Resolução: </strong>
                      {q.explicacao}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── MODO 3: FOLHA DE RESPOSTAS / CARTÃO ÓPTICO RÁPIDO ── */}
        {modoImpressao === 'cartao_resposta' && (
          <div className="border border-slate-300 rounded-2xl p-6 bg-white space-y-6">
            <div className="text-center pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Grade de Respostas para Preenchimento Óptico / Manual
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Preencha totalmente a bolha correspondente à alternativa escolhida utilizando caneta esferográfica azul ou preta.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {questoes.map((q: any, idx: number) => {
                const isObj = q.tipo === 'multipla_escolha' || q.tipo === 'unica_escolha' || q.tipo === 'multipla_selecao'
                const isVF = q.tipo === 'verdadeiro_falso'
                const countOptions = q.alternativas ? q.alternativas.length : 5

                return (
                  <div key={q.id || idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="font-mono font-bold text-xs w-6 text-slate-700">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>

                    {isObj ? (
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: countOptions }).map((_, altI) => (
                          <div
                            key={altI}
                            className="w-5 h-5 rounded-full border border-slate-400 bg-white flex items-center justify-center font-mono text-[10px] font-bold text-slate-600"
                          >
                            {String.fromCharCode(65 + altI)}
                          </div>
                        ))}
                      </div>
                    ) : isVF ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500">(V / F)</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Dissertativa</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Assinatura do Aluno: _____________________________________________</span>
              <span>Visto do Fiscal: __________________</span>
            </div>
          </div>
        )}

        {/* ── RODAPÉ ESCOLAR DE AUTENTICIDADE ── */}
        <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>IMPACTO-EDU • Sistema de Gestão Escolar Integrada</span>
          <span>Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
          <span>Hash ID: {prova.id?.slice(0, 12)}</span>
        </div>
      </main>
    </div>
  )
}
