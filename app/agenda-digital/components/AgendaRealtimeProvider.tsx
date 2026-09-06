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
import { useRouter, useParams } from 'next/navigation'
import { Calendar, FileText, Image as ImageIcon, ShieldAlert, Megaphone, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { ReportPayloadView } from '@/components/DynamicReports/ReportPayloadView'

import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { toast, Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { useAgendaNotifications } from '../hooks/useAgendaNotifications'
import { PushPermissionBanner } from '@/components/agenda/PushPermissionBanner'

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
  const { currentUser } = useApp()
  const osInitialized = useRef(false)

  const isFamily =
    currentUser?.perfil === 'Família' ||
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
    try {
      const cached = localStorage.getItem(`edu-meus-alunos-${currentUser.id}`)
      if (cached) {
        setMeusAlunos(JSON.parse(cached))
      }
    } catch(e) {}

    fetch('/api/agenda/meus-alunos', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setMeusAlunos(data)
          try {
            localStorage.setItem(`edu-meus-alunos-${currentUser.id}`, JSON.stringify(data))
          } catch(e) {}
        }
      })
      .catch(() => {})
  }, [currentUser?.id])

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

  // ── OneSignal Initialization ──────────────────────────────────────────────
  // 1. Inicializa o SDK (apenas uma vez)
  useEffect(() => {
    let isMounted = true
    if (typeof window === 'undefined') return

    const initOneSignal = async () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
        if (!appId) {
          console.warn('[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID não configurado. Push desativado.')
          return
        }

        // ── Verificar ambiente nativo (Capacitor) ─────────────────────────
        let isNative = false
        try {
          isNative = !!(window as any).Capacitor?.isNativePlatform()
        } catch {}

        if (isNative) {
          if (!window.__OS_INIT__) {
            console.log('📱 [OneSignal] Ambiente nativo detectado (Capacitor)')
            window.__OS_INIT__ = true
            try {
              const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
              OneSignalNative.initialize(appId)
              ;(window as any).__OS_NATIVE_READY__ = true
              
              // Solicitar permissão de notificação no Android 13+ e iOS
              try {
                await OneSignalNative.Notifications.requestPermission(true)
              } catch (permErr: any) {
                console.warn('📱 [OneSignal] Aviso permissão nativa:', permErr?.message)
              }

              // Deep link nativo
              OneSignalNative.Notifications.addEventListener('click', (event: any) => {
                const data = event?.notification?.additionalData || {}
                console.log('[OneSignal] Notificação nativa clicada:', data)
                
                const directUrl = data.targetUrl || data.url
                if (directUrl) {
                  const finalUrl = data.item_id && !directUrl.includes('id=')
                    ? `${directUrl}${directUrl.includes('?') ? '&' : '?'}id=${data.item_id}`
                    : directUrl
                  console.log(`[OneSignal] Deep link nativo direto → ${finalUrl}`)
                  if ((data?.type === 'comunicados' || data?.rota === 'comunicados') && data?.item_id) {
                    window.dispatchEvent(new CustomEvent('ad:open-comunicado', { detail: { id: data.item_id } }))
                  }
                  router.push(finalUrl)
                  return
                }

                if (data?.rota || data?.type) {
                  const isColab = data.perfil_destino === 'colaborador' || data.isColab
                  let route = ''

                  if (isColab) {
                    route = `/agenda-digital/colaborador/${data.rota || typeToRoute(data.type)}`
                  } else {
                    const slug = data.aluno_id || alunoIdRef.current
                    if (slug) {
                      route = `/agenda-digital/${slug}/${data.rota || typeToRoute(data.type)}`
                    } else {
                      route = `/agenda-digital?redirect=${data.rota || typeToRoute(data.type)}`
                    }
                  }
                  
                  if (data?.item_id && !route.includes('id=')) {
                    route += (route.includes('?') ? '&' : '?') + `id=${data.item_id}`
                  }

                  if (route) {
                    console.log(`[OneSignal] Deep link nativo → ${route}`)
                    if ((data?.type === 'comunicados' || data?.rota === 'comunicados') && data?.item_id) {
                      window.dispatchEvent(new CustomEvent('ad:open-comunicado', { detail: { id: data.item_id } }))
                    }
                    router.push(route)
                  }
                }
              })

              // Se a notificação chegar com o app ABERTO no celular, forçar refresh da interface!
              OneSignalNative.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
                console.log('📱 [OneSignal] Notificação recebida em FOREGROUND! Forçando refresh da agenda...', event)
                queryClient.invalidateQueries({ queryKey: ['agenda'] })
              })

              // Quando o app volta do background pro foreground (onde o WebSocket do Supabase costuma falhar), forçar refresh!
              import('@capacitor/app').then(({ App }) => {
                App.addListener('appStateChange', ({ isActive }) => {
                  if (isActive) {
                    console.log('📱 [Capacitor] App voltou para o FOREGROUND! Atualizando dados da agenda para evitar perda de mensagens do WebSocket...')
                    queryClient.invalidateQueries({ queryKey: ['agenda'] })
                  }
                })
              }).catch(e => console.error('[Capacitor] Erro ao carregar App plugin:', e))
            } catch (nativeErr: any) {
              console.error('[OneSignal] Erro no plugin nativo:', nativeErr.message)
            }
          }
          return
        }

        // ── Web Push (v16) ────────────────────────────────────────────────
        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push(async function (OneSignal: any) {
          try {
            if (!OneSignal) {
              console.warn('[OneSignal] Instância não encontrada.');
              return;
            }
            if (!window.__OS_INIT__) {
              if (window.location.hostname === 'localhost') {
                console.log('Push notifications Web desativadas no localhost (evita erro do OneSignal).')
                return
              }
              window.__OS_INIT__ = true
              try {
                await OneSignal.init({
                  appId,
                  allowLocalhostAsSecureOrigin: true,
                  // Botão de sino do OneSignal — ativado para facilitar permissão
                  notifyButton: {
                    enable: true,
                    size: 'medium',
                    position: 'bottom-right',
                    offset: { bottom: '80px', right: '20px' },
                    colors: {
                      'circle.background': '#4f46e5',
                      'circle.foreground': 'white',
                      'badge.background': '#fe5062',
                      'badge.foreground': 'white',
                    },
                  },
                  // Service worker na raiz do domínio
                  serviceWorkerParam: { scope: '/' },
                })
                console.log('🔔 [OneSignal] Inicializado com sucesso!')
                
                // Listener de clique nas notificações Web
                if (typeof OneSignal?.Notifications?.addEventListener === 'function') {
                  OneSignal.Notifications.addEventListener('click', (event: any) => {
                    const data = event?.notification?.additionalData || {}
                    console.log('[OneSignal] Notificação web clicada:', data)

                    const directUrl = data.targetUrl || data.url
                    if (directUrl) {
                      const finalUrl = data.item_id && !directUrl.includes('id=')
                        ? `${directUrl}${directUrl.includes('?') ? '&' : '?'}id=${data.item_id}`
                        : directUrl
                      console.log(`[OneSignal] Deep link web direto → ${finalUrl}`)
                      if ((data?.type === 'comunicados' || data?.rota === 'comunicados') && data?.item_id) {
                        window.dispatchEvent(new CustomEvent('ad:open-comunicado', { detail: { id: data.item_id } }))
                      }
                      router.push(finalUrl)
                      return
                    }

                    if (data?.rota || data?.type) {
                      const isColab = data.perfil_destino === 'colaborador' || data.isColab
                      let route = ''

                      if (isColab) {
                        route = `/agenda-digital/colaborador/${data.rota || typeToRoute(data.type)}`
                      } else {
                        const slug = data.aluno_id || alunoIdRef.current
                        if (slug) {
                          route = `/agenda-digital/${slug}/${data.rota || typeToRoute(data.type)}`
                        } else {
                          route = `/agenda-digital?redirect=${data.rota || typeToRoute(data.type)}`
                        }
                      }
                      
                      if (data?.item_id && !route.includes('id=')) {
                        route += (route.includes('?') ? '&' : '?') + `id=${data.item_id}`
                      }

                      if (route) {
                        console.log(`[OneSignal] Deep link web → ${route}`)
                        if ((data?.type === 'comunicados' || data?.rota === 'comunicados') && data?.item_id) {
                          window.dispatchEvent(new CustomEvent('ad:open-comunicado', { detail: { id: data.item_id } }))
                        }
                        router.push(route)
                      }
                    }
                  })
                }
              } catch (initErr: any) {
                const msg = initErr?.message || ''
                if (msg.includes('already initialized') || msg.includes('Timeout')) {
                  console.warn('[OneSignal] SDK já inicializado (ignorar):', msg)
                } else {
                  console.error('[OneSignal] Erro na inicialização:', initErr)
                  window.__OS_INIT__ = false // Permite nova tentativa
                }
              }
            }
          } catch (e: any) {
            console.error('[OneSignal] Erro interno no listener web:', e)
          }
        })
      } catch (err: any) {
        console.error('[OneSignal] Falha crítica na inicialização:', err.message)
      }
    }

    // Pequeno delay para garantir que o SDK foi carregado pelo <Script>
    const timer = setTimeout(initOneSignal, 500)
    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Apenas na montagem para evitar duplos listeners

  // 2. Gerenciar Usuário e Tags no OneSignal (Reage a mudanças no currentUser)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const gerenciarUsuarioPush = async (retryCount = 0) => {
      try {
        let isNative = false
        try {
          isNative = !!(window as any).Capacitor?.isNativePlatform()
        } catch {}

        let OS: any = null
        if (isNative) {
          // Aguarda a inicialização nativa completar antes de logar
          // Limite de 25 tentativas (~5 segundos) para evitar loop infinito
          if (!(window as any).__OS_NATIVE_READY__) {
            if (retryCount >= 25) {
              console.warn('[OneSignal] Nativo não inicializou após 25 tentativas. Abandonando.')
              return
            }
            setTimeout(() => gerenciarUsuarioPush(retryCount + 1), 200)
            return
          }
          const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
          OS = OneSignalNative
        } else {
          OS = window.OneSignal
          // Se o script do OneSignal não carregou ainda, enfileirar
          if (!OS && window.OneSignalDeferred) {
             window.OneSignalDeferred.push(function(OneSignalInstance: any) {
               if (OneSignalInstance) {
                 gerenciarUsuarioPush();
               }
             })
             return
          }
        }

        if (!OS) return

        if (currentUser?.id) {
          const userId = String(currentUser.id)
          
          if (window.__OS_USER_ID__ !== userId) {
            try {
              if (typeof OS.login === 'function') {
                await OS.login(userId)
                window.__OS_USER_ID__ = userId
                console.log(`✅ [OneSignal] Usuário identificado: ${userId}`)
                
                // Add aliases for responsavel_id, aluno_id, colaborador_id and system_user_id to allow backend to target them
                if (OS.User && typeof OS.User.addAlias === 'function') {
                  try {
                    if (currentUser.responsavel_id) {
                      const p = OS.User.addAlias('responsavel_id', String(currentUser.responsavel_id));
                      if (p && p.catch) p.catch(() => {});
                    }
                    if (currentUser.aluno_id) {
                      const p = OS.User.addAlias('aluno_id', String(currentUser.aluno_id));
                      if (p && p.catch) p.catch(() => {});
                    }
                    const colabId = currentUser.colaborador_id || currentUser.system_user_id || currentUser.user_metadata?.colaborador_id || currentUser.user_metadata?.system_user_id || extraStaffIds[0];
                    if (colabId) {
                      const p1 = OS.User.addAlias('colaborador_id', String(colabId));
                      if (p1 && p1.catch) p1.catch(() => {});
                      const p2 = OS.User.addAlias('system_user_id', String(colabId));
                      if (p2 && p2.catch) p2.catch(() => {});
                    }
                  } catch (e) {
                    // ignore
                  }
                }
              }
            } catch (loginErr: any) {
              console.warn('[OneSignal] Erro no login (pode ser normal):', loginErr?.message)
            }
          }
          
          // ── Tags de segmentação (Aplicado no Web e Nativo) ──────────────────
          try {
            const tags: Record<string, string> = {
              perfil: currentUser.perfil || '',
              cargo: currentUser.cargo || '',
            }
            if (alunoId) tags['aluno_id'] = alunoId
            if (turmaNome) tags['turma'] = String(turmaNome)
            if (alunoObj?.id) tags['aluno_db_id'] = String(alunoObj.id)
            if (currentUser.responsavel_id) tags['responsavel_id'] = String(currentUser.responsavel_id)
            const staffIdTag = currentUser.colaborador_id || currentUser.system_user_id || currentUser.user_metadata?.colaborador_id || extraStaffIds[0]
            if (staffIdTag) tags['colaborador_id'] = String(staffIdTag)
            if (hasDualAccess) tags['has_dual_role'] = 'true'

            if (OS.User && typeof OS.User.addTags === 'function') {
              await OS.User.addTags(tags)
              console.log('[OneSignal] Tags de segmentação atribuídas:', tags)
            }
          } catch (tagsErr: any) {
            console.warn('[OneSignal] Erro ao atribuir tags:', tagsErr?.message)
          }

        } else {
          // ── LOGOUT (Garante que usuário não receba PUSHs do usuário anterior)
          if (window.__OS_USER_ID__) {
             try {
               if (typeof OS.logout === 'function') {
                 await OS.logout()
                 window.__OS_USER_ID__ = undefined
                 console.log(`🚪 [OneSignal] Usuário deslogado do Push`)
               }
             } catch (logoutErr: any) {
               console.warn('[OneSignal] Erro no logout:', logoutErr?.message)
             }
          }
        }
      } catch (err: any) {
        console.error('[OneSignal] Erro ao gerenciar usuário/tags:', err)
      }
    }

    gerenciarUsuarioPush()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, responsavelId, alunoId, turmaNome])

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

  const showInAppToast = useCallback((params: {
    type: 'comunicado' | 'momento' | 'calendario' | 'frequencia' | 'ocorrencia' | 'nota'
    id: string
    title: string
    conteudo?: string
    autor?: string
    match: EventMatchResult
  }) => {
    const { type, id, title, conteudo, autor, match } = params

    let profileBadge = ''
    if (hasDualAccess) {
      if (match.profileTarget === 'colaborador') {
        profileBadge = '🏛️ Institucional'
      } else if (match.targetAlunoNome) {
        profileBadge = `🎒 Aluno: ${match.targetAlunoNome.split(' ')[0]}`
      }
    }

    let iconNode = <Megaphone size={18} className="text-indigo-600" />
    if (type === 'momento') iconNode = <ImageIcon size={18} className="text-emerald-600" />
    if (type === 'calendario') iconNode = <Calendar size={18} className="text-amber-600" />

    const preview = conteudo 
      ? (conteudo.replace(/<[^>]*>?/gm, '').slice(0, 75) + (conteudo.length > 75 ? '...' : ''))
      : autor ? `Por ${autor}` : 'Clique para visualizar'

    const toastMessage = profileBadge ? `${profileBadge} • ${title}` : title

    toast(toastMessage, {
      description: preview,
      icon: iconNode,
      duration: 8000,
      action: {
        label: 'Abrir',
        onClick: () => handleOpenItem(type, id, match),
      },
    })
  }, [hasDualAccess, handleOpenItem])

  // ── Supabase Realtime (In-App Toasts & Live Sync) ─────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return

    const identifier = alunoId || String(currentUser.id)
    console.log('🎧 [Realtime] Iniciando escuta de eventos para:', identifier)

    const addNotification = useAgendaNotifications.getState().addNotification
    
    const ensureStringArray = (val: any): string[] => {
      if (!val) return []
      if (Array.isArray(val)) return val.map(String)
      return [String(val)]
    }

    const evaluateEventTarget = (dados: any): EventMatchResult => {
      if (!dados) return { isTarget: false, profileTarget: null }

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
      if (isStaffUser) {
        if (currentUser?.perfil === 'Administrador' || currentUser?.cargo === 'Administrador Master') {
          matchesStaff = true
        } else if (alvoFuncs.some(fid => {
          const clean = String(fid).replace(/^f_?/, '').trim().toLowerCase()
          return myCandidateStaffIds.includes(clean)
        })) {
          matchesStaff = true
        } else if (alvoGrupos.some(g => {
          const cleanG = String(g).trim().toLowerCase()
          return myStaffGroupNamesAndIds.some(mg => mg === cleanG || mg.includes(cleanG) || cleanG.includes(mg))
        })) {
          matchesStaff = true
        } else if (alvoTurmas.length > 0 || alvoTurmasIds.length > 0) {
          const userGroups = agendaCtx?.chatGroups || []
          const isTeacherTurma = turmasArray.some(t => {
            const tNome = String(t.nome || '').toLowerCase().trim()
            const tId = String(t.id).toLowerCase().trim()
            const tCod = String(t.codigo || '').toLowerCase().trim()
            const belongs = userGroups.some((g: any) => {
              let colabs = g.colaboradoresIds
              if (typeof colabs === 'string') {
                try { colabs = JSON.parse(colabs) } catch { colabs = [] }
              }
              if (!Array.isArray(colabs)) colabs = []
              return colabs.some((cid: any) => myCandidateStaffIds.includes(String(cid).replace(/^f_?/, '').trim().toLowerCase())) &&
                (String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === tNome)
            })
            if (!belongs) return false
            return alvoTurmas.some(al => {
              const alClean = al.toLowerCase().trim()
              return alClean === tNome || alClean.includes(tNome) || tNome.includes(alClean) || alClean === tId || alClean === tCod
            }) || alvoTurmasIds.some(al => al.toLowerCase().trim() === tId || al.toLowerCase().trim() === tCod)
          })
          if (isTeacherTurma) matchesStaff = true
        } else if (isTodos) {
          matchesStaff = true
        }
      }

      // 2. Family match
      let matchingStudent: any = null
      const studentsToCheck: any[] = [...meusAlunos]
      if (alunoObj && !studentsToCheck.some(s => String(s.id) === String(alunoObj.id))) {
        studentsToCheck.push(alunoObj)
      }
      if (alunoId && !studentsToCheck.some(s => String(s.id) === String(alunoId))) {
        studentsToCheck.push({ id: alunoId, nome: 'Aluno', turma: rawTurma, turmaNome })
      }

      for (const s of studentsToCheck) {
        const sId = String(s.id)
        const sTurmaNome = String(s.turmaNome || s.turma || '').toLowerCase().trim()
        const sTurmaId = String(s.turma || '').toLowerCase().trim()

        if (alvoAlunos.some(aid => {
          const clean = String(aid).replace(/^a_?/, '').replace(/^_ALU/, '').trim()
          return clean === sId
        })) {
          matchingStudent = s
          break
        }
        if (sTurmaNome && (
          alvoTurmas.some(t => {
            const tl = t.toLowerCase().trim()
            return tl === sTurmaNome || tl.includes(sTurmaNome) || sTurmaNome.includes(tl)
          }) ||
          alvoTurmasIds.some(t => t.toLowerCase().trim() === sTurmaId)
        )) {
          matchingStudent = s
          break
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
        const hasSpecificStaffTarget = alvoGrupos.some(g => myStaffGroupNamesAndIds.includes(String(g).trim().toLowerCase())) ||
          alvoFuncs.some(f => myCandidateStaffIds.includes(String(f).replace(/^f_?/, '').trim().toLowerCase()))

        if (hasSpecificStaffTarget) {
          profileTarget = 'colaborador'
        } else if (typeof window !== 'undefined' && window.location.pathname.includes('/colaborador/')) {
          profileTarget = 'colaborador'
        } else {
          profileTarget = isStaffUser && !isFamily ? 'colaborador' : 'familia'
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

      if (eventType === 'DELETE' || match.isTarget || hasAnyTarget || !isFamily) {
        window.dispatchEvent(new CustomEvent(`ad:comunicados-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] })
      }

      if (eventType === 'INSERT' && (merged.status === 'enviado' || merged.dados?.status === 'enviado')) {
        const isMe =
          (merged.autorId && (myCandidateStaffIds.includes(String(merged.autorId).toLowerCase()) || String(merged.autorId) === String(currentUser?.id))) ||
          (merged.autor && currentUser?.nome &&
            String(merged.autor).trim().toLowerCase() === String(currentUser.nome).trim().toLowerCase())

        if (!isMe && match.isTarget) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
          
          const drawerLink = match.profileTarget === 'colaborador'
            ? `/agenda-digital/colaborador/comunicados?id=${merged.id}`
            : `/agenda-digital/${match.targetAlunoId || alunoId || (meusAlunos[0]?.id)}/comunicados?id=${merged.id}`

          addNotification({
            id: merged.id,
            type: 'comunicado',
            title: (hasDualAccess && match.profileTarget === 'colaborador' ? '[Institucional] ' : '') + (merged.titulo || 'Novo Comunicado'),
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

      if (eventType === 'DELETE' || match.isTarget || hasAnyTarget || !isFamily) {
        window.dispatchEvent(new CustomEvent(`ad:eventos_agenda-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'calendario'] })
      }

      if (eventType === 'INSERT' && match.isTarget) {
        window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        
        const drawerLink = match.profileTarget === 'colaborador'
          ? `/agenda-digital/colaborador/calendario`
          : `/agenda-digital/${match.targetAlunoId || alunoId || (meusAlunos[0]?.id)}/calendario`

        addNotification({
          id: row.id,
          type: 'evento',
          title: (hasDualAccess && match.profileTarget === 'colaborador' ? '[Institucional] ' : '') + (row.titulo || 'Novo Evento'),
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

      if (eventType === 'DELETE' || match.isTarget || hasAnyTarget || !isFamily) {
        window.dispatchEvent(new CustomEvent(`ad:momentos-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'momentos'] })
      }

      if (eventType === 'INSERT' && match.isTarget) {
        window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        
        const drawerLink = match.profileTarget === 'colaborador'
          ? `/agenda-digital/colaborador/momentos`
          : `/agenda-digital/${match.targetAlunoId || alunoId || (meusAlunos[0]?.id)}/momentos`

        addNotification({
          id: merged.id,
          type: 'momento',
          title: (hasDualAccess && match.profileTarget === 'colaborador' ? '[Institucional] ' : '') + (merged.titulo || 'Novo Momento'),
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

      const matchingStudent = meusAlunos.find(s => String(s.id) === rowAlunoId) || (alunoId === rowAlunoId ? alunoObj : null)
      const isForAluno = eventType === 'DELETE' || !!matchingStudent || rowAlunoId === String(alunoId) || !isFamily

      if (isForAluno) {
        window.dispatchEvent(new CustomEvent(`ad:ocorrencias-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'ocorrencias'] })

        if (eventType === 'INSERT') {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
          const targetSlug = matchingStudent?.id || alunoId || (meusAlunos[0]?.id)
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

      const matchingStudent = meusAlunos.find(s => String(s.id) === rowAlunoId || String(s.id).replace(/^0+/, '') === rowAlunoSemZero) || (alunoId === rowAlunoId ? alunoObj : null)
      const isForAluno = eventType === 'DELETE' || !!matchingStudent || rowAlunoId === String(alunoId) || !isFamily

      if (isForAluno) {
        window.dispatchEvent(new CustomEvent(`ad:boletins-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'boletins'] })

        if (eventType === 'INSERT') {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
          const targetSlug = matchingStudent?.id || alunoId || (meusAlunos[0]?.id)
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

      const matchingStudent = meusAlunos.find(s => String(s.id) === rowAlunoId) || (alunoId === rowAlunoId ? alunoObj : null)
      const isForAluno = eventType === 'DELETE' || !!matchingStudent || rowAlunoId === String(alunoId) || !isFamily

      if (isForAluno) {
        window.dispatchEvent(new CustomEvent(`ad:frequencias-${eventType.toLowerCase()}`, { detail: payload }))
        queryClient.invalidateQueries({ queryKey: ['agenda', 'frequencias'] })

        if (eventType === 'INSERT') {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
          const targetSlug = matchingStudent?.id || alunoId || (meusAlunos[0]?.id)
          const match: EventMatchResult = {
            isTarget: true,
            profileTarget: 'familia',
            targetAlunoId: targetSlug,
            targetAlunoNome: matchingStudent?.nome
          }

          addNotification({
            id: row.id,
            type: 'frequencia',
            title: 'Nova falta registrada',
            createdAt: row.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${targetSlug}/frequencia`,
          })

          showInAppToast({
            type: 'frequencia',
            id: row.id,
            title: 'Nova falta registrada',
            conteudo: 'Registro de frequência atualizado.',
            match,
          })
        }
      }
    })

    return () => {
      isMounted = false
      channels.forEach(c => supabase.removeChannel(c))
      console.log(`🔌 [Realtime] Canais desconectados.`)
    }
  }, [
    alunoId,
    currentUser?.id,
    currentUser?.perfil,
    turmaNome,
    typeof rawTurma === 'object' ? JSON.stringify(rawTurma) : String(rawTurma),
    meusAlunos,
    myCandidateStaffIds,
    myStaffGroupNamesAndIds,
    isStaffUser,
    hasDualAccess,
    handleOpenItem,
    showInAppToast
  ])

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
