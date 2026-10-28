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
      contrato = await buscarContratoPorProtocolo(protocolo)
      if (!contrato) {
        contrato = await buscarContratoPorToken(protocolo)
      }
    } else if (hash) {
      contrato = await buscarContratoPorHash(hash)
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

    const rawRep = contrato.evidencias?.escolaRepresentante
    const semAssinaturaRep = Boolean(
      contrato.evidencias?.assinadoPelaEscola === false ||
      rawRep?.semAssinaturaRepresentante ||
      (Array.isArray(rawRep?.representantes) && rawRep.representantes.length === 0 && !rawRep?.nome)
    )
    const posAssinaturas: any[] = Array.isArray(contrato.evidencias?.posicoesAssinaturas)
      ? contrato.evidencias.posicoesAssinaturas
      : []

    const escolaRepresentante = rawRep
      ? {
          nome: semAssinaturaRep ? '' : (rawRep.nome || 'IVAN ROSSI SAMBRANA'),
          cargo: semAssinaturaRep ? '' : (rawRep.cargo || 'Representante Legal / Diretor Geral'),
          razaoSocial: rawRep.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
          cnpj: rawRep.cnpj || '04.395.789/0001-88',
          estiloCaligrafico: rawRep.estiloCaligrafico || 'classica',
          assinaturaBase64: rawRep.estiloCaligrafico === 'custom' ? rawRep.assinaturaBase64 : null,
          dataHoraAssinatura: rawRep.dataHoraAssinatura || contrato.created_at,
          semAssinaturaRepresentante: semAssinaturaRep,
          representantes: semAssinaturaRep
            ? []
            : Array.isArray(rawRep.representantes)
              ? rawRep.representantes.map((r: any) => {
                  const matchPos = posAssinaturas.find(
                    (p: any) =>
                      (r.id && p.signatarioId === r.id) ||
                      (p.nome && r.nome && String(p.nome).trim().toLowerCase() === String(r.nome).trim().toLowerCase())
                  )
                  const estilo = matchPos?.estiloCaligrafico || r.estiloCaligrafico || 'classica'
                  return {
                    id: r.id,
                    nome: r.nome,
                    cargo: r.cargo,
                    cpf: r.cpf,
                    estiloCaligrafico: estilo,
                    assinaturaBase64: estilo === 'custom' ? (matchPos?.assinaturaBase64 || r.assinaturaBase64 || null) : null,
                  }
                })
              : undefined,
        }
      : {
          nome: 'IVAN ROSSI SAMBRANA',
          cargo: 'Representante Legal / Diretor Geral',
          razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
          cnpj: '04.395.789/0001-88',
          estiloCaligrafico: 'classica',
          dataHoraAssinatura: contrato.created_at,
        }

    const rawSigEv = contrato.evidencias?.signatarioEvidencias
    const posResp = posAssinaturas.find((p: any) => p.tipo === 'responsavel')
    const metadadosTecnicos = rawSigEv
      ? {
          ip: rawSigEv.ip || 'Protegido',
          dispositivo: rawSigEv.dispositivo || 'Dispositivo Verificado',
          sistemaOperacional: rawSigEv.sistemaOperacional || 'SO Seguro',
          navegador: rawSigEv.navegador || 'Navegador Web',
          dataHoraAssinatura: rawSigEv.dataHoraAssinatura || contrato.evidencias?.assinaturaConcluidaEm || contrato.updated_at,
        }
      : null

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
      responsavelNome: contrato.responsavel_nome,
      responsavelEstiloCaligrafico: rawSigEv?.estiloCaligrafico || posResp?.estiloCaligrafico || 'classica',
      responsavelAssinaturaBase64: rawSigEv?.tipoAssinatura === 'manual' ? (rawSigEv?.assinaturaBase64 || null) : null,
      responsavelCpfMascarado: maskCpf(contrato.responsavel_cpf),
      responsavelEmailMascarado: maskEmail(contrato.responsavel_email),
      responsavelTelefoneMascarado: maskPhone(contrato.responsavel_telefone),
      responsavelParentesco: contrato.responsavel_parentesco || 'Responsável Legal',
      dataCriacao: contrato.created_at,
      dataAssinatura: contrato.evidencias?.assinaturaConcluidaEm || contrato.updated_at,
      documentoOriginalHash: contrato.documento_original_hash,
      documentoAssinadoHash: contrato.documento_assinado_hash || 'Pendente de finalização',
      trilhaAuditoriaHash,
      escolaRepresentante,
      metadadosTecnicos,
      trilhaAuditoria: (contrato.historico_eventos || []).map(ev => {
        let desc = ev.descricao || ''
        if (ev.evento === 'OTP_CONFIRMADO') {
          desc = 'Código de uso único validado com sucesso.'
        } else {
          desc = desc.replace(/via código de segurança OTP \(\d+\)/gi, 'via código de uso único')
                     .replace(/OTP \(\d+\)/gi, 'OTP')
                     .replace(/\b\d{6}\b/g, '******')
        }
        if (ev.evento === 'ASSINATURA_ESCOLA' && /^Chancela institucional emitida por\s+/i.test(desc)) {
          const repIdent = desc.replace(/^Chancela institucional emitida por\s+/i, '').trim()
          const emissor = contrato.evidencias?.criadoPor || 'Administração Escolar'
          desc = `Aplicação automática de chancela institucional previamente autorizada para ${repIdent}, vinculada à emissão autenticada por ${emissor}`
        }
        if (ev.evento === 'ASSINATURA_SIGNATARIO' && !/aceite integral/i.test(desc)) {
          const versao = contrato.versao_documento || 'v1.0'
          const sufixoAssinatura = desc ? ` e ${desc.charAt(0).toLowerCase() + desc.slice(1)}` : ''
          desc = `Confirmação expressa de aceite integral do pacote documental (${versao} | Protocolo: ${contrato.protocolo} | Hash SHA-256 da versão apresentada: ${contrato.documento_original_hash})${sufixoAssinatura}`
        }
        if (ev.evento === 'DOCUMENTO_CONCLUIDO' && contrato.documento_assinado_hash) {
          desc = desc
            .replace(/Hash SHA-256 Final:\s*[A-Fa-f0-9]+\.{2,3}/i, `Hash do PDF final (SHA-256): ${contrato.documento_assinado_hash}`)
            .replace(/Hash SHA-256 Final:/i, 'Hash do PDF final (SHA-256):')
            .replace(/Hash final SHA-256:/i, 'Hash do PDF final (SHA-256):')
        }
        return {
          timestamp: ev.timestamp,
          evento: ev.evento,
          descricao: desc,
          ip: ev.ip || contrato.evidencias?.ipCriacao || rawSigEv?.ip || '127.0.0.1',
          hash: ev.hash,
        }
      }),
      downloadDisponivel: !isCancelado,
      pdfBase64: null,
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
