'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useData } from '@/lib/dataContext'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, User, MessageSquare, MoreHorizontal, ShieldAlert, Key, Ban,
  Mail, Phone, Calendar as CalendarIcon, FileText, Download, TrendingUp,
  CheckCircle2, Filter, AlertTriangle, Lock, Unlock, Loader2, Eye,
  ExternalLink, Copy, Check, Smartphone, RefreshCw, X, AlertCircle, Clock,
  LogIn, LogOut, UserCheck
} from 'lucide-react'
import Link from 'next/link'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { UserAvatar } from '@/components/UserAvatar'

// Helper function to format any date into clean, human-readable Portuguese text
function formatDatePtBr(rawDate: any): string {
  if (!rawDate) return 'Recente'
  if (
    typeof rawDate === 'string' &&
    (rawDate.includes('Hoje') ||
      rawDate.includes('Ontem') ||
      rawDate.includes('Segunda') ||
      rawDate.includes('Terça') ||
      rawDate.includes('Quarta') ||
      rawDate.includes('Quinta') ||
      rawDate.includes('Sexta') ||
      rawDate.includes('Sábado') ||
      rawDate.includes('Domingo') ||
      rawDate.includes('dias'))
  ) {
    return rawDate
  }

  try {
    const d = new Date(rawDate)
    if (isNaN(d.getTime())) return String(rawDate)

    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    if (isToday) return `Hoje às ${timeStr}`
    if (isYesterday) return `Ontem às ${timeStr}`

    return `${d.toLocaleDateString('pt-BR')} às ${timeStr}`
  } catch (e) {
    return String(rawDate)
  }
}

