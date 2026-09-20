/**
 * lib/zapsign.ts
 *
 * Cliente de integração oficial para a API v1 do ZapSign.
 * Compatível com ambientes de Produção e Sandbox (Testes).
 */

export interface ZapSignSignerConfig {
  name: string
  email?: string
  phoneCountry?: string
  phoneNumber?: string
  authMode?: 'tokenWhatsapp' | 'tokenEmail' | 'assinaturaTela' | 'tokenSms'
  sendAutomaticEmail?: boolean
  sendAutomaticWhatsapp?: boolean
  cpf?: string // CPF (apenas dígitos numéricos)
  requireCpf?: boolean // Se true, torna o campo de CPF obrigatório na interface de assinatura do ZapSign
  qualification?: string // Papel do signatário (ex: Contratante, Contratado)
  lockName?: boolean
  lockEmail?: boolean
  lockPhone?: boolean
  lockCpf?: boolean
}

export interface ZapSignCreateDocParams {
  name: string
  base64Pdf: string // base64 sem prefixo data:...
  signers: ZapSignSignerConfig[]
  externalId?: string
  sandbox?: boolean
  apiToken?: string
  brandLogo?: string
  customMessage?: string
}

export interface ZapSignTemplateVars {
  nomeResponsavel?: string
  nomeAluno?: string
  turmaAluno?: string
  linkAssinatura?: string
  nomeEscola?: string
  nomeDocumento?: string
  nomeRepresentante?: string
  razaoSocial?: string
  cargo?: string
}

export const DEFAULT_MENSAGEM_WHATSAPP_CONTRATANTE =
  `Olá, {{nome_responsavel}}!\n\n` +
  `Segue o documento do Colégio Impacto para o(a) aluno(a) *{{nome_aluno}}*.\n\n` +
  `Por favor, acesse o link oficial abaixo para assinar eletronicamente via ZapSign:\n` +
  `{{link_assinatura}}\n\n` +
  `Assim que concluir a assinatura, por gentileza, nos avise por aqui para darmos andamento imediato à efetivação da matrícula! ✍️\n\n` +
  `Qualquer dúvida, a Secretaria Escolar está à inteira disposição!`

export const DEFAULT_MENSAGEM_WHATSAPP_CONTRATADO =
  `Olá, {{nome_representante}}!\n\n` +
  `Segue o documento do Colégio Impacto para o(a) aluno(a) *{{nome_aluno}}* para assinatura institucional como CONTRATADO ({{razao_social}}).\n\n` +
  `Acesse o link oficial abaixo para assinar eletronicamente via ZapSign:\n` +
  `{{link_assinatura}}\n\n` +
  `Secretaria Digital`

export function formatarMensagemZapSign(template?: string | null, vars: ZapSignTemplateVars = {}): string {
  let text = (template && template.trim()) ? template : DEFAULT_MENSAGEM_WHATSAPP_CONTRATANTE

  // Substitui qualquer caractere corrompido (replacement character U+FFFD) pelo emoji ✍️
  if (text.includes('\uFFFD')) {
    text = text.replace(/\uFFFD/g, '✍️')
  }

  const nomeAluno = vars.nomeAluno?.trim() || ''
  const nomeResp = vars.nomeResponsavel?.trim() || 'Responsável'
  const link = vars.linkAssinatura?.trim() || ''
  const escola = vars.nomeEscola?.trim() || 'Colégio Impacto'
  const doc = vars.nomeDocumento?.trim() || 'Documento Escolar'
  const turma = vars.turmaAluno?.trim() || ''
  const representante = vars.nomeRepresentante?.trim() || 'Representante Legal'
  const razaoSocial = vars.razaoSocial?.trim() || 'Colégio Impacto'
  const cargo = vars.cargo?.trim() || 'Representante Legal'

  // Substituições inteligentes de referência ao aluno
  const refAluno = nomeAluno ? ` para o(a) aluno(a) *${nomeAluno}*` : ''

  const map: Record<string, string> = {
    nome_responsavel: nomeResp,
    responsavel: nomeResp,
    nome_aluno: nomeAluno || 'aluno(a)',
    aluno: nomeAluno || 'aluno(a)',
    referencia_aluno: refAluno,
    turma_aluno: turma,
    turma: turma,
    link_assinatura: link,
    link: link,
    nome_escola: escola,
    escola: escola,
    nome_documento: doc,
    documento: doc,
    nome_representante: representante,
    representante: representante,
    razao_social: razaoSocial,
    cargo: cargo,
  }

  // Se o aluno não estiver informado, limpa construções como "para o(a) aluno(a) *aluno(a)*" de forma elegante
  if (!nomeAluno) {
    text = text.replace(/para\s+o\(a\)\s+aluno\(a\)\s+\*?\{\{\s*(?:nome_)?aluno\s*\}\}\*?/gi, '')
    text = text.replace(/para\s+o\(a\)\s+aluno\(a\)\s+\*?\{(?:nome_)?aluno\}\*?/gi, '')
    text = text.replace(/de\s+\*?\{\{\s*(?:nome_)?aluno\s*\}\}\*?/gi, '')
    text = text.replace(/de\s+\*?\{(?:nome_)?aluno\}\*?/gi, '')
  }

  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{([a-zA-Z0-9_]+)\}/g, (match, p1, p2) => {
    const key = (p1 || p2 || '').toLowerCase()
    return key in map ? map[key] : match
  }).replace(/[ \t]{2,}/g, ' ')
}

