import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { testarConexaoSmtp, executarDiagnosticoSmtp, enviarEmailTeste, SmtpConfig } from '@/lib/server/emailService'

export const dynamic = 'force-dynamic'

const CONFIG_REPRESENTANTE_KEY = 'cfgEscolaRepresentante'
const CONFIG_REPRESENTANTES_KEY = 'cfgEscolaRepresentantes'
const CONFIG_LOGO_KEY = 'cfgEscolaLogo'
const CONFIG_SMTP_KEY = 'cfgEmailSmtp'
const CONFIG_WHATSAPP_KEY = 'cfgWhatsAppMatriculaDigital'

const DEFAULT_REPRESENTANTES = [
  {
    id: 'rep_infantil_fundamental',
    nome: 'IVAN ROSSI SAMBRANA',
    cpf: '00130220167',
    cargo: 'Representante Legal / Diretor Geral',
    razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
    cnpj: '04.395.789/0001-88',
    email: 'direcao@colegioimpacto.net',
    telefone: '(67) 99280-6464',
    endereco: 'Rua Alagoas, 1081 - Jardim dos Estados',
    cidadeUf: 'Campo Grande - MS',
    segmento: 'Educação Infantil e Ensino Fundamental',
    padrao: true,
  },
  {
    id: 'rep_ensino_medio',
    nome: 'IVAN ROSSI SAMBRANA',
    cpf: '00130220167',
    cargo: 'Representante Legal / Diretor Geral',
    razaoSocial: 'CENTRO DE ENSINO IMPACTO LTDA',
    cnpj: '04.397.021/0001-43',
    email: 'direcao@colegioimpacto.net',
    telefone: '(67) 99280-6464',
    endereco: 'Rua Alagoas, 1081 - Jardim dos Estados',
    cidadeUf: 'Campo Grande - MS',
    segmento: 'Ensino Médio',
    padrao: false,
  },
]

const DEFAULT_REPRESENTANTE = DEFAULT_REPRESENTANTES[0]

const DEFAULT_WHATSAPP = `Olá, {responsavel}! 💙\nO Colégio Impacto disponibilizou o Contrato de Matrícula {ano} do(a) estudante *{aluno}* para assinatura digital.\n\n✍️ *Acesse com segurança pelo link oficial:*\n{link_assinatura}\n\nAo acessar, você confirmará um código de segurança enviado para o seu e-mail cadastrado. Agradecemos pela confiança na nossa escola!`

