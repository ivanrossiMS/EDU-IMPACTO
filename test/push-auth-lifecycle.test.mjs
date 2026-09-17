import test from 'node:test';
import assert from 'node:assert/strict';

// ── Mock do OneSignal Nativo (Capacitor Plugin v5) ─────────────────────────
class MockOneSignalNative {
  constructor() {
    this.reset();
  }

  reset() {
    this.externalId = null;
    this.onesignalId = 'mock-os-id-' + Math.random().toString(36).substring(7);
    this.optedIn = false;
    this.permissionGranted = true; // SO concedeu permissão
    this.aliases = {};
    this.tags = {};
    this.callLog = [];
  }

  async initialize(appId) {
    this.callLog.push({ method: 'initialize', appId });
  }

  async login(externalId) {
    this.callLog.push({ method: 'login', externalId });
    // Simula pequena latência de I/O nativo
    await new Promise(r => setTimeout(r, 10));
    this.externalId = externalId;
  }

  async logout() {
    this.callLog.push({ method: 'logout' });
    await new Promise(r => setTimeout(r, 10));
    this.externalId = null;
    this.aliases = {};
  }

  Notifications = {
    getPermissionAsync: async () => {
      this.callLog.push({ method: 'Notifications.getPermissionAsync' });
      return this.permissionGranted;
    },
    requestPermission: async (fallbackToSettings) => {
      this.callLog.push({ method: 'Notifications.requestPermission', fallbackToSettings });
      return this.permissionGranted;
    },
    addEventListener: () => {},
  };

  User = {
    getExternalId: async () => {
      return this.externalId;
    },
    getOnesignalId: async () => {
      return this.onesignalId;
    },
    addAlias: async (label, id) => {
      this.callLog.push({ method: 'User.addAlias', label, id });
      this.aliases[label] = id;
    },
    addAliases: async (aliasesObj) => {
      this.callLog.push({ method: 'User.addAliases', aliasesObj });
      Object.assign(this.aliases, aliasesObj);
    },
    addTags: async (tags) => {
      this.callLog.push({ method: 'User.addTags', tags });
      Object.assign(this.tags, tags);
    },
    pushSubscription: {
      getIdAsync: async () => 'mock-sub-id',
      getTokenAsync: async () => 'mock-push-token-fcm',
      getOptedInAsync: async () => this.optedIn,
      optIn: async () => {
        this.callLog.push({ method: 'User.pushSubscription.optIn' });
        this.optedIn = true;
      },
      optOut: async () => {
        this.callLog.push({ method: 'User.pushSubscription.optOut' });
        this.optedIn = false;
      },
      addEventListener: () => {},
    },
  };
}

// ── Simulação do NotificationService com a lógica idêntica da implementação ─
class TestableNotificationService {
  constructor(nativeSdk) {
    this.native = nativeSdk;
    this.initialized = false;
    this.currentUserId = null;
    this.identityQueue = Promise.resolve();
    this.state = {
      isNative: true,
      permissionStatus: 'notDetermined',
      subscription: {
        isSubscribed: false,
        userId: null,
        optedIn: false,
      },
    };
  }

  enqueueIdentityOp(op) {
    const run = async () => {
      try {
        return await op();
      } catch (err) {
        throw err;
      }
    };
    const resultPromise = this.identityQueue.then(run, run);
    this.identityQueue = resultPromise.then(() => {}, () => {});
    return resultPromise;
  }

  async initialize() {
    if (this.initialized) return;
    await this.native.initialize('test-app-id');
    this.initialized = true;
    await this.refresh();
  }

