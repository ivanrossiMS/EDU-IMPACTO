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

  let contrato = await buscarContratoPorProtocolo(decoded, { includePdf: true })
  if (!contrato) {
    contrato = await buscarContratoPorToken(decoded, { includePdf: true })
  }
  if (!contrato) {
    contrato = await buscarContratoPorHash(decoded, { includePdf: true })
  }

  let initialDossier = null
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
      escolaRepresentante: contrato.evidencias?.escolaRepresentante || {
        nome: 'IVAN ROSSI SAMBRANA',
        cargo: 'Representante Legal / Diretor Geral',
        razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
        cnpj: '04.395.789/0001-88',
      },
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
      downloadDisponivel: Boolean(contrato.documento_assinado_pdf_base64 || contrato.documento_pdf_base64),
      pdfBase64: isAssinado ? contrato.documento_assinado_pdf_base64 : contrato.documento_pdf_base64,
    }
  }

  return <ValidarAssinaturaClient initialDossier={initialDossier} initialProtocolo={decoded} />
}
