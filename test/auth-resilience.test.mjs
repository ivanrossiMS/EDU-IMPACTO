import test from 'node:test';
import assert from 'node:assert/strict';

// ── Setup Mock Environment before importing code ──
const storageMap = new Map();
const preferencesMap = new Map();
const secureStorageMap = new Map();
const cookieMap = new Map();

let isNative = false;
let secureStorageAvailable = true;
let isOnline = true;

const localStorageMock = {
  getItem(key) {
    if (key.startsWith('cap_sec_') && !secureStorageAvailable) {
      throw new Error('Keychain unavailable');
    }
    return storageMap.has(key) ? storageMap.get(key) : null;
  },
  setItem(key, value) {
    if (key.startsWith('cap_sec_') && !secureStorageAvailable) {
      throw new Error('Keychain unavailable');
    }
    storageMap.set(key, String(value));
  },
  removeItem(key) {
    storageMap.delete(key);
  },
  clear() {
    storageMap.clear();
  },
  key(i) {
    return Array.from(storageMap.keys())[i] || null;
  },
  get length() {
    return storageMap.size;
  }
};

const documentMock = {
  get cookie() {
    return Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  },
  set cookie(cookieStr) {
    const parts = cookieStr.split(';');
    const [rawName, rawVal] = parts[0].split('=');
    const name = rawName?.trim();
    const val = rawVal?.trim() || '';
    const isDeleted = parts.some(p => {
      const lower = p.trim().toLowerCase();
      return lower === 'max-age=0' || lower.includes('expires=thu, 01 jan 1970');
    });
    if (isDeleted || val === '') {
      cookieMap.delete(name);
    } else {
      cookieMap.set(name, val);
    }
  }
};

const navigatorMock = {
  get onLine() {
    return isOnline;
  }
};

// Install mocks into globalThis
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: localStorageMock,
    document: documentMock,
    navigator: globalThis.navigator,
    location: { replace() {}, pathname: '/' }
  },
  configurable: true,
  writable: true
});
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true
});
Object.defineProperty(globalThis, 'document', {
  value: documentMock,
  configurable: true,
  writable: true
});
try {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    get() { return isOnline; },
    configurable: true
  });
} catch {}

// Mock Capacitor and native plugins
const { Preferences } = await import('@capacitor/preferences');
Preferences.get = async ({ key }) => {
  return { value: preferencesMap.has(key) ? preferencesMap.get(key) : null };
};
Preferences.set = async ({ key, value }) => {
  preferencesMap.set(key, String(value));
};
Preferences.remove = async ({ key }) => {
  preferencesMap.delete(key);
  storageMap.delete(`CapacitorStorage.${key}`);
};
Preferences.keys = async () => {
  return { keys: Array.from(preferencesMap.keys()) };
};
Preferences.clear = async () => {
  preferencesMap.clear();
  for (const k of Array.from(storageMap.keys())) {
    if (k.startsWith('CapacitorStorage.')) storageMap.delete(k);
  }
};

const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
SecureStoragePlugin.get = async ({ key }) => {
  if (!secureStorageAvailable) throw new Error('Keychain unavailable');
  if (!secureStorageMap.has(key)) throw new Error('Key not found');
  return { value: secureStorageMap.get(key) };
};
SecureStoragePlugin.set = async ({ key, value }) => {
  if (!secureStorageAvailable) throw new Error('Keychain unavailable');
  secureStorageMap.set(key, String(value));
  return { value: true };
};
SecureStoragePlugin.remove = async ({ key }) => {
  if (!secureStorageAvailable) throw new Error('Keychain unavailable');
  secureStorageMap.delete(key);
  storageMap.delete(`cap_sec_${key}`);
  return { value: true };
};
SecureStoragePlugin.clear = async () => {
  if (!secureStorageAvailable) throw new Error('Keychain unavailable');
  secureStorageMap.clear();
  for (const k of Array.from(storageMap.keys())) {
    if (k.startsWith('cap_sec_')) storageMap.delete(k);
  }
  return { value: true };
};
SecureStoragePlugin.keys = async () => {
  if (!secureStorageAvailable) throw new Error('Keychain unavailable');
  return { value: Array.from(secureStorageMap.keys()) };
};

