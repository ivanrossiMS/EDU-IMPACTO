'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, Eye, Clock, CheckCircle, XCircle,
  Upload, BookOpen, Users, User, Info, ChevronRight, AlertCircle, Trash2,
  FileText, Calendar, Layers, Edit, CheckSquare, Printer, ChevronDown, GraduationCap, ChevronUp, Sparkles, BookMarked, MoreVertical
} from 'lucide-react'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { getDerivedStatus } from '@/lib/utils'
import { GabaritoRedacaoModal } from '@/components/simulados/GabaritoRedacaoModal'
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
function formatCreatedInfo(createdAt: string, creatorName: string) {
  const shortAuthor = formatTeacherShortName(creatorName || '') || 'Sistema'
  if (!createdAt) return `Criado por ${shortAuthor}`
  
  try {
    const d = new Date(createdAt)
    const dateStr = d.toLocaleDateString('pt-BR')
    return `Criado por ${shortAuthor} em ${dateStr}`
  } catch (e) {
    return `Criado por ${shortAuthor}`
  }
}

export default function UploadRedacoesGerenciamentoPage() {
  const { currentUser, currentUserPerfil } = useApp()
  const { cfgCalendarioLetivo = [] } = useData()
  const [redacoes, setRedacoes] = useState<any[]>([])
  const [bimestres, setBimestres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterBimestre, setFilterBimestre] = useState('todos')
  const [filterSerie, setFilterSerie] = useState('todas')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [adaptarModalRedacao, setAdaptarModalRedacao] = useState<any | null>(null)
  
  const [expandedTurmas, setExpandedTurmas] = useState<Record<string, boolean>>({})
  const [gabaritoModalId, setGabaritoModalId] = useState<string | null>(null)
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectedRedacoes, setSelectedRedacoes] = useState<Record<string, boolean>>({})
  const [sortOrders, setSortOrders] = useState<Record<string, string>>({})

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
  }, [])

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
      let query = (supabase as any).from('redacao_upload')
        .select('*, redacao_upload_requisicoes(*)')
        .order('created_at', { ascending: false })
      
      if (search) {
        query = query.ilike('titulo', `%${search}%`)
      }
      if (filterBimestre && filterBimestre !== 'todos') {
        query = query.eq('id_bimestre', filterBimestre)
      }

      query = query.range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1)

      const [bimRes, redacoesRes] = await Promise.all([
        (supabase as any).from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome'),
        query
      ])
      
      let newRedacoesData = redacoesRes.data || []
      
      if (newRedacoesData.length < PAGE_SIZE) {
        setHasMore(false)
      } else {
        setHasMore(true)
      }
      
      if (newRedacoesData.length > 0) {
        try {
          newRedacoesData = newRedacoesData.map((p: any) => ({
            ...p,
            status: getDerivedStatus(p, 'redacao')
          }))
          
          const userIds = Array.from(new Set(newRedacoesData.map((p: any) => p.criado_por).filter(Boolean)))
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

              newRedacoesData = newRedacoesData.map((p: any) => ({ ...p, criado_por_nome: usersMap[p.criado_por] || 'Desconhecido' }))
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
        setRedacoes(prev => {
          const newItems = newRedacoesData.filter((n: any) => !prev.some((p: any) => p.id === n.id))
          return [...prev, ...newItems]
        })
      } else {
        setRedacoes(newRedacoesData)
      }

      // Default collapse all turmas initially
      const initialExp: Record<string, boolean> = {}
      newRedacoesData.forEach((p: any) => {
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

  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    await (supabase as any).from('redacao_upload').delete().eq('id', deleteConfirmId)
    setRedacoes(prev => prev.filter(p => p.id !== deleteConfirmId))
    setDeleteConfirmId(null)
  }

  const handleAdaptar = async (redacao: any) => {
    if (redacao.titulo?.includes('ADAPTADO')) {
      window.location.href = `/simulados/redacao-upload/${redacao.id}/adaptar`;
      return;
    }
    
    setLoading(true)
    try {
      const payload = { ...redacao }
      delete payload.id
      delete payload.created_at
      delete payload.redacao_upload_requisicoes
      delete payload.criado_por_nome
      payload.titulo = `${redacao.titulo || 'Redação'} ADAPTADA`
      payload.updated_at = new Date().toISOString()
      
      const { data: newRedacao, error: simError } = await (supabase as any)
        .from('redacao_upload')
        .insert([payload])
        .select()
        .single()
        
      if (simError) throw simError

      if (redacao.redacao_upload_requisicoes && redacao.redacao_upload_requisicoes.length > 0) {
        const reqsPayload = redacao.redacao_upload_requisicoes.map((r: any) => {
          const newReq = { ...r }
          delete newReq.id
          delete newReq.created_at
          newReq.id_redacao_upload = newRedacao.id
          return newReq
        })
        const { error: reqError } = await (supabase as any)
          .from('redacao_upload_requisicoes')
          .insert(reqsPayload)
          
        if (reqError) throw reqError
      }
      
      await loadData()
    } catch (e: any) {
      console.error(e)
      alert('Erro ao adaptar redação: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const isProfView = currentUserPerfil === 'Professor'
  const isCoord = currentUserPerfil !== 'Professor'

  const bimsInYear = useMemo(() => bimestres.filter(b => b.ano_letivo === selectedAnoLetivo).map(b => b.id), [bimestres, selectedAnoLetivo])
  const redacoesInYear = useMemo(() => redacoes.filter(p => bimsInYear.includes(p.id_bimestre)), [redacoes, bimsInYear])

  const filtered = useMemo(() => {
    return redacoesInYear.filter(p => {
      const matchStatus = filterStatus === 'todos' || p.status === filterStatus
      const matchBimestre = filterBimestre === 'todos' || p.id_bimestre === filterBimestre
      const matchSerie = filterSerie === 'todas' || (p.series && (Array.isArray(p.series) ? p.series.includes(filterSerie) : p.series === filterSerie))
      const isAssigned = !isProfView || (p.redacao_upload_requisicoes || []).some((r: any) => r.id_professor === currentUser?.id)
      return matchStatus && matchBimestre && matchSerie && isAssigned
    })
  }, [redacoesInYear, filterStatus, filterBimestre, filterSerie, isProfView, currentUser?.id])

  const groupedStructure = useMemo(() => {
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
    filtered.forEach(item => {
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
  }, [filtered, bimestres, seriesOptions])

  const toggleSelectRedacao = (id: string) => {
    setSelectedRedacoes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSelectAllGroup = (items: any[]) => {
    const allSelected = items.every(p => selectedRedacoes[p.id])
    const nextState = { ...selectedRedacoes }
    items.forEach(p => {
      nextState[p.id] = !allSelected
    })
    setSelectedRedacoes(nextState)
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
      {gabaritoModalId && <GabaritoRedacaoModal provaUploadId={gabaritoModalId} onClose={() => setGabaritoModalId(null)} />}

      <div className="simulados-upload-container" style={{ padding: '32px 40px', maxWidth: 1280, margin: '0 auto', display: selectedAnoLetivo && !showAnoModal ? 'block' : 'none' }}>
      
      <style>{`
        .table-row-hover {
          background-color: hsl(var(--bg-surface)) !important;
        }
        .table-row-hover:hover:not(:has(td[rowSpan]:hover)) > td:not([rowSpan]) {
          background-color: rgba(139, 92, 246, 0.04) !important;
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
        @media (max-width: 768px) {
          .simulados-upload-container { padding: 14px 10px !important; }
          .provas-header-flex { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .provas-header-flex button { width: 100% !important; justify-content: center !important; }
          .provas-filters-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .provas-filters-grid select { font-size: 12px !important; padding-left: 8px !important; padding-right: 22px !important; height: 40px !important; }
          .turma-accordion-header { padding: 12px 10px !important; }
          .bimestre-group-container { padding: 12px 4px !important; }
          .bimestre-card-box { padding: 12px 8px !important; }
          .bimestre-header-flex { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .bimestre-header-flex > div { width: 100% !important; justify-content: space-between !important; }
          .mobile-scroll-hint { display: block !important; }
          .table-responsive-wrapper { overflow-x: auto !important; -webkit-overflow-scrolling: touch; width: 100% !important; margin: 0 !important; display: block !important; }
          .table-responsive-wrapper table { min-width: 920px !important; }
        }
      `}</style>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div className="provas-header-flex" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(139,92,246,0.3)', flexShrink: 0 }}>
                <Edit size={24} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
                  Redações por Turmas e Bimestres
                </h1>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0 0', fontSize: 13 }}>
                  {isCoord ? 'Gerenciamento oficial de redações organizadas por turmas e bimestres.' : 'Visualize e gerencie suas propostas de redação por turmas e bimestres.'}
                </p>
              </div>
            </div>
          </div>
          <Link href="/simulados/redacao-upload/nova" style={{ textDecoration: 'none' }}>
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
              <Plus size={18} /> Nova Redação
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
                const newYearBims = bimestres.filter(b => String(b.ano_letivo) === newAno || (!b.ano_letivo && b.nome?.includes(newAno)));
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
              {[...cfgCalendarioLetivo].sort((a: any, b: any) => parseInt(b.ano) - parseInt(a.ano)).map((item: any) => (
                <option key={item.id} value={item.ano}>{item.ano}</option>
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
              {bimestres.filter(b => b.ano_letivo === selectedAnoLetivo).map(bim => (
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
              <option value="aguardando">Aguardando</option>
              <option value="em_revisao">Em Revisão</option>
              <option value="aprovado">Concluída / Aprovado</option>
              <option value="reprovado">Reprovado</option>
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Content List */}
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
        ) : groupedStructure.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '80px 40px', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Upload size={28} color="#8b5cf6" />
            </div>
            <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
              Nenhuma redação cadastrada
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: 0 }}>
              Tente alterar os filtros ou clique em "Nova Redação".
            </p>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groupedStructure.map(turma => {
              const segInfo = turma.segmentoInfo
              const isExpanded = expandedTurmas[turma.turmaName] ?? false

              return (
                <div key={turma.turmaName} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 18, overflow: isExpanded ? 'visible' : 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', position: 'relative' }}>
                  
                  {/* Turma Accordion Header */}
                  <div 
                    onClick={() => setExpandedTurmas(prev => ({ ...prev, [turma.turmaName]: !isExpanded }))}
                    className="turma-accordion-header"
                    style={{ 
                      padding: '16px 24px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      cursor: 'pointer', 
                      background: 'hsl(var(--bg-surface))',
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

                      {/* Total Redações Badge */}
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>
                        {turma.totalProvas} {turma.totalProvas === 1 ? 'redação' : 'redações'}
                      </span>
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
                            const groupKey = `${turma.turmaName}_${bimGroup.bimestreNome}`
                            const currentSort = sortOrders[groupKey] || 'recentes'

                            // Apply Sorting
                            let sortedRedacoes = [...bimGroup.provas]
                            if (currentSort === 'recentes') {
                              sortedRedacoes.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                            } else if (currentSort === 'antigas') {
                              sortedRedacoes.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
                            } else if (currentSort === 'az') {
                              sortedRedacoes.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''))
                            } else if (currentSort === 'disciplina') {
                              sortedRedacoes.sort((a, b) => {
                                const discA = a.redacao_upload_requisicoes?.[0]?.disciplina_nome || 'Redação'
                                const discB = b.redacao_upload_requisicoes?.[0]?.disciplina_nome || 'Redação'
                                return discA.localeCompare(discB)
                              })
                            } else if (currentSort === 'professor') {
                              sortedRedacoes.sort((a, b) => {
                                const profA = a.redacao_upload_requisicoes?.[0]?.professor_nome || a.criado_por_nome || ''
                                const profB = b.redacao_upload_requisicoes?.[0]?.professor_nome || b.criado_por_nome || ''
                                return profA.localeCompare(profB)
                              })
                            } else if (currentSort === 'status') {
                              sortedRedacoes.sort((a, b) => {
                                const getStatusWeight = (p: any) => {
                                  const req0 = p.redacao_upload_requisicoes?.[0]
                                  const status = req0?.status || p.status || ''
                                  if (status === 'aguardando' || (!status && !req0?.enviado_em)) return 1
                                  if (status === 'enviado' || status === 'em_revisao' || req0?.enviado_em) return 2
                                  if (status === 'aprovado' || status === 'concluido' || status === 'publicado') return 3
                                  return 4
                                }
                                return getStatusWeight(a) - getStatusWeight(b)
                              })
                            }

                            const totalItems = sortedRedacoes.length
                            const isAllSelected = totalItems > 0 && sortedRedacoes.every(p => selectedRedacoes[p.id])

                            return (
                              <div key={bimGroup.bimestreNome} className="bimestre-card-box" style={{ background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 14, padding: '16px 20px', position: 'relative', overflow: 'visible' }}>
                                
                                {/* Bimestre Header Line */}
                                <div className="bimestre-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{ padding: '4px 12px', borderRadius: 8, background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(236,72,153,0.06))', color: '#db2777', fontWeight: 800, fontSize: 13, border: '1px solid rgba(236,72,153,0.2)', whiteSpace: 'nowrap' }}>
                                      {bimGroup.bimestreNome}
                                    </span>
                                    <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                      {totalItems} {totalItems === 1 ? 'redação neste bimestre' : 'redações neste bimestre'}
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
                                      <option value="recentes">Mais recentes</option>
                                      <option value="antigas">Mais antigas</option>
                                      <option value="az">Título (A-Z)</option>
                                      <option value="disciplina">Disciplina (A-Z)</option>
                                      <option value="professor">Professor (A-Z)</option>
                                      <option value="status">Status</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Indicador Visual de Scroll no Mobile */}
                                <div className="mobile-scroll-hint" style={{ display: 'none', fontSize: 11, fontWeight: 700, color: '#8b5cf6', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '6px 12px', borderRadius: 8, marginBottom: 10, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  👈 Deslize a tabela para o lado para ver todas as colunas 👉
                                </div>

                                {/* Table List matching Reference Image UI */}
                                <div className="table-responsive-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                                  <table style={{ width: '100%', minWidth: 920, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                                    <thead>
                                      <tr style={{ color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                                        <th style={{ width: 260, minWidth: 220, padding: '8px 12px 8px 16px', textAlign: 'left' }}>REDAÇÃO</th>
                                        <th style={{ width: 130, minWidth: 110, padding: '8px 6px', textAlign: 'left' }}>DISCIPLINA</th>
                                        <th style={{ width: 160, minWidth: 140, padding: '8px 6px', textAlign: 'left' }}>PROFESSOR</th>
                                        <th style={{ width: 145, minWidth: 130, padding: '8px 6px', textAlign: 'left' }}>CRIAÇÃO / ENVIO</th>
                                        <th style={{ width: 85, minWidth: 75, padding: '8px 4px', textAlign: 'center' }}>PROPOSIÇÕES</th>
                                        <th style={{ width: 110, minWidth: 100, padding: '8px 4px', textAlign: 'center' }}>STATUS</th>
                                        <th style={{ width: 120, minWidth: 110, padding: '8px 4px', textAlign: 'right' }}>AÇÕES</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortedRedacoes.map(redacao => {
                                        const rawReqs = redacao.redacao_upload_requisicoes || []
                                        const reqs = rawReqs.length > 0 ? rawReqs : [{
                                          id: redacao.id,
                                          disciplina_nome: 'Redação',
                                          professor_nome: redacao.criado_por_nome || 'Não atribuído',
                                          qtd_questoes: 1,
                                          status: redacao.status
                                        }]

                                        const isAdaptada = redacao.titulo?.toUpperCase().includes('ADAPTAD') || Boolean(redacao.eh_adaptada)
                                        const dateCriacaoStr = redacao.created_at ? new Date(redacao.created_at).toLocaleDateString('pt-BR') : ''
                                        const rowSpanCount = reqs.length

                                        return reqs.map((req: any, rIdx: number) => {
                                          const isFirstRow = rIdx === 0
                                          const disciplinaNome = req.disciplina_nome || 'Redação'
                                          const profName = req.professor_nome || redacao.criado_por_nome || 'Não atribuído'
                                          const discStyle = getDisciplinaStyle(disciplinaNome)

                                          // Requisition-specific proposition count ratio (e.g. 1/1)
                                          const reqUploadedCount = Array.isArray(redacao.questoes_json)
                                            ? redacao.questoes_json.filter((q: any) => 
                                                (q.id_professor === req.id_professor || q.id_requisicao === req.id) &&
                                                q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio
                                              ).length
                                            : (redacao.questoes_count || 0)
                                          const reqTotalRequested = req.qtd_questoes || 1
                                          const meQuestoesRatio = `${reqUploadedCount}/${reqTotalRequested}`

                                          // Requisition-specific envio status
                                          const isReqEnviada = req.enviado_em || req.status === 'enviado' || req.status === 'aprovado' || req.status === 'concluido' || redacao.status === 'aprovado' || redacao.status === 'publicado'
                                          const envioLabel = isReqEnviada ? 'Enviada' : 'Pendente'

                                          // Requisition-specific status badge
                                          const isReqConcluida = req.status === 'aprovado' || req.status === 'concluido' || redacao.status === 'aprovado' || redacao.status === 'publicado'
                                          const isReqEmRevisao = req.status === 'enviado' || req.status === 'em_revisao' || !!req.enviado_em
                                          const isReqReprovada = req.status === 'rejeitado' || req.status === 'reprovado'

                                          let statusObj = { label: 'Aguardando', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' }
                                          if (isReqConcluida) {
                                            statusObj = { label: 'Concluída', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' }
                                          } else if (isReqReprovada) {
                                            statusObj = { label: 'Devolvida', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' }
                                          } else if (isReqEmRevisao) {
                                            statusObj = { label: 'Em revisão', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' }
                                          }

                                          const editUrl = `/simulados/redacao-upload/${redacao.id}/upload?req=${req.id}&prof=${req.id_professor || ''}`
                                          const editConfigUrl = `/simulados/redacao-upload/${redacao.id}/editar`

                                          return (
                                            <tr key={`${redacao.id}_${req.id || rIdx}`} className="table-row-hover" style={{ background: 'hsl(var(--bg-surface))' }}>
                                              
                                              {/* REDAÇÃO Title (spans all reqs of this redacao) */}
                                              {isFirstRow && (
                                                <td rowSpan={rowSpanCount} style={{ background: 'hsl(var(--bg-surface))', padding: '8px 12px 8px 16px', borderRadius: '12px 0 0 12px', borderLeft: '1px solid hsl(var(--border-subtle))', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', verticalAlign: 'middle' }}>
                                                  <Link href={`/simulados/redacao-upload/${redacao.id}/upload?all=true`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', cursor: 'pointer' }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                                      <FileText size={15} />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={redacao.titulo}>
                                                          {redacao.titulo}
                                                        </span>
                                                        {isAdaptada && (
                                                          <span className="badge-adaptada-neon-brown">
                                                            ADAPTADA
                                                          </span>
                                                        )}
                                                      </div>
                                                      <span style={{ fontSize: 10, fontStyle: 'italic', fontWeight: 500, color: 'hsl(var(--text-secondary))', marginTop: 2, whiteSpace: 'nowrap' }}>
                                                        {formatCreatedInfo(redacao.created_at, redacao.criado_por_nome)}
                                                       </span>
                                                     </div>
                                                   </Link>
                                                 </td>
                                               )}

                                               {/* DISCIPLINA (Individual per req) */}
                                               <td style={{ padding: '8px 6px', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', verticalAlign: 'middle' }}>
                                                 <Link href={editUrl} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }} title={`Inserir/gerenciar proposta de ${disciplinaNome}`}>
                                                   <span style={{ 
                                                     padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, 
                                                     background: discStyle.bg, color: discStyle.color, border: `1px solid ${discStyle.border}`,
                                                     display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                                                     cursor: 'pointer', transition: 'all 0.15s ease'
                                                   }}>
                                                     {disciplinaNome}
                                                   </span>
                                                 </Link>
                                               </td>

                                              {/* PROFESSOR (Individual per req) */}
                                              <td style={{ padding: '8px 6px', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', verticalAlign: 'middle' }}>
                                                <Link 
                                                  href={editUrl} 
                                                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', cursor: 'pointer' }}
                                                  title={`Clique para inserir a proposta de redação do professor ${profName}`}
                                                  className="prof-link-hover"
                                                >
                                                  <div style={{ 
                                                    width: 26, height: 26, borderRadius: '50%', 
                                                    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', 
                                                    color: 'white', fontSize: 10, fontWeight: 800, 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0
                                                  }}>
                                                    {getTeacherInitials(profName)}
                                                  </div>
                                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={profName} className="prof-name-text">
                                                    {formatTeacherShortName(profName)}
                                                  </span>
                                                </Link>
                                              </td>

                                              {/* CRIAÇÃO / ENVIO (Individual per req) */}
                                              <td style={{ padding: '8px 6px', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap', overflow: 'hidden', verticalAlign: 'middle' }}>
                                                <Link href={editUrl} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                                                  <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                                                    {dateCriacaoStr}
                                                  </span>
                                                  <span style={{ fontSize: 12, fontWeight: 700, color: isReqEnviada ? '#10b981' : '#f59e0b', marginLeft: 4 }}>
                                                    • {envioLabel}
                                                  </span>
                                                </Link>
                                              </td>

                                              {/* PROPOSIÇÕES (Individual per req) */}
                                              <td style={{ padding: '8px 4px', textAlign: 'center', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                                <Link href={editUrl} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                                                  <span style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                                                    {meQuestoesRatio}
                                                  </span>
                                                </Link>
                                              </td>

                                              {/* STATUS (Individual per req) */}
                                              <td style={{ padding: '8px 4px', textAlign: 'center', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', verticalAlign: 'middle' }}>
                                                <Link href={editUrl} style={{ textDecoration: 'none', cursor: 'pointer' }}>
                                                  <span style={{ 
                                                    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, 
                                                    background: statusObj.bg, color: statusObj.color, border: `1px solid ${statusObj.border}`,
                                                    display: 'inline-block', whiteSpace: 'nowrap'
                                                  }}>
                                                    {statusObj.label}
                                                  </span>
                                                </Link>
                                              </td>

                                              {/* AÇÕES (Individual per req) */}
                                              <td style={{ padding: '8px 4px', borderRadius: rIdx === rowSpanCount - 1 ? '0 12px 12px 0' : '0', borderRight: '1px solid hsl(var(--border-subtle))', borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'right', position: 'relative', overflow: 'visible', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }} className="action-menu-container">
                                                  
                                                  {/* Botão Editar para esta redação -> edita configurações */}
                                                  <Link href={editConfigUrl} style={{ textDecoration: 'none' }}>
                                                    <button 
                                                      style={{ 
                                                        display: 'inline-flex', alignItems: 'center', gap: 4, 
                                                        padding: '4px 8px', borderRadius: 6, 
                                                        border: '1px solid rgba(59,130,246,0.4)', color: '#3b82f6', 
                                                        background: 'rgba(59,130,246,0.05)', fontWeight: 700, fontSize: 12, 
                                                        cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
                                                      }}
                                                      title="Editar configurações da redação"
                                                    >
                                                      <Edit size={12} /> Editar
                                                    </button>
                                                  </Link>

                                                  {/* Radix DropdownMenu de 3 pontinhos para esta disciplina/professor */}
                                                  <DropdownMenu.Root>
                                                    <DropdownMenu.Trigger asChild>
                                                      <button
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                          width: 26, height: 26, borderRadius: 6,
                                                          border: '1px solid hsl(var(--border-subtle))',
                                                          background: 'hsl(var(--bg-surface))',
                                                          color: 'hsl(var(--text-primary))',
                                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                          cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
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
                                                          <Link href={editUrl} style={{ textDecoration: 'none', outline: 'none' }}>
                                                            <div style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }} className="menu-item-hover">
                                                              <Eye size={15} color="#8b5cf6" /> Visualizar / Proposta ({disciplinaNome})
                                                            </div>
                                                          </Link>
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Item asChild>
                                                          <Link href={editConfigUrl} style={{ textDecoration: 'none', outline: 'none' }}>
                                                            <div style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }} className="menu-item-hover">
                                                              <Edit size={15} color="#ec4899" /> Editar Configurações
                                                            </div>
                                                          </Link>
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Item asChild>
                                                          <div onClick={() => setGabaritoModalId(redacao.id)} style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none', outline: 'none' }} className="menu-item-hover">
                                                            <CheckSquare size={15} color="#10b981" /> Espelho de Correção
                                                          </div>
                                                        </DropdownMenu.Item>

                                                        {!isAdaptada && (
                                                          <DropdownMenu.Item asChild>
                                                            <div onClick={() => setAdaptarModalRedacao(redacao)} style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none', outline: 'none' }} className="menu-item-hover">
                                                              <BookOpen size={15} color="#3b82f6" /> Adaptar redação
                                                            </div>
                                                          </DropdownMenu.Item>
                                                        )}

                                                        <DropdownMenu.Item asChild>
                                                          <Link href={`/simulados/redacao-upload/${redacao.id}/upload?print=true&req=${req.id}`} style={{ textDecoration: 'none', outline: 'none' }}>
                                                            <div style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer', userSelect: 'none' }} className="menu-item-hover">
                                                              <Printer size={15} color="#f59e0b" /> Imprimir folha ({disciplinaNome})
                                                            </div>
                                                          </Link>
                                                        </DropdownMenu.Item>

                                                        <DropdownMenu.Separator style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />

                                                        <DropdownMenu.Item asChild>
                                                          <div onClick={() => setDeleteConfirmId(redacao.id)} style={{ minHeight: 40, padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: '#ef4444', cursor: 'pointer', userSelect: 'none', outline: 'none' }} className="menu-item-hover">
                                                            <Trash2 size={15} color="#ef4444" /> Excluir
                                                          </div>
                                                        </DropdownMenu.Item>
                                                      </DropdownMenu.Content>
                                                    </DropdownMenu.Portal>
                                                  </DropdownMenu.Root>

                                                </div>
                                              </td>

                                            </tr>
                                          )
                                        })
                                      })}
                                    </tbody>
                                  </table>
                                </div>

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
                  {loadingMore ? 'Carregando mais redações...' : 'Carregar mais redações'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal de Explicação e Confirmação de Adaptar */}
        <AnimatePresence>
          {adaptarModalRedacao && (
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
              onClick={() => setAdaptarModalRedacao(null)}
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
                    Redação selecionada
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                    {adaptarModalRedacao.titulo}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                    <span><strong>Duplicação Completa:</strong> Uma nova cópia da proposta de redação será gerada com todas as configurações, professores e temas atuais.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                    <span><strong>Selo de Identificação:</strong> A nova redação receberá a tag <strong style={{ color: '#d97706' }}>ADAPTADA</strong> para fácil identificação.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                    <span><strong>Total Independência:</strong> As edições e adaptações feitas na nova versão não afetarão a proposta regular original.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setAdaptarModalRedacao(null)}
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
                      const r = adaptarModalRedacao
                      setAdaptarModalRedacao(null)
                      handleAdaptar(r)
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

        {/* Modal de Exclusão */}
        <AnimatePresence>
          {deleteConfirmId && (
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
              onClick={() => setDeleteConfirmId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: 20, padding: 28, maxWidth: 420, width: '100%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Trash2 size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>
                  Excluir Redação?
                </h3>
                <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', margin: '0 0 24px', lineHeight: 1.5 }}>
                  Esta ação não pode ser desfeita. Todos os arquivos e dados vinculados a esta proposta de redação serão removidos permanentemente.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    style={{
                      padding: '10px 18px', borderRadius: 10, background: 'hsl(var(--bg-app))',
                      border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    style={{
                      padding: '10px 18px', borderRadius: 10, background: '#ef4444',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
    </>
  )
}
