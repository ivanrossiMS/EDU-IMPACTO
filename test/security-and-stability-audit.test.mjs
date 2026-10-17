import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

test('AuthGuard - nunca confia em user_metadata para perfis administrativos (anti-escalação de privilégio)', () => {
  const src = readRepoFile('lib/server/authGuard.ts')
  assert.ok(src.includes('export async function resolveUserRole'), 'resolveUserRole deve existir em authGuard.ts')
  assert.ok(src.includes('export async function requireStaff'), 'requireStaff deve existir em authGuard.ts')
  assert.ok(
    !src.includes("const userPerfil = dbUser?.perfil || user.user_metadata?.perfil"),
    'requireProfile NÃO deve fazer fallback para user.user_metadata.perfil'
  )
  assert.ok(
    src.includes("dbUser.status.toLowerCase() === 'inativo'"),
    'resolveUserRole/requireProfile deve rejeitar colaboradores com status inativo'
  )
})

test('Middleware - remove endpoints de debug/reset de PUBLIC_PATHS e bloqueia mutações com ?checkMaster=true', () => {
  const src = readRepoFile('middleware.ts')
  const publicPathsBlock = src.slice(src.indexOf('const PUBLIC_PATHS = ['), src.indexOf('function isPublicPath'))

  assert.ok(!publicPathsBlock.includes("'/api/auth/reset-access'"), '/api/auth/reset-access não pode ser público')
  assert.ok(!publicPathsBlock.includes("'/api/auth/debug-db'"), '/api/auth/debug-db não pode ser público')
  assert.ok(!publicPathsBlock.includes("'/api/test'"), '/api/test não pode ser público')
  assert.ok(publicPathsBlock.includes("'/api/matriculas/zapsign/webhook'"), 'Webhook do ZapSign deve estar em PUBLIC_PATHS')

  assert.ok(
    src.includes("request.method === 'GET' && pathname === '/api/configuracoes/usuarios' && request.nextUrl.searchParams.get('checkMaster') === 'true'"),
    'Bypass checkMaster=true em /api/configuracoes/usuarios deve ser restrito ao método GET'
  )

  const allowedForFamilyBlock = src.slice(src.indexOf('const allowedForFamily = ['), src.indexOf('const blockedForFamily = ['))
  assert.ok(
    !allowedForFamilyBlock.includes("'/api/financeiro/baixar-por-responsavel'"),
    '/api/financeiro/baixar-por-responsavel não pode estar liberado para Família/Aluno'
  )
})

test('Account Hijacking Fix - /api/auth/update-password bloqueia troca não autenticada de e-mail em conta já configurada', () => {
  const src = readRepoFile('app/api/auth/update-password/route.ts')
  assert.ok(
    src.includes('const existingByStored = storedRespEmail ? await findAuthUserByEmail(storedRespEmail) : null'),
    'Deve consultar o usuário Auth pelo e-mail já armazenado em responsaveis antes de criar/alterar'
  )
  assert.ok(
    src.includes('existing.last_sign_in_at || (existingByStored && registeredEmail && registeredEmail.trim().toLowerCase() !== storedRespEmail)'),
    'Deve bloquear tentativa de sobrescrever e-mail de conta já ativa sem sessão'
  )
  assert.ok(
    src.includes('if (!storedRespEmail && targetEmail)'),
    'Só deve gravar novo e-mail em responsaveis se o campo estava vazio anteriormente'
  )
})

test('SSRF & XSS Hardening - Google Drive proxy e Chat Media Preview validam domínios e cabeçalhos', () => {
  const gdriveSrc = readRepoFile('app/api/configuracoes/google-drive/route.ts')
  assert.ok(gdriveSrc.includes('requireStaff'), 'Google Drive route deve exigir requireStaff')
  assert.ok(gdriveSrc.includes('isAllowedGoogleWebhookUrl'), 'Google Drive route deve validar domínio HTTPS contra SSRF')
  assert.ok(gdriveSrc.includes("parsed.protocol !== 'https:'"), 'Apenas HTTPS deve ser aceito no webhook do Google Drive')

  const previewSrc = readRepoFile('app/api/chat/media/preview/route.ts')
  assert.ok(previewSrc.includes('isAllowedMediaPreviewUrl'), 'Chat media preview deve validar o domínio da URL')
  assert.ok(previewSrc.includes("'X-Content-Type-Options': 'nosniff'"), 'Deve incluir X-Content-Type-Options: nosniff')
  assert.ok(previewSrc.includes("Content-Security-Policy"), 'Deve incluir Content-Security-Policy restritiva')
})

