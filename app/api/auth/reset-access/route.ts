import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { type, id } = await request.json()

    if (!type || !id) {
      return NextResponse.json({ error: 'Tipo e ID são obrigatórios' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    let targetAuthUserId: string | null = null
    let emailFound: string | null = null

    // Helper: busca auth user por email sem listUsers(1000)
    const findAuthByEmail = async (email: string): Promise<string | null> => {
      // 1. Tenta via system_users (índice rápido)
      const { data: sys } = await supabaseAdmin
        .from('system_users')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle()
      if (sys?.id) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(sys.id).catch(() => ({ data: { user: null } }))
        if (user) return user.id
      }
      // 2. Fallback: listUsers pequeno
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 50 })
      const found = list?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      return found?.id || null
    }

    if (type === 'responsavel') {
      // Find the responsible record
      const { data: resp, error: dbErr } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!resp) {
        return NextResponse.json({ error: 'Responsável não encontrado' }, { status: 404 })
      }

      if (resp.email) {
        const cleanEmail = resp.email.trim().toLowerCase()
        emailFound = cleanEmail
        targetAuthUserId = await findAuthByEmail(cleanEmail)
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

      // Tenta primeiro pelo email virtual, depois pelo email real
      targetAuthUserId = await findAuthByEmail(virtualEmail)
      if (!targetAuthUserId && realEmail) {
        targetAuthUserId = await findAuthByEmail(realEmail)
      }
      if (targetAuthUserId) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(targetAuthUserId).catch(() => ({ data: { user: null } }))
        emailFound = user?.email || null
      }
    } else if (type === 'system_user') {
      // Find system user
      const { data: sysUser, error: dbErr } = await supabaseAdmin
        .from('system_users')
        .select('id, email')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!sysUser) {
        return NextResponse.json({ error: 'Usuário do sistema não encontrado' }, { status: 404 })
      }

      // Para system_users, o ID do banco pode ser igual ao ID do Auth
      const { data: { user: byId } } = await supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: { user: null } }))
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
      return NextResponse.json({ ok: true, message: `Acesso reiniciado com sucesso para o e-mail: ${emailFound}` })
    }

    return NextResponse.json({ ok: true, message: 'Nenhuma credencial ativa encontrada no Supabase Auth. Usuário já está livre para Primeiro Acesso.' })
  } catch (err: any) {
    console.error('[API reset-access] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Erro interno ao reiniciar acesso' }, { status: 500 })
  }
}
