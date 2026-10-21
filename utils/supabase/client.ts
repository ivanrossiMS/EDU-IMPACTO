import { supabase } from '@/lib/supabase'

export function createClient() {
  // O listener global de onAuthStateChange (SIGNED_IN / TOKEN_REFRESHED -> saveSessionSecurely)
  // já é registrado de forma centralizada na inicialização do singleton em @/lib/supabase.
  return supabase;
}