const { Capacitor } = await import('@capacitor/core');
Capacitor.isNativePlatform = () => isNative;

// Import our auth resilience module under test
const secureSession = await import('../lib/auth/secureSession.ts');

function resetAllMocks() {
  storageMap.clear();
  preferencesMap.clear();
  secureStorageMap.clear();
  cookieMap.clear();
  isNative = false;
  secureStorageAvailable = true;
  isOnline = true;
}

function createMockSession(userId = 'usr_test_1', expiresInSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: `access_token_${userId}_${Math.random()}`,
    refresh_token: `refresh_token_${userId}_${Math.random()}`,
    expires_in: expiresInSeconds,
    expires_at: now + expiresInSeconds,
    token_type: 'bearer',
    user: {
      id: userId,
      email: `${userId}@escola.com`,
      user_metadata: { perfil: 'Professor', cargo: 'Professor' }
    }
  };
}

function createMockSupabase(initialSession = null) {
  let currentSession = initialSession;
  let setSessionCalls = 0;
  let refreshCalls = 0;
  let simulatedError = null;
  let delayMs = 0;

  return {
    auth: {
      async getSession() {
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
        if (simulatedError) throw simulatedError;
        return { data: { session: currentSession }, error: null };
      },
      async setSession(params) {
        setSessionCalls++;
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
        if (simulatedError) {
          return { data: { session: null, user: null }, error: simulatedError };
        }
        currentSession = {
          ...currentSession,
          access_token: params.access_token || `new_access_${Date.now()}`,
          refresh_token: params.refresh_token || `new_refresh_${Date.now()}`,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: currentSession?.user || { id: 'usr_test_1', email: 'test@escola.com' }
        };
        return { data: { session: currentSession, user: currentSession.user }, error: null };
      },
      async refreshSession(params) {
        refreshCalls++;
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
        if (simulatedError) {
          return { data: { session: null, user: null }, error: simulatedError };
        }
        currentSession = {
          ...currentSession,
          access_token: `refreshed_access_${Date.now()}`,
          refresh_token: `refreshed_refresh_${Date.now()}`,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: currentSession?.user || { id: 'usr_test_1', email: 'test@escola.com' }
        };
        return { data: { session: currentSession, user: currentSession.user }, error: null };
      },
      async signOut() {
        currentSession = null;
        return { error: null };
      }
    },
    getStats() {
      return { setSessionCalls, refreshCalls, currentSession };
    },
    setError(err) {
      simulatedError = err;
    },
    setDelay(ms) {
      delayMs = ms;
    },
    setCurrentSession(sess) {
      currentSession = sess;
    }
  };
}

// ── TEST SUITE ──

test('Cenário 1: Login seguido de recarga/restauração preserva sessão e anexa sequência monotônica', async () => {
  resetAllMocks();
  const session = createMockSession('user_123', 3600);
  await secureSession.saveSessionSecurely(session);

  // Verifica se salvou com sequência monotônica
  const raw = localStorageMock.getItem(secureSession.SESSION_KEY);
  assert.ok(raw, 'Sessão deve estar gravada no localStorage');
  const parsed = JSON.parse(raw);
  assert.strictEqual(parsed.user.id, 'user_123');
  assert.ok(typeof parsed._seq === 'number', '_seq monotônico deve estar presente');

  // Restauração via restoreSessionSecurely
  const mockSupabase = createMockSupabase(session);
  const result = await secureSession.restoreSessionSecurely(mockSupabase);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.isOffline, false);
  assert.strictEqual(result.session.user.id, 'user_123');
});

test('Cenário 2: Restauração com access token expirado renova silenciosamente com refresh token', async () => {
  resetAllMocks();
  // Sessão expirada há 1 hora
  const expiredSession = createMockSession('user_expired', -3600);
  await secureSession.saveSessionSecurely(expiredSession);

  const mockSupabase = createMockSupabase(expiredSession);
  const result = await secureSession.restoreSessionSecurely(mockSupabase);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.isOffline, false);
  // O client do Supabase deve ter recebido a chamada de refreshSession
  assert.ok(mockSupabase.getStats().refreshCalls > 0, 'Supabase refreshSession deve ter sido chamado');
  // O access token renovado deve estar no storage com expiração futura
  const stored = await secureSession.getSessionFromStorageTiers();
  assert.ok(stored.expires_at > Math.floor(Date.now() / 1000));
});

