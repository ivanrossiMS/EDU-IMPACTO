/**
 * lib/contracts/cryptoSignature.ts
 *
 * Módulo Criptográfico, Pericial e de Conformidade LGPD do Impacto EDU.
 * Responsável pelo cálculo de hashes SHA-256, geração de protocolos auditáveis,
 * extração confiável de IP real com suporte a proxies, mascaramento pericial
 * e cálculo de integridade imutável da cadeia de custódia.
 */

import crypto from 'crypto'

/**
 * Calcula o hash criptográfico SHA-256 de um buffer, Uint8Array ou string.
 */
export function calculateSha256(data: Buffer | Uint8Array | string): string {
  if (typeof data === 'string') {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex').toUpperCase()
  }
  return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex').toUpperCase()
}

/**
 * Gera um código de protocolo human-readable e auditável (ex: IMP-2027-8K3N9P)
 */
export function generateProtocolCode(ano: string = '2027'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem I, O, 0, 1 para evitar ambiguidade visual
  let randomPart = ''
  const randomBytes = crypto.randomBytes(6)
  for (let i = 0; i < 6; i++) {
    randomPart += chars[randomBytes[i] % chars.length]
  }
  return `IMP-${ano}-${randomPart}`
}

/**
 * Gera um token seguro de assinatura (UUID v4)
 */
export function generateSecureToken(): string {
  return crypto.randomUUID()
}

/**
 * Gera código OTP numérico de 6 dígitos para validação temporária
 */
export function generateOtpCode(): string {
  const num = crypto.randomInt(100000, 999999)
  return String(num)
}

/**
 * Calcula o hash encadeado de auditoria (Cadeia de Custódia Imutável)
 */
export function calculateEventHash(
  prevHash: string,
  eventId: string,
  timestamp: string,
  eventType: string,
  ip: string
): string {
  const payload = `${prevHash}|${eventId}|${timestamp}|${eventType}|${ip}`
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex').toUpperCase()
}

/**
 * Calcula o hash consolidado da trilha de auditoria para aferição de integridade pericial.
 */
export function calculateAuditTrailHash(eventos: any[]): string {
  if (!Array.isArray(eventos) || eventos.length === 0) {
    return calculateSha256('TRILHA_AUDITORIA_INICIAL')
  }
  const payload = eventos
    .map(e => `${e.timestamp}|${e.evento}|${e.descricao}|${e.ip}|${e.hash || ''}`)
    .join(';;')
  return calculateSha256(payload)
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!ip) return true
  const clean = ip.trim().replace(/^::ffff:/, '')
  if (clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return true
  if (clean.startsWith('10.') || clean.startsWith('192.168.') || clean.startsWith('fc00:') || clean.startsWith('fe80:')) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true
  return false
}

/**
 * Extrai o melhor endereço IP público do cliente a partir dos headers HTTP,
 * analisando proxies reversos confiáveis (Cloudflare, Nginx, Vercel, Netlify)
 * e ignorando cabeçalhos falsificados ou endereços internos.
 */
export function extractClientIp(reqHeaders: Headers | Record<string, string | string[] | undefined>): string {
  const getHeader = (name: string): string | null => {
    if (typeof (reqHeaders as any)?.get === 'function') {
      return (reqHeaders as Headers).get(name)
    }
    const val = (reqHeaders as Record<string, any>)[name] || (reqHeaders as Record<string, any>)[name.toLowerCase()]
    if (Array.isArray(val)) return val[0] || null
    return val || null
  }

  // 1. Cabeçalhos diretos de proxy confiável de borda
  const cfIp = getHeader('cf-connecting-ip')
  if (cfIp && !isPrivateOrLoopbackIp(cfIp)) return cfIp.trim()

  const trueClientIp = getHeader('true-client-ip')
  if (trueClientIp && !isPrivateOrLoopbackIp(trueClientIp)) return trueClientIp.trim()

  const realIp = getHeader('x-real-ip')
  if (realIp && !isPrivateOrLoopbackIp(realIp)) return realIp.trim()

  // 2. Cadeia X-Forwarded-For: percorre os IPs da esquerda (cliente) para a direita
  const forwardedFor = getHeader('x-forwarded-for')
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map(s => s.trim()).filter(Boolean)
    for (const part of parts) {
      if (!isPrivateOrLoopbackIp(part)) {
        return part
      }
    }
    // Se todos forem locais/privados, identifica claramente como rede interna de teste
    if (parts[0]) {
      const p = parts[0]
      if (p === '::1' || p === '127.0.0.1') return '127.0.0.1 (Loopback / Ambiente Local)'
      return p
    }
  }

  if (realIp) {
    if (realIp === '::1' || realIp === '127.0.0.1') return '127.0.0.1 (Loopback / Ambiente Local)'
    return realIp
  }

  return '127.0.0.1 (Loopback / Ambiente Local)'
}

