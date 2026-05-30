import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

/**
 * Retorna a data de início de acesso do usuário logado baseado em seu perfil:
 * - Admin Master: null (sem restrição)
 * - Aluno: data de matrícula/cadastro do aluno
 * - Família: data do vínculo familiar (relação aluno_responsavel)
 * - Colaborador: data de contratação/admissão
 */
export async function getLoggedUserAccessStartDate(): Promise<Date | null> {
  try {
    const authClient = await createProtectedClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return null

    const email = user.email || ''
    const userId = user.id

    const adminClient = getAdminClient()
    const { data: dbUser } = await adminClient
      .from('system_users')
      .select('perfil, cargo, created_at, dados')
      .eq('id', userId)
      .maybeSingle()

    const perfil = dbUser?.perfil || user.user_metadata?.perfil || ''
    const cargo = dbUser?.cargo || user.user_metadata?.cargo || ''

    // 1. ADMIN MASTER: Visualização total, sem restrições
    if (
      perfil === 'Diretor Geral' ||
      perfil === 'Administrador' ||
      cargo === 'Administrador Master' ||
      cargo === 'Diretor Geral'
    ) {
      return null
    }

    // 2. ALUNO: Respeitar data da matrícula
    if (cargo === 'Aluno' || perfil === 'Aluno') {
      const alunoId = user.user_metadata?.aluno_id || dbUser?.dados?.aluno_id
      if (alunoId) {
        const { data: student } = await adminClient
          .from('alunos')
          .select('created_at, dados')
          .eq('id', alunoId)
          .maybeSingle()
        if (student) {
          const dateStr = student.dados?.data_matricula || student.dados?.data_inicio || student.dados?.data_ingresso || student.created_at
          return new Date(dateStr)
        }
      }
      return new Date(dbUser?.created_at || user.created_at)
    }

    // 3. FAMÍLIA: Respeitar data do vínculo familiar
    if (perfil === 'Família' || cargo === 'Responsável' || perfil === 'Responsável') {
      const responsavelId = user.user_metadata?.responsavel_id || dbUser?.dados?.responsavel_id
      if (responsavelId) {
        const { data: links } = await adminClient
          .from('aluno_responsavel')
          .select('created_at')
          .eq('responsavel_id', responsavelId)
        
        if (links && links.length > 0) {
          let minDate = new Date()
          let foundDate = false
          for (const l of links) {
            if (l.created_at) {
              const d = new Date(l.created_at)
              if (d < minDate) {
                minDate = d
                foundDate = true
              }
            }
          }
          if (foundDate) return minDate
        }

        const { data: resp } = await adminClient
          .from('responsaveis')
          .select('created_at')
          .eq('id', responsavelId)
          .maybeSingle()
        if (resp?.created_at) {
          return new Date(resp.created_at)
        }
      }
      return new Date(dbUser?.created_at || user.created_at)
    }

    // 4. COLABORADOR: Respeitar data de contratação/cadastro
    if (email) {
      const { data: func } = await adminClient
        .from('funcionarios')
        .select('admissao, created_at')
        .eq('email', email)
        .maybeSingle()
      if (func) {
        const dateStr = func.admissao || func.created_at
        return new Date(dateStr)
      }
    }

    // 5. Default Fallback: Data de criação do usuário no sistema
    const dateStr = dbUser?.created_at || user.created_at
    return new Date(dateStr)
  } catch (err) {
    console.error("Error in getLoggedUserAccessStartDate:", err)
    return null
  }
}
