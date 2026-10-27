import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { createProtectedClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request)
    if (errorResponse || !user) {
      return errorResponse || NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')

    if (!currentPassword) {
      return NextResponse.json({ error: 'Informe a senha atual.' }, { status: 400 })
    }
    if (!newPassword) {
      return NextResponse.json({ error: 'Informe a nova senha.' }, { status: 400 })
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'A nova senha deve ser diferente da senha atual.' }, { status: 400 })
    }

    const toAuthPw = (pw: string) => (pw.length > 0 && pw.length < 6 ? `${pw}::imp6` : pw)

    const userEmail = (user.email || '').trim().toLowerCase()
    if (!userEmail) {
      return NextResponse.json({ error: 'Conta sem e-mail vinculado no provedor de autenticação.' }, { status: 400 })
    }

    // 1. Confirma se a senha atual informada é válida usando um cliente isolado (sem alterar cookies da sessão)
    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    )

    const isShortCurrent = currentPassword.length > 0 && currentPassword.length < 6
    let { error: verifyErr } = await verifyClient.auth.signInWithPassword({
      email: userEmail,
      password: isShortCurrent ? toAuthPw(currentPassword) : currentPassword,
    })

    if (verifyErr) {
      return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
    }

    // 2. Atualiza a senha no Supabase Auth via Admin API
    const supabaseAdmin = getAdminClient()
    const finalNewPassword = toAuthPw(newPassword)
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: finalNewPassword,
    })

    if (updateErr) {
      console.error('[API change-password] Erro ao atualizar senha no Auth:', updateErr.message)
      return NextResponse.json(
        { error: updateErr.message || 'Não foi possível atualizar a senha.' },
        { status: 500 }
      )
    }

    // 3. Renova os cookies de sessão com a nova senha para que a sessão web continue ativa sem deslogar
    let refreshedToken: string | undefined
    try {
      const sessionClient = await createProtectedClient()
      const { data: refreshed } = await sessionClient.auth.signInWithPassword({
        email: userEmail,
        password: finalNewPassword,
      })
      refreshedToken = refreshed?.session?.access_token
    } catch {}

    // 4. Marca senha_definida = true em system_users caso seja colaborador/equipe
    try {
      const safeEmail = userEmail.replace(/"/g, '')
      await supabaseAdmin
        .from('system_users')
        .update({ senha_definida: true })
        .or(`id.eq."${user.id}",auth_id.eq."${user.id}",email.ilike."${safeEmail}"`)
    } catch {}

    return NextResponse.json({
      ok: true,
      message: 'Senha alterada com sucesso!',
      ...(refreshedToken ? { accessToken: refreshedToken } : {}),
    })
  } catch (err: any) {
    console.error('[API change-password] Erro inesperado:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar alteração de senha.' },
      { status: 500 }
    )
  }
}
