import { useInfiniteQuery } from '@tanstack/react-query'
import { useApp } from '@/lib/context'

// --- COMUNICADOS ---
export function useQueryComunicados(
  fetchUrl: string | null = '/api/comunicados',
  pageSize: number = 20,
  options?: { enabled?: boolean }
) {
  const { currentUser } = useApp()
  const isEnabled = (options?.enabled !== false) && !!currentUser && !!fetchUrl
  const query = useInfiniteQuery({
    queryKey: ['agenda', 'comunicados', fetchUrl, currentUser?.id || 'anon', pageSize],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!currentUser || !fetchUrl) return [] 
      const url = new URL(fetchUrl, window.location.origin)
      url.searchParams.set('limit', String(pageSize))
      url.searchParams.set('offset', String(pageParam * pageSize))
      
      const res = await fetch(url.toString(), { credentials: 'include' })
      if (!res.ok) throw new Error('Falha ao buscar comunicados')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    getNextPageParam: (lastPage, allPages) => {
      return (lastPage && lastPage.length >= pageSize) ? allPages.length : undefined
    },
    staleTime: 0, // Considera dados imediatamente prontos para revalidação
    gcTime: 1000 * 60 * 10, // 10 min na memória para exibição em 0ms
    refetchOnWindowFocus: 'always', 
    refetchOnMount: 'always',
    enabled: isEnabled
  })

  return query
}

// --- MOMENTOS ---
export function useQueryMomentos(
  fetchUrl: string | null = '/api/agenda/momentos',
  pageSize: number = 20,
  options?: { enabled?: boolean }
) {
  const { currentUser } = useApp()
  const isEnabled = (options?.enabled !== false) && !!currentUser && !!fetchUrl
  const query = useInfiniteQuery({
    queryKey: ['agenda', 'momentos', fetchUrl, currentUser?.id || 'anon', pageSize],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!currentUser || !fetchUrl) return [] 
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
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: 'always',
    refetchOnMount: 'always',
    enabled: isEnabled
  })

  return query
}
