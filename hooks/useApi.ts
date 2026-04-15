import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface ApiQueryOptions {
  /** Tiempo en ms que los datos se consideran "frescos" (sin re-fetch). Default: 30s */
  staleTime?: number
  /** Tiempo en ms que el cache se mantiene inactivo antes de ser descartado. Default: 5min */
  gcTime?: number
  /** Si true, desactiva el cache y añade timestamp a la URL (só para dados em tempo real crítico) */
  noCache?: boolean
  /** Desativa a query completamente enquanto false */
  enabled?: boolean
}

/**
 * useApiQuery: Wrapper corporativo com cache real via React Query.
 * staleTime padrão de 30s garante dados instantâneos em navegação,
 * com revalidação em background para manter frescor sem travar a UI.
 */
export function useApiQuery<T>(
  key: string[],
  url: string,
  params?: Record<string, any>,
  options: ApiQueryOptions = {}
) {
  const { staleTime = 30_000, gcTime = 300_000, noCache = false, enabled = true } = options

  let queryStr = ''
  if (params) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
    if (Object.keys(cleanParams).length > 0) {
      queryStr = '?' + new URLSearchParams(cleanParams as any).toString()
    }
  }

  return useQuery<T>({
    queryKey: [...key, params],
    enabled,
    staleTime,
    gcTime,
    queryFn: async () => {
      // noCache só para módulos que exigem dados absolutamente ao vivo (ex: caixa, PDV)
      const cacheBuster = noCache
        ? (queryStr ? `&_t=${Date.now()}` : `?_t=${Date.now()}`)
        : ''

      const fetchOptions: RequestInit = noCache
        ? { cache: 'no-store' }
        : { cache: 'default' }

      const res = await fetch(`${url}${queryStr}${cacheBuster}`, fetchOptions)
      if (!res.ok) throw new Error('Falha ao processar os dados.')
      return res.json()
    }
  })
}

/**
 * useApiMutation: Gerencia POST/PUT/DELETE com invalidação automática de cache.
 * Após sucesso: invalida as queryKeys especificadas, forçando refetch suave.
 */
export function useApiMutation<TVariables = any, TData = any>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  invalidateKeys?: string[][]
) {
  const queryClient = useQueryClient()

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (vars) => {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).error || 'Erro na operação do servidor')
      }
      return res.json()
    },
    onSuccess: () => {
      if (invalidateKeys) {
        invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key })
        })
      }
    }
  })
}
