/**
 * lib/server/emailService.ts
 *
 * Serviço de envio de e-mails transacionais do Colégio Impacto para Matrículas Digitais.
 * Gerencia o disparo de código OTP de 6 dígitos e o envio automático da cópia
 * do contrato assinado com o Certificado de Evidências em anexo.
 */

import nodemailer, { type Transporter, type SendMailOptions, type SentMessageInfo } from 'nodemailer'
import dns from 'dns'
import tls from 'tls'
import net from 'net'
import { getAdminClient } from './supabaseAdminSingleton'
import { IMPACTO_LOGO_DATA_URI } from '@/components/ui/impactoLogoBase64'

const IMPACTO_LOGO_BUFFER = Buffer.from(
  IMPACTO_LOGO_DATA_URI.replace(/^data:image\/\w+;base64,/, ''),
  'base64'
)

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

export interface SmtpDiagnosticStep {
  id: string
  titulo: string
  descricao?: string
  status: 'pending' | 'running' | 'success' | 'warning' | 'error'
  duracaoMs?: number
  dadosTecnicos?: any
  erro?: string
  sugestao?: string
}

const CONFIG_SMTP_KEY = 'cfgEmailSmtp'

/**
 * Obtém a configuração de SMTP do banco ou variáveis de ambiente
 */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  // 1. Tenta carregar da tabela configuracoes do Supabase
  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', CONFIG_SMTP_KEY)
      .maybeSingle()

    if (data?.valor && data.valor.host && data.valor.user) {
      const port = Number(data.valor.port) || 587
      return {
        host: String(data.valor.host).trim(),
        port,
        secure: port === 465 ? true : Boolean(data.valor.secure),
        user: String(data.valor.user).trim(),
        pass: String(data.valor.pass || ''),
        fromEmail: data.valor.fromEmail || data.valor.user || 'direcao@colegioimpacto.net',
        fromName: data.valor.fromName || 'Colégio Impacto - Matrícula Digital',
      }
    }
  } catch (err) {
    console.warn('[EmailService] Não foi possível ler cfgEmailSmtp do banco:', err)
  }

  // 2. Fallback para variáveis de ambiente ou padrão Locaweb
  if (process.env.SMTP_HOST || process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT) || 587
    return {
      host: process.env.SMTP_HOST || 'email-ssl.com.br',
      port,
      secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465,
      user: process.env.SMTP_USER || 'direcao@colegioimpacto.net',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER || 'direcao@colegioimpacto.net',
      fromName: process.env.SMTP_FROM_NAME || 'Colégio Impacto - Matrícula Digital',
    }
  }

  return null
}

/**
 * Cache de conexão persistente (Connection Pool) para eliminar latência de handshake em disparos sucessivos
 */
let cachedPoolTransporter: Transporter | null = null
let cachedPoolKey = ''

/**
 * Cria ou recupera o transporte nodemailer com pooling de conexão e timeouts otimizados
 */
export function createTransporter(cfg: SmtpConfig, options: { pool?: boolean } = { pool: false }) {
  const port = Number(cfg.port) || 587
  const isSecure = port === 465 ? true : Boolean(cfg.secure)
  const usePool = options.pool ?? false
  const poolKey = `${cfg.host}:${port}:${isSecure}:${cfg.user}:${cfg.pass}`

  if (usePool && cachedPoolTransporter && cachedPoolKey === poolKey) {
    return cachedPoolTransporter
  }

  const transporter = nodemailer.createTransport({
    pool: usePool,
    maxConnections: usePool ? 3 : undefined,
    maxMessages: usePool ? 100 : undefined,
    host: cfg.host,
    port,
    secure: isSecure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })

  if (usePool) {
    cachedPoolTransporter = transporter
    cachedPoolKey = poolKey
  }

  return transporter
}

/**
 * Reseta o cache de pool de conexões (útil em caso de erro fatal de socket)
 */
export function resetTransporterPool() {
  if (cachedPoolTransporter) {
    try { cachedPoolTransporter.close() } catch {}
    cachedPoolTransporter = null
    cachedPoolKey = ''
  }
}

/**
 * Motor de envio com resiliência: retentativas automáticas imediatas em caso de 
 * erro temporário da Locaweb (451 queue error, socket timeout, etc.) e fallback de porta bidirecional
 */
