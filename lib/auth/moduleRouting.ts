import { DEFAULT_PERFIS, Perfil } from '../dataContext'

export interface UserModuleAccess {
  hasGestaoEscolar: boolean
  hasAgendaDigital: boolean
  hasGestaoPessoas: boolean
  hasSimulados: boolean
  totalModules: number
  onlyAgendaDigital: boolean
  availableModules: ('gestao-escolar' | 'agenda-digital' | 'gestao-pessoas' | 'simulados')[]
}

const NORMALIZE = (s?: string) =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Verifica se o usuário pertence ao perfil de Família, Responsável ou Aluno.
 * Esses usuários têm acesso exclusivamente à Agenda Digital por design do sistema.
 */
export function isFamilyOrStudent(user?: { perfil?: string; cargo?: string } | null): boolean {
  if (!user) return false
  const p = NORMALIZE(user.perfil)
  const c = NORMALIZE(user.cargo)

  return (
    p === 'familia' ||
    p === 'responsavel' ||
    p === 'aluno' ||
    c === 'responsavel' ||
    c === 'aluno'
  )
}

/**
 * Retorna o destino exato dentro da Agenda Digital de acordo com o papel do usuário.
 */
export function getAgendaDigitalDestination(user: any): string {
  if (!user) return '/agenda-digital'

  const perfil = user.perfil || ''
  const cargo = user.cargo || ''

  if (cargo === 'Aluno' && user.aluno_id) {
    return `/agenda-digital/${user.aluno_id}/comunicados`
  }

  if (perfil === 'Família' || perfil === 'Responsável' || cargo === 'Responsável') {
    return '/agenda-digital/selecionar-aluno'
  }

  const isAdmin = [
    'Direção',
    'Administrador',
    'Diretor Geral',
    'Administrador Master'
  ].includes(perfil) || [
    'Direção',
    'Administrador',
    'Diretor Geral',
    'Administrador Master'
  ].includes(cargo)

  if (isAdmin) {
    if (perfil === 'Diretor Geral' || cargo === 'Administrador Master' || perfil === 'Administrador') {
      return '/agenda-digital/selecionar-perfil-admin'
    }
    return '/agenda-digital/admin'
  }

  // Colaboradores com papel duplo (filhos vinculados):
  if (user.hasDualRole || user.responsavel_id) {
    return '/agenda-digital/selecionar-aluno'
  }

  // Colaborador regular (Professor, Secretária, etc.):
  return '/agenda-digital/colaborador/comunicados'
}

/**
 * Calcula os módulos aos quais o usuário tem acesso a partir do seu perfil.
 */