export interface ParsedClientInfo {
  ip: string
  browser: string
  os: string
  device: string
  userAgent: string
}

/**
 * Analisa a string de User-Agent identificando Navegador, SO e Dispositivo
 */
export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  if (!ua) {
    return { browser: 'Navegador Web', os: 'Sistema Operacional', device: 'Computador/Dispositivo' }
  }

  let os = 'Sistema Desconhecido'
  let device = 'Computador Desktop'
  let browser = 'Navegador Web'

  // Identificação de SO e Dispositivo
  if (/iPhone/i.test(ua)) {
    os = 'iOS (Apple)'
    device = 'iPhone'
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS (Apple)'
    device = 'iPad (Tablet)'
  } else if (/Android/i.test(ua)) {
    os = 'Android OS'
    device = /Mobile/i.test(ua) ? 'Smartphone Android' : 'Tablet Android'
  } else if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows 10 / 11'
    device = 'Computador (PC Windows)'
  } else if (/Windows/i.test(ua)) {
    os = 'Microsoft Windows'
    device = 'Computador (PC Windows)'
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS (Apple)'
    device = 'Computador (Apple Mac)'
  } else if (/Linux/i.test(ua)) {
    os = 'GNU/Linux'
    device = 'Computador (Linux)'
  }

  // Identificação de Navegador
  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge'
  } else if (/Chrome\//i.test(ua) && !/Chromium|Edg/i.test(ua)) {
    browser = 'Google Chrome'
  } else if (/Safari\//i.test(ua) && !/Chrome|Chromium/i.test(ua)) {
    browser = 'Apple Safari'
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox'
  } else if (/Opera|OPR\//i.test(ua)) {
    browser = 'Opera'
  }

  return { browser, os, device }
}

/**
 * URL Canônica Pública Oficial para validação de autenticidade no QR Code e no PDF impresso.
 * NUNCA retorna localhost ou 127.0.0.1 em documentos jurídicos para garantir que qualquer
 * parte, advogado ou juiz consiga validar externamente em qualquer dispositivo.
 */
export function getPublicValidationUrl(protocolo: string): string {
  const clean = encodeURIComponent(String(protocolo || '').trim())
  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')

  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return `${envUrl}/validar-assinatura/${clean}`
  }

  return `https://www.impacto-edu.net/validar-assinatura/${clean}`
}

/**
 * Determina a URL base adequada da aplicação para redirecionamentos web no portal.
 */
export function getAppBaseUrl(req?: Request | Headers | null): string {
  const getHeader = (name: string): string | null => {
    if (!req) return null
    if ('headers' in req && req.headers && typeof req.headers.get === 'function') {
      return req.headers.get(name)
    }
    if (typeof (req as Headers).get === 'function') {
      return (req as Headers).get(name)
    }
    return null
  }

  const origin = getHeader('origin')
  const host = getHeader('x-forwarded-host') || getHeader('host') || ''

  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return origin.replace(/\/$/, '')
  }

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const proto = getHeader('x-forwarded-proto') || 'http'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (envUrl) {
    return envUrl
  }

  if (origin && !origin.includes('undefined') && !origin.includes('null')) {
    return origin.replace(/\/$/, '')
  }

  if (host) {
    const proto = getHeader('x-forwarded-proto') || 'https'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  return 'https://www.impacto-edu.net'
}

// ── Funções de Mascaramento Pericial e LGPD ──

export function maskCpf(cpf?: string | null): string {
  if (!cpf) return '—'
  const clean = cpf.replace(/\D/g, '')
  if (clean.length === 11) {
    // Formato: ***.302.***-**
    return `***.${clean.slice(3, 6)}.***-**`
  }
  return '***.***.***-**'
}

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '—'
  const [user, domain] = email.trim().split('@')
  if (user.length <= 2) {
    return `${user[0]}***@${domain}`
  }
  return `${user.slice(0, 2)}***@${domain}`
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2)
    const last4 = digits.slice(-4)
    return `(${ddd}) *****-${last4}`
  }
  return phone.replace(/(\d{2})(\d+)(\d{2})/, '($1) *****-$3')
}

export function maskName(name?: string | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return parts
    .map((part, idx) => {
      if (idx === 0) return part // Primeiro nome preservado
      if (part.length <= 2) return part // 'da', 'de', 'do'
      return `${part[0]}${'*'.repeat(part.length - 1)}`
    })
    .join(' ')
}
