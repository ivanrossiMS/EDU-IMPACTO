import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'

export interface UnreadStats {
  unreadMural: number
  unreadChat: number
  unreadMomentos: number
  unreadCalendario: number
  unreadOcorrencias: number
  unreadNotas: number
  unreadFrequencia: number
}

const defaultStats: UnreadStats = {
  unreadMural: 0,
  unreadChat: 0,
  unreadMomentos: 0,
  unreadCalendario: 0,
  unreadOcorrencias: 0,
  unreadNotas: 0,
  unreadFrequencia: 0
}

export function useAgendaBadges(alunoId?: string | null) {
  const { currentUser } = useApp()
  const [unreadStats, setUnreadStats] = useState<UnreadStats>(defaultStats)

  useEffect(() => {
    // If it's a family user, we MUST have an alunoId to fetch their badges.
    const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável'
    if (isFamily && !alunoId && alunoId !== 'colaborador') {
      return
    }

    let isMounted = true

    const fetchUnread = async () => {
      try {
        const url = alunoId && alunoId !== 'colaborador' 
          ? `/api/agenda/notificacoes/unread?aluno_id=${alunoId}`
          : `/api/agenda/notificacoes/unread`
          
        const res = await fetch(url)
        const contentType = res.headers.get("content-type");
        if (res.ok && isMounted && contentType?.includes("application/json")) {
          const data = await res.json()
          setUnreadStats(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
            return data;
          })
        }
      } catch (e) {
        console.error('Failed to fetch agenda badges', e)
      }
    }

    // Inicial fetch
    fetchUnread()

    // Este evento genérico é disparado quando o usuário lê algo
    // OU quando o AgendaRealtimeProvider capta um novo INSERT no banco via supabase realtime.
    const handleUpdate = () => {
      fetchUnread()
    }
    
    window.addEventListener('agenda-digital:unread-updated', handleUpdate)

    // Fallback polling de 30s para garantir
    const interval = setInterval(fetchUnread, 30000)
    
    return () => { 
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('agenda-digital:unread-updated', handleUpdate)
    }
  }, [currentUser?.perfil, currentUser?.cargo, alunoId])

  return unreadStats
}