/**
 * Sanitiza a mensagem personalizada para a API da ZapSign.
 * Quando o envio automático por WhatsApp está ativo para qualquer signatário,
 * a ZapSign (e a Meta WhatsApp Cloud API) rejeita estritamente quebras de linha (\r, \n),
 * tabs (\t) e sequências com múltiplos espaços consecutivos, retornando erro HTTP 406.
 */
export function sanitizarMensagemZapSign(msg?: string | null, isWhatsapp = false): string | undefined {
  if (!msg || typeof msg !== 'string') return undefined
  let clean = msg.trim()
  if (!clean) return undefined

  if (isWhatsapp) {
    clean = clean
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  return clean || undefined
}

export { getWhatsAppShareUrl } from './whatsapp'

export interface ZapSignDocResponse {
  token: string
  name: string
  status: 'pending' | 'signed' | 'refused' | 'canceled' | string
  original_file?: string
  signed_file?: string | null
  created_at?: string
  last_update_at?: string
  signers: Array<{
    token: string
    name: string
    email?: string
    phone_number?: string
    status: 'new' | 'pending' | 'signed' | 'refused' | string
    sign_url: string
    times_viewed?: number
    signed_at?: string | null
  }>
}

/**
 * Retorna a URL base de acordo com o ambiente
 */
export function getZapSignBaseUrl(sandbox = false): string {
  return sandbox
    ? 'https://sandbox.api.zapsign.com.br/api/v1'
    : 'https://api.zapsign.com.br/api/v1'
}

/**
 * Limpa número de telefone brasileiro para formato ZapSign (DDD + Número, 10 ou 11 dígitos)
 */
export function formatPhoneForZapSign(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  // Se vier com código 55 na frente e tiver 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2)
  }
  return digits
}

/**
 * Limpa CPF para formato numérico de 11 dígitos
 */
export function formatCpfForZapSign(cpf?: string | null): string {
  if (!cpf) return ''
  return cpf.replace(/\D/g, '').slice(0, 11)
}

/**
 * Cria um documento no ZapSign para assinatura eletrônica
 */
