'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, User, MessageSquare, MoreHorizontal, Key,
  Mail, Phone, Calendar as CalendarIcon, FileText, Download, TrendingUp,
  CheckCircle2, AlertTriangle, Lock, Unlock, Loader2, Eye,
  ExternalLink, Copy, Check, Smartphone, RefreshCw, X, AlertCircle, Clock,
  LogIn, LogOut, UserCheck, Search, RotateCcw, CreditCard, Bell
} from 'lucide-react'
import Link from 'next/link'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { UserAvatar } from '@/components/UserAvatar'
import { getWhatsAppShareUrl } from '@/lib/whatsapp'

const SCHOOL_TZ = 'America/Campo_Grande'

function getSchoolTodayYmd(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: SCHOOL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function getSchoolYesterdayYmd(): string {
  try {
    const d = new Date(Date.now() - 86400000)
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: SCHOOL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d)
  } catch {
    return ''
  }
}

/**
 * Conforme documentado em /api/portaria/webhook/route.ts:
 * portaria_eventos.data_hora armazena os dígitos já no horário local da escola (America/Campo_Grande)
 * com sufixo UTC ('Z' ou '+00:00'). Ex: "2026-10-21T07:18:00.000Z" representa 07:18 local.
 * Esta função normaliza a string para o offset real '-04:00', evitando desconto duplo de 4 horas.
 */
function normalizePortariaTimestamp(rawDate: any): string | null {
  if (!rawDate) return null
  const str = String(rawDate).trim()
  if (!str) return null
  const isoLike = str.replace(' ', 'T')
  // Se termina com Z ou +00 / +00:00, substitui pelo fuso local da escola (-04:00)
  if (/(?:Z|\+00(?::00)?)$/i.test(isoLike)) {
    return isoLike.replace(/(?:Z|\+00(?::00)?)$/i, '-04:00')
  }
  // Se tem T mas não tem offset explícito no final
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoLike) && !/[+-]\d{2}:?\d{2}$/.test(isoLike)) {
    return `${isoLike}-04:00`
  }
  return isoLike
}

/**
 * Converte qualquer data/hora para timestamp numérico seguro (ms) considerando datas puras YYYY-MM-DD
 * no meio-dia local da escola (-04:00) para nunca recuar 1 dia.
 */
function parseSafeTimestamp(rawDate: any): number {
  if (!rawDate) return 0
  if (typeof rawDate === 'number') return rawDate
  const str = String(rawDate).trim()
  if (!str) return 0

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T12:00:00-04:00`)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }

  // Formato DD/MM/YYYY opcionalmente com hora
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  if (brMatch) {
    const [, dd, mm, yyyy, hh = '12', min = '00'] = brMatch
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00-04:00`)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }

  const normalized =
    str.includes('T') && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)
      ? `${str}-04:00`
      : str

  const d = new Date(normalized)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

/**
 * Formata datas puras (YYYY-MM-DD) apenas como DD/MM/AAAA (sem hora fictícia "às 20:00")
 * e timestamps completos como "Hoje às HH:mm", "Ontem às HH:mm" ou "DD/MM/AAAA às HH:mm"
 * sempre no fuso America/Campo_Grande.
 */
function formatDatePtBr(rawDate: any, options?: { dateOnly?: boolean }): string {
  if (!rawDate) return '—'
  const str = String(rawDate).trim()
  if (!str) return '—'

  if (
    str.includes('Hoje') ||
    str.includes('Ontem') ||
    str.includes('Segunda') ||
    str.includes('Terça') ||
    str.includes('Quarta') ||
    str.includes('Quinta') ||
    str.includes('Sexta') ||
    str.includes('Sábado') ||
    str.includes('Domingo')
  ) {
    return str
  }

  const todayYmd = getSchoolTodayYmd()
  const yesterdayYmd = getSchoolYesterdayYmd()

  // Caso 1: Data pura YYYY-MM-DD (ex: vencimento de boleto, data de frequência, data de nascimento)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split('-')
    if (!options?.dateOnly) {
      if (str === todayYmd) return `Hoje (${dd}/${mm})`
      if (str === yesterdayYmd) return `Ontem (${dd}/${mm})`
    }
    return `${dd}/${mm}/${yyyy}`
  }

  // Caso 2: Data já em DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str
  }

  try {
    const ts = parseSafeTimestamp(str)
    if (!ts) return str
    const d = new Date(ts)

    const itemYmd = new Intl.DateTimeFormat('en-CA', {
      timeZone: SCHOOL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d)

    const dateStr = d.toLocaleDateString('pt-BR', { timeZone: SCHOOL_TZ })
    if (options?.dateOnly) return dateStr

    const timeStr = d.toLocaleTimeString('pt-BR', {
      timeZone: SCHOOL_TZ,
      hour: '2-digit',
      minute: '2-digit'
    })

    if (itemYmd === todayYmd) return `Hoje às ${timeStr}`
    if (itemYmd === yesterdayYmd) return `Ontem às ${timeStr}`

    return `${dateStr} às ${timeStr}`
  } catch {
    return str
  }
}