test('RBAC & IDOR - Rotas administrativas e dados sensíveis exigem requireStaff ou checkResponsavelRelationship', () => {
  const protectedStaffRoutes = [
    'app/api/auth/reset-access/route.ts',
    'app/api/debug/cobrancas/route.ts',
    'app/api/financeiro/dre/historico/route.ts',
    'app/api/financeiro/dre/upload/route.ts',
    'app/api/importacao/alunos/route.ts',
    'app/api/configuracoes/logs/route.ts',
    'app/api/configuracoes/perfis/route.ts',
    'app/api/configuracoes/mantenedores/route.ts',
    'app/api/saida/config/route.ts',
    'app/api/saida/calls/route.ts',
    'app/api/financeiro/baixar-por-responsavel/route.ts',
    'app/api/boletins/route.ts',
    'app/api/academico/frequencias/route.ts',
    'app/api/turmas/route.ts',
    'app/api/provas-online/[id]/route.ts',
    'app/api/provas-online/[id]/corrigir/route.ts',
    'app/api/provas-online/[id]/integrar-notas/route.ts',
    'app/api/provas-online/[id]/monitoramento/route.ts',
  ]

  for (const routePath of protectedStaffRoutes) {
    const src = readRepoFile(routePath)
    assert.ok(
      src.includes('requireStaff'),
      `A rota ${routePath} deve utilizar requireStaff para bloquear mutações/leituras não autorizadas`
    )
  }

  const ocorrenciasSrc = readRepoFile('app/api/ocorrencias/route.ts')
  assert.ok(
    ocorrenciasSrc.includes('!isStaff'),
    'POST /api/ocorrencias deve diferenciar staff de família/aluno'
  )
  assert.ok(
    ocorrenciasSrc.includes('Acesso negado. Apenas colaboradores podem criar ou editar ocorrências.'),
    'Família/aluno só pode registrar ciência em ocorrência existente, sem alterar conteúdo/tipo'
  )

  const configSrc = readRepoFile('app/api/configuracoes/route.ts')
  assert.ok(
    configSrc.includes('SENSITIVE_STAFF_ONLY_CONFIG_KEYS'),
    'GET /api/configuracoes deve filtrar chaves sensíveis para usuários não-staff'
  )
})

test('Webhooks Isaac e Mercado Pago - proteção contra invalidação não verificada e downgrade de cobrança paga', () => {
  const isaacWebhookSrc = readRepoFile('app/api/webhooks/isaac/route.ts')
  assert.ok(
    !isaacWebhookSrc.includes('invalidateIsaacYearCache()'),
    'Webhook do Isaac não deve invalidar todo o cache anual quando a parcela não pôde ser verificada na API'
  )
  assert.ok(
    isaacWebhookSrc.includes('detalhes_depois'),
    'Webhook do Isaac deve gravar log usando a coluna válida detalhes_depois de system_logs'
  )

  const mpWebhookSrc = readRepoFile('app/api/webhooks/mercadopago/route.ts')
  assert.ok(
    mpWebhookSrc.includes("/^[0-9a-zA-Z_-]+$/.test(String(paymentId))"),
    'Webhook do Mercado Pago deve validar formato de paymentId'
  )
  assert.ok(
    mpWebhookSrc.includes(".neq('status', 'RECEIVED')"),
    'Webhook do Mercado Pago não deve rebaixar cobrança já quitada (RECEIVED)'
  )
})

test('OneSignal NotificationService - preserva extraData entre syncs concorrentes e limpa tags dinâmicas no logout', () => {
  const src = readRepoFile('lib/notifications/notificationService.ts')
  assert.ok(
    src.includes('registeredDynamicTags'),
    'NotificationService deve rastrear tags dinâmicas (aluno_*, turma_*) para remoção no clearUser()'
  )
  assert.ok(
    src.includes("const aliasesToRemove = ['responsavel_id', 'aluno_id', 'colaborador_id', 'system_user_id', 'codigo', 'email']"),
    'clearUser() deve remover também o alias email'
  )
  assert.ok(
    src.includes('isFamilyOrStudentRole'),
    'isPureStaff deve verificar perfil/cargo de Família e Aluno para não omitir aluno_id'
  )
})

test('Isolamento de Sessão no Logout e Resiliência de Configuração (useConfigDb / Provas Online DB)', () => {
  const logoutSrc = readRepoFile('lib/auth/logout.ts')
  assert.ok(logoutSrc.includes('clearStudentPhotoCache()'), 'Logout deve limpar cache de fotos de alunos')
  assert.ok(logoutSrc.includes('clearChatMessagesCache()'), 'Logout deve limpar cache de mensagens do chat')
  assert.ok(logoutSrc.includes('clearComunicadosRespostasCache()'), 'Logout deve limpar cache de respostas de comunicados')
  assert.ok(logoutSrc.includes('clearMeusAlunosCache()'), 'Logout deve limpar cache de meus-alunos')

  const configDbSrc = readRepoFile('lib/useConfigDb.ts')
  assert.ok(
    configDbSrc.includes('configCache.resolved && !configCache.hadError'),
    'useConfigDb só deve fazer auto-seed de defaultValue quando a busca inicial teve sucesso sem erro'
  )

  const provasDbSrc = readRepoFile('lib/provas-online/db.ts')
  assert.ok(
    provasDbSrc.includes("sb.from('provas_online_tentativas').delete().eq('prova_id', id)"),
    'dbDeleteProva deve excluir tentativas da tabela correta provas_online_tentativas'
  )
  assert.ok(
    provasDbSrc.includes("sb.from('provas_online_questoes').upsert(rows)"),
    'dbSaveQuestoes deve realizar upsert antes de remover questões obsoletas'
  )

  const sqlMigration = readRepoFile('supabase/migrations/20261013180000_security_rls_and_performance_hardening.sql')
  assert.ok(
    sqlMigration.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_push_logs_item_id_type_unique'),
    'Migration SQL deve criar índice UNIQUE em agenda_push_logs(item_id, type)'
  )
})

