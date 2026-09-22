import { NextResponse } from 'next/server'
import {
  buscarContratoPorToken,
  salvarContrato,
  obterPdfBytes,
  salvarPdfBytes,
  adicionarEventoAuditoriaEmMemoria,
} from '@/lib/server/matriculaDigitalRepository'
import {
  extractClientIp,
  parseUserAgent,
  getAppBaseUrl,
} from '@/lib/contracts/cryptoSignature'
import {
  anexarCertificadoEvidencias,
} from '@/lib/contracts/digitalEvidenceCertificate'
import { enviarCopiaContratoAssinadoEmail } from '@/lib/server/emailService'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

/**
 * POST /api/matriculas/digital/assinar
 * Conclui a assinatura eletrônica do responsável, anexa o Certificado de Evidências em PDF e sela o arquivo
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = body.token_assinatura
    const aceiteTexto = body.aceiteTexto || 'Li, concordo e desejo assinar'
    const assinaturaBase64 = body.assinaturaBase64 || null
    const clientInfoFromBody = body.clientInfo || {}

    if (!token) {
      return NextResponse.json({ error: 'Token de assinatura é obrigatório.' }, { status: 400 })
    }

    const contrato = await buscarContratoPorToken(token)
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    }

    if (contrato.status === 'assinado') {
      return NextResponse.json(
        {
          error: 'Este contrato já se encontra assinado e finalizado.',
          protocolo: contrato.protocolo,
          documentoFinalHash: contrato.documento_assinado_hash,
        },
        { status: 400 }
      )
    }

    if (contrato.status === 'cancelado') {
      return NextResponse.json({ error: 'Este contrato foi cancelado pela administração.' }, { status: 400 })
    }

    // Validação de segurança: o código OTP deve ter sido validado previamente
    if (!contrato.otp_confirmado_em) {
      return NextResponse.json(
        { error: 'É necessário confirmar o código de segurança enviado para o seu e-mail antes de assinar.' },
        { status: 403 }
      )
    }

    // Captura metadados técnicos de hardware e rede
    const userAgentHeader = request.headers.get('user-agent') || ''
    const rawUa = clientInfoFromBody.userAgent || userAgentHeader
    const parsedUa = parseUserAgent(rawUa)
    const clientIp = extractClientIp(request.headers)

    const finalDevice = clientInfoFromBody.device || parsedUa.device
    const finalOs = (clientInfoFromBody.os && !clientInfoFromBody.os.includes('MacIntel') && clientInfoFromBody.os !== 'MacIntel')
      ? clientInfoFromBody.os
      : parsedUa.os
    const finalBrowser = (clientInfoFromBody.browser && !clientInfoFromBody.browser.includes('Mozilla/'))
      ? clientInfoFromBody.browser
      : parsedUa.browser
    const dataHoraAssinatura = new Date().toISOString()

    // 1. Obtém os bytes do PDF original sob demanda (Lazy Loading)
    const originalPdfBytes = await obterPdfBytes(contrato, 'original')
    if (!originalPdfBytes) {
      return NextResponse.json(
        { error: 'Arquivo PDF original não localizado no registro do contrato.' },
        { status: 500 }
      )
    }

    // 2. Monta URL de validação pública canônica para o QR Code e verificação pericial
    const { getPublicValidationUrl } = await import('@/lib/contracts/cryptoSignature')
    const validationUrl = getPublicValidationUrl(contrato.protocolo)

    // 3. Monta dados para o Certificado Oficial de Evidências
    const supabase = getAdminClient()
    let cfgRep: any = null
    let cfgLogo: string | null = null
    try {
      const { data: cfgRows } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['cfgEscolaRepresentante', 'cfgEscolaLogo'])
      const map = new Map((cfgRows || []).map(r => [r.chave, r.valor]))
      cfgRep = map.get('cfgEscolaRepresentante')
      cfgLogo = map.get('cfgEscolaLogo')
    } catch {}

    const repEscola = contrato.evidencias?.escolaRepresentante || cfgRep || {
      nome: 'IVAN ROSSI SAMBRANA',
      cpf: '00130220167',
      cargo: 'Diretor Geral / Representante Legal',
      razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
      cnpj: '04.395.789/0001-88',
      dataHoraAssinatura: contrato.created_at,
      assinaturaBase64: null,
    }

    // Atualiza dados cadastrais do signatário se preenchidos ou confirmados no ato da assinatura
    if (body.signatario_nome) contrato.responsavel_nome = String(body.signatario_nome).trim()
    if (body.signatario_cpf) contrato.responsavel_cpf = String(body.signatario_cpf).trim()
    if (body.signatario_telefone) contrato.responsavel_telefone = String(body.signatario_telefone).trim()
    if (body.signatario_email) contrato.responsavel_email = String(body.signatario_email).trim()
    if (body.signatario_data_nascimento) contrato.responsavel_data_nascimento = String(body.signatario_data_nascimento).trim()

    const tipoAssinatura = body.tipoAssinatura || (assinaturaBase64 ? 'manual' : 'nome_automatico')

    // Registra evento de assinatura na trilha em memória (elimina roundtrips repetidos)
    adicionarEventoAuditoriaEmMemoria(
      contrato,
      'ASSINATURA_SIGNATARIO',
      `Assinatura eletrônica (${tipoAssinatura === 'nome_automatico' ? 'representação gráfica gerada' : 'manuscrita'}) manifestada por ${contrato.responsavel_nome}`,
      clientIp
    )

    // 4. Anexa a página do Certificado de Evidências com QR Code ao PDF e aplica Assinatura PKCS#7
    const sealedResult = await anexarCertificadoEvidencias({
      originalPdfBytes,
      protocolo: contrato.protocolo,
      documentoTitulo: contrato.titulo_documento,
      documentoOriginalHash: contrato.documento_original_hash,
      alunoNome: contrato.aluno_nome || null,
      alunoCpf: contrato.aluno_cpf || null,
      alunoSerieTurma: `${contrato.aluno_serie || ''} ${contrato.aluno_turma || ''}`.trim() || null,
      anoLetivo: contrato.ano_letivo,
      logoBase64: contrato.evidencias?.logoUrl || cfgLogo || null,
      signatario: {
        nome: contrato.responsavel_nome,
        cpf: contrato.responsavel_cpf,
        dataNascimento: contrato.responsavel_data_nascimento || body.signatario_data_nascimento || null,
        email: contrato.responsavel_email,
        telefone: contrato.responsavel_telefone,
        parentesco: contrato.responsavel_parentesco || 'Responsável Legal / Contratante',
        dataHoraAssinatura,
        metodoAutenticacao: 'CÓDIGO DE USO ÚNICO (OTP)',
        aceiteTexto,
        ip: clientIp,
        dispositivo: finalDevice,
        sistemaOperacional: finalOs,
        navegador: finalBrowser,
        tipoAssinatura,
        assinaturaBase64,
        usuarioAutenticadoApp: Boolean(body.usuarioAutenticadoApp),
      },
      representanteEscola: {
        nome: repEscola.nome,
        cpf: repEscola.cpf,
        cargo: repEscola.cargo,
        razaoSocial: repEscola.razaoSocial,
        cnpj: repEscola.cnpj,
        dataHoraAssinatura: repEscola.dataHoraAssinatura || contrato.created_at,
        assinaturaBase64: repEscola.assinaturaBase64 || null,
      },
      eventosAuditoria: contrato.historico_eventos,
      validationUrl,
      documentosAnexados: contrato.evidencias?.documentosAnexados || null,
    })

    // Salva o PDF assinado no Storage isolado
    const signedPdfBuf = Buffer.from(sealedResult.pdfBytes)
    const assinadoPath = await salvarPdfBytes(contrato.id, 'assinado', signedPdfBuf)

    // Registra evento de documento concluído na trilha
    adicionarEventoAuditoriaEmMemoria(
      contrato,
      'DOCUMENTO_CONCLUIDO',
      `Documento selado com assinatura PKCS#7 corporativa (/Sig e /ByteRange). Hash SHA-256 Final: ${sealedResult.documentoFinalHash.substring(0, 16)}...`,
      clientIp
    )

    // 5. Atualiza o status, higieniza credenciais temporárias e sela o contrato
    contrato.status = 'assinado'
    contrato.documento_assinado_hash = sealedResult.documentoFinalHash
    contrato.trilha_auditoria_hash = sealedResult.trilhaAuditoriaHash
    contrato.documento_assinado_storage_path = assinadoPath
    contrato.documento_assinado_pdf_base64 = null // Mantém o payload da lista leve (~13 KB)
    contrato.otp_codigo_aberto = null // Higienização de segurança pericial: OTP descartado pós-confirmação
    contrato.evidencias = {
      ...contrato.evidencias,
      assinaturaConcluidaEm: dataHoraAssinatura,
      signatarioEvidencias: {
        ip: clientIp,
        dispositivo: finalDevice,
        sistemaOperacional: finalOs,
        navegador: finalBrowser,
        aceiteTexto,
        dataHoraAssinatura,
        assinaturaBase64Presente: Boolean(assinaturaBase64),
      },
      documentoOriginalHash: contrato.documento_original_hash,
      documentoFinalHash: sealedResult.documentoFinalHash,
      trilhaAuditoriaHash: sealedResult.trilhaAuditoriaHash,
    }

    // Único salvamento atômico ultraleve
    await salvarContrato(contrato)

    // 6. Envio oficial da cópia do contrato assinado (devidamente aguardado)
    let emailEnvioResultado: { success: boolean; simulated?: boolean; messageId?: string; error?: string } | null = null
    try {
      emailEnvioResultado = await enviarCopiaContratoAssinadoEmail({
        destinatario: contrato.responsavel_email,
        nomeDestinatario: contrato.responsavel_nome,
        alunoNome: contrato.aluno_nome || 'Estudante',
        protocolo: contrato.protocolo,
        documentoFinalHash: sealedResult.documentoFinalHash,
        validationUrl,
        pdfBuffer: Buffer.from(sealedResult.pdfBytes),
        nomeArquivo: `Contrato_${(contrato.aluno_nome || 'Documento').replace(/\s+/g, '_')}_${contrato.protocolo}.pdf`,
      })
    } catch (err: any) {
      console.warn('[API Assinar] Exceção no envio de cópia por e-mail:', err)
      emailEnvioResultado = { success: false, error: err.message }
    }

    // Registra o evento de entrega de e-mail na trilha de auditoria
    if (emailEnvioResultado?.success) {
      adicionarEventoAuditoriaEmMemoria(
        contrato,
        'ENVIO_COPIA_EMAIL',
        `Via oficial do contrato assinado (PDF) enviada para ${contrato.responsavel_email}${emailEnvioResultado.messageId ? ` (ID: ${emailEnvioResultado.messageId})` : ''}`,
        clientIp
      )
      contrato.evidencias = {
        ...contrato.evidencias,
        emailCopiaEnviado: true,
        emailCopiaEnviadoEm: new Date().toISOString(),
        emailCopiaMessageId: emailEnvioResultado.messageId || null,
        emailCopiaDestinatario: contrato.responsavel_email,
      }
    } else {
      adicionarEventoAuditoriaEmMemoria(
        contrato,
        'FALHA_ENVIO_COPIA_EMAIL',
        `Tentativa de envio da cópia do contrato para ${contrato.responsavel_email} falhou: ${emailEnvioResultado?.error || 'Instabilidade temporária'}`,
        clientIp
      )
      contrato.evidencias = {
        ...contrato.evidencias,
        emailCopiaEnviado: false,
        emailCopiaErro: emailEnvioResultado?.error || 'Instabilidade temporária',
        emailCopiaDestinatario: contrato.responsavel_email,
      }
    }

    // Atualiza o contrato com o evento da trilha de envio de e-mail
    await salvarContrato(contrato)

    return NextResponse.json({
      success: true,
      message: 'Contrato assinado e certificado com sucesso!',
      protocolo: contrato.protocolo,
      documentoOriginalHash: contrato.documento_original_hash,
      documentoFinalHash: sealedResult.documentoFinalHash,
      trilhaAuditoriaHash: sealedResult.trilhaAuditoriaHash,
      validationUrl,
      signedPdfBase64: sealedResult.base64Pdf,
      emailEnviado: emailEnvioResultado?.success ?? false,
      emailDestinatario: contrato.responsavel_email,
      emailErro: emailEnvioResultado?.success ? undefined : emailEnvioResultado?.error,
    })
  } catch (err: any) {
    console.error('[API Assinar] Erro grave:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
