'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Stethoscope, Scale, ShieldAlert, Lock, Handshake, BookOpen, FileText, HelpCircle, ChevronRight, Info } from 'lucide-react'

const DIREITOS_DATA = [
  {
    id: 'saude',
    title: 'Saúde e Bem-Estar',
    icon: Stethoscope,
    color: '#10b981',
    bg: '#ecfdf5',
    items: [
      { title: 'Licença Médica', desc: 'Entenda quando a licença médica é necessária, quais documentos apresentar e como funciona o processo de afastamento.', content: 'A licença médica é concedida mediante apresentação de atestado ou relatório médico válido. Para afastamentos de até 15 dias corridos, o pagamento do salário é de responsabilidade da instituição. A partir do 16º dia, o colaborador é encaminhado ao INSS para solicitar o benefício por incapacidade temporária (auxílio-doença). É obrigatório comunicar a liderança imediata assim que possível e enviar o atestado original ao RH.' },
      { title: 'Atestado Médico', desc: 'Saiba como enviar seu atestado, prazos para apresentação e como ocorre a validação pela empresa.', content: 'O atestado médico deve ser entregue ao RH ou inserido no sistema em até 48 horas após a ausência, contendo o CRM e a assinatura do médico, além do CID (se autorizado pelo colaborador) e o tempo de afastamento. Atrasos não justificados podem implicar no desconto dos dias de falta.' },
      { title: 'Afastamento pelo INSS', desc: 'Informações sobre afastamentos superiores a 15 dias, perícia médica, benefícios previdenciários e retorno ao trabalho.', content: 'Quando o afastamento médico ultrapassa 15 dias ininterruptos ou somados em um período de 60 dias pelo mesmo motivo, o colaborador é encaminhado à Previdência Social (INSS). O RH emitirá o requerimento para a perícia médica. Durante esse período, o contrato de trabalho fica suspenso. Após a alta do INSS, é obrigatório realizar o Exame de Retorno ao Trabalho antes de reassumir as funções.' },
      { title: 'Retorno ao Trabalho', desc: 'Conheça os procedimentos para retornar às atividades após um afastamento médico e quando será necessário realizar exame de retorno.', content: 'O Exame Médico de Retorno ao Trabalho é obrigatório no 1º dia de volta para ausências iguais ou superiores a 30 dias por motivo de doença ou acidente, seja ocupacional ou não. Sem a liberação do médico do trabalho (ASO de Apto), o colaborador não pode voltar a exercer suas atividades.' },
      { title: 'Saúde Mental', desc: 'Conheça seus direitos relacionados à saúde mental, acolhimento, atendimento psicológico e prevenção de riscos psicossociais.', content: 'A IMPACTO EDU valoriza a saúde mental de sua equipe. Colaboradores têm direito a acessar programas de apoio, como o Canal de Escuta, sem sofrer qualquer retaliação. Situações como burnout, estresse crônico ou transtornos de ansiedade relacionados ao trabalho são levadas a sério. O colaborador tem o direito de solicitar ajustes pontuais na sua rotina junto ao RH e à gestão em caso de adoecimento mental diagnosticado.' },
      { title: 'Acidente de Trabalho', desc: 'Orientações sobre como agir em caso de acidente, emissão da CAT (Comunicação de Acidente de Trabalho) e acompanhamento.', content: 'Acidente de trabalho é aquele que ocorre pelo exercício do trabalho a serviço da empresa, ou no trajeto de ida/volta. É fundamental comunicar imediatamente qualquer acidente à chefia direta e ao RH, mesmo os mais leves, para a emissão da CAT em até 1 dia útil. O colaborador acidentado tem direito a estabilidade de 12 meses após a cessação do auxílio-doença acidentário.' },
    ]
  },
  {
    id: 'trabalhistas',
    title: 'Direitos Trabalhistas',
    icon: Scale,
    color: '#3b82f6',
    bg: '#eff6ff',
    items: [
      { title: 'Jornada de Trabalho', desc: 'Informações sobre horários, intervalos, descanso semanal, banco de horas e horas extras.', content: 'A jornada de trabalho padrão deve respeitar os limites estabelecidos em contrato e na CLT (máximo 8h diárias e 44h semanais, salvo exceções). É assegurado o Descanso Semanal Remunerado, preferencialmente aos domingos. O controle de ponto é responsabilidade de cada um e deve refletir a jornada real trabalhada. O sistema de banco de horas (se aplicável) permite a compensação de horas excedentes em folgas.' },
      { title: 'Intervalos e Descanso', desc: 'Conheça seus direitos relacionados às pausas durante a jornada e períodos mínimos de descanso.', content: 'Jornadas entre 4h e 6h dão direito a um intervalo de 15 minutos. Jornadas acima de 6h exigem no mínimo 1 hora de intervalo para repouso ou alimentação. É obrigatório um descanso mínimo de 11 horas consecutivas entre duas jornadas de trabalho diferentes (intervalo interjornada).' },
      { title: 'Férias', desc: 'Como solicitar férias, regras legais, períodos aquisitivos e pagamento.', content: 'Após cada período de 12 meses (período aquisitivo), o colaborador tem direito a 30 dias de férias. As férias devem ser solicitadas com pelo menos 30 dias de antecedência e gozadas dentro dos próximos 12 meses (período concessivo). O pagamento é realizado até 2 dias antes do início e inclui o terço constitucional. Importante: Como o pagamento das férias é feito de forma adiantada, no mês de retorno ao trabalho o seu salário sofrerá o desconto referente aos dias em que você esteve de férias, pois você já recebeu por esses dias antecipadamente. Recomendamos sempre o planejamento financeiro para o mês de retorno.' },
      { title: 'Licença Maternidade', desc: 'Regras sobre período de afastamento, estabilidade no emprego, pausas para amamentação e adoção.', content: 'A colaboradora gestante tem direito à licença-maternidade de 120 dias corridos, sem prejuízo do emprego e do salário. O afastamento pode iniciar a partir do 28º dia antes do parto ou na data do nascimento. É garantida a estabilidade provisória no emprego desde a confirmação da gravidez até 5 meses após o parto. Após o retorno ao trabalho, a mãe tem direito a dois descansos especiais de 30 minutos cada um para amamentação, até o bebê completar 6 meses de idade. Para casos de adoção ou guarda judicial, a licença também é garantida. Comunique o RH e a gestão assim que confirmar a gravidez para o planejamento e entrega da documentação.' },
      { title: 'Outras Licenças Legais', desc: 'Informações sobre licença paternidade, casamento, falecimento de familiares, doação de sangue e outras previstas em lei.', content: 'A lei garante ausências remuneradas em casos específicos: licença paternidade (5 dias), casamento (3 dias consecutivos), falecimento de familiar direto (2 dias) e doação de sangue (1 dia a cada 12 meses). Todos os afastamentos devem ser comunicados ao RH com a devida documentação comprobatória.' },
      { title: 'Salário e Benefícios', desc: 'Conheça seus benefícios, formas de pagamento, descontos permitidos e demais informações trabalhistas.', content: 'O salário deve ser pago até o 5º dia útil do mês subsequente. O contracheque está disponível no sistema mensalmente. Descontos só são realizados mediante autorização legal (INSS, IRRF) ou prévia do colaborador (plano de saúde, vales, convênios). Benefícios como Vale Transporte e Vale Refeição/Alimentação seguem as normas da convenção coletiva.' },
      { title: 'Igualdade e Não Discriminação', desc: 'Todos os colaboradores têm direito a um ambiente de trabalho respeitoso, livre de discriminação, preconceito ou tratamento desigual.', content: 'A IMPACTO EDU repudia qualquer forma de discriminação por raça, gênero, idade, religião, orientação sexual, deficiência, entre outros. Promoções, reajustes e contratações são baseadas em mérito e competência. Desigualdade salarial para a mesma função é proibida. Qualquer discriminação deve ser reportada ao Canal de Denúncias.' },
    ]
  },
  {
    id: 'seguranca',
    title: 'Segurança e Ambiente de Trabalho',
    icon: ShieldAlert,
    color: '#f59e0b',
    bg: '#fef3c7',
    items: [
      { title: 'Ambiente Seguro', desc: 'Todo colaborador tem direito a trabalhar em um ambiente seguro, saudável e respeitoso.', content: 'A segurança no trabalho é responsabilidade de todos. A instituição deve fornecer um ambiente salubre, sem riscos iminentes. Caso identifique um fio desencapado, goteiras, ou estruturas instáveis, é direito e dever do colaborador notificar imediatamente a equipe de manutenção ou Segurança do Trabalho.' },
      { title: 'Assédio Moral', desc: 'Saiba identificar situações de assédio moral, seus direitos e como denunciar.', content: 'Assédio moral caracteriza-se por condutas abusivas, frequentes e intencionais que ferem a dignidade do trabalhador, como humilhações, isolamento, cobranças irreais, e insultos. O colaborador tem o direito a não ser submetido a essas situações. Denuncie qualquer prática suspeita pelos canais internos (ouvidoria/RH).' },
      { title: 'Assédio Sexual', desc: 'Conheça os canais disponíveis para denúncia, acolhimento e proteção.', content: 'Tolerância ZERO. Assédio sexual é crime e constitui violação severa do Código de Conduta. Se você for vítima ou presenciar comentários inadequados, avanços indesejados, favores atrelados à intimidade, denuncie no Canal de Denúncias (podendo ser anônimo). Oferecemos acolhimento e total sigilo no tratamento do caso.' },
      { title: 'Violência e Ameaças', desc: 'Procedimentos para comunicar situações de violência, intimidação ou comportamento inadequado.', content: 'O ambiente escolar e corporativo deve ser livre de qualquer violência física ou verbal. Se você sofrer ou presenciar ameaças por parte de colegas, lideranças, pais de alunos ou visitantes, notifique a segurança imediatamente e registre no Canal de Denúncias. A empresa garante proteção a quem denuncia de boa-fé.' },
      { title: 'Equipamentos de Segurança', desc: 'Informações sobre utilização correta de equipamentos de proteção, quando aplicável.', content: 'Para funções que exigem EPI (Equipamento de Proteção Individual), a instituição fornece os equipamentos gratuitamente. É direito do colaborador recebê-los e receber treinamento de como usar. Ao mesmo tempo, é dever inegociável utilizá-los corretamente durante a atividade.' },
      { title: 'Ergonomia', desc: 'Orientações para prevenção de lesões e melhoria das condições ergonômicas no ambiente de trabalho.', content: 'Todos têm direito a um posto de trabalho ergonomicamente adequado. Se seu mobiliário causa desconforto extremo ou pode gerar lesões (LER/DORT), solicite uma Análise Ergonômica do Trabalho (AET) ao RH. O cumprimento de pausas ativas (como alongamentos e intervalos visuais) também é incentivado.' },
    ]
  },
  {
    id: 'privacidade',
    title: 'Privacidade e Proteção de Dados',
    icon: Lock,
    color: '#8b5cf6',
    bg: '#f3e8ff',
    items: [
      { title: 'LGPD', desc: 'Entenda como seus dados pessoais são coletados, utilizados, armazenados e protegidos.', content: 'A Lei Geral de Proteção de Dados (LGPD) garante que seus dados pessoais e sensíveis sejam tratados com transparência e segurança. A IMPACTO EDU coleta dados apenas com finalidade específica (contratação, benefícios, segurança) e os armazena em servidores seguros.' },
      { title: 'Sigilo das Informações', desc: 'As informações pessoais e atendimentos relacionados à saúde são tratados de forma confidencial.', content: 'Documentos médicos, relatos de saúde mental e informações do Canal de Escuta são de caráter ultra-sigiloso. Seu gestor imediato não tem acesso automático ao seu histórico de saúde; o RH só compartilha o estritamente necessário (como as restrições ao trabalho ou dias de licença).' },
      { title: 'Quem pode acessar meus dados?', desc: 'Conheça quem possui autorização para visualizar suas informações e em quais situações.', content: 'O acesso aos seus dados no sistema de Gestão de Pessoas é restrito a profissionais autorizados do RH e do setor de Departamento Pessoal, apenas para execução de suas funções contratuais e fiscais. O seu acesso é individualizado através de login e senha.' },
      { title: 'Compartilhamento de Dados', desc: 'Entenda quando seus dados podem ser compartilhados e quais são seus direitos.', content: 'Seus dados só são compartilhados com terceiros (ex: planos de saúde, INSS, Receita Federal) para cumprimento de obrigação legal ou execução do contrato de trabalho. Não vendemos ou repassamos seus dados a empresas não relacionadas ao seu vínculo empregatício.' },
      { title: 'Solicitação de Dados Pessoais', desc: 'Saiba como solicitar acesso, correção ou exclusão de informações pessoais, quando permitido por lei.', content: 'O colaborador tem o direito de solicitar a atualização, correção de dados incompletos ou a portabilidade/exclusão (quando a lei permitir). Para isso, basta abrir um chamado de "Dúvida" no módulo de Atendimentos direcionado à Privacidade/DPO.' },
    ]
  },
  {
    id: 'relacionamento',
    title: 'Relacionamento com a Instituição',
    icon: Handshake,
    color: '#ec4899',
    bg: '#fdf2f8',
    items: [
      { title: 'Canal de Escuta', desc: 'Conheça o funcionamento do canal de acolhimento e apoio ao colaborador.', content: 'O Canal de Escuta é uma ferramenta voluntária. O colaborador tem o direito de marcar um horário para dialogar sobre questões profissionais e emocionais com psicólogos e analistas, buscando acolhimento e escuta empática.' },
      { title: 'Canal de Denúncias', desc: 'Informações sobre denúncias, anonimato, investigação e proteção contra retaliações.', content: 'Qualquer colaborador que suspeitar de desvios éticos, fraudes, assédios ou desrespeito tem o direito (e dever moral) de reportar no Canal de Denúncias. O canal permite denúncias anônimas e assegura que a investigação será neutra e confidencial.' },
      { title: 'Proteção contra Retaliação', desc: 'Nenhum colaborador poderá sofrer punições por realizar denúncias de boa-fé ou buscar apoio.', content: 'É expressamente proibida qualquer retaliação (demissão, rebaixamento, corte de privilégios ou assédio moral) a um colaborador que tenha efetuado uma denúncia de boa-fé ou servido de testemunha em investigações internas.' },
      { title: 'Direito ao Respeito', desc: 'Todos têm direito a um ambiente profissional baseado no respeito, ética e colaboração.', content: 'Independentemente da hierarquia, o respeito é a base de nossa cultura. Líderes e liderados devem tratar-se com cordialidade. Gritos, xingamentos ou ridicularização em público violam nossos princípios e dão justa causa para sanções.' },
      { title: 'Liberdade para Relatar Problemas', desc: 'O colaborador pode comunicar preocupações relacionadas ao ambiente de trabalho sem receio de represálias.', content: 'A política de "Portas Abertas" permite que o colaborador leve suas ideias, críticas e preocupações a qualquer nível hierárquico, incluindo ao RH ou à Diretoria, buscando melhorar as relações e os processos sem medo de censura.' },
    ]
  },
  {
    id: 'desenvolvimento',
    title: 'Desenvolvimento Profissional',
    icon: BookOpen,
    color: '#06b6d4',
    bg: '#cffafe',
    items: [
      { title: 'Treinamentos Obrigatórios', desc: 'Conheça os treinamentos exigidos pela instituição e pela legislação.', content: 'O colaborador tem direito de receber todos os treinamentos necessários para exercer sua função com segurança (como NR-01, prevenção a assédios, entre outros). Quando obrigatórios, devem ocorrer preferencialmente dentro do horário de trabalho.' },
      { title: 'Desenvolvimento Contínuo', desc: 'Informações sobre cursos, capacitações e programas de desenvolvimento profissional.', content: 'A instituição fomenta o aprendizado contínuo. Fique de olho na área de Treinamentos para acessar capacitações livres. O desenvolvimento de novas competências é valorizado internamente para futuras oportunidades.' },
      { title: 'Avaliações', desc: 'Entenda como funcionam avaliações de desempenho e feedbacks.', content: 'Todo colaborador tem direito de receber feedbacks estruturados sobre seu desempenho e de ser avaliado por critérios objetivos. Você tem o direito de discordar construtivamente e expor seu ponto de vista durante sua avaliação com a liderança.' },
    ]
  },
  {
    id: 'documentos',
    title: 'Documentos e Normas',
    icon: FileText,
    color: '#64748b',
    bg: '#f1f5f9',
    items: [
      { title: 'Código de Conduta', desc: 'Conheça os princípios éticos e comportamentais esperados de todos os colaboradores.', content: 'O Código de Ética e Conduta orienta o comportamento de todos. Ele prevê não apenas os deveres e proibições, mas principalmente os seus direitos perante a instituição, colegas de trabalho e sociedade.' },
      { title: 'Políticas Internas', desc: 'Acesse políticas relacionadas à saúde, segurança, convivência, assédio, privacidade e demais normas institucionais.', content: 'Sempre que uma política interna for lançada ou alterada, a instituição tem a obrigação de dar visibilidade. Todas as políticas atualizadas estarão centralizadas neste portal e no seu Manual do Colaborador.' },
      { title: 'Direitos e Deveres', desc: 'Resumo dos principais direitos e responsabilidades previstos nas políticas internas e legislação trabalhista.', content: 'Lembre-se: direitos e deveres caminham juntos. Ter compromisso com a qualidade, cumprir a jornada, cuidar dos equipamentos e agir de boa-fé são seus deveres, enquanto os benefícios, ambiente seguro e pagamento pontual são seus direitos inalienáveis.' },
    ]
  }
]

