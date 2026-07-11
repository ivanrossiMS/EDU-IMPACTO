import { clearSessionSecurely } from './secureSession';
import { Capacitor } from '@capacitor/core';

/**
 * Performs a complete logout by clearing secure storage,
 * calling the Next.js API to clear cookies, and optionally 
 * redirecting to the login screen.
 */
export async function performLogout() {
  // 1. Limpa a sessão do armazenamento seguro (Keychain/Keystore)
  await clearSessionSecurely();
  
  // 2. Limpa o localStorage local
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.startsWith('edu-'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => window.localStorage.removeItem(k));
  }

  try {
    // 3. Chama a API do servidor para destruir os cookies HTTP-only
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('[Auth] Failed to call logout endpoint:', error);
    // Mesmo falhando por rede, vamos seguir com o redirecionamento
  }

  // 4. Redireciona para a tela de login
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
