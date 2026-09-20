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