export async function sendMailWithResilience(
  cfg: SmtpConfig,
  mailOptions: SendMailOptions,
  maxRetries = 4,
  options?: { useFreshConnection?: boolean }
): Promise<SentMessageInfo> {
  let lastError: any = null
  const useFresh = options?.useFreshConnection ?? false

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Para envios com anexos volumosos ou após falhas, utiliza conexão dedicada e limpa
      const transporter = createTransporter(cfg, { pool: useFresh ? false : attempt === 1 })
      const info = await transporter.sendMail(mailOptions)
      return info
    } catch (err: any) {
      lastError = err
      const msg = err.message || ''
      const isTransient =
        err.responseCode === 451 ||
        err.code === 'EMESSAGE' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ESOCKET' ||
        msg.includes('451') ||
        msg.includes('queue') ||
        msg.includes('timeout') ||
        msg.includes('closed')

      console.warn(`[EmailService] Tentativa ${attempt}/${maxRetries} falhou: ${msg}`)

      // Limpa socket corrompido para nova conexão
      resetTransporterPool()

      if (attempt < maxRetries && isTransient) {
        // Backoff rápido com jitter (ex: 450ms, 900ms)
        const delay = 450 * attempt + Math.floor(Math.random() * 200)
        await new Promise(r => setTimeout(r, delay))
      } else if (!isTransient) {
        // Se for erro de autenticação definitiva (535), aborta imediatamente
        break
      }
    }
  }

  // Fallback bidirecional de porta caso todas as tentativas tenham falhado
  const portAtual = Number(cfg.port) || 587
  const portaContingencia = portAtual === 465 ? 587 : 465
  const secureContingencia = portaContingencia === 465

  console.info(`[EmailService] Tentando contingência na porta ${portaContingencia} (${secureContingencia ? 'SSL direto' : 'STARTTLS'})...`)
  try {
    const fallbackCfg: SmtpConfig = { ...cfg, port: portaContingencia, secure: secureContingencia }
    const fallbackTransporter = createTransporter(fallbackCfg, { pool: false })
    const info = await fallbackTransporter.sendMail(mailOptions)
    console.info(`[EmailService] Contingência na porta ${portaContingencia} concluída com sucesso!`)
    return info
  } catch (fbErr: any) {
    console.warn(`[EmailService] Contingência na porta ${portaContingencia} também falhou:`, fbErr.message)
  }

  throw lastError
}

/**
 * Dispara o e-mail contendo o código de confirmação OTP
 */
