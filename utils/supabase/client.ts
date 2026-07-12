import { supabase } from '@/lib/supabase'
import { saveSessionSecurely } from '@/lib/auth/secureSession'

let isListenerAttached = false;

export function createClient() {
  const client = supabase;

  if (typeof window !== 'undefined' && !isListenerAttached) {
    isListenerAttached = true;
    client.auth.onAuthStateChange((event, session) => {
      // Quando a sessão é iniciada ou o token é renovado silenciosamente,
      // nós guardamos no Keychain/Keystore do Capacitor.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        saveSessionSecurely(session);
      }
    });
  }

  return client;
}
