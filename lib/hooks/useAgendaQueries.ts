import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ADComunicado, ADMomento } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'

// --- COMUNICADOS ---
export function useQueryComunicados(
  isFamily: boolean,
  fetchUrl: string | null = '/api/comunicados'
) {
  const { currentUser } = useApp()
  const query = useQuery<ADComunicado[]>({
    queryKey: ['agenda', 'comunicados', fetchUrl],
    queryFn: async () => {
      if (!currentUser || isFamily || !fetchUrl) return [] 
      const res = await fetch(fetchUrl, { credentials: 'include' })
      if (!res.ok) throw new Error('Falha ao buscar comunicados')
      const data = await res.json()
      return Array.isArray(data) ? data : []
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
  fetchUrl: string | null = '/api/agenda/momentos'
) {
  const { currentUser } = useApp()
  const query = useQuery<ADMomento[]>({
    queryKey: ['agenda', 'momentos', fetchUrl],
    queryFn: async () => {
      if (!currentUser || isFamily || !fetchUrl) return [] 
      const res = await fetch(fetchUrl, { credentials: 'include' })
      if (!res.ok) throw new Error('Falha ao buscar momentos')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!currentUser && !isFamily && !!fetchUrl
  })

  return query
}
