import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ADComunicado, ADMomento } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'

// --- COMUNICADOS ---
export function useQueryComunicados(
  isFamily: boolean,
  fetchUrl: string | null = '/api/comunicados',
  pageSize: number = 30
) {
  const { currentUser } = useApp()
  const query = useInfiniteQuery({
    queryKey: ['agenda', 'comunicados', fetchUrl],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!currentUser || isFamily || !fetchUrl) return [] 
      const url = new URL(fetchUrl, window.location.origin)
      url.searchParams.set('limit', String(pageSize))
      url.searchParams.set('offset', String(pageParam * pageSize))
      
      const res = await fetch(url.toString(), { credentials: 'include' })
      if (!res.ok) throw new Error('Falha ao buscar comunicados')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === pageSize ? allPages.length : undefined
    },
    staleTime: 1000 * 60 * 5, // 5 min de cache fresco
    gcTime: 1000 * 60 * 10, // 10 min na memória
    refetchOnWindowFocus: false, 
    refetchOnMount: false,
    enabled: !!currentUser && !isFamily && !!fetchUrl
  })

  return query
}

// --- MOMENTOS ---
export function useQueryMomentos(
  isFamily: boolean,
  fetchUrl: string | null = '/api/agenda/momentos',
  pageSize: number = 20
) {
  const { currentUser } = useApp()
  const query = useInfiniteQuery({
    queryKey: ['agenda', 'momentos', fetchUrl],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!currentUser || isFamily || !fetchUrl) return [] 
      const url = new URL(fetchUrl, window.location.origin)
      url.searchParams.set('limit', String(pageSize))
      url.searchParams.set('offset', String(pageParam * pageSize))
      
      const res = await fetch(url.toString(), { credentials: 'include' })
      if (!res.ok) throw new Error('Falha ao buscar momentos')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === pageSize ? allPages.length : undefined
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!currentUser && !isFamily && !!fetchUrl
  })

  return query
}