export async function criarDocumentoZapSign(params: ZapSignCreateDocParams): Promise<ZapSignDocResponse> {
  const token = params.apiToken || process.env.ZAPSIGN_API_TOKEN
  if (!token) {
    throw new Error('Token da API do ZapSign não configurado. Por favor, adicione seu token nas configurações.')
  }

  const baseUrl = getZapSignBaseUrl(params.sandbox)
  const cleanBase64 = params.base64Pdf.replace(/^data:application\/pdf;base64,/, '').trim()

  const signersPayload = params.signers.map(s => {
    const cleanPhone = formatPhoneForZapSign(s.phoneNumber)
    const cleanCpf = formatCpfForZapSign(s.cpf)
    const authMode = s.authMode || 'tokenWhatsapp'
    
    // Configurações inteligentes de envio automático conforme a preferência do usuário
    const isWhatsapp = authMode === 'tokenWhatsapp'
    const isEmail = authMode === 'tokenEmail'

    const signerObj: any = {
      name: s.name.trim(),
      email: s.email ? s.email.trim() : undefined,
      phone_country: cleanPhone ? (s.phoneCountry || '55') : undefined,
      phone_number: cleanPhone || undefined,
      auth_mode: authMode,
      send_automatic_whatsapp: s.sendAutomaticWhatsapp ?? isWhatsapp,
      send_automatic_email: s.sendAutomaticEmail ?? isEmail,
      order_group: 1,
      // Torna obrigatório o preenchimento/confirmação do CPF no ZapSign
      require_cpf: s.requireCpf !== undefined ? s.requireCpf : true,
    }

    if (cleanCpf) {
      signerObj.cpf = cleanCpf
    }

    if (s.qualification) {
      signerObj.qualification = s.qualification
    }

    if (s.lockName !== undefined) signerObj.lock_name = s.lockName
    if (s.lockEmail !== undefined) signerObj.lock_email = s.lockEmail
    if (s.lockPhone !== undefined) signerObj.lock_phone = s.lockPhone
    if (s.lockCpf !== undefined) signerObj.lock_cpf = s.lockCpf

    return signerObj
  })

  const payload: any = {
    name: params.name,
    base64_pdf: cleanBase64,
    signers: signersPayload,
    lang: 'pt-br',
  }

  if (params.externalId) {
    payload.external_id = params.externalId
  }
  if (params.brandLogo) {
    payload.brand_logo = params.brandLogo
  }
  if (params.customMessage) {
    const hasWhatsappSigner = signersPayload.some(
      s => s.send_automatic_whatsapp === true || s.auth_mode === 'tokenWhatsapp'
    )
    const cleanMsg = sanitizarMensagemZapSign(params.customMessage, hasWhatsappSigner)
    if (cleanMsg) {
      payload.custom_message = cleanMsg
    }
  }

  const response = await fetch(`${baseUrl}/docs/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.trim()}`,
    },
    body: JSON.stringify(payload),
  })

  const rawText = await response.text()
  let data: any = {}
  try {
    data = JSON.parse(rawText)
  } catch (e) {
    // Não é JSON (pode ser texto puro da ZapSign)
  }

  if (!response.ok) {
    if (response.status === 402 || rawText.includes('Plano de API')) {
      throw new Error(
        'A sua conta da ZapSign requer a contratação ou ativação de um "Plano de API" para envio em Produção. Acesse o painel da ZapSign (Configurações > Integrações > API ZapSign) e clique no botão "Planos de API" para ativar.'
      )
    }
    let errorDetail = data?.message || data?.detail
    if (!errorDetail && typeof data === 'object' && data !== null) {
      const parts: string[] = []
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) {
          parts.push(`${k}: ${v.join(', ')}`)
        } else if (typeof v === 'string') {
          parts.push(`${k}: ${v}`)
        }
      }
      if (parts.length > 0) {
        errorDetail = parts.join('; ')
      }
    }
    if (!errorDetail) {
      errorDetail = rawText || `Erro HTTP ${response.status}`
    }
    throw new Error(`Erro na API do ZapSign (${response.status}): ${errorDetail}`)
  }

  return data as ZapSignDocResponse
}

/**
 * Consulta o status atual de um documento no ZapSign
 */
export async function consultarDocumentoZapSign(
  docToken: string,
  apiToken?: string,
  sandbox = false
): Promise<ZapSignDocResponse> {
  const token = apiToken || process.env.ZAPSIGN_API_TOKEN
  if (!token) {
    throw new Error('Token da API do ZapSign não configurado.')
  }

  const baseUrl = getZapSignBaseUrl(sandbox)
  const response = await fetch(`${baseUrl}/docs/${docToken}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token.trim()}`,
    },
    cache: 'no-store'
  })

  const rawText = await response.text()
  let data: any = {}
  try {
    data = JSON.parse(rawText)
  } catch (e) {
    // Não é JSON
  }

  if (!response.ok) {
    const errorDetail = data?.message || data?.detail || rawText || `Erro HTTP ${response.status}`
    throw new Error(`Erro ao consultar documento no ZapSign (${response.status}): ${errorDetail}`)
  }

  return data as ZapSignDocResponse
}

/**
 * Cancela/Exclui um documento no ZapSign
 */
export async function cancelarDocumentoZapSign(
  docToken: string,
  apiToken?: string,
  sandbox = false
): Promise<{ success: boolean; message?: string }> {
  const token = apiToken || process.env.ZAPSIGN_API_TOKEN
  if (!token) {
    throw new Error('Token da API do ZapSign não configurado.')
  }

  const baseUrl = getZapSignBaseUrl(sandbox)
  const response = await fetch(`${baseUrl}/docs/${docToken}/`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token.trim()}`,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const errorDetail = data?.message || data?.detail || 'Erro ao cancelar'
    throw new Error(`Erro ao cancelar documento no ZapSign (${response.status}): ${errorDetail}`)
  }

  return { success: true }
}

/**
 * Testa a conexão com a API do ZapSign usando o token informado
 */
export async function testarConexaoZapSign(
  apiToken: string,
  sandbox = false
): Promise<{ ok: boolean; message: string; user?: any }> {
  const cleanToken = (apiToken || '').trim()
  if (!cleanToken) {
    return { ok: false, message: 'O token da API não pode estar em branco.' }
  }

  const baseUrl = getZapSignBaseUrl(sandbox)
  try {
    // ZapSign listagem de docs limit=1 para testar o token
    const response = await fetch(`${baseUrl}/docs/?page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
      },
      cache: 'no-store'
    })

    if (response.ok) {
      return { 
        ok: true, 
        message: `Conexão bem-sucedida com o ZapSign (${sandbox ? 'Ambiente de Testes / Sandbox' : 'Ambiente de Produção'})!` 
      }
    }

    if (response.status === 401 || response.status === 403) {
      if (sandbox) {
        return {
          ok: false,
          message: 'Token inválido no Sandbox. Atenção: Tokens gerados na conta padrão (app.zapsign.com.br) são de PRODUÇÃO. Desative o switch "Ambiente de Testes (Sandbox)" para conectar com sucesso!'
        }
      }
      return { 
        ok: false, 
        message: 'Token de API inválido ou sem permissão de acesso no ZapSign. Verifique se o token foi copiado integralmente em Configurações > Integrações > API.' 
      }
    }

    const err = await response.json().catch(() => ({}))
    return { ok: false, message: `Falha na autenticação (${response.status}): ${err?.detail || err?.message || 'Erro desconhecido'}` }
  } catch (err: any) {
    return { ok: false, message: `Erro de conexão com o ZapSign: ${err.message}` }
  }
}

