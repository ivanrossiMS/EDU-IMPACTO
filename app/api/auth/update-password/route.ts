import { NextResponse } from 'next/server'
import { getAdminClient, findAuthUserByEmail as findAuthUserByEmailFast, invalidateAuthUsersCache } from '@/lib/server/supabaseAdminSingleton'
import { clearAuthGuardCache } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

// Simple RFC-like email validation — ensures format has a real domain (e.g. user@domain.com)
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
    const { userIdLegacy, newPass, registeredEmail, isRecovery } = await request.json()

    if (!userIdLegacy || !newPass) {
      return NextResponse.json({ error: 'Usuário e nova senha são obrigatórios' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    // Helper: busca usuário no Auth usando cache O(1) + índices do banco
    const findAuthUserByEmail = async (em: string) => {
      return findAuthUserByEmailFast(em)
    }

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

      const existingByVirtual   = await findAuthUserByEmail(virtualEmail)
      const existingByRealEmail = alunoRealEmail ? await findAuthUserByEmail(alunoRealEmail) : null
      const targetUser = existingByVirtual || existingByRealEmail

      const targetEmail = (registeredEmail || alunoRealEmail || '').trim().toLowerCase()
      const emailForAuth = isValidEmail(targetEmail) ? targetEmail : virtualEmail

      if (targetUser) {
        if (targetUser.last_sign_in_at || (existingByRealEmail && targetEmail && targetEmail !== alunoRealEmail)) {
          return NextResponse.json({ error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail." }, { status: 409 })
        }
        
        // Update password and ensure email matches what user registered
        const updatePayload: any = { password: newPass }
        if (isValidEmail(targetEmail) && targetUser.email !== targetEmail) {
           updatePayload.email = targetEmail
           updatePayload.email_confirm = true
        }

        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, updatePayload)
        if (upErr) {
          if (isSamePasswordError(upErr)) {
            if (updatePayload.email) {
              const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
                email: updatePayload.email,
                email_confirm: true
              })
              if (emailErr && !isSamePasswordError(emailErr)) throw emailErr
            }
          } else {
            throw upErr
          }
        }
      } else {
        // Create auth user for student (using registered email if valid, else virtual)
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
          }
        })
        if (createErr) throw createErr
      }

      invalidateAuthUsersCache()
      clearAuthGuardCache()

      // Also set email on alunos record if registeredEmail provided and not previously set
      if (registeredEmail && (!alunoRealEmail || registeredEmail.trim().toLowerCase() === alunoRealEmail)) {
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
        .select('id, nome, email, celular, auth_id')
        .eq('id', realId)
        .maybeSingle()

      if (!resp) {
        return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 })
      }

      const storedRespEmail = (resp.email || '').trim().toLowerCase()
      // Use registered email from form only if no stored email exists, or if it matches stored email
      const targetEmail = (storedRespEmail || registeredEmail || '').trim().toLowerCase()
      if (!targetEmail || !targetEmail.includes('@')) {
        return NextResponse.json({ error: 'E-mail válido é obrigatório para criar acesso do responsável.' }, { status: 400 })
      }

      // Se o responsável já possui e-mail cadastrado e tentaram enviar outro diferente sem autenticação,
      // verifica primeiro o e-mail cadastrado no banco para impedir sequestro de conta
      const existingByStored = storedRespEmail ? await findAuthUserByEmail(storedRespEmail) : null
      const existingByTarget = (registeredEmail && registeredEmail.trim().toLowerCase() !== storedRespEmail)
        ? await findAuthUserByEmail(registeredEmail.trim().toLowerCase())
        : null
      const existing = existingByStored || existingByTarget

      let resolvedAuthId: string | null = resp.auth_id || null

      if (existing) {
        if (existing.last_sign_in_at || (existingByStored && registeredEmail && registeredEmail.trim().toLowerCase() !== storedRespEmail)) {
          return NextResponse.json({ error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail." }, { status: 409 })
        }
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: newPass })
        if (upErr && !isSamePasswordError(upErr)) throw upErr
        resolvedAuthId = existing.id
      } else {
        if (storedRespEmail && registeredEmail && registeredEmail.trim().toLowerCase() !== storedRespEmail) {
          return NextResponse.json({ error: 'O e-mail informado não corresponde ao cadastro do responsável.' }, { status: 403 })
        }
        const finalEmailToCreate = storedRespEmail || (registeredEmail || '').trim().toLowerCase()
        const { data: createdAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: finalEmailToCreate,
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
          }
        })
        if (createErr) throw createErr
        resolvedAuthId = createdAuth?.user?.id || null
      }

      invalidateAuthUsersCache()
      clearAuthGuardCache()

      // Save registered email back to responsaveis ONLY if it was previously empty, and persist auth_id
      if (!storedRespEmail && targetEmail) {
        await supabaseAdmin
          .from('responsaveis')
          .update(resolvedAuthId ? { email: targetEmail, auth_id: resolvedAuthId } : { email: targetEmail })
          .eq('id', realId)
      } else if (resolvedAuthId && resp.auth_id !== resolvedAuthId) {
        await supabaseAdmin
          .from('responsaveis')
          .update({ auth_id: resolvedAuthId })
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
        error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail." 
      }, { status: 409 })
    }

    if (registeredEmail && registeredEmail.trim().toLowerCase() !== email) {
      return NextResponse.json({
        error: 'O e-mail informado não corresponde ao cadastro do colaborador.'
      }, { status: 403 })
    }

    let existingAuthUser: any = null
    const { data: { user: byId } } = await supabaseAdmin.auth.admin.getUserById(userIdLegacy).catch(() => ({ data: { user: null } }))
    if (byId) {
      existingAuthUser = byId
    } else {
      existingAuthUser = await findAuthUserByEmail(email)
    }

    if (existingAuthUser) {
      if (existingAuthUser.last_sign_in_at) {
        return NextResponse.json({
          error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail."
        }, { status: 409 })
      }
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { password: newPass })
      if (upErr && !isSamePasswordError(upErr)) throw upErr
      if (existingAuthUser.id !== userIdLegacy) {
        await supabaseAdmin.from('system_users')
          .update({ auth_id: existingAuthUser.id, senha_definida: true })
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
          .update({ auth_id: authData.user.id, senha_definida: true })
          .eq('id', userIdLegacy)
      }
    }

    await supabaseAdmin
      .from('system_users')
      .update({ senha_definida: true })
      .eq('id', userIdLegacy)

    invalidateAuthUsersCache()
    clearAuthGuardCache()
    
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API update-password] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Erro interno ao atualizar senha' }, { status: 500 })
  }
}
