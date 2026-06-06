import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ADComunicado, ADMomento } from '@/lib/agendaDigitalContext'

// --- COMUNICADOS ---
export function useQueryComunicados(
  isFamily: boolean,
  fetchUrl: string = '/api/comunicados'
) {
  const queryClient = useQueryClient()

  const query = useQuery<ADComunicado[]>({
    queryKey: ['agenda', 'comunicados', fetchUrl],
    queryFn: async () => {
      if (isFamily) return [] // Família busca na página local
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error('Falha ao buscar comunicados')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    staleTime: 1000 * 60 * 5, // 5 min
    enabled: !isFamily // Não roda o fetch global se for família
  })

  // Realtime Subscriptions
  useEffect(() => {
    if (isFamily) return // Realtime da família será feito localmente, ou mantemos global para toasts? Mantemos para toasts!
    
    const channelId = `comunicados_${Math.random().toString(36).substring(7)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comunicados' },
        (payload) => {
          // Toast Notification
          if (payload.eventType === 'INSERT') {
            const newDoc = payload.new as any
            const titulo = newDoc.dados?.titulo || newDoc.titulo || 'Novo Comunicado'
            toast.info('Novo Comunicado Recebido', { description: titulo })
          }

          // Invalidate Cache to fetch fresh data instantly without window focus
          queryClient.invalidateQueries({ queryKey: ['agenda', 'comunicados'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, isFamily])

  return query
}

// --- MOMENTOS ---
export function useQueryMomentos(
  isFamily: boolean,
  fetchUrl: string = '/api/agenda/momentos'
) {
  const queryClient = useQueryClient()

  const query = useQuery<ADMomento[]>({
    queryKey: ['agenda', 'momentos', fetchUrl],
    queryFn: async () => {
      if (isFamily) return [] // Família busca na página local
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error('Falha ao buscar momentos')
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    staleTime: 1000 * 60 * 5,
    enabled: !isFamily
  })

  // Realtime Subscriptions
  useEffect(() => {
    if (isFamily) return
    
    const channelId = `momentos_${Math.random().toString(36).substring(7)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'colecoes' }, // Assumindo que usa a tabela genérica ou 'momentos'?
        (payload) => {
          if (payload.new && (payload.new as any).tipo === 'agenda/momentos' || fetchUrl.includes('momentos')) {
            if (payload.eventType === 'INSERT') {
              toast.success('Nova Foto/Vídeo Publicado!', { description: 'Acesse a aba Momentos para visualizar.' })
            }
            queryClient.invalidateQueries({ queryKey: ['agenda', 'momentos'] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, isFamily, fetchUrl])

  return query
}