test('Cenário 3: Falha temporária de rede durante refresh NÃO apaga sessão nem faz logout (modo offline)', async () => {
  resetAllMocks();
  const expiredSession = createMockSession('user_offline_test', -3600);
  await secureSession.saveSessionSecurely(expiredSession);

  const mockSupabase = createMockSupabase(expiredSession);
  // Simula erro transitório de rede do Supabase
  const networkError = new Error('TypeError: fetch failed');
  networkError.name = 'AuthRetryableFetchError';
  mockSupabase.setError(networkError);

  const result = await secureSession.restoreSessionSecurely(mockSupabase);

  assert.strictEqual(result.isOffline, true, 'Deve sinalizar explicitamente isOffline: true');
  assert.strictEqual(result.session.user.id, 'user_offline_test');

  // As credenciais devem continuar íntegras no storage
  const stored = await secureSession.getSessionFromStorageTiers();
  assert.ok(stored, 'Credenciais não podem ter sido apagadas do storage');
  assert.strictEqual(stored.user.id, 'user_offline_test');
});

test('Cenário 4: Recuperação online após falha transitória restaura tokens e incrementa sequência', async () => {
  resetAllMocks();
  const session = createMockSession('user_recovery', 3600);
  await secureSession.saveSessionSecurely(session);

  const initialRaw = JSON.parse(localStorageMock.getItem(secureSession.SESSION_KEY));
  const initialSeq = initialRaw._seq;

  const mockSupabase = createMockSupabase(session);
  const { session: renewed, error } = await secureSession.refreshSessionCentralized(mockSupabase, true);

  assert.strictEqual(error, null);
  assert.ok(renewed);

  const updatedRaw = JSON.parse(localStorageMock.getItem(secureSession.SESSION_KEY));
  assert.ok(updatedRaw._seq > initialSeq, 'Sequência monotônica deve ter incrementado');
});

test('Cenário 5: Fallback transparente do SecureStorage para Preferences em ambiente nativo', async () => {
  resetAllMocks();
  isNative = true;
  secureStorageAvailable = false; // Simula Keychain indisponível

  const session = createMockSession('user_native_fallback', 3600);
  // Deve salvar sem estourar exceção, fazendo fallback para Preferences
  await secureSession.setSecureStorageWithRetry(secureSession.SESSION_KEY, JSON.stringify(session), 2, 5);

  // O Keychain falhou, mas Preferences deve conter o valor
  const { Preferences } = await import('@capacitor/preferences');
  const prefResult = await Preferences.get({ key: secureSession.SESSION_KEY });
  assert.ok(prefResult.value, 'Preferences deve conter a chave após fallback');

  // Leitura com fallback deve recuperar a sessão com sucesso das camadas de storage
  const retrieved = await secureSession.getSessionFromStorageTiers();
  assert.ok(retrieved);
  assert.strictEqual(retrieved.user.id, 'user_native_fallback');
});

test('Cenário 6: Reconciliação entre storage e cookies respeita versão mais recente', async () => {
  resetAllMocks();
  const projectRef = secureSession.getProjectRef();
  const storageKey = `sb-${projectRef}-auth-token`;

  const oldSession = { ...createMockSession('user_sync', 3600), _seq: 1 };
  const newSession = { ...createMockSession('user_sync', 3600), _seq: 5 };

  // Storage com sessão mais nova
  localStorageMock.setItem(storageKey, JSON.stringify(newSession));
  localStorageMock.setItem(secureSession.SESSION_KEY, JSON.stringify(newSession));

  // Cookie com sessão mais antiga
  documentMock.cookie = `${storageKey}=${encodeURIComponent(JSON.stringify(oldSession))}; path=/`;

  const mockSupabase = createMockSupabase(newSession);
  const result = await secureSession.restoreSessionSecurely(mockSupabase);

  assert.strictEqual(result.success, true);
  // A sessão do storage deve ter prevalecido
  const current = await secureSession.getSessionFromStorageTiers();
  assert.strictEqual(current._seq, 5);
});