export default function ADAdminPessoaDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { turmas = [], alunos: contextAlunos = [] } = useData()
  const { adAlert, adConfirm } = useAgendaDigital()

  // Aluno individual carregado via /api/alunos/[id] (sem baixar a tabela inteira de alunos)
  const [fetchedAluno, setFetchedAluno] = useState<any | null>(null)
  const [isLoadingAluno, setIsLoadingAluno] = useState(true)

  // Estados de dados reais
  const [dbResponsaveis, setDbResponsaveis] = useState<any[]>([])
  const [isLoadingResponsaveis, setIsLoadingResponsaveis] = useState(true)
  const [pushDevicesByResp, setPushDevicesByResp] = useState<Record<string, any>>({})
  const [realOcorrencias, setRealOcorrencias] = useState<any[]>([])
  const [isLoadingOcorrencias, setIsLoadingOcorrencias] = useState(true)
  const [realTitulos, setRealTitulos] = useState<any[]>([])
  const [isLoadingTitulos, setIsLoadingTitulos] = useState(true)
  const [realPortariaEventos, setRealPortariaEventos] = useState<any[]>([])
  const [isLoadingPortaria, setIsLoadingPortaria] = useState(true)
  const [realSaidaCalls, setRealSaidaCalls] = useState<any[]>([])
  const [isLoadingSaidaCalls, setIsLoadingSaidaCalls] = useState(true)
  const [realFrequenciaDb, setRealFrequenciaDb] = useState<any[]>([])
  const [isLoadingFrequencia, setIsLoadingFrequencia] = useState(true)
  const [realComunicados, setRealComunicados] = useState<any[]>([])
  const [isLoadingComunicados, setIsLoadingComunicados] = useState(true)
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)

  // UI States
  const [logFilter, setLogFilter] = useState<'todos' | 'portaria' | 'comunicados' | 'financeiro' | 'ocorrencias' | 'acessos'>('todos')
  const [periodFilter, setPeriodFilter] = useState<'todos' | 'hoje' | '7d' | '30d'>('todos')
  const [comunicadoStatusFilter, setComunicadoStatusFilter] = useState<'todos' | 'lidos' | 'pendentes'>('todos')
  const [logSearch, setLogSearch] = useState('')
  const [visibleLogCount, setVisibleLogCount] = useState(15)
  const [selectedRespModal, setSelectedRespModal] = useState<any | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)

  // Fallback imediato do contexto enquanto a API individual responde
  const contextAluno = useMemo(() => {
    if (!contextAlunos || contextAlunos.length === 0 || !id) return null
    const paramIdStr = String(id).trim()
    return (contextAlunos || []).find((a: any) =>
      String(a.id) === paramIdStr ||
      String(a.matricula) === paramIdStr ||
      String(a.dados?.codigo) === paramIdStr ||
      String(a.codigo) === paramIdStr
    ) || null
  }, [contextAlunos, id])

  const aluno = fetchedAluno || contextAluno

  // Função centralizada para carregar todos os dados do aluno em paralelo
  const fetchAllStudentData = useCallback(async (silent = false) => {
    if (!id) return
    if (!silent) {
      setIsLoadingAluno(true)
      setIsLoadingResponsaveis(true)
      setIsLoadingComunicados(true)
      setIsLoadingOcorrencias(true)
      setIsLoadingTitulos(true)
      setIsLoadingPortaria(true)
      setIsLoadingSaidaCalls(true)
      setIsLoadingFrequencia(true)
    } else {
      setIsRefreshingAll(true)
    }

    const paramId = String(id).trim()

    try {
      // 1. Busca o aluno individual (rápido, 1 registro)
      const alunoRes = await fetch(`/api/alunos/${encodeURIComponent(paramId)}`).catch(() => null)
      let resolvedStudent: any = contextAluno
      if (alunoRes && alunoRes.ok) {
        const alunoJson = await alunoRes.json().catch(() => null)
        if (alunoJson?.data) {
          resolvedStudent = alunoJson.data
          setFetchedAluno(alunoJson.data)
          if (Array.isArray(alunoJson.data.responsaveis) && alunoJson.data.responsaveis.length > 0) {
            setDbResponsaveis(alunoJson.data.responsaveis)
          }
        }
      }
      setIsLoadingAluno(false)

      const studentId = String(resolvedStudent?.id || paramId).trim()
      const studentMatricula = String(resolvedStudent?.matricula || resolvedStudent?.dados?.codigo || paramId).trim()
      const studentTurma = String(resolvedStudent?.turma || '').trim()

      // 2. Dispara todas as consultas específicas em paralelo (sem waterfall)
      await Promise.allSettled([
        // Responsáveis enriquecidos com status real de Auth (last_sign_in_at / temContaAtiva)
        fetch(`/api/aluno-responsavel?aluno_id=${encodeURIComponent(studentId)}`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              if (Array.isArray(data?.responsaveis) && data.responsaveis.length > 0) {
                setDbResponsaveis(data.responsaveis)
              }
            }
          })
          .finally(() => setIsLoadingResponsaveis(false)),

        // Comunicados do aluno (com limite ampliado para cálculo fiel de leitura)
        fetch(`/api/comunicados?aluno_id=${encodeURIComponent(studentId)}&limit=100`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
              setRealComunicados(list)
            }
          })
          .finally(() => setIsLoadingComunicados(false)),

        // Ocorrências pedagógicas
        fetch(`/api/ocorrencias?aluno_id=${encodeURIComponent(studentId)}`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              if (Array.isArray(data)) setRealOcorrencias(data)
            }
          })
          .finally(() => setIsLoadingOcorrencias(false)),

        // Títulos financeiros / Boletos
        fetch(`/api/financeiro/titulos?alunoId=${encodeURIComponent(studentId)}`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              if (Array.isArray(data)) setRealTitulos(data)
            }
          })
          .finally(() => setIsLoadingTitulos(false)),

        // Eventos da Catraca ControliD iDFace
        fetch(`/api/portaria/eventos?aluno_id=${encodeURIComponent(studentId)}&matricula=${encodeURIComponent(studentMatricula)}&limit=100`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
              setRealPortariaEventos(list)
            }
          })
          .finally(() => setIsLoadingPortaria(false)),

        // Chamadas de Saída (Painel de Chamadas)
        fetch(`/api/saida/calls?studentId=${encodeURIComponent(studentId)}&from=2020-01-01&to=2030-12-31&limit=100`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              if (Array.isArray(data)) setRealSaidaCalls(data)
            }
          })
          .finally(() => setIsLoadingSaidaCalls(false)),

        // Frequência / Diário de Classe
        fetch(`/api/academico/frequencias?aluno_id=${encodeURIComponent(studentId)}${studentTurma ? `&turma_id=${encodeURIComponent(studentTurma)}` : ''}&limit=200`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              if (Array.isArray(data)) setRealFrequenciaDb(data)
            }
          })
          .finally(() => setIsLoadingFrequencia(false)),

        // Enriquecimento opcional de aparelhos Push OneSignal reais (não bloqueante)
        fetch(`/api/agenda/push/test?aluno_id=${encodeURIComponent(studentId)}`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json()
              if (Array.isArray(data?.responsaveis)) {
                const map: Record<string, any> = {}
                data.responsaveis.forEach((r: any) => {
                  if (r.responsavel_id) map[String(r.responsavel_id).trim()] = r
                  if (r.email) map[String(r.email).toLowerCase().trim()] = r
                })
                setPushDevicesByResp(map)
              }
            }
          })
          .catch(() => null)
      ])
    } finally {
      setIsLoadingAluno(false)
      setIsRefreshingAll(false)
    }
  }, [id, contextAluno])

  useEffect(() => {
    fetchAllStudentData(false)
  }, [id])

  // Resolução de Turma
  const turmaObj = (turmas || []).find((t: any) => String(t.id) === String(aluno?.turma)) ||
                   (turmas || []).find((t: any) => String(t.nome) === String(aluno?.turma))
  const resolvedTurmaNome = turmaObj?.nome || aluno?.turma_nome || aluno?.turma || 'Sem Turma'

  // Mapeamento de Responsáveis com enriquecimento de conta ativa, último login e aparelhos Push
  const responsaveis: any[] = []
  const rawRespSource = dbResponsaveis && dbResponsaveis.length > 0
    ? dbResponsaveis
    : (Array.isArray(aluno?.responsaveis) && aluno.responsaveis.length > 0 ? aluno.responsaveis : [])

  if (rawRespSource.length > 0) {
    rawRespSource.forEach((r: any) => {
      if (!r || !r.nome) return
      let tipo = 'Responsável'
      let color = 'hsl(var(--text-secondary))'
      let badgeBg = 'hsl(var(--bg-overlay))'

      const isFin = Boolean(r.isFinanceiro || r.respFinanceiro || r.resp_financeiro)
      const isPed = Boolean(r.isPedagogico || r.respPedagogico || r.resp_pedagogico)

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

      const rIdKey = String(r.id || r.responsavel_id || '').trim()
      const rEmailKey = String(r.email || '').toLowerCase().trim()
      const pushInfo = (rIdKey && pushDevicesByResp[rIdKey]) || (rEmailKey && pushDevicesByResp[rEmailKey]) || null

      const ultimoAcesso = r.ultimoAcesso || r.ultimo_acesso || pushInfo?.ultimoAcesso || null
      const temContaAtiva = Boolean(r.temContaAtiva || pushInfo?.temContaAtiva || ultimoAcesso || r.appInstalado || r.app_instalado)
      const dispositivosAtivos = typeof pushInfo?.dispositivosAtivos === 'number' ? pushInfo.dispositivosAtivos : 0
      const totalDispositivos = typeof pushInfo?.totalDispositivos === 'number' ? pushInfo.totalDispositivos : 0

      responsaveis.push({
        ...r,
        id: r.id || r.responsavel_id,
        auth_id: r.auth_id || pushInfo?.authId || null,
        email: r.email || pushInfo?.email || '',
        telefone: r.telefone || r.celular || pushInfo?.telefone || '',
        cpf: r.cpf || r.dados?.cpf || '',
        tipo,
        color,
        badgeBg,
        ultimoAcesso,
        temContaAtiva,
        dispositivosAtivos,
        totalDispositivos,
        dispositivos: pushInfo?.dispositivos || []
      })
    })
  } else if (aluno) {
    if (aluno.responsavelFinanceiro || aluno.responsavel_financeiro) {
      responsaveis.push({
        nome: aluno.responsavelFinanceiro || aluno.responsavel_financeiro,
        tipo: 'Financeiro',
        color: '#10b981',
        badgeBg: 'rgba(16,185,129,0.1)',
        parentesco: 'Responsável Financeiro',
        temContaAtiva: false
      })
    }
    if (aluno.responsavelPedagogico || aluno.responsavel_pedagogico) {
      responsaveis.push({
        nome: aluno.responsavelPedagogico || aluno.responsavel_pedagogico,
        tipo: 'Pedagógico',
        color: '#4f46e5',
        badgeBg: 'rgba(99,102,241,0.1)',
        parentesco: 'Responsável Pedagógico',
        temContaAtiva: false
      })
    }
    if (aluno.responsavel && aluno.responsavel !== aluno.responsavelFinanceiro && aluno.responsavel !== aluno.responsavelPedagogico) {
      responsaveis.push({
        nome: aluno.responsavel,
        tipo: 'Responsável',
        color: 'hsl(var(--text-secondary))',
        badgeBg: 'hsl(var(--bg-overlay))',
        parentesco: 'Responsável Geral',
        temContaAtiva: false
      })
    }
  }

  // Identificadores limpos do aluno para checagem de leitura de comunicados
  const studentIdClean = String(aluno?.id || id || '').replace(/^(a_|_ALU|_)/i, '').trim()
  const studentMatriculaClean = aluno?.matricula ? String(aluno.matricula).trim() : ''

  // Função auxiliar que verifica se o comunicado foi lido por esta família/aluno e extrai o timestamp real da leitura
  const getComunicadoReadInfo = (c: any): { isRead: boolean; hasCiencia: boolean; readAt: string | null } => {
    const leituras = c.leituras || c.dados?.leituras || {}
    const ciencias = c.ciencias || c.dados?.ciencias || {}
    const leiturasAlunosIds: string[] = Array.isArray(c.leituras_alunos_ids)
      ? c.leituras_alunos_ids.map((x: any) => String(x).replace(/^(a_|_ALU|_)/i, '').trim())
      : []

    let readAt: string | null = null
    let hasCiencia = false

    const pickTimestamp = (val: any) => {
      if (typeof val === 'string' && val.length >= 8 && val !== 'true') {
        if (!readAt || parseSafeTimestamp(val) > parseSafeTimestamp(readAt)) {
          readAt = val
        }
      }
    }

    // 1. Checar se o aluno está em leituras_alunos_ids (populado por /api/comunicados)
    let isRead = leiturasAlunosIds.includes(studentIdClean) || (Boolean(studentMatriculaClean) && leiturasAlunosIds.includes(studentMatriculaClean))

    // 2. Checar chaves diretas e compostas (usuarioId_alunoId) em leituras e ciencias
    Object.entries(leituras).forEach(([k, val]) => {
      const cleanK = String(k).trim()
      if (
        cleanK === studentIdClean ||
        cleanK === String(aluno?.id || '') ||
        (studentMatriculaClean && cleanK === studentMatriculaClean) ||
        cleanK.endsWith(`_${studentIdClean}`) ||
        (studentMatriculaClean && cleanK.endsWith(`_${studentMatriculaClean}`))
      ) {
        isRead = true
        pickTimestamp(val)
      }
    })

    Object.entries(ciencias).forEach(([k, val]) => {
      const cleanK = String(k).trim()
      if (
        cleanK === studentIdClean ||
        cleanK === String(aluno?.id || '') ||
        (studentMatriculaClean && cleanK === studentMatriculaClean) ||
        cleanK.endsWith(`_${studentIdClean}`) ||
        (studentMatriculaClean && cleanK.endsWith(`_${studentMatriculaClean}`))
      ) {
        isRead = true
        hasCiencia = true
        pickTimestamp(val)
      }
    })

    // 3. Checar pelos IDs e auth_ids dos responsáveis vinculados
    responsaveis.forEach((r: any) => {
      const candidateKeys = [r.id, r.auth_id].filter(Boolean).map(String)
      candidateKeys.forEach(rk => {
        if (leituras[rk]) {
          isRead = true
          pickTimestamp(leituras[rk])
        }
        if (leituras[`${rk}_${studentIdClean}`]) {
          isRead = true
          pickTimestamp(leituras[`${rk}_${studentIdClean}`])
        }
        if (ciencias[rk]) {
          isRead = true
          hasCiencia = true
          pickTimestamp(ciencias[rk])
        }
        if (ciencias[`${rk}_${studentIdClean}`]) {
          isRead = true
          hasCiencia = true
          pickTimestamp(ciencias[`${rk}_${studentIdClean}`])
        }
      })
    })

    return { isRead, hasCiencia, readAt }
  }

  // Comunicados relevantes vindos da rota oficial filtrada para o aluno (/api/comunicados?aluno_id=...)
  const relevantComunicados = useMemo(() => {
    return (realComunicados || []).filter((c: any) => {
      if (!c) return false
      if (c.status && c.status !== 'enviado' && c.status !== 'publicado') return false
      return true
    })
  }, [realComunicados])

  const comunicadosWithReadInfo = useMemo(() => {
    return relevantComunicados.map((c: any) => ({
      comunicado: c,
      ...getComunicadoReadInfo(c)
    }))
  }, [relevantComunicados, responsaveis, studentIdClean, studentMatriculaClean])

  const readComunicadosCount = comunicadosWithReadInfo.filter(item => item.isRead).length
  const totalComunicados = comunicadosWithReadInfo.length
  const readingRate = totalComunicados > 0
    ? Math.round((readComunicadosCount / totalComunicados) * 100)
    : 0

  // Métricas reais de contas e dispositivos conectados
  const activeAccountsCount = responsaveis.filter(r => r.temContaAtiva).length
  const totalPushDevices = responsaveis.reduce((acc, r) => acc + (r.dispositivosAtivos || 0), 0)
  const hasPushDataLoaded = Object.keys(pushDevicesByResp).length > 0

  // Separar eventos da catraca iDFace (Entradas vs Saídas) e corrigir o fuso horário
  const validIdfaceEntries = useMemo(() => {
    return (realPortariaEventos || [])
      .filter((e: any) => {
        if (!e || !e.data_hora) return false
        const s = String(e.status || '').toLowerCase().trim()
        const isOk = !s || ['sucesso', 'liberado', 'autorizado', 'ok', 'permitido', 'entrada'].includes(s)
        const tipo = String(e.tipo || e.sentido || 'entrada').toLowerCase().trim()
        return isOk && tipo !== 'saida'
      })
      .map((e: any) => {
        const normalizedIso = normalizePortariaTimestamp(e.data_hora) || e.data_hora
        return {
          ...e,
          normalizedIso,
          timestamp: parseSafeTimestamp(normalizedIso)
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [realPortariaEventos])

  // Filtrar chamadas de saída reais (confirmadas ou chamadas com data real) e ordenar da mais recente para a mais antiga
  const validSaidaCalls = useMemo(() => {
    return (realSaidaCalls || [])
      .filter((sc: any) => {
        if (!sc) return false
        // Ignorar autorizações permanentes/multi-dias que não tiveram saída confirmada
        if (sc.status === 'special_auth' && !sc.confirmedOut && !sc.confirmedAt) return false
        return sc.status === 'confirmed' || sc.status === 'called' || sc.status === 'waiting' || Boolean(sc.confirmedOut)
      })
      .map((sc: any) => {
        const rawDt = sc.confirmedAt || sc.calledAt || sc.created_at || sc.updated_at || null
        const timestamp = parseSafeTimestamp(rawDt)
        return {
          ...sc,
          effectiveDate: rawDt,
          timestamp
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [realSaidaCalls])

  const confirmedSaidasCount = validSaidaCalls.filter(
    (c: any) => c.status === 'confirmed' || Boolean(c.confirmedOut)
  ).length

  const latestIdfaceEvent = validIdfaceEntries[0] || null
  const latestSaidaCall = validSaidaCalls[0] || null

  // Status de HOJE na escola (para visão rápida da secretaria/coordenação)
  const todayYmd = getSchoolTodayYmd()
  const todayEntry = useMemo(() => {
    return validIdfaceEntries.find(e => {
      if (!e.normalizedIso) return false
      return String(e.normalizedIso).slice(0, 10) === todayYmd
    }) || null
  }, [validIdfaceEntries, todayYmd])

  const todayExit = useMemo(() => {
    return validSaidaCalls.find(sc => {
      if (!sc.timestamp) return false
      const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TZ }).format(new Date(sc.timestamp))
      return ymd === todayYmd
    }) || null
  }, [validSaidaCalls, todayYmd])

  // Estatísticas de Frequência Acadêmica (Diário de Classe)
  const attendanceStats = useMemo(() => {
    const total = realFrequenciaDb.length
    const faltasInjustificadas = realFrequenciaDb.filter((f: any) => f.presente === false && !String(f.justificativa || '').toLowerCase().includes('justifica')).length
    const faltasJustificadas = realFrequenciaDb.filter((f: any) => f.presente === false && String(f.justificativa || '').toLowerCase().includes('justifica')).length
    const presencas = Math.max(0, total - faltasInjustificadas - faltasJustificadas)
    const pct = total > 0 ? Math.round(((presencas + faltasJustificadas) / total) * 100) : 100
    return { total, presencas, faltasInjustificadas, faltasJustificadas, pct }
  }, [realFrequenciaDb])

  // Estatísticas Financeiras
  const financialStats = useMemo(() => {
    const pagos = realTitulos.filter((t: any) => t.status === 'pago' || t.status === 'quitado')
    const vencidos = realTitulos.filter((t: any) => {
      if (t.status === 'pago' || t.status === 'quitado' || t.status === 'cancelado') return false
      if (t.status === 'atrasado' || t.status === 'vencido') return true
      if (t.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(String(t.vencimento)) && String(t.vencimento) < todayYmd) return true
      return false
    })
    const pendentes = realTitulos.filter((t: any) => {
      if (t.status === 'pago' || t.status === 'quitado' || t.status === 'cancelado') return false
      return !vencidos.includes(t)
    })
    return { total: realTitulos.length, pagos: pagos.length, vencidos: vencidos.length, pendentes: pendentes.length }
  }, [realTitulos, todayYmd])

  // ============================================================================
  // CONSTRUÇÃO DA TIMELINE CRONOLÓGICA REAL (SEM DATAS FALSAS / SEM DUPLICATAS)
  // ============================================================================
  const sortedLogs = useMemo(() => {
    const combinedLogs: any[] = []

    // 1. Entradas na Catraca iDFace (com fuso corrigido e separadas de saídas)
    ;(realPortariaEventos || []).forEach((e: any) => {
      if (!e || !e.data_hora) return
      const tipo = String(e.tipo || e.sentido || 'entrada').toLowerCase().trim()
      // Saídas da catraca já vêm unificadas em /api/saida/calls; evitamos duplicar na timeline
      if (tipo === 'saida') return

      const normalizedIso = normalizePortariaTimestamp(e.data_hora) || e.data_hora
      const ts = parseSafeTimestamp(normalizedIso)
      if (!ts) return

      const s = String(e.status || '').toLowerCase().trim()
      const isSuccess = !s || ['sucesso', 'liberado', 'autorizado', 'ok', 'permitido', 'entrada'].includes(s)

      combinedLogs.push({
        id: `idface-${e.id}`,
        type: isSuccess ? 'login' : 'alert',
        category: 'portaria',
        title: isSuccess ? 'Entrada reconhecida via Catraca iDFace' : 'Tentativa de passagem na Catraca iDFace',
        time: formatDatePtBr(normalizedIso),
        timestamp: ts,
        color: isSuccess ? '#10b981' : '#ef4444',
        details: `Equipamento: ${e.dispositivo_nome || 'Portaria iDFace'} • Status: ${isSuccess ? 'Acesso Liberado' : (e.status || 'Não Reconhecido')}`,
        categoryLabel: 'Catraca iDFace'
      })
    })

    // 2. Saídas Confirmadas no Painel de Chamadas / Catraca de Saída
    validSaidaCalls.forEach((sc: any) => {
      if (!sc.effectiveDate || !sc.timestamp) return
      const isConfirmed = sc.status === 'confirmed' || Boolean(sc.confirmedOut)
      const isCatracaExit = sc.source === 'catraca' || sc.origem === 'catraca_idface'

      combinedLogs.push({
        id: `saida-${sc.id}`,
        type: 'logout',
        category: 'portaria',
        title: isCatracaExit
          ? 'Saída registrada via Catraca iDFace'
          : isConfirmed
            ? 'Saída de aluno confirmada na Portaria'
            : 'Chamada de saída solicitada na Portaria',
        time: formatDatePtBr(sc.effectiveDate),
        timestamp: sc.timestamp,
        color: isConfirmed ? '#4f46e5' : '#f59e0b',
        details: `Liberado para: ${sc.guardianName || sc.responsavelNome || 'Responsável Cadastrado'} • Status: ${isConfirmed ? 'Saída Confirmada' : 'Aguardando na Portaria'}`,
        categoryLabel: isCatracaExit ? 'Catraca Saída' : 'Saída Chamada'
      })
    })

    // 3. Faltas em Sala de Aula (Diário de Classe)
    ;(realFrequenciaDb || []).forEach((f: any) => {
      const isPresent = f.presente !== false && !f.falta
      if (isPresent || !f.data) return
      const isJustified = String(f.justificativa || '').toLowerCase().includes('justifica')
      const ts = parseSafeTimestamp(f.data)

      combinedLogs.push({
        id: `freq-${f.id || f.data}`,
        type: 'alert',
        category: 'ocorrencias',
        title: isJustified ? 'Falta Justificada em Sala de Aula' : 'Falta Registrada em Sala de Aula',
        time: formatDatePtBr(f.data, { dateOnly: true }),
        timestamp: ts,
        color: isJustified ? '#f59e0b' : '#ef4444',
        details: `Data da aula: ${formatDatePtBr(f.data, { dateOnly: true })}${f.registradoPor ? ` • Lançado por: ${f.registradoPor}` : ''}`,
        categoryLabel: 'Frequência'
      })
    })

    // 4. Comunicados (com distinção real entre Lido/Ciente com data da leitura vs Pendente de leitura)
    comunicadosWithReadInfo.forEach(({ comunicado: c, isRead, hasCiencia, readAt }) => {
      const sentDate = c.dataEnvio || c.data || c.created_at || c.dados?.dataEnvio || c.dados?.created_at
      // Se foi lido e temos o timestamp da leitura, ordenamos e exibimos pela data real da leitura!
      const effectiveDate = (isRead && readAt) ? readAt : sentDate
      const ts = parseSafeTimestamp(effectiveDate)
      if (!ts) return

      const tituloStr = c.titulo || c.assunto || c.dados?.titulo || c.dados?.assunto || 'Informativo Escolar'
      const autorStr = c.autor || c.dados?.autor || 'Coordenação'
      const sentFormatted = sentDate ? formatDatePtBr(sentDate) : ''

      combinedLogs.push({
        id: `com-${c.id}`,
        type: 'doc',
        category: 'comunicados',
        isRead,
        hasCiencia,
        title: hasCiencia
          ? `Confirmou Ciência no Comunicado: "${tituloStr}"`
          : isRead
            ? `Visualizou Comunicado: "${tituloStr}"`
            : `Comunicado Pendente de Leitura: "${tituloStr}"`,
        time: formatDatePtBr(effectiveDate),
        timestamp: ts,
        color: hasCiencia ? '#10b981' : isRead ? '#4f46e5' : '#f59e0b',
        details: isRead && readAt && sentFormatted
          ? `Lido pela família em ${formatDatePtBr(readAt)} • Enviado por ${autorStr} (${sentFormatted})`
          : `Enviado por ${autorStr} • Categoria: ${c.categoria || c.dados?.categoria || 'Geral'} • Status: ${isRead ? 'Lido pela família' : 'Ainda não lido'}`,
        categoryLabel: hasCiencia ? 'Ciente' : isRead ? 'Comunicado Lido' : 'Não Lido'
      })
    })

    // 5. Ocorrências Pedagógicas
    ;(realOcorrencias || []).forEach((oc: any) => {
      const rawDate = oc.created_at || oc.data
      const ts = parseSafeTimestamp(rawDate)
      if (!ts) return
      const hasCienciaResp = Boolean(oc.ciencia_responsavel || oc.dados?.ciencia_responsavel)

      combinedLogs.push({
        id: `oc-${oc.id}`,
        type: 'alert',
        category: 'ocorrencias',
        title: `Ocorrência: ${oc.titulo || oc.tipo || oc.tipo_id || 'Registro Pedagógico'}`,
        time: formatDatePtBr(rawDate),
        timestamp: ts,
        color: '#ef4444',
        details: `${oc.descricao || oc.observacao || 'Sem descrição detalhada'}${hasCienciaResp ? ' • ✅ Família ciente' : ' • ⏳ Aguardando ciência da família'}`,
        categoryLabel: 'Ocorrência'
      })
    })

    // 6. Títulos Financeiros / Boletos (sem shift de -1 dia no vencimento)
    ;(realTitulos || []).forEach((t: any) => {
      const isPaid = t.status === 'pago' || t.status === 'quitado'
      const isOverdue =
        !isPaid &&
        (t.status === 'atrasado' ||
          t.status === 'vencido' ||
          (t.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(String(t.vencimento)) && String(t.vencimento) < todayYmd))

      const rawDate = (isPaid && (t.data_pagamento || t.pagamento)) || t.vencimento || t.created_at
      const ts = parseSafeTimestamp(rawDate)
      if (!ts) return

      const formattedValor = Number(t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      const vencStr = t.vencimento ? formatDatePtBr(t.vencimento, { dateOnly: true }) : 'A definir'

      combinedLogs.push({
        id: `tit-${t.id}`,
        type: isPaid ? 'check' : isOverdue ? 'alert' : 'download',
        category: 'financeiro',
        title: `${isPaid ? 'Boleto Quitado' : isOverdue ? 'Boleto Vencido' : 'Boleto em Aberto'}: ${t.descricao || t.eventoDescricao || 'Mensalidade Escolar'} (R$ ${formattedValor})`,
        time: formatDatePtBr(rawDate, { dateOnly: /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate || '')) }),
        timestamp: ts,
        color: isPaid ? '#10b981' : isOverdue ? '#ef4444' : '#f59e0b',
        details: `Vencimento: ${vencStr}${isPaid && (t.data_pagamento || t.pagamento) ? ` • Pago em: ${formatDatePtBr(t.data_pagamento || t.pagamento, { dateOnly: true })}` : ''} • Status: ${isPaid ? 'Quitado' : isOverdue ? 'Em Atraso' : 'A vencer'}`,
        categoryLabel: 'Financeiro'
      })
    })

    // 7. Último Login Real dos Responsáveis no App (vindo do Supabase Auth last_sign_in_at)
    responsaveis.forEach((r: any) => {
      const lastAccess = r.ultimoAcesso || r.ultimo_acesso
      const ts = parseSafeTimestamp(lastAccess)
      if (ts > 0) {
        combinedLogs.push({
          id: `resp-access-${r.id || r.cpf || r.nome}`,
          type: 'check',
          category: 'acessos',
          title: `Último login no App por ${r.nome}`,
          time: formatDatePtBr(lastAccess),
          timestamp: ts,
          color: '#10b981',
          details: `Vínculo: ${r.tipo}${r.dispositivosAtivos ? ` • ${r.dispositivosAtivos} aparelho(s) Push ativo(s)` : ''}`,
          categoryLabel: 'Login App'
        })
      }
    })

    // Deduplicar por ID e ordenar do mais recente para o mais antigo
    const uniqueMap = new Map<string, any>()
    combinedLogs.forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item)
      }
    })

    return Array.from(uniqueMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }, [realPortariaEventos, validSaidaCalls, realFrequenciaDb, comunicadosWithReadInfo, realOcorrencias, realTitulos, responsaveis, todayYmd])

  // Contadores por categoria para as abas rápidas
  const categoryCounts = useMemo(() => {
    const counts = {
      todos: sortedLogs.length,
      portaria: 0,
      comunicados: 0,
      financeiro: 0,
      ocorrencias: 0,
      acessos: 0
    }
    sortedLogs.forEach(l => {
      if (l.category && counts[l.category as keyof typeof counts] !== undefined) {
        counts[l.category as keyof typeof counts]++
      }
    })
    return counts
  }, [sortedLogs])

  // Aplicação combinada de filtros (Categoria + Período + Status de Comunicado + Busca textual)
  const filteredLogs = useMemo(() => {
    const now = Date.now()
    const query = logSearch.trim().toLowerCase()

    return sortedLogs.filter(log => {
      if (logFilter !== 'todos' && log.category !== logFilter) return false

      if (logFilter === 'comunicados' && comunicadoStatusFilter !== 'todos') {
        if (comunicadoStatusFilter === 'lidos' && !log.isRead) return false
        if (comunicadoStatusFilter === 'pendentes' && log.isRead) return false
      }

      if (periodFilter !== 'todos' && log.timestamp) {
        if (periodFilter === 'hoje') {
          const itemYmd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TZ }).format(new Date(log.timestamp))
          if (itemYmd !== todayYmd) return false
        } else if (periodFilter === '7d') {
          if (now - log.timestamp > 7 * 86400000) return false
        } else if (periodFilter === '30d') {
          if (now - log.timestamp > 30 * 86400000) return false
        }
      }

      if (query) {
        const hay = `${log.title || ''} ${log.details || ''} ${log.categoryLabel || ''} ${log.time || ''}`.toLowerCase()
        if (!hay.includes(query)) return false
      }

      return true
    })
  }, [sortedLogs, logFilter, periodFilter, comunicadoStatusFilter, logSearch, todayYmd])

  // Retornos condicionais de carregamento / não encontrado posicionados APÓS todos os Hooks (Rules of Hooks)
  if (isLoadingAluno && !aluno) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Loader2 size={36} className="animate-spin" style={{ color: '#4f46e5' }} />
        <p style={{ margin: 0, fontWeight: 500 }}>Carregando ficha completa do aluno e família...</p>
      </div>
    )
  }

  if (!aluno) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Pessoa / Aluno não encontrado</h2>
        <button className="btn btn-secondary" onClick={() => router.back()}>Voltar</button>
      </div>
    )
  }

  // Ação: Bloquear / Desbloquear acesso da família à Agenda Digital
  const handleToggleBlockAccess = () => {
    const isCurrentlyBlocked = Boolean(aluno.bloqueadoAgenda || aluno.bloqueadoAgendaDigital)
    const actionLabel = isCurrentlyBlocked ? 'Desbloquear' : 'Bloquear'

    adConfirm(
      `Deseja realmente ${actionLabel.toLowerCase()} o acesso desta família ao aplicativo Agenda Digital?`,
      `${actionLabel} Acesso`,
      async () => {
        try {
          const nextBlocked = !isCurrentlyBlocked
          setFetchedAluno((prev: any) => ({
            ...(prev || aluno),
            bloqueadoAgenda: nextBlocked,
            bloqueadoAgendaDigital: nextBlocked
          }))

          await fetch(`/api/alunos?id=${encodeURIComponent(aluno.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...aluno,
              bloqueadoAgenda: nextBlocked,
              bloqueadoAgendaDigital: nextBlocked
            })
          })
          adAlert(`Acesso ${isCurrentlyBlocked ? 'liberado' : 'bloqueado'} com sucesso!`, 'Atualização Salva')
        } catch (err) {
          console.error('Erro ao atualizar bloqueio:', err)
          adAlert('Não foi possível salvar a alteração.', 'Erro')
        }
      }
    )
  }

  // Ação Real 1: Enviar link de recuperação de senha por e-mail (/api/auth/recover-password)
  const handleSendPasswordRecoveryEmail = (resp: any) => {
    const targetEmail = (resp.email || resp.usuarioEmail || '').trim()
    if (!targetEmail) {
      adAlert(
        `O responsável ${resp.nome} não possui um endereço de e-mail cadastrado. Cadastre o e-mail ou utilize a opção "Reiniciar 1º Acesso".`,
        'E-mail Ausente'
      )
      return
    }

    adConfirm(
      `Enviar link de redefinição de senha para ${resp.nome} (${targetEmail})?`,
      'Enviar Redefinição de Senha',
      async () => {
        const busyKey = `recover-${resp.id || resp.nome}`
        setActionBusyId(busyKey)
        try {
          const res = await fetch('/api/auth/recover-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail, origin: window.location.origin })
          })
          const data = await res.json().catch(() => ({}))
          if (res.ok) {
            adAlert(`Link de redefinição enviado com sucesso para ${targetEmail}!`, 'E-mail Enviado')
          } else if (data?.needsFirstAccess) {
            adAlert(
              `${resp.nome} ainda não realizou o Primeiro Acesso no aplicativo. Oriente a família a clicar em "Primeiro Acesso" na tela de login.`,
              'Pendente de 1º Acesso'
            )
          } else {
            adAlert(data?.error || 'Não foi possível enviar o e-mail de recuperação.', 'Atenção')
          }
        } catch {
          adAlert('Erro de conexão ao tentar enviar e-mail de recuperação.', 'Erro')
        } finally {
          setActionBusyId(null)
        }
      }
    )
  }

  // Ação Real 2: Reiniciar 1º Acesso no Supabase Auth (/api/auth/reset-access)
  const handleResetFirstAccess = (resp: any) => {
    if (!resp.id) {
      adAlert('Este responsável não possui ID vinculado na tabela de responsáveis para reiniciar o acesso.', 'Aviso')
      return
    }

    adConfirm(
      `Isto irá apagar a credencial atual de ${resp.nome} no Auth e liberar o cadastro para fazer um novo "Primeiro Acesso" do zero. Confirmar?`,
      'Reiniciar 1º Acesso',
      async () => {
        const busyKey = `reset-${resp.id}`
        setActionBusyId(busyKey)
        try {
          const res = await fetch('/api/auth/reset-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'responsavel', id: resp.id })
          })
          const data = await res.json().catch(() => ({}))
          if (res.ok) {
            adAlert(data?.message || `Acesso de ${resp.nome} reiniciado! Já está livre para o Primeiro Acesso.`, 'Acesso Reiniciado')
            fetchAllStudentData(true)
          } else {
            adAlert(data?.error || 'Não foi possível reiniciar o acesso.', 'Erro')
          }
        } catch {
          adAlert('Falha na comunicação com o servidor.', 'Erro')
        } finally {
          setActionBusyId(null)
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
      <style dangerouslySetInnerHTML={{ __html: `
        .ad-timeline-deferred-item {
          content-visibility: auto;
          contain-intrinsic-size: auto none auto 76px;
        }
        @media (max-width: 960px) {
          .ad-pessoa-main-grid {
            grid-template-columns: 1fr !important;
          }
          .ad-pessoa-today-strip {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 600px) {
          .ad-pessoa-today-strip {
            grid-template-columns: 1fr !important;
          }
          .ad-pessoa-hero-card {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      ` }} />

      {/* Top Breadcrumb & Refresh Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => fetchAllStudentData(true)}
          disabled={isRefreshingAll}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--text-secondary))' }}
          title="Recarregar dados em tempo real"
        >
          <RefreshCw size={14} className={isRefreshingAll ? 'animate-spin' : ''} />
          {isRefreshingAll ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </div>

      {/* Header / Hero Card */}
      <div
        className="card ad-pessoa-hero-card"
        style={{
          padding: 24,
          marginBottom: 16,
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
        <UserAvatar userId={aluno.id} name={aluno.nome} fotoUrl={aluno.foto} size={88} style={{ borderRadius: 22, fontSize: 32 }} />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>{aluno.nome}</h1>
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

          <div style={{ display: 'flex', gap: 14, color: 'hsl(var(--text-muted))', fontSize: 13.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Código / Matrícula: <strong style={{ color: 'hsl(var(--text-main))' }}>{aluno.codigo || aluno.matricula || aluno.dados?.codigo || aluno.id}</strong></span>
            <span>•</span>
            <span>
              Turma:{' '}
              {turmaObj ? (
                <Link href={`/agenda-digital/admin/turmas/${turmaObj.id}`} style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>
                  {turmaObj.nome}
                </Link>
              ) : (
                <strong style={{ color: 'hsl(var(--text-main))' }}>{resolvedTurmaNome}</strong>
              )}
            </span>
            {(aluno.data_nascimento || aluno.dados?.data_nascimento) && (
              <>
                <span>•</span>
                <span>Nascimento: <strong style={{ color: 'hsl(var(--text-main))' }}>{formatDatePtBr(aluno.data_nascimento || aluno.dados?.data_nascimento, { dateOnly: true })}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative' }}>
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
            aria-label="Mais ações"
          >
            <MoreHorizontal size={20} />
          </button>

          {showActionsMenu && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 245,
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
                  router.push(`/agenda-digital/admin/testar-push?aluno_id=${aluno.id}`)
                }}
              >
                <Bell size={14} style={{ marginRight: 8 }} /> Diagnosticar Push / Aparelhos
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

      {/* Barra Objetiva de Status Escolar & Hoje na Escola */}
      <div
        className="ad-pessoa-today-strip"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 24
        }}
      >
        {/* 1. Entrada Hoje */}
        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: todayEntry ? 'rgba(16,185,129,0.12)' : 'hsl(var(--bg-overlay))',
            color: todayEntry ? '#10b981' : 'hsl(var(--text-muted))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <LogIn size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Entrada Hoje (iDFace)</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: todayEntry ? '#10b981' : 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isLoadingPortaria ? 'Consultando...' : todayEntry ? formatDatePtBr(todayEntry.normalizedIso).replace('Hoje às ', '') : 'Sem leitura hoje'}
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {todayEntry ? (todayEntry.dispositivo_nome || 'Portaria iDFace') : (latestIdfaceEvent ? `Última: ${formatDatePtBr(latestIdfaceEvent.normalizedIso)}` : 'Nenhum acesso')}
            </div>
          </div>
        </div>

        {/* 2. Saída Hoje */}
        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: todayExit ? 'rgba(79,70,229,0.12)' : 'hsl(var(--bg-overlay))',
            color: todayExit ? '#4f46e5' : 'hsl(var(--text-muted))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <LogOut size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Saída Hoje (Portaria)</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: todayExit ? '#4f46e5' : 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isLoadingSaidaCalls ? 'Consultando...' : todayExit ? formatDatePtBr(todayExit.effectiveDate).replace('Hoje às ', '') : 'Sem saída hoje'}
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {todayExit
                ? `Com: ${todayExit.guardianName || 'Responsável'}`
                : latestSaidaCall
                  ? `Última: ${formatDatePtBr(latestSaidaCall.effectiveDate)}`
                  : 'Nenhuma saída registrada'}
            </div>
          </div>
        </div>

        {/* 3. Frequência Escolar */}
        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: attendanceStats.faltasInjustificadas > 5 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
            color: attendanceStats.faltasInjustificadas > 5 ? '#ef4444' : '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <UserCheck size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Assiduidade (Diário)</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-main))' }}>
              {isLoadingFrequencia ? 'Calculando...' : `${attendanceStats.pct}% Presença`}
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              {attendanceStats.faltasInjustificadas} falta(s) • {attendanceStats.faltasJustificadas} justificada(s)
            </div>
          </div>
        </div>

        {/* 4. Situação Financeira */}
        <div
          className="card"
          style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => setLogFilter(logFilter === 'financeiro' ? 'todos' : 'financeiro')}
          title="Clique para filtrar boletos no histórico"
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: financialStats.vencidos > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
            color: financialStats.vencidos > 0 ? '#ef4444' : '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <CreditCard size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Financeiro / Boletos</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: financialStats.vencidos > 0 ? '#ef4444' : '#10b981' }}>
              {isLoadingTitulos
                ? 'Consultando...'
                : financialStats.vencidos > 0
                  ? `${financialStats.vencidos} em atraso`
                  : 'Em dia'}
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
              {financialStats.pagos} quitado(s) • {financialStats.pendentes} a vencer
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout: Left (Guardians & Metrics) | Right (Timeline History) */}
      <div className="ad-pessoa-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1fr) 2fr', gap: 28 }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Card: Engajamento (Família) */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#4f46e5" /> Engajamento da Família
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Leitura de Comunicados</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: readingRate >= 50 ? '#10b981' : readingRate >= 25 ? '#f59e0b' : '#ef4444' }}>
                    {isLoadingComunicados ? '...' : `${readingRate}%`}
                  </span>
                </div>
                <div style={{ width: '100%', height: 7, background: 'hsl(var(--bg-overlay))', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${readingRate}%`,
                      height: '100%',
                      background: readingRate >= 50 ? '#10b981' : readingRate >= 25 ? '#f59e0b' : '#ef4444',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'hsl(var(--text-muted))', marginTop: 6 }}>
                  <span>{readComunicadosCount} de {totalComunicados} comunicados lidos</span>
                  {totalComunicados - readComunicadosCount > 0 && (
                    <button
                      onClick={() => {
                        setLogFilter('comunicados')
                        setComunicadoStatusFilter('pendentes')
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#4f46e5',
                        fontWeight: 700,
                        fontSize: 11.5,
                        cursor: 'pointer'
                      }}
                    >
                      Ver {totalComunicados - readComunicadosCount} não lido(s)
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 12, background: 'hsl(var(--bg-main))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Contas / Push Ativos</div>
                  <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Smartphone size={15} color={(activeAccountsCount > 0 || totalPushDevices > 0) ? '#10b981' : 'hsl(var(--text-muted))'} />
                    {hasPushDataLoaded && totalPushDevices > 0
                      ? `${totalPushDevices} Aparelho(s)`
                      : activeAccountsCount > 0
                        ? `${activeAccountsCount} Conta(s) Ativa(s)`
                        : 'Sem login ativo'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                    {responsaveis.length} responsável(is) no ERP
                  </div>
                </div>

                <div
                  style={{ padding: 12, background: 'hsl(var(--bg-main))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}
                  onClick={() => setLogFilter(logFilter === 'ocorrencias' ? 'todos' : 'ocorrencias')}
                >
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Ocorrências</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: realOcorrencias.length > 0 ? '#ef4444' : 'inherit', marginTop: 3 }}>
                    {isLoadingOcorrencias ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : realOcorrencias.length > 0 ? (
                      `${realOcorrencias.length} Registro(s)`
                    ) : (
                      'Nenhuma'
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                    {attendanceStats.faltasInjustificadas} falta(s) em aula
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Portaria & Frequência (iDFace e Saída) */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogIn size={18} color="#10b981" /> Histórico de Portaria
              </h3>
              {(isLoadingPortaria || isLoadingSaidaCalls) && <Loader2 size={15} className="animate-spin text-muted" />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Catraca iDFace Summary */}
              <div
                style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: 12, background: 'hsl(var(--bg-main))', cursor: 'pointer' }}
                onClick={() => setLogFilter(logFilter === 'portaria' ? 'todos' : 'portaria')}
              >
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
                    {validIdfaceEntries.length} Acesso(s)
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', marginTop: 8, paddingTop: 8, borderTop: '1px dashed hsl(var(--border-subtle))' }}>
                  {latestIdfaceEvent ? (
                    <>
                      Última entrada: <strong style={{ color: 'hsl(var(--text-main))' }}>{formatDatePtBr(latestIdfaceEvent.normalizedIso)}</strong> ({latestIdfaceEvent.dispositivo_nome || 'Portaria iDFace'})
                    </>
                  ) : (
                    'Nenhum registro facial de entrada localizado.'
                  )}
                </div>
              </div>

              {/* Saídas Confirmadas Summary */}
              <div
                style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: 12, background: 'hsl(var(--bg-main))', cursor: 'pointer' }}
                onClick={() => setLogFilter(logFilter === 'portaria' ? 'todos' : 'portaria')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LogOut size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Saídas Confirmadas</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Painel de Chamadas / Portaria</div>
                    </div>
                  </div>
                  <span className="badge" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', fontWeight: 700, fontSize: 11 }}>
                    {confirmedSaidasCount} Saída(s)
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', marginTop: 8, paddingTop: 8, borderTop: '1px dashed hsl(var(--border-subtle))' }}>
                  {latestSaidaCall && latestSaidaCall.effectiveDate ? (
                    <>
                      Última saída: <strong style={{ color: 'hsl(var(--text-main))' }}>{formatDatePtBr(latestSaidaCall.effectiveDate)}</strong> (Para: {latestSaidaCall.guardianName || latestSaidaCall.responsavelNome || 'Responsável'})
                    </>
                  ) : (
                    'Nenhuma saída confirmada registrada.'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card: Credenciais (Responsáveis) */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Credenciais (Responsáveis)</h3>
              {isLoadingResponsaveis && <Loader2 size={15} className="animate-spin text-muted" />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {responsaveis.length > 0 ? (
                responsaveis.map((resp, i) => {
                  const isBusyRecover = actionBusyId === `recover-${resp.id || resp.nome}`
                  const isBusyReset = actionBusyId === `reset-${resp.id}`
                  return (
                    <div
                      key={resp.id || i}
                      style={{
                        border: '1px solid hsl(var(--border-subtle))',
                        borderRadius: 12,
                        padding: 15,
                        background: 'hsl(var(--bg-main))'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'hsl(var(--text-main))' }}>{resp.nome}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: resp.badgeBg, color: resp.color, fontSize: 10.5, padding: '2px 8px', fontWeight: 700 }}>
                              {resp.tipo}
                            </span>
                            <span
                              className="badge"
                              style={{
                                background: resp.temContaAtiva ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                color: resp.temContaAtiva ? '#10b981' : '#d97706',
                                fontSize: 10.5,
                                padding: '2px 7px',
                                fontWeight: 700
                              }}
                            >
                              {resp.temContaAtiva ? '● Conta Ativa' : '○ Pendente 1º Acesso'}
                            </span>
                            {resp.dispositivosAtivos > 0 && (
                              <span className="badge badge-ghost" style={{ fontSize: 10, padding: '2px 6px' }}>
                                📱 {resp.dispositivosAtivos} Push
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          className="btn btn-ghost btn-sm"
                          title="Ver todos os detalhes do responsável"
                          style={{ padding: 6 }}
                          onClick={() => setSelectedRespModal(resp)}
                        >
                          <Eye size={14} />
                        </button>
                      </div>

                      {resp.ultimoAcesso && (
                        <div style={{ fontSize: 11.5, color: '#10b981', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={12} /> Último login: {formatDatePtBr(resp.ultimoAcesso)}
                        </div>
                      )}

                      {(resp.email || resp.telefone || resp.cpf) && (
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {resp.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <Mail size={12} style={{ flexShrink: 0 }} /> {resp.email}
                              </span>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 5px', height: 'auto' }}
                                title="Copiar e-mail"
                                onClick={() => copyToClipboard(resp.email, `email-${i}`)}
                              >
                                {copiedField === `email-${i}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                              </button>
                            </div>
                          )}
                          {resp.telefone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Phone size={12} style={{ flexShrink: 0 }} /> {resp.telefone}
                              </span>
                              <a
                                href={getWhatsAppShareUrl(resp.telefone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', height: 'auto', fontSize: 11, color: '#10b981', fontWeight: 700, textDecoration: 'none' }}
                                title="Abrir conversa no WhatsApp"
                              >
                                WhatsApp <ExternalLink size={11} style={{ marginLeft: 3 }} />
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, fontSize: 11.5, padding: '6px 8px' }}
                          disabled={isBusyRecover}
                          onClick={() => handleSendPasswordRecoveryEmail(resp)}
                          title="Envia link por e-mail para o responsável redefinir a senha"
                        >
                          {isBusyRecover ? <Loader2 size={13} className="animate-spin" style={{ marginRight: 4 }} /> : <Key size={13} style={{ marginRight: 4 }} />}
                          Link de Senha
                        </button>

                        {resp.id && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11.5, padding: '6px 8px', border: '1px solid hsl(var(--border-subtle))' }}
                            disabled={isBusyReset}
                            onClick={() => handleResetFirstAccess(resp)}
                            title="Apaga o vínculo de Auth atual e libera novamente o Primeiro Acesso"
                          >
                            {isBusyReset ? <Loader2 size={13} className="animate-spin" style={{ marginRight: 4 }} /> : <RotateCcw size={13} style={{ marginRight: 4 }} />}
                            Reiniciar 1º Acesso
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 8 }}>
                  Nenhum responsável vinculado encontrado neste cadastro.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline / History */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 540 }}>
          {/* Header + Search + Period Filter */}
          <div
            style={{
              padding: '18px 22px 14px',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Histórico Unificado (Aluno & Família)</h3>
                <span className="badge badge-ghost" style={{ fontSize: 11, fontWeight: 700 }}>
                  {filteredLogs.length} evento(s)
                </span>
              </div>

              {/* Busca rápida + Filtro de período */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <input
                    className="form-input"
                    placeholder="Buscar no histórico..."
                    value={logSearch}
                    onChange={e => {
                      setLogSearch(e.target.value)
                      setVisibleLogCount(15)
                    }}
                    style={{ padding: '5px 10px 5px 30px', fontSize: 12.5, width: 190, height: 32 }}
                  />
                </div>

                <select
                  className="form-input"
                  value={periodFilter}
                  onChange={e => {
                    setPeriodFilter(e.target.value as any)
                    setVisibleLogCount(15)
                  }}
                  style={{ padding: '4px 10px', fontSize: 12.5, height: 32, width: 'auto' }}
                >
                  <option value="todos">Todo o período</option>
                  <option value="hoje">Somente Hoje</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                </select>
              </div>
            </div>

            {/* Abas de Categoria Rápidas (1 clique, com contadores) */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'todos', label: 'Todos', count: categoryCounts.todos },
                { id: 'portaria', label: 'Portaria & Saída', count: categoryCounts.portaria },
                { id: 'comunicados', label: 'Comunicados', count: categoryCounts.comunicados },
                { id: 'financeiro', label: 'Financeiro', count: categoryCounts.financeiro },
                { id: 'ocorrencias', label: 'Pedagógico & Faltas', count: categoryCounts.ocorrencias },
                { id: 'acessos', label: 'Logins App', count: categoryCounts.acessos }
              ].map(tab => {
                const isActive = logFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setLogFilter(tab.id as any)
                      setVisibleLogCount(15)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 11px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 600,
                      border: isActive ? '1px solid #4f46e5' : '1px solid hsl(var(--border-subtle))',
                      background: isActive ? 'rgba(79, 70, 229, 0.1)' : 'hsl(var(--bg-main))',
                      color: isActive ? '#4f46e5' : 'hsl(var(--text-secondary))',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: isActive ? '#4f46e5' : 'hsl(var(--bg-overlay))',
                        color: isActive ? '#fff' : 'hsl(var(--text-muted))',
                        fontWeight: 700
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Sub-filtro exclusivo quando a aba Comunicados está selecionada */}
            {logFilter === 'comunicados' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
                <span style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Status de leitura:</span>
                {[
                  { id: 'todos', label: `Todos (${totalComunicados})` },
                  { id: 'lidos', label: `Lidos pela família (${readComunicadosCount})` },
                  { id: 'pendentes', label: `Não lidos (${Math.max(0, totalComunicados - readComunicadosCount)})` }
                ].map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setComunicadoStatusFilter(sub.id as any)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: comunicadoStatusFilter === sub.id ? 700 : 500,
                      border: '1px solid hsl(var(--border-subtle))',
                      background: comunicadoStatusFilter === sub.id ? 'hsl(var(--bg-overlay))' : 'transparent',
                      color: 'hsl(var(--text-main))',
                      cursor: 'pointer'
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista Cronológica */}
          <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', flex: 1 }}>
              {filteredLogs.length > 0 && (
                <div style={{ position: 'absolute', left: 18, top: 18, bottom: 18, width: 2, background: 'hsl(var(--border-subtle))', zIndex: 0 }} />
              )}

              {filteredLogs.length > 0 ? (
                filteredLogs.slice(0, visibleLogCount).map((log: any, index: number) => {
                  let IconRender = CheckCircle2
                  if (log.type === 'doc') IconRender = FileText
                  else if (log.type === 'download') IconRender = Download
                  else if (log.type === 'alert') IconRender = AlertTriangle
                  else if (log.type === 'login') IconRender = LogIn
                  else if (log.type === 'logout') IconRender = LogOut

                  const isSolidGreen = log.type === 'check' || log.type === 'login'
                  const isSolidIndigo = log.type === 'logout'

                  return (
                    <div
                      key={log.id}
                      className={index >= 8 ? 'ad-timeline-deferred-item' : undefined}
                      style={{ display: 'flex', gap: 14, position: 'relative', zIndex: 1 }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: isSolidGreen
                            ? '#10b981'
                            : isSolidIndigo
                              ? '#4f46e5'
                              : log.type === 'alert'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'hsl(var(--bg-surface))',
                          color: isSolidGreen || isSolidIndigo ? 'white' : log.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: isSolidGreen || isSolidIndigo ? 'none' : `1.5px solid ${log.color || 'hsl(var(--border-subtle))'}`
                        }}
                      >
                        <IconRender size={17} />
                      </div>

                      <div style={{ paddingTop: 1, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'hsl(var(--text-main))' }}>{log.title}</span>
                            {log.categoryLabel && (
                              <span
                                className="badge badge-ghost"
                                style={{
                                  fontSize: 10,
                                  padding: '1px 7px',
                                  fontWeight: 700,
                                  color: log.categoryLabel === 'Não Lido' ? '#d97706' : undefined,
                                  background: log.categoryLabel === 'Não Lido' ? 'rgba(245,158,11,0.12)' : undefined
                                }}
                              >
                                {log.categoryLabel}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <Clock size={12} /> {log.time}
                          </div>
                        </div>

                        {log.details && (
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 3, lineHeight: 1.4 }}>
                            {log.details}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}>
                  <AlertTriangle size={32} style={{ marginBottom: 12, opacity: 0.45 }} />
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))', margin: '0 0 6px 0' }}>Nenhum evento encontrado para este filtro</h4>
                  <p style={{ margin: 0, fontSize: 13, maxWidth: 360 }}>
                    Altere a categoria ou o período selecionado acima para visualizar mais registros.
                  </p>
                  {(logFilter !== 'todos' || periodFilter !== 'todos' || logSearch) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 14 }}
                      onClick={() => {
                        setLogFilter('todos')
                        setPeriodFilter('todos')
                        setComunicadoStatusFilter('todos')
                        setLogSearch('')
                      }}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredLogs.length > visibleLogCount && (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: 24 }}
                onClick={() => setVisibleLogCount(prev => prev + 20)}
              >
                Carregar mais eventos ({filteredLogs.length - visibleLogCount} restantes)
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Modal: Detalhes Completos do Responsável */}
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
            style={{ width: '100%', maxWidth: 460, padding: 24, background: 'hsl(var(--bg-surface))' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Detalhes do Responsável</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRespModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Nome Completo</label>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{selectedRespModal.nome}</div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Vínculo / Papel</label>
                  <div style={{ marginTop: 4 }}>
                    <span className="badge" style={{ background: selectedRespModal.badgeBg, color: selectedRespModal.color, fontWeight: 600 }}>
                      {selectedRespModal.tipo || 'Responsável'}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Status no App</label>
                  <div style={{ marginTop: 4 }}>
                    <span
                      className="badge"
                      style={{
                        background: selectedRespModal.temContaAtiva ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                        color: selectedRespModal.temContaAtiva ? '#10b981' : '#d97706',
                        fontWeight: 700
                      }}
                    >
                      {selectedRespModal.temContaAtiva ? 'Conta Ativa' : 'Pendente 1º Acesso'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedRespModal.ultimoAcesso && (
                <div>
                  <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>Último Login Registrado</label>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                    {formatDatePtBr(selectedRespModal.ultimoAcesso)}
                  </div>
                </div>
              )}

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
                      href={getWhatsAppShareUrl(selectedRespModal.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11, marginLeft: 'auto', textDecoration: 'none' }}
                    >
                      WhatsApp <ExternalLink size={12} style={{ marginLeft: 4 }} />
                    </a>
                  </div>
                </div>
              )}

              {Array.isArray(selectedRespModal.dispositivos) && selectedRespModal.dispositivos.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>
                    Aparelhos Push Conectados ({selectedRespModal.dispositivosAtivos}/{selectedRespModal.totalDispositivos})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {selectedRespModal.dispositivos.map((dev: any, idx: number) => (
                      <div
                        key={dev.id || idx}
                        style={{
                          fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'hsl(var(--bg-main))',
                          border: '1px solid hsl(var(--border-subtle))',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{dev.device_model || dev.device_type || 'Dispositivo Mobile/Web'}</span>
                        <span style={{ color: dev.isSubscribed ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 11 }}>
                          {dev.isSubscribed ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
