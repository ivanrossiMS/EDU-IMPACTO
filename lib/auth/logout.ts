import { clearSessionSecurely } from './secureSession';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { createClient } from '@/utils/supabase/client';

/**
 * Performs a complete, nuclear logout:
 * 1. Signs out Supabase Auth Client (global scope)
 * 2. Clears iOS Keychain / Android Keystore
 * 3. Clears Capacitor Native Preferences
 * 4. Clears window.localStorage and sessionStorage
 * 5. Calls POST /api/auth/logout to expire HTTP-only sb-* cookies on the server
 * 6. Navigates directly to /login using replace() — NO 302 redirect chain
 *
 * IMPORTANT (Capacitor iOS): Never use window.location.href = '/api/auth/logout'
 * because the WKWebView follows the server 302 redirect unreliably and the app
 * ends up on a blank white screen. Always do the cookie clearing via POST fetch
 * then navigate directly to /login.
 */
export async function performLogout() {
  console.log('[Auth Logout] Initiating full logout...');

  // 1. Sign out Supabase JS client
  try {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'global' });
  } catch (error) {
    console.error('[Auth Logout] Error signing out Supabase client:', error);
  }

  // 2. Clear iOS Keychain / Android Keystore
  try {
    await clearSessionSecurely();
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

  // 4. Clear window.localStorage
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.clear();
      console.log('[Auth Logout] localStorage cleared.');
    } catch (error) {
      console.error('[Auth Logout] Error clearing localStorage:', error);
    }
  }

  // 5. Clear window.sessionStorage
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      window.sessionStorage.clear();
      console.log('[Auth Logout] sessionStorage cleared.');
    } catch (error) {
      console.error('[Auth Logout] Error clearing sessionStorage:', error);
    }
  }

  // 6. Call POST /api/auth/logout to clear HTTP-Only server cookies WITHOUT following a redirect.
  //    This avoids the Capacitor WKWebView blank-screen bug caused by following 302s.
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

  // 7. Navigate directly to /login — no redirect chain, guaranteed to work on Capacitor iOS
  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
}

