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
    const escolaRepresentante = rawRep
      ? {
          nome: rawRep.nome || 'IVAN ROSSI SAMBRANA',
          cargo: rawRep.cargo || 'Representante Legal / Diretor Geral',
          razaoSocial: rawRep.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
          cnpj: rawRep.cnpj || '04.395.789/0001-88',
          representantes: Array.isArray(rawRep.representantes)
            ? rawRep.representantes.map((r: any) => ({
                id: r.id,
                nome: r.nome,
                cargo: r.cargo,
                cpf: r.cpf,
              }))
            : undefined,
        }
      : {
          nome: 'IVAN ROSSI SAMBRANA',
          cargo: 'Representante Legal / Diretor Geral',
          razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
          cnpj: '04.395.789/0001-88',
        }

    const rawSigEv = contrato.evidencias?.signatarioEvidencias
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
        return {
          timestamp: ev.timestamp,
          evento: ev.evento,
          descricao: desc,
          hash: ev.hash || '',
        }
      }),
      downloadDisponivel: !isCancelado,
      pdfBase64: null,
    }
  }

  return <ValidarAssinaturaClient initialDossier={initialDossier} initialProtocolo={decoded} />
}
