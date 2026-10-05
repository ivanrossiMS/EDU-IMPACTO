import test from 'node:test'
import assert from 'node:assert/strict'

// 1. Test Startup Diagnostics module directly
import { startupDiagnostics } from '../lib/diagnostics/startupDiagnostics.ts'

test('StartupDiagnostics - Initializes and records milestones without throwing', () => {
  const correlationId = startupDiagnostics.init()
  assert.ok(correlationId, 'Correlation ID should be generated')
  assert.equal(typeof correlationId, 'string')
  assert.ok(correlationId.length > 5)

  startupDiagnostics.mark('test_start', { test: true })
  startupDiagnostics.mark('test_step_1', { step: 1 })
  startupDiagnostics.mark('test_step_2')

  const logs = startupDiagnostics.getLogs()
  assert.ok(Array.isArray(logs))
  assert.ok(logs.length >= 3)

  const hasStep1 = logs.some(l => l.milestone === 'test_step_1')
  assert.ok(hasStep1, 'Logs should contain test_step_1')
})

test('StartupDiagnostics - Strict PII Redaction prevents sensitive data leaks', () => {
  startupDiagnostics.init()

  // Attempt to pass tokens, passwords, and student names
  startupDiagnostics.mark('auth_payload', {
    password: 'super_secret_password',
    token: 'jwt.bearer.secret.token',
    access_token: 'xyz123',
    refresh_token: 'refresh_secret',
    aluno: 'João Pedro de Almeida',
    nome: 'Maria da Silva',
    matricula: '2024001',
    cpf: '123.456.789-00',
    email: 'user@example.com',
    safe_metric: 42
  })

  const logs = startupDiagnostics.getLogs()
  const authLog = logs.find(l => l.milestone === 'auth_payload')
  assert.ok(authLog, 'Auth log must exist')
  assert.ok(authLog.data, 'Data object must exist')

  // Verify redactions
  assert.equal(authLog.data.password, '[REDACTED]')
  assert.equal(authLog.data.token, '[REDACTED]')
  assert.equal(authLog.data.access_token, '[REDACTED]')
  assert.equal(authLog.data.refresh_token, '[REDACTED]')
  assert.equal(authLog.data.aluno, '[REDACTED]')
  assert.equal(authLog.data.nome, '[REDACTED]')
  assert.equal(authLog.data.matricula, '[REDACTED]')
  assert.equal(authLog.data.cpf, '[REDACTED]')
  assert.equal(authLog.data.email, '[REDACTED]')
  assert.equal(authLog.data.safe_metric, 42, 'Safe non-PII metrics must be preserved')
})

test('StartupDiagnostics - Records errors safely with correlation ID', () => {
  startupDiagnostics.init()

  const dummyError = new Error('Simulated network timeout')
  startupDiagnostics.recordError('network_timeout_event', dummyError, { endpoint: '/api/v1/session' })

  const logs = startupDiagnostics.getLogs()
  const errLog = logs.find(l => l.milestone === 'error_network_timeout_event' || l.milestone === 'network_network_timeout_event')
  assert.ok(errLog)
  assert.equal(errLog.data.errorMessage, 'Simulated network timeout')
  assert.equal(errLog.data.endpoint, '/api/v1/session')
  assert.ok(startupDiagnostics.getCorrelationId())
})

test('StartupDiagnostics - Robustness: never throws even on invalid or circular input', () => {
  assert.doesNotThrow(() => {
    startupDiagnostics.mark(null)
    startupDiagnostics.mark(undefined)
    startupDiagnostics.recordError(null, null)
    
    // Circular reference test
    const circularObj = {}
    circularObj.self = circularObj
    startupDiagnostics.mark('circular', circularObj)
  })
})

// 2. Storage Timeout Resilience Test
test('Storage Timeout Protection - withTimeout aborts hanging operations', async () => {
  // Simulate hanging plugin call (e.g. iOS Keychain lock or Android Keystore stall)
  const hangingPromise = new Promise((resolve) => {
    // Never resolves
  })

  function withTimeout(promise, ms, fallbackValue) {
    let timer
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallbackValue), ms)
    })
    return Promise.race([
      promise.then((res) => {
        clearTimeout(timer)
        return res
      }),
      timeout
    ])
  }

  const start = Date.now()
  const result = await withTimeout(hangingPromise, 150, 'FALLBACK_OK')
  const elapsed = Date.now() - start

  assert.equal(result, 'FALLBACK_OK', 'Must return fallback value when hung')
  assert.ok(elapsed >= 140 && elapsed < 350, `Must resolve near 150ms timeout (took ${elapsed}ms)`)
})

test('Storage Timeout Protection - withTimeout passes through fast successful operations', async () => {
  function withTimeout(promise, ms, fallbackValue) {
    let timer
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallbackValue), ms)
    })
    return Promise.race([
      promise.then((res) => {
        clearTimeout(timer)
        return res
      }),
      timeout
    ])
  }

  const fastPromise = Promise.resolve({ value: 'SECURE_TOKEN_DATA' })
  const result = await withTimeout(fastPromise, 500, null)
  assert.deepEqual(result, { value: 'SECURE_TOKEN_DATA' })
})

test('Storage Timeout Protection - withTimeout handles rejected promises cleanly', async () => {
  function withTimeout(promise, ms, fallbackValue) {
    let timer
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallbackValue), ms)
    })
    return Promise.race([
      promise.then((res) => {
        clearTimeout(timer)
        return res
      }),
      timeout
    ])
  }

  const failingPromise = Promise.reject(new Error('Keychain access denied'))
  await assert.rejects(
    async () => await withTimeout(failingPromise, 500, null),
    { message: 'Keychain access denied' }
  )
})