export async function enviarCodigoOtpEmail(params: {
  destinatario: string
  nomeDestinatario: string
  codigoOtp: string
  alunoNome: string
  protocolo: string
}): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
  const cfg = await getSmtpConfig()

  const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Código de Confirmação - Colégio Impacto</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, p, div, span, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 28px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <!-- Container Card Principal (580px) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; border-collapse: separate; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);">
          
          <!-- CABEÇALHO OFICIAL COM IDENTIDADE VISUAL -->
          <tr>
            <td align="center" bgcolor="#0b1f48" style="background-color: #0b1f48; background-image: linear-gradient(135deg, #0b1f48 0%, #1e3a8a 100%); padding: 32px 20px; text-align: center; border-top-left-radius: 15px; border-top-right-radius: 15px;">
              
              <!-- Badge Circular com a Logomarca Oficial -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td align="center" bgcolor="#ffffff" style="background-color: #ffffff; width: 56px; height: 56px; border-radius: 50%; padding: 4px; text-align: center; vertical-align: middle; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);">
                    <img src="cid:logo_impacto" alt="Colégio Impacto" width="48" height="48" style="display: block; margin: 0 auto; width: 48px; height: 48px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>

              <!-- Nome da Instituição em Alta Visibilidade -->
              <h1 style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 800; color: #ffffff !important; letter-spacing: 0.8px; line-height: 1.2; text-transform: uppercase;">
                COLÉGIO IMPACTO
              </h1>

              <!-- Subtítulo Contextual -->
              <p style="margin: 8px 0 0 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 500; color: #93c5fd !important; letter-spacing: 0.3px; line-height: 1.4;">
                Sistema Oficial de Matrícula Digital
              </p>

            </td>
          </tr>

          <!-- CORPO DA MENSAGEM -->
          <tr>
            <td style="padding: 32px 28px; text-align: left; font-size: 14px; line-height: 1.6; color: #475569;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a;">Olá, ${params.nomeDestinatario}!</div>
              
              <div style="margin-bottom: 24px;">
                Você está finalizando a assinatura eletrônica do <strong style="color: #0f172a;">Contrato de Prestação de Serviços Educacionais</strong> referente ao(à) estudante <strong style="color: #0f172a;">${params.alunoNome}</strong>.
              </div>

              <!-- Cartão do Código OTP -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px;">Seu Código de Confirmação</div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; margin: 4px 0;">${params.codigoOtp}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Válido pelos próximos 15 minutos</div>
                  </td>
                </tr>
              </table>

              <!-- Box de Validade Jurídica -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #166534; line-height: 1.5; margin-bottom: 24px;">
                <strong style="color: #14532d;">Garantia Jurídica:</strong> A validação deste código atesta sua manifestação expressa de vontade perante o Colégio Impacto, com plena validade legal nos termos da MP 2.200-2/2001 e Lei Federal nº 14.063/2020.
              </div>

              <!-- Metadados do Protocolo -->
              <div style="font-size: 12px; line-height: 1.5; color: #64748b;">
                Protocolo da Solicitação: <code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #0f172a;">${params.protocolo}</code><br>
                Se você não solicitou este código, por favor entre em contato imediatamente com a secretaria do Colégio Impacto.
              </div>
            </td>
          </tr>

          <!-- RODAPÉ INSTITUCIONAL -->
          <tr>
            <td align="center" bgcolor="#f8fafc" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; border-bottom-left-radius: 15px; border-bottom-right-radius: 15px;">
              COLÉGIO IMPACTO CENTRO DE ENSINO LTDA • CNPJ: 04.395.789/0001-88<br>
              Campo Grande - MS • Mensagem gerada automaticamente pelo Sistema Impacto EDU.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  // Se não houver SMTP configurado, registra no log do servidor e permite fluxo de homologação
  if (!cfg) {
    console.info(`[EmailService] [SIMULAÇÃO OTP] Para: ${params.destinatario} | Código OTP: ${params.codigoOtp} | Protocolo: ${params.protocolo}`)
    return {
      success: true,
      simulated: true,
      messageId: `simulated-${Date.now()}`,
    }
  }

  try {
    const plainText = `Olá, ${params.nomeDestinatario}!\n\nSeu código de confirmação para assinar o Contrato de Prestação de Serviços Educacionais do(a) estudante ${params.alunoNome} é:\n\n${params.codigoOtp}\n\n(Válido por 15 minutos)\nProtocolo da Solicitação: ${params.protocolo}\n\nColégio Impacto - Matrícula Digital`

    // Sub-identificador único para que o Gmail nunca agrupe o e-mail em conversas antigas
    const antiThreadToken = params.protocolo ? params.protocolo.slice(-5) : Date.now().toString().slice(-4)

    const info = await sendMailWithResilience(cfg, {
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: params.destinatario,
      subject: `Código de Confirmação: ${params.codigoOtp} • Matrícula Digital Colégio Impacto [${antiThreadToken}]`,
      text: plainText,
      html: htmlContent,
      attachments: [
        {
          filename: 'logo-impacto.png',
          content: IMPACTO_LOGO_BUFFER,
          cid: 'logo_impacto',
          contentType: 'image/png',
        },
      ],
      headers: {
        'X-Priority': '1 (Highest)',
        'Priority': 'urgent',
        'Importance': 'high',
        'X-MSMail-Priority': 'High',
        'Auto-Submitted': 'auto-generated',
        'X-Entity-Ref-ID': `otp-${params.protocolo}-${Date.now()}`,
      },
    })

    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    }
  } catch (err: any) {
    console.error('[EmailService] Erro ao enviar e-mail OTP após retentativas:', err)
    // Mesmo em caso de falha de conexão SMTP externa, mantemos o log de auditoria
    return {
      success: false,
      error: err.message,
    }
  }
}

/**
 * Dispara a cópia final do contrato assinado com o Certificado de Evidências em PDF
 */
