import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_KEY = 'edu_impacto_secure_session';
export const LOGOUT_BARRIER_KEY = 'edu_logout_pending_barrier';

/**
 * Retorna o identificador do projeto Supabase atual de forma resiliente.
 */
export function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lrpwerkkqrjkcauofhph.supabase.co';
  return url.replace(/^https?:\/\//, '').split('.')[0];
}

/**
 * Retorna a chave canônica utilizada pelo Supabase Auth para armazenar o token deste projeto.
 */
export function getProjectStorageKey(): string {
  return `sb-${getProjectRef()}-auth-token`;
}

/**
 * Verifica se o erro representa uma falha temporária de rede ou indisponibilidade
 * que NÃO deve causar deslogamento do usuário.
 */
export function isNetworkOrTransientError(error: any): boolean {
  if (!error) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;

  const errMsg = (error.message || '').toLowerCase();
  const errName = (error.name || '').toLowerCase();
  const errCode = (error.code || error.error_code || '').toLowerCase();
  const status = error.status || error.statusCode || 0;
  const causeMsg = (error.cause?.message || '').toLowerCase();

  return (
    errName === 'authretryablefetcherror' ||
    errName === 'aborterror' ||
    errCode === 'over_request_rate_limit' ||
    errCode === 'request_timeout' ||
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
    causeMsg.includes('enotfound') ||
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 522
  );
}

/**
 * Verifica com precisão se o erro indica invalidação ou revogação definitiva da sessão no servidor.
 * Inspeciona códigos e tipos reais do SDK do Supabase.
 */
export function isPermanentTokenRevocation(error: any): boolean {
  if (!error) return false;
  if (isNetworkOrTransientError(error)) return false;

  const errMsg = (error.message || '').toLowerCase();
  const errName = (error.name || '').toLowerCase();
  const errCode = (error.code || error.error_code || '').toLowerCase();
  const status = error.status || error.statusCode || 0;

  // AuthSessionMissingError significa que o SDK local ainda não carregou a sessão na memória.
  // Isso NÃO é revogação de token pelo servidor!
  if (errName === 'authsessionmissingerror' || errMsg.includes('auth session missing')) {
    return false;
  }

  // Erros de rate limit ou timeout não são revogações permanentes
  if (errCode === 'over_request_rate_limit' || status === 429 || status === 408) {
    return false;
  }

  return (
    errCode === 'refresh_token_not_found' ||
    errCode === 'refresh_token_already_used' ||
    errCode === 'session_not_found' ||
    errCode === 'session_expired' ||
    errCode === 'user_banned' ||
    errCode === 'user_not_found' ||
    errCode === 'invalid_grant' ||
    errCode === 'invalid_refresh_token' ||
    errMsg.includes('refresh token not found') ||
    errMsg.includes('invalid refresh token') ||
    errMsg.includes('refresh token already used') ||
    errMsg.includes('invalid_grant') ||
    errMsg.includes('token is expired by') ||
    errMsg.includes('user not found') ||
    errMsg.includes('user is banned') ||
    errMsg.includes('no valid session stored') ||
    errMsg.includes('user logged out') ||
    errMsg.includes('user is logged out') ||
    errMsg.includes('logout barrier active') ||
    (status === 400 && (errCode === 'invalid_grant' || errMsg.includes('grant')))
  );
}

/**
 * Grava chave-valor no SecureStorage com retry e backoff exponencial.
 */
export async function setSecureStorageWithRetry(
  key: string,
  value: string,
  maxAttempts = 3,
  initialDelayMs = 120
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await SecureStoragePlugin.set({ key, value });
      return true;
    } catch (err) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * attempt));
      } else {
        console.warn(`[Auth] SecureStoragePlugin.set falhou após ${maxAttempts} tentativas para chave ${key}:`, err);
      }
    }
  }

  // Fallback para Preferences quando SecureStorage falha permanentemente
  try {
    await Preferences.set({ key, value });
    return true;
  } catch (prefErr) {
    console.warn(`[Auth] Fallback para Preferences também falhou para chave ${key}:`, prefErr);
  }
  return false;
}

