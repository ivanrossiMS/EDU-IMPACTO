'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { useRouter, useParams } from 'next/navigation'
import { BellRing, Calendar, FileText, Image as ImageIcon, CheckCircle, ShieldAlert, Megaphone, X } from 'lucide-react'
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
      
      // Helper para garantir que é array de strings
      const ensureStringArray = (val: any) => {
        if (!val) return []
        if (Array.isArray(val)) return val.map(String)
        return [String(val)]
      }

      // Converte tudo para string para evitar bug de [4697].includes("4697") === false
      const alvoTurmas = ensureStringArray(dados.turmas || dados.targetClasses || turmasStringArray)
      const alvoTurmasIds = ensureStringArray(dados.turmasIds)
      const alvoAlunos = ensureStringArray(dados.alunosIds || dados.targetStudents)

      const alunoStr = String(alunoId)
      const turmaNomeStr = String(turmaNome)
      const rawTurmaStr = String(rawTurma)

      console.log('--- DEBUG TARGETING ---')
      console.log('alvoTurmas:', alvoTurmas)
      console.log('alvoAlunos:', alvoAlunos)
      console.log('alunoStr (eu):', alunoStr)
      console.log('turmaNomeStr (eu):', turmaNomeStr)
      console.log('rawTurmaStr (eu):', rawTurmaStr)
      console.log('-----------------------')

      // Todos / Toda a Escola
      if (
        dados.destino === 'todos' ||
        dados.destino === 'Todos' ||
        alvoTurmas.includes('Todos') || 
        alvoTurmas.includes('Toda a Escola') || 
        alvoTurmas.includes('TODOS') || 
        alvoTurmas.includes('Toda a escola')
      ) return true

      // Turma Específica
      if (turmaNome && alvoTurmas.includes(turmaNomeStr)) return true
      if (rawTurma && alvoTurmas.includes(rawTurmaStr)) return true
      if (rawTurma && alvoTurmasIds.includes(rawTurmaStr)) return true

      // Aluno Específico
      if (
        alvoAlunos.includes(alunoStr) || 
        alvoAlunos.includes(`a_${alunoStr}`) || 
        alvoAlunos.includes(`_ALU${alunoStr}`)
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
        console.log('📦 DADOS DO COMUNICADO:', JSON.stringify(row, null, 2))
        
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
          toast.custom((t) => (
            <div className="flex items-center w-full sm:w-[400px] bg-white p-3.5 sm:p-4 rounded-[20px] sm:rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 gap-3 sm:gap-4 pointer-events-auto">
              {/* Ícone */}
              <div className="relative flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#F3F0FF] flex items-center justify-center">
                <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-[#6C48FA]" />
                <span className="absolute -top-0.5 -right-0.5 sm:top-0 sm:right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-[#FF4F64] border-2 border-white rounded-full"></span>
              </div>

              {/* Textos */}
              <div className="flex-1 min-w-0">
                <h4 className="text-gray-900 font-bold text-[14px] sm:text-[15px] leading-snug truncate">
                  Novo comunicado disponível!
                </h4>
                <p className="text-gray-500 text-[12px] sm:text-[13px] leading-snug mt-0.5 truncate pr-2">
                  Acesse agora para não perder nenhuma novidade.
                </p>
              </div>

              {/* Botão */}
              <button 
                onClick={() => {
                  toast.dismiss(t);
                  router.push(`/agenda-digital/${alunoId}/comunicados`);
                }}
                className="flex-shrink-0 bg-[#6C48FA] hover:bg-[#5a38dd] text-white text-[13px] sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-[10px] sm:rounded-[12px] transition-colors"
              >
                Ver agora
              </button>

              {/* Fechar */}
              <button 
                onClick={() => toast.dismiss(t)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors ml-0.5 sm:ml-1 p-1"
              >
                <X size={18} />
              </button>
            </div>
          ), {
            duration: 8000,
            position: 'top-center'
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
