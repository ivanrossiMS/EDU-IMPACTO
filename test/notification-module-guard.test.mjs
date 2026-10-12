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