/**
 * Lê chave-valor do SecureStorage com retry para bloqueios transitórios.
 */
export async function getSecureStorageWithRetry(
  key: string,
  maxAttempts = 3,
  initialDelayMs = 80
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await SecureStoragePlugin.get({ key });
      if (res?.value) return res.value;
      return null;
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      // Chave não existente não deve sofrer novas tentativas
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
 * Valida se um objeto de sessão possui tokens válidos e não vazios.
 */
export function isValidSessionObject(session: any): session is {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: any;
  _seq?: number;
  _saved_at?: number;
  [key: string]: any;
} {
  return Boolean(
    session &&
    typeof session === 'object' &&
    typeof session.access_token === 'string' &&
    session.access_token.trim().length > 0 &&
    typeof session.refresh_token === 'string' &&
    session.refresh_token.trim().length > 0
  );
}

/**
 * Checa se a sessão está expirada ou próxima de expirar dentro da margem thresholdSeconds.
 */
export function isSessionExpiredOrExpiringSoon(session: any, thresholdSeconds = 300): boolean {
  if (!isValidSessionObject(session)) return true;
  const expiresAt = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  return expiresAt <= (now + thresholdSeconds);
}

// ── Controle de Geração, Sequência Monotônica e Barreira de Logout ────────────
let authGenerationId = 1;
let monotonicWriteSeq = 0;
let lastLogoutTimestamp = 0;
let isExplicitlyLoggedOut = false;
let lastSavedAccessToken: string | null = null;
let lastSavedAtTimestamp = 0;

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

export interface LogoutBarrierData {
  timestamp: number;
  generationId: number;
  userId?: string;
}

/**
 * Registra a barreira de logout persistente (local e nativa), garantindo que após
 * um logout offline o aplicativo nunca reative a sessão ao religar a rede.
 */
export function setLogoutBarrier(userId?: string): void {
  lastLogoutTimestamp = Date.now();
  isExplicitlyLoggedOut = true;
  bumpAuthGeneration();

  const barrier: LogoutBarrierData = {
    timestamp: lastLogoutTimestamp,
    generationId: authGenerationId,
    userId,
  };
  const barrierStr = JSON.stringify(barrier);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOGOUT_BARRIER_KEY, barrierStr);
      window.sessionStorage?.setItem(LOGOUT_BARRIER_KEY, barrierStr);
      window.localStorage.setItem('edu_last_logout_at', String(lastLogoutTimestamp));
      if (typeof document !== 'undefined') {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        document.cookie = `${LOGOUT_BARRIER_KEY}=1; path=/; max-age=86400; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      }
    } catch {}
  }

  if (Capacitor.isNativePlatform()) {
    Preferences.set({ key: LOGOUT_BARRIER_KEY, value: barrierStr }).catch(() => {});
  }
}

export async function getLogoutBarrier(): Promise<LogoutBarrierData | null> {
  if (typeof window !== 'undefined') {
    try {
      const val = window.localStorage.getItem(LOGOUT_BARRIER_KEY);
      if (val) return JSON.parse(val);
    } catch {}
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const { value } = await Preferences.get({ key: LOGOUT_BARRIER_KEY });
      if (value) return JSON.parse(value);
    } catch {}
  }
  return null;
}

export async function clearLogoutBarrier(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LOGOUT_BARRIER_KEY);
      window.sessionStorage?.removeItem(LOGOUT_BARRIER_KEY);
      window.localStorage.removeItem('edu-logout-pending');
      window.localStorage.removeItem('edu_last_logout_at');
      if (typeof document !== 'undefined') {
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        document.cookie = `${LOGOUT_BARRIER_KEY}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      }
    } catch {}
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await Preferences.remove({ key: LOGOUT_BARRIER_KEY });
      await Preferences.remove({ key: 'edu-logout-pending' });
    } catch {}
  }
}

/**
 * Remove cirurgicamente os cookies de autenticação do projeto atual no navegador do cliente (RFC 6265).
 * Restrito ao projectRef do Impacto EDU, nunca apagando outros projetos ou cookies não relacionados.
 */
