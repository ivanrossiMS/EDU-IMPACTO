import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  executarDiagnosticoSmtp,
  enviarEmailTeste,
  SmtpConfig,
} from '@/lib/server/emailService'

export const dynamic = 'force-dynamic'

const CONFIG_SMTP_KEY = 'cfgEmailSmtp'

/**
 * POST /api/matriculas/digital/configuracoes/teste-smtp
 * Executa diagnóstico de conexão SMTP passo a passo ou disparo de e-mail de teste.
 * Retorna JSON estruturado e compatível com todos os navegadores (incluindo Safari/WebKit).
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { action = 'test_connection', smtp: clientSmtp = {}, destinatario } = body

    // 1. Resolução inteligente de credenciais (recupera senha gravada se vier vazia ou mascarada)
    const supabase = getAdminClient()
    const dbRow = (
      await supabase.from('configuracoes').select('valor').eq('chave', CONFIG_SMTP_KEY).maybeSingle()
    ).data?.valor || {}

    let passEfetiva = clientSmtp.pass ? String(clientSmtp.pass).trim() : ''
    if (!passEfetiva || passEfetiva === '••••••••') {
      passEfetiva = dbRow.pass || process.env.SMTP_PASS || ''
    }

    const hostEfetivo = String(clientSmtp.host || dbRow.host || 'email-ssl.com.br').trim()
    const portEfetiva = Number(clientSmtp.port || dbRow.port) || 587
    const userEfetivo = String(clientSmtp.user || dbRow.user || 'direcao@colegioimpacto.net').trim()

    const resolvedConfig: SmtpConfig = {
      host: hostEfetivo,
      port: portEfetiva,
      secure: clientSmtp.secure !== undefined ? Boolean(clientSmtp.secure) : portEfetiva === 465,
      user: userEfetivo,
      pass: passEfetiva,
      fromEmail: clientSmtp.fromEmail || dbRow.fromEmail || userEfetivo,
      fromName: clientSmtp.fromName || dbRow.fromName || 'Colégio Impacto - Matrícula Digital',
    }

    if (action === 'send_test_email') {
      const dest = destinatario || resolvedConfig.user
      const result = await enviarEmailTeste(resolvedConfig, dest)
      return NextResponse.json(result)
    }

    // Diagnóstico completo de procedimentos SMTP
    const result = await executarDiagnosticoSmtp(resolvedConfig)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[API Teste SMTP] Erro geral:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro interno ao processar teste SMTP.',
      steps: [],
    }, { status: 500 })
  }
}
