import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  testarConexaoZapSign,
  DEFAULT_MENSAGEM_WHATSAPP_CONTRATANTE,
  DEFAULT_MENSAGEM_WHATSAPP_CONTRATADO
} from '@/lib/zapsign'

export const dynamic = 'force-dynamic'

const CONFIG_CHAVE = 'cfgZapSignInteg'

export interface SignatarioEscola {
  id: string
  cnpj: string
  razaoSocial: string
  nomeRepresentante: string
  cargo: string
  email: string
  celular: string
  isDefault: boolean
}

export interface ZapSignConfig {
  apiToken: string
  sandbox: boolean
  authModePadrao: 'tokenWhatsapp' | 'tokenEmail' | 'assinaturaTela'
  authModeContratantePadrao?: 'tokenWhatsapp' | 'tokenEmail'
  authModeContratadoPadrao?: 'tokenWhatsapp' | 'tokenEmail'
  envioAutomaticoWhatsapp: boolean
  envioAutomaticoEmail: boolean
  signatariosEscola?: SignatarioEscola[]
  mensagemWhatsappContratante?: string
  mensagemWhatsappContratado?: string
  updatedAt?: string
}

const DEFAULT_SIGNATARIOS_ESCOLA: SignatarioEscola[] = [
  {
    id: 'escola-default-1',
    cnpj: '04.395.789/0001-88',
    razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
    nomeRepresentante: 'Direção Geral',
    cargo: 'Diretor Geral / Representante Legal',
    email: 'secretaria@colegioimpacto.com.br',
    celular: '(67) 3000-0000',
    isDefault: true
  }
]

const DEFAULT_CONFIG: ZapSignConfig = {
  apiToken: process.env.ZAPSIGN_API_TOKEN || '',
  sandbox: false,
  authModePadrao: 'tokenWhatsapp',
  authModeContratantePadrao: 'tokenWhatsapp',
  authModeContratadoPadrao: 'tokenWhatsapp',
  envioAutomaticoWhatsapp: true,
  envioAutomaticoEmail: false,
  signatariosEscola: DEFAULT_SIGNATARIOS_ESCOLA,
  mensagemWhatsappContratante: DEFAULT_MENSAGEM_WHATSAPP_CONTRATANTE,
  mensagemWhatsappContratado: DEFAULT_MENSAGEM_WHATSAPP_CONTRATADO,
}

export async function GET() {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', CONFIG_CHAVE)
      .maybeSingle()

    const savedVal = data?.valor || {}
    const config: ZapSignConfig = {
      ...DEFAULT_CONFIG,
      ...savedVal,
      apiToken: savedVal.apiToken || process.env.ZAPSIGN_API_TOKEN || '',
      authModeContratantePadrao: savedVal.authModeContratantePadrao || savedVal.authModePadrao || 'tokenWhatsapp',
      authModeContratadoPadrao: savedVal.authModeContratadoPadrao || savedVal.authModePadrao || 'tokenWhatsapp',
      mensagemWhatsappContratante: String(savedVal.mensagemWhatsappContratante || DEFAULT_MENSAGEM_WHATSAPP_CONTRATANTE).replace(/\uFFFD/g, '✍️'),
      mensagemWhatsappContratado: String(savedVal.mensagemWhatsappContratado || DEFAULT_MENSAGEM_WHATSAPP_CONTRATADO).replace(/\uFFFD/g, '✍️'),
      signatariosEscola: Array.isArray(savedVal.signatariosEscola) && savedVal.signatariosEscola.length > 0
        ? savedVal.signatariosEscola
        : DEFAULT_SIGNATARIOS_ESCOLA,
    }

    // Mascarar o token para exibição se não for vazio
    const maskedToken = config.apiToken
      ? config.apiToken.length > 8
        ? `${config.apiToken.slice(0, 4)}••••••••${config.apiToken.slice(-4)}`
        : '••••••••'
      : ''

    return NextResponse.json({
      config,
      hasToken: Boolean(config.apiToken && config.apiToken.trim()),
      maskedToken,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const {
      action,
      apiToken,
      sandbox,
      authModePadrao,
      authModeContratantePadrao,
      authModeContratadoPadrao,
      envioAutomaticoWhatsapp,
      envioAutomaticoEmail,
      signatariosEscola,
      mensagemWhatsappContratante,
      mensagemWhatsappContratado
    } = body

    const supabase = getAdminClient()

    // Ação: Testar conexão
    if (action === 'test_connection') {
      let tokenToTest = apiToken
      if (!tokenToTest) {
        // Busca token salvo
        const { data } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', CONFIG_CHAVE)
          .maybeSingle()
        tokenToTest = data?.valor?.apiToken || process.env.ZAPSIGN_API_TOKEN
      }

      const result = await testarConexaoZapSign(tokenToTest, Boolean(sandbox))
      return NextResponse.json(result)
    }

    // Ação: Salvar configurações
    // Recupera configuração atual
    const { data: existing } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', CONFIG_CHAVE)
      .maybeSingle()

    const currentVal = existing?.valor || DEFAULT_CONFIG

    const effectiveContratante = authModeContratantePadrao || authModePadrao || currentVal.authModeContratantePadrao || currentVal.authModePadrao || 'tokenWhatsapp'
    const effectiveContratado = authModeContratadoPadrao || currentVal.authModeContratadoPadrao || currentVal.authModePadrao || 'tokenWhatsapp'

    const newVal: ZapSignConfig = {
      apiToken: apiToken !== undefined ? String(apiToken).trim() : currentVal.apiToken,
      sandbox: sandbox !== undefined ? Boolean(sandbox) : currentVal.sandbox,
      authModePadrao: effectiveContratante,
      authModeContratantePadrao: effectiveContratante,
      authModeContratadoPadrao: effectiveContratado,
      envioAutomaticoWhatsapp: envioAutomaticoWhatsapp !== undefined ? Boolean(envioAutomaticoWhatsapp) : currentVal.envioAutomaticoWhatsapp,
      envioAutomaticoEmail: envioAutomaticoEmail !== undefined ? Boolean(envioAutomaticoEmail) : currentVal.envioAutomaticoEmail,
      signatariosEscola: Array.isArray(signatariosEscola)
        ? signatariosEscola
        : (currentVal.signatariosEscola || DEFAULT_SIGNATARIOS_ESCOLA),
      mensagemWhatsappContratante: mensagemWhatsappContratante !== undefined
        ? String(mensagemWhatsappContratante).replace(/\uFFFD/g, '✍️')
        : String(currentVal.mensagemWhatsappContratante || DEFAULT_MENSAGEM_WHATSAPP_CONTRATANTE).replace(/\uFFFD/g, '✍️'),
      mensagemWhatsappContratado: mensagemWhatsappContratado !== undefined
        ? String(mensagemWhatsappContratado).replace(/\uFFFD/g, '✍️')
        : String(currentVal.mensagemWhatsappContratado || DEFAULT_MENSAGEM_WHATSAPP_CONTRATADO).replace(/\uFFFD/g, '✍️'),
      updatedAt: new Date().toISOString(),
    }

    const { error: upsertErr } = await supabase
      .from('configuracoes')
      .upsert({
        chave: CONFIG_CHAVE,
        valor: newVal,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' })

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações do ZapSign atualizadas com sucesso!',
      config: newVal,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