const FAQ_ITEMS = [
  { q: 'Posso apresentar atestado após o prazo?', a: 'O prazo padrão para entrega de atestados é de 48 horas após a ausência, conforme política interna, salvo em casos de força maior devidamente justificados.' },
  { q: 'Meu gestor terá acesso às minhas informações médicas?', a: 'Não. Informações como CID (Código Internacional de Doenças) e diagnósticos são protegidos por sigilo médico e acessados apenas pelo médico do trabalho ou RH autorizado.' },
  { q: 'Quem pode visualizar minha denúncia?', a: 'As denúncias são recebidas apenas pelo comitê de ética ou setor responsável pela apuração, que atua com total sigilo e imparcialidade.' },
  { q: 'Como funciona o sigilo das informações?', a: 'Todas as tratativas via Canal de Escuta ou RH relacionadas a problemas pessoais e saúde são estritamente confidenciais e protegidas pela LGPD.' },
  { q: 'Posso solicitar uma conversa confidencial com o RH?', a: 'Sim. Todo colaborador pode agendar um horário com a Gestão de Pessoas para tratar assuntos de forma particular e segura.' },
  { q: 'Como solicitar férias?', a: 'O pedido deve ser feito junto ao seu gestor direto e formalizado no setor de RH com pelo menos 30 dias de antecedência ao período desejado, respeitando as regras CLT.' },
  { q: 'O que fazer em caso de acidente de trabalho?', a: 'Notifique imediatamente seu gestor e o RH, mesmo que pareça leve. A instituição tem a obrigação de emitir a CAT (Comunicação de Acidente de Trabalho).' },
  { q: 'Como solicitar apoio psicológico?', a: 'Basta acessar a área de "Bem-Estar" no portal, ler as orientações e solicitar um "Apoio Psicológico" de forma sigilosa pelo módulo de Atendimentos.' },
  { q: 'Como funciona um afastamento pelo INSS?', a: 'Afastamentos acima de 15 dias consecutivos pelo mesmo motivo geram encaminhamento ao INSS. O RH fornecerá os documentos para que você agende sua perícia.' },
  { q: 'Posso denunciar anonimamente?', a: 'Sim. O Canal de Denúncias permite a opção de anonimato para garantir sua proteção ao relatar desvios de conduta.' },
  { q: 'O que fazer se me sentir sobrecarregado?', a: 'O primeiro passo é um diálogo transparente com seu gestor para reavaliação de demandas. Caso não resolva, você pode procurar o Canal de Escuta do RH.' },
  { q: 'Quais são meus direitos relacionados à saúde mental?', a: 'Você tem direito a um ambiente de trabalho que previna o adoecimento mental, com políticas de combate ao assédio, controle de jornada, respeito a pausas e canais de acolhimento.' },
  { q: 'Como exercer meus direitos previstos na LGPD?', a: 'Você pode solicitar acesso, alteração ou exclusão de dados desnecessários a qualquer momento através de um chamado específico para o encarregado de dados (DPO) via RH.' },
]

