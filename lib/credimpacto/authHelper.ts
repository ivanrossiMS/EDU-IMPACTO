// ==============================================================================
// Helper de Autenticação e Permissões do CredImpacto
// ==============================================================================

import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export interface ResolvedUser {
  id: string              // auth uid
  systemUserId?: string   // dbUser?.id
  funcionarioId?: string  // dbFunc?.id
  email: string
  nome: string
  cpf?: string
  cargo?: string
  perfil?: string
  matricula?: string
  salarioBase?: number
  unidade?: string
  isAdminOrFinance: boolean
}

export async function resolveCredImpactoUser(authUser: any): Promise<ResolvedUser> {
  const sb = getAdminClient()
  const uid = authUser.id
  const email = (authUser.email || '').trim().toLowerCase()

  // 1. Busca dados em system_users
  let dbUser: any = null
  try {
    const { data } = await sb
      .from('system_users')
      .select('*')
      .or(`id.eq.${uid},auth_id.eq.${uid},email.ilike.${email}`)
      .maybeSingle()
    dbUser = data
  } catch (e) {}

  // 2. Busca dados em funcionarios
  let dbFunc: any = null
  try {
    const { data: func1 } = await sb
      .from('funcionarios')
      .select('*')
      .or(`id.eq.${uid},email.ilike.${email}`)
      .maybeSingle()
    dbFunc = func1

    // Se não achou e dbUser tiver colaborador_id
    if (!dbFunc && dbUser?.colaborador_id) {
      const { data: func2 } = await sb
        .from('funcionarios')
        .select('*')
        .eq('id', dbUser.colaborador_id)
        .maybeSingle()
      if (func2) dbFunc = func2
    }

    // Se ainda não achou e temos nome confiável
    if (!dbFunc && dbUser?.nome) {
      const { data: func3 } = await sb
        .from('funcionarios')
        .select('*')
        .ilike('nome', dbUser.nome.trim())
        .maybeSingle()
      if (func3) dbFunc = func3
    }
  } catch (e) {}

  const perfil = dbUser?.perfil || authUser.user_metadata?.perfil || 'Colaborador'
  const cargo = dbFunc?.cargo || dbUser?.cargo || authUser.user_metadata?.cargo || 'Colaborador'
  const nome = dbFunc?.nome || dbUser?.nome || authUser.user_metadata?.nome || email.split('@')[0]
  const cpf = dbFunc?.cpf || dbUser?.cpf || authUser.user_metadata?.cpf || ''
  const matricula = dbFunc?.codigo || authUser.user_metadata?.matricula || ''
  const unidade = dbFunc?.unidade || ''
  const salarioBase = dbFunc?.salario ? Number(dbFunc.salario) : (dbFunc?.dados?.salario ? Number(dbFunc.dados.salario) : undefined)

  const isAdminOrFinance = isCredImpactoAdmin(perfil, cargo)

  return {
    id: uid,
    systemUserId: dbUser?.id,
    funcionarioId: dbFunc?.id,
    email: email || dbUser?.email || dbFunc?.email || '',
    nome,
    cpf,
    cargo,
    perfil,
    matricula,
    salarioBase,
    unidade,
    isAdminOrFinance
  }
}

/**
 * Determina se o usuário tem privilégio estrito de gestão no CredImpacto.
 * Regra: SOMENTE Admin e Diretor Geral têm acesso ao Painel de Gestão.
 * Cargos operacionais e subordinados (Auxiliar, Assistente, etc.) são colaboradores comuns.
 */
export function isCredImpactoAdmin(perfil?: string, cargo?: string): boolean {
  if (!perfil && !cargo) return false

  const clean = (str?: string) =>
    (str || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

  const p = clean(perfil)
  const c = clean(cargo)

  // Desclassificar expressamente qualquer cargo subordinado ou operacional:
  // Ex: "auxiliar administrativo", "assistente administrativo", "estagiario"
  const SUBORDINATE_PREFIXES = ['auxiliar', 'assistente', 'estagi', 'estudante', 'aluno', 'responsavel']
  if (SUBORDINATE_PREFIXES.some((sub) => p.includes(sub) || c.includes(sub))) {
    return false
  }

  // Lista estrita permitida: Admin e Diretor Geral
  const EXACT_ROLES = [
    'diretor geral',
    'diretora geral',
    'administrador master',
    'administrador',
    'admin',
    'master',
    'direcao geral',
    'diretoria geral'
  ]

  const isMatch = (str: string) => {
    if (!str) return false
    if (EXACT_ROLES.includes(str)) return true
    if (str.startsWith('diretor geral') || str.startsWith('diretora geral')) return true
    if (str.startsWith('administrador master') || str.startsWith('administrador')) return true
    if (str === 'diretor' || str === 'diretora' || str === 'direcao' || str === 'diretoria') return true
    return false
  }

  return isMatch(p) || isMatch(c)
}