  async refresh() {
    const hasPerm = await this.native.Notifications.getPermissionAsync();
    const permStatus = hasPerm ? 'authorized' : 'denied';
    const optedIn = await this.native.User.pushSubscription.getOptedInAsync();
    const extId = await this.native.User.getExternalId();

    // REGRA DE OURO: Só dá optIn se houver currentUserId autenticado
    if (this.currentUserId && permStatus === 'authorized' && !optedIn) {
      await this.native.User.pushSubscription.optIn();
    }

    const currentOptedIn = await this.native.User.pushSubscription.getOptedInAsync();
    this.state = {
      isNative: true,
      permissionStatus: permStatus,
      subscription: {
        isSubscribed: Boolean(hasPerm && currentOptedIn),
        userId: extId,
        optedIn: currentOptedIn,
      },
    };
    return this.state;
  }

  async syncUser(user, extraData) {
    return this.enqueueIdentityOp(() => this._doSyncUser(user, extraData));
  }

  async _doSyncUser(user, extraData) {
    if (!user?.id) return;
    if (!this.initialized) {
      await this.initialize();
    }

    const userId = String(user.id);
    const nativeExtId = await this.native.User.getExternalId();
    const needsLogin = nativeExtId !== userId || this.currentUserId !== userId;

    if (needsLogin) {
      await this.native.login(userId);
      this.currentUserId = userId;
    } else {
      this.currentUserId = userId;
    }

    const nativePerm = await this.native.Notifications.getPermissionAsync();
    if (nativePerm) {
      await this.native.User.pushSubscription.optIn();
    }

    const aliasesRecord = {};
    if (user.responsavel_id) aliasesRecord['responsavel_id'] = String(user.responsavel_id);
    if (user.aluno_id) aliasesRecord['aluno_id'] = String(user.aluno_id);
    if (extraData?.alunoId) aliasesRecord['aluno_id'] = String(extraData.alunoId);

    if (Object.keys(aliasesRecord).length > 0) {
      await this.native.User.addAliases(aliasesRecord);
    }

    await this.refresh();
  }

  async clearUser() {
    return this.enqueueIdentityOp(() => this._doClearUser());
  }

  async _doClearUser() {
    this.currentUserId = null;
    const nativeExtId = await this.native.User.getExternalId();
    if (nativeExtId) {
      await this.native.logout();
    }
    await this.refresh();
  }
}

// ── TESTES ───────────────────────────────────────────────────────────────────

test('1. Primeiro login associa usuário, ativa optIn e inscreve no Push', async () => {
  const native = new MockOneSignalNative();
  const service = new TestableNotificationService(native);

  await service.syncUser({ id: 'user_primeiro_acesso', responsavel_id: 'resp_10' });

  assert.equal(native.externalId, 'user_primeiro_acesso', 'External ID deve ser definido no OneSignal nativo');
  assert.equal(native.optedIn, true, 'Push subscription deve estar com optIn');
  assert.equal(service.state.subscription.isSubscribed, true, 'Estado deve indicar isSubscribed: true');
  assert.equal(native.aliases['responsavel_id'], 'resp_10', 'Alias de responsavel_id deve estar registrado');
});

test('2. Logout desassocia usuário, mas NÃO re-ativa optIn para a conta anônima', async () => {
  const native = new MockOneSignalNative();
  const service = new TestableNotificationService(native);

  // Login inicial
  await service.syncUser({ id: 'user_teste' });
  assert.equal(native.externalId, 'user_teste');
  assert.equal(native.optedIn, true);

  // Logout
  await service.clearUser();

  assert.equal(native.externalId, null, 'External ID nativo deve ser limpo no logout');
  assert.equal(service.currentUserId, null, 'currentUserId local deve ser null');
  // Se o OneSignal no logout desativar a subscription, o refresh() NÃO deve reativá-la
  native.optedIn = false;
  await service.refresh();
  assert.equal(native.optedIn, false, 'Conta anônima deslogada não deve sofrer optIn forçado');
});

