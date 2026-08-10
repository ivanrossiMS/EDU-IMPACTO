import { clearSessionSecurely } from './secureSession';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { createClient } from '@/utils/supabase/client';

/**
 * Performs a complete, nuclear logout by:
 * 1. Signing out Supabase Auth Client
 * 2. Clearing iOS Keychain / Android Keystore (SecureStorage)
 * 3. Clearing Capacitor Native Preferences
 * 4. Clearing window.localStorage
 * 5. Clearing window.sessionStorage
 * 6. Invoking the server API endpoint /api/auth/logout to clear HTTP-only cookies
 * 7. Redirecting cleanly to /login
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

  // 6. Call server API to expire HTTP-only cookies
  try {
    await fetch('/api/auth/logout', { 
      method: 'POST', 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    console.log('[Auth Logout] Server logout endpoint called.');
  } catch (error) {
    console.error('[Auth Logout] Failed to call logout endpoint:', error);
  }

  // 7. Atomic redirect to /login
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

