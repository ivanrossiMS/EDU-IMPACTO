import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  MoreHorizontal,
  MessageSquare,
  Heart,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Users,
  GraduationCap,
} from 'lucide-react'
import { ADMomento, useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { formatDateTime } from '@/lib/utils'
import { isAlunoCursandoTurma, getAlunoTurmaCursando, compareTurmasBySerie } from '@/lib/studentTurmaUtils'
import { MomentoLightbox } from '@/components/agenda/MomentoLightbox'
import { MomentoVideoPlayer } from '@/components/agenda/MomentoVideoPlayer'

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])
  return mounted ? createPortal(children, document.body) : null
}

// Paleta de temas ultra-modernos com cabeçalho em gradiente, bordas 3D e sombras em camadas
const CARD_HEADER_THEMES = [
  {
    headerGradient: 'linear-gradient(135deg var(--in-oklab, ), #4338ca 0%, #6366f1 52%, #8b5cf6 100%)',
    borderLight: '#c7d2fe',
    borderMid: '#a5b4fc',
    border3D: '#4f46e5',
    shadowRest:
      '0 14px 30px -8px rgba(79, 70, 229, 0.20), 0 6px 14px -4px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    shadowHover:
      '0 22px 42px -10px rgba(79, 70, 229, 0.30), 0 10px 20px -6px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)',
    accentColor: '#4f46e5',
    accentBg: '#eef2ff',
  },
  {
    headerGradient: 'linear-gradient(135deg var(--in-oklab, ), #7e22ce 0%, #a855f7 50%, #ec4899 100%)',
    borderLight: '#e9d5ff',
    borderMid: '#d8b4fe',
    border3D: '#9333ea',
    shadowRest:
      '0 14px 30px -8px rgba(147, 51, 234, 0.20), 0 6px 14px -4px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    shadowHover:
      '0 22px 42px -10px rgba(147, 51, 234, 0.30), 0 10px 20px -6px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)',
    accentColor: '#9333ea',
    accentBg: '#faf5ff',
  },
  {
    headerGradient: 'linear-gradient(135deg var(--in-oklab, ), #1d4ed8 0%, #2563eb 50%, #06b6d4 100%)',
    borderLight: '#bfdbfe',
    borderMid: '#93c5fd',
    border3D: '#2563eb',
    shadowRest:
      '0 14px 30px -8px rgba(37, 99, 235, 0.20), 0 6px 14px -4px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    shadowHover:
      '0 22px 42px -10px rgba(37, 99, 235, 0.30), 0 10px 20px -6px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)',
    accentColor: '#2563eb',
    accentBg: '#eff6ff',
  },
  {
    headerGradient: 'linear-gradient(135deg var(--in-oklab, ), #047857 0%, #059669 50%, #14b8a6 100%)',
    borderLight: '#a7f3d0',
    borderMid: '#6ee7b7',
    border3D: '#059669',
    shadowRest:
      '0 14px 30px -8px rgba(5, 150, 105, 0.20), 0 6px 14px -4px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    shadowHover:
      '0 22px 42px -10px rgba(5, 150, 105, 0.30), 0 10px 20px -6px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)',
    accentColor: '#059669',
    accentBg: '#ecfdf5',
  },
  {
    headerGradient: 'linear-gradient(135deg var(--in-oklab, ), #c2410c 0%, #ea580c 50%, #f59e0b 100%)',
    borderLight: '#fed7aa',
    borderMid: '#fdba74',
    border3D: '#ea580c',
    shadowRest:
      '0 14px 30px -8px rgba(234, 88, 12, 0.20), 0 6px 14px -4px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    shadowHover:
      '0 22px 42px -10px rgba(234, 88, 12, 0.30), 0 10px 20px -6px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)',
    accentColor: '#ea580c',
    accentBg: '#fff7ed',
  },
  {
    headerGradient: 'linear-gradient(135deg var(--in-oklab, ), #be123c 0%, #e11d48 50%, #ec4899 100%)',
    borderLight: '#fecdd3',
    borderMid: '#fda4af',
    border3D: '#e11d48',
    shadowRest:
      '0 14px 30px -8px rgba(225, 29, 72, 0.20), 0 6px 14px -4px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    shadowHover:
      '0 22px 42px -10px rgba(225, 29, 72, 0.30), 0 10px 20px -6px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)',
    accentColor: '#e11d48',
    accentBg: '#fff1f2',
  },
]

