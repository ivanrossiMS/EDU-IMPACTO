'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { useRouter, useParams } from 'next/navigation'
import { BellRing, Calendar, FileText, Image as ImageIcon, CheckCircle, ShieldAlert } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { toast, Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { useAgendaNotifications } from '../hooks/useAgendaNotifications'

interface RealtimeProviderProps {
  children?: React.ReactNode
}

declare global {
  interface Window {
    OneSignalDeferred?: any[]
    OneSignal?: any
  }
}

export function AgendaRealtimeProvider({
  children
}: RealtimeProviderProps) {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const { currentUser } = useApp()

  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'
  const responsavelId = currentUser?.id ? String(currentUser.id) : null
  const alunoId = params?.slug ? String(params.slug) : null

  // Tenta puxar o contexto do aluno selecionado se estivermos numa rota de família/aluno
  let alunoObj: any = null;
  let turmasArray: any[] = [];
  try {
    const selected = useSelectedStudent();
    if (selected && selected.aluno) alunoObj = selected.aluno;
  } catch(e) {}
  
  try {
    const dataCtx = useData();
    if (dataCtx && dataCtx.turmas) turmasArray = dataCtx.turmas;
  } catch(e) {}

  const rawTurma = alunoObj?.turma;
  const resolvedTurmaObj = turmasArray.find(t => String(t.id) === String(rawTurma) || String(t.codigo) === String(rawTurma));
  const turmaNome = resolvedTurmaObj?.nome || rawTurma;

  useEffect(() => {
    let isMounted = true

    // 1. Setup OneSignal (Push Notifications Native)
    const initOneSignal = async () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
        if (!appId) return

        // Vanilla OneSignal v16 Setup (Evita bugs do react-onesignal e Strict Mode)
        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push(async function(OneSignal: any) {
          try {
            if (!(window as any).__OS_INIT__) {
              // 1. Marca imediatamente como inicializado ANTES do await (resolve Race Condition do React Strict Mode)
              ;(window as any).__OS_INIT__ = true
              
              try {
                await OneSignal.init({
                  appId,
                  allowLocalhostAsSecureOrigin: true,
                  notifyButton: { enable: true },
                })
                console.log('🔔 OneSignal Inicializado com Sucesso!')
              } catch (initErr: any) {
                // Se já estiver inicializado por vias obscuras ou timeout, apenas logamos sem erro fatal
                if (initErr?.message?.includes('already initialized') || initErr?.message?.includes('Timeout')) {
                  console.warn('⚠️ OneSignal:', initErr.message)
                } else {
                  console.error('OneSignal Init Error:', initErr)
                  // Libera para tentar de novo no futuro se foi outro erro que não already initialized
                  ;(window as any).__OS_INIT__ = false
                }
              }
            }


            if (isFamily && responsavelId && isMounted && typeof window !== 'undefined' && window.OneSignal) {
              try {
                // Em algumas versões do v16 o login pode falhar se o init não terminou 100%
                if (typeof window.OneSignal.login === 'function') {
                  await window.OneSignal.login(String(responsavelId))
                  console.log(`✅ OneSignal logado para o Responsável: ${responsavelId}`)
                }
              } catch (loginErr: any) {
                console.warn('⚠️ OneSignal Login Error (Ignorável):', loginErr?.message || loginErr)
              }
            }
          } catch (e: any) {
            const msg = e?.message || String(e)
            if (msg.includes('already initialized') || msg.includes('Timeout')) {
              console.warn('⚠️ Aviso OneSignal:', msg)
            } else {
              console.error('OneSignal falhou na inicialização interna:', e)
            }
          }
        })
      } catch (err) {
        console.error('Falha ao inicializar OneSignal:', err)
      }
    }
    
    // Chama o init (deixando em background para não travar o React)
    initOneSignal()

    return () => {
      isMounted = false
    }
  }, [responsavelId, isFamily])

  useEffect(() => {
    // 2. Setup Supabase Realtime (In-App Toast Notifications)
    if (!isFamily || !alunoId) return

    console.log('🎧 Iniciando Supabase Realtime para notificações locais...')
    
    // Obtem metodo do store de notificacoes (sem destructuring reativo para evitar loops no useEffect)
    const addNotification = useAgendaNotifications.getState().addNotification;

    // Função auxiliar para verificar se o evento é para este aluno
    const isTargetingAluno = (dados: any, turmasStringArray?: string[]) => {
      if (!dados) return false
      
      // Verifica no Array do Supabase ou num objeto JSON (dependendo de como a tabela foi salva)
      const alvoTurmas = dados.turmas || dados.targetClasses || turmasStringArray || []
      const alvoAlunos = dados.alunosIds || dados.targetStudents || []

      // Todos / Toda a Escola
      if (
        alvoTurmas.includes('Todos') || 
        alvoTurmas.includes('Toda a Escola') || 
        alvoTurmas.includes('TODOS') || 
        alvoTurmas.includes('Toda a escola')
      ) return true

      // Turma Específica
      if (turmaNome && alvoTurmas.includes(turmaNome)) return true
      if (rawTurma && alvoTurmas.includes(rawTurma)) return true

      // Aluno Específico
      if (
        alvoAlunos.includes(alunoId) || 
        alvoAlunos.includes(`a_${alunoId}`) || 
        alvoAlunos.includes(`_ALU${alunoId}`)
      ) return true

      return false
    }

    // Usa um nome único para o canal para evitar erro de reaproveitar canal já inscrito (Strict Mode)
    const channelName = `agenda-realtime-events-${alunoId}-${Date.now()}`
    const channel = supabase.channel(channelName)
      // --- COMUNICADOS ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comunicados' }, (payload) => {
        const row = payload.new
        console.log('📡 REALTIME COMUNICADO RECEBIDO:', row.id, row.titulo)
        if (row.status !== 'enviado' && row.dados?.status !== 'enviado') {
           console.log('📡 REALTIME IGNORADO: status nao é enviado')
           return
        }
        
        const newCom = { ...row, ...(row.dados || {}) }
        
        if (isTargetingAluno(newCom)) {
          console.log('🎯 TARGETING ALUNO CONFIRMADO! Disparando evento visual...')
          // 1. Emit Event for page.tsx to pick up and auto-append
          window.dispatchEvent(new CustomEvent('ad:comunicado-inserted', { detail: newCom }));
          
          // 2. Atualiza o Store Global (Incrementa o Badge vermelho)
          addNotification({
            id: newCom.id,
            type: 'comunicado',
            title: newCom.titulo,
            createdAt: newCom.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${alunoId}/comunicados`
          });
          
          // 3. Show Standard Modern Toast (Garante que vai aparecer)
          toast.success('Novo comunicado recebido!', {
            description: newCom.titulo,
            duration: 8000,
            position: 'top-right',
            action: {
              label: 'Ver agora',
              onClick: () => router.push(`/agenda-digital/${alunoId}/comunicados`)
            }
          });
        }
      })
      // --- MOMENTOS ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'momentos' }, (payload) => {
        const row = payload.new
        if (row.dados?.status !== 'approved') return
        if (isTargetingAluno(row.dados)) {
          addNotification({
            id: row.id,
            type: 'momento',
            title: row.titulo,
            createdAt: row.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${alunoId}/momentos`
          });
          toast('Novo Momento Compartilhado', {
            description: row.titulo,
            icon: <ImageIcon size={20} className="text-purple-500" />,
            action: { label: 'Ver Foto/Vídeo', onClick: () => router.push(`/agenda-digital/${alunoId}/momentos`) }
          })
        }
      })
      // --- EVENTOS DE AGENDA (CALENDÁRIO) ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos_agenda' }, (payload) => {
        const row = payload.new
        // eventos_agenda salva 'turmas' na raiz e não no jsonb dados geralmente, ou em dados
        if (isTargetingAluno(row.dados, row.turmas)) {
          addNotification({
            id: row.id,
            type: 'evento',
            title: row.titulo,
            createdAt: row.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${alunoId}/calendario`
          });
          toast('Novo Evento no Calendário', {
            description: row.titulo,
            icon: <Calendar size={20} className="text-emerald-500" />,
            action: { label: 'Ver', onClick: () => router.push(`/agenda-digital/${alunoId}/calendario`) }
          })
        }
      })
      // --- OCORRÊNCIAS ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ocorrencias' }, (payload) => {
        const row = payload.new
        if (String(row.aluno_id) === String(alunoId) || String(row.dados?.aluno_id) === String(alunoId) || String(row.dados?.alunoId) === String(alunoId)) {
          addNotification({
            id: row.id,
            type: 'ocorrencia',
            title: `Nova ocorrência: ${row.tipo}`,
            createdAt: row.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${alunoId}/ocorrencias`
          });
          toast('Nova Ocorrência', {
            description: `Foi registrada uma nova ocorrência: ${row.tipo}`,
            icon: <ShieldAlert size={20} className="text-red-500" />,
            action: { label: 'Abrir', onClick: () => router.push(`/agenda-digital/${alunoId}/ocorrencias`) }
          })
        }
      })
      // --- BOLETINS (NOTAS) ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'boletins' }, (payload) => {
        const row = payload.new
        const alunoStr = String(alunoId)
        const alunoSemZero = alunoStr.replace(/^0+/, '')
        if (String(row.aluno_id) === alunoStr || String(row.aluno_id) === alunoSemZero) {
          addNotification({
            id: row.id,
            type: 'nota',
            title: 'Boletim de notas atualizado',
            createdAt: row.created_at || new Date().toISOString(),
            read: false,
            link: `/agenda-digital/${alunoId}/notas`
          });
          toast('Novas Notas Lançadas', {
            description: `O boletim de notas foi atualizado.`,
            icon: <FileText size={20} className="text-indigo-500" />,
            action: { label: 'Consultar', onClick: () => router.push(`/agenda-digital/${alunoId}/notas`) }
          })
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conectado ao Supabase Realtime (Notificações In-App)')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [alunoId, isFamily, router])

  return (
    <>
      <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
      <Toaster position="top-right" richColors />
      {children}
    </>
  )
}
