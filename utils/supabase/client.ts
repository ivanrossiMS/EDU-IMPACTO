import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Ao fechar o navegador, o Session Cookie é destruído.
    // Garantimos que o localStorage seja completamente limpo de modo a forçar o re-login.
    if (!document.cookie.includes('sb-')) {
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && (k.startsWith('sb-') || k.startsWith('edu-'))) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach(k => window.localStorage.removeItem(k))
    }
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
