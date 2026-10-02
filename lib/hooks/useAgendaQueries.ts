import { useInfiniteQuery } from '@tanstack/react-query'
import { useApp } from '@/lib/context'
import { apiFetch } from '@/lib/api/apiClient'

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
      url.searchParams.set('offset', String(pageParam))
      
      const res = await apiFetch(url.toString(), { credentials: 'include' })
      if (!res.ok) {
        console.warn('[useQueryComunicados] Falha ao buscar comunicados:', res.status)
        throw new Error(`Falha ao buscar comunicados (${res.status})`)
      }
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length < pageSize) return undefined
      return (typeof lastPageParam === 'number' ? lastPageParam : 0) + pageSize
    },
    staleTime: 1000 * 30, // 30s de retenção para estabilidade e navegação ágil
    gcTime: 1000 * 60 * 10, // 10 min na memória para exibição em 0ms
    refetchOnWindowFocus: false, // Evita re-fetch automático que cancela paginação ao clicar
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
      url.searchParams.set('offset', String(pageParam))
      
      const res = await apiFetch(url.toString(), { credentials: 'include' })
      if (!res.ok) {
        console.warn('[useQueryMomentos] Falha ao buscar momentos:', res.status)
        throw new Error(`Falha ao buscar momentos (${res.status})`)
      }
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length < pageSize) return undefined
      return (typeof lastPageParam === 'number' ? lastPageParam : 0) + pageSize
    },
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    enabled: isEnabled
  })

  return query
}
