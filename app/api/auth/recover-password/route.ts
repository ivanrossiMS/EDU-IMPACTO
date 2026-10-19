import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import {
  getAdminClient,
  findAuthUserByEmail,
  invalidateAuthUsersCache,
} from '@/lib/server/supabaseAdminSingleton'
import { clearAuthGuardCache } from '@/lib/server/authGuard'
import { enviarEmailRecuperacaoSenha } from '@/lib/server/emailService'
import { isNonDeliverableTestEmail } from '@/lib/utils/emailValidation'

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

function resolveSafeOrigin(request: Request, clientOrigin?: string): string {
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
    return 'https://resilient-cuchufli-2b4125.netlify.app'
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawEmail = typeof body.email === 'string' ? body.email : ''
    const cleanEmail = rawEmail.trim().toLowerCase()

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { error: 'Por favor, informe um endereço de e-mail válido.' },
        { status: 400 }
      )
    }

    if (isNonDeliverableTestEmail(cleanEmail)) {
      return NextResponse.json(
        {
          error:
            'O domínio deste e-mail é reservado para testes/exemplos (RFC 2606) e não recebe mensagens. Por favor, informe um endereço de e-mail válido.',
        },
        { status: 400 }
      )
    }

    const baseOrigin = resolveSafeOrigin(request, body.origin)
    const supabaseAdmin = getAdminClient()

    // 1. Verifica cadastro em system_users, responsaveis, alunos e auth.users
    const [sysRes, respRes, alunoRes, initialAuthUser] = await Promise.all([
      supabaseAdmin
        .from('system_users')
        .select('id, nome, email, cargo, perfil, status, auth_id, senha_definida')
        .ilike('email', cleanEmail)
        .limit(1),
      supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, auth_id')
        .ilike('email', cleanEmail)
        .limit(1),
      supabaseAdmin
        .from('alunos')
        .select('id, nome, email, matricula, dados, status')
        .or(`email.ilike.${cleanEmail},dados->>email.ilike.${cleanEmail}`)
        .limit(1),
      findAuthUserByEmail(cleanEmail),
    ])

    const sysUser = sysRes.data?.[0] || null
    const respUser = respRes.data?.[0] || null
    const alunoUser = alunoRes.data?.[0] || null
    let existingAuthUser = initialAuthUser

    // Se for aluno e ainda não localizou pelo e-mail real, verifica se já fez primeiro acesso com e-mail virtual
    if (!existingAuthUser && alunoUser) {
      const matricula = alunoUser.matricula || alunoUser.dados?.codigo || alunoUser.id
      if (matricula) {
        const virtualEmail = `aluno.${matricula}@impactoedu.local`.toLowerCase()
        existingAuthUser = await findAuthUserByEmail(virtualEmail)
      }
    }

    if (!sysUser && !respUser && !alunoUser && !existingAuthUser) {
      return NextResponse.json(
        {
          error:
            'Nenhum cadastro ativo encontrado com este e-mail. Verifique se digitou o e-mail cadastrado na secretaria escolar.',
        },
        { status: 404 }
      )
    }

    if (sysUser && sysUser.status === 'inativo') {
      return NextResponse.json(
        { error: 'Acesso bloqueado: Usuário inativo. Contate o suporte ou a secretaria.' },
        { status: 403 }
      )
    }

    if (!sysUser && respUser) {
      const { data: links } = await supabaseAdmin
        .from('aluno_responsavel')
        .select('resp_financeiro, resp_pedagogico')
        .eq('responsavel_id', respUser.id)

      const isAllowed = (links || []).some(
        (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
      )

      if (!isAllowed && !alunoUser) {
        return NextResponse.json(
          {
            error:
              'Acesso não autorizado. Apenas responsáveis Financeiro ou Pedagógico possuem login no sistema.',
          },
          { status: 403 }
        )
      }
    }

    if (!sysUser && !respUser && alunoUser) {
      const activeStatus = ['ativo', 'matriculado', 'cursando', 'ativo_transferencia']
      const isActive =
        !alunoUser.status || activeStatus.includes((alunoUser.status || '').toLowerCase())
      if (!isActive) {
        return NextResponse.json(
          { error: 'Matrícula inativa. Por favor, verifique com a secretaria escolar.' },
          { status: 403 }
        )
      }
    }

    const nomeDestinatario =
      sysUser?.nome ||
      respUser?.nome ||
      alunoUser?.nome ||
      existingAuthUser?.user_metadata?.nome ||
      undefined

    // 2. Verifica se o usuário já realizou o Primeiro Acesso (primeiro cadastro de senha).
    // Caso ainda não tenha feito o Primeiro Acesso, bloqueia o envio de redefinição e orienta o usuário.
    const hasAuthSignInOrConfirmation = Boolean(
      existingAuthUser &&
        (existingAuthUser.last_sign_in_at ||
          existingAuthUser.user_metadata?.password_confirmed_at)
    )

    const hasCompletedFirstAccess = sysUser
      ? Boolean(
          existingAuthUser &&
            (sysUser.senha_definida === true || hasAuthSignInOrConfirmation)
        )
      : hasAuthSignInOrConfirmation

    if (!hasCompletedFirstAccess) {
      return NextResponse.json(
        {
          error:
            'Você ainda não realizou o seu Primeiro Acesso. Para cadastrar sua senha pela primeira vez, volte para a tela de login, clique em "Primeiro Acesso" e siga as instruções enviadas para o seu e-mail.',
          needsFirstAccess: true,
          user: {
            nome: nomeDestinatario || '',
            email: cleanEmail,
            cargo: sysUser?.cargo || (respUser ? 'Responsável' : alunoUser ? 'Aluno' : 'Usuário'),
          },
        },
        { status: 403 }
      )
    }

    // Se o aluno já tinha feito Primeiro Acesso com e-mail virtual e agora possui e-mail real cadastrado, sincroniza antes de gerar o link
    if (existingAuthUser && existingAuthUser.email?.toLowerCase() !== cleanEmail) {
      await supabaseAdmin.auth.admin
        .updateUserById(existingAuthUser.id, {
          email: cleanEmail,
          email_confirm: true,
        })
        .catch(() => {})
      invalidateAuthUsersCache()
    }

    // 3. Gera o link/token de recuperação via Supabase Admin API
    const redirectTarget = `${baseOrigin}/atualizar-senha`
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: redirectTarget,
      },
    })

    if (linkErr || !linkData?.properties) {
      console.warn('[API recover-password] generateLink error:', linkErr?.message)
      return NextResponse.json(
        { error: linkErr?.message || 'Não foi possível gerar o link de recuperação.' },
        { status: 500 }
      )
    }

    let hashedToken = linkData.properties.hashed_token || ''
    if (!hashedToken && linkData.properties.action_link) {
      try {
        const actionUrl = new URL(linkData.properties.action_link)
        hashedToken = actionUrl.searchParams.get('token') || ''
      } catch {}
    }

    // Link direto para /atualizar-senha com token_hash, evitando o redirect_to para / da Site URL do Supabase
    const directResetUrl = hashedToken
      ? `${baseOrigin}/atualizar-senha?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
      : linkData.properties.action_link

    const emailResult = await enviarEmailRecuperacaoSenha({
      destinatario: cleanEmail,
      nomeDestinatario,
      resetUrl: directResetUrl,
    })

    if (!emailResult.success) {
      console.warn(
        '[API recover-password] Falha no envio SMTP direto, acionando fallback Supabase:',
        emailResult.error
      )
      const { error: fallbackErr } = await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectTarget,
      })
      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API recover-password POST] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar recuperação de senha.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { accessToken, tokenHash, newPassword } = body

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getAdminClient()
    let targetUser: any = null

    if (accessToken && typeof accessToken === 'string') {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
      if (!error && data?.user) {
        targetUser = data.user
      }
    }

    if (!targetUser && tokenHash && typeof tokenHash === 'string') {
      const tempClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )
      const { data, error } = await tempClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      })
      if (!error && data?.user) {
        targetUser = data.user
      }
    }

    if (!targetUser?.id) {
      return NextResponse.json(
        { error: 'Sessão de recuperação inválida ou expirada. Solicite um novo link.' },
        { status: 401 }
      )
    }

    const userEmail = (targetUser.email || '').trim().toLowerCase()
    if (userEmail) {
      const { data: sysRows } = await supabaseAdmin
        .from('system_users')
        .select('id, status, senha_definida')
        .ilike('email', userEmail)
        .limit(1)

      const sysCheck = sysRows?.[0]
      if (sysCheck) {
        if (sysCheck.status === 'inativo') {
          return NextResponse.json(
            { error: 'Acesso bloqueado: Usuário inativo. Contate o suporte ou a secretaria.' },
            { status: 403 }
          )
        }
        if (sysCheck.senha_definida !== true && !targetUser.user_metadata?.password_confirmed_at) {
          return NextResponse.json(
            {
              error:
                'Você ainda não realizou o seu Primeiro Acesso. Para cadastrar sua senha pela primeira vez, acesse a opção "Primeiro Acesso" na tela de login.',
              needsFirstAccess: true,
            },
            { status: 403 }
          )
        }
      }
    }

    let mantemMesmaSenha = false
    const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        ...(targetUser.user_metadata || {}),
        password_confirmed_at: new Date().toISOString(),
      },
    })

    if (upErr) {
      if (isSamePasswordError(upErr)) {
        mantemMesmaSenha = true
      } else {
        return NextResponse.json(
          { error: `Falha ao atualizar: ${upErr.message}` },
          { status: 400 }
        )
      }
    }

    if (userEmail) {
      await Promise.all([
        supabaseAdmin
          .from('system_users')
          .update({ senha_definida: true, auth_id: targetUser.id })
          .or(`auth_id.eq.${targetUser.id},email.ilike.${userEmail}`),
        supabaseAdmin
          .from('responsaveis')
          .update({ auth_id: targetUser.id })
          .ilike('email', userEmail)
          .is('auth_id', null),
      ]).catch(() => {})
    }

    invalidateAuthUsersCache()
    clearAuthGuardCache()

    return NextResponse.json({
      ok: true,
      email: userEmail,
      mantemMesmaSenha,
    })
  } catch (err: any) {
    console.error('[API recover-password PUT] Error:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao atualizar senha.' },
      { status: 500 }
    )
  }
}
