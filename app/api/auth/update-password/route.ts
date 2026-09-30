import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

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

    // Helper: busca usuário no Auth de forma completa e paginada
    const findAuthUserByEmail = async (em: string) => {
      let page = 1
      while (page <= 5) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 }).catch(() => ({ data: { users: [] } }))
        if (!list || !list.users || list.users.length === 0) break
        const found = list.users.find((u: any) => u.email?.toLowerCase() === em.toLowerCase())
        if (found) return found
        if (list.users.length < 1000) break
        page++
      }
      return null
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
        if (targetUser.last_sign_in_at) {
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
        .select('id, nome, email, celular')
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

      const existing = await findAuthUserByEmail(targetEmail)

      if (existing) {
        if (existing.last_sign_in_at) {
          return NextResponse.json({ error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail." }, { status: 409 })
        }
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: newPass })
        if (upErr && !isSamePasswordError(upErr)) throw upErr
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
        error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail." 
      }, { status: 409 })
    }

    let existingAuthUser: any = null
    const { data: { user: byId } } = await supabaseAdmin.auth.admin.getUserById(userIdLegacy).catch(() => ({ data: { user: null } }))
    if (byId) {
      existingAuthUser = byId
    } else {
      existingAuthUser = await findAuthUserByEmail(email)
    }

    if (existingAuthUser) {
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
    
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API update-password] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Erro interno ao atualizar senha' }, { status: 500 })
  }
}
