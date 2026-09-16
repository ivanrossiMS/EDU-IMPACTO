'use client'

/**
 * AgendaRealtimeProvider.tsx
 * 
 * Provedor central de notificações em tempo real para a Agenda Digital.
 * 
 * Responsabilidades:
 * 1. Inicializar o OneSignal v16 (web push) ou cordova-plugin (nativo)
 * 2. Identificar o usuário logado no OneSignal via External User ID
 * 3. Atribuir tags de segmentação (perfil, turma, aluno_id, escola_id)
 * 4. Escutar eventos Supabase Realtime e exibir toast notifications in-app
 * 5. Deep linking: clique na notificação abre a página correta
 * 
 * SEGURANÇA:
 * - A REST API Key do OneSignal NUNCA é usada aqui (apenas App ID público)
 * - Usuário não autenticado não recebe dados sensíveis
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Script from 'next/script'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { Calendar, FileText, Image as ImageIcon, ShieldAlert, Megaphone, BarChart2, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { ReportPayloadView } from '@/components/DynamicReports/ReportPayloadView'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { toast, Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { notificationService } from '@/lib/notifications/notificationService'
import { useData } from '@/lib/dataContext'
import { useAgendaNotifications } from '../hooks/useAgendaNotifications'
import { PushPermissionBanner } from '@/components/agenda/PushPermissionBanner'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'

interface RealtimeProviderProps {
  children?: React.ReactNode
}

declare global {
  interface Window {
    OneSignalDeferred?: any[]
    OneSignal?: any
    /** Flag para evitar dupla inicialização do OneSignal (React Strict Mode) */
    __OS_INIT__?: boolean
    /** Flag para evitar duplo login do OneSignal */
    __OS_USER_ID__?: string
  }
}