function normStr(val: any): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export interface ResolvedMomentoGroup {
  name: string
  students: string[]
}

export function resolveMomentoRecipientGroups(
  post: ADMomento,
  turmas: any[],
  chatGroups: any[],
  alunos: any[]
): { isAllSchool: boolean; groups: ResolvedMomentoGroup[] } {
  const rawTargets = Array.from(
    new Set(
      [
        ...(post.targetClasses || []),
        ...((post as any).dados?.targetClasses || []),
        ...(post.grupos || []),
        ...((post as any).targetGrupos || []),
        ...((post as any).dados?.grupos || []),
        ...((post as any).dados?.targetGrupos || []),
      ]
        .map(t => String(t || '').trim())
        .filter(Boolean)
    )
  )

  const rawAlunosIds: string[] = (post.alunosIds || (post as any).dados?.alunosIds || [])
    .map((id: any) => String(id).trim())
    .filter(Boolean)
  const rawAlunosNomes: string[] = (post.alunosNomes || (post as any).dados?.alunosNomes || []).map((n: any) =>
    String(n || '').trim()
  )

  const GLOBAL_LABELS = ['toda a escola', 'todos', 'todas', 'todas as turmas', 'institucional']
  const isExplicitGlobal =
    rawTargets.some(t => GLOBAL_LABELS.includes(t.toLowerCase())) ||
    (post as any).destino === 'todos' ||
    (post as any).dados?.destino === 'todos'

  const specificTargets = rawTargets.filter(t => !GLOBAL_LABELS.includes(t.toLowerCase()))
  const hasAlunos = rawAlunosIds.length > 0
  const isAllSchool = isExplicitGlobal || (!hasAlunos && specificTargets.length === 0)

  if (isAllSchool) {
    return { isAllSchool: true, groups: [] }
  }

  // Mapa rápido de alunos por ID limpo
  const alunosById = new Map<string, any>()
  ;(alunos || []).forEach(a => {
    if (!a || a.id == null) return
    const clean = String(a.id).replace(/^(a_|_ALU)/, '').trim()
    if (clean) alunosById.set(clean, a)
    alunosById.set(String(a.id).trim(), a)
  })

  // Função auxiliar para obter todos os alunos pertencentes a uma turma ou grupo
  const getStudentsOfTurmaOrGroup = (targetNameOrId: string): { displayName: string; students: { id: string; nome: string }[] } => {
    const tNorm = normStr(targetNameOrId)
    const cleanTargetId = tNorm.replace(/^[tg]_?/, '').replace(/^sync-/, '')

    const matchedGroup = (chatGroups || []).find((g: any) => {
      const gNome = normStr(g.nome || g.dados?.nome)
      const gId = normStr(g.id)
      const gSync = normStr(g.syncId || g.dados?.syncId)
      return (
        (gNome && gNome === tNorm) ||
        (gId && (gId === tNorm || gId === cleanTargetId || gId === `sync-${cleanTargetId}`)) ||
        (gSync && (gSync === tNorm || gSync === `sync-${cleanTargetId}`))
      )
    })

    const matchedTurma = (turmas || []).find((t: any) => {
      const erpNome = normStr(t.nome)
      const erpId = normStr(t.id)
      const erpCod = normStr(t.codigo)
      if ((erpNome && erpNome === tNorm) || (erpId && erpId === cleanTargetId) || (erpCod && erpCod === cleanTargetId)) {
        return true
      }
      if (matchedGroup) {
        const gSync = normStr(matchedGroup.syncId || matchedGroup.dados?.syncId || matchedGroup.id)
        const gNome = normStr(matchedGroup.nome || matchedGroup.dados?.nome)
        if ((erpId && gSync === `sync-${erpId}`) || (erpNome && gNome === erpNome)) {
          return true
        }
      }
      return false
    })

    const displayName =
      matchedGroup?.nome || matchedGroup?.dados?.nome || matchedTurma?.nome || targetNameOrId

    const groupMemberIds = new Set<string>()
    if (matchedGroup) {
      let aIds = matchedGroup.alunosIds || matchedGroup.dados?.alunosIds || []
      if (typeof aIds === 'string') {
        try {
          aIds = JSON.parse(aIds)
        } catch {
          aIds = []
        }
      }
      if (Array.isArray(aIds)) {
        aIds.forEach((id: any) => {
          const clean = String(id).replace(/^(a_|_ALU)/, '').trim()
          if (clean) groupMemberIds.add(clean)
        })
      }
    }

    const studentMap = new Map<string, { id: string; nome: string }>()

    // 1. Adicionar membros diretos do grupo
    groupMemberIds.forEach(cleanId => {
      const aObj = alunosById.get(cleanId)
      if (aObj && aObj.nome) {
        studentMap.set(cleanId, { id: cleanId, nome: String(aObj.nome).trim() })
      }
    })

    // 2. Verificar alunos cursando a turma correspondente
    ;(alunos || []).forEach((a: any) => {
      if (!a || !a.nome) return
      const cleanAId = String(a.id).replace(/^(a_|_ALU)/, '').trim()
      if (studentMap.has(cleanAId)) return

      if (matchedTurma && isAlunoCursandoTurma(a, matchedTurma, matchedTurma.ano, turmas)) {
        studentMap.set(cleanAId, { id: cleanAId, nome: String(a.nome).trim() })
        return
      }
      if (!matchedTurma && matchedGroup && isAlunoCursandoTurma(a, matchedGroup, matchedGroup.ano, turmas)) {
        studentMap.set(cleanAId, { id: cleanAId, nome: String(a.nome).trim() })
        return
      }
      if (!matchedTurma && !matchedGroup && isAlunoCursandoTurma(a, targetNameOrId, undefined, turmas)) {
        studentMap.set(cleanAId, { id: cleanAId, nome: String(a.nome).trim() })
        return
      }

      const directTurma = normStr(a.turma)
      const directTurmaNome = normStr(a.turma_nome || a.dados?.turma_nome)
      if ((directTurma && directTurma === tNorm) || (directTurmaNome && directTurmaNome === tNorm)) {
        studentMap.set(cleanAId, { id: cleanAId, nome: String(a.nome).trim() })
      }
    })

    const sorted = Array.from(studentMap.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return { displayName, students: sorted }
  }

  const groupsMap = new Map<string, Set<string>>()
  const addStudentToGroup = (groupName: string, studentName: string) => {
    const cleanGroup = String(groupName || '').trim() || 'Turma Selecionada'
    let set = groupsMap.get(cleanGroup)
    if (!set) {
      set = new Set<string>()
      groupsMap.set(cleanGroup, set)
    }
    if (studentName) set.add(studentName)
  }

  const targetAlunoIdSet = new Set(rawAlunosIds.map(id => String(id).replace(/^(a_|_ALU)/, '').trim()))
  const coveredStudentIds = new Set<string>()

  // 1. Processar turmas/grupos explícitos em targetClasses / grupos
  if (specificTargets.length > 0) {
    specificTargets.forEach(tRaw => {
      const { displayName, students } = getStudentsOfTurmaOrGroup(tRaw)
      if (!groupsMap.has(displayName)) {
        groupsMap.set(displayName, new Set<string>())
      }
      if (hasAlunos) {
        const matchingTargeted = students.filter(s => targetAlunoIdSet.has(s.id))
        if (matchingTargeted.length > 0) {
          matchingTargeted.forEach(s => {
            addStudentToGroup(displayName, s.nome)
            coveredStudentIds.add(s.id)
          })
        } else {
          students.forEach(s => addStudentToGroup(displayName, s.nome))
        }
      } else {
        students.forEach(s => addStudentToGroup(displayName, s.nome))
      }
    })
  }

  // 2. Processar alunosIds que não estavam cobertos por targetClasses explícitas
  if (hasAlunos) {
    const remaining = rawAlunosIds
      .map((rawId, idx) => {
        const cleanId = String(rawId).replace(/^(a_|_ALU)/, '').trim()
        const alunoObj = alunosById.get(cleanId)
        const fallbackName = rawAlunosNomes[idx] || alunoObj?.nome || ''
        return {
          cleanId,
          aluno: alunoObj,
          name: String(alunoObj?.nome || fallbackName || '').trim(),
        }
      })
      .filter(item => !coveredStudentIds.has(item.cleanId))

    if (remaining.length > 0) {
      const resolvePrimaryTurmaForStudent = (alunoObj: any, cleanId: string): string => {
        if (alunoObj) {
          const regularTurmas = (turmas || []).filter((t: any) => {
            const n = normStr(t.nome)
            return !n.includes('integral') && !n.includes('intermediario')
          })
          const matchedRegular = regularTurmas.find((t: any) =>
            isAlunoCursandoTurma(alunoObj, t, t.ano, turmas)
          )
          if (matchedRegular?.nome) return matchedRegular.nome

          const matchedAnyTurma = (turmas || []).find((t: any) =>
            isAlunoCursandoTurma(alunoObj, t, t.ano, turmas)
          )
          if (matchedAnyTurma?.nome) return matchedAnyTurma.nome

          const cursandoRef = getAlunoTurmaCursando(alunoObj)
          if (cursandoRef) {
            const cNorm = normStr(cursandoRef)
            const foundT = (turmas || []).find(
              (t: any) =>
                normStr(t.id) === cNorm || normStr(t.codigo) === cNorm || normStr(t.nome) === cNorm
            )
            if (foundT?.nome) return foundT.nome
            const foundG = (chatGroups || []).find(
              (g: any) => normStr(g.id) === cNorm || normStr(g.nome) === cNorm
            )
            if (foundG?.nome) return foundG.nome
            return cursandoRef
          }

          const directNome = alunoObj.turma_nome || alunoObj.dados?.turma_nome
          if (directNome) return String(directNome).trim()
        }

        const matchedChatGroup = (chatGroups || []).find((g: any) => {
          let aIds = g.alunosIds || g.dados?.alunosIds || []
          if (typeof aIds === 'string') {
            try {
              aIds = JSON.parse(aIds)
            } catch {
              aIds = []
            }
          }
          return (
            Array.isArray(aIds) &&
            aIds.some((id: any) => String(id).replace(/^(a_|_ALU)/, '').trim() === cleanId)
          )
        })
        if (matchedChatGroup?.nome) return matchedChatGroup.nome

        return 'Turma Selecionada'
      }

      const studentTurmaPairs = remaining.map(item => ({
        ...item,
        turmaName: resolvePrimaryTurmaForStudent(item.aluno, item.cleanId),
      }))

      const distinctPrimaryTurmas = new Set(studentTurmaPairs.map(p => p.turmaName))

      let sharedSpecialGroupName: string | null = null
      if (distinctPrimaryTurmas.size > 1 && remaining.length >= 2) {
        const specialCandidates = [
          ...(chatGroups || []).filter((g: any) => {
            const n = normStr(g.nome || g.dados?.nome)
            return n.includes('integral') || n.includes('intermediario') || !String(g.syncId || g.id).startsWith('sync-')
          }),
          ...(turmas || []).filter((t: any) => {
            const n = normStr(t.nome)
            return n.includes('integral') || n.includes('intermediario')
          }),
        ]

        for (const cand of specialCandidates) {
          const candName = cand.nome || cand.dados?.nome
          if (!candName) continue
          const { students: candStudents } = getStudentsOfTurmaOrGroup(candName)
          const candIdSet = new Set(candStudents.map(s => s.id))
          if (candIdSet.size > 0 && remaining.every(r => candIdSet.has(r.cleanId))) {
            sharedSpecialGroupName = candName
            break
          }
        }
      }

      if (sharedSpecialGroupName) {
        studentTurmaPairs.forEach(p => {
          addStudentToGroup(sharedSpecialGroupName!, p.name)
        })
      } else {
        studentTurmaPairs.forEach(p => {
          addStudentToGroup(p.turmaName, p.name)
        })
      }
    }
  }

  const groups: ResolvedMomentoGroup[] = Array.from(groupsMap.entries())
    .map(([name, studentSet]) => ({
      name,
      students: Array.from(studentSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }))
    .sort((a, b) => compareTurmasBySerie({ nome: a.name }, { nome: b.name }))

  return { isAllSchool: false, groups }
}

export function formatMomentoTargetLabel(isAllSchool: boolean, groups: ResolvedMomentoGroup[]): string {
  if (isAllSchool) return 'Toda a Escola'
  if (groups.length === 0) return 'Turma Selecionada'
  if (groups.length === 1) return groups[0].name

  const byPrefix: Record<string, string[]> = {}
  groups.forEach(g => {
    const prefix = g.name.split(' - ')[0]?.trim() || g.name
    if (!byPrefix[prefix]) byPrefix[prefix] = []
    byPrefix[prefix].push(g.name)
  })

  const entries = Object.entries(byPrefix)
  if (entries.length > 2) return `${groups.length} Turmas/Grupos`
  return entries
    .map(([prefix, list]) => (list.length > 1 ? `${prefix} (${list.length})` : list[0]))
    .join(', ')
}

type Props = {
  post: ADMomento
  index: number
  onDelete: (id: string | number) => void
  alunos?: any[]
  turmas?: any[]
}

export function MomentoPostCard({ post, index, onDelete, alunos: propAlunos, turmas: propTurmas }: Props) {
  const [slide, setSlide] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [isDescExpanded, setIsDescExpanded] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  const { adConfirm, chatGroups = [] } = useAgendaDigital()
  const { turmas: contextTurmas = [] } = useData()
  const [fallbackAlunos = []] = useSupabaseArray<any>('alunos/lightweight?limit=2000', [])
  const { currentUser } = useApp()

  const effectiveTurmas = propTurmas && propTurmas.length > 0 ? propTurmas : contextTurmas
  const effectiveAlunos = propAlunos && propAlunos.length > 0 ? propAlunos : fallbackAlunos

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isSwipingCardRef = useRef(false)

  const medias = post.media || []
  const hasMultiple = medias.length > 1
  const currentMedia = medias[slide]

  // Proactive preloading of next slide
  useEffect(() => {
    if (!medias || medias.length <= 1) return
    const nextIdx = (slide + 1) % medias.length
    const nextMed = medias[nextIdx]
    if (nextMed && nextMed.type !== 'video' && nextMed.url) {
      const img = new Image()
      img.src = nextMed.url
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {})
      }
    }
  }, [slide, medias])

  const handleCardTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      isSwipingCardRef.current = false
    }
  }

  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    if (Math.abs(dx) > 8) {
      isSwipingCardRef.current = true
    }
  }

  const handleCardTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !hasMultiple) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y

    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      e.stopPropagation()
      if (dx < 0) {
        setSlide(s => (s === medias.length - 1 ? 0 : s + 1))
      } else {
        setSlide(s => (s === 0 ? medias.length - 1 : s - 1))
      }
    }
    touchStartRef.current = null
  }

  const displayTime = (() => {
    const dt = (post as any).created_at || (post as any).date
    if (dt) {
      try {
        return formatDateTime(dt)
      } catch {
        return post.time || 'Agora'
      }
    }
    return post.time || 'Agora'
  })()

  const authorName =
    !post.author || post.author === 'Administração'
      ? currentUser?.nome || 'Administração'
      : post.author
  const authorInitial = authorName.charAt(0).toUpperCase()
  const theme = CARD_HEADER_THEMES[index % CARD_HEADER_THEMES.length]

  const { isAllSchool, groups: resolvedGroups } = useMemo(
    () => resolveMomentoRecipientGroups(post, effectiveTurmas, chatGroups, effectiveAlunos),
    [post, effectiveTurmas, chatGroups, effectiveAlunos]
  )

  const targetLabel = useMemo(
    () => formatMomentoTargetLabel(isAllSchool, resolvedGroups),
    [isAllSchool, resolvedGroups]
  )

  const isClickable = !isAllSchool && resolvedGroups.length > 0

  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  const handleOpenTargetsModal = () => {
    if (!isClickable) return
    setExpandedGroups({})
    setShowTargets(true)
  }

  const descText = (post.desc || '').trim()
  const isLongDesc = descText.length > 140 || descText.split('\n').length > 3

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --in-oklab: ;
            }
            @supports (background: linear-gradient(in oklab, white, black)) {
              :root {
                --in-oklab: in oklab;
              }
            }
          `,
        }}
      />

      {/* Card com Bordas 3D, Sombras em Camadas e Cabeçalho Gradiente */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          borderTop: `1.5px solid ${theme.borderLight}`,
          borderLeft: `1.5px solid ${theme.borderLight}`,
          borderRight: `1.5px solid ${theme.borderMid}`,
          borderBottom: `5px solid ${theme.border3D}`,
          boxShadow: theme.shadowRest,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.transform = 'translateY(-5px)'
          el.style.boxShadow = theme.shadowHover
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.transform = 'none'
          el.style.boxShadow = theme.shadowRest
        }}
      >
        {/* Header em Gradiente Ultra Moderno */}
        <div
          style={{
            position: 'relative',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: theme.headerGradient,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.32), 0 2px 10px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Brilho suave decorativo no topo direito do cabeçalho */}
          <div
            style={{
              position: 'absolute',
              top: -28,
              right: -18,
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              minWidth: 0,
              flex: 1,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Avatar com efeito Glass 3D */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.22)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1.5px solid rgba(255, 255, 255, 0.55)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              {authorInitial}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 14,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.16)',
                }}
                title={authorName}
              >
                {authorName}
              </div>

              <div
                style={{
                  marginTop: 5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={handleOpenTargetsModal}
                  style={{
                    background: 'rgba(255, 255, 255, 0.20)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255, 255, 255, 0.38)',
                    borderRadius: 999,
                    padding: '2.5px 9px',
                    margin: 0,
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: isClickable ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                    maxWidth: 195,
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.10)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (isClickable) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.32)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (isClickable) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.20)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.38)'
                    }
                  }}
                  title={isClickable ? 'Clique para ver as turmas/grupos e alunos destinatários' : ''}
                >
                  <Users size={11} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {targetLabel}
                  </span>
                  {isClickable && <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.9 }} />}
                </button>
              </div>

              <div
                style={{
                  marginTop: 3,
                  color: 'rgba(255, 255, 255, 0.82)',
                  fontSize: 10.5,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {displayTime}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => adConfirm('Apagar este momento?', 'Apagar', () => onDelete(post.id))}
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'rgba(255, 255, 255, 0.18)',
              border: '1px solid rgba(255, 255, 255, 0.30)',
              borderRadius: 10,
              padding: 6,
              cursor: 'pointer',
              color: '#ffffff',
              display: 'flex',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.30)'
            }}
            title="Opções do momento"
          >
            <MoreHorizontal size={17} />
          </button>
        </div>

        {/* Media Frame */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 260,
            overflow: 'hidden',
            background: '#0f172a',
            flexShrink: 0,
            cursor: 'pointer',
            touchAction: 'pan-y',
          }}
          onTouchStart={handleCardTouchStart}
          onTouchMove={handleCardTouchMove}
          onTouchEnd={handleCardTouchEnd}
          onClick={() => {
            if (isSwipingCardRef.current) {
              isSwipingCardRef.current = false
              return
            }
            setShowLightbox(true)
          }}
        >
          {currentMedia ? (
            currentMedia.type === 'video' ||
            /\.(mp4|webm|mov|m4v|3gp|mkv|ogv)$/i.test((currentMedia.url || '').split('?')[0]) ? (
              <MomentoVideoPlayer
                src={currentMedia.url}
                poster={currentMedia.thumbnail_url || (currentMedia as any).thumbnail || null}
                objectFit="cover"
                onExpand={() => setShowLightbox(true)}
              />
            ) : (
              <img
                src={currentMedia.url}
                alt="Momento"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              Sem Mídia
            </div>
          )}

          {/* Hover overlay hint */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.18)',
              opacity: 0,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                borderRadius: '50%',
                padding: 10,
                backdropFilter: 'blur(4px)',
              }}
            >
              <Maximize2 size={20} color="#fff" />
            </div>
          </div>

          {/* Counter */}
          {medias.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(15, 23, 42, 0.72)',
                backdropFilter: 'blur(6px)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                zIndex: 10,
              }}
            >
              {slide + 1}/{medias.length}
            </div>
          )}

          {/* Nav arrows */}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setSlide(s => (s === 0 ? medias.length - 1 : s - 1))
                }}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.90)',
                  boxShadow: '0 4px 10px rgba(15, 23, 42, 0.20)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1e293b',
                  zIndex: 10,
                }}
                aria-label="Mídia anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setSlide(s => (s === medias.length - 1 ? 0 : s + 1))
                }}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  background: 'rgba(255, 255, 255, 0.90)',
                  boxShadow: '0 4px 10px rgba(15, 23, 42, 0.20)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1e293b',
                  zIndex: 10,
                }}
                aria-label="Próxima mídia"
              >
                <ChevronRight size={17} />
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            background: '#ffffff',
          }}
        >
          {descText ? (
            <div>
              <p
                style={{
                  margin: 0,
                  color: '#334155',
                  fontSize: 13.5,
                  fontWeight: 450,
                  lineHeight: 1.55,
                  display: isDescExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: isDescExpanded ? undefined : 3,
                  WebkitBoxOrient: isDescExpanded ? undefined : 'vertical',
                  overflow: isDescExpanded ? 'visible' : 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {descText}
              </p>
              {isLongDesc && (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(v => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '5px 0 0',
                    margin: 0,
                    color: theme.accentColor,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isDescExpanded ? 'Ver menos' : 'Ver mais'}
                </button>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
              Sem descrição
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #f1f5f9',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: '#f8fafc',
            marginTop: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setShowComments(s => !s)}
            style={{
              background: showComments ? theme.accentBg : 'transparent',
              border: 'none',
              borderRadius: 8,
              padding: '4px 8px',
              marginLeft: -8,
              cursor: 'pointer',
              color: showComments ? theme.accentColor : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            <MessageSquare size={15} /> {(post.comments || []).length} Comentários
          </button>
          <div
            style={{
              color: (post.likes || []).length > 0 ? '#f43f5e' : '#64748b',
              background: (post.likes || []).length > 0 ? '#fff1f2' : 'transparent',
              padding: '4px 10px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <Heart size={15} fill={(post.likes || []).length > 0 ? '#f43f5e' : 'none'} />
            {(post.likes || []).length} Curtidas
          </div>
        </div>

        {showComments && (
          <div
            style={{
              padding: '10px 16px 14px',
              background: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {(post.comments || []).length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '6px 0' }}>
                Nenhum comentário ainda.
              </div>
            ) : (
              (post.comments || []).map(c => (
                <div
                  key={c.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '8px 12px',
                  }}
                >
                  <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 12 }}>{c.author}</span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}> • {c.time}</span>
                  <div style={{ color: '#334155', fontSize: 12.5, marginTop: 2 }}>{c.text}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: Grupos / Turmas Selecionados com expansão de alunos */}
      {showTargets && (
        <ClientPortal>
          <div
            onClick={() => setShowTargets(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.60)',
              backdropFilter: 'blur(6px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: 22,
                width: '100%',
                maxWidth: 460,
                borderTop: `1.5px solid ${theme.borderLight}`,
                borderLeft: `1.5px solid ${theme.borderLight}`,
                borderRight: `1.5px solid ${theme.borderMid}`,
                borderBottom: `5px solid ${theme.border3D}`,
                boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '82vh',
                overflow: 'hidden',
              }}
            >
              {/* Cabeçalho em Gradiente do Modal */}
              <div
                style={{
                  background: theme.headerGradient,
                  padding: '18px 22px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: '#ffffff', fontSize: 16, fontWeight: 800 }}>
                    Grupos / Turmas Selecionados
                  </h3>
                  <p style={{ margin: '3px 0 0', color: 'rgba(255, 255, 255, 0.88)', fontSize: 12 }}>
                    {resolvedGroups.length}{' '}
                    {resolvedGroups.length === 1 ? 'grupo/turma neste momento' : 'grupos/turmas neste momento'} •
                    Clique na turma para expandir os alunos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTargets(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    borderRadius: 10,
                    padding: 7,
                    cursor: 'pointer',
                    color: '#ffffff',
                    display: 'flex',
                    flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  padding: '18px 20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  overflowY: 'auto',
                }}
              >
                {resolvedGroups.map((group, i) => {
                  const isExpanded = !!expandedGroups[group.name]
                  return (
                    <div
                      key={`${group.name}_${i}`}
                      style={{
                        borderRadius: 14,
                        border: isExpanded ? `1.5px solid ${theme.border3D}` : '1px solid #e2e8f0',
                        borderBottom: isExpanded ? `3.5px solid ${theme.border3D}` : '2.5px solid #cbd5e1',
                        background: '#ffffff',
                        overflow: 'hidden',
                        transition: 'all 0.15s ease',
                        boxShadow: isExpanded
                          ? '0 6px 16px -4px rgba(15, 23, 42, 0.08)'
                          : '0 2px 4px rgba(15, 23, 42, 0.03)',
                      }}
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleGroupExpand(group.name)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: isExpanded ? theme.accentBg : '#f8fafc',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background: theme.border3D,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: '#0f172a',
                              fontSize: 13.5,
                              fontWeight: 700,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {group.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: theme.accentColor,
                              background: '#ffffff',
                              border: `1px solid ${theme.borderLight}`,
                              padding: '2px 9px',
                              borderRadius: 999,
                            }}
                          >
                            {group.students.length} aluno{group.students.length !== 1 ? 's' : ''}
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={16} color={theme.accentColor} />
                          ) : (
                            <ChevronDown size={16} color="#64748b" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            borderTop: '1px solid #e2e8f0',
                            padding: '10px 12px',
                            background: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            maxHeight: 240,
                            overflowY: 'auto',
                          }}
                        >
                          {group.students.length > 0 ? (
                            group.students.map((studentName, sIdx) => (
                              <div
                                key={sIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '6px 10px',
                                  borderRadius: 9,
                                  background: '#f8fafc',
                                  border: '1px solid #f1f5f9',
                                }}
                              >
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: theme.accentBg,
                                    color: theme.accentColor,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <GraduationCap size={11} />
                                </div>
                                <span
                                  style={{
                                    color: '#334155',
                                    fontSize: 12.5,
                                    fontWeight: 500,
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {studentName}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div
                              style={{
                                color: '#94a3b8',
                                fontSize: 12,
                                textAlign: 'center',
                                padding: '8px 0',
                              }}
                            >
                              Nenhum aluno listado nesta turma.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ClientPortal>
      )}

      {/* Lightbox: Media View com Zoom */}
      <MomentoLightbox
        isOpen={showLightbox && medias.length > 0}
        onClose={() => setShowLightbox(false)}
        media={medias}
        initialIndex={slide}
        author={authorName}
        description={post.desc}
      />
    </>
  )
}
