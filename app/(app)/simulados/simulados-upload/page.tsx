'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, Eye, Clock, CheckCircle, XCircle,
  Upload, BookOpen, Users, User, Info, ChevronRight, AlertCircle, Trash2,
  FileText, Calendar, Layers, Edit, CheckSquare, Printer, ChevronDown, GraduationCap, ChevronUp, Sparkles, BookMarked, MoreVertical,
  ArrowUp, ArrowDown, RotateCcw, RefreshCw, Send
} from 'lucide-react'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { getDerivedStatus, isQuestionForRequisicao, isFileForRequisicao, normalizeQuestoesList, hasGabaritoBracketArtifact, isCollaboratorRole, isUserRequisicaoOwner, isUserCreator } from '@/lib/utils'
import { GabaritoSimuladoModal } from '@/components/simulados/GabaritoSimuladoModal'
import { AnoLetivoModal } from '@/components/simulados/AnoLetivoModal'

// Visual styling helper per segment
function getSegmentoInfo(serieName: string) {
  const nameLower = (serieName || '').toLowerCase().trim()

  if (
    nameLower.includes('infantil') || 
    nameLower.includes('berçário') || 
    nameLower.includes('bercario') || 
    nameLower.includes('maternal') || 
    nameLower.includes('jardim') || 
    nameLower.includes('pré') || 
    nameLower.includes('pre')
  ) {
    return {
      segmento: 'Educação Infantil',
      color: '#f97316',
      bgLight: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.25)',
      gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)',
      icon: Sparkles
    }
  }

  if (
    nameLower.includes('1º ano') || nameLower.includes('2º ano') || nameLower.includes('3º ano') || 
    nameLower.includes('4º ano') || nameLower.includes('5º ano') || nameLower.includes('1° ano') || 
    nameLower.includes('2° ano') || nameLower.includes('3° ano') || nameLower.includes('4° ano') || 
    nameLower.includes('5° ano') || nameLower.includes('fundamental 1') || nameLower.includes('fundamental i') ||
    nameLower.includes('ef1') || nameLower.includes('ef i') || nameLower.includes('anos iniciais')
  ) {
    return {
      segmento: 'Ensino Fundamental I',
      color: '#10b981',
      bgLight: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
      icon: BookOpen
    }
  }

  if (
    nameLower.includes('6º ano') || nameLower.includes('7º ano') || nameLower.includes('8º ano') || 
    nameLower.includes('9º ano') || nameLower.includes('6° ano') || nameLower.includes('7° ano') || 
    nameLower.includes('8° ano') || nameLower.includes('9° ano') || nameLower.includes('fundamental 2') ||
    nameLower.includes('fundamental ii') || nameLower.includes('ef2') || nameLower.includes('ef ii') ||
    nameLower.includes('anos finais')
  ) {
    return {
      segmento: 'Ensino Fundamental II',
      color: '#0284c7',
      bgLight: 'rgba(2, 132, 199, 0.12)',
      border: 'rgba(2, 132, 199, 0.25)',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
      icon: BookMarked
    }
  }

  if (
    nameLower.includes('série em') || nameLower.includes('serie em') || nameLower.includes('médio') || 
    nameLower.includes('medio') || nameLower.includes('terceirão') || nameLower.includes('terceirao') ||
    nameLower.includes('pré-vestibular') || nameLower.includes('pv') || nameLower.includes('em')
  ) {
    return {
      segmento: 'Ensino Médio',
      color: '#8b5cf6',
      bgLight: 'rgba(139, 92, 246, 0.12)',
      border: 'rgba(139, 92, 246, 0.25)',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
      icon: GraduationCap
    }
  }

  return {
    segmento: 'Geral',
    color: '#64748b',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.25)',
    gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
    boxShadow: '0 4px 14px rgba(100, 116, 139, 0.25)',
    icon: Layers
  }
}

