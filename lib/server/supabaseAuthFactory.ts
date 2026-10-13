/**
 * Redireciona para a factory unificada em supabaseServerFactory.ts,
 * garantindo suporte a Bearer Token (mobile) + Cookies (web) com maxAge seguro (365 dias).
 */
export { createProtectedClient, createAdminClient, getAuthenticatedUser } from './supabaseServerFactory'