test('3. RE-LOGIN com o MESMO USUÁRIO restabelece recebimento de push sem reinstalar', async () => {
  const native = new MockOneSignalNative();
  const service = new TestableNotificationService(native);

  const userId = 'user_mesma_conta';

  // Passo A: Instalação e 1º login
  await service.syncUser({ id: userId, responsavel_id: 'resp_99' });
  assert.equal(native.externalId, userId);
  assert.equal(native.optedIn, true);

  // Passo B: Usuário clica em "Sair"
  await service.clearUser();
  assert.equal(native.externalId, null, 'External ID limpo');

  // Passo C: Usuário faz login novamente na mesma conta
  await service.syncUser({ id: userId, responsavel_id: 'resp_99' });

  // Validação do problema observado pelo usuário:
  assert.equal(native.externalId, userId, 'External ID deve ser restabelecido após segundo login');
  assert.equal(native.optedIn, true, 'Subscrição OneSignal deve estar com optIn');
  assert.equal(service.state.subscription.isSubscribed, true, 'Estado de inscrição deve ser true');
  assert.equal(native.aliases['responsavel_id'], 'resp_99', 'Alias deve ser re-registrado');
});

test('4. Atomicidade da Fila: Chamadas concorrentes logout() -> login() não sofrem race condition', async () => {
  const native = new MockOneSignalNative();
  const service = new TestableNotificationService(native);

  // Simula o bug clássico de concorrência onde clearUser() e syncUser()
  // eram disparados em paralelo sem aguardar um ao outro
  await service.syncUser({ id: 'user_inicial' });

  // Disparo simultâneo sem await individual
  const pLogout = service.clearUser();
  const pLogin = service.syncUser({ id: 'user_novo' });

  await Promise.all([pLogout, pLogin]);

  // A fila garante ordem sequencial estrita: primeiro logout, depois login
  assert.equal(native.externalId, 'user_novo', 'External ID final DEVE ser o do novo login');
  assert.equal(native.optedIn, true, 'Push deve estar ativado para o novo usuário');
  assert.equal(service.state.subscription.isSubscribed, true);

  // Verifica que o logout ocorreu antes do login no histórico de chamadas nativas
  const logoutIdx = native.callLog.findLastIndex(c => c.method === 'logout');
  const loginIdx = native.callLog.findLastIndex(c => c.method === 'login' && c.externalId === 'user_novo');
  assert.ok(logoutIdx < loginIdx, 'logout nativo deve sempre ocorrer ANTES do login subsequente');
});

test('5. Proteção de Hidratação: currentUser nulo antes da hidratação NÃO dispara logout indevido', () => {
  let clearUserCalled = false;
  let syncUserCalled = false;

  const mockService = {
    clearUser: async () => { clearUserCalled = true; },
    syncUser: async () => { syncUserCalled = true; },
  };

  // Simula o efeito do GlobalNotificationProvider
  function simulateProviderEffect(hydrated, currentUser, lastSyncedRef) {
    if (!hydrated) return; // Nova guarda implementada

    if (currentUser?.id) {
      const key = `${currentUser.id}:${currentUser.perfil || ''}:${currentUser.cargo || ''}`;
      if (lastSyncedRef.current === key) return;
      lastSyncedRef.current = key;
      mockService.syncUser(currentUser);
    } else {
      if (lastSyncedRef.current === null) return; // Nova proteção de estado
      lastSyncedRef.current = null;
      mockService.clearUser();
    }
  }

  const lastSyncedRef = { current: null };

  // Frame 1: Cold start / Page load pós window.location.href (hydrated = false, currentUser = null)
  simulateProviderEffect(false, null, lastSyncedRef);
  assert.equal(clearUserCalled, false, 'NÃO deve chamar clearUser() durante hidratação pendente');
  assert.equal(syncUserCalled, false);

  // Frame 2: Sessão hidrata com sucesso (hydrated = true, currentUser = user_1)
  simulateProviderEffect(true, { id: 'user_1', perfil: 'Família' }, lastSyncedRef);
  assert.equal(syncUserCalled, true, 'Deve chamar syncUser() ao hidratar');
  assert.equal(clearUserCalled, false, 'NÃO deve ter chamado clearUser()');

  // Frame 3: Re-render com os mesmos dados
  syncUserCalled = false;
  simulateProviderEffect(true, { id: 'user_1', perfil: 'Família' }, lastSyncedRef);
  assert.equal(syncUserCalled, false, 'Idempotência: re-render não chama syncUser desnecessariamente');

  // Frame 4: Logout explícito (hydrated = true, currentUser = null)
  simulateProviderEffect(true, null, lastSyncedRef);
  assert.equal(clearUserCalled, true, 'Deve chamar clearUser() no logout explícito');

  // Frame 5: Render seguinte já deslogado
  clearUserCalled = false;
  simulateProviderEffect(true, null, lastSyncedRef);
  assert.equal(clearUserCalled, false, 'Não deve chamar clearUser repetidamente quando já deslogado');
});