export function getUserModuleAccess(user: any, perfilObj?: any): UserModuleAccess {
  if (!user) {
    return {
      hasGestaoEscolar: false,
      hasAgendaDigital: false,
      hasGestaoPessoas: false,
      hasSimulados: false,
      totalModules: 0,
      onlyAgendaDigital: false,
      availableModules: []
    }
  }

  // Família / Aluno / Responsável têm apenas a Agenda Digital
  if (isFamilyOrStudent(user)) {
    return {
      hasGestaoEscolar: false,
      hasAgendaDigital: true,
      hasGestaoPessoas: false,
      hasSimulados: false,
      totalModules: 1,
      onlyAgendaDigital: true,
      availableModules: ['agenda-digital']
    }
  }

  // Para colaboradores / administradores:
  // Se tivermos perfilObj (configuração salva no Supabase):
  if (perfilObj) {
    const hasGestaoEscolar = !perfilObj.bloqueadoGestaoEscolar
    const hasAgendaDigital = !perfilObj.bloqueadoAgendaDigital
    const hasGestaoPessoas = !perfilObj.bloqueadoGestaoPessoas
    const hasSimulados = !perfilObj.bloqueadoSimulados

    const availableModules: ('gestao-escolar' | 'agenda-digital' | 'gestao-pessoas' | 'simulados')[] = []
    if (hasGestaoEscolar) availableModules.push('gestao-escolar')
    if (hasAgendaDigital) availableModules.push('agenda-digital')
    if (hasGestaoPessoas) availableModules.push('gestao-pessoas')
    if (hasSimulados) availableModules.push('simulados')

    const totalModules = availableModules.length
    const onlyAgendaDigital = hasAgendaDigital && totalModules === 1

    return {
      hasGestaoEscolar,
      hasAgendaDigital,
      hasGestaoPessoas,
      hasSimulados,
      totalModules,
      onlyAgendaDigital,
      availableModules
    }
  }

  // Fallback seguro usando perfis padrão conhecidos
  const userPerfilName = user.perfil || user.cargo || ''
  const defaultFound = DEFAULT_PERFIS.find(p => p.nome === userPerfilName)

  const hasGestaoEscolar = defaultFound ? !defaultFound.bloqueadoGestaoEscolar : true
  const hasAgendaDigital = defaultFound ? !defaultFound.bloqueadoAgendaDigital : true
  const hasGestaoPessoas = defaultFound ? !defaultFound.bloqueadoGestaoPessoas : true
  const hasSimulados = defaultFound ? !defaultFound.bloqueadoSimulados : true

  const availableModules: ('gestao-escolar' | 'agenda-digital' | 'gestao-pessoas' | 'simulados')[] = []
  if (hasGestaoEscolar) availableModules.push('gestao-escolar')
  if (hasAgendaDigital) availableModules.push('agenda-digital')
  if (hasGestaoPessoas) availableModules.push('gestao-pessoas')
  if (hasSimulados) availableModules.push('simulados')

  const totalModules = availableModules.length
  const onlyAgendaDigital = hasAgendaDigital && totalModules === 1

  return {
    hasGestaoEscolar,
    hasAgendaDigital,
    hasGestaoPessoas,
    hasSimulados,
    totalModules,
    onlyAgendaDigital,
    availableModules
  }
}

/**
 * Determina a rota inicial apropriada para um usuário autenticado.
 * - Se tiver APENAS a Agenda Digital: vai direto para a Agenda Digital.
 * - Se tiver APENAS 1 módulo diferente: vai direto para esse módulo.
 * - Se tiver múltiplos módulos: vai para a tela de escolha (/login?step=choose_system).
 */
export function getInitialRouteForUser(user: any, perfilObj?: any): string {
  const access = getUserModuleAccess(user, perfilObj)

  // 1. Só tem Agenda Digital liberada
  if (access.onlyAgendaDigital) {
    return getAgendaDigitalDestination(user)
  }

  // 2. Só tem 1 módulo liberado (e não é a Agenda Digital)
  if (access.totalModules === 1) {
    if (access.hasGestaoEscolar) return '/dashboard'
    if (access.hasGestaoPessoas) return '/gestao-pessoas'
    if (access.hasSimulados) return '/simulados'
  }

  // 3. Tem múltiplos módulos (ex.: Gestão Escolar + Agenda Digital)
  // Direciona para a tela de seleção de módulos
  return '/login?step=choose_system'
}

/**
 * Cache local ultrarrápido de perfis para eliminar qualquer latência de rede na abertura
 */
const CACHE_KEY = 'edu-perfis-cache'

export function getCachedPerfis(): Perfil[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export function setCachedPerfis(perfis: Perfil[]): void {
  if (typeof window === 'undefined') return
  try {
    if (Array.isArray(perfis) && perfis.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(perfis))
    }
  } catch {}
}

/**
 * Busca a lista de perfis aproveitando cache local com timeout de segurança.
 */
export async function fetchPerfisWithCache(timeoutMs = 1500): Promise<Perfil[]> {
  const cached = getCachedPerfis()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch('/api/configuracoes/perfis', { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setCachedPerfis(data)
        return data
      }
    }
  } catch (e) {
    clearTimeout(timer)
  }

  return cached || DEFAULT_PERFIS
}
