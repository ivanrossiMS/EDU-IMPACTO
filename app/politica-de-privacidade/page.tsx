import React from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  UserCheck,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  GraduationCap
} from 'lucide-react'

export const metadata = {
  title: 'Política de Privacidade | Impacto EDU - Colégio Impacto',
  description: 'Política de Privacidade e Proteção de Dados Pessoais do aplicativo Impacto EDU (Colégio Impacto).',
}

export default function PoliticaPrivacidadePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: '32px 16px 64px 16px',
      }}
    >
      <div
        style={{
          maxWidth: '840px',
          margin: '0 auto',
        }}
      >
        {/* ── HEADER SUPERIOR ──────────────────────────────────────────────── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px 28px',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src="/logo-impacto.png"
              alt="Colégio Impacto"
              style={{
                height: '48px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <div style={{ width: '1.5px', height: '40px', background: '#e2e8f0' }} />
            <div>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  color: '#0f172a',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Política de Privacidade
              </h1>
              <p
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: 600,
                  margin: '2px 0 0 0',
                }}
              >
                Impacto EDU • Colégio Impacto (LGPD)
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '6px 12px',
              borderRadius: '100px',
              fontSize: '12px',
              fontWeight: 800,
              color: '#059669',
            }}
          >
            <ShieldCheck size={16} />
            <span>Documento Atualizado: Agosto/2026</span>
          </div>
        </div>

        {/* ── CONTEÚDO PRINCIPAL ───────────────────────────────────────────── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '36px 32px',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            lineHeight: 1.7,
            fontSize: '14.5px',
            color: '#334155',
          }}
        >
          {/* Introdução */}
          <section style={{ marginBottom: '32px' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '15px' }}>
              O <strong>Colégio Impacto</strong> (composto pelas entidades{' '}
              <em>COLÉGIO IMPACTO CENTRO DE ENSINO LTDA</em> — CNPJ: 04.395.789/0001-88 e{' '}
              <em>CENTRO DE ENSINO IMPACTO LTDA</em> — CNPJ: 04.397.021/0001-43) valoriza a privacidade e a
              segurança das informações de seus alunos, pais, responsáveis legais e colaboradores.
            </p>
            <p style={{ margin: 0 }}>
              Esta Política de Privacidade explica de forma clara e transparente como coletamos, utilizamos,
              armazenamos, protegemos e tratamos os dados pessoais através do aplicativo{' '}
              <strong>Impacto EDU</strong> e de nossos sistemas integrados, em estrita conformidade com a{' '}
              <strong>Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)</strong> e as diretrizes
              de privacidade da Apple App Store e Google Play Store.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '28px 0' }} />

          {/* 1. Controlador dos Dados */}
          <section style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Building2 size={20} color="#4f46e5" />
              1. Identificação do Controlador
            </h2>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px 20px',
                fontSize: '13.5px',
              }}
            >
              <p style={{ margin: '0 0 6px 0' }}>
                <strong>Razão Social:</strong> COLÉGIO IMPACTO CENTRO DE ENSINO LTDA / CENTRO DE ENSINO IMPACTO LTDA
              </p>
              <p style={{ margin: '0 0 6px 0' }}>
                <strong>CNPJ:</strong> 04.395.789/0001-88 (Infantil/Fundamental) • 04.397.021/0001-43 (Ensino Médio)
              </p>
              <p style={{ margin: '0 0 6px 0' }}>
                <strong>Endereço:</strong> Rua Alagoas, 1081 - Jardim dos Estados, Campo Grande/MS - CEP 79020-121
              </p>
              <p style={{ margin: '0 0 6px 0' }}>
                <strong>E-mail de Contato / Encarregado de Dados (DPO):</strong>{' '}
                <a href="mailto:impacto@colegioimpacto.net" style={{ color: '#4f46e5', fontWeight: 700 }}>
                  impacto@colegioimpacto.net
                </a>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Telefone:</strong> (67) 3025-5585
              </p>
            </div>
          </section>

          {/* 2. Dados Coletados */}
          <section style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FileText size={20} color="#4f46e5" />
              2. Dados Coletados e Finalidades do Tratamento
            </h2>
            <p style={{ margin: '0 0 12px 0' }}>
              O aplicativo <strong>Impacto EDU</strong> coleta e processa apenas os dados estritamente necessários
              para a execução do contrato de prestação de serviços educacionais e garantia da segurança dos alunos:
            </p>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Dados Cadastrais e de Identificação:</strong> Nome completo, CPF, e-mail, telefone de contato,
                endereço e data de nascimento de pais, responsáveis legais e estudantes.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Dados Acadêmicos e Pedagógicos:</strong> Notas, frequência escolar diária, turma, série,
                ocorrências pedagógicas, comunicados institucionais e calendário de avaliações.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Segurança, Portaria e Controle de Acesso:</strong> Registro de horários de entrada e saída,
                autorizações de saída e identificação de pessoas autorizadas para retirada de menores.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Dados Financeiros e Fiscais:</strong> Histórico de faturas, comprovantes de quitação de
                mensalidades e geração de declarações de Imposto de Renda (IRPF) processados via integração segura com a
                plataforma <em>isaac</em>. Não armazenamos números de cartão de crédito.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Notificações Push e Identificadores Técnicos:</strong> Identificador único anônimo de
                dispositivo (Push Token via OneSignal) para envio em tempo real de avisos escolares urgentes, recados e
                alertas de saída da portaria.
              </li>
            </ul>
          </section>

          {/* 3. Compartilhamento de Dados e Não Comercialização */}
          <section style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Lock size={20} color="#4f46e5" />
              3. Não Comercialização e Compartilhamento Seguro
            </h2>
            <div
              style={{
                background: '#eef2ff',
                border: '1.5px solid #c7d2fe',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '14px',
                color: '#312e81',
                fontWeight: 700,
              }}
            >
              🔒 O Colégio Impacto NUNCA comercializa, aluga, vende ou repassa informações pessoais ou acadêmicas de
              alunos e responsáveis para empresas de publicidade ou marketing de terceiros.
            </div>
            <p style={{ margin: 0 }}>
              O compartilhamento de dados ocorre exclusivamente com provedores essenciais para a operação da escola, sob
              rigorosos contratos de confidencialidade e segurança da informação:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li>
                <strong>isaac (Edux21 Instituição de Pagamento):</strong> Para viabilização de cobranças, conciliação e
                pagamento de mensalidades escolares via Pix ou boleto.
              </li>
              <li>
                <strong>OneSignal:</strong> Para entrega de notificações push seguras no smartphone do responsável.
              </li>
              <li>
                <strong>Órgãos Públicos e Regulatórios:</strong> Quando exigido por lei ou determinação judicial perante
                o Ministério da Educação (MEC) ou Secretarias de Educação.
              </li>
            </ul>
          </section>

          {/* 4. Segurança e Armazenamento */}
          <section style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldCheck size={20} color="#4f46e5" />
              4. Medidas de Segurança e Criptografia
            </h2>
            <p style={{ margin: '0 0 10px 0' }}>
              Adotamos medidas técnicas, administrativas e organizacionais de padrão corporativo para proteger os dados
              pessoais contra acessos não autorizados, destruição, perda, alteração ou qualquer forma de tratamento
              inadequado:
            </p>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              <li>Criptografia de ponta a ponta em trânsito utilizando protocolo seguro <strong>HTTPS / TLS 1.3</strong>.</li>
              <li>Armazenamento em banco de dados isolado com criptografia em repouso (AES-256).</li>
              <li>Controle de acesso rigoroso por níveis de privilégio (Role-Based Access Control - RBAC).</li>
              <li>Autenticação segura e registro de logs de auditoria para prevenção a fraudes.</li>
            </ul>
          </section>

          {/* 5. Direitos do Titular (LGPD) */}
          <section style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <UserCheck size={20} color="#4f46e5" />
              5. Seus Direitos como Titular dos Dados (LGPD)
            </h2>
            <p style={{ margin: '0 0 10px 0' }}>
              De acordo com a Lei Geral de Proteção de Dados (Art. 18 da LGPD), você tem o direito de, a qualquer
              momento e mediante requisição:
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px',
                marginTop: '10px',
              }}
            >
              {[
                'Confirmação da existência de tratamento',
                'Acesso facilitado aos dados cadastrais',
                'Correção de dados incompletos ou desatualizados',
                'Anonimização, bloqueio ou eliminação de dados excessivos',
                'Portabilidade dos dados a outro prestador',
                'Revogação de consentimento a qualquer momento',
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} color="#4f46e5" style={{ flexShrink: 0 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 6. Exclusão de Conta e Eliminação de Dados (Exigência Apple / Google) */}
          <section style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Eye size={20} color="#4f46e5" />
              6. Exclusão de Conta e Retenção de Dados
            </h2>
            <p style={{ margin: '0 0 10px 0' }}>
              O titular da conta pode solicitar o encerramento do acesso e a exclusão dos dados de seu aplicativo a
              qualquer momento:
            </p>
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '14px',
                padding: '14px 18px',
                fontSize: '13.5px',
                color: '#991b1b',
              }}
            >
              <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>Como solicitar a exclusão da sua conta:</p>
              <p style={{ margin: 0 }}>
                Envie um e-mail para{' '}
                <a href="mailto:impacto@colegioimpacto.net" style={{ color: '#b91c1c', fontWeight: 800 }}>
                  impacto@colegioimpacto.net
                </a>{' '}
                com o assunto <strong>"Solicitação de Exclusão de Conta - Impacto EDU"</strong> informando seu nome e
                CPF cadastrado. A solicitação será processada em até 5 dias úteis, resguardando-se os dados acadêmicos e
                fiscais que a instituição é legalmente obrigada a manter por determinação do Ministério da Educação
                (MEC) e da legislação fiscal brasileira.
              </p>
            </div>
          </section>

          {/* 7. Contato e DPO */}
          <section>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Mail size={20} color="#4f46e5" />
              7. Fale com Nosso Encarregado de Proteção de Dados (DPO)
            </h2>
            <p style={{ margin: '0 0 10px 0' }}>
              Caso tenha qualquer dúvida sobre esta Política de Privacidade ou deseje exercer algum dos seus direitos
              garantidos pela LGPD, entre em contato conosco:
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
                <Mail size={16} color="#4f46e5" />
                <a href="mailto:impacto@colegioimpacto.net" style={{ color: '#4f46e5', fontWeight: 700 }}>
                  impacto@colegioimpacto.net
                </a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
                <Phone size={16} color="#4f46e5" />
                <span style={{ fontWeight: 700 }}>(67) 3025-5585</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
                <MapPin size={16} color="#4f46e5" />
                <span>Rua Alagoas, 1081 - Jardim dos Estados, Campo Grande/MS</span>
              </div>
            </div>
          </section>
        </div>

        {/* ── FOOTER DA PÁGINA ────────────────────────────────────────────── */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} Colégio Impacto. Todos os direitos reservados.
          </p>
          <p style={{ margin: '4px 0 0 0' }}>
            Formando valores. Inspirando futuros.
          </p>
        </div>
      </div>
    </div>
  )
}
