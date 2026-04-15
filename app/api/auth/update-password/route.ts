import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { userIdLegacy, newPass, registeredEmail } = await request.json()

    if (!userIdLegacy || !newPass) {
      return NextResponse.json({ error: 'Usuário e nova senha são obrigatórios' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── Detect user type from prefixed ID ───────────────────────────
    const isAluno       = userIdLegacy.startsWith('aluno-')
    const isResponsavel = userIdLegacy.startsWith('responsavel-')
    const isVirtual     = userIdLegacy.startsWith('virtual-')

    // ── A) Handle ALUNO (prefix: aluno-{uuid}) ──────────────────────
    if (isAluno || isVirtual) {
      const realId = userIdLegacy.replace(/^aluno-/, '').replace(/^virtual-/, '')

      const { data: aluno } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados')
        .eq('id', realId)
        .maybeSingle()

      if (!aluno) {
        return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 })
      }

      const matricula      = aluno.matricula || aluno.dados?.codigo || aluno.id
      const alunoRealEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
      
      // Virtual email used as Supabase Auth identifier for students
      const virtualEmail = `aluno.${matricula}@impactoedu.local`

      // Check if auth user already exists
      const { data: listData }  = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existingByVirtual   = listData?.users?.find((u: any) => u.email?.toLowerCase() === virtualEmail)
      const existingByRealEmail = alunoRealEmail 
        ? listData?.users?.find((u: any) => u.email?.toLowerCase() === alunoRealEmail) 
        : null

      const targetUser = existingByVirtual || existingByRealEmail

      if (targetUser) {
        if (targetUser.last_sign_in_at) {
          return NextResponse.json({ error: 'Senha já definida. Use Login normal.' }, { status: 409 })
        }
        // Update password
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, { password: newPass })
        if (upErr) throw upErr
      } else {
        // Create auth user for student (use virtual email as Supabase identifier)
        const emailForAuth = alunoRealEmail && alunoRealEmail.includes('@') && !alunoRealEmail.endsWith('@impactoedu.local')
          ? alunoRealEmail
          : virtualEmail

        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: emailForAuth,
          password: newPass,
          email_confirm: true,
          user_metadata: {
            nome: aluno.nome,
            cargo: 'Aluno',
            perfil: 'Família',
            matricula,
            aluno_id: aluno.id,
          }
        })
        if (createErr) throw createErr
      }

      // Also set email on alunos record if registeredEmail provided and different
      if (registeredEmail && registeredEmail.trim() !== alunoRealEmail) {
        await supabaseAdmin
          .from('alunos')
          .update({ email: registeredEmail.trim().toLowerCase() })
          .eq('id', realId)
      }

      return NextResponse.json({ ok: true })
    }

    // ── B) Handle RESPONSAVEL (prefix: responsavel-{uuid}) ──────────
    if (isResponsavel) {
      const realId = userIdLegacy.replace(/^responsavel-/, '')

      const { data: resp } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, cpf, celular')
        .eq('id', realId)
        .maybeSingle()

      if (!resp) {
        return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 })
      }

      // Use registered email from form, fallback to stored email
      const targetEmail = (registeredEmail || resp.email || '').trim().toLowerCase()
      if (!targetEmail || !targetEmail.includes('@')) {
        return NextResponse.json({ error: 'E-mail válido é obrigatório para criar acesso do responsável.' }, { status: 400 })
      }

      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = listData?.users?.find((u: any) => u.email?.toLowerCase() === targetEmail)

      if (existing) {
        if (existing.last_sign_in_at) {
          return NextResponse.json({ error: 'Senha já definida. Use Login normal.' }, { status: 409 })
        }
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: newPass })
        if (upErr) throw upErr
      } else {
        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: targetEmail,
          password: newPass,
          email_confirm: true,
          user_metadata: {
            nome: resp.nome,
            cargo: 'Responsável',
            perfil: 'Família',
            responsavel_id: resp.id,
          }
        })
        if (createErr) throw createErr
      }

      // Save registered email back to responsaveis if different
      if (targetEmail !== (resp.email || '').trim().toLowerCase()) {
        await supabaseAdmin
          .from('responsaveis')
          .update({ email: targetEmail })
          .eq('id', realId)
      }

      return NextResponse.json({ ok: true })
    }

    // ── C) Handle SYSTEM USER (collaborator) ────────────────────────
    const { data: dbUser } = await supabaseAdmin
      .from('system_users')
      .select('id, email, nome, senha_definida')
      .eq('id', userIdLegacy)
      .maybeSingle()
    
    const email = dbUser?.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Usuário não encontrado no sistema.' }, { status: 404 })
    }

    if (dbUser?.senha_definida === true) {
      return NextResponse.json({ 
        error: 'Senha já definida anteriormente. Use Login normal ou recuperação de senha.' 
      }, { status: 409 })
    }

    const { data: listData2 } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingAuthUser = listData2?.users?.find((u: any) => u.email?.toLowerCase() === email)

    if (existingAuthUser) {
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { password: newPass })
      if (upErr) throw upErr
      if (existingAuthUser.id !== userIdLegacy) {
        await supabaseAdmin.from('system_users')
          .update({ auth_id: existingAuthUser.id })
          .eq('id', userIdLegacy)
      }
    } else {
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
