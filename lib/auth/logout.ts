import { clearSessionSecurely } from './secureSession';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { createClient } from '@/utils/supabase/client';

const LOGOUT_FLAG = 'edu-logout-pending';
let logoutPromise: Promise<void> | null = null;

/**
 * Performs a complete, non-blocking nuclear logout:
 * 1. Clears window.localStorage and window.sessionStorage FIRST
 * 2. Clears iOS Keychain / Android Keystore
 * 3. Clears Capacitor Native Preferences
 * 4. Calls POST /api/auth/logout to clear HTTP-only server cookies and revoke token
 * 5. Calls Supabase local signOut with safe timeout and background error suppression
 * 6. Navigates cleanly to /login via replace()
 */
export async function performLogout(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('edu:logout-start'));
    } catch (_) {}
  }

  if (logoutPromise) {
    return logoutPromise;
  }

  logoutPromise = executeLogout();
  return logoutPromise;
}

async function executeLogout(): Promise<void> {
  console.log('[Auth Logout] Initiating full non-blocking logout...');

  // 1. Clear window.localStorage & sessionStorage IMMEDIATELY
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(LOGOUT_FLAG, '1');
      console.log('[Auth Logout] localStorage and sessionStorage wiped.');
    } catch (error) {
      console.error('[Auth Logout] Error clearing browser storage:', error);
    }
  }

  // 2. Clear iOS Keychain / Android Keystore
  try {
    await clearSessionSecurely();
    console.log('[Auth Logout] Secure session cleared.');
  } catch (error) {
    console.error('[Auth Logout] Error clearing secure session:', error);
  }

  // 3. Clear Capacitor Native Preferences (iOS/Android disk storage)
  if (Capacitor.isNativePlatform()) {
    try {
      await Preferences.clear();
      console.log('[Auth Logout] Capacitor Preferences cleared.');
    } catch (error) {
      console.error('[Auth Logout] Error clearing Capacitor Preferences:', error);
    }
  }

  // 4. Call POST /api/auth/logout to clear HTTP-Only server cookies
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
    });
    console.log('[Auth Logout] Server session cookies cleared via POST.');
  } catch (error) {
    console.error('[Auth Logout] Failed to clear server session cookies:', error);
  }

  // 5. Sign out Supabase JS client locally (server already revoked global session in step 4)
  try {
    const supabase = createClient();
    const signOutPromise = supabase.auth.signOut({ scope: 'local' })
      .catch((error) => {
        // Suppress any lock abortion or cancellation so it never causes unhandled promise rejection
        console.warn('[Auth Logout] Background signOut notice:', error?.message || error);
      });
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 800));
    await Promise.race([signOutPromise, timeoutPromise]);
  } catch (error) {
    console.warn('[Auth Logout] Supabase signOut error or timeout:', error);
  }

  // 6. Navigate directly to /login
  if (typeof window !== 'undefined') {
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    } else {
      window.location.reload();
    }
  }
}
