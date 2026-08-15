'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Search,
  Download,
  Printer,
  RefreshCw,
  Copy,
  Check,
  User,
  GraduationCap,
  Calendar,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronDown,
  X,
  FileCheck2,
  Sparkles,
  Layers,
  ArrowRight,
  Filter,
  DollarSign,
  Receipt,
  Eye,
  Info,
  SlidersHorizontal,
  ExternalLink,
  BookOpen,
  Phone,
  Mail,
  CreditCard,
  UserCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { DeclaracaoIrpfDocument, DeclaracaoIrpfData } from '@/app/agenda-digital/components/DeclaracaoIrpfDocument'
import { generateDeclaracaoHtml } from '@/app/agenda-digital/components/declaracaoHtmlGenerator'
import { generateDeclaracaoPdf } from '@/app/agenda-digital/components/declaracaoPdfGenerator'

interface TurmaInfo {
  id: string
  codigo?: string
  nome: string
  serie?: string
  turno?: string
  ano?: number
}

interface StudentSummary {
  id: string
  nome: string
  matricula?: string
  turma?: string
  turmaNome?: string
  foto?: string | null
  anoLetivo?: string
  status?: string
  responsavelNome?: string
  responsaveis?: any[]
}

interface ResponsavelSummary {
  id: string
  nome: string
  cpf: string
  email?: string
  telefone?: string
  parentesco?: string
  isFinanceiro?: boolean
  alunosVinculados?: Array<{
    id?: string
    aluno_id?: string
    nome?: string
    matricula?: string
    turma?: string
  }>
}

interface ResponsavelOption {
  id: string
  nome: string
  cpf: string
  email?: string
  telefone?: string
  parentesco?: string
  isFinanceiro?: boolean
}

interface ExtendedDeclaracaoData extends DeclaracaoIrpfData {
  responsaveisDisponiveis?: ResponsavelOption[]
  alunosDisponiveis?: Array<{
    id: string
    nome: string
    matricula?: string
    turma?: string
    foto?: string | null
  }>
}

const ANOS_DISPONIVEIS = ['2026', '2025', '2024', '2023', '2022']

