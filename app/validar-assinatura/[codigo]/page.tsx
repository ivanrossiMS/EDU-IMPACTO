import { Metadata } from 'next'
import {
  buscarContratoPorProtocolo,
  buscarContratoPorToken,
  buscarContratoPorHash,
} from '@/lib/server/matriculaDigitalRepository'
import {
  maskCpf,
  maskEmail,
  maskPhone,
  maskName,
  calculateAuditTrailHash,
} from '@/lib/contracts/cryptoSignature'
import { ValidarAssinaturaClient } from '../ValidarAssinaturaClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ codigo: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params
  const clean = decodeURIComponent(codigo || '').trim()
  return {
    title: `Validação de Documento Oficial ${clean} | Colégio Impacto`,
    description: `Consulte a autenticidade e validade jurídica do documento ${clean} assinado no Sistema Impacto EDU.`,
  }
}

export default async function ValidarCodigoPage({ params }: Props) {
  const { codigo } = await params
  const decoded = decodeURIComponent(codigo || '').trim()

  let contrato = await buscarContratoPorProtocolo(decoded)
  if (!contrato) {
    contrato = await buscarContratoPorToken(decoded)
  }
  if (!contrato) {
    contrato = await buscarContratoPorHash(decoded)
  }

  let initialDossier = null

  if (!contrato) {
    try {
      const { dbGetEmprestimos } = await import('@/lib/credimpacto/db')
      const allLoans = await dbGetEmprestimos()
      const foundLoan = allLoans.find(
        (l) =>
          l.codigoOperacao === decoded ||
          l.codigoVerificacaoAssinatura === decoded ||
          l.contratoHashSha256 === decoded ||
          l.id === decoded
      )
      if (foundLoan) {
        const isAssinado = Boolean(foundLoan.assinadoEm)
        const isCancelado = foundLoan.status === 'cancelado'
        initialDossier = {
          valido: isAssinado && !isCancelado,
          status: foundLoan.status,
          statusDescricao: isAssinado
            ? 'Contrato de Mútuo CredImpacto Assinado e Verificado'
            : isCancelado
            ? 'Empréstimo Cancelado'
            : 'Empréstimo Emitido / Aguardando Assinatura',
          protocolo: foundLoan.codigoOperacao,
          tituloDocumento: 'Contrato de Empréstimo e Desconto em Folha (CredImpacto)',
          anoLetivo: new Date(foundLoan.createdAt).getFullYear().toString(),
          alunoNome: foundLoan.colaboradorNome,
          alunoCpfMascarado: maskCpf(foundLoan.colaboradorCpf),
          alunoSerieTurma: foundLoan.colaboradorCargo || 'Colaborador',
          responsavelNomeMascarado: maskName(foundLoan.colaboradorNome),
          responsavelCpfMascarado: maskCpf(foundLoan.colaboradorCpf),
          responsavelEmailMascarado: maskEmail(foundLoan.colaboradorEmail || ''),
          responsavelTelefoneMascarado: '***',
          responsavelParentesco: 'Colaborador(a) Mutuário(a)',
          dataCriacao: foundLoan.createdAt,
          dataAssinatura: foundLoan.assinadoEm || foundLoan.updatedAt,
          documentoOriginalHash: foundLoan.contratoHashSha256 || 'N/A',
          documentoAssinadoHash: foundLoan.contratoHashSha256 || 'Aguardando Assinatura',
          trilhaAuditoriaHash: foundLoan.contratoHashSha256 || 'N/A',
          logoUrl: '/logo-impacto-clean.png',
          escolaRepresentante: {
            nome: 'COLÉGIO IMPACTO',
            cargo: 'Diretoria / Gestão Financeira',
            razaoSocial: 'COLÉGIO IMPACTO EDUCAÇÃO E CULTURA LTDA',
            cnpj: '04.395.789/0001-88',
          },
          trilhaAuditoria: [
            {
              timestamp: foundLoan.createdAt,
              evento: 'PROPOSTA_CRIADA',
              descricao: `Operação ${foundLoan.codigoOperacao} gerada no valor de R$ ${foundLoan.valorAprovado.toFixed(2)}.`,
              hash: foundLoan.id,
            },
            ...(foundLoan.assinadoEm ? [{
              timestamp: foundLoan.assinadoEm,
              evento: 'ASSINATURA_ELETRONICA_CONFIRMADA',
              descricao: `Assinatura eletrônica realizada via IP ${foundLoan.assinanteIp || 'Servidor'}.`,
              hash: foundLoan.contratoHashSha256 || '',
            }] : [])
          ],
          downloadDisponivel: false,
          pdfBase64: null,
        }
      }
    } catch (e) {}
  }
  if (contrato) {
    const isAssinado = contrato.status === 'assinado'
    const isCancelado = contrato.status === 'cancelado'
    const trilhaHash = contrato.trilha_auditoria_hash || calculateAuditTrailHash(contrato.historico_eventos || [])

    let cfgLogo: string | null = null
    try {
      const { getAdminClient } = await import('@/lib/server/supabaseAdminSingleton')
      const supabase = getAdminClient()
      const { data: logoRow } = await supabase.from('configuracoes').select('valor').eq('chave', 'cfgEscolaLogo').maybeSingle()
      cfgLogo = logoRow?.valor || null
    } catch {}

    const rawRep = contrato.evidencias?.escolaRepresentante
    const posAssinaturas: any[] = Array.isArray(contrato.evidencias?.posicoesAssinaturas)
      ? contrato.evidencias.posicoesAssinaturas
      : []

    const escolaRepresentante = rawRep
      ? {
          nome: rawRep.nome || 'IVAN ROSSI SAMBRANA',
          cargo: rawRep.cargo || 'Representante Legal / Diretor Geral',
          razaoSocial: rawRep.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
          cnpj: rawRep.cnpj || '04.395.789/0001-88',
          estiloCaligrafico: rawRep.estiloCaligrafico || 'classica',
          assinaturaBase64: rawRep.estiloCaligrafico === 'custom' ? rawRep.assinaturaBase64 : null,
          dataHoraAssinatura: rawRep.dataHoraAssinatura || contrato.created_at,
          representantes: Array.isArray(rawRep.representantes)
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

    initialDossier = {
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
      responsavelParentesco: contrato.responsavel_parentesco || 'Responsável Legal / Contratante',
      dataCriacao: contrato.created_at,
      dataAssinatura: contrato.evidencias?.assinaturaConcluidaEm || contrato.updated_at,
      documentoOriginalHash: contrato.documento_original_hash,
      documentoAssinadoHash: contrato.documento_assinado_hash || 'Pendente de finalização',
      trilhaAuditoriaHash: trilhaHash,
      logoUrl: contrato.evidencias?.logoUrl || cfgLogo || '/logo-impacto-clean.png',
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
          hash: ev.hash || '',
        }
      }),
      downloadDisponivel: !isCancelado,
      pdfBase64: null,
    }
  }

  return <ValidarAssinaturaClient initialDossier={initialDossier} initialProtocolo={decoded} />
}
