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
 * Sets key-value in SecureStorage with retry and exponential backoff
 * to withstand temporary hardware/keychain lockouts.
 */
export async function setSecureStorageWithRetry(
  key: string,
  value: string,
  maxAttempts = 3,
  initialDelayMs = 150
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await SecureStoragePlugin.set({ key, value });
      return true;
    } catch (err) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * attempt));
      } else {
        console.warn(`[Auth] SecureStoragePlugin.set falhou após ${maxAttempts} tentativas:`, err);
      }
    }
  }
  return false;
}

/**
 * Gets key-value from SecureStorage with retry for temporary lockouts.
 */
export async function getSecureStorageWithRetry(
  key: string,
  maxAttempts = 3,
  initialDelayMs = 100
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await SecureStoragePlugin.get({ key });
      if (res?.value) return res.value;
      return null;
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      // Não retenta se a chave comprovadamente não existe
      if (msg.includes('key') || msg.includes('not found') || msg.includes('empty') || msg.includes('does not exist')) {
        return null;
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * attempt));
      }
    }
  }
  return null;
}

/**
 * Validates whether a stored session object has the required tokens.
 */
export function isValidSessionObject(session: any): session is { access_token: string; refresh_token: string; expires_at?: number; user?: any; [key: string]: any } {
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

// Controle de Estado de Logout e Geração de Autenticação
let authGenerationId = 1;
let lastLogoutTimestamp = 0;
let isExplicitlyLoggedOut = false;

export function getAuthGenerationId(): number {
  return authGenerationId;
}

export function bumpAuthGeneration(): number {
  authGenerationId++;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem('edu_auth_generation_id', String(authGenerationId));
    } catch {}
  }
  return authGenerationId;
}

export function getLastLogoutTimestamp(): number {
  return lastLogoutTimestamp;
}

export function isUserLoggedOut(): boolean {
  return isExplicitlyLoggedOut;
}

export function markExplicitLogin() {
  lastLogoutTimestamp = 0;
  isExplicitlyLoggedOut = false;
  bumpAuthGeneration();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem('edu-logout-pending');
      window.localStorage.removeItem('edu_last_logout_at');
    } catch {}
  }
}

/**
 * Migrates a session from fallback storage (Preferences / localStorage)
 * into SecureStorage (Keychain/Keystore).
 * CRITICAL SAFETY RULE: Verifies the session was successfully written and can be read back
 * from SecureStorage BEFORE removing the fallback copy.
 */
export async function migrateSessionToSecureStorageSafely(session: any): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !isValidSessionObject(session)) return false;

  const sessionStr = JSON.stringify(session);
  const saved = await setSecureStorageWithRetry(SESSION_KEY, sessionStr);
  if (!saved) {
    console.warn('[Auth Migration] Falha ao gravar no Keychain. Preservando cópias de contingência.');
    return false;
  }

  const readBack = await getSecureStorageWithRetry(SESSION_KEY);
  if (!readBack) {
    console.warn('[Auth Migration] Keychain retornou vazio na verificação. Preservando cópias de contingência.');
    return false;
  }

  try {
    const parsed = JSON.parse(readBack);
    if (!isValidSessionObject(parsed) || parsed.access_token !== session.access_token) {
      console.warn('[Auth Migration] Dados no Keychain divergem do esperado. Preservando fallback.');
      return false;
    }
  } catch {
    return false;
  }

  // Verificado com sucesso no Keychain: agora limpa a cópia desprotegida
  try {
    await Preferences.remove({ key: SESSION_KEY });
  } catch {}
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {}
  }
  return true;
}

/**
 * Retrieves the raw session string from any available storage tier,
 * prioritising native Keychain/Keystore on mobile platforms.
 */
export async function getSessionFromStorageTiers(): Promise<any | null> {
  let sessionStr: string | null = null;

  // 1. Native Secure Storage (Keychain on iOS / Android Keystore) com retentativa
  if (Capacitor.isNativePlatform()) {
    sessionStr = await getSecureStorageWithRetry(SESSION_KEY);

    // Se o Keychain estiver vazio, busca em Preferences como contingência e tenta migrar de forma segura
    if (!sessionStr) {
      try {
        const { value } = await Preferences.get({ key: SESSION_KEY });
        if (value) {
          sessionStr = value;
          try {
            const parsed = JSON.parse(value);
            if (isValidSessionObject(parsed)) {
              migrateSessionToSecureStorageSafely(parsed).catch(() => {});
            }
          } catch {}
        }
      } catch {}
    }
  } else {
    // 2. Web Browser tradicional: recupera de window.localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        sessionStr = window.localStorage.getItem(SESSION_KEY);
      } catch {}
    }
    // Fallback Preferences apenas no Web
    if (!sessionStr) {
      try {
        const { value } = await Preferences.get({ key: SESSION_KEY });
        if (value) sessionStr = value;
      } catch {}
    }
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

