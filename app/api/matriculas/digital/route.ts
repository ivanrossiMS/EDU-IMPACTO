import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
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
import { getWhatsAppShareUrl } from '@/lib/whatsapp'

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
    let totalPaginas = 1

    // Se o arquivo enviado for Word (.docx ou .doc), converte automaticamente para PDF fiel com timbrado e imagens
    if (inputFormat === 'docx' || inputFormat === 'doc') {
      const convResult = await convertDocumentBufferToPdf(inputBytes, arquivoNomeOriginal, {
        title: body.titulo_documento,
        schoolName: body.escola_razao_social || 'COLÉGIO IMPACTO',
      })
      pdfBytes = Buffer.from(convResult.pdfBytes)
      cleanBase64 = convResult.cleanBase64
      totalPaginas = convResult.totalPages
    } else {
      try {
        const { PDFDocument } = await import('pdf-lib')
        const loaded = await PDFDocument.load(inputBytes, { ignoreEncryption: true })
        totalPaginas = loaded.getPageCount()
      } catch {}
    }

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

    const anoLetivo = String(body.ano_letivo || new Date().getFullYear())
    const protocolo = generateProtocolCode(anoLetivo)
    const tokenAssinatura = generateSecureToken()
    const id = body.id || uuidv4()

    let tituloDoc = (body.titulo_documento || body.arquivo_nome || 'Documento para Assinatura').trim()
    tituloDoc = tituloDoc.replace(/\.(docx?|pdf)$/i, '')

    // 2. Calcula o Hash SHA-256 do arquivo original
    const docOriginalHash = calculateSha256(pdfBytes)

    // 3. Monta o histórico inicial de eventos (auditoria)
    const dataCriacao = new Date().toISOString()
    const eventoCriacaoHash = calculateSha256(`GENESIS|${id}|${dataCriacao}|CRIACAO|${clientIp}`)

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
        autorizacoesExigidas: body.autorizacoes_exigidas || [],
        escolaRepresentante: {
          id: body.escola_representante_id || undefined,
          nome: body.escola_representante_nome || 'IVAN ROSSI SAMBRANA',
          cpf: body.escola_representante_cpf || '00130220167',
          cargo: body.escola_representante_cargo || 'Representante Legal / Diretor Geral',
          razaoSocial: body.escola_razao_social || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
          cnpj: body.escola_cnpj || '04.395.789/0001-88',
          dataHoraAssinatura: dataCriacao,
        },
      },
      historico_eventos: [
        {
          id: `ev-init-${Date.now()}`,
          timestamp: dataCriacao,
          evento: 'CRIACAO',
          descricao: `Documento emitido no sistema por ${user?.email || 'Administração Escolar'}`,
          ip: clientIp,
          hash: eventoCriacaoHash,
        },
        {
          id: `ev-sch-${Date.now()}`,
          timestamp: dataCriacao,
          evento: 'ASSINATURA_ESCOLA',
          descricao: `Chancela institucional emitida por ${body.escola_representante_nome || 'IVAN ROSSI SAMBRANA'} (${body.escola_representante_cargo || 'Diretor Geral'})`,
          ip: clientIp,
          hash: calculateSha256(`${eventoCriacaoHash}|ASSINATURA_ESCOLA|${dataCriacao}|${clientIp}`),
        },
      ],
      created_at: dataCriacao,
      updated_at: dataCriacao,
    }

    const salvo = await salvarContrato(novoContrato)

    // Constrói o link de assinatura e mensagem WhatsApp
    const appUrl = getAppBaseUrl(request)
    const signUrl = `${appUrl}/assinar/${tokenAssinatura}`
    const validationUrl = `${appUrl}/validar-assinatura/${protocolo}`

    const alunoRef = body.aluno_nome ? ` referente ao(à) estudante *${body.aluno_nome}*` : ''
    const whatsappText = `Olá, ${signatarioNome}! 💙\nO Colégio Impacto disponibilizou o documento *${tituloDoc}*${alunoRef} para sua ciência e assinatura digital.\n\n✍️ *Acesse com segurança pelo link oficial:*\n${signUrl}\n\nAo acessar, você confirmará um código de segurança enviado para o seu e-mail (${signatarioEmail || 'cadastrado'}). Agradecemos pela confiança na nossa escola!`

    return NextResponse.json({
      success: true,
      contrato: salvo,
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
