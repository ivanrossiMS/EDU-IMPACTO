'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { useRouter, useParams } from 'next/navigation'
import { BellRing, Calendar, FileText, Image as ImageIcon, CheckCircle, ShieldAlert } from 'lucide-react'
import { useApp } from '@/lib/context'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { toast, Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'

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

            // Força a janela de permissão de Push no centro da tela para garantir
            await OneSignal.Slidedown.promptPush()

            if (isFamily && responsavelId && isMounted) {
              await OneSignal.login(String(responsavelId))
              console.log(`✅ OneSignal logado para o Responsável: ${responsavelId}`)
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
      // if (turmaNome && alvoTurmas.includes(turmaNome)) return true

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
        if (row.status !== 'enviado' && row.dados?.status !== 'enviado') return
        if (isTargetingAluno(row.dados)) {
          toast('Novo Comunicado', {
            description: row.titulo,
            icon: <BellRing size={20} className="text-blue-500" />,
            action: { label: 'Ler', onClick: () => router.push(`/agenda-digital/${alunoId}/comunicados`) }
          })
        }
      })
      // --- MOMENTOS ---
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'momentos' }, (payload) => {
        const row = payload.new
        if (row.dados?.status !== 'approved') return
        if (isTargetingAluno(row.dados)) {
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
      <Toaster position="top-center" richColors />
      {children}
    </>
  )
}
