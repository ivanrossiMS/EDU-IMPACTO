import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isCobrancaPaidStatus,
  resolveCobrancaPaymentTimestamp,
  normalizeIsoTimestamp,
} from '../lib/cobrancasUtils.ts'
import {
  extractMercadoPagoPaidAt,
  enrichDestinatariosWithPaymentDates,
} from '../lib/server/mercadopagoSync.ts'
import {
  signCobrancaReceiptToken,
  verifyCobrancaReceiptToken,
  buildCobrancaReceiptPath,
} from '../lib/server/receiptToken.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('isCobrancaPaidStatus recognizes all paid statuses case-insensitively', () => {
  assert.equal(isCobrancaPaidStatus('RECEIVED'), true)
  assert.equal(isCobrancaPaidStatus('CONFIRMED'), true)
  assert.equal(isCobrancaPaidStatus('PAID'), true)
  assert.equal(isCobrancaPaidStatus('pago'), true)
  assert.equal(isCobrancaPaidStatus('PENDING'), false)
  assert.equal(isCobrancaPaidStatus('OVERDUE'), false)
  assert.equal(isCobrancaPaidStatus(null), false)
})

test('resolveCobrancaPaymentTimestamp never falls back to created_at or generic updated_at', () => {
  const rowCreatedOnly = {
    status: 'RECEIVED',
    created_at: '2026-11-05T19:51:53.126802+00:00',
    updated_at: '2026-11-05T19:51:53.126802+00:00',
  }
  assert.equal(resolveCobrancaPaymentTimestamp(rowCreatedOnly), null)

  const rowPendingWithPaidAt = {
    status: 'PENDING',
    created_at: '2026-11-05T19:51:53.126802+00:00',
    paid_at: '2026-11-18T13:41:55.000Z',
  }
  assert.equal(resolveCobrancaPaymentTimestamp(rowPendingWithPaidAt), null)

  const rowPaidWithPaidAt = {
    status: 'RECEIVED',
    created_at: '2026-11-05T19:51:53.126802+00:00',
    paid_at: '2026-11-18T09:41:55.000-04:00',
  }
  assert.equal(
    resolveCobrancaPaymentTimestamp(rowPaidWithPaidAt),
    '2026-11-18T13:41:55.000Z'
  )
})

test('normalizeIsoTimestamp rejects invalid dates and normalizes valid offsets', () => {
  assert.equal(normalizeIsoTimestamp(''), null)
  assert.equal(normalizeIsoTimestamp('not-a-date'), null)
  assert.equal(
    normalizeIsoTimestamp('2026-11-13T16:01:05.000-04:00'),
    '2026-11-13T20:01:05.000Z'
  )
})

test('UI and XLSX exports no longer fall back to d.updated_at || d.created_at', () => {
  const filesToCheck = [
    'app/agenda-digital/admin/cobrancas/components/CobrancaDetailsModal.tsx',
    'app/agenda-digital/admin/cobrancas/page.tsx',
  ]
  for (const rel of filesToCheck) {
    const content = fs.readFileSync(path.join(rootDir, rel), 'utf8')
    assert.equal(
      content.includes('d.updated_at || d.created_at'),
      false,
      `${rel} must not fall back to d.updated_at || d.created_at for payment date`
    )
    assert.equal(
      content.includes('resolveCobrancaPaymentTimestamp'),
      true,
      `${rel} must use resolveCobrancaPaymentTimestamp`
    )
  }
})

test('Mercado Pago webhook and /api/cobrancas persist and clear paid_at properly', () => {
  const webhookContent = fs.readFileSync(
    path.join(rootDir, 'app/api/webhooks/mercadopago/route.ts'),
    'utf8'
  )
  assert.match(webhookContent, /extractMercadoPagoPaidAt/)
  assert.match(webhookContent, /paid_at/)

  const apiContent = fs.readFileSync(
    path.join(rootDir, 'app/api/cobrancas/route.ts'),
    'utf8'
  )
  assert.match(apiContent, /enrichDestinatariosWithPaymentDates/)
  assert.match(apiContent, /paid_at:\s*isMarkingPaid\s*\?\s*nowIso\s*:\s*null/)

  const modalContent = fs.readFileSync(
    path.join(rootDir, 'components/agenda/ComunicadoViewModal.tsx'),
    'utf8'
  )
  assert.equal(modalContent.includes('json.destinatario'), true)
  assert.equal(modalContent.includes('pagador_usuario_nome'), true)
})

test('extractMercadoPagoPaidAt returns normalized date_approved only for approved payments', () => {
  assert.equal(
    extractMercadoPagoPaidAt({
      status: 'approved',
      date_approved: '2026-11-18T09:41:55.000-04:00',
      date_created: '2026-11-18T09:37:54.000-04:00',
    }),
    '2026-11-18T13:41:55.000Z'
  )
  assert.equal(
    extractMercadoPagoPaidAt({
      status: 'pending',
      date_created: '2026-11-18T09:37:54.000-04:00',
    }),
    null
  )
})