export interface SaveSessionOptions {
  startedAt?: number;
  originToken?: string;
  generationId?: number;
  isExplicitLogin?: boolean;
}

/**
 * Saves the Supabase session with generation coordination,
 * anti-race protection and verified migration before cleanup.
 */
export async function saveSessionSecurely(session: any, options?: SaveSessionOptions): Promise<boolean> {
  if (!isValidSessionObject(session)) return false;

  // 1. Proteção contra gravação por geração defasada ou após logout
  if (options?.isExplicitLogin) {
    markExplicitLogin();
  } else {
    if (isExplicitlyLoggedOut) {
      console.warn('[Auth] Bloqueando gravação de sessão: usuário encontra-se deslogado.');
      return false;
    }
    // Se foi fornecida uma geração e a geração atual mudou, rejeita a gravação SEM limpar nada
    if (options?.generationId !== undefined && options.generationId !== authGenerationId) {
      console.warn(`[Auth] Bloqueando gravação de sessão defasada (geração da op: ${options.generationId} != atual: ${authGenerationId}).`);
      return false;
    }
    if (lastLogoutTimestamp > 0) {
      const opStartedAt = options?.startedAt || 0;
      if (opStartedAt > 0 && opStartedAt <= lastLogoutTimestamp) {
        console.warn('[Auth] Bloqueando gravação de sessão: operação iniciada antes do logout.');
        return false;
      }
    }
    if (typeof window !== 'undefined' && window.localStorage?.getItem('edu-logout-pending')) {
      console.warn('[Auth] Bloqueando gravação de sessão: flag edu-logout-pending ativa.');
      return false;
    }
  }

  // 2. Proteção contra sobrescrita de conta por operação concorrente
  const currentStored = await getSessionFromStorageTiers();
  if (currentStored && isValidSessionObject(currentStored)) {
    const currentUserId = currentStored.user?.id;
    const newUserId = session.user?.id;
    if (currentUserId && newUserId && currentUserId !== newUserId && !options?.isExplicitLogin) {
      console.warn(`[Auth] Bloqueando sobrescrita de conta: sessão atual (${currentUserId}) != nova (${newUserId}).`);
      return false;
    }
  }

  const now = Date.now();
  const sessionToSave = {
    ...session,
    _saved_at: Math.max(session._saved_at || 0, now),
  };

  const sessionStr = JSON.stringify(sessionToSave);

  // 3. Persistência no Mobile Nativo com verificação antes de limpar fallback
  if (Capacitor.isNativePlatform()) {
    const saved = await setSecureStorageWithRetry(SESSION_KEY, sessionStr);

    // VERIFICAÇÃO ATIVA: Confirma se o Keychain realmente gravou
    let verifiedInSecureStorage = false;
    if (saved) {
      const readBack = await getSecureStorageWithRetry(SESSION_KEY);
      if (readBack) {
        try {
          const parsed = JSON.parse(readBack);
          if (isValidSessionObject(parsed) && parsed.access_token === sessionToSave.access_token) {
            verifiedInSecureStorage = true;
          }
        } catch {}
      }
    }

    if (verifiedInSecureStorage) {
      // SUCESSO VERIFICADO NO KEYCHAIN: Limpa fallback desprotegido e mantém apenas metadados
      try {
        const safeMeta = {
          user: sessionToSave.user,
          expires_at: sessionToSave.expires_at,
          _saved_at: sessionToSave._saved_at,
        };
        await Preferences.set({
          key: `${SESSION_KEY}_meta`,
          value: JSON.stringify(safeMeta),
        });
        await Preferences.remove({ key: SESSION_KEY }).catch(() => {});
      } catch (e) {}

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          if (sessionToSave.user) {
            window.localStorage.setItem('edu_auth_user', JSON.stringify(sessionToSave.user));
          }
          window.localStorage.removeItem(SESSION_KEY);
        } catch (e) {}
      }
    } else {
      // SE A GRAVAÇÃO OU VERIFICAÇÃO NO KEYCHAIN FALHOU:
      // Não destrua a única sessão recuperável! Preserva cópia em Preferences para evitar perda de login
      console.warn('[Auth] Gravação no SecureStorage não pôde ser confirmada. Preservando cópia em Preferences.');
      try {
        await Preferences.set({ key: SESSION_KEY, value: sessionStr });
      } catch (e) {}
    }
  } else {
    // Web Browser tradicional
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(SESSION_KEY, sessionStr);
      } catch (e) {}
    }
  }

  // 4. Sincroniza com os cookies do navegador para manter o SSR e Edge atualizados
  if (typeof document !== 'undefined') {
    import('@/lib/supabase').then(({ syncDocumentCookie }) => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lrpwerkkqrjkcauofhph.supabase.co';
      const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0];
      syncDocumentCookie(`sb-${projectRef}-auth-token`, sessionStr);
    }).catch(() => {});
  }

  return true;
}

