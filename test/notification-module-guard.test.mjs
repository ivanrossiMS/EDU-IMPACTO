import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Função pura que replica a regra de negócio aplicada em NotificationPermissionModal:
 * O modal de permissão só deve aparecer se o status for denied, não estiver carregando,
 * não tiver sido dispensado e o usuário estiver DENTRO do módulo Agenda Digital.
 */
function shouldShowNotificationPermissionModal({
  pathname,
  isDenied,
  isLoading,
  dismissed,
  isLoggingOut = false,
  loadingPath = null,
  currentUser = { id: 'user-123' },
}) {
  const isAgendaDigitalModule = Boolean(
    pathname && (pathname === '/agenda-digital' || pathname.startsWith('/agenda-digital/'))
  )
  const isLoggingOutActive = isLoggingOut || loadingPath === 'logout'
  const isUserAuthenticated = Boolean(currentUser?.id)

  return Boolean(
    !isLoggingOutActive &&
    isUserAuthenticated &&
    isDenied &&
    !isLoading &&
    !dismissed &&
    isAgendaDigitalModule
  )
}

test('NotificationPermissionModal - Módulo Gestão Escolar (NUNCA deve aparecer)', () => {
  const gestaoEscolarRoutes = [
    '/dashboard',
    '/dashboard/metricas',
    '/alunos',
    '/alunos/123',
    '/turmas',
    '/professores',
    '/disciplinas',
    '/financeiro',
    '/matriculas',
    '/secretaria',
    '/documentos-digitais',
    '/relatorios',
    '/portaria',
    '/configuracoes',
  ]

  for (const route of gestaoEscolarRoutes) {
    const shouldShow = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
    })
    assert.equal(
      shouldShow,
      false,
      `Aviso de notificação NÃO deve aparecer na rota de Gestão Escolar: ${route}`
    )
  }
})

test('NotificationPermissionModal - Módulo Gestão de Pessoas (NUNCA deve aparecer)', () => {
  const gestaoPessoasRoutes = [
    '/gestao-pessoas',
    '/gestao-pessoas/colaboradores',
    '/gestao-pessoas/atendimentos',
    '/gestao-pessoas/sst',
    '/gestao-pessoas/shai',
    '/gestao-pessoas/treinamentos',
  ]

  for (const route of gestaoPessoasRoutes) {
    const shouldShow = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
    })
    assert.equal(
      shouldShow,
      false,
      `Aviso de notificação NÃO deve aparecer na rota de Gestão de Pessoas: ${route}`
    )
  }
})

test('NotificationPermissionModal - Módulo Provas/Simulados (NUNCA deve aparecer)', () => {
  const simuladosRoutes = [
    '/simulados',
    '/simulados/novo',
    '/provas',
    '/provas/123',
    '/redacao-enem',
  ]

  for (const route of simuladosRoutes) {
    const shouldShow = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
    })
    assert.equal(
      shouldShow,
      false,
      `Aviso de notificação NÃO deve aparecer na rota de Provas/Simulados: ${route}`
    )
  }
})

test('NotificationPermissionModal - Rotas Públicas e de Login (NUNCA deve aparecer)', () => {
  const publicRoutes = [
    '/login',
    '/login?step=choose_system',
    '/esqueci-senha',
    '/atualizar-senha',
    '/assinar/token-123',
    '/validar-assinatura',
    '/politica-de-privacidade',
  ]

  for (const route of publicRoutes) {
    const shouldShow = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
    })
    assert.equal(
      shouldShow,
      false,
      `Aviso de notificação NÃO deve aparecer na rota pública: ${route}`
    )
  }
})

test('NotificationPermissionModal - Módulo Agenda Digital (DEVE aparecer quando negado e não dispensado)', () => {
  const agendaDigitalRoutes = [
    '/agenda-digital',
    '/agenda-digital/selecionar-aluno',
    '/agenda-digital/selecionar-perfil-admin',
    '/agenda-digital/admin',
    '/agenda-digital/admin/comunicados',
    '/agenda-digital/colaborador/comunicados',
    '/agenda-digital/colaborador/momentos',
    '/agenda-digital/aluno-123/comunicados',
    '/agenda-digital/aluno-123/notas',
  ]

  for (const route of agendaDigitalRoutes) {
    // Caso 1: Negado, não carregando, não dispensado -> DEVE APARECER
    const shouldShow = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
    })
    assert.equal(
      shouldShow,
      true,
      `Aviso de notificação DEVE aparecer na Agenda Digital quando negado: ${route}`
    )

    // Caso 2: Dispensado na sessão -> NÃO DEVE APARECER
    const shouldShowDismissed = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: true,
    })
    assert.equal(
      shouldShowDismissed,
      false,
      `Aviso dispensado NÃO deve aparecer na Agenda Digital: ${route}`
    )

    // Caso 3: Autorizado (isDenied === false) -> NÃO DEVE APARECER
    const shouldShowAuthorized = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: false,
      isLoading: false,
      dismissed: false,
    })
    assert.equal(
      shouldShowAuthorized,
      false,
      `Aviso autorizado NÃO deve aparecer na Agenda Digital: ${route}`
    )
  }
})