function formatCPF(cpf?: string | null): string {
  if (!cpf) return ''
  const digits = String(cpf).replace(/\D/g, '')
  if (digits.length !== 11) return String(cpf)
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export default function DeclaracaoIrpfAdminPage() {
  // ── 1. Estados de Turmas (Mapeamento de Nomes vs Códigos) ──────────────────
  const [turmasList, setTurmasList] = useState<TurmaInfo[]>([])
  const [loadingTurmas, setLoadingTurmas] = useState(false)

  // ── 2. Estados de Busca e Filtros ──────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<'todos' | 'alunos' | 'responsaveis'>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTurmaFilter, setSelectedTurmaFilter] = useState<string>('todas')

  // Listas de resultados de busca
  const [studentsResults, setStudentsResults] = useState<StudentSummary[]>([])
  const [responsaveisResults, setResponsaveisResults] = useState<ResponsavelSummary[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)

  // ── 3. Aluno, Responsável e Ano Selecionados ────────────────────────────────
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null)
  const [selectedResponsavel, setSelectedResponsavel] = useState<ResponsavelSummary | null>(null)
  const [selectedAno, setSelectedAno] = useState<string>('2026')
  const [selectedResponsavelId, setSelectedResponsavelId] = useState<string | null>(null)

  // ── 4. Dados da Declaração ────────────────────────────────────────────────
  const [docData, setDocData] = useState<ExtendedDeclaracaoData | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)

  // ── 5. Modos de Visualização & Ações ───────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'document' | 'table'>('document')
  const [savingPdf, setSavingPdf] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const searchContainerRef = useRef<HTMLDivElement>(null)

  // ── Helper: Mapa de ID/Código de Turma -> Nome Formatado ────────────────────
  const turmaMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of turmasList) {
      if (t.id && t.nome) map.set(String(t.id).trim(), t.nome)
      if (t.codigo && t.nome) map.set(String(t.codigo).trim(), t.nome)
    }
    return map
  }, [turmasList])

  const getTurmaNome = useCallback(
    (rawTurma?: string | null): string => {
      if (!rawTurma) return 'Sem turma'
      const key = String(rawTurma).trim()
      if (turmaMap.has(key)) return turmaMap.get(key)!
      if (/^\d+$/.test(key)) {
        const found = turmasList.find((t) => String(t.id) === key || String(t.codigo) === key)
        if (found?.nome) return found.nome
      }
      return rawTurma
    },
    [turmaMap, turmasList]
  )

  // ── Carregar Lista Completa de Turmas para Mapeamento ───────────────────────
  useEffect(() => {
    const fetchTurmas = async () => {
      setLoadingTurmas(true)
      try {
        const res = await fetch('/api/turmas?all=true')
        if (res.ok) {
          const json = await res.json()
          const list: TurmaInfo[] = json.data || json || []
          setTurmasList(list)
        }
      } catch (err) {
        console.error('[IRPF Admin] Erro ao carregar turmas:', err)
      } finally {
        setLoadingTurmas(false)
      }
    }
    fetchTurmas()
  }, [])

  // ── Debounce de busca ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 250)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // ── Fechar dropdown ao clicar fora ─────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Carregar Alunos e Responsáveis para o Autocomplete (Mínimo 3 Caracteres) ───
  const performSearch = useCallback(
    async (query = '') => {
      const cleanQuery = query.trim()
      if (cleanQuery.length < 3) {
        setStudentsResults([])
        setResponsaveisResults([])
        setLoadingSearch(false)
        return
      }

      setLoadingSearch(true)

      try {
        const promises: Promise<any>[] = []

        // Busca Alunos
        if (searchMode === 'todos' || searchMode === 'alunos') {
          const studentParams = new URLSearchParams()
          studentParams.append('search', cleanQuery)
          studentParams.append('limit', '30')
          promises.push(
            fetch(`/api/alunos/lightweight?${studentParams.toString()}`)
              .then((r) => (r.ok ? r.json() : { data: [] }))
              .catch(() => ({ data: [] }))
          )
        } else {
          promises.push(Promise.resolve({ data: [] }))
        }

        // Busca Responsáveis
        if (searchMode === 'todos' || searchMode === 'responsaveis') {
          const respParams = new URLSearchParams()
          respParams.append('search', cleanQuery)
          respParams.append('limit', '30')
          promises.push(
            fetch(`/api/responsaveis?${respParams.toString()}`)
              .then((r) => (r.ok ? r.json() : { data: [] }))
              .catch(() => ({ data: [] }))
          )
        } else {
          promises.push(Promise.resolve({ data: [] }))
        }

        const [studentsRes, responsaveisRes] = await Promise.all(promises)

        const rawStudents: StudentSummary[] = studentsRes.data || []
        const formattedStudents = rawStudents.map((s) => ({
          ...s,
          turmaNome: getTurmaNome(s.turma),
          responsavelNome:
            s.responsaveis?.[0]?.nome || (s as any).responsavel || (s as any).responsavelFinanceiro || undefined,
        }))
        setStudentsResults(formattedStudents)

        const rawResponsaveis: ResponsavelSummary[] = responsaveisRes.data || []
        setResponsaveisResults(rawResponsaveis)
      } catch (err) {
        console.error('[IRPF Admin] Erro na busca:', err)
      } finally {
        setLoadingSearch(false)
      }
    },
    [searchMode, getTurmaNome]
  )

  useEffect(() => {
    if (debouncedSearch.trim().length >= 3) {
      performSearch(debouncedSearch)
    } else {
      setStudentsResults([])
      setResponsaveisResults([])
      setLoadingSearch(false)
    }
  }, [debouncedSearch, performSearch])

  // ── Filtrar Alunos por Turma ───────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    if (selectedTurmaFilter === 'todas') return studentsResults
    return studentsResults.filter(
      (s) =>
        s.turma === selectedTurmaFilter ||
        s.turmaNome === selectedTurmaFilter ||
        String(s.turma).toLowerCase().includes(selectedTurmaFilter.toLowerCase())
    )
  }, [studentsResults, selectedTurmaFilter])

  // ── Buscar Declaração Consolidada no Isaac ───────────────────────────────────
  const fetchDeclaracao = useCallback(
    async (student: StudentSummary | null, resp: ResponsavelSummary | null, ano: string, respId?: string | null) => {
      if (!student && !resp) return

      setLoadingDoc(true)
      setDocError(null)

      try {
        const params = new URLSearchParams({ ano })

        if (student?.id) params.append('alunoId', student.id)
        if (student?.nome) params.append('alunoNome', student.nome)

        const finalRespId = respId || resp?.id
        if (finalRespId) params.append('responsavelId', finalRespId)
        if (resp?.cpf) params.append('responsavelCpf', resp.cpf)

        const res = await fetch(`/api/isaac/declaracao-irpf?${params.toString()}`)
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error || 'Não foi possível carregar os dados financeiros do aluno no Isaac.')
        }

        setDocData(json)

        // Se o backend retornou responsáveis disponíveis e ainda não selecionamos um
        if (json.responsaveisDisponiveis && json.responsaveisDisponiveis.length > 0 && !respId) {
          const matched = json.responsaveisDisponiveis.find((r: ResponsavelOption) => r.isFinanceiro) || json.responsaveisDisponiveis[0]
          if (matched) {
            setSelectedResponsavelId(matched.id)
          }
        }
      } catch (err: any) {
        console.error('[IRPF Admin] Erro ao gerar declaração:', err)
        setDocError(err.message || 'Erro ao conectar à API Isaac.')
        setDocData(null)
      } finally {
        setLoadingDoc(false)
      }
    },
    []
  )

  // Disparar busca quando o Aluno, Responsável, Ano ou Responsável Titular mudar
  useEffect(() => {
    if (selectedStudent || selectedResponsavel) {
      fetchDeclaracao(selectedStudent, selectedResponsavel, selectedAno, selectedResponsavelId)
    }
  }, [selectedStudent, selectedResponsavel, selectedAno, selectedResponsavelId, fetchDeclaracao])

  // ── Selecionar um Aluno ────────────────────────────────────────────────────
  const handleSelectStudent = (student: StudentSummary) => {
    setSelectedStudent(student)
    setSelectedResponsavelId(null)
    setSearchTerm(student.nome)
    setSearchDropdownOpen(false)
  }

  // ── Selecionar um Responsável ──────────────────────────────────────────────
  const handleSelectResponsavel = (resp: ResponsavelSummary) => {
    setSelectedResponsavel(resp)
    setSelectedResponsavelId(resp.id)
    setSearchTerm(resp.nome)
    setSearchDropdownOpen(false)

    // Se o responsável possui alunos vinculados, seleciona o primeiro
    const linked = resp.alunosVinculados || []
    if (linked.length > 0 && linked[0]) {
      const firstAluno = linked[0]
      setSelectedStudent({
        id: String(firstAluno.id || firstAluno.aluno_id),
        nome: firstAluno.nome || 'Aluno',
        matricula: firstAluno.matricula,
        turma: firstAluno.turma,
        turmaNome: getTurmaNome(firstAluno.turma),
      })
    } else {
      setSelectedStudent(null)
    }
  }

  // ── Limpar Seleção Atual ───────────────────────────────────────────────────
  const handleClearSelection = () => {
    setSelectedStudent(null)
    setSelectedResponsavel(null)
    setSelectedResponsavelId(null)
    setDocData(null)
    setDocError(null)
    setSearchTerm('')
  }

  // ── Download do PDF Oficial Vetorial ───────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!docData) return
    setSavingPdf(true)

    try {
      const pdfBytes = await generateDeclaracaoPdf(docData)
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const safeName = (docData.aluno.nome || 'Aluno').replace(/\s+/g, '_')
      const fileName = `Declaracao_IRPF_${docData.anoCalendario}_${safeName}.pdf`

      const isMobile =
        typeof navigator !== 'undefined' &&
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')

      let shared = false
      if (isMobile && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try {
          const file = new File([blob], fileName, { type: 'application/pdf' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Declaração IRPF ${docData.anoCalendario} - ${docData.aluno.nome}`,
              text: `Comprovante de Quitação Anual de Mensalidades - ${docData.aluno.nome}`,
            })
            shared = true
            toast.success('Declaração compartilhada com sucesso!')
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            setSavingPdf(false)
            return
          }
        }
      }

      if (!shared) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a)
          }
          URL.revokeObjectURL(url)
        }, 1500)

        toast.success('Declaração em PDF gerada com sucesso!')
      }
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err)
      toast.error('Erro ao gerar PDF: ' + (err.message || 'Falha desconhecida'))
    } finally {
      setSavingPdf(false)
    }
  }

  // ── Impressão do Documento (Iframe Direto e Infalível sem Bloqueio de Pop-up) ───
  // ── Impressão do Documento Oficial ──────────────────────────────────────────
  const handlePrint = () => {
    if (!docData) return
    try {
      const htmlContent = generateDeclaracaoHtml(docData)
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.open()
        printWindow.document.write(htmlContent)
        printWindow.document.close()
      } else {
        handleDownloadPdf()
      }
    } catch (e) {
      console.error('Erro no handlePrint:', e)
      handleDownloadPdf()
    }
  }

  // ── Copiar Código de Autenticidade ──────────────────────────────────────────
  const handleCopyAuthCode = () => {
    if (!docData?.codigoAutenticidade) return
    navigator.clipboard.writeText(docData.codigoAutenticidade)
    setCopiedCode(true)
    toast.success('Código de autenticidade copiado!')
    setTimeout(() => setCopiedCode(false), 2500)
  }

  return (
    <div
      style={{
        padding: '24px 32px 60px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: 'Outfit, Inter, system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
        color: '#0f172a',
      }}
    >
      {/* ── 1. CABEÇALHO DA PÁGINA ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(79, 70, 229, 0.08)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#4f46e5',
              marginBottom: 8,
            }}
          >
            <ShieldCheck size={14} />
            <span>MÓDULO ADMINISTRATIVO • DECLARAÇÃO IRPF</span>
          </div>

          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              margin: '0 0 4px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <FileCheck2 size={28} style={{ color: '#4f46e5' }} />
            Declaração de IRPF & Quitação Anual
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748b', fontWeight: 500 }}>
            Emissão oficial do Comprovante de Quitação Anual de Mensalidades por aluno para a Declaração de Ajuste Anual de IRPF.
          </p>
        </div>

        {/* Status da Integração com o Isaac */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#ffffff',
            padding: '8px 16px',
            borderRadius: 16,
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 10px #10b981',
            }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b' }}>
              API Isaac Escola Conectada
            </div>
            <div style={{ fontSize: 10.5, color: '#64748b' }}>
              Sincronização em tempo real
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. CARD DE BUSCA UNIVERSAL & FILTROS ────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 22,
          border: '1.5px solid #e2e8f0',
          padding: '20px 24px',
          marginBottom: 24,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Abas de Modo de Busca */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 12,
              gap: 3,
            }}
          >
            <button
              onClick={() => setSearchMode('todos')}
              style={{
                padding: '6px 14px',
                borderRadius: 9,
                border: 'none',
                background: searchMode === 'todos' ? '#ffffff' : 'transparent',
                color: searchMode === 'todos' ? '#4f46e5' : '#64748b',
                fontSize: 12.5,
                fontWeight: searchMode === 'todos' ? 800 : 600,
                cursor: 'pointer',
                boxShadow: searchMode === 'todos' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              🔍 Todos
            </button>
            <button
              onClick={() => setSearchMode('alunos')}
              style={{
                padding: '6px 14px',
                borderRadius: 9,
                border: 'none',
                background: searchMode === 'alunos' ? '#ffffff' : 'transparent',
                color: searchMode === 'alunos' ? '#4f46e5' : '#64748b',
                fontSize: 12.5,
                fontWeight: searchMode === 'alunos' ? 800 : 600,
                cursor: 'pointer',
                boxShadow: searchMode === 'alunos' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              🎓 Buscar por Aluno
            </button>
            <button
              onClick={() => setSearchMode('responsaveis')}
              style={{
                padding: '6px 14px',
                borderRadius: 9,
                border: 'none',
                background: searchMode === 'responsaveis' ? '#ffffff' : 'transparent',
                color: searchMode === 'responsaveis' ? '#4f46e5' : '#64748b',
                fontSize: 12.5,
                fontWeight: searchMode === 'responsaveis' ? 800 : 600,
                cursor: 'pointer',
                boxShadow: searchMode === 'responsaveis' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              👤 Buscar por Responsável (Isaac)
            </button>
          </div>

          {/* Seletor de Ano Calendário */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Ano-Base:
            </span>
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: 3,
                borderRadius: 12,
                gap: 3,
              }}
            >
              {ANOS_DISPONIVEIS.map((ano) => {
                const isSelected = selectedAno === ano
                return (
                  <button
                    key={ano}
                    onClick={() => setSelectedAno(ano)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 9,
                      border: 'none',
                      background: isSelected ? '#ffffff' : 'transparent',
                      color: isSelected ? '#4f46e5' : '#64748b',
                      fontSize: 12.5,
                      fontWeight: isSelected ? 900 : 600,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {ano}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Grade de Campos de Busca */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 16,
            alignItems: 'flex-end',
          }}
        >
          {/* Input de Busca com Autocomplete */}
          <div ref={searchContainerRef} style={{ position: 'relative' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 800,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              {searchMode === 'responsaveis'
                ? 'Nome, CPF ou Telefone do Responsável:'
                : searchMode === 'alunos'
                ? 'Nome ou Matrícula do Aluno:'
                : 'Buscar Aluno ou Responsável Financeiro:'}
            </label>

            <div style={{ position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder={
                  searchMode === 'responsaveis'
                    ? 'Digite ao menos 3 caracteres do responsável ou CPF...'
                    : searchMode === 'alunos'
                    ? 'Digite ao menos 3 caracteres do aluno ou matrícula...'
                    : 'Digite ao menos 3 caracteres (nome do aluno, matrícula, responsável ou CPF)...'
                }
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setSearchDropdownOpen(true)
                }}
                onFocus={() => setSearchDropdownOpen(true)}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 42px',
                  borderRadius: 14,
                  border: '1.5px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />

              {searchTerm && (
                <button
                  onClick={handleClearSelection}
                  title="Limpar busca"
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Dropdown de Resultados com Autocomplete */}
            <AnimatePresence>
              {searchDropdownOpen && searchTerm.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 6,
                    background: '#ffffff',
                    borderRadius: 16,
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
                    zIndex: 50,
                    maxHeight: 360,
                    overflowY: 'auto',
                    padding: 8,
                  }}
                >
                  {searchTerm.trim().length < 3 ? (
                    <div
                      style={{
                        padding: '16px 20px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                    >
                      🔍 Digite pelo menos <strong>3 caracteres</strong> para buscar coincidências...
                    </div>
                  ) : loadingSearch ? (
                    <div
                      style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: '#4f46e5' }} />
                      <span>Buscando coincidências no sistema & Isaac...</span>
                    </div>
                  ) : filteredStudents.length === 0 && responsaveisResults.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      Nenhuma coincidência localizada para &quot;{searchTerm}&quot;
                    </div>
                  ) : (
                    <div>
                      {/* Seção 1: Alunos */}
                      {filteredStudents.length > 0 && (
                        <div style={{ marginBottom: responsaveisResults.length > 0 ? 12 : 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: '#6366f1',
                              textTransform: 'uppercase',
                              padding: '4px 8px',
                              letterSpacing: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <GraduationCap size={13} />
                            <span>Alunos ({filteredStudents.length})</span>
                          </div>

                          {filteredStudents.slice(0, 15).map((aluno) => {
                            const isSelected = selectedStudent?.id === aluno.id
                            const initials = aluno.nome
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()

                            return (
                              <div
                                key={`aluno-${aluno.id}`}
                                onClick={() => handleSelectStudent(aluno)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  background: isSelected ? '#f1f5f9' : 'transparent',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = '#f8fafc'
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {aluno.foto ? (
                                    <img
                                      src={aluno.foto}
                                      alt={aluno.nome}
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1.5px solid #e2e8f0',
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 11,
                                        fontWeight: 800,
                                      }}
                                    >
                                      {initials}
                                    </div>
                                  )}

                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                      {aluno.nome}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                      Matrícula: {aluno.matricula || aluno.id}
                                      {aluno.responsavelNome && ` • Resp: ${aluno.responsavelNome}`}
                                    </div>
                                  </div>
                                </div>

                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#4f46e5',
                                    background: '#eef2ff',
                                    padding: '3px 8px',
                                    borderRadius: 8,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {aluno.turmaNome || getTurmaNome(aluno.turma)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Seção 2: Responsáveis */}
                      {responsaveisResults.length > 0 && (
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: '#059669',
                              textTransform: 'uppercase',
                              padding: '4px 8px',
                              letterSpacing: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              borderTop: filteredStudents.length > 0 ? '1px solid #f1f5f9' : 'none',
                              paddingTop: filteredStudents.length > 0 ? 8 : 4,
                            }}
                          >
                            <User size={13} />
                            <span>Responsáveis Financeiros ({responsaveisResults.length})</span>
                          </div>

                          {responsaveisResults.slice(0, 15).map((resp) => {
                            const isSelected = selectedResponsavel?.id === resp.id
                            const initials = resp.nome
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()

                            return (
                              <div
                                key={`resp-${resp.id}`}
                                onClick={() => handleSelectResponsavel(resp)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  background: isSelected ? '#ecfdf5' : 'transparent',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = '#f0fdf4'
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                      color: '#ffffff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 11,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {initials}
                                  </div>

                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                      {resp.nome}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                      CPF: {formatCPF(resp.cpf) || 'Não informado'}
                                      {resp.telefone && ` • Tel: ${resp.telefone}`}
                                    </div>
                                  </div>
                                </div>

                                {resp.alunosVinculados && resp.alunosVinculados.length > 0 && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: '#059669',
                                      background: '#ecfdf5',
                                      padding: '3px 8px',
                                      borderRadius: 8,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {resp.alunosVinculados.length} dependente(s)
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filtro por Turma com Nome Humano */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 800,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Filtrar por Turma / Série:
            </label>
            <select
              value={selectedTurmaFilter}
              onChange={(e) => setSelectedTurmaFilter(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: 14,
                border: '1.5px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: 13,
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
                minWidth: 200,
              }}
            >
              <option value="todas">Todas as Turmas ({turmasList.length})</option>
              {turmasList.map((t) => (
                <option key={t.id} value={t.nome || t.id}>
                  {t.nome || `Turma ${t.codigo || t.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── 3. ESTADO: NENHUM ALUNO OU RESPONSÁVEL SELECIONADO ───────────────── */}
      {!selectedStudent && !selectedResponsavel && !loadingDoc && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '2px dashed #cbd5e1',
            padding: '70px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.12)',
            }}
          >
            <Search size={32} />
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
            Nenhum aluno ou responsável selecionado
          </h3>
          <p
            style={{
              fontSize: 13.5,
              color: '#64748b',
              maxWidth: 540,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Digite <strong>ao menos 3 caracteres</strong> no campo de busca acima para pesquisar pelo{' '}
            <strong>Nome ou Matrícula do Aluno</strong>, ou pelo{' '}
            <strong>Nome ou CPF do Responsável Financeiro</strong> para emitir a declaração do ano-base{' '}
            <strong>{selectedAno}</strong>.
          </p>
        </div>
      )}

      {/* ── 4. ESTADO: CARREGANDO DADOS DA DECLARAÇÃO ────────────────────────── */}
      {loadingDoc && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1.5px solid #e2e8f0',
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RefreshCw
            size={36}
            style={{
              color: '#4f46e5',
              animation: 'spin 0.9s linear infinite',
              marginBottom: 16,
            }}
          />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Consultando API Isaac & Consolidando Declaração...
          </h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Localizando parcelas e histórico de mensalidades quitadas no ano de{' '}
            <strong>{selectedAno}</strong>.
          </p>
        </div>
      )}

      {/* ── 5. ESTADO: ERRO NA CONSULTA ──────────────────────────────────────── */}
      {docError && !loadingDoc && (
        <div
          style={{
            background: '#fef2f2',
            borderRadius: 20,
            border: '1.5px solid #fecaca',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertCircle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#991b1b' }}>
                Erro ao gerar Declaração de IRPF
              </div>
              <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2 }}>{docError}</div>
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedStudent || selectedResponsavel) {
                fetchDeclaracao(selectedStudent, selectedResponsavel, selectedAno, selectedResponsavelId)
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              border: 'none',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}

      {/* ── 6. PAINEL PRINCIPAL: DADOS CARREGADOS COM SUCESSO ─────────────────── */}
      {docData && !loadingDoc && (
        <div>
          {/* Seletor de Dependentes / Filhos (quando o responsável tiver mais de 1 aluno) */}
          {docData.alunosDisponiveis && docData.alunosDisponiveis.length > 1 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                borderRadius: 18,
                border: '1.5px solid #c7d2fe',
                padding: '14px 20px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: '#4f46e5' }} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#1e1b4b' }}>
                    Dependentes de {docData.responsavel.nome}:
                  </span>
                  <span style={{ fontSize: 12, color: '#4338ca', marginLeft: 6 }}>
                    (Clique para alternar a declaração por aluno)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {docData.alunosDisponiveis.map((a) => {
                  const isCurrent =
                    selectedStudent?.id === a.id ||
                    docData.aluno.id === a.id ||
                    docData.aluno.nome.toLowerCase() === a.nome.toLowerCase()

                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelectedStudent({
                          id: a.id,
                          nome: a.nome,
                          matricula: a.matricula,
                          turma: a.turma,
                          turmaNome: getTurmaNome(a.turma),
                          foto: a.foto,
                        })
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 12,
                        border: isCurrent ? '2px solid #4f46e5' : '1.5px solid #cbd5e1',
                        background: isCurrent ? '#4f46e5' : '#ffffff',
                        color: isCurrent ? '#ffffff' : '#334155',
                        fontSize: 12.5,
                        fontWeight: isCurrent ? 900 : 700,
                        cursor: 'pointer',
                        boxShadow: isCurrent ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <GraduationCap size={14} />
                      <span>{a.nome}</span>
                      {a.turma && (
                        <span
                          style={{
                            fontSize: 10.5,
                            background: isCurrent ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                            color: isCurrent ? '#ffffff' : '#4f46e5',
                            padding: '1px 6px',
                            borderRadius: 6,
                            fontWeight: 800,
                          }}
                        >
                          {getTurmaNome(a.turma)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Card de Perfil Consolidado: Aluno + Responsável Financeiro */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 22,
              border: '1.5px solid #e2e8f0',
              padding: '20px 24px',
              marginBottom: 20,
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 24,
              }}
            >
              {/* Lado Esquerdo: Beneficiário / Aluno */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#4f46e5',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 10,
                  }}
                >
                  <GraduationCap size={15} />
                  <span>Beneficiário / Aluno Selecionado</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 900,
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                      flexShrink: 0,
                    }}
                  >
                    {docData.aluno.nome
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>

                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                      {docData.aluno.nome}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: '#4f46e5',
                          background: '#eef2ff',
                          padding: '2px 8px',
                          borderRadius: 8,
                        }}
                      >
                        {getTurmaNome(docData.aluno.turma)}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        Matrícula: {docData.aluno.matricula}
                      </span>
                      {docData.aluno.cpf && docData.aluno.cpf !== 'Não informado' && (
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                          • CPF: {docData.aluno.cpf}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lado Direito: Responsável Financeiro Titular */}
              <div
                style={{
                  borderLeft: '1.5px solid #f1f5f9',
                  paddingLeft: 24,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#059669',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    <User size={15} />
                    <span>Responsável Financeiro Titular</span>
                  </div>

                  {/* Seletor de Responsável se houver múltiplos vínculos */}
                  {docData.responsaveisDisponiveis && docData.responsaveisDisponiveis.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Titular:</span>
                      <select
                        value={selectedResponsavelId || ''}
                        onChange={(e) => {
                          const newId = e.target.value
                          setSelectedResponsavelId(newId)
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#059669',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {docData.responsaveisDisponiveis.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome} ({r.parentesco || 'Resp.'}) {r.isFinanceiro ? '★' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 900,
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                      flexShrink: 0,
                    }}
                  >
                    {docData.responsavel.nome
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>

                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                      {docData.responsavel.nome}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginTop: 4,
                        flexWrap: 'wrap',
                        fontSize: 12,
                        color: '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>
                        CPF: {docData.responsavel.cpf}
                      </span>
                      {docData.responsavel.telefone && (
                        <span>• Tel: {docData.responsavel.telefone}</span>
                      )}
                      {docData.responsavel.email && <span>• {docData.responsavel.email}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4 CARDS DE MÉTRICAS / RESUMO FISCAL ──────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* 1. Total Quitado */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                borderRadius: 20,
                padding: '18px 20px',
                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.15)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <DollarSign size={14} style={{ color: '#38bdf8' }} />
                <span>Total Quitado em {docData.anoCalendario}</span>
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#38bdf8',
                  marginTop: 6,
                  letterSpacing: '-0.02em',
                }}
              >
                {docData.totalPagoFormatado}
              </div>
              <div style={{ fontSize: 10.5, color: '#cbd5e1', marginTop: 4, fontWeight: 500 }}>
                {docData.totalPagoPorExtenso}
              </div>
            </div>

            {/* 2. Quantidade de Mensalidades */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1.5px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={14} style={{ color: '#059669' }} />
                <span>Mensalidades Quitadas</span>
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#0f172a',
                  marginTop: 6,
                  letterSpacing: '-0.02em',
                }}
              >
                {docData.quantidadeMensalidades} parcela(s)
              </div>
              <div style={{ fontSize: 11.5, color: '#059669', marginTop: 4, fontWeight: 700 }}>
                Status: Regularmente Liquidadas
              </div>
            </div>

            {/* 3. Razão Social & CNPJ */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1.5px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Building2 size={14} style={{ color: '#4f46e5' }} />
                <span>Entidade Emissora (CNPJ)</span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#0f172a',
                  marginTop: 6,
                }}
              >
                {docData.escola.cnpj}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  marginTop: 4,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {docData.escola.razaoSocial}
              </div>
            </div>

            {/* 4. Código de Autenticidade */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1.5px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={14} style={{ color: '#8b5cf6' }} />
                  <span>Código de Autenticidade</span>
                </div>

                <button
                  onClick={handleCopyAuthCode}
                  title="Copiar código de autenticidade"
                  style={{
                    background: copiedCode ? '#ecfdf5' : '#f1f5f9',
                    border: 'none',
                    borderRadius: 6,
                    padding: '3px 6px',
                    cursor: 'pointer',
                    color: copiedCode ? '#059669' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                >
                  {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 900,
                  color: '#0f172a',
                  marginTop: 6,
                  fontFamily: 'monospace',
                  letterSpacing: '0.04em',
                }}
              >
                {docData.codigoAutenticidade}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                Exercício Fiscal: {docData.exercicio}
              </div>
            </div>
          </div>

          {/* ── BARRA DE AÇÕES & ABAS ────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {/* Seletor de Aba */}
            <div
              style={{
                display: 'flex',
                background: '#e2e8f0',
                padding: 4,
                borderRadius: 14,
                gap: 4,
              }}
            >
              <button
                onClick={() => setActiveTab('document')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeTab === 'document' ? '#ffffff' : 'transparent',
                  color: activeTab === 'document' ? '#0f172a' : '#64748b',
                  fontSize: 13,
                  fontWeight: activeTab === 'document' ? 800 : 600,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'document' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Eye size={15} />
                <span>Documento Oficial (A4)</span>
              </button>

              <button
                onClick={() => setActiveTab('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeTab === 'table' ? '#ffffff' : 'transparent',
                  color: activeTab === 'table' ? '#0f172a' : '#64748b',
                  fontSize: 13,
                  fontWeight: activeTab === 'table' ? 800 : 600,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'table' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Receipt size={15} />
                <span>Detalhamento de Mensalidades ({docData.quantidadeMensalidades})</span>
              </button>
            </div>

            {/* Botões de Ação */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => {
                  if (selectedStudent || selectedResponsavel) {
                    fetchDeclaracao(selectedStudent, selectedResponsavel, selectedAno, selectedResponsavelId)
                  }
                }}
                title="Recarregar dados da API Isaac"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 14,
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <RefreshCw size={15} />
                <span>Atualizar</span>
              </button>

              <button
                onClick={handlePrint}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 14,
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Printer size={16} />
                <span>Imprimir</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={savingPdf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 14,
                  border: 'none',
                  background: savingPdf
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 900,
                  cursor: savingPdf ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                {savingPdf ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                    <span>Gerando PDF Oficial...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Baixar PDF Oficial</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── ABA 1: DOCUMENTO OFICIAL ─────────────────────────────────────── */}
          {activeTab === 'document' && (
            <div
              style={{
                background: '#f8fafc',
                borderRadius: 24,
                border: '1.5px solid #e2e8f0',
                padding: '30px 20px',
                display: 'flex',
                justifyContent: 'center',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ width: '100%', maxWidth: 740 }}>
                <DeclaracaoIrpfDocument data={docData} />
              </div>
            </div>
          )}

          {/* ── ABA 2: DETALHAMENTO DE MENSALIDADES ──────────────────────────── */}
          {activeTab === 'table' && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: 22,
                border: '1.5px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  background: '#f8fafc',
                  borderBottom: '1.5px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: '#0f172a' }}>
                    Demonstrativo de Parcelas Liquidadas — {docData.aluno.nome}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                    Exclusivamente mensalidades escolares do ano-calendário {docData.anoCalendario}
                  </p>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: '#4f46e5',
                    background: '#eef2ff',
                    padding: '4px 12px',
                    borderRadius: 10,
                  }}
                >
                  Total: {docData.totalPagoFormatado}
                </div>
              </div>

              {docData.quantidadeMensalidades === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
                  <AlertCircle size={32} style={{ color: '#f59e0b', marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                    Nenhuma mensalidade quitada localizada para este aluno
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    Não foram encontradas parcelas de mensalidade com status pago (PAID) para{' '}
                    <strong>{docData.aluno.nome}</strong> no ano de {docData.anoCalendario}.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: '#0f172a',
                          color: '#ffffff',
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        <th style={{ padding: '10px 14px', width: 50, textAlign: 'center' }}>#</th>
                        <th style={{ padding: '10px 14px' }}>Competência</th>
                        <th style={{ padding: '10px 14px' }}>Descrição da Parcela</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Vencimento</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Data Pagamento</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Valor Pago (R$)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docData.mensalidades.map((m, idx) => (
                        <tr
                          key={m.id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          }}
                        >
                          <td
                            style={{
                              padding: '12px 14px',
                              textAlign: 'center',
                              fontWeight: 700,
                              color: '#64748b',
                            }}
                          >
                            {m.index}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a' }}>
                            {m.competencia}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 500 }}>
                            {m.descricao}
                          </td>
                          <td
                            style={{
                              padding: '12px 14px',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              color: '#64748b',
                            }}
                          >
                            {m.vencimento}
                          </td>
                          <td
                            style={{
                              padding: '12px 14px',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: '#059669',
                            }}
                          >
                            {m.dataPagamento}
                          </td>
                          <td
                            style={{
                              padding: '12px 14px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 900,
                              color: '#0f172a',
                            }}
                          >
                            {m.valorPago}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#ecfdf5',
                                color: '#059669',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 6,
                              }}
                            >
                              <CheckCircle2 size={12} />
                              QUITADO
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          background: '#f1f5f9',
                          fontWeight: 900,
                          borderTop: '2px solid #cbd5e1',
                        }}
                      >
                        <td
                          colSpan={5}
                          style={{
                            padding: '14px 16px',
                            textAlign: 'right',
                            fontSize: 13,
                            color: '#0f172a',
                          }}
                        >
                          Total de mensalidades pagas em {docData.anoCalendario} ({docData.quantidadeMensalidades} parcelas):
                        </td>
                        <td
                          style={{
                            padding: '14px 16px',
                            textAlign: 'right',
                            fontSize: 15,
                            color: '#4f46e5',
                            fontFamily: 'monospace',
                          }}
                        >
                          {docData.totalPagoFormatado}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
