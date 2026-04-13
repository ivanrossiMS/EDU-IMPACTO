import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { userIdLegacy, newPass } = await request.json()

    if (!userIdLegacy || !newPass) {
      return NextResponse.json({ error: 'Usuário e nova senha são obrigatórios' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // 1. Get email from system_users — also check if already done
    const { data: dbUser } = await supabaseAdmin
      .from('system_users')
      .select('id, email, nome, senha_definida')
      .eq('id', userIdLegacy)
      .single()
    
    const email = dbUser?.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Usuário não encontrado no sistema.' }, { status: 404 })
    }

    // 2. Block if already set (idempotency guard)
    if (dbUser?.senha_definida === true) {
      return NextResponse.json({ 
        error: 'Senha já definida anteriormente. Use Login normal ou recuperação de senha.' 
      }, { status: 409 })
    }

    // 3. Check if Auth user exists
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingAuthUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email)

    if (existingAuthUser) {
      // Update password
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { 
        password: newPass 
      })
      if (upErr) throw upErr
      
      // Sync auth_id if needed
      if (existingAuthUser.id !== userIdLegacy) {
        await supabaseAdmin.from('system_users')
          .update({ auth_id: existingAuthUser.id })
          .eq('id', userIdLegacy)
      }
    } else {
      // Create Auth user with the chosen password (user provisioned before fix)
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPass,
        email_confirm: true,
      })
      if (authErr) throw authErr
      
      if (authData?.user?.id) {
        await supabaseAdmin.from('system_users')
          .update({ auth_id: authData.user.id, id: authData.user.id })
          .eq('id', userIdLegacy)
      }
    }

    // 4. Mark password as defined in DB — prevents repeated first-access
    await supabaseAdmin
      .from('system_users')
      .update({ senha_definida: true })
      .eq('id', userIdLegacy)
    
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API update-password] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Erro interno ao atualizar senha' }, { status: 500 })
  }
}
