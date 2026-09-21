/**
 * Helper unificado para geração de URLs de compartilhamento no WhatsApp.
 *
 * ⚠️ ATENÇÃO CRÍTICA SOBRE O BUG DO 'wa.me' DA META:
 * NUNCA utilize o domínio encurtador 'wa.me' para links que contenham mensagens de texto com emojis
 * (como 💙, ✍️, ✨) ou caracteres acentuados.
 *
 * O servidor da Meta em 'wa.me' responde com redirecionamento HTTP 302 (Found) para 'api.whatsapp.com/send/'.
 * Porém, o proxy reverso da Meta possui um bug de codificação no cabeçalho 'Location:' que corrompe
 * caracteres multibyte UTF-8 (emojis de 4 bytes ou com seletores de variação), transformando cada emoji
 * em '%EF%BF%BD' (U+FFFD - Replacement Character, exibido no WhatsApp como losango com interrogação: ).
 *
 * O endpoint oficial 'https://api.whatsapp.com/send/' atende diretamente com HTTP 200 sem passar pelo
 * redirecionamento defeituoso do 'wa.me', preservando 100% dos emojis, formatação markdown (*negrito*)
 * e quebras de linha.
 */

export function getWhatsAppShareUrl(phone?: string, text?: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '')
  const fullPhone = cleanPhone
    ? cleanPhone.startsWith('55')
      ? cleanPhone
      : `55${cleanPhone}`
    : ''

  if (fullPhone && text) {
    return `https://api.whatsapp.com/send/?phone=${fullPhone}&text=${encodeURIComponent(text)}`
  }
  if (fullPhone) {
    return `https://api.whatsapp.com/send/?phone=${fullPhone}`
  }
  if (text) {
    return `https://api.whatsapp.com/send/?text=${encodeURIComponent(text)}`
  }
  return 'https://api.whatsapp.com/send/'
}

/**
 * Modelo padrão oficial de mensagem de WhatsApp para notificação de assinatura de documentos digitais
 */
export const DEFAULT_WHATSAPP_DIGITAL_TEMPLATE = `Olá, {responsavel}! 💙
O {escola} disponibilizou o documento *{documento}* referente ao(à) estudante *{aluno}* para sua ciência e assinatura digital.

✍️ *Acesse com segurança pelo link oficial:*
{link_assinatura}

Ao acessar, você confirmará um código de segurança enviado para o seu e-mail ({email}). Agradecemos pela confiança na nossa escola!`

export interface ParametrosMensagemWhatsApp {
  responsavel?: string
  documento?: string
  aluno?: string
  ano?: string
  link_assinatura?: string
  email?: string
  escola?: string
  protocolo?: string
  lista_documentos?: string
}

/**
 * Formata um template de WhatsApp substituindo tags dinâmicas de forma resiliente e profissional
 */
export function formatarMensagemWhatsApp(
  template: string | null | undefined,
  params: ParametrosMensagemWhatsApp
): string {
  let msg = (template && template.trim()) ? template : DEFAULT_WHATSAPP_DIGITAL_TEMPLATE

  const responsavel = (params.responsavel || 'Responsável').trim()
  const documento = (params.documento || 'Documento').trim()
  const aluno = (params.aluno || '').trim()
  const ano = (params.ano || '').trim()
  const email = (params.email || 'cadastrado').trim()
  const escola = (params.escola || 'Colégio Impacto').trim()
  const protocolo = (params.protocolo || '').trim()
  const linkAssinatura = (params.link_assinatura || '').trim()
  const listaDocumentos = (params.lista_documentos || '').trim()

  // Se o aluno não for informado (ex: contratos institucionais), remove menção suavemente
  if (!aluno) {
    msg = msg
      .replace(/\s*referente ao\(à\) estudante\s*\*?\{aluno\}\*?/gi, '')
      .replace(/\s*do\(a\) estudante\s*\*?\{aluno\}\*?/gi, '')
      .replace(/\s*do\(a\) aluno\(a\)\s*\*?\{aluno\}\*?/gi, '')
      .replace(/\{aluno\}/g, '')
  }

  // Se houver lista de documentos (modo de envio separado)
  if (listaDocumentos) {
    if (msg.includes('{lista_documentos}')) {
      msg = msg.replaceAll('{lista_documentos}', listaDocumentos)
    } else if (msg.includes('{link_assinatura}')) {
      msg = msg.replaceAll('{link_assinatura}', listaDocumentos)
    } else if (msg.includes('{link}')) {
      msg = msg.replaceAll('{link}', listaDocumentos)
    }
  }

  const tags: Record<string, string> = {
    '{responsavel}': responsavel,
    '{nome_responsavel}': responsavel,
    '{documento}': documento,
    '{titulo_documento}': documento,
    '{aluno}': aluno,
    '{nome_aluno}': aluno,
    '{ano}': ano,
    '{ano_letivo}': ano,
    '{link_assinatura}': linkAssinatura,
    '{link}': linkAssinatura,
    '{email}': email,
    '{email_responsavel}': email,
    '{escola}': escola,
    '{nome_escola}': escola,
    '{protocolo}': protocolo,
    '{lista_documentos}': listaDocumentos || linkAssinatura,
  }

  for (const [tag, val] of Object.entries(tags)) {
    msg = msg.replaceAll(tag, val)
  }

  return msg
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