export function AgendaRealtimeProvider({ children }: RealtimeProviderProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const params = useParams<{ slug: string }>()
  const pathname = usePathname()
  const { currentUser, currentUserPerfil } = useApp()
  const osInitialized = useRef(false)

  const isFamily =
    currentUser?.perfil === 'Família' ||
    currentUser?.perfil === 'Responsável' ||
    currentUser?.cargo === 'Aluno' ||
    currentUser?.cargo === 'Responsável'

  const responsavelId = currentUser?.id ? String(currentUser.id) : null
  const alunoId = params?.slug ? String(params.slug) : null

  // ── Contextos opcionais — chamados incondicionalmente (Rules of Hooks) ────
  // Usar valores padrão seguros quando o provider não existe na árvore.
  const selectedStudentCtx = useSelectedStudent();
  const agendaCtxRaw = useAgendaDigital();
  const dataCtxRaw = useData();

  // Os hooks acima agora seguem as Rules of Hooks.
  // Os valores capturados são usados de forma reativa sem precisar de ref hacks.
  const alunoObj = selectedStudentCtx?.aluno ?? null
  const turmasArray = dataCtxRaw?.turmas ?? []
  const agendaCtx   = agendaCtxRaw

  const rawTurma = alunoObj?.turma
  const resolvedTurmaObj = turmasArray.find(
    t => t && (String(t.id) === String(rawTurma) || String(t.codigo) === String(rawTurma))
  )
  const turmaNome = resolvedTurmaObj?.nome || rawTurma

  const alunoIdRef = useRef(alunoId)
  useEffect(() => {
    alunoIdRef.current = alunoId
  }, [alunoId])

  const [meusAlunos, setMeusAlunos] = useState<any[]>([])

  useEffect(() => {
    if (!currentUser?.id) return

    const respMetaId = (currentUser as any)?.responsavel_id || (currentUser as any)?.user_metadata?.responsavel_id || ''
    const userEmail = (currentUser?.email || '').toLowerCase().trim()
    const possibleKeys = [
      `edu-meus-alunos-${currentUser.id}`,
      `edu-meus-alunos-${respMetaId || userEmail}`,
      `edu-meus-alunos-${userEmail}`
    ]

    for (const key of possibleKeys) {
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          const parsed = JSON.parse(cached)
          const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : null)
          if (list && list.length > 0) {
            setMeusAlunos(list)
            break
          }
        }
      } catch (_) {}
    }

    fetch('/api/agenda/meus-alunos', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setMeusAlunos(data)
          possibleKeys.forEach(k => {
            try {
              localStorage.setItem(k, JSON.stringify(data))
              localStorage.setItem(`${k}-meta`, JSON.stringify({ data, ts: Date.now() }))
            } catch (_) {}
          })
        }
      })
      .catch(() => {})
  }, [currentUser?.id, (currentUser as any)?.responsavel_id, currentUser?.email])

  const [extraStaffIds, setExtraStaffIds] = useState<string[]>([])

  useEffect(() => {
    if (!currentUser?.id) return
    const known = currentUser?.colaborador_id || currentUser?.system_user_id || currentUser?.user_metadata?.colaborador_id || (currentUser as any)?.colaboradorId
    if (known) {
      setExtraStaffIds([String(known).replace(/^f_?/, '').trim().toLowerCase()])
      return
    }

    // Busca da sessão do Supabase Auth caso o localStorage não tenha hidratado com colaborador_id
    supabase.auth.getUser().then((res: any) => {
      const meta = res?.data?.user?.user_metadata
      const cId = meta?.colaborador_id || meta?.system_user_id || meta?.colaboradorId
      if (cId) {
        setExtraStaffIds([String(cId).replace(/^f_?/, '').trim().toLowerCase()])
      }
    }).catch(() => {})
  }, [currentUser?.id, currentUser?.colaborador_id, currentUser?.system_user_id])

  const isStaffUser = Boolean(
    currentUser?.colaborador_id ||
    currentUser?.system_user_id ||
    currentUser?.user_metadata?.colaborador_id ||
    extraStaffIds.length > 0 ||
    (currentUser?.perfil &&
      !['Família', 'Responsável', 'Aluno'].includes(currentUser.perfil) &&
      !['Responsável', 'Aluno'].includes(currentUser?.cargo || ''))
  )

  const hasFamilyAccess = isFamily || meusAlunos.length > 0 || !!currentUser?.responsavel_id || currentUser?.cargo === 'Aluno'
  const hasDualAccess = isStaffUser && hasFamilyAccess

  const isMasterAdmin = useMemo(() => {
    if (!currentUser && !currentUserPerfil) return false
    const p = String(currentUser?.perfil || currentUserPerfil || currentUser?.user_metadata?.perfil || '').toLowerCase().trim()
    const c = String(currentUser?.cargo || currentUser?.user_metadata?.cargo || '').toLowerCase().trim()
    const masterRoles = [
      'administrador master',
      'administrador',
      'admin',
      'diretor geral',
      'diretora geral',
      'master'
    ]
    return masterRoles.includes(p) || masterRoles.includes(c)
  }, [currentUser, currentUserPerfil])

  const isColaboradorAccess = useMemo(() => {
    if (pathname?.includes('/agenda-digital/colaborador')) return true
    if (isStaffUser && !isMasterAdmin) return true
    return false
  }, [pathname, isStaffUser, isMasterAdmin])

  const myCandidateStaffIds = useMemo(() => {
    const ids = new Set<string>()
    if (currentUser?.id) ids.add(String(currentUser.id).replace(/^f_?/, '').trim().toLowerCase())
    if ((currentUser as any)?.uid_legacy) ids.add(String((currentUser as any).uid_legacy).replace(/^f_?/, '').trim().toLowerCase())
    if ((currentUser as any)?.id_legado) ids.add(String((currentUser as any).id_legado).replace(/^f_?/, '').trim().toLowerCase())
    if (currentUser?.colaborador_id) ids.add(String(currentUser.colaborador_id).replace(/^f_?/, '').trim().toLowerCase())
    if (currentUser?.system_user_id) ids.add(String(currentUser.system_user_id).replace(/^f_?/, '').trim().toLowerCase())
    if (currentUser?.user_metadata?.colaborador_id) ids.add(String(currentUser.user_metadata.colaborador_id).replace(/^f_?/, '').trim().toLowerCase())
    if (currentUser?.user_metadata?.system_user_id) ids.add(String(currentUser.user_metadata.system_user_id).replace(/^f_?/, '').trim().toLowerCase())
    if (currentUser?.email) ids.add(String(currentUser.email).trim().toLowerCase())
    extraStaffIds.forEach(id => ids.add(String(id).replace(/^f_?/, '').trim().toLowerCase()))
    return Array.from(ids)
  }, [currentUser, extraStaffIds])

  const myStaffGroupNamesAndIds = useMemo(() => {
    if (!agendaCtx?.chatGroups || !Array.isArray(agendaCtx.chatGroups)) return []
    const results: string[] = []
    agendaCtx.chatGroups.forEach((g: any) => {
      let colabs = g.colaboradoresIds
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs) } catch { colabs = [] }
      }
      if (!Array.isArray(colabs)) colabs = []
      const belongs = colabs.some((cid: any) => {
        const clean = String(cid).replace(/^f_?/, '').trim().toLowerCase()
        return myCandidateStaffIds.includes(clean)
      })
      if (belongs) {
        if (g.nome) results.push(String(g.nome).trim().toLowerCase())
        if (g.id) results.push(String(g.id).trim().toLowerCase())
      }
    })
    return results
  }, [agendaCtx?.chatGroups, myCandidateStaffIds])

  const currentUserRef = useRef(currentUser)
  useEffect(() => { currentUserRef.current = currentUser }, [currentUser])

  const meusAlunosRef = useRef(meusAlunos)
  useEffect(() => { meusAlunosRef.current = meusAlunos }, [meusAlunos])

  const turmasArrayRef = useRef(turmasArray)
  useEffect(() => { turmasArrayRef.current = turmasArray }, [turmasArray])

  const myCandidateStaffIdsRef = useRef(myCandidateStaffIds)
  useEffect(() => { myCandidateStaffIdsRef.current = myCandidateStaffIds }, [myCandidateStaffIds])

  const myStaffGroupNamesAndIdsRef = useRef(myStaffGroupNamesAndIds)
  useEffect(() => { myStaffGroupNamesAndIdsRef.current = myStaffGroupNamesAndIds }, [myStaffGroupNamesAndIds])

  const isStaffUserRef = useRef(isStaffUser)
  useEffect(() => { isStaffUserRef.current = isStaffUser }, [isStaffUser])

  const isMasterAdminRef = useRef(isMasterAdmin)
  useEffect(() => { isMasterAdminRef.current = isMasterAdmin }, [isMasterAdmin])

  const isColaboradorAccessRef = useRef(isColaboradorAccess)
  useEffect(() => { isColaboradorAccessRef.current = isColaboradorAccess }, [isColaboradorAccess])

  const hasDualAccessRef = useRef(hasDualAccess)
  useEffect(() => { hasDualAccessRef.current = hasDualAccess }, [hasDualAccess])

  const isFamilyRef = useRef(isFamily)
  useEffect(() => { isFamilyRef.current = isFamily }, [isFamily])

  const alunoObjRef = useRef(alunoObj)
  useEffect(() => { alunoObjRef.current = alunoObj }, [alunoObj])

  const turmaNomeRef = useRef(turmaNome)
  useEffect(() => { turmaNomeRef.current = turmaNome }, [turmaNome])

  const rawTurmaRef = useRef(rawTurma)
  useEffect(() => { rawTurmaRef.current = rawTurma }, [rawTurma])

  const agendaCtxRef = useRef(agendaCtx)
  useEffect(() => { agendaCtxRef.current = agendaCtx }, [agendaCtx])

  // Escuta eventos globais de foreground emitidos pelo GlobalNotificationProvider
  useEffect(() => {
    const handleRefresh = () => {
      console.log('🔄 [AgendaRealtime] Revalidando queries da agenda após evento foreground...')
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    }
    window.addEventListener('ad:push-foreground', handleRefresh)
    window.addEventListener('ad:app-foreground', handleRefresh)
    return () => {
      window.removeEventListener('ad:push-foreground', handleRefresh)
      window.removeEventListener('ad:app-foreground', handleRefresh)
    }
  }, [queryClient])

  // ── Sincronização de Metadados da Agenda no OneSignal ─────────────────────
  // O OneSignal é inicializado globalmente pelo GlobalNotificationProvider.
  // Aqui atualizamos apenas as tags e aliases contextuais da Agenda Digital (alunos, turmas).
  useEffect(() => {
    if (!currentUser?.id) return

    notificationService
      .syncUser(currentUser, {
        meusAlunos,
        alunoId,
        turmaNome,
        alunoObj,
        extraStaffIds,
        hasDualAccess,
      })
      .catch(err => {
        console.warn('[AgendaRealtime] Erro ao sincronizar metadados no OneSignal:', err)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, responsavelId, alunoId, turmaNome, meusAlunos.length])

  interface EventMatchResult {
    isTarget: boolean
    profileTarget: 'colaborador' | 'familia' | null
    targetAlunoId?: string
    targetAlunoNome?: string
  }

  const handleOpenItem = useCallback((type: 'comunicado' | 'momento' | 'calendario' | 'frequencia' | 'ocorrencia' | 'nota', id: string, match: EventMatchResult) => {
    let targetUrl = ''
    
    if (match.profileTarget === 'colaborador') {
      if (type === 'comunicado') {
        targetUrl = `/agenda-digital/colaborador/comunicados?id=${id}`
      } else if (type === 'momento') {
        targetUrl = `/agenda-digital/colaborador/momentos`
      } else if (type === 'calendario') {
        targetUrl = `/agenda-digital/colaborador/calendario`
      } else {
        targetUrl = `/agenda-digital/colaborador/comunicados`
      }
    } else {
      const targetSlug = match.targetAlunoId || alunoId || (meusAlunos[0]?.id)
      if (targetSlug) {
        if (type === 'comunicado') {
          targetUrl = `/agenda-digital/${targetSlug}/comunicados?id=${id}`
        } else if (type === 'momento') {
          targetUrl = `/agenda-digital/${targetSlug}/momentos`
        } else if (type === 'calendario') {
          targetUrl = `/agenda-digital/${targetSlug}/calendario`
        } else if (type === 'frequencia') {
          targetUrl = `/agenda-digital/${targetSlug}/frequencia`
        } else if (type === 'ocorrencia') {
          targetUrl = `/agenda-digital/${targetSlug}/ocorrencias`
        } else if (type === 'nota') {
          targetUrl = `/agenda-digital/${targetSlug}/notas`
        }
      } else {
        targetUrl = `/agenda-digital?redirect=${type === 'comunicado' ? 'comunicados' : type}&id=${id}`
      }
    }

    if (type === 'comunicado') {
      window.dispatchEvent(new CustomEvent('ad:open-comunicado', { detail: { id } }))
    }
    if (targetUrl) {
      router.push(targetUrl)
    }
  }, [router, alunoId, meusAlunos])

  // Banners flutuantes (toasts in-app) desativados a pedido do usuário:
  // Mantendo apenas o histórico na central de notificações/sininho e as Push Notifications nativas.
  const showInAppToast = useCallback((_params: {
    type: 'comunicado' | 'momento' | 'calendario' | 'frequencia' | 'ocorrencia' | 'nota'
    id: string
    title: string
    conteudo?: string
    autor?: string
    match: EventMatchResult
  }) => {
    // Desativado: nenhum banner flutuante deve ser exibido cobrindo a tela
  }, [])

  // ── Supabase Realtime (In-App Toasts & Live Sync) ─────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return

    const identifier = String(currentUser.id)
    console.log('🎧 [Realtime] Iniciando escuta de eventos para usuário:', identifier)

    const addNotification = useAgendaNotifications.getState().addNotification
    
    const ensureStringArray = (val: any): string[] => {
      if (!val) return []
      if (Array.isArray(val)) return val.map(String)
      return [String(val)]
    }

    const norm = (str: any) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

    const evaluateEventTarget = (dados: any): EventMatchResult => {
      if (!dados) return { isTarget: false, profileTarget: null }

      const currentCandidateStaffIds = myCandidateStaffIdsRef.current
      const currentStaffGroupNamesAndIds = myStaffGroupNamesAndIdsRef.current
      const currentTurmasArray = turmasArrayRef.current
      const currentAgendaCtx = agendaCtxRef.current
      const currentIsStaffUser = isStaffUserRef.current
      const currentCurrentUser = currentUserRef.current
      const currentMeusAlunos = meusAlunosRef.current
      const currentAlunoObj = alunoObjRef.current
      const currentAlunoId = alunoIdRef.current
      const currentTurmaNome = turmaNomeRef.current
      const currentRawTurma = rawTurmaRef.current
      const currentIsFamily = isFamilyRef.current

      const alvoTurmas = ensureStringArray(dados.turmas || dados.targetClasses)
      const alvoTurmasIds = ensureStringArray(dados.turmasIds || dados.targetClassesIds)
      const alvoAlunos = ensureStringArray(dados.alunosIds || dados.targetStudents || dados.targetAlunos)
      const alvoGrupos = ensureStringArray(dados.grupos || dados.targetGroups)
      const alvoFuncs = ensureStringArray(dados.funcionariosIds || dados.colaboradoresIds)
      const destino = String(dados.destino || '').toLowerCase().trim()
      const isTodos = destino === 'todos' || alvoTurmas.some(t => {
        const tl = t.toLowerCase().trim()
        return ['todos', 'toda a escola', 'todas', 'all'].includes(tl) || tl.startsWith('todos:')
      })

      // 1. Staff match
      let matchesStaff = false
      if (currentIsStaffUser) {
        if (currentCurrentUser?.perfil === 'Administrador' || currentCurrentUser?.cargo === 'Administrador Master') {
          matchesStaff = true
        } else if (alvoFuncs.some(fid => {
          const clean = String(fid).replace(/^f_?/, '').trim().toLowerCase()
          return currentCandidateStaffIds.includes(clean)
        })) {
          matchesStaff = true
        } else if (alvoGrupos.some(g => {
          const cleanG = String(g).trim().toLowerCase()
          return currentStaffGroupNamesAndIds.some(mg => mg === cleanG || mg.includes(cleanG) || cleanG.includes(mg))
        })) {
          matchesStaff = true
        } else if (alvoTurmas.length > 0 || alvoTurmasIds.length > 0) {
          const userGroups = currentAgendaCtx?.chatGroups || []
          const isTeacherTurma = currentTurmasArray.some(t => {
            const tNome = String(t.nome || '').toLowerCase().trim()
            const tId = String(t.id).toLowerCase().trim()
            const tCod = String(t.codigo || '').toLowerCase().trim()
            const tNomeNorm = norm(t.nome)
            const belongs = userGroups.some((g: any) => {
              let colabs = g.colaboradoresIds
              if (typeof colabs === 'string') {
                try { colabs = JSON.parse(colabs) } catch { colabs = [] }
              }
              if (!Array.isArray(colabs)) colabs = []
              return colabs.some((cid: any) => currentCandidateStaffIds.includes(String(cid).replace(/^f_?/, '').trim().toLowerCase())) &&
                (String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === tNome || norm(g.nome) === tNomeNorm)
            })
            if (!belongs) return false
            return alvoTurmas.some(al => {
              const alClean = al.toLowerCase().trim()
              const alNorm = norm(al)
              return alClean === tNome || alClean.includes(tNome) || tNome.includes(alClean) || alClean === tId || alClean === tCod ||
                (alNorm && tNomeNorm && (alNorm === tNomeNorm || alNorm.includes(tNomeNorm) || tNomeNorm.includes(alNorm)))
            }) || alvoTurmasIds.some(al => {
              const alNorm = norm(al)
              return alNorm === norm(t.id) || alNorm === norm(t.codigo)
            })
          })
          if (isTeacherTurma) matchesStaff = true
        } else if (isTodos) {
          matchesStaff = true
        }
      }

      // 2. Family match (verifica TODOS os alunos vinculados ao responsável logado)
      let matchingStudent: any = null
      const studentsToCheck: any[] = [...currentMeusAlunos]
      if (currentAlunoObj && !studentsToCheck.some(s => String(s.id) === String(currentAlunoObj.id))) {
        studentsToCheck.push(currentAlunoObj)
      }
      if (currentAlunoId && !studentsToCheck.some(s => String(s.id) === String(currentAlunoId))) {
        studentsToCheck.push({ id: currentAlunoId, nome: 'Aluno', turma: currentRawTurma, turmaNome: currentTurmaNome })
      }

      for (const s of studentsToCheck) {
        const sId = String(s.id)
        const sTurmaNome = String(s.turmaNome || s.turma || '').trim()
        const sTurmaId = String(s.turma || '').trim()
        const sTurmaNorm = norm(sTurmaNome)
        const sTurmaIdNorm = norm(sTurmaId)

        // 2a. Match direto pelo ID do aluno
        if (alvoAlunos.some(aid => {
          const clean = String(aid).replace(/^a_?/, '').replace(/^_ALU/, '').trim()
          return clean === sId || clean === sId.replace(/^(a_|_ALU)/, '')
        })) {
          matchingStudent = s
          break
        }

        // 2b. Match de turma por nome normalizado (ex: "4 ano A - matutino" === "4º Ano A - Matutino") ou código/ID
        const matchedTurmaDirect = alvoTurmas.some(t => {
          const tlNorm = norm(t)
          if (!tlNorm) return false
          const tlClean = tlNorm.replace(/^turma/, '')
          return (
            tlNorm === sTurmaNorm ||
            tlNorm === sTurmaIdNorm ||
            (sTurmaNorm.length >= 4 && (tlNorm.includes(sTurmaNorm) || sTurmaNorm.includes(tlNorm))) ||
            (tlClean.length >= 4 && (sTurmaNorm.includes(tlClean) || tlClean.includes(sTurmaNorm)))
          )
        }) || alvoTurmasIds.some(t => {
          const tlNorm = norm(t)
          return tlNorm === sTurmaIdNorm || tlNorm === sTurmaNorm
        })

        if (matchedTurmaDirect) {
          matchingStudent = s
          break
        }

        // 2c. Match através de isAlunoCursandoTurma com turmasArray (suporte a histórico e duplo vínculo Integral)
        if (currentTurmasArray && currentTurmasArray.length > 0) {
          const matchingTurmaInList = currentTurmasArray.find(t => {
            const tNomeNorm = norm(t.nome)
            const tIdNorm = norm(t.id)
            const tCodNorm = norm(t.codigo)
            return alvoTurmas.some(at => {
              const atNorm = norm(at)
              const atClean = atNorm.replace(/^turma/, '')
              return atNorm === tNomeNorm || atNorm === tIdNorm || atNorm === tCodNorm ||
                (tNomeNorm.length >= 4 && (atNorm.includes(tNomeNorm) || tNomeNorm.includes(atNorm))) ||
                (atClean.length >= 4 && (tNomeNorm.includes(atClean) || atClean.includes(tNomeNorm)))
            }) || alvoTurmasIds.some(atId => norm(atId) === tIdNorm || norm(atId) === tCodNorm)
          })

          if (matchingTurmaInList && isAlunoCursandoTurma(s, matchingTurmaInList, undefined, currentTurmasArray)) {
            matchingStudent = s
            break
          }
        }

        // 2d. Match por grupos da agenda em que o aluno é membro
        if (alvoGrupos.length > 0) {
          const userGroups = currentAgendaCtx?.chatGroups || []
          const inGroup = userGroups.some((g: any) => {
            const gNomeNorm = norm(g.nome || g.dados?.nome)
            const gIdNorm = norm(g.id)
            const isTargetGroup = alvoGrupos.some(ag => {
              const agNorm = norm(ag)
              return agNorm === gNomeNorm || agNorm === gIdNorm
            })
            if (!isTargetGroup) return false
            let aIds = g.alunosIds || g.dados?.alunosIds || []
            if (typeof aIds === 'string') {
              try { aIds = JSON.parse(aIds) } catch { aIds = [] }
            }
            if (!Array.isArray(aIds)) aIds = []
            return aIds.some((aid: any) => String(aid).replace(/^(a_|_ALU)/, '').trim() === sId)
          })
          if (inGroup) {
            matchingStudent = s
            break
          }
        }
      }

      if (isTodos && !matchingStudent && studentsToCheck.length > 0) {
        matchingStudent = studentsToCheck[0]
      }

      let profileTarget: 'colaborador' | 'familia' | null = null
      if (matchesStaff && !matchingStudent) {
        profileTarget = 'colaborador'
      } else if (!matchesStaff && matchingStudent) {
        profileTarget = 'familia'
      } else if (matchesStaff && matchingStudent) {
        // Se o evento foi direcionado expressamente a grupos da equipe escolar ou a colaboradores, preferir 'colaborador'
        const hasSpecificStaffTarget = alvoGrupos.some(g => currentStaffGroupNamesAndIds.includes(String(g).trim().toLowerCase())) ||
          alvoFuncs.some(f => currentCandidateStaffIds.includes(String(f).replace(/^f_?/, '').trim().toLowerCase()))

        if (hasSpecificStaffTarget) {
          profileTarget = 'colaborador'
        } else if (typeof window !== 'undefined' && window.location.pathname.includes('/colaborador/')) {
          profileTarget = 'colaborador'
        } else {
          profileTarget = currentIsStaffUser && !currentIsFamily ? 'colaborador' : 'familia'
        }
      }

      const isTarget = matchesStaff || !!matchingStudent || isTodos
      return {
        isTarget,
        profileTarget,
        targetAlunoId: matchingStudent?.id,
        targetAlunoNome: matchingStudent?.nome
      }
    }

    let isMounted = true
    const channels: any[] = []

    const createBinding = (table: string, filter: any, handler: (payload: any) => void) => {
      const cName = `agenda-rt-${table}-${identifier}`
      const c = supabase.channel(cName)
      c.on('postgres_changes', filter, handler)
        .subscribe((status: string) => {
          if (!isMounted) return
          if (status === 'SUBSCRIBED') {
            console.log(`✅ [Realtime] Conectado ao canal ${table}`)
          } else if (status === 'CHANNEL_ERROR') {
            console.warn(`⚠️ [Realtime] Erro no canal ${table}. Verifique se Realtime está ativado no banco.`)
            supabase.removeChannel(c)
          }
        })
      channels.push(c)
    }

    // ── COMUNICADOS ──────────────────────────────────────────────────────
    createBinding('comunicados', { event: '*', schema: 'public', table: 'comunicados' }, payload => {
      const { eventType, old, new: newRow } = payload
      const row = eventType === 'DELETE' ? old : newRow
      const merged = { ...row, ...(row.dados || {}) }

      const match = evaluateEventTarget(merged)
      
      const alvoTurmas = ensureStringArray(merged.turmas || merged.targetClasses)
      const alvoTurmasIds = ensureStringArray(merged.turmasIds || merged.targetClassesIds)
      const alvoGrupos = ensureStringArray(merged.grupos || merged.targetGroups)
      const alvoAlunos = ensureStringArray(merged.alunosIds || merged.targetAlunos)
      const alvoFuncs = ensureStringArray(merged.funcionariosIds || merged.colaboradoresIds)
      const destino = String(merged.destino || '').toLowerCase().trim()
      
      const hasAnyTarget = alvoTurmas.length > 0 || alvoTurmasIds.length > 0 || alvoGrupos.length > 0 || alvoAlunos.length > 0 || alvoFuncs.length > 0 || destino === 'todos'

      if (eventType === 'DELETE' || match.isTarget || hasAnyTarget || !isFamilyRef.current) {
        window.dispatchEvent(new CustomEvent(`ad:comunicados-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] })
      }

      if (eventType === 'INSERT' && (merged.status === 'enviado' || merged.dados?.status === 'enviado')) {
        const currentCandidateStaffIds = myCandidateStaffIdsRef.current
        const currentCurrentUser = currentUserRef.current
        const isMe =
          (merged.autorId && (currentCandidateStaffIds.includes(String(merged.autorId).toLowerCase()) || String(merged.autorId) === String(currentCurrentUser?.id))) ||
          (merged.autor && currentCurrentUser?.nome &&
            String(merged.autor).trim().toLowerCase() === String(currentCurrentUser.nome).trim().toLowerCase())

        if (!isMe && match.isTarget) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
          
          const currentAlunoId = alunoIdRef.current
          const currentMeusAlunos = meusAlunosRef.current
          const drawerLink = match.profileTarget === 'colaborador'
            ? `/agenda-digital/colaborador/comunicados?id=${merged.id}`
            : `/agenda-digital/${match.targetAlunoId || currentAlunoId || (currentMeusAlunos[0]?.id)}/comunicados?id=${merged.id}`

          addNotification({
            id: merged.id,
            type: 'comunicado',
            title: (hasDualAccessRef.current && match.profileTarget === 'colaborador' ? '[Institucional] ' : '') + (merged.titulo || 'Novo Comunicado'),
            createdAt: merged.created_at || new Date().toISOString(),
            read: false,
            link: drawerLink,
          })

          showInAppToast({
            type: 'comunicado',
            id: merged.id,
            title: merged.titulo || 'Novo Comunicado',
            conteudo: merged.conteudo,
            autor: merged.autor,
            match,
          })
        }
      }
    })

    // ── CALENDÁRIO ───────────────────────────────────────────────────────
    createBinding('eventos_agenda', { event: '*', schema: 'public', table: 'eventos_agenda' }, payload => {
      const { eventType, old, new: newRow } = payload
      const row = eventType === 'DELETE' ? old : newRow

      const merged = { ...row, ...(row.dados || {}), turmas: row.turmas }
      const match = evaluateEventTarget(merged)
      
      const alvoTurmas = Array.isArray(merged.turmas) ? merged.turmas : [merged.turmas].filter(Boolean)
      const alvoTurmasIds = Array.isArray(merged.turmasIds) ? merged.turmasIds : [merged.turmasIds].filter(Boolean)
      const alvoGrupos = Array.isArray(merged.grupos) ? merged.grupos : [merged.grupos].filter(Boolean)
      const alvoAlunos = Array.isArray(merged.alunosIds) ? merged.alunosIds : [merged.alunosIds].filter(Boolean)
      const alvoFuncs = Array.isArray(merged.funcionariosIds) ? merged.funcionariosIds : [merged.funcionariosIds].filter(Boolean)
      const destino = String(merged.destino || '').toLowerCase().trim()
      
      const hasAnyTarget = alvoTurmas.length > 0 || alvoTurmasIds.length > 0 || alvoGrupos.length > 0 || alvoAlunos.length > 0 || alvoFuncs.length > 0 || destino === 'todos'

      if (eventType === 'DELETE' || match.isTarget || hasAnyTarget || !isFamilyRef.current) {
        window.dispatchEvent(new CustomEvent(`ad:eventos_agenda-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'calendario'] })
      }

      if (eventType === 'INSERT' && match.isTarget) {
        window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        
        const currentAlunoId = alunoIdRef.current
        const currentMeusAlunos = meusAlunosRef.current
        const drawerLink = match.profileTarget === 'colaborador'
          ? `/agenda-digital/colaborador/calendario`
          : `/agenda-digital/${match.targetAlunoId || currentAlunoId || (currentMeusAlunos[0]?.id)}/calendario`

        addNotification({
          id: row.id,
          type: 'evento',
          title: (hasDualAccessRef.current && match.profileTarget === 'colaborador' ? '[Institucional] ' : '') + (row.titulo || 'Novo Evento'),
          createdAt: row.created_at || new Date().toISOString(),
          read: false,
          link: drawerLink,
        })

        showInAppToast({
          type: 'calendario',
          id: row.id,
          title: row.titulo || 'Novo Evento',
          conteudo: row.descricao || row.local || '',
          match,
        })
      }
    })

    // ── MOMENTOS ─────────────────────────────────────────────────────────
    createBinding('momentos', { event: '*', schema: 'public', table: 'momentos' }, payload => {
      const { eventType, old, new: newRow } = payload
      const row = eventType === 'DELETE' ? old : newRow
      const merged = { ...row, ...(row.dados || {}) }

      const match = evaluateEventTarget(merged)
      
      const alvoTurmas = ensureStringArray(merged.turmas || merged.targetClasses)
      const alvoTurmasIds = ensureStringArray(merged.turmasIds || merged.targetClassesIds)
      const alvoGrupos = ensureStringArray(merged.grupos || merged.targetGroups)
      const alvoAlunos = ensureStringArray(merged.alunosIds || merged.targetAlunos)
      const alvoFuncs = ensureStringArray(merged.funcionariosIds || merged.colaboradoresIds)
      const destino = String(merged.destino || '').toLowerCase().trim()
      
      const hasAnyTarget = alvoTurmas.length > 0 || alvoTurmasIds.length > 0 || alvoGrupos.length > 0 || alvoAlunos.length > 0 || alvoFuncs.length > 0 || destino === 'todos'

      if (eventType === 'DELETE' || match.isTarget || hasAnyTarget || !isFamilyRef.current) {
        window.dispatchEvent(new CustomEvent(`ad:momentos-${eventType.toLowerCase()}`, { detail: { ...payload, new: merged } }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'momentos'] })
      }

      if (eventType === 'INSERT' && match.isTarget) {
        window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        
        const currentAlunoId = alunoIdRef.current
        const currentMeusAlunos = meusAlunosRef.current
        const drawerLink = match.profileTarget === 'colaborador'
          ? `/agenda-digital/colaborador/momentos`
          : `/agenda-digital/${match.targetAlunoId || currentAlunoId || (currentMeusAlunos[0]?.id)}/momentos`

        addNotification({
          id: merged.id,
          type: 'momento',
          title: (hasDualAccessRef.current && match.profileTarget === 'colaborador' ? '[Institucional] ' : '') + (merged.titulo || 'Novo Momento'),
          createdAt: merged.created_at || new Date().toISOString(),
          read: false,
          link: drawerLink,
        })

        showInAppToast({
          type: 'momento',
          id: merged.id,
          title: merged.titulo || 'Novo Momento',
          conteudo: merged.legenda || merged.descricao || '',
          match,
        })
      }
    })

    // ── OCORRÊNCIAS ──────────────────────────────────────────────────────
    createBinding('ocorrencias', { event: '*', schema: 'public', table: 'ocorrencias' }, payload => {
      const { eventType, old, new: newRow } = payload
      const row = eventType === 'DELETE' ? old : newRow
      const rowAlunoId = String(row.aluno_id || row.dados?.aluno_id || row.dados?.alunoId || '')

      const currentMeusAlunos = meusAlunosRef.current
      const currentAlunoId = alunoIdRef.current
      const currentAlunoObj = alunoObjRef.current
      const currentIsFamily = isFamilyRef.current

      const matchingStudent = currentMeusAlunos.find(s => String(s.id) === rowAlunoId) || (currentAlunoId === rowAlunoId ? currentAlunoObj : null)
      const isForAluno = eventType === 'DELETE' || !!matchingStudent || rowAlunoId === String(currentAlunoId) || !currentIsFamily

      if (isForAluno) {
        window.dispatchEvent(new CustomEvent(`ad:ocorrencias-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'ocorrencias'] })

        if (eventType === 'INSERT') {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
          const targetSlug = matchingStudent?.id || currentAlunoId || (currentMeusAlunos[0]?.id)
          const match: EventMatchResult = {
            isTarget: true,
            profileTarget: 'familia',
            targetAlunoId: targetSlug,
            targetAlunoNome: matchingStudent?.nome
          }

          addNotification({
            id: row.id,
            type: 'ocorrencia',
            title: `Nova ocorrência: ${row.tipo || row.dados?.tipo || 'Aviso'}`,
            createdAt: row.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${targetSlug}/ocorrencias`,
          })

          showInAppToast({
            type: 'ocorrencia',
            id: row.id,
            title: `Nova ocorrência: ${row.tipo || row.dados?.tipo || 'Aviso'}`,
            conteudo: row.descricao || row.motivo || '',
            match,
          })
        }
      }
    })

    // ── BOLETINS (NOTAS) ─────────────────────────────────────────────────
    createBinding('boletins', { event: '*', schema: 'public', table: 'boletins' }, payload => {
      const { eventType, old, new: newRow } = payload
      const row = eventType === 'DELETE' ? old : newRow
      const rowAlunoId = String(row.aluno_id || '')
      const rowAlunoSemZero = rowAlunoId.replace(/^0+/, '')

      const currentMeusAlunos = meusAlunosRef.current
      const currentAlunoId = alunoIdRef.current
      const currentAlunoObj = alunoObjRef.current
      const currentIsFamily = isFamilyRef.current

      const matchingStudent = currentMeusAlunos.find(s => String(s.id) === rowAlunoId || String(s.id).replace(/^0+/, '') === rowAlunoSemZero) || (currentAlunoId === rowAlunoId ? currentAlunoObj : null)
      const isForAluno = eventType === 'DELETE' || !!matchingStudent || rowAlunoId === String(currentAlunoId) || !currentIsFamily

      if (isForAluno) {
        window.dispatchEvent(new CustomEvent(`ad:boletins-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'boletins'] })

        if (eventType === 'INSERT') {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
          const targetSlug = matchingStudent?.id || currentAlunoId || (currentMeusAlunos[0]?.id)
          const match: EventMatchResult = {
            isTarget: true,
            profileTarget: 'familia',
            targetAlunoId: targetSlug,
            targetAlunoNome: matchingStudent?.nome
          }

          addNotification({
            id: row.id,
            type: 'nota',
            title: 'Boletim de notas atualizado',
            createdAt: row.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${targetSlug}/notas`,
          })

          showInAppToast({
            type: 'nota',
            id: row.id,
            title: 'Boletim de notas atualizado',
            conteudo: 'Novas avaliações foram publicadas no boletim.',
            match,
          })
        }
      }
    })

    // ── FREQUÊNCIAS ──────────────────────────────────────────────────────
    createBinding('frequencias', { event: '*', schema: 'public', table: 'frequencias' }, payload => {
      const { eventType, old, new: newRow } = payload
      const row = eventType === 'DELETE' ? old : newRow
      const rowAlunoId = String(row.aluno_id || row.dados?.aluno_id || '')

      const currentMeusAlunos = meusAlunosRef.current
      const currentAlunoId = alunoIdRef.current
      const currentAlunoObj = alunoObjRef.current
      const currentIsFamily = isFamilyRef.current
      const currentIsColaboradorAccess = isColaboradorAccessRef.current
      const currentIsMasterAdmin = isMasterAdminRef.current

      const matchingStudent = currentMeusAlunos.find(s => String(s.id) === rowAlunoId) || (currentAlunoId === rowAlunoId ? currentAlunoObj : null)

      // Invalidação silenciosa para manter tabelas e gráficos sincronizados em background
      window.dispatchEvent(new CustomEvent(`ad:frequencias-${eventType.toLowerCase()}`, { detail: payload }))
      queryClient.invalidateQueries({ queryKey: ['agenda', 'frequencias'] })

      // Banners e notificações de presença NÃO devem aparecer para perfil acesso colaboradores,
      // apenas para o Administrador Master (ou família para seus próprios dependentes).
      if (currentIsColaboradorAccess) {
        return
      }

      // Se não for Administrador Master, só exibe se for perfil família e para seu próprio aluno
      if (!currentIsMasterAdmin) {
        if (!currentIsFamily || !matchingStudent) {
          return
        }
      }

      if (eventType === 'INSERT') {
        window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        const targetSlug = matchingStudent?.id || rowAlunoId || currentAlunoId || (currentMeusAlunos[0]?.id)
        const match: EventMatchResult = {
          isTarget: true,
          profileTarget: currentIsMasterAdmin ? 'colaborador' : 'familia',
          targetAlunoId: targetSlug,
          targetAlunoNome: matchingStudent?.nome
        }

        const isPresenca = row.presente !== false && !row.justificativa && !row.dados?.justificativa
        const isJustificada = Boolean(
          (row.justificativa && String(row.justificativa).trim().length > 0) ||
          (row.dados?.justificativa && String(row.dados.justificativa).trim().length > 0)
        )

        let title = 'Presença confirmada'
        let conteudo = 'Registro de frequência atualizado.'

        if (isJustificada) {
          title = 'Falta justificada'
          conteudo = (row.justificativa || row.dados?.justificativa)
            ? `Justificativa: ${row.justificativa || row.dados?.justificativa}`
            : 'Registro de frequência atualizado.'
        } else if (!isPresenca) {
          title = 'Nova falta registrada'
          conteudo = 'Registro de frequência atualizado.'
        }

        addNotification({
          id: row.id,
          type: 'frequencia',
          title,
          createdAt: row.created_at || new Date().toISOString(),
          read: false,
          link: `/agenda-digital/${targetSlug}/frequencia`,
        })

        showInAppToast({
          type: 'frequencia',
          id: row.id,
          title,
          conteudo,
          match,
        })
      }
    })

    return () => {
      isMounted = false
      channels.forEach(c => supabase.removeChannel(c))
      console.log(`🔌 [Realtime] Canais desconectados.`)
    }
  }, [currentUser?.id])

  return (
    <>
      {/* SDK do OneSignal v16 — carregado após interação do usuário */}
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
      <PushPermissionBanner />
      <Toaster position="top-right" richColors />
      {children}
    </>
  )
}

/**
 * Mapeia o tipo de push para a rota correta da agenda.
 * Usado no deep link ao clicar na notificação.
 */
function typeToRoute(type: string): string {
  const map: Record<string, string> = {
    comunicados: 'comunicados',
    momentos:    'momentos',
    calendario:  'calendario',
    frequencia:  'frequencia',
    ocorrencias: 'ocorrencias',
    notas:       'notas',
    cobrancas:   'financeiro',
    saida:       'portaria', // ← deep link de saída/portaria
  }
  return map[type] || ''
}
