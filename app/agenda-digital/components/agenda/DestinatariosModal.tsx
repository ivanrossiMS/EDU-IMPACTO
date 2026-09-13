'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { 
  X, Search, Users, Check, Building2, GraduationCap, Calendar, ArrowLeft, ChevronRight,
  Shield, DollarSign, UserCheck, Phone, FileText, Briefcase, BookOpen, ChevronDown, ChevronUp,
  User, Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { isAlunoCursandoTurma, compareTurmasBySerie, getTurmaSerieWeight } from '@/lib/studentTurmaUtils'

interface DestinatariosModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (selected: {id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}[]) => void
  initialSelected?: {id: string, name: string, type?: 'turma' | 'funcionario' | 'aluno' | 'grupo'}[]
  allowedTurmasIds?: string[]
  allowedGruposIds?: string[]
  currentUserId?: string
  hideFilterTabs?: boolean
  hideAllColabsButton?: boolean
}

const DEST_MODAL_STYLES = `
  .dest-modal-container {
    width: 100%;
    height: 100dvh;
    position: absolute;
    inset: 0;
    background: #F8FAFC;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .dest-modal-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  .dest-modal-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid #E2E8F0;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 30;
  }
  .dest-modal-btn-cancel,
  .dest-modal-btn-confirm {
    flex: 1;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }
  .dest-modal-btn-cancel {
    background: #F1F5F9;
    color: #475569;
  }
  .dest-modal-btn-cancel:hover {
    background: #E2E8F0;
  }
  .dest-modal-btn-confirm {
    font-weight: 800;
    color: #FFFFFF;
  }
  @media (min-width: 1024px) {
    .dest-modal-container {
      width: 90%;
      max-width: 720px;
      height: 90vh;
      max-height: 850px;
      position: relative;
      border-radius: 28px;
      box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.25);
    }
    .dest-modal-footer {
      justify-content: flex-end;
      padding: 16px 24px;
    }
    .dest-modal-btn-cancel {
      flex: none;
      min-width: 120px;
      padding: 0 24px;
    }
    .dest-modal-btn-confirm {
      flex: none;
      min-width: 160px;
      padding: 0 28px;
    }
  }
  @keyframes orbitSpinCW {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes orbitSpinCCW {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }
  @keyframes cyberCorePulse {
    0%, 100% {
      transform: scale(0.92);
      filter: drop-shadow(0 0 6px rgba(0, 210, 255, 0.6));
    }
    50% {
      transform: scale(1.15);
      filter: drop-shadow(0 0 16px rgba(117, 81, 255, 0.8)) drop-shadow(0 0 24px rgba(0, 210, 255, 0.7));
    }
  }
  @keyframes destAuraGlow {
    0%, 100% {
      transform: scale(0.92);
      opacity: 0.35;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.75;
    }
  }
  @keyframes laserBeamSweep {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(100%); }
    100% { transform: translateX(250%); }
  }
  @keyframes destPulseDot {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  @keyframes destPulseBadge {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    50% { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  }
  @keyframes destShimmerLine {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes waveAnimation {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`

function ensureDestStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('dest-modal-global-styles')) return
  const style = document.createElement('style')
  style.id = 'dest-modal-global-styles'
  style.innerHTML = DEST_MODAL_STYLES
  document.head.appendChild(style)
}