test('enrichDestinatariosWithPaymentDates resolves real MP payment dates and ignores pending/already-stamped rows', async () => {
  const originalFetch = globalThis.fetch
  const originalToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-token'

  const fetchedIds = []
  globalThis.fetch = async (url) => {
    const id = String(url).split('/').pop()
    fetchedIds.push(id)
    return new Response(
      JSON.stringify({
        id,
        status: 'approved',
        date_approved: '2026-11-13T16:01:05.000-04:00',
        payment_method_id: 'visa',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const rows = [
      {
        id: 'row-needs-mp',
        status: 'RECEIVED',
        created_at: '2026-11-05T19:49:32.264092+00:00',
        asaas_payment_id: '189479487820',
      },
      {
        id: 'row-already-paid-at',
        status: 'RECEIVED',
        created_at: '2026-11-05T19:49:32.264092+00:00',
        paid_at: '2026-11-12T23:19:53.000Z',
        asaas_payment_id: '189322216960',
      },
      {
        id: 'row-pending',
        status: 'PENDING',
        created_at: '2026-11-05T19:49:32.264092+00:00',
        asaas_payment_id: 'pref-123',
      },
    ]

    const enriched = await enrichDestinatariosWithPaymentDates(rows, undefined, {
      persistToDb: false,
    })

    assert.deepEqual(fetchedIds, ['189479487820'])
    assert.equal(enriched[0].paid_at, '2026-11-13T20:01:05.000Z')
    assert.equal(enriched[0].payment_method, 'visa')
    assert.equal(enriched[1].paid_at, '2026-11-12T23:19:53.000Z')
    assert.equal(enriched[2].paid_at, undefined)
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN
    else process.env.MERCADOPAGO_ACCESS_TOKEN = originalToken
  }
})

test('Cobrancas API loads relational aluno_responsavel/responsaveis and mercadopago-generate resolves logged-in payer name', () => {
  const apiContent = fs.readFileSync(
    path.join(rootDir, 'app/api/cobrancas/route.ts'),
    'utf8'
  )
  assert.match(apiContent, /fetchAllTableRows\('aluno_responsavel'/)
  assert.match(apiContent, /fetchAllTableRows\('responsaveis'/)
  assert.match(apiContent, /userNameByAuthId/)

  const mpGenContent = fs.readFileSync(
    path.join(rootDir, 'app/api/cobrancas/mercadopago-generate/route.ts'),
    'utf8'
  )
  assert.match(mpGenContent, /\.from\('responsaveis'\)/)
  assert.match(mpGenContent, /pagador_usuario_nome = resolvedPayerName/)

  const modalContent = fs.readFileSync(
    path.join(rootDir, 'components/agenda/ComunicadoViewModal.tsx'),
    'utf8'
  )
  assert.match(modalContent, /isMercadoPago/)
  assert.match(modalContent, /Envio:/)
  assert.match(modalContent, /Pago em/)
  assert.match(modalContent, /Comprovante/)
})

test('Signed cobranca receipt token validates authentic IDs and rejects tampered tokens', () => {
  const id = '3e24e239-b307-47c0-89d3-c1c7c1134c98'
  const sig = signCobrancaReceiptToken(id)
  assert.equal(verifyCobrancaReceiptToken(id, sig), true)
  assert.equal(verifyCobrancaReceiptToken(id, 'tampered-signature'), false)
  assert.equal(verifyCobrancaReceiptToken('other-id', sig), false)
  assert.equal(verifyCobrancaReceiptToken(id, ''), false)

  const pathStr = buildCobrancaReceiptPath(id)
  assert.equal(pathStr, `/recibo/cobranca/${id}?sig=${sig}`)
})

test('Paid charges open and copy receipt_url instead of checkout url_pagamento', () => {
  const mpGenContent = fs.readFileSync(
    path.join(rootDir, 'app/api/cobrancas/mercadopago-generate/route.ts'),
    'utf8'
  )
  assert.match(mpGenContent, /alreadyPaid:\s*true/)
  assert.match(mpGenContent, /receiptUrl:\s*buildCobrancaReceiptPath/)

  const modalContent = fs.readFileSync(
    path.join(rootDir, 'components/agenda/ComunicadoViewModal.tsx'),
    'utf8'
  )
  assert.match(modalContent, /getCobReceiptUrl/)
  assert.match(modalContent, /Comprovante/)

  const detailsContent = fs.readFileSync(
    path.join(rootDir, 'app/agenda-digital/admin/cobrancas/components/CobrancaDetailsModal.tsx'),
    'utf8'
  )
  assert.match(detailsContent, /isPaid \? 'Comprovante' : 'Fatura'/)

  const pageContent = fs.readFileSync(
    path.join(rootDir, 'app/agenda-digital/admin/cobrancas/page.tsx'),
    'utf8'
  )
  assert.match(pageContent, /getReceiptUrlForDest/)
  assert.match(pageContent, /Link do comprovante copiado!/)

  assert.equal(
    fs.existsSync(path.join(rootDir, 'app/recibo/cobranca/[id]/page.tsx')),
    true,
    'Receipt page must exist at app/recibo/cobranca/[id]/page.tsx'
  )

  const reciboLayout = fs.readFileSync(
    path.join(rootDir, 'app/recibo/layout.tsx'),
    'utf8'
  )
  assert.equal(reciboLayout.includes('<html'), false, 'app/recibo/layout.tsx must not render nested <html>')
  assert.equal(reciboLayout.includes('<body'), false, 'app/recibo/layout.tsx must not render nested <body>')
})