// Color badges per discipline
function getDisciplinaStyle(discName: string) {
  const d = (discName || '').toLowerCase().trim()
  if (d.includes('reda')) {
    return { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.25)' }
  }
  if (d.includes('histó') || d.includes('histo')) {
    return { bg: 'rgba(168, 85, 247, 0.12)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.25)' }
  }
  if (d.includes('matem')) {
    return { bg: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', border: 'rgba(34, 197, 94, 0.25)' }
  }
  if (d.includes('ciênc') || d.includes('biol')) {
    return { bg: 'rgba(20, 184, 166, 0.12)', color: '#0d9488', border: 'rgba(20, 184, 166, 0.25)' }
  }
  if (d.includes('portu') || d.includes('língua')) {
    return { bg: 'rgba(249, 115, 22, 0.12)', color: '#ea580c', border: 'rgba(249, 115, 22, 0.25)' }
  }
  if (d.includes('geog')) {
    return { bg: 'rgba(6, 182, 212, 0.12)', color: '#0891b2', border: 'rgba(6, 182, 212, 0.25)' }
  }
  if (d.includes('físic') || d.includes('quím')) {
    return { bg: 'rgba(236, 72, 153, 0.12)', color: '#db2777', border: 'rgba(236, 72, 153, 0.25)' }
  }
  if (d.includes('ingl') || d.includes('esp')) {
    return { bg: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: 'rgba(99, 102, 241, 0.25)' }
  }
  return { bg: 'rgba(100, 116, 139, 0.12)', color: '#475569', border: 'rgba(100, 116, 139, 0.25)' }
}

// Abbreviate last names helper
function formatTeacherShortName(name: string) {
  if (!name || name === 'Não atribuído' || name === 'Desconhecido') return name || 'Não atribuído'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return name
  
  const firstName = parts[0]
  const lastInitials = parts.slice(1).map(p => {
    const clean = p.replace(/\./g, '').trim()
    if (!clean) return ''
    if (['de', 'da', 'do', 'dos', 'das'].includes(clean.toLowerCase())) return ''
    return clean[0].toUpperCase() + '.'
  }).filter(Boolean)

  if (lastInitials.length === 0) return firstName
  return `${firstName} ${lastInitials.join(' ')}`
}

// Teacher initials helper
function getTeacherInitials(name: string) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/).filter(p => !['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase()))
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Format creation info helper (e.g. "Criado por Marilda V. em 08/07/2026")
function formatCreatedInfo(createdAt: string, creatorName: string, includeTime = false) {
  const shortAuthor = formatTeacherShortName(creatorName || '') || 'Sistema'
  if (!createdAt) return `Criado por ${shortAuthor}`
  
  try {
    const d = new Date(createdAt)
    const dateStr = d.toLocaleDateString('pt-BR')
    if (includeTime) {
      const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      return `Criado por ${shortAuthor} em ${dateStr} às ${timeStr}`
    }
    return `Criado por ${shortAuthor} em ${dateStr}`
  } catch (e) {
    return `Criado por ${shortAuthor}`
  }
}

// Identify whether a simulado is an Adapted version (Educação Especial / Inclusão)
function isSimuladoAdaptado(simulado: any): boolean {
  if (!simulado) return false
  return Boolean(simulado.eh_adaptada) || Boolean(simulado.titulo?.toUpperCase().includes('ADAPTAD'))
}

// Extract the base regular simulado title by stripping trailing/inline ADAPTADO(A) markers
function getBaseSimuladoTitle(titulo?: string): string {
  if (!titulo) return 'Simulado'
  return titulo
    .replace(/\s*[-–—]?\s*\bADAPTAD[OA]S?\b\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function UploadSimuladosGerenciamentoPage() {
  const { currentUser, currentUserPerfil } = useApp()
  const { cfgCalendarioLetivo = [] } = useData()
  const [simulados, setSimulados] = useState<any[]>([])
  const [bimestres, setBimestres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterBimestre, setFilterBimestre] = useState('todos')
  const [filterSerie, setFilterSerie] = useState('todas')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    simulado: any
    mode: 'collaborator_only' | 'full_simulado'
    selectedReqId: string
    targetReqs: any[]
    allReqs: any[]
    canDeleteFullSimulado: boolean
  } | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)
  const [adaptarModalSimulado, setAdaptarModalSimulado] = useState<any | null>(null)
  
  const [expandedTurmas, setExpandedTurmas] = useState<Record<string, boolean>>({})
  const [expandedTurmasAdaptados, setExpandedTurmasAdaptados] = useState<Record<string, boolean>>({})
  const [activeView, setActiveView] = useState<'regulares' | 'adaptados'>('regulares')
  const [adaptadosSearch, setAdaptadosSearch] = useState('')
  const [filterBaseTitle, setFilterBaseTitle] = useState<string | null>(null)
  const [newlyCreatedAdaptadoId, setNewlyCreatedAdaptadoId] = useState<string | null>(null)
  const [gabaritoModalId, setGabaritoModalId] = useState<string | null>(null)
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectedSimulados, setSelectedSimulados] = useState<Record<string, boolean>>({})
  const [sortOrders, setSortOrders] = useState<Record<string, string>>({})
  const [localCustomOrders, setLocalCustomOrders] = useState<Record<string, string[]>>({})

  const [selectedAnoLetivo, setSelectedAnoLetivo] = useState<string | null>(null)
  const [showAnoModal, setShowAnoModal] = useState(true)
  const [isClient, setIsClient] = useState(false)

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 100

  const seriesOptions = [
    '1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF',
    '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF',
    '1ª Série EM', '2ª Série EM', '3ª Série EM'
  ]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.action-menu-container')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setIsClient(true)
    setShowAnoModal(true)
    try {
      const saved = localStorage.getItem('impacto_simulados_upload_ordens')
      if (saved) {
        setLocalCustomOrders(JSON.parse(saved))
      }
      const savedView = sessionStorage.getItem('simulados_upload_active_view')
      if (savedView === 'regulares' || savedView === 'adaptados') {
        setActiveView(savedView)
      }
    } catch (e) {}
  }, [])

  const switchActiveView = (view: 'regulares' | 'adaptados') => {
    setActiveView(view)
    try {
      sessionStorage.setItem('simulados_upload_active_view', view)
    } catch (e) {}
  }

  const getSimuladoOrder = (simulado: any, groupKey: string): number | null => {
    const customList = localCustomOrders[groupKey]
    if (customList && customList.length > 0) {
      const idx = customList.indexOf(simulado.id)
      if (idx !== -1) return idx + 1
    }
    if (simulado.ordem_series && typeof simulado.ordem_series === 'object') {
      const sOrder = simulado.ordem_series[groupKey]
      if (typeof sOrder === 'number' && sOrder > 0) return sOrder
    }
    if (typeof simulado.ordem === 'number' && simulado.ordem > 0) {
      return simulado.ordem
    }
    return null
  }

  const handleMoveSimulado = async (
    turmaName: string,
    bimestreNome: string,
    simuladoId: string,
    direction: 'cima' | 'baixo',
    currentList: any[],
    customGroupKey?: string
  ) => {
    const groupKey = customGroupKey || `${turmaName}_${bimestreNome}`
    const idx = currentList.findIndex(p => p.id === simuladoId)
    if (idx === -1) return
    if (direction === 'cima' && idx <= 0) return
    if (direction === 'baixo' && idx >= currentList.length - 1) return

    const targetIdx = direction === 'cima' ? idx - 1 : idx + 1
    const newList = [...currentList]
    const [movedItem] = newList.splice(idx, 1)
    newList.splice(targetIdx, 0, movedItem)

    const newOrderIds = newList.map(p => p.id)

    // 1. Optimistic Local State Update
    setLocalCustomOrders(prev => {
      const updated = { ...prev, [groupKey]: newOrderIds }
      try {
        localStorage.setItem('impacto_simulados_upload_ordens', JSON.stringify(updated))
      } catch (e) {}
      return updated
    })

    setSortOrders(prev => ({ ...prev, [groupKey]: 'ordem' }))

    setSimulados(prev => {
      return prev.map(item => {
        const pos = newOrderIds.indexOf(item.id)
        if (pos !== -1) {
          const updatedOrdemSeries = { ...(item.ordem_series || {}), [groupKey]: pos + 1 }
          return {
            ...item,
            ordem: pos + 1,
            ordem_series: updatedOrdemSeries
          }
        }
        return item
      })
    })

    // 2. Persist to Supabase in Background
    try {
      const updates = newList.map((item, i) => {
        const newPos = i + 1
        const updatedOrdemSeries = { ...(item.ordem_series || {}), [groupKey]: newPos }
        return {
          id: item.id,
          ordem: newPos,
          ordem_series: updatedOrdemSeries
        }
      })

      await Promise.all(
        updates.map(u =>
          (supabase as any)
            .from('simulados_upload')
            .update({
              ordem: u.ordem,
              ordem_series: u.ordem_series,
              updated_at: new Date().toISOString()
            })
            .eq('id', u.id)
        )
      )
    } catch (err) {
      console.warn('Tentando fallback de ordenação no Supabase:', err)
      try {
        await Promise.all(
          newList.map((item, i) =>
            (supabase as any)
              .from('simulados_upload')
              .update({ ordem: i + 1, updated_at: new Date().toISOString() })
              .eq('id', item.id)
          )
        )
      } catch (e2) {
        console.warn('Ordem mantida via LocalStorage:', e2)
      }
    }
  }

  useEffect(() => {
    if (isClient) {
      setPage(1)
      loadData(1, false)
    }
  }, [search, filterBimestre, isClient])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadData = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)

    try {
      let query = (supabase as any).from('simulados_upload')
        .select('*, simulados_upload_requisicoes(*)')
        .order('created_at', { ascending: false })
      
      if (search) {
        query = query.ilike('titulo', `%${search}%`)
      }
      if (filterBimestre && filterBimestre !== 'todos') {
        query = query.eq('id_bimestre', filterBimestre)
      }

      query = query.range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1)

      const [bimRes, simuladosRes] = await Promise.all([
        (supabase as any).from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome'),
        query
      ])
      
      let newSimuladosData = simuladosRes.data || []
      
      if (newSimuladosData.length < PAGE_SIZE) {
        setHasMore(false)
      } else {
        setHasMore(true)
      }
      
      if (newSimuladosData.length > 0) {
        try {
          newSimuladosData = newSimuladosData.map((p: any) => {
            const pReqs = p.simulados_upload_requisicoes || []
            const rawPQs = Array.isArray(p.questoes_json) ? p.questoes_json : []
            const hadGabaritoArtifact = rawPQs.some((q: any) =>
              hasGabaritoBracketArtifact(q.enunciado) ||
              (q.alternativas || []).some((a: any) => hasGabaritoBracketArtifact(a.text || a.texto))
            )
            let pQs = normalizeQuestoesList(rawPQs)
            let hasOrphan = hadGabaritoArtifact

            if (pQs.length > 0 && pReqs.length > 0) {
              pQs = pQs.map((q: any) => {
                if (q.id_requisicao && pReqs.some((r: any) => r.id === q.id_requisicao)) {
                  return q
                }
                const match = pReqs.find((r: any) => isQuestionForRequisicao(q, r, pReqs, false))
                if (match) {
                  hasOrphan = true
                  return {
                    ...q,
                    id_requisicao: match.id,
                    id_disciplina: match.id_disciplina || q.id_disciplina,
                    disciplina_nome: match.disciplina_nome || q.disciplina_nome,
                    id_professor: match.id_professor || q.id_professor,
                    professor_nome: match.professor_nome || q.professor_nome
                  }
                }
                return q
              })
            }

            if (hasOrphan && pQs.length > 0) {
              (supabase as any)
                .from('simulados_upload')
                .update({
                  questoes_json: pQs,
                  questoes_count: pQs.filter((q: any) => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio).length,
                  updated_at: new Date().toISOString()
                })
                .eq('id', p.id)
                .then(() => {})
            }

            const fixedReqs = pReqs.map((r: any) => {
              const qCount = pQs.filter((q: any) => isQuestionForRequisicao(q, r, pReqs, true)).length
              if (qCount === 0 && r.status !== 'pendente' && r.status !== 'aprovado' && r.status !== 'concluido') {
                if (r.id) {
                  (supabase as any)
                    .from('simulados_upload_requisicoes')
                    .update({ status: 'pendente', enviado_em: null })
                    .eq('id', r.id)
                    .then(() => {})
                    .catch(() => {})
                }
                return { ...r, status: 'pendente', enviado_em: null }
              }
              return r
            })

            const derivedSt = getDerivedStatus({ ...p, simulados_upload_requisicoes: fixedReqs, questoes_json: pQs }, 'simulado')
            if (p.id && p.status !== derivedSt && p.status !== 'publicado') {
              (supabase as any)
                .from('simulados_upload')
                .update({ status: derivedSt, updated_at: new Date().toISOString() })
                .eq('id', p.id)
                .then(() => {})
                .catch(() => {})
            }

            return {
              ...p,
              simulados_upload_requisicoes: fixedReqs,
              questoes_json: pQs,
              status: derivedSt
            }
          })
          
          const userIds = Array.from(new Set(newSimuladosData.map((p: any) => p.criado_por).filter(Boolean)))
          if (userIds.length > 0) {
            try {
              const req = await fetch('/api/usuarios/nomes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: userIds })
              })
              const resData = await req.json()
              const usersMap = resData.data || {}

              if (currentUser?.id && !usersMap[currentUser.id]) {
                usersMap[currentUser.id] = currentUser.nome
              }

              const formatCreatorName = (name: string) => {
                if (!name) return 'Desconhecido'
                const parts = name.trim().split(/\s+/).filter((p: string) => !['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase()))
                if (parts.length > 1) {
                  return parts.slice(0, 2).join(' ')
                }
                return parts[0] || 'Desconhecido'
              }
              
              Object.keys(usersMap).forEach(k => {
                usersMap[k] = formatCreatorName(usersMap[k])
              })

              newSimuladosData = newSimuladosData.map((p: any) => ({ ...p, criado_por_nome: usersMap[p.criado_por] || 'Desconhecido' }))
            } catch (e) {
              console.error(e)
            }
          }
        } catch (e) {
          console.error("Error fetching requisitions or users", e)
        }
      }

      setBimestres(bimRes.data || [])
      
      if (append) {
        setSimulados(prev => {
          const newItems = newSimuladosData.filter((n: any) => !prev.some((p: any) => p.id === n.id))
          return [...prev, ...newItems]
        })
      } else {
        setSimulados(newSimuladosData)
      }

      // Default collapse all turmas initially
      const initialExp: Record<string, boolean> = {}
      newSimuladosData.forEach((p: any) => {
        const sList = Array.isArray(p.series) ? p.series : (p.series ? [p.series] : ['Sem Turma'])
        sList.forEach((s: string) => { initialExp[s] = false })
      })
      setExpandedTurmas(prev => ({ ...initialExp, ...prev }))
      
    } catch (e: any) {
      console.error("Error in loadData:", e?.message || e)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadData(nextPage, true)
  }

  const isProfView = isCollaboratorRole(currentUser, currentUserPerfil)
  const isCoord = !isProfView

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!feedbackToast) return
    const timer = setTimeout(() => setFeedbackToast(null), 4000)
    return () => clearTimeout(timer)
  }, [feedbackToast])

  const handleUpdateReqStatus = async (simulado: any, req: any, newStatus: 'pendente' | 'enviado' | 'aprovado' | 'reprovado') => {
    if (!simulado || !req) return
    setStatusUpdatingId(req.id)
    try {
      const now = new Date().toISOString()
      const updateReqData: any = { status: newStatus }
      if (newStatus === 'enviado') {
        updateReqData.enviado_em = req.enviado_em || now
      } else if (newStatus === 'pendente') {
        updateReqData.enviado_em = null
      }

      const { error: reqErr } = await (supabase as any)
        .from('simulados_upload_requisicoes')
        .update(updateReqData)
        .eq('id', req.id)

      if (reqErr) throw reqErr

      const allReqs = Array.isArray(simulado.simulados_upload_requisicoes) ? simulado.simulados_upload_requisicoes : []
      const updatedReqs = allReqs.map((r: any) =>
        r.id === req.id ? { ...r, ...updateReqData } : r
      )

      const newSimuladoStatus = getDerivedStatus(
        { ...simulado, simulados_upload_requisicoes: updatedReqs },
        'simulado'
      )

      await (supabase as any)
        .from('simulados_upload')
        .update({ status: newSimuladoStatus, updated_at: now })
        .eq('id', simulado.id)

      setSimulados(prev =>
        prev.map(s =>
          s.id === simulado.id
            ? {
                ...s,
                status: newSimuladoStatus,
                simulados_upload_requisicoes: updatedReqs,
                updated_at: now
              }
            : s
        )
      )

      const statusLabels: Record<string, string> = {
        pendente: 'Reaberta para elaboração',
        enviado: 'Enviada para revisão da coordenação',
        aprovado: 'Aprovada com sucesso',
        reprovado: 'Devolvida para revisão do professor'
      }
      setFeedbackToast({
        message: `${req.disciplina_nome || 'Disciplina'}: ${statusLabels[newStatus] || newStatus}!`,
        type: 'success'
      })
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err)
      setFeedbackToast({
        message: 'Erro ao atualizar status: ' + (err.message || 'Tente novamente.'),
        type: 'error'
      })
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleUpdateSimuladoStatus = async (simulado: any, newStatus: 'aguardando' | 'em_revisao' | 'aprovado' | 'reprovado' | 'publicado') => {
    if (!simulado) return
    setStatusUpdatingId(simulado.id)
    try {
      const now = new Date().toISOString()
      const { error: pErr } = await (supabase as any)
        .from('simulados_upload')
        .update({ status: newStatus, updated_at: now })
        .eq('id', simulado.id)

      if (pErr) throw pErr

      const allReqs = Array.isArray(simulado.simulados_upload_requisicoes) ? simulado.simulados_upload_requisicoes : []
      let newReqStatus: string | null = null
      if (newStatus === 'aprovado' || newStatus === 'publicado') {
        newReqStatus = 'aprovado'
      } else if (newStatus === 'reprovado') {
        newReqStatus = 'reprovado'
      } else if (newStatus === 'aguardando') {
        newReqStatus = 'pendente'
      } else if (newStatus === 'em_revisao') {
        newReqStatus = 'enviado'
      }

      let updatedReqs = allReqs
      if (newReqStatus) {
        await (supabase as any)
          .from('simulados_upload_requisicoes')
          .update({ status: newReqStatus })
          .eq('id_simulado_upload', simulado.id)
        updatedReqs = allReqs.map((r: any) => ({ ...r, status: newReqStatus }))
      }

      setSimulados(prev =>
        prev.map(s =>
          s.id === simulado.id
            ? {
                ...s,
                status: newStatus,
                simulados_upload_requisicoes: updatedReqs,
                updated_at: now
              }
            : s
        )
      )

      const statusLabels: Record<string, string> = {
        aguardando: 'Reaberto para elaboração',
        em_revisao: 'Colocado em revisão',
        aprovado: 'Simulado aprovado com sucesso',
        reprovado: 'Simulado devolvido para ajuste',
        publicado: 'Simulado publicado oficialmente'
      }
      setFeedbackToast({
        message: `Simulado "${simulado.titulo}": ${statusLabels[newStatus] || newStatus}!`,
        type: 'success'
      })
    } catch (err: any) {
      console.error('Erro ao atualizar status do simulado:', err)
      setFeedbackToast({
        message: 'Erro ao atualizar status: ' + (err.message || 'Tente novamente.'),
        type: 'error'
      })
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const openDeleteModal = (simulado: any, specificReq?: any) => {
    if (!simulado) return
    const rawReqs = Array.isArray(simulado.simulados_upload_requisicoes) ? simulado.simulados_upload_requisicoes : []
    const myReqs = rawReqs.filter((r: any) => isUserRequisicaoOwner(currentUser, r))
    const otherReqs = rawReqs.filter((r: any) => !isUserRequisicaoOwner(currentUser, r))
    const createdByMe = isUserCreator(currentUser, simulado)

    // Colaborador nunca pode excluir simulado de outros colaboradores
    if (isProfView && myReqs.length === 0 && !createdByMe) {
      return
    }

    if (specificReq) {
      if (isProfView && !isUserRequisicaoOwner(currentUser, specificReq) && !createdByMe) {
        return
      }
      const canFull = !isProfView || (otherReqs.length === 0 && createdByMe)
      setDeleteConfirmId(simulado.id)
      setDeleteConfirmTarget({
        simulado,
        mode: 'collaborator_only',
        selectedReqId: specificReq.id || 'my_all',
        targetReqs: [specificReq],
        allReqs: rawReqs,
        canDeleteFullSimulado: canFull
      })
      return
    }

    // Se for colaborador:
    if (isProfView) {
      // Se existem outros colaboradores neste simulado, DEVE excluir APENAS a parte deste colaborador!
      if (otherReqs.length > 0) {
        setDeleteConfirmId(simulado.id)
        setDeleteConfirmTarget({
          simulado,
          mode: 'collaborator_only',
          selectedReqId: myReqs[0]?.id || 'my_all',
          targetReqs: myReqs,
          allReqs: rawReqs,
          canDeleteFullSimulado: false
        })
        return
      }

      // Se o simulado tem apenas a requisição deste colaborador:
      const myQsCount = Array.isArray(simulado.questoes_json)
        ? simulado.questoes_json.filter((q: any) => myReqs.some((mr: any) => isQuestionForRequisicao(q, mr, rawReqs, true))).length
        : 0

      // Se foi criado pela Coordenação e o professor enviou questões, o padrão seguro é limpar apenas o envio dele (ou excluir se ele mesmo criou)
      const canFull = createdByMe || rawReqs.length <= 1
      const defaultMode: 'collaborator_only' | 'full_simulado' = (!createdByMe && myQsCount > 0 && myReqs.length > 0)
        ? 'collaborator_only'
        : 'full_simulado'

      setDeleteConfirmId(simulado.id)
      setDeleteConfirmTarget({
        simulado,
        mode: defaultMode,
        selectedReqId: myReqs[0]?.id || 'my_all',
        targetReqs: myReqs,
        allReqs: rawReqs,
        canDeleteFullSimulado: canFull
      })
      return
    }

    // Se for Coordenação / Admin:
    // Se o simulado possui múltiplos colaboradores/disciplinas, abre com opção de excluir apenas de um colaborador específico ou o simulado inteiro
    if (rawReqs.length > 1) {
      const firstWithQs = rawReqs.find((r: any) =>
        Array.isArray(simulado.questoes_json) &&
        simulado.questoes_json.some((q: any) => isQuestionForRequisicao(q, r, rawReqs, true))
      ) || rawReqs[0]

      setDeleteConfirmId(simulado.id)
      setDeleteConfirmTarget({
        simulado,
        mode: 'collaborator_only',
        selectedReqId: firstWithQs.id,
        targetReqs: [firstWithQs],
        allReqs: rawReqs,
        canDeleteFullSimulado: true
      })
      return
    }

    setDeleteConfirmId(simulado.id)
    setDeleteConfirmTarget({
      simulado,
      mode: 'full_simulado',
      selectedReqId: rawReqs[0]?.id || '',
      targetReqs: rawReqs,
      allReqs: rawReqs,
      canDeleteFullSimulado: true
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId || !deleteConfirmTarget) return
    setDeletingItem(true)
    try {
      const { simulado, mode, targetReqs, allReqs, canDeleteFullSimulado } = deleteConfirmTarget

      // Segurança extra: se o usuário for colaborador e houver outros colaboradores no simulado, NUNCA permite excluir o simulado inteiro
      const hasOtherCollaborators = allReqs.some((r: any) => !targetReqs.some((tr: any) => tr.id === r.id))
      const effectiveMode = (isProfView && hasOtherCollaborators) || !canDeleteFullSimulado
        ? 'collaborator_only'
        : mode

      if (effectiveMode === 'collaborator_only' && targetReqs.length > 0) {
        // Busca o estado mais recente do banco para não afetar nenhum outro colaborador
        const { data: latestSim } = await (supabase as any)
          .from('simulados_upload')
          .select('questoes_json, config_estudio')
          .eq('id', simulado.id)
          .single()

        const currentQs: any[] = Array.isArray(latestSim?.questoes_json)
          ? latestSim.questoes_json
          : (Array.isArray(simulado.questoes_json) ? simulado.questoes_json : [])

        // Mantém APENAS as questões que NÃO pertencem às requisições-alvo da exclusão
        const remainingQsRaw = currentQs.filter((q: any) =>
          !targetReqs.some((tr: any) => isQuestionForRequisicao(q, tr, allReqs, false))
        )

        let numCounter = 1
        const remainingQs = remainingQsRaw.map((q: any) => {
          const isApoio = q?.tipo_questao === 'texto_apoio' || q?.is_texto_apoio || q?.isTextoApoio
          return {
            ...q,
            numero: isApoio ? 0 : numCounter++
          }
        })

        const validRemainingCount = remainingQs.filter(
          (q: any) => q?.tipo_questao !== 'texto_apoio' && !q?.is_texto_apoio && !q?.isTextoApoio
        ).length

        // Remove apenas o arquivo original (.docx) enviado por este colaborador
        const currentConfig = latestSim?.config_estudio || simulado.config_estudio || {}
        const currentArquivos: any[] = Array.isArray(currentConfig.arquivos_originais)
          ? currentConfig.arquivos_originais
          : []
        const remainingArquivos = currentArquivos.filter(
          (a: any) => !targetReqs.some((tr: any) => isFileForRequisicao(a, tr, allReqs))
        )

        const targetReqIds = targetReqs.map((tr: any) => tr.id).filter(Boolean)
        if (targetReqIds.length > 0) {
          await (supabase as any)
            .from('simulados_upload_requisicoes')
            .update({ status: 'pendente', enviado_em: null })
            .in('id', targetReqIds)
        }

        const updatedReqs = allReqs.map((r: any) =>
          targetReqIds.includes(r.id) ? { ...r, status: 'pendente', enviado_em: null } : r
        )

        const newStatus = getDerivedStatus(
          { ...simulado, simulados_upload_requisicoes: updatedReqs, questoes_json: remainingQs, status: 'em_revisao' },
          'simulado'
        )

        const updatedConfig = {
          ...currentConfig,
          arquivos_originais: remainingArquivos
        }

        await (supabase as any)
          .from('simulados_upload')
          .update({
            questoes_json: remainingQs,
            questoes_count: validRemainingCount,
            config_estudio: updatedConfig,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', simulado.id)

        setSimulados(prev =>
          prev.map(p =>
            p.id === simulado.id
              ? {
                  ...p,
                  questoes_json: remainingQs,
                  questoes_count: validRemainingCount,
                  config_estudio: updatedConfig,
                  simulados_upload_requisicoes: updatedReqs,
                  status: newStatus
                }
              : p
          )
        )
      } else {
        await (supabase as any).from('simulados_upload').delete().eq('id', simulado.id)
        setSimulados(prev => prev.filter(p => p.id !== simulado.id))
      }
    } catch (e) {
      console.error('Erro ao excluir:', e)
    } finally {
      setDeletingItem(false)
      setDeleteConfirmId(null)
      setDeleteConfirmTarget(null)
    }
  }

  const handleAdaptar = async (simulado: any) => {
    if (simulado.titulo?.toUpperCase().includes('ADAPTAD')) {
      window.location.href = `/simulados/simulados-upload/${simulado.id}/adaptar`
      return
    }

    setLoading(true)
    try {
      const payload: any = { ...simulado }
      delete payload.id
      delete payload.created_at
      delete payload.simulados_upload_requisicoes
      delete payload.criado_por_nome
      delete payload.config_estudio
      delete payload.eh_adaptada
      payload.titulo = `${simulado.titulo || 'Simulado'} ADAPTADO`
      payload.updated_at = new Date().toISOString()

      const { data: newSimulado, error: simError } = await (supabase as any)
        .from('simulados_upload')
        .insert([payload])
        .select()
        .single()
        
      if (simError) throw simError

      // Duplicate all requisitions for this adapted simulado and map new IDs
      const oldReqs = simulado.simulados_upload_requisicoes || []
      const idMap: Record<string, string> = {}

      if (oldReqs.length > 0) {
        const reqsPayload = oldReqs.map((r: any) => {
          const newReq = { ...r }
          delete newReq.id
          delete newReq.created_at
          newReq.id_simulado_upload = newSimulado.id
          // Verifica se ESTA requisição específica possui questões vinculadas
          const rHasQuestions = Array.isArray(payload.questoes_json) && payload.questoes_json.some((q: any) => isQuestionForRequisicao(q, r, oldReqs, true))
          if (rHasQuestions) {
            newReq.status = r.status === 'aprovado' || r.status === 'concluido' ? r.status : 'enviado'
            newReq.enviado_em = r.enviado_em || new Date().toISOString()
          } else {
            newReq.status = 'pendente'
            newReq.enviado_em = null
          }
          return newReq
        })

        const { data: insertedReqs, error: reqError } = await (supabase as any)
          .from('simulados_upload_requisicoes')
          .insert(reqsPayload)
          .select()
          
        if (reqError) throw reqError

        if (insertedReqs && Array.isArray(insertedReqs)) {
          oldReqs.forEach((oldR: any, idx: number) => {
            const newR = insertedReqs[idx] || insertedReqs.find((nr: any) => nr.disciplina_nome === oldR.disciplina_nome && nr.id_professor === oldR.id_professor)
            if (newR && oldR.id) {
              idMap[oldR.id] = newR.id
            }
          })
        }
      }

      // Re-map questoes_json with the new requisition IDs
      const existingQs = Array.isArray(payload.questoes_json) ? payload.questoes_json : []
      if (existingQs.length > 0 || simulado.config_estudio) {
        const mappedQs = existingQs.map((q: any) => {
          const newReqId = (q.id_requisicao && idMap[q.id_requisicao]) 
            ? idMap[q.id_requisicao] 
            : (Object.values(idMap).length === 1 ? Object.values(idMap)[0] : q.id_requisicao)

          return {
            ...q,
            id_requisicao: newReqId || q.id_requisicao
          }
        })

        // Copy and map config_estudio if present
        let newConfig = simulado.config_estudio ? { ...simulado.config_estudio } : {}
        const singleMappedReqId = Object.values(idMap).length === 1 ? Object.values(idMap)[0] : null
        if (Array.isArray(newConfig.arquivos_originais)) {
          newConfig.arquivos_originais = newConfig.arquivos_originais.map((a: any) => ({
            ...a,
            id_requisicao: (a.id_requisicao && idMap[a.id_requisicao])
              ? idMap[a.id_requisicao]
              : (singleMappedReqId || a.id_requisicao)
          }))
        }
        if (Array.isArray(newConfig.ordem_requisicoes)) {
          newConfig.ordem_requisicoes = newConfig.ordem_requisicoes.map((rid: string) => idMap[rid] || rid)
        }

        const updatePayload: any = {
          questoes_json: mappedQs,
          questoes_count: mappedQs.filter((q: any) => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio).length,
          config_estudio: newConfig,
          updated_at: new Date().toISOString()
        }

        const { error: updError } = await (supabase as any)
          .from('simulados_upload')
          .update(updatePayload)
          .eq('id', newSimulado.id)

        if (updError && updError.message?.includes('config_estudio')) {
          delete updatePayload.config_estudio
          await (supabase as any)
            .from('simulados_upload')
            .update(updatePayload)
            .eq('id', newSimulado.id)
        }
      }

      // Tentativa não-bloqueante de atualizar flag eh_adaptada caso a coluna exista no banco
      (supabase as any)
        .from('simulados_upload')
        .update({ eh_adaptada: true })
        .eq('id', newSimulado.id)
        .then(() => {})
        .catch(() => {})
      
      await loadData()

      // Redireciona automaticamente para a Central de Simulados Adaptados e expande a turma
      const sList = Array.isArray(simulado.series) ? simulado.series : (simulado.series ? [simulado.series] : ['Sem Turma'])
      setExpandedTurmasAdaptados(prev => {
        const next = { ...prev }
        sList.forEach((s: string) => { next[s] = true })
        return next
      })
      setFilterBaseTitle(null)
      setNewlyCreatedAdaptadoId(newSimulado.id)
      switchActiveView('adaptados')
    } catch (e: any) {
      console.error('Erro ao adaptar simulado:', e)
      alert('Erro ao adaptar simulado: ' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }

  const getBimestreAno = (b: any): string => {
    if (!b) return ''
    if (b.ano_letivo) return String(b.ano_letivo).trim()
    if (b.nome) {
      const match = b.nome.match(/\b(20\d{2})\b/)
      if (match) return match[1]
    }
    if (b.data_inicio) {
      return b.data_inicio.substring(0, 4)
    }
    return ''
  }

  const anosDisponiveis = useMemo(() => {
    const yearsSet = new Set<string>()
    bimestres.forEach((b: any) => {
      const y = getBimestreAno(b)
      if (y) yearsSet.add(y)
    })
    return Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a))
  }, [bimestres])

  const bimsInYear = useMemo(() => bimestres.filter(b => getBimestreAno(b) === String(selectedAnoLetivo)).map(b => b.id), [bimestres, selectedAnoLetivo])
  const simuladosInYear = useMemo(() => simulados.filter(p => bimsInYear.includes(p.id_bimestre)), [simulados, bimsInYear])

  const filtered = useMemo(() => {
    return simuladosInYear.filter(p => {
      const matchStatus = (() => {
        if (filterStatus === 'todos') return true
        const reqs = p.simulados_upload_requisicoes || []
        const relevantReqs = isProfView && currentUser?.id
          ? reqs.filter((r: any) => isUserRequisicaoOwner(currentUser, r))
          : reqs

        if (filterStatus === 'aprovado') {
          if (p.status === 'aprovado' || p.status === 'concluido' || p.status === 'publicado') return true
          if (relevantReqs.length > 0 && relevantReqs.every((r: any) => r.status === 'aprovado' || r.status === 'concluido')) return true
          return false
        }
        if (filterStatus === 'reprovado') {
          if (p.status === 'reprovado' || p.status === 'rejeitado') return true
          if (relevantReqs.some((r: any) => r.status === 'reprovado' || r.status === 'rejeitado')) return true
          return false
        }
        if (filterStatus === 'em_revisao') {
          if (p.status === 'em_revisao') return true
          if (relevantReqs.some((r: any) => r.status === 'enviado')) return true
          return false
        }
        if (filterStatus === 'aguardando') {
          if (p.status === 'aguardando' || p.status === 'pendente') return true
          if (relevantReqs.some((r: any) => r.status === 'pendente')) return true
          return false
        }
        if (filterStatus === 'publicado') {
          return p.status === 'publicado'
        }
        return p.status === filterStatus
      })()

      const matchBimestre = filterBimestre === 'todos' || p.id_bimestre === filterBimestre
      const matchSerie = filterSerie === 'todas' || (p.series && (Array.isArray(p.series) ? p.series.includes(filterSerie) : p.series === filterSerie))
      const isAssigned =
        !isProfView ||
        isUserCreator(currentUser, p) ||
        (p.simulados_upload_requisicoes || []).some((r: any) => isUserRequisicaoOwner(currentUser, r))
      return matchStatus && matchBimestre && matchSerie && isAssigned
    })
  }, [simuladosInYear, filterStatus, filterBimestre, filterSerie, isProfView, currentUser])

  // Strict separation: Regular Simulados vs Adapted Simulados
  const filteredRegulares = useMemo(() => filtered.filter(p => !isSimuladoAdaptado(p)), [filtered])
  const filteredAdaptadosAll = useMemo(() => filtered.filter(p => isSimuladoAdaptado(p)), [filtered])

  const filteredAdaptados = useMemo(() => {
    const q = adaptadosSearch.trim().toLowerCase()
    return filteredAdaptadosAll.filter(p => {
      if (filterBaseTitle) {
        const base = getBaseSimuladoTitle(p.titulo).toLowerCase()
        if (base !== filterBaseTitle.toLowerCase()) return false
      }
      if (!q) return true
      const matchTitle = (p.titulo || '').toLowerCase().includes(q)
      const matchCreator = (p.criado_por_nome || '').toLowerCase().includes(q)
      const matchReqs = (p.simulados_upload_requisicoes || []).some((r: any) =>
        (r.disciplina_nome || '').toLowerCase().includes(q) ||
        (r.professor_nome || '').toLowerCase().includes(q)
      )
      return matchTitle || matchCreator || matchReqs
    })
  }, [filteredAdaptadosAll, adaptadosSearch, filterBaseTitle])

  // Lookup maps to show contextual badges in Regular View without mixing adapted items in the table
  const adaptadosByTurma = useMemo(() => {
    const map: Record<string, any[]> = {}
    filteredAdaptadosAll.forEach(item => {
      const sList = Array.isArray(item.series) ? item.series : (item.series ? [item.series] : ['Sem Turma'])
      const validSeries = sList.length > 0 ? sList : ['Sem Turma']
      validSeries.forEach((s: string) => {
        if (!map[s]) map[s] = []
        map[s].push(item)
      })
    })
    return map
  }, [filteredAdaptadosAll])

  const adaptadosByTurmaBimestre = useMemo(() => {
    const map: Record<string, any[]> = {}
    filteredAdaptadosAll.forEach(item => {
      const bimObj = bimestres.find(b => b.id === item.id_bimestre)
      const bName = bimObj ? bimObj.nome : 'Sem Bimestre'
      const sList = Array.isArray(item.series) ? item.series : (item.series ? [item.series] : ['Sem Turma'])
      const validSeries = sList.length > 0 ? sList : ['Sem Turma']
      validSeries.forEach((s: string) => {
        const key = `${s}_${bName}`
        if (!map[key]) map[key] = []
        map[key].push(item)
      })
    })
    return map
  }, [filteredAdaptadosAll, bimestres])

  // Compute chronological version numbers when multiple adapted copies of the same base simulado exist in a Turma + Bimestre
  const adaptadosVersionInfoMap = useMemo(() => {
    const versionMap: Record<string, { versionNumber: number; totalVersions: number }> = {}
    Object.entries(adaptadosByTurmaBimestre).forEach(([tbKey, items]) => {
      const byBaseTitle: Record<string, any[]> = {}
      items.forEach(item => {
        const baseKey = getBaseSimuladoTitle(item.titulo).toUpperCase()
        if (!byBaseTitle[baseKey]) byBaseTitle[baseKey] = []
        byBaseTitle[baseKey].push(item)
      })
      Object.values(byBaseTitle).forEach(group => {
        const sortedChronological = [...group].sort(
          (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        )
        sortedChronological.forEach((item, idx) => {
          versionMap[`${tbKey}_${item.id}`] = {
            versionNumber: idx + 1,
            totalVersions: sortedChronological.length
          }
        })
      })
    })
    return versionMap
  }, [adaptadosByTurmaBimestre])

  const buildGroupedStructure = (sourceItems: any[]) => {
    const result: Array<{
      turmaName: string
      turmaIndexBadge: string
      segmentoInfo: any
      totalProvas: number
      bimestres: Array<{
        bimestreNome: string
        provas: any[]
      }>
    }> = []

    const turmasMap: Record<string, any[]> = {}
    sourceItems.forEach(item => {
      const sList = Array.isArray(item.series) ? item.series : (item.series ? [item.series] : ['Sem Turma'])
      const validSeries = sList.length > 0 ? sList : ['Sem Turma']
      validSeries.forEach((s: string) => {
        if (!turmasMap[s]) turmasMap[s] = []
        turmasMap[s].push(item)
      })
    })

    const sortedTurmaKeys = Object.keys(turmasMap).sort((a, b) => {
      if (a === 'Sem Turma') return 1
      if (b === 'Sem Turma') return -1
      const idxA = seriesOptions.indexOf(a)
      const idxB = seriesOptions.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })

    sortedTurmaKeys.forEach(turmaKey => {
      const turmaItems = turmasMap[turmaKey]
      const segInfo = getSegmentoInfo(turmaKey)

      const numMatch = turmaKey.match(/\d+/)
      const indexBadge = numMatch ? numMatch[0] : (turmaKey.slice(0, 2).toUpperCase())

      const bimsMap: Record<string, any[]> = {}
      turmaItems.forEach(item => {
        const bimObj = bimestres.find(b => b.id === item.id_bimestre)
        const bName = bimObj ? bimObj.nome : 'Sem Bimestre'
        if (!bimsMap[bName]) bimsMap[bName] = []
        bimsMap[bName].push(item)
      })

      const sortedBimKeys = Object.keys(bimsMap).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0
        const numB = parseInt(b.replace(/\D/g, '')) || 0
        return numA - numB
      })

      const bimestresArr = sortedBimKeys.map(bKey => ({
        bimestreNome: bKey,
        provas: bimsMap[bKey]
      }))

      result.push({
        turmaName: turmaKey,
        turmaIndexBadge: indexBadge,
        segmentoInfo: segInfo,
        totalProvas: turmaItems.length,
        bimestres: bimestresArr
      })
    })

    return result
  }

  const groupedStructure = useMemo(
    () => buildGroupedStructure(filteredRegulares),
    [filteredRegulares, bimestres, seriesOptions]
  )

  const groupedStructureAdaptados = useMemo(
    () => buildGroupedStructure(filteredAdaptados),
    [filteredAdaptados, bimestres, seriesOptions]
  )

  const toggleSelectSimulado = (id: string) => {
    setSelectedSimulados(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSelectAllGroup = (items: any[]) => {
    const allSelected = items.every(p => selectedSimulados[p.id])
    const nextState = { ...selectedSimulados }
    items.forEach(p => {
      nextState[p.id] = !allSelected
    })
    setSelectedSimulados(nextState)
  }

  if (!isClient) return null

  return (
    <>
      {showAnoModal && (
        <AnoLetivoModal 
          onSelect={(ano, bimId) => { 
            setSelectedAnoLetivo(ano); 
            sessionStorage.setItem('selectedAnoLetivo', ano);
            if (bimId && bimId !== 'todos') {
              setFilterBimestre(bimId);
              sessionStorage.setItem('selectedBimestre', bimId);
            } else {
              setFilterBimestre('todos');
              sessionStorage.setItem('selectedBimestre', 'todos');
            }
            setShowAnoModal(false);
          }} 
        />
      )}
      {gabaritoModalId && <GabaritoSimuladoModal simuladoUploadId={gabaritoModalId} onClose={() => setGabaritoModalId(null)} />}

      <div className="simulados-upload-container" style={{ padding: '32px 40px', maxWidth: 1280, margin: '0 auto', display: selectedAnoLetivo && !showAnoModal ? 'block' : 'none' }}>
      
      <style>{`
        .simulado-modern-card {
          background-color: hsl(var(--bg-surface));
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s ease;
        }
        .simulado-modern-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 26px -6px rgba(15, 23, 42, 0.08), 0 4px 10px -3px rgba(15, 23, 42, 0.04) !important;
        }
        .simulado-action-btn {
          transition: all 0.15s ease;
        }
        .simulado-action-btn:hover {
          transform: translateY(-1px);
          filter: brightness(0.97);
        }
        .simulado-req-row {
          transition: background-color 0.15s ease;
        }
        .simulado-req-row:hover {
          background-color: rgba(139, 92, 246, 0.035) !important;
        }
        .simulado-req-row-adaptado:hover {
          background-color: rgba(245, 158, 11, 0.045) !important;
        }
        .menu-item-hover {
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .menu-item-hover:hover, [data-highlighted] .menu-item-hover {
          background-color: rgba(139, 92, 246, 0.08) !important;
          color: #8b5cf6 !important;
        }
        .prof-link-hover:hover .prof-name-text {
          color: #8b5cf6 !important;
          text-decoration: underline !important;
        }
        [data-radix-menu-content] {
          outline: none !important;
        }
        @media (max-width: 960px) {
          .simulados-upload-container { padding: 14px 10px !important; }
          .provas-header-flex { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .provas-header-flex button { width: 100% !important; justify-content: center !important; }
          .provas-filters-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .provas-filters-grid select { font-size: 12px !important; padding-left: 10px !important; padding-right: 24px !important; height: 42px !important; border-radius: 10px !important; }
          .workspace-tabs-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .turma-accordion-header { padding: 12px 10px !important; }
          .bimestre-group-container { padding: 12px 6px !important; }
          .bimestre-card-box { padding: 12px 10px !important; }
          .bimestre-header-flex { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .bimestre-header-flex > div { width: 100% !important; justify-content: space-between !important; }
          .simulado-card-header-flex { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
          .simulado-card-toolbar { width: 100% !important; justify-content: flex-start !important; }
          .simulado-req-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
        }
        @media (max-width: 560px) {
          .simulado-req-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div className="provas-header-flex" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(139,92,246,0.3)', flexShrink: 0 }}>
                <Upload size={24} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
                  Simulados por Turmas e Bimestres
                </h1>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0 0', fontSize: 13 }}>
                  {isCoord ? 'Gerenciamento oficial de simulados organizados por turmas e bimestres.' : 'Visualize e gerencie seus simulados organizados por turmas e bimestres.'}
                </p>
              </div>
            </div>
          </div>
          <Link href="/simulados/simulados-upload/nova" style={{ textDecoration: 'none' }}>
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 22px', borderRadius: 12,
                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer',
                fontSize: 14, boxShadow: '0 8px 20px rgba(139,92,246,0.35)',
              }}
            >
              <Plus size={18} /> Novo Simulado
            </motion.button>
          </Link>
        </div>

        {/* Filters Bar: 4 Select Filters side by side */}
        <div className="provas-filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24, width: '100%' }}>
          {/* 1. Ano Letivo */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedAnoLetivo || ''}
              onChange={e => {
                const newAno = e.target.value;
                setSelectedAnoLetivo(newAno);
                sessionStorage.setItem('selectedAnoLetivo', newAno);
                const newYearBims = bimestres.filter(b => getBimestreAno(b) === newAno);
                const lastBim = newYearBims.length > 0 ? newYearBims[newYearBims.length - 1] : null;
                if (lastBim) {
                  setFilterBimestre(lastBim.id);
                  sessionStorage.setItem('selectedBimestre', lastBim.id);
                } else {
                  setFilterBimestre('todos');
                  sessionStorage.setItem('selectedBimestre', 'todos');
                }
              }}
              style={{ width: '100%', padding: '12px 32px 12px 16px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}
            >
              {anosDisponiveis.map((ano: string) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
          </div>

          {/* 2. Bimestre */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterBimestre}
              onChange={e => {
                setFilterBimestre(e.target.value);
                sessionStorage.setItem('selectedBimestre', e.target.value);
              }}
              style={{ width: '100%', padding: '12px 32px 12px 16px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}
            >
              <option value="todos">Todos os bimestres</option>
              {bimestres.filter(b => getBimestreAno(b) === String(selectedAnoLetivo)).map(bim => (
                <option key={bim.id} value={bim.id}>{bim.nome}</option>
              ))}
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
          </div>

          {/* 3. Turmas */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterSerie}
              onChange={e => setFilterSerie(e.target.value)}
              style={{ width: '100%', padding: '12px 32px 12px 16px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}
            >
              <option value="todas">Todas as Turmas</option>
              {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
          </div>

          {/* 4. Status */}
          <div style={{ position: 'relative' }}>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', padding: '12px 32px 12px 16px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}
            >
              <option value="todos">Todos os Status</option>
              <option value="aguardando">Aguardando Envio / Elaboração</option>
              <option value="em_revisao">Em Revisão</option>
              <option value="aprovado">Concluída / Aprovada</option>
              <option value="reprovado">Devolvida / Ajuste Solicitado</option>
              <option value="publicado">Publicada</option>
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Segmented Workspace Switcher: Simulados Regulares vs Simulados Adaptados */}
        <div
          role="tablist"
          aria-label="Ambientes de Simulados"
          className="workspace-tabs-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
            marginBottom: 24,
            width: '100%'
          }}
        >
          {/* Tab 1: Simulados Regulares */}
          <button
            id="tab-simulados-regulares"
            role="tab"
            type="button"
            aria-selected={activeView === 'regulares'}
            aria-controls="panel-simulados-workspace"
            tabIndex={activeView === 'regulares' ? 0 : -1}
            onClick={() => switchActiveView('regulares')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault()
                switchActiveView('adaptados')
                document.getElementById('tab-simulados-adaptados')?.focus()
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'safe center',
              justifyContent: 'space-between',
              gap: 14,
              padding: '16px 20px',
              borderRadius: 16,
              background: activeView === 'regulares'
                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(109, 40, 217, 0.05) 100%)'
                : 'hsl(var(--bg-surface))',
              border: activeView === 'regulares'
                ? '2px solid #8b5cf6'
                : '1px solid hsl(var(--border-subtle))',
              boxShadow: activeView === 'regulares'
                ? '0 8px 24px rgba(139, 92, 246, 0.16)'
                : '0 2px 10px rgba(0, 0, 0, 0.02)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: activeView === 'regulares'
                    ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                    : 'rgba(139, 92, 246, 0.1)',
                  color: activeView === 'regulares' ? '#fff' : '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: activeView === 'regulares' ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <BookOpen size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>
                    Simulados Regulares
                  </span>
                  {activeView === 'regulares' && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 100,
                      fontSize: 10,
                      fontWeight: 800,
                      background: 'rgba(139, 92, 246, 0.16)',
                      color: '#7c3aed',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      Visualização Ativa
                    </span>
                  )}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Grade oficial das turmas — sem misturar simulados adaptados
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                background: activeView === 'regulares' ? '#8b5cf6' : 'hsl(var(--bg-app))',
                color: activeView === 'regulares' ? '#fff' : 'hsl(var(--text-primary))',
                border: activeView === 'regulares' ? 'none' : '1px solid hsl(var(--border-subtle))',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {filteredRegulares.length}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--text-secondary))', marginTop: 3 }}>
                {filteredRegulares.length === 1 ? 'simulado' : 'simulados'}
              </span>
            </div>
          </button>

          {/* Tab 2: Simulados Adaptados (Educação Especial & Inclusão) */}
          <button
            id="tab-simulados-adaptados"
            role="tab"
            type="button"
            aria-selected={activeView === 'adaptados'}
            aria-controls="panel-simulados-workspace"
            tabIndex={activeView === 'adaptados' ? 0 : -1}
            onClick={() => switchActiveView('adaptados')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault()
                switchActiveView('regulares')
                document.getElementById('tab-simulados-regulares')?.focus()
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'safe center',
              justifyContent: 'space-between',
              gap: 14,
              padding: '16px 20px',
              borderRadius: 16,
              background: activeView === 'adaptados'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(217, 119, 6, 0.05) 100%)'
                : 'hsl(var(--bg-surface))',
              border: activeView === 'adaptados'
                ? '2px solid #f59e0b'
                : '1px solid rgba(245, 158, 11, 0.3)',
              boxShadow: activeView === 'adaptados'
                ? '0 8px 24px rgba(245, 158, 11, 0.18)'
                : '0 2px 10px rgba(0, 0, 0, 0.02)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: activeView === 'adaptados'
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'rgba(245, 158, 11, 0.12)',
                  color: activeView === 'adaptados' ? '#fff' : '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: activeView === 'adaptados' ? '0 4px 12px rgba(245, 158, 11, 0.35)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <Sparkles size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>
                    Simulados Adaptados
                  </span>
                  <span className="badge-adaptada-neon-brown" style={{ flexShrink: 0 }}>
                    ADAPTADA
                  </span>
                  {activeView === 'adaptados' && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 100,
                      fontSize: 10,
                      fontWeight: 800,
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#b45309',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      Visualização Ativa
                    </span>
                  )}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Central exclusiva de Educação Especial & Inclusão — organizada por turma e bimestre
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                background: activeView === 'adaptados'
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'rgba(245, 158, 11, 0.12)',
                color: activeView === 'adaptados' ? '#fff' : '#d97706',
                border: activeView === 'adaptados' ? 'none' : '1px solid rgba(245, 158, 11, 0.3)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {filteredAdaptadosAll.length}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', marginTop: 3 }}>
                {filteredAdaptadosAll.length === 1 ? 'adaptado' : 'adaptados'}
              </span>
            </div>
          </button>
        </div>

        {/* Dedicated Banner & Controls when viewing Simulados Adaptados */}
        {activeView === 'adaptados' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.09) 0%, rgba(217, 119, 6, 0.03) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.32)',
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                }}>
                  <Sparkles size={19} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                      Central de Simulados Adaptados
                    </h2>
                    <span style={{
                      padding: '2px 9px',
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'rgba(245, 158, 11, 0.16)',
                      color: '#b45309',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      {Object.keys(adaptadosByTurma).length} {Object.keys(adaptadosByTurma).length === 1 ? 'turma atendida' : 'turmas atendidas'}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                    Todos os simulados adaptados ficam reunidos aqui com numeração e ordenação próprias, sem misturar com os simulados regulares.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Search input inside Adaptados */}
                <div style={{ position: 'relative', minWidth: 230 }}>
                  <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={adaptadosSearch}
                    onChange={e => setAdaptadosSearch(e.target.value)}
                    placeholder="Buscar adaptado, disciplina ou prof..."
                    aria-label="Buscar simulado adaptado"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: 10,
                      background: 'hsl(var(--bg-surface))',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      color: 'hsl(var(--text-primary))',
                      fontSize: 12,
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Expand / Collapse all Turmas in Adaptados */}
                {groupedStructureAdaptados.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allOpen = groupedStructureAdaptados.every(t => expandedTurmasAdaptados[t.turmaName] ?? true)
                      const next: Record<string, boolean> = {}
                      groupedStructureAdaptados.forEach(t => { next[t.turmaName] = !allOpen })
                      setExpandedTurmasAdaptados(next)
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'hsl(var(--bg-surface))',
                      border: '1px solid hsl(var(--border-subtle))',
                      color: 'hsl(var(--text-primary))',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {groupedStructureAdaptados.every(t => expandedTurmasAdaptados[t.turmaName] ?? true)
                      ? 'Recolher Turmas'
                      : 'Expandir Turmas'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setFilterBaseTitle(null)
                    switchActiveView('regulares')
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.28)',
                    color: '#7c3aed',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ← Voltar aos Regulares
                </button>
              </div>
            </div>

            {/* Active Base Simulado Filter Chip (when user clicked "Ver Adaptadas" on a specific regular simulado) */}
            {filterBaseTitle && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'hsl(var(--bg-surface))',
                border: '1px solid rgba(245, 158, 11, 0.4)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--text-primary))', fontWeight: 600 }}>
                  <Sparkles size={14} color="#d97706" />
                  <span>
                    Filtrando versões adaptadas do simulado: <strong style={{ color: '#d97706' }}>{filterBaseTitle}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterBaseTitle(null)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#b45309',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Mostrar todos os adaptados ({filteredAdaptadosAll.length}) ×
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Content List */}
        <div id="panel-simulados-workspace" role="tabpanel" aria-labelledby={activeView === 'regulares' ? 'tab-simulados-regulares' : 'tab-simulados-adaptados'}>
        {loading ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 100, background: 'hsl(var(--bg-surface))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', position: 'relative' }}>
                <div style={{ padding: 24, display: 'flex', gap: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'hsl(var(--bg-elevated))' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '30%', height: 18, background: 'hsl(var(--bg-elevated))', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ width: '15%', height: 14, background: 'hsl(var(--bg-elevated))', borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (activeView === 'regulares' ? groupedStructure : groupedStructureAdaptados).length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '72px 40px', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: activeView === 'adaptados' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid hsl(var(--border-subtle))' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: activeView === 'adaptados' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(139,92,246,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              {activeView === 'adaptados' ? <Sparkles size={28} color="#d97706" /> : <Upload size={28} color="#8b5cf6" />}
            </div>
            <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
              {activeView === 'adaptados'
                ? 'Nenhum simulado adaptado encontrado'
                : 'Nenhum simulado regular cadastrado'}
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: '0 auto 18px', maxWidth: 520 }}>
              {activeView === 'adaptados'
                ? (filterBaseTitle || adaptadosSearch
                    ? 'Tente limpar a busca ou o filtro ativo para visualizar todos os simulados adaptados.'
                    : 'Para criar uma versão adaptada, acesse a aba "Simulados Regulares" e clique no botão "Adaptar" no simulado desejado.')
                : (filteredAdaptadosAll.length > 0
                    ? `Existem ${filteredAdaptadosAll.length} simulado(s) adaptado(s) organizados na aba "Simulados Adaptados".`
                    : 'Tente alterar os filtros ou clique em "Novo Simulado".')}
            </p>
            {activeView === 'adaptados' && (filterBaseTitle || adaptadosSearch) ? (
              <button
                type="button"
                onClick={() => { setFilterBaseTitle(null); setAdaptadosSearch('') }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#b45309',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Limpar filtros de busca
              </button>
            ) : activeView === 'adaptados' ? (
              <button
                type="button"
                onClick={() => switchActiveView('regulares')}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#7c3aed',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Ir para Simulados Regulares
              </button>
            ) : filteredAdaptadosAll.length > 0 ? (
              <button
                type="button"
                onClick={() => switchActiveView('adaptados')}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                }}
              >
                Ver Simulados Adaptados ({filteredAdaptadosAll.length})
              </button>
            ) : null}
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(activeView === 'regulares' ? groupedStructure : groupedStructureAdaptados).map(turma => {
              const isAdaptadosView = activeView === 'adaptados'
              const segInfo = turma.segmentoInfo
              const isExpanded = isAdaptadosView
                ? (expandedTurmasAdaptados[turma.turmaName] ?? true)
                : (expandedTurmas[turma.turmaName] ?? false)
              const adaptadosCountInTurma = adaptadosByTurma[turma.turmaName]?.length || 0

              const toggleTurmaAccordion = () => {
                if (isAdaptadosView) {
                  setExpandedTurmasAdaptados(prev => ({ ...prev, [turma.turmaName]: !isExpanded }))
                } else {
                  setExpandedTurmas(prev => ({ ...prev, [turma.turmaName]: !isExpanded }))
                }
              }

              return (
                <div
                  key={`${activeView}_${turma.turmaName}`}
                  style={{
                    background: 'hsl(var(--bg-surface))',
                    border: isAdaptadosView
                      ? '1px solid rgba(245, 158, 11, 0.35)'
                      : '1px solid hsl(var(--border-subtle))',
                    borderRadius: 18,
                    overflow: isExpanded ? 'visible' : 'hidden',
                    boxShadow: isAdaptadosView
                      ? '0 4px 20px rgba(245, 158, 11, 0.06)'
                      : '0 4px 20px rgba(0,0,0,0.03)',
                    position: 'relative'
                  }}
                >
                  {/* Turma Accordion Header */}
                  <div 
                    onClick={toggleTurmaAccordion}
                    className="turma-accordion-header"
                    style={{ 
                      padding: '16px 24px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      cursor: 'pointer', 
                      background: isAdaptadosView
                        ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.06) 0%, transparent 100%)'
                        : 'hsl(var(--bg-surface))',
                      borderBottom: isExpanded ? '1px solid hsl(var(--border-subtle))' : 'none',
                      userSelect: 'none',
                      flexWrap: 'wrap',
                      gap: 10
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                      {/* Badge with Turma Index Number in Segment Color */}
                      <div style={{ 
                        width: 32, height: 32, borderRadius: '50%', 
                        background: segInfo.gradient, 
                        color: 'white', fontWeight: 800, fontSize: 14, 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: segInfo.boxShadow, flexShrink: 0 
                      }}>
                        {turma.turmaIndexBadge}
                      </div>

                      {/* Turma Name */}
                      <span style={{ fontSize: 17, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                        {turma.turmaName}
                      </span>

                      {/* Segment Tag with Segment Color */}
                      <span style={{ 
                        padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, 
                        background: segInfo.bgLight, color: segInfo.color, border: `1px solid ${segInfo.border}`,
                        textTransform: 'none', whiteSpace: 'nowrap'
                      }}>
                        {segInfo.segmento}
                      </span>

                      {/* Total Simulados Badge (Regular vs Adaptados) */}
                      {isAdaptadosView ? (
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: 100,
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(245, 158, 11, 0.14)',
                          color: '#b45309',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                          <Sparkles size={11} />
                          {turma.totalProvas} {turma.totalProvas === 1 ? 'simulado adaptado' : 'simulados adaptados'}
                        </span>
                      ) : (
                        <>
                          <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>
                            {turma.totalProvas} {turma.totalProvas === 1 ? 'simulado regular' : 'simulados regulares'}
                          </span>

                          {/* Quick Jump Pill to Adapted Simulados of this Turma (without mixing in table) */}
                          {adaptadosCountInTurma > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setFilterBaseTitle(null)
                                setExpandedTurmasAdaptados(prev => ({ ...prev, [turma.turmaName]: true }))
                                switchActiveView('adaptados')
                              }}
                              title={`Ver os ${adaptadosCountInTurma} simulado(s) adaptado(s) de ${turma.turmaName} na Central de Adaptados`}
                              style={{
                                padding: '3px 10px',
                                borderRadius: 100,
                                fontSize: 11,
                                fontWeight: 700,
                                background: 'rgba(245, 158, 11, 0.12)',
                                color: '#d97706',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Sparkles size={11} />
                              {adaptadosCountInTurma} {adaptadosCountInTurma === 1 ? 'adaptado separado →' : 'adaptados separados →'}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Expand/Collapse Toggle Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'hsl(var(--bg-app))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid hsl(var(--border-subtle))' }}>
                        <ChevronUp size={15} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
                      </div>
                    </div>
                  </div>

                  {/* Turma Accordion Body: Separated strictly by Bimestres */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'visible' }}
                      >
                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }} className="bimestre-group-container">
                          
                          {turma.bimestres.map(bimGroup => {
                            const tbLookupKey = `${turma.turmaName}_${bimGroup.bimestreNome}`
                            const groupKey = isAdaptadosView ? `${tbLookupKey}_adaptados` : tbLookupKey
                            const currentSort = sortOrders[groupKey] || 'ordem'
                            const adaptadosInThisBimestre = adaptadosByTurmaBimestre[tbLookupKey] || []

                            // Apply Sorting
                            let sortedSimulados = [...bimGroup.provas]
                            if (currentSort === 'ordem') {
                              sortedSimulados.sort((a, b) => {
                                const orderA = getSimuladoOrder(a, groupKey)
                                const orderB = getSimuladoOrder(b, groupKey)
                                if (orderA !== null && orderB !== null && orderA !== orderB) {
                                  return orderA - orderB
                                }
                                if (orderA !== null && orderB === null) return -1
                                if (orderA === null && orderB !== null) return 1
                                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                              })
                            } else if (currentSort === 'recentes') {
                              sortedSimulados.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                            } else if (currentSort === 'antigas') {
                              sortedSimulados.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
                            } else if (currentSort === 'az') {
                              sortedSimulados.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''))
                            } else if (currentSort === 'disciplina') {
                              sortedSimulados.sort((a, b) => {
                                const discA = a.simulados_upload_requisicoes?.[0]?.disciplina_nome || 'Geral'
                                const discB = b.simulados_upload_requisicoes?.[0]?.disciplina_nome || 'Geral'
                                return discA.localeCompare(discB)
                              })
                            } else if (currentSort === 'professor') {
                              sortedSimulados.sort((a, b) => {
                                const profA = a.simulados_upload_requisicoes?.[0]?.professor_nome || a.criado_por_nome || ''
                                const profB = b.simulados_upload_requisicoes?.[0]?.professor_nome || b.criado_por_nome || ''
                                return profA.localeCompare(profB)
                              })
                            } else if (currentSort === 'status') {
                              sortedSimulados.sort((a, b) => {
                                const getStatusWeight = (p: any) => {
                                  const req0 = p.simulados_upload_requisicoes?.[0]
                                  const status = req0?.status || p.status || ''
                                  if (status === 'reprovado' || status === 'rejeitado') return 0
                                  if (status === 'aguardando' || status === 'pendente') return 1
                                  if (status === 'enviado' || status === 'em_revisao') return 2
                                  if (status === 'aprovado' || status === 'concluido') return 3
                                  if (status === 'publicado') return 4
                                  return 1
                                }
                                return getStatusWeight(a) - getStatusWeight(b)
                              })
                            }

                            const totalItems = sortedSimulados.length

                            return (
                              <div
                                key={bimGroup.bimestreNome}
                                className="bimestre-card-box"
                                style={{
                                  background: 'hsl(var(--bg-app))',
                                  border: isAdaptadosView
                                    ? '1px solid rgba(245, 158, 11, 0.28)'
                                    : '1px solid hsl(var(--border-subtle))',
                                  borderRadius: 14,
                                  padding: '16px 20px',
                                  position: 'relative',
                                  overflow: 'visible'
                                }}
                              >
                                {/* Bimestre Header Line */}
                                <div className="bimestre-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{
                                      padding: '4px 12px',
                                      borderRadius: 8,
                                      background: isAdaptadosView
                                        ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(217,119,6,0.08))'
                                        : 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(236,72,153,0.06))',
                                      color: isAdaptadosView ? '#d97706' : '#db2777',
                                      fontWeight: 800,
                                      fontSize: 13,
                                      border: isAdaptadosView
                                        ? '1px solid rgba(245,158,11,0.3)'
                                        : '1px solid rgba(236,72,153,0.2)',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {bimGroup.bimestreNome}
                                    </span>
                                    <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                      {isAdaptadosView
                                        ? `${totalItems} ${totalItems === 1 ? 'simulado adaptado neste bimestre' : 'simulados adaptados neste bimestre'}`
                                        : `${totalItems} ${totalItems === 1 ? 'simulado regular neste bimestre' : 'simulados regulares neste bimestre'}`}
                                    </span>
                                  </div>

                                  {/* Sort Selector */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600, whiteSpace: 'nowrap' }}>Ordenar:</span>
                                    <select
                                      value={currentSort}
                                      onChange={e => setSortOrders(prev => ({ ...prev, [groupKey]: e.target.value }))}
                                      style={{ padding: '6px 24px 6px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}
                                    >
                                      <option value="ordem">Ordem personalizada</option>
                                      <option value="recentes">Mais recentes</option>
                                      <option value="antigas">Mais antigas</option>
                                      <option value="az">Título (A-Z)</option>
                                      <option value="disciplina">Disciplina (A-Z)</option>
                                      <option value="professor">Professor (A-Z)</option>
                                      <option value="status">Status</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Ultra-Modern Simulado Cards List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
                                  {sortedSimulados.map((simulado, itemIdx) => {
                                    const rawReqs = simulado.simulados_upload_requisicoes || []
                                    const reqs = rawReqs.length > 0 ? rawReqs : [{
                                      id: simulado.id,
                                      disciplina_nome: 'Geral',
                                      professor_nome: simulado.criado_por_nome || 'Não atribuído',
                                      qtd_questoes: 10,
                                      status: simulado.status
                                    }]

                                    const myReqsInCard = rawReqs.filter((r: any) => isUserRequisicaoOwner(currentUser, r))
                                    const otherReqsInCard = rawReqs.filter((r: any) => !isUserRequisicaoOwner(currentUser, r))
                                    const isCreatedByMe = isUserCreator(currentUser, simulado)
                                    const canUserDeleteOnCard = !isProfView || myReqsInCard.length > 0 || (rawReqs.length === 0 && isCreatedByMe)
                                    const canUserManageConfig = !isProfView || (isCreatedByMe && otherReqsInCard.length === 0)

                                    const isAdaptada = isSimuladoAdaptado(simulado)
                                    const baseSimuladoTitle = getBaseSimuladoTitle(simulado.titulo)
                                    const relatedAdaptados = !isAdaptada
                                      ? adaptadosInThisBimestre.filter(a => getBaseSimuladoTitle(a.titulo).toUpperCase() === baseSimuladoTitle.toUpperCase())
                                      : []
                                    const versionInfo = isAdaptada ? adaptadosVersionInfoMap[`${tbLookupKey}_${simulado.id}`] : null
                                    const isNewlyCreated = newlyCreatedAdaptadoId === simulado.id

                                    const dateCriacaoStr = simulado.created_at ? new Date(simulado.created_at).toLocaleDateString('pt-BR') : '—'
                                    const accentColor = isAdaptada ? '#d97706' : '#8b5cf6'

                                    const myFirstReq = myReqsInCard[0]
                                    const openAllQuestionsUrl = (isProfView && myFirstReq)
                                      ? `/simulados/simulados-upload/${simulado.id}/upload?req=${myFirstReq.id}&prof=${myFirstReq.id_professor || ''}&disc=${myFirstReq.id_disciplina || ''}`
                                      : `/simulados/simulados-upload/${simulado.id}/upload?all=true`
                                    const openAllPrintUrl = (isProfView && myFirstReq)
                                      ? `/simulados/simulados-upload/${simulado.id}/upload?print=true&req=${myFirstReq.id}&prof=${myFirstReq.id_professor || ''}&disc=${myFirstReq.id_disciplina || ''}`
                                      : `/simulados/simulados-upload/${simulado.id}/upload?all=true&print=true`
                                    const editConfigUrl = `/simulados/simulados-upload/${simulado.id}/editar`
                                    const estudioAdaptadaUrl = `/simulados/simulados-upload/${simulado.id}/adaptar`

                                    return (
                                      <div
                                        key={simulado.id}
                                        className="simulado-modern-card"
                                        style={{
                                          borderRadius: 16,
                                          border: isAdaptada
                                            ? (isNewlyCreated ? '1.5px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.35)')
                                            : '1px solid hsl(var(--border-default))',
                                          borderLeft: isAdaptada
                                            ? '4px solid #f59e0b'
                                            : '4px solid #8b5cf6',
                                          boxShadow: isNewlyCreated
                                            ? '0 8px 24px rgba(245, 158, 11, 0.16)'
                                            : '0 2px 10px rgba(15, 23, 42, 0.03)',
                                          overflow: 'hidden'
                                        }}
                                      >
                                        {/* Tier 1: Card Header (Identity on Left + Action Toolbar on Right) */}
                                        <div
                                          className="simulado-card-header-flex"
                                          style={{
                                            padding: '14px 18px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 16,
                                            flexWrap: 'wrap',
                                            borderBottom: '1px solid hsl(var(--border-subtle))',
                                            background: isAdaptada
                                              ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, transparent 65%)'
                                              : 'linear-gradient(90deg, rgba(139, 92, 246, 0.035) 0%, transparent 65%)'
                                          }}
                                        >
                                          {/* Left: Position Stepper + Icon + Title & Meta */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
                                            {/* Modern Compact Stepper Pill */}
                                            <div
                                              style={{
                                                display: 'inline-flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: 'hsl(var(--bg-app))',
                                                border: '1px solid hsl(var(--border-subtle))',
                                                borderRadius: 10,
                                                padding: '2px 4px',
                                                minWidth: 32,
                                                flexShrink: 0
                                              }}
                                            >
                                              <button
                                                type="button"
                                                disabled={itemIdx === 0}
                                                aria-label={`Subir posição de ${simulado.titulo}`}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleMoveSimulado(turma.turmaName, bimGroup.bimestreNome, simulado.id, 'cima', sortedSimulados, groupKey)
                                                }}
                                                title={itemIdx === 0 ? 'Primeira posição' : 'Subir posição na série'}
                                                style={{
                                                  width: 22,
                                                  height: 15,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  border: 'none',
                                                  background: 'transparent',
                                                  color: itemIdx === 0 ? 'hsl(var(--text-secondary))' : accentColor,
                                                  cursor: itemIdx === 0 ? 'not-allowed' : 'pointer',
                                                  opacity: itemIdx === 0 ? 0.25 : 1,
                                                  padding: 0
                                                }}
                                              >
                                                <ChevronUp size={13} strokeWidth={2.5} />
                                              </button>
                                              <span
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: 800,
                                                  color: isAdaptada ? '#d97706' : 'hsl(var(--text-primary))',
                                                  lineHeight: 1.1,
                                                  fontVariantNumeric: 'tabular-nums'
                                                }}
                                                title={`Posição ${itemIdx + 1} de ${sortedSimulados.length} neste bimestre`}
                                              >
                                                {itemIdx + 1}º
                                              </span>
                                              <button
                                                type="button"
                                                disabled={itemIdx === sortedSimulados.length - 1}
                                                aria-label={`Descer posição de ${simulado.titulo}`}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleMoveSimulado(turma.turmaName, bimGroup.bimestreNome, simulado.id, 'baixo', sortedSimulados, groupKey)
                                                }}
                                                title={itemIdx === sortedSimulados.length - 1 ? 'Última posição' : 'Descer posição na série'}
                                                style={{
                                                  width: 22,
                                                  height: 15,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  border: 'none',
                                                  background: 'transparent',
                                                  color: itemIdx === sortedSimulados.length - 1 ? 'hsl(var(--text-secondary))' : accentColor,
                                                  cursor: itemIdx === sortedSimulados.length - 1 ? 'not-allowed' : 'pointer',
                                                  opacity: itemIdx === sortedSimulados.length - 1 ? 0.25 : 1,
                                                  padding: 0
                                                }}
                                              >
                                                <ChevronDown size={13} strokeWidth={2.5} />
                                              </button>
                                            </div>

                                            {/* Simulado Modern Icon Box */}
                                            <div
                                              style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 12,
                                                background: isAdaptada
                                                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                                  : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#ffffff',
                                                flexShrink: 0,
                                                boxShadow: isAdaptada
                                                  ? '0 4px 12px rgba(245, 158, 11, 0.25)'
                                                  : '0 4px 12px rgba(139, 92, 246, 0.25)'
                                              }}
                                            >
                                              {isAdaptada ? <Sparkles size={18} /> : <FileText size={18} />}
                                            </div>

                                            {/* Title + Badges + Author Meta */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <Link
                                                  href={openAllQuestionsUrl}
                                                  style={{
                                                    fontSize: 15,
                                                    fontWeight: 800,
                                                    color: 'hsl(var(--text-primary))',
                                                    textDecoration: 'none',
                                                    letterSpacing: '-0.01em',
                                                    lineHeight: 1.3
                                                  }}
                                                  title="Clique para abrir todas as questões do simulado"
                                                >
                                                  {simulado.titulo}
                                                </Link>

                                                {isAdaptada && (
                                                  <span className="badge-adaptada-neon-brown">
                                                    ADAPTADA
                                                  </span>
                                                )}

                                                {isAdaptada && versionInfo && versionInfo.totalVersions > 1 && (
                                                  <span
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      padding: '2px 8px',
                                                      borderRadius: 9999,
                                                      fontSize: 10,
                                                      fontWeight: 800,
                                                      background: 'rgba(139, 92, 246, 0.12)',
                                                      color: '#7c3aed',
                                                      border: '1px solid rgba(139, 92, 246, 0.28)',
                                                      letterSpacing: '0.02em',
                                                      flexShrink: 0
                                                    }}
                                                  >
                                                    Versão #{versionInfo.versionNumber}
                                                  </span>
                                                )}
                                              </div>

                                              {/* Meta Sub-line */}
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                                                <span>
                                                  {formatCreatedInfo(simulado.created_at, simulado.criado_por_nome, isAdaptada)}
                                                </span>
                                                {isAdaptada && (
                                                  <>
                                                    <span style={{ opacity: 0.4 }}>•</span>
                                                    <span
                                                      style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        padding: '1px 8px',
                                                        borderRadius: 6,
                                                        background: 'hsl(var(--bg-app))',
                                                        border: '1px solid hsl(var(--border-subtle))',
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        color: 'hsl(var(--text-secondary))'
                                                      }}
                                                    >
                                                      Origem: <strong style={{ color: 'hsl(var(--text-primary))', fontWeight: 700 }}>{baseSimuladoTitle}</strong>
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Right: Sleek Horizontal Action Toolbar */}
                                          <div
                                            className="simulado-card-toolbar"
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              flexWrap: 'wrap',
                                              justifyContent: 'flex-end'
                                            }}
                                          >
                                            {/* Editar Questões */}
                                            <Link href={openAllQuestionsUrl} style={{ textDecoration: 'none' }}>
                                              <button
                                                type="button"
                                                className="simulado-action-btn"
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: 5,
                                                  padding: '6px 11px',
                                                  borderRadius: 8,
                                                  border: '1px solid rgba(16, 185, 129, 0.32)',
                                                  color: '#059669',
                                                  background: 'rgba(16, 185, 129, 0.08)',
                                                  fontWeight: 700,
                                                  fontSize: 11.5,
                                                  cursor: 'pointer',
                                                  whiteSpace: 'nowrap'
                                                }}
                                                title="Editar todas as questões do simulado"
                                              >
                                                <Edit size={12} /> Editar
                                              </button>
                                            </Link>

                                            {/* Imprimir */}
                                            <Link href={openAllPrintUrl} style={{ textDecoration: 'none' }}>
                                              <button
                                                type="button"
                                                className="simulado-action-btn"
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: 5,
                                                  padding: '6px 11px',
                                                  borderRadius: 8,
                                                  border: '1px solid rgba(245, 158, 11, 0.32)',
                                                  color: '#d97706',
                                                  background: 'rgba(245, 158, 11, 0.08)',
                                                  fontWeight: 700,
                                                  fontSize: 11.5,
                                                  cursor: 'pointer',
                                                  whiteSpace: 'nowrap'
                                                }}
                                                title="Imprimir simulado completo"
                                              >
                                                <Printer size={12} /> Imprimir
                                              </button>
                                            </Link>

                                            {/* Gabarito */}
                                            <button
                                              type="button"
                                              className="simulado-action-btn"
                                              onClick={() => setGabaritoModalId(simulado.id)}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 5,
                                                padding: '6px 11px',
                                                borderRadius: 8,
                                                border: '1px solid rgba(13, 148, 136, 0.3)',
                                                color: '#0d9488',
                                                background: 'rgba(20, 184, 166, 0.08)',
                                                fontWeight: 700,
                                                fontSize: 11.5,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap'
                                              }}
                                              title="Visualizar gabarito oficial do simulado"
                                            >
                                              <CheckSquare size={12} /> Gabarito
                                            </button>

                                            {/* Config */}
                                            {canUserManageConfig && (
                                              <Link href={editConfigUrl} style={{ textDecoration: 'none' }}>
                                                <button
                                                  type="button"
                                                  className="simulado-action-btn"
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    padding: '6px 11px',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                                    color: '#7c3aed',
                                                    background: 'rgba(139, 92, 246, 0.07)',
                                                    fontWeight: 700,
                                                    fontSize: 11.5,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                  title="Configurações do simulado"
                                                >
                                                  <Layers size={12} /> Config
                                                </button>
                                              </Link>
                                            )}

                                            {/* IA Inclusiva (when Adapted) OR Adaptar + Ver Adaptadas (when Regular) */}
                                            {isAdaptada ? (
                                              <Link href={estudioAdaptadaUrl} style={{ textDecoration: 'none' }}>
                                                <button
                                                  type="button"
                                                  className="simulado-action-btn"
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    padding: '6px 12px',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(217, 119, 6, 0.45)',
                                                    color: '#b45309',
                                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.1))',
                                                    fontWeight: 800,
                                                    fontSize: 11.5,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                  title="Abrir Estúdio de Adaptação Inclusiva (IA)"
                                                >
                                                  <Sparkles size={12} /> IA Inclusiva
                                                </button>
                                              </Link>
                                            ) : (
                                              <>
                                                {canUserManageConfig && (
                                                  <button
                                                    type="button"
                                                    className="simulado-action-btn"
                                                    onClick={() => setAdaptarModalSimulado(simulado)}
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: 5,
                                                      padding: '6px 11px',
                                                      borderRadius: 8,
                                                      border: '1px solid rgba(59, 130, 246, 0.32)',
                                                      color: '#2563eb',
                                                      background: 'rgba(59, 130, 246, 0.08)',
                                                      fontWeight: 700,
                                                      fontSize: 11.5,
                                                      cursor: 'pointer',
                                                      whiteSpace: 'nowrap'
                                                    }}
                                                    title="Criar versão adaptada deste simulado"
                                                  >
                                                    <BookOpen size={12} /> Adaptar
                                                  </button>
                                                )}

                                                {relatedAdaptados.length > 0 && (
                                                  <button
                                                    type="button"
                                                    className="simulado-action-btn"
                                                    onClick={() => {
                                                      setFilterBaseTitle(baseSimuladoTitle)
                                                      setExpandedTurmasAdaptados(prev => ({ ...prev, [turma.turmaName]: true }))
                                                      switchActiveView('adaptados')
                                                    }}
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: 5,
                                                      padding: '6px 11px',
                                                      borderRadius: 8,
                                                      border: '1px solid rgba(217, 119, 6, 0.4)',
                                                      color: '#b45309',
                                                      background: 'rgba(245, 158, 11, 0.14)',
                                                      fontWeight: 800,
                                                      fontSize: 11.5,
                                                      cursor: 'pointer',
                                                      whiteSpace: 'nowrap'
                                                    }}
                                                    title={`Ver ${relatedAdaptados.length} versão(ões) adaptada(s) na Central de Adaptados`}
                                                  >
                                                    <Sparkles size={12} /> Adaptadas ({relatedAdaptados.length})
                                                  </button>
                                                )}
                                              </>
                                            )}

                                            {/* Excluir (Somente visível se o colaborador for dono de alguma parte/simulado ou se for Coordenação/Admin) */}
                                            {canUserDeleteOnCard && (
                                              <button
                                                type="button"
                                                className="simulado-action-btn"
                                                onClick={() => openDeleteModal(simulado)}
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: 4,
                                                  padding: '6px 10px',
                                                  borderRadius: 8,
                                                  border: '1px solid rgba(239, 68, 68, 0.28)',
                                                  color: '#ef4444',
                                                  background: 'rgba(239, 68, 68, 0.06)',
                                                  fontWeight: 700,
                                                  fontSize: 11.5,
                                                  cursor: 'pointer',
                                                  whiteSpace: 'nowrap'
                                                }}
                                                title={
                                                  isProfView && otherReqsInCard.length > 0
                                                    ? 'Excluir apenas as minhas questões enviadas neste simulado'
                                                    : 'Opções de exclusão deste simulado'
                                                }
                                              >
                                                <Trash2 size={12} /> {isProfView && otherReqsInCard.length > 0 ? 'Excluir minha parte' : 'Excluir'}
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Tier 2: Requisitions / Disciplines Rows */}
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          {reqs.map((req: any, rIdx: number) => {
                                            const isLastRow = rIdx === reqs.length - 1
                                            const disciplinaNome = req.disciplina_nome || 'Geral'
                                            const profName = req.professor_nome || simulado.criado_por_nome || 'Não atribuído'
                                            const discStyle = getDisciplinaStyle(disciplinaNome)

                                            // Requisition-specific question count ratio & progress percentage
                                            const reqUploadedCount = Array.isArray(simulado.questoes_json)
                                              ? simulado.questoes_json.filter((q: any) => isQuestionForRequisicao(q, req, reqs, true)).length
                                              : 0
                                            const reqTotalRequested = req.qtd_questoes || 10
                                            const meQuestoesRatio = `${reqUploadedCount}/${reqTotalRequested}`
                                            const progressPct = Math.min(100, Math.round((reqUploadedCount / Math.max(1, reqTotalRequested)) * 100))

                                            // Requisition-specific envio status
                                            const hasUploadedQuestions = reqUploadedCount > 0
                                            const isReqConcluida = req.status === 'aprovado' || req.status === 'concluido' || simulado.status === 'aprovado' || simulado.status === 'publicado'
                                            const isReqReprovada = req.status === 'rejeitado' || req.status === 'reprovado' || simulado.status === 'reprovado'
                                            const isReqEmRevisao = !isReqConcluida && !isReqReprovada && (req.status === 'enviado' || req.status === 'em_revisao')

                                            let statusObj = { label: 'Aguardando', color: '#d97706', dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' }
                                            if (isReqConcluida) {
                                              statusObj = { label: simulado.status === 'publicado' ? 'Publicada' : 'Concluída', color: '#059669', dot: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' }
                                            } else if (isReqReprovada) {
                                              statusObj = { label: 'Devolvida', color: '#dc2626', dot: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' }
                                            } else if (isReqEmRevisao) {
                                              statusObj = { label: 'Em revisão', color: '#2563eb', dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' }
                                            } else if (hasUploadedQuestions) {
                                              statusObj = { label: 'Em elaboração', color: '#d97706', dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' }
                                            }

                                            const isReqEnviada = req.status === 'enviado' || isReqConcluida
                                            const envioLabel = isReqEnviada
                                              ? 'Enviada'
                                              : (isReqReprovada
                                                ? 'Devolvida'
                                                : (hasUploadedQuestions ? 'Em elaboração' : 'Pendente'))

                                            const reqEditUrl = `/simulados/simulados-upload/${simulado.id}/upload?req=${req.id}&prof=${req.id_professor || ''}&disc=${req.id_disciplina || ''}`
                                            const reqPrintUrl = `/simulados/simulados-upload/${simulado.id}/upload?print=true&req=${req.id}&prof=${req.id_professor || ''}&disc=${req.id_disciplina || ''}`

                                            return (
                                              <div
                                                key={`${simulado.id}_${req.id || rIdx}`}
                                                className={isAdaptada ? 'simulado-req-row simulado-req-row-adaptado simulado-req-grid' : 'simulado-req-row simulado-req-grid'}
                                                style={{
                                                  padding: '11px 18px',
                                                  borderBottom: isLastRow ? 'none' : '1px solid hsl(var(--border-subtle))',
                                                  display: 'grid',
                                                  gridTemplateColumns: '1.25fr 1.45fr 1.25fr 1.1fr 0.95fr auto',
                                                  alignItems: 'center',
                                                  gap: 12
                                                }}
                                              >
                                                {/* 1. DISCIPLINA */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--text-secondary))', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    Disciplina
                                                  </span>
                                                  <Link
                                                    href={reqEditUrl}
                                                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', maxWidth: '100%' }}
                                                    title={`Visualizar questões de ${disciplinaNome}`}
                                                  >
                                                    <span
                                                      style={{
                                                        padding: '4px 10px',
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        background: discStyle.bg,
                                                        color: discStyle.color,
                                                        border: `1px solid ${discStyle.border}`,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        maxWidth: '100%'
                                                      }}
                                                    >
                                                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: discStyle.color, flexShrink: 0 }} />
                                                      {disciplinaNome}
                                                    </span>
                                                  </Link>
                                                </div>

                                                {/* 2. PROFESSOR */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--text-secondary))', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    Professor
                                                  </span>
                                                  <Link
                                                    href={reqEditUrl}
                                                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
                                                    title={`Professor ${profName} (${disciplinaNome})`}
                                                    className="prof-link-hover"
                                                  >
                                                    <div
                                                      style={{
                                                        width: 26,
                                                        height: 26,
                                                        borderRadius: '50%',
                                                        background: isAdaptada
                                                          ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                                          : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                                        color: 'white',
                                                        fontSize: 10,
                                                        fontWeight: 800,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                      }}
                                                    >
                                                      {getTeacherInitials(profName)}
                                                    </div>
                                                    <span
                                                      className="prof-name-text"
                                                      style={{
                                                        fontSize: 12.5,
                                                        fontWeight: 700,
                                                        color: 'hsl(var(--text-primary))',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                      }}
                                                      title={profName}
                                                    >
                                                      {formatTeacherShortName(profName)}
                                                    </span>
                                                  </Link>
                                                </div>

                                                {/* 3. CRIAÇÃO / ENVIO */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--text-secondary))', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    Criação / Envio
                                                  </span>
                                                  <Link
                                                    href={reqEditUrl}
                                                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                                                    title={`Visualizar questões de ${disciplinaNome}`}
                                                  >
                                                    <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                      {dateCriacaoStr}
                                                    </span>
                                                    <span
                                                      style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        padding: '2px 7px',
                                                        borderRadius: 9999,
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        background: isReqEnviada ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                        color: isReqEnviada ? '#059669' : '#d97706'
                                                      }}
                                                    >
                                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: isReqEnviada ? '#10b981' : '#f59e0b' }} />
                                                      {envioLabel}
                                                    </span>
                                                  </Link>
                                                </div>

                                                {/* 4. QUESTÕES + PROGRESS BAR */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--text-secondary))', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    Questões
                                                  </span>
                                                  <Link
                                                    href={reqEditUrl}
                                                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                                                    title={`${reqUploadedCount} de ${reqTotalRequested} questões enviadas`}
                                                  >
                                                    <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', fontVariantNumeric: 'tabular-nums' }}>
                                                      {meQuestoesRatio}
                                                    </span>
                                                    <div
                                                      style={{
                                                        width: 52,
                                                        height: 6,
                                                        borderRadius: 999,
                                                        background: 'hsl(var(--bg-app))',
                                                        border: '1px solid hsl(var(--border-subtle))',
                                                        overflow: 'hidden',
                                                        flexShrink: 0
                                                      }}
                                                    >
                                                      <div
                                                        style={{
                                                          width: `${progressPct}%`,
                                                          height: '100%',
                                                          borderRadius: 999,
                                                          background: progressPct >= 100
                                                            ? 'linear-gradient(90deg, #10b981, #059669)'
                                                            : progressPct > 0
                                                              ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                                              : 'transparent',
                                                          transition: 'width 0.3s ease'
                                                        }}
                                                      />
                                                    </div>
                                                  </Link>
                                                </div>

                                                {/* 5. STATUS */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--text-secondary))', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                                    Status
                                                  </span>
                                                  <DropdownMenu.Root>
                                                    <DropdownMenu.Trigger asChild>
                                                      <button
                                                        type="button"
                                                        aria-label={`Status: ${statusObj.label} para ${disciplinaNome}. Clique para gerenciar.`}
                                                        title={`Status: ${statusObj.label}. Clique para alterar status ou ver opções.`}
                                                        disabled={statusUpdatingId === req.id}
                                                        style={{
                                                          padding: '4px 10px',
                                                          borderRadius: 9999,
                                                          fontSize: 11.5,
                                                          fontWeight: 700,
                                                          background: statusObj.bg,
                                                          color: statusObj.color,
                                                          border: `1px solid ${statusObj.border}`,
                                                          display: 'inline-flex',
                                                          alignItems: 'center',
                                                          gap: 6,
                                                          whiteSpace: 'nowrap',
                                                          cursor: 'pointer',
                                                          outline: 'none',
                                                          transition: 'all 0.15s ease'
                                                        }}
                                                      >
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusObj.dot, flexShrink: 0 }} />
                                                        {statusUpdatingId === req.id ? 'Atualizando...' : statusObj.label}
                                                        <ChevronDown size={11} style={{ opacity: 0.6 }} />
                                                      </button>
                                                    </DropdownMenu.Trigger>

                                                    <DropdownMenu.Portal>
                                                      <DropdownMenu.Content
                                                        align="start"
                                                        side="bottom"
                                                        sideOffset={6}
                                                        collisionPadding={12}
                                                        style={{
                                                          minWidth: 230,
                                                          background: 'hsl(var(--bg-elevated))',
                                                          border: '1px solid hsl(var(--border-subtle))',
                                                          borderRadius: 12,
                                                          padding: 6,
                                                          display: 'flex',
                                                          flexDirection: 'column',
                                                          gap: 2,
                                                          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.25), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
                                                          zIndex: 9999999,
                                                          outline: 'none'
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        <div style={{ padding: '6px 10px 4px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'hsl(var(--text-secondary))' }}>
                                                          Alterar Status ({disciplinaNome})
                                                        </div>

                                                        {isCoord && (
                                                          <>
                                                            <DropdownMenu.Item asChild>
                                                              <div
                                                                onClick={() => handleUpdateReqStatus(simulado, req, 'aprovado')}
                                                                style={{ minHeight: 36, padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 600, color: '#10b981', cursor: 'pointer', userSelect: 'none', outline: 'none' }}
                                                                className="menu-item-hover"
                                                              >
                                                                <CheckCircle size={14} color="#10b981" /> Marcar como Concluída / Aprovada
                                                              </div>
                                                            </DropdownMenu.Item>
                                                            <DropdownMenu.Item asChild>
                                                              <div
                                                                onClick={() => handleUpdateReqStatus(simulado, req, 'reprovado')}
                                                                style={{ minHeight: 36, padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 600, color: '#ef4444', cursor: 'pointer', userSelect: 'none', outline: 'none' }}
                                                                className="menu-item-hover"
                                                              >
                                                                <XCircle size={14} color="#ef4444" /> Devolver para Revisão (Solicitar Ajuste)
                                                              </div>
                                                            </DropdownMenu.Item>
                                                          </>
                                                        )}

                                                        <DropdownMenu.Item asChild>
                                                          <div
                                                            onClick={() => handleUpdateReqStatus(simulado, req, 'enviado')}
                                                            style={{ minHeight: 36, padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 600, color: '#3b82f6', cursor: 'pointer', userSelect: 'none', outline: 'none' }}
                                                            className="menu-item-hover"
                                                          >
                                                            <Send size={14} color="#3b82f6" /> {isCoord ? 'Marcar como Em Revisão' : 'Enviar para Revisão da Coordenação'}
                                                          </div>
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Item asChild>
                                                          <div
                                                            onClick={() => handleUpdateReqStatus(simulado, req, 'pendente')}
                                                            style={{ minHeight: 36, padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 600, color: '#f59e0b', cursor: 'pointer', userSelect: 'none', outline: 'none' }}
                                                            className="menu-item-hover"
                                                          >
                                                            <RotateCcw size={14} color="#f59e0b" /> Reabrir para Elaboração (Rascunho)
                                                          </div>
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Separator style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />

                                                        <DropdownMenu.Item asChild>
                                                          <Link href={reqEditUrl} style={{ textDecoration: 'none', outline: 'none' }}>
                                                            <div style={{ minHeight: 36, padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }} className="menu-item-hover">
                                                              <Eye size={14} color="#8b5cf6" /> Abrir no Estúdio de Edição
                                                            </div>
                                                          </Link>
                                                        </DropdownMenu.Item>
                                                      </DropdownMenu.Content>
                                                    </DropdownMenu.Portal>
                                                  </DropdownMenu.Root>
                                                </div>

                                                {/* 6. AÇÕES DA DISCIPLINA */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} className="action-menu-container">
                                                  <Link href={reqEditUrl} style={{ textDecoration: 'none' }}>
                                                    <button
                                                      type="button"
                                                      title={`Visualizar questões de ${disciplinaNome}`}
                                                      aria-label={`Visualizar questões de ${disciplinaNome}`}
                                                      style={{
                                                        width: 30,
                                                        height: 30,
                                                        borderRadius: 8,
                                                        border: '1px solid hsl(var(--border-subtle))',
                                                        background: 'hsl(var(--bg-app))',
                                                        color: accentColor,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                      }}
                                                    >
                                                      <Eye size={14} />
                                                    </button>
                                                  </Link>

                                                  <DropdownMenu.Root>
                                                    <DropdownMenu.Trigger asChild>
                                                      <button
                                                        type="button"
                                                        aria-label={`Mais ações para ${simulado.titulo} (${disciplinaNome})`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                          width: 30,
                                                          height: 30,
                                                          borderRadius: 8,
                                                          border: '1px solid hsl(var(--border-subtle))',
                                                          background: 'hsl(var(--bg-surface))',
                                                          color: 'hsl(var(--text-primary))',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          justifyContent: 'center',
                                                          cursor: 'pointer',
                                                          transition: 'all 0.2s',
                                                          outline: 'none'
                                                        }}
                                                        title="Mais ações"
                                                      >
                                                        <MoreVertical size={14} />
                                                      </button>
                                                    </DropdownMenu.Trigger>

                                                    <DropdownMenu.Portal>
                                                      <DropdownMenu.Content
                                                        align="end"
                                                        side="bottom"
                                                        sideOffset={6}
                                                        collisionPadding={12}
                                                        style={{
                                                          minWidth: 230,
                                                          background: 'hsl(var(--bg-elevated))',
                                                          border: '1px solid hsl(var(--border-subtle))',
                                                          borderRadius: 12,
                                                          padding: 6,
                                                          display: 'flex',
                                                          flexDirection: 'column',
                                                          gap: 2,
                                                          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.25), 0 4px 12px -2px rgba(0, 0, 0, 0.12)',
                                                          zIndex: 9999999,
                                                          outline: 'none'
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        <DropdownMenu.Item asChild>
                                                          <Link href={reqEditUrl} style={{ textDecoration: 'none', outline: 'none' }}>
                                                            <div style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }} className="menu-item-hover">
                                                              <Eye size={15} color="#8b5cf6" /> Visualizar questões ({disciplinaNome})
                                                            </div>
                                                          </Link>
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item asChild>
                                                          <Link href={reqPrintUrl} style={{ textDecoration: 'none', outline: 'none' }}>
                                                            <div style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }} className="menu-item-hover">
                                                              <Printer size={15} color="#f59e0b" /> Imprimir caderno ({disciplinaNome})
                                                            </div>
                                                          </Link>
                                                        </DropdownMenu.Item>

                                                        {/* GERENCIAMENTO DE STATUS DA DISCIPLINA */}
                                                        <DropdownMenu.Separator style={{ height: 1, background: "hsl(var(--border-subtle))", margin: "4px 0" }} />
                                                        <div style={{ padding: '4px 12px 2px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'hsl(var(--text-secondary))' }}>
                                                          Status de {disciplinaNome}
                                                        </div>

                                                        {isCoord && (
                                                          <>
                                                            <DropdownMenu.Item asChild>
                                                              <div
                                                                onClick={() => handleUpdateReqStatus(simulado, req, 'aprovado')}
                                                                style={{ minHeight: 38, padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#10b981", cursor: "pointer", userSelect: "none", outline: "none" }}
                                                                className="menu-item-hover"
                                                              >
                                                                <CheckCircle size={15} color="#10b981" /> Aprovar envio ({disciplinaNome})
                                                              </div>
                                                            </DropdownMenu.Item>
                                                            <DropdownMenu.Item asChild>
                                                              <div
                                                                onClick={() => handleUpdateReqStatus(simulado, req, 'reprovado')}
                                                                style={{ minHeight: 38, padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#ef4444", cursor: "pointer", userSelect: "none", outline: "none" }}
                                                                className="menu-item-hover"
                                                              >
                                                                <XCircle size={15} color="#ef4444" /> Devolver para ajuste ({disciplinaNome})
                                                              </div>
                                                            </DropdownMenu.Item>
                                                          </>
                                                        )}

                                                        <DropdownMenu.Item asChild>
                                                          <div
                                                            onClick={() => handleUpdateReqStatus(simulado, req, 'enviado')}
                                                            style={{ minHeight: 38, padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#3b82f6", cursor: "pointer", userSelect: "none", outline: "none" }}
                                                            className="menu-item-hover"
                                                          >
                                                            <Send size={15} color="#3b82f6" /> {isCoord ? 'Marcar Em Revisão' : 'Enviar para Revisão'} ({disciplinaNome})
                                                          </div>
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Item asChild>
                                                          <div
                                                            onClick={() => handleUpdateReqStatus(simulado, req, 'pendente')}
                                                            style={{ minHeight: 38, padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#f59e0b", cursor: "pointer", userSelect: "none", outline: "none" }}
                                                            className="menu-item-hover"
                                                          >
                                                            <RotateCcw size={15} color="#f59e0b" /> Reabrir elaboração ({disciplinaNome})
                                                          </div>
                                                        </DropdownMenu.Item>

                                                        {/* AÇÕES DE ORDENAÇÃO */}
                                                        <DropdownMenu.Separator style={{ height: 1, background: "hsl(var(--border-subtle))", margin: "4px 0" }} />

                                                        {itemIdx > 0 && (
                                                          <DropdownMenu.Item asChild>
                                                            <div 
                                                              onClick={() => handleMoveSimulado(turma.turmaName, bimGroup.bimestreNome, simulado.id, "cima", sortedSimulados, groupKey)} 
                                                              style={{ minHeight: 38, padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "hsl(var(--text-primary))", cursor: "pointer", userSelect: "none", outline: "none" }} 
                                                              className="menu-item-hover"
                                                            >
                                                              <ArrowUp size={15} color={accentColor} /> Subir posição na série
                                                            </div>
                                                          </DropdownMenu.Item>
                                                        )}

                                                        {itemIdx < sortedSimulados.length - 1 && (
                                                          <DropdownMenu.Item asChild>
                                                            <div 
                                                              onClick={() => handleMoveSimulado(turma.turmaName, bimGroup.bimestreNome, simulado.id, "baixo", sortedSimulados, groupKey)} 
                                                              style={{ minHeight: 38, padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "hsl(var(--text-primary))", cursor: "pointer", userSelect: "none", outline: "none" }} 
                                                              className="menu-item-hover"
                                                            >
                                                              <ArrowDown size={15} color={accentColor} /> Descer posição na série
                                                            </div>
                                                          </DropdownMenu.Item>
                                                        )}

                                                        {(!isProfView || isUserRequisicaoOwner(currentUser, req)) && (
                                                          <>
                                                            <DropdownMenu.Separator style={{ height: 1, background: "hsl(var(--border-subtle))", margin: "4px 0" }} />
                                                            <DropdownMenu.Item asChild>
                                                              <div
                                                                onClick={() => openDeleteModal(simulado, req)}
                                                                style={{ minHeight: 38, padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#ef4444", cursor: "pointer", userSelect: "none", outline: "none" }}
                                                                className="menu-item-hover"
                                                              >
                                                                <Trash2 size={15} color="#ef4444" />
                                                                {isUserRequisicaoOwner(currentUser, req)
                                                                  ? `Excluir meu envio (${disciplinaNome})`
                                                                  : `Excluir envio de ${formatTeacherShortName(profName)} (${disciplinaNome})`}
                                                              </div>
                                                            </DropdownMenu.Item>
                                                          </>
                                                        )}
                                                      </DropdownMenu.Content>
                                                    </DropdownMenu.Portal>
                                                  </DropdownMenu.Root>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>

                                {/* Footer Callout Bar in Regular View when Adapted Simulados exist in this Bimestre */}
                                {!isAdaptadosView && adaptadosInThisBimestre.length > 0 && (
                                  <div style={{
                                    marginTop: 12,
                                    padding: '10px 16px',
                                    borderRadius: 10,
                                    background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.04) 100%)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 10
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--text-primary))', fontWeight: 600 }}>
                                      <Sparkles size={15} color="#d97706" />
                                      <span>
                                        Há <strong style={{ color: '#d97706' }}>{adaptadosInThisBimestre.length} {adaptadosInThisBimestre.length === 1 ? 'simulado adaptado' : 'simulados adaptados'}</strong> neste bimestre organizados separadamente para não misturar com a grade regular.
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFilterBaseTitle(null)
                                        setExpandedTurmasAdaptados(prev => ({ ...prev, [turma.turmaName]: true }))
                                        switchActiveView('adaptados')
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        border: 'none',
                                        color: '#fff',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <Sparkles size={12} /> Ver Simulados Adaptados ({adaptadosInThisBimestre.length}) →
                                    </button>
                                  </div>
                                )}

                              </div>
                            )
                          })}

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '12px 24px', borderRadius: '12px',
                    background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
                    border: '1px solid rgba(139,92,246,0.2)', fontWeight: 'bold',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  {loadingMore ? 'Carregando mais simulados...' : 'Carregar mais simulados'}
                </button>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Modal de Explicação e Confirmação de Adaptar */}
        <AnimatePresence>
          {adaptarModalSimulado && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 9999, padding: 16
              }}
              onClick={() => setAdaptarModalSimulado(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: 20, padding: 28, maxWidth: 480, width: '100%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>
                      Criar Versão Adaptada
                    </h3>
                    <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', margin: '2px 0 0' }}>
                      Educação Especial & Inclusão
                    </p>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-secondary))', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                    Simulado selecionado
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                    {adaptarModalSimulado.titulo}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                    <span><strong>Duplicação Completa:</strong> Uma nova cópia do simulado será gerada com todas as disciplinas, professores e questões atuais.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                    <span><strong>Selo de Identificação:</strong> O novo simulado receberá a tag <strong style={{ color: '#d97706' }}>ADAPTADA</strong> para fácil identificação.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#d97706', fontWeight: 800 }}>•</span>
                    <span><strong>Ambiente Separado:</strong> O simulado adaptado ficará organizado exclusivamente na aba <strong style={{ color: '#d97706' }}>Simulados Adaptados</strong>, sem misturar com os simulados regulares.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                    <span><strong>Total Independência:</strong> As edições e adaptações nas questões feitas na nova versão não afetarão o simulado original.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setAdaptarModalSimulado(null)}
                    style={{
                      padding: '10px 18px', borderRadius: 10, background: 'hsl(var(--bg-app))',
                      border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const s = adaptarModalSimulado
                      setAdaptarModalSimulado(null)
                      handleAdaptar(s)
                    }}
                    style={{
                      padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)', display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <BookOpen size={14} /> Confirmar e Adaptar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Exclusão Inteligente (Isolado por Colaborador ou Completo) */}
        <AnimatePresence>
          {deleteConfirmId && deleteConfirmTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 9999, padding: 16
              }}
              onClick={() => {
                if (!deletingItem) {
                  setDeleteConfirmId(null)
                  setDeleteConfirmTarget(null)
                }
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: 20, padding: 28, maxWidth: 480, width: '100%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Trash2 size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>
                  {deleteConfirmTarget.mode === 'collaborator_only'
                    ? (isProfView ? 'Excluir Meu Envio do Simulado?' : 'Excluir Envio do Colaborador?')
                    : 'Excluir Simulado Completo?'}
                </h3>

                {/* Se houver opções (ex: Coordenação ou criador podendo escolher entre limpar só um colaborador ou todo o simulado) */}
                {deleteConfirmTarget.canDeleteFullSimulado && deleteConfirmTarget.allReqs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0 16px' }}>
                    <label
                      onClick={() => {
                        const defaultReq = deleteConfirmTarget.targetReqs[0] || deleteConfirmTarget.allReqs[0]
                        setDeleteConfirmTarget(prev => prev ? {
                          ...prev,
                          mode: 'collaborator_only',
                          selectedReqId: defaultReq?.id || '',
                          targetReqs: defaultReq ? [defaultReq] : prev.allReqs
                        } : null)
                      }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                        borderRadius: 10, cursor: 'pointer',
                        border: deleteConfirmTarget.mode === 'collaborator_only'
                          ? '1.5px solid #ef4444'
                          : '1px solid hsl(var(--border-subtle))',
                        background: deleteConfirmTarget.mode === 'collaborator_only'
                          ? 'rgba(239, 68, 68, 0.06)'
                          : 'hsl(var(--bg-app))'
                      }}
                    >
                      <input
                        type="radio"
                        checked={deleteConfirmTarget.mode === 'collaborator_only'}
                        onChange={() => {}}
                        style={{ marginTop: 3, accentColor: '#ef4444' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                          Excluir apenas questões de um colaborador
                        </div>
                        <div style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                          Mantém o simulado e preserva todas as questões enviadas pelos demais colaboradores.
                        </div>
                        {deleteConfirmTarget.mode === 'collaborator_only' && deleteConfirmTarget.allReqs.length > 1 && !isProfView && (
                          <select
                            value={deleteConfirmTarget.selectedReqId}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const reqId = e.target.value
                              const found = deleteConfirmTarget.allReqs.find((r: any) => r.id === reqId)
                              if (found) {
                                setDeleteConfirmTarget(prev => prev ? {
                                  ...prev,
                                  selectedReqId: reqId,
                                  targetReqs: [found]
                                } : null)
                              }
                            }}
                            style={{
                              marginTop: 8, width: '100%', padding: '7px 10px', borderRadius: 8,
                              border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))',
                              color: 'hsl(var(--text-primary))', fontSize: 12.5, fontWeight: 600
                            }}
                          >
                            {deleteConfirmTarget.allReqs.map((r: any) => {
                              const qCount = Array.isArray(deleteConfirmTarget.simulado?.questoes_json)
                                ? deleteConfirmTarget.simulado.questoes_json.filter((q: any) => isQuestionForRequisicao(q, r, deleteConfirmTarget.allReqs, true)).length
                                : 0
                              return (
                                <option key={r.id} value={r.id}>
                                  {r.disciplina_nome || 'Geral'} — {r.professor_nome || 'Professor'} ({qCount}/{r.qtd_questoes || 10} questões)
                                </option>
                              )
                            })}
                          </select>
                        )}
                      </div>
                    </label>

                    <label
                      onClick={() => setDeleteConfirmTarget(prev => prev ? { ...prev, mode: 'full_simulado' } : null)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                        borderRadius: 10, cursor: 'pointer',
                        border: deleteConfirmTarget.mode === 'full_simulado'
                          ? '1.5px solid #ef4444'
                          : '1px solid hsl(var(--border-subtle))',
                        background: deleteConfirmTarget.mode === 'full_simulado'
                          ? 'rgba(239, 68, 68, 0.06)'
                          : 'hsl(var(--bg-app))'
                      }}
                    >
                      <input
                        type="radio"
                        checked={deleteConfirmTarget.mode === 'full_simulado'}
                        onChange={() => {}}
                        style={{ marginTop: 3, accentColor: '#ef4444' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                          Excluir card completo do simulado
                        </div>
                        <div style={{ fontSize: 11.5, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
                          Remove o simulado inteiro e todas as disciplinas vinculadas.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                <p style={{ fontSize: 13.5, color: 'hsl(var(--text-secondary))', margin: '0 0 24px', lineHeight: 1.55 }}>
                  {deleteConfirmTarget.mode === 'collaborator_only' ? (
                    <>
                      Serão removidas <strong>apenas as questões e o arquivo enviado</strong> de{' '}
                      <strong style={{ color: 'hsl(var(--text-primary))' }}>
                        {deleteConfirmTarget.targetReqs.map((r: any) => `${r.disciplina_nome || 'Geral'} (${r.professor_nome || 'Colaborador'})`).join(', ')}
                      </strong>
                      . As questões enviadas pelos outros colaboradores neste simulado <strong>permanecerão intactas</strong>.
                    </>
                  ) : (
                    <>
                      Esta ação não pode ser desfeita. O simulado <strong>{deleteConfirmTarget.simulado?.titulo}</strong> e seus dados vinculados serão removidos permanentemente.
                    </>
                  )}
                </p>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    disabled={deletingItem}
                    onClick={() => {
                      setDeleteConfirmId(null)
                      setDeleteConfirmTarget(null)
                    }}
                    style={{
                      padding: '10px 18px', borderRadius: 10, background: 'hsl(var(--bg-app))',
                      border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))',
                      fontSize: 13, fontWeight: 700, cursor: deletingItem ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={deletingItem}
                    onClick={confirmDelete}
                    style={{
                      padding: '10px 18px', borderRadius: 10, background: '#ef4444',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                      cursor: deletingItem ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                      opacity: deletingItem ? 0.7 : 1
                    }}
                  >
                    {deletingItem
                      ? 'Excluindo...'
                      : deleteConfirmTarget.mode === 'collaborator_only'
                        ? 'Excluir Apenas Esta Parte'
                        : 'Excluir Simulado'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Feedback Toast */}
        <AnimatePresence>
          {feedbackToast && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 999999,
                padding: '12px 20px',
                borderRadius: 14,
                background: feedbackToast.type === 'success' ? '#065f46' : '#991b1b',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13.5,
                fontWeight: 700,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              {feedbackToast.type === 'success' ? <CheckCircle size={18} color="#34d399" /> : <XCircle size={18} color="#f87171" />}
              <span>{feedbackToast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
    </>
  )
}
