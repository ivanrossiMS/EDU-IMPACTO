import { clearSessionSecurely, clearSessionCookiesOnClient, setLogoutBarrier, getProjectStorageKey, SESSION_KEY } from './secureSession';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { createClient } from '@/utils/supabase/client';
import { removeSettingAsync } from '@/lib/context';
import { notificationService } from '@/lib/notifications/notificationService';

const LOGOUT_FLAG = 'edu-logout-pending';
let logoutPromise: Promise<void> | null = null;

/**
 * Realiza logout atômico e cirúrgico:
 * 1. Ativa a barreira de logout persistente contra respostas HTTP atrasadas
 * 2. Limpa cookies no navegador imediatamente (inclusive offline)
 * 3. Limpa exclusivamente chaves de autenticação no localStorage/sessionStorage,
 *    preservando preferências de dispositivo independentes (tema, etc)
 * 4. Remove credenciais do Keychain/Keystore e Preferences
 * 5. Notifica o servidor via POST /api/auth/logout (com no-store)
 * 6. Executa signOut local do Supabase
 * 7. Redireciona de forma limpa para /login
 */
export async function performLogout(userId?: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('edu:logout-start'));
    } catch (_) {}
  }

  if (logoutPromise) {
    return logoutPromise;
  }

  logoutPromise = executeLogout(userId);
  try {
    await logoutPromise;
  } finally {
    logoutPromise = null;
  }
}

async function executeLogout(userId?: string): Promise<void> {
  console.log('[Auth Logout] Iniciando logout cirúrgico e não-destrutivo...');

  // 1. Ativa a barreira de logout persistente
  setLogoutBarrier(userId);

  // 2. Limpa cookies de sessão no cliente imediatamente (proteção para logout offline)
  clearSessionCookiesOnClient();

  // 3. Limpa seletivamente chaves de autenticação do browser, preservando preferências de UI
  const projectStorageKey = getProjectStorageKey();
  if (typeof window !== 'undefined') {
    try {
      const keysToClear = [
        SESSION_KEY,
        projectStorageKey,
        'edu-current-user',
        'edu-current-perfil',
        'edu_auth_user',
        'edu-active-modules',
        LOGOUT_FLAG,
      ];
      if (userId) {
        keysToClear.push(
          `edu-user-photo-${userId}`,
          `edu-profile-extra-${userId}`,
          `edu-active-modules-${userId}`,
          `edu-active-unit-${userId}`
        );
      }
      keysToClear.forEach(k => window.localStorage.removeItem(k));
      window.localStorage.setItem(LOGOUT_FLAG, '1');
      window.sessionStorage.clear();
      console.log('[Auth Logout] Chaves de autenticação do usuário removidas com sucesso.');
    } catch (error) {
      console.error('[Auth Logout] Erro ao limpar chaves do storage:', error);
    }
  }

  // 4. Executa tarefas de limpeza assíncronas em paralelo com tempos limite curtos
  const cleanupTasks: Promise<any>[] = [
    // a) Hardware / Keychain / Keystore / Preferences
    (async () => {
      try {
        await clearSessionSecurely(userId);
        await Promise.allSettled([
          removeSettingAsync('edu-current-user'),
          removeSettingAsync('edu-current-perfil'),
          removeSettingAsync('edu_auth_user'),
          removeSettingAsync('edu-active-modules'),
        ]);
        console.log('[Auth Logout] Sessão segura removida do hardware e storage.');
      } catch (error) {
        console.error('[Auth Logout] Erro ao limpar sessão segura:', error);
      }
    })(),

    // b) Notifica o servidor via POST /api/auth/logout com timeout de 1.8s
    fetch('/api/auth/logout', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(1800),
    })
      .then(() => console.log('[Auth Logout] Cookies de sessão revogados via POST.'))
      .catch((error) => console.warn('[Auth Logout] Aviso ao notificar servidor:', error)),

    // c) SignOut local no GoTrueClient do Supabase (com timeout de 500ms)
    (async () => {
      try {
        const supabase = createClient();
        const signOutPromise = supabase.auth.signOut({ scope: 'local' })
          .catch((error) => console.warn('[Auth Logout] Aviso no signOut Supabase:', error?.message || error));
        await Promise.race([signOutPromise, new Promise((resolve) => setTimeout(resolve, 500))]);
      } catch (error) {
        console.warn('[Auth Logout] Erro no timeout do signOut:', error);
      }
    })(),

    // d) Desassociação no OneSignal
    notificationService.clearUser()
      .then(() => console.log('[Auth Logout] Usuário desassociado do OneSignal.'))
      .catch((error) => console.warn('[Auth Logout] Erro ao desassociar OneSignal:', error)),
  ];

  await Promise.allSettled(cleanupTasks);
  console.log('[Auth Logout] Operações de limpeza concluídas.');

  // 5. Notifica o overlay que as operações de limpeza assíncrona foram concluídas
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('edu:logout-ready'));
    } catch (_) {}

    // Fallback de segurança: caso o overlay não esteja ativo ou ocorra anomalia,
    // garante a navegação após 1.5 segundos (sem travar o usuário)
    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }, 1500);
  }
}
