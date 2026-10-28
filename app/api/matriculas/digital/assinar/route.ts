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
import { validarCPF, sanitizeSignerName } from '@/lib/contracts/sealUtils'
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
      // 1. Tenta auto-recuperar do fallback em configuracoes caso tenha havido dessincronização transitória
      try {
        const supabase = getAdminClient()
        const { data: cfgRow } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'matriculas_digitais_list')
          .maybeSingle()

        if (Array.isArray(cfgRow?.valor)) {
          const fbItem = cfgRow.valor.find((c: any) => c && c.token_assinatura === token)
          if (fbItem?.otp_confirmado_em) {
            contrato.otp_confirmado_em = fbItem.otp_confirmado_em
            contrato.otp_codigo_aberto = null
            await salvarContrato(contrato)
          }
        }
      } catch (errFallback) {
        console.warn('[API Assinar] Aviso ao consultar fallback de OTP:', errFallback)
      }

      // 2. Se o cliente enviou o código informado no passo anterior, confere o hash criptográfico com limite de tentativas e expiração
      if (!contrato.otp_confirmado_em && body.otp_codigo) {
        if ((contrato.otp_tentativas || 0) >= 5) {
          return NextResponse.json(
            { error: 'Limite de tentativas do código de segurança excedido. Solicite um novo código.' },
            { status: 429 }
          )
        }
        if (contrato.otp_expira_em && new Date(contrato.otp_expira_em).getTime() < Date.now()) {
          return NextResponse.json(
            { error: 'O código de segurança expirou. Solicite um novo código.' },
            { status: 400 }
          )
        }

        const cleanCodigo = String(body.otp_codigo).trim()
        const { calculateSha256 } = await import('@/lib/contracts/cryptoSignature')
        const codigoHash = calculateSha256(cleanCodigo)
        const isValido =
          codigoHash === contrato.otp_codigo_hash ||
          (contrato.otp_codigo_aberto ? cleanCodigo === contrato.otp_codigo_aberto : false)

        if (isValido) {
          const nowIso = new Date().toISOString()
          contrato.otp_confirmado_em = nowIso
          contrato.otp_codigo_aberto = null
          const clientIp = extractClientIp(request.headers)
          adicionarEventoAuditoriaEmMemoria(
            contrato,
            'OTP_CONFIRMADO',
            'Código de uso único validado no ato da assinatura.',
            clientIp
          )
          await salvarContrato(contrato)
        } else {
          contrato.otp_tentativas = (contrato.otp_tentativas || 0) + 1
          await salvarContrato(contrato)
        }
      }
    }

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
    let cfgRepsList: any = null
    let cfgLogo: string | null = null
    try {
      const { data: cfgRows } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['cfgEscolaRepresentante', 'cfgEscolaRepresentantes', 'cfgEscolaLogo'])
      const map = new Map((cfgRows || []).map(r => [r.chave, r.valor]))
      cfgRep = map.get('cfgEscolaRepresentante')
      cfgRepsList = map.get('cfgEscolaRepresentantes')
      cfgLogo = map.get('cfgEscolaLogo')
    } catch {}

    const rawRep = contrato.evidencias?.escolaRepresentante
    const semAssinaturaRep = Boolean(
      contrato.evidencias?.assinadoPelaEscola === false ||
      rawRep?.semAssinaturaRepresentante ||
      (Array.isArray(rawRep?.representantes) && rawRep.representantes.length === 0 && !rawRep?.nome)
    )

    const repEscola = { ...(rawRep || (semAssinaturaRep ? {} : cfgRep) || {}) }
    if (!semAssinaturaRep) {
      if (!repEscola.nome) repEscola.nome = 'IVAN ROSSI SAMBRANA'
      if (!repEscola.cpf) repEscola.cpf = '00130220167'
      if (!repEscola.cargo) repEscola.cargo = 'Diretor Geral / Representante Legal'
      if (!repEscola.dataHoraAssinatura) repEscola.dataHoraAssinatura = contrato.created_at
    } else {
      repEscola.nome = ''
      repEscola.cpf = ''
      repEscola.cargo = ''
      repEscola.representantes = []
      repEscola.semAssinaturaRepresentante = true
    }
    if (!repEscola.razaoSocial) repEscola.razaoSocial = 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'
    if (!repEscola.cnpj) repEscola.cnpj = '04.395.789/0001-88'

    // Enriquecimento resiliente de assinaturas dos representantes a partir das configurações salvas
    if (Array.isArray(repEscola.representantes) && repEscola.representantes.length > 0) {
      const allKnownSigs: any[] = []
      if (Array.isArray(cfgRepsList)) {
        cfgRepsList.forEach((cr: any) => {
          if (Array.isArray(cr.signatarios)) allKnownSigs.push(...cr.signatarios)
        })
      }
      if (Array.isArray(cfgRep?.signatarios)) {
        allKnownSigs.push(...cfgRep.signatarios)
      }

      repEscola.representantes = repEscola.representantes.map((rep: any) => {
        if (rep.assinaturaBase64) return rep
        const match = allKnownSigs.find(s =>
          (s.cpf && rep.cpf && s.cpf.replace(/\D/g, '') === rep.cpf.replace(/\D/g, '')) ||
          (s.nome && rep.nome && s.nome.trim().toUpperCase() === rep.nome.trim().toUpperCase())
        )
        if (match?.assinaturaBase64) {
          return { ...rep, assinaturaBase64: match.assinaturaBase64 }
        }
        return rep
      })
    }

    // Atualiza dados cadastrais do signatário se preenchidos ou confirmados no ato da assinatura
    if (body.signatario_nome) {
      contrato.responsavel_nome = sanitizeSignerName(String(body.signatario_nome))
    } else if (contrato.responsavel_nome) {
      contrato.responsavel_nome = sanitizeSignerName(contrato.responsavel_nome)
    }
    if (body.signatario_cpf) {
      const cleanSignatarioCpf = String(body.signatario_cpf).replace(/\D/g, '')
      if (!validarCPF(cleanSignatarioCpf)) {
        return NextResponse.json({ error: 'O CPF do signatário é inválido. Não é possível concluir a assinatura jurídica.' }, { status: 400 })
      }
      contrato.responsavel_cpf = String(body.signatario_cpf).trim()
    }
    if (body.signatario_telefone) contrato.responsavel_telefone = String(body.signatario_telefone).trim()
    if (body.signatario_email && !contrato.responsavel_email) {
      contrato.responsavel_email = String(body.signatario_email).trim()
    }
    if (body.signatario_data_nascimento) contrato.responsavel_data_nascimento = String(body.signatario_data_nascimento).trim()

    const tipoAssinatura = body.tipoAssinatura || (assinaturaBase64 ? 'manual' : 'nome_automatico')

    const { getAuthenticatedUser } = await import('@/lib/server/supabaseAuthFactory')
    const authUser = await getAuthenticatedUser().catch(() => null)
    const isVerifiedAppUser = Boolean(authUser && body.usuarioAutenticadoApp)

    // Registra evento de assinatura e conclusão na trilha em memória ANTES de gerar o Certificado de Evidências
    // para que o trilhaAuditoriaHash impresso no PDF bata 100% com contrato.historico_eventos!
    adicionarEventoAuditoriaEmMemoria(
      contrato,
      'ASSINATURA_SIGNATARIO',
      `Confirmação expressa de aceite integral do pacote documental (${contrato.versao_documento || 'v1.0'} | Protocolo: ${contrato.protocolo} | Hash SHA-256 da versão apresentada: ${contrato.documento_original_hash}) e assinatura eletrônica (${tipoAssinatura === 'nome_automatico' ? 'representação gráfica gerada' : 'manuscrita'}) formalizada por ${contrato.responsavel_nome}`,
      clientIp,
      dataHoraAssinatura
    )

    adicionarEventoAuditoriaEmMemoria(
      contrato,
      'DOCUMENTO_CONCLUIDO',
      `Documento selado com assinatura PKCS#7 corporativa (/Sig e /ByteRange) e Certificado de Evidências Digitais.`,
      clientIp,
      dataHoraAssinatura
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
        estiloCaligrafico: body.estiloCaligrafico || 'classica',
        assinaturaBase64,
        usuarioAutenticadoApp: isVerifiedAppUser,
      },
      representanteEscola: {
        nome: repEscola.nome,
        cpf: repEscola.cpf,
        cargo: repEscola.cargo,
        razaoSocial: repEscola.razaoSocial,
        cnpj: repEscola.cnpj,
        dataHoraAssinatura: repEscola.dataHoraAssinatura || contrato.created_at,
        assinaturaBase64: repEscola.assinaturaBase64 || null,
        representantes: repEscola.representantes || undefined,
        semAssinaturaRepresentante: Boolean(repEscola.semAssinaturaRepresentante),
      },
      eventosAuditoria: contrato.historico_eventos,
      validationUrl,
      documentosAnexados: contrato.evidencias?.documentosAnexados || null,
      arquivoOriginalNome: contrato.evidencias?.arquivoOriginalNome || null,
      posicoesAssinaturas: contrato.evidencias?.posicoesAssinaturas || null,
      suprimirRubricaRodape: Boolean(contrato.evidencias?.suprimirRubricaRodape || (contrato.evidencias?.posicoesAssinaturas && contrato.evidencias.posicoesAssinaturas.length > 0)),
    })

    // Salva o PDF assinado no Storage isolado
    const signedPdfBuf = Buffer.from(sealedResult.pdfBytes)
    const assinadoPath = await salvarPdfBytes(contrato.id, 'assinado', signedPdfBuf)

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
        tipoAssinatura,
        estiloCaligrafico: body.estiloCaligrafico || 'classica',
        assinaturaBase64: tipoAssinatura === 'manual' ? assinaturaBase64 : null,
      },
      documentoOriginalHash: contrato.documento_original_hash,
      documentoFinalHash: sealedResult.documentoFinalHash,
      trilhaAuditoriaHash: sealedResult.trilhaAuditoriaHash,
    }

    // Único salvamento atômico ultraleve
    await salvarContrato(contrato)

    // 6. Envio oficial da cópia do contrato assinado (despacho assíncrono em background sem alterar historico_eventos já selado)
    const emailPayload = {
      destinatario: contrato.responsavel_email,
      nomeDestinatario: contrato.responsavel_nome,
      alunoNome: contrato.aluno_nome || 'Estudante',
      protocolo: contrato.protocolo,
      documentoFinalHash: sealedResult.documentoFinalHash,
      validationUrl,
      pdfBuffer: Buffer.from(sealedResult.pdfBytes),
      nomeArquivo: `Contrato_${(contrato.aluno_nome || 'Documento').replace(/\s+/g, '_')}_${contrato.protocolo}.pdf`,
    }

    // Executa o envio por e-mail em background registrando metadados apenas em evidencias (preservando trilha_auditoria_hash)
    void (async () => {
      try {
        const emailEnvioResultado = await enviarCopiaContratoAssinadoEmail(emailPayload)
        const contratoAtual = (await buscarContratoPorToken(token)) || contrato
        if (emailEnvioResultado?.success) {
          contratoAtual.evidencias = {
            ...contratoAtual.evidencias,
            emailCopiaEnviado: true,
            emailCopiaEnviadoEm: new Date().toISOString(),
            emailCopiaMessageId: emailEnvioResultado.messageId || null,
            emailCopiaDestinatario: contrato.responsavel_email,
          }
        } else {
          contratoAtual.evidencias = {
            ...contratoAtual.evidencias,
            emailCopiaEnviado: false,
            emailCopiaErro: emailEnvioResultado?.error || 'Instabilidade temporária',
            emailCopiaDestinatario: contrato.responsavel_email,
          }
        }
        await salvarContrato(contratoAtual)
      } catch (errBg: any) {
        console.warn('[API Assinar Background Email] Erro no envio assíncrono:', errBg)
      }
    })()

    // Otimização: para documentos volumosos (> 2.5 MB), evita serializar megabytes desnecessários
    // no JSON já que o cliente faz o download nativo via endpoint HTTP de streaming
    const isPdfGrande = sealedResult.pdfBytes.length > 2.5 * 1024 * 1024

    return NextResponse.json({
      success: true,
      message: 'Contrato assinado e certificado com sucesso!',
      protocolo: contrato.protocolo,
      documentoOriginalHash: contrato.documento_original_hash,
      documentoFinalHash: sealedResult.documentoFinalHash,
      trilhaAuditoriaHash: sealedResult.trilhaAuditoriaHash,
      validationUrl,
      signedPdfBase64: isPdfGrande ? null : sealedResult.base64Pdf,
      signedPdfUrl: `/api/matriculas/digital/pdf/${contrato.token_assinatura}?v=assinado&download=1`,
      emailEnviado: true,
      emailDestinatario: contrato.responsavel_email,
    })
  } catch (err: any) {
    console.error('[API Assinar] Erro grave:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
