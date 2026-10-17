import { NextResponse } from 'next/server'
import { getAdminClient, findAuthUserByEmail } from '@/lib/server/supabaseAdminSingleton'
import {
  generateFirstAccessOtp,
  maskEmail,
  type FirstAccessUserPayload,
} from '@/lib/server/firstAccessSecurity'
import { enviarCodigoOtpPrimeiroAcesso } from '@/lib/server/emailService'

export const dynamic = 'force-dynamic'

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !email.endsWith('@impactoedu.local')

export async function POST(request: Request) {
  try {
    const { query } = await request.json().catch(() => ({}))

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Informe seu e-mail cadastrado.' }, { status: 400 })
    }

    const q = query.trim().toLowerCase()

    if (!isValidEmail(q)) {
      return NextResponse.json(
        { error: 'Informe um e-mail válido (ex: seu.nome@exemplo.com).' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getAdminClient()

    // Helper: busca usuário existente no Supabase Auth por e-mail via cache/índice rápido
    const findAuthByEmail = async (email: string) => {
      return findAuthUserByEmail(email)
    }

    // ── 1. Verificar Colaborador (system_users) ─────────────────────────
    const { data: sysUserRows } = await supabaseAdmin
      .from('system_users')
      .select('id, nome, email, cargo, perfil, status, senha_definida')
      .ilike('email', q)
      .limit(1)

    const sysUser = sysUserRows?.[0]
    if (sysUser) {
      if (sysUser.status === 'inativo') {
        return NextResponse.json(
          { error: 'Acesso bloqueado: Usuário inativo. Contate o suporte ou a secretaria.' },
          { status: 403 }
        )
      }

      const userPayload: FirstAccessUserPayload = {
        userId: sysUser.id,
        realId: sysUser.id,
        nome: sysUser.nome,
        email: sysUser.email,
        cargo: sysUser.cargo || 'Colaborador',
        perfil: sysUser.perfil || 'Usuário',
        userType: 'system_user',
      }

      if (sysUser.senha_definida === true) {
        return NextResponse.json(
          {
            error:
              "Sua senha já foi configurada. Acesse pelo Login normal ou use 'Esqueci minha senha' para redefinir.",
            alreadyConfigured: true,
            user: userPayload,
          },
          { status: 409 }
        )
      }

      const { otpCode, otpToken } = generateFirstAccessOtp(userPayload)
      await enviarCodigoOtpPrimeiroAcesso({
        destinatario: sysUser.email,
        nomeDestinatario: sysUser.nome,
        codigoOtp: otpCode,
        perfilOuCargo: sysUser.cargo,
      })

      return NextResponse.json({
        ok: true,
        otpToken,
        emailMasked: maskEmail(sysUser.email),
        isParentEmail: false,
        user: userPayload,
        cooldownSeconds: 60,
      })
    }

    // ── 2. Verificar Responsável (responsaveis) ─────────────────────────
    const { data: responsaveisRows } = await supabaseAdmin
      .from('responsaveis')
      .select('id, nome, email, celular, codigo, telefone, dados')
      .ilike('email', q)
      .limit(1)

    const responsavel = responsaveisRows?.[0]

    if (responsavel) {
      // Verifica autorização (Financeiro ou Pedagógico)
      const { data: links } = await supabaseAdmin
        .from('aluno_responsavel')
        .select('resp_financeiro, resp_pedagogico')
        .eq('responsavel_id', responsavel.id)

      const isAllowed = (links || []).some(
        (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
      )

      if (!isAllowed) {
        return NextResponse.json(
          {
            error:
              'Acesso não autorizado. Apenas responsáveis Financeiro ou Pedagógico possuem login no sistema.',
          },
          { status: 403 }
        )
      }

      const targetEmail = (responsavel.email || q).trim().toLowerCase()

      const userPayload: FirstAccessUserPayload = {
        userId: `responsavel-${responsavel.id}`,
        realId: responsavel.id,
        nome: responsavel.nome,
        email: targetEmail,
        cargo: 'Responsável',
        perfil: 'Família',
        userType: 'responsavel',
      }

      const existingAuthResp = await findAuthByEmail(targetEmail)
      if (existingAuthResp && (existingAuthResp.last_sign_in_at || existingAuthResp.confirmed_at)) {
        return NextResponse.json(
          {
            error:
              "Sua senha já foi configurada. Acesse pelo Login normal ou use 'Esqueci minha senha' para redefinir.",
            alreadyConfigured: true,
            user: userPayload,
          },
          { status: 409 }
        )
      }

      const { otpCode, otpToken } = generateFirstAccessOtp(userPayload)
      await enviarCodigoOtpPrimeiroAcesso({
        destinatario: targetEmail,
        nomeDestinatario: responsavel.nome,
        codigoOtp: otpCode,
        perfilOuCargo: 'Responsável',
      })

      return NextResponse.json({
        ok: true,
        otpToken,
        emailMasked: maskEmail(targetEmail),
        isParentEmail: false,
        user: userPayload,
        cooldownSeconds: 60,
      })
    }

    // ── 3. Verificar Aluno (alunos) ────────────────────────────────────
    const { data: alunosRows } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, matricula, telefone, dados, status')
      .or(`email.ilike.${q},dados->>email.ilike.${q}`)
      .limit(1)

    const aluno = alunosRows?.[0]

    if (aluno) {
      const activeStatus = ['ativo', 'matriculado', 'cursando', 'ativo_transferencia']
      const isActive = !aluno.status || activeStatus.includes((aluno.status || '').toLowerCase())
      if (!isActive) {
        return NextResponse.json(
          { error: 'Matrícula inativa. Por favor, verifique com a secretaria escolar.' },
          { status: 403 }
        )
      }

      const matricula = aluno.matricula || aluno.dados?.codigo || aluno.id
      const virtualEmail = `aluno.${matricula}@impactoedu.local`
      const targetEmail = (aluno.email || aluno.dados?.email || q).trim().toLowerCase()

      // Verifica se o aluno já possui senha ativa configurada
      let existingAuth = await findAuthByEmail(virtualEmail)
      if (!existingAuth && isValidEmail(targetEmail)) {
        existingAuth = await findAuthByEmail(targetEmail)
      }

      const userPayload: FirstAccessUserPayload = {
        userId: `aluno-${aluno.id}`,
        realId: aluno.id,
        nome: aluno.nome,
        email: targetEmail,
        cargo: 'Aluno',
        perfil: 'Família',
        matricula,
        userType: 'aluno',
      }

      if (existingAuth && (existingAuth.last_sign_in_at || existingAuth.confirmed_at)) {
        return NextResponse.json(
          {
            error:
              "Sua senha já foi configurada. Acesse pelo Login normal ou use 'Esqueci minha senha' para redefinir.",
            alreadyConfigured: true,
            user: userPayload,
          },
          { status: 409 }
        )
      }

      const { otpCode, otpToken } = generateFirstAccessOtp(userPayload)
      await enviarCodigoOtpPrimeiroAcesso({
        destinatario: targetEmail,
        nomeDestinatario: aluno.nome,
        codigoOtp: otpCode,
        perfilOuCargo: 'Aluno',
        alunoNome: aluno.nome,
      })

      return NextResponse.json({
        ok: true,
        otpToken,
        emailMasked: maskEmail(targetEmail),
        isParentEmail: false,
        parentName: null,
        user: userPayload,
        cooldownSeconds: 60,
      })
    }

    return NextResponse.json(
      { error: 'Nenhum cadastro ativo encontrado com este e-mail. Verifique se digitou o e-mail cadastrado na secretaria escolar.' },
      { status: 404 }
    )
  } catch (err: any) {
    console.error('[API first-access/send-otp]', err)
    return NextResponse.json(
      { error: 'Erro interno ao processar a verificação de primeiro acesso.' },
      { status: 500 }
    )
  }
}
