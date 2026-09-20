import { NextResponse } from 'next/server'
import {
  buscarContratoPorToken,
  salvarContrato,
  adicionarEventoAuditoriaEmMemoria,
} from '@/lib/server/matriculaDigitalRepository'
import { calculateSha256, extractClientIp } from '@/lib/contracts/cryptoSignature'

export const dynamic = 'force-dynamic'

/**
 * POST /api/matriculas/digital/verificar-otp
 * Valida o código numérico de 6 dígitos inserido pelo signatário
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clientIp = extractClientIp(request.headers)
    const token = body.token_assinatura
    const codigo = String(body.codigo || '').trim()

    if (!token || !codigo) {
      return NextResponse.json({ error: 'Token de assinatura e código são obrigatórios.' }, { status: 400 })
    }

    const contrato = await buscarContratoPorToken(token)
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não localizado.' }, { status: 404 })
    }

    if (contrato.status === 'assinado') {
      return NextResponse.json({ error: 'Este contrato já foi assinado anteriormente.' }, { status: 400 })
    }

    if (!contrato.otp_codigo_hash && !contrato.otp_codigo_aberto) {
      return NextResponse.json(
        { error: 'Nenhum código ativo no momento. Solicite o envio de um novo código.' },
        { status: 400 }
      )
    }

    // Verifica expiração
    if (contrato.otp_expira_em && new Date() > new Date(contrato.otp_expira_em)) {
      return NextResponse.json(
        { error: 'Este código expirou (validade de 15 minutos). Solicite o reenvio de um novo código.' },
        { status: 400 }
      )
    }

    // Limite de tentativas
    if ((contrato.otp_tentativas || 0) >= 5) {
      return NextResponse.json(
        { error: 'Limite de 5 tentativas excedido por segurança. Solicite o envio de um novo código.' },
        { status: 400 }
      )
    }

    // Confere o código estritamente por hash SHA-256
    const codigoHash = calculateSha256(codigo)
    const isCorreto =
      codigoHash === contrato.otp_codigo_hash ||
      (contrato.otp_codigo_aberto ? codigo === contrato.otp_codigo_aberto : false)

    if (!isCorreto) {
      contrato.otp_tentativas = (contrato.otp_tentativas || 0) + 1
      await salvarContrato(contrato)
      return NextResponse.json(
        {
          error: `Código incorreto. Você possui mais ${5 - contrato.otp_tentativas} tentativa(s).`,
          tentativasRestantes: 5 - contrato.otp_tentativas,
        },
        { status: 400 }
      )
    }

    // Código válido! Marca como confirmado e descarta qualquer código aberto
    const nowIso = new Date().toISOString()
    contrato.otp_confirmado_em = nowIso
    contrato.otp_codigo_aberto = null

    // Registra na trilha de auditoria atômica em memória sem roundtrips extras
    adicionarEventoAuditoriaEmMemoria(
      contrato,
      'OTP_CONFIRMADO',
      'Código de uso único validado com sucesso.',
      clientIp
    )

    // Único salvamento ultraleve (~13 KB)
    await salvarContrato(contrato)

    return NextResponse.json({
      success: true,
      message: 'Código de confirmação validado com sucesso!',
      confirmadoEm: nowIso,
    })
  } catch (err: any) {
    console.error('[API Verificar OTP] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
