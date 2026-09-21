import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  listarContratos,
  salvarContrato,
  cancelarOuExcluirContrato,
  ContratoDigitalModel,
} from '@/lib/server/matriculaDigitalRepository'
import { gerarContratoPdf } from '@/lib/contracts/contractPdfGenerator'
import {
  calculateSha256,
  generateProtocolCode,
  generateSecureToken,
  extractClientIp,
  getAppBaseUrl,
} from '@/lib/contracts/cryptoSignature'
import {
  detectDocumentFormat,
  convertDocumentBufferToPdf,
} from '@/lib/converters/documentToPdfServer'
import { v4 as uuidv4 } from 'uuid'
import { getWhatsAppShareUrl, formatarMensagemWhatsApp } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

/**
 * GET /api/matriculas/digital
 * Lista todos os contratos/documentos com filtros e métricas
 */
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'todos'
    const search = url.searchParams.get('search') || ''
    const ano = url.searchParams.get('ano') || ''

    const result = await listarContratos({ status, search, ano })
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err: any) {
    console.error('[API Matriculas Digital] Erro ao listar:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/matriculas/digital
 * Emite documento de ciência/matrícula ou processa arquivo PDF enviado pela escola
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const clientIp = extractClientIp(request.headers)

    const signatarioNome = (body.signatario_nome || body.responsavel_nome || '').trim()
    const signatarioEmail = (body.signatario_email || body.responsavel_email || '').trim()
    const signatarioCpf = (body.signatario_cpf || body.responsavel_cpf || '').trim()
    const signatarioTelefone = (body.signatario_telefone || body.responsavel_telefone || '').trim()
    const signatarioDataNasc = (body.signatario_data_nascimento || body.responsavel_data_nascimento || '').trim()
    const signatarioCargo = (body.signatario_cargo || body.responsavel_parentesco || 'Signatário').trim()

    if (!signatarioNome) {
      return NextResponse.json({ error: 'O nome do signatário é obrigatório.' }, { status: 400 })
    }
    if (!signatarioEmail) {
      return NextResponse.json({ error: 'O e-mail do signatário é obrigatório para validação.' }, { status: 400 })
    }

    const appUrl = getAppBaseUrl(request)
    const anoLetivo = String(body.ano_letivo || new Date().getFullYear())
    const dataCriacao = new Date().toISOString()
    const repInfo = {
      id: body.escola_representante_id || undefined,
      nome: body.escola_representante_nome || 'IVAN ROSSI SAMBRANA',
      cpf: body.escola_representante_cpf || '00130220167',
      cargo: body.escola_representante_cargo || 'Representante Legal / Diretor Geral',
      razaoSocial: body.escola_razao_social || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
      cnpj: body.escola_cnpj || '04.395.789/0001-88',
      dataHoraAssinatura: dataCriacao,
    }

    // Consulta o template personalizado de WhatsApp configurado para a escola
    let whatsappTemplateCustom: string | null = null
    try {
      const supabase = getAdminClient()
      const { data: cfgRow } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'cfgWhatsAppMatriculaDigital')
        .maybeSingle()
      if (cfgRow?.valor && typeof cfgRow.valor === 'string') {
        whatsappTemplateCustom = cfgRow.valor
      }
    } catch {
      // Fallback gracioso para o template padrão
    }

    // ── MODO SEPARADOS: Emissão de Múltiplos Documentos Individuais em Lote ──
    if (body.modo_envio === 'separados' && Array.isArray(body.documentos) && body.documentos.length > 1) {
      const contratosSalvos: ContratoDigitalModel[] = []
      const itensRetorno: Array<{
        id: string
        protocolo: string
        titulo: string
        arquivoNome: string
        signUrl: string
        validationUrl: string
      }> = []

      for (let idx = 0; idx < body.documentos.length; idx++) {
        const itemDoc = body.documentos[idx]
        const rawItemPayload = itemDoc.pdf_base64 || itemDoc.cleanBase64 || itemDoc.arquivo_base64
        if (!rawItemPayload) continue

        const rawItemClean = String(rawItemPayload).replace(/^data:[^;]+;base64,/, '')
        const itemBytes = Buffer.from(rawItemClean, 'base64')
        if (itemBytes.length < 10) continue

        const itemFormat = detectDocumentFormat(itemBytes)
        const itemNomeOriginal = itemDoc.nome || itemDoc.arquivo_nome || `documento_${idx + 1}`
        let itemPdfBytes = itemBytes
        let itemCleanBase64 = rawItemClean
        let itemTotalPaginas = Number(itemDoc.totalPaginas) || 1

        if (itemFormat === 'docx' || itemFormat === 'doc') {
          const convResult = await convertDocumentBufferToPdf(itemBytes, itemNomeOriginal, {
            title: itemDoc.titulo || itemDoc.titulo_documento,
            schoolName: repInfo.razaoSocial,
          })
          itemPdfBytes = Buffer.from(convResult.pdfBytes)
          itemCleanBase64 = convResult.cleanBase64
          itemTotalPaginas = convResult.totalPages
        } else if (!itemDoc.totalPaginas) {
          try {
            const { PDFDocument } = await import('pdf-lib')
            const loaded = await PDFDocument.load(itemBytes, { ignoreEncryption: true })
            itemTotalPaginas = loaded.getPageCount()
          } catch {}
        }

        const itemId = uuidv4()
        const itemProtocolo = generateProtocolCode(anoLetivo)
        const itemToken = generateSecureToken()
        let itemTitulo = (itemDoc.titulo || itemDoc.titulo_documento || itemNomeOriginal).trim()
        itemTitulo = itemTitulo.replace(/\.(docx?|pdf)$/i, '')

        const itemOriginalHash = calculateSha256(itemPdfBytes)
        const itemEventoHash = calculateSha256(`GENESIS|${itemId}|${dataCriacao}|CRIACAO|${clientIp}`)

        const contratoItem: ContratoDigitalModel = {
          id: itemId,
          protocolo: itemProtocolo,
          token_assinatura: itemToken,
          aluno_id: body.aluno_id ? String(body.aluno_id) : '',
          aluno_nome: body.aluno_nome ? String(body.aluno_nome) : '',
          aluno_cpf: body.aluno_cpf || null,
          aluno_turma: body.aluno_turma || null,
          aluno_serie: body.aluno_serie || null,
          aluno_data_nascimento: body.aluno_data_nascimento || null,
          responsavel_id: body.responsavel_id || null,
          responsavel_nome: signatarioNome,
          responsavel_cpf: signatarioCpf,
          responsavel_data_nascimento: signatarioDataNasc || null,
          responsavel_email: signatarioEmail,
          responsavel_telefone: signatarioTelefone,
          responsavel_parentesco: signatarioCargo,
          ano_letivo: anoLetivo,
          tipo_documento: 'documento_upload',
          titulo_documento: itemTitulo,
          valor_anuidade: 0,
          valor_mensalidade: 0,
          num_parcelas: 0,
          desconto_percent: 0,
          dia_vencimento: 0,
          primeiro_vencimento: null,
          status: 'pendente',
          versao_documento: 'v1.0',
          documento_original_hash: itemOriginalHash,
          documento_pdf_base64: itemCleanBase64,
          otp_tentativas: 0,
          evidencias: {
            criadoPor: user?.email || 'Administração Escolar',
            ipCriacao: clientIp,
            assinadoPelaEscola: true,
            arquivoOriginalNome: itemNomeOriginal,
            formatoOriginal: itemFormat,
            tamanhoBytes: itemPdfBytes.length,
            totalPaginas: itemTotalPaginas,
            isUploadProprio: true,
            emissaoEmLote: true,
            loteIndice: idx + 1,
            loteTotal: body.documentos.length,
            autorizacoesExigidas: body.autorizacoes_exigidas || [],
            escolaRepresentante: repInfo,
          },
          historico_eventos: [
            {
              id: `ev-init-${Date.now()}-${idx}`,
              timestamp: dataCriacao,
              evento: 'CRIACAO',
              descricao: `Documento [${idx + 1}/${body.documentos.length}] emitido no sistema por ${user?.email || 'Administração Escolar'}`,
              ip: clientIp,
              hash: itemEventoHash,
            },
            {
              id: `ev-sch-${Date.now()}-${idx}`,
              timestamp: dataCriacao,
              evento: 'ASSINATURA_ESCOLA',
              descricao: `Chancela institucional emitida por ${repInfo.nome} (${repInfo.cargo})`,
              ip: clientIp,
              hash: calculateSha256(`${itemEventoHash}|ASSINATURA_ESCOLA|${dataCriacao}|${clientIp}`),
            },
          ],
          created_at: dataCriacao,
          updated_at: dataCriacao,
        }

        const salvo = await salvarContrato(contratoItem)
        contratosSalvos.push(salvo)

        const itemSignUrl = `${appUrl}/assinar/${itemToken}`
        const itemValUrl = `${appUrl}/validar-assinatura/${itemProtocolo}`

        itensRetorno.push({
          id: itemId,
          protocolo: itemProtocolo,
          titulo: itemTitulo,
          arquivoNome: itemNomeOriginal,
          signUrl: itemSignUrl,
          validationUrl: itemValUrl,
        })
      }

      if (contratosSalvos.length === 0) {
        return NextResponse.json({ error: 'Nenhum dos documentos enviados pôde ser processado com sucesso.' }, { status: 400 })
      }

      let listaDocsTexto = ''
      itensRetorno.forEach((it, i) => {
        listaDocsTexto += `📄 *${i + 1}. ${it.titulo}*\n✍️ Link: ${it.signUrl}\n\n`
      })
      listaDocsTexto = listaDocsTexto.trim()

      const whatsappText = formatarMensagemWhatsApp(whatsappTemplateCustom, {
        responsavel: signatarioNome,
        documento: `${contratosSalvos.length} documentos`,
        aluno: body.aluno_nome,
        ano: String(body.ano_letivo || new Date().getFullYear()),
        link_assinatura: itensRetorno[0]?.signUrl,
        lista_documentos: listaDocsTexto,
        email: signatarioEmail,
        escola: repInfo.razaoSocial?.includes('IMPACTO') ? 'Colégio Impacto' : repInfo.razaoSocial,
        protocolo: itensRetorno[0]?.protocolo,
      })

      return NextResponse.json({
        success: true,
        modo_envio: 'separados',
        total: contratosSalvos.length,
        contratos: contratosSalvos,
        itens: itensRetorno,
        contrato: contratosSalvos[0],
        signUrl: itensRetorno[0]?.signUrl,
        validationUrl: itensRetorno[0]?.validationUrl,
        whatsappText,
        whatsappShareUrl: getWhatsAppShareUrl(signatarioTelefone, whatsappText),
      })
    }

    // ── MODO PADRÃO / UNIFICADO (Envelope Único com 1 ou mais arquivos integrados) ──
    const rawPayload = body.pdf_base64 || body.arquivo_base64
    if (!rawPayload) {
      return NextResponse.json(
        { error: 'Por favor, selecione ou faça o upload de um arquivo PDF ou Word (.docx/.doc) para assinatura.' },
        { status: 400 }
      )
    }

    const rawClean = String(rawPayload).replace(/^data:[^;]+;base64,/, '')
    const inputBytes = Buffer.from(rawClean, 'base64')

    if (inputBytes.length < 10) {
      return NextResponse.json(
        { error: 'O arquivo enviado parece corrompido ou vazio.' },
        { status: 400 }
      )
    }

    // Identifica o formato real dos bytes
    const inputFormat = detectDocumentFormat(inputBytes)
    const arquivoNomeOriginal = body.arquivo_nome || 'documento'
    let pdfBytes = inputBytes
    let cleanBase64 = rawClean
    let totalPaginas = Number(body.total_paginas) || 1

    // Se o arquivo enviado for Word (.docx ou .doc), converte automaticamente para PDF fiel com timbrado e imagens
    if (inputFormat === 'docx' || inputFormat === 'doc') {
      const convResult = await convertDocumentBufferToPdf(inputBytes, arquivoNomeOriginal, {
        title: body.titulo_documento,
        schoolName: repInfo.razaoSocial,
      })
      pdfBytes = Buffer.from(convResult.pdfBytes)
      cleanBase64 = convResult.cleanBase64
      totalPaginas = convResult.totalPages
    } else if (!body.total_paginas) {
      try {
        const { PDFDocument } = await import('pdf-lib')
        const loaded = await PDFDocument.load(inputBytes, { ignoreEncryption: true })
        totalPaginas = loaded.getPageCount()
      } catch {}
    }

    const protocolo = generateProtocolCode(anoLetivo)
    const tokenAssinatura = generateSecureToken()
    const id = body.id || uuidv4()

    let tituloDoc = (body.titulo_documento || body.arquivo_nome || 'Documento para Assinatura').trim()
    tituloDoc = tituloDoc.replace(/\.(docx?|pdf)$/i, '')

    // 2. Calcula o Hash SHA-256 do arquivo original consolidado
    const docOriginalHash = calculateSha256(pdfBytes)

    // 3. Monta o histórico inicial de eventos (auditoria)
    const eventoCriacaoHash = calculateSha256(`GENESIS|${id}|${dataCriacao}|CRIACAO|${clientIp}`)

    const documentosAnexados = Array.isArray(body.documentos_anexados) && body.documentos_anexados.length > 0
      ? body.documentos_anexados
      : null

    const totalArquivos = documentosAnexados ? documentosAnexados.length : 1
    const descricaoCriacao = totalArquivos > 1
      ? `Pacote unificado contendo ${totalArquivos} documentos emitido no sistema por ${user?.email || 'Administração Escolar'}`
      : `Documento emitido no sistema por ${user?.email || 'Administração Escolar'}`

    const novoContrato: ContratoDigitalModel = {
      id,
      protocolo,
      token_assinatura: tokenAssinatura,
      aluno_id: body.aluno_id ? String(body.aluno_id) : '',
      aluno_nome: body.aluno_nome ? String(body.aluno_nome) : '',
      aluno_cpf: body.aluno_cpf || null,
      aluno_turma: body.aluno_turma || null,
      aluno_serie: body.aluno_serie || null,
      aluno_data_nascimento: body.aluno_data_nascimento || null,
      responsavel_id: body.responsavel_id || null,
      responsavel_nome: signatarioNome,
      responsavel_cpf: signatarioCpf,
      responsavel_data_nascimento: signatarioDataNasc || null,
      responsavel_email: signatarioEmail,
      responsavel_telefone: signatarioTelefone,
      responsavel_parentesco: signatarioCargo,
      ano_letivo: anoLetivo,
      tipo_documento: 'documento_upload',
      titulo_documento: tituloDoc,
      valor_anuidade: 0,
      valor_mensalidade: 0,
      num_parcelas: 0,
      desconto_percent: 0,
      dia_vencimento: 0,
      primeiro_vencimento: null,
      status: 'pendente',
      versao_documento: 'v1.0',
      documento_original_hash: docOriginalHash,
      documento_pdf_base64: cleanBase64,
      otp_tentativas: 0,
      evidencias: {
        criadoPor: user?.email || 'Administração Escolar',
        ipCriacao: clientIp,
        assinadoPelaEscola: true,
        arquivoOriginalNome: arquivoNomeOriginal,
        formatoOriginal: inputFormat,
        tamanhoBytes: pdfBytes.length,
        totalPaginas,
        isUploadProprio: Boolean(body.pdf_base64 || body.arquivo_base64),
        totalDocumentos: totalArquivos,
        documentosAnexados: documentosAnexados || undefined,
        modoEnvio: totalArquivos > 1 ? 'unificado' : 'individual',
        autorizacoesExigidas: body.autorizacoes_exigidas || [],
        escolaRepresentante: repInfo,
      },
      historico_eventos: [
        {
          id: `ev-init-${Date.now()}`,
          timestamp: dataCriacao,
          evento: 'CRIACAO',
          descricao: descricaoCriacao,
          ip: clientIp,
          hash: eventoCriacaoHash,
        },
        {
          id: `ev-sch-${Date.now()}`,
          timestamp: dataCriacao,
          evento: 'ASSINATURA_ESCOLA',
          descricao: `Chancela institucional emitida por ${repInfo.nome} (${repInfo.cargo})`,
          ip: clientIp,
          hash: calculateSha256(`${eventoCriacaoHash}|ASSINATURA_ESCOLA|${dataCriacao}|${clientIp}`),
        },
      ],
      created_at: dataCriacao,
      updated_at: dataCriacao,
    }

    const salvo = await salvarContrato(novoContrato)

    // Constrói o link de assinatura e mensagem WhatsApp
    const signUrl = `${appUrl}/assinar/${tokenAssinatura}`
    const validationUrl = `${appUrl}/validar-assinatura/${protocolo}`

    const docDesc = totalArquivos > 1 ? `${tituloDoc} (${totalArquivos} anexos)` : tituloDoc
    const whatsappText = formatarMensagemWhatsApp(whatsappTemplateCustom, {
      responsavel: signatarioNome,
      documento: docDesc,
      aluno: body.aluno_nome,
      ano: String(body.ano_letivo || new Date().getFullYear()),
      link_assinatura: signUrl,
      email: signatarioEmail,
      escola: repInfo.razaoSocial?.includes('IMPACTO') ? 'Colégio Impacto' : repInfo.razaoSocial,
      protocolo: protocolo,
    })

    return NextResponse.json({
      success: true,
      modo_envio: 'unificado',
      contrato: salvo,
      totalDocumentos: totalArquivos,
      signUrl,
      validationUrl,
      whatsappText,
      whatsappShareUrl: getWhatsAppShareUrl(signatarioTelefone, whatsappText),
    })
  } catch (err: any) {
    console.error('[API Matriculas Digital] Erro ao criar documento:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/matriculas/digital?id=...&tipo=cancelar|excluir
 */
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const tipo = (url.searchParams.get('tipo') as 'cancelar' | 'excluir') || 'excluir'
    const motivo = url.searchParams.get('motivo') || ''

    if (!id) {
      return NextResponse.json({ error: 'ID do contrato é obrigatório' }, { status: 400 })
    }

    await cancelarOuExcluirContrato(id, tipo, motivo)
    return NextResponse.json({ success: true, message: `Documento ${tipo === 'excluir' ? 'excluído' : 'cancelado'} com sucesso.` })
  } catch (err: any) {
    console.error('[API Matriculas Digital] Erro ao deletar:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
