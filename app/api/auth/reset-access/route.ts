import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { type, id } = await request.json()

    if (!type || !id) {
      return NextResponse.json({ error: 'Tipo e ID são obrigatórios' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // List all users from Supabase Auth to find the matching one
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) {
      throw listErr
    }

    let targetAuthUserId: string | null = null
    let emailFound: string | null = null

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
        emailFound = resp.email.trim().toLowerCase()
        const authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === emailFound)
        if (authUser) {
          targetAuthUserId = authUser.id
        }
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

      const authUser = listData?.users?.find(
        (u: any) => u.email?.toLowerCase() === virtualEmail || (realEmail && u.email?.toLowerCase() === realEmail)
      )
      if (authUser) {
        targetAuthUserId = authUser.id
        emailFound = authUser.email || null
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

      if (sysUser.email) {
        emailFound = sysUser.email.trim().toLowerCase()
        const authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === emailFound)
        if (authUser) {
          targetAuthUserId = authUser.id
        }
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