test('Cenário 7: Múltiplas chamadas concorrentes de refreshSession são deduplicadas (mutex)', async () => {
  resetAllMocks();
  const session = createMockSession('user_concurrent', 3600);
  await secureSession.saveSessionSecurely(session);

  const mockSupabase = createMockSupabase(session);
  mockSupabase.setDelay(50); // Adiciona 50ms de latência simulada

  // Dispara 5 requisições de refresh simultâneas
  const promises = [
    secureSession.refreshSessionCentralized(mockSupabase, true),
    secureSession.refreshSessionCentralized(mockSupabase, true),
    secureSession.refreshSessionCentralized(mockSupabase, true),
    secureSession.refreshSessionCentralized(mockSupabase, true),
    secureSession.refreshSessionCentralized(mockSupabase, true)
  ];

  const results = await Promise.all(promises);

  // Todas devem ser bem-sucedidas
  for (const res of results) {
    assert.strictEqual(res.error, null);
    assert.ok(res.session);
  }

  // A API subjacente do Supabase deve ter sido chamada apenas UMA vez graças ao mutex
  assert.strictEqual(mockSupabase.getStats().refreshCalls, 1, 'Supabase refreshSession deve ter sido chamado exatamente uma vez');
});

test('Cenário 8: Logout durante refresh em andamento cancela gravação tardia e impede ressurreição', async () => {
  resetAllMocks();
  const session = createMockSession('user_logout_race', 3600);
  await secureSession.saveSessionSecurely(session);

  const mockSupabase = createMockSupabase(session);
  mockSupabase.setDelay(80); // Latência de 80ms

  // Inicia refresh assíncrono
  const refreshPromise = secureSession.refreshSessionCentralized(mockSupabase, true);

  // Imediatamente executa logout (30ms depois)
  await new Promise(r => setTimeout(r, 30));
  await secureSession.clearSessionSecurely('user_logout_race');
  await secureSession.setLogoutBarrier();

  // Aguarda término da promessa de refresh
  await refreshPromise;

  // Verifica se o refresh tardio ressuscitou a sessão
  const storedAfter = await secureSession.getSessionFromStorageTiers();
  assert.strictEqual(storedAfter, null, 'Sessão não pode ter sido ressuscitada pelo refresh tardio');
  assert.ok(await secureSession.getLogoutBarrier(), 'Barreira de logout deve continuar ativa');
});

test('Cenário 9: Troca de contas com resposta tardia não sobrescreve nova conta', async () => {
  resetAllMocks();
  const sessionUserA = createMockSession('user_A', 3600);
  await secureSession.saveSessionSecurely(sessionUserA, { isExplicitLogin: true });

  // User A faz logout e User B faz login explícito
  await secureSession.clearSessionSecurely('user_A');
  const sessionUserB = createMockSession('user_B', 3600);
  await secureSession.saveSessionSecurely(sessionUserB, { isExplicitLogin: true });

  const current = await secureSession.getSessionFromStorageTiers();
  assert.strictEqual(current.user.id, 'user_B');

  // Resposta atrasada de User A tenta gravar com sequência antiga
  await secureSession.saveSessionSecurely({
    ...sessionUserA,
    _seq: 1 // sequência antiga
  });

  // O usuário no storage deve continuar sendo User B
  const afterStale = await secureSession.getSessionFromStorageTiers();
  assert.strictEqual(afterStale.user.id, 'user_B', 'User B não pode ser sobrescrito pela escrita tardia de User A');
});

