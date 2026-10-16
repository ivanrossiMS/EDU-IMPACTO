import { NextResponse } from 'next/server'
import { verifyFirstAccessOtp } from '@/lib/server/firstAccessSecurity'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { otpToken, code } = await request.json()

    if (!otpToken || typeof otpToken !== 'string') {
      return NextResponse.json(
        { error: 'Sessão de verificação não informada ou inválida.' },
        { status: 400 }
      )
    }

    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      return NextResponse.json(
        { error: 'Informe o código de 6 dígitos completo.' },
        { status: 400 }
      )
    }

    const result = verifyFirstAccessOtp(otpToken, code)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Código de verificação incorreto.',
          remainingAttempts: result.remainingAttempts,
          nextOtpToken: result.nextOtpToken,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      creationToken: result.creationToken,
      user: result.user,
    })
  } catch (err: any) {
    console.error('[API first-access/verify-otp]', err)
    return NextResponse.json(
      { error: 'Erro interno ao validar código de segurança.' },
      { status: 500 }
    )
  }
}
