/**
 * lib/banking/openBoletoHtml.ts
 * Abre boleto HTML em nova janela com encoding UTF-8 correto.
 *
 * Problema resolvido:
 *   - window.open + document.write() processa os bytes ANTES de ler o
 *     <meta charset="UTF-8">, causando caracteres acentuados quebrados (ç→??).
 *   - Solução: criar um Blob com type 'text/html;charset=utf-8' e abrir via
 *     URL.createObjectURL — o browser lê o charset direto do MIME type, antes
 *     de parsear o conteúdo.
 */
export function openBoletoHtml(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  // Revoga após 60s (tempo suficiente para o browser carregar)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  if (!win) {
    // Fallback: popup bloqueado → tenta via <a> download
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.click()
  }
}