export function clearSessionCookiesOnClient(projectRef = getProjectRef()): void {
  if (typeof document === 'undefined') return;
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const securePart = isHttps ? '; Secure' : '';
  const prefix = `sb-${projectRef}-auth-token`;

  try {
    const cookies = document.cookie.split('; ');
    for (const c of cookies) {
      const name = c.split('=')[0];
      if (name === prefix || name.startsWith(`${prefix}.`) || name === 'edu_keep_connected') {
        document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`;
      }
    }
  } catch {}
}

/**
 * Marca explicitamente um novo login do usuário, limpando a barreira de logout
 * e permitindo que a nova sessão seja persistida e restaurada sem interferência.
 */
export function markExplicitLogin() {
  lastLogoutTimestamp = 0;
  isExplicitlyLoggedOut = false;
  bumpAuthGeneration();
  clearLogoutBarrier().catch(() => {});
}

/**
 * Migra a sessão de um storage de contingência (Preferences) para o SecureStorage (Keychain/Keystore).
 * Regra de segurança: testa a leitura de volta no Keychain ANTES de remover o fallback.
 */
export async function migrateSessionToSecureStorageSafely(session: any): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !isValidSessionObject(session)) return false;

  const sessionStr = JSON.stringify(session);
  const saved = await setSecureStorageWithRetry(SESSION_KEY, sessionStr);
  if (!saved) return false;

  const readBack = await getSecureStorageWithRetry(SESSION_KEY);
  if (!readBack) return false;

  try {
    const parsed = JSON.parse(readBack);
    if (!isValidSessionObject(parsed) || parsed.access_token !== session.access_token) {
      return false;
    }
  } catch {
    return false;
  }

  // Verificado com sucesso no Keychain: limpa fallback desprotegido
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
 * Recupera o objeto de sessão estruturalmente válido a partir das camadas de armazenamento,
 * respeitando a precedência de hardware (Keychain no mobile) e alinhando com Preferences e Cookies.
 */
export async function getSessionFromStorageTiers(): Promise<any | null> {
  let sessionStr: string | null = null;
  const projectStorageKey = getProjectStorageKey();

  if (Capacitor.isNativePlatform()) {
    // 1. Tenta chave primária da sessão no Keychain / Keystore
    sessionStr = await getSecureStorageWithRetry(SESSION_KEY);

    // Se vazia, tenta chave canônica do Supabase no Keychain
    if (!sessionStr) {
      sessionStr = await getSecureStorageWithRetry(projectStorageKey);
    }

    // 2. Se o Keychain estiver temporariamente inacessível, recorre ao Preferences como contingência
    if (!sessionStr) {
      try {
        const { value } = await Preferences.get({ key: SESSION_KEY });
        if (value) {
          sessionStr = value;
          try {
            const parsed = JSON.parse(value);
            if (isValidSessionObject(parsed)) {
              // Tenta migrar em background para o Keychain agora que o processo está ativo
              migrateSessionToSecureStorageSafely(parsed).catch(() => {});
            }
          } catch {}
        }
      } catch {}
    }

    if (!sessionStr) {
      try {
        const { value } = await Preferences.get({ key: projectStorageKey });
        if (value) sessionStr = value;
      } catch {}
    }
  } else {
    // Web Browser tradicional: busca prioritariamente em localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        sessionStr = window.localStorage.getItem(SESSION_KEY) || window.localStorage.getItem(projectStorageKey);
      } catch {}
    }

    // Fallback em Preferences se habilitado no Web
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
 * Salva a sessão do Supabase com coordenação atômica de sequência monotônica,
 * controle estrito de geração e verificação ativa pós-gravação contra corridas de logout.
 */
export async function saveSessionSecurely(session: any, options?: SaveSessionOptions): Promise<boolean> {
  if (!isValidSessionObject(session)) return false;

  // Deduplicação: se a mesma sessão (access_token) foi gravada com sucesso nos últimos 3s,
  // evita disparar outra rodada de 5 chamadas de I/O no Keychain/Keystore do hardware móvel.
  if (
    !options?.isExplicitLogin &&
    lastSavedAccessToken === session.access_token &&
    Date.now() - lastSavedAtTimestamp < 3000
  ) {
    return true;
  }

  const opStartedAt = options?.startedAt || Date.now();
  const opGenerationId = options?.generationId !== undefined ? options.generationId : authGenerationId;

  // 1. Verificação inicial contra gravação após logout ou geração defasada
  if (options?.isExplicitLogin) {
    markExplicitLogin();
  } else {
    if (isExplicitlyLoggedOut) {
      console.warn('[Auth] Bloqueando gravação: usuário deslogado.');
      return false;
    }
    if (opGenerationId !== authGenerationId) {
      console.warn(`[Auth] Bloqueando gravação defasada: op ${opGenerationId} != atual ${authGenerationId}`);
      return false;
    }
    if (lastLogoutTimestamp > 0 && opStartedAt <= lastLogoutTimestamp) {
      console.warn('[Auth] Bloqueando gravação: iniciada antes do logout.');
      return false;
    }
    const barrier = await getLogoutBarrier();
    if (barrier && barrier.timestamp >= opStartedAt) {
      console.warn('[Auth] Bloqueando gravação: barreira de logout ativa.');
      return false;
    }
  }

  // 2. Proteção contra sobrescrita indevida de conta diferente
  const currentStored = await getSessionFromStorageTiers();
  if (currentStored && isValidSessionObject(currentStored)) {
    const currentUserId = currentStored.user?.id;
    const newUserId = session.user?.id;
    if (currentUserId && newUserId && currentUserId !== newUserId && !options?.isExplicitLogin) {
      console.warn(`[Auth] Bloqueando sobrescrita entre usuários: atual (${currentUserId}) != novo (${newUserId})`);
      return false;
    }
  }

  monotonicWriteSeq++;
  const sessionToSave = {
    ...session,
    _seq: monotonicWriteSeq,
    _saved_at: Date.now(),
    _generation_id: authGenerationId,
  };
  const sessionStr = JSON.stringify(sessionToSave);
  const projectStorageKey = getProjectStorageKey();

  // 3. Persistência Nativa (Mobile) com verificação e barreira atômica pós-escrita
  if (Capacitor.isNativePlatform()) {
    // Grava de forma coordenada na chave canônica e chave unificada
    const saved = await setSecureStorageWithRetry(SESSION_KEY, sessionStr);
    await setSecureStorageWithRetry(projectStorageKey, sessionStr);

    // CHECAGEM PÓS-ESCRITA: Um logout ocorreu durante o await da gravação?
    if (isExplicitlyLoggedOut || (lastLogoutTimestamp > 0 && lastLogoutTimestamp >= opStartedAt)) {
      console.warn('[Auth] Logout detectado durante escrita no Keychain. Revertendo gravação...');
      await SecureStoragePlugin.remove({ key: SESSION_KEY }).catch(() => {});
      await SecureStoragePlugin.remove({ key: projectStorageKey }).catch(() => {});
      await Preferences.remove({ key: SESSION_KEY }).catch(() => {});
      await Preferences.remove({ key: projectStorageKey }).catch(() => {});
      return false;
    }

    let verified = false;
    if (saved) {
      const readBack = await getSecureStorageWithRetry(SESSION_KEY);
      if (readBack) {
        try {
          const parsed = JSON.parse(readBack);
          if (isValidSessionObject(parsed) && parsed.access_token === sessionToSave.access_token) {
            verified = true;
          }
        } catch {}
      }
    }

    if (verified) {
      // Gravação confirmada no Keychain: limpa fallback em Preferences
      try {
        await Preferences.remove({ key: SESSION_KEY });
        await Preferences.remove({ key: projectStorageKey });
      } catch {}
    } else {
      // Fallback para quando o Keychain sofrer bloqueio temporário
      console.warn('[Auth] Gravação não confirmada no Keychain. Mantendo cópia em Preferences.');
      try {
        await Preferences.set({ key: SESSION_KEY, value: sessionStr });
        await Preferences.set({ key: projectStorageKey, value: sessionStr });
      } catch {}
    }
  } else {
    // Web Browser padrão
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(SESSION_KEY, sessionStr);
        window.localStorage.setItem(projectStorageKey, sessionStr);
      } catch {}
    }
  }

  // 4. Sincroniza com os cookies do navegador para SSR e Edge Middleware
  if (typeof document !== 'undefined') {
    // Re-checa barreira de logout antes de sincronizar cookies
    if (!isExplicitlyLoggedOut && (lastLogoutTimestamp === 0 || opStartedAt > lastLogoutTimestamp)) {
      import('@/lib/supabase').then(({ syncDocumentCookie }) => {
        syncDocumentCookie(projectStorageKey, sessionStr);
      }).catch(() => {});
    }
  }

  lastSavedAccessToken = session.access_token;
  lastSavedAtTimestamp = Date.now();

  return true;
}

/**
 * Lock em memória para evitar que chamadas concorrentes no mesmo processo/aba
 * executem renovação duplicada. A sincronização entre abas é gerenciada pelo
 * navigatorLock interno do Supabase SDK.
 */
let inFlightRefreshPromise: Promise<{ session: any | null; error: any | null; isOffline?: boolean }> | null = null;

/**
 * Renovação centralizada de sessão:
 * - Passa explicitamente o refresh_token recuperado.
 * - Relê o armazenamento logo no início para aproveitar renovações feitas por outras abas.
 * - Classifica rigorosamente erros sem apagar credenciais indevidamente.
 */
export async function refreshSessionCentralized(
  supabase: SupabaseClient,
  force = false
): Promise<{
  session: any | null;
  error: any | null;
  isOffline?: boolean;
}> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  const capturedGenerationId = authGenerationId;
  const refreshStartedAt = Date.now();

  inFlightRefreshPromise = (async () => {
    try {
      if (isExplicitlyLoggedOut) {
        return { session: null, error: new Error('User logged out') };
      }

      // RELER O ARMAZENAMENTO ATUAL: Outra aba ou processo já renovou o token?
      const storedSession = await getSessionFromStorageTiers();
      if (!storedSession || !isValidSessionObject(storedSession)) {
        return { session: null, error: new Error('No valid session stored to refresh') };
      }

      // Se a sessão em storage já estiver renovada e válida (vencimento em mais de 5 minutos),
      // reutiliza sem necessidade de chamada de rede a menos que forçado explicitamente
      if (!force && !isSessionExpiredOrExpiringSoon(storedSession, 300)) {
        return { session: storedSession, error: null };
      }

      const originRefreshToken = storedSession.refresh_token;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('[Auth] Dispositivo offline — preservando credenciais locais sem refresh de rede.');
        return { session: storedSession, error: null, isOffline: true };
      }

      console.log(`[Auth] Executando renovação com refresh_token explícito (Geração ${capturedGenerationId})...`);
      
      // Chamada com refresh_token explícito garante que mesmo sem sessão na memória do cliente,
      // o GoTrueClient consiga renovar a sessão com o servidor
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: originRefreshToken });

      // VERIFICAÇÃO 1: Logout ou troca de usuário durante o tempo de rede?
      if (
        authGenerationId !== capturedGenerationId ||
        isExplicitlyLoggedOut ||
        (lastLogoutTimestamp > 0 && lastLogoutTimestamp >= refreshStartedAt)
      ) {
        console.warn('[Auth] Resposta de refresh atrasada descartada após logout ou troca de conta.');
        clearSessionCookiesOnClient();
        return { session: null, error: new Error('Refresh discarded due to logout') };
      }

      // SUCESSO: Persiste a nova sessão renovada
      if (!error && data?.session && isValidSessionObject(data.session)) {
        console.log('[Auth] Sessão renovada com sucesso pelo servidor.');
        await saveSessionSecurely(data.session, {
          generationId: capturedGenerationId,
          startedAt: refreshStartedAt,
          originToken: originRefreshToken,
        });
        return { session: data.session, error: null };
      }

      // TRATAMENTO DE ERROS:
      if (error) {
        // Falha temporária de rede / 5xx / timeout
        if (isNetworkOrTransientError(error)) {
          console.warn('[Auth] Erro temporário de rede na renovação. Mantendo sessão local intacta:', error.message);
          return { session: storedSession, error, isOffline: true };
        }

        // Se o erro indicar invalid_grant ou token já utilizado:
        // RE-CONSULTA O ARMAZENAMENTO antes de concluir que o usuário foi deslogado!
        // Uma aba concorrente pode ter usado o refresh_token e gravado a resposta mais recente!
        const latestInStorage = await getSessionFromStorageTiers();
        if (
          latestInStorage &&
          isValidSessionObject(latestInStorage) &&
          latestInStorage.refresh_token !== originRefreshToken
        ) {
          console.log('[Auth] Token já havia sido renovado por outro processo. Recuperando credencial mais recente.');
          return { session: latestInStorage, error: null };
        }

        // Revogação definitiva confirmada: limpa credenciais apenas se o token for exatamente o mesmo
        if (isPermanentTokenRevocation(error)) {
          if (authGenerationId === capturedGenerationId && !isExplicitlyLoggedOut) {
            console.warn('[Auth] Sessão revogada de forma definitiva pelo servidor. Limpando credenciais locais:', error.message);
            await clearSessionSecurely();
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
          return { session: null, error };
        }

        console.warn('[Auth] Erro não fatal na renovação:', error.message);
        return { session: null, error };
      }

      return { session: null, error: null };
    } catch (err: any) {
      if (isNetworkOrTransientError(err)) {
        console.warn('[Auth] Exceção de rede na renovação. Preservando credenciais locais.');
        const cached = await getSessionFromStorageTiers();
        return { session: cached, error: err, isOffline: true };
      }
      return { session: null, error: err };
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
}

export interface RestoreSessionResult {
  success: boolean;
  isOffline: boolean;
  session: any | null;
  error: any | null;
}

let inFlightRestorePromise: Promise<RestoreSessionResult> | null = null;

/**
 * Restaura a sessão autenticada a partir do armazenamento persistente seguro.
 * Retorna estado explícito (success, isOffline, session, error).
 * NUNCA retorna success: true para erros de rede.
 */
export async function restoreSessionSecurely(supabase: SupabaseClient): Promise<RestoreSessionResult> {
  if (isExplicitlyLoggedOut) {
    return { success: false, isOffline: false, session: null, error: new Error('User is logged out') };
  }

  // Verifica barreira de logout persistente
  const barrier = await getLogoutBarrier();
  if (barrier) {
    console.log('[Auth] Restauração abortada: barreira de logout offline ativa.');
    return { success: false, isOffline: false, session: null, error: new Error('Logout barrier active') };
  }

  if (inFlightRestorePromise) {
    return inFlightRestorePromise;
  }

  inFlightRestorePromise = (async (): Promise<RestoreSessionResult> => {
    try {
      // 1. Verifica se o cliente já possui sessão ativa não expirada na memória
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSession = sessionData?.session;
        if (currentSession && isValidSessionObject(currentSession)) {
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = currentSession.expires_at || 0;
          if (expiresAt > now + 60) {
            return { success: true, isOffline: false, session: currentSession, error: null };
          }
        }
      } catch {}

      // 2. Recupera das camadas de armazenamento seguro
      const storedSession = await getSessionFromStorageTiers();
      if (!storedSession || !isValidSessionObject(storedSession)) {
        return { success: false, isOffline: false, session: null, error: null };
      }

      if (isExplicitlyLoggedOut) {
        return { success: false, isOffline: false, session: null, error: new Error('User is logged out') };
      }

      // 3. Se estiver expirada ou prestes a expirar, aciona renovação centralizada
      if (isSessionExpiredOrExpiringSoon(storedSession, 60)) {
        const { session: refreshedSession, error: refreshErr, isOffline } = await refreshSessionCentralized(supabase);
        
        if (isExplicitlyLoggedOut) {
          return { success: false, isOffline: false, session: null, error: new Error('User is logged out') };
        }

        if (isOffline || isNetworkOrTransientError(refreshErr)) {
          console.log('[Auth] Rede offline durante restauração. Preservando modo offline seguro.');
          return { success: false, isOffline: true, session: storedSession, error: refreshErr };
        }

        if (!refreshErr && refreshedSession && isValidSessionObject(refreshedSession)) {
          return { success: true, isOffline: false, session: refreshedSession, error: null };
        }

        return { success: false, isOffline: false, session: null, error: refreshErr };
      }

      // 4. Injeta sessão válida no cliente Supabase
      const { data, error } = await supabase.auth.setSession({
        access_token: storedSession.access_token,
        refresh_token: storedSession.refresh_token,
      });

      if (isExplicitlyLoggedOut) {
        return { success: false, isOffline: false, session: null, error: new Error('User is logged out') };
      }

      if (!error && data?.session && isValidSessionObject(data.session)) {
        await saveSessionSecurely(data.session);
        return { success: true, isOffline: false, session: data.session, error: null };
      }

      if (error && isNetworkOrTransientError(error)) {
        return { success: false, isOffline: true, session: storedSession, error };
      }

      return { success: false, isOffline: false, session: null, error };
    } catch (err: any) {
      if (isNetworkOrTransientError(err)) {
        const cached = await getSessionFromStorageTiers();
        return { success: false, isOffline: true, session: cached, error: err };
      }
      return { success: false, isOffline: false, session: null, error: err };
    } finally {
      inFlightRestorePromise = null;
    }
  })();

  return inFlightRestorePromise;
}

/**
 * Limpa com precisão atômica todos os artefatos de sessão do projeto atual.
 */
export async function clearSessionSecurely(userId?: string) {
  lastSavedAccessToken = null;
  lastSavedAtTimestamp = 0;
  setLogoutBarrier(userId);
  inFlightRefreshPromise = null;
  inFlightRestorePromise = null;

  const projectRef = getProjectRef();
  const projectStorageKey = getProjectStorageKey();

  // Limpa cookies no cliente imediatamente
  clearSessionCookiesOnClient(projectRef);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(projectStorageKey);
      window.localStorage.removeItem('edu_auth_user');
      window.localStorage.removeItem('edu-current-user');
      window.localStorage.removeItem('edu-current-perfil');
      if (userId) {
        window.localStorage.removeItem(`edu-user-photo-${userId}`);
        window.localStorage.removeItem(`edu-profile-extra-${userId}`);
        window.localStorage.removeItem(`edu-active-modules-${userId}`);
        window.localStorage.removeItem(`edu-active-unit-${userId}`);
      }
      window.localStorage.removeItem('edu-active-modules');
    } catch {}
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.remove({ key: SESSION_KEY }).catch(() => {});
      await SecureStoragePlugin.remove({ key: projectStorageKey }).catch(() => {});
      await SecureStoragePlugin.remove({ key: 'edu-current-user' }).catch(() => {});
      await SecureStoragePlugin.remove({ key: 'edu-current-perfil' }).catch(() => {});
      await Preferences.remove({ key: SESSION_KEY }).catch(() => {});
      await Preferences.remove({ key: projectStorageKey }).catch(() => {});
      await Preferences.remove({ key: `${SESSION_KEY}_meta` }).catch(() => {});
      await Preferences.remove({ key: 'edu-current-user' }).catch(() => {});
      await Preferences.remove({ key: 'edu-current-perfil' }).catch(() => {});
      await Preferences.remove({ key: 'edu_auth_user' }).catch(() => {});
      await Preferences.remove({ key: 'edu-active-modules' }).catch(() => {});
      if (userId) {
        await Preferences.remove({ key: `edu-user-photo-${userId}` }).catch(() => {});
        await Preferences.remove({ key: `edu-profile-extra-${userId}` }).catch(() => {});
        await Preferences.remove({ key: `edu-active-modules-${userId}` }).catch(() => {});
        await Preferences.remove({ key: `edu-active-unit-${userId}` }).catch(() => {});
      }
    } catch {}
  }
}