test('6. Idempotência: syncUser não chama login nativo se SDK já possui o mesmo externalId', async () => {
  const native = new MockOneSignalNative();
  const service = new TestableNotificationService(native);

  await service.syncUser({ id: 'user_estavel' });
  const loginCallsCount1 = native.callLog.filter(c => c.method === 'login').length;
  assert.equal(loginCallsCount1, 1);

  // Segunda chamada com mesmo usuário
  await service.syncUser({ id: 'user_estavel' });
  const loginCallsCount2 = native.callLog.filter(c => c.method === 'login').length;
  assert.equal(loginCallsCount2, 1, 'Não deve reenviar login ao OneSignal nativo se já estiver ativo com mesmo externalId');
});

test('7. Troca de contas: desassocia usuário A e vincula usuário B mantendo subscrição', async () => {
  const native = new MockOneSignalNative();
  const service = new TestableNotificationService(native);

  // Conta A
  await service.syncUser({ id: 'usuario_pai_1', responsavel_id: 'resp_A' });
  assert.equal(native.externalId, 'usuario_pai_1');

  // Logout da conta A
  await service.clearUser();
  assert.equal(native.externalId, null);

  // Conta B
  await service.syncUser({ id: 'usuario_mae_2', responsavel_id: 'resp_B' });
  assert.equal(native.externalId, 'usuario_mae_2');
  assert.equal(native.aliases['responsavel_id'], 'resp_B');
  assert.equal(native.optedIn, true);
  assert.equal(service.state.subscription.isSubscribed, true);
});

test('8. Resiliência a falhas: Se syncUser falhar, lastSyncedIdentityRef NÃO é fixado, permitindo retry automático', async () => {
  let attempts = 0;
  const mockService = {
    syncUser: async () => {
      attempts++;
      if (attempts === 1) throw new Error('Falha de rede transitória');
      return true;
    },
  };

  // Simula o comportamento corrigido do GlobalNotificationProvider
  let lastSyncedIdentity = null;
  let isSyncing = false;

  async function simulateSync(user) {
    const key = `${user.id}:${user.perfil || ''}`;
    if (lastSyncedIdentity === key || isSyncing) return;
    isSyncing = true;
    try {
      await mockService.syncUser(user);
      lastSyncedIdentity = key; // Só fixa em caso de sucesso!
    } catch {
      // Não fixa lastSyncedIdentity, permitindo retry
    } finally {
      isSyncing = false;
    }
  }

  const user = { id: 'user_retry', perfil: 'Família' };

  // Tentativa 1: falha
  await simulateSync(user);
  assert.equal(attempts, 1);
  assert.equal(lastSyncedIdentity, null, 'lastSyncedIdentity deve permanecer null após falha');

  // Tentativa 2 (ex: re-render ou retorno do foreground): executa retry com sucesso
  await simulateSync(user);
  assert.equal(attempts, 2, 'Deve ter tentado novamente');
  assert.equal(lastSyncedIdentity, 'user_retry:Família', 'lastSyncedIdentity deve ser gravado após sucesso');

  // Tentativa 3: já sincronizado, não repete
  await simulateSync(user);
  assert.equal(attempts, 2, 'Não deve chamar novamente quando já sincronizado com sucesso');
});

