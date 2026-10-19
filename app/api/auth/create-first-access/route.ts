import { NextResponse } from 'next/server'
import {
  getAdminClient,
  findAuthUserByEmail,
  invalidateAuthUsersCache,
  syncAlunoAuthOnEmailChange,
  syncResponsavelAuthOnEmailChange,
} from '@/lib/server/supabaseAdminSingleton'
import { requireStaff, clearAuthGuardCache } from '@/lib/server/authGuard'
import { invalidateColaboradoresCache } from '@/lib/server/colaboradoresCache'
import { enviarEmailCredenciaisPrimeiroAcesso } from '@/lib/server/emailService'

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

function generateRandomPassword(length = 8): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits

  let pass = ''
  pass += upper.charAt(Math.floor(Math.random() * upper.length))
  pass += lower.charAt(Math.floor(Math.random() * lower.length))
  pass += digits.charAt(Math.floor(Math.random() * digits.length))

  for (let i = 3; i < length; i++) {
    pass += all.charAt(Math.floor(Math.random() * all.length))
  }

  return pass
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

function resolveBaseOrigin(request: Request, clientOrigin?: string): string {
  const candidates = [
    clientOrigin,
    request.headers.get('origin'),
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    try {
      const u = new URL(c.trim())
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.origin
      }
    } catch {}
  }

  try {
    return new URL(request.url).origin
  } catch {
    return 'https://impacto-edu.net'
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const { type, id, email: rawCustomEmail, password: rawPassword, sendEmail = false, origin } = body

    if (!type || !id) {
      return NextResponse.json({ error: 'Tipo e ID do usuário são obrigatórios.' }, { status: 400 })
    }

    const finalPassword =
      typeof rawPassword === 'string' && rawPassword.trim().length >= 6
        ? rawPassword.trim()
        : generateRandomPassword(8)

    const customEmail = typeof rawCustomEmail === 'string' ? rawCustomEmail.trim().toLowerCase() : ''
    const supabaseAdmin = getAdminClient()
    const confirmedIso = new Date().toISOString()
    const baseOrigin = resolveBaseOrigin(request, origin)

    let loginIdentifier = ''
    let targetEmailForSend = ''
    let nomeDestinatario = ''
    let perfilOuCargo = ''

    // ── 1. COLABORADOR (system_users) ───────────────────────────────────
    if (type === 'system_user') {
      const { data: sysUser, error: dbErr } = await supabaseAdmin
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status, auth_id, dados')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!sysUser) {
        return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 })
      }

      const storedEmail = (sysUser.email || '').trim().toLowerCase()
      const finalEmail = customEmail || storedEmail

      if (!isValidEmail(finalEmail)) {
        return NextResponse.json(
          { error: 'Informe um e-mail válido para criar o acesso do colaborador.' },
          { status: 400 }
        )
      }

      nomeDestinatario = sysUser.nome || 'Colaborador'
      perfilOuCargo = sysUser.cargo || sysUser.perfil || 'Colaborador'
      loginIdentifier = finalEmail
      targetEmailForSend = finalEmail

      // Busca usuário existente no Supabase Auth (por auth_id, id ou e-mail)
      let existingAuthUser: any = null
      const candidateId = sysUser.auth_id || sysUser.id
      const { data: byIdRes } = await supabaseAdmin.auth.admin
        .getUserById(candidateId)
        .catch(() => ({ data: { user: null } }))

      if (byIdRes?.user) {
        existingAuthUser = byIdRes.user
      } else {
        existingAuthUser = await findAuthUserByEmail(finalEmail)
        if (!existingAuthUser && storedEmail && storedEmail !== finalEmail) {
          existingAuthUser = await findAuthUserByEmail(storedEmail)
        }
      }

      // Verifica se também possui papel de responsável (dual role)
      const { data: respMatch } = await supabaseAdmin
        .from('responsaveis')
        .select('id')
        .ilike('email', finalEmail)
        .maybeSingle()

      const hasDualRole = Boolean(respMatch?.id || sysUser.dados?.responsavel_id)
      let resolvedAuthId = existingAuthUser?.id || null

      if (existingAuthUser) {
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
          email: finalEmail,
          password: finalPassword,
          email_confirm: true,
          app_metadata: {
            ...(existingAuthUser.app_metadata || {}),
            role_type: 'staff',
            cargo: sysUser.cargo,
            perfil: sysUser.perfil,
            system_user_id: sysUser.id,
          },
          user_metadata: {
            ...(existingAuthUser.user_metadata || {}),
            nome: sysUser.nome,
            cargo: sysUser.cargo,
            perfil: sysUser.perfil,
            colaborador_id: sysUser.id,
            system_user_id: sysUser.id,
            ...(respMatch?.id ? { responsavel_id: String(respMatch.id) } : {}),
            hasDualRole,
            password_confirmed_at: confirmedIso,
          },
        })
        if (upErr && !isSamePasswordError(upErr)) throw upErr
        resolvedAuthId = existingAuthUser.id
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: finalEmail,
          password: finalPassword,
          email_confirm: true,
          app_metadata: {
            role_type: 'staff',
            cargo: sysUser.cargo,
            perfil: sysUser.perfil,
            system_user_id: sysUser.id,
          },
          user_metadata: {
            nome: sysUser.nome,
            cargo: sysUser.cargo,
            perfil: sysUser.perfil,
            colaborador_id: sysUser.id,
            system_user_id: sysUser.id,
            ...(respMatch?.id ? { responsavel_id: String(respMatch.id) } : {}),
            hasDualRole,
            password_confirmed_at: confirmedIso,
          },
        })
        if (createErr) throw createErr
        resolvedAuthId = created?.user?.id || null
      }

      await supabaseAdmin
        .from('system_users')
        .update({
          email: finalEmail,
          auth_id: resolvedAuthId,
          senha_definida: true,
          status: 'ativo',
        })
        .eq('id', sysUser.id)
    }

    // ── 2. RESPONSÁVEL (responsaveis) ───────────────────────────────────
    else if (type === 'responsavel') {
      const { data: resp, error: dbErr } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, celular, auth_id')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!resp) {
        return NextResponse.json({ error: 'Responsável não encontrado.' }, { status: 404 })
      }

      const storedEmail = (resp.email || '').trim().toLowerCase()
      const finalEmail = customEmail || storedEmail

      if (!isValidEmail(finalEmail)) {
        return NextResponse.json(
          { error: 'Informe um e-mail válido para criar o acesso deste responsável.' },
          { status: 400 }
        )
      }

      nomeDestinatario = resp.nome || 'Responsável'
      perfilOuCargo = 'Responsável'
      loginIdentifier = finalEmail
      targetEmailForSend = finalEmail

      await syncResponsavelAuthOnEmailChange({
        responsavelId: String(resp.id),
        oldEmail: storedEmail || null,
        newEmail: finalEmail,
        authId: resp.auth_id || null,
        nome: resp.nome,
      })

      const existing = await findAuthUserByEmail(finalEmail)
      let resolvedAuthId: string | null = resp.auth_id || null

      if (existing) {
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          email: finalEmail,
          password: finalPassword,
          email_confirm: true,
          app_metadata: {
            ...(existing.app_metadata || {}),
            role_type: existing.app_metadata?.role_type || 'responsavel',
            responsavel_id: resp.id,
          },
          user_metadata: {
            ...(existing.user_metadata || {}),
            nome: existing.user_metadata?.nome || resp.nome,
            responsavel_id: resp.id,
            password_confirmed_at: confirmedIso,
          },
        })
        if (upErr && !isSamePasswordError(upErr)) throw upErr
        resolvedAuthId = existing.id
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: finalEmail,
          password: finalPassword,
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
            password_confirmed_at: confirmedIso,
          },
        })
        if (createErr) throw createErr
        resolvedAuthId = created?.user?.id || null
      }

      await supabaseAdmin
        .from('responsaveis')
        .update({
          email: finalEmail,
          auth_id: resolvedAuthId,
        })
        .eq('id', resp.id)
    }

    // ── 3. ALUNO (alunos) ───────────────────────────────────────────────
    else if (type === 'aluno') {
      const { data: aluno, error: dbErr } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados')
        .eq('id', id)
        .maybeSingle()

      if (dbErr) throw dbErr
      if (!aluno) {
        return NextResponse.json({ error: 'Aluno não encontrado.' }, { status: 404 })
      }

      const matricula = aluno.matricula || aluno.dados?.codigo || aluno.id
      const virtualEmail = `aluno.${matricula}@impactoedu.local`.toLowerCase()
      const storedEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
      const finalEmail = customEmail || storedEmail

      if (!isValidEmail(finalEmail)) {
        return NextResponse.json(
          { error: 'Informe um e-mail válido para criar o acesso deste aluno (o login é realizado com e-mail e senha).' },
          { status: 400 }
        )
      }

      nomeDestinatario = aluno.nome || 'Estudante'
      perfilOuCargo = 'Aluno'
      loginIdentifier = finalEmail
      targetEmailForSend = finalEmail

      await syncAlunoAuthOnEmailChange({
        alunoId: String(aluno.id),
        matricula: String(matricula || ''),
        oldEmail: storedEmail || null,
        newEmail: finalEmail,
        nome: aluno.nome,
      })

      const existingByVirtual = await findAuthUserByEmail(virtualEmail)
      const existingByReal = await findAuthUserByEmail(finalEmail)
      const targetUser = existingByReal || existingByVirtual

      if (targetUser) {
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
          email: finalEmail,
          password: finalPassword,
          email_confirm: true,
          app_metadata: {
            ...(targetUser.app_metadata || {}),
            role_type: 'aluno',
            perfil: 'Família',
            cargo: 'Aluno',
            aluno_id: aluno.id,
          },
          user_metadata: {
            ...(targetUser.user_metadata || {}),
            nome: aluno.nome,
            cargo: 'Aluno',
            perfil: 'Família',
            matricula,
            aluno_id: aluno.id,
            password_confirmed_at: confirmedIso,
          },
        })
        if (upErr && !isSamePasswordError(upErr)) throw upErr
      } else {
        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: finalEmail,
          password: finalPassword,
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
            password_confirmed_at: confirmedIso,
          },
        })
        if (createErr) throw createErr
      }

      if (finalEmail !== storedEmail) {
        await supabaseAdmin
          .from('alunos')
          .update({
            email: finalEmail,
            dados: {
              ...(aluno.dados || {}),
              email: finalEmail,
            },
          })
          .eq('id', aluno.id)
      }
    } else {
      return NextResponse.json({ error: 'Tipo de usuário inválido.' }, { status: 400 })
    }

    invalidateAuthUsersCache()
    clearAuthGuardCache()
    invalidateColaboradoresCache()

    let emailSent = false
    let emailError: string | undefined

    if (sendEmail && isValidEmail(targetEmailForSend)) {
      const loginUrl = `${baseOrigin}/login?email=${encodeURIComponent(loginIdentifier)}`
      const mailRes = await enviarEmailCredenciaisPrimeiroAcesso({
        destinatario: targetEmailForSend,
        nomeDestinatario,
        login: loginIdentifier,
        senhaGerada: finalPassword,
        perfilOuCargo,
        loginUrl,
      })
      emailSent = mailRes.success
      if (!mailRes.success) {
        emailError = mailRes.error
      }
    }

    return NextResponse.json({
      ok: true,
      nome: nomeDestinatario,
      login: loginIdentifier,
      password: finalPassword,
      emailSent,
      emailError,
      message: 'Primeiro acesso criado com sucesso!',
    })
  } catch (err: any) {
    console.error('[API create-first-access] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao criar primeiro acesso.' },
      { status: 500 }
    )
  }
}
