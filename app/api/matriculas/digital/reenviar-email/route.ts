import { NextResponse } from 'next/server'
import {
  buscarContratoPorToken,
  buscarContratoPorId,
  buscarContratoPorProtocolo,
  obterPdfBytes,
  salvarContrato,
  adicionarEventoAuditoriaEmMemoria,
} from '@/lib/server/matriculaDigitalRepository'
import { extractClientIp, getPublicValidationUrl } from '@/lib/contracts/cryptoSignature'
import { enviarCopiaContratoAssinadoEmail } from '@/lib/server/emailService'

export const dynamic = 'force-dynamic'

/**
 * POST /api/matriculas/digital/reenviar-email
 * Reenvia a cópia oficial do contrato assinado (PDF com Certificado de Evidências)
 * para o responsável ou para um e-mail alternativo especificado.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clientIp = extractClientIp(request.headers)
    const token = body.token_assinatura
    const contratoId = body.contratoId
    const protocolo = body.protocolo

    let contrato = null
    if (token) {
      contrato = await buscarContratoPorToken(token)
    } else if (contratoId) {
      contrato = await buscarContratoPorId(contratoId)
    } else if (protocolo) {
      contrato = await buscarContratoPorProtocolo(protocolo)
    }

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    }

    if (contrato.status !== 'assinado') {
      return NextResponse.json(
        { error: 'Apenas contratos concluídos e assinados podem receber a cópia oficial em PDF.' },
        { status: 400 }
      )
    }

    const emailDestino = (body.email_destinatario || contrato.responsavel_email || '').trim()
    if (!emailDestino || !emailDestino.includes('@')) {
      return NextResponse.json(
        { error: 'Endereço de e-mail de destino inválido.' },
        { status: 400 }
      )
    }

    // 1. Obtém os bytes do PDF assinado selado
    const signedPdfBytes = await obterPdfBytes(contrato, 'assinado')
    if (!signedPdfBytes || signedPdfBytes.length === 0) {
      return NextResponse.json(
        { error: 'O arquivo PDF assinado não foi localizado no storage do sistema.' },
        { status: 404 }
      )
    }

    // 2. URL canônica de validação pública
    const validationUrl = getPublicValidationUrl(contrato.protocolo)

    // 3. Dispara a cópia com resiliência
    const nomeArquivo = `Contrato_${(contrato.aluno_nome || 'Documento').replace(/\s+/g, '_')}_${contrato.protocolo}.pdf`

    const emailResult = await enviarCopiaContratoAssinadoEmail({
      destinatario: emailDestino,
      nomeDestinatario: contrato.responsavel_nome,
      alunoNome: contrato.aluno_nome || 'Estudante',
      protocolo: contrato.protocolo,
      documentoFinalHash: contrato.documento_assinado_hash || 'SHA-256-CERTIFIED',
      validationUrl,
      pdfBuffer: signedPdfBytes,
      nomeArquivo,
    })

    if (!emailResult.success) {
      adicionarEventoAuditoriaEmMemoria(
        contrato,
        'FALHA_REENVIO_COPIA_EMAIL',
        `Tentativa de reenvio da via do contrato para ${emailDestino} falhou: ${emailResult.error || 'Instabilidade temporária'}`,
        clientIp
      )
      await salvarContrato(contrato)

      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'Falha na comunicação com o servidor de e-mail.',
        },
        { status: 502 }
      )
    }

    // 4. Registra evento de reenvio na trilha imutável
    adicionarEventoAuditoriaEmMemoria(
      contrato,
      'REENVIO_COPIA_EMAIL',
      `Via oficial do contrato assinado (PDF) reenviada para ${emailDestino}${emailResult.messageId ? ` (ID: ${emailResult.messageId})` : ''}`,
      clientIp
    )

    contrato.evidencias = {
      ...contrato.evidencias,
      ultimoReenvioEmailEm: new Date().toISOString(),
      ultimoReenvioEmailDestino: emailDestino,
      ultimoReenvioMessageId: emailResult.messageId || null,
    }

    // Atualiza email cadastrado caso o usuário tenha corrigido
    if (body.atualizar_email_cadastro && emailDestino !== contrato.responsavel_email) {
      contrato.responsavel_email = emailDestino
    }

    await salvarContrato(contrato)

    return NextResponse.json({
      success: true,
      message: `Cópia do contrato enviada com sucesso para ${emailDestino}.`,
      destinatario: emailDestino,
      messageId: emailResult.messageId,
    })
  } catch (err: any) {
    console.error('[API Reenviar Email] Erro grave:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
