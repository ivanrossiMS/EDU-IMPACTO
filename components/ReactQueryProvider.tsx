'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000 * 5, // 5 min cache otimizado para navegação instantânea
        gcTime: 24 * 60 * 60 * 1000, // 24h de retenção em cache para resiliência offline
        refetchOnWindowFocus: false, // Evita re-fetch excessivo ao alternar abas
        refetchOnReconnect: true, // Recarrega automaticamente ao restabelecer sinal de rede
        retry: 1 // Minimiza requests em caso de erro 500
      }
    }
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
