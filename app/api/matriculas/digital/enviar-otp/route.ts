import { NextResponse } from 'next/server'
import {
  buscarContratoPorToken,
  buscarContratoPorId,
  salvarContrato,
  registrarEventoAuditoria,
} from '@/lib/server/matriculaDigitalRepository'
import { generateOtpCode, calculateSha256, calculateEventHash, extractClientIp } from '@/lib/contracts/cryptoSignature'
import { enviarCodigoOtpEmail } from '@/lib/server/emailService'

export const dynamic = 'force-dynamic'

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'e-mail'
  const [user, domain] = email.split('@')
  if (user.length <= 2) return `${user}***@${domain}`
  return `${user.substring(0, 2)}***${user.substring(user.length - 1)}@${domain}`
}

/**
 * POST /api/matriculas/digital/enviar-otp
 * Dispara o código de confirmação de 6 dígitos para o e-mail do responsável
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clientIp = extractClientIp(request.headers)
    const token = body.token_assinatura
    const contratoId = body.contratoId

    let contrato = null
    if (token) {
      contrato = await buscarContratoPorToken(token)
    } else if (contratoId) {
      contrato = await buscarContratoPorId(contratoId)
    }

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado ou link inválido.' }, { status: 404 })
    }

    if (contrato.status === 'assinado') {
      return NextResponse.json({ error: 'Este contrato já foi assinado e finalizado.' }, { status: 400 })
    }

    if (contrato.status === 'cancelado') {
      return NextResponse.json({ error: 'Este contrato foi cancelado pela administração escolar.' }, { status: 400 })
    }

    // 1. Resolução do destinatário informado no formulário
    const emailEfetivo = (body.email_destinatario || contrato.responsavel_email || '').trim()
    const nomeEfetivo = (body.nome_destinatario || contrato.responsavel_nome || '').trim()

    // 2. Gera código numérico de 6 dígitos
    const otpCode = generateOtpCode()
    const otpHash = calculateSha256(otpCode)
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos

    // 3. Atualiza dados no contrato (inclusive se o responsável corrigiu o e-mail)
    contrato.responsavel_email = emailEfetivo
    if (nomeEfetivo) contrato.responsavel_nome = nomeEfetivo
    contrato.otp_codigo_hash = otpHash
    contrato.otp_codigo_aberto = null // Nunca armazenar código aberto pericialmente
    contrato.otp_expira_em = expiraEm
    contrato.otp_tentativas = 0

    // Registra na trilha de auditoria diretamente (elimina roundtrips repetidos de upload de PDFs)
    const historico = contrato.historico_eventos || []
    const ultimoEvento = historico[historico.length - 1]
    const prevHash = ultimoEvento?.hash || contrato.documento_original_hash || 'GENESIS_HASH'
    const eventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const timestamp = new Date().toISOString()
    const eventHash = calculateEventHash(prevHash, eventId, timestamp, 'ENVIO_CODIGO_OTP', clientIp)

    contrato.historico_eventos = [
      ...historico,
      {
        id: eventId,
        timestamp,
        evento: 'ENVIO_CODIGO_OTP',
        descricao: `Código de verificação OTP gerado e despachado para ${maskEmail(emailEfetivo)}`,
        ip: clientIp,
        hash: eventHash,
      },
    ]

    // 4. Executa em paralelo: persistência única no banco + disparo SMTP otimizado
    const [_, emailResult] = await Promise.all([
      salvarContrato(contrato),
      enviarCodigoOtpEmail({
        destinatario: emailEfetivo,
        nomeDestinatario: nomeEfetivo,
        codigoOtp: otpCode,
        alunoNome: contrato.aluno_nome || 'Estudante',
        protocolo: contrato.protocolo,
      }),
    ])

    if (!emailResult.success) {
      console.error('[API Enviar OTP] Falha após todas as tentativas de envio:', emailResult.error)
      return NextResponse.json({
        success: false,
        error: `O servidor de e-mail não pôde entregar o código no momento (${emailResult.error || 'Oscilação temporária'}). Você também pode receber o código diretamente via WhatsApp.`,
        simulated: false,
      }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      message: `Código enviado com sucesso para ${maskEmail(emailEfetivo)}.`,
      emailMascarado: maskEmail(emailEfetivo),
      simulated: emailResult.simulated,
      // Se estiver em modo simulado (sem SMTP conectado ainda), retorna o código para facilitar testes imediatos
      codigoSimulado: emailResult.simulated ? otpCode : undefined,
    })
  } catch (err: any) {
    console.error('[API Enviar OTP] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
