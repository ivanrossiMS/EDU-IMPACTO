import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_KEY = 'edu_impacto_secure_session';

/**
 * Checks if the current error represents a temporary network failure or timeout
 * rather than a permanent token revocation.
 */
export function isNetworkOrTransientError(error: any): boolean {
  if (!error) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;

  const errMsg = (error.message || '').toLowerCase();
  const errName = (error.name || '').toLowerCase();
  const status = error.status || error.statusCode || 0;
  const causeMsg = (error.cause?.message || '').toLowerCase();

  return (
    errName === 'authretryablefetcherror' ||
    errName === 'aborterror' ||
    errMsg.includes('failed to fetch') ||
    errMsg.includes('load failed') ||
    errMsg.includes('network') ||
    errMsg.includes('timeout') ||
    errMsg.includes('timed out') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('etimedout') ||
    causeMsg.includes('failed to fetch') ||
    causeMsg.includes('network') ||
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 522
  );
}

/**
 * Checks if the error indicates that the refresh token was permanently revoked,
 * invalid, or rotated by another device.
 */
export function isPermanentTokenRevocation(error: any): boolean {
  if (!error) return false;
  const errMsg = (error.message || '').toLowerCase();
  const errCode = (error.code || error.error_code || '').toLowerCase();
  const status = error.status || error.statusCode || 0;

  return (
    errCode === 'refresh_token_not_found' ||
    errCode === 'invalid_grant' ||
    errCode === 'invalid_refresh_token' ||
    errMsg.includes('refresh token not found') ||
    errMsg.includes('invalid refresh token') ||
    errMsg.includes('invalid_grant') ||
    errMsg.includes('token is expired by') ||
    (status === 400 && !isNetworkOrTransientError(error))
  );
}

/**
 * Validates whether a stored session object has the required tokens.
 */
export function isValidSessionObject(session: any): session is { access_token: string; refresh_token: string; expires_at?: number; [key: string]: any } {
  return Boolean(
    session &&
    typeof session === 'object' &&
    typeof session.access_token === 'string' &&
    session.access_token.length > 0 &&
    typeof session.refresh_token === 'string' &&
    session.refresh_token.length > 0
  );
}

/**
 * Checks if the session is already expired or will expire within thresholdSeconds.
 */
export function isSessionExpiredOrExpiringSoon(session: any, thresholdSeconds = 300): boolean {
  if (!isValidSessionObject(session)) return true;
  const expiresAt = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  return expiresAt <= (now + thresholdSeconds);
}

/**
 * Retrieves the raw session string from any available storage tier,
 * prioritising native Keychain/Keystore on mobile platforms.
 */
export async function getSessionFromStorageTiers(): Promise<any | null> {
  let sessionStr: string | null = null;

  // 1. Native Secure Storage (Keychain on iOS / Android Keystore)
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await SecureStoragePlugin.get({ key: SESSION_KEY });
      if (res?.value) sessionStr = res.value;
    } catch {
      // Key may not exist yet
    }
  }

  // 2. Capacitor Preferences (Disk-backed native/web)
  if (!sessionStr) {
    try {
      const { value } = await Preferences.get({ key: SESSION_KEY });
      if (value) sessionStr = value;
    } catch {}
  }

  // 3. Browser localStorage backup
  if (!sessionStr && typeof window !== 'undefined' && window.localStorage) {
    try {
      sessionStr = window.localStorage.getItem(SESSION_KEY);
    } catch {}
  }

  if (sessionStr) {
    try {
      const parsed = JSON.parse(sessionStr);
      if (isValidSessionObject(parsed)) {
        return parsed;
      }
    } catch {}
  }

  return null;
}

/**
 * Saves the Supabase session across all persistence tiers:
 * 1. Native Secure Storage (Keychain/Keystore)
 * 2. Capacitor Preferences (Disk-backed native)
 * 3. Browser localStorage
 */
