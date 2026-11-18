import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

test('Lembrete de Comunicado - Proteção RBAC, Middleware e Bloqueios de Status', () => {
  const routeSrc = readRepoFile('app/api/comunicados/lembrete/route.ts')
  assert.ok(routeSrc.includes('requireStaff(request)'), 'POST /api/comunicados/lembrete deve exigir requireStaff')
  assert.ok(
    routeSrc.includes("comStatus === 'rascunho' || comStatus === 'agendado'"),
    'Não deve permitir lembrete para rascunho ou agendado'
  )
  assert.ok(routeSrc.includes('REMINDER_COOLDOWN_MS'), 'Deve aplicar cooldown anti-duplicação entre disparos manuais')

  const middlewareSrc = readRepoFile('middleware.ts')
  const blockedBlock = middlewareSrc.slice(
    middlewareSrc.indexOf('const blockedForFamily = ['),
    middlewareSrc.indexOf('const isExplicitlyBlocked =')
  )
  assert.ok(
    blockedBlock.includes("'/api/comunicados/lembrete'"),
    '/api/comunicados/lembrete deve estar explicitamente bloqueado para Família/Aluno no middleware'
  )
})

test('Lembrete de Comunicado - Deduplicação única por disparo e Deep-Linking Direto', () => {
  const routeSrc = readRepoFile('app/api/comunicados/lembrete/route.ts')

  // Cada lembrete deve usar itemId único (-reminder-${reminderBatchId}) para não colidir com o push original em agenda_push_logs,
  // mantendo metadata.item_id e targetUrl apontando para o comunicado real para abertura direta.
  assert.match(routeSrc, /itemId:\s*`\$\{targetComId\}-reminder-\$\{reminderBatchId\}`/)
  assert.match(routeSrc, /itemId:\s*`\$\{comIdStr\}-reminder-\$\{reminderBatchId\}`/)
  assert.match(routeSrc, /item_id:\s*String\(targetComId\)/)
  assert.match(routeSrc, /item_id:\s*comIdStr/)
  assert.match(routeSrc, /is_reminder:\s*true/)
  assert.ok(
    routeSrc.includes('/agenda-digital/${encodeURIComponent(rawAluno)}/comunicados?id=${encodeURIComponent(targetComId)}'),
    'Deep-link familiar deve apontar diretamente para /agenda-digital/[alunoId]/comunicados?id=[comunicadoId]'
  )
  assert.ok(
    routeSrc.includes('/agenda-digital/colaborador/comunicados?id=${encodeURIComponent(comIdStr)}'),
    'Deep-link de colaborador deve apontar diretamente para /agenda-digital/colaborador/comunicados?id=[comunicadoId]'
  )
  assert.ok(
    routeSrc.includes('resolveStuMapForConsolidatedReport'),
    'Relatórios consolidados devem resolver o ID individual AD-COM-REL-STU de cada aluno para famílias'
  )
})

test('Lembrete de Comunicado - UI apenas para Staff/Admin e nunca para Famílias/Alunos', () => {
  const modalSrc = readRepoFile('components/agenda/ComunicadoViewModal.tsx')
  assert.ok(modalSrc.includes('Enviar lembrete'), 'ComunicadoViewModal deve renderizar botão Enviar lembrete')
  assert.ok(
    modalSrc.includes("onSendReminder &&\n    comunicado?.id &&\n    comunicado?.status !== 'rascunho' &&\n    comunicado?.status !== 'agendado'"),
    'Botão Enviar lembrete só deve aparecer quando onSendReminder for passado e comunicado já tiver sido enviado'
  )

  const colabPageSrc = readRepoFile('app/agenda-digital/colaborador/comunicados/page.tsx')
  assert.ok(colabPageSrc.includes('/api/comunicados/lembrete'), 'Página do colaborador deve integrar /api/comunicados/lembrete')
  assert.ok(colabPageSrc.includes('lastAutoOpenedQueryIdRef'), 'Página do colaborador deve suportar abertura direta repetida via query ?id=')

  const adminPageSrc = readRepoFile('app/agenda-digital/admin/comunicados/page.tsx')
  assert.ok(adminPageSrc.includes('/api/comunicados/lembrete'), 'Página do admin deve integrar /api/comunicados/lembrete')

  const familyPageSrc = readRepoFile('app/agenda-digital/[slug]/comunicados/page.tsx')
  assert.ok(!familyPageSrc.includes('onSendReminder'), 'Página da família/aluno NUNCA deve passar onSendReminder')
  assert.ok(familyPageSrc.includes('lastAutoOpenedQueryIdRef'), 'Página da família/aluno deve suportar abertura direta repetida via query ?id=')
})
