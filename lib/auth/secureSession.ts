import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Capacitor } from '@capacitor/core';
import { SupabaseClient } from '@supabase/supabase-js';

const SESSION_KEY = 'edu_impacto_secure_session';

/**
 * Saves the Supabase session to Capacitor Secure Storage (Keychain/Keystore).
 */
export async function saveSessionSecurely(session: any) {
  if (!session || !session.access_token || !session.refresh_token) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.set({
        key: SESSION_KEY,
        value: JSON.stringify(session),
      });
      console.log('[Auth] Session saved securely.');
    } catch (error) {
      console.error('[Auth] Failed to save session securely:', error);
    }
  }
}

/**
 * Restores the Supabase session from Capacitor Secure Storage.
 * If found, it injects the session into the Supabase client, which will 
 * automatically refresh it if expired and re-issue the cookies for /api requests.
 */
export async function restoreSessionSecurely(supabase: SupabaseClient): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const { value } = await SecureStoragePlugin.get({ key: SESSION_KEY });
    if (value) {
      const session = JSON.parse(value);
      if (session?.access_token && session?.refresh_token) {
        console.log('[Auth] Restoring session from secure storage...');
        // Injetamos a sessão. Se estiver expirada, o Supabase usará o refresh_token automaticamente.
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        
        if (!error) {
          return true; // Restauração iniciada com sucesso
        } else {
          console.error('[Auth] Error setting session from secure storage:', error);
        }
      }
    }
  } catch (error) {
    // SecureStoragePlugin.get lança erro (Item not found) se a chave não existir.
    console.log('[Auth] No secure session found or error:', error);
  }
  return false;
}

/**
 * Clears the Supabase session from Capacitor Secure Storage.
 */
export async function clearSessionSecurely() {
  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.remove({ key: SESSION_KEY });
      console.log('[Auth] Secure session cleared.');
    } catch (error) {
      console.error('[Auth] Failed to clear secure session:', error);
    }
  }
}
