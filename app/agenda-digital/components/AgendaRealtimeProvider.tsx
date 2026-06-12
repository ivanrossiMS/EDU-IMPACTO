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

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Script from 'next/script'
import { useRouter, useParams } from 'next/navigation'
import { Calendar, FileText, Image as ImageIcon, ShieldAlert, Megaphone, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { ReportPayloadView } from '@/components/DynamicReports/ReportPayloadView'
import { PullToRefresh } from '@/components/PullToRefresh'
import { Capacitor } from '@capacitor/core'
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

  // Contextos opcionais — envoltos em try/catch para suportar rotas sem provider
  let alunoObj: any = null
  let turmasArray: any[] = []
  let agendaCtx: any = null

  try {
    const selected = useSelectedStudent()
    if (selected?.aluno) alunoObj = selected.aluno
  } catch {}

  try {
    agendaCtx = useAgendaDigital()
  } catch {}

  try {
    const dataCtx = useData()
    if (dataCtx?.turmas) turmasArray = dataCtx.turmas
  } catch {}

  const rawTurma = alunoObj?.turma
  const resolvedTurmaObj = turmasArray.find(
    t => String(t.id) === String(rawTurma) || String(t.codigo) === String(rawTurma)
  )
  const turmaNome = resolvedTurmaObj?.nome || rawTurma

  const alunoIdRef = useRef(alunoId)
  useEffect(() => {
    alunoIdRef.current = alunoId
  }, [alunoId])

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
          isNative = Capacitor.isNativePlatform()
        } catch {}

        if (isNative) {
          if (!window.__OS_INIT__) {
            console.log('📱 [OneSignal] Ambiente nativo detectado (Capacitor)')
            window.__OS_INIT__ = true
            try {
              const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
              OneSignalNative.initialize(appId)
              ;(window as any).__OS_NATIVE_READY__ = true
              
              // Deep link nativo
              OneSignalNative.Notifications.addEventListener('click', (event: any) => {
                const data = event?.notification?.additionalData || {}
                console.log('[OneSignal] Notificação nativa clicada:', data)
                
                if (data?.rota || data?.type) {
                  const slug = data.aluno_id || alunoIdRef.current
                  let route = ''

                  if (slug) {
                    route = `/agenda-digital/${slug}/${data.rota || typeToRoute(data.type)}`
                  } else {
                    route = `/agenda-digital/${data.rota || typeToRoute(data.type)}`
                  }

                  if (route) {
                    console.log(`[OneSignal] Deep link nativo → ${route}`)
                    router.push(route)
                  }
                }
              })
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

                    if (data?.rota || data?.type) {
                      const slug = data.aluno_id || alunoIdRef.current
                      let route = ''

                      if (slug) {
                        route = `/agenda-digital/${slug}/${data.rota || typeToRoute(data.type)}`
                      } else {
                        route = `/agenda-digital/${data.rota || typeToRoute(data.type)}`
                      }

                      if (route) {
                        console.log(`[OneSignal] Deep link web → ${route}`)
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

    const gerenciarUsuarioPush = async () => {
      try {
        let isNative = false
        try {
          isNative = Capacitor.isNativePlatform()
        } catch {}

        let OS: any = null
        if (isNative) {
          // Aguarda a inicialização nativa completar (appId) antes de logar
          if (!(window as any).__OS_NATIVE_READY__) {
             setTimeout(() => gerenciarUsuarioPush(), 200)
             return
          }
          const { default: OneSignalNative } = await import('@onesignal/capacitor-plugin')
          OS = OneSignalNative
        } else {
          OS = window.OneSignal
          // Se o script do OneSignal não carregou ainda, enfileirar
          if (!OS && window.OneSignalDeferred) {
             window.OneSignalDeferred.push(() => gerenciarUsuarioPush())
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

  // ── Supabase Realtime (In-App Toasts) ────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return

    const identifier = alunoId || String(currentUser.id)
    console.log('🎧 [Realtime] Iniciando escuta de eventos para:', identifier)

    const addNotification = useAgendaNotifications.getState().addNotification

    /**
     * Verifica se um evento Supabase é destinado ao usuário atual.
     * Lógica por perfil:
     * - Admin: recebe tudo
     * - Família/Aluno: filtra por turma ou aluno_id
     * - Colaborador: filtra por turmas que ministra aula
     */
    const isTargetingAluno = (dados: any): boolean => {
      if (!dados) return false

      const ensureStringArray = (val: any): string[] => {
        if (!val) return []
        if (Array.isArray(val)) return val.map(String)
        return [String(val)]
      }

      const alvoTurmas = ensureStringArray(dados.turmas || dados.targetClasses)
      const alvoTurmasIds = ensureStringArray(dados.turmasIds || dados.targetClassesIds)
      const alvoAlunos = ensureStringArray(dados.alunosIds || dados.targetStudents)
      const destino = String(dados.destino || '').toLowerCase().trim()

      // Admin recebe tudo
      if (currentUser?.perfil === 'Administrador') return true

      // Família/Aluno: filtra por turma ou aluno específico
      if (alunoId) {
        const alunoStr = String(alunoId)

        // Todos/Escola toda
        if (
          destino === 'todos' ||
          alvoTurmas.some(t => ['todos', 'toda a escola', 'todas', 'all'].includes(t.toLowerCase().trim()))
        ) return true

        // Turma específica
        const tNomeStr = turmaNome ? String(turmaNome).toLowerCase() : ''
        const rTurmaStr = rawTurma ? String(rawTurma).toLowerCase() : ''

        if (tNomeStr || rTurmaStr) {
          if (alvoTurmas.some(t => {
            const tl = t.toLowerCase().trim()
            return (tNomeStr && (tl === tNomeStr || tl.includes(tNomeStr) || tNomeStr.includes(tl))) ||
              (rTurmaStr && (tl === rTurmaStr || tl.includes(rTurmaStr) || rTurmaStr.includes(tl)))
          })) return true

          if (alvoTurmasIds.some(t => {
            const tl = t.toLowerCase().trim()
            return (rTurmaStr && (tl === rTurmaStr || tl.includes(rTurmaStr) || rTurmaStr.includes(tl)))
          })) return true
        }

        // Aluno específico (suporta prefixos legados)
        if (
          alvoAlunos.includes(alunoStr) ||
          alvoAlunos.includes(`a_${alunoStr}`) ||
          alvoAlunos.includes(`_ALU${alunoStr}`)
        ) return true

        return false
      }

      // Colaborador: filtra por turmas que ministra
      if (currentUser?.perfil === 'Colaborador') {
        if (
          destino === 'todos' ||
          alvoTurmas.some(t => ['todos', 'toda a escola', 'todas'].includes(t.toLowerCase().trim()))
        ) return true

        const userGroups = agendaCtx?.chatGroups || []
        const userTurmas = turmasArray.filter(t =>
          userGroups.some((g: any) => {
            let colabs = g.colaboradoresIds
            if (typeof colabs === 'string') {
              try { colabs = JSON.parse(colabs) } catch { colabs = [] }
            }
            if (!Array.isArray(colabs)) colabs = []
            return (
              colabs.some((id: any) => String(id) === String(currentUser.id)) &&
              (String(g.id) === `sync-${t.id}` ||
                String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase())
            )
          })
        )

        return userTurmas.some(t => {
          const tNome = String(t.nome || '').toLowerCase()
          const tId = String(t.id).toLowerCase()
          const tCod = String(t.codigo || '').toLowerCase()

          return (
            alvoTurmas.some(alvo => {
              const al = alvo.toLowerCase().trim()
              return al === tNome || al.includes(tNome) || tNome.includes(al) || al === tId || al === tCod
            }) ||
            alvoTurmasIds.some(alvo => {
              const al = alvo.toLowerCase().trim()
              return al === tId || al === tCod
            })
          )
        })
      }

      return false
    }

    // Canal único por sessão (evita conflitos do React Strict Mode)
    const channelName = `agenda-rt-${identifier}-${Date.now()}`
    let isMounted = true
    const channel = supabase
      .channel(channelName)

      // ── COMUNICADOS ──────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, payload => {
        const { eventType, old, new: newRow } = payload
        const row = eventType === 'DELETE' ? old : newRow
        const merged = { ...row, ...(row.dados || {}) }

        if (eventType === 'DELETE' || isTargetingAluno(merged)) {
          window.dispatchEvent(new CustomEvent(`ad:comunicados-${eventType.toLowerCase()}`, { detail: payload }))

          if (
            eventType === 'INSERT' &&
            (merged.status === 'enviado' || merged.dados?.status === 'enviado')
          ) {
            const isMe =
              (merged.autorId && String(merged.autorId) === String(currentUser?.id)) ||
              (merged.autor && currentUser?.nome &&
                String(merged.autor).trim().toLowerCase() === String(currentUser.nome).trim().toLowerCase())

            if (!isMe) {
              window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
              addNotification({
                id: merged.id,
                type: 'comunicado',
                title: merged.titulo,
                createdAt: merged.created_at || new Date().toISOString(),
                read: false,
                link: `/agenda-digital/${alunoId}/comunicados`,
              })

              toast.custom(t => (
                <div className="flex items-center bg-white p-4 sm:p-5 rounded-[24px] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)] border border-gray-100 gap-3 sm:gap-4 pointer-events-auto w-max max-w-[95vw] mx-auto">
                  <div className="relative flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#F5F2FF] flex items-center justify-center">
                    <Megaphone size={24} strokeWidth={1.5} className="text-[#694CF2]" />
                    <span className="absolute top-[2px] right-[2px] w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] bg-[#FE5062] border-[2px] sm:border-[2.5px] border-white rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                    <h4 className="text-[#1F1F1F] font-extrabold text-[15px] sm:text-[16px] leading-tight tracking-tight mb-0.5 sm:mb-1">
                      Novo comunicado disponível!
                    </h4>
                    <p className="text-[#848484] text-[12px] sm:text-[13.5px] leading-snug truncate sm:whitespace-normal">
                      Acesse agora para não perder nenhuma novidade.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      toast.dismiss(t)
                      router.push(`/agenda-digital/${alunoId}/comunicados`)
                    }}
                    className="flex-shrink-0 bg-[#694CF2] hover:bg-[#5C3CE0] text-white text-[13px] sm:text-[14.5px] font-bold px-4 sm:px-6 py-2 sm:py-[10px] rounded-[12px] sm:rounded-[14px] transition-transform active:scale-95 shadow-[0_4px_12px_rgba(105,76,242,0.3)]"
                  >
                    Ver agora
                  </button>
                  <button
                    onClick={() => toast.dismiss(t)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-800 transition-colors p-1"
                  >
                    <X size={20} strokeWidth={2} />
                  </button>
                </div>
              ), { duration: 10000, position: 'top-center' })
            }
          }
        }
      })

      // ── CALENDÁRIO ───────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos_agenda' }, payload => {
        const { eventType, old, new: newRow } = payload
        const row = eventType === 'DELETE' ? old : newRow

        if (eventType === 'DELETE' || isTargetingAluno({ ...row, ...(row.dados || {}), turmas: row.turmas })) {
          window.dispatchEvent(new CustomEvent(`ad:eventos_agenda-${eventType.toLowerCase()}`, { detail: payload }))

          if (eventType === 'INSERT') {
            window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
            addNotification({
              id: row.id,
              type: 'evento',
              title: row.titulo || 'Novo Evento',
              createdAt: row.created_at || new Date().toISOString(),
              read: false,
              link: `/agenda-digital/${alunoId}/calendario`,
            })
            toast('Novo Evento no Calendário', {
              description: row.titulo,
              icon: <Calendar size={20} className="text-emerald-500" />,
              action: { label: 'Ver', onClick: () => router.push(`/agenda-digital/${alunoId}/calendario`) },
            })
          }
        }
      })

      // ── OCORRÊNCIAS ──────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ocorrencias' }, payload => {
        const { eventType, old, new: newRow } = payload
        const row = eventType === 'DELETE' ? old : newRow

        const isForAluno =
          eventType === 'DELETE' ||
          String(row.aluno_id) === String(alunoId) ||
          String(row.dados?.aluno_id) === String(alunoId) ||
          String(row.dados?.alunoId) === String(alunoId)

        if (isForAluno) {
          window.dispatchEvent(new CustomEvent(`ad:ocorrencias-${eventType.toLowerCase()}`, { detail: payload }))

          if (eventType === 'INSERT') {
            window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
            addNotification({
              id: row.id,
              type: 'ocorrencia',
              title: `Nova ocorrência: ${row.tipo || row.dados?.tipo || 'Aviso'}`,
              createdAt: row.created_at || new Date().toISOString(),
              read: false,
              link: `/agenda-digital/${alunoId}/ocorrencias`,
            })
            toast('Nova Ocorrência', {
              description: `Foi registrada uma nova ocorrência.`,
              icon: <ShieldAlert size={20} className="text-red-500" />,
              action: { label: 'Abrir', onClick: () => router.push(`/agenda-digital/${alunoId}/ocorrencias`) },
            })
          }
        }
      })

      // ── BOLETINS (NOTAS) ─────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boletins' }, payload => {
        const { eventType, old, new: newRow } = payload
        const row = eventType === 'DELETE' ? old : newRow
        const alunoStr = String(alunoId)
        const alunoSemZero = alunoStr.replace(/^0+/, '')

        if (
          eventType === 'DELETE' ||
          String(row.aluno_id) === alunoStr ||
          String(row.aluno_id) === alunoSemZero
        ) {
          window.dispatchEvent(new CustomEvent(`ad:boletins-${eventType.toLowerCase()}`, { detail: payload }))

          if (eventType === 'INSERT') {
            window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
            addNotification({
              id: row.id,
              type: 'nota',
              title: 'Boletim de notas atualizado',
              createdAt: row.created_at || new Date().toISOString(),
              read: false,
              link: `/agenda-digital/${alunoId}/notas`,
            })
            toast('Novas Notas Lançadas', {
              description: 'O boletim de notas foi atualizado.',
              icon: <FileText size={20} className="text-indigo-500" />,
              action: { label: 'Consultar', onClick: () => router.push(`/agenda-digital/${alunoId}/notas`) },
            })
          }
        }
      })

      // ── FREQUÊNCIAS ──────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'frequencias' }, payload => {
        const { eventType, old, new: newRow } = payload
        const row = eventType === 'DELETE' ? old : newRow

        if (
          eventType === 'DELETE' ||
          String(row.aluno_id) === String(alunoId) ||
          String(row.dados?.aluno_id) === String(alunoId)
        ) {
          window.dispatchEvent(new CustomEvent(`ad:frequencias-${eventType.toLowerCase()}`, { detail: payload }))

          if (eventType === 'INSERT') {
            // Frequencia shouldn't have badge but we trigger update just in case for other modules sync
            window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
            addNotification({
              id: row.id,
              type: 'frequencia',
              title: 'Nova falta registrada',
              createdAt: row.created_at || new Date().toISOString(),
              read: false,
              link: `/agenda-digital/${alunoId}/frequencia`,
            })
            toast('Nova Falta Registrada', {
              description: 'Uma nova falta foi lançada no sistema.',
              icon: <Calendar size={20} className="text-orange-500" />,
              action: { label: 'Verificar', onClick: () => router.push(`/agenda-digital/${alunoId}/frequencia`) },
            })
          }
        }
      })

      // ── MOMENTOS ─────────────────────────────────────────────────────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'momentos' }, payload => {
        const { eventType, old, new: newRow } = payload
        const row = eventType === 'DELETE' ? old : newRow
        const merged = { ...row, ...(row.dados || {}) }

        if (eventType === 'DELETE' || isTargetingAluno(merged)) {
          window.dispatchEvent(new CustomEvent(`ad:momentos-${eventType.toLowerCase()}`, { detail: payload }))

          if (eventType === 'INSERT') {
            window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
            addNotification({
              id: merged.id,
              type: 'momento',
              title: merged.titulo || 'Novo Momento',
              createdAt: merged.created_at || new Date().toISOString(),
              read: false,
              link: `/agenda-digital/${alunoId}/momentos`,
            })
            toast('Novas Fotos/Vídeos', {
              description: merged.titulo || 'Um novo momento foi compartilhado',
              icon: <ImageIcon size={20} className="text-pink-500" />,
              action: { label: 'Ver', onClick: () => router.push(`/agenda-digital/${alunoId}/momentos`) },
            })
          }
        }
      })

      .subscribe(status => {
        if (!isMounted) return;
        if (status === 'SUBSCRIBED') {
          console.log(`✅ [Realtime] Conectado ao canal: ${channelName}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ [Realtime] Erro no canal: ${channelName}`)
        }
      })

    return () => {
      isMounted = false;
      supabase.removeChannel(channel)
      console.log(`🔌 [Realtime] Canal desconectado: ${channelName}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId, currentUser?.id, currentUser?.perfil, turmaNome, rawTurma])

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
    momentos: 'momentos',
    calendario: 'calendario',
    frequencia: 'frequencia',
    ocorrencias: 'ocorrencias',
    notas: 'notas',
    cobrancas: 'financeiro',
  }
  return map[type] || ''
}
