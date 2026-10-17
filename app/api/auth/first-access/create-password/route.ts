import { NextResponse } from 'next/server'
import {
  getAdminClient,
  findAuthUserByEmail as findAuthUserByEmailFast,
  invalidateAuthUsersCache,
  syncAlunoAuthOnEmailChange,
  syncResponsavelAuthOnEmailChange,
} from '@/lib/server/supabaseAdminSingleton'
import { verifyCreationToken } from '@/lib/server/firstAccessSecurity'
import { clearAuthGuardCache } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !email.endsWith('@impactoedu.local')

const isSamePasswordError = (err: any): boolean => {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  const code = (err.code || '').toLowerCase()
  return (
    code === 'same_password' ||
    msg.includes('different from the old password') ||
    msg.includes('should be different') ||
    msg.includes('same password') ||
    (err.status === 422 && msg.includes('password'))
  )
}

export async function POST(request: Request) {
  try {
    const { creationToken, newPass } = await request.json()

    if (!creationToken || typeof creationToken !== 'string') {
      return NextResponse.json(
        { error: 'Token de autorização não informado ou inválido. Reinicie o Primeiro Acesso.' },
        { status: 400 }
      )
    }

    if (!newPass || typeof newPass !== 'string' || newPass.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve conter no mínimo 6 caracteres.' },
        { status: 400 }
      )
    }

    // Valida o token criptográfico emitido após o sucesso do OTP
    const verification = verifyCreationToken(creationToken)
    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        { error: verification.error || 'Token de autorização expirou. Reinicie o Primeiro Acesso.' },
        { status: 403 }
      )
    }

    const { user } = verification
    const supabaseAdmin = getAdminClient()

    // Helper: busca usuário no Supabase Auth por e-mail via cache/índice rápido
    const findAuthUserByEmail = async (em: string) => {
      return findAuthUserByEmailFast(em)
    }

    let loginIdentifier = user.email

    // ── A) ALUNO ────────────────────────────────────────────────────────
    if (user.userType === 'aluno') {
      const realId = user.realId || user.userId.replace(/^aluno-/, '')

      const { data: aluno } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados')
        .eq('id', realId)
        .maybeSingle()

      if (!aluno) {
        return NextResponse.json({ error: 'Cadastro do estudante não encontrado.' }, { status: 404 })
      }

      const matricula = aluno.matricula || aluno.dados?.codigo || aluno.id
      const virtualEmail = `aluno.${matricula}@impactoedu.local`
      const alunoStoredEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
      const targetEmail = (user.email || alunoStoredEmail || '').trim().toLowerCase()
      const emailForAuth = isValidEmail(targetEmail) ? targetEmail : virtualEmail

      loginIdentifier = isValidEmail(targetEmail) ? targetEmail : matricula

      // Migra ou remove qualquer conta Auth antiga vinculada a este aluno antes de definir a senha
      await syncAlunoAuthOnEmailChange({
        alunoId: String(aluno.id),
        matricula: String(matricula || ''),
        oldEmail: alunoStoredEmail || null,
        newEmail: isValidEmail(targetEmail) ? targetEmail : null,
        nome: aluno.nome,
      })

      const existingByVirtual = await findAuthUserByEmail(virtualEmail)
      const existingByRealEmail = isValidEmail(targetEmail)
        ? await findAuthUserByEmail(targetEmail)
        : null
      const targetUser = existingByRealEmail || existingByVirtual

      if (targetUser) {
        const updatePayload: any = { password: newPass }
        if (isValidEmail(targetEmail) && targetUser.email !== targetEmail) {
          updatePayload.email = targetEmail
          updatePayload.email_confirm = true
        }

        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(
          targetUser.id,
          updatePayload
        )
        if (upErr && !isSamePasswordError(upErr)) {
          throw upErr
        }
      } else {
        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: emailForAuth,
          password: newPass,
          email_confirm: true,
          app_metadata: {
            role_type: 'aluno',
            perfil: 'Família',
            cargo: 'Aluno',
            aluno_id: aluno.id,
          },
          user_metadata: {
            nome: aluno.nome,
            cargo: 'Aluno',
            perfil: 'Família',
            matricula,
            aluno_id: aluno.id,
          },
        })
        if (createErr) throw createErr
      }

      invalidateAuthUsersCache()
      clearAuthGuardCache()

      // Se o aluno não tinha e-mail e não é e-mail de pai, salva na tabela de alunos
      if (isValidEmail(targetEmail) && !user.isParentEmail && !alunoStoredEmail) {
        await supabaseAdmin
          .from('alunos')
          .update({ email: targetEmail })
          .eq('id', realId)
      }

      return NextResponse.json({
        ok: true,
        loginIdentifier,
        nome: aluno.nome,
        message: 'Senha criada com sucesso!',
      })
    }

    // ── B) RESPONSÁVEL ──────────────────────────────────────────────────
    if (user.userType === 'responsavel') {
      const realId = user.realId || user.userId.replace(/^responsavel-/, '')

      const { data: resp } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, celular, auth_id')
        .eq('id', realId)
        .maybeSingle()

      if (!resp) {
        return NextResponse.json({ error: 'Cadastro do responsável não encontrado.' }, { status: 404 })
      }

      const storedRespEmail = (resp.email || '').trim().toLowerCase()
      const finalEmail = storedRespEmail || (user.email || '').trim().toLowerCase()

      if (!isValidEmail(finalEmail)) {
        return NextResponse.json(
          { error: 'E-mail válido é obrigatório para registrar o acesso.' },
          { status: 400 }
        )
      }

      loginIdentifier = finalEmail

      // Migra ou remove qualquer conta Auth antiga vinculada a este responsável antes de definir a senha
      await syncResponsavelAuthOnEmailChange({
        responsavelId: String(resp.id),
        oldEmail: storedRespEmail || null,
        newEmail: finalEmail,
        authId: resp.auth_id || null,
        nome: resp.nome,
      })

      const existing = await findAuthUserByEmail(finalEmail)
      let resolvedAuthId: string | null = resp.auth_id || null

      if (existing) {
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: newPass,
        })
        if (upErr && !isSamePasswordError(upErr)) throw upErr
        resolvedAuthId = existing.id
      } else {
        const { data: createdAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: finalEmail,
          password: newPass,
          email_confirm: true,
          app_metadata: {
            role_type: 'responsavel',
            perfil: 'Família',
            cargo: 'Responsável',
            responsavel_id: resp.id,
          },
          user_metadata: {
            nome: resp.nome,
            cargo: 'Responsável',
            perfil: 'Família',
            responsavel_id: resp.id,
          },
        })
        if (createErr) throw createErr
        resolvedAuthId = createdAuth?.user?.id || null
      }

      invalidateAuthUsersCache()
      clearAuthGuardCache()

      // Se a tabela de responsáveis estava sem e-mail, persiste o e-mail validado + auth_id
      if (!storedRespEmail && finalEmail) {
        await supabaseAdmin
          .from('responsaveis')
          .update(resolvedAuthId ? { email: finalEmail, auth_id: resolvedAuthId } : { email: finalEmail })
          .eq('id', realId)
      } else if (resolvedAuthId && resp.auth_id !== resolvedAuthId) {
        await supabaseAdmin
          .from('responsaveis')
          .update({ auth_id: resolvedAuthId })
          .eq('id', realId)
      }

      return NextResponse.json({
        ok: true,
        loginIdentifier,
        nome: resp.nome,
        message: 'Senha criada com sucesso!',
      })
    }

    // ── C) COLABORADOR (system_users) ───────────────────────────────────
    if (user.userType === 'system_user') {
      const realId = user.realId || user.userId

      const { data: dbUser } = await supabaseAdmin
        .from('system_users')
        .select('id, email, nome, cargo, perfil, senha_definida')
        .eq('id', realId)
        .maybeSingle()

      if (!dbUser || !dbUser.email) {
        return NextResponse.json({ error: 'Usuário do sistema não encontrado.' }, { status: 404 })
      }

      loginIdentifier = dbUser.email
      let existingAuthUser = await findAuthUserByEmail(dbUser.email.trim().toLowerCase())

      if (existingAuthUser) {
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(
          existingAuthUser.id,
          { password: newPass }
        )
        if (upErr && !isSamePasswordError(upErr)) throw upErr

        await supabaseAdmin
          .from('system_users')
          .update({ auth_id: existingAuthUser.id, senha_definida: true })
          .eq('id', realId)
      } else {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: dbUser.email.trim().toLowerCase(),
          password: newPass,
          email_confirm: true,
          app_metadata: {
            role_type: 'staff',
            cargo: dbUser.cargo,
            perfil: dbUser.perfil,
            system_user_id: dbUser.id,
          },
          user_metadata: {
            nome: dbUser.nome,
            cargo: dbUser.cargo,
            perfil: dbUser.perfil,
            system_user_id: dbUser.id,
          },
        })
        if (authErr) throw authErr

        if (authData?.user?.id) {
          await supabaseAdmin
            .from('system_users')
            .update({ auth_id: authData.user.id, senha_definida: true })
            .eq('id', realId)
        }
      }

      await supabaseAdmin
        .from('system_users')
        .update({ senha_definida: true })
        .eq('id', realId)

      invalidateAuthUsersCache()
      clearAuthGuardCache()

      return NextResponse.json({
        ok: true,
        loginIdentifier,
        nome: dbUser.nome,
        message: 'Senha criada com sucesso!',
      })
    }

    return NextResponse.json({ error: 'Tipo de usuário inválido.' }, { status: 400 })
  } catch (err: any) {
    console.error('[API first-access/create-password] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Erro interno ao salvar nova senha.' },
      { status: 500 }
    )
  }
}