export async function saveSessionSecurely(session: any) {
  if (!isValidSessionObject(session)) return;

  const sessionStr = JSON.stringify(session);

  // 1. Native Secure Storage (Keychain / Android Keystore)
  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.set({
        key: SESSION_KEY,
        value: sessionStr,
      });
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
 * Centralized Promise Deduplication Lock for Token Refresh.
 * Prevents multiple concurrent refresh calls from racing and invalidating
 * Supabase's single-use rotating refresh tokens.
 */
let inFlightRefreshPromise: Promise<any> | null = null;

export async function refreshSessionCentralized(supabase: SupabaseClient): Promise<{
  session: any | null;
  error: any | null;
}> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      // If client is known to be offline, avoid network trip and return existing session
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('[Auth] Dispositivo offline detectado — mantendo sessão local sem refresh.');
        const cached = await getSessionFromStorageTiers();
        return { session: cached, error: null };
      }

      console.log('[Auth] Renovando sessão Supabase centralizada...');
      const { data, error } = await supabase.auth.refreshSession();

      if (!error && data?.session) {
        console.log('[Auth] Sessão renovada com sucesso.');
        await saveSessionSecurely(data.session);
        return { session: data.session, error: null };
      }

      if (error) {
        if (isPermanentTokenRevocation(error)) {
          console.warn('[Auth] Token de atualização revogado ou inválido:', error.message);
          await clearSessionSecurely();
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          return { session: null, error };
        }

        if (isNetworkOrTransientError(error)) {
          console.warn('[Auth] Falha temporária de rede ao renovar sessão. Preservando sessão local.');
          const cached = await getSessionFromStorageTiers();
          return { session: cached, error };
        }

        console.warn('[Auth] Erro ao renovar sessão:', error.message);
      }

      return { session: null, error };
    } catch (err: any) {
      if (isNetworkOrTransientError(err)) {
        console.warn('[Auth] Exceção de rede no refresh centralizado. Preservando sessão local:', err?.message);
        const cached = await getSessionFromStorageTiers();
        return { session: cached, error: err };
      }
      return { session: null, error: err };
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
}

let inFlightRestorePromise: Promise<boolean> | null = null;

/**
 * Restores the Supabase session from Capacitor Secure Storage (Keychain/Keystore)
 * or persistent backups with complete deduplication and offline resilience.
 */
export async function restoreSessionSecurely(supabase: SupabaseClient): Promise<boolean> {
  if (inFlightRestorePromise) {
    return inFlightRestorePromise;
  }

  inFlightRestorePromise = (async () => {
    try {
      // 1. Verifica se o Supabase já possui uma sessão ativa válida e não expirada em memória
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSession = sessionData?.session;
        if (currentSession && isValidSessionObject(currentSession)) {
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = currentSession.expires_at || 0;
          if (expiresAt > now + 60) {
            // Sessão válida por pelo menos mais 1 minuto
            return true;
          }
        }
      } catch (e) {}

      // 2. Tenta recuperar dos níveis de persistência (Keychain -> Preferences -> localStorage)
      const storedSession = await getSessionFromStorageTiers();

      if (storedSession && isValidSessionObject(storedSession)) {
        console.log('[Auth] Restaurando sessão do armazenamento persistente seguro...');

        // Injeta a sessão no cliente Supabase
        const { data, error } = await supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        if (!error && data?.session) {
          await saveSessionSecurely(data.session);
          return true;
        }

        if (error) {
          // Erro de rede / offline
          if (isNetworkOrTransientError(error)) {
            console.log('[Auth] Rede offline/instável ao restaurar sessão. Mantendo sessão local ativa.');
            return true;
          }

          // Se for revogação permanente (ex: invalid_grant / refresh_token_not_found)
          if (isPermanentTokenRevocation(error)) {
            console.warn('[Auth] Token de sessão permanentemente revogado:', error.message);
            await clearSessionSecurely();
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            return false;
          }

          // Para outros erros transitórios, se temos refresh token guardado, não apague!
          console.warn('[Auth] Erro transitório no setSession. Preservando credenciais locais:', error.message);
          return true;
        }
      }

      return false;
    } catch (err: any) {
      if (isNetworkOrTransientError(err)) {
        console.warn('[Auth] Falha de rede ao restaurar sessão. Mantendo sessão.');
        return true;
      }
      console.error('[Auth] Erro inesperado ao restaurar sessão:', err);
      return false;
    } finally {
      inFlightRestorePromise = null;
    }
  })();

  return inFlightRestorePromise;
}

/**
 * Clears the Supabase session from all storage tiers (called ONLY on explicit logout
 * or verified permanent token revocation).
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
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => window.localStorage.removeItem(k));
    } catch (e) {}
  }
}
