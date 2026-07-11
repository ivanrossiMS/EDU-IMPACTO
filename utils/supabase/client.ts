import { createBrowserClient } from '@supabase/ssr'
import { saveSessionSecurely } from '@/lib/auth/secureSession'

let isListenerAttached = false;

export function createClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  if (typeof window !== 'undefined' && !isListenerAttached) {
    isListenerAttached = true;
    supabase.auth.onAuthStateChange((event, session) => {
      // Quando a sessão é iniciada ou o token é renovado silenciosamente,
      // nós guardamos no Keychain/Keystore do Capacitor.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        saveSessionSecurely(session);
      }
    });
  }

  return supabase
}