test('Auditoria 2026-10-17 - Eliminação de loops listUsers, proteção de escopo familiar e sanitização de Enquetes/Autorizações', () => {
  const adminSingleton = readRepoFile('lib/server/supabaseAdminSingleton.ts')
  assert.ok(adminSingleton.includes('export async function getAllAuthUsersCached'), 'Deve expor getAllAuthUsersCached com cache em memória e deduplicação')
  assert.ok(adminSingleton.includes('export function invalidateAuthUsersCache'), 'Deve expor invalidateAuthUsersCache')

  const authGuard = readRepoFile('lib/server/authGuard.ts')
  assert.ok(authGuard.includes('export async function getAuthorizedAlunoIdsForUser'), 'Deve expor getAuthorizedAlunoIdsForUser')
  assert.ok(authGuard.includes('export async function getAuthorizedResponsavelIdsForUser'), 'Deve expor getAuthorizedResponsavelIdsForUser')
  assert.ok(authGuard.includes('export async function requireAdminOrDirecao'), 'Deve expor requireAdminOrDirecao')
  assert.ok(authGuard.includes('export async function requireHrOrAdmin'), 'Deve expor requireHrOrAdmin')

  const enqueteUtils = readRepoFile('lib/enquetes/enqueteUtils.ts')
  assert.ok(enqueteUtils.includes('export function sanitizeEnqueteForViewer'), 'Deve sanitizar votos de terceiros em enquetes para famílias')

  const autorizacaoUtils = readRepoFile('lib/autorizacoes/autorizacaoUtils.ts')
  assert.ok(autorizacaoUtils.includes('export function sanitizeAutorizacaoForViewer'), 'Deve sanitizar respostas de terceiros em autorizações para famílias')

  const comunicadosRoute = readRepoFile('app/api/comunicados/route.ts')
  assert.ok(comunicadosRoute.includes('sanitizeEnqueteForViewer'), 'GET /api/comunicados deve sanitizar enquetes para famílias')
  assert.ok(comunicadosRoute.includes('sanitizeAutorizacaoForViewer'), 'GET /api/comunicados deve sanitizar autorizações para famílias')
  assert.ok(!comunicadosRoute.includes('|| r.is_admin === true'), 'GET /api/comunicados não deve vazar respostas de admin para outras famílias')
})

test('Auditoria 2026-10-17 - Hardening de Matrículas Digitais (OTP Brute-Force), Financeiro, CNAB 400, CredImpacto e RLS is_staff()', () => {
  const assinarRoute = readRepoFile('app/api/matriculas/digital/assinar/route.ts')
  assert.ok(assinarRoute.includes('(contrato.otp_tentativas || 0) >= 5'), 'Assinatura digital deve limitar tentativas de OTP (proteção brute-force)')
  assert.ok(assinarRoute.includes('status: 429'), 'Excesso de tentativas OTP deve retornar HTTP 429')

  const matriculasConfig = readRepoFile('app/api/matriculas/config/route.ts')
  assert.ok(matriculasConfig.includes('requireStaff'), '/api/matriculas/config deve exigir requireStaff')
  assert.ok(matriculasConfig.includes('maskedToken'), '/api/matriculas/config deve mascarar apiToken do ZapSign no GET')

  const estornarBaixa = readRepoFile('app/api/financeiro/estornar-baixa/route.ts')
  assert.ok(estornarBaixa.includes('requireStaff'), '/api/financeiro/estornar-baixa deve exigir requireStaff')
  assert.ok(estornarBaixa.includes('/^[A-Za-z0-9_-]{2,80}$/'), 'cod_baixa_codes deve validar formato seguro contra PostgREST injection')

  const credAuth = readRepoFile('lib/credimpacto/authHelper.ts')
  assert.ok(
    credAuth.includes('const isAdminOrFinance = isCredImpactoAdmin(dbUser?.perfil, dbFunc?.cargo || dbUser?.cargo)'),
    'CredImpacto deve resolver privilégio de gestão exclusivamente do banco (system_users / funcionarios)'
  )

  const credTemplate = readRepoFile('lib/credimpacto/contractTemplate.ts')
  assert.ok(credTemplate.includes('function escapeHtml'), 'Contrato CredImpacto deve escapar HTML de campos fornecidos pelo usuário')

  const auditMigration = readRepoFile('supabase/migrations/20261017120000_comprehensive_audit_security_and_performance.sql')
  assert.ok(
    auditMigration.includes("'responsavel', 'responsável', 'aluno'"),
    'public.is_staff() na migration deve excluir perfis de Família/Aluno presentes em system_users'
  )
})

