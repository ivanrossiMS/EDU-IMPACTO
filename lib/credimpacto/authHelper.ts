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
  telefone?: string
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
    const dbUserColabId = dbUser?.colaborador_id || dbUser?.dados?.colaborador_id
    if (!dbFunc && dbUserColabId) {
      const { data: func2 } = await sb
        .from('funcionarios')
        .select('*')
        .eq('id', dbUserColabId)
        .maybeSingle()
      if (func2) dbFunc = func2
    }

    // Se ainda não achou e temos nome confiável vindo do registro em system_users (não de user_metadata editável)
    if (!dbFunc && dbUser?.nome) {
      const targetName = String(dbUser.nome || '').trim()
      if (targetName) {
        const { data: func3 } = await sb
          .from('funcionarios')
          .select('*')
          .ilike('nome', targetName)
          .limit(2)
        // Somente vincula por nome quando houver exatamente 1 homônimo
        if (Array.isArray(func3) && func3.length === 1) dbFunc = func3[0]
      }
    }
  } catch (e) {}

  const perfil = dbUser?.perfil || 'Colaborador'
  const cargo = dbFunc?.cargo || dbUser?.cargo || 'Colaborador'
  const nome = dbFunc?.nome || dbUser?.nome || authUser.user_metadata?.nome || email.split('@')[0]
  const cpf = dbFunc?.cpf || dbUser?.cpf || authUser.user_metadata?.cpf || ''
  const matricula = dbFunc?.codigo || authUser.user_metadata?.matricula || ''
  const unidade = dbFunc?.unidade || ''
  const telefone =
    dbFunc?.celular ||
    dbFunc?.telefone ||
    dbFunc?.dados?.celular ||
    dbFunc?.dados?.telefone ||
    dbUser?.celular ||
    dbUser?.telefone ||
    dbUser?.dados?.celular ||
    dbUser?.dados?.telefone ||
    authUser.user_metadata?.telefone ||
    ''
  const salarioBase = dbFunc?.salario ? Number(dbFunc.salario) : (dbFunc?.dados?.salario ? Number(dbFunc.dados.salario) : undefined)

  // Privilégio de gestão deve vir exclusivamente do banco (system_users / funcionarios), nunca de user_metadata
  const isAdminOrFinance = isCredImpactoAdmin(dbUser?.perfil, dbFunc?.cargo || dbUser?.cargo)

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
    telefone,
    isAdminOrFinance
  }
}

/**
 * Verifica de forma resiliente se um empréstimo (ou payload de evento Realtime)
 * pertence ao usuário autenticado (por Auth ID, Funcionario ID, SystemUser ID, Email ou CPF).
 */
export function isLoanOwnedByUser(
  loan: {
    colaboradorId?: string
    colaboradorEmail?: string
    colaboradorCpf?: string
    colaboradorNome?: string
  } | null | undefined,
  user: {
    id?: string
    systemUserId?: string
    funcionarioId?: string
    email?: string
    cpf?: string
    nome?: string
  } | null | undefined
): boolean {
  if (!loan || !user) return false

  const cleanStr = (s?: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  const cleanDoc = (s?: string) => (s || '').replace(/\D/g, '')

  if (
    loan.colaboradorId &&
    (loan.colaboradorId === user.id ||
      (user.funcionarioId && loan.colaboradorId === user.funcionarioId) ||
      (user.systemUserId && loan.colaboradorId === user.systemUserId))
  ) {
    return true
  }

  if (
    loan.colaboradorEmail &&
    user.email &&
    cleanStr(loan.colaboradorEmail) === cleanStr(user.email)
  ) {
    return true
  }

  const loanCpf = cleanDoc(loan.colaboradorCpf)
  const userCpf = cleanDoc(user.cpf)
  if (loanCpf.length === 11 && loanCpf !== '00000000000' && loanCpf === userCpf) {
    return true
  }

  // Fallback por nome apenas para registros legados que não possuem ID, e-mail nem CPF
  const hasStrongIdentifier = Boolean(
    loan.colaboradorId ||
    loan.colaboradorEmail ||
    (loanCpf && loanCpf.length === 11 && loanCpf !== '00000000000')
  )
  if (
    !hasStrongIdentifier &&
    loan.colaboradorNome &&
    user.nome &&
    cleanStr(loan.colaboradorNome) === cleanStr(user.nome)
  ) {
    return true
  }

  return false
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