export default function DireitosPage() {
  const [activeSection, setActiveSection] = useState(DIREITOS_DATA[0].id)
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [openItem, setOpenItem] = useState<number | null>(null)

  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* HEADER */}
      <div style={{ 
        padding: '48px 40px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', filter: 'blur(40px)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #38bdf8, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(56, 189, 248, 0.3)' }}>
            <Scale size={40} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', fontFamily: "'Outfit', sans-serif" }}>
              Direitos do Colaborador
            </h1>
            <p style={{ margin: '8px 0 0 0', fontSize: 16, color: '#cbd5e1', lineHeight: 1.5, maxWidth: 600 }}>
              Um guia completo e transparente sobre seus direitos, benefícios, normas de segurança, privacidade e saúde no ambiente de trabalho.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* SIDEBAR TABS */}
        <div style={{ 
          width: 300, 
          background: '#fff', 
          borderRadius: 24, 
          padding: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          border: '1px solid #e2e8f0',
          flexShrink: 0,
          position: 'sticky',
          top: 32
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 12px' }}>
            Categorias
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DIREITOS_DATA.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveSection(cat.id)
                  setOpenItem(null)
                  setOpenFAQ(null)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 16,
                  border: 'none',
                  background: activeSection === cat.id ? cat.bg : 'transparent',
                  color: activeSection === cat.id ? cat.color : '#64748b',
                  fontWeight: activeSection === cat.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
                onMouseEnter={e => {
                  if (activeSection !== cat.id) e.currentTarget.style.background = '#f8fafc'
                }}
                onMouseLeave={e => {
                  if (activeSection !== cat.id) e.currentTarget.style.background = 'transparent'
                }}
              >
                <cat.icon size={18} strokeWidth={activeSection === cat.id ? 2.5 : 2} />
                <span style={{ flex: 1, fontSize: 14 }}>{cat.title}</span>
                {activeSection === cat.id && <ChevronRight size={16} />}
              </button>
            ))}

            <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />

            <button
              onClick={() => setActiveSection('faq')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 16,
                border: 'none',
                background: activeSection === 'faq' ? '#fdf2f8' : 'transparent',
                color: activeSection === 'faq' ? '#db2777' : '#64748b',
                fontWeight: activeSection === 'faq' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
            >
              <HelpCircle size={18} />
              <span style={{ flex: 1, fontSize: 14 }}>Perguntas Frequentes</span>
              {activeSection === 'faq' && <ChevronRight size={16} />}
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <AnimatePresence mode="wait">
            {activeSection !== 'faq' ? (
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                {DIREITOS_DATA.find(d => d.id === activeSection)?.items.map((item, idx) => {
                  const isOpen = openItem === idx
                  const sectionColor = DIREITOS_DATA.find(d => d.id === activeSection)?.color
                  return (
                    <div key={idx} style={{ 
                      background: '#fff', 
                      borderRadius: 20, 
                      border: '1px solid',
                      borderColor: isOpen ? sectionColor : '#e2e8f0',
                      boxShadow: isOpen ? `0 4px 20px ${sectionColor}15` : '0 4px 12px rgba(0,0,0,0.02)',
                      overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}>
                      <button 
                        onClick={() => setOpenItem(isOpen ? null : idx)}
                        style={{
                          width: '100%',
                          padding: 24,
                          display: 'flex',
                          gap: 20,
                          alignItems: 'center',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ 
                          width: 48, height: 48, borderRadius: 14, 
                          background: DIREITOS_DATA.find(d => d.id === activeSection)?.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Info size={24} color={sectionColor} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700, color: isOpen ? sectionColor : '#0f172a' }}>{item.title}</h3>
                          <p style={{ margin: 0, fontSize: 15, color: '#64748b', lineHeight: 1.5 }}>{item.desc}</p>
                        </div>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: '50%', background: isOpen ? `${sectionColor}15` : '#f1f5f9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s'
                        }}>
                          <ChevronRight size={18} color={isOpen ? sectionColor : '#64748b'} />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ padding: '0 24px 24px 24px' }}>
                              <div style={{ height: 1, background: '#f1f5f9', marginBottom: 16 }} />
                              <p style={{ margin: 0, fontSize: 15, color: '#334155', lineHeight: 1.7 }}>
                                {item.content}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </motion.div>
            ) : (
              <motion.div
                key="faq"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ marginBottom: 16, padding: '0 8px' }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Perguntas Frequentes (Direitos)</h2>
                  <p style={{ margin: '8px 0 0 0', color: '#64748b' }}>As dúvidas mais comuns sobre os direitos e deveres dos colaboradores.</p>
                </div>

                {FAQ_ITEMS.map((item, idx) => {
                  const isOpen = openFAQ === idx
                  return (
                    <div key={idx} style={{ 
                      background: '#fff', 
                      borderRadius: 16, 
                      border: '1px solid',
                      borderColor: isOpen ? '#db2777' : '#e2e8f0',
                      overflow: 'hidden',
                      boxShadow: isOpen ? '0 4px 20px rgba(219, 39, 119, 0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s'
                    }}>
                      <button 
                        onClick={() => setOpenFAQ(isOpen ? null : idx)}
                        style={{ 
                          width: '100%', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 700, color: isOpen ? '#db2777' : '#1e293b', paddingRight: 16 }}>{item.q}</span>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: '50%', background: isOpen ? '#fdf2f8' : '#f1f5f9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s'
                        }}>
                          <ChevronRight size={18} color={isOpen ? '#db2777' : '#64748b'} />
                        </div>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ padding: '0 24px 24px 24px' }}>
                              <div style={{ height: 1, background: '#f1f5f9', marginBottom: 16 }} />
                              <p style={{ margin: 0, fontSize: 15, color: '#475569', lineHeight: 1.7 }}>{item.a}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