/**
 * Função utilitária centralizada para sincronizar um contrato individual com a API do ZapSign
 */
export async function syncContratoWithZapSign(
  contrato: any,
  apiToken: string,
  defaultSandbox: boolean
) {
  const docToken = contrato?.zapsign_doc_token
  if (!docToken) return { updated: false, updates: {}, contratoAtualizado: contrato, zapDoc: null }

  const isSandbox = contrato?.metadata?.isSandbox !== undefined
    ? Boolean(contrato.metadata.isSandbox)
    : Boolean(defaultSandbox)

  const zapDoc = await consultarDocumentoZapSign(docToken, apiToken, isSandbox)

  const signersList: any[] = Array.isArray(zapDoc.signers) ? zapDoc.signers : []
  const totalSigners = signersList.length || 1

  const assinados = signersList.filter((s: any) =>
    s.status === 'signed' || Boolean(s.signed_at) || (Number(s.times_signed) > 0)
  )
  const numAssinados = assinados.length

  const pendentes = signersList.filter((s: any) =>
    !(s.status === 'signed' || Boolean(s.signed_at) || (Number(s.times_signed) > 0))
  )

  // Status rigoroso: se o documento está 'signed' no ZapSign OU se todos os signatários assinaram
  let novoStatus = 'aguardando'
  if (zapDoc.status === 'refused') {
    novoStatus = 'recusado'
  } else if (zapDoc.status === 'canceled') {
    novoStatus = 'cancelado'
  } else if (zapDoc.status === 'signed' || (totalSigners > 0 && numAssinados >= totalSigners)) {
    novoStatus = 'assinado'
  } else {
    novoStatus = 'aguardando'
  }

  const isCompleted = novoStatus === 'assinado'
  const firstSigner = signersList[0]
  const escolaSigner = signersList.length > 1 ? signersList[1] : undefined

  const currentMetadata = (contrato?.metadata && typeof contrato.metadata === 'object') ? contrato.metadata : {}
  const normalizedSigners = signersList.map((s: any) => ({
    ...s,
    status: isCompleted ? 'signed' : (s.status || 'pending'),
    signed_at: s.signed_at || (isCompleted ? (contrato.updated_at || new Date().toISOString()) : null)
  }))

  const updatedMetadata = {
    ...currentMetadata,
    signers: normalizedSigners.length > 0 ? normalizedSigners : (currentMetadata.signers || []),
    totalSigners,
    numAssinados: isCompleted ? totalSigners : numAssinados,
    pendentes: isCompleted ? [] : pendentes.map((p: any) => ({
      name: p.name,
      email: p.email,
      phoneNumber: p.phone_number,
      qualification: p.qualification,
    })),
    escolaSignUrl: escolaSigner?.sign_url || currentMetadata.escolaSignUrl || null,
    lastStatusCheck: new Date().toISOString(),
  }

  const updates: any = {
    status: novoStatus,
    zapsign_status: zapDoc.status,
    signed_file_url: zapDoc.signed_file || contrato?.signed_file_url || null,
    zapsign_sign_url: firstSigner?.sign_url || contrato?.zapsign_sign_url,
    metadata: updatedMetadata,
    updated_at: new Date().toISOString(),
  }

  const hasChanged = contrato.status !== novoStatus ||
    contrato.zapsign_status !== zapDoc.status ||
    (!contrato.signed_file_url && Boolean(updates.signed_file_url))

  return {
    updated: hasChanged,
    updates,
    contratoAtualizado: { ...contrato, ...updates },
    zapDoc,
  }
}