test('NotificationPermissionModal - Durante Logout e Sem Usuário Autenticado (NUNCA deve aparecer)', () => {
  const agendaDigitalRoutes = [
    '/agenda-digital',
    '/agenda-digital/selecionar-aluno',
    '/agenda-digital/aluno-123/notas',
    '/agenda-digital/aluno-123/comunicados',
  ]

  for (const route of agendaDigitalRoutes) {
    // Cenário 1: Durante logout com isLoggingOut = true -> NUNCA APARECE
    const showLoggingOut = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
      isLoggingOut: true,
    })
    assert.equal(
      showLoggingOut,
      false,
      `Aviso de notificação NÃO deve aparecer durante logout (isLoggingOut): ${route}`
    )

    // Cenário 2: Durante logout com loadingPath = 'logout' -> NUNCA APARECE
    const showLoadingLogout = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
      loadingPath: 'logout',
    })
    assert.equal(
      showLoadingLogout,
      false,
      `Aviso de notificação NÃO deve aparecer com loadingPath logout: ${route}`
    )

    // Cenário 3: Sem usuário autenticado (currentUser = null) -> NUNCA APARECE
    const showNoUser = shouldShowNotificationPermissionModal({
      pathname: route,
      isDenied: true,
      isLoading: false,
      dismissed: false,
      currentUser: null,
    })
    assert.equal(
      showNoUser,
      false,
      `Aviso de notificação NÃO deve aparecer sem usuário autenticado: ${route}`
    )
  }
})

test('Push Architecture Regression Guards - OneSignal Limits, Deduplication Keys & Deep Links', async () => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const root = process.cwd()

  // 1. pushService.ts: maxChunkSize <= 300 para respeitar o limite de 2.000 aliases em 6 chaves de include_aliases
  const pushServiceCode = await fs.readFile(path.join(root, 'lib/server/pushService.ts'), 'utf8')
  assert.match(pushServiceCode, /const maxChunkSize = 300\b/, 'pushService.ts deve limitar lotes a 300 IDs (<= 1.800 aliases totais)')
  assert.match(pushServiceCode, /id !== 'undefined' && id !== 'null'/, 'pushService.ts deve sanitizar strings vazias/inválidas nos aliases')

  // 2. agendaNotifications.ts: URL de fallback atualizada, cache de ad_config e retentativa em caso de status failed
  const agendaNotifsCode = await fs.readFile(path.join(root, 'lib/server/agendaNotifications.ts'), 'utf8')
  assert.ok(!agendaNotifsCode.includes('resilient-cuchufli-2b4125.netlify.app'), 'agendaNotifications.ts não deve conter URL legada do Netlify')
  assert.match(agendaNotifsCode, /existingLog\?\.status !== 'failed'/, 'agendaNotifications.ts deve permitir reenvio quando o registro anterior falhou')

  // 3. chatPushNotification.ts: Conversas de grupo não devem fixar o aluno_id do 1º aluno para todos os pais
  const chatPushCode = await fs.readFile(path.join(root, 'lib/server/chatPushNotification.ts'), 'utf8')
  assert.match(chatPushCode, /let resolvedFamilyAlunoId = conv\.type === 'group' \? null : conv\.aluno_id/, 'Chat de grupo não deve fixar o aluno_id de uma única criança para toda a turma')

  // 4. ocorrencias/route.ts: Confirmação de ciência deve usar itemId distinto da criação
  const ocorrenciasCode = await fs.readFile(path.join(root, 'app/api/ocorrencias/route.ts'), 'utf8')
  assert.match(ocorrenciasCode, /itemId:\s*`ciencia_\$\{data\.id\}`/, 'Confirmação de ciência deve usar chave ciencia_${data.id}')

  // 5. boletins/route.ts: Atualizações de notas no mesmo bimestre devem incluir janela de tempo no itemId
  const boletinsCode = await fs.readFile(path.join(root, 'app/api/boletins/route.ts'), 'utf8')
  assert.match(boletinsCode, /itemId:\s*`\$\{data\[0\]\.id\}_\$\{updateBucket\}`/, 'Boletins devem incluir bucket de atualização no itemId')

  // 6. frequencias/route.ts: Chave determinística por status do dia para não reenviar push inalterado
  const frequenciasCode = await fs.readFile(path.join(root, 'app/api/academico/frequencias/route.ts'), 'utf8')
  assert.match(frequenciasCode, /const pushItemId = `\$\{row\.id\}_\$\{statusKey\}`/, 'Frequência em lote deve usar chave determinística por status')

  // 7. eventos/route.ts: Agendamento send_after na criação limitado a 24h (demais via Cron Diário) + 1 push por aluno por dia
  const eventosCode = await fs.readFile(path.join(root, 'app/api/agenda/eventos/route.ts'), 'utf8')
  assert.match(eventosCode, /shouldSendReminder = diffHours > 0 && diffHours <= 24/, 'Agendamento imediato send_after de eventos deve ocorrer apenas dentro da janela de 24h')
  assert.match(eventosCode, /const dailyStudentItemId = `cal_dia_\$\{todayStr\}-\$\{student\.aluno_id\}`/, 'Eventos adicionados no mesmo dia devem enviar no máximo 1 push por aluno no dia')

  // 8. calendarReminders.ts: Lembretes de eventos consolidados por aluno e por data do evento
  const remindersCode = await fs.readFile(path.join(root, 'lib/server/calendarReminders.ts'), 'utf8')
  assert.match(remindersCode, /const reminderItemId = `cal_lembrete_\$\{targetDate\}-\$\{student\.aluno_id\}-reminder`/, 'Lembretes de calendário devem ser consolidados por data e por aluno')
})

