import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buscarContratoPorToken } from '@/lib/server/matriculaDigitalRepository'
import { SigningPortalClient } from './SigningPortalClient'
import { ShieldAlert, Phone } from 'lucide-react'
import { getWhatsAppShareUrl } from '@/lib/whatsapp'

import { PDFDocument } from 'pdf-lib'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const contrato = await buscarContratoPorToken(token)

  return {
    title: contrato
      ? `Assinatura Digital: ${contrato.titulo_documento} | Colégio Impacto`
      : 'Assinatura Eletrônica | Colégio Impacto',
    description: 'Portal oficial de assinatura eletrônica do Colégio Impacto (Impacto EDU).',
    robots: 'noindex, nofollow',
  }
}

export default async function AssinarPage({ params }: Props) {
  const { token } = await params
  const contrato = await buscarContratoPorToken(token)

  if (!contrato) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0f1d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 24,
            padding: '40px 32px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <ShieldAlert size={36} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: '#fff' }}>
            Link Inválido ou Não Localizado
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 28px' }}>
            O documento associado a este endereço de acesso não foi encontrado, pode ter expirado ou foi cancelado pela secretaria escolar.
          </p>

          <a
            href={getWhatsAppShareUrl('5567992806464', 'Olá! Preciso de ajuda para assinar o documento pelo sistema digital.')}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              textDecoration: 'none',
              padding: '14px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <Phone size={16} /> Falar com a Secretaria no WhatsApp
          </a>
        </div>
      </div>
    )
  }

  // Calcula a quantidade de páginas do PDF com suporte a cache de metadados
  const totalPaginas = Number(contrato.totalPaginas) || Number(contrato.evidencias?.totalPaginas) || 1

  // Busca logo customizada se houver
  let cfgLogo: string | null = null
  try {
    const { getAdminClient } = await import('@/lib/server/supabaseAdminSingleton')
    const supabase = getAdminClient()
    const { data: logoRow } = await supabase.from('configuracoes').select('valor').eq('chave', 'cfgEscolaLogo').maybeSingle()
    cfgLogo = logoRow?.valor || null
  } catch {}

  // Prepara dados serializáveis para o client (ultraleve, sem injetar 6MB de Base64 no DOM)
  const contratoData = {
    id: contrato.id,
    protocolo: contrato.protocolo,
    token_assinatura: contrato.token_assinatura,
    titulo_documento: contrato.titulo_documento,
    ano_letivo: contrato.ano_letivo,
    signatario_nome: contrato.responsavel_nome,
    signatario_cpf: contrato.responsavel_cpf || '',
    signatario_data_nascimento: contrato.responsavel_data_nascimento || contrato.evidencias?.signatarioDataNascimento || '',
    signatario_email: contrato.responsavel_email,
    signatario_telefone: contrato.responsavel_telefone || '',
    signatario_cargo: contrato.responsavel_parentesco || 'Signatário',
    aluno_nome: contrato.aluno_nome || null,
    status: contrato.status,
    documento_original_hash: contrato.documento_original_hash,
    documento_assinado_hash: contrato.documento_assinado_hash,
    documento_pdf_base64: null,
    documento_assinado_pdf_base64: null,
    arquivoOriginalNome: contrato.evidencias?.arquivoOriginalNome || `${contrato.titulo_documento}.pdf`,
    formatoOriginal: (
      contrato.evidencias?.formatoOriginal ||
      (contrato.evidencias?.arquivoOriginalNome?.toLowerCase().endsWith('.docx') ? 'docx' :
       contrato.evidencias?.arquivoOriginalNome?.toLowerCase().endsWith('.doc') ? 'doc' : 'pdf')
    ) as 'pdf' | 'docx' | 'doc',
    logoUrl: contrato.evidencias?.logoUrl || cfgLogo || '/logo-impacto-clean.png',
    representanteEscola: contrato.evidencias?.escolaRepresentante || {
      nome: 'IVAN ROSSI SAMBRANA',
      cargo: 'Diretor Geral / Representante Legal',
      razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
      cnpj: '04.395.789/0001-88',
      assinaturaUrl: '/assinatura-representante.png',
    },
    totalPaginas,
    dataCriacao: contrato.created_at,
    dataAssinatura: contrato.evidencias?.assinaturaConcluidaEm || contrato.updated_at,
    trilhaAuditoria: (contrato.historico_eventos || []).map(ev => ({
      timestamp: ev.timestamp,
      evento: ev.evento,
      descricao: (ev.descricao || '')
        .replace(/via código de segurança OTP \(\d+\)/gi, 'via código de uso único')
        .replace(/OTP \(\d+\)/gi, 'OTP')
        .replace(/\b\d{6}\b/g, '******'),
      hash: ev.hash,
    })),
  }

  return <SigningPortalClient contrato={contratoData} />
}

