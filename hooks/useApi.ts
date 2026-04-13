import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * useApiQuery: Wrapper corporativo sobre o SWR/React Query.
 * Ele permite buscar dados usando cache, fallback seguro e revalidação automática
 */
export function useApiQuery<T>(key: string[], url: string, params?: Record<string, any>) {
  let queryStr = ''
  if (params) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    )
    if (Object.keys(cleanParams).length > 0) {
      queryStr = '?' + new URLSearchParams(cleanParams as any).toString()
    }
  }
  
  return useQuery<T>({
    queryKey: [...key, params],
    queryFn: async () => {
      // Otimização agressiva contra caches do Next.js e Browsers que ignoram a invalidação do React Query
      const buster = queryStr ? `&_t=${Date.now()}` : `?_t=${Date.now()}`
      const res = await fetch(`${url}${queryStr}${buster}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao processar os dados.')
      const data = await res.json()
      return data
    }
  })
}

/**
 * useApiMutation: Utilizado para gerenciar POST/PUT/DELETE.
 * Após a ação ser um sucesso, ele INVALIDA o cache da Query (pelo key)
 * fazendo a tabela atualizar sozinha como mágica, instantaneamente.
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
        const err = await res.json().catch(()=>({}))
        throw new Error(err.error || 'Erro na operação do servidor')
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
