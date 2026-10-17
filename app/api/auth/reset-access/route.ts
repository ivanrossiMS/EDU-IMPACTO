import { NextResponse } from 'next/server'
import { getAdminClient, findAuthUserByEmail, getAllAuthUsersCached, invalidateAuthUsersCache } from '@/lib/server/supabaseAdminSingleton'
import { requireStaff, clearAuthGuardCache } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { type, id } = await request.json()

    if (!type || !id) {
      return NextResponse.json({ error: 'Tipo e ID são obrigatórios' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    let targetAuthUserId: string | null = null
    let emailFound: string | null = null

    const findAuthByEmail = async (email: string): Promise<string | null> => {
      const found = await findAuthUserByEmail(email)
      return found?.id || null
    }

    if (type === 'responsavel') {
      // Find the responsible record
      const { data: resp, error: dbErr } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, auth_id')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!resp) {
        return NextResponse.json({ error: 'Responsável não encontrado' }, { status: 404 })
      }

      const idsToDelete: string[] = []
      if (resp.auth_id) {
        idsToDelete.push(String(resp.auth_id))
      }
      if (resp.email) {
        const cleanEmail = resp.email.trim().toLowerCase()
        const byEmailId = await findAuthByEmail(cleanEmail)
        if (byEmailId && !idsToDelete.includes(byEmailId)) {
          idsToDelete.push(byEmailId)
        }
      }

      try {
        const allUsers = await getAllAuthUsersCached()
        const matches = allUsers.filter(
          (u: any) =>
            String(u.user_metadata?.responsavel_id || '') === String(resp.id) ||
            String(u.app_metadata?.responsavel_id || '') === String(resp.id)
        )
        for (const m of matches) {
          if (!idsToDelete.includes(m.id)) idsToDelete.push(m.id)
        }
      } catch (e) {}

      await supabaseAdmin
        .from('responsaveis')
        .update({ auth_id: null })
        .eq('id', id)

      if (idsToDelete.length > 0) {
        for (const authId of idsToDelete) {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(authId).catch(() => ({ data: { user: null } }))
          if (user?.email) emailFound = emailFound ? emailFound + ', ' + user.email : user.email
          await supabaseAdmin.auth.admin.deleteUser(authId).catch(() => {})
        }
        invalidateAuthUsersCache()
        clearAuthGuardCache()
        return NextResponse.json({ ok: true, message: `Acesso reiniciado com sucesso para o e-mail: ${emailFound || resp.email || ''}` })
      }
    } else if (type === 'aluno') {
      // Find the student record
      const { data: aluno, error: dbErr } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!aluno) {
        return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
      }

      const matricula = aluno.matricula || aluno.dados?.codigo || aluno.id
      const virtualEmail = `aluno.${matricula}@impactoedu.local`
      const realEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()

      // Tenta apagar os dois se existirem para garantir reset total
      const idsToDelete: string[] = []
      const virtualAuthId = await findAuthByEmail(virtualEmail)
      if (virtualAuthId) idsToDelete.push(virtualAuthId)
      
      if (realEmail) {
        const realAuthId = await findAuthByEmail(realEmail)
        if (realAuthId && !idsToDelete.includes(realAuthId)) {
          idsToDelete.push(realAuthId)
        }
      }

      // Procura também por metadata aluno_id usando o cache compartilhado
      try {
        const allUsers = await getAllAuthUsersCached()
        const matches = allUsers.filter((u: any) => 
          u.user_metadata?.aluno_id === aluno.id ||
          (matricula && u.user_metadata?.matricula === matricula)
        )
        for (const m of matches) {
          if (!idsToDelete.includes(m.id)) idsToDelete.push(m.id)
        }
      } catch (e) {}
      
      if (idsToDelete.length > 0) {
        for (const authId of idsToDelete) {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(authId).catch(() => ({ data: { user: null } }))
          if (user?.email) emailFound = (emailFound ? emailFound + ', ' + user.email : user.email)
          await supabaseAdmin.auth.admin.deleteUser(authId).catch(() => {})
        }
        invalidateAuthUsersCache()
        clearAuthGuardCache()
        return NextResponse.json({ ok: true, message: `Acesso reiniciado com sucesso para: ${emailFound}` })
      }
    } else if (type === 'system_user') {
      // Find system user
      const { data: sysUser, error: dbErr } = await supabaseAdmin
        .from('system_users')
        .select('id, email, auth_id')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!sysUser) {
        return NextResponse.json({ error: 'Usuário do sistema não encontrado' }, { status: 404 })
      }

      // Para system_users, o ID do banco ou auth_id pode ser usado diretamente
      const candidateId = sysUser.auth_id || id
      const { data: { user: byId } } = await supabaseAdmin.auth.admin.getUserById(candidateId).catch(() => ({ data: { user: null } }))
      if (byId) {
        targetAuthUserId = byId.id
        emailFound = byId.email || null
      } else if (sysUser.email) {
        const cleanSysEmail = sysUser.email.trim().toLowerCase()
        emailFound = cleanSysEmail
        targetAuthUserId = await findAuthByEmail(cleanSysEmail)
      }

      // Also reset password flag in DB
      await supabaseAdmin
        .from('system_users')
        .update({ senha_definida: false })
        .eq('id', id)
    }

    if (targetAuthUserId) {
      // Delete the Supabase Auth user
      const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(targetAuthUserId)
      if (deleteErr) {
        throw deleteErr
      }
      invalidateAuthUsersCache()
      clearAuthGuardCache()
      return NextResponse.json({ ok: true, message: `Acesso reiniciado com sucesso para o e-mail: ${emailFound}` })
    }

    clearAuthGuardCache()
    return NextResponse.json({ ok: true, message: 'Nenhuma credencial ativa encontrada no Supabase Auth. Usuário já está livre para Primeiro Acesso.' })
  } catch (err: any) {
    console.error('[API reset-access] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Erro interno ao reiniciar acesso' }, { status: 500 })
  }
}
