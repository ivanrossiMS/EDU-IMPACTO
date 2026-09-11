import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { SupabaseClient } from '@supabase/supabase-js';

const SESSION_KEY = 'edu_impacto_secure_session';

/**
 * Saves the Supabase session to Capacitor Secure Storage (Keychain/Keystore)
 * with multi-tier fallback to Preferences and localStorage.
 */
export async function saveSessionSecurely(session: any) {
  if (!session || !session.access_token || !session.refresh_token) return;

  const sessionStr = JSON.stringify(session);

  // 1. Native Secure Storage (Keychain / Android Keystore)
  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.set({
        key: SESSION_KEY,
        value: sessionStr,
      });
      console.log('[Auth] Session saved to SecureStorage.');
    } catch (error) {
      console.warn('[Auth] Failed to save session to SecureStorage:', error);
    }
  }

  // 2. Capacitor Preferences (Disk-backed native/web)
  try {
    await Preferences.set({ key: SESSION_KEY, value: sessionStr });
  } catch (e) {}

  // 3. Browser localStorage backup
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SESSION_KEY, sessionStr);
    } catch (e) {}
  }
}

/**
 * Restores the Supabase session from Capacitor Secure Storage or persistent backups.
 * If found, it injects the session into the Supabase client, which will 
 * automatically refresh it if expired and re-issue the cookies for /api requests.
 */
export async function restoreSessionSecurely(supabase: SupabaseClient): Promise<boolean> {
  let sessionStr: string | null = null;

  // 1. Tenta recuperar do SecureStorage (Keychain/Keystore)
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await SecureStoragePlugin.get({ key: SESSION_KEY });
      if (res?.value) sessionStr = res.value;
    } catch (error) {
      // Normal se ainda não tiver sessão salva
    }
  }

  // 2. Fallback: Capacitor Preferences
  if (!sessionStr) {
    try {
      const { value } = await Preferences.get({ key: SESSION_KEY });
      if (value) sessionStr = value;
    } catch (e) {}
  }

  // 3. Fallback: browser localStorage
  if (!sessionStr && typeof window !== 'undefined' && window.localStorage) {
    try {
      sessionStr = window.localStorage.getItem(SESSION_KEY);
    } catch (e) {}
  }

  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      if (session?.access_token && session?.refresh_token) {
        console.log('[Auth] Restoring session from persistent storage...');
        const { data, error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (!error && data?.session) {
          // Atualiza o backup com tokens renovados caso o setSession tenha atualizado
          saveSessionSecurely(data.session).catch(() => {});
          return true;
        } else if (error) {
          console.warn('[Auth] Error setting session from storage:', error.message);
          const errMsg = error.message?.toLowerCase() || '';
          const isNetworkError = errMsg.includes('load failed') || errMsg.includes('fetch failed') || errMsg.includes('network');
          if (isNetworkError) {
            const now = Math.floor(Date.now() / 1000);
            if (!session.expires_at || session.expires_at > now) {
              console.log('[Auth] Rede offline/instável ao restaurar sessão, mantendo sessão local ativa.');
              return true;
            }
          }
          // Se o refresh_token for explicitamente inválido, limpa
          if (errMsg.includes('invalid') || errMsg.includes('expired') || (error as any).status === 400) {
            await clearSessionSecurely();
          }
        }
      }
    } catch (parseError) {
      console.error('[Auth] Error parsing saved session:', parseError);
    }
  }

  return false;
}

/**
 * Clears the Supabase session from all storage tiers.
 */
export async function clearSessionSecurely() {
  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.remove({ key: SESSION_KEY });
      console.log('[Auth] Secure session cleared from Keychain/Keystore.');
    } catch (error) {}
  }
  try {
    await Preferences.remove({ key: SESSION_KEY });
  } catch (e) {}
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
}
