'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, FileBarChart, Plus, FileText, ClipboardList, BookOpen, GraduationCap, Calendar, Users, MessageSquare, Layout, FileCheck, ArrowRight, ArrowLeft, ChevronDown, Sparkles } from 'lucide-react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useRelatorios, ReportTemplate, ReportField } from '@/lib/relatoriosContext'

import { useApp } from '@/lib/context'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'

interface ReportsSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (attachmentText: string, payload: any) => void
  onFillDirectly?: (payload: any) => void
  selectedDest?: any[]
  targetedStudents?: any[]
  currentUser?: any
  allowedTurmasIds?: string[]
}

export function ReportsSelectionModal({ 
  isOpen, 
  onClose, 
  selectedDest, 
  onAdd, 
  onFillDirectly,
  targetedStudents: propTargetedStudents,
  currentUser: propCurrentUser,
  allowedTurmasIds 
}: ReportsSelectionModalProps) {
  const { currentUser: contextCurrentUser } = useApp()
  const effectiveUser = propCurrentUser || contextCurrentUser
  const { templates: contextTemplates = [] } = useRelatorios()
  const [alunos, _sa, { loading: loadingAlunos }] = useSupabaseArray<any>('alunos/lightweight?limit=2000')
  const [gruposManuais, _sg, { loading: loadingGrupos }] = useSupabaseArray<any>('agenda/grupos')
  const [turmas, _st, { loading: loadingTurmas }] = useSupabaseArray<any>('turmas')
  const [colaboradores, _sc, { loading: loadingColabs }] = useSupabaseArray<any>('configuracoes/usuarios')
  
  const isLoadingData = loadingAlunos || loadingGrupos || loadingTurmas || loadingColabs

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  
  // Grid/List of resolved targeted students
  const [targetedStudents, setTargetedStudents] = useState<any[]>([])
  const [searchStudent, setSearchStudent] = useState('')

  // Report Assignment States
  const [dataReferencia, setDataReferencia] = useState<string>(new Date().toISOString().split('T')[0])

  const [filterYear, setFilterYear] = useState<string>('')
  const [filterTurmaId, setFilterTurmaId] = useState<string>('')
  
  // Custom selector states
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [showTurmaModal, setShowTurmaModal] = useState(false)

  // Load only dynamic context templates
  const allTemplates = contextTemplates.filter(t => t.status === 'ativo')

  // Mapeamento abrangente de IDs do colaborador atual (f_id, id puro, uid_legacy, email)
  const candidateColabIds = React.useMemo(() => {
    const ids = new Set<string>()
    if (effectiveUser?.id) {
      const raw = String(effectiveUser.id).trim().toLowerCase()
      ids.add(raw)
      ids.add(raw.replace(/^f_?/, ''))
      ids.add(`f_${raw.replace(/^f_?/, '')}`)
    }
    if ((effectiveUser as any)?.uid_legacy) {
      const raw = String((effectiveUser as any).uid_legacy).trim().toLowerCase()
      ids.add(raw)
      ids.add(raw.replace(/^f_?/, ''))
    }
    if ((effectiveUser as any)?.auth_id) {
      ids.add(String((effectiveUser as any).auth_id).trim().toLowerCase())
    }
    if (effectiveUser?.email) {
      ids.add(String(effectiveUser.email).trim().toLowerCase())
    }

    const matchedColab = (colaboradores || []).find((c: any) => 
      (c.email && effectiveUser?.email && String(c.email).toLowerCase() === String(effectiveUser.email).toLowerCase()) ||
      (c.id && effectiveUser?.id && String(c.id).replace(/^f_?/, '').toLowerCase() === String(effectiveUser.id).replace(/^f_?/, '').toLowerCase())
    )
    if (matchedColab) {
      if (matchedColab.id) {
        const raw = String(matchedColab.id).trim().toLowerCase()
        ids.add(raw)
        ids.add(raw.replace(/^f_?/, ''))
        ids.add(`f_${raw.replace(/^f_?/, '')}`)
      }
      if (matchedColab.uid_legacy) {
        ids.add(String(matchedColab.uid_legacy).trim().toLowerCase())
      }
      if (matchedColab.email) {
        ids.add(String(matchedColab.email).trim().toLowerCase())
      }
    }
    return ids
  }, [effectiveUser, colaboradores])

  const isColabInIds = React.useCallback((rawIds: any) => {
    if (!rawIds) return false
    let arr = rawIds
    if (typeof arr === 'string') {
      try { arr = JSON.parse(arr) } catch { arr = [arr] }
    }
    if (!Array.isArray(arr)) arr = [arr]
    return arr.some((id: any) => {
      const s = String(id || '').trim().toLowerCase()
      const clean = s.replace(/^f_?/, '')
      return candidateColabIds.has(s) || candidateColabIds.has(clean) || candidateColabIds.has(`f_${clean}`)
    })
  }, [candidateColabIds])

  const isEquipeEscolarGrupo = React.useCallback((g: any): boolean => {
    if (!g) return false
    if (
      g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1 ||
      g.dados?.isEquipeEscolar === true || g.dados?.isEquipeEscolar === 'true' || g.dados?.isEquipeEscolar === 1 ||
      g.ano === 'Equipe Escolar' || g.dados?.ano === 'Equipe Escolar'
    ) return true
    const n = String(g.nome || '').toLowerCase()
    return (
      n.includes('coordenação') || n.includes('coordenacao') || n.includes('direção') || n.includes('direcao') ||
      n.includes('secretaria') || n.includes('financeiro') || n.includes('inspetor') || n.includes('recepção') ||
      n.includes('recepcao') || n.includes('portaria') || n.includes('limpeza') || n.includes('equipe escolar') ||
      n.includes('equipe pedagógica') || n.includes('professores') || n.includes('docentes') || n.includes('colaboradores')
    )
  }, [])

  // Unifica todas as fontes de turmas da escola:
  // 1. Grupos ativos da Agenda Digital (onde turmas como NÍVEL 4 e NÍVEL 5 são geridas)
  // 2. Turmas acadêmicas cadastradas no ERP
  const allTurmaSources = React.useMemo(() => {
    const map = new Map<string, any>()
    const currentYearStr = new Date().getFullYear().toString()

    // 1. Grupos da Agenda Digital que representam turmas
    const digitalTurmaGroups = (gruposManuais || []).filter((g: any) => !isEquipeEscolarGrupo(g))
    digitalTurmaGroups.forEach((g: any) => {
      const syncId = g.syncId || (String(g.id).startsWith('sync-') ? g.id : '')
      const rawTurmaId = syncId ? syncId.replace(/^sync-/, '') : String(g.id)
      const matchedErp = (turmas || []).find((t: any) => 
        String(t.id) === rawTurmaId || 
        String(t.nome).trim().toLowerCase() === String(g.nome).trim().toLowerCase()
      )

      const ano = g.ano !== undefined && g.ano !== null && String(g.ano).trim() !== ''
        ? String(g.ano).trim()
        : (matchedErp?.ano ? String(matchedErp.ano) : (matchedErp?.anoLetivo || currentYearStr))

      const item = {
        id: String(g.id),
        rawId: rawTurmaId,
        grupoId: String(g.id),
        syncId: g.syncId,
        codigo: matchedErp?.codigo || g.codigo || rawTurmaId,
        nome: g.nome,
        ano: String(ano),
        anoLetivo: String(ano),
        serie: matchedErp?.serie || g.serie || '',
        turno: matchedErp?.turno || g.turno || '',
        cor: g.cor || matchedErp?.cor,
        alunosIds: g.alunosIds || [],
        colaboradoresIds: g.colaboradoresIds || [],
        professorId: matchedErp?.professorId || matchedErp?.dados?.professorId || g.professorId,
        professor: matchedErp?.professor || matchedErp?.dados?.professor || g.professor,
        disciplinas: matchedErp?.disciplinas || matchedErp?.dados?.disciplinas || [],
        raw: matchedErp || g
      }
      map.set(String(g.id), item)
      if (rawTurmaId && !map.has(rawTurmaId)) {
        map.set(rawTurmaId, item)
      }
    });

    // 2. Turmas do ERP
    (turmas || []).forEach((t: any) => {
      const tId = String(t.id)
      if (!map.has(tId)) {
        const ano = t.ano !== undefined && t.ano !== null && String(t.ano).trim() !== ''
          ? String(t.ano).trim()
          : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || currentYearStr)

        map.set(tId, {
          id: tId,
          rawId: tId,
          grupoId: `sync-${tId}`,
          syncId: `sync-${tId}`,
          codigo: t.codigo || tId,
          nome: t.nome,
          ano: String(ano),
          anoLetivo: String(ano),
          serie: t.serie || '',
          turno: t.turno || '',
          cor: t.cor,
          alunosIds: t.alunosIds || [],
          colaboradoresIds: t.colaboradoresIds || [],
          professorId: t.professorId || t.dados?.professorId,
          professor: t.professor || t.dados?.professor,
          disciplinas: t.disciplinas || t.dados?.disciplinas || [],
          raw: t
        })
      }
    })

    return Array.from(new Set(map.values()))
  }, [gruposManuais, turmas, isEquipeEscolarGrupo])

  // Identifica com precisão cirúrgica quais turmas o usuário atual pode acessar
  const accessibleTurmas = React.useMemo(() => {
    if (!effectiveUser?.id) return []

    // 1. Administrador / Gestão / Coordenação possui acesso total
    const isMaster = 
      effectiveUser.perfil === 'administrador' || 
      effectiveUser.perfil === 'admin' ||
      ['administrador', 'diretor', 'admin', 'coordenador', 'coordenadora', 'secretaria', 'secretário', 'secretária'].some(p => 
        String(effectiveUser.cargo || '').toLowerCase().includes(p) ||
        String(effectiveUser.perfil || '').toLowerCase().includes(p)
      )

    if (isMaster) return allTurmaSources

    // 2. Se allowedTurmasIds foi passado explicitamente
    const allowedSet = allowedTurmasIds && allowedTurmasIds.length > 0 
      ? new Set(allowedTurmasIds.map(String))
      : null

    // 3. Destinatários já selecionados previamente no comunicado
    const selectedTurmaIds = new Set(
      (selectedDest || [])
        .filter((d: any) => d.type === 'turma' || d.type === 'grupo' || String(d.id || '').startsWith('t_') || String(d.id || '').startsWith('g_'))
        .map((d: any) => String(d.id).replace(/^[tg]_?/, ''))
    )

    // 4. Grupos manuais aos quais o professor está associado
    const myGroups = (gruposManuais || []).filter((g: any) => isColabInIds(g.colaboradoresIds))
    const hasGlobal = myGroups.some((g: any) => 
      g.isGlobalAccess === true || g.isGlobalAccess === 'true' || g.isGlobalAccess === 1
    )
    if (hasGlobal) return allTurmaSources

    const myName = String(effectiveUser.nome || '').trim().toLowerCase()

    return allTurmaSources.filter((t: any) => {
      const tId = String(t.id)
      const rawId = String(t.rawId || '')
      const grupoId = String(t.grupoId || '')
      const syncId = String(t.syncId || '')
      const tNome = String(t.nome || '').trim().toLowerCase()

      // Se consta nas turmas permitidas da sessão
      if (allowedSet) {
        if (
          allowedSet.has(tId) || 
          (rawId && allowedSet.has(rawId)) || 
          (grupoId && allowedSet.has(grupoId)) || 
          (syncId && allowedSet.has(syncId)) ||
          allowedSet.has(`sync-${tId}`) ||
          allowedSet.has(`sync-${rawId}`)
        ) {
          return true
        }
      }

      // Se já estava selecionada como destinatário
      if (selectedTurmaIds.has(tId) || (rawId && selectedTurmaIds.has(rawId)) || (grupoId && selectedTurmaIds.has(grupoId))) {
        return true
      }

      // Vínculo no grupo da turma (colaboradoresIds)
      if (isColabInIds(t.colaboradoresIds)) return true

      // Vínculo direto como professor da turma
      const profId = String(t.professorId || '').trim().toLowerCase()
      if (profId && (candidateColabIds.has(profId) || candidateColabIds.has(profId.replace(/^f_?/, '')))) return true

      const profNome = String(t.professor || '').trim().toLowerCase()
      if (profNome && myName && (profNome === myName || candidateColabIds.has(profNome))) return true

      // Vínculo nas disciplinas da turma
      if (Array.isArray(t.disciplinas)) {
        const hasDisc = t.disciplinas.some((d: any) => {
          const dProfId = String(d.professorId || d.professor_id || d.funcionarioId || '').replace(/^f_?/, '').trim().toLowerCase()
          const dProfNome = String(d.professorNome || d.professor_nome || d.professor || '').trim().toLowerCase()
          return (dProfId && candidateColabIds.has(dProfId)) || (myName && dProfNome && dProfNome === myName)
        })
        if (hasDisc) return true
      }

      // Se algum grupo do professor bate com a turma (id, syncId ou nome)
      return myGroups.some((g: any) => 
        String(g.id) === tId || 
        String(g.id) === grupoId || 
        (rawId && String(g.syncId || g.id) === `sync-${rawId}`) ||
        String(g.nome || '').trim().toLowerCase() === tNome
      )
    })
  }, [allTurmaSources, effectiveUser, allowedTurmasIds, selectedDest, gruposManuais, isColabInIds, candidateColabIds])

  // Derive available years from students and accessible turmas
  const availableYears = React.useMemo(() => {
    const years = new Set<string>()
    const currentYear = new Date().getFullYear().toString()
    years.add(currentYear)

    accessibleTurmas.forEach((t: any) => {
      const year = String(t.ano || t.anoLetivo || t.dados?.anoLetivo || '').trim()
      if (year && year !== 'undefined' && year !== 'null' && year !== '') years.add(year)
    })

    alunos.forEach((a: any) => {
      const year = String(a.ano_letivo || a.anoLetivo || a.ano || '').trim()
      if (year && year !== 'undefined' && year !== 'null' && year !== '') years.add(year)
    })

    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [alunos, accessibleTurmas])

  // Derive available classes from accessible turmas and students for the selected year
  const availableTurmas = React.useMemo(() => {
    if (!filterYear) return []
    const currentYearStr = new Date().getFullYear().toString()
    const classMap = new Map<string, string>()

    accessibleTurmas.forEach((t: any) => {
      const tYear = String(t.ano || t.anoLetivo || t.dados?.anoLetivo || currentYearStr).trim()
      if (tYear === filterYear || filterYear === 'Todos' || !tYear) {
        classMap.set(String(t.id), t.nome || String(t.id))
      }
    })
    
    return Array.from(classMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [accessibleTurmas, filterYear])

  // Derived selected turma name
  const selectedTurmaName = React.useMemo(() => {
    return availableTurmas.find((t: any) => t.id === filterTurmaId)?.name || ''
  }, [availableTurmas, filterTurmaId])

  // Formata o item da turma de forma leve, compacta e sem redundâncias
  const formatTurmaDisplay = React.useCallback((rawName: string) => {
    const name = (rawName || '').trim()
    let main = name
    let badgeText = ''
    let badgeStyle = { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }

    if (name.includes(' - ')) {
      const parts = name.split(' - ')
      main = parts[0].trim()
      badgeText = parts.slice(1).join(' - ').trim()
    } else if (name.includes(' – ')) {
      const parts = name.split(' – ')
      main = parts[0].trim()
      badgeText = parts.slice(1).join(' – ').trim()
    }

    const bLower = (badgeText || name).toLowerCase()
    if (bLower.includes('matutino') || bLower.includes('manhã') || bLower.includes('manha')) {
      badgeStyle = { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
      if (!badgeText) badgeText = 'Matutino'
    } else if (bLower.includes('vespertino') || bLower.includes('tarde')) {
      badgeStyle = { bg: '#fdf4ff', color: '#9333ea', border: '#f0abfc' }
      if (!badgeText) badgeText = 'Vespertino'
    } else if (bLower.includes('integral') || bLower.includes('intermediário') || bLower.includes('intermediario')) {
      badgeStyle = { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
      if (!badgeText) badgeText = 'Integral'
    } else if (bLower.includes('médio') || bLower.includes('medio')) {
      badgeStyle = { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
    }

    return { main, badgeText, badgeStyle }
  }, [])

  // Initialization when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setSelectedTemplate(allTemplates[0] || null)
      setSearchStudent('')
      const currentYearStr = new Date().getFullYear().toString()
      const initialYear = availableYears.includes(currentYearStr)
        ? currentYearStr
        : (availableYears[0] || '')
      setFilterYear(initialYear)
      setFilterTurmaId('')
      setShowTurmaModal(false)
      setShowYearDropdown(false)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, availableYears])

  // Resolver alunos vinculados a uma turma usando as regras completas da escola
  const resolveTurmaAlunos = React.useCallback((selectedTurma: any, year: string) => {
    if (!selectedTurma) return []
    const tIdStr = String(selectedTurma.id || selectedTurma.rawId || '')
    const tAno = selectedTurma.ano !== undefined && selectedTurma.ano !== null && String(selectedTurma.ano).trim() !== ''
      ? String(selectedTurma.ano)
      : (selectedTurma.anoLetivo || selectedTurma.ano_letivo || selectedTurma.dados?.anoLetivo || year || String(new Date().getFullYear()))

    // Alunos diretos do objeto da turma (ex: grupo da Agenda Digital que tem alunosIds)
    let directAlunosIds: string[] = []
    let tAlunos = selectedTurma.alunosIds || selectedTurma.dados?.alunosIds || []
    if (typeof tAlunos === 'string') {
      try { tAlunos = JSON.parse(tAlunos) } catch { tAlunos = [] }
    }
    if (Array.isArray(tAlunos)) directAlunosIds = tAlunos.map(String)

    // 1. Procura grupo espelhado em agenda/grupos (sync-{id}, id ou mesmo nome)
    const syncGroup = (gruposManuais || []).find((g: any) => {
      const gSync = g.syncId || (String(g.id).startsWith('sync-') ? g.id : '')
      return (
        gSync === `sync-${tIdStr}` || 
        g.id === `sync-${tIdStr}` || 
        g.id === tIdStr ||
        (g.nome && String(g.nome).trim().toLowerCase() === String(selectedTurma.nome || '').trim().toLowerCase())
      )
    })

    let extraAlunosIds: string[] = []
    if (syncGroup) {
      let aIds = syncGroup.alunosIds || syncGroup.dados?.alunosIds || []
      if (typeof aIds === 'string') {
        try { aIds = JSON.parse(aIds) } catch { aIds = [] }
      }
      if (Array.isArray(aIds)) extraAlunosIds = aIds.map(String)
    }

    const tIdLower = tIdStr.toLowerCase()
    const tNomeLower = String(selectedTurma.nome || '').trim().toLowerCase()
    const tCodLower = String(selectedTurma.codigo || '').trim().toLowerCase()

    return (alunos || []).filter((a: any) => {
      const aIdStr = String(a.id)

      // Se constar nos alunos vinculados diretos do grupo ou do grupo espelhado
      if (directAlunosIds.includes(aIdStr) || extraAlunosIds.includes(aIdStr)) return true

      // Regra oficial de matricula cursando (inclui Dual-Enrollment de Integral/Intermediário!)
      if (isAlunoCursandoTurma(a, selectedTurma, tAno, turmas)) return true

      // Vínculos diretos nas propriedades do aluno
      const directTurma = String(a.turma || '').trim().toLowerCase()
      const directTurmaId = String((a as any).turmaId || '').trim().toLowerCase()
      if (directTurma && (directTurma === tIdLower || directTurma === tNomeLower || (tCodLower && directTurma === tCodLower))) return true
      if (directTurmaId && (directTurmaId === tIdLower || directTurmaId === tNomeLower || (tCodLower && directTurmaId === tCodLower))) return true

      // Histórico de turmas
      const hist = a.historicoTurmas || a.dados?.historicoTurmas
      if (Array.isArray(hist)) {
        const matchesHist = hist.some((h: any) => {
          if (!h || h.status === 'Inativo') return false
          const hYear = String(h.anoLetivo || h.ano || '').trim()
          if (tAno && hYear && hYear !== tAno) return false
          const hTurma = String(h.serieTurma || h.turma || h.nome || '').trim().toLowerCase()
          return hTurma === tIdLower || hTurma === tNomeLower || (tCodLower && hTurma === tCodLower)
        })
        if (matchesHist) return true
      }

      return false
    })
  }, [alunos, gruposManuais, turmas])

  // Resolve targeted students when dependencies or filters change
  useEffect(() => {
    if (isOpen) {
      let resolved: any[] = []
      if (!selectedDest || selectedDest.length === 0) {
        resolved = (alunos || []).filter(a => {
           const aYear = String(a.ano_letivo || a.anoLetivo || a.ano || '')
           if (filterYear !== '' && filterYear !== 'Todos' && aYear !== filterYear && aYear !== '') return false;
           return true;
        })
      } else {
        const directStudentIds = new Set<string>()
        const targetedClasses = new Set<string>()
        
        selectedDest.forEach(d => {
          if (d.type === 'aluno' || d.id.startsWith('a_')) {
            directStudentIds.add(d.id.replace(/^a_?/, ''))
          } else if (d.type === 'turma') {
            targetedClasses.add(d.id.replace(/^t_?/, '').toLowerCase())
          } else if (d.type === 'grupo' || d.id.startsWith('g_')) {
            const gId = d.id.replace(/^g_?/, '')
            const groupObj = (gruposManuais || []).find(g => String(g.id) === String(gId))
            if (groupObj && groupObj.alunosIds) {
              let gAids = groupObj.alunosIds;
              if (typeof gAids === 'string') {
                try { gAids = JSON.parse(gAids); } catch(e) { gAids = []; }
              }
              if (Array.isArray(gAids)) {
                gAids.forEach((sId: any) => {
                  directStudentIds.add(String(sId))
                })
              }
            }
          }
        })
        const validTurmaRefs = new Set<string>();
        targetedClasses.forEach(tc => {
           validTurmaRefs.add(tc);
           const tObj = turmas.find((t: any) => String(t.id).toLowerCase() === tc || String(t.codigo).toLowerCase() === tc || String(t.nome).trim().toLowerCase() === tc);
           if (tObj) {
              if (tObj.id) validTurmaRefs.add(String(tObj.id).toLowerCase());
              if (tObj.codigo) validTurmaRefs.add(String(tObj.codigo).toLowerCase());
              if (tObj.nome) validTurmaRefs.add(String(tObj.nome).trim().toLowerCase());
           }
        });

        resolved = (alunos || []).filter(a => {
           if (directStudentIds.has(String(a.id))) return true;
           for (const tc of Array.from(targetedClasses)) {
             const tObj = turmas.find((t: any) => String(t.id).toLowerCase() === tc || String(t.codigo).toLowerCase() === tc || String(t.nome).trim().toLowerCase() === tc)
             if (tObj && isAlunoCursandoTurma(a, tObj, tObj.ano || filterYear, turmas)) return true
           }
           const tRefLower = String(a.turma || '').trim().toLowerCase();
           const tIdLower = String((a as any).turmaId || '').trim().toLowerCase();
           return validTurmaRefs.has(tRefLower) || validTurmaRefs.has(tIdLower);
        })
      }

      if (filterTurmaId && filterTurmaId !== 'all') {
        const filterLower = filterTurmaId.trim().toLowerCase();
        const selectedTurma = accessibleTurmas.find((t: any) => 
          String(t.id).toLowerCase() === filterLower || 
          String(t.rawId || '').toLowerCase() === filterLower ||
          String(t.codigo || '').toLowerCase() === filterLower || 
          String(t.nome).trim().toLowerCase() === filterLower
        ) || (turmas || []).find((t: any) => 
          String(t.id).toLowerCase() === filterLower || 
          String(t.codigo).toLowerCase() === filterLower || 
          String(t.nome).trim().toLowerCase() === filterLower
        ) || (gruposManuais || []).find((g: any) => 
          String(g.id).toLowerCase() === filterLower || 
          String(g.syncId || '').toLowerCase() === filterLower ||
          String(g.nome).trim().toLowerCase() === filterLower
        );
        
        resolved = resolveTurmaAlunos(selectedTurma, filterYear)
      } else if (propTargetedStudents && propTargetedStudents.length > 0) {
        resolved = propTargetedStudents
      } else if (selectedDest && selectedDest.length > 0) {
        // Se nenhuma turma foi selecionada no modal, mas temos destinatários, 
        // a lista já está filtrada em `resolved`. Não fazemos nada.
      } else {
        // Se ainda não selecionou a turma e não há destinatários prévios, exibimos 0 alunos
        resolved = []
      }

      setTargetedStudents(resolved)
    }
  }, [isOpen, selectedDest, propTargetedStudents, alunos, turmas, gruposManuais, filterYear, filterTurmaId, accessibleTurmas, availableTurmas, resolveTurmaAlunos])

  // Set default date when going to step 2
  useEffect(() => {
    if (step === 2) {
      if (!dataReferencia) setDataReferencia(new Date().toISOString().split('T')[0])
    }
  }, [step, dataReferencia])

  // if (!isOpen) return null

  const allFields = selectedTemplate ? selectedTemplate.sections.flatMap(s => s.fields) : []

  // We don't need getFieldCompletionCount anymore

  const handleFillDirectly = () => {
    if (!selectedTemplate) return
    
    const payload = {
      type: 'report-assignment',
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      turmaId: filterTurmaId,
      turmaName: availableTurmas.find((t: any) => t.id === filterTurmaId)?.name || 'Turma selecionada',
      dataReferencia: new Date().toISOString().split('T')[0],
      studentCount: targetedStudents.length,
      studentIds: targetedStudents.map(st => st.id)
    }

    if (onFillDirectly) {
      onFillDirectly(payload)
    } else {
      // Fallback para manter retrocompatibilidade com onAdd (anexar tarefa)
      onAdd(`Tarefa de Relatório: ${selectedTemplate.name}`, payload)
      onClose()
    }
  }
    


  const filteredStudents = targetedStudents.filter(st => 
    st.nome?.toLowerCase().includes(searchStudent.toLowerCase())
  )

  const renderIcon = (t: ReportTemplate, size = 18) => {
    const isEmoji = t.icon && /\p{Emoji}/u.test(t.icon) && t.icon.length <= 4
    if (isEmoji) return <span style={{ fontSize: size }}>{t.icon}</span>

    const ICON_MAP: any = { FileText, FileBarChart, FileCheck, ClipboardList, BookOpen, GraduationCap, Calendar, Users, MessageSquare, Layout }
    const IconComp = ICON_MAP[t.icon] || FileBarChart
    return <IconComp size={size} />
  }

  const isReadyToFill = Boolean(selectedTemplate && filterYear !== '' && filterTurmaId !== '' && targetedStudents.length > 0)

  return (
    <AnimatePresence>
      {isOpen && (
      <div className="ad-reports-modal-overlay">
        <style>{`
          .ad-reports-modal-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 9999999 !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            padding: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }
          .ad-reports-modal-card {
            background: #f8fafc !important;
            width: 100vw !important;
            height: 100dvh !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            margin: 0 !important;
            flex: 1 !important;
          }
          .ad-reports-header-box {
            background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 52%, #4f46e5 100%) !important;
            padding: 18px 24px !important;
            padding-top: max(18px, env(safe-area-inset-top)) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: relative !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
            z-index: 10 !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
            width: 100% !important;
          }
          .ad-reports-header-inner {
            max-width: 760px;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
            z-index: 1;
          }
          .ad-reports-content-body {
            padding: 24px 20px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            overflow-y: auto !important;
            flex: 1 !important;
            background: #f8fafc !important;
            width: 100% !important;
          }
          .ad-reports-body-inner {
            max-width: 760px;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .ad-reports-list::-webkit-scrollbar {
            width: 5px;
          }
          .ad-reports-list::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .ad-reports-list::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .ad-reports-list::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          .ad-turma-picker-list::-webkit-scrollbar {
            width: 5px;
          }
          .ad-turma-picker-list::-webkit-scrollbar-track {
            background: #f8fafc;
            border-radius: 4px;
          }
          .ad-turma-picker-list::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .ad-turma-picker-list::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          .ad-reports-footer {
            padding: 16px 24px !important;
            padding-bottom: max(16px, env(safe-area-inset-bottom)) !important;
            border-top: 1px solid #e2e8f0 !important;
            background: #ffffff !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            flex-shrink: 0 !important;
            z-index: 10 !important;
            box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04) !important;
            width: 100% !important;
          }
          .ad-reports-footer-inner {
            max-width: 760px;
            width: 100%;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            align-items: center;
          }
          @media (max-width: 480px) {
            .ad-reports-header-box {
              padding: 14px 16px !important;
              padding-top: max(14px, env(safe-area-inset-top)) !important;
            }
            .ad-reports-content-body {
              padding: 18px 16px !important;
            }
            .ad-reports-footer {
              padding: 12px 16px !important;
              padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
            }
            .ad-reports-footer-inner {
              display: flex !important;
              gap: 10px !important;
            }
            .ad-reports-footer-inner button {
              flex: 1 !important;
              justify-content: center !important;
              padding: 13px 14px !important;
            }
          }
        `}</style>
        
        <motion.div 
          className="ad-reports-modal-card ad-reports-step1"
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Header com Gradiente Ultra Moderno */}
          <div className="ad-reports-header-box">
            {/* Efeito sutil de luz/brilho no fundo */}
            <div style={{
              position: 'absolute',
              right: -25,
              top: -35,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)',
              pointerEvents: 'none',
            }} />
            
            <div className="ad-reports-header-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.16)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  flexShrink: 0
                }}>
                  <FileBarChart size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 19, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.25 }}>
                    Preencher Relatório
                  </h3>
                  <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', margin: '4px 0 0 0', fontWeight: 500 }}>
                    Selecione a turma e o modelo para iniciar
                  </p>
                </div>
              </div>

              <button 
                onClick={onClose}
                aria-label="Fechar modal"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.14)',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.26)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Conteúdo Principal do Modal */}
          <div className="ad-reports-content-body">
            <div className="ad-reports-body-inner">
              {/* Seção 1: Filtro de Turma e Ano */}
              <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GraduationCap size={15} style={{ color: '#2563eb' }} />
                    Filtro de Turma
                  </span>
                  {filterTurmaId && targetedStudents.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 10 }}>
                      {targetedStudents.length} {targetedStudents.length === 1 ? 'aluno' : 'alunos'}
                    </span>
                  )}
                </div>

                {isLoadingData ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 110, height: 44, borderRadius: 14, background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
                    <div style={{ flex: 1, height: 44, borderRadius: 14, background: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Seletor Ano - Custom Flex Button com Dropdown Popover */}
                    <div style={{ position: 'relative', width: 110, flexShrink: 0 }}>
                      <button 
                        type="button"
                        onClick={() => setShowYearDropdown(prev => !prev)}
                        style={{ 
                          width: '100%', 
                          height: 44, 
                          borderRadius: 14, 
                          border: filterYear ? '1.5px solid #93c5fd' : '1.5px solid #e2e8f0', 
                          padding: '0 10px', 
                          fontSize: 13.5, 
                          fontWeight: 700, 
                          background: filterYear ? '#eff6ff' : '#ffffff', 
                          color: '#1e293b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <Calendar size={15} style={{ color: filterYear ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{filterYear || 'Ano'}</span>
                        </div>
                        <ChevronDown size={14} style={{ color: '#94a3b8', flexShrink: 0, transform: showYearDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>

                      {/* Year Dropdown Popover */}
                      <AnimatePresence>
                        {showYearDropdown && (
                          <>
                            <div 
                              onClick={() => setShowYearDropdown(false)} 
                              style={{ position: 'fixed', inset: 0, zIndex: 999999 }} 
                            />
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              style={{
                                position: 'absolute',
                                top: 48,
                                left: 0,
                                width: 120,
                                background: '#ffffff',
                                borderRadius: 14,
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                                zIndex: 1000000,
                                overflow: 'hidden',
                                padding: 4
                              }}
                            >
                              {availableYears.map(y => (
                                <div
                                  key={y}
                                  onClick={() => {
                                    setFilterYear(y)
                                    setFilterTurmaId('')
                                    setShowYearDropdown(false)
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: y === filterYear ? 800 : 600,
                                    color: y === filterYear ? '#2563eb' : '#334155',
                                    background: y === filterYear ? '#eff6ff' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseEnter={e => {
                                    if (y !== filterYear) e.currentTarget.style.background = '#f8fafc'
                                  }}
                                  onMouseLeave={e => {
                                    if (y !== filterYear) e.currentTarget.style.background = 'transparent'
                                  }}
                                >
                                  <span>{y}</span>
                                  {y === filterYear && <Check size={14} style={{ color: '#2563eb' }} />}
                                </div>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Seleção de Turma Ultra Moderna - Trigger Button */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button 
                        type="button"
                        onClick={() => setShowTurmaModal(true)}
                        style={{ 
                          width: '100%', 
                          height: 44, 
                          borderRadius: 14, 
                          border: filterTurmaId ? '1.5px solid #93c5fd' : '1.5px solid #e2e8f0', 
                          padding: '0 14px', 
                          fontSize: 13.5, 
                          fontWeight: 700, 
                          background: filterTurmaId ? '#eff6ff' : '#ffffff', 
                          color: '#1e293b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <Users size={16} style={{ color: filterTurmaId ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
                          <span style={{ 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            color: selectedTurmaName ? '#1e293b' : '#94a3b8',
                            fontWeight: selectedTurmaName ? 700 : 500
                          }}>
                            {selectedTurmaName || 'Selecione a Turma'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ 
                            fontSize: 10.5, 
                            fontWeight: 700, 
                            color: filterTurmaId ? '#2563eb' : '#64748b', 
                            background: filterTurmaId ? '#dbeafe' : '#f1f5f9', 
                            padding: '2px 7px', 
                            borderRadius: 6 
                          }}>
                            {filterTurmaId ? 'Trocar' : 'Escolher'}
                          </span>
                          <ChevronDown size={14} style={{ color: '#94a3b8' }} />
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Status e Feedback de Alunos */}
                {filterTurmaId && (
                  <div style={{ marginTop: 2 }}>
                    {isLoadingData ? (
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Carregando alunos da turma...</div>
                    ) : targetedStudents.length > 0 ? (
                      <div style={{ 
                        fontSize: 12, 
                        fontWeight: 600, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        color: '#059669', 
                        background: '#ecfdf5', 
                        border: '1px solid #d1fae5', 
                        padding: '7px 12px', 
                        borderRadius: 11 
                      }}>
                        <Check size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span>{targetedStudents.length} aluno{targetedStudents.length > 1 ? 's' : ''} participante{targetedStudents.length > 1 ? 's' : ''} vinculado{targetedStudents.length > 1 ? 's' : ''} a esta turma</span>
                      </div>
                    ) : (
                      <div style={{ 
                        fontSize: 12, 
                        fontWeight: 600, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        color: '#d97706', 
                        background: '#fffbeb', 
                        border: '1px solid #fef3c7', 
                        padding: '7px 12px', 
                        borderRadius: 11 
                      }}>
                        <span>⚠️ Nenhum aluno encontrado nesta turma para o ano {filterYear || 'selecionado'}.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seção 2: Escolha do Modelo de Relatório */}
              <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={15} style={{ color: '#2563eb' }} />
                    Escolha o Relatório
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                    {allTemplates.length} disponíveis
                  </span>
                </div>

                {/* Lista de Cards Compactos e Ultra Modernos */}
                <div className="ad-reports-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {isLoadingData ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ height: 12, width: '50%', background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                          <div style={{ height: 10, width: '30%', background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    allTemplates.map(t => {
                      const isSelected = selectedTemplate?.id === t.id
                      return (
                        <div 
                          key={t.id}
                          onClick={() => setSelectedTemplate(t)}
                          style={{
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 10, 
                            padding: '8px 12px', 
                            borderRadius: 12,
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                            cursor: 'pointer', 
                            transition: 'all 0.15s ease', 
                            boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
                            minHeight: 44
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#cbd5e1'
                              e.currentTarget.style.background = '#f8fafc'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#e2e8f0'
                              e.currentTarget.style.background = '#ffffff'
                            }
                          }}
                        >
                          {/* Ícone Compacto */}
                          <div style={{ 
                            width: 32, 
                            height: 32, 
                            borderRadius: 8, 
                            background: (t.color || '#2563eb') + '15', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: t.color || '#2563eb', 
                            flexShrink: 0 
                          }}>
                            {renderIcon(t, 16)}
                          </div>

                          {/* Título e Categoria */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontSize: 13, 
                              fontWeight: isSelected ? 800 : 700, 
                              color: isSelected ? '#1d4ed8' : '#1e293b', 
                              lineHeight: 1.25,
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis' 
                            }}>
                              {t.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ 
                                fontSize: 9.5, 
                                fontWeight: 700, 
                                color: '#475569', 
                                background: '#f1f5f9', 
                                padding: '1px 5px', 
                                borderRadius: 4 
                              }}>
                                {t.category || 'Geral'}
                              </span>
                              {t.description && (
                                <span style={{ 
                                  fontSize: 11, 
                                  color: '#64748b', 
                                  fontWeight: 500,
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis' 
                                }}>
                                  {t.description}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Indicador de Seleção com Checkmark */}
                          <div style={{ 
                            width: 20, 
                            height: 20, 
                            borderRadius: '50%', 
                            border: isSelected ? 'none' : '1.5px solid #cbd5e1', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            background: isSelected ? '#3b82f6' : '#ffffff', 
                            flexShrink: 0,
                            transition: 'all 0.15s ease'
                          }}>
                            {isSelected && (
                              <Check size={12} strokeWidth={3} style={{ color: '#ffffff' }} />
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé de Ações */}
          <div className="ad-reports-footer">
            <div className="ad-reports-footer-inner">
              <button 
                type="button"
                onClick={onClose} 
                style={{ 
                  padding: '11px 22px', 
                  borderRadius: 14, 
                  border: '1px solid #e2e8f0', 
                  background: '#ffffff', 
                  color: '#64748b', 
                  fontSize: 14, 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleFillDirectly}
                disabled={!isReadyToFill}
                title={
                  !selectedTemplate ? 'Selecione um relatório' :
                  !filterYear ? 'Selecione o ano' :
                  !filterTurmaId ? 'Selecione a turma' :
                  targetedStudents.length === 0 ? 'Nenhum aluno encontrado para esta turma' :
                  'Clique para preencher o relatório'
                }
                style={{ 
                  padding: '11px 26px', 
                  borderRadius: 14, 
                  border: 'none', 
                  background: isReadyToFill ? 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' : '#e2e8f0', 
                  color: isReadyToFill ? '#ffffff' : '#94a3b8', 
                  fontSize: 14, 
                  fontWeight: 700, 
                  cursor: isReadyToFill ? 'pointer' : 'not-allowed',
                  boxShadow: isReadyToFill ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                <span>Preencher Relatório</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Modal de Seleção de Turma Ultra Moderno e Compacto */}
        <AnimatePresence>
          {showTurmaModal && (
            <div 
              className="ad-turma-picker-overlay"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000005,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16
              }}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 15 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{
                  width: '100%',
                  maxWidth: 500,
                  background: '#ffffff',
                  borderRadius: 20,
                  maxHeight: '82dvh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                {/* Header do Seletor */}
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#ffffff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                        Selecionar Turma
                      </h4>
                      <p style={{ fontSize: 11.5, color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                        {availableTurmas.length} turmas disponíveis em {filterYear || 'ano selecionado'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTurmaModal(false)}
                    aria-label="Fechar"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: '#f1f5f9',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Lista de Turmas em Cards Compactos, Leves e Organizados */}
                <div 
                  className="ad-turma-picker-list"
                  style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '10px 14px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 6 
                  }}
                >
                  {availableTurmas.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Users size={28} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>Nenhuma turma encontrada</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Não há turmas disponíveis para o ano {filterYear || 'selecionado'}.</div>
                    </div>
                  ) : (
                    availableTurmas.map((t: { id: string, name: string }) => {
                      const isSelected = filterTurmaId === t.id
                      const { main, badgeText, badgeStyle } = formatTurmaDisplay(t.name)
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setFilterTurmaId(t.id)
                            setShowTurmaModal(false)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            borderRadius: 12,
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
                            minHeight: 40
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#cbd5e1'
                              e.currentTarget.style.background = '#f8fafc'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#e2e8f0'
                              e.currentTarget.style.background = '#ffffff'
                            }
                          }}
                        >
                          {/* Ícone Compacto */}
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: isSelected ? '#dbeafe' : '#f1f5f9',
                            color: isSelected ? '#2563eb' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Users size={14} />
                          </div>

                          {/* Nome e Badge Alinhados em Linha Única */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                            <span style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 800 : 700,
                              color: isSelected ? '#1d4ed8' : '#1e293b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {main}
                            </span>
                            {badgeText && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                background: badgeStyle.bg,
                                color: badgeStyle.color,
                                border: `1px solid ${badgeStyle.border}`,
                                padding: '1px 6px',
                                borderRadius: 6,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                letterSpacing: '0.02em'
                              }}>
                                {badgeText}
                              </span>
                            )}
                          </div>

                          {/* Checkmark Indicador */}
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: isSelected ? '#3b82f6' : '#ffffff',
                            border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.15s'
                          }}>
                            {isSelected && <Check size={12} strokeWidth={3} style={{ color: '#ffffff' }} />}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      )}
    </AnimatePresence>
  )
}
