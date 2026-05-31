'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { toast } from 'sonner'

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface UseAgendaRealtimeProps<T = any> {
  table: string
  event?: RealtimeEvent
  filter?: string
  onInsert?: (payload: { new: T; old: T | null }) => void
  onUpdate?: (payload: { new: T; old: T | null }) => void
  onDelete?: (payload: { new: T | null; old: T }) => void
  toastConfig?: {
    enabled: boolean
    insertMessage?: (data: T) => string
    updateMessage?: (data: T) => string
    icon?: React.ReactNode
  }
}

export function useAgendaRealtime<T = any>({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  toastConfig,
}: UseAgendaRealtimeProps<T>) {
  const { currentUser } = useApp()
  const params = useParams<{ slug: string }>()
  const dataCtx = useData()
  let agendaCtx: any = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    agendaCtx = useAgendaDigital()
  } catch (e) {}

  let alunoObj: any = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const selected = useSelectedStudent()
    if (selected && selected.aluno) alunoObj = selected.aluno
  } catch (e) {}

  const alunoId = params?.slug ? String(params.slug) : null
  const turmasArray = dataCtx?.turmas || []
  const rawTurma = alunoObj?.turma
  const resolvedTurmaObj = turmasArray.find(
    (t) => String(t.id) === String(rawTurma) || String(t.codigo) === String(rawTurma)
  )
  const turmaNome = resolvedTurmaObj?.nome || rawTurma

  // Refs para manter os callbacks atualizados sem causar re-render ou re-subscription
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)

  useEffect(() => {
    onInsertRef.current = onInsert
    onUpdateRef.current = onUpdate
    onDeleteRef.current = onDelete
  }, [onInsert, onUpdate, onDelete])

  // Lógica de visibilidade idêntica ao AgendaRealtimeProvider para segurança Client-Side
  const checkVisibility = (dados: any) => {
    if (!dados || !currentUser?.id) return false

    // Se a alteração foi feita por mim mesmo nesta aba, dependendo do design eu posso querer ignorar,
    // mas o state local precisa ser atualizado, então passamos a verificação adiante se necessário.
    
    const ensureStringArray = (val: any) => {
      if (!val) return []
      if (Array.isArray(val)) return val.map(String)
      return [String(val)]
    }

    const alvoTurmas = ensureStringArray(dados.turmas || dados.targetClasses)
    const alvoTurmasIds = ensureStringArray(dados.turmasIds || dados.targetClassesIds)
    const alvoAlunos = ensureStringArray(dados.alunosIds || dados.targetStudents)

    if (currentUser?.perfil === 'Administrador') return true

    if (alunoId) {
      const alunoStr = String(alunoId)
      const dest = String(dados.destino || '').toLowerCase()

      if (
        dest === 'todos' ||
        alvoTurmas.some((t) => {
          const tl = t.toLowerCase()
          return tl === 'todos' || tl === 'toda a escola' || tl === 'todas'
        })
      )
        return true

      const tNomeStr = turmaNome ? String(turmaNome).toLowerCase() : ''
      const rTurmaStr = rawTurma ? String(rawTurma).toLowerCase() : ''

      if (
        alvoTurmas.some((t) => {
          const tl = t.toLowerCase()
          if (tNomeStr && (tl.includes(tNomeStr) || tNomeStr.includes(tl))) return true
          if (rTurmaStr && (tl === rTurmaStr || tl.includes(rTurmaStr) || rTurmaStr.includes(tl)))
            return true
          return false
        })
      )
        return true

      if (
        alvoTurmasIds.some((t) => {
          const tl = t.toLowerCase()
          if (rTurmaStr && (tl === rTurmaStr || tl.includes(rTurmaStr) || rTurmaStr.includes(tl)))
            return true
          return false
        })
      )
        return true

      if (
        alvoAlunos.includes(alunoStr) ||
        alvoAlunos.includes(`a_${alunoStr}`) ||
        alvoAlunos.includes(`_ALU${alunoStr}`)
      )
        return true

      return false
    }

    if (currentUser?.perfil === 'Colaborador') {
      const dest = String(dados.destino || '').toLowerCase()
      if (
        dest === 'todos' ||
        alvoTurmas.some((t) => {
          const tl = t.toLowerCase()
          return tl === 'todos' || tl === 'toda a escola' || tl === 'todas'
        })
      )
        return true

      const userGroups = agendaCtx?.chatGroups || []
      const userTurmas = turmasArray.filter((t) => {
        return userGroups.some((g: any) => {
          let colabs = g.colaboradoresIds
          if (typeof colabs === 'string') {
            try {
              colabs = JSON.parse(colabs)
            } catch (e) {
              colabs = []
            }
          }
          if (!Array.isArray(colabs)) colabs = []
          if (!colabs.some((id: any) => String(id) === String(currentUser.id))) return false
          return (
            String(g.id) === `sync-${t.id}` ||
            String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase()
          )
        })
      })

      return userTurmas.some((t) => {
        const tNome = String(t.nome).toLowerCase()
        const tId = String(t.id).toLowerCase()
        const tCod = String(t.codigo).toLowerCase()

        return (
          alvoTurmas.some((alvo) => {
            const al = alvo.toLowerCase()
            return al === tNome || al.includes(tNome) || tNome.includes(al) || al === tId || al === tCod
          }) ||
          alvoTurmasIds.some((alvo) => {
            const al = alvo.toLowerCase()
            return al === tId || al === tCod
          })
        )
      })
    }

    return false
  }

  useEffect(() => {
    if (!currentUser?.id) return

    const channelName = `realtime-${table}-${alunoId || currentUser.id}-${Date.now()}`
    console.log(`[Realtime] 📡 Iniciando subscription para: ${table}`)

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table: table,
          filter: filter,
        },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const record = eventType === 'DELETE' ? oldRec : newRec

          // Verificação especial de segurança para ver se este registro pertence ao usuário atual
          // Para DELETE, talvez não tenhamos as relations, mas podemos confiar no filter via RLS ou ID
          // No entanto, para evitar problemas onde 'old' não tem 'turmas', passamos sempre.
          const isTarget = eventType === 'DELETE' ? true : checkVisibility(record)
          
          if (!isTarget) {
            console.log(`[Realtime] 🛑 Evento de ${table} ignorado (Não pertence a este perfil/aluno)`)
            return
          }

          if (eventType === 'INSERT') {
            if (onInsertRef.current) onInsertRef.current({ new: newRec as T, old: null })
            
            // Toasts para inserts
            if (toastConfig?.enabled && toastConfig.insertMessage) {
              // Verifica se não fui eu quem criou
              const isMine = String(newRec?.autorId || newRec?.criado_por || newRec?.responsavel_id) === String(currentUser?.id)
              if (!isMine) {
                toast.success(toastConfig.insertMessage(newRec as T), { icon: toastConfig.icon })
              }
            }
          } else if (eventType === 'UPDATE') {
            if (onUpdateRef.current) onUpdateRef.current({ new: newRec as T, old: oldRec as T })
            
            // Toasts para updates
            if (toastConfig?.enabled && toastConfig.updateMessage) {
              const isMine = String(newRec?.autorId || newRec?.criado_por || newRec?.responsavel_id) === String(currentUser?.id)
              if (!isMine) {
                toast.info(toastConfig.updateMessage(newRec as T), { icon: toastConfig.icon })
              }
            }
          } else if (eventType === 'DELETE') {
            if (onDeleteRef.current) onDeleteRef.current({ new: null, old: oldRec as T })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ✅ Conectado na tabela ${table}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] ❌ Erro ao conectar na tabela ${table}`)
        }
      })

    return () => {
      console.log(`[Realtime] 🧹 Limpando subscription para: ${table}`)
      supabase.removeChannel(channel)
    }
  }, [table, event, filter, currentUser?.id, alunoId]) // Não colocar onInsert/onUpdate/onDelete aqui, pois usamos refs
}