/**
 * Centralized Promise Deduplication Lock for Token Refresh.
 * Captures generation and origin identity to discard stale completions safely.
 */
let inFlightRefreshPromise: Promise<any> | null = null;

export async function refreshSessionCentralized(supabase: SupabaseClient): Promise<{
  session: any | null;
  error: any | null;
}> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  const capturedGenerationId = authGenerationId;
  const refreshStartedAt = Date.now();

  inFlightRefreshPromise = (async () => {
    let sessionBeforeRefresh: any = null;
    try {
      if (isExplicitlyLoggedOut) {
        return { session: null, error: new Error('User logged out') };
      }

      sessionBeforeRefresh = await getSessionFromStorageTiers();
      const originUserId = sessionBeforeRefresh?.user?.id;
      const originRefreshToken = sessionBeforeRefresh?.refresh_token;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('[Auth] Dispositivo offline detectado — mantendo sessão local sem refresh.');
        return { session: sessionBeforeRefresh, error: null };
      }

      console.log(`[Auth] Renovando sessão (Geração ${capturedGenerationId})...`);
      const { data, error } = await supabase.auth.refreshSession();

      // VERIFICAÇÃO 1: GERAÇÃO MUDOU ENQUANTO O REFRESH ESTAVA EM ANDAMENTO?
      // (Ex: O usuário deslogou ou outra conta efetuou login enquanto a requisição viajava)
      if (authGenerationId !== capturedGenerationId) {
        console.warn(`[Auth] Refresh da geração ${capturedGenerationId} descartado: geração atual é ${authGenerationId}. Sem limpeza global.`);
        // DESCARTE SEGURO: Não chama clearSessionSecurely(), mantendo a nova sessão intacta!
        return { session: null, error: new Error('Stale generation discarded') };
      }

      // VERIFICAÇÃO 2: A IDENTIDADE DA SESSÃO EM ARMAZENAMENTO MUDOU?
      const currentStored = await getSessionFromStorageTiers();
      if (currentStored && isValidSessionObject(currentStored)) {
        const currentUserId = currentStored.user?.id;
        if (originUserId && currentUserId && originUserId !== currentUserId) {
          console.warn('[Auth] Identidade do usuário mudou durante refresh. Descartando resposta defasada.');
          return { session: currentStored, error: null };
        }
        if (originRefreshToken && currentStored.refresh_token && currentStored.refresh_token !== originRefreshToken) {
          console.log('[Auth] Sessão já renovada por outro processo. Preservando a mais recente.');
          return { session: currentStored, error: null };
        }
      }

      if (!error && data?.session) {
        // Checagem final de geração antes de persistir
        if (authGenerationId !== capturedGenerationId) {
          console.warn('[Auth] Geração mudou antes de gravar. Descartando.');
          return { session: null, error: new Error('Stale generation discarded') };
        }

        console.log('[Auth] Sessão renovada com sucesso.');
        await saveSessionSecurely(data.session, {
          generationId: capturedGenerationId,
          startedAt: refreshStartedAt,
          originToken: originRefreshToken,
        });
        return { session: data.session, error: null };
      }

      if (error) {
        // Se a geração mudou durante o erro, descarta sem tomar ações
        if (authGenerationId !== capturedGenerationId) {
          return { session: null, error: new Error('Stale generation discarded') };
        }

        // Se falhou com invalid_grant mas uma sessão mais recente já está salva
        if (currentStored && isValidSessionObject(currentStored)) {
          if (currentStored.refresh_token !== originRefreshToken) {
            console.log('[Auth] Refresh reportou erro, mas sessão já foi atualizada concorrentemente. Preservando credenciais.');
            return { session: currentStored, error: null };
          }
        }

        if (isNetworkOrTransientError(error)) {
          console.warn('[Auth] Falha temporária de rede ao renovar sessão. Preservando sessão local.');
          return { session: sessionBeforeRefresh, error };
        }

        // Revogação definitiva comprovada: SÓ limpa se a geração ainda for EXATAMENTE a mesma!
        if (isPermanentTokenRevocation(error)) {
          if (authGenerationId === capturedGenerationId) {
            console.warn('[Auth] Token definitivamente revogado no servidor para a geração atual. Limpando credenciais locais:', error.message);
            await clearSessionSecurely();
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
          return { session: null, error };
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
 * with complete deduplication, offline resilience, and post-logout blocking.
 */
export async function restoreSessionSecurely(supabase: SupabaseClient): Promise<boolean> {
  // Se logout ocorreu recentemente ou usuário está deslogado, bloqueia restauração
  if (isExplicitlyLoggedOut) {
    console.log('[Auth] Restauração abortada: usuário deslogado explicitamente.');
    return false;
  }
  if (lastLogoutTimestamp > 0 && Date.now() - lastLogoutTimestamp < 10000) {
    console.log('[Auth] Restauração abortada: logout recente detectado.');
    return false;
  }
  if (typeof window !== 'undefined' && window.localStorage?.getItem('edu-logout-pending')) {
    console.log('[Auth] Restauração abortada: logout pendente em localStorage.');
    return false;
  }

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
            return true;
          }
        }
      } catch (e) {}

      // 2. Tenta recuperar do Keychain/Keystore
      const storedSession = await getSessionFromStorageTiers();

      // Checa se logout ocorreu durante a leitura
      if (isExplicitlyLoggedOut) return false;

      if (storedSession && isValidSessionObject(storedSession)) {
        // Se a sessão estiver expirada ou próxima de expirar, usa o refresh centralizado com mutex
        if (isSessionExpiredOrExpiringSoon(storedSession, 60)) {
          console.log('[Auth] Sessão persistida expirada. Renovando via mutex centralizado...');
          const { session: refreshedSession, error: refreshErr } = await refreshSessionCentralized(supabase);
          if (isExplicitlyLoggedOut) return false;

          if (refreshedSession && isValidSessionObject(refreshedSession)) {
            return true;
          }
          if (refreshErr && isNetworkOrTransientError(refreshErr)) {
            console.log('[Auth] Rede offline/instável durante renovação inicial. Mantendo sessão local ativa.');
            return true;
          }
          return false;
        }

        console.log('[Auth] Restaurando sessão do armazenamento persistente seguro...');

        // Injeta a sessão no cliente Supabase
        const { data, error } = await supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        if (isExplicitlyLoggedOut) return false;

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

          // Para outros erros (inclusive race conditions no setSession), não apague o Keychain!
          console.warn('[Auth] Aviso no setSession. Preservando credenciais locais para nova tentativa:', error.message);
          return false;
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
  lastLogoutTimestamp = Date.now();
  isExplicitlyLoggedOut = true;
  bumpAuthGeneration();
  inFlightRefreshPromise = null;
  inFlightRestorePromise = null;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('edu_last_logout_at', String(lastLogoutTimestamp));
      window.localStorage.setItem('edu-logout-pending', '1');
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem('edu_auth_user');
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch (e) {}
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.remove({ key: SESSION_KEY });
      console.log('[Auth] Secure session cleared from Keychain/Keystore.');
    } catch (error) {}

    try {
      await Preferences.remove({ key: `${SESSION_KEY}_meta` });
      await Preferences.remove({ key: SESSION_KEY });
    } catch (e) {}
  } else {
    try {
      await Preferences.remove({ key: SESSION_KEY });
    } catch (e) {}
  }
}