export default function ADAdminPessoaDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { turmas = [] } = useData()
  const [alunos, setAlunos, { loading: isAlunosLoading }] = useSupabaseArray<any>('alunos')
  const { adAlert, adConfirm, comunicados = [] } = useAgendaDigital()

  // State for fetched guardians, occurrences, financial titles, iDFace events, saida calls & roll call attendance
  const [dbResponsaveis, setDbResponsaveis] = useState<any[]>([])
  const [isLoadingResponsaveis, setIsLoadingResponsaveis] = useState(true)
  const [realOcorrencias, setRealOcorrencias] = useState<any[]>([])
  const [isLoadingOcorrencias, setIsLoadingOcorrencias] = useState(true)
  const [realTitulos, setRealTitulos] = useState<any[]>([])
  const [isLoadingTitulos, setIsLoadingTitulos] = useState(true)
  const [realPortariaEventos, setRealPortariaEventos] = useState<any[]>([])
  const [isLoadingPortaria, setIsLoadingPortaria] = useState(true)
  const [realSaidaCalls, setRealSaidaCalls] = useState<any[]>([])
  const [isLoadingSaidaCalls, setIsLoadingSaidaCalls] = useState(true)
  const [realFrequenciaDb, setRealFrequenciaDb] = useState<any[]>([])
  const [realComunicados, setRealComunicados] = useState<any[]>([])
  const [isLoadingComunicados, setIsLoadingComunicados] = useState(true)
  
  // Instant local simulated logs override
  const [localSimulatedLogs, setLocalSimulatedLogs] = useState<any[] | null>(null)

  // UI States
  const [logFilter, setLogFilter] = useState<'todos' | 'comunicados' | 'financeiro' | 'ocorrencias' | 'acessos' | 'portaria'>('todos')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [visibleLogCount, setVisibleLogCount] = useState(10)
  const [selectedRespModal, setSelectedRespModal] = useState<any | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Find target student strictly or loosely by id, matricula, or codigo
  const aluno = useMemo(() => {
    if (!alunos || alunos.length === 0 || !id) return null
    const paramIdStr = String(id).trim()
    return (alunos || []).find((a: any) =>
      String(a.id) === paramIdStr ||
      String(a.matricula) === paramIdStr ||
      String(a.dados?.codigo) === paramIdStr ||
      String(a.codigo) === paramIdStr
    )
  }, [alunos, id])

  // Fetch real comunicados for this student directly from Supabase API (/api/comunicados)
  useEffect(() => {
    let isMounted = true
    async function loadComunicados() {
      if (!id) return
      setIsLoadingComunicados(true)
      try {
        const studentId = aluno?.id || id
        const res = await fetch(`/api/comunicados?aluno_id=${encodeURIComponent(String(studentId))}`)
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
          if (isMounted) {
            setRealComunicados(list)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar comunicados do aluno:', err)
      } finally {
        if (isMounted) setIsLoadingComunicados(false)
      }
    }
    loadComunicados()
    return () => { isMounted = false }
  }, [id, aluno?.id])

  // Fetch real guardians from Supabase API (/api/aluno-responsavel)
  useEffect(() => {
    let isMounted = true
    async function loadResponsaveis() {
      if (!id) return
      setIsLoadingResponsaveis(true)
      try {
        const studentId = aluno?.id || id
        const res = await fetch(`/api/aluno-responsavel?aluno_id=${encodeURIComponent(String(studentId))}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && data.responsaveis) {
            setDbResponsaveis(data.responsaveis)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar responsáveis reais:', err)
      } finally {
        if (isMounted) setIsLoadingResponsaveis(false)
      }
    }
    loadResponsaveis()
    return () => { isMounted = false }
  }, [id, aluno?.id])

  // Fetch real occurrences from Supabase API (/api/ocorrencias)
  useEffect(() => {
    let isMounted = true
    async function loadOcorrencias() {
      if (!id) return
      setIsLoadingOcorrencias(true)
      try {
        const studentId = aluno?.id || id
        const res = await fetch(`/api/ocorrencias?aluno_id=${encodeURIComponent(String(studentId))}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && Array.isArray(data)) {
            setRealOcorrencias(data)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar ocorrências:', err)
      } finally {
        if (isMounted) setIsLoadingOcorrencias(false)
      }
    }
    loadOcorrencias()
    return () => { isMounted = false }
  }, [id, aluno?.id])

  // Fetch real financial titles / boletos from Supabase API (/api/financeiro/titulos)
  useEffect(() => {
    let isMounted = true
    async function loadTitulos() {
      if (!id) return
      setIsLoadingTitulos(true)
      try {
        const studentId = aluno?.id || id
        const res = await fetch(`/api/financeiro/titulos?alunoId=${encodeURIComponent(String(studentId))}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && Array.isArray(data)) {
            setRealTitulos(data)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar títulos financeiros:', err)
      } finally {
        if (isMounted) setIsLoadingTitulos(false)
      }
    }
    loadTitulos()
    return () => { isMounted = false }
  }, [id, aluno?.id])

  // Fetch Catraca iDFace recognition / entrance events from (/api/portaria/eventos)
  useEffect(() => {
    let isMounted = true
    async function loadPortariaEventos() {
      if (!id) return
      setIsLoadingPortaria(true)
      try {
        const studentId = aluno?.id || id
        const studentMatricula = aluno?.matricula || aluno?.dados?.codigo || id
        const res = await fetch(`/api/portaria/eventos?aluno_id=${encodeURIComponent(String(studentId))}&matricula=${encodeURIComponent(String(studentMatricula))}&limit=50`)
        if (res.ok) {
          const data = await res.json()
          const eventsList = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
          if (isMounted) {
            setRealPortariaEventos(eventsList)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar eventos da catraca iDFace:', err)
      } finally {
        if (isMounted) setIsLoadingPortaria(false)
      }
    }
    loadPortariaEventos()
    return () => { isMounted = false }
  }, [id, aluno?.id, aluno?.matricula])

  // Fetch confirmed departure calls from Painel Chamadas (/api/saida/calls)
  useEffect(() => {
    let isMounted = true
    async function loadSaidaCalls() {
      if (!id) return
      setIsLoadingSaidaCalls(true)
      try {
        const studentId = aluno?.id || id
        const res = await fetch(`/api/saida/calls?studentId=${encodeURIComponent(String(studentId))}&from=2020-01-01&to=2030-12-31`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && Array.isArray(data)) {
            setRealSaidaCalls(data)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar chamadas de saída:', err)
      } finally {
        if (isMounted) setIsLoadingSaidaCalls(false)
      }
    }
    loadSaidaCalls()
    return () => { isMounted = false }
  }, [id, aluno?.id])

  // Fetch roll call attendance records from (/api/academico/frequencias)
  useEffect(() => {
    let isMounted = true
    async function loadFrequenciaDb() {
      if (!id || !aluno?.turma) return
      try {
        const studentId = aluno?.id || id
        const res = await fetch(`/api/academico/frequencias?aluno_id=${encodeURIComponent(String(studentId))}&turma_id=${encodeURIComponent(String(aluno.turma))}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && Array.isArray(data)) {
            setRealFrequenciaDb(data)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar diário de classe:', err)
      }
    }
    loadFrequenciaDb()
    return () => { isMounted = false }
  }, [id, aluno?.id, aluno?.turma])

  // Combine comunicados from React Context AND direct API fetch
  const allComunicadosToFilter = useMemo(() => {
    const map = new Map<string, any>()
    ;(comunicados || []).forEach((c: any) => {
      if (c && c.id) map.set(String(c.id), c)
    })
    ;(realComunicados || []).forEach((c: any) => {
      if (c && c.id) map.set(String(c.id), c)
      else if (c && c.dados?.id) map.set(String(c.dados.id), c)
    })
    return Array.from(map.values())
  }, [comunicados, realComunicados])

  // Skeleton loader when initial data loading is in progress
  if (isAlunosLoading && !aluno) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
        <Loader2 size={48} className="animate-spin" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Carregando dados do usuário...</h3>
      </div>
    )
  }

  if (!aluno && !isAlunosLoading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
        <User size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'hsl(var(--text-main))' }}>Usuário não encontrado</h3>
        <p style={{ fontSize: 14, margin: '8px 0 16px' }}>Não foi possível localizar um aluno com o identificador informado ({String(id)}).</p>
        <button className="btn btn-secondary" onClick={() => router.push('/agenda-digital/admin/pessoas')}>
          <ArrowLeft size={16} style={{ marginRight: 6 }} /> Voltar para Pessoas
        </button>
      </div>
    )
  }

  // Turma lookup
  const turmaObj = (turmas || []).find((t: any) => String(t.id) === String(aluno.turma)) ||
                   (turmas || []).find((t: any) => String(t.nome) === String(aluno.turma))

  // Map Responsáveis combining database records and student object fallbacks
  const responsaveis: any[] = []
  if (dbResponsaveis && dbResponsaveis.length > 0) {
    dbResponsaveis.forEach((r: any) => {
      if (!r.nome) return
      let tipo = 'Responsável'
      let color = 'hsl(var(--text-secondary))'
      let badgeBg = 'hsl(var(--bg-overlay))'
      
      const isFin = r.isFinanceiro || r.respFinanceiro || r.resp_financeiro
      const isPed = r.isPedagogico || r.respPedagogico || r.resp_pedagogico

      if (isFin && isPed) {
        tipo = 'Financeiro & Pedagógico'
        color = '#ec4899'
        badgeBg = 'rgba(236, 72, 153, 0.1)'
      } else if (isFin) {
        tipo = 'Financeiro'
        color = '#10b981'
        badgeBg = 'rgba(16,185,129,0.1)'
      } else if (isPed) {
        tipo = 'Pedagógico'
        color = '#4f46e5'
        badgeBg = 'rgba(99,102,241,0.1)'
      }
      responsaveis.push({ ...r, tipo, color, badgeBg })
    })
  } else if (aluno.responsaveis && aluno.responsaveis.length > 0) {
    aluno.responsaveis.forEach((r: any) => {
      if (!r.nome) return
      let tipo = 'Responsável'
      let color = 'hsl(var(--text-secondary))'
      let badgeBg = 'hsl(var(--bg-overlay))'
      if (r.respFinanceiro || r.isFinanceiro) { tipo = 'Financeiro'; color = '#10b981'; badgeBg = 'rgba(16,185,129,0.1)' }
      else if (r.respPedagogico || r.isPedagogico) { tipo = 'Pedagógico'; color = '#4f46e5'; badgeBg = 'rgba(99,102,241,0.1)' }
      responsaveis.push({ ...r, tipo, color, badgeBg })
    })
  } else {
    if (aluno.responsavelFinanceiro) {
      responsaveis.push({ nome: aluno.responsavelFinanceiro, tipo: 'Financeiro', color: '#10b981', badgeBg: 'rgba(16,185,129,0.1)', parentesco: 'Responsável Financeiro' })
    }
    if (aluno.responsavelPedagogico) {
      responsaveis.push({ nome: aluno.responsavelPedagogico, tipo: 'Pedagógico', color: '#4f46e5', badgeBg: 'rgba(99,102,241,0.1)', parentesco: 'Responsável Pedagógico' })
    }
    if (aluno.responsavel && aluno.responsavel !== aluno.responsavelFinanceiro && aluno.responsavel !== aluno.responsavelPedagogico) {
      responsaveis.push({ nome: aluno.responsavel, tipo: 'Outro', color: 'hsl(var(--text-secondary))', badgeBg: 'hsl(var(--bg-overlay))', parentesco: 'Responsável Geral' })
    }
  }

  // Calculate strict relevant comunicados for THIS student & turma
  const studentIdClean = String(aluno.id).replace(/^a_?/, '')
  const studentMatriculaClean = aluno.matricula ? String(aluno.matricula) : ''
  const studentCodigoClean = aluno.dados?.codigo ? String(aluno.dados.codigo) : ''
  const studentTurmaId = aluno.turma ? String(aluno.turma) : ''
  const studentTurmaName = turmaObj?.nome ? String(turmaObj.nome) : studentTurmaId



  const relevantComunicados = (allComunicadosToFilter || []).filter((c: any) => {
    if (!c) return false
    
    // Ignore draft status
    if (c.status && c.status !== 'enviado' && c.status !== 'publicado') return false

    // If fetched directly by student_id API, it is already targeted to this student
    if (realComunicados.some((rc: any) => String(rc.id) === String(c.id) || rc === c || (c.dados?.id && String(rc.id) === String(c.dados.id)))) {
      return true
    }

    // 1. Check Explicit Global Broadcast / Destino Todos
    const destinoStr = String(c.destino || c.dados?.destino || c.destinatarios || c.dados?.destinatarios || '').toLowerCase()
    if (
      destinoStr === 'todos' ||
      c.isGlobal === true ||
      c.dados?.isGlobal === true ||
      c.para === 'todos'
    ) {
      return true
    }

    // 2. Direct student targeting
    const targetAlunos = Array.isArray(c.alunosIds)
      ? c.alunosIds
      : (Array.isArray(c.dados?.alunosIds) ? c.dados.alunosIds : (Array.isArray(c.alunos) ? c.alunos : []))

    if (targetAlunos.length > 0) {
      const isTargeted = targetAlunos.some((aid: any) => {
        const cleanAid = String(aid).replace(/^(a_|_ALU)/, '')
        return cleanAid === studentIdClean || cleanAid === studentMatriculaClean || cleanAid === studentCodigoClean
      })
      if (isTargeted) return true
    }

    // 3. Turma targeting with flexible string matching (e.g. "NÍVEL 1" vs "NÍVEL 1 - MATUTINO")
    const targetTurmas = Array.isArray(c.turmas)
      ? c.turmas
      : (Array.isArray(c.dados?.turmas) ? c.dados.turmas : (c.turma ? [c.turma] : (c.dados?.turma ? [c.dados.turma] : [])))

    if (targetTurmas.length > 0) {
      const isTurmaTargeted = targetTurmas.some((t: any) => {
        const tStr = String(t).trim().toLowerCase()
        const tIdStr = studentTurmaId.toLowerCase()
        const tNameStr = studentTurmaName.toLowerCase()

        if (tStr === 'todas' || tStr === 'todos') return true
        if (tStr === tIdStr || tStr === tNameStr) return true
        if (tNameStr && (tNameStr.startsWith(tStr) || tStr.startsWith(tNameStr))) return true
        return false
      })
      if (isTurmaTargeted) return true
    }

    return false
  })

  const readComunicados = relevantComunicados.filter((c: any) => {
    const leituras = c.leituras || c.dados?.leituras || {}
    const ciencias = c.ciencias || c.dados?.ciencias || {}
    const studentId = String(aluno.id)
    const studentMatricula = String(aluno.matricula || '')
    if (leituras[studentId] || ciencias[studentId] || (studentMatricula && (leituras[studentMatricula] || ciencias[studentMatricula]))) return true
    return responsaveis.some((r: any) => r.id && (leituras[r.id] || ciencias[r.id] || leituras[String(r.id)] || ciencias[String(r.id)]))
  })

  const totalComunicados = relevantComunicados.length
  const readingRate = totalComunicados > 0
    ? Math.round((readComunicados.length / totalComunicados) * 100)
    : 0

  // Count connected devices/accounts for the family
  const connectedDevices = responsaveis.length > 0
    ? responsaveis.length
    : (aluno.status === 'matriculado' || aluno.status === 'ativo' ? 1 : 0)

  // Calculate Attendance Stats (Roll call + iDFace entries)
  const idfaceEntriesCount = realPortariaEventos.filter((e: any) => {
    const s = String(e.status || '').toLowerCase()
    return s === 'sucesso' || s === 'liberado' || s === 'autorizado' || s === 'ok' || s === 'permitido' || s === 'entrada' || !e.status
  }).length

  const confirmedSaidasCount = realSaidaCalls.filter((c: any) => c.status === 'confirmed' || c.status === 'called' || c.status === 'waiting').length

  const latestIdfaceEvent = realPortariaEventos[0]
  const latestSaidaCall = realSaidaCalls[0]

  // Aggregate REAL Timeline Logs
  const combinedLogs: any[] = []

  // 1. Real Catraca iDFace Entry Events
  realPortariaEventos.forEach((e: any) => {
    const rawDate = e.data_hora || Date.now()
    const isSuccess = !e.status || ['sucesso', 'liberado', 'autorizado', 'ok', 'permitido', 'entrada'].includes(String(e.status).toLowerCase())
    
    combinedLogs.push({
      id: `idface-${e.id}`,
      type: isSuccess ? 'check' : 'alert',
      category: 'portaria',
      title: `Entrada reconhecida via Catraca iDFace`,
      time: formatDatePtBr(rawDate),
      timestamp: new Date(rawDate).getTime() || Date.now(),
      color: isSuccess ? '#10b981' : '#ef4444',
      details: `Equipamento: ${e.dispositivo_nome || 'Portaria iDFace'} • Status: ${isSuccess ? 'Liberado / Acesso Concedido' : (e.status || 'Não Reconhecido')}`,
      categoryLabel: 'Catraca iDFace'
    })
  })

  // 2. Real Confirmed Departure Calls (Saída de Aluno / Painel Chamadas)
  realSaidaCalls.forEach((sc: any) => {
    const rawDate = sc.created_at || sc.updated_at || Date.now()
    const isConfirmed = sc.status === 'confirmed'
    
    combinedLogs.push({
      id: `saida-${sc.id}`,
      type: 'check',
      category: 'portaria',
      title: `Saída de aluno confirmada no Painel de Chamadas`,
      time: formatDatePtBr(rawDate),
      timestamp: new Date(rawDate).getTime() || Date.now(),
      color: isConfirmed ? '#10b981' : '#4f46e5',
      details: `Liberado para: ${sc.guardianName || sc.responsavelNome || 'Responsável Cadastrado'} • Status: ${isConfirmed ? 'Saída Confirmada' : 'Aguardando na Portaria'}`,
      categoryLabel: 'Saída Chamada'
    })
  })

  // 3. Real Roll Call Absences / Presences from Academic Module
  realFrequenciaDb.forEach((f: any) => {
    const rawDate = f.data ? `${f.data}T12:00:00Z` : Date.now()
    const isPresent = f.presente !== false && !f.falta
    const isJustified = f.justificativa?.toLowerCase().includes('justifica')
    
    if (!isPresent) {
      combinedLogs.push({
        id: `freq-${f.id || f.data}`,
        type: 'alert',
        category: 'ocorrencias',
        title: `Registro de Falta em Sala de Aula`,
        time: formatDatePtBr(rawDate),
        timestamp: new Date(rawDate).getTime() || Date.now(),
        color: isJustified ? '#f59e0b' : '#ef4444',
        details: `Data: ${f.data} • Status: ${isJustified ? 'Falta Justificada' : 'Falta Não Justificada'}`,
        categoryLabel: 'Frequência'
      })
    }
  })

  // 4. Real Comunicados events matching THIS student
  relevantComunicados.forEach((c: any) => {
    const isRead = readComunicados.includes(c)
    const rawDate = c.dataEnvio || c.data || c.created_at || c.dados?.dataEnvio || c.dados?.created_at || Date.now()
    const tituloStr = c.titulo || c.assunto || c.dados?.titulo || c.dados?.assunto || 'Informativo Escolar'
    combinedLogs.push({
      id: `com-${c.id || Math.random()}`,
      type: 'doc',
      category: 'comunicados',
      title: `${isRead ? 'Visualizou' : 'Recebeu'} Comunicado: "${tituloStr}"`,
      time: formatDatePtBr(rawDate),
      timestamp: new Date(rawDate).getTime() || Date.now(),
      color: isRead ? '#4f46e5' : '#8b5cf6',
      details: c.categoria || c.dados?.categoria || 'Geral',
      categoryLabel: 'Comunicado'
    })
  })

  // 5. Real Ocorrências events
  realOcorrencias.forEach((oc: any) => {
    const rawDate = oc.created_at || oc.data || Date.now()
    combinedLogs.push({
      id: `oc-${oc.id}`,
      type: 'alert',
      category: 'ocorrencias',
      title: `Ocorrência registrada: ${oc.titulo || oc.tipo || 'Registro Pedagógico'}`,
      time: formatDatePtBr(rawDate),
      timestamp: new Date(rawDate).getTime() || Date.now(),
      color: '#ef4444',
      details: oc.descricao || oc.observacao || '',
      categoryLabel: 'Ocorrência'
    })
  })

  // 6. Real Financial Titles / Boletos events
  realTitulos.forEach((t: any) => {
    const isPaid = t.status === 'pago' || t.status === 'quitado'
    const isOverdue = t.status === 'atrasado' || t.status === 'vencido'
    const rawDate = t.pagamento || t.vencimento || t.created_at || Date.now()
    const formattedValor = Number(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    
    combinedLogs.push({
      id: `tit-${t.id}`,
      type: isPaid ? 'check' : isOverdue ? 'alert' : 'download',
      category: 'financeiro',
      title: `${isPaid ? 'Boleto Quitado' : isOverdue ? 'Boleto em Atraso' : 'Boleto Disponibilizado'}: ${t.descricao || t.eventoDescricao || 'Mensalidade Escolar'} (R$ ${formattedValor})`,
      time: formatDatePtBr(rawDate),
      timestamp: new Date(rawDate).getTime() || Date.now(),
      color: isPaid ? '#10b981' : isOverdue ? '#ef4444' : '#f59e0b',
      details: `Vencimento: ${t.vencimento ? formatDatePtBr(t.vencimento) : 'A definir'} • Status: ${t.status || 'Pendente'}`,
      categoryLabel: 'Financeiro'
    })
  })

  // 7. Real Guardians App Accesses (ONLY if actual login date exists - NOT created_at)
  responsaveis.forEach((r: any) => {
    const lastAccess = r.ultimoAcesso || r.ultimo_acesso || r.last_access || r.ultimo_login
    if (lastAccess) {
      combinedLogs.push({
        id: `resp-access-${r.id || r.cpf || r.nome}`,
        type: 'check',
        category: 'acessos',
        title: `Acesso no aplicativo por ${r.nome}`,
        time: formatDatePtBr(lastAccess),
        timestamp: new Date(lastAccess).getTime() || Date.now(),
        color: '#10b981',
        details: `Dispositivo / App iOS & Android • Vínculo: ${r.tipo}`,
        categoryLabel: 'Acesso App'
      })
    }
  })

  // 8. Simulated logs ONLY if explicitly generated by the user
  const simulatedLogsSource = localSimulatedLogs || (aluno.agendaLogsSimulados ? aluno.agendaLogs : null)
  if (simulatedLogsSource && Array.isArray(simulatedLogsSource)) {
    simulatedLogsSource.forEach((l: any) => {
      const logId = String(l.id || Math.random())
      if (!combinedLogs.some(existing => String(existing.id) === logId)) {
        combinedLogs.push({
          id: logId,
          type: l.type || 'check',
          category: l.category || (l.type === 'download' ? 'financeiro' : (l.type === 'doc' ? 'comunicados' : 'acessos')),
          title: l.title,
          time: formatDatePtBr(l.time),
          timestamp: typeof l.id === 'number' ? l.id : Date.now(),
          color: l.color || '#10b981',
          details: l.details || '',
          categoryLabel: l.categoryLabel || 'Demonstração'
        })
      }
    })
  }

  // Deduplicate by ID and Sort timeline newest first
  const uniqueLogsMap = new Map<string, any>()
  combinedLogs.forEach(item => {
    if (!uniqueLogsMap.has(item.id)) {
      uniqueLogsMap.set(item.id, item)
    }
  })
  const sortedLogs = Array.from(uniqueLogsMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  // Filtered timeline
  const filteredLogs = sortedLogs.filter(log => {
    if (logFilter === 'todos') return true
    if (logFilter === 'portaria') return log.category === 'portaria'
    return log.category === logFilter
  })

  // Actions: Block / Unblock student access
  const handleToggleBlockAccess = () => {
    const isCurrentlyBlocked = Boolean(aluno.bloqueadoAgenda)
    const actionLabel = isCurrentlyBlocked ? 'Desbloquear' : 'Bloquear'

    adConfirm(
      `Deseja realmente ${actionLabel.toLowerCase()} o acesso desta família ao aplicativo Agenda Digital?`,
      `${actionLabel} Acesso`,
      async () => {
        try {
          await setAlunos((prev: any[]) =>
            prev.map((a: any) => (a.id === aluno.id ? { ...a, bloqueadoAgenda: !isCurrentlyBlocked } : a))
          )
          adAlert(`Acesso ${isCurrentlyBlocked ? 'liberado' : 'bloqueado'} com sucesso!`, 'Atualização Salva')
        } catch (err) {
          console.error('Erro ao atualizar bloqueio:', err)
          adAlert('Não foi possível salvar a alteração.', 'Erro')
        }
      }
    )
  }

  // Actions: Reset password for guardian
  const handleResetPassword = (resp: any) => {
    const targetEmail = resp.email || resp.usuarioEmail
    adConfirm(
      `Enviar e-mail de redefinição de senha para ${resp.nome}${targetEmail ? ` (${targetEmail})` : ''}?`,
      'Resetar Senha',
      async () => {
        try {
          if (targetEmail) {
            await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: targetEmail })
            }).catch(() => null)
          }
          adAlert(`Instruções de redefinição de senha enviadas para ${resp.nome}!`, 'Solicitação Concluída')
        } catch (err) {
          adAlert('Solicitação enviada com sucesso.', 'Recuperação de Senha')
        }
      }
    )
  }

  // Action: Generate simulated logs (persist in React state and Supabase)
  const generateSimulatedLogs = () => {
    adConfirm(
      'Isto irá gerar um histórico simulado de demonstração no perfil desta família. Continuar?',
      'Gerar Histórico Simulados',
      async () => {
        const sampleLogs = [
          { id: Date.now() + 1, type: 'check', category: 'acessos', title: 'Responsável confirmou presença na Reunião de Pais', time: 'Hoje às 11:32', color: '#10b981', categoryLabel: 'Demonstração' },
          { id: Date.now() + 2, type: 'doc', category: 'comunicados', title: 'Visualizou o Comunicado: "Feriado Prolongado e Atividades"', time: 'Ontem às 08:15', color: '#4f46e5', categoryLabel: 'Demonstração' },
          { id: Date.now() + 3, type: 'download', category: 'financeiro', title: 'Fez o download do Boleto da Mensalidade de Abril', time: 'Segunda-feira', color: '#f59e0b', categoryLabel: 'Demonstração' }
        ]
        
        // Update local React state instantly for immediate UI rendering
        setLocalSimulatedLogs(sampleLogs)
        
        try {
          await setAlunos((prev: any[]) =>
            prev.map((a: any) => (a.id === aluno.id ? { ...a, agendaLogs: sampleLogs, agendaLogsSimulados: true } : a))
          )
          adAlert('Dados simulados gerados para exibição.', 'Sucesso')
        } catch (err) {
          console.error('Erro ao salvar no banco:', err)
        }
      }
    )
  }

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 60 }}>
      {/* Top Breadcrumb & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/agenda-digital/admin/pessoas')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} /> Voltar para Pessoas
        </button>
        <span style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>/</span>
        <span style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>Pessoas</span>
        <span style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>/</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{aluno.nome}</span>
      </div>

      {/* Header / Hero Card */}
      <div
        className="card"
        style={{
          padding: 28,
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          background: aluno.bloqueadoAgenda
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, hsl(var(--bg-surface)) 100%)'
            : 'hsl(var(--bg-surface))',
          border: aluno.bloqueadoAgenda ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid hsl(var(--border-subtle))',
          position: 'relative'
        }}
      >
        <UserAvatar userId={aluno.id} name={aluno.nome} fotoUrl={aluno.foto} size={100} style={{ borderRadius: 24, fontSize: 36 }} />
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>{aluno.nome}</h1>
            {aluno.status === 'matriculado' || aluno.status === 'ativo' ? (
              <span className="badge badge-success" style={{ fontWeight: 700, padding: '4px 10px', fontSize: 12 }}>
                Ativo no App
              </span>
            ) : (
              <span className="badge badge-ghost text-muted" style={{ padding: '4px 10px', fontSize: 12 }}>
                Inativo
              </span>
            )}

            {aluno.bloqueadoAgenda && (
              <span className="badge" style={{ background: '#ef4444', color: 'white', fontWeight: 800, padding: '4px 10px', fontSize: 11 }}>
                <Lock size={12} style={{ marginRight: 4 }} /> ACESSO BLOQUEADO
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 16, color: 'hsl(var(--text-muted))', fontSize: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Código / Matrícula: <strong>{aluno.codigo || aluno.matricula || aluno.dados?.codigo || aluno.id}</strong></span>
            <span>•</span>
            <span>
              Turma:{' '}
              {turmaObj ? (
                <Link href={`/agenda-digital/admin/turmas/${turmaObj.id}`} style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>
                  {turmaObj.nome}
                </Link>
              ) : (
                <strong>{aluno.turma || 'Sem Turma'}</strong>
              )}
            </span>
            {aluno.dados?.data_nascimento && (
              <>
                <span>•</span>
                <span>Nascimento: <strong>{aluno.dados.data_nascimento}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'relative' }}>
          <Link
            href={`/agenda-digital/admin/espelhar?aluno=${encodeURIComponent(aluno.id)}`}
            className="btn btn-secondary"
            title="Visualizar a Agenda como este aluno/família"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Eye size={16} /> Espelhar Agenda
          </Link>

          <button
            className="btn btn-ghost"
            style={{ padding: '10px 14px', position: 'relative' }}
            onClick={() => setShowActionsMenu(!showActionsMenu)}
          >
            <MoreHorizontal size={20} />
          </button>

          {/* Action Dropdown Menu */}
          {showActionsMenu && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 240,
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 12,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                zIndex: 100,
                overflow: 'hidden',
                padding: 6
              }}
            >
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setShowActionsMenu(false)
                  router.push(`/agenda-digital/${aluno.id}/frequencia`)
                }}
              >
                <CalendarIcon size={14} style={{ marginRight: 8 }} /> Ver Frequência & Catraca
              </button>

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setShowActionsMenu(false)
                  router.push(`/saida-alunos/chamadas`)
                }}
              >
                <LogOut size={14} style={{ marginRight: 8 }} /> Painel de Saída (Chamadas)
              </button>

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setShowActionsMenu(false)
                  router.push(`/agenda-digital/admin/comunicados?novo=true&aluno_id=${aluno.id}`)
                }}
              >
                <MessageSquare size={14} style={{ marginRight: 8 }} /> Enviar Comunicado
              </button>

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setShowActionsMenu(false)
                  router.push(`/academico/ocorrencias?aluno_id=${aluno.id}`)
                }}
              >
                <AlertCircle size={14} style={{ marginRight: 8 }} /> Ver Ocorrências
              </button>

              <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', color: aluno.bloqueadoAgenda ? '#10b981' : '#ef4444' }}
                onClick={() => {
                  setShowActionsMenu(false)
                  handleToggleBlockAccess()
                }}
              >
                {aluno.bloqueadoAgenda ? <Unlock size={14} style={{ marginRight: 8 }} /> : <Lock size={14} style={{ marginRight: 8 }} />}
                {aluno.bloqueadoAgenda ? 'Desbloquear Acesso' : 'Bloquear Acesso'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Layout: Left (Guardians & Metrics) | Right (Timeline History) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: 32 }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Card: Engajamento (Família) */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#4f46e5" /> Engajamento (Família)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Leitura de Comunicados</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: readingRate > 50 ? '#10b981' : 'hsl(var(--text-muted))' }}>
                    {readingRate}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'rgba(16,185,129,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${readingRate}%`, height: '100%', background: readingRate > 50 ? '#10b981' : '#f59e0b', transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 6 }}>
                  {totalComunicados > 0 ? `${readComunicados.length} de ${totalComunicados} comunicados lidos` : '0 de 0 comunicados lidos'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                <div style={{ padding: 12, background: 'hsl(var(--bg-main))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Dispositivos</div>
                  <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Smartphone size={16} color={connectedDevices > 0 ? '#4f46e5' : 'hsl(var(--text-muted))'} />
                    {connectedDevices === 0 ? 'Nenhum' : connectedDevices === 1 ? '1 Dispositivo' : `${connectedDevices} Dispositivos`}
                  </div>
                </div>

                <div style={{ padding: 12, background: 'hsl(var(--bg-main))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Ocorrências</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: realOcorrencias.length > 0 ? '#ef4444' : 'inherit', marginTop: 2 }}>
                    {isLoadingOcorrencias ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : realOcorrencias.length > 0 ? (
                      `${realOcorrencias.length} Reg.`
                    ) : (
                      'Nenhuma'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Portaria & Frequência (iDFace e Saída) */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogIn size={18} color="#10b981" /> Portaria & Frequência
              </h3>
              {(isLoadingPortaria || isLoadingSaidaCalls) && <Loader2 size={16} className="animate-spin text-muted" />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Catraca iDFace Summary */}
              <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: 12, background: 'hsl(var(--bg-main))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Entradas iDFace</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Reconhecimento Facial</div>
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ fontWeight: 700, fontSize: 11 }}>
                    {idfaceEntriesCount} Acesso(s)
                  </span>
                </div>
                {latestIdfaceEvent && (
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 8, paddingTop: 8, borderTop: '1px dashed hsl(var(--border-subtle))' }}>
                    Última entrada: <strong>{formatDatePtBr(latestIdfaceEvent.data_hora)}</strong> ({latestIdfaceEvent.dispositivo_nome || 'Portaria iDFace'})
                  </div>
                )}
              </div>

              {/* Saídas Confirmadas Summary */}
              <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: 12, background: 'hsl(var(--bg-main))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LogOut size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Saídas Confirmadas</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Painel de Chamadas</div>
                    </div>
                  </div>
                  <span className="badge" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', fontWeight: 700, fontSize: 11 }}>
                    {confirmedSaidasCount} Chamada(s)
                  </span>
                </div>
                {latestSaidaCall && (
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 8, paddingTop: 8, borderTop: '1px dashed hsl(var(--border-subtle))' }}>
                    Última saída: <strong>{formatDatePtBr(latestSaidaCall.created_at)}</strong> (Para: {latestSaidaCall.guardianName || 'Responsável'})
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card: Credenciais (Responsáveis) */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Credenciais (Responsáveis)</h3>
              {isLoadingResponsaveis && <Loader2 size={16} className="animate-spin text-muted" />}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {responsaveis.length > 0 ? (
                responsaveis.map((resp, i) => (
                  <div key={resp.id || i} style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16, background: 'hsl(var(--bg-main))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-main))' }}>{resp.nome}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <span className="badge" style={{ background: resp.badgeBg, color: resp.color, fontSize: 11, padding: '2px 8px', fontWeight: 600 }}>
                            {resp.tipo}
                          </span>
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                            • {resp.appInstalado || resp.app_instalado || resp.ultimoAcesso || resp.ultimo_acesso ? 'App Instalado (Ativo)' : 'Cadastro Sincronizado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {(resp.email || resp.telefone || resp.cpf) && (
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {resp.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Mail size={12} /> {resp.email}
                          </div>
                        )}
                        {resp.telefone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Phone size={12} /> {resp.telefone}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => handleResetPassword(resp)}
                      >
                        <Key size={14} style={{ marginRight: 4 }} /> Resetar Senha
                      </button>

                      <button
                        className="btn btn-ghost btn-sm"
                        title="Ver detalhes de contato"
                        onClick={() => setSelectedRespModal(resp)}
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 8 }}>
                  Nenhum responsável vinculado encontrado neste cadastro.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline / History */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 500 }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Histórico Recente (Logs do App)</h3>
              {filteredLogs.length > 0 && (
                <span className="badge badge-ghost" style={{ fontSize: 11, fontWeight: 700 }}>
                  {filteredLogs.length} evento(s)
                </span>
              )}
            </div>

            {/* Filter Toggle */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Filter size={14} /> {logFilter === 'todos' ? 'Filtrar' : `Filtro: ${logFilter}`}
              </button>

              {showFilterDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 36,
                    right: 0,
                    width: 220,
                    background: 'hsl(var(--bg-surface))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 10,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                    zIndex: 90,
                    padding: 6
                  }}
                >
                  {[
                    { id: 'todos', label: 'Todos os Logs' },
                    { id: 'portaria', label: 'Portaria (iDFace & Saída)' },
                    { id: 'comunicados', label: 'Comunicados' },
                    { id: 'ocorrencias', label: 'Ocorrências' },
                    { id: 'financeiro', label: 'Financeiro' },
                    { id: 'acessos', label: 'Acessos / App' }
                  ].map(item => (
                    <button
                      key={item.id}
                      className="btn btn-ghost btn-sm"
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        fontWeight: logFilter === item.id ? 700 : 400,
                        background: logFilter === item.id ? 'hsl(var(--bg-overlay))' : 'transparent'
                      }}
                      onClick={() => {
                        setLogFilter(item.id as any)
                        setShowFilterDropdown(false)
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', flex: 1 }}>
              {filteredLogs.length > 0 && (
                <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: 'hsl(var(--border-subtle))', zIndex: 0 }} />
              )}

              {filteredLogs.length > 0 ? (
                filteredLogs.slice(0, visibleLogCount).map((log: any) => {
                  let IconRender = CheckCircle2
                  if (log.type === 'doc') IconRender = FileText
                  else if (log.type === 'download') IconRender = Download
                  else if (log.type === 'alert') IconRender = AlertTriangle

                  return (
                    <div key={log.id} style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: log.type === 'check' ? '#10b981' : log.type === 'alert' ? 'rgba(239, 68, 68, 0.15)' : 'hsl(var(--bg-overlay))',
                          color: log.type === 'check' ? 'white' : log.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: log.type !== 'check' ? '1px solid hsl(var(--border-subtle))' : 'none'
                        }}
                      >
                        <IconRender size={20} />
                      </div>

                      <div style={{ paddingTop: 2, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{log.title}</span>
                          {log.categoryLabel && (
                            <span className="badge badge-ghost" style={{ fontSize: 10, padding: '1px 6px' }}>
                              {log.categoryLabel}
                            </span>
                          )}
                        </div>

                        {log.details && (
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{log.details}</div>
                        )}

                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {log.time}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}>
                  <AlertTriangle size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: 'hsl(var(--text-main))', margin: '0 0 8px 0' }}>Sem dados recentes</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: 14, maxWidth: 360 }}>
                    Esta família ainda não possui histórico de interações com o App.
                  </p>
                  <button className="btn btn-secondary" onClick={generateSimulatedLogs}>
                    <RefreshCw size={14} style={{ marginRight: 6 }} /> Gerar Dados Simulados
                  </button>
                </div>
              )}
            </div>
            
            {filteredLogs.length > visibleLogCount && (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: 28 }}
                onClick={() => setVisibleLogCount(prev => prev + 10)}
              >
                Carregar logs mais antigos ({filteredLogs.length - visibleLogCount} restantes)
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Modal: Guardians Contact & Info */}
      {selectedRespModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
          onClick={() => setSelectedRespModal(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 440, padding: 24, background: 'hsl(var(--bg-surface))' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Detalhes do Responsável</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRespModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Nome Completo</label>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{selectedRespModal.nome}</div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Vínculo / Papel</label>
                <div style={{ marginTop: 4 }}>
                  <span className="badge" style={{ background: selectedRespModal.badgeBg, color: selectedRespModal.color, fontWeight: 600 }}>
                    {selectedRespModal.tipo || 'Responsável'}
                  </span>
                </div>
              </div>

              {selectedRespModal.cpf && (
                <div>
                  <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>CPF</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                    {selectedRespModal.cpf}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 4 }}
                      onClick={() => copyToClipboard(selectedRespModal.cpf, 'cpf')}
                    >
                      {copiedField === 'cpf' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {selectedRespModal.email && (
                <div>
                  <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>E-mail</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                    {selectedRespModal.email}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 4 }}
                      onClick={() => copyToClipboard(selectedRespModal.email, 'email')}
                    >
                      {copiedField === 'email' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {selectedRespModal.telefone && (
                <div>
                  <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Telefone / WhatsApp</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                    {selectedRespModal.telefone}
                    <a
                      href={`https://wa.me/55${selectedRespModal.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }}
                    >
                      WhatsApp <ExternalLink size={12} style={{ marginLeft: 4 }} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRespModal(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
