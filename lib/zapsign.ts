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
}

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
    const errorDetail = data?.message || data?.detail || rawText || `Erro HTTP ${response.status}`
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