/**
 * GET /api/matriculas/digital/configuracoes
 */
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const { data: rows } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        CONFIG_REPRESENTANTE_KEY,
        CONFIG_REPRESENTANTES_KEY,
        CONFIG_LOGO_KEY,
        CONFIG_SMTP_KEY,
        CONFIG_WHATSAPP_KEY,
        'cfgCalendarioLetivo',
      ])

    const rowMap = new Map((rows || []).map(r => [r.chave, r.valor]))

    // Trata anos letivos cadastrados e determina com precisão o último cadastrado
    const calList: any[] = Array.isArray(rowMap.get('cfgCalendarioLetivo')) ? rowMap.get('cfgCalendarioLetivo') : []
    const anosValidos = calList
      .filter((c: any) => c && c.ano)
      .map((c: any) => ({
        ano: String(c.ano).trim(),
        criadoEm: c.criadoEm || c.createdAt || '',
      }))
      .sort((a, b) => {
        const timeA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0
        const timeB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0
        if (timeA !== timeB) return timeB - timeA
        return Number(b.ano) - Number(a.ano)
      })

    const anosLetivos = Array.from(new Set(anosValidos.map(a => a.ano)))
    const ultimoAnoCadastrado = anosValidos[0]?.ano || String(new Date().getFullYear())

    // Trata lista de representantes com fallback para os dois CNPJs padrões
    let representantes: any[] = rowMap.get(CONFIG_REPRESENTANTES_KEY)
    if (!Array.isArray(representantes) || representantes.length === 0) {
      const repSingular = rowMap.get(CONFIG_REPRESENTANTE_KEY)
      if (repSingular && repSingular.nome) {
        representantes = [
          { ...DEFAULT_REPRESENTANTES[0], ...repSingular, id: repSingular.id || DEFAULT_REPRESENTANTES[0].id },
          DEFAULT_REPRESENTANTES[1],
        ]
      } else {
        representantes = DEFAULT_REPRESENTANTES
      }
    }

    const representante = representantes.find(r => r.padrao) || representantes[0] || DEFAULT_REPRESENTANTE
    const logoUrl = rowMap.get(CONFIG_LOGO_KEY) || '/logo-impacto-clean.png'
    const whatsappTemplate = rowMap.get(CONFIG_WHATSAPP_KEY) || DEFAULT_WHATSAPP
    const smtpRow = rowMap.get(CONFIG_SMTP_KEY) || {}
    const passSalva = smtpRow.pass || process.env.SMTP_PASS || ''

    return NextResponse.json({
      representante,
      representantes,
      logoUrl,
      whatsappTemplate,
      anosLetivos,
      ultimoAnoCadastrado,
      smtp: {
        host: smtpRow.host || 'email-ssl.com.br',
        port: Number(smtpRow.port) || 587,
        secure: smtpRow.secure !== undefined ? Boolean(smtpRow.secure) : (Number(smtpRow.port) || 587) === 465,
        user: smtpRow.user || 'direcao@colegioimpacto.net',
        pass: passSalva,
        passMascarado: passSalva ? '••••••••' : '',
        fromEmail: smtpRow.fromEmail || smtpRow.user || 'direcao@colegioimpacto.net',
        fromName: smtpRow.fromName || 'Colégio Impacto - Matrícula Digital',
        configurado: Boolean(smtpRow.host && smtpRow.user && passSalva),
      },
    })
  } catch (err: any) {
    console.error('[API Configs] Erro ao carregar:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/matriculas/digital/configuracoes
 * Salva representantes, logo, template de WhatsApp ou testa/salva SMTP
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = getAdminClient()

    // 1. Teste de conexão SMTP ou Envio de E-mail de Teste
    if (body.action === 'test_smtp' || body.action === 'test_connection' || body.action === 'send_test_email') {
      const clientCfg: Partial<SmtpConfig> = body.smtp || {}
      const existing = (await supabase.from('configuracoes').select('valor').eq('chave', CONFIG_SMTP_KEY).maybeSingle()).data?.valor || {}
      let passEfetiva = clientCfg.pass ? String(clientCfg.pass).trim() : ''
      if (!passEfetiva || passEfetiva === '••••••••') {
        passEfetiva = existing.pass || process.env.SMTP_PASS || ''
      }

      const port = Number(clientCfg.port || existing.port) || 587
      const cfg: SmtpConfig = {
        host: String(clientCfg.host || existing.host || 'email-ssl.com.br').trim(),
        port,
        secure: port === 465 ? true : Boolean(clientCfg.secure),
        user: String(clientCfg.user || existing.user || 'direcao@colegioimpacto.net').trim(),
        pass: passEfetiva,
        fromEmail: clientCfg.fromEmail || existing.fromEmail || clientCfg.user || existing.user || 'direcao@colegioimpacto.net',
        fromName: clientCfg.fromName || existing.fromName || 'Colégio Impacto - Matrícula Digital',
      }

      if (body.action === 'send_test_email') {
        const dest = body.destinatario || cfg.user
        const sendResult = await enviarEmailTeste(cfg, dest)
        return NextResponse.json(sendResult)
      }

      const testResult = await executarDiagnosticoSmtp(cfg)
      return NextResponse.json({
        success: testResult.success,
        mensagemGeral: testResult.mensagemGeral,
        error: testResult.success ? undefined : testResult.mensagemGeral,
        steps: testResult.steps,
      })
    }

    // 2. Salvar representantes da escola (múltiplos por CNPJ)
    if (body.representantes && Array.isArray(body.representantes)) {
      await supabase.from('configuracoes').upsert({
        chave: CONFIG_REPRESENTANTES_KEY,
        valor: body.representantes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })

      // Atualiza também a chave singular com o padrão para compatibilidade com partes legadas
      const repPadrao = body.representantes.find((r: any) => r.padrao) || body.representantes[0]
      if (repPadrao) {
        await supabase.from('configuracoes').upsert({
          chave: CONFIG_REPRESENTANTE_KEY,
          valor: repPadrao,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chave' })
      }
    } else if (body.representante) {
      await supabase.from('configuracoes').upsert({
        chave: CONFIG_REPRESENTANTE_KEY,
        valor: body.representante,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })
    }

    // 3. Salvar logotipo oficial
    if (body.logoUrl !== undefined) {
      await supabase.from('configuracoes').upsert({
        chave: CONFIG_LOGO_KEY,
        valor: body.logoUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })
    }

    // 4. Salvar template de WhatsApp
    if (body.whatsappTemplate) {
      await supabase.from('configuracoes').upsert({
        chave: CONFIG_WHATSAPP_KEY,
        valor: body.whatsappTemplate,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })
    }

    // 5. Salvar configurações de SMTP (Padrão Locaweb: email-ssl.com.br:465)
    if (body.smtp) {
      const existing = (await supabase.from('configuracoes').select('valor').eq('chave', CONFIG_SMTP_KEY).maybeSingle()).data?.valor || {}
      const port = Number(body.smtp.port) || 465
      const passEnviada = body.smtp.pass !== undefined && body.smtp.pass !== null ? String(body.smtp.pass).trim() : ''
      const passFinal = (passEnviada && passEnviada !== '••••••••') ? passEnviada : (existing.pass || process.env.SMTP_PASS || '')

      const smtpPayload = {
        host: String(body.smtp.host || existing.host || 'email-ssl.com.br').trim(),
        port,
        secure: port === 465 ? true : Boolean(body.smtp.secure),
        user: String(body.smtp.user || existing.user || 'direcao@colegioimpacto.net').trim(),
        pass: passFinal,
        fromEmail: body.smtp.fromEmail || body.smtp.user || existing.fromEmail || 'direcao@colegioimpacto.net',
        fromName: body.smtp.fromName || existing.fromName || 'Colégio Impacto - Matrícula Digital',
      }

      await supabase.from('configuracoes').upsert({
        chave: CONFIG_SMTP_KEY,
        valor: smtpPayload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })
    }

    return NextResponse.json({ success: true, message: 'Configurações salvas com sucesso.' })
  } catch (err: any) {
    console.error('[API Configs] Erro ao salvar:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