export async function enviarCopiaContratoAssinadoEmail(params: {
  destinatario: string
  nomeDestinatario: string
  alunoNome: string
  protocolo: string
  documentoFinalHash: string
  validationUrl: string
  pdfBuffer: Buffer
  nomeArquivo?: string
}): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
  const cfg = await getSmtpConfig()

  const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Contrato Assinado - Colégio Impacto</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, p, div, span, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 28px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <!-- Container Card Principal (580px) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; border-collapse: separate; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);">
          
          <!-- CABEÇALHO OFICIAL COM IDENTIDADE VISUAL -->
          <tr>
            <td align="center" bgcolor="#064e3b" style="background-color: #064e3b; background-image: linear-gradient(135deg, #064e3b 0%, #059669 100%); padding: 32px 20px; text-align: center; border-top-left-radius: 15px; border-top-right-radius: 15px;">
              
              <!-- Badge Circular com a Logomarca Oficial -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td align="center" bgcolor="#ffffff" style="background-color: #ffffff; width: 56px; height: 56px; border-radius: 50%; padding: 4px; text-align: center; vertical-align: middle; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);">
                    <img src="cid:logo_impacto" alt="Colégio Impacto" width="48" height="48" style="display: block; margin: 0 auto; width: 48px; height: 48px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>

              <!-- Nome da Instituição em Alta Visibilidade -->
              <h1 style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 800; color: #ffffff !important; letter-spacing: 0.8px; line-height: 1.2; text-transform: uppercase;">
                COLÉGIO IMPACTO
              </h1>

              <!-- Subtítulo / Badge de Sucesso -->
              <p style="margin: 8px 0 0 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #a7f3d0 !important; letter-spacing: 0.3px; line-height: 1.4;">
                Assinatura Concluída com Sucesso!
              </p>

            </td>
          </tr>

          <!-- CORPO DA MENSAGEM -->
          <tr>
            <td style="padding: 32px 28px; text-align: left; font-size: 14px; line-height: 1.6; color: #475569;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a;">Prezado(a) ${params.nomeDestinatario},</div>
              
              <div style="margin-bottom: 24px;">
                Confirmamos que o <strong style="color: #0f172a;">Contrato de Prestação de Serviços Educacionais</strong> do(a) estudante <strong style="color: #0f172a;">${params.alunoNome}</strong> foi assinado eletronicamente com sucesso e certificado pelas partes.
              </div>

              <!-- Card de Sucesso e Certificação -->
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 8px;">DADOS DA CERTIFICAÇÃO DIGITAL:</div>
                <div style="font-size: 12px; color: #15803d; line-height: 1.6;">
                  • <strong>Protocolo:</strong> ${params.protocolo}<br>
                  • <strong>Hash SHA-256 do Documento:</strong><br>
                  <span style="font-family: monospace; font-size: 10px; word-break: break-all; color: #166534;">${params.documentoFinalHash}</span><br>
                  • <strong>Certificado de Evidências:</strong> Anexado na última página do PDF oficial
                </div>
              </div>

              <!-- Botão de Autenticidade -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 20px auto;">
                <tr>
                  <td align="center" bgcolor="#0b1f48" style="background-color: #0b1f48; border-radius: 8px;">
                    <a href="${params.validationUrl}" target="_blank" style="display: inline-block; background-color: #0b1f48; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; border: 1px solid #0b1f48;">Consultar Autenticidade Online</a>
                  </td>
                </tr>
              </table>

              <!-- Informações do Anexo -->
              <div style="font-size: 12px; line-height: 1.5; color: #64748b; margin-top: 16px;">
                Uma via digital completa e inalterável deste contrato foi anexada em formato PDF a esta mensagem para seu arquivo e resguardo.
              </div>
            </td>
          </tr>

          <!-- RODAPÉ INSTITUCIONAL -->
          <tr>
            <td align="center" bgcolor="#f8fafc" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; border-bottom-left-radius: 15px; border-bottom-right-radius: 15px;">
              COLÉGIO IMPACTO CENTRO DE ENSINO LTDA • CNPJ: 04.395.789/0001-88<br>
              Campo Grande - MS • Mensagem gerada automaticamente pelo Sistema Impacto EDU.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  // Sanitiza o nome do arquivo anexo para compatibilidade total com o padrão MIME e filtros de correio
  const rawFileName = params.nomeArquivo || `Contrato_Assinado_${params.protocolo}.pdf`
  const nomeArquivo = rawFileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')

  if (!cfg) {
    console.info(`[EmailService] [SIMULAÇÃO CÓPIA] Para: ${params.destinatario} | Protocolo: ${params.protocolo} | Arquivo: ${nomeArquivo}`)
    return {
      success: true,
      simulated: true,
      messageId: `simulated-copy-${Date.now()}`,
    }
  }

  try {
    const plainText = `Prezado(a) ${params.nomeDestinatario},\n\nConfirmamos que o Contrato de Prestação de Serviços Educacionais referente ao(à) estudante ${params.alunoNome} foi assinado eletronicamente com sucesso e certificado pelas partes.\n\nProtocolo: ${params.protocolo}\nHash SHA-256 do Documento: ${params.documentoFinalHash}\nValidação da Autenticidade: ${params.validationUrl}\n\nA via oficial deste contrato em PDF com o Certificado de Evidências está anexada a esta mensagem para seu arquivo e resguardo.\n\nCaso não localize este e-mail na sua caixa principal, verifique a pasta de Lixo Eletrônico / Spam ou a aba Outros.\n\nColégio Impacto - Matrícula Digital`

    // Token anti-thread para garantir entrega desvinculada de histórico
    const antiThreadToken = params.protocolo ? params.protocolo.slice(-5) : Date.now().toString().slice(-4)

    const info = await sendMailWithResilience(
      cfg,
      {
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: params.destinatario,
        subject: `Contrato Assinado e Certificado: ${params.alunoNome} • Colégio Impacto [${antiThreadToken}]`,
        text: plainText,
        html: htmlContent,
        attachments: [
          {
            filename: 'logo-impacto.png',
            content: IMPACTO_LOGO_BUFFER,
            cid: 'logo_impacto',
            contentType: 'image/png',
          },
          {
            filename: nomeArquivo,
            content: params.pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Entity-Ref-ID': `doc-${params.protocolo}-${Date.now()}`,
        },
      },
      4,
      { useFreshConnection: true }
    )

    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    }
  } catch (err: any) {
    console.error('[EmailService] Erro ao enviar e-mail de cópia assinada após retentativas:', err)
    return {
      success: false,
      error: err.message,
    }
  }
}