// Utilitário para iniciais dos colaboradores
function getInitials(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Paletas de cores harmônicas para avatares
const AVATAR_PALETTES = [
  { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
  { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' },
  { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD' },
]

function getAvatarPalette(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length
  return AVATAR_PALETTES[index]
}

// Helper para obter ícone, cores e informações visuais por departamento
function getEquipeDepartmentInfo(nome: string, fallbackColor?: string) {
  const n = (nome || '').toLowerCase()
  if (n.includes('direção') || n.includes('direcao') || n.includes('diretoria')) {
    return {
      icon: Shield,
      color: fallbackColor || '#EC4899',
      gradient: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
      bgSoft: '#FFF1F2',
      borderSoft: '#FFE4E6',
      badgeBg: 'rgba(244, 63, 94, 0.1)',
      badgeColor: '#E11D48',
      tag: 'Direção'
    }
  }
  if (n.includes('coordenação') || n.includes('coordenacao') || n.includes('pedag')) {
    return {
      icon: GraduationCap,
      color: fallbackColor || '#6366F1',
      gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
      bgSoft: '#EEF2FF',
      borderSoft: '#E0E7FF',
      badgeBg: 'rgba(99, 102, 241, 0.1)',
      badgeColor: '#4F46E5',
      tag: 'Coordenação'
    }
  }
  if (n.includes('financeiro') || n.includes('cobr') || n.includes('contabil')) {
    return {
      icon: DollarSign,
      color: fallbackColor || '#10B981',
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      bgSoft: '#ECFDF5',
      borderSoft: '#D1FAE5',
      badgeBg: 'rgba(16, 185, 129, 0.1)',
      badgeColor: '#059669',
      tag: 'Financeiro'
    }
  }
  if (n.includes('inspetor') || n.includes('patio') || n.includes('disciplina')) {
    return {
      icon: UserCheck,
      color: fallbackColor || '#F59E0B',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      bgSoft: '#FFFBEB',
      borderSoft: '#FEF3C7',
      badgeBg: 'rgba(245, 158, 11, 0.1)',
      badgeColor: '#D97706',
      tag: 'Inspetoria'
    }
  }
  if (n.includes('recepção') || n.includes('recepcao') || n.includes('atendimento')) {
    return {
      icon: Phone,
      color: fallbackColor || '#8B5CF6',
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      bgSoft: '#F5F3FF',
      borderSoft: '#EDE9FE',
      badgeBg: 'rgba(139, 92, 246, 0.1)',
      badgeColor: '#7C3AED',
      tag: 'Recepção'
    }
  }
  if (n.includes('secretaria') || n.includes('document')) {
    return {
      icon: FileText,
      color: fallbackColor || '#0EA5E9',
      gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
      bgSoft: '#F0F9FF',
      borderSoft: '#E0F2FE',
      badgeBg: 'rgba(14, 165, 233, 0.1)',
      badgeColor: '#0284C7',
      tag: 'Secretaria'
    }
  }
  return {
    icon: Briefcase,
    color: fallbackColor || '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    bgSoft: '#F8FAFC',
    borderSoft: '#E2E8F0',
    badgeBg: 'rgba(99, 102, 241, 0.1)',
    badgeColor: '#4F46E5',
    tag: 'Equipe Escolar'
  }
}

// Identifica se um grupo pertence à Equipe Escolar
function isEquipeEscolarGrupo(g: any): boolean {
  if (!g) return false
  if (
    g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1 ||
    g.dados?.isEquipeEscolar === true || g.dados?.isEquipeEscolar === 'true' || g.dados?.isEquipeEscolar === 1 ||
    g.ano === 'Equipe Escolar' || g.dados?.ano === 'Equipe Escolar'
  ) return true
  const n = String(g.nome || '').toLowerCase()
  if (
    n.includes('coordenação') ||
    n.includes('coordenacao') ||
    n.includes('direção') ||
    n.includes('direcao') ||
    n.includes('secretaria') ||
    n.includes('financeiro') ||
    n.includes('inspetor') ||
    n.includes('recepção') ||
    n.includes('recepcao') ||
    n.includes('portaria') ||
    n.includes('limpeza') ||
    n.includes('equipe escolar') ||
    n.includes('equipe pedagógica') ||
    n.includes('professores') ||
    n.includes('docentes') ||
    n.includes('colaboradores')
  ) {
    return true
  }
  let cIds = g.colaboradoresIds || []
  if (typeof cIds === 'string') {
    try { cIds = JSON.parse(cIds) } catch { cIds = [] }
  }
  let aIds = g.alunosIds || []
  if (typeof aIds === 'string') {
    try { aIds = JSON.parse(aIds) } catch { aIds = [] }
  }
  if (Array.isArray(cIds) && cIds.length > 0 && (!Array.isArray(aIds) || aIds.length === 0)) {
    return true
  }
  return false
}

export function DestinatariosModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  initialSelected = [], 
  allowedTurmasIds, 
  allowedGruposIds, 
  currentUserId,
  hideFilterTabs = false,
  hideAllColabsButton = false
}: DestinatariosModalProps) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
    ensureDestStyles()
  }, [])

  const data = useData()
  const [directTurmas = [], _setT, { loading: loadingTurmas }] = useSupabaseArray<any>('turmas')

  const rawTurmas = useMemo(() => {
    if (data?.turmas && data.turmas.length > 0) return data.turmas
    return directTurmas
  }, [data?.turmas, directTurmas])

  const [gruposManuais = [], _setG, { loading: loadingGrupos }] = useSupabaseArray<any>('agenda/grupos')
  const [alunos = [], _setA, { loading: loadingAlunos }] = useSupabaseArray<any>('alunos/lightweight?limit=2000')
  const [colaboradores = [], _setC, { loading: loadingColabs }] = useSupabaseArray<any>('configuracoes/usuarios')

  // As turmas da Agenda Digital são estritamente os grupos ativos da Gestão de Turmas (Imagem 2)
  const turmas = useMemo(() => {
    const digitalTurmaGroups = (gruposManuais || []).filter((g: any) => !isEquipeEscolarGrupo(g))
    
    let sourceList: any[] = []
    if (digitalTurmaGroups.length > 0) {
      sourceList = digitalTurmaGroups.map((g: any) => {
        const syncId = g.syncId || (String(g.id).startsWith('sync-') ? g.id : '')
        const rawTurmaId = syncId ? syncId.replace(/^sync-/, '') : g.id
        const matchedErp = rawTurmas.find((t: any) => String(t.id) === rawTurmaId || String(t.nome).trim().toLowerCase() === String(g.nome).trim().toLowerCase())
        
        const ano = g.ano !== undefined && g.ano !== null && String(g.ano) !== '' 
          ? String(g.ano) 
          : (matchedErp?.ano ? String(matchedErp.ano) : (matchedErp?.anoLetivo || '2026'))

        return {
          id: rawTurmaId,
          grupoId: g.id,
          syncId: g.syncId,
          codigo: matchedErp?.codigo || rawTurmaId,
          nome: g.nome,
          ano: String(ano),
          anoLetivo: String(ano),
          serie: matchedErp?.serie || g.serie || '',
          turno: matchedErp?.turno || g.turno || '',
          cor: g.cor || matchedErp?.cor,
          alunosIds: g.alunosIds || [],
          colaboradoresIds: g.colaboradoresIds || [],
          raw: matchedErp || g
        }
      })
    } else {
      sourceList = rawTurmas
    }

    if (allowedTurmasIds && allowedTurmasIds.length > 0) {
      return sourceList.filter((t: any) => {
        return (
          allowedTurmasIds.includes(String(t.id)) ||
          (t.grupoId && allowedTurmasIds.includes(String(t.grupoId))) ||
          (t.syncId && allowedTurmasIds.includes(String(t.syncId))) ||
          allowedTurmasIds.includes(`sync-${t.id}`)
        )
      })
    }

    return sourceList
  }, [gruposManuais, rawTurmas, allowedTurmasIds ? JSON.stringify(allowedTurmasIds) : null])

  // Safety fallback: evita ficar eternamente preso se uma escola não tiver alunos no banco
  const [loadTimeoutPassed, setLoadTimeoutPassed] = useState(false)
  useEffect(() => {
    if (!isOpen) {
      setLoadTimeoutPassed(false)
      return
    }
    const timer = setTimeout(() => {
      setLoadTimeoutPassed(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Filtro de visualização rápida: 'todos' (exibe ambas as seções juntas), 'turmas' ou 'equipe'
  const [viewFilter, setViewFilter] = useState<'todos' | 'turmas' | 'equipe'>('todos')
  
  // Drill-down para categorias de turmas e expansão de pessoas
  const [currentCatId, setCurrentCatId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAllColabs, setShowAllColabs] = useState(false)

  const [selectedAno, setSelectedAno] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Anos letivos disponíveis baseados em turmas
  const availableAnos = useMemo(() => {
    const anos = new Set<string>()
    turmas.forEach((t: any) => {
      const a = t?.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')
      if (a) anos.add(a)
    })
    return Array.from(anos).sort((a, b) => b.localeCompare(a))
  }, [turmas])

  const defaultAno = useMemo(() => {
    if (availableAnos.length === 0) return ''
    const currentYear = new Date().getFullYear().toString()
    if (availableAnos.includes(currentYear)) return currentYear
    return availableAnos[0] || ''
  }, [availableAnos])

  const effectiveAno = selectedAno || defaultAno

  const filteredTurmas = useMemo(() => {
    if (availableAnos.length === 0) return turmas
    if (!effectiveAno) return turmas
    return turmas.filter((t: any) => {
      const a = t?.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')
      return a === effectiveAno
    })
  }, [turmas, effectiveAno, availableAnos])

  // Estado de itens selecionados
  const [selected, setSelected] = useState<Record<string, { id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo' }>>({})
  const [hasHydrated, setHasHydrated] = useState(false)

  // Mapas relacionais
  const { alunosByTurmaRef, alunosById, colaboradoresById, colaboradoresByTurmaId } = useMemo(() => {
    const byTurmaRef = new Map<string, any[]>()
    const aById = new Map<string, any>()
    const cById = new Map<string, any>()
    const cByTurmaId = new Map<string, any[]>()

    ;(alunos || []).forEach((a: any) => {
      aById.set(String(a.id), a)
      const refs = [String(a.turma || ''), String((a as any).turmaId || '')].filter(Boolean)
      refs.forEach(r => {
        const ref = r.trim().toLowerCase()
        if (ref) {
          let list = byTurmaRef.get(ref)
          if (!list) {
            list = []
            byTurmaRef.set(ref, list)
          }
          if (!list.find(x => x.id === a.id)) list.push(a)
        }
      })
    })

    ;(colaboradores || []).forEach((c: any) => {
      if (!c) return
      const cId = String(c.id || '').trim()
      if (cId) {
        cById.set(cId, c)
        const cleanId = cId.replace(/^f_?/, '')
        cById.set(cleanId, c)
        cById.set(`f_${cleanId}`, c)
      }
      if (c.email) {
        cById.set(String(c.email).trim().toLowerCase(), c)
      }
      if (c.nome) {
        cById.set(String(c.nome).trim().toLowerCase(), c)
      }
      if (c.name) {
        cById.set(String(c.name).trim().toLowerCase(), c)
      }
    })

    ;(gruposManuais || []).forEach((g: any) => {
      const syncId: string = g.syncId || (String(g.id).startsWith('sync-') ? g.id : '')
      if (!syncId) return
      const turmaId = syncId.replace(/^sync-/, '')
      if (!turmaId) return

      let cIds = g.colaboradoresIds || g.membrosIds || g.dados?.colaboradoresIds || g.dados?.membrosIds || []
      if (typeof cIds === 'string') {
        try { cIds = JSON.parse(cIds) } catch { cIds = [] }
      }
      if (!Array.isArray(cIds) || cIds.length === 0) return

      const list: any[] = cByTurmaId.get(turmaId) || []
      cIds.forEach((id: any) => {
        const idStr = String(id).trim()
        const clean = idStr.replace(/^f_?/, '')
        const c = cById.get(idStr) || cById.get(clean) || cById.get(`f_${clean}`) || cById.get(idStr.toLowerCase())
        if (c && !list.find((x: any) => x.id === c.id)) list.push(c)
      })
      cByTurmaId.set(turmaId, list)
    })

    return { alunosByTurmaRef: byTurmaRef, alunosById: aById, colaboradoresById: cById, colaboradoresByTurmaId: cByTurmaId }
  }, [alunos, colaboradores, gruposManuais])

  const getTurmaAlunos = (t: any) => {
    const tAno = t?.ano !== undefined ? String(t.ano) : (t?.anoLetivo || t?.ano_letivo || selectedAno)
    const tIdStr = String(t.id)

    const syncGroup = (gruposManuais || []).find((g: any) => {
      const gSync = g.syncId || (String(g.id).startsWith('sync-') ? g.id : '')
      return gSync === `sync-${tIdStr}` || g.id === `sync-${tIdStr}` || (g.nome && g.nome.toLowerCase() === String(t.nome || '').toLowerCase())
    })
    
    let extraAlunosIds: string[] = []
    if (syncGroup) {
      let aIds = syncGroup.alunosIds || []
      if (typeof aIds === 'string') {
        try { aIds = JSON.parse(aIds) } catch { aIds = [] }
      }
      if (Array.isArray(aIds)) extraAlunosIds = aIds.map(String)
    }

    return (alunos || []).filter((a: any) => {
      const aIdStr = String(a.id)
      if (extraAlunosIds.includes(aIdStr)) return true
      if (isAlunoCursandoTurma(a, t, tAno)) return true
      const directTurma = String(a.turma || '').trim().toLowerCase()
      const directTurmaId = String((a as any).turmaId || '').trim().toLowerCase()
      const tIdLower = tIdStr.toLowerCase()
      const tNomeLower = String(t.nome || '').trim().toLowerCase()
      const tCodLower = String(t.codigo || '').trim().toLowerCase()
      if (directTurma && (directTurma === tIdLower || directTurma === tNomeLower || (tCodLower && directTurma === tCodLower))) return true
      if (directTurmaId && (directTurmaId === tIdLower || directTurmaId === tNomeLower || (tCodLower && directTurmaId === tCodLower))) return true
      return false
    })
  }

  const getGrupoAlunos = (g: any): any[] => {
    let aIds = g.alunosIds || []
    if (typeof aIds === 'string') {
      try { aIds = JSON.parse(aIds) } catch { aIds = [] }
    }
    const directStudents = (Array.isArray(aIds) ? aIds : []).map((id: any) => alunosById.get(String(id))).filter(Boolean)

    const syncId = g.syncId || (String(g.id).startsWith('sync-') ? g.id : '')
    const turmaId = syncId ? syncId.replace(/^sync-/, '') : null
    const turmaERP = turmaId 
      ? turmas.find((tx: any) => String(tx.id) === turmaId || tx.nome === g.nome) 
      : turmas.find((tx: any) => tx.nome === g.nome)

    if (turmaERP) {
      const tAno = g.ano || turmaERP.ano || selectedAno
      const extraCursando = (alunos || []).filter((a: any) => isAlunoCursandoTurma(a, turmaERP, tAno))
      const map = new Map<string, any>()
      directStudents.forEach((a: any) => map.set(String(a.id), a))
      extraCursando.forEach((a: any) => map.set(String(a.id), a))
      return Array.from(map.values())
    }

    return directStudents
  }

  const getTurmaColaboradores = (t: any): any[] => {
    return colaboradoresByTurmaId.get(String(t.id)) || []
  }

  // Verificação de carregamento
  const isAnyHookLoading = loadingTurmas || loadingGrupos || loadingAlunos || loadingColabs
  const hasInitialData = turmas.length > 0 || (colaboradores && colaboradores.length > 0)
  const isWaitingForAlunos = !loadTimeoutPassed && turmas.length > 0 && alunos.length === 0

  const isLoadingData = !hasInitialData && (isAnyHookLoading || isWaitingForAlunos) && !loadTimeoutPassed

  useEffect(() => {
    if (isOpen && availableAnos.length > 0 && selectedAno === '' && defaultAno) {
      setSelectedAno(defaultAno)
    }
  }, [isOpen, availableAnos, selectedAno, defaultAno])

  useEffect(() => {
    if (!isOpen) {
      setHasHydrated(false)
      setCurrentCatId(null)
      setSelected({})
      setSearchQuery('')
      setSelectedAno('')
      setViewFilter('todos')
      setExpandedId(null)
      setShowAllColabs(false)
      return
    }
    if (isLoadingData) return
    if (hasHydrated) return

    if (initialSelected.length > 0) {
       const hasTurma = initialSelected.some(s => {
         const type = s.type || (s.id && (s.id.startsWith('f_') || s.id === 'func') ? 'funcionario' : s.id && s.id.startsWith('a_') ? 'aluno' : s.id && s.id.startsWith('g_') ? 'grupo' : 'turma')
         return type === 'turma'
       })
       if (hasTurma && turmas.length === 0) return

       const hasGrupo = initialSelected.some(s => {
         const type = s.type || (s.id && (s.id.startsWith('f_') || s.id === 'func') ? 'funcionario' : s.id && s.id.startsWith('a_') ? 'aluno' : s.id && s.id.startsWith('g_') ? 'grupo' : 'turma')
         return type === 'grupo'
       })
       if (hasGrupo && gruposManuais.length === 0) return
       
       if ((hasTurma || hasGrupo) && alunos.length === 0) return
    }

    const map: typeof selected = {}
    initialSelected.forEach(s => {
      const type = s.type || (s.id && (s.id.startsWith('f_') || s.id === 'func') ? 'funcionario' : s.id && s.id.startsWith('a_') ? 'aluno' : s.id && s.id.startsWith('g_') ? 'grupo' : 'turma')
      
      if (type === 'turma') {
         const t = turmas.find((x: any) => String(x.id) === String(s.id) || String(x.nome) === String(s.name))
         if (t) {
           const tAlunos = getTurmaAlunos(t)
           tAlunos.forEach((a: any) => {
             map[`a_${a.id}`] = { id: `a_${a.id}`, name: a.nome, type: 'aluno' }
           })
         }
      } else if (type === 'grupo') {
         const g = gruposManuais.find((x: any) => String(x.id) === String(s.id).replace('g_', ''))
         if (g) {
           let aIds = g.alunosIds || []
           if (typeof aIds === 'string') {
             try { aIds = JSON.parse(aIds) } catch(e) { aIds = [] }
           }
           let cIds = g.colaboradoresIds || []
           if (typeof cIds === 'string') {
             try { cIds = JSON.parse(cIds) } catch(e) { cIds = [] }
           }
           const gAlunos = (Array.isArray(aIds) ? aIds : []).map((id: any) => alunosById.get(String(id))).filter(Boolean)
           const gColabs = (Array.isArray(cIds) ? cIds : []).map((id: any) => colaboradoresById.get(String(id))).filter(Boolean)
           gAlunos.forEach((a: any) => map[`a_${a.id}`] = { id: `a_${a.id}`, name: a.nome, type: 'aluno' })
           gColabs.forEach((c: any) => map[`f_${c.id}`] = { id: `f_${c.id}`, name: c.nome, type: 'funcionario' })
         }
      } else if (type === 'funcionario') {
        const key = s.id.startsWith('f_') ? s.id : `f_${s.id}`
        map[key] = { id: key, name: s.name, type: 'funcionario' }
      } else {
        map[s.id] = { id: s.id, name: s.name, type: type as any }
      }
    })
    setSelected(map)
    setHasHydrated(true)
  }, [isOpen, hasHydrated, initialSelected, turmas, gruposManuais, alunos, colaboradores, alunosByTurmaRef, alunosById, colaboradoresById])

  // ══════════════════════════════════════════════════════════════════════════
  // SEPARAÇÃO PRINCIPAL: TURMAS DE ALUNOS & EQUIPE ESCOLAR
  // ══════════════════════════════════════════════════════════════════════════

  // (Ordenação rigorosa por série fornecida por compareTurmasBySerie de @/lib/studentTurmaUtils)

  // 1. Segmentos Pedagógicos e Turmas de Alunos
  const { turmasListItems, turmasLeafIds } = useMemo(() => {
    const categorias = [
      { name: 'Educação Infantil', icon: Sparkles, match: (t: any) => /NÍVEL|INFANTIL|BERÇÁRIO|MATERNAL|JARDIM|PRÉ-ESCOLA/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Fundamental I', icon: BookOpen, match: (t: any) => !/MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) && /(1|2|3|4|5)º?\s*ANO/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Fundamental II', icon: Building2, match: (t: any) => !/MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) && /(6|7|8|9)º?\s*ANO/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Médio', icon: GraduationCap, match: (t: any) => /SÉRIE|MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) },
    ]

    const items: any[] = []
    const leafIds = new Set<string>()
    
    const mappedCats = categorias.map(cat => {
      const tList = filteredTurmas.filter(cat.match).sort(compareTurmasBySerie)
      return { ...cat, turmas: tList }
    }).filter(c => c.turmas.length > 0)

    const catTurmasIds = new Set(mappedCats.flatMap(c => c.turmas.map((t: any) => String(t.id))))
    const restantes = filteredTurmas.filter((t: any) => !catTurmasIds.has(String(t.id)))
    if (restantes.length > 0) {
      mappedCats.push({ name: 'Outras Turmas', icon: Users, turmas: restantes.sort(compareTurmasBySerie), match: () => false })
    }

    mappedCats.forEach(cat => {
      const catPeopleIds = new Set<string>()
      const catPayloads = new Map<string, any>()
      const turmasItems: any[] = []
      
      cat.turmas.forEach((t: any) => {
        const tAlunos = getTurmaAlunos(t)
        const tColabs = getTurmaColaboradores(t)
        const anoLetivo = t.ano !== undefined ? t.ano : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')

        const alunoPayloads = tAlunos.map((a: any) => ({
          id: `a_${a.id}`,
          name: a.nome,
          type: 'aluno' as const,
          turmaNome: t.nome,
          anoLetivo
        }))

        const colabPayloads = tColabs.map((c: any) => ({
          id: `f_${c.id}`,
          name: c.nome,
          type: 'funcionario' as const,
          turmaNome: t.nome,
          funcao: c.cargo || c.perfil || c.dados?.cargo || c.dados?.perfil || 'Colaborador'
        }))

        const payloads = [
          ...colabPayloads.sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')),
          ...alunoPayloads.sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'))
        ]
        
        payloads.forEach(p => {
          leafIds.add(p.id)
          catPeopleIds.add(p.id)
          catPayloads.set(p.id, p)
        })
        
        const totalPessoas = payloads.length

        turmasItems.push({
          id: `t_${t.id}`,
          title: t.nome,
          subtitle: '',
          countBadge: isLoadingData ? 'Carregando...' : `${totalPessoas} pessoa${totalPessoas !== 1 ? 's' : ''}`,
          type: 'turma',
          icon: Users,
          leafIds: payloads.map(p => p.id),
          payloads: payloads,
          people: payloads
        })
      })

      if (catPeopleIds.size > 0 || cat.turmas.length > 0) {
        const totalTurmas = cat.turmas.length
        const totalPessoas = catPeopleIds.size
        items.push({
          id: `cat_${cat.name}`,
          title: cat.name,
          subtitle: isLoadingData ? 'Carregando...' : `${totalTurmas} turma${totalTurmas !== 1 ? 's' : ''} com ${totalPessoas} pessoa${totalPessoas !== 1 ? 's' : ''}`,
          countBadge: null,
          type: 'category',
          icon: cat.icon || Building2,
          leafIds: Array.from(catPeopleIds),
          payloads: Array.from(catPayloads.values()),
          people: null,
          children: turmasItems
        })
      }
    })

    // Grupos Manuais voltados aos alunos (não-equipe escolar)
    const manualStudentGroups = (gruposManuais || []).filter((g: any) => {
      if (isEquipeEscolarGrupo(g)) return false
      const isSyncedTurma = g.syncId || String(g.id).startsWith('sync-')
      const isGlobal = g.isGlobalAccess === true || g.isGlobalAccess === 'true' || g.isGlobalAccess === 1
      if (isSyncedTurma && !isGlobal) return false
      if (allowedGruposIds && !allowedGruposIds.includes(String(g.id))) return false
      if (selectedAno) {
        const a = g?.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '')
        if (a && a !== selectedAno) return false
      }
      return true
    })

    if (manualStudentGroups.length > 0) {
      const studentGroupsItems: any[] = []
      const groupCatLeaves = new Set<string>()
      const groupCatPayloads = new Map<string, any>()

      manualStudentGroups.sort(compareTurmasBySerie).forEach((g: any) => {
        let cIds = g.colaboradoresIds || []
        if (typeof cIds === 'string') {
          try { cIds = JSON.parse(cIds) } catch(e) { cIds = [] }
        }
        const gAlunos = getGrupoAlunos(g)
        const gColabs = (Array.isArray(cIds) ? cIds : []).map((id: any) => colaboradoresById.get(String(id))).filter(Boolean)
        
        const payloads = [
          ...gAlunos.map((a: any) => {
            const t = turmas.find((tx: any) => String(tx.id) === String(a.turma) || String(tx.codigo) === String(a.turma) || String(tx.nome) === String(a.turma)) as any
            const anoLetivo = t ? (t.ano !== undefined ? t.ano : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')) : ''
            return { id: `a_${a.id}`, name: a.nome, type: 'aluno', turmaNome: t?.nome || '', anoLetivo }
          }),
          ...gColabs.map((c: any) => ({ id: `f_${c.id}`, name: c.nome, type: 'funcionario', funcao: c.funcao || c.cargo || c.perfil || c.dados?.funcao || c.dados?.cargo || c.dados?.perfil || '' }))
        ]
        
        payloads.forEach(p => {
          leafIds.add(p.id)
          groupCatLeaves.add(p.id)
          groupCatPayloads.set(p.id, p)
        })

        studentGroupsItems.push({
          id: `g_${g.id}`,
          title: g.nome,
          subtitle: `${payloads.length} pessoas`,
          countBadge: isLoadingData ? 'Carregando...' : `${payloads.length} pessoas`,
          type: 'grupo',
          icon: Users,
          leafIds: payloads.map(p => p.id),
          payloads: payloads,
          people: payloads
        })
      })

      const totalGrupos = studentGroupsItems.length
      const totalPessoasGrupos = groupCatLeaves.size
      items.push({
        id: 'cat_grupos_alunos',
        title: 'Grupos Extracurriculares',
        subtitle: `${totalGrupos} grupo${totalGrupos !== 1 ? 's' : ''} com ${totalPessoasGrupos} pessoa${totalPessoasGrupos !== 1 ? 's' : ''}`,
        countBadge: null,
        type: 'category',
        icon: Users,
        leafIds: Array.from(groupCatLeaves),
        payloads: Array.from(groupCatPayloads.values()),
        people: null,
        children: studentGroupsItems
      })
    }

    return { turmasListItems: items, turmasLeafIds: leafIds }
  }, [filteredTurmas, gruposManuais, allowedGruposIds ? JSON.stringify(allowedGruposIds) : null, selectedAno, alunosByTurmaRef, alunosById, colaboradoresById, colaboradoresByTurmaId, isLoadingData])

  // 2. Grupos Exclusivos da Equipe Escolar
  const { equipeListItems, equipeLeafIds, allSchoolColabs } = useMemo(() => {
    const items: any[] = []
    const leafIds = new Set<string>()

    const seenEquipeKeys = new Set<string>()
    const equipeGroups: any[] = []

    // Grupos da Equipe Escolar vindos de agenda/grupos (todos visíveis para acesso institucional)
    ;(gruposManuais || []).forEach((g: any) => {
      const isEquipe = isEquipeEscolarGrupo(g)
      if (!isEquipe) return
      const key = String(g.nome || '').trim().toLowerCase()
      if (key && !seenEquipeKeys.has(key)) {
        seenEquipeKeys.add(key)
        equipeGroups.push(g)
      }
    })

    const sortedEquipe = [...equipeGroups].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    sortedEquipe.forEach((g: any) => {
      let cIds = g.colaboradoresIds || g.membrosIds || g.dados?.colaboradoresIds || g.dados?.membrosIds || []
      if (typeof cIds === 'string') {
        try { cIds = JSON.parse(cIds) } catch(e) { cIds = [] }
      }
      
      let gColabs = (Array.isArray(cIds) ? cIds : []).map((id: any) => {
        if (!id) return null
        if (typeof id === 'object' && (id.id || id.nome)) return id
        const idStr = String(id).trim()
        const clean = idStr.replace(/^f_?/, '')
        return (
          colaboradoresById.get(idStr) ||
          colaboradoresById.get(clean) ||
          colaboradoresById.get(`f_${clean}`) ||
          colaboradoresById.get(idStr.toLowerCase()) ||
          null
        )
      }).filter(Boolean)

      if (gColabs.length === 0 && Array.isArray(g.colaboradores) && g.colaboradores.length > 0) {
        gColabs = g.colaboradores.map((c: any) => {
          if (!c) return null
          if (typeof c === 'object' && (c.id || c.nome)) return c
          const idStr = String(c).trim()
          const clean = idStr.replace(/^f_?/, '')
          return colaboradoresById.get(idStr) || colaboradoresById.get(clean) || colaboradoresById.get(`f_${clean}`) || colaboradoresById.get(idStr.toLowerCase()) || null
        }).filter(Boolean)
      }

      const deptInfo = getEquipeDepartmentInfo(g.nome, g.cor)

      const payloads = gColabs.map((c: any) => ({
        id: `f_${c.id || c.email || c.nome}`,
        name: c.nome || c.name || 'Colaborador',
        type: 'funcionario' as const,
        funcao: c.funcao || c.cargo || c.perfil || c.dados?.funcao || c.dados?.cargo || c.dados?.perfil || 'Colaborador',
        email: c.email || '',
        foto: c.foto || c.avatar || null
      }))

      payloads.forEach(p => leafIds.add(p.id))

      items.push({
        id: `g_${g.id}`,
        title: g.nome,
        subtitle: `${payloads.length} colaborador${payloads.length !== 1 ? 'es' : ''}`,
        countBadge: isLoadingData ? 'Carregando...' : `${payloads.length} colaborador${payloads.length !== 1 ? 'es' : ''}`,
        type: 'grupo',
        isEquipeEscolar: true,
        deptInfo,
        icon: deptInfo.icon,
        cor: g.cor || deptInfo.color,
        leafIds: payloads.map(p => p.id),
        payloads: payloads,
        people: payloads,
        colaboradores: gColabs
      })
    })

    // Lista de todos os colaboradores ativos da escola
    const validColabs = (colaboradores || []).filter((c: any) => {
      if (!c || !c.nome) return false
      const p = String(c.perfil || '').toLowerCase()
      const cg = String(c.cargo || '').toLowerCase()
      if (p.includes('família') || p.includes('aluno') || cg.includes('aluno') || cg.includes('responsável')) return false
      return true
    }).map((c: any) => ({
      id: `f_${c.id}`,
      name: c.nome,
      type: 'funcionario' as const,
      funcao: c.cargo || c.perfil || c.dados?.cargo || c.dados?.perfil || 'Colaborador',
      email: c.email || '',
      foto: c.foto || c.avatar || null
    })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'))

    return { equipeListItems: items, equipeLeafIds: leafIds, allSchoolColabs: validColabs }
  }, [gruposManuais, colaboradores, colaboradoresById, isLoadingData])

  // Contadores selecionados
  const selectedTurmasCount = useMemo(() => {
    return Object.keys(selected).filter(id => turmasLeafIds.has(id)).length
  }, [selected, turmasLeafIds])

  const selectedEquipeCount = useMemo(() => {
    return Object.keys(selected).filter(id => equipeLeafIds.has(id) || id.startsWith('f_')).length
  }, [selected, equipeLeafIds])

  // Itens ativos no contexto atual
  const activeItems = useMemo(() => {
    if (currentCatId) {
      const children = turmasListItems.find(i => i.id === currentCatId)?.children || []
      return [...children].sort(compareTurmasBySerie)
    }
    if (viewFilter === 'turmas') {
      return turmasListItems
    }
    if (viewFilter === 'equipe') {
      return equipeListItems
    }
    return [...turmasListItems, ...equipeListItems]
  }, [viewFilter, currentCatId, turmasListItems, equipeListItems])

  // Busca Inteligente Categorizada
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { equipe: [], turmasEAlunos: [] }
    const q = searchQuery.toLowerCase().trim()

    const equipeMap = new Map<string, any>()
    const turmasMap = new Map<string, any>()

    // Busca colaboradores da escola
    allSchoolColabs.forEach(c => {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.funcao && c.funcao.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      ) {
        equipeMap.set(c.id, c)
      }
    })

    // Busca grupos da equipe escolar
    equipeListItems.forEach(g => {
      if (g.title.toLowerCase().includes(q)) {
        if (!equipeMap.has(g.id)) {
          equipeMap.set(g.id, g)
        }
      }
      if (g.people) {
        g.people.forEach((p: any) => {
          if (p.name.toLowerCase().includes(q) || (p.funcao && p.funcao.toLowerCase().includes(q))) {
            equipeMap.set(p.id, p)
          }
        })
      }
    })

    // Busca turmas e alunos
    const extractTurmasAlunos = (items: any[]) => {
      items.forEach(item => {
        if (item.title.toLowerCase().includes(q) && item.type === 'turma') {
          turmasMap.set(item.id, item)
        }
        if (item.people) {
          item.people.forEach((p: any) => {
            if (p.type === 'aluno' && p.name.toLowerCase().includes(q)) {
              turmasMap.set(p.id, p)
            }
          })
        }
        if (item.children) {
          extractTurmasAlunos(item.children)
        }
      })
    }
    extractTurmasAlunos(turmasListItems)

    return {
      equipe: Array.from(equipeMap.values()),
      turmasEAlunos: Array.from(turmasMap.values())
    }
  }, [searchQuery, allSchoolColabs, equipeListItems, turmasListItems])

  const hasSearch = searchQuery.trim() !== ''
  const totalSearchResults = searchResults.equipe.length + searchResults.turmasEAlunos.length

  // Toggle de seleção em grupo ou item
  const toggleSelect = (item: any) => {
    setSelected(prev => {
      const next = { ...prev }
      const leafIds = (item.leafIds as string[] || [item.id]).filter(id => id !== `f_${currentUserId}`)
      const allSelected = leafIds.length > 0 && leafIds.every((id: string) => !!prev[id])
      
      if (allSelected) {
        leafIds.forEach((id: string) => delete next[id])
      } else {
        if (item.payloads && Array.isArray(item.payloads)) {
          item.payloads.forEach((p: any) => {
            if (p.id !== `f_${currentUserId}`) next[p.id] = p
          })
        } else {
          if (item.id !== `f_${currentUserId}`) next[item.id] = item
        }
      }
      return next
    })
  }

  // Toggle selecionar tudo na visualização atual
  const toggleAllInCurrentView = () => {
    if (hasSearch) {
      const allItemsToSelect = [
        ...searchResults.equipe.flatMap(item => item.payloads || [item]),
        ...searchResults.turmasEAlunos.flatMap(item => item.payloads || [item])
      ].filter(p => p.id !== `f_${currentUserId}`)

      const allSelected = allItemsToSelect.length > 0 && allItemsToSelect.every(p => !!selected[p.id])

      setSelected(prev => {
        const next = { ...prev }
        if (allSelected) {
          allItemsToSelect.forEach(p => delete next[p.id])
        } else {
          allItemsToSelect.forEach(p => next[p.id] = p)
        }
        return next
      })
      return
    }

    if (currentCatId) {
      const catLeaves = (turmasListItems.find(i => i.id === currentCatId)?.leafIds || []).filter((id: string) => id !== `f_${currentUserId}`)
      const allCatSelected = catLeaves.length > 0 && catLeaves.every((id: string) => !!selected[id])
      setSelected(prev => {
        const next = { ...prev }
        if (allCatSelected) {
          catLeaves.forEach((id: string) => delete next[id])
        } else {
          const cat = turmasListItems.find(i => i.id === currentCatId)
          if (cat?.payloads) {
            cat.payloads.forEach((p: any) => {
              if (p.id !== `f_${currentUserId}`) next[p.id] = p
            })
          }
        }
        return next
      })
      return
    }

    let targetLeaves: string[] = []
    let targetPayloads: any[] = []

    if (viewFilter === 'todos') {
      targetLeaves = [...Array.from(turmasLeafIds), ...Array.from(equipeLeafIds)].filter(id => id !== `f_${currentUserId}`)
      turmasListItems.forEach(i => { if (i.payloads) targetPayloads.push(...i.payloads) })
      equipeListItems.forEach(i => { if (i.payloads) targetPayloads.push(...i.payloads) })
    } else if (viewFilter === 'turmas') {
      targetLeaves = Array.from(turmasLeafIds).filter(id => id !== `f_${currentUserId}`)
      turmasListItems.forEach(i => { if (i.payloads) targetPayloads.push(...i.payloads) })
    } else {
      targetLeaves = Array.from(equipeLeafIds).filter(id => id !== `f_${currentUserId}`)
      equipeListItems.forEach(i => { if (i.payloads) targetPayloads.push(...i.payloads) })
    }

    const allSelected = targetLeaves.length > 0 && targetLeaves.every(id => !!selected[id])

    setSelected(prev => {
      const next = { ...prev }
      if (allSelected) {
        targetLeaves.forEach(id => delete next[id])
      } else {
        targetPayloads.forEach(p => {
          if (p.id !== `f_${currentUserId}`) next[p.id] = p
        })
      }
      return next
    })
  }

  const isAllActiveSelected = useMemo(() => {
    if (hasSearch) {
      const allItems = [
        ...searchResults.equipe.flatMap(item => item.payloads || [item]),
        ...searchResults.turmasEAlunos.flatMap(item => item.payloads || [item])
      ].filter(p => p.id !== `f_${currentUserId}`)
      return allItems.length > 0 && allItems.every(p => !!selected[p.id])
    }

    if (currentCatId) {
      const catLeaves = (turmasListItems.find(i => i.id === currentCatId)?.leafIds || []).filter((id: string) => id !== `f_${currentUserId}`)
      return catLeaves.length > 0 && catLeaves.every((id: string) => !!selected[id])
    }

    let targetLeaves: string[] = []
    if (viewFilter === 'todos') {
      targetLeaves = [...Array.from(turmasLeafIds), ...Array.from(equipeLeafIds)].filter(id => id !== `f_${currentUserId}`)
    } else if (viewFilter === 'turmas') {
      targetLeaves = Array.from(turmasLeafIds).filter(id => id !== `f_${currentUserId}`)
    } else {
      targetLeaves = Array.from(equipeLeafIds).filter(id => id !== `f_${currentUserId}`)
    }

    return targetLeaves.length > 0 && targetLeaves.every(id => !!selected[id])
  }, [hasSearch, searchResults, currentCatId, turmasListItems, viewFilter, turmasLeafIds, equipeLeafIds, selected, currentUserId])

  // Confirmação com reconstrução elegante de grupos e turmas
  const handleConfirm = () => {
    const result: any[] = []
    const selectedLeaves = new Set(Object.keys(selected))
    const coveredLeaves = new Set<string>()
    
    const allGroupItems: any[] = []
    turmasListItems.forEach(item => {
      allGroupItems.push(item)
      if (item.children) {
        allGroupItems.push(...item.children)
      }
    })
    equipeListItems.forEach(item => {
      allGroupItems.push(item)
    })

    allGroupItems.forEach(item => {
      if (item.type === 'turma' || item.type === 'grupo') {
        if (item.leafIds && item.leafIds.length > 0 && item.leafIds.every((id: string) => selectedLeaves.has(id))) {
           result.push({ id: item.id, name: item.title, type: item.type })
           item.leafIds.forEach((id: string) => coveredLeaves.add(id))

           if (item.payloads) {
             item.payloads.forEach((p: any) => {
               if (p.type === 'funcionario') {
                 const alreadyInResult = result.some(r => r.id === p.id)
                 if (!alreadyInResult) {
                   result.push({ id: p.id, name: p.name, type: 'funcionario' })
                 }
               }
             })
           }
        }
      }
    })

    selectedLeaves.forEach(id => {
      if (!coveredLeaves.has(id)) {
        result.push(selected[id])
      }
    })

    onAdd(result)
    onClose()
  }

  // Render do cartão de categoria/segmento
  const renderSegmentCard = (item: any) => {
    const isFullySelected = item.leafIds && item.leafIds.length > 0 && item.leafIds.every((id: string) => !!selected[id])
    const isPartiallySelected = !isFullySelected && item.leafIds && item.leafIds.some((id: string) => !!selected[id])
    const Icon = item.icon || Building2

    return (
      <motion.div
        key={item.id}
        style={{ 
          borderRadius: 20, 
          background: isFullySelected ? '#EEF2FF' : '#FFFFFF',
          border: isFullySelected ? '2px solid #818CF8' : '1px solid #E2E8F0',
          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
          transition: 'all 0.2s',
          overflow: 'hidden'
        }}
      >
        <div 
          onClick={() => setCurrentCatId(item.id)}
          style={{
            cursor: 'pointer', padding: '14px 18px',
            display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
          }}
        >
          <div 
            onClick={(e) => { e.stopPropagation(); toggleSelect(item) }}
            style={{ 
              width: 22, height: 22, flexShrink: 0, borderRadius: 6, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              background: isFullySelected ? '#4F46E5' : isPartiallySelected ? '#C4B5FD' : '#FFFFFF',
              border: isFullySelected || isPartiallySelected ? 'none' : '2px solid #CBD5E1',
              cursor: 'pointer'
            }}
          >
            {isFullySelected ? <Check size={14} color="#fff" strokeWidth={3} /> : isPartiallySelected ? <div style={{ width: 10, height: 3, background: '#fff', borderRadius: 2 }} /> : null}
          </div>

          <div style={{
            width: 44, height: 44, flexShrink: 0, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#EEF2FF', color: '#4F46E5'
          }}>
            <Icon size={22} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2 }}>
            <span style={{ 
              fontSize: 15, 
              fontWeight: 700, 
              color: isFullySelected ? '#4F46E5' : '#0F172A', 
              letterSpacing: '-0.2px',
              lineHeight: 1.2
            }}>
              {item.title}
            </span>
            {item.subtitle && (
              <span style={{ fontSize: 12, fontWeight: 500, color: '#64748B', lineHeight: 1.2 }}>
                {item.subtitle}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <ChevronRight size={20} color="#94A3B8" />
          </div>
        </div>
      </motion.div>
    )
  }

  // Render do cartão de turma no drill-down
  const renderTurmaCard = (item: any) => {
    const isFullySelected = item.leafIds && item.leafIds.length > 0 && item.leafIds.every((id: string) => !!selected[id])
    const isPartiallySelected = !isFullySelected && item.leafIds && item.leafIds.some((id: string) => !!selected[id])
    const isExpanded = expandedId === item.id

    return (
      <div
        key={item.id}
        style={{ 
          borderRadius: 14, 
          background: isFullySelected ? '#F5F3FF' : '#FFFFFF',
          border: isFullySelected ? '1.5px solid #818CF8' : '1px solid #E2E8F0',
          boxShadow: isFullySelected ? '0 3px 12px -2px rgba(99, 102, 241, 0.15)' : '0 1px 3px rgba(15, 23, 42, 0.03)',
          transition: 'all 0.2s ease',
          overflow: 'hidden'
        }}
      >
        <div 
          onClick={() => setExpandedId(isExpanded ? null : item.id)}
          style={{
            cursor: 'pointer', padding: '10px 14px',
            display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <div 
            onClick={(e) => { e.stopPropagation(); toggleSelect(item) }}
            style={{ 
              width: 20, height: 20, flexShrink: 0, borderRadius: 6, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              background: isFullySelected ? '#4F46E5' : isPartiallySelected ? '#C4B5FD' : '#FFFFFF',
              border: isFullySelected || isPartiallySelected ? 'none' : '2px solid #CBD5E1',
              cursor: 'pointer'
            }}
          >
            {isFullySelected ? <Check size={13} color="#fff" strokeWidth={3} /> : isPartiallySelected ? <div style={{ width: 9, height: 3, background: '#fff', borderRadius: 2 }} /> : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ 
              fontSize: 13.5, 
              fontWeight: 700, 
              color: isFullySelected ? '#4338CA' : '#0F172A', 
              lineHeight: 1.3,
              letterSpacing: '-0.2px'
            }}>
              {item.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {item.countBadge && (
              <span style={{ 
                fontSize: 11, 
                fontWeight: 600, 
                color: isFullySelected ? '#4F46E5' : '#64748B', 
                background: isFullySelected ? '#EEF2FF' : '#F1F5F9', 
                padding: '2px 8px', 
                borderRadius: 8 
              }}>
                {item.countBadge}
              </span>
            )}
            {isExpanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#94A3B8" />}
          </div>
        </div>

        {/* Lista de alunos da turma */}
        <AnimatePresence>
          {isExpanded && item.people && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0 14px 12px 14px', display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                {item.people.map((person: any) => {
                  const isPersonSelected = !!selected[person.id]
                  const isColab = person.type === 'funcionario'
                  const isCurrentUser = person.id === `f_${currentUserId}`

                  return (
                    <div 
                      key={person.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isCurrentUser) return
                        setSelected(prev => {
                          const next = { ...prev }
                          if (isPersonSelected) delete next[person.id]
                          else next[person.id] = person
                          return next
                        })
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                        borderRadius: 10, cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                        opacity: isCurrentUser ? 0.6 : 1,
                        background: isPersonSelected ? (isColab ? 'rgba(124,58,237,0.08)' : '#EEF2FF') : 'transparent',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ 
                        width: 17, height: 17, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isCurrentUser ? '#CBD5E1' : (isPersonSelected ? (isColab ? '#7C3AED' : '#4F46E5') : '#FFFFFF'),
                        border: (isPersonSelected || isCurrentUser) ? 'none' : '2px solid #CBD5E1'
                      }}>
                        {(isPersonSelected || isCurrentUser) && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{person.name}</span>
                          {isColab && (
                            <span style={{
                              fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                              background: '#F3E8FF', color: '#7C3AED', textTransform: 'uppercase'
                            }}>Colaborador</span>
                          )}
                        </div>
                        <span style={{ fontSize: 10.5, color: '#64748B' }}>
                          {isColab ? (person.funcao || 'Colaborador') : `Aluno • ${person.turmaNome || ''}`}
                        </span>
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
  }

  // Render do cartão de departamento da Equipe Escolar
  const renderEquipeCard = (item: any) => {
    const isFullySelected = item.leafIds && item.leafIds.length > 0 && item.leafIds.every((id: string) => !!selected[id])
    const isPartiallySelected = !isFullySelected && item.leafIds && item.leafIds.some((id: string) => !!selected[id])
    const dept = item.deptInfo
    const Icon = item.icon || Shield
    const isExpanded = expandedId === item.id

    return (
      <div
        key={item.id}
        style={{
          borderRadius: 14,
          background: isFullySelected ? dept.bgSoft : '#FFFFFF',
          border: isFullySelected ? `1.5px solid ${dept.color}` : '1px solid #E2E8F0',
          boxShadow: isFullySelected ? `0 4px 14px -3px ${dept.color}20` : '0 1px 4px rgba(15, 23, 42, 0.03)',
          transition: 'all 0.2s',
          overflow: 'hidden'
        }}
      >
        <div
          onClick={() => setExpandedId(isExpanded ? null : item.id)}
          style={{
            cursor: 'pointer', padding: '9px 13px',
            display: 'flex', alignItems: 'center', gap: 10
          }}
        >
          {/* Checkbox do grupo */}
          <div
            onClick={(e) => { e.stopPropagation(); toggleSelect(item) }}
            style={{
              width: 18, height: 18, flexShrink: 0, borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              background: isFullySelected ? dept.color : isPartiallySelected ? dept.borderSoft : '#FFFFFF',
              border: isFullySelected || isPartiallySelected ? 'none' : '1.5px solid #CBD5E1',
              cursor: 'pointer'
            }}
          >
            {isFullySelected ? <Check size={11} color="#fff" strokeWidth={3} /> : isPartiallySelected ? <div style={{ width: 8, height: 2.5, background: dept.color, borderRadius: 2 }} /> : null}
          </div>

          {/* Ícone do setor */}
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: dept.gradient, color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 8px ${dept.color}30`
          }}>
            <Icon size={16} strokeWidth={2.2} />
          </div>

          {/* Dados do Setor */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.1px', lineHeight: 1.2 }}>
                {item.title}
              </span>
              <span style={{
                fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 12,
                background: dept.badgeBg, color: dept.badgeColor, textTransform: 'uppercase', letterSpacing: 0.4
              }}>
                {dept.tag}
              </span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B', marginTop: 1, lineHeight: 1.2 }}>
              {item.subtitle}
            </span>
          </div>

          {/* Seta indicativa */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: '#94A3B8' }}>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Drawer de Colaboradores do Setor */}
        <AnimatePresence>
          {isExpanded && item.people && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: '8px 12px 10px 12px',
                background: isFullySelected ? 'rgba(255,255,255,0.6)' : '#F8FAFC',
                borderTop: `1px solid ${isFullySelected ? dept.borderSoft : '#EDF2F7'}`,
                display: 'flex', flexDirection: 'column', gap: 4
              }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Membros do Setor
                </span>

                {item.people.map((person: any) => {
                  const isPersonSelected = !!selected[person.id]
                  const isCurrentUser = person.id === `f_${currentUserId}`
                  const pal = getAvatarPalette(person.name)

                  return (
                    <div
                      key={person.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isCurrentUser) return
                        setSelected(prev => {
                          const next = { ...prev }
                          if (isPersonSelected) delete next[person.id]
                          else next[person.id] = person
                          return next
                        })
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px',
                        borderRadius: 9, cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                        opacity: isCurrentUser ? 0.6 : 1,
                        background: isPersonSelected ? '#FFFFFF' : 'transparent',
                        border: isPersonSelected ? '1px solid #DDD6FE' : '1px solid transparent',
                        boxShadow: isPersonSelected ? '0 1px 3px rgba(0,0,0,0.02)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        width: 15, height: 15, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isCurrentUser ? '#CBD5E1' : (isPersonSelected ? '#7C3AED' : '#FFFFFF'),
                        border: (isPersonSelected || isCurrentUser) ? 'none' : '1.5px solid #CBD5E1'
                      }}>
                        {(isPersonSelected || isCurrentUser) && <Check size={10} color="#fff" strokeWidth={3} />}
                      </div>

                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: pal.bg, color: pal.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9.5, fontWeight: 800, flexShrink: 0
                      }}>
                        {getInitials(person.name)}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>
                            {person.name}
                          </span>
                          {isCurrentUser && (
                            <span style={{ fontSize: 8.5, fontWeight: 800, padding: '1px 5px', borderRadius: 8, background: '#E2E8F0', color: '#475569' }}>
                              Você (Autor)
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: '#64748B', lineHeight: 1.2 }}>
                          {person.funcao || 'Colaborador'}
                        </span>
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
  }

  // Render da seção de todos os colaboradores avulsos
  const renderAllSchoolColabsSection = () => {
    return (
      <div style={{ marginTop: 6 }}>
        <button
          type="button"
          onClick={() => setShowAllColabs(!showAllColabs)}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: 18,
            background: '#FFFFFF', border: '1px dashed #CBD5E1',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={18} color="#7C3AED" />
            <span>Ver todos os colaboradores individuais ({allSchoolColabs.length})</span>
          </div>
          {showAllColabs ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {showAllColabs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: 10, padding: 12, borderRadius: 18,
                background: '#FFFFFF', border: '1px solid #E2E8F0',
                display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto'
              }}>
                {allSchoolColabs.map((person: any) => {
                  const isPersonSelected = !!selected[person.id]
                  const isCurrentUser = person.id === `f_${currentUserId}`
                  const pal = getAvatarPalette(person.name)

                  return (
                    <div
                      key={person.id}
                      onClick={() => {
                        if (isCurrentUser) return
                        setSelected(prev => {
                          const next = { ...prev }
                          if (isPersonSelected) delete next[person.id]
                          else next[person.id] = person
                          return next
                        })
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                        borderRadius: 12, cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                        opacity: isCurrentUser ? 0.6 : 1,
                        background: isPersonSelected ? '#F5F3FF' : '#FFFFFF',
                        border: isPersonSelected ? '1px solid #C4B5FD' : '1px solid #F1F5F9'
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isCurrentUser ? '#CBD5E1' : (isPersonSelected ? '#7C3AED' : '#FFFFFF'),
                        border: (isPersonSelected || isCurrentUser) ? 'none' : '2px solid #CBD5E1'
                      }}>
                        {(isPersonSelected || isCurrentUser) && <Check size={12} color="#fff" strokeWidth={3} />}
                      </div>

                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: pal.bg, color: pal.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, flexShrink: 0
                      }}>
                        {getInitials(person.name)}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{person.name}</span>
                          {isCurrentUser && (
                            <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: '#E2E8F0', color: '#475569' }}>Você</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#64748B' }}>{person.funcao}</span>
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
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          key="dest-modal-portal-wrapper"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          <style>{DEST_MODAL_STYLES}</style>
          
          <motion.div 
            key="dest-modal-backdrop"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="dest-modal-backdrop"
          />

          <motion.div 
            key="dest-modal-container"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="dest-modal-container"
            style={{ zIndex: 2147483647 }}
          >
            {/* ── HEADER ULTRA MODERNO COM GRADIENTE ────────────────────── */}
            <header style={{ 
              height: 72, flexShrink: 0, 
              background: 'linear-gradient(135deg, #6D5DF6 0%, #4F46E5 50%, #7C3AED 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', top: 0, zIndex: 20 
            }}>
              
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={onClose}
                style={{ 
                  width: 44, height: 44, position: 'absolute', right: 16, borderRadius: '50%', 
                  background: 'rgba(255,255,255,0.2)', backdropFilter: 'none', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', 
                  border: 'none', cursor: 'pointer' 
                }}
              >
                <X size={22} />
              </motion.button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>Destinatários</h2>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>Selecione quem receberá o comunicado</span>
              </div>
            </header>

            {/* ── CORPO PRINCIPAL ────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120, display: 'flex', flexDirection: 'column' }}>
              {isLoadingData ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 24px',
                  position: 'relative',
                  minHeight: 460
                }}>
                  {/* Cyber Atmospheric Ambient Glow */}
                  <div style={{
                    position: 'absolute',
                    width: 260,
                    height: 260,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0, 210, 255, 0.22) 0%, rgba(117, 81, 255, 0.18) 45%, rgba(236, 72, 153, 0.08) 70%, transparent 85%)',
                    filter: 'blur(32px)',
                    animation: 'destAuraGlow 3s ease-in-out infinite',
                    pointerEvents: 'none',
                    zIndex: 0
                  }} />

                  {/* Multi-Ring Ultra-Modern Gyroscope */}
                  <div style={{ position: 'relative', width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, marginBottom: 24 }}>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '3px solid transparent',
                      borderTopColor: '#00D2FF',
                      borderRightColor: '#7551FF',
                      filter: 'drop-shadow(0 0 8px rgba(0, 210, 255, 0.6))',
                      animation: 'orbitSpinCW 1.3s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite'
                    }} />
                    <div style={{
                      position: 'absolute',
                      inset: 10,
                      borderRadius: '50%',
                      border: '2px dashed rgba(236, 72, 153, 0.75)',
                      borderBottomColor: '#00D2FF',
                      animation: 'orbitSpinCCW 1.9s linear infinite'
                    }} />
                    <div style={{
                      position: 'relative',
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(240, 244, 255, 0.9) 100%)',
                      border: '1.5px solid rgba(255, 255, 255, 0.95)',
                      boxShadow: '0 10px 25px -4px rgba(79, 70, 229, 0.25)',
                    }}>
                      <Users size={22} style={{
                        color: '#6D5DF6',
                        filter: 'drop-shadow(0 0 6px rgba(109, 93, 246, 0.5))',
                        animation: 'cyberCorePulse 2s ease-in-out infinite'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', zIndex: 1, maxWidth: 360 }}>
                    <h3 style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#0F172A',
                      letterSpacing: '-0.3px',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      Carregando Destinatários
                      <span style={{ display: 'inline-flex', gap: 4, marginLeft: 2 }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{
                            display: 'inline-block',
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #00D2FF, #7551FF)',
                            animation: `destPulseDot 1.2s ease-in-out ${i * 0.2}s infinite`
                          }} />
                        ))}
                      </span>
                    </h3>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 14px',
                      borderRadius: 99,
                      background: 'rgba(255, 255, 255, 0.85)',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    }}>
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#10B981',
                        boxShadow: '0 0 8px #10B981',
                        display: 'inline-block',
                        animation: 'destPulseBadge 1.8s ease-in-out infinite'
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                        Sincronizando turmas, alunos e colaboradores...
                      </span>
                    </div>

                    <div style={{
                      width: 200,
                      height: 4,
                      borderRadius: 99,
                      background: '#E2E8F0',
                      overflow: 'hidden',
                      position: 'relative',
                      marginTop: 4
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '50%',
                        borderRadius: 99,
                        background: 'linear-gradient(90deg, transparent, #00D2FF, #7551FF, #EC4899, transparent)',
                        animation: 'laserBeamSweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                      }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  {/* ── BARRA DE FILTRO RÁPIDO (TODOS / TURMAS / EQUIPE) ──────── */}
                  {!hideFilterTabs && (
                    <div style={{
                      display: 'flex',
                      padding: 4,
                      background: '#EDF2F7',
                      borderRadius: 18,
                      gap: 6,
                      margin: '16px 24px 8px 24px',
                      border: '1px solid #E2E8F0',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                    }}>
                      <button
                        type="button"
                        onClick={() => { setViewFilter('todos'); setCurrentCatId(null); }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '9px 12px',
                          borderRadius: 14,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 13,
                          transition: 'all 0.2s',
                          background: viewFilter === 'todos' ? '#FFFFFF' : 'transparent',
                          color: viewFilter === 'todos' ? '#0F172A' : '#64748B',
                          boxShadow: viewFilter === 'todos' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
                        }}
                      >
                        <span>Todos</span>
                        {Object.keys(selected).length > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: '#F1F5F9', color: '#475569' }}>
                            {Object.keys(selected).length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setViewFilter('turmas'); setCurrentCatId(null); }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '9px 12px',
                          borderRadius: 14,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 13,
                          transition: 'all 0.2s',
                          background: viewFilter === 'turmas' ? '#FFFFFF' : 'transparent',
                          color: viewFilter === 'turmas' ? '#4F46E5' : '#64748B',
                          boxShadow: viewFilter === 'turmas' ? '0 2px 8px rgba(79, 70, 229, 0.12)' : 'none'
                        }}
                      >
                        <GraduationCap size={15} />
                        <span>Turmas</span>
                        {selectedTurmasCount > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: '#EEF2FF', color: '#4F46E5' }}>
                            {selectedTurmasCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setViewFilter('equipe'); setCurrentCatId(null); }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '9px 12px',
                          borderRadius: 14,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 13,
                          transition: 'all 0.2s',
                          background: viewFilter === 'equipe' ? '#FFFFFF' : 'transparent',
                          color: viewFilter === 'equipe' ? '#7C3AED' : '#64748B',
                          boxShadow: viewFilter === 'equipe' ? '0 2px 8px rgba(124, 58, 237, 0.12)' : 'none'
                        }}
                      >
                        <Shield size={15} />
                        <span>Equipe</span>
                        {selectedEquipeCount > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: '#F5F3FF', color: '#7C3AED' }}>
                            {selectedEquipeCount}
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* ── BARRA DE PESQUISA & SELECIONAR TUDO ─────────────────── */}
                  <div style={{ padding: '12px 24px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                        <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: 14, top: 12 }} />
                        <input
                          placeholder="Buscar por turma, aluno, setor ou colaborador..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          style={{
                            width: '100%', height: 42, borderRadius: 14, border: '1px solid #E2E8F0',
                            padding: '0 16px 0 40px', fontSize: 14, outline: 'none', background: '#FFFFFF',
                            transition: 'border 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}
                          onFocus={e => e.currentTarget.style.borderColor = '#6D5DF6'}
                          onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            style={{ position: 'absolute', right: 12, top: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={toggleAllInCurrentView}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
                          color: '#4F46E5',
                          background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '6px 8px'
                        }}
                      >
                        <span>Selecionar tudo</span>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s',
                          background: isAllActiveSelected ? '#4F46E5' : 'transparent',
                          border: isAllActiveSelected ? 'none' : '2px solid #CBD5E1'
                        }}>
                          {isAllActiveSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* ── CONTEÚDO PRINCIPAL ──────────────────────────────────── */}
                  <div style={{ padding: '0 24px 24px' }}>
                    
                    {/* CASO: BUSCA ATIVA COM RESULTADOS CATEGORIZADOS */}
                    {hasSearch ? (
                      totalSearchResults === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748B' }}>
                          <Search size={36} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                          <p style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', margin: '0 0 4px' }}>Nenhum resultado encontrado</p>
                          <span style={{ fontSize: 13, color: '#94A3B8' }}>Não encontramos destinatários para "{searchQuery}"</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                          
                          {/* Seção 1: Equipe Escolar encontrada */}
                          {searchResults.equipe.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
                                <Shield size={16} color="#7C3AED" />
                                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#7C3AED' }}>
                                  Equipe Escolar & Colaboradores ({searchResults.equipe.length})
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {searchResults.equipe.map((item: any) => {
                                  const isColab = item.type === 'funcionario'
                                  const isPersonSelected = isColab ? !!selected[item.id] : (item.leafIds && item.leafIds.length > 0 && item.leafIds.every((id: string) => !!selected[id]))
                                  const dept = !isColab ? item.deptInfo : getEquipeDepartmentInfo(item.funcao || 'Colaborador')

                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => toggleSelect(item)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px',
                                        borderRadius: 14, cursor: 'pointer',
                                        background: isPersonSelected ? '#F5F3FF' : '#FFFFFF',
                                        border: isPersonSelected ? '1.5px solid #C4B5FD' : '1px solid #E2E8F0',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <div style={{
                                        width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        background: isPersonSelected ? '#7C3AED' : '#FFFFFF',
                                        border: isPersonSelected ? 'none' : '1.5px solid #CBD5E1'
                                      }}>
                                        {isPersonSelected && <Check size={11} color="#fff" strokeWidth={3} />}
                                      </div>

                                      <div style={{
                                        width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: dept.bgSoft, color: dept.color, flexShrink: 0
                                      }}>
                                        <dept.icon size={16} />
                                      </div>

                                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{item.title || item.name}</span>
                                          <span style={{
                                            fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 12,
                                            background: dept.badgeBg, color: dept.badgeColor, textTransform: 'uppercase'
                                          }}>
                                            {isColab ? (item.funcao || 'Colaborador') : 'Setor da Equipe'}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: 11, color: '#64748B', marginTop: 1, lineHeight: 1.2 }}>
                                          {isColab ? (item.email || 'Colaborador da Escola') : `${item.payloads?.length || 0} membros`}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Seção 2: Turmas e Alunos encontrados */}
                          {searchResults.turmasEAlunos.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
                                <GraduationCap size={16} color="#4F46E5" />
                                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#4F46E5' }}>
                                  Turmas & Alunos ({searchResults.turmasEAlunos.length})
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {searchResults.turmasEAlunos.map((item: any) => {
                                  const isAluno = item.type === 'aluno'
                                  const isSelected = isAluno ? !!selected[item.id] : (item.leafIds && item.leafIds.length > 0 && item.leafIds.every((id: string) => !!selected[id]))

                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => toggleSelect(item)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                                        borderRadius: 16, cursor: 'pointer',
                                        background: isSelected ? '#EEF2FF' : '#FFFFFF',
                                        border: isSelected ? '2px solid #A5B4FC' : '1px solid #E2E8F0',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <div style={{
                                        width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        background: isSelected ? '#4F46E5' : '#FFFFFF',
                                        border: isSelected ? 'none' : '2px solid #CBD5E1'
                                      }}>
                                        {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                                      </div>

                                      <div style={{
                                        width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: '#EEF2FF', color: '#4F46E5', flexShrink: 0
                                      }}>
                                        {isAluno ? <User size={18} /> : <Users size={18} />}
                                      </div>

                                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{item.title || item.name}</span>
                                          <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                            background: '#F1F5F9', color: '#475569', textTransform: 'uppercase'
                                          }}>
                                            {isAluno ? 'Aluno' : 'Turma'}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                                          {isAluno ? `${item.turmaNome || 'Turma'}${item.anoLetivo ? ` • ${item.anoLetivo}` : ''}` : item.subtitle}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                        </div>
                      )
                    ) : (
                      /* ════════════════════════════════════════════════════════
                         VISUALIZAÇÃO PADRÃO: TURMAS & EQUIPE NA MESMA ABA (SEPARADOS)
                         ════════════════════════════════════════════════════════ */
                      <AnimatePresence mode="popLayout">
                        {currentCatId ? (
                          /* Drill-down de uma categoria de turmas */
                          <motion.div
                            key={currentCatId}
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, marginTop: 4 }}>
                              <button 
                                onClick={() => setCurrentCatId(null)} 
                                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, color: '#4F46E5', fontWeight: 700, cursor: 'pointer', padding: '6px 0', fontSize: 14 }}
                              >
                                <ArrowLeft size={18} />
                                Voltar para Todos os Destinatários
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                                  {turmasListItems.find(i => i.id === currentCatId)?.title}
                                </h3>
                                <span style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                                  {activeItems.length}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {activeItems.map((item: any) => renderTurmaCard(item))}
                            </div>
                          </motion.div>
                        ) : (
                          /* Visualização Principal: Ambas as seções juntas na mesma tela */
                          <div
                            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                          >
                            {/* ── SEÇÃO 1: TURMAS DE ALUNOS ──────────────────────── */}
                            {(viewFilter === 'todos' || viewFilter === 'turmas') && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <GraduationCap size={18} color="#4F46E5" />
                                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.2px' }}>
                                      Turmas de Alunos
                                    </h3>
                                  </div>

                                  {availableAnos.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Ano:</span>
                                      <select
                                        value={effectiveAno}
                                        onChange={e => setSelectedAno(e.target.value)}
                                        style={{
                                          height: 32, borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF',
                                          padding: '0 24px 0 8px', fontSize: 12, fontWeight: 700, color: '#0F172A', outline: 'none',
                                          cursor: 'pointer', appearance: 'none',
                                          backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748B%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E")',
                                          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', backgroundSize: '14px'
                                        }}
                                      >
                                        {availableAnos.map(ano => (
                                          <option key={ano} value={ano}>{ano}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                {/* Cartões de Categorias/Segmentos */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {turmasListItems.map((item: any) => renderSegmentCard(item))}
                                </div>
                              </div>
                            )}

                            {/* ── SEPARADOR ELEGANTE QUANDO EXIBINDO TODOS ────────── */}
                            {viewFilter === 'todos' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 2px' }}>
                                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                  Equipe Escolar
                                </span>
                                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                              </div>
                            )}

                            {/* ── SEÇÃO 2: EQUIPE ESCOLAR ────────────────────────── */}
                            {(viewFilter === 'todos' || viewFilter === 'equipe') && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Shield size={18} color="#7C3AED" />
                                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.2px' }}>
                                      Equipe Escolar
                                    </h3>
                                  </div>
                                </div>

                                {/* Cartões dos setores da Equipe Escolar */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {equipeListItems.map((item: any) => renderEquipeCard(item))}
                                </div>

                                {/* Colaboradores Individuais */}
                                {!hideAllColabsButton && renderAllSchoolColabsSection()}
                              </div>
                            )}
                          </div>
                        )}
                      </AnimatePresence>
                    )}

                  </div>
                </div>
              )}
            </div>

            {/* ── FOOTER DE CONFIRMAÇÃO ────────────────────── */}
            <div className="dest-modal-footer">
              <button 
                type="button"
                onClick={onClose}
                className="dest-modal-btn-cancel"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleConfirm}
                disabled={isLoadingData || Object.keys(selected).length === 0}
                className="dest-modal-btn-confirm"
                style={{
                  background: (isLoadingData || Object.keys(selected).length === 0) 
                    ? '#CBD5E1' 
                    : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  cursor: (isLoadingData || Object.keys(selected).length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: (isLoadingData || Object.keys(selected).length === 0) 
                    ? 'none' 
                    : '0 8px 20px -4px rgba(79, 70, 229, 0.45)'
                }}
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (!mounted) return null
  return createPortal(
    modalContent,
    document.body
  )
}
