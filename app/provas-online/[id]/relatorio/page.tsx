'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ArrowLeft, Download, Printer, CheckCircle2,
  Users, BarChart3, TrendingUp, AlertTriangle, ArrowUpRight,
  RefreshCw, Check, Sparkles, HelpCircle, Layers, Scale,
  BookOpen, Calculator, Database, Shield, Award
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'

export default function RelatorioProvaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  // Tab: Geral vs Itens vs Alunos vs Ata Oficial
  const [activeTab, setActiveTab] = useState<'geral' | 'itens' | 'alunos' | 'ata'>('geral')

  // Search in student results
  const [studentSearch, setStudentSearch] = useState('')

  // Integration Modal
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false)
  const [selectedTurma, setSelectedTurma] = useState('')
  const [escalaAlvo, setEscalaAlvo] = useState(10.0)
  const [peso, setPeso] = useState(1.0)
  const [avaliacaoNome, setAvaliacaoNome] = useState('')
  const [tratarAusencias, setTratarAusencias] = useState<'zero' | 'sem_nota'>('sem_nota')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [integrationPreview, setIntegrationPreview] = useState<any>(null)
  const [committingIntegration, setCommittingIntegration] = useState(false)

  // Load Report Data
  const loadReport = async () => {
    if (!id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/provas-online/${id}/relatorio`)
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Erro ao carregar relatório da avaliação')

      setData(json)
      if (json.prova?.titulo && !avaliacaoNome) {
        setAvaliacaoNome(`Prova Online: ${json.prova.titulo}`)
      }
      if (json.prova?.turmas && json.prova.turmas.length > 0 && !selectedTurma) {
        setSelectedTurma(json.prova.turmas[0])
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao buscar relatório')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [id])

  // Load Integration Preview
  const handleLoadIntegrationPreview = async () => {
    setLoadingPreview(true)
    try {
      const q = new URLSearchParams({
        turmaId: selectedTurma,
        escala: String(escalaAlvo),
        peso: String(peso),
        avaliacaoNome: avaliacaoNome.trim()
      })
      const res = await fetch(`/api/provas-online/${id}/integrar-notas?${q.toString()}`)
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Erro ao carregar prévia do diário')

      setIntegrationPreview(json)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Commit Integration
  const handleCommitIntegration = async () => {
    setCommittingIntegration(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/integrar-notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turmaId: selectedTurma,
          escalaAlvo,
          peso,
          avaliacaoNome: avaliacaoNome.trim(),
          tratarAusencias
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao transferir notas para o diário')

      toast.success(`${json.notasLancadas || 'Notas'} lançadas no Diário de Notas com sucesso!`)
      setIntegrationModalOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCommittingIntegration(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    if (!data?.desempenhoAlunos) return

    const rows = [
      ['Nome do Aluno', 'Matrícula', 'Turma', 'Situação', 'Nota Objetiva', 'Nota Dissertativa', 'Nota Final', 'Aproveitamento (%)']
    ]

    data.desempenhoAlunos.forEach((a: any) => {
      rows.push([
        a.alunoNome,
        a.matricula || '',
        a.turma || '',
        a.status || '',
        String(a.notaObjetiva ?? ''),
        String(a.notaDissertativa ?? ''),
        String(a.notaFinal ?? ''),
        String(a.porcentagem ?? '')
      ])
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `relatorio_${data.prova?.titulo?.replace(/\s+/g, '_') || 'prova'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered student list
  const filteredStudents = useMemo(() => {
    if (!data?.desempenhoAlunos) return []
    return data.desempenhoAlunos.filter((s: any) =>
      s.alunoNome.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.matricula && s.matricula.includes(studentSearch))
    )
  }, [data?.desempenhoAlunos, studentSearch])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm font-semibold text-slate-700">Processando estatísticas da avaliação...</p>
      </div>
    )
  }

  const { prova, resumo, distribuicao, analiseQuestoes } = data || {}

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. TOP HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        paddingBottom: '24px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              href="/provas-online"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#334155',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                textDecoration: 'none'
              }}
            >
              <ArrowLeft size={16} />
            </Link>
            <span style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 800,
              background: '#eff6ff',
              color: '#0284c7',
              border: '1px solid #bae6fd',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {prova?.disciplina}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              Relatório Pedagógico & Integração
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {prova?.titulo}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Ata Oficial button */}
          <button
            type="button"
            onClick={() => setActiveTab('ata')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              background: activeTab === 'ata' ? '#0284c7' : '#ffffff',
              border: activeTab === 'ata' ? 'none' : '1px solid #cbd5e1',
              color: activeTab === 'ata' ? '#ffffff' : '#334155',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            <Award size={15} color={activeTab === 'ata' ? '#ffffff' : '#0284c7'} />
            Ata Oficial Escolar
          </button>

          {/* Contingency Paper Exam Link */}
          <Link
            href={`/provas-online/${id}/imprimir`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
            className="hover:bg-slate-50"
          >
            <BookOpen size={15} color="#64748b" />
            Caderno / Gabarito Impresso
          </Link>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={15} color="#64748b" />
            Exportar CSV
          </button>

          {/* Gradebook Integration Button */}
          <button
            type="button"
            onClick={() => {
              setIntegrationModalOpen(true)
              handleLoadIntegrationPreview()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 18px',
              borderRadius: '10px',
              background: '#10b981',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.28)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            <Database size={15} color="#ffffff" />
            Lançar no Diário de Notas
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* Taxa de Participação */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Participação
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {resumo?.taxaParticipacao}%
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {resumo?.totalParticipantes} de {resumo?.totalInscritos} alunos
          </span>
        </div>

        {/* Média da Turma */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Média da Turma
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={16} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0284c7', lineHeight: 1 }}>
            {resumo?.mediaGeral?.toFixed(2) || '0.00'}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Valor Total: {prova?.valorTotal} pts
          </span>
        </div>

        {/* Mediana */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Mediana
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={16} color="#64748b" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {resumo?.mediana?.toFixed(2) || '0.00'}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ponto central de notas</span>
        </div>

        {/* Maior Nota */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Maior Nota
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', lineHeight: 1 }}>
            {resumo?.notaMaxima?.toFixed(1) || '0.0'}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Melhor desempenho</span>
        </div>

        {/* Menor Nota */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Menor Nota
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#334155', lineHeight: 1 }}>
            {resumo?.notaMinima?.toFixed(1) || '0.0'}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Menor pontuação</span>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        padding: '3px',
        borderRadius: '12px',
        gap: '3px',
        width: 'fit-content'
      }}>
        {[
          { id: 'geral', label: 'Visão Geral & Distribuição' },
          { id: 'itens', label: `Análise por Questão (${analiseQuestoes?.length || 0})` },
          { id: 'alunos', label: `Notas dos Alunos (${data?.desempenhoAlunos?.length || 0})` },
          { id: 'ata', label: 'Ata Oficial de Aplicação' },
        ].map(t => {
          const isSelected = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '7px 16px',
                borderRadius: '9px',
                fontSize: '12px',
                fontWeight: isSelected ? 800 : 600,
                background: isSelected ? '#ffffff' : 'transparent',
                color: isSelected ? '#0284c7' : '#64748b',
                border: 'none',
                boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 4. TAB 1: VISÃO GERAL & HISTOGRAMA */}
      {activeTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Histogram Card (7 cols) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }} className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                Histograma de Distribuição de Notas
              </h3>
              <span className="text-xs text-slate-500 font-medium">Faixas de aproveitamento</span>
            </div>

            {/* Custom Bar Graph */}
            <div className="space-y-3 pt-2">
              {(distribuicao || []).map((item: any, idx: number) => {
                const total = resumo?.totalParticipantes || 1
                const pct = Math.round((item.quantidade / total) * 100)

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-700 font-semibold">{item.faixa}</span>
                      <span className="text-slate-500 font-mono">
                        {item.quantidade} aluno(s) ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                      <div
                        className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pedagogy Insights (5 cols) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} className="lg:col-span-5">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} color="#0284c7" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  Insights Pedagógicos
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Diagnóstico automatizado da avaliação</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Card 1: Aproveitamento Médio */}
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={16} color="#0284c7" />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Aproveitamento Médio
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#0c4a6e', lineHeight: 1.5 }}>
                  A turma atingiu uma média de <strong>{resumo?.mediaGeral || '0.0'} pontos</strong>. Cerca de {Math.round(((distribuicao?.[3]?.quantidade || 0) + (distribuicao?.[4]?.quantidade || 0)) / (resumo?.totalParticipantes || 1) * 100)}% dos alunos obtiveram notas na faixa superior a 6.0.
                </p>
              </div>

              {/* Card 2: Revisão Sugerida */}
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} color="#d97706" />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Revisão Pedagógica Sugerida
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#78350f', lineHeight: 1.5 }}>
                  Verifique as questões com taxa de acerto inferior a 50% na aba <strong>"Análise por Questão"</strong> para planejar intervenções e aulas de reforço com a turma.
                </p>
              </div>

              {/* Card 3: Integridade & Auditoria */}
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color="#475569" />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Integridade & Auditoria
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  Todas as tentativas, entregas e comprovantes digitais estão autenticados criptograficamente e vinculados à matrícula de cada estudante.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: ANÁLISE POR QUESTÃO (ITEM A ITEM) */}
      {activeTab === 'itens' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              Desempenho e Distratores por Questão
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-mono">
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Pontuação</th>
                    <th className="py-3 px-4">Taxa de Acerto</th>
                    <th className="py-3 px-4">Diagnóstico</th>
                    <th className="py-3 px-4">Distratores Mais Assinalados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(analiseQuestoes || []).map((q: any, idx: number) => {
                    const acerto = q.taxaAcerto || 0
                    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    let label = 'Fácil / Bem Compreendido'

                    if (acerto < 40) {
                      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200'
                      label = 'Crítica / Alto Índice de Erro'
                    } else if (acerto < 70) {
                      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200'
                      label = 'Atenção / Médio Acerto'
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">
                          #{idx + 1}
                        </td>
                        <td className="py-4 px-4 capitalize">
                          {q.tipo?.replace('_', ' ')}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          {q.valorPontos?.toFixed(1)} pts
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{acerto}%</span>
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  acerto >= 70 ? 'bg-emerald-500' : acerto >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${acerto}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          {q.distratores && q.distratores.length > 0 ? (
                            <span className="font-mono text-[11px]">
                              {q.distratores.map((d: any) => `${d.alternativa} (${d.escolhas})`).join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">--</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 3: NOTAS DOS ALUNOS */}
      {activeTab === 'alunos' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900">
              Relação Nominal de Resultados
            </h3>
            <input
              type="text"
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Filtrar por nome ou matrícula..."
              className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-mono">
                  <th className="py-3 px-4">Aluno</th>
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4">Turma</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Nota Objetiva</th>
                  <th className="py-3 px-4 text-right">Nota Dissertativa</th>
                  <th className="py-3 px-4 text-right">Nota Final</th>
                  <th className="py-3 px-4 text-right">Aproveitamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Nenhum aluno encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s: any) => (
                    <tr key={s.alunoId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {s.alunoNome}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {s.matricula || 'S/M'}
                      </td>
                      <td className="py-3.5 px-4">
                        {s.turma}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                          {s.status?.replace('_', ' ') || 'Entregue'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        {s.notaObjetiva !== undefined ? s.notaObjetiva.toFixed(1) : '--'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        {s.notaDissertativa !== undefined ? s.notaDissertativa.toFixed(1) : '--'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sky-700">
                        {s.notaFinal !== undefined ? s.notaFinal.toFixed(1) : '--'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                        {s.porcentagem !== undefined ? `${s.porcentagem}%` : '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB 4: ATA OFICIAL DE APLICAÇÃO DA AVALIAÇÃO */}
      {activeTab === 'ata' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          maxWidth: '900px',
          margin: '0 auto',
        }} className="print:border-none print:shadow-none print:p-0">
          {/* Header da Ata */}
          <div className="border-2 border-slate-900 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl">
                  IE
                </div>
                <div>
                  <h2 className="text-base font-black tracking-wide text-slate-900 uppercase">
                    IMPACTO-EDU • SISTEMA DE GESTÃO ESCOLAR
                  </h2>
                  <p className="text-xs text-slate-600 font-semibold">
                    ATA OFICIAL DE APLICAÇÃO E ENCERRAMENTO DE AVALIAÇÃO DIGITAL
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-md text-xs font-black uppercase bg-slate-100 text-slate-800 border border-slate-300">
                  Documento Oficial
                </span>
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Identificação Geral */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-slate-200 pb-4 mb-4">
              <div>
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Avaliação:</span>
                <span className="font-bold text-slate-900 text-sm">{prova?.titulo}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Disciplina:</span>
                <span className="font-bold text-slate-900 text-sm">{prova?.disciplina}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Turma(s):</span>
                <span className="font-bold text-slate-900 text-sm">{(prova?.turmas || []).join(', ') || 'Geral'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Professor Responsável:</span>
                <span className="font-bold text-slate-900 text-sm">{prova?.professorNome || 'Docente'}</span>
              </div>
            </div>

            {/* Quadro Estatístico da Ata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Esperados</span>
                <span className="text-xl font-black font-mono text-slate-900">{resumo?.totalParticipantes || 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Entregues / Presentes</span>
                <span className="text-xl font-black font-mono text-emerald-800">
                  {resumo?.totalEntregues || 0} ({resumo?.taxaParticipacao || 0}%)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-center">
                <span className="text-sky-700 block text-[10px] uppercase font-bold">Média da Turma</span>
                <span className="text-xl font-black font-mono text-sky-800">
                  {resumo?.mediaGeral?.toFixed(2) || '0.00'} pts
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <span className="text-amber-700 block text-[10px] uppercase font-bold">Maior / Menor Nota</span>
                <span className="text-xl font-black font-mono text-amber-800">
                  {resumo?.maiorNota?.toFixed(1) || '0.0'} / {resumo?.menorNota?.toFixed(1) || '0.0'}
                </span>
              </div>
            </div>

            {/* Texto Formal da Ata */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed mb-6">
              Aos <strong>{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>, 
              sob supervisão da Coordenação Pedagógica do IMPACTO-EDU, foi realizada e homologada a avaliação digital da disciplina de 
              <strong> {prova?.disciplina}</strong>. Constatou-se a participação efetiva de <strong>{resumo?.totalEntregues || 0}</strong> estudantes 
              do total de <strong>{resumo?.totalParticipantes || 0}</strong> matriculados, registrando uma taxa de adesão de <strong>{resumo?.taxaParticipacao || 0}%</strong>.
              As notas foram apuradas conforme os critérios regulamentares da instituição e encontram-se discriminadas na relação nominal abaixo.
            </div>

            {/* Tabela Nominal da Ata */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">Nº</th>
                    <th className="py-2.5 px-3">Estudante</th>
                    <th className="py-2.5 px-3">Matrícula</th>
                    <th className="py-2.5 px-3">Turma</th>
                    <th className="py-2.5 px-3 text-center">Situação</th>
                    <th className="py-2.5 px-3 text-right">Nota Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {(data?.desempenhoAlunos || []).map((aluno: any, idx: number) => (
                    <tr key={aluno.alunoId} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{aluno.alunoNome}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{aluno.matricula || 'S/M'}</td>
                      <td className="py-2 px-3">{aluno.turma}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                          {aluno.status?.replace('_', ' ') || 'Entregue'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-sm">
                        {aluno.notaFinal !== null && aluno.notaFinal !== undefined ? aluno.notaFinal.toFixed(1) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Termo de Assinaturas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-8 border-t-2 border-slate-900 text-center text-xs">
              <div>
                <div className="border-b border-slate-400 pb-1 mb-2 h-8" />
                <span className="font-bold text-slate-900 block">{prova?.professorNome || 'Professor(a) Titular'}</span>
                <span className="text-[10px] text-slate-500 uppercase">Professor(a) Aplicador(a)</span>
              </div>
              <div>
                <div className="border-b border-slate-400 pb-1 mb-2 h-8" />
                <span className="font-bold text-slate-900 block">Coordenação Pedagógica</span>
                <span className="text-[10px] text-slate-500 uppercase">Visto da Coordenação</span>
              </div>
              <div>
                <div className="border-b border-slate-400 pb-1 mb-2 h-8" />
                <span className="font-bold text-slate-900 block">Direção Escolar</span>
                <span className="text-[10px] text-slate-500 uppercase">Homologação da Direção</span>
              </div>
            </div>
          </div>

          {/* Action buttons (hidden on print) */}
          <div className="print:hidden flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Ata Oficial / Salvar PDF
            </button>
          </div>
        </div>
      )}

      {/* 7. MODAL: INTEGRAÇÃO COM O DIÁRIO DE NOTAS */}
      <AnimatePresence>
        {integrationModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '640px',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Transferir Notas para o Diário Oficial</h3>
                  <p className="text-xs text-slate-500">
                    Mapeia as notas computadas nas provas diretamente no módulo acadêmico de notas
                  </p>
                </div>
              </div>

              {/* Form Configs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Turma Destino:</label>
                  <select
                    value={selectedTurma}
                    onChange={e => setSelectedTurma(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  >
                    {(prova?.turmas || []).map((t: string) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Escala Alvo do Diário:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={escalaAlvo}
                    onChange={e => setEscalaAlvo(parseFloat(e.target.value) || 10)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-mono text-center focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tratar Ausências:</label>
                  <select
                    value={tratarAusencias}
                    onChange={e => setTratarAusencias(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  >
                    <option value="sem_nota">Manter em Branco</option>
                    <option value="zero">Atribuir Zero (0.0)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Avaliação no Diário:</label>
                <input
                  type="text"
                  value={avaliacaoNome}
                  onChange={e => setAvaliacaoNome(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Preview Button & Table */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLoadIntegrationPreview}
                  disabled={loadingPreview}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                >
                  {loadingPreview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5 text-sky-600" />}
                  Recarregar Prévia de Lançamento
                </button>
              </div>

              {integrationPreview && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 max-h-60 overflow-y-auto">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium pb-2 border-b border-slate-200">
                    <span>Aluno</span>
                    <span>Nota Convertida</span>
                  </div>
                  {(integrationPreview.linhas || []).map((row: any) => (
                    <div key={row.alunoId} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 truncate max-w-[280px]">{row.alunoNome}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {row.notaLancada !== null ? row.notaLancada.toFixed(1) : 'Em Branco'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIntegrationModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCommitIntegration}
                  disabled={committingIntegration}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {committingIntegration ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Confirmar Transferência para Diário
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
