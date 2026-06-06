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
import { PushPermissionBanner } from '@/components/agenda/PushPermissionBanner'

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
  
  let agendaCtx: any = null;
  try {
    agendaCtx = useAgendaDigital();
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

        // Capacitor Native Check
        let isNative = false;
        try {
          const { Capacitor } = require('@capacitor/core');
          isNative = Capacitor.isNativePlatform();
        } catch (e) {}

        if (isNative) {
          console.log('📱 Rodando em ambiente Mobile Nativo via Capacitor');
          try {
            const OneSignalNative = require('onesignal-cordova-plugin').default;
            
            OneSignalNative.initialize(appId);
            OneSignalNative.Notifications.requestPermission(true);
            
            if (currentUser?.id) {
              OneSignalNative.login(String(currentUser.id));
              console.log(`✅ OneSignal Nativo logado para o Usuário: ${currentUser.id}`);
            }

            // Handle push deep linking natively
            OneSignalNative.Notifications.addEventListener('click', (event: any) => {
              const data = event.notification.additionalData;
              if (data && data.rota) {
                const alunoPushId = data.aluno_id || alunoId;
                if (alunoPushId) {
                  router.push(`/agenda-digital/${alunoPushId}/${data.rota}`);
                }
              }
            });
          } catch (nativeErr) {
            console.error('Erro ao inicializar OneSignal Nativo:', nativeErr);
          }
          return; // Skip the web setup
        }

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


            if (currentUser?.id && isMounted && typeof window !== 'undefined' && window.OneSignal) {
              try {
                // Em algumas versões do v16 o login pode falhar se o init não terminou 100%
                if (typeof window.OneSignal.login === 'function') {
                  await window.OneSignal.login(String(currentUser.id))
                  console.log(`✅ OneSignal logado para o Usuário: ${currentUser.id}`)
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
    if (!currentUser?.id) return

    const isAdminOrColab = currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Colaborador'
    const identifier = alunoId || currentUser.id

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

      const alvoTurmas = ensureStringArray(dados.turmas || dados.targetClasses || turmasStringArray)
      const alvoTurmasIds = ensureStringArray(dados.turmasIds || dados.targetClassesIds)
      const alvoAlunos = ensureStringArray(dados.alunosIds || dados.targetStudents)

      // Se for ADMIN, recebe tudo! (Eles monitoram o fluxo da escola toda)
      if (currentUser?.perfil === 'Administrador') return true

      // Lógica de visualização baseada no Aluno/Turma selecionada (Família/Aluno)
      if (alunoId) {
        const alunoStr = String(alunoId)
        const turmaNomeStr = String(turmaNome)
        const rawTurmaStr = String(rawTurma)

        const dest = String(dados.destino || '').toLowerCase()

        // Todos / Toda a Escola
        if (
          dest === 'todos' ||
          alvoTurmas.some(t => {
            const tl = t.toLowerCase()
            return tl === 'todos' || tl === 'toda a escola' || tl === 'todas'
          })
        ) return true

        // Turma Específica
        const tNomeStr = turmaNome ? String(turmaNome).toLowerCase() : ''
        const rTurmaStr = rawTurma ? String(rawTurma).toLowerCase() : ''

        if (alvoTurmas.some(t => {
          const tl = t.toLowerCase()
          if (tNomeStr && (tl.includes(tNomeStr) || tNomeStr.includes(tl))) return true
          if (rTurmaStr && (tl === rTurmaStr || tl.includes(rTurmaStr) || rTurmaStr.includes(tl))) return true
          return false
        })) return true

        if (alvoTurmasIds.some(t => {
          const tl = t.toLowerCase()
          if (rTurmaStr && (tl === rTurmaStr || tl.includes(rTurmaStr) || rTurmaStr.includes(tl))) return true
          return false
        })) return true

        // Aluno Específico
        if (
          alvoAlunos.includes(alunoStr) || 
          alvoAlunos.includes(`a_${alunoStr}`) || 
          alvoAlunos.includes(`_ALU${alunoStr}`)
        ) return true

        return false
      }

      // Lógica de visualização de Colaborador (Valida as turmas que o colaborador dá aula)
      if (currentUser?.perfil === 'Colaborador') {
        const dest = String(dados.destino || '').toLowerCase()
        if (
          dest === 'todos' ||
          alvoTurmas.some(t => {
            const tl = t.toLowerCase()
            return tl === 'todos' || tl === 'toda a escola' || tl === 'todas'
          })
        ) return true

        const userGroups = agendaCtx?.chatGroups || []
        const userTurmas = turmasArray.filter(t => {
           return userGroups.some((g: any) => {
             let colabs = g.colaboradoresIds;
             if (typeof colabs === 'string') {
               try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
             }
             if (!Array.isArray(colabs)) colabs = [];
             if (!colabs.some((id: any) => String(id) === String(currentUser.id))) return false;
             return String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase()
           })
        })

        return userTurmas.some(t => {
           const tNome = String(t.nome).toLowerCase()
           const tId = String(t.id).toLowerCase()
           const tCod = String(t.codigo).toLowerCase()
           
           return alvoTurmas.some(alvo => {
             const al = alvo.toLowerCase()
             return al === tNome || al.includes(tNome) || tNome.includes(al) ||
                    al === tId || al === tCod
           }) || alvoTurmasIds.some(alvo => {
             const al = alvo.toLowerCase()
             return al === tId || al === tCod
           })
        })
      }

      return false
    }

    // Usa um nome único para o canal para evitar erro de reaproveitar canal já inscrito (Strict Mode)
    const channelName = `agenda-realtime-events-${identifier}-${Date.now()}`
    const channel = supabase.channel(channelName)
      // --- COMUNICADOS ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, (payload) => {
        const { eventType, old, new: newRow } = payload;
        const row = eventType === 'DELETE' ? old : newRow;
        
        const newCom = { ...row, ...(row.dados || {}) }
        const isTarget = eventType === 'DELETE' ? true : isTargetingAluno(newCom);

        if (isTarget) {
          window.dispatchEvent(new CustomEvent(`ad:comunicados-${eventType.toLowerCase()}`, { detail: payload }));
          
          if (eventType === 'INSERT' && (row.status === 'enviado' || row.dados?.status === 'enviado')) {
            const isMe = (newCom.autorId && String(newCom.autorId) === String(currentUser?.id)) || 
                         (newCom.autor && currentUser?.nome && String(newCom.autor).trim().toLowerCase() === String(currentUser?.nome).trim().toLowerCase());
            
            if (!isMe) {
              addNotification({ id: newCom.id, type: 'comunicado', title: newCom.titulo, createdAt: newCom.created_at || new Date().toISOString(), read: false, link: `/agenda-digital/${alunoId}/comunicados` });
              toast.custom((t) => (
              <div className="flex items-center bg-white p-4 sm:p-5 rounded-[24px] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)] border border-gray-100 gap-3 sm:gap-4 pointer-events-auto w-max max-w-[95vw] mx-auto">
                <div className="relative flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#F5F2FF] flex items-center justify-center">
                  <Megaphone size={24} strokeWidth={1.5} className="text-[#694CF2]" />
                  <span className="absolute top-[2px] right-[2px] w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] bg-[#FE5062] border-[2px] sm:border-[2.5px] border-white rounded-full"></span>
                </div>
                <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                  <h4 className="text-[#1F1F1F] font-extrabold text-[15px] sm:text-[16px] leading-tight tracking-tight mb-0.5 sm:mb-1">Novo comunicado disponível!</h4>
                  <p className="text-[#848484] text-[12px] sm:text-[13.5px] leading-snug truncate sm:whitespace-normal">Acesse agora para não perder nenhuma novidade.</p>
                </div>
                <button onClick={() => { toast.dismiss(t); router.push(`/agenda-digital/${alunoId}/comunicados`); }} className="flex-shrink-0 bg-[#694CF2] hover:bg-[#5C3CE0] text-white text-[13px] sm:text-[14.5px] font-bold px-4 sm:px-6 py-2 sm:py-[10px] rounded-[12px] sm:rounded-[14px] transition-transform active:scale-95 shadow-[0_4px_12px_rgba(105,76,242,0.3)]">Ver agora</button>
                <button onClick={() => toast.dismiss(t)} className="flex-shrink-0 text-gray-400 hover:text-gray-800 transition-colors p-1"><X size={20} strokeWidth={2} /></button>
              </div>
            ), { duration: 10000, position: 'top-center' });
            }
          }
        }
      })
      // --- EVENTOS DE AGENDA (CALENDÁRIO) ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eventos_agenda' }, (payload) => {
        const { eventType, old, new: newRow } = payload;
        const row = eventType === 'DELETE' ? old : newRow;
        
        if (eventType === 'DELETE' || isTargetingAluno(row.dados, row.turmas)) {
          window.dispatchEvent(new CustomEvent(`ad:eventos_agenda-${eventType.toLowerCase()}`, { detail: payload }));
          
          if (eventType === 'INSERT') {
            addNotification({ id: row.id, type: 'evento', title: row.titulo, createdAt: row.created_at || new Date().toISOString(), read: false, link: `/agenda-digital/${alunoId}/calendario` });
            toast('Novo Evento no Calendário', { description: row.titulo, icon: <Calendar size={20} className="text-emerald-500" />, action: { label: 'Ver', onClick: () => router.push(`/agenda-digital/${alunoId}/calendario`) } })
          }
        }
      })
      // --- OCORRÊNCIAS ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ocorrencias' }, (payload) => {
        const { eventType, old, new: newRow } = payload;
        const row = eventType === 'DELETE' ? old : newRow;
        
        if (eventType === 'DELETE' || String(row.aluno_id) === String(alunoId) || String(row.dados?.aluno_id) === String(alunoId) || String(row.dados?.alunoId) === String(alunoId)) {
          window.dispatchEvent(new CustomEvent(`ad:ocorrencias-${eventType.toLowerCase()}`, { detail: payload }));
          
          if (eventType === 'INSERT') {
            addNotification({ id: row.id, type: 'ocorrencia', title: `Nova ocorrência: ${row.tipo}`, createdAt: row.created_at || new Date().toISOString(), read: false, link: `/agenda-digital/${alunoId}/ocorrencias` });
            toast('Nova Ocorrência', { description: `Foi registrada uma nova ocorrência: ${row.tipo}`, icon: <ShieldAlert size={20} className="text-red-500" />, action: { label: 'Abrir', onClick: () => router.push(`/agenda-digital/${alunoId}/ocorrencias`) } })
          }
        }
      })
      // --- BOLETINS (NOTAS) ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boletins' }, (payload) => {
        const { eventType, old, new: newRow } = payload;
        const row = eventType === 'DELETE' ? old : newRow;
        const alunoStr = String(alunoId);
        const alunoSemZero = alunoStr.replace(/^0+/, '');
        
        if (eventType === 'DELETE' || String(row.aluno_id) === alunoStr || String(row.aluno_id) === alunoSemZero) {
          window.dispatchEvent(new CustomEvent(`ad:boletins-${eventType.toLowerCase()}`, { detail: payload }));
          
          if (eventType === 'INSERT') {
            addNotification({ id: row.id, type: 'nota', title: 'Boletim de notas atualizado', createdAt: row.created_at || new Date().toISOString(), read: false, link: `/agenda-digital/${alunoId}/notas` });
            toast('Novas Notas Lançadas', { description: `O boletim de notas foi atualizado.`, icon: <FileText size={20} className="text-indigo-500" />, action: { label: 'Consultar', onClick: () => router.push(`/agenda-digital/${alunoId}/notas`) } })
          }
        }
      })
      // --- FREQUÊNCIAS ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'frequencias' }, (payload) => {
        const { eventType, old, new: newRow } = payload;
        const row = eventType === 'DELETE' ? old : newRow;
        
        if (eventType === 'DELETE' || String(row.aluno_id) === String(alunoId) || String(row.dados?.aluno_id) === String(alunoId)) {
          window.dispatchEvent(new CustomEvent(`ad:frequencias-${eventType.toLowerCase()}`, { detail: payload }));
          
          if (eventType === 'INSERT') {
            addNotification({ id: row.id, type: 'frequencia', title: 'Nova falta registrada', createdAt: row.created_at || new Date().toISOString(), read: false, link: `/agenda-digital/${alunoId}/frequencia` });
            toast('Nova Falta Registrada', { description: `Uma nova falta foi lançada no sistema.`, icon: <Calendar size={20} className="text-orange-500" />, action: { label: 'Verificar', onClick: () => router.push(`/agenda-digital/${alunoId}/frequencia`) } })
          }
        }
      })
      // --- MOMENTOS ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'momentos' }, (payload) => {
        const { eventType, old, new: newRow } = payload;
        const row = eventType === 'DELETE' ? old : newRow;
        const newCom = { ...row, ...(row.dados || {}) }
        
        if (eventType === 'DELETE' || isTargetingAluno(newCom)) {
          window.dispatchEvent(new CustomEvent(`ad:momentos-${eventType.toLowerCase()}`, { detail: payload }));
          
          if (eventType === 'INSERT') {
            addNotification({ id: newCom.id, type: 'momento', title: newCom.titulo || 'Novo Momento', createdAt: newCom.created_at || new Date().toISOString(), read: false, link: `/agenda-digital/${alunoId}/momentos` });
            toast('Novas Fotos/Vídeos', { description: newCom.titulo || 'Um novo momento foi compartilhado', icon: <ImageIcon size={20} className="text-pink-500" />, action: { label: 'Ver', onClick: () => router.push(`/agenda-digital/${alunoId}/momentos`) } })
          }
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
  }, [alunoId, isFamily, router, currentUser?.id, currentUser?.perfil, turmaNome, rawTurma])

  return (
    <>
      <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
      <PushPermissionBanner />
      <Toaster position="top-right" richColors />
      {children}
    </>
  )
}
