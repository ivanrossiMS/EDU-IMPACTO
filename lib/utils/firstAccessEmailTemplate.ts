/**
 * lib/utils/firstAccessEmailTemplate.ts
 *
 * Template HTML ultra-moderno e responsivo para o convite de Primeiro Acesso
 * ao Aplicativo Oficial Impacto EDU & Agenda Digital (iOS e Android).
 * Isomorfo: pode ser utilizado tanto pelo servidor SMTP (emailService.ts)
 * quanto pelo painel administrativo para pré-visualização em tempo real.
 */

export const DEFAULT_GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=br.com.impactoedu.agenda'

export const DEFAULT_APP_STORE_URL =
  'https://apps.apple.com/br/app/impacto-edu/id6798868153'

export interface AlunoVinculadoConvite {
  nome: string
  turma?: string
}

export interface ConvitePrimeiroAcessoTemplateParams {
  nomeDestinatario: string
  emailDestinatario: string
  categoria?: 'responsavel' | 'aluno' | 'colaborador'
  alunosVinculados?: AlunoVinculadoConvite[]
  firstAccessUrl?: string
  googlePlayUrl?: string
  appStoreUrl?: string
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extrairPrimeiroNome(nomeCompleto: string): string {
  const limpo = String(nomeCompleto || '').trim()
  if (!limpo) return 'Família'
  const partes = limpo.split(/\s+/)
  const primeiro = partes[0]
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase()
}

export function gerarTextoPlanoConvitePrimeiroAcessoApp(
  params: ConvitePrimeiroAcessoTemplateParams
): string {
  const nome = params.nomeDestinatario || 'Responsável'
  const email = (params.emailDestinatario || '').trim().toLowerCase()
  const googlePlayUrl = (params.googlePlayUrl || DEFAULT_GOOGLE_PLAY_URL).trim()
  const appStoreUrl = (params.appStoreUrl || DEFAULT_APP_STORE_URL).trim()
  const firstAccessUrl =
    params.firstAccessUrl ||
    `https://impacto-edu.net/login?step=first_access_verify&email=${encodeURIComponent(email)}`

  const alunosLista =
    params.alunosVinculados && params.alunosVinculados.length > 0
      ? `\nEstudante(s) vinculado(s): ${params.alunosVinculados
          .map(a => (a.turma ? `${a.nome} (${a.turma})` : a.nome))
          .join(', ')}\n`
      : ''

  return [
    `COLÉGIO IMPACTO • APLICATIVO OFICIAL & AGENDA DIGITAL`,
    ``,
    `Olá, ${nome}!`,
    ``,
    `Notamos que você ainda não realizou o seu Primeiro Acesso no aplicativo oficial Impacto EDU e na nossa Agenda Digital.`,
    alunosLista,
    `Com o aplicativo Impacto EDU no seu celular, você acompanha toda a rotina escolar em tempo real:`,
    `• Comunicados e Avisos Oficiais com notificações instantâneas (Push)`,
    `• Saída Inteligente ("Chamar Aluno" na Portaria) com aviso em 1 toque e autorizações de retirada`,
    `• Momentos e Galeria de Fotos das atividades e projetos da turma`,
    `• Boletim Digital, Notas Bimestrais e Desempenho Acadêmico`,
    `• Frequência Diária e Calendário Escolar de Provas e Eventos`,
    `• Acompanhamento Pedagógico, Ocorrências e confirmação de ciência digital`,
    `• Provas Online, Simulados e Resultados`,
    `• Financeiro Digital (Mensalidades, PIX, Boletos e Histórico)`,
    ``,
    `COMO FAZER SEU 1º ACESSO EM 1 MINUTO:`,
    `1. Acesse o link direto de ativação abaixo ou abra o app Impacto EDU:`,
    `${firstAccessUrl}`,
    `2. Na tela de login, toque em "Primeiro Acesso" e confirme seu e-mail (${email}).`,
    `3. Digite o código de 6 dígitos que enviaremos ao seu e-mail e crie sua senha pessoal!`,
    ``,
    `BAIXE O APLICATIVO IMPACTO EDU NO SEU CELULAR:`,
    `• iPhone / iPad (App Store): ${appStoreUrl}`,
    `• Android (Google Play): ${googlePlayUrl}`,
    ``,
    `Colégio Impacto Centro de Ensino • Campo Grande - MS`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function gerarHtmlConvitePrimeiroAcessoApp(
  params: ConvitePrimeiroAcessoTemplateParams
): string {
  const nomeCompleto = escapeHtml(params.nomeDestinatario || 'Responsável')
  const primeiroNome = escapeHtml(extrairPrimeiroNome(params.nomeDestinatario || 'Responsável'))
  const emailRaw = (params.emailDestinatario || '').trim().toLowerCase()
  const emailEscaped = escapeHtml(emailRaw)
  const categoria = params.categoria || 'responsavel'

  const googlePlayUrl = escapeHtml((params.googlePlayUrl || DEFAULT_GOOGLE_PLAY_URL).trim())
  const appStoreUrl = escapeHtml((params.appStoreUrl || DEFAULT_APP_STORE_URL).trim())
  const firstAccessUrl = escapeHtml(
    params.firstAccessUrl ||
      `https://impacto-edu.net/login?step=first_access_verify&email=${encodeURIComponent(emailRaw)}`
  )

  const alunos = Array.isArray(params.alunosVinculados) ? params.alunosVinculados : []

  const subtituloContextual =
    categoria === 'aluno'
      ? 'Seu portal do estudante e agenda interativa já estão prontos para ativação!'
      : categoria === 'colaborador'
      ? 'Seu acesso corporativo e pedagógico na plataforma Impacto EDU aguarda ativação!'
      : 'Acompanhe cada conquista, comunicado e rotina escolar do seu filho(a) em tempo real direto no celular!'

  const blocoAlunosHtml =
    alunos.length > 0
      ? `
              <!-- Card de Vínculo Familiar -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #059669; margin-bottom: 8px;">
                      🎓 ${alunos.length === 1 ? 'Estudante Vinculado ao Seu Acesso' : 'Estudantes Vinculados ao Seu Acesso'}
                    </div>
                    ${alunos
                      .map(
                        a => `
                    <div style="padding: 6px 0; font-size: 14px; font-weight: 700; color: #064e3b;">
                      • ${escapeHtml(a.nome)}${
                          a.turma
                            ? ` <span style="display: inline-block; margin-left: 6px; padding: 2px 8px; background-color: #dcfce7; color: #15803d; border-radius: 999px; font-size: 11px; font-weight: 700;">${escapeHtml(
                                a.turma
                              )}</span>`
                            : ''
                        }
                    </div>`
                      )
                      .join('')}
                  </td>
                </tr>
              </table>`
      : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Ative seu 1º Acesso no App Impacto EDU - Colégio Impacto</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, div, span, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f6; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <!-- Preheader oculto para preview nos clientes de e-mail -->
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px; color: #eef2f6;">
    Olá, ${primeiroNome}! Seu primeiro acesso ao App Oficial e Agenda Digital do Colégio Impacto está liberado. Baixe no iPhone ou Android e ative em 1 minuto!
  </div>

  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #eef2f6; width: 100%; margin: 0; padding: 24px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <!-- Container Principal (600px) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 20px; border: 1px solid #dbe3ef; border-collapse: separate; overflow: hidden; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);">
          
          <!-- BARRA DE TOPO LUMINOSA -->
          <tr>
            <td bgcolor="#2563eb" style="height: 5px; background: linear-gradient(90deg, #4f46e5 0%, #2563eb 50%, #10b981 100%); font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>

          <!-- HERO HEADER ULTRA MODERNO -->
          <tr>
            <td align="center" bgcolor="#081636" style="background-color: #081636; background-image: linear-gradient(145deg, #07122b 0%, #0f2557 52%, #1d4ed8 100%); padding: 38px 28px 34px 28px; text-align: center;">
              
              <!-- Pílula de Destaque Superior -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 18px auto;">
                <tr>
                  <td align="center" bgcolor="#1e3a8a" style="background-color: rgba(59, 130, 246, 0.22); border: 1px solid rgba(147, 197, 253, 0.35); border-radius: 999px; padding: 6px 16px;">
                    <span style="font-size: 11px; font-weight: 800; color: #93c5fd !important; letter-spacing: 1px; text-transform: uppercase;">
                      ✨ APLICATIVO OFICIAL &amp; AGENDA DIGITAL
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Selo Circular com Logomarca Oficial -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 16px auto;">
                <tr>
                  <td align="center" bgcolor="#ffffff" style="background-color: #ffffff; width: 68px; height: 68px; border-radius: 50%; padding: 6px; text-align: center; vertical-align: middle; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);">
                    <img src="https://impacto-edu.net/logo-impacto-clean.png" alt="Colégio Impacto" width="56" height="56" style="display: block; margin: 0 auto; width: 56px; height: 56px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>

              <!-- Título Hero -->
              <h1 style="margin: 0 0 10px 0; padding: 0; font-size: 26px; font-weight: 900; color: #ffffff !important; letter-spacing: -0.3px; line-height: 1.22;">
                O Colégio Impacto na Palma da Sua Mão
              </h1>

              <!-- Subtítulo Hero -->
              <p style="margin: 0 auto; max-width: 470px; padding: 0; font-size: 14px; font-weight: 500; color: #bfdbfe !important; line-height: 1.55;">
                ${subtituloContextual}
              </p>

              <!-- Botões Rápidos de Loja no Topo -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 22px auto 0 auto;">
                <tr>
                  <td align="center" style="padding: 0 5px;">
                    <a href="${appStoreUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #0f172a !important; text-decoration: none; padding: 10px 18px; border-radius: 10px; font-size: 12px; font-weight: 800; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                      &#63743; App Store (iPhone)
                    </a>
                  </td>
                  <td align="center" style="padding: 0 5px;">
                    <a href="${googlePlayUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 10px; font-size: 12px; font-weight: 800; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                      &#9654; Google Play (Android)
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- CORPO PRINCIPAL -->
          <tr>
            <td style="padding: 32px 28px 24px 28px; text-align: left; font-size: 14px; line-height: 1.65; color: #334155;">
              
              <!-- Saudação Personalizada -->
              <div style="font-size: 19px; font-weight: 800; color: #0f172a; margin-bottom: 10px; letter-spacing: -0.2px;">
                Olá, ${nomeCompleto}! 👋
              </div>

              <p style="margin: 0 0 18px 0; font-size: 14.5px; color: #475569; line-height: 1.65;">
                Identificamos em nosso sistema que o seu <strong style="color: #0f172a;">Primeiro Acesso</strong> na plataforma <strong style="color: #1d4ed8;">Impacto EDU</strong> ainda está pendente de ativação. Preparamos uma experiência digital completa, moderna e intuitiva para aproximar ainda mais você da rotina escolar!
              </p>

              ${blocoAlunosHtml}

              <!-- CARD DE ATIVAÇÃO IMEDIATA (PRIMEIRO ACESSO) -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0; background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%); background-color: #eff6ff; border: 2px solid #93c5fd; border-radius: 16px;">
                <tr>
                  <td align="center" style="padding: 24px 20px; text-align: center;">
                    <div style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 999px; margin-bottom: 10px;">
                      ⚡ Ativação Rápida em 1 Minuto
                    </div>
                    <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
                      Sua conta já está pré-cadastrada!
                    </div>
                    <div style="font-size: 13px; color: #475569; margin-bottom: 16px; line-height: 1.5;">
                      Utilize o seu e-mail oficial abaixo para validar seu código de segurança e criar sua senha:
                    </div>

                    <!-- Caixa do E-mail de Login -->
                    <div style="background-color: #ffffff; border: 1px dashed #60a5fa; border-radius: 10px; padding: 10px 16px; margin: 0 auto 18px auto; max-width: 420px;">
                      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.06em;">
                        Seu E-mail de Acesso
                      </div>
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 800; color: #1e3a8a; word-break: break-all; margin-top: 2px;">
                        ${emailEscaped}
                      </div>
                    </div>

                    <!-- Botão Principal CTA -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                      <tr>
                        <td align="center" bgcolor="#2563eb" style="background-color: #2563eb; border-radius: 12px; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.32);">
                          <a href="${firstAccessUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; background-image: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 800; font-size: 15px; letter-spacing: 0.2px; text-align: center;">
                            🚀 Fazer Meu Primeiro Acesso Agora
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- TÍTULO DA VITRINE DE FUNCIONALIDADES -->
              <div style="text-align: center; margin-bottom: 18px;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb; margin-bottom: 4px;">
                  ECOSSISTEMA COMPLETO
                </div>
                <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px;">
                  Tudo o que espera por você na Agenda Digital
                </h2>
              </div>

              <!-- BENTO GRID DE FUNCIONALIDADES (8 MÓDULOS) -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                
                <!-- Feature 1: Comunicados & Avisos Push -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 12px;">
                      <tr>
                        <td width="48" valign="top" style="padding: 14px 0 14px 16px; font-size: 22px; line-height: 1;">🔔</td>
                        <td valign="top" style="padding: 14px 16px 14px 8px;">
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">Comunicados &amp; Notificações em Tempo Real</div>
                          <div style="font-size: 12.5px; color: #475569; line-height: 1.5;">Receba circulares, avisos da coordenação e lembretes importantes com alertas instantâneos (Push) direto no seu celular.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Feature 2: Saída Inteligente / Chamar Aluno -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 12px;">
                      <tr>
                        <td width="48" valign="top" style="padding: 14px 0 14px 16px; font-size: 22px; line-height: 1;">🚗</td>
                        <td valign="top" style="padding: 14px 16px 14px 8px;">
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">Saída Inteligente (&ldquo;Chamar Aluno&rdquo; na Portaria)</div>
                          <div style="font-size: 12.5px; color: #475569; line-height: 1.5;">Avise que está chegando com 1 toque pelo app, agilize a chamada na portaria sem filas e gerencie autorizações especiais de retirada com total segurança.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Feature 3: Galeria de Momentos -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #8b5cf6; border-radius: 12px;">
                      <tr>
                        <td width="48" valign="top" style="padding: 14px 0 14px 16px; font-size: 22px; line-height: 1;">📸</td>
                        <td valign="top" style="padding: 14px 16px 14px 8px;">
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">Momentos &amp; Galeria da Turma</div>
                          <div style="font-size: 12.5px; color: #475569; line-height: 1.5;">Vivencie de perto os projetos, atividades pedagógicas, eventos e conquistas diárias através de registros fotográficos exclusivos.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Feature 4: Boletim, Notas e Frequência -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0ea5e9; border-radius: 12px;">
                      <tr>
                        <td width="48" valign="top" style="padding: 14px 0 14px 16px; font-size: 22px; line-height: 1;">📊</td>
                        <td valign="top" style="padding: 14px 16px 14px 8px;">
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">Boletim Digital, Notas &amp; Frequência Diária</div>
                          <div style="font-size: 12.5px; color: #475569; line-height: 1.5;">Consulte notas bimestrais, médias, evolução por disciplina e o controle de presença em sala de aula em tempo real.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Feature 5: Calendário Escolar, Provas Online & Simulados -->
                <tr>
                  <td style="padding-bottom: 10px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; border-radius: 12px;">
                      <tr>
                        <td width="48" valign="top" style="padding: 14px 0 14px 16px; font-size: 22px; line-height: 1;">📅</td>
                        <td valign="top" style="padding: 14px 16px 14px 8px;">
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">Calendário Escolar, Simulados &amp; Provas Online</div>
                          <div style="font-size: 12.5px; color: #475569; line-height: 1.5;">Fique por dentro das datas de provas, feriados, eventos letivos, além de acompanhar avaliações digitais e simulados.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Feature 6: Acompanhamento Pedagógico & Financeiro Digital -->
                <tr>
                  <td>
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #ec4899; border-radius: 12px;">
                      <tr>
                        <td width="48" valign="top" style="padding: 14px 0 14px 16px; font-size: 22px; line-height: 1;">💳</td>
                        <td valign="top" style="padding: 14px 16px 14px 8px;">
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px;">Acompanhamento Pedagógico &amp; Financeiro Digital</div>
                          <div style="font-size: 12.5px; color: #475569; line-height: 1.5;">Confirme ciência em registros pedagógicos com 1 clique e acesse mensalidades, PIX copia e cola, boletos e histórico financeiro com praticidade.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>

              <!-- PASSO A PASSO SIMPLES -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 26px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px;">
                <tr>
                  <td style="padding: 20px 22px;">
                    <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #1e3a8a; margin-bottom: 12px;">
                      🔐 Como realizar o seu Primeiro Acesso (3 passos):
                    </div>
                    <div style="font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 8px;">
                      <strong style="color: #2563eb;">1.</strong> Baixe o app <strong>Impacto EDU</strong> na loja do seu celular (links abaixo) ou clique em <em>&ldquo;Fazer Meu Primeiro Acesso Agora&rdquo;</em>.
                    </div>
                    <div style="font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 8px;">
                      <strong style="color: #2563eb;">2.</strong> Na tela inicial de login, toque na opção <strong>&ldquo;Primeiro Acesso&rdquo;</strong> e informe o seu e-mail (<code style="background-color: #e2e8f0; padding: 1px 5px; border-radius: 4px; font-size: 12px;">${emailEscaped}</code>).
                    </div>
                    <div style="font-size: 13px; color: #334155; line-height: 1.6;">
                      <strong style="color: #2563eb;">3.</strong> Digite o <strong>código de 6 dígitos</strong> que chegará no seu e-mail e defina sua senha de acesso!
                    </div>
                  </td>
                </tr>
              </table>

              <!-- BANNER DE DOWNLOAD DAS LOJAS OFICIAIS (iOS & ANDROID) -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0f172a; background-image: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; overflow: hidden;">
                <tr>
                  <td align="center" style="padding: 28px 22px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 800; color: #38bdf8 !important; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px;">
                      📲 DISPONÍVEL PARA IPHONE E ANDROID
                    </div>
                    <div style="font-size: 19px; font-weight: 900; color: #ffffff !important; margin-bottom: 8px;">
                      Baixe o Aplicativo Impacto EDU
                    </div>
                    <div style="font-size: 13px; color: #cbd5e1 !important; margin-bottom: 20px; line-height: 1.5;">
                      Toque na loja correspondente ao seu aparelho para instalar gratuitamente:
                    </div>

                    <!-- Botões Oficiais App Store e Google Play -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="padding: 6px;">
                          <a href="${appStoreUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #0f172a !important; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 800; font-size: 13.5px; border: 1px solid #ffffff;">
                            &#63743; Baixar na App Store (iOS)
                          </a>
                        </td>
                        <td align="center" style="padding: 6px;">
                          <a href="${googlePlayUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 800; font-size: 13.5px; border: 1px solid #059669;">
                            &#9654; Baixar no Google Play (Android)
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Links Diretos Explícitos -->
                    <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); font-size: 11.5px; color: #94a3b8 !important; line-height: 1.7; text-align: left;">
                      <div><strong style="color: #e2e8f0 !important;">iPhone (App Store):</strong> <a href="${appStoreUrl}" target="_blank" style="color: #60a5fa !important; text-decoration: underline; word-break: break-all;">${appStoreUrl}</a></div>
                      <div style="margin-top: 4px;"><strong style="color: #e2e8f0 !important;">Android (Google Play):</strong> <a href="${googlePlayUrl}" target="_blank" style="color: #34d399 !important; text-decoration: underline; word-break: break-all;">${googlePlayUrl}</a></div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Dúvidas / Suporte -->
              <div style="margin-top: 22px; font-size: 12.5px; color: #64748b; text-align: center; line-height: 1.55;">
                Em caso de dúvidas ou caso precise atualizar seu endereço de e-mail, nossa equipe da secretaria está à disposição para ajudar.
              </div>

            </td>
          </tr>

          <!-- RODAPÉ INSTITUCIONAL -->
          <tr>
            <td align="center" bgcolor="#f8fafc" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6; border-bottom-left-radius: 19px; border-bottom-right-radius: 19px;">
              <strong style="color: #475569;">COLÉGIO IMPACTO CENTRO DE ENSINO LTDA</strong> • CNPJ: 04.395.789/0001-88<br />
              Campo Grande - MS • Plataforma Oficial <a href="https://impacto-edu.net" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">impacto-edu.net</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