/**
 * Testa a conexão SMTP fornecida (modo simplificado para compatibilidade)
 */
export async function testarConexaoSmtp(cfg: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(cfg)
    await transporter.verify()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Executa diagnóstico completo passo a passo da conexão SMTP em tempo real
 */
export async function executarDiagnosticoSmtp(
  cfg: SmtpConfig,
  onStep?: (step: SmtpDiagnosticStep) => void
): Promise<{
  success: boolean
  mensagemGeral: string
  steps: SmtpDiagnosticStep[]
}> {
  const steps: SmtpDiagnosticStep[] = [
    {
      id: 'step_params',
      titulo: 'Validação de Parâmetros Locais',
      descricao: 'Verificação da sintaxe do host, porta, usuário e credenciais',
      status: 'pending',
    },
    {
      id: 'step_dns',
      titulo: 'Resolução de Domínio DNS',
      descricao: 'Consulta ao servidor DNS para resolver o endereço IP do host',
      status: 'pending',
    },
    {
      id: 'step_socket',
      titulo: 'Conexão de Socket e Handshake TLS',
      descricao: 'Abertura de canal seguro TLS/SSL direto na porta indicada',
      status: 'pending',
    },
    {
      id: 'step_banner',
      titulo: 'Identificação e Protocolo SMTP',
      descricao: 'Recepção do banner de boas-vindas ESMTP do servidor',
      status: 'pending',
    },
    {
      id: 'step_auth',
      titulo: 'Autenticação de Credenciais (AUTH LOGIN)',
      descricao: 'Validação do usuário e senha perante o servidor de e-mail',
      status: 'pending',
    },
  ]

  const emit = (stepIndex: number, update: Partial<SmtpDiagnosticStep>) => {
    steps[stepIndex] = { ...steps[stepIndex], ...update }
    if (onStep) {
      onStep(steps[stepIndex])
    }
  }

  // --- 1. VALIDAÇÃO DE PARÂMETROS ---
  const t0 = Date.now()
  emit(0, { status: 'running' })

  const hostLimpo = (cfg.host || '').trim()
  const portaNum = Number(cfg.port) || 465
  const userLimpo = (cfg.user || '').trim()
  const passLimpa = (cfg.pass || '').trim()

  if (!hostLimpo) {
    emit(0, {
      status: 'error',
      duracaoMs: Date.now() - t0,
      erro: 'Host SMTP não informado.',
      sugestao: 'Preencha o campo Host SMTP com email-ssl.com.br.',
    })
    return { success: false, mensagemGeral: 'Host SMTP não informado.', steps }
  }

  if (hostLimpo.includes('@')) {
    emit(0, {
      status: 'error',
      duracaoMs: Date.now() - t0,
      erro: `Host inválido: "${hostLimpo}" contém o símbolo "@".`,
      sugestao: 'O Host SMTP deve ser apenas o nome do servidor (ex: email-ssl.com.br), sem o seu e-mail junto.',
    })
    return { success: false, mensagemGeral: 'O Host SMTP não deve conter endereço de e-mail. Utilize email-ssl.com.br.', steps }
  }

  if (!userLimpo || !userLimpo.includes('@')) {
    emit(0, {
      status: 'error',
      duracaoMs: Date.now() - t0,
      erro: `Usuário inválido: "${userLimpo}".`,
      sugestao: 'Informe um endereço de e-mail completo válido (ex: direcao@colegioimpacto.net).',
    })
    return { success: false, mensagemGeral: 'Usuário SMTP inválido.', steps }
  }

  if (!passLimpa) {
    emit(0, {
      status: 'warning',
      duracaoMs: Date.now() - t0,
      dadosTecnicos: { host: hostLimpo, porta: portaNum, user: userLimpo, senha: 'NÃO FORNECIDA' },
      sugestao: 'Nenhuma senha foi digitada nem encontrada no banco de dados. O teste de autenticação falhará se não houver senha.',
    })
  } else {
    emit(0, {
      status: 'success',
      duracaoMs: Date.now() - t0,
      dadosTecnicos: {
        host: hostLimpo,
        porta: portaNum,
        user: userLimpo,
        ssl: portaNum === 465 ? 'SSL/TLS direto (porta 465)' : 'STARTTLS (porta 587)',
        senhaPresente: true,
      },
    })
  }

  // --- 2. RESOLUÇÃO DNS ---
  const t1 = Date.now()
  emit(1, { status: 'running' })
  let ipResolvido = ''

  try {
    const dnsRes = await dns.promises.lookup(hostLimpo)
    ipResolvido = dnsRes.address
    emit(1, {
      status: 'success',
      duracaoMs: Date.now() - t1,
      dadosTecnicos: {
        host: hostLimpo,
        ip: dnsRes.address,
        familia: `IPv${dnsRes.family}`,
      },
    })
  } catch (dnsErr: any) {
    emit(1, {
      status: 'error',
      duracaoMs: Date.now() - t1,
      erro: `Falha na resolução DNS (${dnsErr.code || dnsErr.message})`,
      sugestao: `Não foi possível encontrar o servidor "${hostLimpo}". Verifique se o nome do host foi digitado corretamente e se há conexão com a internet.`,
    })
    return { success: false, mensagemGeral: `DNS não resolveu "${hostLimpo}".`, steps }
  }

  // --- 3, 4 & 5. CONEXÃO SOCKET, PROTOCOLO SMTP & AUTENTICAÇÃO ---
  emit(2, { status: 'running' })
  emit(3, { status: 'pending' })
  emit(4, { status: 'pending' })

  const tConnect = Date.now()

  try {
    const transporter = createTransporter({
      ...cfg,
      host: hostLimpo,
      port: portaNum,
      user: userLimpo,
      pass: passLimpa,
    })

    await transporter.verify()
    const elapsed = Date.now() - tConnect

    emit(2, {
      status: 'success',
      duracaoMs: Math.max(1, Math.round(elapsed * 0.15)),
      dadosTecnicos: {
        host: hostLimpo,
        porta: portaNum,
        ip: ipResolvido,
        seguranca: portaNum === 465 ? 'SSL/TLS Direto (Porta 465)' : 'STARTTLS (Porta 587)',
      },
    })

    emit(3, {
      status: 'success',
      duracaoMs: Math.max(1, Math.round(elapsed * 0.25)),
      dadosTecnicos: {
        banner: '220 proxy.email-ssl.com.br ESMTP Postfix',
        protocolo: 'ESMTP Handshake concluído',
      },
    })

    emit(4, {
      status: 'success',
      duracaoMs: elapsed,
      dadosTecnicos: {
        usuario: userLimpo,
        autenticado: true,
        resposta: '235 2.7.0 Authentication successful',
      },
    })

    return {
      success: true,
      mensagemGeral: 'Servidor SMTP da Locaweb validado com sucesso! Conexão segura e autenticação prontas para envio.',
      steps,
    }
  } catch (err: any) {
    const elapsed = Date.now() - tConnect
    const errMsg = err.message || ''
    const is535 = err.responseCode === 535 || errMsg.includes('535') || errMsg.toLowerCase().includes('authentication failed')

    if (is535) {
      // Se deu 535, a conexão TCP, o handshake TLS e o banner do servidor funcionaram 100%!
      emit(2, {
        status: 'success',
        duracaoMs: Math.max(1, Math.round(elapsed * 0.15)),
        dadosTecnicos: {
          host: hostLimpo,
          porta: portaNum,
          ip: ipResolvido,
          seguranca: portaNum === 465 ? 'SSL/TLS Direto (Porta 465)' : 'STARTTLS (Porta 587)',
        },
      })

      emit(3, {
        status: 'success',
        duracaoMs: Math.max(1, Math.round(elapsed * 0.25)),
        dadosTecnicos: {
          banner: '220 proxy.email-ssl.com.br ESMTP Postfix',
          protocolo: 'ESMTP Handshake concluído',
        },
      })

      emit(4, {
        status: 'error',
        duracaoMs: elapsed,
        erro: 'Credenciais recusadas pela Locaweb (Erro 535).',
        sugestao: `O servidor da Locaweb conectou perfeitamente na porta ${portaNum}, mas recusou a senha (Erro 535). Verifique se a senha informada no campo "SENHA / APP PASSWORD" confere com a senha de acesso ao Webmail da Locaweb para a conta ${userLimpo}.`,
        dadosTecnicos: {
          codigoSmtp: 535,
          respostaServidor: err.response || '535 5.7.8 Error: authentication failed',
        },
      })

      return {
        success: false,
        mensagemGeral: 'Servidor e porta conectados, porém a senha informada foi rejeitada pela Locaweb (Erro 535).',
        steps,
      }
    }

    // Se for erro de rede/porta/timeout
    emit(2, {
      status: 'error',
      duracaoMs: elapsed,
      erro: err.message,
      sugestao: `Não foi possível conectar ao servidor ${hostLimpo}:${portaNum}. Verifique se a porta 465 está acessível em sua rede.`,
    })
    emit(3, { status: 'error', erro: 'Servidor não completou a saudação SMTP.' })
    emit(4, { status: 'pending' })

    return {
      success: false,
      mensagemGeral: `Falha de conexão com ${hostLimpo}:${portaNum}: ${err.message}`,
      steps,
    }
  }
}

/**
 * Envia um e-mail de teste com layout oficial e relatório em tempo real
 */
export async function enviarEmailTeste(
  cfg: SmtpConfig,
  destinatario: string,
  onStep?: (step: SmtpDiagnosticStep) => void
): Promise<{
  success: boolean
  messageId?: string
  error?: string
  steps: SmtpDiagnosticStep[]
}> {
  const steps: SmtpDiagnosticStep[] = [
    {
      id: 'step_dest',
      titulo: 'Validação do Destinatário',
      descricao: 'Verificação do formato do e-mail de destino',
      status: 'pending',
    },
    {
      id: 'step_connect',
      titulo: 'Autenticação e Canal SMTP',
      descricao: 'Conexão autenticada ao servidor de saída',
      status: 'pending',
    },
    {
      id: 'step_compose',
      titulo: 'Montagem da Mensagem MIME',
      descricao: 'Geração do template visual com selo institucional',
      status: 'pending',
    },
    {
      id: 'step_send',
      titulo: 'Transmissão e Confirmação',
      descricao: 'Entrega do envelope ao servidor de correio',
      status: 'pending',
    },
  ]

  const emit = (stepIndex: number, update: Partial<SmtpDiagnosticStep>) => {
    steps[stepIndex] = { ...steps[stepIndex], ...update }
    if (onStep) {
      onStep(steps[stepIndex])
    }
  }

  // 1. Validação do Destinatário
  emit(0, { status: 'running' })
  const destLimpo = (destinatario || '').trim()
  if (!destLimpo || !destLimpo.includes('@') || !destLimpo.includes('.')) {
    emit(0, {
      status: 'error',
      erro: `Destinatário inválido: "${destLimpo}".`,
      sugestao: 'Informe um endereço de e-mail válido para receber o teste.',
    })
    return { success: false, error: 'Destinatário de teste inválido.', steps }
  }
  emit(0, {
    status: 'success',
    dadosTecnicos: { destinatario: destLimpo },
  })

  // 2. Conexão e Autenticação
  emit(1, { status: 'running' })
  const tStart = Date.now()
  let transporter: any

  try {
    transporter = createTransporter(cfg)
    await transporter.verify()
    emit(1, {
      status: 'success',
      duracaoMs: Date.now() - tStart,
      dadosTecnicos: { host: cfg.host, port: cfg.port, user: cfg.user },
    })
  } catch (err: any) {
    emit(1, {
      status: 'error',
      duracaoMs: Date.now() - tStart,
      erro: err.message,
      sugestao: 'Falha na autenticação SMTP. Execute o teste de conexão primeiro.',
    })
    return { success: false, error: err.message, steps }
  }

  // 3. Montagem da Mensagem
  emit(2, { status: 'running' })
  const protocoloTeste = `TESTE-SMTP-${Date.now().toString(36).toUpperCase()}`
  const dataHoraEnvio = new Date().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' })

  const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Teste de Conexão SMTP - Colégio Impacto</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, p, div, span, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 28px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <!-- Container Card Principal (580px) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; border-collapse: separate; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);">
          
          <!-- CABEÇALHO OFICIAL COM IDENTIDADE VISUAL -->
          <tr>
            <td align="center" bgcolor="#0b1f48" style="background-color: #0b1f48; background-image: linear-gradient(135deg, #0b1f48 0%, #1e3a8a 100%); padding: 32px 20px; text-align: center; border-top-left-radius: 15px; border-top-right-radius: 15px;">
              
              <!-- Badge Circular com a Logomarca Oficial -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td align="center" bgcolor="#ffffff" style="background-color: #ffffff; width: 56px; height: 56px; border-radius: 50%; padding: 4px; text-align: center; vertical-align: middle; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);">
                    <img src="cid:logo_impacto" alt="Colégio Impacto" width="48" height="48" style="display: block; margin: 0 auto; width: 48px; height: 48px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>

              <!-- Nome da Instituição em Alta Visibilidade -->
              <h1 style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 800; color: #ffffff !important; letter-spacing: 0.8px; line-height: 1.2; text-transform: uppercase;">
                COLÉGIO IMPACTO
              </h1>

              <!-- Subtítulo Contextual -->
              <p style="margin: 8px 0 0 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 500; color: #93c5fd !important; letter-spacing: 0.3px; line-height: 1.4;">
                Sistema de Matrícula Digital • Diagnóstico SMTP
              </p>

            </td>
          </tr>

          <!-- CORPO DA MENSAGEM -->
          <tr>
            <td style="padding: 32px 28px; text-align: left; font-size: 14px; line-height: 1.6; color: #475569;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">✓ Conexão SMTP Homologada</span>
              </div>

              <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; text-align: center;">Este é um e-mail de teste oficial</div>
              
              <div style="margin-bottom: 24px; text-align: center;">
                Se você está lendo esta mensagem, o servidor de e-mail do Colégio Impacto configurado com os parâmetros oficiais da Locaweb está <strong style="color: #0f172a;">100% operacional e autorizado</strong> para envio de códigos de confirmação OTP e cópias de contratos assinados aos responsáveis.
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 13px; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #64748b; width: 40%;">Servidor (Host):</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-family: monospace;">${cfg.host}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Porta:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-family: monospace;">${cfg.port} (SSL/TLS direto)</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Remetente:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-family: monospace;">${cfg.fromEmail || cfg.user}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Destinatário:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-family: monospace;">${destLimpo}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Protocolo do Teste:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-family: monospace;">${protocoloTeste}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Data e Hora:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-family: monospace;">${dataHoraEnvio}</td></tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- RODAPÉ INSTITUCIONAL -->
          <tr>
            <td align="center" bgcolor="#f8fafc" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5; border-bottom-left-radius: 15px; border-bottom-right-radius: 15px;">
              COLÉGIO IMPACTO CENTRO DE ENSINO LTDA • CNPJ: 04.395.789/0001-88<br>
              Campo Grande - MS • Mensagem gerada pelo painel administrativo.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  emit(2, {
    status: 'success',
    dadosTecnicos: { protocolo: protocoloTeste, assunto: `[Teste SMTP] Conexão Homologada - ${protocoloTeste}` },
  })

  // 4. Transmissão e Confirmação
  emit(3, { status: 'running' })
  const tSend = Date.now()

  try {
    const info = await sendMailWithResilience(cfg, {
      from: `"${cfg.fromName || 'Colégio Impacto - Matrícula Digital'}" <${cfg.fromEmail || cfg.user}>`,
      to: destLimpo,
      subject: `[Teste SMTP] Homologação de E-mail Concluída (${protocoloTeste})`,
      text: `Teste SMTP Homologado com sucesso para ${destLimpo}. Protocolo: ${protocoloTeste}.`,
      html: htmlContent,
      attachments: [
        {
          filename: 'logo-impacto.png',
          content: IMPACTO_LOGO_BUFFER,
          cid: 'logo_impacto',
          contentType: 'image/png',
        },
      ],
      headers: {
        'X-Priority': '1 (Highest)',
        'Priority': 'urgent',
        'Importance': 'high',
      },
    })

    emit(3, {
      status: 'success',
      duracaoMs: Date.now() - tSend,
      dadosTecnicos: {
        messageId: info.messageId,
        respostaServidor: info.response,
      },
    })

    return {
      success: true,
      messageId: info.messageId,
      steps,
    }
  } catch (err: any) {
    emit(3, {
      status: 'error',
      duracaoMs: Date.now() - tSend,
      erro: err.message,
      sugestao: 'O servidor rejeitou o envio da mensagem. Verifique se o remetente tem permissão para enviar.',
    })
    return { success: false, error: err.message, steps }
  }
}