test('9. Verificação com retry no login nativo confirma externalId antes de concluir', async () => {
  let readAttempts = 0;
  let loggedInId = null;

  const mockNative = {
    login: async (id) => {
      // Simula a escrita assíncrona da ponte nativa
      setTimeout(() => { loggedInId = id; }, 20);
    },
    User: {
      getExternalId: async () => {
        readAttempts++;
        return loggedInId;
      },
    },
  };

  const targetId = 'user_verificado';
  await mockNative.login(targetId);

  let verified = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await mockNative.User.getExternalId();
    if (current === targetId) {
      verified = true;
      break;
    }
    await new Promise(r => setTimeout(r, 15));
  }

  assert.equal(verified, true, 'Deve confirmar que o externalId foi efetivamente gravado');
  assert.ok(readAttempts >= 2, 'Deve ter realizado polling até confirmação');
});

test('10. Poda de subscrições excedentes: remove subscrições mortas (sem token e desativadas)', () => {
  const currentSubId = 'sub_ativa_atual';
  const existingSubs = [
    { id: currentSubId, enabled: true, token: 'token_valido_1' },
    { id: 'sub_antiga_1', enabled: false, token: '' },
    { id: 'sub_antiga_2', enabled: false, token: null },
    { id: 'sub_antiga_3', enabled: true, token: 'token_valido_2' },
    { id: 'sub_antiga_4', enabled: false, token: '' },
  ];

  const deadSubs = existingSubs.filter(
    s => s.id !== currentSubId && s.enabled === false && (!s.token || s.token === '')
  );

  assert.equal(deadSubs.length, 3, 'Deve identificar as 3 subscrições mortas');
  assert.deepEqual(deadSubs.map(s => s.id), ['sub_antiga_1', 'sub_antiga_2', 'sub_antiga_4']);
  assert.ok(!deadSubs.some(s => s.id === currentSubId), 'Nunca deve podar a subscrição ativa atual');
});

test('11. Poda de reinstalações do mesmo celular: remove subscrições órfãs do mesmo modelo e plataforma', () => {
  const currentSubId = 'iphone_ativo_novo';
  const currentSub = { id: currentSubId, type: 'iOSPush', device_model: 'iPhone18,2', enabled: true, token: 'token_novo', session_count: 1 };
  
  const existingSubs = [
    currentSub,
    { id: 'iphone_antigo_1', type: 'iOSPush', device_model: 'iPhone18,2', enabled: true, token: 'token_antigo_1', session_count: 5 },
    { id: 'iphone_antigo_2', type: 'iOSPush', device_model: 'iPhone18,2', enabled: true, token: 'token_antigo_2', session_count: 10 },
    { id: 'android_outro', type: 'AndroidPush', device_model: 'Redmi Note 8', enabled: true, token: 'token_android', session_count: 2 },
  ];

  const isCurrentMobile = currentSub.type === 'iOSPush' || currentSub.type === 'AndroidPush';

  const deadSubs = existingSubs.filter(s => {
    if (s.id === currentSubId) return false;
    if (s.enabled === false || !s.token || s.token === '') return true;

    if (isCurrentMobile) {
      const sameType = s.type === currentSub.type;
      const sameModel = Boolean(s.device_model && currentSub.device_model && s.device_model === currentSub.device_model);
      if (sameType && (sameModel || currentSub.type === 'iOSPush')) {
        return true;
      }
    }
    return false;
  });

  assert.equal(deadSubs.length, 2, 'Deve identificar as 2 subscrições antigas do mesmo iPhone');
  assert.deepEqual(deadSubs.map(s => s.id), ['iphone_antigo_1', 'iphone_antigo_2']);
  assert.ok(!deadSubs.some(s => s.id === 'android_outro'), 'Não deve podar aparelhos de outro tipo/modelo (ex: Redmi Android)');
  assert.ok(!deadSubs.some(s => s.id === currentSubId), 'Nunca deve podar a subscrição recém-sincronizada');
});


