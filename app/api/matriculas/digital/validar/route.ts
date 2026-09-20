import { NextResponse } from 'next/server'
import {
  buscarContratoPorProtocolo,
  buscarContratoPorToken,
  buscarContratoPorHash,
} from '@/lib/server/matriculaDigitalRepository'
import {
  calculateSha256,
  maskCpf,
  maskEmail,
  maskPhone,
  maskName,
  calculateAuditTrailHash,
} from '@/lib/contracts/cryptoSignature'

export const dynamic = 'force-dynamic'

/**
 * GET /api/matriculas/digital/validar?protocolo=...&hash=...
 * Validação pública pericial de autenticidade, integridade criptográfica e conformidade legal
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const protocolo = url.searchParams.get('protocolo')
    const hash = url.searchParams.get('hash')

    if (!protocolo && !hash) {
      return NextResponse.json(
        { error: 'Informe o código do protocolo ou o hash SHA-256 para validação.' },
        { status: 400 }
      )
    }

    let contrato = null
    if (protocolo) {
      contrato = await buscarContratoPorProtocolo(protocolo, { includePdf: true })
      if (!contrato) {
        contrato = await buscarContratoPorToken(protocolo, { includePdf: true })
      }
    } else if (hash) {
      contrato = await buscarContratoPorHash(hash, { includePdf: true })
    }

    if (!contrato) {
      return NextResponse.json(
        {
          valido: false,
          error: 'Documento não localizado no banco de registros oficiais do Colégio Impacto.',
          mensagem: 'O protocolo ou hash informado não corresponde a nenhum documento assinado emitido pelo sistema.',
        },
        { status: 404 }
      )
    }

    const isAssinado = contrato.status === 'assinado'
    const isCancelado = contrato.status === 'cancelado'

    const trilhaAuditoriaHash =
      contrato.trilha_auditoria_hash ||
      calculateAuditTrailHash(contrato.historico_eventos || [])

    const dossier = {
      valido: isAssinado && !isCancelado,
      status: contrato.status,
      statusDescricao: isAssinado
        ? 'Documento Autêntico e Assinado Eletronicamente'
        : isCancelado
        ? 'Documento Cancelado pela Instituição de Ensino'
        : 'Documento Emitido / Aguardando Assinatura',
      protocolo: contrato.protocolo,
      tituloDocumento: contrato.titulo_documento,
      anoLetivo: contrato.ano_letivo,
      alunoNome: contrato.aluno_nome,
      alunoCpfMascarado: maskCpf(contrato.aluno_cpf),
      alunoSerieTurma: `${contrato.aluno_serie || ''} ${contrato.aluno_turma ? `(${contrato.aluno_turma})` : ''}`.trim(),
      responsavelNomeMascarado: maskName(contrato.responsavel_nome),
      responsavelCpfMascarado: maskCpf(contrato.responsavel_cpf),
      responsavelEmailMascarado: maskEmail(contrato.responsavel_email),
      responsavelTelefoneMascarado: maskPhone(contrato.responsavel_telefone),
      responsavelParentesco: contrato.responsavel_parentesco || 'Responsável Legal',
      dataCriacao: contrato.created_at,
      dataAssinatura: contrato.evidencias?.assinaturaConcluidaEm || contrato.updated_at,
      documentoOriginalHash: contrato.documento_original_hash,
      documentoAssinadoHash: contrato.documento_assinado_hash || 'Pendente de finalização',
      trilhaAuditoriaHash,
      escolaRepresentante: contrato.evidencias?.escolaRepresentante || {
        nome: 'IVAN ROSSI SAMBRANA',
        cargo: 'Representante Legal / Diretor Geral',
        razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
        cnpj: '04.395.789/0001-88',
      },
      metadadosTecnicos: contrato.evidencias?.signatarioEvidencias || null,
      trilhaAuditoria: (contrato.historico_eventos || []).map(ev => {
        let desc = ev.descricao || ''
        if (ev.evento === 'OTP_CONFIRMADO') {
          desc = 'Código de uso único validado com sucesso.'
        } else {
          desc = desc.replace(/via código de segurança OTP \(\d+\)/gi, 'via código de uso único')
                     .replace(/OTP \(\d+\)/gi, 'OTP')
                     .replace(/\b\d{6}\b/g, '******')
        }
        return {
          timestamp: ev.timestamp,
          evento: ev.evento,
          descricao: desc,
          hash: ev.hash,
        }
      }),
      downloadDisponivel: Boolean(contrato.documento_assinado_pdf_base64 || contrato.documento_pdf_base64),
      pdfBase64: isAssinado ? contrato.documento_assinado_pdf_base64 : contrato.documento_pdf_base64,
    }

    return NextResponse.json(dossier)
  } catch (err: any) {
    console.error('[API Validar] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/matriculas/digital/validar
 * Recebe um arquivo PDF em base64 ou hash para verificar se sofreu qualquer modificação
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    let hashParaVerificar = body.hash

    if (body.fileBase64) {
      const buffer = Buffer.from(body.fileBase64.replace(/^data:application\/pdf;base64,/, ''), 'base64')
      hashParaVerificar = calculateSha256(buffer)
    }

    if (!hashParaVerificar) {
      return NextResponse.json({ error: 'Nenhum hash ou arquivo fornecido para conferência.' }, { status: 400 })
    }

    const contrato = await buscarContratoPorHash(hashParaVerificar)

    if (!contrato) {
      return NextResponse.json({
        valido: false,
        inalterado: false,
        hashVerificado: hashParaVerificar,
        mensagem: 'O hash deste arquivo NÃO corresponde a nenhum documento oficial assinado no Colégio Impacto. O arquivo pode ter sido alterado, adulterado ou corrompido.',
      })
    }

    const isMatchFinal = contrato.documento_assinado_hash?.toUpperCase() === hashParaVerificar.toUpperCase()
    const isMatchOriginal = contrato.documento_original_hash?.toUpperCase() === hashParaVerificar.toUpperCase()

    return NextResponse.json({
      valido: true,
      inalterado: isMatchFinal,
      tipoCorrespondencia: isMatchFinal ? 'DOCUMENTO_FINAL_COM_CERTIFICADO' : 'DOCUMENTO_ORIGINAL_PRE_ASSINATURA',
      protocolo: contrato.protocolo,
      alunoNome: contrato.aluno_nome,
      responsavelNomeMascarado: maskName(contrato.responsavel_nome),
      documentoOriginalHash: contrato.documento_original_hash,
      documentoAssinadoHash: contrato.documento_assinado_hash,
      trilhaAuditoriaHash: contrato.trilha_auditoria_hash,
      hashVerificado: hashParaVerificar,
      status: contrato.status,
      mensagem: isMatchFinal
        ? 'AUTENTICIDADE COMPROVADA: Este arquivo é exatamente idêntico ao documento final assinado e selado digitalmente. Não sofreu nenhuma alteração.'
        : 'Arquivo corresponde à versão original do documento antes da conclusão da assinatura e do selo digital.',
    })
  } catch (err: any) {
    console.error('[API Validar POST] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
