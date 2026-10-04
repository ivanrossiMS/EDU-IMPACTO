'use client'

/**
 * auditClient.ts
 *
 * Helper leve e não bloqueante para envio de logs de auditoria do lado do cliente.
 * - Valida se o usuário logado é Administrador, Professor ou Colaborador.
 * - Alunos e Famílias são ignorados automaticamente para não sobrecarregar o sistema.
 * - Envia requisições via fire-and-forget de forma assíncrona.
 */

export interface ClientAuditLogParams {
  modulo:
    | 'Acadêmico'
    | 'Financeiro'
    | 'RH'
    | 'Gestão de Pessoas'
    | 'Secretaria'
    | 'Matrículas'
    | 'Portaria'
    | 'Comunicação'
    | 'Agenda Digital'
    | 'Configurações'
    | 'Segurança'
    | string
  acao:
    | 'Criação'
    | 'Edição'
    | 'Exclusão'
    | 'Envio'
    | 'Baixa'
    | 'Estorno'
    | 'Login'
    | 'Logout'
    | 'Importação'
    | 'Exportação'
    | string
  descricao: string
  registroId?: string | number | null
  nomeRelacionado?: string | null
  detalhesAntes?: any
  detalhesDepois?: any
  status?: 'sucesso' | 'erro' | 'aviso'
}

const EXCLUDED_PROFILES = [
  'aluno',
  'alunos',
  'estudante',
  'responsavel',
  'responsável',
  'responsaveis',
  'responsáveis',
  'familia',
  'família',
  'pais',
]

export function isClientUserEligibleForAudit(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem('edu-current-user')
    if (!raw) return true
    const user = JSON.parse(raw)
    const perfil = (user?.perfil || user?.role || '').toLowerCase().trim()
    if (!perfil) return true
    return !EXCLUDED_PROFILES.some(ex => perfil.includes(ex))
  } catch {
    return true
  }
}

export function getClientUserInfo(): { nome: string; perfil: string } {
  if (typeof window === 'undefined') return { nome: 'Usuário', perfil: 'Colaborador' }
  try {
    const raw = window.localStorage.getItem('edu-current-user')
    if (raw) {
      const u = JSON.parse(raw)
      return {
        nome: u.nome || u.name || 'Usuário',
        perfil: u.perfil || u.role || 'Colaborador',
      }
    }
  } catch {}
  return { nome: 'Usuário', perfil: 'Colaborador' }
}

/**
 * Envia um registro de auditoria para o backend.
 * Chamada não-bloqueante (fire-and-forget).
 */
export function sendAuditLog(params: ClientAuditLogParams): void {
  if (!isClientUserEligibleForAudit()) {
    // Alunos e Famílias são expressamente ignorados
    return
  }

  const user = getClientUserInfo()

  const payload = {
    usuarioNome: user.nome,
    perfil: user.perfil,
    modulo: params.modulo,
    acao: params.acao,
    descricao: params.descricao,
    registroId: params.registroId ? String(params.registroId) : null,
    nomeRelacionado: params.nomeRelacionado || null,
    detalhesAntes: params.detalhesAntes || null,
    detalhesDepois: params.detalhesDepois || null,
    status: params.status || 'sucesso',
    origem: 'web',
  }

  // Envio não bloqueante via fetch
  if (typeof fetch !== 'undefined') {
    fetch('/api/system-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(err => {
      // Falha silenciosa para não quebrar a UX do usuário
      console.warn('[AuditClient] Falha assíncrona ao registrar log:', err)
    })
  }
}
