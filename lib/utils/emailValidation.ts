/**
 * lib/utils/emailValidation.ts
 *
 * Utilitários isomorfos para validação e proteção de endereços de e-mail.
 * Funciona tanto no ambiente de navegador (client components) quanto no servidor (Node.js/Next.js).
 */

/**
 * Verifica se um endereço de e-mail pertence a domínios reservados pela RFC 2606 e RFC 6761
 * (como example.com, example.net, .test, .invalid, .localhost) ou padrões sintéticos de teste.
 * 
 * ATENÇÃO: Nunca bloqueia domínios legítimos reais (como gmail.com, hotmail.com, outlook.com,
 * yahoo.com, uol.com.br, colegioimpacto.net, domínios corporativos ou institucionais).
 */
export function isNonDeliverableTestEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim().toLowerCase()
  if (!trimmed.includes('@')) return false

  const parts = trimmed.split('@')
  if (parts.length !== 2) return false
  const [localPart, domain] = parts

  if (!domain || !localPart) return false

  // 1. Domínios reservados pela RFC 2606 e RFC 6761 (possuem Null MX garantido ou inexistência intencional)
  const reservedExactDomains = [
    'example.com',
    'example.org',
    'example.net',
    'example.edu',
    'test.com',
    'teste.com',
    'teste.com.br',
    'local.test',
  ]

  if (reservedExactDomains.includes(domain)) {
    return true
  }

  // 2. Subdomínios de domínios reservados (ex: *.example.com)
  if (
    domain.endsWith('.example.com') ||
    domain.endsWith('.example.org') ||
    domain.endsWith('.example.net') ||
    domain.endsWith('.example.edu')
  ) {
    return true
  }

  // 3. TLDs reservados (RFC 2606 / RFC 6761)
  const reservedTlds = ['.example', '.invalid', '.localhost', '.test']
  for (const tld of reservedTlds) {
    if (domain.endsWith(tld)) {
      return true
    }
  }

  // 4. Prefixos sintéticos de auditoria combinados com domínios de teste genéricos
  if (
    (localPart.startsWith('df-audit-') || localPart.startsWith('audit-') || localPart.startsWith('test-audit-')) &&
    (domain.includes('example') || domain.includes('test') || domain.includes('audit'))
  ) {
    return true
  }

  return false
}

/**
 * Validação estrutural de sintaxe de e-mail (compatível com RFC 5322 simplificada)
 */
export function isValidEmailSyntax(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  return emailRegex.test(trimmed)
}