test('Cenário 10: Logout offline seguido de reconexão é barrado pelo marcador persistente', async () => {
  resetAllMocks();
  isOnline = false; // Usuário está offline

  const session = createMockSession('user_offline_logout', 3600);
  await secureSession.saveSessionSecurely(session);

  // Usuário faz logout enquanto offline
  await secureSession.clearSessionSecurely('user_offline_logout');
  await secureSession.setLogoutBarrier();

  // Simula cookie residual do servidor que ainda existe na máquina
  const projectRef = secureSession.getProjectRef();
  documentMock.cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify(session))}; path=/`;

  // Reconexão / cold boot
  isOnline = true;
  const mockSupabase = createMockSupabase(session);

  // Restauração deve ser impedida pelo logout barrier
  const result = await secureSession.restoreSessionSecurely(mockSupabase);
  assert.strictEqual(result.success, false, 'Restauração automática deve ser bloqueada pela barreira');
  assert.strictEqual(result.session, null);
});

test('Cenário 11: Revogação permanente (invalid_grant / refresh_token_not_found) é detectada e tratada', async () => {
  resetAllMocks();
  const session = createMockSession('user_revoked', 3600);
  await secureSession.saveSessionSecurely(session);

  // Teste 11.1: Erro de rede NÃO é revogação permanente
  const netErr = new Error('Failed to fetch');
  assert.strictEqual(secureSession.isPermanentTokenRevocation(netErr), false);
  assert.strictEqual(secureSession.isNetworkOrTransientError(netErr), true);

  // Teste 11.2: Erro definitivo de refresh token
  const permanentErr1 = {
    code: 'refresh_token_not_found',
    message: 'Invalid Refresh Token: Refresh Token Not Found'
  };
  assert.strictEqual(secureSession.isPermanentTokenRevocation(permanentErr1), true);
  assert.strictEqual(secureSession.isNetworkOrTransientError(permanentErr1), false);

  const permanentErr2 = {
    code: 'invalid_grant',
    message: 'Invalid Refresh Token: Already Used'
  };
  assert.strictEqual(secureSession.isPermanentTokenRevocation(permanentErr2), true);
});

test('Cenário 12: Preservação de configurações independentes de conta (edu-theme, sidebar-theme)', async () => {
  resetAllMocks();
  // Configurações independentes de conta
  localStorageMock.setItem('edu-theme', 'dark');
  localStorageMock.setItem('edu-sidebar-theme', 'compact');
  localStorageMock.setItem('edu-device-uuid', 'xyz-123');

  // Chaves do usuário
  localStorageMock.setItem(secureSession.SESSION_KEY, JSON.stringify(createMockSession('user_settings', 3600)));
  localStorageMock.setItem('sb-test-auth-token', 'token-data');
  localStorageMock.setItem('edu-user-photo-user_settings', 'photo-data');
  localStorageMock.setItem('edu-profile-extra-user_settings', 'profile-extra-data');

  // Executa limpeza de sessão
  await secureSession.clearSessionSecurely('user_settings');

  // Configurações independentes devem ser preservadas
  assert.strictEqual(localStorageMock.getItem('edu-theme'), 'dark', 'edu-theme deve ser preservado');
  assert.strictEqual(localStorageMock.getItem('edu-sidebar-theme'), 'compact', 'edu-sidebar-theme deve ser preservado');
  assert.strictEqual(localStorageMock.getItem('edu-device-uuid'), 'xyz-123', 'edu-device-uuid deve ser preservado');

  // Chaves de auth e caches do usuário devem ter sido removidas
  assert.strictEqual(localStorageMock.getItem(secureSession.SESSION_KEY), null);
  assert.strictEqual(localStorageMock.getItem('edu-user-photo-user_settings'), null);
  assert.strictEqual(localStorageMock.getItem('edu-profile-extra-user_settings'), null);
});

test('Cenário 13: Limpeza de cookies e storage estritamente restrita ao projectRef do Supabase', async () => {
  resetAllMocks();
  const currentProjectRef = secureSession.getProjectRef();
  const otherProjectRef = 'otherproj999';

  // Seta cookies do projeto atual e de outro projeto
  documentMock.cookie = `sb-${currentProjectRef}-auth-token=token_current; path=/`;
  documentMock.cookie = `sb-${currentProjectRef}-auth-token.0=chunk_0; path=/`;
  documentMock.cookie = `sb-${otherProjectRef}-auth-token=token_other; path=/`;
  documentMock.cookie = `other_app_cookie=some_value; path=/`;

  // Limpa cookies do projeto atual
  secureSession.clearSessionCookiesOnClient(currentProjectRef);

  // Cookies do projeto atual devem ter sumido
  assert.ok(!cookieMap.has(`sb-${currentProjectRef}-auth-token`), 'Cookie do projeto atual deve ser removido');
  assert.ok(!cookieMap.has(`sb-${currentProjectRef}-auth-token.0`), 'Chunks do projeto atual devem ser removidos');

  // Cookies de outros projetos e da aplicação devem ser preservados
  assert.ok(cookieMap.has(`sb-${otherProjectRef}-auth-token`), 'Cookie de outro projeto Supabase NÃO pode ser removido');
  assert.ok(cookieMap.has('other_app_cookie'), 'Cookies alheios à autenticação NÃO podem ser removidos');
});

test('Cenário 14: ClearLogoutBarrier limpa barreira no storage e cookie após login bem-sucedido', async () => {
  resetAllMocks();
  await secureSession.setLogoutBarrier();
  assert.ok(await secureSession.getLogoutBarrier(), 'Barreira deve estar ativa');

  await secureSession.clearLogoutBarrier();
  assert.strictEqual(await secureSession.getLogoutBarrier(), null, 'Barreira deve ser nula após clear');
  assert.ok(!cookieMap.has(secureSession.LOGOUT_BARRIER_KEY));
});

test('Cenário 15: isSessionExpiredOrExpiringSoon detecta expiração com limiar de segurança configurável', () => {
  const now = Math.floor(Date.now() / 1000);

  // Expira em 10 minutos (600s) -> NÃO está expirando logo se limiar for 300s
  const session1 = { access_token: 'acc', refresh_token: 'ref', expires_at: now + 600 };
  assert.strictEqual(secureSession.isSessionExpiredOrExpiringSoon(session1, 300), false);

  // Expira em 3 minutos (180s) -> ESTÁ expirando logo se limiar for 300s
  const session2 = { access_token: 'acc', refresh_token: 'ref', expires_at: now + 180 };
  assert.strictEqual(secureSession.isSessionExpiredOrExpiringSoon(session2, 300), true);

  // Já expirou (-10s) -> expirado
  const session3 = { access_token: 'acc', refresh_token: 'ref', expires_at: now - 10 };
  assert.strictEqual(secureSession.isSessionExpiredOrExpiringSoon(session3, 300), true);
});

test('Cenário 16: clearSessionSecurely remove chaves de usuário (edu-current-user, etc.) do Keychain e Preferences', async () => {
  resetAllMocks();
  isNative = true;

  // Popula chaves de perfil nos tiers
  storageMap.set('cap_sec_edu-current-user', JSON.stringify({ id: 'user_test', nome: 'João' }));
  storageMap.set('cap_sec_edu-current-perfil', 'Professor');
  storageMap.set('CapacitorStorage.edu-current-user', JSON.stringify({ id: 'user_test', nome: 'João' }));
  storageMap.set('CapacitorStorage.edu_auth_user', JSON.stringify({ id: 'user_test' }));
  localStorageMock.setItem('edu-current-user', JSON.stringify({ id: 'user_test' }));
  localStorageMock.setItem('edu-current-perfil', 'Professor');

  await secureSession.clearSessionSecurely('user_test');

  assert.strictEqual(storageMap.has('cap_sec_edu-current-user'), false, 'edu-current-user deve ser removido do Keychain');
  assert.strictEqual(storageMap.has('cap_sec_edu-current-perfil'), false, 'edu-current-perfil deve ser removido do Keychain');
  assert.strictEqual(storageMap.has('CapacitorStorage.edu-current-user'), false, 'edu-current-user deve ser removido de Preferences');
  assert.strictEqual(storageMap.has('CapacitorStorage.edu_auth_user'), false, 'edu_auth_user deve ser removido de Preferences');
  assert.strictEqual(localStorageMock.getItem('edu-current-user'), null, 'edu-current-user deve ser removido do localStorage');
});

test('Cenário 17: isPermanentTokenRevocation reconhece mensagens de sessão vazia e logout', () => {
  assert.strictEqual(secureSession.isPermanentTokenRevocation({ message: 'No valid session stored to refresh' }), true);
  assert.strictEqual(secureSession.isPermanentTokenRevocation({ message: 'User logged out' }), true);
  assert.strictEqual(secureSession.isPermanentTokenRevocation({ message: 'Logout barrier active' }), true);
  assert.strictEqual(secureSession.isPermanentTokenRevocation({ message: 'Network connection failed' }), false);
});

